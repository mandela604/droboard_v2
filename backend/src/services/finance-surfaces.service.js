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
  PaymentDispute, StoreConfigLog, LedgerEntry, Entitlement,
} = require('../models/money.model');
const { User } = require('../models/user.model');
const { ActivityLog } = require('../models/platform.model');
const { CoinRate, AdRevenueLedger } = require('../models/revenue.model');
const { EditorPayout } = require('../models/editor-earnings.model');
const editorPay = require('./editor-earnings.service');
const ledger = require('./ledger.service');
const txn = require('./txn');
const { userRefFilter } = require('./user-ref');

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
  // Money docs reference the stored uuidv7 `id`; only legacy rows carry a 24-hex
  // `_id`. A uuidv7 handed to an `_id` filter throws a CastError and the
  // `.catch(() => [])` below turns that into an empty map — which is how payout
  // rows used to print the owner's raw id instead of their name.
  const rows = await User.find(userRefFilter(uniq))
    .select('id fullName username avatar status email').lean().catch(() => []);
  const m = {};
  rows.forEach(u => {
    const v = {
      name: u.fullName || u.username || String(u._id),
      avatar: u.avatar || '',
      status: u.status || 'active',
      email: u.email || '',
    };
    const keys = [String(u._id), u.id ? String(u.id) : ''];
    keys.filter(Boolean).forEach(k => { m[k] = v; });
  });
  return m;
}
function nameOf(m, id) { const u = m[String(id)]; return u ? u.name : String(id || ''); }
function avatarOf(m, id) { const u = m[String(id)]; return (u && u.avatar) || 'https://i.pravatar.cc/60?img=12'; }

// NGN -> USD for console columns that show USD, the FX table for anything
// priced in another currency, and the coin face value for coin-denominated
// revenue. Source: the single CoinRate doc (editable in Super Admin).
// 1500 / 15 are the documented fallbacks matching the seed catalog.
let _fx = null;
async function fxTable() {
  if (_fx) return _fx;
  let doc = null;
  try { doc = await CoinRate.findOne({ key: 'live' }).lean(); } catch (e) { /* no rate doc yet */ }
  const fx = (doc && doc.fx) || {};
  const usd = Number(fx.USD != null ? fx.USD : fx.usd);
  _fx = {
    fx,
    usd: usd > 0 ? usd : 1500,
    coinFaceNGN: Number(doc && doc.coinFaceNGN) > 0 ? Number(doc.coinFaceNGN) : 15,
  };
  return _fx;
}
// NGN per one unit of `cur`. An unlisted currency is priced like USD rather
// than dropped, so a new channel's money still reaches the report.
function rateOf(t, cur) {
  const c = String(cur || 'NGN').toUpperCase();
  if (c === 'NGN') return 1;
  const v = Number(t.fx[c]);
  return v > 0 ? v : t.usd;
}
async function ngnPerUsd() { return (await fxTable()).usd; }
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
 * Senior editors withdraw through the same queue: their rows come from
 * EditorPayout and are addressed with an 'ep:' prefix so the one set of
 * approve/decline/pay routes settles both kinds.
 * ───────────────────────────────────────────────────────────── */
const EP_PREFIX = 'ep:';
const isEpId = (id) => String(id).startsWith(EP_PREFIX);
const epRawId = (id) => String(id).slice(EP_PREFIX.length);

function wdStatus(s) {
  if (s === 'approved' || s === 'paid') return 'approved';
  if (s === 'declined' || s === 'failed') return 'declined';
  return 'pending';
}

// The approve modal shows where the money goes, so the staff read of the queue
// carries the payee's own payment method: the exact one the withdrawal was
// requested with, else that person's default. accountNumber is select:false in
// the schema, so it only arrives through this explicit reveal — every
// author-facing list still hides it (see finance.controller's method routes).
async function payeesOf(rows) {
  if (!rows.length) return [];
  const methodIds = rows.map(r => String(r.paymentMethodId || r.methodId || '')).filter(Boolean);
  const owners = rows.map(r => String(r.authorId || r.editorId || '')).filter(Boolean);
  const or = [];
  if (methodIds.length) or.push({ id: { $in: methodIds } });
  if (owners.length) or.push({ authorId: { $in: owners }, isDefault: true });
  const docs = or.length
    ? await PaymentMethod.find({ $or: or }).select('+accountNumber').lean().catch(() => [])
    : [];
  const byMethod = {};
  const defaultByOwner = {};
  docs.forEach(m => {
    byMethod[String(m.id)] = m;
    const owner = String(m.authorId);
    if (m.isDefault && !defaultByOwner[owner]) defaultByOwner[owner] = m;
  });
  return rows.map(r => byMethod[String(r.paymentMethodId || r.methodId || '')]
    || defaultByOwner[String(r.authorId || r.editorId || '')] || null);
}

function payeeFields(m) {
  if (!m) return {};
  return {
    accountName: m.accountName || '',
    bankName: m.bankName || '',
    accountNumber: m.accountNumber || '',
    routingCode: m.routingCode || '',
    email: m.email || '',
    provider: m.provider || '',
    phoneNumber: m.phoneNumber || '',
    payeeVerified: !!m.verified,
  };
}

function withdrawalShape(w, umap, payee) {
  return Object.assign({
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
  }, payeeFields(payee));
}

function editorPayoutShape(p, umap, payee) {
  return Object.assign({
    id: EP_PREFIX + p.id,
    author: nameOf(umap, p.editorId),
    avatar: avatarOf(umap, p.editorId),
    amount: Number(p.amount) || 0,
    method: p.method || 'Bank Transfer',
    account: p.account || '',
    requested: new Date(p.createdAt || Date.now()).toISOString(),
    status: wdStatus(p.status),
    note: p.note || p.declineReason || '',
    processed: p.paidAt ? new Date(p.paidAt).toISOString() : undefined,
  }, payeeFields(payee));
}

async function shapedWithdrawals(docs, eps, umap) {
  const [a, b] = [await payeesOf(docs), await payeesOf(eps)];
  return docs.map((w, i) => withdrawalShape(w, umap, a[i]))
    .concat(eps.map((p, i) => editorPayoutShape(p, umap, b[i])))
    .sort((x, y) => new Date(y.requested) - new Date(x.requested));
}

async function withdrawals() {
  const [docs, eps] = await Promise.all([
    Withdrawal.find({}).sort({ requestedAt: -1 }).limit(200).lean(),
    EditorPayout.find({}).sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  const umap = await usersById(docs.map(w => w.authorId).concat(eps.map(p => p.editorId)));
  return shapedWithdrawals(docs, eps, umap);
}

async function loadWithdrawalOr404(id) {
  const doc = await Withdrawal.findOne({ id: String(id) });
  if (!doc) bad('not_found', 404);
  return doc;
}

// A single-row echo after an action: the console re-reads the queue anyway, but
// the response must not lose the payee block the row was rendered with.
async function echoAuthorRow(doc) {
  const umap = await usersById([doc.authorId]);
  const plain = doc.toObject ? doc.toObject() : doc;
  const [payee] = await payeesOf([plain]);
  return withdrawalShape(plain, umap, payee);
}

async function echoEditorPayoutRow(rawId) {
  const row = await EditorPayout.findOne({ id: String(rawId) }).lean();
  if (!row) bad('not_found', 404);
  const umap = await usersById([row.editorId]);
  const [payee] = await payeesOf([row]);
  return editorPayoutShape(row, umap, payee);
}

// The editor flow splits the steps the console merges: approvePayout only
// marks the row, payPayout posts liability:editor -> bank:editor-payouts under
// a payout idempotency key. Running both makes "approve and mark as processed"
// actually move the money, and a retry after a crash cannot pay twice.
async function settleEditorPayout(rawId, userId, reference) {
  const row = await EditorPayout.findOne({ id: String(rawId) });
  if (!row) bad('not_found', 404);
  if (row.status === 'requested') await editorPay.approvePayout(row.id, userId);
  if (row.status !== 'paid') await editorPay.payPayout(row.id, { reference }, userId);
  return echoEditorPayoutRow(row.id);
}

// The console has one button per row ("approve the withdrawal and mark it as
// processed"), so approval IS the settlement: it moves the money and lands the
// payout row in the same step. Anything still parked at `approved` (an older
// row, or a flow that approves first) is settled by payWithdrawal.
async function approveWithdrawal(id, userId) {
  if (isEpId(id)) return settleEditorPayout(epRawId(id), userId);
  const doc = await loadWithdrawalOr404(id);
  if (!['requested', 'under_review'].includes(doc.status)) bad('not_approvable', 409);
  await settleWithdrawal(doc, userId);
  return echoAuthorRow(doc);
}

async function payWithdrawal(id, reference, userId) {
  if (isEpId(id)) {
    const raw = epRawId(id);
    const row = await EditorPayout.findOne({ id: String(raw) }).lean();
    if (!row) bad('not_found', 404);
    if (row.status === 'paid') return echoEditorPayoutRow(raw);
    return settleEditorPayout(raw, userId, reference);
  }
  const doc = await loadWithdrawalOr404(id);
  if (doc.status === 'paid') return echoAuthorRow(doc); // already settled: echo, no second payment
  if (doc.status !== 'approved') bad('not_payable', 409);
  await settleWithdrawal(doc, userId, reference);
  return echoAuthorRow(doc);
}

// The author's cash, derived from the journal rather than trusted from the
// cached Wallet.fiatAvail (money.model's own rule: balances come from the
// ledger). Both credit shapes count: the author-scoped leg and the anonymous
// `wallet:author` leg the unlock waterfall wrote before that leg carried the
// author id — those rows still stamp authorId, so they remain attributable.
async function authorCashOn(authorId, session) {
  const id = String(authorId);
  const scoped = 'wallet:author:' + id;
  const rows = await LedgerEntry.aggregate([
    {
      $match: {
        $or: [
          { creditAcct: scoped }, { debitAcct: scoped },
          { creditAcct: 'wallet:author', authorId: id },
        ],
      },
    },
    {
      $group: {
        _id: null,
        in: { $sum: { $cond: [{ $eq: ['$creditAcct', scoped] }, '$amount', 0] } },
        legacy: { $sum: { $cond: [{ $eq: ['$creditAcct', 'wallet:author'] }, '$amount', 0] } },
        out: { $sum: { $cond: [{ $eq: ['$debitAcct', scoped] }, '$amount', 0] } },
      },
    },
  ], txn.withSession(session));
  const r = rows[0] || { in: 0, legacy: 0, out: 0 };
  return Math.max(0, r2(r.in + r.legacy - r.out));
}

// Money leaves the platform only through the journal: the idempotency key is
// taken from the withdrawal id, so a double click or a retry after a crash
// settles the row once. Everything after the gate is the paperwork for that one
// payment — payout row, author debit, cached balance, status.
// What this one withdrawal already took out of the author's cash. A retry after
// a crash between the journal write and doc.save() finds the money gone; read
// without this and the guard would refuse to finish paying a row the ledger
// says is paid, leaving it stuck in the queue forever.
async function prepaidOn(authorId, withdrawalId, session) {
  const rows = await LedgerEntry.aggregate([
    {
      $match: {
        authorId: String(authorId), kind: 'payout', saleId: String(withdrawalId),
        debitAcct: 'wallet:author:' + String(authorId),
      },
    },
    { $group: { _id: null, t: { $sum: '$amount' } } },
  ], txn.withSession(session));
  return Number(rows[0] && rows[0].t) || 0;
}

async function settleWithdrawal(doc, userId, reference) {
  const amount = Number(doc.amount) || 0;
  if (amount <= 0) bad('bad_amount', 400);
  const authorId = String(doc.authorId);
  await txn.run(async (session) => {
    const [cash, prepaid, openOther] = await Promise.all([
      authorCashOn(authorId, session),
      prepaidOn(authorId, doc.id, session),
      Withdrawal.aggregate([
        { $match: { authorId, status: { $in: ['requested', 'under_review', 'approved'] }, _id: { $ne: doc._id } } },
        { $group: { _id: null, t: { $sum: '$amount' } } },
      ], txn.withSession(session)),
    ]);
    const committed = Number(openOther[0] && openOther[0].t) || 0;
    // Pay only what the journal says the author holds, after the rest of the
    // queue has reserved its share; beyond that an approve would be uncovered.
    if (cash + prepaid - committed < amount) bad('insufficient_funds', 409);

    const posted = await ledger.post({
      legs: [{ debit: 'wallet:author:' + authorId, credit: 'bank:author-payouts', amount }],
      authorId, kind: 'payout', saleId: doc.id,
      memo: 'withdrawal ' + doc.id + ' via ' + doc.method,
      idempotencyKey: 'withdrawal_payout:' + doc.id, session,
    });
    if (!posted.duplicate) {
      await Payout.create([{
        authorId, recipient: doc.account || authorId, amount, method: doc.method,
        status: 'completed', reference: String(reference || '').slice(0, 120) || ('WPY-' + doc.id),
        paidAt: new Date(),
      }], txn.withSession(session));
      await AuthorTransaction.create([{
        authorId, type: 'withdrawal', desc: 'Withdrawal paid — ' + doc.method,
        amount: -amount, status: 'completed',
      }], txn.withSession(session));
    }
    // Cache re-read from the journal, never decremented by hand: a wallet whose
    // fiatAvail drifted (pre-fix earnings, or a payout with no journal) is
    // repaired on the first settle instead of staying wrong forever.
    await Wallet.updateOne({ userId: authorId, kind: 'author' },
      { $set: { fiatAvail: await authorCashOn(authorId, session) } },
      txn.withSession(session, { upsert: true }));
    doc.status = 'paid';
    doc.reviewedBy = String(userId || '');
    doc.processedAt = new Date();
    await doc.save({ session });
  });
}

// decline: carries the operator reason the console shows in the row note.
async function declineWithdrawal(id, reason, userId) {
  if (isEpId(id)) {
    const raw = epRawId(id);
    const row = await EditorPayout.findOne({ id: String(raw) });
    if (!row) bad('not_found', 404);
    if (row.status === 'paid') bad('already_paid', 409);
    if (row.status === 'declined') return echoEditorPayoutRow(raw);
    await editorPay.declinePayout(raw, reason ? String(reason).slice(0, 1000) : 'Declined by Finance.', userId);
    return echoEditorPayoutRow(raw);
  }
  const doc = await loadWithdrawalOr404(id);
  if (!['requested', 'under_review'].includes(doc.status)) bad('not_declinable', 409);
  doc.status = 'declined';
  doc.note = reason ? String(reason).slice(0, 1000) : 'Declined by Finance.';
  doc.reviewedBy = String(userId);
  doc.processedAt = new Date();
  await doc.save();
  return echoAuthorRow(doc);
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

// processPayment: settles every open withdrawal for the author. finance-data.js:269.
// It used to flip the rows to paid and write a Payout with no journal behind it,
// which is exactly what the derived author balance cannot survive (money out the
// door, ledger still says it is there). Every row now goes through the same gate
// Approve uses; a row the ledger cannot cover simply stays in the queue.
async function processPayment(authorId, userId) {
  const id = String(authorId);
  const open = await Withdrawal.find({ authorId: id, status: { $in: ['requested', 'under_review', 'approved'] } })
    .sort({ requestedAt: 1 });
  for (const w of open) {
    try {
      await settleWithdrawal(w, userId);
    } catch (e) {
      if (e.message === 'insufficient_funds') continue;
      throw e;
    }
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
// One mapper for both the queue and the post-action echo. A row can come from
// an author (authorId) or a reader (userId) — the finance page shows whichever
// filed it, using the stored display name when the account lookup misses.
function disputeShape(d, umap) {
  const filerId = d.authorId || d.userId || '';
  return {
    // The console addresses resolve/reject/reply by this key, so it must be the
    // stored public id (lean docs have no virtual).
    id: String(d.id || d._id || ''),
    author: nameOf(umap, filerId) || d.who || 'Reader',
    avatar: avatarOf(umap, filerId) || d.avatar || '',
    role: d.role || (d.authorId ? 'author' : 'reader'),
    item: d.item || '',
    txnId: d.transactionId || '',
    amount: Number(d.amount) || 0,
    reason: d.reason,
    status: d.status,
    filed: new Date(d.createdAt || Date.now()).toISOString(),
    resolutionNote: d.resolutionNote || '',
    replies: (d.replies || []).map(r => ({
      from: nameOf(umap, r.from), message: r.message, time: new Date(r.at || Date.now()).toISOString(),
    })),
  };
}

async function paymentDisputes() {
  const docs = await PaymentDispute.find({}).sort({ createdAt: -1 }).limit(200).lean();
  const ids = docs.map(d => d.authorId || d.userId).concat(docs.flatMap(d => (d.replies || []).map(r => r.from)));
  const umap = await usersById(ids);
  return docs.map(d => disputeShape(d, umap));
}

async function loadDisputeOr404(id) {
  // Public id first; a raw {id:'PD-401'}-style value that is neither would
  // otherwise throw a cast error (500) on the _id fallback, so check it.
  const s = String(id);
  const doc = await PaymentDispute.findOne({ id: s })
    || (require('mongoose').Types.ObjectId.isValid(s) ? await PaymentDispute.findOne({ _id: s }) : null);
  if (!doc) bad('not_found', 404);
  return doc;
}
async function disputeOut(doc) {
  const umap = await usersById([doc.authorId || doc.userId].concat((doc.replies || []).map(r => r.from)));
  return disputeShape(doc, umap);
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
      id: d.code, code: d.code,
      name: m.name || d.code,
      coins: Number(d.coins) || 0,
      priceUsd: await priceUsdOf(d),
      bonusPercent: Number(d.bonusPct) || 0,
      status: d.status,
      prices: pricesOut(d),
      // Card chrome has no column on CoinPack — it rides in meta, which is
      // exactly what the reader catalog (store.service packOut) renders from.
      // The fallbacks match packOut so the console previews the real card.
      badge: m.badge || '', color: m.color || '#FF2D6A', icon: m.icon || 'fa-coins',
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
      id: d.code, code: d.code,
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
    id: d.code, code: d.code, name: d.name, icon: d.icon || '🎁',
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
      id: d.code, code: d.code, action: d.action, type: d.type,
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
    id: d.code, code: d.code, name: d.name, period: d.period,
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
    id: String(d.id || d._id || ''), action: d.action, itemType: d.itemType, itemName: d.itemName,
    actor: d.actor || 'Finance', details: d.details || '',
    date: new Date(d.at || Date.now()).toISOString(),
  }));
}
// Generic upsert keyed on the console's `id`; creates need a `code` because
// models key uniqueness on it (matches store.service conventions).
// Console rows are identified by their catalog code ('pack1', 'SUB-01'), not a
// Mongo id, so look up by code first and only fall back to _id when the value
// actually is one — otherwise every PUT/DELETE on the console 500s on a cast.
function byIdOrCode(Model, id) {
  const s = String(id);
  return Model.findOne({ code: s }).then(doc => doc
    || (require('mongoose').Types.ObjectId.isValid(s) ? Model.findOne({ _id: s }) : null));
}
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
      const doc = await byIdOrCode(Model, id);
      if (!doc) bad('not_found', 404);
      Object.assign(doc, pickFields(body, fields));
      await doc.save();
      return doc.toJSON();
    },
    async patchStatus(id, status) {
      const doc = await byIdOrCode(Model, id);
      if (!doc) bad('not_found', 404);
      if (status !== undefined) doc.status = status;
      await doc.save();
      return doc.toJSON();
    },
    async remove(id) {
      const doc = await byIdOrCode(Model, id);
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
  'icon', 'color', 'coinsPerDay', 'bonusPercent', 'status'];

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
  if (kind === 'subscription' && b.period) {
    // durationDays is required by the schema but the console only picks a
    // period; derive it so a plan's length can never disagree with its name.
    b.durationDays = b.durationDays || { day: 1, week: 7, month: 30, year: 365 }[b.period] || 30;
  }
  if (kind === 'earn') {
    // The reward editor posts icon/available/blog/channel/video extras at the
    // top level; the schema keeps them in meta (same folding store.service does).
    const extras = ['icon', 'available', 'blogCategory', 'blogUrl',
      'channelId', 'channelUrl', 'videoId', 'minWatchSec', 'adUrl'];
    const meta = Object.assign({}, b.meta && typeof b.meta === 'object' ? b.meta : {});
    extras.forEach(k => { if (b[k] !== undefined) meta[k] = b[k]; });
    if (Object.keys(meta).length) b.meta = meta;
    // Nothing half-configured is saved: an ad task with no https ad URL, a
    // YouTube row with no video id or a reward with no cooldown would all be
    // claimed for coins the reader never earned. Same rules the store serves by.
    let candidate = b;
    if (b.id) {
      const cur = await byIdOrCode(EarnReward, b.id);
      candidate = Object.assign({}, cur ? cur.toObject() : {}, b);
    }
    const errs = require('./earn-rules').validate(candidate);
    if (errs.length) { const e = new Error('reward_invalid'); e.status = 400; e.errors = errs; throw e; }
  }
  if (b.name !== undefined && (kind === 'package')) {
    b.meta = Object.assign({}, b.meta && typeof b.meta === 'object' ? b.meta : {}, { name: b.name });
  }
  if (kind === 'package' || kind === 'bundle') {
    // CoinPack has no chrome columns at all (and neither model has a badge
    // column); the store card chrome rides in meta so the console can set it
    // and catalog() can hand it back out.
    const extras = ['badge', 'period', 'features', 'icon', 'color'];
    const meta = Object.assign({}, b.meta && typeof b.meta === 'object' ? b.meta : {});
    extras.forEach(k => { if (b[k] !== undefined) meta[k] = b[k]; });
    if (Object.keys(meta).length) b.meta = meta;
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
    { label: 'Configure Store Catalog', icon: 'fa-coins', cls: 'accent', count: 0, href: 'coin-transactions.html' },
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
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const row = await LedgerEntry.aggregate([
      { $match: { createdAt: { $gte: dayStart }, kind: 'spend' } },
      { $group: { _id: null, coins: { $sum: '$coins' } } },
    ]);
    return row[0] ? row[0].coins : 0;
  } catch (e) { return 0; }
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/finance/financial-reports?from&to
 * finance-data.js:374 (getFinancialReports); rows consumed by
 * financial-reports-service.js:68-144, which recomputes the KPI cards, the
 * monthly chart, the expense breakdown and the category ranking from the
 * three daily arrays below. So the daily arrays are the contract.
 * Amounts are base currency (NGN), like every other money leg.
 *   revenue   = coin/subscription sales + settled ad revenue
 *   payouts   = author withdrawals actually paid out
 *   platformIncome = revenue − payouts (what the platform keeps of the money in)
 *   fees      = store/channel commission withheld at purchase
 *   bonuses   = author bonus credits
 *   marketing = money spent out of the marketing pool (ledger debits)
 *   categories = coin unlocks by book genre at coin face value
 * There is no source for infrastructure cost, so it reports 0 rather than a
 * made-up daily figure.
 * ───────────────────────────────────────────────────────────── */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYGROUP = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } };
function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function add(map, key, v) { map.set(key, (map.get(key) || 0) + (Number(v) || 0)); }

async function financialReports(q) {
  const today = new Date();
  const to = DAY_RE.test((q && q.to) || '') ? q.to : today.toISOString().slice(0, 10);
  const fromDefault = new Date(today.getTime() - 89 * 864e5).toISOString().slice(0, 10);
  const from = DAY_RE.test((q && q.from) || '') ? q.from : fromDefault;
  if (from > to) bad('bad_range', 400);
  const start = new Date(from + 'T00:00:00.000Z');
  const stop = new Date(new Date(to + 'T00:00:00.000Z').getTime() + 864e5); // exclusive
  if ((stop - start) > 400 * 864e5) bad('range_too_wide', 400);
  const span = { $gte: start, $lt: stop };

  const [fx, store, ads, payouts, bonuses, marketing, unlocks] = await Promise.all([
    fxTable(),
    CoinTransaction.aggregate([
      { $match: { status: 'completed', type: { $in: ['purchase', 'subscription'] }, createdAt: span } },
      { $group: { _id: { d: DAYGROUP, c: { $ifNull: [{ $toUpper: '$fiatCurrency' }, 'NGN'] } }, gross: { $sum: '$fiatAmount' }, fees: { $sum: '$feeAmount' } } },
    ]),
    AdRevenueLedger.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: '$date', rev: { $sum: '$revenue' } } },
    ]),
    Payout.aggregate([
      { $match: { status: 'completed', paidAt: span } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } }, t: { $sum: '$amount' } } },
    ]),
    AuthorTransaction.aggregate([
      { $match: { status: 'completed', type: 'bonus', amount: { $gt: 0 }, createdAt: span } },
      { $group: { _id: DAYGROUP, t: { $sum: '$amount' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { debitAcct: 'pool:marketing', createdAt: span } },
      { $group: { _id: DAYGROUP, t: { $sum: '$amount' } } },
    ]),
    Entitlement.aggregate([
      { $match: { kind: 'coin', unlockedAt: span } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$unlockedAt', timezone: 'UTC' } }, bookId: '$bookId' }, coins: { $sum: '$priceCoins' } } },
    ]),
  ]);

  const coinSales = new Map(), fees = new Map();
  store.forEach(r => {
    const rate = rateOf(fx, r._id.c);
    add(coinSales, r._id.d, r.gross * rate);
    add(fees, r._id.d, r.fees * rate);
  });
  const adRev = new Map();
  ads.forEach(r => { add(adRev, r._id, r.rev * fx.usd); }); // network rows are booked in USD
  const paid = new Map();
  payouts.forEach(r => { if (r._id) add(paid, r._id, r.t); });
  const bon = new Map();
  bonuses.forEach(r => { if (r._id) add(bon, r._id, r.t); });
  const mkt = new Map();
  marketing.forEach(r => { if (r._id) add(mkt, r._id, r.t); });

  // Genre names come from the catalog, not the unlock row, so resolve the books.
  const bookIds = Array.from(new Set(unlocks.map(u => String(u._id.bookId)).filter(Boolean)));
  const genreOf = {};
  if (bookIds.length) {
    const { Book } = require('../models/content.model');
    const books = await Book.find({ id: { $in: bookIds } }).select('id genre').lean().catch(() => []);
    books.forEach(b => { genreOf[String(b.id)] = b.genre || 'Unspecified'; });
  }
  const cats = [];
  const catByDay = new Map();
  unlocks.forEach(u => {
    const genre = genreOf[String(u._id.bookId)] || 'Unspecified';
    const revenue = u.coins * fx.coinFaceNGN;
    if (revenue <= 0) return;
    cats.push({ date: u._id.d, genre, revenue: r2(revenue) });
    add(catByDay, genre, revenue);
  });
  cats.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || b.revenue - a.revenue);

  const dayKeys = new Set();
  [coinSales, adRev, paid, fees, bon, mkt].forEach(m => m.forEach((v, k) => { if (v) dayKeys.add(k); }));
  const days = Array.from(dayKeys).sort();

  const dailyRevenue = days.map(d => {
    const cs = coinSales.get(d) || 0, ar = adRev.get(d) || 0, po = paid.get(d) || 0;
    const revenue = cs + ar;
    return { date: d, revenue: r2(revenue), payouts: r2(po), platformIncome: r2(revenue - po), coinSales: r2(cs) };
  });
  const dailyExpenses = days.map(d => ({
    date: d,
    authorPayouts: r2(paid.get(d) || 0),
    processingFees: r2(fees.get(d) || 0),
    bonuses: r2(bon.get(d) || 0),
    marketing: r2(mkt.get(d) || 0),
    infrastructure: 0,
  }));

  const monthAgg = new Map();
  dailyRevenue.forEach(r => {
    const label = MONTHS[Number(r.date.slice(5, 7)) - 1];
    add(monthAgg, r.date.slice(0, 7) + '|' + label, r.revenue);
  });
  const monthlyRevenue = Array.from(monthAgg.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => ({ month: k.split('|')[1], revenue: r2(v) }));

  const sum = (m) => Array.from(m.values()).reduce((s, v) => s + v, 0);
  const totalRevenue = sum(coinSales) + sum(adRev);
  const totalPayouts = sum(paid);
  const totalFees = sum(fees);
  const totalBonuses = sum(bon);
  const totalMarketing = sum(mkt);
  let growth = 0;
  if (monthlyRevenue.length >= 2) {
    const prev = monthlyRevenue[monthlyRevenue.length - 2].revenue;
    const last = monthlyRevenue[monthlyRevenue.length - 1].revenue;
    if (prev > 0) growth = ((last - prev) / prev) * 100;
  }

  return {
    range: { from, to },
    currency: 'NGN',
    generatedAt: new Date().toISOString(),
    summary: {
      totalRevenue: r2(totalRevenue),
      totalPayouts: r2(totalPayouts),
      platformIncome: r2(totalRevenue - totalPayouts),
      coinSalesRevenue: r2(sum(coinSales)),
      growthVsLastMonth: Math.round(growth * 10) / 10,
    },
    monthlyRevenue,
    dailyRevenue,
    dailyExpenses,
    dailyCategoryRevenue: cats,
    expenseBreakdown: [
      { label: 'Author Payouts', amount: r2(totalPayouts), color: 'accent' },
      { label: 'Payment Processing Fees', amount: r2(totalFees), color: 'blue' },
      { label: 'Bonuses & Incentives', amount: r2(totalBonuses), color: 'purple' },
      { label: 'Marketing Spend', amount: r2(totalMarketing), color: 'amber' },
      { label: 'Infrastructure', amount: 0, color: 'green' },
    ],
    topCategories: Array.from(catByDay.entries())
      .map(([genre, revenue]) => ({ genre, revenue: r2(revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

module.exports = {
  dashboard,
  withdrawals, approveWithdrawal, declineWithdrawal, payWithdrawal, authorCashOn,
  authorPayments, paymentHistory, schedulePayout, processPayment,
  paymentDisputes, resolveDispute, rejectDispute, replyDispute,
  coinTransactions, financialReports,
  coinPackages, coinBundles, coinGifts, coinEarn, coinSubscriptions, coinConfigHistory,
  saveConfig, updateConfigStatus, removeConfig,
};
