'use strict';
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(user) {
  return jwt.sign(
    { sub: user.id || user._id, roles: user.roles || ['reader'], mfaAt: user._mfaAt || null },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessTtl }
  );
}

/* Resolve the caller's identity from the short-lived access token (Bearer
   header or dro_access cookie). Returns { identity, renewed } — identity is
   null for a true guest. Never throws.

   The refresh cookie is scoped to /api/auth only, so it is never present on
   this route; the client keeps the access token warm by calling
   POST /api/auth/refresh itself. The refresh-cookie fallback below therefore
   only fires on /api/auth-scoped callers, and is a no-op for everyone else. */
async function resolveSession(req, res) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ')
    ? hdr.slice(7)
    : (req.cookies && req.cookies.dro_access) || null;
  let p = null;
  if (token) {
    try { p = jwt.verify(token, env.jwtAccessSecret); } catch (e) { p = null; }
  }
  if (p) return { identity: { id: p.sub, roles: p.roles || [], mfaAt: p.mfaAt || null }, renewed: false };

  // Access token missing/expired. The refresh cookie is scoped to /api/auth,
  // so it is normally absent here; renew only if a caller on that path has it.
  const rt = (req.cookies && req.cookies.dro_refresh) || null;
  if (!rt) return { identity: null, renewed: false };
  let s;
  try { s = await require('../services/auth.service').verifyRefreshSession(rt); }
  catch (e) { return { identity: null, renewed: false }; }
  if (!s || !s.userId) return { identity: null, renewed: false };
  return { identity: { id: s.userId, roles: [], mfaAt: s.mfaAt || null }, renewed: true };
}

// Express middleware: require valid access JWT (Bearer header or dro_access
// httpOnly cookie set at login). Sets req.user {id, roles, mfaAt}.
// The client refreshes the 15-minute access token proactively via
// /api/auth/refresh, so a browsing user stays signed in. Also enforces account
// standing on every request, so a ban or suspension takes effect immediately
// even with a still-valid token.
async function requireAuth(req, res, next) {
  const sess = await resolveSession(req, res);
  if (!sess.identity) return res.status(401).json({ error: 'unauthorized' });
  let u;
  try {
    const { User } = require('../models/user.model');
    u = await User.findOne({ _id: sess.identity.id }).select('_id status deletedAt roles').lean();
  } catch (e) {
    return res.status(503).json({ error: 'account_check_failed' });
  }
  if (!u || u.deletedAt) return res.status(401).json({ error: 'unauthorized' });
  if (u.status === 'banned') return res.status(403).json({ error: 'banned' });
  if (u.status === 'suspended') return res.status(403).json({ error: 'suspended' });
  const roles = Array.isArray(u.roles) ? u.roles : sess.identity.roles;
  const userId = String(u._id);
  if (sess.renewed) {
    try { require('../controllers/base.controller').setAccessCookie(res, signAccess({ id: userId, roles, _mfaAt: sess.identity.mfaAt })); } catch (e) { /* keep going */ }
  }
  req.user = { id: userId, roles, mfaAt: sess.identity.mfaAt };
  return next();
}

// Optional identity for public reads (feed/status rows/profile): a valid
// session attaches req.user; anything else stays anonymous. Never rejects.
// Renews the access token from the refresh cookie like requireAuth so the
// owner still sees their own controls on a public page.
async function optionalAuth(req, res, next) {
  const sess = await resolveSession(req, res);
  if (!sess.identity) { req.user = null; return next(); }
  let roles = sess.identity.roles;
  try {
    const { User } = require('../models/user.model');
    const u = await User.findOne({ _id: sess.identity.id }).select('_id status deletedAt roles').lean();
    if (!u || u.deletedAt || u.status === 'banned' || u.status === 'suspended') { req.user = null; return next(); }
    roles = Array.isArray(u.roles) ? u.roles : roles;
    if (sess.renewed) {
      try { require('../controllers/base.controller').setAccessCookie(res, signAccess({ id: String(u._id), roles, _mfaAt: sess.identity.mfaAt })); } catch (e) { /* keep going */ }
    }
  } catch (e) { /* DB error — still let them through as identity-only */ }
  req.user = { id: sess.identity.id, roles, mfaAt: sess.identity.mfaAt };
  return next();
}

// Password re-confirmation for privileged moderation actions (flag/unflag).
// OAuth-only accounts have no hash and cannot use these actions.
async function verifyPassword(userId, password) {
  const argon2 = require('argon2');
  const { User } = require('../models/user.model');
  const u = await User.findOne({ _id: String(userId) }).select('+passwordHash');
  if (!u || !u.passwordHash) { const e = new Error('oauth_only'); e.status = 400; throw e; }
  const ok = await argon2.verify(u.passwordHash, String(password || '')).catch(() => false);
  if (!ok) { const e = new Error('invalid_password'); e.status = 401; throw e; }
  return u;
}

module.exports = { signAccess, requireAuth, optionalAuth, verifyPassword };
