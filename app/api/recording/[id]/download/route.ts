export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from 'next/server';
import { getPrisma } from '@/utils/prisma';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const prisma = getPrisma();

  try {
    const { id } = await params;

    // 1. Capture Env Vars securely
    const r2Bucket = process.env.BUCKET_NAME;
    const r2Endpoint = process.env.R2_ENDPOINT;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;

    // 2. Validate
    const missingVars = [];
    if (!r2Bucket) missingVars.push("R2_BUCKET_NAME");
    if (!r2Endpoint) missingVars.push("R2_ENDPOINT");
    if (!r2AccessKey) missingVars.push("R2_ACCESS_KEY_ID");
    if (!r2SecretKey) missingVars.push("R2_SECRET_ACCESS_KEY");

    if (missingVars.length > 0) {
      console.error("Missing R2 Env Vars:", missingVars);
      return NextResponse.json({ 
        error: `Server Config Error: Missing ${missingVars.join(', ')}` 
      }, { status: 500 });
    }

    // 3. Initialize S3 Client
    const s3 = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKey!, // We know these exist now
        secretAccessKey: r2SecretKey!,
      },
      forcePathStyle: true, // Required for R2
    });

    // 4. Find recording
    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording || !recording.s3Key) {
      console.error(`Recording not found or missing s3Key: ${id}`);
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    // 5. Generate Signed URL
    const extension = recording.s3Key.split('.').pop() || 'webm';
    
    // console.log(`Generating signed URL for: ${recording.s3Key}`);

    const command = new GetObjectCommand({
      Bucket: r2Bucket,
      Key: recording.s3Key,
      ResponseContentDisposition: `attachment; filename="recording-${id}.${extension}"`,
    });

    // Sign the URL
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); 

    return NextResponse.json({ url });

  } catch (error: any) {
    console.error("Download Route Error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error",
      details: error.toString() 
    }, { status: 500 });
  }
}