'use client';
import { useState } from 'react';

export default function UploadTest() {
  const [status, setStatus] = useState('Idle');

  const testUpload = async () => {
    setStatus('Starting...');
    const fileName = `test-file-${Date.now()}.txt`;

    try {
      // 1. INIT
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'INIT', fileName })
      });
      const { uploadId } = await initRes.json();
      if (!uploadId) throw new Error("No Upload ID returned");
      setStatus(`Upload Init: ${uploadId.substring(0, 10)}...`);

      // 2. GET URL
      const urlRes = await fetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ action: 'PART', fileName, uploadId, partNumber: 1 })
      });
      const { signedUrl } = await urlRes.json();
      if (!signedUrl) throw new Error("No Signed URL returned");
      
      // 3. UPLOAD (Put Dummy Data)
      const blob = new Blob(["Hello R2 from Localhost!"], { type: 'text/plain' });
      const uploadRes = await fetch(signedUrl, { method: 'PUT', body: blob });
      
      if (!uploadRes.ok) {
        throw new Error("Upload PUT failed");
      }

      // 4. GET ETAG (Required for Completion)
      const eTag = uploadRes.headers.get('ETag');
      console.log("ETag received:", eTag);
      
      if (!eTag) {
        throw new Error("ETag missing. Please add 'Expose-Headers: ETag' to your R2 CORS config.");
      }

      // 5. COMPLETE THE UPLOAD
      setStatus('Finalizing...');
      const completeRes = await fetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'COMPLETE', 
          fileName, 
          uploadId, 
          parts: [{ PartNumber: 1, ETag: eTag }] 
        })
      });

      if (completeRes.ok) {
        setStatus("✅ Success! Multipart Upload Completed.");
      } else {
        const err = await completeRes.json();
        throw new Error(`Completion failed: ${err.error}`);
      }

    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Error: ${e.message}`);
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-gray-900 p-4 rounded border border-gray-700 text-white z-50">
      <h3 className="font-bold text-sm mb-2">Level 7: R2 Test</h3>
      <p className="text-xs mb-3 text-gray-400 font-mono">{status}</p>
      <button 
        onClick={testUpload}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
      >
        Test Connection
      </button>
    </div>
  );
}