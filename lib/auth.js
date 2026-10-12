import crypto from 'node:crypto';
import { one, query } from './db.js';
import { HttpError, clientIp, isHttps } from './http.js';

const COOKIE = 'nw_admin';
const TTL = 8 * 3600; // seconds

const b64u = buf => Buffer.from(buf).toString('base64url');
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET is not configured');
  return s;
}

/* ---------------- passwords: scrypt$N$r$p$salt$hash (same format as gen/pcg_auth_setup.py) ---------------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${b64u(salt)}$${b64u(hash)}`;
}
export function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64url');
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64url'), expected.length, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return crypto.timingSafeEqual(got, expected);
}
// burn the same time for unknown emails so response timing doesn't reveal which emails exist
const DUMMY = hashPassword(crypto.randomBytes(16).toString('hex'));

export function validateNewPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(422, 'Passwords need at least 10 characters.');
  if (pw.length > 200) throw new HttpError(422, 'That password is too long.');
}

/* ---------------- signed session cookie ---------------- */
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function unsign(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
function readCookie(req) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
export function sessionCookie(req, user) {
  const token = sign({ uid: user.id, v: user.session_version, exp: Math.floor(Date.now() / 1000) + TTL });
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL}${isHttps(req) ? '; Secure' : ''}`;
}
export function clearCookie(req) {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}

// Returns the signed-in user, or null. Checks the session version so password changes / sign-out-everywhere revoke old cookies.
export async function currentUser(req) {
  const s = unsign(readCookie(req));
  if (!s || s.exp < Date.now() / 1000) return null;
  const u = await one('select id, email, name, session_version from pcg.admin_user where id = $1', [s.uid]);
  return u && u.session_version === s.v ? u : null;
}

/* ---------------- login with rate limiting ---------------- */
export async function login(req, email, password) {
  email = String(email || '').trim().toLowerCase();
  const ip = clientIp(req);
  const [{ n }] = await query(
    `select count(*)::int as n from pcg.login_attempt where not ok and at > now() - interval '15 minutes' and (ip = $1 or email = $2)`, [ip, email]);
  if (n >= 8) throw new HttpError(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  const u = await one('select id, email, name, password_hash, session_version from pcg.admin_user where email = $1', [email]);
  const ok = u ? verifyPassword(String(password || ''), u.password_hash) : (verifyPassword('x', DUMMY), false);
  await query('insert into pcg.login_attempt (ip, email, ok) values ($1, $2, $3)', [ip, email, ok]);
  await query(`delete from pcg.login_attempt where at < now() - interval '2 days'`);
  if (!ok) {
    await new Promise(r => setTimeout(r, 400));
    throw new HttpError(401, 'Wrong username or password.');
  }
  await query('update pcg.admin_user set last_login_at = now() where id = $1', [u.id]);
  return u;
}
