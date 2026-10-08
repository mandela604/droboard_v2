'use strict';
const wallet = require('../services/wallet.service');
const base = require('./base.controller');

// Demo verify: accept receipt, credit on success.
// LIVE: verify signature/token with Play Developer API / App Store Server
// API / Paystack API BEFORE crediting. Never trust client claims.
async function verifyAndCredit({ userId, kind, receipt, expectedCoins, fiatAmount, fiatCurrency }) {
  if (!receipt) { const e = new Error('no_receipt'); e.status = 400; throw e; }
  // TODO live verification per channel goes here; reject on failure.
  return wallet.creditPurchase({
    userId, coins: expectedCoins, fiatAmount, fiatCurrency: fiatCurrency || 'NGN',
    channel: kind, storeRef: typeof receipt === 'string' ? receipt : (receipt.token || receipt.reference || ''),
  });
}

async function paystack(req, res) {
  return base.wrap(res, async () => verifyAndCredit({
    userId: req.user.id, kind: 'web',
    receipt: req.valid.body.reference, expectedCoins: req.valid.body.coins,
    fiatAmount: req.valid.body.amount, fiatCurrency: req.valid.body.currency,
  }));
}

async function play(req, res) {
  return base.wrap(res, async () => verifyAndCredit({
    userId: req.user.id, kind: 'android-app',
    receipt: req.valid.body.purchaseToken, expectedCoins: req.valid.body.coins,
    fiatAmount: req.valid.body.amount, fiatCurrency: req.valid.body.currency,
  }));
}

async function appstore(req, res) {
  return base.wrap(res, async () => verifyAndCredit({
    userId: req.user.id, kind: 'ios-app',
    receipt: req.valid.body.transactionId, expectedCoins: req.valid.body.coins,
    fiatAmount: req.valid.body.amount, fiatCurrency: req.valid.body.currency,
  }));
}

module.exports = { paystack, play, appstore };
