'use strict';
/* Reader league — POST /api/league/track (league-service.js:184, fire-and-forget).
   Board/me reads are computed client-side today, so only the write path
   exists here. */
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { validate, writeLimiter } = require('../middleware/http');
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

module.exports = router;
