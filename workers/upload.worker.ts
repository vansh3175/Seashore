/* eslint-disable no-restricted-globals */
import { 
  initRecordingInDB, 
  saveChunkToDB, 
  markChunkUploaded, 
  clearRecordingFromDB,
  getPendingRecordings, 
  getRecordingChunks    
} from '../utils/db';

const PART_SIZE = 5 * 1024 * 1024; // EXACT 5MB

interface BufferedChunk {
  blob: Blob;
  sessionId: string;
  sequenceId: number; // Unique sequence number for this chunk
}

interface PartInfo {
  PartNumber: number;
  ETag: string;
}

// Global state for current upload
let uploadId: string | null = null;
let fullKey: string | null = null;
let recordingId: string | null = null;
let apiBase: string | null = null;
let multipartStarted = false;

let studioId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let recordingType = "camera";

// Track uploaded parts for final completion
let parts: PartInfo[] = [];
let partNumber = 1;

// Buffer management
let buffer: BufferedChunk[] = [];
let bufferSize = 0;
let sequenceIdCounter = 1;

// Task queue for sequential processing
let taskQueue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "INIT") {
    studioId = payload.studioId;
    sessionId = payload.sessionId;
    userId = payload.userId;
    apiBase = payload.apiBase;
    recordingType = payload.recordingType || "camera";
  } 
  else if (type === "ADD_CHUNK") {
    taskQueue = taskQueue.then(() => handleChunk(payload.blob));
  } 
  else if (type === "FINALIZE") {
    taskQueue = taskQueue.then(() =>
      finalize(payload.startedAt, payload.endedAt, payload.duration)
    );
  } 
  else if (type === "RECOVER") {
    apiBase = payload.apiBase;
    taskQueue = taskQueue.then(() => handleRecover(payload.sessionId));
  }

  taskQueue = taskQueue.catch(err => {
    console.error("[WORKER ERROR]", err);
    self.postMessage({ type: "ERROR", error: err?.message || String(err) });
  });
};

// --------------------------------------------------
// CHUNK HANDLING
// --------------------------------------------------
async function handleChunk(blob: Blob) {
  if (!blob.size) return;

  const sequenceId = sequenceIdCounter++;

  // Save chunk to IDB as "pending"
  if (sessionId) {
    await saveChunkToDB(sessionId, sequenceId, blob);
  }

  // Add to buffer for processing
  buffer.push({ blob, sessionId: sessionId || "", sequenceId });
  bufferSize += blob.size;

  // If we haven't started multipart yet and we have enough data, start it
  if (!multipartStarted && bufferSize >= PART_SIZE) {
    await startMultipart();
  }

  // If multipart is active, upload parts that are ready
  if (multipartStarted) {
    await uploadReadyParts();
  }
}

async function uploadReadyParts() {
  // While buffer has enough for a full 5MB part, upload it
  while (bufferSize >= PART_SIZE) {
    await uploadExactPart();
  }
}

// --------------------------------------------------
// START MULTIPART
// --------------------------------------------------
async function startMultipart(startedAt?: string) {
  try {
    const res = await fetch(`${apiBase}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INIT",
        studioId,
        sessionId,
        userId,
        type: recordingType,
        startedAt: startedAt || new Date().toISOString()
      })
    });

    if (!res.ok) {
      throw new Error(`INIT failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    uploadId = data.uploadId;
    recordingId = data.recordingId;
    fullKey = data.fullKey;

    // Save recording metadata to IDB for recovery
    if (sessionId && uploadId && fullKey) {
      await initRecordingInDB(sessionId, uploadId, fullKey);
    }

    multipartStarted = true;
    self.postMessage({ type: "INIT_SUCCESS", uploadId, recordingId });
  } catch (err) {
    throw new Error(`Failed to start multipart upload: ${err}`);
  }
}

// --------------------------------------------------
// UPLOAD EXACT 5MB PART (WITH PROPER SLICING)
// --------------------------------------------------
async function uploadExactPart() {
  if (!multipartStarted || bufferSize < PART_SIZE || !sessionId) {
    return;
  }

  const blobs: Blob[] = [];
  const uploadedSequenceIds: Set<number> = new Set();
  let size = 0;
  let currentChunkIndex = 0;

  // Build exactly 5MB from buffer, tracking which sequence IDs we use
  while (currentChunkIndex < buffer.length && size < PART_SIZE) {
    const item = buffer[currentChunkIndex];
    const need = PART_SIZE - size;

    if (item.blob.size <= need) {
      // Entire chunk fits in this part
      blobs.push(item.blob);
      uploadedSequenceIds.add(item.sequenceId);
      size += item.blob.size;
      currentChunkIndex++;
    } else {
      // Chunk needs to be sliced - take what we need
      blobs.push(item.blob.slice(0, need));
      uploadedSequenceIds.add(item.sequenceId);
      // Keep the rest of the chunk in the buffer
      buffer[currentChunkIndex] = {
        ...item,
        blob: item.blob.slice(need)
      };
      size += need;
    }
  }

  // Remove fully consumed chunks from buffer
  buffer = buffer.slice(currentChunkIndex);
  bufferSize -= PART_SIZE;

  const blob = new Blob(blobs, { type: "video/webm" });
  const thisPartNumber = partNumber++;

  let putRes: Response | undefined;
  let lastError: any;

  // Get signed URL from server
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const signRes = await fetch(`${apiBase}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PART",
          uploadId,
          fullKey,
          partNumber: thisPartNumber,
          recordingId
        })
      });

      if (!signRes.ok) {
        throw new Error(`Failed to get signed URL: ${signRes.status}`);
      }
      const { signedUrl } = await signRes.json();

      // Upload to R2 with signed URL
      putRes = await fetch(signedUrl, {
        method: "PUT",
        body: blob
      });

      if (putRes.ok) break;
      throw new Error(`PUT failed ${putRes.status}`);
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  if (!putRes || !putRes.ok) {
    throw new Error(`Failed to upload part ${thisPartNumber} after 3 attempts: ${lastError}`);
  }

  // Extract ETag from response
  const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
  if (!etag) {
    throw new Error(`No ETag returned for part ${thisPartNumber}`);
  }

  parts.push({ PartNumber: thisPartNumber, ETag: etag });

  // Mark all chunks that were fully or partially uploaded as uploaded in IDB
  for (const sequenceId of uploadedSequenceIds) {
    await markChunkUploaded(sessionId, sequenceId, etag);
  }

  self.postMessage({ 
    type: "PART_UPLOADED", 
    partNumber: thisPartNumber,
    totalParts: parts.length
  });
}

// --------------------------------------------------
// FINALIZE - Complete multipart or handle single upload
// --------------------------------------------------
async function finalize(startedAt?: string, endedAt?: string, duration?: number) {
  // Case 1: Multipart was never started (small file)
  if (!multipartStarted) {
    const finalBlob = new Blob(buffer.map(b => b.blob), { type: "video/webm" });
    if (!finalBlob.size) {
      throw new Error("No data to upload");
    }

    const params = new URLSearchParams({
      studioId: studioId || "",
      sessionId: sessionId || "",
      userId: userId || "",
      recordingId: recordingId || sessionId || "",
      type: recordingType,
      startedAt: startedAt || new Date().toISOString(),
      endedAt: endedAt || new Date().toISOString(),
      duration: String(duration || 0)
    });

    const res = await fetch(`${apiBase}/api/upload/single?${params}`, {
      method: "PUT",
      headers: { "Content-Type": "video/webm" },
      body: finalBlob
    });

    if (!res.ok) {
      throw new Error(`Single upload failed: ${res.status}`);
    }

    const result = await res.json();
    if (sessionId) {
      await clearRecordingFromDB(sessionId);
    }

    buffer = [];
    bufferSize = 0;

    self.postMessage({ 
      type: "UPLOAD_COMPLETE", 
      location: result.location,
      fileSize: finalBlob.size
    });
    return;
  }

  // Case 2: Multipart was started - handle any remaining buffer data
  if (bufferSize > 0 && sessionId) {
    const blob = new Blob(buffer.map(b => b.blob), { type: "video/webm" });
    const thisPartNumber = partNumber++;
    const uploadedSequenceIds = new Set(buffer.map(b => b.sequenceId));

    let putRes: Response | undefined;
    let lastError: any;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const signRes = await fetch(`${apiBase}/api/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "PART",
            uploadId,
            fullKey,
            partNumber: thisPartNumber,
            recordingId
          })
        });

        if (!signRes.ok) throw new Error("Failed to get signed URL for final part");
        const { signedUrl } = await signRes.json();

        putRes = await fetch(signedUrl, {
          method: "PUT",
          body: blob
        });

        if (putRes.ok) break;
        throw new Error(`Final PUT failed ${putRes.status}`);
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (!putRes?.ok) {
      throw new Error(`Final part upload failed: ${lastError}`);
    }

    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: thisPartNumber, ETag: etag });

    // Mark remaining chunks as uploaded
    for (const sequenceId of uploadedSequenceIds) {
      await markChunkUploaded(sessionId, sequenceId, etag);
    }
  }

  // Case 3: Complete the multipart upload
  if (parts.length > 0) {
    parts.sort((a, b) => a.PartNumber - b.PartNumber);

    const completeRes = await fetch(`${apiBase}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "COMPLETE",
        uploadId,
        fullKey,
        parts,
        recordingId,
        endedAt: endedAt || new Date().toISOString(),
        duration: duration || 0
      })
    });

    if (!completeRes.ok) {
      throw new Error(`Complete failed: ${await completeRes.text()}`);
    }

    const result = await completeRes.json();

    // Clear IDB
    if (sessionId) {
      await clearRecordingFromDB(sessionId);
    }

    // Reset state
    buffer = [];
    bufferSize = 0;
    parts = [];
    partNumber = 1;
    uploadId = null;
    fullKey = null;
    recordingId = null;
    multipartStarted = false;

    self.postMessage({ 
      type: "UPLOAD_COMPLETE", 
      location: result.location,
      fileSize: result.fileSize
    });
  }
}

// --------------------------------------------------
// RECOVERY - Resume interrupted multipart upload
// --------------------------------------------------
async function handleRecover(targetSessionId: string) {
  try {
    // Step 1: Get pending recording metadata from IDB
    const recordings = await getPendingRecordings();
    const recording = recordings.find(r => r.sessionId === targetSessionId);
    
    if (!recording) {
      throw new Error(`No recovery data found for session ${targetSessionId}`);
    }

    // Step 2: Restore upload state
    uploadId = recording.uploadId;
    fullKey = recording.s3Key;
    sessionId = recording.sessionId;
    multipartStarted = true;
    parts = [];
    partNumber = 1;
    buffer = [];
    bufferSize = 0;

    self.postMessage({ 
      type: "RECOVERY_STARTED", 
      sessionId,
      uploadId 
    });

    // Step 3: Get all pending chunks from IDB
    const chunks = await getRecordingChunks(targetSessionId);
    if (chunks.length === 0) {
      throw new Error(`No chunks found for recovery of session ${targetSessionId}`);
    }

    // Step 4: Sort chunks by sequence ID and group into parts
    const pendingChunks = chunks.filter(c => c.status === 'pending');
    if (pendingChunks.length === 0) {
      // All chunks already uploaded, just complete the multipart
      self.postMessage({ 
        type: "RECOVERY_COMPLETE_READY", 
        message: "All chunks already uploaded, ready to complete"
      });
      // Call finalize with no buffer to complete
      await finalize();
      return;
    }

    pendingChunks.sort((a, b) => a.sequenceId - b.sequenceId);

    // Step 5: Reassemble buffer from pending chunks
    for (const chunk of pendingChunks) {
      buffer.push({
        blob: chunk.blob,
        sessionId: chunk.sessionId,
        sequenceId: chunk.sequenceId
      });
      bufferSize += chunk.blob.size;
    }

    self.postMessage({ 
      type: "RECOVERY_BUFFER_LOADED", 
      pendingChunks: pendingChunks.length,
      bufferSize
    });

    // Step 6: Upload ready parts from recovered buffer
    while (bufferSize >= PART_SIZE) {
      await uploadExactPart();
    }

    self.postMessage({ 
      type: "RECOVERY_PARTS_UPLOADED", 
      uploadedParts: parts.length
    });
  } catch (err) {
    throw new Error(`Recovery failed: ${err}`);
  }
}
