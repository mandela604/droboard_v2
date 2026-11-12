'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, moneyLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/balance', requireAuth, ctrl.balance);
router.get('/entitlements', requireAuth, ctrl.entitlements);
router.get('/store', requireAuth, ctrl.storeData);
router.post('/unlock', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    bookId: z.string().min(1).max(40), chapterId: z.string().min(1).max(40),
    // deprecated: price is read server-side from Chapter.price (admin/editor
    // module). Accepted for frontend compat but IGNORED.
    priceCoins: z.number().int().min(0).max(10000).optional(),
  }).strict() })), ctrl.unlock);
// Rewarded-video unlock. No coins are spent or minted: start returns a token,
// the claim books the entitlement after the minimum watch time. Guard on the
// economy lives in the service (paid chapter + allowAdUnlock).
router.post('/unlock-ad/start', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    bookId: z.string().min(1).max(40), chapterId: z.string().min(1).max(40),
  }).strict() })), ctrl.adUnlockStart);
router.post('/unlock-ad', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    bookId: z.string().min(1).max(40), chapterId: z.string().min(1).max(40),
    token: z.string().min(10).max(600),
  }).strict() })), ctrl.adUnlock);
router.post('/tip', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    authorId: z.string().min(1).max(40), coins: z.number().int().min(1).max(100000),
    giftCode: z.string().max(20).optional(),
    // One value per open sheet: makes a retry/resend the SAME request instead
    // of a second tip. Optional — the server falls back to a 10s window.
    requestId: z.string().min(1).max(60).optional(),
  }).strict() })), ctrl.tip);

// Reader's own coin history (store History tab + dispute itemization).
router.get('/transactions', requireAuth, ctrl.transactions);
// Supporters (people who tipped/gifted this author) for the tip sheet.
router.get('/tips/:authorId', requireAuth,
  validate(z.object({
    params: z.object({ authorId: z.string().min(1).max(60) }),
    query: z.object({ limit: z.string().max(6).optional() }).strict(),
  })), ctrl.tips);
// Earn tasks: coins come from the reward row, cooldown from the claim ledger —
// never from whatever the client says it earned. Tasks that leave the app are
// started first (/earn/start hands back a single-use token the claim needs).
router.post('/earn/start', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({ code: z.string().min(1).max(40) }).strict() })), ctrl.earnStart);
router.post('/earn', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    code: z.string().min(1).max(40),
    token: z.string().min(10).max(600).optional(),
  }).strict() })), ctrl.earn);

module.exports = router;
