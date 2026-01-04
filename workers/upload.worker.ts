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

let uploadId: string | null = null;
let fullKey: string | null = null;
let recordingId: string | null = null;
let apiBase: string | null = null;
let multipartStarted = false;

let studioId: string | null = null;
let sessionId: string | null = null;
let userId: string | null = null;
let recordingType = "camera";

let parts: { PartNumber: number; ETag: string }[] = [];
let partNumber = 1;

let buffer: { blob: Blob; id: number }[] = [];
let bufferSize = 0;
let sequenceNumber = 1;

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
    self.postMessage({ type: "ERROR", error: err?.message || String(err) });
  });
};

// --------------------------------------------------
// CHUNK HANDLING
// --------------------------------------------------
async function handleChunk(blob: Blob) {
  if (!blob.size) return;

  const id = sequenceNumber++;

  if (sessionId) {
    await saveChunkToDB(sessionId, id, blob);
  }

  await processBuffer(blob, id);
}

async function processBuffer(blob: Blob, id: number) {
  buffer.push({ blob, id });
  bufferSize += blob.size;

  if (!multipartStarted && bufferSize >= PART_SIZE) {
    await startMultipart();
  }

  if (multipartStarted) {
    while (bufferSize >= PART_SIZE) {
      await uploadExactPart();
    }
  }
}

// --------------------------------------------------
// START MULTIPART
// --------------------------------------------------
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

  if (sessionId && uploadId && fullKey) {
    await initRecordingInDB(sessionId, uploadId, fullKey);
  }

  multipartStarted = true;
  self.postMessage({ type: "INIT_SUCCESS", uploadId });
}

// --------------------------------------------------
// UPLOAD EXACT 5MB PART (FIXED RETRY LOGIC)
// --------------------------------------------------
async function uploadExactPart() {
  const blobs: Blob[] = [];
  const ids: number[] = [];
  let size = 0;

  while (buffer.length && size < PART_SIZE) {
    const item = buffer[0];
    const need = PART_SIZE - size;

    if (item.blob.size <= need) {
      blobs.push(item.blob);
      ids.push(item.id);
      size += item.blob.size;
      buffer.shift();
    } else {
      blobs.push(item.blob.slice(0, need));
      buffer[0] = { blob: item.blob.slice(need), id: item.id };
      size += need;
    }
  }

  bufferSize -= PART_SIZE;
  const blob = new Blob(blobs);
  const thisPartNumber = partNumber++;

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

      if (!signRes.ok) throw new Error("Failed to get signed URL");
      const { signedUrl } = await signRes.json();

      putRes = await fetch(signedUrl, {
        method: "PUT",
        body: blob
      });

      if (putRes.ok) break;
      throw new Error(`PUT failed ${putRes.status}`);
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  if (!putRes || !putRes.ok) {
    throw new Error(`PUT Part ${thisPartNumber} failed after 3 attempts: ${lastError}`);
  }

  const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
  parts.push({ PartNumber: thisPartNumber, ETag: etag });

  if (sessionId) {
    for (const id of ids) {
      await markChunkUploaded(sessionId, id, etag);
    }
  }

  self.postMessage({ type: "PART_UPLOADED", partNumber: thisPartNumber });
}

// --------------------------------------------------
// FINALIZE
// --------------------------------------------------
async function finalize(startedAt?: string, endedAt?: string, duration?: number) {
  if (!multipartStarted) {
    const finalBlob = new Blob(buffer.map(b => b.blob), { type: "video/webm" });
    if (!finalBlob.size) return;

    const params = new URLSearchParams({
      studioId: studioId || "",
      sessionId: sessionId || "",
      userId: userId || "",
      recordingId: sessionId || "",
      type: recordingType,
      startedAt: startedAt || "",
      endedAt: endedAt || "",
      duration: String(duration || 0)
    });

    const res = await fetch(`${apiBase}/api/upload/single?${params}`, {
      method: "PUT",
      headers: { "Content-Type": "video/webm" },
      body: finalBlob
    });

    if (!res.ok) throw new Error("Single upload failed");
    if (sessionId) await clearRecordingFromDB(sessionId);
    self.postMessage({ type: "UPLOAD_COMPLETE", location: (await res.json()).location });
    return;
  }

  if (bufferSize > 0) {
    const blob = new Blob(buffer.map(b => b.blob));
    const thisPartNumber = partNumber++;

    let putRes: Response | undefined;

    for (let attempt = 0; attempt < 3; attempt++) {
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

      if (!signRes.ok) continue;
      const { signedUrl } = await signRes.json();

      putRes = await fetch(signedUrl, { method: "PUT", body: blob });
      if (putRes.ok) break;
    }

    if (!putRes?.ok) throw new Error("Final part upload failed");

    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: thisPartNumber, ETag: etag });
  }

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
  if (sessionId) await clearRecordingFromDB(sessionId);
  self.postMessage({ type: "UPLOAD_COMPLETE", location: (await res.json()).location });
}

// --------------------------------------------------
// RECOVER
// --------------------------------------------------
async function handleRecover(targetSessionId: string) {
  const recordings = await getPendingRecordings();
  const session = recordings.find(r => r.sessionId === targetSessionId);
  if (!session) throw new Error("No recovery data");

  uploadId = session.uploadId;
  fullKey = session.s3Key;
  sessionId = session.sessionId;

  multipartStarted = true;
  parts = [];
  partNumber = 1;
  buffer = [];
  bufferSize = 0;

  const chunks = await getRecordingChunks(targetSessionId);
  chunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of chunks) {
    await processBuffer(chunk.blob, chunk.partNumber);
  }

  await finalize();
}
