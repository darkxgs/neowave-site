// Public read-only proxy for uploaded product photos: /media/products/<file> -> private Neon storage bucket.
// Upload keys contain a content hash, so responses are immutable and cached at the edge for a year.
import { getObject, PREFIX, storageEnabled } from '../lib/storage.js';

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export default async function handler(req, res) {
  const notFound = () => { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=60'); res.end('Not found'); };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
  const url = new URL(req.url, 'http://x');
  const key = url.searchParams.get('key') ?? url.pathname.replace(/^\/(api\/)?media\/?/, '');
  const m = /^products\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/.exec(key || '');
  if (!m || !key.startsWith(PREFIX) || !storageEnabled()) return notFound();
  try {
    const obj = await getObject(key);
    res.statusCode = 200;
    res.setHeader('Content-Type', TYPES[m[1]]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (obj.ContentLength) res.setHeader('Content-Length', String(obj.ContentLength));
    if (req.method === 'HEAD') return res.end();
    res.end(Buffer.from(await obj.Body.transformToByteArray()));
  } catch (e) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return notFound();
    console.error(e);
    res.statusCode = 502; res.setHeader('Cache-Control', 'no-store'); res.end('Storage error');
  }
}
