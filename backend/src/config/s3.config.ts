import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  bucketName: process.env.S3_BUCKET_NAME,
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  cdnBaseUrl: process.env.CDN_BASE_URL,
}));
