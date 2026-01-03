'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X, UploadCloud, FileVideo } from 'lucide-react';
import { getPendingRecordings } from '@/utils/db'; 

export default function GlobalRecovery() {
  const [pendingSessions, setPendingSessions] = useState<any[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [currentPart, setCurrentPart] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recovering' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const workerRef = useRef<Worker | null>(null);

  // 1. Scan for stranded recordings on mount
  useEffect(() => {
    const scanDB = async () => {
      try {
        const sessions = await getPendingRecordings();
        console.log("[GlobalRecovery] Pending sessions found:", sessions);
        if (sessions.length > 0) {
          setPendingSessions(sessions);
        }
      } catch (e) {
        console.error("[GlobalRecovery] Failed to scan IDB:", e);
      }
    };

    // Run immediately
    scanDB();
  }, []);

  // 2. Worker Lifecycle Management
  useEffect(() => {
    if (isRecovering && pendingSessions.length > 0 && !workerRef.current) {
      console.log("[GlobalRecovery] Initializing Recovery Worker...");
      
      // Initialize Worker
      workerRef.current = new Worker(new URL('@/workers/upload.worker.ts', import.meta.url));
      
      workerRef.current.onmessage = (e) => {
        const { type, partNumber, error } = e.data;
        console.log("[GlobalRecovery] Worker Message:", type, partNumber || '');

        if (type === 'PART_UPLOADED' || type === 'PART_RECOVERED') {
          setCurrentPart(prev => prev + 1);
        }

        if (type === 'UPLOAD_COMPLETE') {
          console.log("[GlobalRecovery] Session Finalized.");
          // One session done. Remove it from the list.
          setPendingSessions(prev => {
            const remaining = prev.slice(1);
            if (remaining.length === 0) {
              setStatus('success');
              setIsRecovering(false);
              workerRef.current?.terminate();
              workerRef.current = null;
            } else {
              // Automatically start the next one
              triggerWorkerForSession(remaining[0]);
            }
            return remaining;
          });
        }

        if (type === 'ERROR') {
          console.error("[GlobalRecovery] Recovery Error:", error);
          setStatus('error');
          setErrorMessage(error || 'Unknown upload error');
          setIsRecovering(false);
          workerRef.current?.terminate();
          workerRef.current = null;
        }
      };

      // Start the first session
      triggerWorkerForSession(pendingSessions[0]);
    }

    return () => {
      // Only terminate on unmount if we aren't actively recovering? 
      // Ideally we want it to survive navigation, but React unmounts components on navigation sometimes.
      // Since this is in Layout, it should persist.
    };
  }, [isRecovering, pendingSessions]); // Added pendingSessions dependency

  const triggerWorkerForSession = (session: any) => {
    if (!workerRef.current) return;
    console.log("[GlobalRecovery] Triggering RECOVER for session:", session.sessionId);
    setCurrentPart(0);
    workerRef.current.postMessage({
      type: 'RECOVER',
      payload: {
        sessionId: session.sessionId,
        apiBase: window.location.origin 
      }
    });
  };

  const startRecovery = () => {
    setStatus('recovering');
    setIsRecovering(true);
  };

  const closeDialog = () => {
    setPendingSessions([]);
    setStatus('idle');
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  // If nothing pending, render nothing
  if (pendingSessions.length === 0 && status !== 'success') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0F131F] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        
        {/* Top Highlight Line */}
        <div className={`absolute top-0 left-0 w-full h-1 ${
          status === 'error' ? 'bg-red-500' : 
          status === 'success' ? 'bg-green-500' : 
          'bg-gradient-to-r from-blue-500 to-[#3CE8FF]'
        }`} />

        <div className="p-8 flex flex-col items-center text-center">
          
          {/* --- STATE: IDLE (Prompt) --- */}
          {status === 'idle' && (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 animate-pulse">
                <UploadCloud className="w-8 h-8 text-[#3CE8FF]" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Recover Recordings?</h2>
              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                We found <strong className="text-white">{pendingSessions.length} unfinished recording(s)</strong> from a previous session. 
                This happens if your browser crashed or lost internet connection.
              </p>

              <div className="w-full space-y-3">
                <button 
                  onClick={startRecovery}
                  className="w-full py-4 rounded-xl bg-[#3CE8FF] hover:bg-[#2bc8dd] text-[#0B0F19] font-bold text-lg transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-5 h-5" /> Start Recovery
                </button>
                <button 
                  onClick={closeDialog} 
                  className="w-full py-3 rounded-xl bg-transparent hover:bg-white/5 text-slate-500 font-medium text-sm transition-all"
                >
                  Ignore & Delete Data
                </button>
              </div>
            </>
          )}

          {/* --- STATE: RECOVERING (Blocking Progress) --- */}
          {status === 'recovering' && (
            <>
              <div className="w-20 h-20 relative mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-[#3CE8FF] border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileVideo className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Restoring Your File...</h2>
              <p className="text-slate-400 text-sm mb-6">
                Uploading saved chunks from your device. <br/>
                <span className="text-[#3CE8FF] font-mono mt-2 block">
                  Processing Part #{currentPart + 1}
                </span>
              </p>

              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-[#3CE8FF] w-2/3 animate-pulse" /> 
              </div>
              <p className="text-xs text-slate-500 mt-4">Please do not close this tab.</p>
            </>
          )}

          {/* --- STATE: SUCCESS --- */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">All Safe!</h2>
              <p className="text-slate-400 text-sm mb-8">
                Your recordings have been successfully uploaded and processed.
              </p>
              <button 
                onClick={closeDialog}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-lg shadow-green-900/20"
              >
                Continue to Dashboard
              </button>
            </>
          )}

          {/* --- STATE: ERROR --- */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Recovery Failed</h2>
              <p className="text-red-300 text-sm mb-8 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                {errorMessage}
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setStatus('idle')} // Reset to try again
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={startRecovery} // Retry
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all"
                >
                  Retry
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}