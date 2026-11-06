'use strict';
// Live stats for the Insights page (Pages/insights.html).
// GET /api/insights/:surface?period=today|7d|month|all&id=&genre=&handle=
//   hub        → board stats (board crew or staff)
//   profile    → the signed-in owner's own numbers (?handle= for staff)
//   collection → the owner's collection (?id=)
//   droboard   → the official page (staff)
const { z } = require('zod');
const base = require('../controllers/base.controller');
const svc = require('../services/insights.service');
const { optionalAuth } = require('../middleware/auth');
const { validate, generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/:surface', generalLimiter, optionalAuth,
  validate(z.object({
    params: z.object({ surface: z.enum(['hub', 'droboard', 'profile', 'collection']) }),
    query: z.object({
      period: z.enum(['today', '7d', 'month', 'all']).optional(),
      id: z.string().max(120).optional(),
      genre: z.string().max(120).optional(),
      handle: z.string().max(120).optional(),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => {
    const surface = req.valid.params.surface;
    const q = req.valid.query;
    const period = q.period || '7d';
    const viewer = req.user && req.user.id ? req.user : null;
    if (surface === 'hub') return svc.getHubStats({ slug: q.genre || q.id, period, viewer });
    if (surface === 'profile') return svc.getProfileStats({ handle: q.handle || q.id, period, viewer });
    if (surface === 'collection') return svc.getCollectionStats({ id: q.id, period, viewer });
    return svc.getDroboardStats({ period, viewer });
  }));

module.exports = router;
