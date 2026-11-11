'use strict';
const { AuthorTransaction, Withdrawal, PaymentMethod, PaymentDispute } = require('../models/money.model');
const { Wallet } = require('../models/money.model');
const base = require('./base.controller');

function mine(req) {
  // authors act on their own finance; admins may pass ?authorId=
  const isStaff = (req.user.roles || []).some(r => ['admin', 'finance'].includes(r));
  return (isStaff && req.valid.query.authorId) ? req.valid.query.authorId : req.user.id;
}

// Author-console withdrawal pill only has three states; the DB keeps the full
// approval history so finance can audit — collapse the 6→3 at the read boundary.
function authorWdStatus(s) {
  if (s === 'approved' || s === 'paid') return 'approved';
  if (s === 'declined' || s === 'failed') return 'declined';
  return 'pending';
}

function monthStart(offset) {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + (offset || 0), 1);
}

async function earnings(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const thisStart = monthStart(0);
    const lastStart = monthStart(-1);
    const histStart = monthStart(-11); // trailing 12 buckets incl. this month
    const [completed, pendingAgg, wallet, lifetimeAgg, bookAgg] = await Promise.all([
      AuthorTransaction.find({
        authorId, status: 'completed', type: { $in: ['earned', 'bonus'] },
        createdAt: { $gte: histStart },
      }).select('amount type bookId createdAt').lean(),
      Withdrawal.aggregate([
        { $match: { authorId, status: { $in: ['requested', 'under_review', 'approved'] } } },
        { $group: { _id: null, t: { $sum: '$amount' } } },
      ]),
      Wallet.findOne({ userId: authorId, kind: 'author' }).lean(),
      // Lifetime is every author credit, not the 12-month window above.
      AuthorTransaction.aggregate([
        { $match: { authorId, status: 'completed', type: { $in: ['earned', 'bonus'] } } },
        { $group: { _id: null, t: { $sum: '$amount' } } },
      ]),
      // byBook rolls earned credits (bonus has no bookId) up to the source.
      AuthorTransaction.aggregate([
        { $match: { authorId, status: 'completed', type: 'earned', bookId: { $ne: null } } },
        { $group: { _id: '$bookId', earnings: { $sum: '$amount' } } },
      ]),
    ]);

    const sum = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const thisMonthRows = completed.filter(r => r.createdAt >= thisStart);
    const lastMonthRows = completed.filter(r => r.createdAt >= lastStart && r.createdAt < thisStart);

    const bookIds = bookAgg.map(r => String(r._id)).filter(Boolean);
    const { Book } = require('../models/content.model');
    const bookRows = bookIds.length
      ? await Book.find({ id: { $in: bookIds } }).select('id title cover').lean().catch(() => [])
      : [];
    const meta = {};
    bookRows.forEach(b => { meta[String(b.id)] = { title: b.title || 'Untitled', cover: b.cover || '' }; });
    const byBook = bookAgg
      .map(r => ({
        id: String(r._id),
        title: (meta[String(r._id)] && meta[String(r._id)].title) || 'Untitled',
        cover: (meta[String(r._id)] && meta[String(r._id)].cover) || '',
        earnings: Math.round((Number(r.earnings) || 0) * 100) / 100,
      }))
      .sort((a, b) => b.earnings - a.earnings);

    const monthlyHistory = [];
    for (let i = 11; i >= 0; i--) {
      const from = monthStart(-i);
      const to = monthStart(-i + 1);
      const label = from.toLocaleDateString('en-US', { month: 'short' });
      const rows = completed.filter(r => r.createdAt >= from && r.createdAt < to);
      monthlyHistory.push({ month: label, earned: Math.round(sum(rows) * 100) / 100 });
    }

    return {
      // Balance is withdrawable fiat, not the coin wallet — the author page
      // uses it to gate the Withdraw button.
      balance: Math.max(0, Number(wallet && wallet.fiatAvail) || 0),
      lifetime: Math.round((Number(lifetimeAgg[0] && lifetimeAgg[0].t) || 0) * 100) / 100,
      thisMonth: Math.round(sum(thisMonthRows) * 100) / 100,
      lastMonth: Math.round(sum(lastMonthRows) * 100) / 100,
      monthlyHistory,
      pending: Math.round((Number(pendingAgg[0] && pendingAgg[0].t) || 0) * 100) / 100,
      byBook,
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

// Owner-only read of one method, including the unmasked account number so the
// edit form can show what is stored. The list endpoint keeps it hidden.
async function method(req, res) {
  return base.wrap(res, async () => {
    const authorId = mine(req);
    const m = await PaymentMethod.findOne({ id: req.valid.params.id, authorId }).select('+accountNumber').lean();
    if (!m) { const e = new Error('not_found'); e.status = 404; throw e; }
    return m;
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
    const rows = await Withdrawal.find({ authorId }).sort({ requestedAt: -1 }).lean();
    // Author console sees the three pill states and the field names the
    // frontend's `getWithdrawals` renders — collapse the raw 6-state queue
    // and `requestedAt` -> `requested` here so the reader never has to know
    // about the internal approval lifecycle.
    return rows.map(w => ({
      id: w.id,
      amount: Number(w.amount) || 0,
      method: w.method,
      account: w.account || '',
      requested: (w.requestedAt || w.createdAt || new Date()).toISOString(),
      status: authorWdStatus(w.status),
      note: w.note || '',
      processed: w.processedAt ? new Date(w.processedAt).toISOString() : null,
    }));
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
    // Both sides of a payment argument, whichever field carries the filer.
    const id = String(req.user.id);
    return PaymentDispute.find({ $or: [{ authorId: mine(req) }, { userId: id }] })
      .sort({ createdAt: -1 }).lean();
  });
}

async function fileDispute(req, res) {
  return base.wrap(res, async () => {
    const body = Object.assign({ amount: 0, role: 'author' }, req.valid.body, { status: 'open' });
    const isStaff = (req.user.roles || []).some(r => ['admin', 'finance'].includes(r));
    if (body.role === 'reader' && !isStaff) {
      body.userId = String(req.user.id);
      body.authorId = '';
    } else {
      body.authorId = mine(req);
      if (body.role !== 'reader') body.role = 'author';
    }
    if (!body.who) {
      // The finance queue shows a name, not a Mongo id, so resolve it here.
      const { User } = require('../models/user.model');
      const u = await User.findOne({ id: String(req.user.id) }).select('fullName avatar').lean().catch(() => null);
      body.who = (u && u.fullName) || '';
      if (u && u.avatar) body.avatar = u.avatar;
    }
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

module.exports = { earnings, transactions, methods, method, addMethod, updateMethod, deleteMethod, defaultMethod, withdrawals, requestWithdrawal, disputes, fileDispute, coinPacks, saveCoinPack, deleteCoinPack, adRewards, saveAdReward, deleteAdReward, bundles, saveBundle, deleteBundle };
