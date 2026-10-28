'use strict';
/* Reader league — POST /api/league/track (league-service.js:184, fire-and-forget),
   GET /api/league/board + /me (league-service.js:7,10 USE_API reads). */
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { validate, writeLimiter, generalLimiter } = require('../middleware/http');
const surfaces = require('../services/marketing-surfaces.service');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

router.post('/track', requireAuth, writeLimiter,
  validate(z.object({
    body: z.object({
      // Not an enum: the console may add custom weighted actions and those
      // must track too (league-service.js "custom actions … work").
      action: z.string().min(1).max(40),
      n: z.number().int().min(1).max(500).optional(),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => surfaces.track(
    req.valid.body.action, req.valid.body.n || 1, req.user.id)));

// Optional auth: anonymous visitors can read the board (matches the demo).
function optionalAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (!token) return next();
    const jwt = require('jsonwebtoken');
    const env = require('../config/env');
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [] };
  } catch (e) { /* anonymous */ }
  return next();
}

router.get('/board', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({
    season: z.string().regex(/^\d{4}-W\d{1,2}$/).optional(),
    scope: z.enum(['weekly', 'alltime']).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => surfaces.leagueBoard({
    season: req.valid.query.season, scope: req.valid.query.scope,
    userId: req.user && req.user.id,
  })));

router.get('/me', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => surfaces.leagueMe(req.user.id)));

module.exports = router;
