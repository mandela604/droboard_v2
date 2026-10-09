'use strict';
/* Audience segments backend — live evaluator for the marketing ad-setup
   catalog (public/marketing/shared/ad-setup-data.js SEGMENTS).
   Each segment declares {signal, windowDays, op, value}; evaluateSegment
   counts matching users from real event collections. Catalog responses are
   cached 10 minutes (console traffic is low, aggregates are heavy). */
const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const {
  Post, Comment, Follow, LibraryItem, ReadingProgress, Referral, Reaction, ShareEvent,
} = require('../models/social.model');
const { LedgerEntry, CoinTransaction, Subscription } = require('../models/money.model');
const { AdClick } = require('../models/platform.model');

const DAY = 86400000;
function since(days) { return new Date(Date.now() - days * DAY); }

const SEGMENTS = [
  { id: 'top-tippers', label: 'Top Tippers', icon: 'fa-coins', color: '#f0a800', desc: 'Tipped a writer in the last 30 days — proven spenders.', rule: { signal: 'tip_sent', windowDays: 30, op: 'gte', value: 1 } },
  { id: 'super-reactors', label: 'Super Reactors', icon: 'fa-heart', color: '#ff0050', desc: '50+ reactions in 30 days — the loudest engagers.', rule: { signal: 'reactions', windowDays: 30, op: 'gte', value: 50 } },
  { id: 'commentators', label: 'Commentators', icon: 'fa-comments', color: '#38bdf8', desc: '10+ comments in 30 days — discussion drivers.', rule: { signal: 'comments', windowDays: 30, op: 'gte', value: 10 } },
  { id: 'sharers', label: 'Sharers', icon: 'fa-share-nodes', color: '#34d399', desc: 'Shared 3+ stories — organic amplifiers.', rule: { signal: 'shares', windowDays: 90, op: 'gte', value: 3 } },
  { id: 'savers', label: 'Savers', icon: 'fa-bookmark', color: '#60a5fa', desc: '20+ saved stories — library builders with intent.', rule: { signal: 'saves', windowDays: 90, op: 'gte', value: 20 } },
  { id: 'unlockers', label: 'Chapter Unlockers', icon: 'fa-lock-open', color: '#d97706', desc: 'Unlocked 3+ chapters — pay for content already.', rule: { signal: 'chapters_unlocked', windowDays: 90, op: 'gte', value: 3 } },
  { id: 'coin-buyers', label: 'Coin Buyers', icon: 'fa-wallet', color: '#a78bfa', desc: 'Bought coins in the last 90 days — wallet open.', rule: { signal: 'coin_purchase', windowDays: 90, op: 'gte', value: 1 } },
  { id: 'premium', label: 'Premium Members', icon: 'fa-crown', color: '#fbbf24', desc: 'Active subscription — highest lifetime value.', rule: { signal: 'subscription_active', op: 'eq', value: true } },
  { id: 'power-followers', label: 'Power Followers', icon: 'fa-user-group', color: '#f472b6', desc: 'Follows 25+ accounts — discovery hungry.', rule: { signal: 'following_count', op: 'gte', value: 25 } },
  { id: 'binge-readers', label: 'Binge Readers', icon: 'fa-fire', color: '#ef4444', desc: '5+ hrs/week or a 10-day streak — always reading.', rule: { signal: 'weekly_hours_or_streak', op: 'any', value: [5, 10] } },
  { id: 'finishers', label: 'Finishers', icon: 'fa-circle-check', color: '#22c55e', desc: 'Completed 3+ books — commit to full stories.', rule: { signal: 'books_finished', op: 'gte', value: 3 } },
  { id: 'referrers', label: 'Referrers', icon: 'fa-user-plus', color: '#0ea5e9', desc: 'Brought 1+ converted reader — trusted voices.', rule: { signal: 'referrals_converted', op: 'gte', value: 1 } },
  { id: 'ad-responders', label: 'Ad Responders', icon: 'fa-rectangle-ad', color: '#fb923c', desc: 'Clicked an ad in 30 days — proven to convert.', rule: { signal: 'ad_click', windowDays: 30, op: 'gte', value: 1 } },
  { id: 'winback', label: 'Win-back', icon: 'fa-moon', color: '#818cf8', desc: 'Dormant 30+ days — re-engagement plays.', rule: { signal: 'days_since_active', op: 'gte', value: 30 } },
  { id: 'newcomers', label: 'Newcomers', icon: 'fa-seedling', color: '#4ade80', desc: 'Joined in the last 14 days — onboarding window.', rule: { signal: 'account_age_days', op: 'lte', value: 14 } },
  { id: 'lapsed-subscribers', label: 'Lapsed Subscribers', icon: 'fa-ticket', color: '#f97316', desc: 'Held Daily/Weekly/Monthly before but not subscribed now — win them back.', rule: { signal: 'had_subscription', op: 'eq', value: true } },
  { id: 'writers', label: 'Writers', icon: 'fa-feather-pointed', color: '#e879f9', desc: 'Verified authors — for tools, promos, services.', rule: { signal: 'is_writer', op: 'eq', value: true } },
];

async function distinctUserIds(pipeline, Model) {
  const rows = await Model.aggregate(pipeline);
  return new Set(rows.map(r => String(r._id)).filter(Boolean));
}
function havingCount(field, min) {
  return [
    { $group: { _id: '$' + field, n: { $sum: 1 } } },
    { $match: { n: { $gte: min } } },
  ];
}
function havingDistinct(field, distinct, min) {
  return [
    { $group: { _id: '$' + field, ids: { $addToSet: '$' + distinct } } },
    { $project: { n: { $size: '$ids' } } },
    { $match: { n: { $gte: min } } },
  ];
}

async function evaluateSegment(id) {
  const d30 = since(30), d90 = since(90), d7 = since(7), d14 = since(14);
  switch (id) {
    case 'top-tippers': {
      const rows = await LedgerEntry.aggregate([
        { $match: { debitAcct: /^wallet:/, kind: { $in: ['tip', 'gift'] }, createdAt: { $gte: d30 } } },
        { $group: { _id: '$debitAcct' } },
      ]);
      return new Set(rows.map(r => String(r._id).replace(/^wallet:/, '')));
    }
    case 'super-reactors':
      return distinctUserIds([{ $match: { createdAt: { $gte: d30 } } }, ...havingCount('userId', 50)], Reaction);
    case 'commentators':
      return distinctUserIds([{ $match: { createdAt: { $gte: d30 } } }, ...havingCount('authorId', 10)], Comment);
    case 'sharers':
      return distinctUserIds([{ $match: { createdAt: { $gte: d90 } } }, ...havingDistinct('userId', 'targetId', 3)], ShareEvent);
    case 'savers':
      return distinctUserIds([{ $match: { list: { $in: ['library', 'saved'] }, createdAt: { $gte: d90 } } }, ...havingDistinct('userId', 'storyId', 20)], LibraryItem);
    case 'unlockers': {
      const rows = await LedgerEntry.aggregate([
        { $match: { kind: 'spend', memo: /^unlock ch /, createdAt: { $gte: d90 } } },
        ...havingDistinct('debitAcct', 'saleId', 3),
      ]);
      return new Set([...rows].map(r => String(r._id).replace(/^wallet:/, '')));
    }
    case 'coin-buyers':
      return distinctUserIds([{ $match: { type: 'purchase', status: 'completed', createdAt: { $gte: d90 } } }, { $group: { _id: '$userId' } }], CoinTransaction);
    case 'premium':
      return distinctUserIds([{ $match: { status: 'active' } }, { $group: { _id: '$userId' } }], Subscription);
    case 'power-followers':
      return distinctUserIds([...havingCount('followerId', 25)], Follow);
    case 'binge-readers': {
      const [heavy, streaky] = await Promise.all([
        ReadingProgress.aggregate([
          { $match: { lastReadAt: { $gte: d7 } } },
          { $group: { _id: '$userId', secs: { $sum: '$secondsSpent' } } },
          { $match: { secs: { $gte: 5 * 3600 } } },
        ]),
        ReadingProgress.aggregate([
          { $match: { lastReadAt: { $gte: d14 } } },
          { $group: { _id: { u: '$userId', d: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } } },
          { $group: { _id: '$_id.u', days: { $sum: 1 } } },
          { $match: { days: { $gte: 10 } } },
        ]),
      ]);
      return new Set([...heavy, ...streaky].map(r => String(r._id)).filter(Boolean));
    }
    case 'finishers':
      return distinctUserIds([{ $match: { list: 'history', status: 'finished' } }, ...havingDistinct('userId', 'storyId', 3)], LibraryItem);
    case 'referrers':
      return distinctUserIds([{ $match: { readRewarded: true } }, { $group: { _id: '$ownerId' } }], Referral);
    case 'ad-responders':
      return distinctUserIds([{ $match: { createdAt: { $gte: d30 } } }, { $group: { _id: '$userId' } }], AdClick);
    case 'winback': {
      const rows = await User.find({
        deletedAt: null,
        $or: [
          { lastLoginAt: { $lt: d30 } },
          { lastLoginAt: null, createdAt: { $lt: d30 } },
        ],
      }).select('_id').lean();
      return new Set(rows.map(u => String(u._id)));
    }
    case 'newcomers': {
      const rows = await User.find({ deletedAt: null, createdAt: { $gte: since(14) } }).select('_id').lean();
      return new Set(rows.map(u => String(u._id)));
    }
    case 'lapsed-subscribers': {
      const [all, active] = await Promise.all([
        Subscription.aggregate([{ $group: { _id: '$userId' } }]),
        Subscription.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$userId' } }]),
      ]);
      const on = new Set(active.map(r => String(r._id)));
      return new Set(all.map(r => String(r._id)).filter(id => id && !on.has(id)));
    }
    case 'writers': {
      const rows = await User.find({ deletedAt: null, roles: 'writer' }).select('_id').lean();
      return new Set(rows.map(u => String(u._id)));
    }
    default: return new Set();
  }
}

async function genreAudiences() {
  const pairs = await ReadingProgress.aggregate([
    { $match: { lastReadAt: { $gte: since(90) } } },
    { $group: { _id: { u: '$userId', s: '$storyId' } } },
    { $limit: 20000 },
  ]);
  const storyIds = [...new Set(pairs.map(p => String(p._id.s)).filter(Boolean))];
  if (!storyIds.length) return [];
  const books = await Book.find({ $or: [{ id: { $in: storyIds } }] }).select('genre').lean();
  const hex = storyIds.filter(s => /^[0-9a-fA-F]{24}$/.test(s));
  const legacy = hex.length ? await Book.find({ _id: { $in: hex } }).select('genre').lean() : [];
  const gmap = {};
  [...books, ...legacy].forEach(b => {
    if (b.id) gmap[String(b.id)] = b.genre || '';
    if (b._id) gmap[String(b._id)] = b.genre || '';
  });
  const per = {};
  pairs.forEach(p => {
    const g = gmap[String(p._id.s)];
    if (!g) return;
    per[g] = per[g] || new Set();
    per[g].add(String(p._id.u));
  });
  return Object.keys(per).sort().map(name => ({ name, count: per[name].size }));
}

async function countryAudiences(total) {
  const rows = await User.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: { $ifNull: ['$country', ''] }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 20 },
  ]);
  return rows.filter(r => r._id).map(r => ({ code: r._id, name: r._id, share: total ? +(r.n / total).toFixed(4) : 0, count: r.n }));
}

let CACHE = { at: 0, data: null };
const CACHE_TTL = 10 * 60 * 1000;

async function catalog() {
  if (CACHE.data && Date.now() - CACHE.at < CACHE_TTL) return CACHE.data;
  const [total, counts, genres] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Promise.all(SEGMENTS.map(s => evaluateSegment(s.id).then(set => ({ id: s.id, reach: set.size })).catch(() => ({ id: s.id, reach: 0 })))),
    genreAudiences().catch(() => []),
  ]);
  const reachById = {};
  counts.forEach(c => { reachById[c.id] = c.reach; });
  const countries = await countryAudiences(total).catch(() => []);
  const data = {
    segments: SEGMENTS.map(s => Object.assign({}, s, { reach: reachById[s.id] || 0 })),
    genres, countries, totalReaders: total, cachedAt: new Date().toISOString(),
  };
  CACHE = { at: Date.now(), data };
  return data;
}

/* union estimate mirroring the setup page: overlap discount + country scaling */async function estimate({ segments, genres, countries }) {
  const cat = await catalog();
  const segMap = {};
  cat.segments.forEach(s => { segMap[s.id] = s.reach; });
  const genreMap = {};
  cat.genres.forEach(g => { genreMap[g.name] = g.count; });
  let sum = 0, sets = 0;
  (segments || []).forEach(id => { if (segMap[id] != null) { sum += segMap[id]; sets++; } });
  (genres || []).forEach(g => { if (genreMap[g] != null) { sum += genreMap[g]; sets++; } });
  let share = 1;
  if ((countries || []).length) {
    share = 0;
    const cmap = {};
    cat.countries.forEach(c => { cmap[c.code] = c.share; });
    countries.forEach(code => { share += cmap[code] || 0; });
  }
  if (!sets) return { reach: Math.round(cat.totalReaders * share), sets: 0, capped: false };
  const reach = Math.round((sets > 1 ? sum * 0.7 : sum) * share);
  return { reach: Math.min(cat.totalReaders, reach), sets, capped: reach > cat.totalReaders };
}

/* per-user reading profile: hours, streak, sessions (derived from heartbeat
   gaps >30min — never stored), finishes, top categories/genres/tropes. */
async function readingProfile(userId) {
  const { Category } = require('../models/content.model');
  const me = await User.findOne({ $or: [{ id: String(userId) }] }).select('_id').lean().catch(() => null);
  const flavors = me ? [...new Set([String(me.id), String(me._id)])] : [String(userId)];
  const d7 = since(7), d30 = since(30), d90 = since(90);
  const [rows, fins] = await Promise.all([
    ReadingProgress.find({ userId: { $in: flavors }, lastReadAt: { $gte: d30 } })
      .select('storyId chapterId secondsSpent wordsRead finished lastReadAt').limit(5000).lean(),
    LibraryItem.find({ userId: { $in: flavors }, list: 'history', status: 'finished' }).select('storyId').lean(),
  ]);
  let secs7 = 0, secs30 = 0, words30 = 0;
  const days = new Set(), stories = new Set(), finishedCh = new Set(), times = [];
  rows.forEach(r => {
    const s = Number(r.secondsSpent) || 0;
    secs30 += s; words30 += Number(r.wordsRead) || 0;
    const t = r.lastReadAt ? new Date(r.lastReadAt).getTime() : 0;
    if (t) {
      times.push(t);
      days.add(new Date(t).toISOString().slice(0, 10));
      if (t >= d7.getTime()) secs7 += s;
    }
    if (r.storyId) stories.add(String(r.storyId));
    if (r.finished && r.chapterId) finishedCh.add(String(r.storyId) + ':' + String(r.chapterId));
  });
  // streak: consecutive days back from today/yesterday
  let streak = 0;
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setTime(cursor.getTime() - DAY);
  while (days.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setTime(cursor.getTime() - DAY); }
  // sessions: gaps >30min between heartbeats
  times.sort((a, b) => a - b);
  let sessions = 0, prevT = null;
  times.forEach(t => { if (prevT === null || t - prevT > 30 * 60 * 1000) sessions++; prevT = t; });
  // affinity over category + genre + tropes (90d window via the 30d rows cap:
  // extend with older rows when needed)
  const storyIds = [...stories];
  const books = storyIds.length ? await Book.find({ $or: [{ id: { $in: storyIds } }] }).select('id genre categoryId tropes').lean() : [];
  const hexIds = storyIds.filter(s => /^[0-9a-fA-F]{24}$/.test(s));
  const legacy = hexIds.length ? await Book.find({ _id: { $in: hexIds } }).select('genre categoryId tropes').lean() : [];
  const bmap = {};
  [...books, ...legacy].forEach(b => {
    const rec = { genre: b.genre || '', categoryId: b.categoryId || null, tropes: b.tropes || [] };
    if (b.id) bmap[String(b.id)] = rec;
    if (b._id) bmap[String(b._id)] = rec;
  });
  const catIds = [...new Set(Object.values(bmap).map(b => b.categoryId).filter(Boolean))];
  const cats = catIds.length ? await Category.find({ id: { $in: catIds } }).select('name').lean() : [];
  const hexCat = catIds.filter(s => /^[0-9a-fA-F]{24}$/.test(String(s)));
  const legacyCat = hexCat.length ? await Category.find({ _id: { $in: hexCat } }).select('name').lean() : [];
  const cmap = {};
  [...cats, ...legacyCat].forEach(c => {
    const n = c.name || '';
    if (c.id) cmap[String(c.id)] = n;
    if (c._id) cmap[String(c._id)] = n;
  });
  const byCat = {}, byGenre = {}, byTrope = {};
  rows.forEach(r => {
    const b = bmap[String(r.storyId)];
    if (!b) return;
    const s = Number(r.secondsSpent) || 0;
    if (b.genre) byGenre[b.genre] = (byGenre[b.genre] || 0) + s;
    const cn = cmap[String(b.categoryId)];
    if (cn) byCat[cn] = (byCat[cn] || 0) + s;
    (b.tropes || []).forEach(t => { byTrope[t] = (byTrope[t] || 0) + s; });
  });
  const top = (m) => Object.keys(m).map(k => ({ name: k, seconds: m[k] })).sort((a, b) => b.seconds - a.seconds).slice(0, 5);
  return {
    hours7d: +(secs7 / 3600).toFixed(1), hours30d: +(secs30 / 3600).toFixed(1),
    words30d: words30, streakDays: streak, sessions30d: sessions,
    finishes: new Set(fins.map(f => String(f.storyId))).size,
    books30d: stories.size, chaptersFinished30d: finishedCh.size,
    topCategories: top(byCat), topGenres: top(byGenre), topTropes: top(byTrope),
  };
}

module.exports = { SEGMENTS, catalog, estimate, evaluateSegment, readingProfile };
