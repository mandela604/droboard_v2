'use strict';
// Finance console surfaces — the read/write contracts the finance pages
// (finance-data.js + coin-transactions-service.js) actually consume.
// Core finance.controller keeps the author-scoped endpoints; everything here
// is platform-scoped and STAFF-gated, so an anonymous session still falls back
// to demo data exactly as before.
//
// Each function documents the frontend file:line reads it satisfies.

const {
  Wallet, CoinPack, CoinBundle, SubscriptionPlan, Gift, EarnReward,
  CoinTransaction, AuthorTransaction, Withdrawal, Payout, PaymentMethod,
  PaymentDispute, StoreConfigLog,
} = require('../models/money.model');
const { User } = require('../models/user.model');
const { ActivityLog } = require('../models/platform.model');
const { CoinRate } = require('../models/revenue.model');

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; throw e; }

/* ── formatting helpers (mirror the demo's display strings) ── */
function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(v);
}
function usd(n) { return '$' + (Number(n) || 0).toFixed(2); }
function rel(d) {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + 'd ago';
  if (dd < 30) return Math.floor(dd / 7) + 'w ago';
  return Math.floor(dd / 30) + 'mo ago';
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bold(s) { return '<b>' + esc(s) + '</b>'; }

// Display legs are strings ('$9.99' / '₦15,000'); parse to a number for math.
function legNum(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

async function usersById(ids) {
  const uniq = Array.from(new Set((ids || []).map(String).filter(Boolean)));
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id fullName username avatar status email').lean().catch(() => []);
  const m = {};
  rows.forEach(u => {
    m[String(u.id)] = {
      name: u.fullName || u.username || String(u.id),
      avatar: u.avatar || '',
      status: u.status || 'active',
      email: u.email || '',
    };
  });
  return m;
}
function nameOf(m, id) { const u = m[String(id)]; return u ? u.name : String(id || ''); }
function avatarOf(m, id) { const u = m[String(id)]; return (u && u.avatar) || 'https://i.pravatar.cc/60?img=12'; }

// NGN -> USD for console columns that show USD. Source: CoinRate.fx.USD
// (NGN per USD, editable in Super Admin). 1500 is the documented fallback
// matching the seed catalog (100 coins = 1500 NGN).
let _fxUsd = null;
async function ngnPerUsd() {
  if (_fxUsd != null) return _fxUsd;
  try {
    const doc = await CoinRate.findOne({ key: 'live' }).lean();
    const fx = (doc && doc.fx) || {};
    const v = Number(fx.USD != null ? fx.USD : fx.usd);
    _fxUsd = v > 0 ? v : 1500;
  } catch (e) { _fxUsd = 1500; }
  return _fxUsd;
}
async function toUsd(ngn) { return (Number(ngn) || 0) / (await ngnPerUsd()); }

// priceUsd from a catalog doc: explicit USD leg wins, else basePriceNGN / fx.
async function priceUsdOf(doc) {
  const legs = (doc && doc.prices instanceof Map) ? Object.fromEntries(doc.prices) : ((doc && doc.prices) || {});
  if (legs.USD != null && legs.USD !== '') return legNum(legs.USD);
  return Number((await toUsd(doc && doc.basePriceNGN)).toFixed(2));
}

const METHOD_LABEL = { bank: 'Bank Transfer', paypal: 'PayPal', mobile: 'Mobile Money' };

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/withdrawals  (platform scope for staff)
 * finance-data.js:227; row reads withdrawals-service.js:70-73,105-145,183-208.
 * Backend enum requested|under_review|approved|paid|declined|failed maps onto
 * the console's three pill states pending|approved|declined.
 * ───────────────────────────────────────────────────────────── */
function wdStatus(s) {
  if (s === 'approved' || s === 'paid') return 'approved';
  if (s === 'declined' || s === 'failed') return 'declined';
  return 'pending';
}
function withdrawalShape(w, umap) {
  return {
    id: w.id,
    author: nameOf(umap, w.authorId),
    avatar: avatarOf(umap, w.authorId),
    amount: Number(w.amount) || 0,
    method: w.method,
    account: w.account || '',
    requested: (w.requestedAt || w.createdAt || new Date()).toISOString(),
    status: wdStatus(w.status),
    note: w.note || '',
    processed: w.processedAt ? new Date(w.processedAt).toISOString() : undefined,
  };
}

async function withdrawals() {
  const docs = await Withdrawal.find({}).sort({ requestedAt: -1 }).limit(200).lean();
  const umap = await usersById(docs.map(w => w.authorId));
  return docs.map(w => withdrawalShape(w, umap));
}

async function loadWithdrawalOr404(id) {
  const doc = await Withdrawal.findOne({ id: String(id) });
  if (!doc) bad('not_found', 404);
  return doc;
}

// approve: requested|under_review -> approved (paid is set when funds move).
async function approveWithdrawal(id, userId) {
  const doc = await loadWithdrawalOr404(id);
  if (!['requested', 'under_review'].includes(doc.status)) bad('not_approvable', 409);
  doc.status = 'approved';
  doc.reviewedBy = String(userId);
  doc.processedAt = new Date();
  await doc.save();
  const umap = await usersById([doc.authorId]);
  return withdrawalShape(doc.toObject(), umap);
}

// decline: carries the operator reason the console shows in the row note.
async function declineWithdrawal(id, reason, userId) {
  const doc = await loadWithdrawalOr404(id);
  if (!['requested', 'under_review'].includes(doc.status)) bad('not_declinable', 409);
  doc.status = 'declined';
  doc.note = reason ? String(reason).slice(0, 1000) : 'Declined by Finance.';
  doc.reviewedBy = String(userId);
  doc.processedAt = new Date();
  await doc.save();
  const umap = await usersById([doc.authorId]);
  return withdrawalShape(doc.toObject(), umap);
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/author-payments  +  /payment-history
 * finance-data.js:252/:256. Row reads: author-payments-service.js:31-33,
 * :50-80, :137-142, :199-237. `id` MUST be the authorId — schedule/process
 * call /author-payments/{id}/… (finance-data.js:260,269).
 * ───────────────────────────────────────────────────────────── */
async function financeAuthorIds() {
  const [tx, wd, py] = await Promise.all([
    AuthorTransaction.distinct('authorId'),
    Withdrawal.distinct('authorId'),
    Payout.distinct('authorId'),
  ]);
  return Array.from(new Set([].concat(tx, wd, py).map(String).filter(Boolean)));
}

async function authorPayments() {
  const ids = await financeAuthorIds();
  if (!ids.length) return [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [umap, earnedAgg, pendingAgg, payouts, methods, wallets] = await Promise.all([
    usersById(ids),
    AuthorTransaction.aggregate([
      { $match: { authorId: { $in: ids }, status: 'completed', type: { $in: ['earned', 'bonus'] } } },
      { $group: { _id: '$authorId', total: { $sum: '$amount' } } },
    ]),
    Withdrawal.aggregate([
      { $match: { authorId: { $in: ids }, status: { $in: ['requested', 'under_review'] } } },
      { $group: { _id: '$authorId', total: { $sum: '$amount' } } },
    ]),
    Payout.find({ authorId: { $in: ids } }).sort({ paidAt: -1, createdAt: -1 }).limit(500).lean(),
    PaymentMethod.find({ authorId: { $in: ids }, isDefault: true }).lean(),
    Wallet.find({ userId: { $in: ids }, kind: 'author' }).lean(),
  ]).catch(e => { throw e; });

  const earned = {}; earnedAgg.forEach(r => { earned[r._id] = r.total; });
  const pending = {}; pendingAgg.forEach(r => { pending[r._id] = r.total; });
  const lastByAuthor = {};
  payouts.forEach(p => { if (!lastByAuthor[p.authorId]) lastByAuthor[p.authorId] = p; });
  const methodByAuthor = {};
  methods.forEach(m => { methodByAuthor[m.authorId] = METHOD_LABEL[m.type] || m.type; });
  const walletByAuthor = {};
  wallets.forEach(w => { walletByAuthor[w.userId] = w; });
  const wdByAuthor = {};
  (await Withdrawal.find({ authorId: { $in: ids } }).sort({ requestedAt: -1 }).lean())
    .forEach(w => { if (!wdByAuthor[w.authorId]) wdByAuthor[w.authorId] = w; });

  return ids.map(id => {
    const u = umap[id] || {};
    const w = walletByAuthor[id] || {};
    const last = lastByAuthor[id] || null;
    const wd = wdByAuthor[id] || null;
    // on-hold is a real signal: the account is not active (suspended/banned).
    const onHold = u.status && u.status !== 'active';
    return {
      id,
      author: u.name || id,
      avatar: u.avatar || 'https://i.pravatar.cc/60?img=12',
      totalEarned: Number(earned[id]) || 0,
      pendingPayout: Number(pending[id]) || 0,
      method: methodByAuthor[id] || (wd ? wd.method : 'Bank Transfer'),
      status: onHold ? 'on-hold' : 'active',
      holdReason: onHold ? 'Account is ' + String(u.status).replace(/_/g, ' ') + '.' : undefined,
      lastPayout: last && (last.paidAt || last.createdAt) ? new Date(last.paidAt || last.createdAt).toISOString().slice(0, 10) : null,
      lastAmount: last ? Number(last.amount) || 0 : 0,
      nextScheduled: w.nextPayoutAt ? new Date(w.nextPayoutAt).toISOString().slice(0, 10) : null,
      nextPayoutAmount: Number(w.nextPayoutAmount) || 0,
    };
  }).sort((a, b) => b.pendingPayout - a.pendingPayout || b.totalEarned - a.totalEarned);
}

async function paymentHistory() {
  const docs = await Payout.find({}).sort({ paidAt: -1, createdAt: -1 }).limit(200).lean();
  const umap = await usersById(docs.map(p => p.authorId));
  return docs.map(p => ({
    id: p.id,
    author: nameOf(umap, p.authorId),
    avatar: avatarOf(umap, p.authorId),
    amount: Number(p.amount) || 0,
    method: p.method || 'Bank Transfer',
    date: new Date(p.paidAt || p.createdAt || Date.now()).toISOString(),
    status: p.status === 'failed' ? 'failed' : 'completed',
    reference: p.reference || p.id,
    failReason: p.failReason || undefined,
  }));
}

// schedulePayout: records the operator's intended next payout on the author's
// wallet (finance-data.js:260 sends {amount, date:'YYYY-MM-DD'}).
async function schedulePayout(authorId, amount, date) {
  const w = await Wallet.findOne({ userId: String(authorId), kind: 'author' });
  if (!w) bad('wallet_not_found', 404);
  w.nextPayoutAt = date ? new Date(date) : null;
  w.nextPayoutAmount = Number(amount) || 0;
  await w.save();
  const rows = await authorPayments();
  return rows.find(r => r.id === String(authorId)) || null;
}

// processPayment: settles every open withdrawal for the author and writes a
// Payout row (which feeds /payment-history). finance-data.js:269.
async function processPayment(authorId, userId) {
  const id = String(authorId);
  const open = await Withdrawal.find({ authorId: id, status: { $in: ['requested', 'under_review', 'approved'] } });
  const amount = open.reduce((s, w) => s + (Number(w.amount) || 0), 0);
  if (amount > 0) {
    await Promise.all(open.map(w => {
      w.status = 'paid';
      w.reviewedBy = String(userId || '');
      w.processedAt = new Date();
      return w.save();
    }));
    const method = open[0].method || 'Bank Transfer';
    await Payout.create({
      authorId: id, recipient: id, amount, method, status: 'completed',
      reference: 'TXN-' + Date.now().toString(36).toUpperCase(), paidAt: new Date(),
    });
    await AuthorTransaction.create({
      authorId: id, type: 'withdrawal', desc: 'Payout processed', amount: -amount, status: 'completed',
    }).catch(() => {});
  }
  const w = await Wallet.findOne({ userId: id, kind: 'author' });
  if (w) { w.nextPayoutAt = null; w.nextPayoutAmount = 0; await w.save(); }
  const rows = await authorPayments();
  return rows.find(r => r.id === id) || null;
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/payment-disputes + resolve|reject|reply
 * finance-data.js:312/:316/:320/:324; row reads payment-disputes-service.js
 * :70-73, :109-149, :192-256, :311-329.
 * ───────────────────────────────────────────────────────────── */
async function paymentDisputes() {
  const docs = await PaymentDispute.find({}).sort({ createdAt: -1 }).limit(200).lean();
  const umap = await usersById(docs.map(d => d.authorId).concat(docs.flatMap(d => (d.replies || []).map(r => r.from))));
  return docs.map(d => ({
    id: d.id,
    author: nameOf(umap, d.authorId),
    avatar: avatarOf(umap, d.authorId),
    amount: Number(d.amount) || 0,
    reason: d.reason,
    status: d.status,
    filed: new Date(d.createdAt || Date.now()).toISOString(),
    resolutionNote: d.resolutionNote || '',
    replies: (d.replies || []).map(r => ({
      from: nameOf(umap, r.from),
      message: r.message,
      time: new Date(r.at || Date.now()).toISOString(),
    })),
  }));
}

async function loadDisputeOr404(id) {
  const doc = await PaymentDispute.findOne({ id: String(id) });
  if (!doc) bad('not_found', 404);
  return doc;
}
async function disputeOut(doc) {
  const umap = await usersById([doc.authorId].concat((doc.replies || []).map(r => r.from)));
  return ({
    id: doc.id,
    author: nameOf(umap, doc.authorId),
    avatar: avatarOf(umap, doc.authorId),
    amount: Number(doc.amount) || 0,
    reason: doc.reason,
    status: doc.status,
    filed: new Date(doc.createdAt || Date.now()).toISOString(),
    resolutionNote: doc.resolutionNote || '',
    replies: (doc.replies || []).map(r => ({
      from: nameOf(umap, r.from), message: r.message, time: new Date(r.at || Date.now()).toISOString(),
    })),
  });
}
async function resolveDispute(id, note) {
  const doc = await loadDisputeOr404(id);
  doc.status = 'resolved';
  doc.resolutionNote = note ? String(note).slice(0, 1000) : 'Resolved by Finance.';
  await doc.save();
  return disputeOut(doc);
}
async function rejectDispute(id, note) {
  const doc = await loadDisputeOr404(id);
  doc.status = 'rejected';
  doc.resolutionNote = note ? String(note).slice(0, 1000) : 'Rejected by Finance.';
  await doc.save();
  return disputeOut(doc);
}
async function replyDispute(id, message, userId) {
  const doc = await loadDisputeOr404(id);
  doc.replies.push({ from: String(userId || 'finance'), message: String(message || '').slice(0, 2000), at: new Date() });
  if (doc.status === 'open') doc.status = 'investigating';
  await doc.save();
  return disputeOut(doc);
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/coin-transactions
 * finance-data.js:281; row reads coin-transactions-service.js:252-301, :340-349.
 * ───────────────────────────────────────────────────────────── */
async function coinTransactions() {
  const docs = await CoinTransaction.find({}).sort({ createdAt: -1 }).limit(300).lean();
  const umap = await usersById(docs.map(t => t.userId));
  const rate = await ngnPerUsd();
  return docs.map(t => ({
    id: t.id,
    user: nameOf(umap, t.userId),
    avatar: avatarOf(umap, t.userId),
    type: t.type === 'refund' ? 'refund' : (t.type === 'subscription' ? 'subscription' : t.type),
    coins: Number(t.coins) || 0,
    usd: String(t.fiatCurrency || 'NGN').toUpperCase() === 'USD'
      ? Number(t.fiatAmount) || 0
      : Number(((Number(t.fiatAmount) || 0) / rate).toFixed(2)),
    date: new Date(t.createdAt || Date.now()).toISOString(),
    status: t.status,
    note: t.note || undefined,
  }));
}

/* ─────────────────────────────────────────────────────────────
 * Coin config surface (coin-transactions-service.js:160-163, :701, :704,
 * :713, :744, :771). Bare arrays; CRUD round-trips the same payload shape.
 * ───────────────────────────────────────────────────────────── */
function pricesOut(doc) {
  const p = (doc.prices instanceof Map) ? Object.fromEntries(doc.prices) : (doc.prices || {});
  return p && typeof p === 'object' ? p : {};
}
function metaOut(doc) {
  const m = doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
  return m;
}
function createdAtStr(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

async function coinPackages() {
  const docs = await CoinPack.find({}).sort({ createdAt: -1 }).lean();
  return Promise.all(docs.map(async d => {
    const m = metaOut(d);
    return {
      id: d.id, code: d.code,
      name: m.name || d.code,
      coins: Number(d.coins) || 0,
      priceUsd: await priceUsdOf(d),
      bonusPercent: Number(d.bonusPct) || 0,
      status: d.status,
      prices: pricesOut(d),
      badge: m.badge || '', color: m.color || '',
      createdAt: createdAtStr(d.createdAt),
    };
  }));
}

async function coinBundles() {
  const docs = await CoinBundle.find({}).sort({ createdAt: -1 }).lean();
  return Promise.all(docs.map(async d => {
    const m = metaOut(d);
    const p = await priceUsdOf(d);
    return {
      id: d.id, code: d.code,
      name: d.name, coins: Number(d.coins) || 0, bonus: Number(d.bonus) || 0,
      // The pricing grid renders `price` raw, so it must be a display string.
      price: usd(p),
      priceUsd: p,
      icon: m.icon || d.icon || 'fa-box-open',
      color: m.color || d.color || '#22c55e',
      prices: pricesOut(d),
      status: d.status,
      createdAt: createdAtStr(d.createdAt),
    };
  }));
}

async function coinGifts() {
  const docs = await Gift.find({}).sort({ createdAt: -1 }).lean();
  return docs.map(d => ({
    id: d.id, code: d.code, name: d.name, icon: d.icon || '🎁',
    costCoins: Number(d.costCoins) || 0, color: d.color || '',
    desc: d.desc || '', status: d.status,
    createdAt: createdAtStr(d.createdAt),
  }));
}

async function coinEarn() {
  const docs = await EarnReward.find({}).sort({ createdAt: -1 }).lean();
  return docs.map(d => {
    const m = metaOut(d);
    return Object.assign({
      id: d.id, code: d.code, action: d.action, type: d.type,
      coins: Number(d.coins) || 0, cooldown: d.cooldown || '',
      pagesRequired: Number(d.pagesRequired) || 0,
      icon: m.icon || 'fa-coins',
      available: m.available !== undefined ? !!m.available : d.status === 'active',
      status: d.status,
      createdAt: createdAtStr(d.createdAt),
    },
      // blog/youtube extras the reward editor round-trips
      m.blogCategory !== undefined ? { blogCategory: m.blogCategory, blogUrl: m.blogUrl } : {},
      m.channelId !== undefined ? { channelId: m.channelId, channelUrl: m.channelUrl } : {},
      m.videoId !== undefined ? { videoId: m.videoId, minWatchSec: m.minWatchSec } : {},
      m.adUrl !== undefined ? { adUrl: m.adUrl } : {});
  });
}

async function coinSubscriptions() {
  const docs = await SubscriptionPlan.find({}).sort({ createdAt: -1 }).lean();
  return Promise.all(docs.map(async d => ({
    id: d.id, code: d.code, name: d.name, period: d.period,
    priceUsd: await priceUsdOf(d),
    durationDays: Number(d.durationDays) || 0,
    coinsPerDay: Number(d.coinsPerDay) || 0,
    bonusPercent: Number(d.bonusPercent) || 0,
    prices: pricesOut(d),
    features: d.features || [], badge: d.badge || '',
    status: d.status,
    createdAt: createdAtStr(d.createdAt),
  })));
}

async function coinConfigHistory() {
  const docs = await StoreConfigLog.find({}).sort({ at: -1 }).limit(200).lean();
  return docs.map(d => ({
    id: d.id, action: d.action, itemType: d.itemType, itemName: d.itemName,
    actor: d.actor || 'Finance', details: d.details || '',
    date: new Date(d.at || Date.now()).toISOString(),
  }));
}
// Generic upsert keyed on the console's `id`; creates need a `code` because
// models key uniqueness on it (matches store.service conventions).
function makeCrud(Model, fields, requiredCode) {
  return {
    async create(body) {
      const data = pickFields(body, fields);
      if (!data.code) data.code = requiredCode + '-' + Date.now().toString(36).toUpperCase().slice(-8);
      const dupe = await Model.findOne({ code: data.code }).select('_id').lean();
      if (dupe) bad('code_taken', 409);
      const doc = await Model.create(data);
      return doc.toJSON();
    },
    async update(id, body) {
      const doc = await Model.findOne({ id: String(id) });
      if (!doc) bad('not_found', 404);
      Object.assign(doc, pickFields(body, fields));
      await doc.save();
      return doc.toJSON();
    },
    async patchStatus(id, status) {
      const doc = await Model.findOne({ id: String(id) });
      if (!doc) bad('not_found', 404);
      if (status !== undefined) doc.status = status;
      await doc.save();
      return doc.toJSON();
    },
    async remove(id) {
      const doc = await Model.findOne({ id: String(id) });
      if (!doc) bad('not_found', 404);
      await doc.deleteOne();
      return { ok: true, id: String(id) };
    },
  };
}
function pickFields(body, fields) {
  const out = {};
  fields.forEach(k => { if (body && body[k] !== undefined) out[k] = body[k]; });
  return out;
}

const PACK_FIELDS = ['code', 'coins', 'bonusPct', 'basePriceNGN', 'prices', 'status', 'meta'];
const BUNDLE_FIELDS = ['code', 'name', 'coins', 'bonus', 'basePriceNGN', 'prices', 'icon', 'color', 'status', 'meta'];
const GIFT_FIELDS = ['code', 'name', 'icon', 'costCoins', 'color', 'desc', 'status'];
const EARN_FIELDS = ['code', 'action', 'type', 'coins', 'cooldown', 'pagesRequired', 'status', 'meta'];
const SUB_FIELDS = ['code', 'name', 'period', 'durationDays', 'basePriceNGN', 'prices', 'features', 'badge',
  'coinsPerDay', 'bonusPercent', 'status'];

const packCrud = makeCrud(CoinPack, PACK_FIELDS, 'PACK');
const bundleCrud = makeCrud(CoinBundle, BUNDLE_FIELDS, 'BND');
const giftCrud = makeCrud(Gift, GIFT_FIELDS, 'GIFT');
const earnCrud = makeCrud(EarnReward, EARN_FIELDS, 'AD');
const subCrud = makeCrud(SubscriptionPlan, SUB_FIELDS, 'SUB');

// The console posts its own field names (priceUsd/bonusPercent/name/price);
// saveConfig maps them onto the catalog schema on write.
async function saveConfig(kind, body, userId) {
  const crud = kind === 'package' ? packCrud : kind === 'bundle' ? bundleCrud
    : kind === 'gift' ? giftCrud : kind === 'earn' ? earnCrud : subCrud;
  const b = Object.assign({}, body);
  const rate = await ngnPerUsd();
  if (b.priceUsd !== undefined && b.basePriceNGN === undefined) {
    b.basePriceNGN = Math.round((Number(b.priceUsd) || 0) * rate);
  }
  if (b.price !== undefined && b.basePriceNGN === undefined) {
    b.basePriceNGN = Math.round(legNum(b.price) * rate);
  }
  if (b.bonusPercent !== undefined && b.bonusPct === undefined) b.bonusPct = b.bonusPercent;
  if (kind === 'earn') {
    // The reward editor posts icon/available/blog/channel/video extras at the
    // top level; the schema keeps them in meta (same folding store.service does).
    const extras = ['icon', 'available', 'blogCategory', 'blogUrl',
      'channelId', 'channelUrl', 'videoId', 'minWatchSec', 'adUrl'];
    const meta = Object.assign({}, b.meta && typeof b.meta === 'object' ? b.meta : {});
    extras.forEach(k => { if (b[k] !== undefined) meta[k] = b[k]; });
    if (Object.keys(meta).length) b.meta = meta;
  }
  if (b.name !== undefined && (kind === 'package')) {
    b.meta = Object.assign({}, b.meta && typeof b.meta === 'object' ? b.meta : {}, { name: b.name });
  }
  const doc = b.id ? await crud.update(b.id, b) : await crud.create(b);
  // History rows come from the console itself (POST /coin-config-history);
  // logging here too would duplicate every entry.
  return doc;
}

async function updateConfigStatus(kind, id, status, userId) {
  const crud = kind === 'package' ? packCrud : kind === 'bundle' ? bundleCrud
    : kind === 'gift' ? giftCrud : kind === 'earn' ? earnCrud : subCrud;
  const doc = await crud.patchStatus(id, status);
  return doc;
}

async function removeConfig(kind, id, userId) {
  const crud = kind === 'package' ? packCrud : kind === 'bundle' ? bundleCrud
    : kind === 'gift' ? giftCrud : kind === 'earn' ? earnCrud : subCrud;
  const out = await crud.remove(id);
  return out;
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/dashboard
 * finance-data.js:222; dashboard-service.js:57-163.
 * ───────────────────────────────────────────────────────────── */
const FIN_ACT = {
  payout: { icon: 'fa-money-check-dollar', color: 'green' },
  create: { icon: 'fa-circle-plus', color: 'blue' },
  update: { icon: 'fa-pen', color: 'purple' },
  delete: { icon: 'fa-trash', color: 'red' },
  login: { icon: 'fa-right-to-bracket', color: 'amber' },
  review: { icon: 'fa-scale-balanced', color: 'accent' },
};

async function dashboard() {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  const [pendingWd, allDisp, walletAgg, purchasedToday, coinsSpentToday,
    monthVolume, activity] = await Promise.all([
      Withdrawal.find({ status: { $in: ['requested', 'under_review', 'approved'] } }).lean(),
      PaymentDispute.find({}).sort({ createdAt: -1 }).limit(50).lean(),
      Wallet.aggregate([{ $group: { _id: null, coins: { $sum: '$coinBalance' } } }]),
      CoinTransaction.aggregate([
        { $match: { createdAt: { $gte: dayStart }, status: 'completed', type: 'purchase' } },
        { $group: { _id: null, amount: { $sum: '$fiatAmount' }, n: { $sum: 1 } } },
      ]),
      LedgerAggregate(),
      CoinTransaction.aggregate([
        { $match: { createdAt: { $gte: monthStart }, status: 'completed' } },
        { $group: { _id: null, amount: { $sum: '$fiatAmount' } } },
      ]),
      ActivityLog.find({}).sort({ at: -1 }).limit(20).lean(),
    ]);

  const pendingTotal = pendingWd.reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const umap = await usersById(pendingWd.map(w => w.authorId));
  const dispUm = await usersById(allDisp.map(d => d.authorId));

  const pendingPayouts = pendingWd.slice(0, 8).map(w => ({
    id: w.id,
    author: nameOf(umap, w.authorId),
    avatar: avatarOf(umap, w.authorId),
    amount: money(w.amount),
    method: w.method,
    requested: rel(w.requestedAt || w.createdAt),
  }));

  const openCount = allDisp.filter(d => d.status === 'open' || d.status === 'investigating');
  const urgent = openCount.filter(d => (Date.now() - new Date(d.createdAt).getTime()) > 48 * 3600e3).length;
  const resolvedThisWeek = allDisp.filter(d =>
    ['resolved', 'rejected'].includes(d.status) && new Date(d.updatedAt) >= weekAgo).length;
  const avgDays = (() => {
    const done = allDisp.filter(d => ['resolved', 'rejected'].includes(d.status));
    if (!done.length) return 0;
    const sum = done.reduce((s, d) => s + Math.max(0, (new Date(d.updatedAt) - new Date(d.createdAt)) / 864e5), 0);
    return Number((sum / done.length).toFixed(1));
  })();

  const purchased = purchasedToday[0] || { amount: 0, n: 0 };
  const circulation = walletAgg[0] ? walletAgg[0].coins : 0;

  const quickActions = [
    { label: 'Review Withdrawals', icon: 'fa-building-columns', cls: 'blue', count: pendingWd.length, href: 'withdrawals.html' },
    { label: 'Process Author Payments', icon: 'fa-money-check-dollar', cls: 'accent', count: 0, href: 'author-payments.html' },
    { label: 'Resolve Payment Disputes', icon: 'fa-scale-balanced', cls: 'red', count: openCount.length, href: 'payment-disputes.html' },
    { label: 'Generate Financial Report', icon: 'fa-chart-pie', cls: 'purple', count: 0, href: 'financial-reports.html' },
  ];

  const recentActivity = activity.map(a => {
    const style = FIN_ACT[a.type] || { icon: 'fa-circle-info', color: 'accent' };
    return {
      icon: style.icon, color: style.color,
      text: bold(a.userLabel || 'Platform') + (a.detail ? ' ' + esc(a.detail) : ''),
      time: rel(a.at),
    };
  });

  return {
    pendingPayoutsCount: pendingWd.length,
    pendingPayoutsTotal: money(pendingTotal),
    totalVolumeMonth: money(monthVolume[0] ? monthVolume[0].amount : 0),
    coinBalance: compact(circulation),
    openDisputes: openCount.length,
    quickActions,
    pendingPayouts,
    coinSnapshot: {
      purchasedToday: money(purchased.amount),
      coinsInCirculation: compact(circulation),
      redeemedToday: compact(coinsSpentToday),
      avgPurchase: usd(purchased.n > 0 ? purchased.amount / purchased.n : 0),
    },
    disputesSnapshot: {
      open: openCount.length, urgent, avgResolutionDays: avgDays, resolvedThisWeek,
    },
    recentActivity,
  };
}

// "Redeemed" = coins spent against the ledger today (real movement, not a guess).
async function LedgerAggregate() {
  try {
    const { LedgerEntry } = require('../models/money.model');
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const row = await LedgerEntry.aggregate([
      { $match: { createdAt: { $gte: dayStart }, kind: 'spend' } },
      { $group: { _id: null, coins: { $sum: '$coins' } } },
    ]);
    return row[0] ? row[0].coins : 0;
  } catch (e) { return 0; }
}

module.exports = {
  dashboard,
  withdrawals, approveWithdrawal, declineWithdrawal,
  authorPayments, paymentHistory, schedulePayout, processPayment,
  paymentDisputes, resolveDispute, rejectDispute, replyDispute,
  coinTransactions,
  coinPackages, coinBundles, coinGifts, coinEarn, coinSubscriptions, coinConfigHistory,
  saveConfig, updateConfigStatus, removeConfig,
};
