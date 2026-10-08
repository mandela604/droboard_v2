'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/awards.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const handle = z.string().min(1).max(80);
const pg = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };
const criteria = z.object({
  metric: z.enum(['reads', 'books', 'followers', 'rating', 'genre_rank', 'growth', 'manual']),
  op: z.enum(['>=', 'top', 'admin']),
  value: z.number().min(0),
  genre: z.string().max(40).optional(),
  period: z.string().max(10).optional().nullable(),
}).strict();
const awardBody = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
  desc: z.string().max(1000).optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  criteria: criteria.optional(),
}).strict();

// reads stay public (reader profile AwardsEngine); writes are admin-gated
router.get('/', generalLimiter,
  validate(z.object({ query: z.object({
    ...pg, q: z.string().max(80).optional(), status: z.string().max(20).optional(),
  }).strict() })), ctrl.list);
router.get('/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.get);
router.get('/:id/holders', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.holders);
router.get('/user/:handle', generalLimiter,
  validate(z.object({ params: z.object({ handle }) })), ctrl.byHandle);

const admin = [requireAuth, requireRole('admin')];
router.post('/', ...admin, writeLimiter, audit('awards.create'),
  validate(z.object({ body: awardBody })), ctrl.create);
router.put('/:id', ...admin, writeLimiter, audit('awards.update'),
  validate(z.object({ params: z.object({ id }), body: awardBody.partial() })), ctrl.update);
router.delete('/:id', ...admin, writeLimiter, audit('awards.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);
router.post('/:id/grant', ...admin, writeLimiter, audit('awards.grant'),
  validate(z.object({ params: z.object({ id }), body: z.object({ handle }).strict() })), ctrl.grant);
router.post('/:id/revoke', ...admin, writeLimiter, audit('awards.revoke'),
  validate(z.object({ params: z.object({ id }), body: z.object({ handle }).strict() })), ctrl.revoke);
router.get('/:id/evaluate', ...admin,
  validate(z.object({ params: z.object({ id }), query: z.object({ handle }).strict() })), ctrl.evaluate);
router.post('/run-auto-grant', ...admin, writeLimiter, audit('awards.auto-grant'),
  ctrl.runAutoGrant);

module.exports = router;
