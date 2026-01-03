import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const usernameParam = req.nextUrl.searchParams.get('username');
  const isHostParam = req.nextUrl.searchParams.get('isHost');

  if (!room) {
    return NextResponse.json({ error: 'Missing room' }, { status: 400 });
  }

  try {
    // 1. Determine Identity (The "Who are you?" Step)
    const user = await currentUser();
    
    let identity: string;
    let name: string;
    let role = isHostParam === 'true' ? 'host' : 'guest';

    if (user) {
      identity = user.id;
      name = (role === 'host')? `${user.fullName}(host)` || "host": user.fullName || "guest";
 
    } else {
      // GUEST: Use name + timestamp (or rely on client storing a UUID cookie)
      // Ideally, guests should generate a UUID on the client and send it here 
      // to allow reconnections. For now, we fallback to Name + Time.
      name = usernameParam || "Guest";
      identity = `${name}_${Date.now()}`; 
    }

    // 2. Find the Active Session
    const studio = await prisma.studio.findUnique({
      where: { id: room },
      include: {
        sessions: {
          where: { endedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!studio || studio.sessions.length === 0) {
       return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    const currentSession = studio.sessions[0];

    // 3. Register Participant (UPSERT = Update if exists, Create if new)
    // This fixes the duplicate issue for Hosts.
    const participant = await prisma.participant.upsert({
      where: {
        // This composite unique key must exist in your schema: @@unique([sessionId, identity])
        sessionId_identity: {
          sessionId: currentSession.id,
          identity: identity
        }
      },
      update: {
        // If they exist, just mark them active again
        status: 'active',
        lastSeenAt: new Date(),
        // Add a connection log entry for the re-join
        events: {
            create: {
                event: 'reconnected',
                timestamp: new Date()
            }
        }
      },
      create: {
        sessionId: currentSession.id,
        identity: identity,
        name: name,
        role: role,
        status: 'active',
        firstJoinedAt: new Date(),
        events: {
            create: {
                event: 'connected',
                timestamp: new Date()
            }
        }
      }
    });

    // 4. Generate Token
  
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { identity, name }
      
    );

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    return NextResponse.json({ 
      token: await at.toJwt(), 
      participantId: participant.id,
      sessionId: currentSession.id,
      identity 
    });

  } catch (error) {
    console.error("Token Error:", error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}