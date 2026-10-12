// Local stand-in for Vercel: serves site/ statically, routes /api/* to the same function handlers,
// applies vercel.json headers/rewrites. Uses the restricted pcg_app connection from gen/.env.
//   node dev-server.mjs        -> http://localhost:5530
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(ROOT, 'site');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'gen', '.env'), 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
process.env.DATABASE_URL = env.PCG_APP_DATABASE_URL;
process.env.SESSION_SECRET = env.SESSION_SECRET;
for (const k of ['NEON_S3_ENDPOINT', 'NEON_S3_KEY_ID', 'NEON_S3_SECRET', 'NEON_S3_REGION', 'NEON_S3_BUCKET']) if (env[k]) process.env[k] = env[k];

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const admin = (await import('./api/admin.js')).default;
const generator = (await import('./api/generator.js')).default;
const media = (await import('./api/media.js')).default;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf' };

function applyHeaders(res, pathname) {
  for (const h of config.headers) {
    const re = new RegExp('^' + h.source.replace(/\(([^)]*)\)/g, '($1)').replace(/\//g, '\\/') + '$');
    if (re.test(pathname)) for (const { key, value } of h.headers) res.setHeader(key, value);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  applyHeaders(res, p);
  if (p.startsWith('/api/admin')) {
    const sub = p.replace(/^\/api\/admin\/?/, '');
    req.url = `/api/admin?path=${encodeURIComponent(sub)}`;
    return admin(req, res);
  }
  if (p === '/api/generator') return generator(req, res);
  if (p.startsWith('/media/')) { req.url = `/api/media?key=${encodeURIComponent(p.slice(7))}`; return media(req, res); }
  if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
  if (p.endsWith('/')) p += 'index.html';
  if (p.endsWith('.html') && p !== '/admin/index.html') { res.statusCode = 308; res.setHeader('Location', (p.replace(/(index)?\.html$/, '') || '/') + url.search); return res.end(); }
  if (!path.extname(p) && fs.existsSync(path.join(SITE, p + '.html'))) p += '.html';
  const file = path.normalize(path.join(SITE, p));
  if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(5530, () => console.log('dev server on http://localhost:5530  (admin: /admin)'));
