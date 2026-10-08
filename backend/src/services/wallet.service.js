'use strict';
const mongoose = require('mongoose');
const { Wallet, CoinTransaction, AuthorTransaction, Withdrawal, PaymentMethod, PaymentDispute, CoinPack, CoinBundle, SubscriptionPlan, Gift } = require('../models/money.model');
const { PoolBalance } = require('../models/revenue.model');
const ledger = require('./ledger.service');
const revenue = require('./revenue.service');

async function getOrCreateWallet(userId, kind) {
  let w = await Wallet.findOne({ userId, kind: kind || 'reader' });
  if (!w) w = await Wallet.create({ userId, kind: kind || 'reader' });
  return w;
}

async function bumpPool(pool, amount, session) {
  await PoolBalance.updateOne({ pool }, { $inc: { balance: amount }, $set: { recomputedAt: new Date() } }, { upsert: true, session });
}

// Purchase: credit coins AFTER external verification (caller verifies first).
async function creditPurchase({ userId, coins, fiatAmount, fiatCurrency, channel, storeRef, packCode }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await CoinTransaction.create([{
      userId, type: 'purchase', coins, fiatAmount,
      fiatCurrency: fiatCurrency || 'NGN', channel: channel || 'web',
      storeRef: storeRef || '', status: 'completed',
    }], { session });
    await Wallet.updateOne({ userId, kind: 'reader' }, { $inc: { coinBalance: coins } }, { upsert: true, session });
    await ledger.post({
      legs: [{ debit: 'store:' + channel, credit: 'wallet:' + userId, amount: fiatAmount, coins }],
      saleId: storeRef || null, kind: 'purchase', memo: 'pack ' + (packCode || ''),
      idempotencyKey: 'purchase:' + (storeRef || (userId + ':' + Date.now())), session,
    });
    await session.commitTransaction();
    const w = await Wallet.findOne({ userId, kind: 'reader' }).lean();
    return { coins: w.coinBalance };
  } catch (e) {
    try { await session.abortTransaction(); } catch (_) {}
    throw e;
  } finally { session.endSession(); }
}

// Chapter unlock: spend coins at per-chapter price, run waterfall immediately.
async function unlockChapter({ userId, bookId, chapterId, priceCoins, coinFaceNGN }) {
  if (!priceCoins || priceCoins < 0) { const e = new Error('bad_price'); e.status = 400; throw e; }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const wallet = await Wallet.findOne({ userId, kind: 'reader' }).session(session);
    if (!wallet || wallet.coinBalance < priceCoins) { const e = new Error('insufficient'); e.status = 402; throw e; }
    wallet.coinBalance -= priceCoins;
    await wallet.save({ session });
    const gross = priceCoins * coinFaceNGN; // fiat-equivalent of the spend
    const cfg = await revenue.activeConfig();
    const s = revenue.splitGross(gross, cfg);
    const { Book } = require('../models/content.model');
    const { AuthorTransaction } = require('../models/money.model');
    const book = await Book.findOne({ id: bookId }).select('authorId title').session(session).lean();
    const authorId = book ? String(book.authorId) : null;
    const key = 'unlock:' + userId + ':' + bookId + ':' + chapterId;
    await ledger.post({
      legs: [
        { debit: 'wallet:' + userId, credit: 'pool:sales', amount: gross, coins: priceCoins },
        { debit: 'pool:sales', credit: 'pool:marketing', amount: s.marketing, coins: 0 },
        { debit: 'pool:sales', credit: 'pool:editors', amount: s.editors, coins: 0 },
        { debit: 'pool:sales', credit: 'wallet:author', amount: s.writer, coins: 0 },
        { debit: 'pool:sales', credit: 'pool:platform', amount: s.platform, coins: 0 },
      ],
      authorId, saleId: key, kind: 'spend', memo: 'unlock ch ' + chapterId,
      idempotencyKey: key, configVersion: cfg.version, session,
    });
    if (authorId) {
      await AuthorTransaction.create([{
        authorId, type: 'earned', desc: 'Chapter unlock' + (book ? ' — ' + book.title : ''),
        amount: s.writer, bookId, status: 'completed',
      }], { session });
      await Wallet.updateOne({ userId: authorId, kind: 'author' },
        { $inc: { fiatAvail: s.writer, lifetimeEarned: s.writer } }, { upsert: true, session });
    }
    await bumpPool('marketing', s.marketing, session);
    await bumpPool('editors', s.editors, session);
    await bumpPool('platform', s.platform, session);
    await session.commitTransaction();
    return { balance: wallet.coinBalance, writerShare: s.writer };
  } catch (e) {
    try { await session.abortTransaction(); } catch (_) {}
    throw e;
  } finally { session.endSession(); }
}

// Tips/gifts: flat writer/platform split of coin face. Coin-only, no cash.
async function sendTip({ fromUserId, authorId, coins, giftCode, coinFaceNGN }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const wallet = await Wallet.findOne({ userId: fromUserId, kind: 'reader' }).session(session);
    if (!wallet || wallet.coinBalance < coins) { const e = new Error('insufficient'); e.status = 402; throw e; }
    wallet.coinBalance -= coins;
    await wallet.save({ session });
    const face = coins * coinFaceNGN;
    const cfg = await revenue.activeConfig(authorId);
    const s = revenue.splitGift(face, cfg);
    const key = 'tip:' + fromUserId + ':' + authorId + ':' + Date.now();
    await ledger.post({
      legs: [
        { debit: 'wallet:' + fromUserId, credit: 'pool:tips', amount: face, coins },
        { debit: 'pool:tips', credit: 'wallet:author:' + authorId, amount: s.writer, coins: 0 },
        { debit: 'pool:tips', credit: 'pool:platform', amount: s.platform, coins: 0 },
      ],
      authorId, saleId: key, kind: giftCode ? 'gift' : 'tip',
      memo: (giftCode ? 'gift ' + giftCode : 'tip'),
      idempotencyKey: key, configVersion: cfg.version, session,
    });
    await bumpPool('platform', s.platform, session);
    await AuthorTransaction.create([{
      authorId, type: 'earned', desc: (giftCode ? 'Gift' : 'Tip') + ' from reader',
      amount: s.writer, status: 'completed',
    }], { session });
    await Wallet.updateOne({ userId: authorId, kind: 'author' },
      { $inc: { fiatAvail: s.writer, lifetimeEarned: s.writer } }, { upsert: true, session });
    await session.commitTransaction();
    return { balance: wallet.coinBalance, writerShare: s.writer }; // tip/gift flow
  } catch (e) {
    try { await session.abortTransaction(); } catch (_) {}
    throw e;
  } finally { session.endSession(); }
}

module.exports = { getOrCreateWallet, creditPurchase, unlockChapter, sendTip };
