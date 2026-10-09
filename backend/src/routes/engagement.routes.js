'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/engagement.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router({ mergeParams: true });

const id = z.string().min(1).max(120);
const key = z.string().min(1).max(40);

// reader-engagement-service contract: results include totals + my votes
router.get('/:bookId/chapters/:key/engagement', generalLimiter,
  validate(z.object({ params: z.object({ bookId: id, key }) })), ctrl.results);

// bridge + collection-story contract: GET /api/stories/:id (single segment, no clash)
router.get('/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    const feed = require('../services/feed.service');
    return base.wrap(res, async () => feed.storyDetail(req.valid.params.id));
  });

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
