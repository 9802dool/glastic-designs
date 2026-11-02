const { scrypt, randomBytes, timingSafeEqual, createHash } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);
const COOKIE = 'gd_admin';
const SESSION_DAYS = 30;

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(String(password), salt, 32);
  return 'scrypt$' + salt + '$' + derived.toString('hex');
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const derived = await scryptAsync(String(password), parts[1], 32);
  const expected = Buffer.from(parts[2], 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

function envPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

function passwordMatchesEnv(password) {
  const expected = envPassword();
  if (!expected) return false;
  const left = Buffer.from(String(password));
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function passwordIsAcceptable(password) {
  const value = String(password || '');
  if (value.length < 8 || value.length > 200) return false;
  return true;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const bits = raw.split(';');
  for (let i = 0; i < bits.length; i++) {
    const piece = bits[i].trim();
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    if (piece.slice(0, eq) === name) return decodeURIComponent(piece.slice(eq + 1));
  }
  return '';
}

function cookieHeader(token, req) {
  const secure = process.env.VERCEL === '1' || (req.headers['x-forwarded-proto'] || '').includes('https');
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return COOKIE + '=' + encodeURIComponent(token)
    + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + maxAge
    + (secure ? '; Secure' : '');
}

function clearCookieHeader(req) {
  const secure = process.env.VERCEL === '1' || (req.headers['x-forwarded-proto'] || '').includes('https');
  return COOKIE + '=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' + (secure ? '; Secure' : '');
}

function newToken() {
  return randomBytes(32).toString('base64url');
}

module.exports = {
  COOKIE,
  SESSION_DAYS,
  hashToken,
  hashPassword,
  verifyPassword,
  envPassword,
  passwordMatchesEnv,
  passwordIsAcceptable,
  readCookie,
  cookieHeader,
  clearCookieHeader,
  newToken
};
