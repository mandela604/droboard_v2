'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/finance.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, generalLimiter, writeLimiter, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const id = z.string().min(1).max(120);
const STAFF = [requireAuth, requireRole('admin', 'finance')];

router.get('/earnings', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.earnings);
router.get('/transactions', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.transactions);

router.get('/payment-methods', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.methods);
router.post('/payment-methods', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({
    type: z.enum(['bank', 'paypal', 'mobile']), accountName: z.string().min(1).max(120),
    bankName: z.string().max(120).optional(), accountNumber: z.string().max(40).optional(),
    email: z.string().max(160).optional(), provider: z.string().max(60).optional(),
    phoneNumber: z.string().max(30).optional(),
  }).strict(),
})), ctrl.addMethod);
router.delete('/payment-methods/:id', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  params: z.object({ id }),
})), ctrl.deleteMethod);

router.get('/withdrawals', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.withdrawals);
router.post('/withdrawals', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ amount: z.number().min(100), methodId: z.string().min(1).max(40) }).strict(),
})), ctrl.requestWithdrawal);

router.get('/disputes', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.disputes);
router.post('/disputes', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ transactionId: z.string().max(40).optional(), amount: z.number().min(0), reason: z.string().min(1).max(1000) }).strict(),
})), ctrl.fileDispute);

// ── Store settings admin (coin packs / ad rewards / bundles) ──
const packBody = z.object({
  id: z.string().min(1).max(120).optional(), code: z.string().min(1).max(40).optional(),
  coins: z.number().int().min(1).max(1000000).optional(), bonusPct: z.number().min(0).max(100).optional(),
  basePriceNGN: z.number().min(0).max(100000000).optional(), prices: z.record(z.string().max(8), z.number().min(0)).optional(),
  status: z.enum(['active', 'inactive']).optional(), meta: z.any().optional(),
  icon: z.string().max(200).optional(), color: z.string().max(20).optional(),
  badge: z.string().max(40).optional(), name: z.string().max(80).optional(), price: z.string().max(20).optional(),
}).strict();
const rewardBody = z.object({
  id: z.string().min(1).max(120).optional(), code: z.string().min(1).max(40).optional(),
  action: z.string().min(1).max(120).optional(),
  type: z.enum(['watch_ad', 'checkin', 'rate', 'share', 'blog_read', 'youtube_sub', 'youtube_watch']).optional(),
  coins: z.number().int().min(0).max(1000000).optional(), cooldown: z.string().max(20).optional(),
  pagesRequired: z.number().int().min(0).max(1000).optional(), status: z.enum(['active', 'inactive']).optional(),
  meta: z.any().optional(),
  icon: z.string().max(200).optional(), available: z.boolean().optional(),
  blogCategory: z.string().max(40).optional(), blogUrl: z.string().max(500).optional(),
  channelId: z.string().max(80).optional(), channelUrl: z.string().max(500).optional(),
  videoId: z.string().max(80).optional(), minWatchSec: z.number().int().min(0).max(100000).optional(),
}).strict();
const bundleBody = z.object({
  id: z.string().min(1).max(120).optional(), code: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(80).optional(), coins: z.number().int().min(1).max(1000000).optional(),
  bonus: z.number().int().min(0).max(1000000).optional(), basePriceNGN: z.number().min(0).max(100000000).optional(),
  icon: z.string().max(200).optional(), color: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive']).optional(), meta: z.any().optional(), price: z.string().max(20).optional(),
}).strict();

router.get('/store/coin-packs', ...STAFF, generalLimiter, ctrl.coinPacks);
router.post('/store/coin-packs', ...STAFF, writeLimiter, audit('finance.store.packs.save'),
  validate(z.object({ body: packBody })), ctrl.saveCoinPack);
router.delete('/store/coin-packs/:id', ...STAFF, writeLimiter, audit('finance.store.packs.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteCoinPack);
router.get('/store/ad-rewards', ...STAFF, generalLimiter, ctrl.adRewards);
router.post('/store/ad-rewards', ...STAFF, writeLimiter, audit('finance.store.rewards.save'),
  validate(z.object({ body: rewardBody })), ctrl.saveAdReward);
router.delete('/store/ad-rewards/:id', ...STAFF, writeLimiter, audit('finance.store.rewards.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteAdReward);
router.get('/store/bundles', ...STAFF, generalLimiter, ctrl.bundles);
router.post('/store/bundles', ...STAFF, writeLimiter, audit('finance.store.bundles.save'),
  validate(z.object({ body: bundleBody })), ctrl.saveBundle);
router.delete('/store/bundles/:id', ...STAFF, writeLimiter, audit('finance.store.bundles.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteBundle);

module.exports = router;
