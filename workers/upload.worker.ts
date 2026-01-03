/* eslint-disable no-restricted-globals */
import { 
  initRecordingInDB, 
  saveChunkToDB, 
  markChunkUploaded, 
  clearRecordingFromDB,
  getPendingRecordings, 
  getRecordingChunks    
} from '../utils/db';

const MIN_PART_SIZE = 5.2 * 1024 * 1024; // 5.2 MB trigger

// State
let uploadId: string | null = null;
let fullKey: string | null = null;     // studioId/sessionId/userId/recordingId
let recordingId: string | null = null;
let apiBase: string | null = null;

// Context
let studioId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let recordingType: string = "camera"; 

// Buffers
let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

// We store the Blob AND its IDB sequence ID so we can mark it as uploaded later
let buffer: { blob: Blob; id: number }[] = []; 
let bufferSize = 0;
let sequenceNumber = 1; // Auto-increment for IDB chunks

const inFlightUploads = new Map<number, Promise<void>>();
let taskQueue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "INIT") {
    studioId = payload.studioId;
    sessionId = payload.sessionId;
    userId = payload.userId;
    apiBase = payload.apiBase;
    recordingType = payload.recordingType || "camera"; 

    taskQueue = taskQueue.then(() =>
      initializeUpload(payload.startedAt)
    );

  } else if (type === "ADD_CHUNK") {
    taskQueue = taskQueue.then(() => handleNewChunk(payload.blob));

  } else if (type === "FINALIZE") {
    taskQueue = taskQueue.then(() =>
      completeUpload(payload.endedAt, payload.duration)
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
// Helpers
// ----------------------------------------------

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// ----------------------------------------------
// 1️⃣ INIT — Create DB row + get uploadId
// ----------------------------------------------
async function initializeUpload(startedAt: string) {
  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "INIT",
      studioId,
      sessionId,
      userId, 
      type: recordingType, 
      startedAt
    })
  });

  if (!res.ok) {
      const err = await res.text();
      throw new Error(`Init failed: ${err}`);
  }

  const data = await safeJson(res);
  
  if (!data.uploadId || !data.recordingId || !data.fullKey)
    throw new Error("Failed to initialize upload: Missing keys in response");

  uploadId = data.uploadId;
  recordingId = data.recordingId;
  fullKey = data.fullKey;

  // Reset upload state
  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  sequenceNumber = 1;

  if (recordingId && uploadId && fullKey) {
    await initRecordingInDB(recordingId, uploadId, fullKey);
  }

  self.postMessage({
    type: "INIT_SUCCESS",
    uploadId,
    recordingId,
    fullKey
  });
}

// ----------------------------------------------
// 2️⃣ Handle Chunk Buffering
// ----------------------------------------------
async function handleNewChunk(blob: Blob) {
  if (!blob.size) return;

  const currentSeqId = sequenceNumber++;

  if (recordingId) {
    await saveChunkToDB(recordingId, currentSeqId, blob);
  }

  buffer.push({ blob, id: currentSeqId });
  bufferSize += blob.size;

  if (bufferSize >= MIN_PART_SIZE) {
    await uploadBufferAsPart();
  }
}

// ----------------------------------------------
// Helper: Upload Accumulated Buffer
// ----------------------------------------------
// Added 'throwError' to control if we want to fail hard (for Finalize) or soft (for streaming)
async function uploadBufferAsPart(throwError = false) {
  if (buffer.length === 0) return;

  const blobs = buffer.map(b => b.blob);
  const compositeBlob = new Blob(blobs);
  const idsToMark = buffer.map(b => b.id);

  // Clear buffer immediately for next chunks
  buffer = [];
  bufferSize = 0;

  try {
    await uploadStrictPart(compositeBlob, idsToMark);
  } catch (err) {
    if (throwError) throw err;
    console.error("Soft failure uploading part during stream:", err);
    // We swallow error during streaming so the recorder doesn't crash.
    // The data is safe in IDB and will be picked up by Recovery.
  }
}

// ----------------------------------------------
// Upload Part to S3
// ----------------------------------------------
async function uploadStrictPart(blob: Blob, chunkIds: number[] = []) {
  const thisPart = partNumber++;

  const uploadPromise = (async () => {
    const res = await fetch(`${apiBase}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PART",
        fullKey,
        uploadId,
        partNumber: thisPart,
        recordingId
      })
    });

    if (!res.ok) throw new Error("Failed to get signed URL");

    const data = await res.json();
    const signedUrl = data.signedUrl;

    const putRes = await fetch(signedUrl, {
      method: "PUT",
      body: blob,
    });

    if (!putRes.ok) throw new Error(`Part upload failed: ${putRes.statusText}`);

    const eTag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: thisPart, ETag: eTag });

    if (recordingId && chunkIds.length > 0) {
      for (const id of chunkIds) {
        await markChunkUploaded(recordingId, id, eTag);
      }
    }

    self.postMessage({
      type: "PART_UPLOADED",
      partNumber: thisPart
    });
  })();

  inFlightUploads.set(thisPart, uploadPromise);
  uploadPromise.finally(() => inFlightUploads.delete(thisPart));

  return uploadPromise;
}

// ----------------------------------------------
// 3️⃣ FINALIZE — Complete upload + update DB
// ----------------------------------------------
async function completeUpload(endedAt?: string, duration?: number) {
  if (!uploadId || !fullKey || !apiBase) return;

  // 1. Upload leftover buffer
  if (buffer.length > 0) {
    try {
        await uploadBufferAsPart(true); // throwError = true
    } catch (e) {
        console.error("Failed to upload last part, retrying once...", e);
        // Simple retry logic for the critical last part
        await new Promise(r => setTimeout(r, 1000));
        throw new Error("Failed to upload final part. Please try Recovery.");
    }
  }

  // 2. Wait for pending uploads
  if (inFlightUploads.size > 0) {
    await Promise.all(inFlightUploads.values());
  }

  // 3. Sort Parts
  const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

  if (sortedParts.length === 0) {
      throw new Error("No parts uploaded. Cannot finalize empty file.");
  }

  // 4. Call Complete
  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "COMPLETE",
      fullKey,
      uploadId,
      parts: sortedParts,
      recordingId,
      endedAt: endedAt || new Date().toISOString(), 
      duration: duration || 0
    })
  });

  if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Complete failed: ${txt}`);
  }

  const data = await safeJson(res);

  // 5. Cleanup IDB
  if (recordingId) {
    await clearRecordingFromDB(recordingId);
  }

  self.postMessage({
    type: "UPLOAD_COMPLETE",
    location: data.location,
    recordingId
  });

  resetState();
}

// ----------------------------------------------
// 4️⃣ RECOVER — Restore from IDB
// ----------------------------------------------
async function handleRecover(targetSessionId: string) {
  const recordings = await getPendingRecordings();
  const session = recordings.find(r => r.sessionId === targetSessionId);

  if (!session) {
    throw new Error("No local recovery data found for this session.");
  }

  uploadId = session.uploadId;
  fullKey = session.s3Key;
  recordingId = session.sessionId;
  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;

  const allChunks = await getRecordingChunks(recordingId);
  
  // FIX: Sort by partNumber instead of 'id' which might be missing in type def
  allChunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of allChunks) {
    // FIX: Push partNumber as id
    buffer.push({ blob: chunk.blob, id: chunk.partNumber });
    bufferSize += chunk.blob.size;

    if (bufferSize >= MIN_PART_SIZE) {
      const etags = buffer.map(b => 
        // FIX: Compare against partNumber
        allChunks.find(c => c.partNumber === b.id)?.etag
      ).filter(Boolean);

      const uniqueTags = [...new Set(etags)];

      // Check if this batch matches a previously uploaded part (Optimization)
      if (uniqueTags.length === 1 && etags.length === buffer.length) {
        const existingEtag = uniqueTags[0];
        parts.push({ PartNumber: partNumber++, ETag: existingEtag! });
        buffer = [];
        bufferSize = 0;
        self.postMessage({ type: "PART_RECOVERED", partNumber: partNumber - 1 });
      } else {
        // Not fully uploaded or mixed -> Re-upload
        await uploadBufferAsPart(true); // Throw on error during recovery
      }
    }
  }

  await completeUpload();
}

function resetState() {
  uploadId = null;
  fullKey = null;
  recordingId = null;
  studioId = null; 
  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  sequenceNumber = 1;
  inFlightUploads.clear();
}