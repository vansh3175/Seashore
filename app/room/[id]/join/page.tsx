'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { 
  LocalAudioTrack, 
  LocalVideoTrack, 
  RoomEvent, 
  Track,
  ConnectionState, 
} from 'livekit-client';
import { 
  LiveKitRoom, 
  VideoConference,
  ControlBar, 
  useRoomContext,
  useConnectionState, 
  useLocalParticipant, 
} from '@livekit/components-react';
import '@livekit/components-styles';

import { Inter } from 'next/font/google';
import { 
  Mic, MicOff, Video, VideoOff, ArrowLeft, Loader2, CheckCircle2,
  Camera, Waves, LogOut, Play, Clock,
  Power,
  WifiOff
} from 'lucide-react';
import axios from 'axios';
import { useCanvasStream } from '@/hooks/useCanvasStream';

const inter = Inter({ subsets: ['latin'] });

// ============================================================================
// PART 1: THE ACTIVE SESSION (Live Room + Stream Compositor)
// ============================================================================
interface ActiveSessionProps {
  userStream: MediaStream;
  participantId: string | null;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isHost: boolean;
  uploadStatus: string;
  handleEndSession: () => void;
  studioId: string;
  participantName: string;
  setRecordingStream: (stream: MediaStream) => void;
}

function ActiveSession({ 
  userStream, 
  participantId, 
  isRecording, 
  startRecording, 
  stopRecording,
  isHost,
  uploadStatus,
  handleEndSession,
  studioId,
  participantName,
  setRecordingStream,
}: ActiveSessionProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  
  const { isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  const [isPublished, setIsPublished] = useState(false);
  const publishingRef = useRef(false);

  const recStream = useCanvasStream({
    mediaStream: userStream,
    isVideoEnabled: isCameraEnabled, 
    isAudioEnabled: isMicrophoneEnabled,
    participantName: participantName || "Guest",
  });

  useEffect(() => {
    if (recStream) {
        setRecordingStream(recStream);
    }
  }, [recStream, setRecordingStream]);

  // Debug Connection
  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      if (room.name !== studioId) {
        // Mismatch logic could go here if needed
      }
    }
  }, [connectionState, room.name, studioId]);

  // Handle Metadata Changes (Sync Recording State)
  useEffect(() => {
    if (!room) return;
    const handleMetadataChange = () => {
      const metadata = JSON.parse(room.metadata || "{}");
      if (metadata.isRecording) {
        if (!isRecording && recStream) startRecording();
      } else {
        if (isRecording) stopRecording();
      }
    };
    room.on(RoomEvent.RoomMetadataChanged, handleMetadataChange);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handleMetadataChange);
    };
  }, [room, isRecording, startRecording, stopRecording, recStream]);

  // Handle Disconnects (Safely Stop Recording)
  useEffect(() => {
    if (!room) return;

    const logDisconnect = () => {
      let performRedirect = true;

      if (isRecording) {
        stopRecording(); 
        performRedirect = false; 
      }

      if (participantId) {
        fetch('/api/connection-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, event: 'left' }),
          keepalive: true,
        });
      }

      if (performRedirect && connectionState === ConnectionState.Connected) {
         window.location.href = "/ended";
      }
    };

    const handleRoomDisconnect = (reason?: any) => {
        logDisconnect();
    };

    room.on(RoomEvent.Disconnected, handleRoomDisconnect); 
    
    return () => {
        room.off(RoomEvent.Disconnected, handleRoomDisconnect);
    };
  }, [room, participantId, connectionState, isRecording, stopRecording]);

  // Publish Tracks
  useEffect(() => {
    if (!room || isPublished || publishingRef.current) return;

    const publishTracks = async () => {
      publishingRef.current = true;
      try {
        const rawVideoTrack = userStream.getVideoTracks()[0];
        const rawAudioTrack = userStream.getAudioTracks()[0];
        const currentPubs = Array.from(room.localParticipant.trackPublications.values());
        
        const isVideoPublished = rawVideoTrack && currentPubs.some(pub => 
          pub.track?.mediaStreamTrack.id === rawVideoTrack.id || pub.trackName === 'camera-1080p'
        );
        const isAudioPublished = rawAudioTrack && currentPubs.some(pub => 
          pub.trackName === 'mic-input'
        );

        if (rawVideoTrack && !isVideoPublished) {
          // [OPTIMIZATION] Simulcast is crucial for mobile clients viewing this stream
          await room.localParticipant.publishTrack(new LocalVideoTrack(rawVideoTrack.clone()), {
            simulcast: true, name: 'camera-1080p', source: Track.Source.Camera,
          });
        }
        if (rawAudioTrack && !isAudioPublished) {
          await room.localParticipant.publishTrack(new LocalAudioTrack(rawAudioTrack.clone()), {
            name: 'mic-input', source: Track.Source.Microphone,
          });
        }
        setIsPublished(true);
      } catch (e: any) {
        // Ignored
      } finally {
        publishingRef.current = false;
      }
    };
    publishTracks();
  }, [room, userStream, isPublished]);

  const isConnected = connectionState === ConnectionState.Connected;
  
  const getButtonText = () => {
    if (isConnected) return isRecording ? 'Stop Rec' : 'Start Rec';
    switch (connectionState) {
        case ConnectionState.Connecting: return 'Connecting...';
        case ConnectionState.Reconnecting: return 'Reconnecting...';
        case ConnectionState.Disconnected: return 'Disconnected';
        default: return 'Wait...';
    }
  };

  return (
    <div className="relative w-full h-full bg-[#050810]">
      <VideoConference>
        <ControlBar>
          {/* ScreenShareButton intentionally removed */}
        </ControlBar>
      </VideoConference>
      
      {isHost && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">

          

          {/* 🎙️ RECORD */}
          <button
            disabled={!isConnected || !recStream}
            onClick={isRecording ? stopRecording : startRecording}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
              border transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isRecording
                ? "bg-red-600 border-red-500 text-white"
                : "bg-black/60 border-white/10 text-white hover:bg-red-600"}
            `}
          >
            {isRecording ? (
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
            ) : (
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
            {isRecording ? "Stop" : "Record"}
          </button>

          {/* ⛔ END */}
          <button
            onClick={handleEndSession}
            disabled={!isConnected}
            className="
              flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
              bg-black/60 border border-white/10 text-white
              hover:bg-red-600 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Power size={12} />
            End
          </button>

        </div>
      )}


    </div>
  );
}

// ============================================================================
// PART 2: THE GREEN ROOM (Lobby -> Active Transition)
// ============================================================================
export default function StudioJoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const studioId = id; 

  const { user, isLoaded: isAuthLoaded } = useUser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState("Guest"); 
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Session State
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'active' | 'scheduled'  | 'error'>('checking');
  const [isHost, setIsHost] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('Idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const [recordingStream, setRecordingStream] = useState<MediaStream|null>(null);

  // 1. SESSION STATE CHECK
  const checkSession = async () => {
    if (!studioId) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/session?studioId=${studioId}`);
      const data = await res.json();

      if (res.status === 404) {
        setSessionStatus('error');
        return;
      }

      const isUserHost = user?.id === data.ownerId; 
      setIsHost(isUserHost);
      
      if(isUserHost){
        setDisplayName(user?.firstName ? `${user.firstName} (Host)` : "Host");
      } else {
        setDisplayName(user?.firstName || "Guest");
      }

      if (res.status === 200) {
        setSessionStatus('active');
        setSessionId(data.sessionId);
        return;
      }

      if (res.status === 202) {
          setSessionStatus('active'); 
          if (data.sessionId) setSessionId(data.sessionId);
      }

      if (res.status === 403) {
        if (data.isScheduled) {
            setScheduledTime(data.scheduledAt);
            setSessionStatus('scheduled');
            if(data.sessionId) setSessionId(data.sessionId); 
        } else {
            setSessionStatus('error');
        }
      }

    } catch (err) {
      setSessionStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoaded) return;
    checkSession();
  }, [studioId, isAuthLoaded, user]);

  // 2. Initialize Camera (OPTIMIZED FOR MOBILE)
  useEffect(() => {
    const startCamera = async () => {
      try {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        
        // [FIX] Use lighter constraints for mobile to prevent encoding lag
        const constraints = isMobile 
          ? { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } }, audio: true }
          : { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        setActiveStream(stream);
        setIsLoading(false);
      } catch (err) { 
        setIsLoading(false);
      }
    };
    startCamera();
  }, []);

  useEffect(() => {
    if (videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream;
    }
  }, [activeStream, isLoading]);

  // 3. Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('@/workers/upload.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
      const { type, partNumber, error } = e.data;
      if (type === 'INIT_SUCCESS') setUploadStatus('Connected');
      if (type === 'PART_UPLOADED') setUploadStatus(`Uploaded Part ${partNumber}`);
      if (type === 'UPLOAD_COMPLETE') {
          setUploadStatus('Upload Complete');
      }
      if (type === 'ERROR') setUploadStatus(`Error: ${error}`);
    };
    return () => workerRef.current?.terminate();
  }, []); 

  // 4. Force Stop on Tab Close (Safety Net)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isRecording) {
            e.preventDefault();
            e.returnValue = '';
            
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  // 5. Actions
  const handleJoin = async () => {
    setIsJoining(true);
    setConnectionError(null);
    try {
      const res = await fetch(`/api/token?room=${studioId}&username=${displayName}&isHost=${isHost}`);
      if (!res.ok) throw new Error("Failed to fetch token");
      const data = await res.json();
      setToken(data.token);
      setParticipantId(data.participantId);
    } catch (e: any) { 
      setIsJoining(false);
      setConnectionError(e.message || "Failed to join room");
    }
  };

  const handleStartSession = async () => {
    if (!sessionId) return;
    setIsJoining(true);
    try {
        const res = await axios.patch('/api/session/?task=start',{sessionId});
        if (res.status!=200) throw new Error("Failed to start");
        await handleJoin();
    } catch (e) {
        setIsJoining(false);
        alert("Failed to start session");
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    if (!confirm("Are you sure you want to end this session for everyone?")) return;
    try {
        await fetch('/api/session/?task=end', {
            method: 'PATCH',
            body: JSON.stringify({ sessionId }),
            keepalive: true,
        });
        window.location.href = `/studio/${studioId}`;
    } catch (e) {
        alert("Failed to end session");
    }
  }

  // 6. Recording Logic
  const toggleRecording = async (action: "start" | "stop") => {
    try {
      await fetch("/api/recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId,
          action
        })
      });
    } catch (err) {
      // Ignored
    }
  };

  const startRecording = () => {
    if (!recordingStream || !workerRef.current) {
        return;
    }

    toggleRecording("start");

    const startedAt = new Date().toISOString(); 

    workerRef.current.postMessage({
      type: "INIT",
      payload: {
        apiBase: window.location.origin,
        studioId,
        sessionId,
        userId: user?.id,
        recordingType: "camera", 
        startedAt
      }
    });

    // [FIX] Optimized MimeType Selection for Mobile
    const getBestMimeType = () => {
        // Order of preference: H.264 (hardware) -> VP8 (lighter) -> VP9 (heavy)
        const types = [
            "video/webm; codecs=h264",
            "video/mp4; codecs=h264", // Safari
            "video/webm; codecs=vp8",
            "video/webm; codecs=vp9",
            "video/webm"
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return "video/webm";
    };

    const mimeType = getBestMimeType();

    const recorder = new MediaRecorder(recordingStream, {
      mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps is good for 720p/1080p
    });

    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        workerRef.current?.postMessage({
          type: "ADD_CHUNK",
          payload: { blob: event.data }
        });
      }
    };

    recorder.onstop = () => {
      const endedAt = new Date().toISOString();
      const duration =
        (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;

      workerRef.current?.postMessage({
        type: "FINALIZE",
        payload: { endedAt, duration }
      });
    };

    recorder.start(1000); 
    mediaRecorderRef.current = recorder;

    setIsRecording(true);
    setUploadStatus("Recording...");
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    toggleRecording("stop");
    setIsRecording(false);
    setUploadStatus("Finalizing...");
  };

  const getStatusText = () => {
    if (sessionStatus === 'checking' || isChecking) return "Connecting to studio details...";
    if (sessionStatus === 'error') return "Unable to find this studio.";
    
    if (sessionStatus === 'scheduled') {
       if (scheduledTime) {
         const date = new Date(scheduledTime);
         return `This session is scheduled for ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
       }
       return "This session is scheduled for a future date.";
    }

    if (sessionStatus === 'active') {
      return "The session is live. You are ready to join.";
    }

    return "Check your audio and video before entering.";
  };

  const renderActionSection = () => {
    if (sessionStatus === 'checking' || isChecking) return <p className="text-slate-500 animate-pulse">Checking studio status...</p>;
    if (sessionStatus === 'error') return <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">Studio not found.</div>;

    if (sessionStatus === 'scheduled') {
        const scheduleDate = new Date(scheduledTime!);
        const now = new Date();
        const diffMinutes = (scheduleDate.getTime() - now.getTime()) / 1000 / 60;
        const isEarly = diffMinutes > 15;

        if (isHost) {
            if (isEarly) {
                return (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 text-blue-400 font-bold">
                            <Clock className="w-5 h-5" /> Scheduled: {scheduleDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        <p className="text-sm text-slate-400">You can start 15 min early.</p>
                    </div>
                );
            }
            return (
                <button onClick={handleStartSession} disabled={isJoining} className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 transition-all">
                    {isJoining ? <Loader2 className="animate-spin" /> : <>Start Session <Play className="w-5 h-5 fill-current" /></>}
                </button>
            );
        } else {
            return null; 
        }
    }

    return (
        <div className="space-y-4">
             {connectionError && (
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <WifiOff size={16} /> {connectionError}
                 </div>
             )}
            <button onClick={handleJoin} disabled={isJoining || isLoading} className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-[#3CE8FF] hover:bg-[#2bc8dd] text-[#0B0F19] hover:scale-[1.02] shadow-lg shadow-blue-900/20 transition-all">
                {isJoining ? <Loader2 className="animate-spin" /> : <>Join Studio Now <CheckCircle2 className="w-6 h-6" /></>}
            </button>
        </div>
    );
  };

  if (token && activeStream && participantId) {
    if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
        return <div className="h-screen flex items-center justify-center text-red-500">Configuration Error: Missing LiveKit URL</div>;
    }

    return (
      <div className="h-screen w-full bg-[#050810] relative">
        {isRecording && (
             <div className="absolute top-6 left-6 z-50 flex items-center gap-3 bg-red-950/80 border border-red-500/30 pl-3 pr-4 py-1.5 rounded-full backdrop-blur-md shadow-xl animate-fade-in-down">
                <div className="relative flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full z-10" />
                    <div className="absolute w-full h-full bg-red-500 rounded-full animate-ping opacity-75" />
                </div>
                <span className="text-red-200 text-[10px] font-black tracking-[0.2em] uppercase">REC</span>
            </div>
        )}

        <LiveKitRoom
          video={false} audio={false} token={token}
          connect={true}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          data-lk-theme="default" style={{ height: '100vh' }}
          onError={(e) => {
             // Ignored
          }}
        >
          <ActiveSession 
            userStream={activeStream} 
            participantId={participantId} 
            startRecording={startRecording}
            stopRecording={stopRecording}
            isRecording={isRecording}  
            isHost={isHost}
            uploadStatus={uploadStatus}
            handleEndSession={handleEndSession}
            studioId={studioId}
            participantName={displayName}
            setRecordingStream={setRecordingStream}
          />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#050810] text-white flex flex-col overflow-hidden">
      
      <header className="h-14 md:h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/studio" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
          <div className="flex items-center gap-2 font-bold text-base md:text-lg tracking-tight">
            <Waves className="w-5 h-5 md:w-6 md:h-6 text-[#3CE8FF]" />
            <span className="text-slate-400">Check your gear</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex items-center justify-center px-4 md:px-6">
        <div className="w-full max-w-7xl h-full grid lg:grid-cols-3 gap-4 md:gap-8 items-center">

          <div className="lg:col-span-2 w-[93vw]  sm:w-full flex flex-col justify-center gap-3">
            <div className="relative w-full h-[55vh]  sm:h-[60vh] lg:h-[65vh] bg-black rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 shadow-2xl">

              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-gray-500">Starting Camera...</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-500 ${
                      isVideoOff ? "opacity-0" : "opacity-100"
                    }`}
                  />

                  <div
                    className={`absolute inset-0 flex flex-col items-center justify-center bg-[#0F131F] transition-opacity duration-500 ${
                      isVideoOff ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <VideoOff className="w-12 h-12 text-slate-500 mb-4" />
                    <p className="text-slate-500 font-medium">Camera is off</p>
                  </div>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-3 rounded-xl transition-all ${
                        isMuted
                          ? "bg-red-500/20 text-red-500"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => setIsVideoOff(!isVideoOff)}
                      className={`p-3 rounded-xl transition-all ${
                        isVideoOff
                          ? "bg-red-500/20 text-red-500"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between px-2 text-xs md:text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-2 truncate">
                <Camera className="w-4 h-4" />
                {activeStream?.getVideoTracks()[0]?.label || "Camera"}
              </span>
              <span className="flex items-center gap-2 truncate">
                <Mic className="w-4 h-4" />
                {activeStream?.getAudioTracks()[0]?.label || "Mic"}
              </span>
            </div>
          </div>

          <div className="w-full flex flex-col justify-center gap-4 lg:gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                {isHost ? "Welcome, Host" : "Ready to join?"}
              </h1>
              <p className="text-gray-400 text-base md:text-lg mt-2">
                {getStatusText()}
              </p>
            </div>

            <div className="space-y-3">
              {renderActionSection()}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}