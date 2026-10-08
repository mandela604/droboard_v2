'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/statuses.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const statusBody = z.object({
  bg: z.string().min(1).max(40),
  quote: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  isLive: z.boolean().optional(),
  ttlHours: z.number().int().min(1).max(72).optional(),
}).strict();

router.get('/home', generalLimiter, ctrl.home);
router.post('/', requireAuth, writeLimiter, audit('statuses.create'),
  validate(z.object({ body: statusBody })), ctrl.create);
router.post('/:id/view', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.view);
router.post('/:id/like', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.like);
router.delete('/:id', requireAuth, writeLimiter, audit('statuses.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

module.exports = router;
