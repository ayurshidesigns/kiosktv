import crypto from 'node:crypto';

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const sig = (t) => crypto.createHmac('sha256', secret()).update(String(t)).digest('hex');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const WEEK = 7 * 86400;

export function makeCookie() {
  const exp = Date.now() + WEEK * 1000;
  return `tv_admin=${exp}.${sig(exp)}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${WEEK}`;
}
export const clearCookie = 'tv_admin=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0';

export function isAdmin(req) {
  if (!secret()) return false;
  const m = /(?:^|;\s*)tv_admin=(\d+)\.([a-f0-9]+)/.exec(req.headers.get('cookie') || '');
  if (!m || +m[1] < Date.now()) return false;
  const a = Buffer.from(m[2]), b = Buffer.from(sig(m[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function checkPassword(p) {
  const pw = process.env.ADMIN_PASSWORD || '';
  return !!pw && crypto.timingSafeEqual(sha(p), sha(pw));
}
