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

async function withdrawals(req, res) {
  return base.wrap(res, async () => {
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
    const d = await PaymentDispute.create(Object.assign({}, req.valid.body, { authorId, status: 'open' }));
    return d.toJSON();
  });
}

module.exports = { earnings, transactions, methods, addMethod, deleteMethod, withdrawals, requestWithdrawal, disputes, fileDispute };
