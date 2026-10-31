// Shared password gate for the API routes (the leading underscore keeps Vercel from
// exposing this file as its own endpoint).
//
// Optional: set APP_PASSWORD (e.g. in Vercel) to require a password. Clients send it in the
// `x-app-password` header. If APP_PASSWORD is unset the tool is open to anyone with the link.
import { timingSafeEqual } from 'node:crypto';

const fails = new Map(); // ip -> { n, reset } — best-effort brute-force limit (per warm instance)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 10;

export function authRequired() {
  return Boolean(process.env.APP_PASSWORD);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns true if the request may proceed; otherwise sends the error response and returns false. */
export function checkAuth(req, res) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;

  const ip = clientIp(req);
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && rec.reset > now && rec.n >= MAX_FAILS) {
    res.status(429).json({ error: 'Too many wrong passwords. Try again in a few minutes.', code: 'auth' });
    return false;
  }

  if (same(req.headers['x-app-password'] || '', expected)) return true;

  const next = rec && rec.reset > now ? rec : { n: 0, reset: now + WINDOW_MS };
  next.n += 1;
  fails.set(ip, next);
  res.status(401).json({ error: 'Wrong or missing password.', code: 'auth' });
  return false;
}
