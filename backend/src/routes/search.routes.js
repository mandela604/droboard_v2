'use strict';
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const base = require('../controllers/base.controller');
const search = require('../services/search.service');
const tracking = require('../services/tracking.service');
const { generalLimiter } = require('../middleware/http');
const { validate } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

function optionalAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (!token) return next();
    const env = require('../config/env');
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [] };
  } catch (e) { /* anonymous */ }
  return next();
}

// search-service contract: GET /api/search/index
// Every query is logged (anonymous userId='') so trending/zero-result
// analytics work without the client firing a separate track call.
router.get('/index', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({
    q: z.string().max(80).optional(), type: z.string().max(20).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => {
    const out = await search.index(req.valid.query);
    const results = (out.books || []).length + (out.users || []).length + (out.collections || []).length + (out.tags || []).length;
    tracking.logSearch({ userId: req.user && req.user.id, q: req.valid.query.q, type: req.valid.query.type, results });
    return out;
  }));

// Public trending list for the search overlay ({q, meta, fire} — 7d SearchLog).
router.get('/trending', generalLimiter,
  validate(z.object({ query: z.object({ limit: z.string().max(6).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => tracking.publicTrending({ limit: req.valid.query.limit })));

module.exports = router;
