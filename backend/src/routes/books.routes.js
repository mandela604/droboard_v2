'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/books.controller');
const chCtrl = require('../controllers/chapters.controller');
const engagementService = require('../services/engagement.service');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');
const { SHARE_CHANNELS } = require('../services/engagement.service');

function Router() { return require('express').Router(); }

const id = z.string().min(1).max(120);
const bookBody = z.object({
  title: z.string().min(1).max(160),
  synopsis: z.string().max(5000).optional(),
  genre: z.string().max(40).optional(),
  categoryId: z.string().max(40).optional(),
  cover: z.string().max(2000).optional(), // Images delivery URL (upload first via POST /api/uploads/image)
  tags: z.array(z.string().max(30)).max(10).optional(),
  tropes: z.array(z.string().max(40)).max(10).optional(),
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
  // coin price (0 = free). Server-side pricing truth for /wallet/unlock —
  // staff-only (enforced in controllers; admin/editor module sets prices).
  price: z.number().int().min(0).max(10000).optional(),
  scheduledAt: z.string().max(40).refine(v => !isNaN(new Date(v).getTime()), { message: 'bad_scheduledAt' }).optional(),
  // Engagement expiry: epoch ms — null = never closes (create-wizard payload).
  poll: z.object({ q: z.string().max(300).optional(), opts: z.array(z.string().max(120)).max(4).optional(), expiresAt: z.number().nullable().optional(), id: z.string().min(1).max(40).optional() }).optional(),
  prediction: z.object({ q: z.string().max(300).optional(), opts: z.array(z.string().max(120)).max(4).optional(), expiresAt: z.number().nullable().optional(), id: z.string().min(1).max(40).optional() }).optional(),
  // Custom ballot labels live on the model (debate.forText/againstText), so the
  // wizard must be able to send them — a plain nested z.object silently STRIPS
  // unknown keys, which is why labels used to vanish with no error.
  debate: z.object({ motion: z.string().max(500).optional(), forText: z.string().max(60).optional(), againstText: z.string().max(60).optional(), expiresAt: z.number().nullable().optional(), question: z.string().max(300).optional() }).optional(),
}).strict();
const chPatch = chBody.partial();

const router = Router();

router.get('/', generalLimiter, (req, _res, next) => {
  // Optional auth: staff viewers may query any status; public forced to live.
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (token) {
      const jwt = require('jsonwebtoken');
      const env = require('../config/env');
      const p = jwt.verify(token, env.jwtAccessSecret);
      req.user = { id: p.sub, roles: p.roles || [] };
    }
  } catch (e) { /* anonymous */ }
  next();
}, validate(z.object({ query: z.object({
  q: z.string().max(80).optional(), genre: z.string().max(40).optional(),
  status: z.string().max(20).optional(), kind: z.enum(['short', 'long']).optional(),
  authorId: z.string().max(40).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('books.create'),
  validate(z.object({ body: bookBody })), ctrl.create);

// BATCH 1: create-wizard submit — book + chapters atomically (rollback on failure).
router.post('/batch', requireAuth, writeLimiter, audit('books.createBatch'),
  validate(z.object({
    body: z.object({
      book: bookBody,
      chapters: z.array(chBody).min(1).max(25),
    }).strict(),
  })), ctrl.createBatch);

router.get('/:id', optionalAuth, generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.detail);

// More-like-this. The story read already embeds it; this is the standalone
// refresh so a page can re-roll the row without reloading the book.
router.get('/:id/similar', generalLimiter,
  validate(z.object({
    params: z.object({ id }),
    query: z.object({ limit: z.string().max(3).optional() }).strict(),
  })), ctrl.similar);

// Share analytics: channel -> count (webcopy/whatsapp/twitter/link).
// One row per confirmed click (client-side gating ensures sheet close doesn't count).
router.post('/:id/share', requireAuth, writeLimiter, audit('books.share'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ channel: z.enum(SHARE_CHANNELS) }).strict(),
  })), ctrl.share);

// Emoji reactions (rid 'love' is the topbar like). Same rid twice is a no-op.
router.post('/:id/reaction', requireAuth, writeLimiter, audit('books.react'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ rid: z.enum(engagementService.STORY_RX) }).strict(),
  })), ctrl.react);
router.delete('/:id/reaction', requireAuth, writeLimiter, audit('books.unreact'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unreact);

router.patch('/:id', requireAuth, writeLimiter, audit('books.update'),
  validate(z.object({ params: z.object({ id }), body: bookPatch })), ctrl.update);
router.delete('/:id', requireAuth, writeLimiter, audit('books.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

// chapters nested (reorder BEFORE :key — else 'reorder' matches :key)
router.get('/:id/chapters', generalLimiter, validate(z.object({ params: z.object({ id }) })), chCtrl.list);
router.post('/:id/chapters', requireAuth, writeLimiter, audit('chapters.create'),
  validate(z.object({ params: z.object({ id }), body: chBody })), chCtrl.create);
router.patch('/:id/chapters/reorder', requireAuth, writeLimiter, audit('chapters.reorder'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ order: z.array(z.string().min(1).max(120)).min(1).max(1000) }).strict(),
  })), chCtrl.reorder);
router.get('/:id/chapters/:key', generalLimiter,
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }) })), chCtrl.get);
router.patch('/:id/chapters/:key', requireAuth, writeLimiter, audit('chapters.update'),
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }), body: chPatch })), chCtrl.update);
router.delete('/:id/chapters/:key', requireAuth, writeLimiter, audit('chapters.delete'),
  validate(z.object({ params: z.object({ id, key: z.string().min(1).max(40) }) })), chCtrl.remove);

module.exports = router;
