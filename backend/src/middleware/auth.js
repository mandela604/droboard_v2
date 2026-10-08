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
function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ')
    ? hdr.slice(7)
    : (req.cookies && req.cookies.dro_access) || null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [], mfaAt: p.mfaAt || null };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

module.exports = { signAccess, requireAuth };
