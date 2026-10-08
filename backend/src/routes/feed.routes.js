'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/feed.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const pg = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

// mounted once at /api — paths below are the exact frontend contracts
router.get('/home', generalLimiter, ctrl.home);
router.get('/discover', generalLimiter, ctrl.discover);
router.get('/discover/stories', generalLimiter,
  validate(z.object({ query: z.object({ page: pg.page, limit: pg.limit }).strict() })), ctrl.discoverStories);
router.get('/discover/ads', generalLimiter, async (req, res) => {
  const base = require('../controllers/base.controller');
  const ads = require('../services/ads.service');
  const pools = await ads.pools('discover');
  return res.json(base.normalize({ platformAds: pools.platform || [], bookAds: pools.book || [] }));
});

router.get('/library/stats', requireAuth, generalLimiter, ctrl.libraryStats);
router.get('/library/promo', generalLimiter, async (req, res) => {
  const base = require('../controllers/base.controller');
  const ads = require('../services/ads.service');
  return res.json(base.normalize(await ads.promos('library')));
});
router.get('/library/continue', requireAuth, generalLimiter, ctrl.libraryList('continue'));
router.get('/library/items', requireAuth, generalLimiter, ctrl.libraryList('library'));
router.get('/library/saved', requireAuth, generalLimiter, ctrl.libraryList('saved'));
router.get('/library/history', requireAuth, generalLimiter, ctrl.libraryList('history'));

// library writes (library page add/remove/move)
const listEnum = z.enum(['library', 'saved', 'history', 'continue', 'later']);
router.post('/library/items', requireAuth, writeLimiter, audit('library.add'),
  validate(z.object({ body: z.object({ storyId: z.string().min(1).max(40), list: listEnum }).strict() })), ctrl.libraryAdd);
router.delete('/library/items/:storyId', requireAuth, writeLimiter, audit('library.remove'),
  validate(z.object({
    params: z.object({ storyId: z.string().min(1).max(40) }),
    query: z.object({ list: listEnum.optional() }).strict(),
  })), ctrl.libraryRemove);
router.patch('/library/items/:storyId/move', requireAuth, writeLimiter, audit('library.move'),
  validate(z.object({
    params: z.object({ storyId: z.string().min(1).max(40) }),
    body: z.object({ from: listEnum, to: listEnum }).strict(),
  })), ctrl.libraryMove);

// story detail (bridge + collection story contracts)
router.get('/stories/:id', generalLimiter,
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }) })), ctrl.storyDetail);

module.exports = router;
