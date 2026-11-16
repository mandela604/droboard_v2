'use strict';
// Author story-wide engagement — poll/prediction/debate attached to Book.
// Per-chapter engagement stays on chapters; these endpoints manage book-level arrays.
const { z } = require('zod');
const ctrl = require('../controllers/author.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');
const ids = require('../models/ids');
const { Book } = require('../models/content.model');

// Story-wide engagement routes under /api/author/books/:bookId/engagement
// Nested here so author.routes can mount at /api/author and we handle :id/* subpaths correctly.
function Router() { return require('express').Router({ mergeParams: true }); }
const router = Router();
router.use(requireAuth);

const id = z.string().min(1).max(120);
const optItem = z.object({ t: z.string().trim().min(1).max(60), v: z.number().int().min(0).default(0) });
const baseEngagementBody = z.object({ kind: z.enum(['poll', 'prediction', 'debate']) });
const pollBody = baseEngagementBody.and(z.object({
  question: z.string().trim().min(1).max(300),
  opts: z.array(optItem).min(2).max(4),
  expiresAt: z.number().nullable().optional(), // epoch ms or null
}));
const predBody = baseEngagementBody.and(z.object({
  question: z.string().trim().min(1).max(300),
  opts: z.array(optItem).min(2).max(4),
  expiresAt: z.number().nullable().optional(),
}));
const debateBody = baseEngagementBody.and(z.object({
  motion: z.string().trim().min(1).max(500),
  forText: z.string().trim().max(60).optional(),
  againstText: z.string().trim().max(60).optional(),
  expiresAt: z.number().nullable().optional(),
}));

// List the author's own story-wide engagements with live totals. The reader
// contract nests these under `engagement`; here the console wants the three
// arrays flat, and an author never votes, so no myVote state.
router.get('/engagement', generalLimiter,
  validate(z.object({ params: z.object({ bookId: id }) })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => {
      const engagement = require('../services/engagement.service');
      const read = await engagement.bookEngagement({ bookId: req.valid.params.bookId, userId: req.user?.id || null });
      return Object.assign({ bookId: read.bookId }, read.engagement);
    });
  });

// Create one engagement item (the UI will call this 1–4 times)
router.post('/engagement', writeLimiter, audit('author.engagement.create'),
  validate(z.object({
    params: z.object({ bookId: id }),
    body: z.union([pollBody, predBody, debateBody]),
  })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => {
      const data = req.valid.body;
      // Owner-only: a stranger must not be able to push engagement into
      // someone else's book. 404, not 403, so book ids never enumerate.
      const book = await Book.findOne({ id: req.valid.params.bookId, authorId: req.user.id })
        .select('id').lean();
      if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }

      const expiresAt = data.expiresAt != null ? new Date(data.expiresAt) : null;
      if (data.kind === 'debate') {
        // debates are stored under `motion` (the schema has no `q` field —
        // writing q here would be silently stripped and the row born blank)
        const item = {
          id: ids.nanoid(8),
          motion: data.motion,
          forText: data.forText || 'For',
          againstText: data.againstText || 'Against',
          forV: 0,
          agV: 0,
          expiresAt,
        };
        await Book.updateOne({ id: book.id }, { $push: { debates: item } });
        res.status(201);
        return { ...item, kind: data.kind };
      }

      const item = {
        id: ids.nanoid(8),
        q: data.question,
        opts: data.opts.map(o => ({ t: String(o.t || ''), v: Number(o.v || 0) })),
        expiresAt,
      };
      await Book.updateOne({ id: book.id }, { $push: { [`${data.kind}s`]: item } });
      res.status(201);
      return { ...item, kind: data.kind };
    });
  });

// Edit an existing item IN PLACE: the id and the per-option vote counts stay,
// so the votes readers already cast keep pointing at the same item. Changing
// the NUMBER of options is refused — the counts are per position, so the
// author should delete the item and create a fresh one instead.
router.put('/engagement/:kind/:itemId', writeLimiter, audit('author.engagement.update'),
  validate(z.object({
    params: z.object({ bookId: id, kind: z.enum(['poll', 'prediction', 'debate']), itemId: z.string().min(1).max(120) }),
    body: z.object({
      question: z.string().trim().min(1).max(300).optional(),
      opts: z.array(z.string().trim().min(1).max(60)).min(2).max(4).optional(),
      motion: z.string().trim().min(1).max(500).optional(),
      forText: z.string().trim().max(60).optional(),
      againstText: z.string().trim().max(60).optional(),
    }).strict(),
  })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => {
      const { kind, itemId } = req.valid.params;
      const data = req.valid.body || {};
      const book = await Book.findOne({ id: req.valid.params.bookId, authorId: req.user.id });
      if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
      const array = kind === 'debate' ? 'debates' : `${kind}s`;
      const item = (book[array] || []).find(i => String(i.id) === String(itemId));
      if (!item) { const e = new Error('not_found'); e.status = 404; throw e; }

      if (kind === 'debate') {
        if (data.motion !== undefined) item.motion = data.motion;
        if (data.forText !== undefined) item.forText = data.forText || 'For';
        if (data.againstText !== undefined) item.againstText = data.againstText || 'Against';
      } else {
        if (data.opts && data.opts.length !== (item.opts || []).length) {
          const e = new Error('opt_count_changed'); e.status = 409; throw e;
        }
        if (data.question !== undefined) item.q = data.question;
        if (data.opts) item.opts.forEach((o, i) => { o.t = data.opts[i]; });
      }
      await book.save();
      return { ...(item.toJSON ? item.toJSON() : item), kind };
    });
  });

// Remove an engagement item by id
router.delete('/engagement/:kind/:itemId', writeLimiter, audit('author.engagement.delete'),
  validate(z.object({
    params: z.object({ bookId: id, kind: z.enum(['poll', 'prediction', 'debate']), itemId: z.string().min(1).max(120) }),
  })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => {
      const { kind, itemId } = req.valid.params;
      const book = await Book.findOne({ id: req.valid.params.bookId, authorId: req.user.id })
        .select('id').lean();
      if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
      // debates is the plural of debate — `${kind}s` would pull from nothing
      const array = kind === 'debate' ? 'debates' : `${kind}s`;
      await Book.updateOne({ id: book.id }, { $pull: { [array]: { id: itemId } } });
      return { ok: true, kind, id: itemId };
    });
  });

module.exports = router;
