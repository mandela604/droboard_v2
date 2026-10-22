'use strict';
const { z } = require('zod');
const ads = require('../services/ads.service');
const base = require('../controllers/base.controller');
const { requireAuth } = require('../middleware/auth');
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
// The client always sends page/slot/storyId/viewerId/ts — they must be
// accepted (strict() made every live impression/click fail with 400) and the
// slot/story context feeds the ad-revenue ledger split.
router.post('/track', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({
    id: z.string().min(1).max(120), event: z.enum(['impression', 'click']),
    page: z.string().max(80).optional(), slot: z.string().max(120).optional(),
    storyId: z.string().max(120).optional(),
  }).passthrough() })),
  async (req, res) => base.wrap(res, async () => ads.track({
    id: req.valid.body.id, event: req.valid.body.event, userId: req.user.id,
    page: req.valid.body.page, slot: req.valid.body.slot, storyId: req.valid.body.storyId,
  })));

module.exports = router;
