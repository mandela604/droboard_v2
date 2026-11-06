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

// Permission guard. requirePerm('manage_roles') / requirePerm('release_payouts', 'any')
// Reads the AdminRole docs whose `slug` matches one of the actor's roles and
// OR-combines their perms map. `admin` (the seeded Super Admin slug) always
// passes; that slug carries every key, so an explicit bypass would be
// redundant — but requireRole('admin') on the route already gates access.
// The service exposes a 30s cache; on cold, this is one indexed find.
function requirePerm(key) {
  return async function (req, res, next) {
    try {
      const sa = require('../services/superadmin.service');
      const bySlug = await sa.permsBySlug();
      const roles = (req.user && req.user.roles) || [];
      const ok = roles.some(r => bySlug[r] && bySlug[r][key]);
      if (!ok) return res.status(403).json({ error: 'missing_perm', perm: key });
      return next();
    } catch (e) { return next(e); }
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

module.exports = { requireRole, requirePerm, requireFreshMfa };
