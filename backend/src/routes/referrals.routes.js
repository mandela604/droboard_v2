'use strict';
// routes/referrals.routes.js — frontend refer.html contracts + invite stats.
//   GET /api/referrals/code   -> { code, link }
//   GET /api/referrals/stats  -> { invited, joined, earned }
//   GET /api/referrals        -> { items: [...] }
const { z } = require('zod');
const base = require('../controllers/base.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter } = require('../middleware/http');
const referrals = require('../services/referrals.service');
const env = require('../config/env');

function Router() { return require('express').Router(); }
const router = Router();

function inviteLink(code) {
  const baseUrl = (env.appUrl || '').replace(/\/$/, '');
  if (baseUrl) return baseUrl + '/Pages/signup.html?ref=' + encodeURIComponent(code);
  return 'signup.html?ref=' + encodeURIComponent(code);
}

router.get('/code', requireAuth, generalLimiter, async (req, res) => {
  return base.wrap(res, async () => {
    const code = await referrals.ensureCode(req.user.id);
    return { code, link: inviteLink(code) };
  });
});

router.get('/stats', requireAuth, generalLimiter, async (req, res) => {
  return base.wrap(res, async () => referrals.getStats(req.user.id));
});

router.get('/', requireAuth, generalLimiter,
  validate(z.object({ query: z.object({ limit: z.string().max(6).optional() }).strict() })),
  async (req, res) => {
    return base.wrap(res, async () => ({
      items: await referrals.listReferred(req.user.id, { limit: parseInt((req.valid.query && req.valid.query.limit) || '50', 10) }),
    }));
  });

module.exports = router;
