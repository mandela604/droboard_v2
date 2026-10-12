'use strict';
// Verify-first purchase controller. Every channel verifies with its
// provider and asserts the verified amount against the pack catalog
// BEFORE crediting. Coins come from the catalog by packCode, never from
// client claims. Missing provider credentials fail closed (503).
const wallet = require('../services/wallet.service');
const verify = require('../services/payments-verify.service');
const base = require('./base.controller');

function storeRefFor(channel, orderId) { return channel + ':' + orderId; }

async function creditVerified({ userId, pack, verified, channel, packCode }) {
  verify.assertPackAmount(pack, verified.amount, verified.currency);
  const out = await wallet.creditPurchase({
    userId, coins: pack.coins,
    fiatAmount: verified.amount, fiatCurrency: verified.currency || 'NGN',
    channel, storeRef: storeRefFor(channel, verified.orderId), packCode,
  });
  // Subscriptions fulfill as plan rows (coins stay 0); packs/bundles as coins.
  if (pack.kind === 'subscription' && pack.plan) {
    const { Subscription } = require('../models/money.model');
    const days = Number(pack.plan.durationDays) || 30;
    const startedAt = new Date();
    const sub = await Subscription.create({
      userId, planCode: pack.code, status: 'active', startedAt,
      expiresAt: new Date(startedAt.getTime() + days * 86400000),
    });
    return Object.assign({}, out, { plan: pack.code, subscriptionId: sub.id, expiresAt: sub.expiresAt });
  }
  return out;
}

// Web (Paystack): client sends the transaction reference + packCode.
async function paystack(req, res) {
  return base.wrap(res, async () => {
    const { reference, packCode } = req.valid.body;
    const v = await verify.verifyPaystack({ reference });
    const pack = await verify.lookupPack(packCode);
    return creditVerified({ userId: req.user.id, pack, verified: v, channel: 'paystack', packCode: pack.code });
  });
}

// Web (Flutterwave): client sends the transaction id + packCode.
async function flutterwave(req, res) {
  return base.wrap(res, async () => {
    const { transactionId, packCode } = req.valid.body;
    const v = await verify.verifyFlutterwave({ transactionId });
    const pack = await verify.lookupPack(packCode);
    return creditVerified({ userId: req.user.id, pack, verified: v, channel: 'flutterwave', packCode: pack.code });
  });
}

// App (Google Play Billing): Play Console product IDs must equal pack codes.
async function play(req, res) {
  return base.wrap(res, async () => {
    const { purchaseToken, productId } = req.valid.body;
    const v = await verify.verifyPlay({ purchaseToken, productId });
    const pack = await verify.lookupPack(productId);
    return creditVerified({ userId: req.user.id, pack, verified: v, channel: 'play', packCode: pack.code });
  });
}

// iOS App Store: not wired (app uses Google Play). Fail closed.
async function appstore(req, res) {
  return base.wrap(res, async () => {
    const e = new Error('appstore_not_configured');
    e.status = 501;
    throw e;
  });
}

async function config(req, res) {
  return base.wrap(res, async () => {
    const env = require('../config/env');
    return {
      paystackPublicKey: env.paystackPublicKey || '',
      flutterwavePublicKey: env.flwPublicKey || '',
      currency: 'NGN',
    };
  });
}

/* ── Webhooks (provider -> server, no auth; signature verified).
   NOTE: express.raw must parse these routes (see server.js) so the HMAC
   runs over exact bytes. Each webhook re-verifies via the provider API,
   then credits idempotently (ledger key = channel:orderId). */

// Paystack sends metadata (set at init: { userId, packCode }).
async function paystackWebhook(req, res) {
  return base.wrap(res, async () => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!verify.verifyPaystackSig(raw, req.headers['x-paystack-signature'])) {
      const e = new Error('bad_webhook_signature');
      e.status = 401;
      throw e;
    }
    let event;
    try { event = JSON.parse(raw.toString('utf8')); } catch (e) { throw Object.assign(new Error('bad_webhook_body'), { status: 400 }); }
    if (!event || event.event !== 'charge.success' || !event.data) return { ok: true, ignored: true };
    const meta = event.data.metadata || {};
    if (!meta.userId || !meta.packCode) throw Object.assign(new Error('webhook_missing_metadata'), { status: 400 });
    const v = await verify.verifyPaystack({ reference: event.data.reference });
    const pack = await verify.lookupPack(meta.packCode);
    return creditVerified({ userId: String(meta.userId), pack, verified: v, channel: 'paystack', packCode: pack.code });
  });
}

// Flutterwave sends meta (set at charge: { userId, packCode }).
async function flutterwaveWebhook(req, res) {
  return base.wrap(res, async () => {
    if (!verify.verifyFlwHash(req.headers['verif-hash'])) {
      const e = new Error('bad_webhook_signature');
      e.status = 401;
      throw e;
    }
    let event = req.body;
    if (Buffer.isBuffer(event)) {
      try { event = JSON.parse(event.toString('utf8')); } catch (e) { throw Object.assign(new Error('bad_webhook_body'), { status: 400 }); }
    }
    if (!event || event.event !== 'charge.completed' || !event.data) return { ok: true, ignored: true };
    const meta = event.data.meta || event.data.metadata || {};
    if (!meta.userId || !meta.packCode) throw Object.assign(new Error('webhook_missing_metadata'), { status: 400 });
    const txId = event.data.id || event.data.tx_ref;
    const v = await verify.verifyFlutterwave({ transactionId: txId });
    const pack = await verify.lookupPack(meta.packCode);
    return creditVerified({ userId: String(meta.userId), pack, verified: v, channel: 'flutterwave', packCode: pack.code });
  });
}

module.exports = { paystack, flutterwave, play, appstore, paystackWebhook, flutterwaveWebhook, config };
