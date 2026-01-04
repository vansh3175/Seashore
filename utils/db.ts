import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 1. Define the shape of our Database
interface SeaShoreDB extends DBSchema {
  // Store 1: Active Recordings (Metadata for recovery)
  recordings: {
    key: string; // sessionId (Using sessionId as key allows 1 active recovery per room)
    value: {
      sessionId: string;
      uploadId: string; // S3 Multipart ID
      s3Key: string;    // S3 File Path
      startedAt: number;
      status: 'recording' | 'uploading' | 'completed';
    };
  };

  // Store 2: Video Chunks (The "Child" records)
  chunks: {
    key: number; // Auto-incrementing ID
    value: {
      sessionId: string; // Link to parent recording
      sequenceId: number; // Unique sequence ID of this chunk (for recovery identification)
      partNumber: number; // Part for sorting/uploading (same as sequenceId initially)
      blob: Blob;
      status: 'pending' | 'uploaded'; 
      etag?: string; // S3 Receipt (Only exists if status === 'uploaded')
    };
    // Index to quickly find chunks for a specific recording context
    indexes: { 'by-session': string }; 
  };
}

const DB_NAME = 'SeaShoreDB';
const DB_VERSION = 4; // INCREMENTED VERSION (Critical Fix)

// 2. Initialize the Database
export async function initDB(): Promise<IDBPDatabase<SeaShoreDB>> {
  return openDB<SeaShoreDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 1. Create 'recordings' store if missing
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings', { keyPath: 'sessionId' });
      }

      // 2. Cleanup old 'sessions' store if it exists from V2
      // if (db.objectStoreNames.contains('sessions')) {
      //   db.deleteObjectStore('sessions');
      // }

      // 3. Chunk Store
      let chunkStore;
      if (!db.objectStoreNames.contains('chunks')) {
        chunkStore = db.createObjectStore('chunks', {
          keyPath: 'id',
          autoIncrement: true,
        });
      } else {
        chunkStore = transaction.objectStore('chunks');
      }

      // 4. Create Index if missing (This fixes your error)
      if (!chunkStore.indexNames.contains('by-session')) {
        chunkStore.createIndex('by-session', 'sessionId');
      }
    },
  });
}

// 3. Helper: Start a New Recording (Metadata)
export async function initRecordingInDB(sessionId: string, uploadId: string, s3Key: string) {
  const db = await initDB();
  await db.put('recordings', {
    sessionId,
    uploadId,
    s3Key,
    startedAt: Date.now(),
    status: 'recording'
  });
}

// 4. Helper: Save a Chunk (Linked to Session ID)
export async function saveChunkToDB(sessionId: string, sequenceId: number, blob: Blob) {
  const db = await initDB();
  await db.add('chunks', {
    sessionId,
    partNumber: sequenceId, // Store sequence ID as partNumber for sorting
    sequenceId,
    blob,
    status: 'pending',
  });
}

// 5. Helper: Mark Chunk as Uploaded (Save ETag)
export async function markChunkUploaded(sessionId: string, sequenceId: number, etag: string) {
  const db = await initDB();
  const tx = db.transaction('chunks', 'readwrite');
  const index = tx.store.index('by-session');
  
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  
  while (cursor) {
    if (cursor.value.sequenceId === sequenceId) {
      const updateData = cursor.value;
      updateData.status = 'uploaded';
      updateData.etag = etag;
      await cursor.update(updateData);
      break; 
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

// 6. Helper: Get Pending Recordings (For Recovery Check)
export async function getPendingRecordings() {
  const db = await initDB();
  const allRecordings = await db.getAll('recordings');
  return allRecordings.filter(r => r.status !== 'completed');
}

// 7. Helper: Get All Chunks for a Recording (For Recovery Upload)
export async function getRecordingChunks(sessionId: string) {
  const db = await initDB();
  return await db.getAllFromIndex('chunks', 'by-session', sessionId);
}

// 8. Helper: Clear Recording (After successful finalize)
export async function clearRecordingFromDB(sessionId: string) {
  const db = await initDB();
  const tx = db.transaction(['recordings', 'chunks'], 'readwrite');
  
  // Delete Recording Metadata
  await tx.objectStore('recordings').delete(sessionId);
  
  // Delete Chunks
  let cursor = await tx.objectStore('chunks').index('by-session').openCursor(IDBKeyRange.only(sessionId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  
  await tx.done;
}