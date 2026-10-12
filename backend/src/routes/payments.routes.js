'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/payments.controller');
const base = require('../controllers/base.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, moneyLimiter, generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const packCode = z.string().min(1).max(60);

const paystackBody = z.object({
  reference: z.string().min(1).max(200),
  packCode,
}).strict();

const flutterwaveBody = z.object({
  transactionId: z.union([z.string().min(1).max(200), z.number()]),
  packCode,
}).strict();

const playBody = z.object({
  purchaseToken: z.string().min(1).max(2000),
  productId: z.string().min(1).max(200),
}).strict();

// Client verify-then-credit (authed; money rate-limited).
router.post('/paystack/verify', requireAuth, moneyLimiter, validate(z.object({ body: paystackBody })), ctrl.paystack);
router.post('/flutterwave/verify', requireAuth, moneyLimiter, validate(z.object({ body: flutterwaveBody })), ctrl.flutterwave);
router.post('/play/verify', requireAuth, moneyLimiter, validate(z.object({ body: playBody })), ctrl.play);
router.post('/appstore/verify', requireAuth, moneyLimiter, validate(z.object({ body: playBody })), ctrl.appstore);

// Publishable config for inline SDKs (public keys only — never secrets).
router.get('/config', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => ctrl.config()));
// Provider webhooks (no auth; HMAC/hash verified in controller).
// NOTE: server.js parses these routes with express.raw — do not move them
// behind express.json or Paystack HMAC verification breaks.
router.post('/webhook/paystack', ctrl.paystackWebhook);
router.post('/webhook/flutterwave', ctrl.flutterwaveWebhook);

module.exports = router;
