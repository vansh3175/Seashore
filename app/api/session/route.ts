import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/utils/prisma'; // Ensure this matches your prisma import path
import { roomService } from '@/utils/livekitRoomService';

// GET: Check Session Status (Used by Green Room)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studioId = searchParams.get('studioId');

    if (!studioId) {
      return NextResponse.json({ error: "Studio ID is required" }, { status: 400 });
    }

    // 1. Find Studio & Active Session
    const studio = await prisma.studio.findUnique({
      where: { id: studioId },
      include: {
        sessions: {
          where: { endedAt: null }, // Only open sessions
          orderBy: { createdAt: 'desc' }, // Get latest
          take: 1,
          include: {
            participants: {
              where: { role: 'host' },
              orderBy: { firstJoinedAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    const currentSession = studio.sessions[0];

    // 2. Logic: Has it started?
    if (!currentSession || !currentSession.startedAt) {
      // It exists but hasn't "Started" (Scheduled or Instant-Wait)
      return NextResponse.json({ 
        error: "Meeting has not started yet",
        isScheduled: !!currentSession?.scheduledAt,
        scheduledAt: currentSession?.scheduledAt,
        sessionId: currentSession?.id, // Return ID so Host can start it
        ownerId: studio.ownerId // Return Owner ID so frontend knows if YOU are the host
      }, { status: 403 });
    }

    // 3. Logic: Is Host connected?
    // (Optional: You can relax this if you want guests to join before host)
    /* const hostParticipant = currentSession.participants[0];
    const isHostActive = hostParticipant && hostParticipant.status === 'active';
    if (!isHostActive) {
      return NextResponse.json({ 
        error: "Host hasn't joined yet", 
        ownerId: studio.ownerId,
        sessionId: currentSession.id
      }, { status: 202 });
    }
    */

    // 4. Active & Ready
    return NextResponse.json({ 
      status: "active", 
      sessionId: currentSession.id,
      studioName: studio.name,
      ownerId: studio.ownerId
    }, { status: 200 });

  } catch (error) {
    console.error("[SESSION_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST: Create New Session (Instant or Scheduled)
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { studioId, scheduledAt, title } = body;

    if (!studioId) return NextResponse.json({ error: "Studio ID required" }, { status: 400 });

    const studio = await prisma.studio.findUnique({
      where: { id: studioId, ownerId: user.id }
    });

    if (!studio) return NextResponse.json({ error: "Unauthorized" }, { status: 404 });

    let sessionData;

    if (scheduledAt) {
      // Scheduled: Do not close existing sessions
      sessionData = {
        studioId: studio.id,
        scheduledAt: new Date(scheduledAt),
        startedAt: null,
        title: title || `Scheduled Session ${new Date(scheduledAt).toLocaleDateString()}`
      };
    } else {
      // Instant: Close others
      await prisma.session.updateMany({
        where: { studioId: studio.id, endedAt: null },
        data: { endedAt: new Date() }
      });

      sessionData = {
        studioId: studio.id,
        startedAt: new Date(),
        title: title || `Session ${new Date().toLocaleDateString()}`
      };
    }

    const session = await prisma.session.create({ data: sessionData });
    return NextResponse.json({ session });

  } catch (error) {
    console.error("[SESSION_CREATE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// PATCH: Start or End Session
export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sessionId, status } = body; // status = 'ended'
    const { searchParams } = new URL(req.url);
    const task = searchParams.get('task'); // task = 'start' or 'end'

    if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

    const sessionToPatch = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { studio: true }
    });

    if (!sessionToPatch || sessionToPatch.studio.ownerId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 404 });
    }

    // Logic 1: End Session
    if (status === 'ended' || task === 'end') {
        const updatedSession = await prisma.session.update({
            where: { id: sessionId },
            data: { endedAt: new Date() }
        });

        // Kill LiveKit Room
        try {
            if (roomService) {
                await roomService.deleteRoom(sessionToPatch.studioId);
                console.log(`[API] Deleted LiveKit room: ${sessionToPatch.studioId}`);
            }
        } catch (e) {
            console.warn(`[API] Failed to delete LiveKit room:`, e);
        }

        return NextResponse.json({ session: updatedSession });
    }

    // Logic 2: Start Session (Activate Schedule)
    // Close other active sessions first
    await prisma.session.updateMany({
      where: { 
        studioId: sessionToPatch.studioId, 
        endedAt: null,
        id: { not: sessionId }
      },
      data: { endedAt: new Date() }
    });
    
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { startedAt: new Date(), endedAt: null }
    });

    return NextResponse.json({ session: updatedSession });

  } catch (error) {
    console.error("[SESSION_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}