'use strict';
/* insights.service.js — live numbers for the Insights page (insights.html).
   One payload shape for every surface so insights-service.js renders them
   all the same way:
     { title, sub, hero:{label,v,delta,sub}, chartTitle, chartNote,
       series:[n], cards:[{label,v,s:{t,cls}}],
       list:{title,icon,items:[{n,s,v,href}]}, countries:[{country,n}] }
   Page visits come from InsightHit (written by POST /api/track/insight, one
   row per surface/target/day/reader with an hourly breakdown). Everything
   else is a real count over the same window — no seeded numbers. */
const { Book, Category, Genre, CategoryMembership, BookDailyStat } = require('../models/content.model');
const {
  Discussion, Comment, Post, Collection, CollectionFollow,
  InsightHit, Follow, Reaction, LibraryItem, ReadingProgress,
} = require('../models/social.model');
const { User } = require('../models/user.model');
const track = require('./tracking.service');

const DAY = 864e5;
const PERIODS = ['today', '7d', 'month', 'all'];
const PERIOD_N = { today: 6, '7d': 7, month: 10, all: 6 };
const STAFF = ['admin', 'super_admin', 'chief_editor', 'senior_editor', 'editor', 'moderator', 'support', 'marketing', 'finance'];

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }
function isStaff(user) { return !!(user && (user.roles || []).some(r => STAFF.includes(String(r)))); }
function normalizePeriod(p) { const s = String(p || '7d'); return PERIODS.includes(s) ? s : '7d'; }
function pLabel(p) { return p === 'today' ? 'today' : p === '7d' ? 'last 7 days' : p === 'month' ? 'last 30 days' : 'all time'; }
function fmtK(n) { n = Math.round(n || 0); if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; return String(n); }
function deltaPct(cur, prev) { if (prev == null || prev < 0) return null; if (!prev && !cur) return 0; if (!prev) return 100; return Math.round(((cur - prev) / prev) * 100); }
function cardNote(d, flatTxt) {
  if (d === null) return { t: flatTxt || 'cumulative', cls: 'flat' };
  if (d > 0) return { t: '+' + d + '% vs prev', cls: 'up' };
  if (d < 0) return { t: d + '% vs prev', cls: 'down' };
  return { t: flatTxt || 'steady', cls: 'flat' };
}

// One counted visit per reader per 20 minutes (tracking.service). The flat
// note names how many separate readers that is, so "12 unique / 3 visitors"
// reads as 12 windowed visits by 3 people — not as a contradiction.
function uniqCard(vis) {
  const n = vis.uniqueVisitors || 0;
  return {
    label: 'Unique visits',
    v: fmtK(vis.unique),
    s: cardNote(deltaPct(vis.unique, vis.uniquePrev), n + (n === 1 ? ' visitor' : ' visitors')),
  };
}

/* ── window math ──
   Windows are counted in UTC day indexes (days since epoch) so the day
   strings stored on InsightHit can be compared and bucketed without any
   timezone drift. The bucket shapes match insights-service.js chartBuckets:
   today = 6×4h, 7d = 7 days, month = 10×3 days, all = last 6 months. */
function todayIdx() {
  const n = new Date();
  return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / DAY);
}
function dayStr(idx) { return new Date(idx * DAY).toISOString().slice(0, 10); }
function dayIndex(day) { return Math.floor(Date.parse(day + 'T00:00:00Z') / DAY); }
function monthIndex(day) { const d = new Date(day + 'T00:00:00Z'); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }

function periodWindow(period) {
  const t = todayIdx();
  if (period === 'today') return { cur: [t, t + 1], prev: [t - 1, t], n: 6, kind: 'hour' };
  if (period === '7d') return { cur: [t - 6, t + 1], prev: [t - 13, t - 6], n: 7, kind: 'day' };
  if (period === 'month') return { cur: [t - 29, t + 1], prev: [t - 59, t - 29], n: 10, kind: 'day' };
  return { cur: [0, Infinity], prev: null, n: 6, kind: 'month' };
}
// createdAt filter for real content rows (posts, books, comments).
function createdFilter(w) {
  if (!w.cur[0]) return {};
  return { createdAt: { $gte: new Date(w.cur[0] * DAY), $lte: new Date() } };
}
function prevCreatedFilter(w) {
  if (!w.prev) return {};
  return { createdAt: { $gte: new Date(w.prev[0] * DAY), $lt: new Date(w.prev[1] * DAY) } };
}

/* ── visit counters (InsightHit) ── */
async function hitRows({ surface, targetIds, from, to }) {
  const filter = { surface };
  if (targetIds && targetIds.length) filter.targetId = { $in: targetIds.map(String) };
  const day = { $gte: dayStr(from) };
  if (to !== Infinity) day.$lte = dayStr(to - 1);
  filter.day = day;
  const rows = await InsightHit.aggregate([
    { $match: filter },
    { $group: { _id: '$day', total: { $sum: '$count' }, hours: { $push: '$hours' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map(r => ({
    day: r._id,
    total: r.total || 0,
    hours: (r.hours || []).filter(Boolean),
  }));
}

function buildSeries(period, rows) {
  const w = periodWindow(period);
  const out = new Array(PERIOD_N[period]).fill(0);
  rows.forEach(r => {
    const di = dayIndex(r.day);
    if (period === 'today') {
      if (di !== w.cur[0]) return;
      const hours = {};
      r.hours.forEach(m => Object.keys(m || {}).forEach(k => { hours[k] = (hours[k] || 0) + (Number(m[k]) || 0); }));
      Object.keys(hours).forEach(k => {
        const b = Math.floor(Number(k) / 4);
        if (b >= 0 && b < out.length) out[b] += hours[k];
      });
      return;
    }
    if (period === 'all') {
      const now = new Date();
      const base = now.getUTCFullYear() * 12 + now.getUTCMonth() - 5;
      const b = monthIndex(r.day) - base;
      if (b >= 0 && b < out.length) out[b] += r.total;
      return;
    }
    const b = period === '7d' ? di - w.cur[0] : Math.floor((di - w.cur[0]) / 3);
    if (b >= 0 && b < out.length) out[b] += r.total;
  });
  return out;
}

async function countryRows({ surface, targetIds, from, to }) {
  const filter = { surface };
  if (targetIds && targetIds.length) filter.targetId = { $in: targetIds.map(String) };
  const day = { $gte: dayStr(from) };
  if (to !== Infinity) day.$lte = dayStr(to - 1);
  filter.day = day;
  const rows = await InsightHit.aggregate([
    { $match: filter },
    { $group: { _id: null, mixes: { $push: '$countries' } } },
  ]);
  const totals = {};
  (rows[0] && rows[0].mixes || []).forEach(mix => {
    Object.keys(mix || {}).forEach(k => { totals[k] = (totals[k] || 0) + (Number(mix[k]) || 0); });
  });
  return Object.keys(totals)
    .map(k => ({ country: k, n: totals[k] }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}

// The whole visit block every surface reuses.
async function visits({ surface, targetIds, period }) {
  const w = periodWindow(period);
  const rows = await hitRows({ surface, targetIds, from: w.cur[0], to: w.cur[1] });
  const series = buildSeries(period, rows);
  const total = rows.reduce((a, r) => a + r.total, 0);
  let prev = null;
  if (w.prev) {
    const prevRows = await hitRows({ surface, targetIds, from: w.prev[0], to: w.prev[1] });
    prev = prevRows.reduce((a, r) => a + r.total, 0);
  }
  const countries = await countryRows({ surface, targetIds, from: w.cur[0], to: w.cur[1] });
  // Unique = the same reader counted once per 20 minutes (tracking.service).
  // '' bounds mean "open-ended", which is what the all-time window is.
  const dayRange = (from, to) => ({
    fromDay: from > 0 ? dayStr(from) : '',
    toDay: to === Infinity ? '' : dayStr(to - 1),
  });
  const cur = await track.uniqueVisits(Object.assign(
    { surface, targetIds }, dayRange(w.cur[0], w.cur[1])));
  let uniquePrev = null;
  if (w.prev) {
    uniquePrev = (await track.uniqueVisits(Object.assign(
      { surface, targetIds }, dayRange(w.prev[0], w.prev[1])))).unique;
  }
  return {
    visits: total, visitsPrev: prev, series, countries,
    unique: cur.unique, uniqueVisitors: cur.uniqueVisitors, uniquePrev,
  };
}

async function usersByIds(ids, select) {
  const list = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!list.length) return {};
  const rows = await User.find({ id: { $in: list } }).select(select).lean();
  const map = {};
  rows.forEach(u => { map[String(u.id)] = u; });
  return map;
}
function nameOf(u) { return (u && (u.fullName || u.username)) || 'someone'; }

/* ── board (hub) ── */
async function getHubStats({ slug, period, viewer }) {
  const p = normalizePeriod(period);
  const key = String(slug || '').trim();
  if (!key) err('bad_board', 400);
  const lower = key.toLowerCase();

  let cat = null;
  const genre = await Genre.findOne({ $or: [{ slug: lower }, { id: key }] }).lean();
  if (genre) cat = await Category.findOne({ id: genre.categoryId }).lean();
  if (!cat) cat = await Category.findOne({ $or: [{ slug: lower }, { id: key }] }).lean();
  if (!cat) err('not_found', 404);

  const crew = [...(cat.adminIds || []), ...(cat.moderatorIds || [])].map(String);
  const isCrew = !!(viewer && crew.includes(String(viewer.id)));
  if (!isStaff(viewer) && !isCrew) err('forbidden', 403);

  const genres = await Genre.find({ categoryId: cat.id }).select('id slug name').lean();
  const genreIds = genres.map(g => String(g.id));
  const genreSlug = {};
  genres.forEach(g => { genreSlug[String(g.id)] = g.slug; });
  const targetIds = [String(cat.id), String(cat.slug)]
    .concat(genres.map(g => String(g.id)), genres.map(g => String(g.slug)))
    .filter(Boolean);

  const w = periodWindow(p);
  const cur = createdFilter(w);
  const prev = prevCreatedFilter(w);

  const [vis, posts, postsPrev, threads, threadsPrev, members, discussions, threadIds] = await Promise.all([
    visits({ surface: 'hub', targetIds, period: p }),
    Discussion.countDocuments(Object.assign({ genreId: { $in: genreIds } }, cur)),
    Discussion.countDocuments(Object.assign({ genreId: { $in: genreIds } }, prev)),
    Book.countDocuments(Object.assign({ categoryId: cat.id }, cur)),
    Book.countDocuments(Object.assign({ categoryId: cat.id }, prev)),
    CategoryMembership.countDocuments({ categoryId: cat.id }),
    Discussion.find(Object.assign({ genreId: { $in: genreIds } }, cur)).sort({ likes: -1, createdAt: -1 }).limit(5).lean(),
    Discussion.find(Object.assign({ genreId: { $in: genreIds } }, cur)).distinct('id'),
  ]);

  const replies = threadIds.length
    ? await Comment.countDocuments(Object.assign({ scope: 'discussion', discussionId: { $in: threadIds.map(String) } }, cur))
    : 0;
  const authors = await usersByIds(discussions.map(d => d.authorId), 'id username fullName');
  const topPosts = discussions.map(d => ({
    n: d.title || 'Untitled',
    s: 'by ' + nameOf(authors[String(d.authorId)]),
    v: (d.likes || 0) + ' likes',
    href: 'discussion.html?genre=' + encodeURIComponent(genreSlug[String(d.genreId)] || '') + '&id=' + encodeURIComponent(String(d.id)),
  }));

  return {
    title: (cat.name || 'Board') + ' hub',
    sub: 'Hub insights · ' + pLabel(p),
    hero: {
      label: 'Board views',
      v: String(vis.visits),
      delta: deltaPct(vis.visits, vis.visitsPrev),
      sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
    },
    chartTitle: 'Page visits & activity',
    chartNote: '',
    series: vis.series,
    cards: [
      uniqCard(vis),
      { label: 'Posts', v: String(posts), s: cardNote(deltaPct(posts, postsPrev)) },
      { label: 'Replies', v: String(replies), s: { t: 'total', cls: 'flat' } },
      { label: 'New stories', v: String(threads), s: cardNote(deltaPct(threads, threadsPrev)) },
      { label: 'Members', v: String(members), s: { t: 'total', cls: 'flat' } },
    ],
    list: { title: 'Top posts', icon: 'fa-fire', items: topPosts },
    countries: vis.countries,
  };
}

/* ── profile (owner's own numbers) ── */
async function getProfileStats({ handle, period, viewer }) {
  const p = normalizePeriod(period);
  if (!viewer || !viewer.id) err('unauthorized', 401);
  const want = String(handle || '').trim().toLowerCase();
  const user = want
    ? await User.findOne({ $or: [{ username: want }, { id: want }] }).select('id username fullName').lean()
    : await User.findOne({ id: String(viewer.id) }).select('id username fullName').lean();
  if (!user) err('not_found', 404);
  const self = String(user.id) === String(viewer.id);
  if (!self && !isStaff(viewer)) err('forbidden', 403);

  const books = await Book.find({ authorId: String(user.id) }).select('id title reads likes status chapterCount').lean();
  const bookIds = books.map(b => String(b.id));
  const w = periodWindow(p);
  const dayFilter = w.cur[1] !== Infinity ? { $gte: dayStr(w.cur[0]), $lte: dayStr(w.cur[1] - 1) } : { $gte: dayStr(w.cur[0]) };

  const [vis, reads, readsPrev, followers, saves, posts] = await Promise.all([
    visits({ surface: 'profile', targetIds: [String(user.username), String(user.id)], period: p }),
    bookIds.length ? BookDailyStat.aggregate([{ $match: { bookId: { $in: bookIds }, day: dayFilter } }, { $group: { _id: null, r: { $sum: '$reads' } } }]).then(a => (a[0] && a[0].r) || 0) : Promise.resolve(0),
    (w.prev && bookIds.length) ? BookDailyStat.aggregate([{ $match: { bookId: { $in: bookIds }, day: { $gte: dayStr(w.prev[0]), $lte: dayStr(w.prev[1] - 1) } } }, { $group: { _id: null, r: { $sum: '$reads' } } }]).then(a => (a[0] && a[0].r) || 0) : Promise.resolve(0),
    Follow.countDocuments({ followingId: String(user.id) }),
    bookIds.length ? LibraryItem.countDocuments({ storyId: { $in: bookIds }, list: 'saved' }) : Promise.resolve(0),
    Post.find({ authorId: String(user.id) }).select('id likesCount').lean(),
  ]);

  const postIds = posts.map(p2 => String(p2.id));
  const postLikes = postIds.length
    ? await Reaction.countDocuments({ targetType: 'post', targetId: { $in: postIds } })
    : 0;
  const bookLikes = books.reduce((a, b) => a + (b.likes || 0), 0);
  const topBooks = books.slice().sort((a, b) => (b.reads || 0) - (a.reads || 0)).slice(0, 5).map(b => ({
    n: b.title || 'Untitled',
    s: 'Book · ' + (b.status || 'draft'),
    v: fmtK(b.reads || 0) + ' reads',
    href: 'bridge.html?id=' + encodeURIComponent(String(b.id)),
  }));

  return {
    title: 'Your profile',
    sub: 'Owner insights · ' + pLabel(p),
    hero: {
      label: 'Profile views',
      v: String(vis.visits),
      delta: deltaPct(vis.visits, vis.visitsPrev),
      sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
    },
    chartTitle: 'Profile views',
    chartNote: '',
    series: vis.series,
    cards: [
      uniqCard(vis),
      { label: 'Reads', v: fmtK(reads), s: cardNote(deltaPct(reads, readsPrev)) },
      { label: 'Likes', v: fmtK(bookLikes + postLikes), s: { t: 'total', cls: 'flat' } },
      { label: 'Followers', v: fmtK(followers), s: { t: 'total', cls: 'flat' } },
      { label: 'Saves', v: fmtK(saves), s: { t: 'total', cls: 'flat' } },
    ],
    list: { title: 'Your top books', icon: 'fa-book-open', items: topBooks },
    countries: vis.countries,
  };
}

/* ── collection (owner's own numbers) ── */
async function getCollectionStats({ id, period, viewer }) {
  const p = normalizePeriod(period);
  const key = String(id || '').trim();
  if (!key) err('bad_collection', 400);
  const col = await Collection.findOne({ id: key }).lean();
  if (!col) err('not_found', 404);
  const owner = String(col.ownerId) === String(viewer && viewer.id);
  if (!owner && !isStaff(viewer)) err('forbidden', 403);

  const w = periodWindow(p);
  const cur = createdFilter(w);
  const [vis, followers, stories, shares, books] = await Promise.all([
    visits({ surface: 'collection', targetIds: [String(col.id)], period: p }),
    CollectionFollow.countDocuments({ collectionId: String(col.id) }),
    Promise.resolve(col.storiesCount != null ? col.storiesCount : (col.stories || []).length),
    Promise.resolve(col.sharesCount || 0),
    Book.find({ id: { $in: (col.stories || []).map(String) } }).select('id title reads authorId').lean(),
  ]);
  const authors = await usersByIds(books.map(b => b.authorId), 'id username fullName');
  const topStories = books.slice().sort((a, b) => (b.reads || 0) - (a.reads || 0)).slice(0, 5).map(b => ({
    n: b.title || 'Untitled',
    s: 'by ' + nameOf(authors[String(b.authorId)]),
    v: fmtK(b.reads || 0) + ' reads',
    href: 'bridge.html?id=' + encodeURIComponent(String(b.id)),
  }));

  return {
    title: 'Collection stats',
    sub: 'Owner insights · ' + pLabel(p),
    hero: {
      label: 'Collection views',
      v: String(vis.visits),
      delta: deltaPct(vis.visits, vis.visitsPrev),
      sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
    },
    chartTitle: 'Views',
    chartNote: '',
    series: vis.series,
    cards: [
      uniqCard(vis),
      { label: 'Followers', v: String(followers), s: { t: 'total', cls: 'flat' } },
      { label: 'Stories', v: String(stories), s: { t: 'in collection', cls: 'flat' } },
      { label: 'Shares', v: String(shares), s: { t: 'total', cls: 'flat' } },
      { label: 'Total views', v: String(col.visits || 0), s: { t: 'all time', cls: 'flat' } },
    ],
    list: { title: 'Top stories in collection', icon: 'fa-book', items: topStories },
    countries: vis.countries,
  };
}

/* ── droboard (the official page; staff) ── */
async function getDroboardStats({ period, viewer }) {
  const p = normalizePeriod(period);
  if (!isStaff(viewer)) err('forbidden', 403);
  const w = periodWindow(p);
  const cur = createdFilter(w);
  const prev = prevCreatedFilter(w);
  const [vis, posts, postsPrev, comments, followers, followersPrev, readers] = await Promise.all([
    visits({ surface: 'droboard', targetIds: null, period: p }),
    Post.countDocuments(cur),
    Post.countDocuments(prev),
    Comment.countDocuments(Object.assign({ scope: 'post' }, cur)),
    Follow.countDocuments(cur),
    Follow.countDocuments(prev),
    ReadingProgress.distinct('userId', cur.createdAt ? { lastReadAt: cur.createdAt } : {}),
  ]);
  const topPosts = await Post.find(cur).sort({ likesCount: -1, createdAt: -1 }).limit(5).select('id title heading text note quote caption type likesCount authorId').lean();
  const authors = await usersByIds(topPosts.map(p2 => p2.authorId), 'id username fullName');

  return {
    title: 'Droboard page',
    sub: 'Official page insights · ' + pLabel(p),
    hero: {
      label: 'Page visits',
      v: String(vis.visits),
      delta: deltaPct(vis.visits, vis.visitsPrev),
      sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
    },
    chartTitle: 'Page visits',
    chartNote: '',
    series: vis.series,
    cards: [
      uniqCard(vis),
      { label: 'Posts', v: String(posts), s: cardNote(deltaPct(posts, postsPrev)) },
      { label: 'Active readers', v: fmtK(readers.length), s: { t: 'total', cls: 'flat' } },
      { label: 'Comments', v: String(comments), s: { t: 'total', cls: 'flat' } },
      { label: 'New followers', v: fmtK(followers), s: cardNote(deltaPct(followers, followersPrev)) },
    ],
    list: {
      title: 'Top posts',
      icon: 'fa-star',
      items: topPosts.map(p2 => ({
        n: p2.title || p2.heading || String(p2.text || '').slice(0, 60) || String(p2.note || '').slice(0, 60) || String(p2.quote || '').slice(0, 60) || String(p2.caption || '').slice(0, 60) || 'Untitled',
        s: 'by ' + nameOf(authors[String(p2.authorId)]),
        v: fmtK(p2.likesCount || 0) + ' likes',
        href: 'droboard-page.html',
      })),
    },
    countries: vis.countries,
  };
}

module.exports = { getHubStats, getProfileStats, getCollectionStats, getDroboardStats };
