import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error("Missing R2 Environment Variables");
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED', 
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'sea-shore-recordings';