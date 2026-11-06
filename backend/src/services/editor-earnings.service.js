'use strict';
/**
 * services/editor-earnings.service.js — how senior editors get paid.
 *
 * Schemes, one ledger:
 *  - revenue_share: a % (default 10) of every sale credit an assigned author
 *    receives, funded by pool:editors (the waterfall's editorsPct bucket).
 *  - tip_share: a smaller % (default 5) of the author's TIP credit, funded by
 *    pool:platform — tips never feed the editors bucket.
 *  - fixed_monthly: a flat bill per period, funded by pool:editors.
 *  - hybrid: revenue_share + fixed_monthly. Tip share follows revenue-share
 *    editors only; a fixed-only editor gets no variable tip pay.
 *
 * Accrual credits liability:editor:<id>; an approved withdrawal debits it.
 * The ledger, not a counter, is the balance authority.
 *
 * Money movement is finance: editors request a withdrawal like authors do,
 * finance approves and pays. The chief editor never sees per-editor variable
 * earnings — only the program settings and fixed salaries, which it sets.
 */
const { EditorEarning, EditorPayout } = require('../models/editor-earnings.model');
const { EditorAssignment } = require('../models/chief.model');
const { PlatformSetting } = require('../models/platform.model');
const { PoolBalance } = require('../models/revenue.model');
const { PaymentMethod } = require('../models/money.model');
const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const ledger = require('./ledger.service');
const txn = require('./txn');
const ids = require('../models/ids');

const SETTING_KEY = 'editor_pay';
const MODES = ['revenue_share', 'fixed_monthly', 'hybrid'];
const DEFAULTS = {
  enabled: true, mode: 'revenue_share', revenueSharePct: 10, tipSharePct: 5,
  fixedMonthlyAmount: 0, minWithdrawal: 100, currency: 'NGN', payoutDay: 1,
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const periodOf = (d) => new Date(d || Date.now()).toISOString().slice(0, 7);
const err = (code, status) => Object.assign(new Error(code), { status });

function pg(query) {
  const page = Math.max(1, parseInt((query || {}).page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt((query || {}).limit, 10) || 20));
  return { page, limit };
}

/* ── Pay settings (chief editor) ───────────────────────────────────── */

function cleanSettings(raw) {
  const o = Object.assign({}, DEFAULTS, raw || {});
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    enabled: o.enabled !== false,
    mode: MODES.includes(o.mode) ? o.mode : DEFAULTS.mode,
    revenueSharePct: Math.min(100, Math.max(0, n(o.revenueSharePct, DEFAULTS.revenueSharePct))),
    tipSharePct: Math.min(100, Math.max(0, n(o.tipSharePct, DEFAULTS.tipSharePct))),
    fixedMonthlyAmount: Math.max(0, n(o.fixedMonthlyAmount, DEFAULTS.fixedMonthlyAmount)),
    minWithdrawal: Math.max(0, n(o.minWithdrawal, DEFAULTS.minWithdrawal)),
    currency: String(o.currency || DEFAULTS.currency).toUpperCase().slice(0, 3),
    payoutDay: Math.min(28, Math.max(1, parseInt(o.payoutDay, 10) || DEFAULTS.payoutDay)),
  };
}

async function settings() {
  const row = await PlatformSetting.findOne({ key: SETTING_KEY }).lean();
  return cleanSettings(row && row.value);
}

async function saveSettings(patch, by) {
  const current = await settings();
  const next = cleanSettings(Object.assign({}, current, patch || {}));
  await PlatformSetting.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set: { value: next, updatedBy: by || null } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return next;
}

/* ── Terms resolution ──────────────────────────────────────────────── */

// quota.paymentType is free text written by the chief console ("Monthly",
// "Revenue Share", "Both"…). Map it onto the three modes; blank = use global.
function modeOf(raw) {
  const s = String(raw || '').toLowerCase();
  if (!s) return '';
  if (s.includes('hybrid') || s.includes('both')) return 'hybrid';
  if (s.includes('fixed') || s.includes('monthly') || s.includes('salary')) return 'fixed_monthly';
  if (s.includes('revenue') || s.includes('share') || s.includes('commission') || s.includes('royalt')) return 'revenue_share';
  return '';
}

// Per-editor terms win over the global program, field by field.
function termsFor(quota, cfg) {
  const q = quota || {};
  const mode = modeOf(q.paymentType) || (MODES.includes(cfg.mode) ? cfg.mode : DEFAULTS.mode);
  const qr = Number(q.revenueShare);
  const qm = Number(q.monthlyPay);
  return {
    mode,
    rate: Math.min(100, Math.max(0, qr > 0 ? qr : Number(cfg.revenueSharePct) || 0)),
    monthlyAmount: Math.max(0, qm > 0 ? qm : Number(cfg.fixedMonthlyAmount) || 0),
  };
}

function sharesRevenue(mode) { return mode === 'revenue_share' || mode === 'hybrid'; }
function paysFixed(mode) { return mode === 'fixed_monthly' || mode === 'hybrid'; }

/* ── Accrual ───────────────────────────────────────────────────────── */

async function bumpPool(pool, delta, session) {
  await PoolBalance.updateOne(
    { pool },
    { $inc: { balance: delta }, $set: { recomputedAt: new Date() } },
    txn.withSession(session, { upsert: true }),
  );
}

// Insert + fund one accrual. The unique (editor, sourceType, sourceId) index is
// the gate: a duplicate returns null and posts nothing. If the ledger leg fails
// the row is removed again, so the idempotency key stays usable on retry.
async function insertEarning(data, session) {
  // Inside a transaction a duplicate-key error aborts the whole session, so
  // check first; the unique index remains the guard for concurrent writers.
  if (session) {
    const prev = await EditorEarning.findOne({
      editorId: data.editorId, sourceType: data.sourceType, sourceId: data.sourceId,
    }).session(session).lean();
    if (prev) return null;
  }
  let doc;
  try {
    const created = await EditorEarning.create([Object.assign({ currency: 'NGN', fund: 'editors' }, data)], txn.withSession(session));
    doc = created[0];
  } catch (e) {
    if (e && e.code === 11000) return null;
    throw e;
  }
  try {
    await ledger.post({
      legs: [{ debit: 'pool:' + doc.fund, credit: 'liability:editor:' + doc.editorId, amount: doc.amount }],
      kind: 'editor_commission',
      memo: 'editor ' + doc.sourceType + ' ' + (doc.sourceId || ''),
      idempotencyKey: 'editor_commission:' + doc.sourceType + ':' + doc.editorId + ':' + doc.sourceId,
      session,
    });
    await bumpPool(doc.fund, -doc.amount, session);
  } catch (e) {
    await EditorEarning.deleteOne({ id: doc.id }, txn.withSession(session)).catch(() => {});
    throw e;
  }
  return doc.toJSON ? doc.toJSON() : doc;
}

// Called from the author-credit path (wallet.service) inside its transaction.
// `kind` is 'sale' (chapter unlock) or 'tip' (gift/tip); the tip rate is the
// program-wide tipSharePct and is funded by the platform, not the editors pool.
async function accrueAuthorEarning({ authorId, authorTxnId, amount, kind, bookId, at, session }) {
  const credit = round2(amount);
  if (!authorId || !authorTxnId || credit <= 0) return null;
  const cfg = await settings();
  if (!cfg.enabled) return null;

  let query = EditorAssignment.findOne({ authorIds: String(authorId) }).select('editorId quota');
  if (session) query = query.session(session);
  const asg = await query.lean();
  if (!asg || !asg.editorId) return null;

  const terms = termsFor(asg.quota, cfg);
  if (!sharesRevenue(terms.mode)) return null;

  const isTip = kind === 'tip';
  const rate = isTip ? Number(cfg.tipSharePct) || 0 : terms.rate;
  if (rate <= 0) return null;

  const commission = round2(credit * rate / 100);
  if (commission <= 0) return null;

  return insertEarning({
    editorId: String(asg.editorId),
    authorId: String(authorId),
    sourceType: isTip ? 'tip_share' : 'revenue_share',
    sourceId: String(authorTxnId),
    bookId: bookId || '',
    baseAmount: credit,
    rate,
    amount: commission,
    currency: cfg.currency,
    fund: isTip ? 'platform' : 'editors',
    period: periodOf(at),
  }, session);
}

// A commission must never take a reader's purchase or an author's credit down
// with it — the primary money flow wins, the accrual is logged for ops.
async function accrueSafe(args) {
  try {
    return await accrueAuthorEarning(args);
  } catch (e) {
    console.error('[editor-earnings] accrual failed:', e && e.message);
    return null;
  }
}

/* ── Fixed monthly bills ───────────────────────────────────────────── */

async function runFixedBills(periodInput, by) {
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodInput || '')) ? periodInput : periodOf();
  const cfg = await settings();
  if (!cfg.enabled) return { period, created: 0, skipped: 0 };

  const asgs = await EditorAssignment.find({}).select('editorId quota').lean();
  let created = 0, skipped = 0;
  for (const a of asgs) {
    const terms = termsFor(a.quota, cfg);
    if (!paysFixed(terms.mode) || terms.monthlyAmount <= 0) { skipped += 1; continue; }
    const exists = await EditorEarning.exists({ editorId: String(a.editorId), sourceType: 'fixed_monthly', sourceId: period });
    if (exists) { skipped += 1; continue; }
    const row = await insertEarning({
      editorId: String(a.editorId), authorId: '', sourceType: 'fixed_monthly', sourceId: period,
      baseAmount: 0, rate: 0, amount: round2(terms.monthlyAmount), currency: cfg.currency,
      fund: 'editors', period, note: 'Monthly pay ' + period, createdBy: by || null,
    });
    if (row) created += 1; else skipped += 1;
  }
  return { period, created, skipped };
}

// Scheduler entry: no-op until the configured payout day of the current period.
async function runMonthlyIfDue(now) {
  const cfg = await settings();
  if (!cfg.enabled || !paysFixed(cfg.mode)) {
    // A per-editor fixed override still needs a bill even when the program is
    // revenue-share only, so fall through when any assignment says fixed.
    const overridden = await EditorAssignment.exists({ 'quota.paymentType': { $regex: 'fixed|monthly|salary|hybrid|both', $options: 'i' } });
    if (!overridden) return null;
  }
  const d = now || new Date();
  if (d.getUTCDate() < cfg.payoutDay) return null;
  return runFixedBills(periodOf(d));
}

/* ── Display helpers ───────────────────────────────────────────────── */

const UI_EARNING = { accrued: 'completed', void: 'failed' };
const UI_PAYOUT = { requested: 'pending', approved: 'processing', paid: 'completed', declined: 'failed' };
const money = (n, currency) => {
  const sym = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' }[currency] || (currency + ' ');
  const v = Math.abs(Number(n) || 0);
  return sym + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const SOURCE_LABEL = {
  revenue_share: 'Editor share',
  tip_share: 'Tip share',
  fixed_monthly: 'Monthly pay',
  adjustment: 'Adjustment',
};

/* ── Balance + editor console ──────────────────────────────────────── */

// earned (non-void) minus everything already requested, approved or paid.
async function balance(editorId) {
  const [earned, out] = await Promise.all([
    EditorEarning.aggregate([
      { $match: { editorId: String(editorId), status: 'accrued' } },
      { $group: { _id: null, n: { $sum: '$amount' } } },
    ]),
    EditorPayout.aggregate([
      { $match: { editorId: String(editorId), status: { $in: ['requested', 'approved', 'paid'] } } },
      { $group: { _id: null, n: { $sum: '$amount' } } },
    ]),
  ]);
  return round2(((earned[0] && earned[0].n) || 0) - ((out[0] && out[0].n) || 0));
}

async function summary(editorId) {
  const cfg = await settings();
  const [asg, groups, monthAgg, authors, lastPayout, pendingAgg, paidAgg, available] = await Promise.all([
    EditorAssignment.findOne({ editorId: String(editorId) }).select('quota').lean(),
    EditorEarning.aggregate([
      { $match: { editorId: String(editorId) } },
      { $group: { _id: '$status', amount: { $sum: '$amount' }, rows: { $sum: 1 } } },
    ]),
    EditorEarning.aggregate([
      { $match: { editorId: String(editorId), period: periodOf(), status: 'accrued' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    EditorEarning.distinct('authorId', { editorId: String(editorId), authorId: { $ne: '' }, status: 'accrued' }),
    EditorPayout.findOne({ editorId: String(editorId), status: 'paid' }).sort({ paidAt: -1 }).lean(),
    EditorPayout.aggregate([
      { $match: { editorId: String(editorId), status: { $in: ['requested', 'approved'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    EditorPayout.aggregate([
      { $match: { editorId: String(editorId), status: 'paid' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    balance(editorId),
  ]);

  const g = {};
  groups.forEach(r => { g[r._id] = { amount: round2(r.amount), rows: r.rows }; });
  const earned = (g.accrued && g.accrued.amount) || 0;
  const terms = termsFor(asg && asg.quota, cfg);

  return {
    currency: cfg.currency,
    terms,
    tipSharePct: cfg.tipSharePct,
    minWithdrawal: cfg.minWithdrawal,
    earned,                                   // lifetime, non-void
    available,                                // what can be withdrawn now
    // Cash already settled out. The bill page derives this as
    // earned-available-pendingPayout, which silently counts a rejected-and-
    // re-requested payout twice; the paid ledger is the honest number.
    withdrawn: round2((paidAgg[0] && paidAgg[0].amount) || 0),
    pendingPayout: round2((pendingAgg[0] && pendingAgg[0].amount) || 0),
    thisMonth: round2((monthAgg[0] && monthAgg[0].amount) || 0),
    authorCount: authors.length,
    earningRows: groups.reduce((s, r) => s + r.rows, 0),
    lastPayout: lastPayout ? {
      id: lastPayout.id, amount: lastPayout.amount, currency: lastPayout.currency || cfg.currency,
      method: lastPayout.method || '', reference: lastPayout.reference || '',
      paidAt: lastPayout.paidAt || lastPayout.updatedAt,
    } : null,
  };
}

async function hydrateAuthorRows(rows) {
  const userIds = [...new Set(rows.map(r => String(r.authorId)).filter(Boolean))];
  const bookIds = [...new Set(rows.map(r => String(r.bookId)).filter(Boolean))];
  const [people, books] = await Promise.all([
    userIds.length ? User.find({ id: { $in: userIds } }).select('id fullName username avatar').lean() : [],
    bookIds.length ? Book.find({ id: { $in: bookIds } }).select('id title cover').lean() : [],
  ]);
  const byUser = {}; people.forEach(u => { byUser[u.id] = u; });
  const byBook = {}; books.forEach(b => { byBook[b.id] = b; });
  return rows.map(r => ({ user: byUser[String(r.authorId)] || {}, book: byBook[String(r.bookId)] || {} }));
}

async function list(editorId, query) {
  const { page, limit } = pg(query);
  const filter = { editorId: String(editorId) };
  if (query && query.status) filter.status = query.status === 'pending' ? 'accrued' : (query.status === 'failed' ? 'void' : query.status);
  if (query && query.period) filter.period = String(query.period);
  if (query && query.sourceType) filter.sourceType = String(query.sourceType);

  const [rows, total, cfg] = await Promise.all([
    EditorEarning.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EditorEarning.countDocuments(filter),
    settings(),
  ]);
  const meta = await hydrateAuthorRows(rows);
  const items = rows.map((r, i) => {
    const who = meta[i].user, bk = meta[i].book;
    const label = SOURCE_LABEL[r.sourceType] || 'Earning';
    return {
      id: r.id,
      type: 'earning',
      sourceType: r.sourceType,
      title: r.sourceType === 'fixed_monthly'
        ? 'Monthly pay — ' + r.period
        : (bk.title || 'Author earning') + ' — ' + label.toLowerCase(),
      book: bk.title || '',
      bookId: r.bookId || '',
      cover: bk.cover || '',
      author: who.fullName || who.username || '',
      authorId: r.authorId || '',
      avatar: who.avatar || '',
      baseAmount: r.baseAmount,
      rate: r.rate,
      num: r.amount,
      amount: money(r.amount, r.currency || cfg.currency),
      date: day(r.createdAt),
      at: r.createdAt,
      status: UI_EARNING[r.status] || r.status,
      modelStatus: r.status,
      period: r.period,
      desc: r.note || (r.sourceType === 'fixed_monthly'
        ? 'Fixed monthly pay for ' + r.period + '.'
        : r.rate + '% ' + label.toLowerCase() + ' of ' + money(r.baseAmount, r.currency || cfg.currency) + ' credited to ' + (who.fullName || 'the author') + '.'),
    };
  });
  return { items, total, page, limit };
}

// My Earnings page: earnings AND withdrawals in one ledger table.
async function billRows(editorId, query) {
  const { page, limit } = pg(query);
  const cfg = await settings();
  const [earnings, payouts] = await Promise.all([
    EditorEarning.find({ editorId: String(editorId) }).sort({ createdAt: -1 }).limit(200).lean(),
    EditorPayout.find({ editorId: String(editorId) }).sort({ createdAt: -1 }).limit(200).lean(),
  ]);
  const meta = await hydrateAuthorRows(earnings);

  const rows = earnings.map((r, i) => {
    const who = meta[i].user, bk = meta[i].book;
    const label = SOURCE_LABEL[r.sourceType] || 'Earning';
    return {
      id: r.id, type: 'earning',
      title: r.sourceType === 'fixed_monthly' ? 'Monthly pay — ' + r.period : (bk.title || 'Author earning'),
      book: bk.title || '',
      cover: bk.cover || '',
      num: r.amount,
      amount: '+' + money(r.amount, r.currency || cfg.currency),
      date: day(r.createdAt), at: r.createdAt,
      status: UI_EARNING[r.status] || r.status,
      desc: r.note || (r.rate + '% ' + label.toLowerCase() + ' of ' + (who.fullName || 'an author') + '\u2019s ' + money(r.baseAmount, r.currency || cfg.currency) + ' credit.'),
      author: who.fullName || who.username || '',
    };
  }).concat(payouts.map(p => ({
    id: p.id, type: 'withdrawal',
    title: 'Withdrawal' + (p.method ? ' · ' + p.method : ''),
    book: '',
    num: -p.amount,
    amount: '-' + money(p.amount, p.currency || cfg.currency),
    date: day(p.paidAt || p.createdAt), at: p.paidAt || p.createdAt,
    status: UI_PAYOUT[p.status] || p.status,
    desc: p.status === 'paid'
      ? 'Paid' + (p.reference ? ' · ' + p.reference : '') + (p.account ? ' · ' + p.account : '') + '.'
      : p.status === 'declined'
        ? (p.declineReason || 'Withdrawal declined.')
        : 'Withdrawal ' + p.status + '.',
    author: '',
  }))).sort((a, b) => new Date(b.at) - new Date(a.at));

  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
}

async function byAuthor(editorId) {
  const cfg = await settings();
  const rows = await EditorEarning.aggregate([
    { $match: { editorId: String(editorId), authorId: { $ne: '' }, status: 'accrued' } },
    { $group: { _id: '$authorId', commission: { $sum: '$amount' }, base: { $sum: '$baseAmount' }, rows: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
    { $sort: { commission: -1 } },
  ]);
  const userIds = rows.map(r => String(r._id));
  const people = userIds.length ? await User.find({ id: { $in: userIds } }).select('id fullName username avatar').lean() : [];
  const byId = {}; people.forEach(u => { byId[u.id] = u; });
  return {
    currency: cfg.currency,
    total: rows.length,
    items: rows.map(r => {
      const u = byId[String(r._id)] || {};
      return {
        authorId: String(r._id), name: u.fullName || '', handle: u.username ? '@' + u.username : '',
        avatar: u.avatar || '', commission: round2(r.commission), base: round2(r.base), rows: r.rows, lastAt: r.lastAt,
      };
    }),
  };
}

/* ── Editor withdrawals (request side) ─────────────────────────────── */

const METHOD_LABEL = { bank: 'Bank Transfer', paypal: 'PayPal', mobile: 'Mobile Money' };

async function requestWithdrawal(editorId, data) {
  const cfg = await settings();
  const amount = round2(data.amount);
  if (!amount || amount < cfg.minWithdrawal) throw err('below_minimum', 400);

  const method = await PaymentMethod.findOne({ id: String(data.methodId || ''), authorId: String(editorId) }).lean();
  if (!method) throw err('no_method', 400);

  const available = await balance(editorId);
  if (amount > available) throw err('insufficient', 409);

  const doc = await EditorPayout.create({
    editorId: String(editorId),
    amount,
    currency: cfg.currency,
    method: METHOD_LABEL[method.type] || method.type,
    methodId: String(method.id),
    account: method.email || method.phoneNumber || '••••',
    status: 'requested',
    note: data.note || '',
  });
  return doc.toJSON();
}

async function withdrawalsOf(editorId, query) {
  const { page, limit } = pg(query);
  const filter = { editorId: String(editorId) };
  if (query && query.status) filter.status = String(query.status);
  const [items, total] = await Promise.all([
    EditorPayout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EditorPayout.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

/* ── Finance console (all editors) ─────────────────────────────────── */

// Per-editor money view. Finance owns this; the chief console never calls it.
async function financeStats() {
  const cfg = await settings();
  const [earnings, payouts, pool, asgs] = await Promise.all([
    EditorEarning.aggregate([
      { $match: { status: 'accrued' } },
      { $group: { _id: '$editorId', earned: { $sum: '$amount' }, rows: { $sum: 1 } } },
    ]),
    EditorPayout.aggregate([
      { $match: { status: { $in: ['requested', 'approved', 'paid'] } } },
      { $group: { _id: { editor: '$editorId', status: '$status' }, amount: { $sum: '$amount' } } },
    ]),
    PoolBalance.findOne({ pool: 'editors' }).lean(),
    EditorAssignment.find({}).select('editorId quota').lean(),
  ]);

  const per = {};
  earnings.forEach(r => {
    const id = String(r._id);
    per[id] = per[id] || { earned: 0, paid: 0, pending: 0, rows: 0 };
    per[id].earned = round2(r.earned);
    per[id].rows = r.rows;
  });
  payouts.forEach(r => {
    const id = String(r._id.editor);
    per[id] = per[id] || { earned: 0, paid: 0, pending: 0, rows: 0 };
    if (r._id.status === 'paid') per[id].paid = round2(r.amount);
    else per[id].pending = round2(per[id].pending + r.amount);
  });

  const ids_ = [...new Set(asgs.map(a => String(a.editorId)).concat(Object.keys(per)))];
  const people = ids_.length ? await User.find({ id: { $in: ids_ } }).select('id fullName username avatar').lean() : [];
  const byId = {}; people.forEach(u => { byId[u.id] = u; });
  const quotaOf = {}; asgs.forEach(a => { quotaOf[String(a.editorId)] = a.quota; });

  const editors = ids_.map(id => {
    const u = byId[id] || {};
    const e = per[id] || { earned: 0, paid: 0, pending: 0, rows: 0 };
    const terms = termsFor(quotaOf[id], cfg);
    return {
      id, name: u.fullName || '', handle: u.username ? '@' + u.username : '', avatar: u.avatar || '',
      earned: e.earned, paid: e.paid, pending: e.pending,
      available: round2(e.earned - e.paid - e.pending),
      rows: e.rows, mode: terms.mode, rate: terms.rate, monthlyAmount: terms.monthlyAmount,
    };
  }).sort((a, b) => b.available - a.available);

  const totals = editors.reduce((s, e) => ({
    earned: round2(s.earned + e.earned),
    paid: round2(s.paid + e.paid),
    pending: round2(s.pending + e.pending),
    available: round2(s.available + e.available),
  }), { earned: 0, paid: 0, pending: 0, available: 0 });

  return {
    settings: cfg,
    totals,
    pool: { pool: 'editors', balance: round2((pool && pool.balance) || 0) },
    editors,
  };
}

async function financeEarnings(query) {
  const { page, limit } = pg(query);
  const filter = {};
  if (query && query.editorId) filter.editorId = String(query.editorId);
  if (query && query.period) filter.period = String(query.period);
  if (query && query.status) filter.status = query.status === 'pending' ? 'accrued' : (query.status === 'failed' ? 'void' : query.status);

  if (query && query.q) {
    const rx = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const people = await User.find({ $or: [{ fullName: rx }, { username: rx }] }).select('id').limit(100).lean();
    const match = people.map(u => u.id);
    filter.$or = [{ editorId: { $in: match } }, { authorId: { $in: match } }];
  }

  const [rows, total, agg] = await Promise.all([
    EditorEarning.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EditorEarning.countDocuments(filter),
    EditorEarning.aggregate([
      { $match: filter },
      { $group: { _id: null, amount: { $sum: '$amount' }, rows: { $sum: 1 } } },
    ]),
  ]);

  const editorIds = [...new Set(rows.map(r => String(r.editorId)))];
  const authorIds = [...new Set(rows.map(r => String(r.authorId)).filter(Boolean))];
  const bookIds = [...new Set(rows.map(r => String(r.bookId)).filter(Boolean))];
  const [editors, authors, books] = await Promise.all([
    editorIds.length ? User.find({ id: { $in: editorIds } }).select('id fullName username avatar').lean() : [],
    authorIds.length ? User.find({ id: { $in: authorIds } }).select('id fullName username avatar').lean() : [],
    bookIds.length ? Book.find({ id: { $in: bookIds } }).select('id title').lean() : [],
  ]);
  const map = (list) => { const m = {}; list.forEach(u => { m[u.id] = u; }); return m; };
  const ed = map(editors), au = map(authors), bk = map(books);

  const items = rows.map(r => {
    const e = ed[String(r.editorId)] || {};
    const a = au[String(r.authorId)] || {};
    const b = bk[String(r.bookId)] || {};
    return {
      id: r.id, editorId: r.editorId, editorName: e.fullName || e.username || '',
      editorAvatar: e.avatar || '', authorId: r.authorId, authorName: a.fullName || a.username || '',
      authorAvatar: a.avatar || '', bookId: r.bookId || '', bookTitle: b.title || '',
      sourceType: r.sourceType, baseAmount: r.baseAmount, rate: r.rate, amount: r.amount,
      currency: r.currency, period: r.period, status: r.status,
      note: r.note || '', at: r.createdAt, date: day(r.createdAt),
    };
  });
  return {
    items, total, page, limit,
    totals: { amount: round2((agg[0] && agg[0].amount) || 0), rows: (agg[0] && agg[0].rows) || 0 },
  };
}

async function financePayouts(query) {
  const { page, limit } = pg(query);
  const filter = {};
  if (query && query.editorId) filter.editorId = String(query.editorId);
  if (query && query.status) filter.status = String(query.status);
  const [rows, total] = await Promise.all([
    EditorPayout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EditorPayout.countDocuments(filter),
  ]);
  const ids_ = [...new Set(rows.map(r => String(r.editorId)))];
  const people = ids_.length ? await User.find({ id: { $in: ids_ } }).select('id fullName username avatar').lean() : [];
  const byId = {}; people.forEach(u => { byId[u.id] = u; });
  return {
    items: rows.map(p => {
      const u = byId[String(p.editorId)] || {};
      return Object.assign({}, p, {
        editorName: u.fullName || u.username || '', editorAvatar: u.avatar || '',
        date: day(p.paidAt || p.createdAt),
      });
    }),
    total, page, limit,
  };
}

async function approvePayout(id, by) {
  const p = await EditorPayout.findOne({ id });
  if (!p) throw err('not_found', 404);
  if (p.status !== 'requested') throw err('not_requested', 409);
  p.status = 'approved';
  p.reviewedBy = by || null;
  await p.save();
  return p.toJSON();
}

async function declinePayout(id, reason, by) {
  const p = await EditorPayout.findOne({ id });
  if (!p) throw err('not_found', 404);
  if (p.status !== 'requested' && p.status !== 'approved') throw err('not_pending', 409);
  p.status = 'declined';
  p.declineReason = reason || 'Declined';
  p.reviewedBy = by || null;
  await p.save();
  return p.toJSON();
}

async function payPayout(id, data, by) {
  const p = await EditorPayout.findOne({ id });
  if (!p) throw err('not_found', 404);
  if (p.status !== 'approved') throw err('not_approved', 409);

  const reference = (data && data.reference) || p.reference || 'EPAY-' + Date.now().toString(36).toUpperCase();
  // Ledger first: if it cannot post, the payout stays approved rather than
  // showing paid with no money movement.
  await ledger.post({
    legs: [{ debit: 'liability:editor:' + p.editorId, credit: 'bank:editor-payouts', amount: p.amount }],
    kind: 'payout',
    memo: 'editor payout ' + p.id,
    idempotencyKey: 'editor_payout:' + p.id,
  });
  p.status = 'paid';
  p.paidAt = new Date();
  p.processedBy = by || null;
  p.reference = reference;
  await p.save();
  return p.toJSON();
}

// Corrections: reverse an accrual that never should have existed. Only while
// the money is still uncommitted (available balance covers the row).
async function voidEarning(id, reason, by) {
  const row = await EditorEarning.findOne({ id });
  if (!row) throw err('not_found', 404);
  if (row.status !== 'accrued') throw err('not_accrued', 409);
  const available = await balance(row.editorId);
  if (available < row.amount) throw err('already_committed', 409);

  await ledger.post({
    legs: [{ debit: 'liability:editor:' + row.editorId, credit: 'pool:' + row.fund, amount: row.amount }],
    kind: 'editor_commission',
    memo: 'void editor earning ' + row.id,
    idempotencyKey: 'editor_void:' + row.id,
  });
  await bumpPool(row.fund, row.amount);
  row.status = 'void';
  row.note = reason || 'Voided';
  row.createdBy = by || null;
  await row.save();
  return row.toJSON();
}

/* ── Chief console (program only, no per-editor earnings) ──────────── */

// What the chief editor may see: the program settings, the editors bucket, how
// editors are paid, and the fixed salaries it sets. No revenue-share amounts.
async function programSummary() {
  const cfg = await settings();
  const [pool, asgs] = await Promise.all([
    PoolBalance.findOne({ pool: 'editors' }).lean(),
    EditorAssignment.find({}).select('editorId quota').lean(),
  ]);
  const ids_ = asgs.map(a => String(a.editorId));
  const people = ids_.length ? await User.find({ id: { $in: ids_ } }).select('id fullName username avatar').lean() : [];
  const byId = {}; people.forEach(u => { byId[u.id] = u; });

  const editors = asgs.map(a => {
    const u = byId[String(a.editorId)] || {};
    const terms = termsFor(a.quota, cfg);
    return {
      id: String(a.editorId), name: u.fullName || '', handle: u.username ? '@' + u.username : '',
      avatar: u.avatar || '', mode: terms.mode, rate: terms.rate, monthlyAmount: terms.monthlyAmount,
    };
  });
  const counts = { revenue_share: 0, fixed_monthly: 0, hybrid: 0 };
  editors.forEach(e => { counts[e.mode] = (counts[e.mode] || 0) + 1; });

  return {
    settings: cfg,
    pool: { pool: 'editors', balance: round2((pool && pool.balance) || 0) },
    editors,
    counts,
    fixedPayroll: round2(editors.filter(e => paysFixed(e.mode)).reduce((s, e) => s + e.monthlyAmount, 0)),
  };
}

module.exports = {
  settings, saveSettings, termsFor, modeOf,
  accrueAuthorEarning, accrueSafe, runFixedBills, runMonthlyIfDue,
  balance, summary, list, billRows, byAuthor,
  requestWithdrawal, withdrawalsOf,
  approvePayout, declinePayout, payPayout, voidEarning,
  financeStats, financeEarnings, financePayouts,
  programSummary,
};
