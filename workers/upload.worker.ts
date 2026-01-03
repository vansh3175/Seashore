/* eslint-disable no-restricted-globals */
import {
  initRecordingInDB,
  saveChunkToDB,
  markChunkUploaded,
  clearRecordingFromDB,
} from '../utils/db';

const PART_SIZE = 5 * 1024 * 1024; // EXACT 5MB

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

// Data
let buffer: { blob: Blob; id: number }[] = [];
let bufferSize = 0;
let totalBytes = 0;
let sequenceNumber = 1;

// Multipart
let multipartStarted = false;
let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

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

  if (type === "ADD_CHUNK") {
    taskQueue = taskQueue.then(() => handleChunk(payload.blob));
  }

  if (type === "FINALIZE") {
    taskQueue = taskQueue.then(() => finalize(payload.endedAt, payload.duration));
  }

  taskQueue = taskQueue.catch(err =>
    self.postMessage({ type: "ERROR", error: err.message })
  );
};

// ----------------------------------------------
// CHUNK HANDLING
// ----------------------------------------------
async function handleChunk(blob: Blob) {
  if (!blob.size) return;

  totalBytes += blob.size;

  const id = sequenceNumber++;
  await saveChunkToDB(sessionId!, id, blob);

  buffer.push({ blob, id });
  bufferSize += blob.size;

  // 🚀 Start multipart ONLY when we cross 5MB
  if (!multipartStarted && bufferSize >= PART_SIZE) {
    await startMultipart();
  }

  if (!multipartStarted) return;

  while (bufferSize >= PART_SIZE) {
    await uploadExactPart();
  }
}

// ----------------------------------------------
// START MULTIPART
// ----------------------------------------------
async function startMultipart() {
  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "INIT",
      studioId,
      sessionId,
      userId,
      type: recordingType,
      startedAt: new Date().toISOString()
    })
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  uploadId = data.uploadId;
  recordingId = data.recordingId;
  fullKey = data.fullKey;

  await initRecordingInDB(recordingId!, uploadId!, fullKey!);
  multipartStarted = true;
}

// ----------------------------------------------
// UPLOAD EXACT PART
// ----------------------------------------------
async function uploadExactPart() {
  let size = 0;
  const blobs: Blob[] = [];
  const ids: number[] = [];

  while (buffer.length && size < PART_SIZE) {
    const item = buffer.shift()!;
    if (size + item.blob.size <= PART_SIZE) {
      blobs.push(item.blob);
      ids.push(item.id);
      size += item.blob.size;
    } else {
      const take = PART_SIZE - size;
      blobs.push(item.blob.slice(0, take));
      ids.push(item.id);
      size = PART_SIZE;
    }
  }

  bufferSize -= PART_SIZE;

  const res = await fetch(`${apiBase}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "PART",
      uploadId,
      fullKey,
      partNumber,
      recordingId
    })
  });

  if (!res.ok) throw new Error("Failed to get signed URL");
  const { signedUrl } = await res.json();

  const putRes = await fetch(signedUrl, {
    method: "PUT",
    body: new Blob(blobs)
  });

  if (!putRes.ok) throw new Error("PUT failed");

  const etag = putRes.headers.get("ETag")!.replace(/"/g, "");
  parts.push({ PartNumber: partNumber++, ETag: etag });

  for (const id of ids) {
    await markChunkUploaded(recordingId!, id, etag);
  }
}

// ----------------------------------------------
// FINALIZE
// ----------------------------------------------
async function finalize(endedAt?: string, duration?: number) {

  // ❌ Backend cannot handle <5MB uploads
  if (!multipartStarted) {
    self.postMessage({
      type: "ERROR",
      error: "Recording too small to upload (backend requires ≥ 5MB)"
    });
    return;
  }

  // Final part
  if (bufferSize > 0) {
    const res = await fetch(`${apiBase}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "PART",
        uploadId,
        fullKey,
        partNumber,
        recordingId
      })
    });

    const { signedUrl } = await res.json();
    const putRes = await fetch(signedUrl, {
      method: "PUT",
      body: new Blob(buffer.map(b => b.blob))
    });

    const etag = putRes.headers.get("ETag")!.replace(/"/g, "");
    parts.push({ PartNumber: partNumber, ETag: etag });
  }

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

  await clearRecordingFromDB(recordingId!);
  self.postMessage({ type: "UPLOAD_COMPLETE", recordingId });
}
