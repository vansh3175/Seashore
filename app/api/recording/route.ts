import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/utils/prisma';
import { roomService } from '@/utils/livekitRoomService';

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { studioId, action } = body; // action: 'start' | 'stop'

    if (!studioId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Verify Ownership
    const studio = await prisma.studio.findUnique({
      where: { id: studioId, ownerId: user.id }
    });

    if (!studio) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Update LiveKit Room Metadata
    // This broadcasts the event to everyone connected
    const metadata = JSON.stringify({ isRecording: action === 'start' });
    
    await roomService.updateRoomMetadata(studioId, metadata);

    return NextResponse.json({ success: true, isRecording: action === 'start' });

  } catch (error) {
    console.error("[RECORDING_TOGGLE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}