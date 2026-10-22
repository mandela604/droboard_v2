'use strict';
/* routes/acquisition.routes.js — paid-acquisition endpoints documented in
 * public/services/acquisition-service.js (mounted at /api/acquisition).
 * GET /summary is the only fetch the console makes today (USE_API=false). */
const { z } = require('zod');
const base = require('../controllers/base.controller');
const svc = require('../services/acquisition.service');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const q = { days: z.string().max(6).optional() };

router.get('/summary', requireAuth, requireRole('admin', 'marketing', 'chief_editor'), generalLimiter,
  validate(z.object({ query: z.object(q).strict() })),
  async (req, res) => base.wrap(res, async () => svc.summary(req.valid.query)));

router.get('/spend', requireAuth, requireRole('admin', 'marketing'), generalLimiter,
  validate(z.object({ query: z.object(q).strict() })),
  async (req, res) => base.wrap(res, async () => svc.spendList(req.valid.query)));

const spendBody = z.object({
  date: z.string().max(10).optional(),
  campaignId: z.string().min(1).max(80),
  amount: z.number().min(0).max(1e7),
  note: z.string().max(300).optional(),
}).strict();

router.post('/spend', requireAuth, requireRole('admin', 'marketing'), writeLimiter,
  audit('acquisition.spend.create'), validate(z.object({ body: spendBody })),
  async (req, res) => base.wrap(res, async () => svc.spendAdd(req.valid.body)));

const eventBody = z.object({
  type: z.string().max(40).optional(),
  visitorId: z.string().max(80).optional(),
  campaignId: z.string().max(80).optional(),
  storyId: z.string().max(120).optional(),
  amount: z.number().min(0).max(1e6).optional(),
  coins: z.number().min(0).max(1e9).optional(),
  pages: z.number().min(0).max(1e5).optional(),
  impressions: z.number().min(0).max(1e7).optional(),
  ts: z.union([z.number(), z.string().max(40)]).optional(),
  date: z.string().max(10).optional(),
  meta: z.record(z.unknown()).optional(),
}).passthrough();

router.post('/events', requireAuth, writeLimiter,
  audit('acquisition.event.create'), validate(z.object({ body: eventBody })),
  async (req, res) => base.wrap(res, async () => svc.captureEvent(req.valid.body)));

module.exports = router;
