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

// senior-editor review-queue-service.js:133 (ungated fetch) — contract type
// picker for the review queue modal. Client keeps its demo trio on a non-200,
// so an empty DB must still answer 200 with a renderable catalog.
const DEFAULT_CONTRACTS = [
  { id: 'standard', label: 'Standard Royalty Contract', detail: '60/40 author-platform split · non-exclusive' },
  { id: 'premium', label: 'Premium Exclusive Contract', detail: '70/30 author-platform split · exclusive, 12-month term' },
  { id: 'flex', label: 'Flex Starter Contract', detail: '50/50 split · month-to-month, for new authors' },
];
router.get('/contracts', generalLimiter, async (req, res) => {
  return base.wrap(res, async () => {
    const { ContractTemplate } = require('../models/contract.model');
    const rows = await ContractTemplate.find({}).sort({ updatedAt: -1 }).limit(50).lean().catch(() => []);
    const mapped = rows.map((t) => ({
      id: t.id,
      label: t.name || t.type || 'Contract',
      detail: [t.desc || t.description || '',
        t.royaltyRate != null ? t.royaltyRate + '% royalty' : '',
        t.termLength || ''].filter(Boolean).join(' · ') || 'Standard terms',
    }));
    return mapped.length ? mapped : DEFAULT_CONTRACTS;
  });
});

module.exports = router;
