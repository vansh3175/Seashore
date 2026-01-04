/* eslint-disable no-restricted-globals */
import { 
  initRecordingInDB, 
  saveChunkToDB, 
  markChunkUploaded, 
  clearRecordingFromDB,
  getPendingRecordings, 
  getRecordingChunks    
} from '../utils/db';

const PART_SIZE = 5 * 1024 * 1024; // EXACT 5MB for R2 compatibility

// State
let uploadId: string | null = null;
let fullKey: string | null = null;
let recordingId: string | null = null;
let apiBase: string | null = null;
let multipartStarted = false;

// Context
let studioId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let recordingType: string = "camera"; 

// Buffers
let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

// Buffer: { blob, id } - id is the seqId for IDB
let buffer: { blob: Blob; id: number }[] = []; 
let bufferSize = 0;
let sequenceNumber = 1; 

// Queue to serialize operations
let taskQueue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "INIT") {
    studioId = payload.studioId;
    sessionId = payload.sessionId;
    userId = payload.userId;
    apiBase = payload.apiBase;
    recordingType = payload.recordingType || "camera"; 
    
    // We don't start multipart immediately. We wait until we have > 5MB 
    // or until finalize is called (for single PUT).
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

  taskQueue = taskQueue.catch((err: any) => {
    self.postMessage({ type: "ERROR", error: err?.message || String(err) });
  });
};

// ----------------------------------------------
// 1️⃣ CHUNK HANDLING
// ----------------------------------------------
async function handleChunk(blob: Blob) {
  if (!blob.size) return;

  const id = sequenceNumber++;
  
  // Save strict raw chunk to IDB immediately for safety using sessionId
  if (sessionId) {
    await saveChunkToDB(sessionId, id, blob);
  }

  await processBuffer(blob, id);
}

async function processBuffer(blob: Blob, id: number) {
  buffer.push({ blob, id });
  bufferSize += blob.size;

  // Start multipart only if we haven't yet, and we have enough data
  if (!multipartStarted && bufferSize >= PART_SIZE) {
    await startMultipart();
  }

  // If multipart is active, upload any full 5MB parts we can form
  if (multipartStarted) {
    while (bufferSize >= PART_SIZE) {
      await uploadExactPart();
    }
  }
}

// ----------------------------------------------
// 2️⃣ START MULTIPART SESSION
// ----------------------------------------------
async function startMultipart(startedAt?: string) {
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

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  uploadId = data.uploadId;
  recordingId = data.recordingId;
  fullKey = data.fullKey;

  // Track in DB that we have a live multipart upload
  if (recordingId && uploadId && fullKey && sessionId) {
    // Note: initRecordingInDB likely uses sessionId as the primary key/index for looking up recording info later
    await initRecordingInDB(sessionId, uploadId, fullKey);
  }
  
  multipartStarted = true;
  self.postMessage({ type: "INIT_SUCCESS", uploadId });
}

// ----------------------------------------------
// 3️⃣ UPLOAD EXACT 5MB PART (The Slicing Logic)
// ----------------------------------------------
async function uploadExactPart() {
  const blobsToUpload: Blob[] = [];
  const chunkIdsToMark: number[] = [];
  let currentPartSize = 0;

  // Consume buffer until we have exactly PART_SIZE
  // Note: We use 'buffer[0]' peeking to ensure we don't drop data if slicing
  while (buffer.length > 0 && currentPartSize < PART_SIZE) {
    const item = buffer[0]; 
    const needed = PART_SIZE - currentPartSize;

    if (item.blob.size <= needed) {
      // Take the whole chunk
      blobsToUpload.push(item.blob);
      chunkIdsToMark.push(item.id);
      currentPartSize += item.blob.size;
      buffer.shift(); // Remove from buffer as it's fully consumed
    } else {
      // Slice the chunk
      const slice = item.blob.slice(0, needed);
      const remainder = item.blob.slice(needed);
      
      blobsToUpload.push(slice);
      // We do NOT mark this ID as uploaded yet because part of it is still in buffer.
      // We only mark chunks that are *fully* uploaded.
      
      currentPartSize += slice.size;
      
      // Update the head of the buffer with the remainder
      // Crucial: Keep the same ID for the remainder so we track it eventually
      buffer[0] = { blob: remainder, id: item.id }; 
    }
  }

  bufferSize -= PART_SIZE;

  // --- Perform Upload ---
  const thisPartNumber = partNumber++;
  
  const res = await fetch(`${apiBase}/api/upload`, {
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

  if (!res.ok) throw new Error("Failed to get signed URL");
  const { signedUrl } = await res.json();

  const compositeBlob = new Blob(blobsToUpload);
  
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    body: compositeBlob
  });

  if (!putRes.ok) throw new Error("PUT Part failed");

  const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
  parts.push({ PartNumber: thisPartNumber, ETag: etag });

  // Mark fully consumed chunks as uploaded in IDB
  // FIX: Use sessionId (the IDB key), not recordingId (the UUID)
  if (sessionId) {
    for (const id of chunkIdsToMark) {
      // Don't await inside loop to speed up? IDB ops are fast, waiting ensures consistency.
      await markChunkUploaded(sessionId, id, etag);
    }
  }

  self.postMessage({ type: "PART_UPLOADED", partNumber: thisPartNumber });
}

// ----------------------------------------------
// 4️⃣ FINALIZE
// ----------------------------------------------
async function finalize(startedAt?: string, endedAt?: string, duration?: number) {
  // CASE A: Small file (never triggered multipart) -> Single PUT
  if (!multipartStarted) {
    const allBlobs = buffer.map(b => b.blob);
    const finalBlob = new Blob(allBlobs, { type: 'video/webm' });

    // Ensure we have something to upload
    if (finalBlob.size === 0) {
         console.warn("Empty recording, skipping upload.");
         if (sessionId) await clearRecordingFromDB(sessionId);
         self.postMessage({ type: "UPLOAD_COMPLETE", location: null });
         return;
    }

    const queryParams = new URLSearchParams({
      studioId: studioId || "",
      sessionId: sessionId || "",
      userId: userId || "",
      recordingId: sessionId || "", // Single PUT creates row if missing
      type: recordingType,
      startedAt: startedAt || new Date().toISOString(),
      endedAt: endedAt || new Date().toISOString(),
      duration: String(duration || 0)
    });

    const res = await fetch(`${apiBase}/api/upload/single?${queryParams.toString()}`, {
      method: "PUT",
      headers: { "Content-Type": "video/webm" },
      body: finalBlob
    });

    if (!res.ok) throw new Error("Single upload failed");
    
    if (sessionId) await clearRecordingFromDB(sessionId);
    
    const data = await res.json();
    self.postMessage({ type: "UPLOAD_COMPLETE", location: data.location });
    return;
  }

  // CASE B: Multipart Active -> Upload remainder and Complete
  if (bufferSize > 0) {
    const thisPartNumber = partNumber++;
    
    const res = await fetch(`${apiBase}/api/upload`, {
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

    if (!res.ok) throw new Error("Failed to get signed URL for final part");
    const { signedUrl } = await res.json();

    const finalBlob = new Blob(buffer.map(b => b.blob));
    
    const putRes = await fetch(signedUrl, {
      method: "PUT",
      body: finalBlob
    });

    if (!putRes.ok) throw new Error("Final Part PUT failed");
    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: thisPartNumber, ETag: etag });
    
    // Mark remaining chunks
    if (sessionId) {
        for (const item of buffer) {
            await markChunkUploaded(sessionId, item.id, etag);
        }
    }
  }

  if (parts.length === 0) {
      throw new Error("Cannot finalize: No parts uploaded.");
  }

  // Sort parts before completing (AWS requires ordered parts)
  parts.sort((a, b) => a.PartNumber - b.PartNumber);

  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "COMPLETE",
      uploadId,
      fullKey,
      parts,
      recordingId,
      endedAt,
      duration
    })
  });

  if (!res.ok) throw new Error(await res.text());
  
  const data = await res.json();

  // Use sessionId for clearing DB as that's the key we used for init/saving
  if (sessionId) {
    await clearRecordingFromDB(sessionId);
  }

  self.postMessage({ type: "UPLOAD_COMPLETE", location: data.location });
}

// ----------------------------------------------
// 5️⃣ RECOVER
// ----------------------------------------------
async function handleRecover(targetSessionId: string) {
  const recordings = await getPendingRecordings();
  const session = recordings.find(r => r.sessionId === targetSessionId);

  if (!session) {
    throw new Error("No local recovery data found.");
  }

  // Restore state
  uploadId = session.uploadId;
  fullKey = session.s3Key;
  
  // NOTE: session.sessionId from DB is the client-side ID. 
  // We use this for IDB operations.
  sessionId = session.sessionId; 
  // recordingId is the server ID, but we might not have it stored in the 'session' object 
  // depending on db.ts implementation. We pass null to upload endpoints if we don't have it, 
  // but usually endpoints need it. 
  // Assuming session.uploadId implies we have a server state.
  // Ideally, initRecordingInDB should store server recordingId too. 
  // If not, we rely on the backend finding it via uploadId or we might fail if backend requires recordingId.
  // For now, we proceed.
  
  studioId = "recovered"; 
  
  parts = []; 
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  
  // We treat recovery as a fresh multipart stream using the retrieved uploadId
  multipartStarted = true; 

  const allChunks = await getRecordingChunks(targetSessionId);
  // Sort by sequence to ensure valid video reconstruction
  // 'partNumber' in IDB chunk usually stores the sequence index
  allChunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of allChunks) {
    // Push directly to buffer processing WITHOUT re-saving to IDB
    // We use the ID from the chunk to ensure we track it correctly
    await processBuffer(chunk.blob, chunk.partNumber); 
  }

  // Finish up any remainder
  await finalize();
}