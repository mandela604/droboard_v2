'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/engagement.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');
const { STORY_RX } = require('../services/engagement.service');

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
// attachViewer too — without it a signed-in reader gets an empty myVotes and
// cannot see or undo the option they picked.
router.get('/:bookId/chapters/:key/engagement', attachViewer, generalLimiter,
  validate(z.object({ params: z.object({ bookId: id, key }) })), ctrl.results);

/* ── per-chapter reactions (chapter end card) ──
   One active rid per reader per chapter. Re-sending the same rid is a no-op;
   a different rid swaps it. Deleting removes the reader's reaction. */
router.get('/:bookId/chapters/:key/reaction', attachViewer, generalLimiter,
  validate(z.object({ params: z.object({ bookId: id, key }) })), ctrl.chapterReactionGet);
router.post('/:bookId/chapters/:key/reaction', requireAuth, writeLimiter, audit('engagement.chapterReact'),
  validate(z.object({
    params: z.object({ bookId: id, key }),
    body: z.object({ rid: z.enum(STORY_RX) }).strict(),
  })), ctrl.chapterReactionPost);
router.delete('/:bookId/chapters/:key/reaction', requireAuth, writeLimiter, audit('engagement.chapterUnreact'),
  validate(z.object({ params: z.object({ bookId: id, key }) })), ctrl.chapterReactionDelete);

// Get a single debate by debate ID (for debate page fetch)
// Can be either chapter-level or book-level debate
// URL: GET /api/stories/:debateId?book=<bookId>[&ch=<chapterId>]
router.get('/:debateId', attachViewer, generalLimiter,
  validate(z.object({ 
    params: z.object({ debateId: z.string().min(1).max(40) }),
    query: z.object({ book: id.optional(), ch: z.string().max(40).optional() }).strict(),
  })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => {
      const { debateId } = req.valid.params;
      const { book: bookId, ch: chapterId } = req.valid.query;
      
      // Must have bookId; chapterId is optional (chapter-level vs book-level)
      if (!bookId) { const e = new Error('book_required'); e.status = 400; throw e; }
      
      const { Book, Chapter } = require('../models/content.model');
      const userId = req.user ? req.user.id : null;

      // Chapter-level debate
      if (chapterId) {
        const chapter = await Chapter.findOne({ bookId, id: chapterId }).lean();
        if (!chapter || !chapter.debate || chapter.debate.id !== debateId) {
          const e = new Error('debate_not_found');
          e.status = 404;
          throw e;
        }
        const d = chapter.debate;
        
        // Get user's vote if authenticated
        let userVote = null;
        if (userId) {
          const { EngagementVote } = require('../models/content.model');
          const vote = await EngagementVote.findOne({
            chapterId: chapter.id,
            userId,
            kind: 'debate',
            itemId: debateId,
          }).lean();
          userVote = vote ? (vote.optionIdx === 0 ? 'for' : 'against') : null;
        }

        return {
          type: 'chapter',
          id: debateId,
          bookId,
          chapterId: chapter.id,
          motion: d.motion || '',
          forText: d.forText || 'For',
          againstText: d.againstText || 'Against',
          forV: d.forV || 0,
          agV: d.agV || 0,
          expiresAt: d.expiresAt || null,
          userVote,
        };
      }

      // Book-level debate
      const book = await Book.findOne({ id: bookId }).lean();
      if (!book || !book.debates || !book.debates.length) {
        const e = new Error('debate_not_found');
        e.status = 404;
        throw e;
      }

      const debate = book.debates.find(d => d.id === debateId);
      if (!debate) {
        const e = new Error('debate_not_found');
        e.status = 404;
        throw e;
      }

      // Get user's vote if authenticated
      let userVote = null;
      if (userId) {
        const { EngagementVote } = require('../models/content.model');
        const vote = await EngagementVote.findOne({
          bookId,
          chapterId: '',
          userId,
          kind: 'debate',
          itemId: debateId,
        }).lean();
        userVote = vote ? (vote.optionIdx === 0 ? 'for' : 'against') : null;
      }

      return {
        type: 'book',
        id: debateId,
        bookId,
        motion: debate.motion || '',
        forText: debate.forText || 'For',
        againstText: debate.againstText || 'Against',
        forV: debate.forV || 0,
        agV: debate.agV || 0,
        expiresAt: debate.expiresAt || null,
        userVote,
      };
    });
  });

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
router.delete('/:id/rating', requireAuth, writeLimiter, audit('ratings.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.ratingDelete);

// reviews list (reader-facing story page): paginated BookRating rows joined to
// author {id,name,avatar} + helpful tally. sort = helpful|newest|rating.
router.get('/:id/ratings', attachViewer, generalLimiter,
  validate(z.object({
    params: z.object({ id }),
    query: z.object({
      page: z.coerce.number().int().min(1).max(100000).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
      sort: z.enum(['helpful', 'newest', 'rating']).optional(),
    }).strict(),
  })), ctrl.ratingsList);

// "helpful" mark on a single review — one per (review, user); re-mark is a no-op.
router.post('/:id/ratings/:ratingId/helpful', requireAuth, writeLimiter, audit('ratings.helpful'),
  validate(z.object({ params: z.object({ id, ratingId: id }) })), ctrl.helpfulMark);
router.delete('/:id/ratings/:ratingId/helpful', requireAuth, writeLimiter, audit('ratings.helpful'),
  validate(z.object({ params: z.object({ id, ratingId: id }) })), ctrl.helpfulUnmark);

// chapter-level engagement (the author's per-chapter poll/prediction/debate)
// Story-wide engagement, which the bridge page renders, is below.
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
   A book carries polls[]/predictions[]/debates[], so a vote names the ROW it
   answers (body.id) and votes key on (bookId, userId, kind, itemId) with
   chapterId '' in EngagementVote. */
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
    }).strict().refine(b => (b.kind === 'debate' ? !!b.side : b.option !== undefined), {
      // Without this, a poll vote with no option reached the service as
      // undefined and came back bad_option — the message is clearer here.
      message: 'poll_and_prediction_need_option',
    }),
  })), ctrl.bookVote);

router.delete('/:bookId/engagement/:kind/:itemId', requireAuth, writeLimiter, audit('engagement.bookRetract'),
  validate(z.object({
    params: z.object({ bookId: id, kind: z.enum(['poll', 'prediction', 'debate']), itemId: z.string().min(1).max(40) }),
  })), ctrl.bookRetract);

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
