'use strict';
const rateLimit = require('express-rate-limit');

// zod validator: validate(schema) — 400 with details, nothing else.
function validate(schema) {
  return function (req, res, next) {
    const r = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!r.success) return res.status(400).json({ error: 'invalid_input', details: r.error.flatten() });
    req.valid = r.data;
    return next();
  };
}

// Staff roles (most-privileged first) — audit rows carry the actor's
// console role so the admin audit view can filter staff without joins.
const STAFF_ROLES = ['admin', 'chief_editor', 'senior_editor', 'editor', 'finance', 'marketing'];
function actorRoleOf(user) {
  const roles = (user && user.roles) || [];
  return STAFF_ROLES.find(r => roles.includes(r)) || roles[0] || '';
}

// Fire-and-forget audit writer (never blocks the response).
function audit(action) {
  return function (req, res, next) {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      try {
        const { AuditLog } = require('../models/user.model');
        AuditLog.create({
          actorId: (req.user && req.user.id) || 'anonymous',
          actorRole: actorRoleOf(req.user),
          action,
          entity: req.baseUrl + req.path,
          entityId: (req.params && req.params.id) || '',
          ip: req.ip,
          ua: req.headers['user-agent'] || '',
        }).catch(() => {});
      } catch (e) { /* never break responses */ }
    });
    next();
  };
}

const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const moneyLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

module.exports = { validate, audit, actorRoleOf, STAFF_ROLES, generalLimiter, authLimiter, moneyLimiter, writeLimiter };
