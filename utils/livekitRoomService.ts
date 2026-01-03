import { RoomServiceClient } from 'livekit-server-sdk';

// We convert the WSS URL (used by frontend) to HTTPS (used by backend API)
const livekitHost = process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('wss://', 'https://');

if (!livekitHost || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  throw new Error("LiveKit keys missing. Check your .env.local file.");
}

export const roomService = new RoomServiceClient(
  livekitHost,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);