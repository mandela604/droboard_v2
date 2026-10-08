'use strict';
// Implements the DroboardSaveAPI contract used by save-modal (all callers).
const { z } = require('zod');
const ctrl = require('../controllers/saves.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const storyId = z.string().min(1).max(40);
const quickKey = z.enum(['library', 'fav', 'later']);

router.get('/state', requireAuth,
  validate(z.object({ query: z.object({ storyId }).strict() })), ctrl.state);
router.post('/quick', requireAuth, writeLimiter, audit('saves.quick'),
  validate(z.object({ body: z.object({ storyId, key: quickKey, value: z.boolean().optional() }).strict() })), ctrl.quick);
router.post('/collections/:id/toggle', requireAuth, writeLimiter, audit('saves.toggleCollection'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ storyId, value: z.boolean().optional() }).strict(),
  })), ctrl.toggleCollection);
router.post('/collections', requireAuth, writeLimiter, audit('saves.createCollection'),
  validate(z.object({ body: z.object({ name: z.string().min(1).max(120), icon: z.string().max(40).optional(), storyId: z.string().min(1).max(120).optional() }).strict() })), ctrl.createCollection);

module.exports = router;
