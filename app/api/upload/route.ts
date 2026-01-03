export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/utils/r2"; // Ensure these exist in your project
import { prisma } from "@/utils/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      studioId,
      sessionId,
      userId, // This is the Clerk User ID sent from frontend
      type,
      startedAt,
      fullKey,
      uploadId,
      partNumber,
      parts,
      recordingId,
      endedAt,
      duration
    } = body;

    // ============================================================
    // 1️⃣ INIT — Create DB row + Start multipart upload
    // ============================================================
    if (action === "INIT") {
      if (!studioId || !sessionId || !userId || !type || !startedAt)
        return NextResponse.json(
          { error: "Missing fields in INIT" },
          { status: 400 }
        );

      // FIX: We must find the PARTICIPANT ID based on the User ID (Clerk Identity)
      // The Recording table links to Participant, not User directly.
      const participant = await prisma.participant.findFirst({
        where: {
          sessionId: sessionId,
          identity: userId
        }
      });

      if (!participant) {
        return NextResponse.json(
          { error: "Participant not found for this session" },
          { status: 404 }
        );
      }

      // Create DB row
      const recording = await prisma.recording.create({
        data: {
          participantId: participant.id, // Use the UUID, not the Clerk ID
          sessionId,
          type, // "camera" or "screen"
          status: "uploading",
          startedAt: new Date(startedAt)
        }
      });

      // Construct Key: studio/session/clerk_id/recording_uuid.webm
      const key = `${studioId}/${sessionId}/${userId}/${recording.id}.webm`;

      // Create R2 multipart upload
      const command = new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: "video/webm"
      });

      const { UploadId } = await r2.send(command);

      return NextResponse.json({
        uploadId: UploadId,
        recordingId: recording.id,
        fullKey: key
      });
    }

    // ============================================================
    // 2️⃣ PART — Upload chunk + update updatedAt
    // ============================================================
    if (action === "PART") {
      if (!uploadId || !partNumber || !fullKey || !recordingId)
        return NextResponse.json(
          { error: "Missing uploadId, partNumber, fullKey, or recordingId" },
          { status: 400 }
        );

      // Update "heartbeat" so we know the upload is still active
      await prisma.recording.update({
        where: { id: recordingId },
        data: { updatedAt: new Date() }
      });

      const command = new UploadPartCommand({
        Bucket: R2_BUCKET,
        Key: fullKey,
        UploadId: uploadId,
        PartNumber: partNumber
      });

      const signedUrl = await getSignedUrl(r2, command, { expiresIn: 600 });

      return NextResponse.json({ signedUrl });
    }

    // ============================================================
    // 3️⃣ COMPLETE — Finalize upload + update DB
    // ============================================================
    if (action === "COMPLETE") {
      if (!uploadId || !parts || !fullKey || !recordingId)
        return NextResponse.json(
          { error: "Missing uploadId, parts, fullKey, or recordingId" },
          { status: 400 }
        );

      // Complete multipart upload
      const command = new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: fullKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      });

      const result = await r2.send(command);

      // Fetch final file size
      const head = await r2.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET,
          Key: fullKey
        })
      );

      const fileSize = Number(head.ContentLength || 0);

      // Update DB
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          fileSize,
          duration,
          endedAt: endedAt ? new Date(endedAt) : new Date(),
          status: "available",
          s3Key: fullKey
        }
      });

      return NextResponse.json({
        location: result.Location,
        fileSize
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (err: any) {
    console.error("[UPLOAD ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}