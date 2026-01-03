import { NextResponse } from 'next/server';
import { prisma as db } from '@/utils/prisma';
import dayjs from 'dayjs';

// GET /api/studio/[id]/schedule?month=YYYY-MM
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Studio ID
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get('month'); // "2024-10"

    if (!monthStr) {
      return NextResponse.json({ error: "Month parameter is required" }, { status: 400 });
    }

    // Calculate start and end of the month
    const startDate = dayjs(monthStr).startOf('month').toDate();
    const endDate = dayjs(monthStr).endOf('month').toDate();

    // Fetch sessions from Prisma
    const sessions = await db.session.findMany({
      where: {
        studioId: id,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        startedAt: true,
        endedAt: true,
      }
    });

    // Map Prisma result to the frontend format
    const formattedSessions = sessions.map(session => {
      let status = 'scheduled';
      if (session.endedAt) {
        status = 'completed';
      } else if (session.startedAt) {
        status = 'live';
      }

      return {
        id: session.id,
        title: session.title || "Untitled Session",
        scheduledAt: session.scheduledAt?.toISOString(),
        status: status,
      };
    });

    return NextResponse.json({ sessions: formattedSessions });

  } catch (error) {
    console.error("API Schedule Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}