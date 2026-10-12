// Runs on Vercel at build time only. Newer Vercel projects serve Web Analytics from a project-specific path,
// published to builds in VERCEL_OBSERVABILITY_CLIENT_CONFIG. Point every page's script tag at it.
import fs from 'node:fs';
import path from 'node:path';

let cfg = null;
try { cfg = JSON.parse(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG || 'null'); } catch { /* ignore */ }
const a = cfg?.analytics;
if (!a?.scriptSrc) { console.log('no analytics client config; keeping /_vercel/insights/script.js'); process.exit(0); }

const abs = p => '/' + String(p).replace(/^\/+/, '');
// same attributes @vercel/analytics sets when it injects the script
const attrs = [`src="${abs(a.scriptSrc)}"`];
if (a.viewEndpoint) attrs.push(`data-endpoint="${abs(a.viewEndpoint).replace(/\/view$/, '')}"`);
if (a.viewEndpoint) attrs.push(`data-view-endpoint="${abs(a.viewEndpoint)}"`);
if (a.eventEndpoint) attrs.push(`data-event-endpoint="${abs(a.eventEndpoint)}"`);
if (a.sessionEndpoint) attrs.push(`data-session-endpoint="${abs(a.sessionEndpoint)}"`);

let n = 0;
for (const f of fs.readdirSync('site').filter(f => f.endsWith('.html'))) {
  const p = path.join('site', f);
  const s = fs.readFileSync(p, 'utf8');
  const out = s.replace('<script defer src="/_vercel/insights/script.js"></script>', `<script defer ${attrs.join(' ')}></script>`);
  if (out !== s) { fs.writeFileSync(p, out); n++; }
}
console.log(`analytics script -> ${abs(a.scriptSrc)} in ${n} pages`);
