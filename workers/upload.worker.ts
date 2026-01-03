/* eslint-disable no-restricted-globals */
import {
  initRecordingInDB,
  saveChunkToDB,
  markChunkUploaded,
  clearRecordingFromDB,
  getPendingRecordings,
  getRecordingChunks
} from '../utils/db';

const PART_SIZE = 5 * 1024 * 1024; // EXACT 5 MB

// State
let uploadId: string | null = null;
let fullKey: string | null = null;
let recordingId: string | null = null;
let apiBase: string | null = null;

// Context
let studioId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let recordingType = "camera";

// Multipart state
let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

// Buffer (raw chunks)
let buffer: { blob: Blob; id: number }[] = [];
let bufferSize = 0;
let sequenceNumber = 1;

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
    taskQueue = taskQueue.then(() => initializeUpload(payload.startedAt));
  }

  if (type === "ADD_CHUNK") {
    taskQueue = taskQueue.then(() => handleNewChunk(payload.blob));
  }

  if (type === "FINALIZE") {
    taskQueue = taskQueue.then(() =>
      completeUpload(payload.endedAt, payload.duration)
    );
  }

  if (type === "RECOVER") {
    apiBase = payload.apiBase;
    taskQueue = taskQueue.then(() => handleRecover(payload.sessionId));
  }

  taskQueue = taskQueue.catch(err => {
    self.postMessage({ type: "ERROR", error: err?.message || String(err) });
  });
};

// ----------------------------------------------
// INIT
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

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  uploadId = data.uploadId;
  recordingId = data.recordingId;
  fullKey = data.fullKey;

  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  sequenceNumber = 1;

  await initRecordingInDB(recordingId!, uploadId!, fullKey!);

  self.postMessage({ type: "INIT_SUCCESS", uploadId, recordingId, fullKey });
}

// ----------------------------------------------
// CHUNK HANDLING
// ----------------------------------------------
async function handleNewChunk(blob: Blob) {
  if (!blob.size) return;

  const id = sequenceNumber++;
  await saveChunkToDB(recordingId!, id, blob);

  buffer.push({ blob, id });
  bufferSize += blob.size;

  await uploadBufferAsParts(false);
}

// ----------------------------------------------
// CORE FIX: FIXED SIZE PART SLICING
// DISCARD REMAINDER OF PARTIALLY USED CHUNK
// ----------------------------------------------
async function uploadBufferAsParts(throwError: boolean) {
  while (bufferSize >= PART_SIZE) {
    let size = 0;
    const blobs: Blob[] = [];
    const ids: number[] = [];

    while (buffer.length && size < PART_SIZE) {
      const item = buffer[0];

      if (size + item.blob.size <= PART_SIZE) {
        // whole chunk fits
        blobs.push(item.blob);
        ids.push(item.id);
        size += item.blob.size;
        buffer.shift();
      } else {
        // partial chunk used → DISCARD remainder
        const take = PART_SIZE - size;
        blobs.push(item.blob.slice(0, take));
        ids.push(item.id);

        // discard remainder intentionally
        buffer.shift();
        size = PART_SIZE;
      }
    }

    bufferSize -= PART_SIZE;

    try {
      await uploadStrictPart(new Blob(blobs), ids);
    } catch (e) {
      if (throwError) throw e;
      break;
    }
  }
}

// ----------------------------------------------
// UPLOAD PART
// ----------------------------------------------
async function uploadStrictPart(blob: Blob, chunkIds: number[]) {
  const currentPart = partNumber++;

  const promise = (async () => {
    const res = await fetch(`${apiBase}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PART",
        uploadId,
        fullKey,
        partNumber: currentPart,
        recordingId
      })
    });

    if (!res.ok) throw new Error("Signed URL failed");
    const { signedUrl } = await res.json();

    const putRes = await fetch(signedUrl, { method: "PUT", body: blob });
    if (!putRes.ok) throw new Error("PUT failed");

    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: currentPart, ETag: etag });

    // mark WHOLE chunks uploaded (even if partially used)
    for (const id of chunkIds) {
      await markChunkUploaded(recordingId!, id, etag);
    }

    self.postMessage({ type: "PART_UPLOADED", partNumber: currentPart });
  })();

  inFlightUploads.set(currentPart, promise);
  promise.finally(() => inFlightUploads.delete(currentPart));
  return promise;
}

// ----------------------------------------------
// FINALIZE
// ----------------------------------------------
async function completeUpload(endedAt?: string, duration?: number) {
  // last part (may be < 5MB)
  if (bufferSize > 0) {
    await uploadStrictPart(
      new Blob(buffer.map(b => b.blob)),
      buffer.map(b => b.id)
    );
    buffer = [];
    bufferSize = 0;
  }

  if (inFlightUploads.size) {
    await Promise.all(inFlightUploads.values());
  }

  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "COMPLETE",
      uploadId,
      fullKey,
      recordingId,
      parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      endedAt: endedAt || new Date().toISOString(),
      duration: duration || 0
    })
  });

  if (!res.ok) throw new Error(await res.text());

  await clearRecordingFromDB(recordingId!);
  self.postMessage({ type: "UPLOAD_COMPLETE", recordingId });

  resetState();
}

// ----------------------------------------------
// RECOVERY (SKIP UPLOADED CHUNKS)
// ----------------------------------------------
async function handleRecover(targetSessionId: string) {
  const recordings = await getPendingRecordings();
  const session = recordings.find(r => r.sessionId === targetSessionId);
  if (!session) throw new Error("No recovery data");

  uploadId = session.uploadId;
  fullKey = session.s3Key;
  recordingId = session.sessionId;

  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;

  const chunks = await getRecordingChunks(recordingId);

  chunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of chunks) {
    if (chunk.etag) continue; // already uploaded

    buffer.push({
      blob: chunk.blob,
      id: chunk.partNumber
    });

    bufferSize += chunk.blob.size;
    await uploadBufferAsParts(true);
  }

  await completeUpload();
}


// ----------------------------------------------
function resetState() {
  uploadId = null;
  fullKey = null;
  recordingId = null;
  parts = [];
  buffer = [];
  bufferSize = 0;
  partNumber = 1;
  sequenceNumber = 1;
  inFlightUploads.clear();
}
