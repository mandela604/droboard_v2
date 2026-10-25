'use strict';
const { z } = require('zod');
const ads = require('../services/ads.service');
const base = require('../controllers/base.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// ad-service contract: GET /api/ads?placement=discover|feed|genreHub…&slot=<slotId>
router.get('/', generalLimiter,
  validate(z.object({ query: z.object({ placement: z.string().max(40).optional(), slot: z.string().max(80).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => ads.inventory(req.valid.query.placement, req.valid.query.slot)));

// placement map for consoles + clients (kill switches, slot flags)
router.get('/placements', generalLimiter,
  async (req, res) => base.wrap(res, async () => ads.placements()));

// ad-service contract: POST /api/ads/track {id, event, page, slot, storyId, …}
// Lifecycle events (impression/viewable/click/complete/skip/conversion) are
// accepted from signed-in AND signed-out viewers — guests carry a stable
// viewerId. showingId identifies one rendered ad instance: repeat showings of
// the same creative count as separate impressions, retries dedupe server-side.
router.post('/track', optionalAuth, writeLimiter,
  validate(z.object({ body: z.object({
    id: z.string().min(1).max(120),
    event: z.enum(['impression', 'viewable', 'click', 'complete', 'skip', 'conversion']),
    page: z.string().max(80).optional(), slot: z.string().max(120).optional(),
    storyId: z.string().max(120).optional(),
    showingId: z.string().max(80).optional(),
    // conversion context (ignored for other events)
    value: z.coerce.number().finite().optional(),
    currency: z.string().max(8).optional(),
    orderId: z.string().max(120).optional(),
  }).passthrough() })),
  async (req, res) => base.wrap(res, async () => ads.track({
    id: req.valid.body.id, event: req.valid.body.event,
    userId: req.user && req.user.id,
    anonId: req.valid.body.viewerId,
    page: req.valid.body.page, slot: req.valid.body.slot, storyId: req.valid.body.storyId,
    showingId: req.valid.body.showingId,
    value: req.valid.body.value, currency: req.valid.body.currency, orderId: req.valid.body.orderId,
  })));

// Advertiser server-to-server postback. Signed with AD_POSTBACK_SECRET
// (x-ad-secret header or ?secret=), idempotent on orderId. Fails closed when
// the secret is not configured.
router.post('/postback', writeLimiter,
  validate(z.object({ body: z.object({
    id: z.string().min(1).max(120).optional(),
    adId: z.string().min(1).max(120).optional(),
    orderId: z.string().max(120).optional(),
    value: z.coerce.number().finite().optional(),
    currency: z.string().max(8).optional(),
    page: z.string().max(80).optional(),
    slot: z.string().max(120).optional(),
    storyId: z.string().max(120).optional(),
  }).passthrough() })),
  async (req, res) => base.wrap(res, async () => {
    const secret = process.env.AD_POSTBACK_SECRET || '';
    if (!secret) { const e = new Error('postback_not_configured'); e.status = 503; throw e; }
    const given = req.get('x-ad-secret') || String(req.query.secret || '');
    if (given !== secret) { const e = new Error('forbidden'); e.status = 403; throw e; }
    const b = req.valid.body || {};
    return ads.track({
      id: b.adId || b.id, event: 'conversion',
      page: b.page, slot: b.slot, storyId: b.storyId,
      value: b.value, currency: b.currency, orderId: b.orderId,
      source: 'postback',
    });
  }));

// Real per-slot numbers for the marketing console.
router.get('/performance', requireAuth, requireRole('admin', 'marketing', 'finance', 'chief_editor'), generalLimiter,
  validate(z.object({ query: z.object({
    days: z.coerce.number().int().min(1).max(90).optional(),
    page: z.string().max(40).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => ads.performance(req.valid.query)));

module.exports = router;
