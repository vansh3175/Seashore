import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/utils/r2";
import { getPrisma } from "@/utils/prisma";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const prisma = getPrisma();

  try {
    const body = await req.arrayBuffer();
    const buffer = Buffer.from(body);

    const { searchParams } = req.nextUrl;
    const studioId = searchParams.get("studioId");
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");
    const recordingId = searchParams.get("recordingId");
    const type = searchParams.get("type");
    const startedAt = searchParams.get("startedAt");
    const endedAt = searchParams.get("endedAt");
    const duration = searchParams.get("duration");

    if (!studioId || !sessionId || !userId || !recordingId) {
      return NextResponse.json(
        { error: "Missing metadata query params" },
        { status: 400 }
      );
    }

    const key = `${studioId}/${sessionId}/${userId}/${recordingId}.webm`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "video/webm"
      })
    );

    const head = await r2.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: key
      })
    );

    const fileSize = Number(head.ContentLength || buffer.length);

    // If it was a small file, the DB row might not exist yet (because INIT creates it).
    // We try to update, if fail, we create.
    
    // However, finding the correct participant is needed for creation.
    // Assuming standard flow:
    const participant = await prisma.participant.findFirst({
        where: { sessionId: sessionId, identity: userId }
    });

    if (participant) {
        // Upsert logic for recording
        // We use the 'sessionId' passed as recordingId in the query if no UUID exists yet
        // But cleaner is to let Prisma handle ID gen if creating.
        
        // Check if recording exists by ID (if we have one) OR create new
        // Since single upload didn't do INIT, we likely need to create.
        await prisma.recording.create({
            data: {
                id: recordingId, // If we passed a UUID. If not, omit this.
                participantId: participant.id,
                sessionId,
                type: type || "camera",
                status: "available",
                startedAt: startedAt ? new Date(startedAt) : new Date(),
                endedAt: endedAt ? new Date(endedAt) : new Date(),
                duration: Number(duration || 0),
                fileSize,
                s3Key: key
            }
        });
    }

    return NextResponse.json({
      location: key,
      fileSize
    });
  } catch (err: any) {
    console.error("[UPLOAD SINGLE ERROR]", err);
    return NextResponse.json(
      { error: err.message || "Single upload failed" },
      { status: 500 }
    );
  }
}