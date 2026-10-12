// Single router for every admin route (keeps the deployment within the Hobby plan's function limit).
// vercel.json rewrites /api/admin/<path> -> /api/admin?path=<path>
import crypto from 'node:crypto';
import { putObject, listObjects, storageEnabled } from '../lib/storage.js';
import { HttpError, send, readJson, readBody } from '../lib/http.js';
import { currentUser, login, sessionCookie, clearCookie } from '../lib/auth.js';
import * as pcg from '../lib/pcg.js';

function routePath(req) {
  const url = new URL(req.url, 'http://x');
  const p = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/admin\/?/, '');
  return p.split('/').filter(Boolean).map(decodeURIComponent);
}
const intId = v => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Not found'); return n; };

async function uploadImage(req) {
  if (!storageEnabled()) throw new HttpError(501, 'Photo storage is not configured on the server.');
  const name = decodeURIComponent(String(req.headers['x-filename'] || 'image.png'));
  const buf = await readBody(req, 4 * 1024 * 1024);
  const sig = buf.subarray(0, 4).toString('hex');
  const ext = sig.startsWith('89504e47') ? 'png' : sig.startsWith('ffd8ff') ? 'jpg' : sig === '52494646' ? 'webp' : null;
  if (!ext) throw new HttpError(422, 'Upload a PNG, JPG or WebP image (max 4 MB).');
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'image';
  // content hash in the key: identical uploads reuse one file, and /media can cache it forever
  const key = `products/${stem}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10)}.${ext}`;
  await putObject(key, buf, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  return { path: `media/${key}` };
}

async function uploadedImages() {
  if (!storageEnabled()) return [];
  return (await listObjects()).map(o => `media/${o.key}`);
}

export default async function handler(req, res) {
  try {
    const [res0, id, sub] = routePath(req);
    const m = req.method;
    // State-changing requests must come from our own admin page (custom header can't be sent cross-site without CORS).
    if (m !== 'GET' && req.headers['x-requested-with'] !== 'nw-admin') throw new HttpError(403, 'Forbidden');

    if (res0 === 'login' && m === 'POST') {
      const b = await readJson(req);
      const u = await login(req, b.email, b.password);
      return send(res, 200, { user: { id: u.id, email: u.email, name: u.name } }, { 'Set-Cookie': sessionCookie(req, u) });
    }
    if (res0 === 'session' && m === 'GET') {
      const u = await currentUser(req);
      return send(res, 200, { user: u ? { id: u.id, email: u.email, name: u.name } : null }, { 'Cache-Control': 'no-store' });
    }

    const user = await currentUser(req);
    if (!user) throw new HttpError(401, 'Please sign in.');
    const json = () => readJson(req);
    res.setHeader('Cache-Control', 'no-store');

    switch (res0) {
      case 'logout': if (m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(req) }); break;
      case 'bootstrap': if (m === 'GET') return send(res, 200, { ...await pcg.bootstrap(), me: { id: user.id, email: user.email, name: user.name } }); break;
      case 'models':
        if (!id && m === 'POST') return send(res, 201, await pcg.saveModel(user, null, await json()));
        if (id && m === 'GET') return send(res, 200, await pcg.getModel(intId(id)));
        if (id && m === 'PUT') return send(res, 200, await pcg.saveModel(user, intId(id), await json()));
        if (id && m === 'DELETE') { await pcg.deleteModel(user, intId(id)); return send(res, 200, { ok: true }); }
        break;
      case 'features':
        if (!id && m === 'POST') return send(res, 201, await pcg.createFeature(user, await json()));
        if (id && m === 'PUT') { await pcg.renameFeature(user, id, await json()); return send(res, 200, { ok: true }); }
        if (id && m === 'DELETE') { await pcg.deleteFeature(user, id); return send(res, 200, { ok: true }); }
        break;
      case 'images':
        if (m === 'GET') return send(res, 200, { uploads: await uploadedImages(), uploadsEnabled: storageEnabled() });
        if (m === 'POST') return send(res, 201, await uploadImage(req));
        break;
      case 'audit': if (m === 'GET') return send(res, 200, await pcg.recentAudit()); break;
      case 'publish': if (m === 'POST') return send(res, 200, await pcg.publish(user)); break;
      case 'users':
        if (!id && m === 'GET') return send(res, 200, await pcg.listUsers());
        if (!id && m === 'POST') return send(res, 201, await pcg.createUser(user, await json()));
        if (id && m === 'DELETE') { await pcg.deleteUser(user, intId(id)); return send(res, 200, { ok: true }); }
        break;
      case 'password':
        if (m === 'POST') {
          const u = await pcg.changePassword(user, await json());
          return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, u) });
        }
        break;
    }
    throw new HttpError(404, 'Not found');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'Something went wrong on the server. Please try again.' });
  }
}
