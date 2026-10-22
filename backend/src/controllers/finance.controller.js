'use strict';
const { AuthorTransaction, Withdrawal, PaymentMethod, PaymentDispute } = require('../models/money.model');
const { Wallet } = require('../models/money.model');
const base = require('./base.controller');

function mine(req) {
  // authors act on their own finance; admins may pass ?authorId=
  const isStaff = (req.user.roles || []).some(r => ['admin', 'finance'].includes(r));
  return (isStaff && req.valid.query.authorId) ? req.valid.query.authorId : req.user.id;
}

async function earnings(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const agg = await AuthorTransaction.aggregate([
      { $match: { authorId, status: 'completed' } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const t = {};
    agg.forEach(a => { t[a._id] = a.total; });
    const w = await Wallet.findOne({ userId: authorId, kind: 'author' }).lean();
    return {
      balance: (w && w.coinBalance) || 0,
      lifetime: t.earned || 0,
      thisMonth: t.earned || 0,
      pending: 0,
      byBook: [],
    };
  });
}

async function transactions(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const list = await AuthorTransaction.find({ authorId }).sort({ createdAt: -1 }).limit(50).lean();
    return list;
  });
}

async function methods(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    return PaymentMethod.find({ authorId }).lean();
  });
}

async function addMethod(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const m = await PaymentMethod.create(Object.assign({}, req.valid.body, { authorId }));
    return m.toJSON();
  });
}

async function deleteMethod(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    await PaymentMethod.deleteOne({ id: req.valid.params.id, authorId });
    return { ok: true };
  });
}

const METHOD_FIELDS = ['type', 'accountName', 'bankName', 'accountNumber', 'routingCode', 'email', 'provider', 'phoneNumber'];
async function updateMethod(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const m = await PaymentMethod.findOne({ id: req.valid.params.id, authorId });
    if (!m) { const e = new Error('not_found'); e.status = 404; throw e; }
    METHOD_FIELDS.forEach(k => { if (req.valid.body[k] !== undefined) m[k] = req.valid.body[k]; });
    await m.save();
    return m.toJSON();
  });
}

async function defaultMethod(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const m = await PaymentMethod.findOne({ id: req.valid.params.id, authorId });
    if (!m) { const e = new Error('not_found'); e.status = 404; throw e; }
    await PaymentMethod.updateMany({ authorId }, { $set: { isDefault: false } });
    m.isDefault = true;
    await m.save();
    return m.toJSON();
  });
}

async function withdrawals(req, res) {
  return base.wrap(res, async () => {
    const isStaff = (req.user.roles || []).some(r => ['admin', 'finance'].includes(r));
    // The finance console (finance-data.js) reads the platform-wide queue off
    // this same path; authors and staff scoping with ?authorId keep own rows.
    if (isStaff && !req.valid.query.authorId) {
      return require('../services/finance-surfaces.service').withdrawals();
    }
    const authorId = mine(req);
    return Withdrawal.find({ authorId }).sort({ requestedAt: -1 }).lean();
  });
}

async function requestWithdrawal(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const { amount, methodId } = req.valid.body;
    const m = await PaymentMethod.findOne({ id: methodId, authorId }).lean();
    if (!m) { const e = new Error('no_method'); e.status = 400; throw e; }
    const w = await Withdrawal.create({
      authorId, amount, method: m.type === 'bank' ? 'Bank Transfer' : m.type === 'paypal' ? 'PayPal' : 'Mobile Money',
      paymentMethodId: m.id, account: m.email || m.phoneNumber || '••••',
      status: 'requested',
    });
    return w.toJSON();
  });
}

async function disputes(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    return PaymentDispute.find({ authorId }).sort({ createdAt: -1 }).lean();
  });
}

async function fileDispute(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const body = Object.assign({ amount: 0 }, req.valid.body, { authorId, status: 'open' });
    const d = await PaymentDispute.create(body);
    return d.toJSON();
  });
}

/* ── Store settings admin (coin packs / ad rewards / bundles) ── */
const store = require('../services/store.service');

async function coinPacks(req, res) {
  return base.wrap(res, async () => store.listPacks());
}
async function saveCoinPack(req, res) {
  return base.wrap(res, async () => {
    const out = await store.savePack(req.valid.body);
    if (!req.valid.body.id) res.status(201);
    return out;
  });
}
async function deleteCoinPack(req, res) {
  return base.wrap(res, async () => store.deletePack(req.valid.params.id));
}
async function adRewards(req, res) {
  return base.wrap(res, async () => store.listRewards());
}
async function saveAdReward(req, res) {
  return base.wrap(res, async () => {
    const out = await store.saveReward(req.valid.body);
    if (!req.valid.body.id) res.status(201);
    return out;
  });
}
async function deleteAdReward(req, res) {
  return base.wrap(res, async () => store.deleteReward(req.valid.params.id));
}
async function bundles(req, res) {
  return base.wrap(res, async () => store.listBundles());
}
async function saveBundle(req, res) {
  return base.wrap(res, async () => {
    const out = await store.saveBundle(req.valid.body);
    if (!req.valid.body.id) res.status(201);
    return out;
  });
}
async function deleteBundle(req, res) {
  return base.wrap(res, async () => store.deleteBundle(req.valid.params.id));
}

module.exports = { earnings, transactions, methods, addMethod, updateMethod, deleteMethod, defaultMethod, withdrawals, requestWithdrawal, disputes, fileDispute, coinPacks, saveCoinPack, deleteCoinPack, adRewards, saveAdReward, deleteAdReward, bundles, saveBundle, deleteBundle };
