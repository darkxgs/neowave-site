// Public, read-only: the latest published generator snapshot. Cached at the edge; a publish shows up within ~1 minute.
import { latestSnapshot } from '../lib/pcg.js';
import { send } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  try {
    const { data, created_at } = await latestSnapshot();
    return send(res, 200, data, {
      // browsers always revalidate; only Vercel's edge keeps a short cache (CDN-Cache-Control is not passed to browsers)
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'max-age=60, stale-while-revalidate=300',
      'Last-Modified': new Date(created_at).toUTCString(),
    });
  } catch (e) {
    console.error(e);
    return send(res, 503, { error: 'Generator data is temporarily unavailable.' }, { 'Cache-Control': 'no-store' });
  }
}
