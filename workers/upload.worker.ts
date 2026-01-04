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
  
  // Save strict raw chunk to IDB immediately for safety
  if (sessionId) {
    await saveChunkToDB(sessionId, id, blob);
  }

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
  if (recordingId && uploadId && fullKey) {
    await initRecordingInDB(recordingId, uploadId, fullKey);
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
  while (buffer.length > 0 && currentPartSize < PART_SIZE) {
    const item = buffer[0]; // Peek at head
    const needed = PART_SIZE - currentPartSize;

    if (item.blob.size <= needed) {
      // Take the whole chunk
      blobsToUpload.push(item.blob);
      chunkIdsToMark.push(item.id);
      currentPartSize += item.blob.size;
      buffer.shift(); // Remove from buffer
    } else {
      // Slice the chunk
      const slice = item.blob.slice(0, needed);
      const remainder = item.blob.slice(needed);
      
      blobsToUpload.push(slice);
      // We do NOT mark this ID as uploaded yet because part of it is still in buffer
      // IDB logic handles recovery based on what is *fully* uploaded anyway.
      
      currentPartSize += slice.size;
      
      // Update the head of the buffer with the remainder
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
  if (recordingId) {
    for (const id of chunkIdsToMark) {
      await markChunkUploaded(recordingId, id, etag);
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

    // Use the SINGLE upload endpoint
    // Note: We need to pass metadata params in query string as per your API code
    const queryParams = new URLSearchParams({
      studioId: studioId || "",
      sessionId: sessionId || "",
      userId: userId || "",
      recordingId: sessionId || "", // Usually we want a unique ID, but sessionId serves here if no DB row yet
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
    
    // Clear local data
    if (sessionId) await clearRecordingFromDB(sessionId);
    
    const data = await res.json();
    self.postMessage({ type: "UPLOAD_COMPLETE", location: data.location });
    return;
  }

  // CASE B: Multipart Active -> Upload remainder and Complete
  if (bufferSize > 0) {
    // Upload the last part (can be any size < 5MB)
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

  if (recordingId) {
    await clearRecordingFromDB(recordingId);
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
  recordingId = session.sessionId; 
  sessionId = session.sessionId; // Ensure context is set
  studioId = "recovered"; // We might not know this, but fullKey has it
  
  parts = []; // We assume we need to re-upload parts to ensure consistency or check ETags
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  
  multipartStarted = true; // Recovery implies we are doing the full flow

  const allChunks = await getRecordingChunks(targetSessionId);
  // Sort by sequence/partNumber to ensure order
  allChunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of allChunks) {
    // Push directly to handler which manages the buffer loop
    // We treat recovered blobs as if they are incoming chunks
    await handleChunk(chunk.blob); 
  }

  // Finish up
  await finalize();
}