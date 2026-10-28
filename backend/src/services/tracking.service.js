'use strict';
// Reader activity tracking: content impressions ("which posts did this
// reader see"), search queries, per-user ad exposure rollups, and page
// insights (InsightHit — shared/insights-tracker.js hit streams). All
// writes are fire-and-forget style — tracking never breaks the action
// that triggered it.
const { ContentImpression, InsightHit } = require('../models/social.model');
const { SearchLog, AdView, AdClick } = require('../models/platform.model');

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

module.exports = { impression, logSearch, myActivity, impressionsFor, searchesFor, trendingSearches, publicTrending, insightHit, insightStats };

/* ── Page insights (insights-service.js loadInsights contract) ──
   POST /api/track/insight {surface, targetId?, country?} — one hit.
   GET  /api/track/insight?surface=&targetId=&period=7d —
     { visits, visitsPrev, series: [n per bucket], countries: [{country, n}] }
   The frontend merges demo + live, so both shapes stay additive. */
const SURFACES = ['hub', 'droboard', 'profile', 'collection'];

async function insightHit({ userId, surface, targetId, country }) {
  if (!SURFACES.includes(surface)) err('bad_surface', 400);
  const tid = String(targetId || '');
  await InsightHit.updateOne(
    { surface, targetId: tid, day: today(), userId: userId ? String(userId) : null },
    { $inc: { count: 1 }, $set: { country: String(country || '').slice(0, 40) } },
    { upsert: true },
  ).catch(() => {});
  return { ok: true };
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
        countries: { $push: '$country' },
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
    (r.countries || []).forEach(c => { if (c) countryCounts[c] = (countryCounts[c] || 0) + 1; });
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

  return { surface, targetId: tid, period: period || 'all', visits, visitsPrev, series, countries };
}
