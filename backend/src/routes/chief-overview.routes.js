'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-overview.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const queueType = z.enum(['dispute', 'policy', 'contract']);
const paging = z.object({
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();
const actionBody = z.object({
  action: z.enum(['review', 'approve', 'reject', 'resolve', 'dismiss']),
  note: z.string().max(1000).optional(),
}).strict();

router.get('/dashboard', requireAuth, requireRole('chief_editor', 'admin'), ctrl.dashboard);
router.get('/dashboard/stats', requireAuth, requireRole('chief_editor', 'admin'), ctrl.stats);

router.get('/performance', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: z.object({ period: z.enum(['7d', '30d', '90d']).optional() }).strict() })), ctrl.performance);

router.get('/queues/:type', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ params: z.object({ type: queueType }), query: paging })), ctrl.queues);
router.post('/queues/:type/:id', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.queues.action'),
  validate(z.object({ params: z.object({ type: queueType, id }), body: actionBody })), ctrl.queueAction);

router.get('/editorial-team', requireAuth, requireRole('chief_editor', 'admin'), ctrl.editorialTeam);

router.get('/activity', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.activity);

module.exports = router;
