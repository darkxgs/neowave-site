// Product photo storage: Neon object storage (S3-compatible, private bucket).
// Photos are served publicly through /media/<key> (api/media.js), so the bucket itself stays private.
// Env names avoid AWS_* because Vercel reserves those for its own runtime.
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const PREFIX = 'products/';
let client;

export function storageEnabled() {
  return !!(process.env.NEON_S3_ENDPOINT && process.env.NEON_S3_KEY_ID && process.env.NEON_S3_SECRET);
}
function s3() {
  if (!storageEnabled()) throw new Error('Photo storage is not configured');
  client ??= new S3Client({
    endpoint: process.env.NEON_S3_ENDPOINT,
    region: process.env.NEON_S3_REGION || 'eu-central-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.NEON_S3_KEY_ID, secretAccessKey: process.env.NEON_S3_SECRET },
  });
  return client;
}
const bucket = () => process.env.NEON_S3_BUCKET || 'assets';

export async function putObject(key, body, contentType) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}
export async function getObject(key) {
  return s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function listObjects(prefix = PREFIX) {
  const out = [];
  let token;
  do {
    const r = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents || []) out.push({ key: o.Key, size: o.Size, modified: o.LastModified });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token && out.length < 5000);
  return out.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}
