'use strict';
// Reader activity tracking: content impressions ("which posts did this
// reader see"), search queries, per-user ad exposure rollups, and page
// insights (InsightHit — shared/insights-tracker.js hit streams). All
// writes are fire-and-forget style — tracking never breaks the action
// that triggered it.
const mongoose = require('mongoose');
const { ContentImpression, InsightHit, InsightVisitor, Discussion, ReadingProgress } = require('../models/social.model');
const { SearchLog, AdView, AdClick } = require('../models/platform.model');
const DAY = 864e5;
const WEEK = 7 * DAY;

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function today() { return new Date().toISOString().slice(0, 10); }

// POST /api/track/impression {targetType, targetId} — logged-in only
// (per-user trail needs an identity; anonymous views stay untracked).
async function impression({ userId, targetType, targetId }) {
  if (!userId) err('auth_required', 401);
  if (!['post', 'discussion', 'story'].includes(targetType)) err('bad_target', 400);
  if (!targetId) err('no_target', 400);
  await ContentImpression.updateOne(
    { userId: String(userId), targetType, targetId: String(targetId), day: today() },
    { $inc: { count: 1 } },
    { upsert: true },
  ).catch(() => {});
  return { ok: true };
}

// Called from the search route after results are computed (q/type/results).
async function logSearch({ userId, q, type, results }) {
  const query = String(q || '').trim().slice(0, 80);
  if (!query) return { skipped: true };
  SearchLog.create({ userId: String(userId || ''), q: query, type: String(type || ''), results: results || 0 })
    .catch(() => {});
  return { ok: true };
}

// My activity rollup — impressions by target, search count, ads seen.
async function myActivity({ userId }) {
  const day = today();
  const [impPosts, impDiscussions, impStories, searches, adsSeen, adClicks] = await Promise.all([
    ContentImpression.countDocuments({ userId, targetType: 'post' }),
    ContentImpression.countDocuments({ userId, targetType: 'discussion' }),
    ContentImpression.countDocuments({ userId, targetType: 'story' }),
    SearchLog.countDocuments({ userId }),
    AdView.countDocuments({ userId }),
    AdClick.countDocuments({ userId }),
  ]);
  return {
    impressions: { posts: impPosts, discussions: impDiscussions, stories: impStories, total: impPosts + impDiscussions + impStories },
    searches, adsSeen, adClicks, day,
  };
}

// Which content this reader saw, newest first (admin investigations +
// "continue where you left off" style features).
async function impressionsFor({ userId, targetType, page, limit }) {
  const filter = { userId: String(userId) };
  if (targetType) filter.targetType = targetType;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const [items, total] = await Promise.all([
    ContentImpression.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    ContentImpression.countDocuments(filter),
  ]);
  return { items: items.map(r => ({ targetType: r.targetType, targetId: r.targetId, day: r.day, count: r.count, at: r.createdAt })), total, page: pg, limit: lim };
}

// This reader's search trail (their own history).
async function searchesFor({ userId, page, limit }) {
  const filter = { userId: String(userId) };
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    SearchLog.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    SearchLog.countDocuments(filter),
  ]);
  return { items: items.map(r => ({ q: r.q, type: r.type, results: r.results, at: r.createdAt })), total, page: pg, limit: lim };
}

// Trending search terms (admin/marketing: what readers hunt for).
async function trendingSearches({ limit }) {
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const since = new Date(Date.now() - 7 * 86400000);
  const rows = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: since }, q: { $ne: '' } } },
    { $group: { _id: '$q', n: { $sum: 1 }, zero: { $sum: { $cond: [{ $eq: ['$results', 0] }, 1, 0] } } } },
    { $sort: { n: -1 } },
    { $limit: lim },
  ]);
  return { items: rows.map(r => ({ q: r._id, count: r.n, zeroResults: r.zero })) };
}

// Public shape for the search overlay's Trending list ({q, meta, fire}).
async function publicTrending({ limit }) {
  const lim = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));
  const out = await trendingSearches({ limit: lim });
  return {
    items: out.items.slice(0, lim).map((r, i) => ({
      q: r.q,
      meta: r.count + ' searches this week',
      fire: i < 3,
    })),
  };
}

// ── Platform rollup ────────────────────────────────────────────────────────
// GET /api/track/platform?days=30 → {
//   days,
//   pageviews: { bySurface: { hub, droboard, profile, collection }, storyReads },
//   returningReaderRate: { pct, definition, windowDays },
//   activeUsers: { dau, wau, mau, definition },
//   countries: [{ country, reads }],
// }
// InsightHit (hub|droboard|profile|collection) carries surface + country + day;
// ReadingProgress carries userId + lastReadAt for story reads.
async function platformStats({ days }) {
  const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const since = new Date(Date.now() - n * 864e5);
  const sinceDay = since.toISOString().slice(0, 10);

  const [surfaceRows, countryRows, readRows, dayRows, weekRows, monthRows] = await Promise.all([
    // 1) pageviews per surface (InsightHit.count summed)
    InsightHit.aggregate([
      { $match: { day: { $gte: sinceDay } } },
      { $group: { _id: '$surface', pageviews: { $sum: '$count' } } },
    ]),
    // 2) country mix on reads (InsightHit.country)
    InsightHit.aggregate([
      { $match: { day: { $gte: sinceDay }, country: { $nin: ['', null] } } },
      { $group: { _id: '$country', reads: { $sum: '$count' } } },
      { $sort: { reads: -1 } },
      { $limit: 20 },
    ]),
    // 3) returning reader rate: users with ≥2 read-days vs users with ≥1 read-day
    ReadingProgress.aggregate([
      { $match: { lastReadAt: { $gte: since } } },
      { $group: { _id: '$userId', days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } } },
      { $project: { dayCount: { $size: '$days' } } },
    ]),
    // 4) DAU — one bucket per calendar day
    InsightHit.aggregate([
      { $match: { day: { $gte: sinceDay }, userId: { $ne: null } } },
      { $group: { _id: '$day', users: { $addToSet: '$userId' } } },
      { $project: { dau: { $size: '$users' } } },
      { $sort: { _id: 1 } },
    ]),
    // 5) WAU — 7-day ISO week bucket (YYYY-WW from day string)
    InsightHit.aggregate([
      { $match: { day: { $gte: sinceDay }, userId: { $ne: null } } },
      { $group: { _id: { $substr: ['$day', 0, 8] }, users: { $addToSet: '$userId' } } },
      { $project: { wau: { $size: '$users' } } },
      { $sort: { _id: 1 } },
    ]),
    // 6) MAU — YYYY-MM month bucket
    InsightHit.aggregate([
      { $match: { day: { $gte: sinceDay }, userId: { $ne: null } } },
      { $group: { _id: { $substr: ['$day', 0, 7] }, users: { $addToSet: '$userId' } } },
      { $project: { mau: { $size: '$users' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const bySurface = {};
  surfaceRows.forEach(r => { bySurface[r._id] = r.pageviews; });
  ['hub', 'droboard', 'profile', 'collection'].forEach(k => { if (bySurface[k] === undefined) bySurface[k] = 0; });

  const totalReaders = readRows.length;
  const returningReaders = readRows.filter(r => r.dayCount >= 2).length;
  const returningReaderRate = totalReaders ? Math.round((returningReaders / totalReaders) * 1000) / 10 : 0;

  return {
    days: n,
    pageviews: {
      bySurface,
      total: Object.values(bySurface).reduce((a, b) => a + b, 0),
    },
    returningReaderRate: {
      pct: returningReaderRate,
      returningReaders, totalReaders, windowDays: n,
      definition: 'readers with >=2 distinct read-days in the window',
    },
    activeUsers: {
      dau: dayRows.map(r => ({ day: r._id, users: r.dau })),
      wau: weekRows.map(r => ({ week: r._id, users: r.wau })),
      mau: monthRows.map(r => ({ month: r._id, users: r.mau })),
      definition: {
        dau: 'distinct signed-in users with an InsightHit on any surface that calendar day (UTC)',
        wau: 'distinct signed-in users in a YYYY-WW bucket',
        mau: 'distinct signed-in users in a YYYY-MM bucket',
      },
    },
    countries: countryRows.map(r => ({ country: String(r._id).toUpperCase(), reads: r.reads })),
  };
}

module.exports = { impression, logSearch, myActivity, impressionsFor, searchesFor, trendingSearches, publicTrending, insightHit, insightStats, platformStats, uniqueVisits };

/* ── Page insights (insights-service.js loadInsights contract) ──
   POST /api/track/insight {surface, targetId?, country?} — one hit.
   GET  /api/track/insight?surface=&targetId=&period=7d —
     { visits, visitsPrev, series: [n per bucket], countries: [{country, n}] }
   The frontend merges demo + live, so both shapes stay additive. */
const SURFACES = ['hub', 'droboard', 'profile', 'collection'];

async function insightHit({ userId, surface, targetId, country, deviceId }) {
  if (!SURFACES.includes(surface)) err('bad_surface', 400);
  // Profile targets are handles: one row per handle, so they are lowercased.
  let tid = String(targetId || '');
  if (surface === 'profile') tid = tid.toLowerCase();
  const hour = new Date().getUTCHours();
  const cc = String(country || '').trim().replace(/[.$]/g, '_').slice(0, 40);
  const inc = { count: 1, ['hours.' + hour]: 1 };
  if (cc) inc['countries.' + cc] = 1;
  await InsightHit.updateOne(
    { surface, targetId: tid, day: today(), userId: userId ? String(userId) : null },
    { $inc: inc, $set: { country: cc } },
    { upsert: true },
  ).catch(() => {});
  await touchUnique({ surface, targetId: tid, userId, deviceId });
  return { ok: true };
}

// A reload storm is one visit, not fifty: the same reader only counts again
// after UNIQUE_WINDOW_MS of silence. Window in one place so the reader-facing
// label and the write agree.
const UNIQUE_WINDOW_MS = 20 * 60 * 1000;

async function touchUnique({ surface, targetId, userId, deviceId }) {
  const visitorKey = userId ? 'u:' + String(userId)
    : (deviceId ? 'd:' + String(deviceId).replace(/[.$]/g, '_').slice(0, 80) : '');
  if (!visitorKey) return false;
  const now = new Date();
  const day = today();
  const filter = { surface, targetId, visitorKey };
  try {
    // Out-of-window visitor: count and stamp in one atomic write, so two
    // simultaneous hits from the same device cannot both pass the check.
    const bumped = await InsightVisitor.findOneAndUpdate(
      Object.assign({}, filter, { lastSeenAt: { $lte: new Date(now.getTime() - UNIQUE_WINDOW_MS) } }),
      { $inc: { visits: 1, ['days.' + day]: 1 }, $set: { lastSeenAt: now } },
      { new: true },
    );
    if (bumped) return true;
    // null here means either "seen inside the window" or "never seen".
    const seen = await InsightVisitor.exists(filter);
    if (seen) return false;
    await InsightVisitor.updateOne(filter,
      { $inc: { visits: 1, ['days.' + day]: 1 }, $set: { lastSeenAt: now } },
      { upsert: true });
    return true;
  } catch (e) {
    // Tracking never breaks the page that triggered it. A lost unique count is
    // visible as a low number, which is better than a failed hit.
    return false;
  }
}

// Summed counted visits + distinct visitors over a UTC day range, sliced from
// each visitor row's `days` map.
async function uniqueVisits({ surface, targetIds, fromDay, toDay }) {
  const filter = { surface };
  if (targetIds && targetIds.length) filter.targetId = { $in: targetIds.map(String) };
  let counted = 0;
  let visitors = 0;
  try {
    const rows = await InsightVisitor.find(filter).select('days').lean();
    rows.forEach(r => {
      let hit = 0;
      const days = r.days || {};
      Object.keys(days).forEach(d => {
        if (fromDay && d < fromDay) return;
        if (toDay && d > toDay) return;
        hit += Number(days[d]) || 0;
      });
      if (hit > 0) { counted += hit; visitors++; }
    });
  } catch (e) { /* same rule: a read that fails shows 0, not a 500 */ }
  return { unique: counted, uniqueVisitors: visitors };
}

// Day-count buckets matching insights-service.js chartBuckets lengths.
const PERIOD_DAYS = { today: 1, '7d': 7, month: 30, all: 0 };

async function insightStats({ surface, targetId, period }) {
  if (!SURFACES.includes(surface)) err('bad_surface', 400);
  const tid = String(targetId || '');
  const days = PERIOD_DAYS[period];
  if (days == null) err('bad_period', 400);
  const filter = { surface, targetId: tid };

  const match = days ? { createdAt: { $gte: new Date(Date.now() - days * 864e5) } } : {};
  const rows = await InsightHit.aggregate([
    { $match: Object.assign({}, filter, match) },
    {
      $group: {
        _id: '$day',
        visits: { $sum: '$count' },
        mixes: { $push: '$countries' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const byDay = {};
  let visits = 0;
  const countryCounts = {};
  rows.forEach(r => {
    byDay[r._id] = r.visits;
    visits += r.visits;
    (r.mixes || []).forEach(mix => {
      Object.keys(mix || {}).forEach(c => { countryCounts[c] = (countryCounts[c] || 0) + (Number(mix[c]) || 0); });
    });
  });

  // Previous window for the delta (same length immediately before).
  const prevMatch = days ? { createdAt: {
    $gte: new Date(Date.now() - 2 * days * 864e5),
    $lt: new Date(Date.now() - days * 864e5),
  } } : null;
  let visitsPrev = -1; // -1 = unknown → frontend hides delta
  if (prevMatch) {
    const prev = await InsightHit.aggregate([
      { $match: Object.assign({}, filter, prevMatch) },
      { $group: { _id: null, v: { $sum: '$count' } } },
    ]);
    visitsPrev = prev[0] ? prev[0].v : 0;
  }

  // Buckets oldest→newest across the window (today → 1 bucket; 7d → 7; month → 30).
  const series = [];
  if (days) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      series.push(byDay[d] || 0);
    }
  } else {
    // all-time: compress to 30 weekly buckets
    const allRows = await InsightHit.aggregate([
      { $match: filter },
      { $group: { _id: { $substr: ['$day', 0, 7] }, v: { $sum: '$count' } } },
      { $sort: { _id: 1 } },
    ]);
    const weekly = {};
    allRows.forEach(r => { weekly[r._id] = r.v; });
    const keys = Object.keys(weekly).sort().slice(-30);
    keys.forEach(k => series.push(weekly[k]));
    if (!series.length) series.push(0);
  }

  const countries = Object.keys(countryCounts).map(c => ({ country: c, n: countryCounts[c] }))
    .sort((a, b) => b.n - a.n).slice(0, 5);

  const fromDay = days ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : '';
  const toDay = today();
  const cur = await uniqueVisits({ surface, targetIds: [tid], fromDay, toDay });
  let uniquePrev = null;
  if (days) {
    const pFrom = new Date(Date.now() - 2 * days * 864e5).toISOString().slice(0, 10);
    const pTo = new Date(Date.now() - (days + 1) * 864e5).toISOString().slice(0, 10);
    uniquePrev = (await uniqueVisits({ surface, targetIds: [tid], fromDay: pFrom, toDay: pTo })).unique;
  }

  return {
    surface, targetId: tid, period: period || 'all',
    visits, visitsPrev, series, countries,
    unique: cur.unique, uniqueVisitors: cur.uniqueVisitors, uniquePrev,
    uniqueWindowMinutes: UNIQUE_WINDOW_MS / 60000,
  };
}
