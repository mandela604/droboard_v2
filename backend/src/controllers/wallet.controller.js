'use strict';
const wallet = require('../services/wallet.service');
const store = require('../services/store.service');
const base = require('./base.controller');

async function balance(req, res) {
  return base.wrap(res, async () => {
    const w = await wallet.getOrCreateWallet(req.user.id, 'reader');
    return wallet.readerBalance(w);
  });
}

async function entitlements(req, res) {
  return base.wrap(res, async () => wallet.entitlements(req.user.id));
}

async function storeData(req, res) {
  return base.wrap(res, async () => {
    const data = await store.catalog();
    if (req.user) {
      const w = await wallet.getOrCreateWallet(req.user.id, 'reader');
      data.balance = wallet.readerBalance(w);
    }
    return data;
  });
}

async function unlock(req, res) {
  return base.wrap(res, async () => {
    const { bookId, chapterId } = req.valid.body;
    const { CoinRate } = require('../models/revenue.model');
    const engagement = require('../services/engagement.service');
    const fx = await CoinRate.findOne({ key: 'live' }).lean();
    const face = (fx && fx.coinFaceNGN) || 15;
    // Price is SERVER-SIDE truth: Chapter.price (set via admin/editor module).
    // The client-sent priceCoins is accepted but ignored.
    const ch = await engagement.loadChapter(bookId, chapterId);
    const price = Math.max(0, Math.floor(ch.price || 0));
    if (price === 0) {
      const w = await wallet.getOrCreateWallet(req.user.id, 'reader');
      return { ok: true, free: true, price: 0, balance: w.coinBalance };
    }
    const out = await wallet.unlockChapter({
      userId: req.user.id, bookId, chapterId: ch.id, priceCoins: price, coinFaceNGN: face,
    });
    return { ok: true, price: out.alreadyOwned ? 0 : price, balance: out.balance, alreadyOwned: !!out.alreadyOwned };
  });
}

// Rewarded-video unlock: the reader pays with a completed view, not coins.
// Start hands back a token that is only valid after a real elapsed time.
async function adUnlockStart(req, res) {
  return base.wrap(res, async () => {
    const { bookId, chapterId } = req.valid.body;
    return wallet.adUnlockStart({ userId: req.user.id, bookId, chapterId });
  });
}

async function adUnlock(req, res) {
  return base.wrap(res, async () => {
    const { bookId, chapterId, token } = req.valid.body;
    return wallet.unlockByAd({ userId: req.user.id, bookId, chapterId, token });
  });
}

async function tip(req, res) {
  return base.wrap(res, async () => {
    const { authorId, coins, giftCode, requestId } = req.valid.body;
    const { CoinRate } = require('../models/revenue.model');
    const fx = await CoinRate.findOne({ key: 'live' }).lean();
    const face = (fx && fx.coinFaceNGN) || 15;
    return wallet.sendTip({ fromUserId: req.user.id, authorId, coins, giftCode, coinFaceNGN: face, requestId });
  });
}

async function transactions(req, res) {
  return base.wrap(res, async () => wallet.history({ userId: req.user.id, limit: req.query.limit }));
}

// Supporters of an author for the tip sheet. Signed-in only: the sheet that
// renders it is already gated, and who tipped whom is not public profile data.
async function tips(req, res) {
  return base.wrap(res, async () => wallet.tipsFor({
    authorId: req.valid.params.authorId,
    limit: req.query.limit,
  }));
}

async function earnStart(req, res) {
  return base.wrap(res, async () => wallet.earnStart({ userId: req.user.id, code: req.valid.body.code }));
}

async function earn(req, res) {
  return base.wrap(res, async () => {
    const out = await wallet.earnClaim({ userId: req.user.id, code: req.valid.body.code, token: req.valid.body.token });
    return out;
  });
}

module.exports = { balance, entitlements, storeData, unlock, adUnlockStart, adUnlock, tip, tips, transactions, earnStart, earn };
