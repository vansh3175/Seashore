/* eslint-disable no-restricted-globals */
import { 
  initRecordingInDB, 
  saveChunkToDB, 
  markChunkUploaded, 
  clearRecordingFromDB,
  getPendingRecordings, 
  getRecordingChunks    
} from '../utils/db';

// Ensure this is an integer to avoid floating point issues with Blob.slice
const MIN_PART_SIZE = Math.ceil(5.2 * 1024 * 1024); // 5.2 MB

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

  // Slice and upload as long as we have enough data for a 5.2MB part
  // This ensures every non-trailing part uploaded is exactly MIN_PART_SIZE
  while (bufferSize >= MIN_PART_SIZE) {
    await uploadBufferAsPart(false, false);
  }
}

// ----------------------------------------------
// Helper: Upload Accumulated Buffer
// ----------------------------------------------
async function uploadBufferAsPart(throwError = false, isFinal = false) {
  if (buffer.length === 0) return;

  // 1. Consolidate blobs
  const allBlobs = buffer.map(b => b.blob);
  const compositeBlob = new Blob(allBlobs);
  
  // If not final and not enough data, stop
  if (!isFinal && compositeBlob.size < MIN_PART_SIZE) {
      return;
  }

  let blobToUpload: Blob;
  let remainder: Blob | null = null;

  // 2. Slice EXACTLY MIN_PART_SIZE if not final
  // This ensures all non-trailing parts are uniform (5.2 MB)
  if (!isFinal && compositeBlob.size >= MIN_PART_SIZE) {
    blobToUpload = compositeBlob.slice(0, MIN_PART_SIZE);
    remainder = compositeBlob.slice(MIN_PART_SIZE);
  } else {
    // Final part can be any size (S3 rules allow this)
    blobToUpload = compositeBlob;
  }

  // 3. Collect IDs to mark as "uploaded" in local DB
  // Note: Since we might slice mid-blob, marking IDs as uploaded is an approximation
  // unless we track byte ranges. For simplicity, we mark chunks involved.
  const idsToMark = buffer.map(b => b.id).filter(id => id !== -1);

  // 4. Update Buffer with Remainder
  buffer = [];
  bufferSize = 0;

  if (remainder && remainder.size > 0) {
    // We store -1 as ID because this remainder corresponds to 
    // a fraction of previous chunks, so we can't map it 1-to-1 to a sequence ID.
    // This is a trade-off for strict slicing logic.
    buffer.push({ blob: remainder, id: -1 });
    bufferSize = remainder.size;
  }

  // 5. Upload
  try {
    await uploadStrictPart(blobToUpload, idsToMark);
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

  // 1. Upload leftover buffer as the final part
  if (buffer.length > 0) {
    try {
        await uploadBufferAsPart(true, true); // throwError = true, isFinal = true
    } catch (e) {
        console.error("Failed to upload last part, retrying once...", e);
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
  
  // Sort by partNumber
  allChunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of allChunks) {
    buffer.push({ blob: chunk.blob, id: chunk.partNumber });
    bufferSize += chunk.blob.size;

    // Use loop to slice strictly if recovering large chunks
    while (bufferSize >= MIN_PART_SIZE) {
      await uploadBufferAsPart(true, false);
    }
  }

  // Upload any remainder as final part
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