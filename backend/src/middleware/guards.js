'use strict';
const env = require('../config/env');

// Role guard: requireRole('admin', 'finance')(...) — 403 unless user has one.
function requireRole(...allowed) {
  return function (req, res, next) {
    const roles = (req.user && req.user.roles) || [];
    const ok = allowed.some(a => roles.includes(a));
    if (!ok) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

// Step-up: require MFA fresher than MFA_STEPUP_MINUTES (payouts, signing).
function requireFreshMfa(req, res, next) {
  const at = req.user && req.user.mfaAt ? new Date(req.user.mfaAt).getTime() : 0;
  if (!at || Date.now() - at > env.mfaStepUpMinutes * 60 * 1000) {
    return res.status(428).json({ error: 'step_up_required' });
  }
  return next();
}

module.exports = { requireRole, requireFreshMfa };
