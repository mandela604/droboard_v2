'use strict';
// User-to-user messaging: conversation list, open-or-create a 1:1 thread,
// paginated history, send (text and/or uploaded image), mark-read, and
// edit/delete own message. Participant checks live in the service.
const { z } = require('zod');
const ctrl = require('../controllers/messages.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);

router.get('/conversations', requireAuth, generalLimiter, ctrl.conversations);

router.post('/conversations', requireAuth, writeLimiter, audit('messages.open'),
  validate(z.object({ body: z.object({ userId: id }).strict() })), ctrl.open);

router.get('/conversations/:id/messages', requireAuth, generalLimiter,
  validate(z.object({
    params: z.object({ id }),
    query: z.object({ page: z.string().max(6).optional(), limit: z.string().max(6).optional() }).strict(),
  })), ctrl.messages);

router.post('/conversations/:id/messages', requireAuth, writeLimiter, audit('messages.send'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      text: z.string().max(4000).optional(),
      image: z.string().max(2800000).optional(),
    }).strict().refine(v => (v.text && v.text.trim()) || v.image, { message: 'empty_message' }),
  })), ctrl.send);

router.post('/conversations/:id/read', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.read);

router.patch('/:id', requireAuth, writeLimiter, audit('messages.edit'),
  validate(z.object({ params: z.object({ id }), body: z.object({ text: z.string().min(1).max(4000) }).strict() })), ctrl.update);

router.delete('/:id', requireAuth, writeLimiter, audit('messages.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

module.exports = router;
