/* eslint-disable no-restricted-globals */
import {
  initRecordingInDB,
  saveChunkToDB,
  markChunkUploaded,
  clearRecordingFromDB,
  getPendingRecordings,
  getRecordingChunks
} from '../utils/db';

// 🔒 EXACT size for S3/R2 multipart
const PART_SIZE = 5 * 1024 * 1024; // 5 MB EXACT

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

// Multipart tracking
let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

// Buffer (raw byte stream)
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
// ADD CHUNK
// ----------------------------------------------
async function handleNewChunk(blob: Blob) {
  if (!blob.size) return;

  const id = sequenceNumber++;
  await saveChunkToDB(recordingId!, id, blob);

  buffer.push({ blob, id });
  bufferSize += blob.size;

  // Upload STRICT 5MB parts
  while (bufferSize >= PART_SIZE) {
    await uploadExactPart(false);
  }
}

// ----------------------------------------------
// CORE: upload EXACT PART_SIZE
// ----------------------------------------------
async function uploadExactPart(throwError: boolean) {
  let size = 0;
  const blobs: Blob[] = [];
  const ids: number[] = [];

  while (buffer.length && size < PART_SIZE) {
    const item = buffer[0];

    if (size + item.blob.size <= PART_SIZE) {
      blobs.push(item.blob);
      ids.push(item.id);
      size += item.blob.size;
      buffer.shift();
    } else {
      // partial chunk → discard remainder intentionally
      const take = PART_SIZE - size;
      blobs.push(item.blob.slice(0, take));
      ids.push(item.id);
      buffer.shift();
      size = PART_SIZE;
    }
  }

  bufferSize -= PART_SIZE;

  try {
    await uploadStrictPart(new Blob(blobs), ids);
  } catch (e) {
    if (throwError) throw e;
    console.error("Soft upload failure:", e);
  }
}

// ----------------------------------------------
// UPLOAD SINGLE PART
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

    if (!res.ok) throw new Error("Failed to get signed URL");
    const { signedUrl } = await res.json();

    const putRes = await fetch(signedUrl, { method: "PUT", body: blob });
    if (!putRes.ok) throw new Error("PUT failed");

    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: currentPart, ETag: etag });

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
  // Final part (ONLY ONE allowed to be smaller)
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
// RECOVERY
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
    if (chunk.etag) continue;

    buffer.push({ blob: chunk.blob, id: chunk.partNumber });
    bufferSize += chunk.blob.size;

    while (bufferSize >= PART_SIZE) {
      await uploadExactPart(true);
    }
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
