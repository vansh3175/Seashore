export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma'; // Use the server-side client

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sessions = await prisma.session.findMany({
      where: { 
        studioId: id,
        // Only show sessions that actually started or have recordings
        OR: [
            { startedAt: { not: null } },
            { recordings: { some: {} } }
        ]
      },
      include: {
        participants: {
          include: {
            recordings: {
              orderBy: { startedAt: 'asc' }, // Chronological order (Part 1, Part 2...)
              where: { status: 'available' } // Only show finished uploads
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Error fetching recordings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}