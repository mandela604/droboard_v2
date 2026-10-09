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
    priceCoins: z.number().int().min(1).max(10000),
  }).strict() })), ctrl.unlock);
router.post('/tip', requireAuth, moneyLimiter,
  validate(z.object({ body: z.object({
    authorId: z.string().min(1).max(40), coins: z.number().int().min(1).max(100000),
    giftCode: z.string().max(20).optional(),
  }).strict() })), ctrl.tip);

module.exports = router;
