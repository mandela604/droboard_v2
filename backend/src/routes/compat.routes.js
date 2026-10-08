'use strict';
// Thin compat aliases — reuse existing services, no new logic.
const { z } = require('zod');
const base = require('../controllers/base.controller');
const { validate, generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// droboard-page-service contracts (backend has unprefixed versions)
router.get('/droboard-page/posts', generalLimiter,
  validate(z.object({ query: z.object({
    tab: z.string().max(20).optional(), type: z.string().max(20).optional(),
    page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => {
    const posts = require('../services/posts.service');
    return base.wrap(res, async () => posts.listPosts(req.valid.query));
  });

router.get('/droboard-page/collections', generalLimiter,
  validate(z.object({ query: z.object({
    q: z.string().max(80).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => {
    const cols = require('../services/collections.service');
    return base.wrap(res, async () => cols.listCollections(req.valid.query));
  });

// feed v1 compat (feed-data.js calls /v1/*)
router.get('/v1/feed', generalLimiter, async (req, res) => {
  const feed = require('../services/feed.service');
  return base.wrap(res, async () => feed.discoverData());
});
router.get('/v1/feed/stories', generalLimiter,
  validate(z.object({ query: z.object({ page: z.string().max(6).optional(), limit: z.string().max(6).optional() }).strict() })),
  async (req, res) => {
    const feed = require('../services/feed.service');
    return base.wrap(res, async () => feed.discoverStories(req.valid.query));
  });
router.get('/v1/feed/promo', generalLimiter, async (req, res) => {
  const ads = require('../services/ads.service');
  return base.wrap(res, async () => ads.promos());
});
router.get('/v1/notifications/unread-count', require('../middleware/auth').requireAuth, generalLimiter,
  async (req, res) => {
    const notifications = require('../services/notifications.service');
    return base.wrap(res, async () => notifications.unreadCount(req.user.id));
  });

module.exports = router;
