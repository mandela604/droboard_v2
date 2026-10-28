'use strict';
/* Marketing console: live audience catalog + estimates (any logged-in
   marketer), ad placement kill-switches (admin only).

   The `marketing` role is enumerated in user.model for exactly this console,
   so console guards accept admin|marketing (audience reads stay open to any
   logged-in user). */
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');
const audience = require('../services/audience.service');
const ads = require('../services/ads.service');
const surfaces = require('../services/marketing-surfaces.service');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

// console guard: admin OR marketing
const C = [requireRole('admin', 'marketing')];

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

/* ── Editable segment catalog (Ad Manager → Audience segments) ──
   Definitions only. `reach` is accepted but ignored — the count comes from
   the aggregates behind /audience-catalog, never from what the console sent,
   so nobody can inflate an audience by editing the number shown for it. */
const segmentRule = z.object({
  signal: z.string().max(40),
  op: z.enum(['gte', 'lte', 'eq', 'any']),
  value: z.union([z.boolean(), z.number().min(0).max(1e7), z.array(z.number().min(0).max(1e5)).length(2)]),
  windowDays: z.number().int().min(1).max(365).optional(),
}).strict();
const segmentBody = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  icon: z.string().max(40).optional(),
  color: z.string().max(9).optional(),
  desc: z.string().max(300).optional(),
  retired: z.boolean().optional(),
  reach: z.number().min(0).optional(),
  rule: segmentRule,
}).strict();

router.get('/audience-segments', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => ({ segments: await audience.listSegments() })));

router.put('/audience-segments', requireAuth, ...C, writeLimiter, audit('marketing.audience.update'),
  validate(z.object({ body: z.object({ segments: z.array(segmentBody).min(1).max(60) }).strict() })),
  async (req, res) => base.wrap(res, async () => ({
    segments: await audience.saveSegments(req.valid.body.segments, req.user && req.user.id),
  })));

router.post('/audience-segments/reset', requireAuth, ...C, writeLimiter, audit('marketing.audience.reset'),
  async (req, res) => base.wrap(res, async () => ({
    segments: await audience.resetSegments(req.user && req.user.id),
  })));

/* ── Dashboard + campaigns (marketing-data.js:240-304) ── */
router.get('/dashboard', requireAuth, ...C, generalLimiter,
  async (req, res) => base.wrap(res, async () => surfaces.dashboard()));

const campaignBody = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(['live', 'scheduled', 'draft', 'paused', 'ended']).optional(),
  type: z.string().max(40).optional(),
  objective: z.string().max(60).optional(),
  storyId: z.string().max(60).optional(),
  storyTitle: z.string().max(300).optional(),
  storyAuthor: z.string().max(200).optional(),
  storyCover: z.string().max(2000).optional(),
  storyGenre: z.string().max(80).optional(),
  placements: z.array(z.string().max(40)).max(20).optional(),
  // Slot entitlement (campaign-wizard.js): every slot the buy covers. Ad setup
  // restricts a creative's slots to this list, so the two can't disagree.
  slots: z.array(z.string().max(80)).max(60).optional(),
  audienceTargeting: z.object({}).passthrough().optional(),
  startDate: z.string().max(30).optional(),
  endDate: z.string().max(30).optional(),
  hasBudget: z.boolean().optional(),
  budget: z.number().min(0).max(1e9).optional(),
  spent: z.number().min(0).max(1e9).optional(),
  owner: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  reach: z.number().min(0).max(1e12).optional(),
  impressions: z.number().min(0).max(1e12).optional(),
  clicks: z.number().min(0).max(1e12).optional(),
  ctr: z.number().min(0).max(100).optional(),
  advertiserName: z.string().max(200).optional(),
  advertiserEmail: z.string().max(200).optional(),
  conversions: z.number().min(0).max(1e12).optional(),
  // passthrough: the wizard also sends objective-specific keys; a strict
  // object here 400s campaign creation for advertisers.
}).passthrough();

router.get('/campaigns', requireAuth, ...C, generalLimiter,
  async (req, res) => base.wrap(res, async () => surfaces.campaigns()));
router.post('/campaigns', requireAuth, ...C, writeLimiter, audit('marketing.campaigns.create'),
  validate(z.object({ body: campaignBody })), async (req, res) => base.wrap(res, async () => {
    const out = await surfaces.createCampaign(req.valid.body);
    res.status(201);
    return out;
  }));
router.put('/campaigns/:id', requireAuth, ...C, writeLimiter, audit('marketing.campaigns.update'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }), body: campaignBody.partial() })),
  async (req, res) => base.wrap(res, async () => surfaces.updateCampaign(req.valid.params.id, req.valid.body)));
router.delete('/campaigns/:id', requireAuth, ...C, writeLimiter, audit('marketing.campaigns.delete'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }) })),
  async (req, res) => base.wrap(res, async () => surfaces.deleteCampaign(req.valid.params.id)));

/* ── Creatives by campaign + stats + reset (marketing-data.js:309,404,455) ── */
router.get('/ads/campaign', requireAuth, ...C, generalLimiter,
  validate(z.object({ query: z.object({ campaign: z.string().min(1).max(120) }).strict() })),
  async (req, res) => base.wrap(res, async () => surfaces.adsByCampaign(req.valid.query.campaign)));
// legacy alias: marketing-data.js calls GET /ads?campaign=…
router.get('/ads/', requireAuth, ...C, generalLimiter,
  validate(z.object({ query: z.object({ campaign: z.string().max(120).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => (
    req.valid.query.campaign ? surfaces.adsByCampaign(req.valid.query.campaign) : ads.inventoryAll())));
router.get('/ads/stats', requireAuth, ...C, generalLimiter,
  async (req, res) => base.wrap(res, async () => surfaces.adStats()));
router.post('/ads/reset', requireAuth, ...C, writeLimiter, audit('marketing.ads.reset'),
  async (req, res) => base.wrap(res, async () => surfaces.resetAds()));

/* ── Reader league (marketing-data.js:415,424,443) ── */
router.get('/league/config', requireAuth, ...C, generalLimiter,
  async (req, res) => base.wrap(res, async () => surfaces.leagueConfig()));
router.put('/league/config', requireAuth, ...C, writeLimiter, audit('marketing.league.config'),
  validate(z.object({ body: z.record(z.any()).optional() })),
  async (req, res) => base.wrap(res, async () => surfaces.saveLeagueConfig(req.valid.body || {})));
router.post('/league/reset', requireAuth, ...C, writeLimiter, audit('marketing.league.reset'),
  async (req, res) => base.wrap(res, async () => surfaces.resetLeague()));

// page/slot programming: {page, enabled?, slots?, interval?, ...}
// slots: { slotId: false } to kill one slot, or
// { slotId: {enabled, formats[], adIds[]} } to program it (pinned ids first).
// `passthrough()`: the ad-manager PUTs one bulk map covering every panel on
// the placements card, so it also sends the spotlight schedule and
// paidUnlockAds. A strict object here 400s the entire save, which the console
// used to swallow and fall back to localStorage — the change looked applied in
// the marketer's browser and never reached a reader. Unknown-but-safe config
// now lands in placement.cfg (ads.service.js savePlacement).
router.patch('/ads/placement', requireAuth, ...C, writeLimiter, audit('marketing.ads.placement'),
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
      repeat: z.boolean().optional(),
      paidUnlockAds: z.boolean().optional(),
    }).passthrough(),
  })), async (req, res) => base.wrap(res, async () => {
    const b = req.valid.body;
    return ads.savePlacement({ page: b.page, patch: b });
  }));

// bulk placements save — matches the ad-manager console call
// (PUT /api/marketing/ads/placements with the full placements map).
router.put('/ads/placements', requireAuth, ...C, writeLimiter, audit('marketing.ads.placements'),  validate(z.object({
      body: z.record(z.string().max(40), z.object({
        enabled: z.boolean().optional(),
        repeat: z.boolean().optional(),
        interval: z.number().int().min(1).max(50).optional(),
      cycle: z.array(z.string().max(20)).max(10).optional(),
      format: z.string().max(20).optional(),
      topPromo: z.boolean().optional(),
      promoSlider: z.boolean().optional(),
      wordsPerSlot: z.number().int().min(50).max(5000).optional(),
      paidUnlockAds: z.boolean().optional(),
      slots: z.record(z.string().max(80), z.union([
        z.boolean(),
        z.object({
          enabled: z.boolean().optional(),
          formats: z.array(z.string().max(20)).max(10).optional(),
          adIds: z.array(z.string().max(120)).max(20).optional(),
        }).strict(),
      ])).optional(),
    }).passthrough()),
  })), async (req, res) => base.wrap(res, async () => {
    const pages = Object.keys(req.valid.body || {}).slice(0, 30);
    for (const page of pages) {
      await ads.savePlacement({ page, patch: req.valid.body[page] });
    }
    return ads.placements();
  }));

// ad inventory CRUD (ad-manager console; MarketingData shape in/out).
// `passthrough()`: the wizard sends per-format creative fields (sponsor,
// author, rating, chapters, preview, name, handle, tagline, headline, sub,
// img, avatar, cover, reads, isBook, …) plus audience/offerRef — a strict
// object would reject every save (marketing-data.js:345-348).
const adBody = z.object({
  id: z.string().max(120).optional(),
  format: z.enum(['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo', 'minibanner', 'spotlight']).optional(),
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
  campaign: z.string().max(120).optional(),
  audience: z.object({
    segments: z.array(z.string().max(40)).max(30).optional(),
    genres: z.array(z.string().max(40)).max(30).optional(),
    countries: z.array(z.string().max(8)).max(30).optional(),
  }).strict().optional(),
  offerRef: z.object({
    kind: z.string().max(40).optional(),
    id: z.string().max(120).optional(),
    name: z.string().max(200).optional(),
  }).strict().optional(),
}).passthrough();

router.get('/ads/inventory', requireAuth, ...C, generalLimiter,
  async (req, res) => base.wrap(res, async () => ads.inventoryAll()));

router.post('/ads', requireAuth, ...C, writeLimiter, audit('marketing.ads.create'),
  validate(z.object({ body: adBody })), async (req, res) => base.wrap(res, async () => {
    const out = await ads.createAd(req.valid.body);
    res.status(201);
    return out;
  }));

router.put('/ads/:id', requireAuth, ...C, writeLimiter, audit('marketing.ads.update'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }), body: adBody })),
  async (req, res) => base.wrap(res, async () => ads.updateAd({ id: req.valid.params.id, data: req.valid.body })));

router.delete('/ads/:id', requireAuth, ...C, writeLimiter, audit('marketing.ads.delete'),
  validate(z.object({ params: z.object({ id: z.string().min(1).max(120) }) })),
  async (req, res) => base.wrap(res, async () => ads.deleteAd(req.valid.params.id)));

module.exports = router;