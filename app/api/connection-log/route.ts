export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { participantId, event } = body; // event: "joined" or "left"

    if (!participantId || !event) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Determine the new status based on the event
    let newStatus = 'active';
    if (event === 'left' || event === 'disconnected') {
      newStatus = 'disconnected';
    }

    // Run inside a transaction to keep Participant Status and Logs in sync
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Create the Log Entry
      const log = await tx.connectionLog.create({
        data: {
          participantId,
          event,
          timestamp: new Date(),
        }
      });

      // 2. Update the Participant's current state
      const updatedParticipant = await tx.participant.update({
        where: { id: participantId },
        data: {
          status: newStatus,
          lastSeenAt: new Date(),
          // Only set leftAt if they are actually leaving
          ...(newStatus === 'disconnected' ? { leaveAt: new Date() } : {})
        }
      });

      return { log, updatedParticipant };
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("[CONNECTION_LOG]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}