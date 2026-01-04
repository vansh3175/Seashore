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

// Helper to safely extract error message
function getSafeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as any).message);
  }
  return String(err);
}

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

  taskQueue = taskQueue.catch((err: any) => {
    self.postMessage({ type: "ERROR", error: getSafeErrorMessage(err) });
  });
};

// ----------------------------------------------
// 1️⃣ CHUNK HANDLING
// ----------------------------------------------
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

  if (recordingId && uploadId && fullKey && sessionId) {
    await initRecordingInDB(sessionId, uploadId, fullKey);
  }
  
  multipartStarted = true;
  self.postMessage({ type: "INIT_SUCCESS", uploadId });
}

// ----------------------------------------------
// 3️⃣ UPLOAD EXACT 5MB PART
// ----------------------------------------------
async function uploadExactPart() {
  const blobsToUpload: Blob[] = [];
  const chunkIdsToMark: number[] = [];
  let currentPartSize = 0;

  while (buffer.length > 0 && currentPartSize < PART_SIZE) {
    const item = buffer[0]; 
    const needed = PART_SIZE - currentPartSize;

    if (item.blob.size <= needed) {
      blobsToUpload.push(item.blob);
      chunkIdsToMark.push(item.id);
      currentPartSize += item.blob.size;
      buffer.shift(); 
    } else {
      const slice = item.blob.slice(0, needed);
      const remainder = item.blob.slice(needed);
      
      blobsToUpload.push(slice);
      currentPartSize += slice.size;
      buffer[0] = { blob: remainder, id: item.id }; 
    }
  }

  bufferSize -= PART_SIZE;

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
  
  // --- ROBUST RETRY LOGIC (5 Attempts) ---
  let putRes;
  let lastError: unknown;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      putRes = await fetch(signedUrl, {
        method: "PUT",
        body: compositeBlob
      });
      
      if (putRes.ok) break;
      
      if (putRes.status >= 500 || putRes.status === 429) {
        throw new Error(`Server Error: ${putRes.status}`);
      }
      if (putRes.status >= 400) {
        // Client error (like 403) usually shouldn't be retried, but we do once just in case of slight clock skew
         throw new Error(`Client Error: ${putRes.status}`);
      }

    } catch (err) {
      lastError = err;
      const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s
      console.warn(`[UploadWorker] Part ${thisPartNumber} attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, err);
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (!putRes || !putRes.ok) {
     const msg = getSafeErrorMessage(lastError) || putRes?.statusText || "Unknown Error";
     throw new Error(`PUT Part ${thisPartNumber} failed after ${maxAttempts} attempts: ${msg}`);
  }

  const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
  parts.push({ PartNumber: thisPartNumber, ETag: etag });

  if (sessionId) {
    for (const id of chunkIdsToMark) {
      await markChunkUploaded(sessionId, id, etag);
    }
  }

  self.postMessage({ type: "PART_UPLOADED", partNumber: thisPartNumber });
}

// ----------------------------------------------
// 4️⃣ FINALIZE
// ----------------------------------------------
async function finalize(startedAt?: string, endedAt?: string, duration?: number) {
  // CASE A: Single PUT
  if (!multipartStarted) {
    const allBlobs = buffer.map(b => b.blob);
    const finalBlob = new Blob(allBlobs, { type: 'video/webm' });

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
      recordingId: sessionId || "", 
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

  // CASE B: Multipart Final Part
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
    
    // --- ROBUST RETRY LOGIC (5 Attempts) for Final Part ---
    let putRes;
    let lastError: unknown;
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            putRes = await fetch(signedUrl, {
                method: "PUT",
                body: finalBlob
            });
            
            if (putRes.ok) break;
            
            if (putRes.status >= 500) throw new Error(`Status ${putRes.status}`);
            if (putRes.status >= 400) throw new Error(`Status ${putRes.status}`);
        } catch (err) {
            lastError = err;
            const delay = 1000 * Math.pow(2, attempt);
            console.warn(`[UploadWorker] Final Part attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, err);
            if (attempt < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    if (!putRes || !putRes.ok) {
        const msg = getSafeErrorMessage(lastError) || putRes?.statusText || "Unknown Error";
        throw new Error(`Final Part PUT failed after ${maxAttempts} attempts: ${msg}`);
    }

    const etag = (putRes.headers.get("ETag") || "").replace(/"/g, "");
    parts.push({ PartNumber: thisPartNumber, ETag: etag });
    
    if (sessionId) {
        for (const item of buffer) {
            await markChunkUploaded(sessionId, item.id, etag);
        }
    }
  }

  if (parts.length === 0) {
      throw new Error("Cannot finalize: No parts uploaded.");
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
  
  const data = await res.json();

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

  uploadId = session.uploadId;
  fullKey = session.s3Key;
  sessionId = session.sessionId; 
  studioId = "recovered"; 
  
  parts = []; 
  partNumber = 1;
  buffer = [];
  bufferSize = 0;
  
  multipartStarted = true; 

  const allChunks = await getRecordingChunks(targetSessionId);
  allChunks.sort((a, b) => a.partNumber - b.partNumber);

  for (const chunk of allChunks) {
    await processBuffer(chunk.blob, chunk.partNumber); 
  }

  await finalize();
}