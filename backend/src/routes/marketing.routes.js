'use strict';
/* Marketing console: live audience catalog + estimates (any logged-in
   marketer), ad placement kill-switches (admin only). */
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');
const audience = require('../services/audience.service');
const ads = require('../services/ads.service');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/audience-catalog', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => audience.catalog()));

router.post('/audience-estimate', requireAuth, generalLimiter,
  validate(z.object({
    body: z.object({
      segments: z.array(z.string().max(40)).max(30).optional(),
      genres: z.array(z.string().max(40)).max(30).optional(),
      countries: z.array(z.string().max(8)).max(30).optional(),
    }).strict(),
  })), async (req, res) => base.wrap(res, async () => audience.estimate(req.valid.body)));

// page/slot programming: {page, enabled?, slots?, interval?, ...}
// slots: { slotId: false } to kill one slot, or
// { slotId: {enabled, formats[], adIds[]} } to program it (pinned ids first).
router.patch('/ads/placement', requireAuth, requireRole('admin'), writeLimiter, audit('marketing.ads.placement'),
  validate(z.object({
    body: z.object({
      page: z.string().min(1).max(40),
      enabled: z.boolean().optional(),
      slots: z.record(z.string().max(80), z.union([
        z.boolean(),
        z.object({
          enabled: z.boolean().optional(),
          formats: z.array(z.string().max(20)).max(10).optional(),
          adIds: z.array(z.string().max(120)).max(20).optional(),
        }).strict(),
      ])).optional(),
      interval: z.number().int().min(1).max(50).optional(),
      cycle: z.array(z.string().max(20)).max(10).optional(),
      format: z.string().max(20).optional(),
      topPromo: z.boolean().optional(),
      promoSlider: z.boolean().optional(),
      wordsPerSlot: z.number().int().min(50).max(5000).optional(),
    }).strict(),
  })), async (req, res) => base.wrap(res, async () => {
    const b = req.valid.body;
    return ads.savePlacement({ page: b.page, patch: b });
  }));

// bulk placements save — matches the ad-manager console call
// (PUT /api/marketing/ads/placements with the full placements map).
router.put('/ads/placements', requireAuth, requireRole('admin'), writeLimiter, audit('marketing.ads.placements'),  validate(z.object({
    body: z.record(z.string().max(40), z.object({
      enabled: z.boolean().optional(),
      interval: z.number().int().min(1).max(50).optional(),
      cycle: z.array(z.string().max(20)).max(10).optional(),
      format: z.string().max(20).optional(),
      topPromo: z.boolean().optional(),
      promoSlider: z.boolean().optional(),
      wordsPerSlot: z.number().int().min(50).max(5000).optional(),
      slots: z.record(z.string().max(80), z.union([
        z.boolean(),
        z.object({
          enabled: z.boolean().optional(),
          formats: z.array(z.string().max(20)).max(10).optional(),
          adIds: z.array(z.string().max(120)).max(20).optional(),
        }).strict(),
      ])).optional(),
    }).strict()),
  })), async (req, res) => base.wrap(res, async () => {
    const pages = Object.keys(req.valid.body || {}).slice(0, 30);
    for (const page of pages) {
      await ads.savePlacement({ page, patch: req.valid.body[page] });
    }
    return ads.placements();
  }));

// ad inventory CRUD (ad-manager console; MarketingData shape in/out)
const adBody = z.object({
  format: z.enum(['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo']).optional(),
  brand: z.string().max(500).optional(), title: z.string().max(500).optional(),
  heading: z.string().max(500).optional(), body: z.string().max(5000).optional(),
  text: z.string().max(5000).optional(), image: z.string().max(2000).optional(),
  code: z.string().max(20000).optional(), cta: z.string().max(500).optional(),
  url: z.string().max(2000).optional(),
  pages: z.array(z.string().max(40)).max(20).optional(),
  slots: z.array(z.string().max(80)).max(40).optional(),
  genre: z.string().max(40).optional(),
  active: z.boolean().optional(),
  startDate: z.string().max(30).optional(), endDate: z.string().max(30).optional(),
}).strict();

router.get('/ads/inventory', requireAuth, requireRole('admin'), generalLimiter,
  async (req, res) => base.wrap(res, async () => ads.inventoryAll()));

router.post('/ads', requireAuth, requireRole('admin'), writeLimiter, audit('marketing.ads.create'),
  validate(z.object({ body: adBody })), async (req, res) => base.wrap(res, async () => {
    const out = await ads.createAd(req.valid.body);
    res.status(201);
    return out;
  }));

router.put('/ads/:id', requireAuth, requireRole('admin'), writeLimiter, audit('marketing.ads.update'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }), body: adBody })),
  async (req, res) => base.wrap(res, async () => ads.updateAd({ id: req.valid.params.id, data: req.valid.body })));

router.delete('/ads/:id', requireAuth, requireRole('admin'), writeLimiter, audit('marketing.ads.delete'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }) })),
  async (req, res) => base.wrap(res, async () => ads.deleteAd(req.valid.params.id)));

module.exports = router;