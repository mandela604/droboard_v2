'use strict';
const { RevenueConfig, PoolBalance, CoinRate } = require('../models/revenue.model');
const { User } = require('../models/user.model');
const { Wallet, Withdrawal, Subscription, SubscriptionRead } = require('../models/money.model');
const { Book } = require('../models/content.model');
const { ReadingProgress } = require('../models/social.model');

// 24-hex ObjectIds may appear in FK fields written before the uuid convention.
const HEX24 = /^[0-9a-fA-F]{24}$/;

// Active global config, optionally overridden per author.
async function activeConfig(authorId) {
  let cfg = await RevenueConfig.findOne({ scope: 'global' }).sort({ version: -1 }).lean();
  if (!cfg) {
    cfg = { scope: 'global', storeFeePct: 30, marketingPct: 20, editorsPct: 10, writerShareOfNetPct: 40, giftWriterPct: 30, subscriptionCoinRateNGN: 10, version: 1 };
  }
  if (authorId) {
    const over = await RevenueConfig.findOne({ scope: 'author', authorId }).sort({ version: -1 }).lean();
    if (over) cfg = Object.assign({}, cfg, over);
  }
  return cfg;
}

// Standard waterfall on gross receipts -> { storeFee, marketing, editors, net, writer, platform }
function splitGross(gross, cfg) {
  const storeFee = gross * (cfg.storeFeePct / 100);
  const receipts = gross - storeFee;
  const marketing = gross * (cfg.marketingPct / 100);
  const editors = gross * (cfg.editorsPct / 100);
  const net = gross - storeFee - marketing - editors;
  const writer = net * (cfg.writerShareOfNetPct / 100);
  const platform = net - writer;
  return { storeFee, receipts, marketing, editors, net, writer, platform };
}

// Gifts/tips: flat writer/platform split of coin face value (no waterfall).
function splitGift(faceValue, cfg) {
  const w = (cfg.giftWriterPct != null ? cfg.giftWriterPct : 30) / 100;
  return { writer: faceValue * w, platform: faceValue * (1 - w) };
}

async function saveConfig({ scope, authorId, splits, note, by }) {
  const last = await RevenueConfig.findOne({ scope }).sort({ version: -1 }).lean();
  const doc = await RevenueConfig.create(Object.assign({
    scope, authorId: authorId || null, version: (last ? last.version : 0) + 1,
    note: note || '', updatedBy: by || null,
  }, splits));
  return doc.toJSON();
}

/* ── Super-admin revenue-splits console (flat UI shape) ──
 * UI speaks flat percentages that sum to 100 with google fixed at 30.
 * Stored 1:1 on the same fields: google<->storeFeePct, marketing<->marketingPct,
 * editors<->editorsPct, writerShare<->writerShareOfNetPct. splitGross() above is
 * untouched and remains the ledger math. */
function toFlat(cfg) {
  if (!cfg) return null;
  const o = typeof cfg.toJSON === 'function' ? cfg.toJSON() : cfg;
  return {
    id: o.id, version: o.version,
    google: o.storeFeePct, marketing: o.marketingPct, editors: o.editorsPct,
    writerShare: o.writerShareOfNetPct,
    giftWriterPct: o.giftWriterPct != null ? o.giftWriterPct : 30,
    subPlatformPct: o.subPlatformPct != null ? o.subPlatformPct : 50,
    subWritersPct: o.subWritersPct != null ? o.subWritersPct : 50,
    subscriptionCoinRateNGN: o.subscriptionCoinRateNGN != null ? o.subscriptionCoinRateNGN : 10,
    note: o.note || '', updatedBy: o.updatedBy || null, updatedAt: o.updatedAt || o.createdAt || null,
    authorId: o.authorId || null,
  };
}
function checkFlat(splits) {
  const g = Number(splits.google);
  const m = Number(splits.marketing);
  const e = Number(splits.editors);
  const w = Number(splits.writerShare);
  if (![g, m, e, w].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) {
    throw Object.assign(new Error('splits_out_of_range'), { status: 400 });
  }
  if (g !== 30) throw Object.assign(new Error('google_fixed'), { status: 400 });
  if (m + e + w !== 70) throw Object.assign(new Error('splits_must_sum'), { status: 400 });
  const gift = splits.giftWriterPct !== undefined ? Number(splits.giftWriterPct) : 30;
  if (!Number.isFinite(gift) || gift !== 30) throw Object.assign(new Error('gift_fixed'), { status: 400 });
  const sp = splits.subPlatformPct !== undefined ? Number(splits.subPlatformPct) : 50;
  const sw = splits.subWritersPct !== undefined ? Number(splits.subWritersPct) : 50;
  if (![sp, sw].every(n => Number.isFinite(n) && n >= 0 && n <= 100) || sp + sw !== 100) {
    throw Object.assign(new Error('sub_splits_must_sum'), { status: 400 });
  }
  return {
    storeFeePct: g, marketingPct: m, editorsPct: e, writerShareOfNetPct: w,
    giftWriterPct: gift, subPlatformPct: sp, subWritersPct: sw,
  };
}
async function configHistory() {
  const rows = await RevenueConfig.find({ scope: 'global' }).sort({ version: -1 }).lean();
  return { versions: rows.map(toFlat) };
}
async function authorOverrides() {
  const rows = await RevenueConfig.find({ scope: 'author' }).sort({ updatedAt: -1 }).lean();
  const ids = [...new Set(rows.map(r => String(r.authorId)).filter(Boolean))];
  const users = await User.find({ id: { $in: ids } }).select('id fullName username avatar').lean();
  return {
    overrides: rows.map(r => {
      const u = users.find(x => String(x.id) === String(r.authorId));
      const flat = toFlat(r);
      flat.name = u ? u.fullName : '';
      flat.handle = u ? '@' + u.username : '';
      flat.avatar = u ? u.avatar : '';
      return flat;
    }),
  };
}
async function saveFlatConfig({ scope, authorId, splits, note, by }) {
  const mapped = checkFlat(splits);
  const doc = await saveConfig({ scope, authorId, splits: mapped, note, by });
  return toFlat(doc);
}
async function deleteAuthorOverride(authorId) {
  const r = await RevenueConfig.findOneAndDelete({ scope: 'author', authorId });
  if (!r) throw Object.assign(new Error('override_not_found'), { status: 404 });
  return { authorId, deleted: true };
}
async function authorDirectory(q) {
  const filter = { roles: 'writer', deletedAt: null };
  if (q) {
    const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { username: rx }];
  }
  const users = await User.find(filter).sort({ fullName: 1 }).limit(20)
    .select('id fullName username avatar').lean();
  return {
    authors: users.map(u => ({ id: u.id, name: u.fullName, handle: '@' + u.username, avatar: u.avatar || '' })),
  };
}
async function poolsShape() {
  const labels = { editors: 'Editors Pool', platform: 'Platform Reserve', marketing: 'Marketing Pool' };
  for (const pool of Object.keys(labels)) {
    await PoolBalance.updateOne({ pool }, { $setOnInsert: { balance: 0 } }, { upsert: true });
  }
  const docs = await PoolBalance.find({}).lean();
  const pools = docs.map(d => ({
    id: d.pool === 'editors' ? 'editors_pool' : d.pool,
    label: labels[d.pool] || d.pool,
    balance: d.balance || 0,
    recomputedAt: d.recomputedAt ? new Date(d.recomputedAt).toLocaleString() : '',
  }));
  const [earnedAgg, paidAgg] = await Promise.all([
    Wallet.aggregate([{ $match: { kind: 'author' } }, { $group: { _id: null, n: { $sum: '$lifetimeEarned' } } }]),
    Withdrawal.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, n: { $sum: '$amount' } } }]),
  ]);
  const earned = (earnedAgg[0] && earnedAgg[0].n) || 0;
  const paid = (paidAgg[0] && paidAgg[0].n) || 0;
  pools.push({ id: 'writers', label: 'Writers Payable', balance: Math.max(0, earned - paid), recomputedAt: new Date().toLocaleString() });
  return { pools };
}

/* ── Subscription pool distribution ──
 * Rule: 50% platform, 50% split pro-rata among writers by QUALIFYING reads:
 * a chapter counts only when a premium (actively subscribed) user spends
 * >= 180s on it within the period. Pool = sum of SubscriptionRead coinValue
 * (NGN face) for the period. Read-only preview (no ledger writes). */
async function distributeSubscriptions(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) {
    throw Object.assign(new Error('invalid_period'), { status: 400 });
  }
  const cfg = toFlat(await activeConfig());
  const start = new Date(period + '-01T00:00:00.000Z');
  const end = new Date(new Date(start).setUTCMonth(start.getUTCMonth() + 1));
  const [reads, subs] = await Promise.all([
    SubscriptionRead.find({ period }).lean(),
    Subscription.find({ status: 'active' }).select('userId').lean(),
  ]);
  const pool = reads.reduce((s, r) => s + (Number(r.coinValue) || 0), 0);
  const platform = pool * ((cfg.subPlatformPct != null ? cfg.subPlatformPct : 50) / 100);
  const writersPool = pool - platform;
  const premium = new Set(subs.map(s => String(s.userId)));
  const progress = await ReadingProgress.find({
    lastReadAt: { $gte: start, $lt: end },
    secondsSpent: { $gte: 180 },
  }).select('userId storyId chapterId').lean();
  const chaptersByStory = {};
  progress.forEach(p => {
    if (!premium.has(String(p.userId)) || !p.chapterId) return;
    const k = String(p.storyId);
    chaptersByStory[k] = chaptersByStory[k] || new Set();
    chaptersByStory[k].add(String(p.userId) + ':' + String(p.chapterId));
  });
  const storyIds = Object.keys(chaptersByStory);
  const hexStory = storyIds.filter(v => HEX24.test(v));
  const books = storyIds.length
    ? await Book.find(hexStory.length ? { $or: [{ id: { $in: storyIds } }, { _id: { $in: hexStory } }] } : { id: { $in: storyIds } }).select('id authorId').lean()
    : [];
  const chaptersByAuthor = {};
  let totalChapters = 0;
  books.forEach(b => {
    const n = (chaptersByStory[String(b.id)] || chaptersByStory[String(b._id)] || new Set()).size;
    if (!n) return;
    const aid = String(b.authorId);
    chaptersByAuthor[aid] = (chaptersByAuthor[aid] || 0) + n;
    totalChapters += n;
  });
  const authorIds = Object.keys(chaptersByAuthor);
  const hexAuthor = authorIds.filter(v => HEX24.test(v));
  const authors = authorIds.length
    ? await User.find(hexAuthor.length ? { $or: [{ id: { $in: authorIds } }, { _id: { $in: hexAuthor } }] } : { id: { $in: authorIds } }).select('id fullName username').lean()
    : [];
  const writers = authorIds.map(aid => {
    const u = authors.find(x => String(x.id) === aid || String(x._id) === aid);
    return {
      authorId: aid, name: u ? u.fullName : '', handle: u ? '@' + u.username : '',
      chapters: chaptersByAuthor[aid],
      amount: totalChapters ? +(writersPool * chaptersByAuthor[aid] / totalChapters).toFixed(2) : 0,
    };
  }).sort((a, b) => b.amount - a.amount);
  return {
    period, pool, platform: +platform.toFixed(2), writersPool: +writersPool.toFixed(2),
    qualifyingChapters: totalChapters, configVersion: cfg.version, writers,
  };
}

/* ── Coin rate (single 'live' CoinRate doc — Super Admin console, no code
   changes). Unlock/tip read coinFaceNGN from here; admin PUT updates it. ── */
async function coinRateGet() {
  const doc = await CoinRate.findOne({ key: 'live' }).lean();
  if (doc) return doc;
  return new CoinRate({ key: 'live' }).toObject(); // unsaved defaults for first render
}
async function coinRateSave(updates) {
  const allowed = ['coinFaceNGN', 'minChapterCoins', 'minWithdrawal', 'bonusExpiryDays', 'dormancyBreakageMonths'];
  const set = {};
  allowed.forEach(k => { if (updates[k] !== undefined) set[k] = updates[k]; });
  if (!Object.keys(set).length) { const e = new Error('nothing_to_save'); e.status = 400; throw e; }
  return CoinRate.findOneAndUpdate(
    { key: 'live' },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

module.exports = {
  activeConfig, splitGross, splitGift, saveConfig,
  toFlat, checkFlat, configHistory, authorOverrides,
  saveFlatConfig, deleteAuthorOverride, authorDirectory, poolsShape,
  distributeSubscriptions, coinRateGet, coinRateSave,
};
