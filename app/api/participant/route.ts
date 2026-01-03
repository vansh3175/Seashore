export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { getPrisma } from '@/utils/prisma';
// POST: Register or Join a Participant
export async function POST(req: Request) {
  const prisma = getPrisma();

  try {
    const body = await req.json();
    const { sessionId, identity, name, role } = body;

    if (!sessionId || !identity) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Upsert: Create if new, Update if exists (e.g. rejoining with same identity)
    const participant = await prisma.participant.upsert({
      where: {
        sessionId_identity: {
          sessionId,
          identity
        }
      },
      update: {
        name: name, // Update name if they changed it
        status: 'active',
        lastSeenAt: new Date(),
      },
      create: {
        sessionId,
        identity,
        name: name || 'Guest',
        role: role || 'guest',
        status: 'active'
      }
    });

    return NextResponse.json({ participant });
  } catch (error) {
    console.error("[PARTICIPANT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// GET: Find a specific participant
export async function GET(req: Request) {
  const prisma = getPrisma();

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const identity = searchParams.get('identity');

    if (!sessionId || !identity) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const participant = await prisma.participant.findUnique({
      where: {
        sessionId_identity: {
          sessionId,
          identity
        }
      }
    });

    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ participant });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// PATCH: Update details (like name change mid-call)
export async function PATCH(req: Request) {
  const prisma = getPrisma();

  try {
    const body = await req.json();
    const { participantId, name, role } = body;

    const participant = await prisma.participant.update({
      where: { id: participantId },
      data: {
        name: name,
        role: role
      }
    });

    return NextResponse.json({ participant });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}