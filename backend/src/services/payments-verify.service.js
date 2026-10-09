'use strict';
// services/payments-verify.service.js — provider verification for coin purchases.
// Client receipts are claims, never truth. Every channel verifies with its
// provider BEFORE crediting; missing credentials fail closed (503), never
// silent-credit.
//
//   App (Google Play Billing): Play Developer API purchases.products.get.
//     Play Console product IDs must equal our pack codes (coins_100 …).
//   Web (Paystack):            GET /transaction/verify/:reference + webhook
//   Web (Flutterwave):         GET /v3/transactions/:id/verify + webhook
//
// Coins always come from OUR catalog by packCode — the client can never
// claim arbitrary coins. Verified fiat is recorded as charged; disputes
// and refunds flow through provider webhooks + finance payment-disputes.
// Zero extra deps: global fetch + jsonwebtoken (JWT) + node:crypto (HMAC).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { CoinPack, CoinBundle, SubscriptionPlan } = require('../models/money.model');

function err(code, status) { return Object.assign(new Error(code), { status: status || 400 }); }

function cfg() {
  return {
    playPackage: process.env.PLAY_PACKAGE_NAME || '',
    playSaJson: process.env.PLAY_SERVICE_ACCOUNT_JSON || '',
    paystackSecret: process.env.PAYSTACK_SECRET || '',
    flwSecret: process.env.FLW_SECRET_KEY || '',
    flwHash: process.env.FLW_WEBHOOK_HASH || '',
  };
}

// Pack catalog lookup: code -> { kind, coins, code, doc }. Coins are trusted;
// amounts are asserted against the pack's legs in assertPackAmount.
async function lookupPack(packCode) {
  if (!packCode) throw err('pack_required', 400);
  const code = String(packCode);
  const pack = await CoinPack.findOne({ code, status: 'active' }).lean();
  if (pack) return { kind: 'pack', coins: pack.coins + Math.round(pack.coins * (pack.bonusPct || 0) / 100), code, doc: pack };
  const bundle = await CoinBundle.findOne({ code, status: 'active' }).lean();
  if (bundle) return { kind: 'bundle', coins: bundle.coins + (bundle.bonus || 0), code, doc: bundle };
  const sub = await SubscriptionPlan.findOne({ code, status: 'active' }).lean();
  if (sub) return { kind: 'subscription', coins: 0, code, plan: sub, doc: sub };
  throw err('unknown_pack', 400);
}

// Country -> ISO currency for leg lookup (legs may be keyed either way).
const COUNTRY_CCY = { NG: 'NGN', US: 'USD', GB: 'GBP', GH: 'GHS', KE: 'KES', ZA: 'ZAR', IN: 'INR', CA: 'CAD', AU: 'AUD', PH: 'PHP' };
function legFor(doc, currency) {
  if (!doc) return null;
  const legs = doc.prices instanceof Map ? Object.fromEntries(doc.prices) : (doc.prices || {});
  const cur = String(currency || 'NGN').toUpperCase();
  if (legs[cur] != null) return Number(legs[cur]);
  for (const k of Object.keys(legs)) {
    if ((COUNTRY_CCY[String(k).toUpperCase()] || String(k).toUpperCase()) === cur) return Number(legs[k]);
  }
  if (cur === 'NGN' && doc.basePriceNGN != null) return Number(doc.basePriceNGN);
  return null;
}

// Amount assertion: verified provider amount must equal the pack's leg for
// the receipt currency. NGN always resolves via basePriceNGN; other legs
// must be filled by finance (CoinPack/Bundle/Plan.prices) or this fails
// closed with amount_mismatch — never a substituted price.
function assertPackAmount(pack, amount, currency) {
  const expected = legFor(pack.doc, currency);
  if (expected == null || !(Number(amount) > 0)) throw err('amount_mismatch', 402);
  if (Math.abs(Number(amount) - expected) > 0.009) throw err('amount_mismatch', 402);
  return { expected, currency: String(currency || 'NGN').toUpperCase() };
}

/* ── Google Play (app) ── */
let _playToken = null;
let _playExpAt = 0;
async function playAccessToken() {
  const c = cfg();
  if (!c.playSaJson) throw err('play_not_configured', 503);
  if (_playToken && Date.now() < _playExpAt - 60000) return _playToken;
  let sa;
  try { sa = JSON.parse(c.playSaJson); } catch (e) { throw err('play_bad_service_account', 500); }
  if (!sa.client_email || !sa.private_key) throw err('play_bad_service_account', 500);
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    sa.private_key, { algorithm: 'RS256' }
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(assertion),
  });
  if (!res.ok) throw err('play_auth_failed', 502);
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) throw err('play_auth_failed', 502);
  _playToken = body.access_token;
  _playExpAt = Date.now() + (body.expires_in || 3600) * 1000;
  return _playToken;
}

// purchaseState: 0 purchased, 1 canceled. Accept only fresh purchases.
async function verifyPlay({ purchaseToken, productId }) {
  const c = cfg();
  if (!c.playPackage) throw err('play_not_configured', 503);
  if (!purchaseToken || !productId) throw err('no_receipt', 400);
  const token = await playAccessToken();
  const url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
    + encodeURIComponent(c.playPackage) + '/purchases/products/'
    + encodeURIComponent(String(productId)) + '/purchases/' + encodeURIComponent(String(purchaseToken));
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 404) throw err('play_unknown_purchase', 402);
  if (!res.ok) throw err('play_verify_failed', 502);
  const p = await res.json().catch(() => ({}));
  if (p.purchaseState !== 0) throw err('play_not_purchased', 402);
  if (!p.orderId) throw err('play_verify_failed', 502);
  return {
    ok: true, orderId: p.orderId,
    amount: p.priceAmountMicros != null ? p.priceAmountMicros / 1000000 : null,
    currency: p.priceCurrencyCode || null,
    purchaseTime: p.purchaseTimeMillis ? new Date(Number(p.purchaseTimeMillis)) : null,
  };
}

/* ── Paystack (web) ── */
async function verifyPaystack({ reference }) {
  const c = cfg();
  if (!c.paystackSecret) throw err('paystack_not_configured', 503);
  if (!reference) throw err('no_receipt', 400);
  const res = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(String(reference)), {
    headers: { Authorization: 'Bearer ' + c.paystackSecret },
  });
  if (!res.ok) throw err('paystack_verify_failed', 502);
  const body = await res.json().catch(() => ({}));
  const d = body && body.data;
  if (!body.status || !d || d.status !== 'success') throw err('paystack_not_successful', 402);
  return {
    ok: true, orderId: d.reference,
    amount: d.amount != null ? d.amount / 100 : null, // kobo -> naira
    currency: d.currency || null,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    raw: d,
  };
}
function verifyPaystackSig(rawBody, signature) {
  const c = cfg();
  if (!c.paystackSecret) throw err('paystack_not_configured', 503);
  const hmac = crypto.createHmac('sha512', c.paystackSecret).update(rawBody).digest('hex');
  let a, b;
  try {
    a = Buffer.from(hmac, 'hex'); b = Buffer.from(String(signature || ''), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/* ── Flutterwave (web) ── */
async function verifyFlutterwave({ transactionId }) {
  const c = cfg();
  if (!c.flwSecret) throw err('flutterwave_not_configured', 503);
  if (!transactionId) throw err('no_receipt', 400);
  const res = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(String(transactionId)) + '/verify', {
    headers: { Authorization: 'Bearer ' + c.flwSecret },
  });
  if (!res.ok) throw err('flutterwave_verify_failed', 502);
  const body = await res.json().catch(() => ({}));
  const d = body && body.data;
  if (!body.status || !d || d.status !== 'successful') throw err('flutterwave_not_successful', 402);
  return {
    ok: true, orderId: String(d.id || d.tx_ref),
    amount: d.amount != null ? Number(d.amount) : null,
    currency: d.currency || null,
    txRef: d.tx_ref || null,
    raw: d,
  };
}
function verifyFlwHash(header) {
  const c = cfg();
  if (!c.flwSecret || !c.flwHash) throw err('flutterwave_not_configured', 503);
  const h = String(header || '');
  if (!h) return false;
  const a = Buffer.from(h);
  const b = Buffer.from(c.flwHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  lookupPack, assertPackAmount, verifyPlay, verifyPaystack, verifyFlutterwave,
  verifyPaystackSig, verifyFlwHash, cfg,
};
