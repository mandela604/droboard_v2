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
    routingCode: z.string().max(40).optional(),
    email: z.string().max(160).optional(), provider: z.string().max(60).optional(),
    phoneNumber: z.string().max(30).optional(),
  }).strict(),
})), ctrl.addMethod);
router.delete('/payment-methods/:id', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  params: z.object({ id }),
})), ctrl.deleteMethod);
router.put('/payment-methods/:id', requireAuth, writeLimiter, audit('finance.methods.update'), validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  params: z.object({ id }),
  body: z.object({
    type: z.enum(['bank', 'paypal', 'mobile']).optional(), accountName: z.string().min(1).max(120).optional(),
    bankName: z.string().max(120).optional(), accountNumber: z.string().max(40).optional(),
    routingCode: z.string().max(40).optional(),
    email: z.string().max(160).optional(), provider: z.string().max(60).optional(),
    phoneNumber: z.string().max(30).optional(),
  }).strict(),
})), ctrl.updateMethod);
router.put('/payment-methods/:id/default', requireAuth, writeLimiter, audit('finance.methods.default'), validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  params: z.object({ id }),
})), ctrl.defaultMethod);

router.get('/withdrawals', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.withdrawals);
router.post('/withdrawals', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ amount: z.number().min(100), methodId: z.string().min(1).max(40) }).strict(),
})), ctrl.requestWithdrawal);

router.get('/disputes', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.disputes);
router.post('/disputes', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ transactionId: z.string().max(40).optional(), amount: z.number().min(0).optional(), reason: z.string().min(1).max(1000) }).strict(),
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
  adUrl: z.string().max(500).optional(),
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

/* ─────────────────────────────────────────────────────────────
 * Finance CONSOLE endpoints (platform-scoped, staff-only).
 * Consumed by finance-data.js + coin-transactions-service.js; every path
 * below previously 404'd, which is why those pages always fell to demo data.
 * STAFF guard keeps the anonymous demo experience unchanged (401 -> fallback).
 * ───────────────────────────────────────────────────────────── */
const fctrl = require('../controllers/finance-console.controller');
const money0 = z.number().min(0).max(1000000000);
const posInt = z.number().int().min(0).max(100000000);
const priceLadder = z.record(z.string().max(8), z.union([z.number(), z.string().max(40)]));

// One strict-but-wide body shared by the five catalog kinds: the console's
// payloads differ per kind (priceUsd vs price, bonusPercent vs bonus, extras),
// and a strict object rejects anything we don't recognise.
const cfgBody = z.object({
  id: z.string().max(120).optional(),
  code: z.string().max(40).optional(),
  name: z.string().max(120).optional(),
  desc: z.string().max(500).optional(),
  coins: posInt.optional(),
  bonus: posInt.optional(),
  bonusPct: z.number().min(0).max(100).optional(),
  bonusPercent: z.number().min(0).max(100).optional(),
  priceUsd: money0.optional(),
  price: z.string().max(40).optional(),
  basePriceNGN: money0.optional(),
  prices: priceLadder.optional(),
  status: z.string().max(20).optional(),
  meta: z.any().optional(),
  icon: z.string().max(200).optional(),
  color: z.string().max(24).optional(),
  badge: z.string().max(40).optional(),
  costCoins: posInt.optional(),
  action: z.string().max(120).optional(),
  type: z.string().max(40).optional(),
  cooldown: z.string().max(40).optional(),
  available: z.boolean().optional(),
  pagesRequired: posInt.optional(),
  blogCategory: z.string().max(60).optional(),
  blogUrl: z.string().max(500).optional(),
  channelId: z.string().max(120).optional(),
  channelUrl: z.string().max(500).optional(),
  videoId: z.string().max(120).optional(),
  minWatchSec: posInt.optional(),
  adUrl: z.string().max(500).optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional(),
  durationDays: posInt.optional(),
  coinsPerDay: posInt.optional(),
  features: z.array(z.string().max(200)).max(30).optional(),
}).strict();
const statusBody = z.object({ status: z.string().max(20) }).strict();
const cfgParams = z.object({ params: z.object({ id }) });

router.get('/dashboard', ...STAFF, generalLimiter, fctrl.dashboard);

router.post('/withdrawals/:id/approve', ...STAFF, writeLimiter, audit('finance.withdrawals.approve'),
  validate(z.object({ params: z.object({ id }) })), fctrl.approveWithdrawal);
router.post('/withdrawals/:id/decline', ...STAFF, writeLimiter, audit('finance.withdrawals.decline'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ reason: z.string().max(1000).optional() }).strict(),
  })), fctrl.declineWithdrawal);

router.get('/author-payments', ...STAFF, generalLimiter, fctrl.authorPayments);
router.get('/payment-history', ...STAFF, generalLimiter, fctrl.paymentHistory);
router.post('/author-payments/:authorId/schedule', ...STAFF, writeLimiter, audit('finance.payouts.schedule'),
  validate(z.object({
    params: z.object({ authorId: z.string().min(1).max(120) }),
    body: z.object({ amount: money0, date: z.string().max(20).optional() }).strict(),
  })), fctrl.schedulePayout);
router.post('/author-payments/:authorId/process', ...STAFF, writeLimiter, audit('finance.payouts.process'),
  validate(z.object({ params: z.object({ authorId: z.string().min(1).max(120) }) })), fctrl.processPayment);

router.get('/payment-disputes', ...STAFF, generalLimiter, fctrl.paymentDisputes);
router.post('/payment-disputes/:id/resolve', ...STAFF, writeLimiter, audit('finance.disputes.resolve'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(1000).optional() }).strict(),
  })), fctrl.resolveDispute);
router.post('/payment-disputes/:id/reject', ...STAFF, writeLimiter, audit('finance.disputes.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(1000).optional() }).strict(),
  })), fctrl.rejectDispute);
router.post('/payment-disputes/:id/reply', ...STAFF, writeLimiter, audit('finance.disputes.reply'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ message: z.string().min(1).max(2000) }).strict(),
  })), fctrl.replyDispute);

router.get('/coin-transactions', ...STAFF, generalLimiter, fctrl.coinTransactions);

// Catalog config — GET lists are bare arrays (coin-transactions-service.js:160-163);
// writes are per-kind so a bad payload only affects one collection.
function cfgRoutes(kind, listFn, saveFn, putFn, statusFn, delFn) {
  router.get('/coin-' + kind, ...STAFF, generalLimiter, listFn);
  router.post('/coin-' + kind, ...STAFF, writeLimiter, audit('finance.coin.' + kind + '.save'),
    validate(z.object({ body: cfgBody })), saveFn);
  router.put('/coin-' + kind + '/:id', ...STAFF, writeLimiter, audit('finance.coin.' + kind + '.update'),
    validate(z.object({ params: z.object({ id }), body: cfgBody })), putFn);
  router.patch('/coin-' + kind + '/:id', ...STAFF, writeLimiter, audit('finance.coin.' + kind + '.status'),
    validate(z.object({ params: z.object({ id }), body: statusBody })), statusFn);
  router.delete('/coin-' + kind + '/:id', ...STAFF, writeLimiter, audit('finance.coin.' + kind + '.delete'),
    validate(z.object({ params: z.object({ id }) })), delFn);
}
cfgRoutes('packages', fctrl.coinPackages, fctrl.savePackage, fctrl.putPackage, fctrl.statusPackage, fctrl.deletePackage);
cfgRoutes('bundles', fctrl.coinBundles, fctrl.saveBundle, fctrl.putBundle, fctrl.statusBundle, fctrl.deleteBundle);
cfgRoutes('gifts', fctrl.coinGifts, fctrl.saveGift, fctrl.putGift, fctrl.statusGift, fctrl.deleteGift);
cfgRoutes('earn', fctrl.coinEarn, fctrl.saveEarn, fctrl.putEarn, fctrl.statusEarn, fctrl.deleteEarn);
cfgRoutes('subscriptions', fctrl.coinSubscriptions, fctrl.saveSubscription, fctrl.putSubscription, fctrl.statusSubscription, fctrl.deleteSubscription);

router.get('/coin-config-history', ...STAFF, generalLimiter, fctrl.coinConfigHistory);
// History rows are written by the console itself (logHistory -> POST here);
// the console's local `id` is ignored so it can't collide with generated ids.
const historyBody = z.object({
  id: z.string().max(40).optional(),
  action: z.enum(['created', 'updated', 'deleted', 'activated', 'deactivated']),
  itemType: z.enum(['package', 'bundle', 'gift', 'earn', 'subscription']),
  itemName: z.string().max(200),
  actor: z.string().max(120).optional(),
  date: z.string().max(40).optional(),
  details: z.string().max(500).optional(),
}).strict();
router.post('/coin-config-history', ...STAFF, writeLimiter,
  validate(z.object({ body: historyBody })), fctrl.logConfig);

module.exports = router;
