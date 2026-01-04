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

    const params = req.nextUrl.searchParams;

    const studioId = params.get("studioId");
    const sessionId = params.get("sessionId");
    const userId = params.get("userId");
    const recordingId = params.get("recordingId");
    const type = params.get("type");
    const startedAt = params.get("startedAt");
    const endedAt = params.get("endedAt");
    const duration = params.get("duration");

    if (!studioId || !sessionId || !userId || !recordingId) {
      return NextResponse.json(
        { error: "Missing metadata" },
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

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        fileSize,
        duration: duration ? Number(duration) : undefined,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        endedAt: endedAt ? new Date(endedAt) : new Date(),
        status: "available",
        s3Key: key
      }
    });

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
