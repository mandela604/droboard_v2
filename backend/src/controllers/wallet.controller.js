'use strict';
const wallet = require('../services/wallet.service');
const store = require('../services/store.service');
const base = require('./base.controller');

async function balance(req, res) {
  return base.wrap(res, async () => {
    const w = await wallet.getOrCreateWallet(req.user.id, 'reader');
    return { coins: w.coinBalance, level: w.level };
  });
}

async function entitlements(req, res) {
  return base.wrap(res, async () => wallet.entitlements(req.user.id));
}

async function storeData(req, res) {
  return base.wrap(res, async () => {
    const data = await store.catalog();
    const w = await wallet.getOrCreateWallet(req.user.id, 'reader');
    data.balance = { coins: w.coinBalance, level: w.level };
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
    return { ok: true, price, balance: out.balance };
  });
}

async function tip(req, res) {
  return base.wrap(res, async () => {
    const { authorId, coins, giftCode } = req.valid.body;
    const { CoinRate } = require('../models/revenue.model');
    const fx = await CoinRate.findOne({ key: 'live' }).lean();
    const face = (fx && fx.coinFaceNGN) || 15;
    return wallet.sendTip({ fromUserId: req.user.id, authorId, coins, giftCode, coinFaceNGN: face });
  });
}

module.exports = { balance, entitlements, storeData, unlock, tip };
