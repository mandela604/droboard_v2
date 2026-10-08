'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/books.controller');
const chCtrl = require('../controllers/chapters.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }

const id = z.string().min(1).max(120);
const bookBody = z.object({
  title: z.string().min(1).max(160),
  synopsis: z.string().max(5000).optional(),
  genre: z.string().max(40).optional(),
  categoryId: z.string().max(40).optional(),
  cover: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  status: z.enum(['draft', 'ongoing', 'under_review', 'published', 'completed', 'paused']).optional(),
  kind: z.enum(['short', 'long']).optional(),
}).strict();
const bookPatch = bookBody.partial();
const chBody = z.object({
  n: z.number().int().min(1).max(5000).optional(),
  title: z.string().min(1).max(160).optional(),
  content: z.string().max(200000).optional(),
  words: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'pending_review', 'revision_needed', 'scheduled', 'live', 'published']).optional(),
  authorNote: z.string().max(2000).optional(),
  scheduledAt: z.string().optional(),
  poll: z.object({ q: z.string().max(300).optional(), opts: z.array(z.string().max(120)).max(4).optional() }).optional(),
  prediction: z.object({ q: z.string().max(300).optional(), opts: z.array(z.string().max(120)).max(4).optional() }).optional(),
  debate: z.object({ motion: z.string().max(500).optional() }).optional(),
}).strict();
const chPatch = chBody.partial();

const router = Router();

router.get('/', generalLimiter, validate(z.object({ query: z.object({
  q: z.string().max(80).optional(), genre: z.string().max(40).optional(),
  status: z.string().max(20).optional(), kind: z.enum(['short', 'long']).optional(),
  authorId: z.string().max(40).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('books.create'),
  validate(z.object({ body: bookBody })), ctrl.create);

router.get('/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.get);
router.patch('/:id', requireAuth, writeLimiter, audit('books.update'),
  validate(z.object({ params: z.object({ id }), body: bookPatch })), ctrl.update);
router.delete('/:id', requireAuth, writeLimiter, audit('books.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

// chapters nested
router.get('/:id/chapters', generalLimiter, validate(z.object({ params: z.object({ id }) })), chCtrl.list);
router.post('/:id/chapters', requireAuth, writeLimiter, audit('chapters.create'),
  validate(z.object({ params: z.object({ id }), body: chBody })), chCtrl.create);
router.get('/:id/chapters/:key', generalLimiter,
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }) })), chCtrl.get);
router.patch('/:id/chapters/:key', requireAuth, writeLimiter, audit('chapters.update'),
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }), body: chPatch })), chCtrl.update);
router.delete('/:id/chapters/:key', requireAuth, writeLimiter, audit('chapters.delete'),
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }) })), chCtrl.remove);

module.exports = router;
