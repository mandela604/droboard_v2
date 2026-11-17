'use strict';
// Thin compat aliases — reuse existing services, no new logic.
const { z } = require('zod');
const base = require('../controllers/base.controller');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');

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
    // The page feed shows the page's OWN posts only — not everyone's.
    return base.wrap(res, async () => posts.listPosts(
      Object.assign({}, req.valid.query, { surface: 'droboard' })
    ));
  });

router.get('/droboard-page/collections', generalLimiter,
  validate(z.object({ query: z.object({
    q: z.string().max(80).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => {
    const cols = require('../services/collections.service');
    return base.wrap(res, async () => cols.listCollections(req.valid.query));
  });

// ── Official @droboard page: managers + editable copy ──────────────────
const pageAuth = [requireAuth, requireRole('admin', 'senior_editor', 'chief_editor', 'marketing', 'editor', 'moderator')];
const adminOnly = [requireAuth, requireRole('admin')];

router.get('/page/managers', generalLimiter, async (req, res) =>
  base.wrap(res, async () => ({ items: await require('../services/posts.service').listManagers() })));
router.post('/page/managers', ...adminOnly, writeLimiter, audit('page.manager.add'),
  validate(z.object({ body: z.object({ handle: z.string().min(1).max(40), role: z.enum(['admin', 'editor']).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () =>
    require('../services/posts.service').addManager(req.valid.body, req.user.id)));
router.patch('/page/managers/:handle', ...adminOnly, writeLimiter, audit('page.manager.role'),
  validate(z.object({ params: z.object({ handle: z.string().min(1).max(40) }), body: z.object({ role: z.enum(['admin', 'editor']) }).strict() })),
  async (req, res) => base.wrap(res, async () =>
    require('../services/posts.service').updateManagerRole(req.valid.params.handle, req.valid.body.role)));
router.delete('/page/managers/:handle', ...adminOnly, writeLimiter, audit('page.manager.remove'),
  validate(z.object({ params: z.object({ handle: z.string().min(1).max(40) }) })),
  async (req, res) => base.wrap(res, async () =>
    require('../services/posts.service').removeManager(req.valid.params.handle)));
router.get('/page/me/manager', generalLimiter, requireAuth, async (req, res) =>
  base.wrap(res, async () => ({ canPost: await require('../services/posts.service').canManagePage(req.user.id) })));
router.get('/page/settings', generalLimiter, async (req, res) =>
  base.wrap(res, async () => require('../services/posts.service').getPageSettings()));
router.patch('/page/settings', ...pageAuth, writeLimiter, audit('page.settings.patch'),
  validate(z.object({ body: z.object({
    bio: z.string().max(5000).optional(), blurb: z.string().max(5000).optional(),
    links: z.array(z.string().max(300)).max(30).optional(),
    rules: z.array(z.string().max(500)).max(50).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () =>
    require('../services/posts.service').savePageSettings(req.valid.body, req.user.id)));

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
// picker for the review queue modal. Empty DB answers 200 with [] — the
// client renders its own empty state; no hardcoded fallback in production.
router.get('/contracts', generalLimiter, async (req, res) => {
  return base.wrap(res, async () => {
    const { ContractTemplate } = require('../models/contract.model');
    const rows = await ContractTemplate.find({}).sort({ updatedAt: -1 }).limit(50).lean().catch(() => []);
    return rows.map((t) => ({
      id: t.id,
      label: t.name || t.type || 'Contract',
      detail: [t.desc || t.description || '',
        t.royaltyRate != null ? t.royaltyRate + '% royalty' : '',
        t.termLength || ''].filter(Boolean).join(' · ') || 'Standard terms',
    }));
  });
});

module.exports = router;
