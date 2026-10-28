'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/engagement.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router({ mergeParams: true });

const id = z.string().min(1).max(120);
const key = z.string().min(1).max(40);

// Optional auth (house pattern): viewer id unlocks myVote/mine/mutes-blocks
// on public reads; anonymous reads still work.
function attachViewer(req, _res, next) {
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
}

// reader-engagement-service contract: results include totals + my votes
router.get('/:bookId/chapters/:key/engagement', generalLimiter,
  validate(z.object({ params: z.object({ bookId: id, key }) })), ctrl.results);

// bridge + collection-story contract: GET /api/stories/:id (single segment, no clash)
router.get('/:id', attachViewer, generalLimiter,
  validate(z.object({ params: z.object({ id }) })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    const feed = require('../services/feed.service');
    return base.wrap(res, async () => feed.storyDetail(req.valid.params.id, req.user ? req.user.id : null));
  });

// rate-modal contract: { ok, mine, avg, count } — anonymous reads see avg/count only
router.get('/:id/rating', attachViewer, generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.ratingGet);
router.post('/:id/rating', requireAuth, writeLimiter,
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      stars: z.number().int().min(1).max(5),
      text: z.string().max(600).optional(),
      spoiler: z.boolean().optional(),
    }).strict(),
  })), ctrl.ratingPost);

// chapter-level engagement only (story-wide engagement deliberately not offered:
// structured polls/predictions/debates are chapter-wise; story-wide debate lives
// as community posts via /api/posts)
router.post('/:bookId/chapters/:key/poll/vote', requireAuth, writeLimiter, audit('engagement.pollVote'),
  validate(z.object({
    params: z.object({ bookId: id, key }),
    body: z.object({ option: z.number().int().min(0).max(10) }).strict(),
  })), ctrl.votePoll);

router.post('/:bookId/chapters/:key/prediction/vote', requireAuth, writeLimiter, audit('engagement.predictionVote'),
  validate(z.object({
    params: z.object({ bookId: id, key }),
    body: z.object({ option: z.number().int().min(0).max(10) }).strict(),
  })), ctrl.votePrediction);

router.post('/:bookId/chapters/:key/debate/vote', requireAuth, writeLimiter, audit('engagement.debateVote'),
  validate(z.object({
    params: z.object({ bookId: id, key }),
    body: z.object({ side: z.enum(['for', 'against']) }).strict(),
  })), ctrl.voteDebate);

router.delete('/:bookId/chapters/:key/:kind', requireAuth, writeLimiter, audit('engagement.retract'),
  validate(z.object({ params: z.object({ bookId: id, key, kind: z.enum(['poll', 'prediction', 'debate']) }) })), ctrl.retract);

/* ── story-wide engagement (book-level poll/prediction/debate) ──
   Same shapes as chapter-wise but against the Book's embedded arrays; votes
   key on (bookId, userId, kind) with chapterId '' in EngagementVote. */
router.get('/:bookId/engagement', attachViewer, generalLimiter,
  validate(z.object({ params: z.object({ bookId: id }) })), ctrl.bookResults);

router.post('/:bookId/engagement/vote', requireAuth, writeLimiter, audit('engagement.bookVote'),
  validate(z.object({
    params: z.object({ bookId: id }),
    body: z.object({
      id: z.string().min(1).max(40),
      kind: z.enum(['poll', 'prediction', 'debate']),
      option: z.number().int().min(0).max(10).optional(),
      side: z.enum(['for', 'against']).optional(),
    }).strict(),
  })), ctrl.bookVote);

router.delete('/:bookId/engagement/:kind', requireAuth, writeLimiter, audit('engagement.bookRetract'),
  validate(z.object({ params: z.object({ bookId: id, kind: z.enum(['poll', 'prediction', 'debate']) }) })), ctrl.bookRetract);

// reader boot: coin-unlocked chapters + per-chapter progress + continue point
router.get('/:bookId/read-state', requireAuth, generalLimiter,
  validate(z.object({ params: z.object({ bookId: id }) })), ctrl.readState);

// Reading time: powers referral stage-2 (30 min / 7 days), streaks, subscriptions.
router.post('/:bookId/chapters/:key/progress', requireAuth, writeLimiter,
  validate(z.object({
    params: z.object({ bookId: id, key }),
    body: z.object({
      secondsSpent: z.number().int().min(0).max(3600),
      pct: z.number().min(0).max(100).optional(),
      finished: z.boolean().optional(),
      wordsRead: z.number().int().min(0).max(100000).optional(),
    }).strict(),
  })), ctrl.progress);

module.exports = router;
