'use strict';
// Reader activity tracking: content impressions ("which posts did this
// reader see"), search queries, and per-user ad exposure rollups. All
// writes are fire-and-forget style — tracking never breaks the action
// that triggered it.
const { ContentImpression } = require('../models/social.model');
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

module.exports = { impression, logSearch, myActivity, impressionsFor, searchesFor, trendingSearches, publicTrending };
