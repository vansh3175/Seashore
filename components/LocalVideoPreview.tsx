'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  LocalAudioTrack, 
  LocalVideoTrack, 
  Track,
} from 'livekit-client';
import { 
  LiveKitRoom, 
  VideoConference, 
  useRoomContext 
} from '@livekit/components-react';
import '@livekit/components-styles';
import { saveChunk } from '@/utils/db'; // We still save to DB for backup!

// --- PART 1: Active Session (The Live Room Logic) ---
function ActiveSession({ userStream }: { userStream: MediaStream }) {
  const room = useRoomContext();
  const [isPublished, setIsPublished] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const publishingRef = useRef(false);

  // 1. Publish Tracks on Mount
  useEffect(() => {
    if (!room || isPublished || publishingRef.current) return;

    const publishTracks = async () => {
      publishingRef.current = true;
      try {
        // A. Get raw tracks from the Lobby stream
        const rawVideoTrack = userStream.getVideoTracks()[0];
        const rawAudioTrack = userStream.getAudioTracks()[0];

        // B. Check if already published to prevent duplicates
        const currentPubs = Array.from(room.localParticipant.trackPublications.values());
        
        const isVideoPublished = rawVideoTrack && currentPubs.some(pub => 
          pub.track?.mediaStreamTrack.id === rawVideoTrack.id ||
          pub.trackName === 'camera-1080p'
        );

        const isAudioPublished = rawAudioTrack && currentPubs.some(pub => 
          pub.trackName === 'mic-input'
        );

        // C. Publish Video (Clone it so we can mute it independently of recorder)
        if (rawVideoTrack && !isVideoPublished) {
          const cloneVideoTrack = rawVideoTrack.clone();
          const localVideo = new LocalVideoTrack(cloneVideoTrack);
          
          await room.localParticipant.publishTrack(localVideo, {
            simulcast: true,
            name: 'camera-1080p',
            source: Track.Source.Camera,
          });
        }

        // D. Publish Audio (Clone it)
        if (rawAudioTrack && !isAudioPublished) {
          const cloneAudioTrack = rawAudioTrack.clone();
          const localAudio = new LocalAudioTrack(cloneAudioTrack);
          
          await room.localParticipant.publishTrack(localAudio, {
            name: 'mic-input',
            source: Track.Source.Microphone,
          });
        }

        setIsPublished(true);

      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('already been published') || e.name === 'TrackInvalidError') {
          console.log("Track already published (benign error), marking active.");
          setIsPublished(true);
        } else {
          console.error("Failed to publish tracks:", e);
        }
      } finally {
        publishingRef.current = false;
      }
    };

    publishTracks();

  }, [room, userStream, isPublished]);

  // 2. Mute/Unmute Handlers (Controls LiveKit ONLY, not Recording)
  const toggleVideo = () => {
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    
    if (pub && pub.track) {
      if (pub.isMuted) {
        pub.track.unmute();
        setVideoMuted(false);
      } else {
        pub.track.mute();
        setVideoMuted(true);
      }
    } else {
      console.warn("No video track found to toggle");
    }
  };

  const toggleAudio = () => {
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    
    if (pub && pub.track) {
      if (pub.isMuted) {
        pub.track.unmute();
        setAudioMuted(false);
      } else {
        pub.track.mute();
        setAudioMuted(true);
      }
    } else {
      console.warn("No audio track found to toggle");
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* The Grid of other users */}
      <VideoConference />

      {/* Custom Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 z-50 bg-black/50 p-4 rounded-xl backdrop-blur-md border border-white/10">
        <button
          onClick={toggleVideo}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            videoMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-white text-gray-900'
          }`}
        >
          {videoMuted ? 'Video Off' : 'Video On'}
        </button>

        <button
          onClick={toggleAudio}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            audioMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-white text-gray-900'
          }`}
        >
          {audioMuted ? 'Mic Off' : 'Mic On'}
        </button>
      </div>
    </div>
  );
}

// --- PART 2: The Main Component (Lobby + Room + Recorder) ---
export default function LocalVideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<string | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('Idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // 1. Camera Init (Level 1 Logic)
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: 30 },
          audio: true
        });
        setActiveStream(stream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        const s = stream.getVideoTracks()[0].getSettings();
        setStreamInfo(`${s.width}x${s.height}`);
      } catch (err) { 
        console.error("Camera Error:", err); 
      }
    };
    startCamera();
  }, []);

  // 2. Initialize Worker (Level 8 Logic)
  useEffect(() => {
    // Create the worker
    workerRef.current = new Worker(new URL('@/workers/upload.worker.ts', import.meta.url));
    
    // Listen for worker messages
    workerRef.current.onmessage = (e) => {
      const { type, partNumber, error } = e.data;
      if (type === 'INIT_SUCCESS') setUploadStatus('Connected to Cloud');
      if (type === 'PART_UPLOADED') setUploadStatus(`Uploaded Part #${partNumber}`);
      if (type === 'UPLOAD_COMPLETE') setUploadStatus('✅ Upload Complete!');
      if (type === 'ERROR') setUploadStatus(`❌ Error: ${error}`);
    };

    return () => workerRef.current?.terminate();
  }, []);

  // 3. Start Recording + Uploading
  const startRecording = () => {
    if (!activeStream || !workerRef.current) return;

    // A. Tell Worker to Start (PASS API BASE URL HERE)
    const fileName = `recording-${Date.now()}.webm`;
    workerRef.current.postMessage({ 
      type: 'INIT', 
      payload: { 
        fileName, 
        apiBase: window.location.origin // <--- THE FIX
      } 
    });

    // B. Start MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(activeStream, { mimeType, videoBitsPerSecond: 2500000 });

    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        // 1. Save to Local DB (Backup)
        await saveChunk(event.data);
        
        // 2. Send to Worker (Upload)
        workerRef.current?.postMessage({ type: 'ADD_CHUNK', payload: { blob: event.data } });
      }
    };

    recorder.onstop = () => {
      console.log("Stopping recorder...");
      // Tell worker to finish up
      workerRef.current?.postMessage({ type: 'FINALIZE' });
    };

    recorder.start(1000); // 1-second chunks
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setUploadStatus('Recording...');
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setUploadStatus('Finalizing Upload...');
  };

  const handleJoin = async () => {
    try {
      const res = await fetch(`/api/token?room=my-room&username=User-${Math.floor(Math.random()*1000)}`);
      const data = await res.json();
      setToken(data.token);
    } catch (e) { 
      console.error("Token Error:", e); 
    }
  };

  // 3. Render: LiveKit Room (Passes the stream down)
  if (token && activeStream) {
    return (
      <div className="h-screen w-full bg-gray-950 relative">
        <LiveKitRoom
          video={false} // Disable auto-publish (Handled by ActiveSession)
          audio={false} // Disable auto-publish
          token={token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          data-lk-theme="default" 
          style={{ height: '100vh' }}
        >
          <ActiveSession userStream={activeStream} />
        </LiveKitRoom>

        {/* Global Recording Controls Overlay */}
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
          <div className="bg-gray-900/80 p-4 rounded-lg border border-gray-700 text-white backdrop-blur-sm">
            <div className="text-xs font-mono text-gray-400 mb-1">Cloud Uplink</div>
            <div className={`font-bold text-sm mb-3 ${uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {uploadStatus}
            </div>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full px-4 py-2 rounded font-bold transition-all ${
                isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Render: Lobby (Unchanged)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-2xl font-bold mb-6">Lobby Check</h1>
      
      <div className="relative w-[800px] aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-2xl mb-8">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover transform -scale-x-100" 
        />
        <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-sm text-green-400 font-mono border border-white/10">
          {streamInfo ? `● ${streamInfo}` : 'Loading...'}
        </div>
      </div>

      <button 
        onClick={handleJoin}
        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-lg transition-all"
      >
        Join Room
      </button>
    </div>
  );
}