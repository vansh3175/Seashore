import { useEffect, useRef, useState } from 'react';

interface UseCanvasStreamProps {
  mediaStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  participantName?: string;
}

export function useCanvasStream({ 
  mediaStream, 
  isVideoEnabled, 
  isAudioEnabled, 
  participantName = "Guest" 
}: UseCanvasStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [canvasStream, setCanvasStream] = useState<MediaStream | null>(null);
  const animationFrameId = useRef<number|null>(null);

  // Use refs for mutable state so we don't restart the stream/canvas on toggles
  const isVideoEnabledRef = useRef(isVideoEnabled);
  const participantNameRef = useRef(participantName);

  useEffect(() => {
    isVideoEnabledRef.current = isVideoEnabled;
    participantNameRef.current = participantName;
  }, [isVideoEnabled, participantName]);

  // 1. Initial Setup (Canvas & Stream Creation)
  useEffect(() => {
    if (!mediaStream) return;

    const canvas = document.createElement('canvas');
    // Default to standard 1080p, but will update on metadata load
    canvas.width = 1920;
    canvas.height = 1080;
    canvasRef.current = canvas;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = mediaStream;
    videoRef.current = video;

    // CRITICAL FIX: Detect actual input resolution (e.g., Mobile Portrait)
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log(`[CanvasStream] Resized to: ${canvas.width}x${canvas.height}`);
    };

    video.play().catch(e => console.error("Canvas video play error", e));

    // Create the video track from canvas (30 FPS constant)
    const stream = canvas.captureStream(30);
    
    // Add audio track immediately if available
    const audioTrack = mediaStream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);

    setCanvasStream(stream);

    // Start Draw Loop
    const ctx = canvas.getContext('2d');
    const draw = () => {
      if (!canvas || !ctx || !video) return;

      const width = canvas.width;
      const height = canvas.height;

      if (isVideoEnabledRef.current) {
        // A. Draw Camera
        // Since we resized canvas to match video, 0,0,w,h is perfect 1:1 mapping
        ctx.drawImage(video, 0, 0, width, height);
      } else {
        // B. Draw Placeholder (Avatar)
        ctx.fillStyle = '#111827'; 
        ctx.fillRect(0, 0, width, height);

        // Responsive Measurements
        const centerX = width / 2;
        const centerY = height / 2;
        const minDim = Math.min(width, height);
        const radius = minDim * 0.15; // 15% of smallest side

        // Avatar Circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#374151'; 
        ctx.fill();

        // Initials (Responsive Font Size)
        const fontSize = Math.floor(minDim * 0.1); 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const name = participantNameRef.current || "Guest";
        const initials = name.slice(0, 2).toUpperCase();
        ctx.fillText(initials, centerX, centerY);
        
        // Status Text
        const smallFontSize = Math.floor(minDim * 0.04);
        ctx.font = `${smallFontSize}px sans-serif`;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText("Video Paused", centerX, centerY + radius + (smallFontSize * 2));
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [mediaStream]);

  // 2. Audio Mute/Unmute Logic
  useEffect(() => {
    if (!canvasStream) return;
    canvasStream.getAudioTracks().forEach(track => {
      track.enabled = isAudioEnabled;
    });
  }, [isAudioEnabled, canvasStream]);

  return canvasStream;
}