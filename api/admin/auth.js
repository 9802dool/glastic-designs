const { send, readJson } = require('../lib/http');
const { getSql, ensureSchema, databaseUrl } = require('../lib/db');
const {
  hashPassword,
  verifyPassword,
  envPassword,
  passwordMatchesEnv,
  passwordIsAcceptable,
  readCookie,
  cookieHeader,
  clearCookieHeader,
  newToken,
  hashToken,
  COOKIE,
  SESSION_DAYS
} = require('../lib/auth');

async function currentSession(req) {
  if (!databaseUrl()) return null;
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const sql = getSql();
  await ensureSchema();
  const rows = await sql`
    SELECT token_hash FROM admin_sessions
    WHERE token_hash = ${hashToken(token)} AND expires_at > now()`;
  return rows.length ? { ok: true } : null;
}

async function startSession(req, res) {
  const token = newToken();
  const sql = getSql();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO admin_sessions (token_hash, expires_at) VALUES (${hashToken(token)}, ${expires.toISOString()})`;
  res.setHeader('Set-Cookie', cookieHeader(token, req));
}

module.exports = async function handler(req, res) {
  try {
    if (!databaseUrl()) {
      return send(res, 503, { error: 'database-missing', needsDatabase: true });
    }
    await ensureSchema();
    const sql = getSql();

    if (req.method === 'GET') {
      const session = await currentSession(req);
      const stored = await sql`SELECT id FROM owner_auth WHERE id = 1`;
      return send(res, 200, {
        signedIn: Boolean(session),
        needsSetup: !stored.length && !envPassword(),
        hasEnvPassword: Boolean(envPassword())
      });
    }

    if (req.method === 'DELETE') {
      const token = readCookie(req, COOKIE);
      if (token) await sql`DELETE FROM admin_sessions WHERE token_hash = ${hashToken(token)}`;
      res.setHeader('Set-Cookie', clearCookieHeader(req));
      return send(res, 200, { signedIn: false });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return send(res, 405, { error: 'Method not allowed' });
    }

    const body = await readJson(req);
    const action = body.action === 'setup' ? 'setup' : 'login';
    const password = body.password;

    if (action === 'setup') {
      if (envPassword() || (await sql`SELECT id FROM owner_auth WHERE id = 1`).length) {
        return send(res, 409, { error: 'A password is already set.' });
      }
      if (!passwordIsAcceptable(password)) {
        return send(res, 400, { error: 'Use at least 8 characters.' });
      }
      await sql`INSERT INTO owner_auth (id, password_hash) VALUES (1, ${await hashPassword(password)})`;
      await startSession(req, res);
      return send(res, 200, { signedIn: true });
    }

    const stored = await sql`SELECT password_hash FROM owner_auth WHERE id = 1`;
    let ok = false;
    if (stored.length) ok = await verifyPassword(password, stored[0].password_hash);
    else if (envPassword()) ok = passwordMatchesEnv(password);
    else return send(res, 409, { error: 'Choose a password first.', needsSetup: true });

    if (!ok) return send(res, 401, { error: 'That password is not right.' });
    await startSession(req, res);
    return send(res, 200, { signedIn: true });
  } catch (error) {
    if (error && error.code === 'database-missing') {
      return send(res, 503, { error: 'database-missing', needsDatabase: true });
    }
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
};

module.exports.requireOwner = async function requireOwner(req, res) {
  if (!databaseUrl()) {
    send(res, 503, { error: 'database-missing', needsDatabase: true });
    return false;
  }
  const session = await currentSession(req);
  if (!session) {
    send(res, 401, { error: 'Please sign in.' });
    return false;
  }
  return true;
};
