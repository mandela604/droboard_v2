'use strict';
// Chief-editor pay console: the program scheme and who is on what. Money moves
// in finance; editors self-serve their own statements and withdrawals.
const { z } = require('zod');
const ctrl = require('../controllers/chief-earnings.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const guard = [requireAuth, requireRole('chief_editor', 'admin')];

const settingsBody = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(['revenue_share', 'fixed_monthly', 'hybrid']).optional(),
  revenueSharePct: z.number().min(0).max(100).optional(),
  fixedMonthlyAmount: z.number().min(0).max(1000000000).optional(),
  currency: z.string().length(3).optional(),
  payoutDay: z.number().int().min(1).max(28).optional(),
}).strict();

router.get('/earnings/settings', ...guard, generalLimiter, ctrl.settings);
router.put('/earnings/settings', ...guard, audit('chief.earnings.settings'),
  validate(z.object({ body: settingsBody })), ctrl.saveSettings);

router.get('/earnings/summary', ...guard, generalLimiter, ctrl.summary);

module.exports = router;
