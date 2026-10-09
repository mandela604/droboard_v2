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
    const { bookId, chapterId, priceCoins } = req.valid.body;
    const { CoinRate } = require('../models/revenue.model');
    const fx = await CoinRate.findOne({ key: 'live' }).lean();
    const face = (fx && fx.coinFaceNGN) || 15;
    return wallet.unlockChapter({ userId: req.user.id, bookId, chapterId, priceCoins, coinFaceNGN: face });
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
