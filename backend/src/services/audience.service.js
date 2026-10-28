'use strict';
/* Audience segments backend — live evaluator for the marketing ad-targeting
   catalog.

   The catalog is stored, not hardcoded: marketing edits thresholds and
   wording in Ad Manager → Audience segments, which writes the AudienceConfig
   document (seeded from DEFAULT_SEGMENTS on first read). What stays in code
   is the SIGNAL vocabulary below — each signal names a real collection and
   how to count it, so a new signal is an engineering change while a new
   threshold is not.

   Each stored segment declares {signal, windowDays, op, value}; evaluateRule
   turns that into an aggregate over the event collections. Catalog responses
   are cached 10 minutes (console traffic is low, aggregates are heavy) and
   the cache is dropped whenever the catalog is saved. */
const { User } = require('../models/user.model');
const { Book, Category, Genre } = require('../models/content.model');
const {
  Comment, Follow, LibraryItem, ReadingProgress, Referral, Reaction, ShareEvent,
} = require('../models/social.model');
const { LedgerEntry, CoinTransaction, Subscription } = require('../models/money.model');
const { AdClick } = require('../models/platform.model');
const { AudienceConfig } = require('../models/marketing.model');

const DAY = 86400000;
function since(days) { return new Date(Date.now() - days * DAY); }
function clamp(n, lo, hi, fb) { n = Number(n); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; }

/* Which collection answers each signal, and which operators it can answer.
   Mirrors public/services/audience-rules.js — keep the two in step. */
const SIGNALS = {
  reactions: { window: true, ops: ['gte'] },
  comments: { window: true, ops: ['gte'] },
  shares: { window: true, ops: ['gte'] },
  saves: { window: true, ops: ['gte'] },
  books_finished: { window: true, ops: ['gte'] },
  chapters_unlocked: { window: true, ops: ['gte'] },
  tip_sent: { window: true, ops: ['gte'] },
  coin_purchase: { window: true, ops: ['gte'] },
  ad_click: { window: true, ops: ['gte'] },
  referrals_converted: { window: true, ops: ['gte'] },
  following_count: { window: false, ops: ['gte'] },
  days_since_active: { window: false, ops: ['gte', 'lte'] },
  account_age_days: { window: false, ops: ['gte', 'lte'] },
  weekly_hours_or_streak: { window: false, ops: ['any'] },
  subscription_active: { window: false, ops: ['eq'] },
  had_subscription: { window: false, ops: ['eq'] },
  is_writer: { window: false, ops: ['eq'] },
};

const DEFAULT_SEGMENTS = [
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

/* ── stored catalog ── */

/* Same clamping the client store applies, so a hand-written or stale record
   cannot reach the evaluator with an operator its signal cannot answer. */
function normalizeSegment(seg) {
  const r = (seg && seg.rule) || {};
  const id = String((seg && seg.id) || '').trim().slice(0, 60);
  const signal = SIGNALS[r.signal] ? r.signal : null;
  if (!id || !signal) return null;
  const def = SIGNALS[signal];
  const raw = r.value;
  const op = def.ops.indexOf(r.op) > -1 ? r.op : def.ops[0];
  const rule = { signal, op };
  if (op === 'eq') rule.value = raw !== false;
  else if (op === 'any') {
    const v = Array.isArray(raw) ? raw : [raw, raw];
    rule.value = [clamp(v[0], 0, 100000, 0), clamp(v[1], 0, 3650, 0)];
  } else rule.value = clamp(raw, 0, 1e7, 0);
  if (def.window) {
    const w = clamp(r.windowDays, 1, 365, 0);
    if (w) rule.windowDays = w;
  }
  const color = /^#[0-9a-fA-F]{6}$/.test(String(seg.color || '')) ? seg.color : '#ff0050';
  return {
    id,
    label: String(seg.label || id).slice(0, 80),
    icon: String(seg.icon || 'fa-users').slice(0, 40),
    color,
    desc: String(seg.desc || '').slice(0, 300),
    rule,
    ...(seg.retired ? { retired: true } : {}),
  };
}
function normalizeList(list) {
  const seen = {};
  return (Array.isArray(list) ? list : []).map(normalizeSegment).filter(s => {
    if (!s || seen[s.id]) return false;
    seen[s.id] = true;
    return true;
  });
}

async function listSegments() {
  const doc = await AudienceConfig.findOne({ key: 'segments' }).lean();
  if (doc && Array.isArray(doc.segments) && doc.segments.length) return normalizeList(doc.segments);
  const seeded = normalizeList(DEFAULT_SEGMENTS);
  await AudienceConfig.updateOne({ key: 'segments' },
    { $set: { segments: seeded } }, { upsert: true }).catch(() => {});
  return seeded;
}

async function saveSegments(list, actor) {
  const clean = normalizeList(list);
  if (!clean.length) throw Object.assign(new Error('At least one segment is required'), { status: 400 });
  await AudienceConfig.updateOne({ key: 'segments' },
    { $set: { segments: clean, updatedBy: String(actor || '') } }, { upsert: true });
  CACHE = { at: 0, data: null };
  return clean;
}

async function resetSegments(actor) {
  const seeded = normalizeList(DEFAULT_SEGMENTS);
  await AudienceConfig.updateOne({ key: 'segments' },
    { $set: { segments: seeded, updatedBy: String(actor || '') } }, { upsert: true });
  CACHE = { at: 0, data: null };
  return seeded;
}

/* ── evaluation ── */

async function distinctUserIds(pipeline, Model) {
  const rows = await Model.aggregate(pipeline);
  return new Set(rows.map(r => String(r._id)).filter(Boolean));
}
function havingCount(field, min) {
  return [{ $group: { _id: '$' + field, n: { $sum: 1 } } }, { $match: { n: { $gte: min } } }];
}
function havingDistinct(field, distinct, min) {
  return [{ $group: { _id: '$' + field, ids: { $addToSet: '$' + distinct } } },
    { $project: { n: { $size: '$ids' } } }, { $match: { n: { $gte: min } } }];
}
function walletIds(set) { return new Set([...set].map(id => id.replace(/^wallet:/, ''))); }
async function complement(matched) {
  const rows = await User.find({ deletedAt: null }).select('_id').lean();
  return new Set(rows.map(u => String(u._id)).filter(id => !matched.has(id)));
}

/* One aggregate per signal, driven entirely by the stored rule. */
async function evaluateRule(rule) {
  const signal = rule && rule.signal;
  const op = (SIGNALS[signal] && rule.op) || 'gte';
  const val = Number(Array.isArray(rule.value) ? rule.value[0] : rule.value) || 0;
  const win = SIGNALS[signal] && SIGNALS[signal].window && rule.windowDays
    ? { createdAt: { $gte: since(clamp(rule.windowDays, 1, 365, 90)) } } : {};

  switch (signal) {
    case 'reactions':
      return distinctUserIds([{ $match: { ...win } }, ...havingCount('userId', val)], Reaction);
    case 'comments':
      return distinctUserIds([{ $match: { ...win } }, ...havingCount('authorId', val)], Comment);
    case 'shares':
      return distinctUserIds([{ $match: { ...win } }, ...havingDistinct('userId', 'targetId', val)], ShareEvent);
    case 'saves':
      return distinctUserIds([{ $match: { list: { $in: ['library', 'saved'] }, ...win } },
        ...havingDistinct('userId', 'storyId', val)], LibraryItem);
    case 'books_finished':
      return distinctUserIds([{ $match: { list: 'history', status: 'finished', ...win } },
        ...havingDistinct('userId', 'storyId', val)], LibraryItem);
    case 'chapters_unlocked': {
      const rows = await LedgerEntry.aggregate([
        { $match: { kind: 'spend', memo: /^unlock ch /, ...win } },
        ...havingDistinct('debitAcct', 'saleId', val),
      ]);
      return walletIds(new Set(rows.map(r => String(r._id))));
    }
    case 'tip_sent': {
      const rows = await LedgerEntry.aggregate([
        { $match: { debitAcct: /^wallet:/, kind: { $in: ['tip', 'gift'] }, ...win } },
        ...havingCount('debitAcct', Math.max(1, val)),
      ]);
      return walletIds(new Set(rows.map(r => String(r._id))));
    }
    case 'coin_purchase':
      return distinctUserIds([{ $match: { type: 'purchase', status: 'completed', ...win } },
        ...havingCount('userId', Math.max(1, val))], CoinTransaction);
    case 'ad_click':
      return distinctUserIds([{ $match: { ...win } }, ...havingCount('userId', Math.max(1, val))], AdClick);
    case 'referrals_converted':
      return distinctUserIds([{ $match: { readRewarded: true, ...win } },
        ...havingCount('ownerId', Math.max(1, val))], Referral);
    case 'following_count':
      return distinctUserIds([...havingCount('followerId', val)], Follow);
    case 'days_since_active': {
      const cutoff = since(val);
      const q = op === 'lte'
        ? { lastLoginAt: { $gte: cutoff } }
        : { $or: [{ lastLoginAt: { $lt: cutoff } }, { lastLoginAt: null, createdAt: { $lt: cutoff } }] };
      const rows = await User.find({ deletedAt: null, ...q }).select('_id').lean();
      return new Set(rows.map(u => String(u._id)));
    }
    case 'account_age_days': {
      const cutoff = since(val);
      const q = op === 'lte' ? { createdAt: { $gte: cutoff } } : { createdAt: { $lt: cutoff } };
      const rows = await User.find({ deletedAt: null, ...q }).select('_id').lean();
      return new Set(rows.map(u => String(u._id)));
    }
    case 'weekly_hours_or_streak': {
      const pair = Array.isArray(rule.value) ? rule.value : [val, val];
      const hrs = Number(pair[0]) || 0, streak = Number(pair[1]) || 0;
      const [heavy, streaky] = await Promise.all([
        hrs ? ReadingProgress.aggregate([
          { $match: { lastReadAt: { $gte: since(7) } } },
          { $group: { _id: '$userId', secs: { $sum: '$secondsSpent' } } },
          { $match: { secs: { $gte: hrs * 3600 } } },
        ]) : [],
        streak ? ReadingProgress.aggregate([
          { $match: { lastReadAt: { $gte: since(Math.max(14, streak * 2)) } } },
          { $group: { _id: { u: '$userId', d: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } } },
          { $group: { _id: '$_id.u', days: { $sum: 1 } } },
          { $match: { days: { $gte: streak } } },
        ]) : [],
      ]);
      return new Set([...heavy, ...streaky].map(r => String(r._id)).filter(Boolean));
    }
    case 'subscription_active': {
      const on = await distinctUserIds([{ $match: { status: 'active' } }, { $group: { _id: '$userId' } }], Subscription);
      return rule.value === false ? complement(on) : on;
    }
    case 'had_subscription': {
      const ever = await distinctUserIds([{ $group: { _id: '$userId' } }], Subscription);
      return rule.value === false ? complement(ever) : ever;
    }
    case 'is_writer': {
      const rows = await User.find({ deletedAt: null, roles: 'writer' }).select('_id').lean();
      const on = new Set(rows.map(u => String(u._id)));
      return rule.value === false ? complement(on) : on;
    }
    default: return new Set();
  }
}

/* Back-compat: count a stored segment by id (used by nothing today, kept so
   a console link can ask for one segment without pulling the whole catalog). */
async function evaluateSegment(id) {
  const seg = (await listSegments()).filter(s => s.id === String(id))[0];
  return seg ? evaluateRule(seg.rule) : new Set();
}

async function genreAudiences() {
  /* The Chief Editor's Genre collection is the only list there is: a genre the
     CE has not created never appears, even if a book carries that string, and
     one with no reads inside the window still appears (count 0) so it can be
     aimed at. Counts are distinct readers per Book.genre in the last 90 days,
     matched case-insensitively so "romance" and "Romance" never split. */
  const curated = await Genre.find({ status: 'active' }).select('name').lean();
  const canonical = {};
  curated.forEach(g => { if (g.name) canonical[String(g.name).toLowerCase()] = g.name; });

  const pairs = await ReadingProgress.aggregate([
    { $match: { lastReadAt: { $gte: since(90) } } },
    { $group: { _id: { u: '$userId', s: '$storyId' } } },
    { $limit: 20000 },
  ]);
  const storyIds = [...new Set(pairs.map(p => String(p._id.s)).filter(Boolean))];
  const gmap = {};
  if (storyIds.length) {
    const hex = storyIds.filter(s => /^[0-9a-fA-F]{24}$/.test(s));
    const books = await Book.find({ id: { $in: storyIds } }).select('genre').lean();
    const legacy = hex.length ? await Book.find({ _id: { $in: hex } }).select('genre').lean() : [];
    [...books, ...legacy].forEach(b => {
      if (b.id) gmap[String(b.id)] = b.genre || '';
      if (b._id) gmap[String(b._id)] = b.genre || '';
    });
  }
  const per = {};
  pairs.forEach(p => {
    const name = canonical[String(gmap[String(p._id.s)] || '').toLowerCase()];
    if (!name) return;
    per[name] = per[name] || new Set();
    per[name].add(String(p._id.u));
  });

  return curated.map(g => ({ name: g.name, count: per[g.name] ? per[g.name].size : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
  const segments = await listSegments();
  const [total, counts, genres] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Promise.all(segments.map(s => evaluateRule(s.rule)
      .then(set => ({ id: s.id, reach: set.size }))
      .catch(() => ({ id: s.id, reach: 0 })))),
    genreAudiences().catch(() => []),
  ]);
  const reachById = {};
  counts.forEach(c => { reachById[c.id] = c.reach; });
  const countries = await countryAudiences(total).catch(() => []);
  const data = {
    segments: segments.map(s => Object.assign({}, s, { reach: reachById[s.id] || 0 })),
    genres, countries, totalReaders: total, cachedAt: new Date().toISOString(),
  };
  CACHE = { at: Date.now(), data };
  return data;
}

/* union estimate mirroring the setup page: overlap discount + country scaling */
async function estimate({ segments, genres, countries }) {
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
  const me = await User.findOne({ $or: [{ id: String(userId) }] }).select('_id').lean().catch(() => null);
  const flavors = me ? [...new Set([String(me.id), String(me._id)])] : [String(userId)];
  const d7 = since(7), d30 = since(30);
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
  // affinity over category + genre + tropes
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

/* ── one reader against the stored rules ──
   The set-based evaluator above answers "how many readers are in this
   segment"; these answer "is this reader in it". Same rule fields, same
   windowing, so the two can never disagree about who qualifies. */

function asObjectId(s) { return /^[0-9a-fA-F]{24}$/.test(String(s)) ? String(s) : null; }

/* Readers exist under both a public `id` and a legacy `_id`; every event
   collection has written one or the other over the life of the app, so a
   match is always against the set of both. */
async function userContext(userId) {
  const q = [{ id: String(userId) }];
  const hex = asObjectId(userId);
  if (hex) q.push({ _id: hex });
  const me = await User.findOne({ $or: q }).select('_id id lastLoginAt createdAt roles').lean().catch(() => null);
  const flavors = [String(userId)];
  if (me) { if (me._id) flavors.push(String(me._id)); if (me.id) flavors.push(String(me.id)); }
  const uniq = [...new Set(flavors.filter(Boolean))];
  const now = Date.now();
  const born = me ? new Date(me.createdAt).getTime() : now;
  const last = me && me.lastLoginAt ? new Date(me.lastLoginAt).getTime() : born;
  return {
    flavors: uniq,
    wallets: uniq.map(f => 'wallet:' + f),
    me,
    daysSinceActive: Math.max(0, Math.floor((now - last) / DAY)),
    accountAgeDays: Math.max(0, Math.floor((now - born) / DAY)),
    isWriter: !!(me && Array.isArray(me.roles) && me.roles.indexOf('writer') > -1),
  };
}

/* Distinct active days in the window — deliberately the same math the
   set-based `weekly_hours_or_streak` case uses, even though it is "days
   read" rather than a strictly consecutive run. */
async function streakDays(uid, from) {
  const rows = await ReadingProgress.aggregate([
    { $match: { userId: uid, lastReadAt: { $gte: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } },
  ]);
  return rows.length;
}

async function matchesUserRule(rule, ctx) {
  const signal = rule && rule.signal;
  const def = SIGNALS[signal];
  if (!def) return false;
  const op = def.ops.indexOf(rule.op) > -1 ? rule.op : def.ops[0];
  const raw = rule.value;
  const val = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const uid = ctx.flavors, wallets = ctx.wallets;
  const win = def.window && rule.windowDays
    ? { createdAt: { $gte: since(clamp(rule.windowDays, 1, 365, 90)) } } : {};
  const passes = (n) => n >= Math.max(0, val);
  const want = raw !== false;

  switch (signal) {
    case 'reactions': return passes(await Reaction.countDocuments({ userId: uid, ...win }));
    case 'comments': return passes(await Comment.countDocuments({ authorId: uid, ...win }));
    case 'shares': return passes((await ShareEvent.distinct('targetId', { userId: uid, ...win })).length);
    case 'saves': return passes((await LibraryItem.distinct('storyId',
      { userId: uid, list: { $in: ['library', 'saved'] }, ...win })).length);
    case 'books_finished': return passes((await LibraryItem.distinct('storyId',
      { userId: uid, list: 'history', status: 'finished', ...win })).length);
    case 'chapters_unlocked': return passes((await LedgerEntry.distinct('saleId',
      { debitAcct: wallets, kind: 'spend', memo: /^unlock ch /, ...win })).length);
    case 'tip_sent': return passes(await LedgerEntry.countDocuments(
      { debitAcct: wallets, kind: { $in: ['tip', 'gift'] }, ...win }));
    case 'coin_purchase': return passes(await CoinTransaction.countDocuments(
      { userId: uid, type: 'purchase', status: 'completed', ...win }));
    case 'ad_click': return passes(await AdClick.countDocuments({ userId: uid, ...win }));
    case 'referrals_converted': return passes(await Referral.countDocuments(
      { ownerId: uid, readRewarded: true, ...win }));
    case 'following_count': return passes(await Follow.countDocuments({ followerId: uid }));
    case 'days_since_active': return op === 'lte' ? ctx.daysSinceActive <= val : ctx.daysSinceActive >= val;
    case 'account_age_days': return op === 'lte' ? ctx.accountAgeDays <= val : ctx.accountAgeDays >= val;
    case 'weekly_hours_or_streak': {
      const pair = Array.isArray(raw) ? raw : [val, val];
      const hrs = Number(pair[0]) || 0, streak = Number(pair[1]) || 0;
      const sums = await ReadingProgress.aggregate([
        { $match: { userId: uid, lastReadAt: { $gte: since(7) } } },
        { $group: { _id: null, secs: { $sum: '$secondsSpent' } } },
      ]);
      if (sums.length && (sums[0].secs || 0) / 3600 >= hrs) return true;
      return streak ? (await streakDays(uid, since(Math.max(14, streak * 2)))) >= streak : false;
    }
    case 'subscription_active': return ((await Subscription.countDocuments({ userId: uid, status: 'active' })) > 0) === want;
    case 'had_subscription': return ((await Subscription.countDocuments({ userId: uid })) > 0) === want;
    case 'is_writer': return ctx.isWriter === want;
    default: return false;
  }
}

/* Which segments one reader matches, from the same stored rules the console
   edits — the client-side matcher and the backend cannot drift. */
async function segmentsForUser(userId) {
  const ctx = await userContext(userId);
  const out = [];
  for (const s of await listSegments()) {
    try { if (await matchesUserRule(s.rule, ctx)) out.push(s.id); } catch (e) { /* a broken rule excludes, never crashes */ }
  }
  return out;
}

/* Reader's own view of the same vocabulary the catalog is written in.
   Mirrors the keys public/services/audience-service.js computes locally,
   so a page can swap one for the other without changing a rule. */
async function userSignals(userId) {
  const ctx = await userContext(userId);
  const uid = ctx.flavors, wallets = ctx.wallets;
  const d7 = since(7);
  const read = await ReadingProgress.find({ userId: uid, lastReadAt: { $gte: d7 } }).select('secondsSpent').lean();
  const [reactions, comments, shares, saves, finished, unlocks, tips, coins, clicks, refers, follows, subs, everSub] = await Promise.all([
    Reaction.countDocuments({ userId: uid }),
    Comment.countDocuments({ authorId: uid }),
    ShareEvent.distinct('targetId', { userId: uid }),
    LibraryItem.distinct('storyId', { userId: uid, list: { $in: ['library', 'saved'] } }),
    LibraryItem.distinct('storyId', { userId: uid, list: 'history', status: 'finished' }),
    LedgerEntry.distinct('saleId', { debitAcct: wallets, kind: 'spend', memo: /^unlock ch / }),
    LedgerEntry.countDocuments({ debitAcct: wallets, kind: { $in: ['tip', 'gift'] } }),
    CoinTransaction.countDocuments({ userId: uid, type: 'purchase', status: 'completed' }),
    AdClick.countDocuments({ userId: uid }),
    Referral.countDocuments({ ownerId: uid, readRewarded: true }),
    Follow.countDocuments({ followerId: uid }),
    Subscription.countDocuments({ userId: uid, status: 'active' }),
    Subscription.countDocuments({ userId: uid }),
  ]);
  return {
    reactions,
    comments,
    shares: shares.length,
    saves: saves.length,
    chapters_unlocked: unlocks.length,
    tip_sent: tips,
    coin_purchase: coins,
    ad_click: clicks,
    referrals_converted: refers,
    following_count: follows,
    books_finished: finished.length,
    weekly_hours_or_streak: [
      +(read.reduce((n, r) => n + (Number(r.secondsSpent) || 0), 0) / 3600).toFixed(1),
      await streakDays(uid, since(14)),
    ],
    subscription_active: subs > 0,
    had_subscription: everSub > 0,
    is_writer: ctx.isWriter,
    days_since_active: ctx.daysSinceActive,
    account_age_days: ctx.accountAgeDays,
  };
}

async function audienceMe(userId) {
  const [segments, signals] = await Promise.all([segmentsForUser(userId), userSignals(userId)]);
  return { segments, signals, at: new Date().toISOString() };
}

module.exports = {
  SIGNALS, DEFAULT_SEGMENTS, listSegments, saveSegments, resetSegments,
  evaluateRule, evaluateSegment, catalog, estimate,
  segmentsForUser, userSignals, audienceMe, readingProfile,
};
