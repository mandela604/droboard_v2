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

// Express middleware: require valid access JWT (Bearer header or dro_access
// httpOnly cookie set at login). Sets req.user {id, roles, mfaAt}.
// Also enforces account standing on every request, so a ban/suspension
// takes effect immediately even with a still-valid token.
async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ')
    ? hdr.slice(7)
    : (req.cookies && req.cookies.dro_access) || null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  let p;
  try {
    p = jwt.verify(token, env.jwtAccessSecret);
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const { User } = require('../models/user.model');
    const u = await User.findOne({ id: p.sub }).select('status deletedAt').lean();
    if (!u || u.deletedAt) return res.status(401).json({ error: 'unauthorized' });
    if (u.status === 'banned') return res.status(403).json({ error: 'banned' });
    if (u.status === 'suspended') return res.status(403).json({ error: 'suspended' });
  } catch (e) {
    return res.status(503).json({ error: 'account_check_failed' });
  }
  req.user = { id: p.sub, roles: p.roles || [], mfaAt: p.mfaAt || null };
  return next();
}

// Optional identity for public reads (feed/status rows/profile): a valid
// token attaches req.user; anything else stays anonymous. Never rejects.
async function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ')
    ? hdr.slice(7)
    : (req.cookies && req.cookies.dro_access) || null;
  if (!token) { req.user = null; return next(); }
  try {
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [], mfaAt: p.mfaAt || null };
  } catch (e) { req.user = null; }
  return next();
}

module.exports = { signAccess, requireAuth, optionalAuth };
