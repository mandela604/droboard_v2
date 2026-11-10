'use strict';
// search-service contract: GET /api/search/index
// One call fills every search-overlay.js section:
//   browse (the default view, painted before any query is typed):
//     trending, categories, featured, writers, boards
//   pools (the results view, matched against q):
//     poolStories, poolWriters, poolBoards, poolDebates
const { Book, Category, BookDailyStat } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Follow, Post } = require('../models/social.model');
const { SearchLog } = require('../models/platform.model');

const HEX24 = /^[0-9a-fA-F]{24}$/;
const READABLE = { $in: ['ongoing', 'completed', 'published'] };
const WEEK = 7 * 86400000;

// The overlay prints numbers as text ("171k", "1.2k stories").
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

function escapeRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function likeRx(s) { return { $regex: escapeRx(s), $options: 'i' }; }

function keywordList() {
  const words = [];
  for (let i = 0; i < arguments.length; i++) {
    String(arguments[i] || '').toLowerCase().split(/[^a-z0-9]+/).forEach(w => {
      if (w.length >= 3 && words.indexOf(w) === -1) words.push(w);
    });
  }
  return words;
}

// Author lookup keyed by Book.authorId (custom string id, hex _id tolerated).
async function loadAuthors(authorIds) {
  const uniq = [...new Set((authorIds || []).map(v => String(v)).filter(Boolean))];
  if (!uniq.length) return {};
  const hex = uniq.filter(v => HEX24.test(v));
  const or = [{ id: { $in: uniq } }];
  if (hex.length) or.push({ _id: { $in: hex } });
  const users = await User.find({ $or: or }).select('id username fullName avatar').lean();
  const out = {};
  users.forEach(u => {
    const rec = { name: u.fullName || u.username || '', handle: u.username || '', photo: u.avatar || '' };
    out[String(u.id)] = rec;
    out[String(u._id)] = rec;
  });
  return out;
}

// ── shared projections ─────────────────────────────────────────────────

// A writer's tile names the genre they publish in most.
async function topGenreByAuthor(userIds) {
  if (!userIds.length) return {};
  const rows = await Book.aggregate([
    { $match: { authorId: { $in: userIds.map(String) }, status: READABLE, genre: { $ne: '' } } },
    { $group: { _id: { authorId: '$authorId', genre: '$genre' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  const out = {};
  rows.forEach(r => {
    const key = String(r._id.authorId);
    if (!out[key]) out[key] = r._id.genre;
  });
  return out;
}

// Verified badge = a writer with signed work, not a role token.
async function contractedSet(userIds) {
  if (!userIds.length) return new Set();
  const rows = await Book.distinct('authorId', { authorId: { $in: userIds.map(String) }, contractStatus: 'contracted' });
  return new Set(rows.map(String));
}

async function followingSet(viewerId, userIds) {
  if (!viewerId || !userIds.length) return new Set();
  const rows = await Follow.find({ followerId: String(viewerId), followingId: { $in: userIds.map(String) } })
    .select('followingId').lean();
  return new Set(rows.map(r => String(r.followingId)));
}

async function shapeWriters(users, { viewerId, withType } = {}) {
  const ids = users.map(u => String(u.id));
  const [genres, contracted, following] = await Promise.all([
    topGenreByAuthor(ids), contractedSet(ids), followingSet(viewerId, ids),
  ]);
  return users.map(u => {
    const card = {
      name: u.fullName || u.username, handle: '@' + (u.username || ''),
      genre: genres[String(u.id)] || (u.genres || [])[0] || '',
      av: u.avatar || '', followers: compact(u.followerCount || 0),
      verified: contracted.has(String(u.id)),
      following: following.has(String(u.id)),
      id: u.id,
    };
    if (!withType) return card;
    return Object.assign(card, {
      type: 'writer',
      keywords: keywordList(u.fullName, u.username, card.genre, u.bio),
    });
  });
}

// ── browse sections ────────────────────────────────────────────────────

// 7-day SearchLog aggregation in the shape the trending list renders.
async function trendingSection(limit) {
  const rows = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - WEEK) }, q: { $ne: '' } } },
    { $group: { _id: '$q', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r, i) => ({ q: r._id, meta: compact(r.n) + ' searches this week', fire: i < 3 }));
}

async function categoriesSection(limit) {
  const rows = await Category.find({ status: 'active' })
    .sort({ booksCount: -1, name: 1 }).limit(limit).select('name icon bg cover booksCount').lean();
  return rows.map(c => ({
    label: (c.icon ? c.icon + ' ' : '') + c.name,
    count: compact(c.booksCount || 0) + ' stories',
    bg: c.bg || c.cover || '',
  }));
}

// "hot" = most read in the last 7 days; "new" = published in the last 14;
// everything else gets no badge. vipLocked is the paywall, not a badge the
// shelf gets to invent.
async function featuredSection(limit) {
  const since = new Date(Date.now() - WEEK);
  const [hot, rows] = await Promise.all([
    BookDailyStat.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$bookId', n: { $sum: '$reads' } } },
      { $sort: { n: -1 } },
      { $limit: limit },
    ]),
    Book.find({ status: READABLE }).sort({ reads: -1 }).limit(limit)
      .select('id title genre cover reads authorId createdAt').lean(),
  ]);
  const hotIds = new Set(hot.map(r => String(r._id)));
  const authors = await loadAuthors(rows.map(r => r.authorId));
  return rows.map(b => {
    const a = authors[String(b.authorId)] || {};
    const isNew = b.createdAt && (Date.now() - b.createdAt.getTime() < 14 * 86400000);
    return {
      img: b.cover || '', cat: b.genre || '', title: b.title,
      // The card prefixes '@' itself (search-overlay renderFeatured), so the
      // payload carries the bare handle — same as the demo rows.
      author: a.handle || a.name || '', av: a.photo || '',
      views: compact(b.reads || 0),
      badge: hotIds.has(String(b.id)) ? 'hot' : isNew ? 'new' : '',
    };
  });
}

async function writersSection(limit, viewerId) {
  const rows = await User.find({ roles: 'writer', status: 'active' })
    .sort({ followerCount: -1 }).limit(limit)
    .select('id username fullName avatar genres followerCount bio').lean();
  return shapeWriters(rows, { viewerId });
}

// A board IS the category the CE created; the overlay opens
// discover.html?board=<id>, which resolves that same id.
function boardIcon(icon) {
  // The card paints `<i class="fas ${icon}">`; a CE emoji icon would render
  // nothing there, so a non-font-awesome icon falls back to the trophy.
  return /^fa-/.test(String(icon || '')) ? icon : 'fa-trophy';
}

async function boardsSection(limit) {
  const rows = await Category.find({ status: 'active' })
    .sort({ membersCount: -1, name: 1 }).limit(limit)
    .select('id name desc tagline icon').lean();
  return rows.map(c => ({
    id: c.id, type: 'board', name: c.name,
    description: c.desc || c.tagline || '',
    icon: boardIcon(c.icon),
    keywords: keywordList(c.name, c.desc, c.tagline),
  }));
}

// ── search pools ───────────────────────────────────────────────────────

async function poolStories(query, lim, type) {
  if (type && type !== 'stories' && type !== 'books') return [];
  const rx = likeRx(query);
  const rows = await Book.find({ status: READABLE, $or: [{ title: rx }, { genre: rx }, { synopsis: rx }] })
    .sort({ reads: -1 }).limit(lim * 2)
    .select('id title genre cover reads likes synopsis authorId').lean();
  const authors = await loadAuthors(rows.map(r => r.authorId));
  return rows.slice(0, lim).map(b => {
    const a = authors[String(b.authorId)] || {};
    const hook = String(b.synopsis || '').split(/\n+/).map(s => s.trim()).filter(Boolean)[0] || '';
    return {
      type: 'story', id: b.id, img: b.cover || '', cat: b.genre || '', title: b.title,
      author: a.handle || a.name || '', av: a.photo || '',
      views: compact(b.reads || 0), likes: compact(b.likes || 0), badge: '',
      // The overlay ignores this; flyer-preview prefills the hook line from it
      // (fillFromStory), so the live card must carry the same first paragraph
      // the demo card shows.
      hook,
      keywords: keywordList(b.title, b.genre, a.name, a.handle, hook),
    };
  });
}

async function poolWriters(query, lim, type, viewerId) {
  if (type && type !== 'writers' && type !== 'users') return [];
  const rx = likeRx(query);
  const rows = await User.find({ status: 'active', $or: [{ username: rx }, { fullName: rx }, { bio: rx }] })
    .sort({ followerCount: -1 }).limit(lim * 2)
    .select('id username fullName avatar genres bio roles followerCount').lean();
  return shapeWriters(rows.slice(0, lim), { viewerId, withType: true });
}

async function poolBoards(query, lim, type) {
  if (type && type !== 'boards') return [];
  const rx = likeRx(query);
  const rows = await Category.find({ status: 'active', $or: [{ name: rx }, { desc: rx }, { tagline: rx }] })
    .sort({ membersCount: -1 }).limit(lim).select('id name desc tagline icon').lean();
  return rows.map(c => ({
    id: c.id, type: 'board', name: c.name,
    description: c.desc || c.tagline || '',
    icon: boardIcon(c.icon),
    keywords: keywordList(c.name, c.desc, c.tagline),
  }));
}

async function poolDebates(query, lim, type) {
  if (type && type !== 'debates') return [];
  const rx = likeRx(query);
  const rows = await Post.find({
    type: 'debate',
    $or: [{ 'debateData.motion': rx }, { 'debateData.question': rx }, { text: rx }],
  }).sort({ createdAt: -1 }).limit(lim)
    .select('id authorId text debateData likesCount commentsCount').lean();
  const authors = await loadAuthors(rows.map(r => r.authorId));
  return rows.map(p => {
    const d = p.debateData || {};
    const a = authors[String(p.authorId)] || {};
    const question = d.motion || d.question || String(p.text || '').slice(0, 120);
    return {
      type: 'debate', id: p.id,
      name: a.handle || a.name || '', avatar: a.photo || '', time: '',
      question, motion: question, prompt: d.prompt || '',
      forText: d.forText || 'For', againstText: d.againstText || 'Against',
      forV: d.forV || 0, agV: d.agV || 0, userVote: null,
      likes: p.likesCount || 0, comments: p.commentsCount || 0,
      keywords: keywordList(question, a.name, a.handle, 'debate'),
    };
  });
}

// Browse "Hot Debates" — the same shape as the search pool, but the newest
// debates when there is no query yet.
async function debatesSection(lim) {
  const rows = await Post.find({ type: 'debate' }).sort({ createdAt: -1 }).limit(lim)
    .select('id authorId text debateData likesCount commentsCount createdAt').lean();
  const authors = await loadAuthors(rows.map(r => r.authorId));
  return rows.map(p => {
    const d = p.debateData || {};
    const a = authors[String(p.authorId)] || {};
    const question = d.motion || d.question || String(p.text || '').slice(0, 120);
    return {
      type: 'debate', id: p.id,
      name: a.handle || a.name || '', avatar: a.photo || '',
      time: p.createdAt ? new Date(p.createdAt).toISOString() : '',
      question, motion: question, prompt: d.prompt || '',
      forText: d.forText || 'For', againstText: d.againstText || 'Against',
      forV: d.forV || 0, agV: d.agV || 0, userVote: null,
      likes: p.likesCount || 0, comments: p.commentsCount || 0,
      keywords: keywordList(question, a.name, a.handle, 'debate'),
    };
  });
}

async function index({ q, type, limit, viewerId } = {}) {
  const query = String(q || '').trim().slice(0, 80);
  const lim = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));

  const sections = [
    trendingSection(lim), categoriesSection(8), featuredSection(6),
    writersSection(8, viewerId), boardsSection(12), debatesSection(6),
  ];
  const pools = query
    ? [poolStories(query, lim, type), poolWriters(query, lim, type, viewerId),
       poolBoards(query, lim, type), poolDebates(query, lim, type)]
    : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

  const [trending, categories, featured, writers, boards, hotDebates, st, wr, bd, dv] =
    await Promise.all(sections.concat(pools));

  return {
    trending, categories, featured, writers,
    boards, debates: hotDebates,
    poolStories: st, poolWriters: wr, poolBoards: bd, poolDebates: dv,
  };
}

module.exports = { index };
