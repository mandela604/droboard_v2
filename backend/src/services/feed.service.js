'use strict';
// Read-side feeds for home/discover/library/book catalogue/story detail.
// Shapes match what the frontend services already consume.
const { Book, Chapter, Genre } = require('../models/content.model');
const { User } = require('../models/user.model');
const { LibraryItem, ReadingProgress, Comment, ShareEvent, Status } = require('../models/social.model');
const { AdInventory, AdPlacement } = require('../models/platform.model');
const { FeaturedPlacement } = require('../models/editorial.model');
const statusesSvc = require('./statuses.service');
const posts = require('./posts.service');
const { relTime } = require('./users.service');

async function authorMap(ids) {
  const users = await User.find({ id: { $in: ids.filter(Boolean) } })
    .select('id username fullName avatar').lean();
  const m = {};
  users.forEach(u => { m[u.id] = u; });
  return m;
}

function cardShape(b, author) {
  const handle = author ? '@' + (author.username || '') : '';
  return {
    id: b.id, title: b.title, author: handle, authorName: author ? author.fullName : '',
    authorAv: author ? author.avatar : '',
    // needed by the taste ranker in discoverData (author-familiarity weight);
    // the reader cards ignore it.
    authorId: b.authorId || '',
    genre: b.genre || '', cat: b.genre || '', cover: b.cover || '', img: b.cover || '',
    preview: (b.synopsis || '').slice(0, 140),
    reads: b.reads || 0, likes: b.likes || 0, rating: b.rating || 0,
    chapter: 'Ch. ' + (b.chapterCount || 0), chapters: b.chapterCount || 0,
    status: b.status || 'ongoing',
  };
}

async function topBooks(sort, limit, viewerId, statuses) {
  const filter = { status: { $in: statuses || ['ongoing', 'completed', 'published'] } };
  if (viewerId) {
    const usersSvc = require('./users.service');
    const [mutes, blocks] = await Promise.all([
      usersSvc.mutedIds(viewerId).catch(() => new Set()),
      usersSvc.blockedIds(viewerId).catch(() => new Set()),
    ]);
    const excluded = new Set([...mutes, ...blocks]);
    if (excluded.size) {
      filter.$or = [
        { authorId: { $nin: [...excluded] } },
        { authorId: viewerId }, // always see your own stories
      ];
    }
  }
  const books = await Book.find(filter).sort({ ...sort, _id: -1 }).limit(limit || 10).lean();
  const am = await authorMap(books.map(b => b.authorId));
  return books.map(b => cardShape(b, am[b.authorId]));
}

/* Top Writers ranking, one swappable function.
   Rule today: total reads across the author's live books, ties broken by
   followers. An author with no live book never appears (the $unwind on the
   user join also drops deleted accounts). When the rule changes — e.g. to a
   momentum window so a new author whose book is climbing can surface — edit
   only this function; the /discover payload and every writers row follow it. */
async function topWriters(limit) {
  const lim = Math.min(20, Math.max(1, parseInt(limit, 10) || 10));
  const rows = await Book.aggregate([
    { $match: { status: { $in: ['ongoing', 'completed', 'published'] } } },
    { $group: { _id: '$authorId', books: { $sum: 1 }, reads: { $sum: { $ifNull: ['$reads', 0] } } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: 'id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.deletedAt': null, 'u.username': { $nin: ['', null] } } },
    { $sort: { reads: -1, 'u.followerCount': -1 } },
    { $limit: lim },
    {
      $project: {
        id: '$u.id', handle: '$u.username', name: '$u.fullName',
        avatar: { $ifNull: ['$u.avatar', ''] },
        verified: { $ifNull: ['$u.emailVerified', false] },
        followers: { $ifNull: ['$u.followerCount', 0] },
        books: 1, reads: 1,
      },
    },
  ]);
  return rows.map(r => ({
    id: String(r.id || ''),
    handle: String(r.handle || ''),
    name: r.name || r.handle || '',
    avatar: r.avatar || '',
    verified: !!r.verified,
    followers: r.followers || 0,
    books: r.books || 0,
    reads: r.reads || 0,
  }));
}

async function home(viewerId, scope) {
  const [top, rated, promos, postsPage, statuses] = await Promise.all([
    topBooks({ reads: -1 }, 8, viewerId),
    topBooks({ rating: -1 }, 5, viewerId),
    AdInventory.find({ format: 'promo', active: true }).limit(5).lean(),
    posts.listPosts({ viewerId, limit: 20 }),
    // The top strip. scope='any' (default) is every role — the feed row;
    // scope='authors' is writers only — the homepage. Fill to 20, followed
    // authors first, then most-recent live status. Rings still come from
    // StatusStore client-side; this is only the first-paint fallback.
    statusesSvc.statusRoster({ userId: viewerId, scope: scope === 'authors' ? 'authors' : 'any', limit: 20 }),
  ]);
  return {
    statuses,
    // The reader feed renders its cards from this call, so home answers posts
    // too. Projected through posts.service: authorship + the viewer's own
    // liked/saved/voted flags, not bare authorId rows.
    posts: postsPage.items,
    heroStories: top.slice(0, 5),
    promoSlides: promos.map(p => ({ title: p.title, author: '', cta: p.cta, img: p.image })),
    trending: top, topRated: rated,
    notifCount: 0,
  };
}

// `taste` is the discover filter the reader toggles on the page — a per-request
// query, never a stored profile field. User.genres is what strangers see on the
// profile row and must not move recommendations.
async function discoverData(viewerId, taste) {
  const now = new Date();
  // Hero carousel AND Editor's Picks both come from the Chief editor's
  // FeaturedPlacement sections — never the SE's EditorPick collection.
  const placementFilter = (sectionKey) => ({
    sectionKey,
    active: true,
    $and: [
      { $or: [{ startAt: { $lte: now } }, { startAt: null }, { startAt: { $exists: false } }] },
      { $or: [{ endAt: { $gte: now } }, { endAt: null }, { endAt: { $exists: false } }] },
    ],
  });

  const [heroPlacements, pickPlacements] = await Promise.all([
    FeaturedPlacement.find(placementFilter('hero-banner'))
      .sort({ order: 1, createdAt: -1 }).limit(5).lean(),
    FeaturedPlacement.find(placementFilter('editors-picks'))
      .sort({ order: 1, createdAt: -1 }).limit(10).lean(),
  ]);

  const bookIdsIn = (placements) => {
    const order = [];
    const seen = {};
    placements.forEach(p => {
      const id = String(p.bookId);
      if (!seen[id]) { seen[id] = 1; order.push(id); }
    });
    return order;
  };
  const ordered = (ids, books, am) => ids
    .map(id => books.find(b => String(b.id) === id))
    .filter(Boolean)
    .map(b => ({ b, a: am[b.authorId] }));

  const heroBookIds = bookIdsIn(heroPlacements);
  const heroBooks = heroBookIds.length ? await Book.find({ id: { $in: heroBookIds } }).lean() : [];
  const heroAm = await authorMap(heroBooks.map(b => b.authorId));
  const heroes = ordered(heroBookIds, heroBooks, heroAm).map(({ b, a }) => ({
    id: b.id,
    img: b.cover || '',
    title: b.title || '',
    author: a ? 'By ' + (a.fullName || a.username) : '',
    tags: (b.genre || '').split(' & ').filter(Boolean).slice(0, 2),
  }));

  const pickBookIds = bookIdsIn(pickPlacements);
  const pickBooks = pickBookIds.length ? await Book.find({ id: { $in: pickBookIds } }).lean() : [];
  const pickAm = await authorMap(pickBooks.map(b => b.authorId));
  const editorsPicks = ordered(pickBookIds, pickBooks, pickAm).map(({ b, a }) => cardShape(b, a));

  // Continue reading: from user's library (list: 'continue')
  let continueReading = [];
  if (viewerId) {
    const continueItems = await LibraryItem.find({
      userId: viewerId,
      list: 'continue',
      status: 'progress'
    }).sort({ updatedAt: -1 }).limit(8).lean();
    const continueBookIds = continueItems.map(i => i.storyId);
    const continueBooks = continueBookIds.length ? await Book.find({ id: { $in: continueBookIds } }).lean() : [];
    const continueAm = await authorMap(continueBooks.map(b => b.authorId));
    const continueMap = {};
    continueItems.forEach(i => { continueMap[i.storyId] = i; });
    continueReading = continueBooks.map(b => {
      const item = continueMap[b.id] || {};
      const card = cardShape(b, continueAm[b.authorId]);
      card.ch = 'Ch. ' + (item.currentChN || 0);
      card.pct = item.pct || 0;
      return card;
    });
  }

  // Base pools for other sections (topBooks already returns render-ready cards)
  const [trending, recent, completed, writers] = await Promise.all([
    topBooks({ reads: -1 }, 20, viewerId),
    topBooks({ updatedAt: -1 }, 12, viewerId),
    topBooks({ reads: -1 }, 10, viewerId, ['completed']),
    topWriters(10),
  ]);

  // Recommendation row: the reader's discover filter — a request query, never a
  // stored profile field — plus reading-history weighting. Guests score the same
  // way, so a signed-out pick tunes only this response.
  const requested = (taste || []).map(g => String(g).toLowerCase()).filter(Boolean).slice(0, 4);
  // The filter vocabulary is the Chief's catalogue, not the client's say-so:
  // unknown or retired genres simply score nothing.
  const live = requested.length
    ? await Genre.find({ status: 'active' }).select('name slug').lean()
    : [];
  const known = new Set();
  live.forEach(g => { known.add(String(g.name).toLowerCase()); known.add(String(g.slug).toLowerCase()); });
  const tasteGenres = requested.filter(g => known.has(g));
  const libraryItems = viewerId ? await LibraryItem.find({ userId: viewerId }).lean() : [];
  const readBookIds = libraryItems.map(i => i.storyId);
  const readBooks = readBookIds.length ? await Book.find({ id: { $in: readBookIds } }).select('genre authorId').lean() : [];

  // Author familiarity map (authors this reader has already read)
  const authorCounts = {};
  readBooks.forEach(b => {
    const key = String(b.authorId);
    authorCounts[key] = (authorCounts[key] || 0) + 1;
  });

  const scored = trending.map(b => {
    let score = 0;

    // Genre match weight (2 points per matching filter genre)
    if (tasteGenres.length) {
      const bookGenres = (b.genre || '').toLowerCase().split(/[,&]/).map(g => g.trim());
      tasteGenres.forEach(tg => {
        if (bookGenres.some(bg => bg.indexOf(tg) !== -1)) score += 2;
      });
    }

    // Author familiarity weight (1 point per read book from same author)
    if (authorCounts[String(b.authorId)]) score += authorCounts[String(b.authorId)];

    // Base popularity weight (reads, rating)
    score += (b.reads || 0) / 1000;
    score += (b.rating || 0) * 0.5;

    return { book: b, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const recommended = scored.slice(0, 8).map(s => s.book);

  return {
    heroes,
    continueReading,
    topRomance: trending.filter(t => /romance/i.test(t.genre)).slice(0, 8),
    trending,
    // The reader page loads collections from /api/collections?sort=popular,
    // so this row is filled client-side rather than duplicated here.
    collections: [],
    newReleases: recent,
    editorsPicks,
    recommended,
    complete: completed,
    recentlyUpdated: recent,
    moreStories: trending,
    topWriters: writers,
  };
}

async function discoverStories({ page, limit, viewerId }) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const filter = { status: { $in: ['ongoing', 'completed', 'published'] } };
  if (viewerId) {
    const usersSvc = require('./users.service');
    const [mutes, blocks] = await Promise.all([
      usersSvc.mutedIds(viewerId).catch(() => new Set()),
      usersSvc.blockedIds(viewerId).catch(() => new Set()),
    ]);
    const excluded = new Set([...mutes, ...blocks]);
    if (excluded.size) {
      filter.$or = [
        { authorId: { $nin: [...excluded] } },
        { authorId: viewerId },
      ];
    }
  }
  const [books, total] = await Promise.all([
    // _id tiebreaker: updatedAt ties (same-second publishes) otherwise make
    // skip/limit unstable, so a reader scrolling the list sees duplicates.
    Book.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Book.countDocuments(filter),
  ]);
  const am = await authorMap(books.map(b => b.authorId));
  const items = books.map(b => cardShape(b, am[b.authorId]));
  return { items, hasMore: pg * lim < total };
}

async function libraryStats(userId) {
  const [lib, prog] = await Promise.all([
    LibraryItem.find({ userId }).lean(),
    ReadingProgress.find({ userId }).lean(),
  ]);
  const inProgress = lib.filter(s => s.status === 'progress').length;
  const finished = lib.filter(s => s.status === 'finished').length;
  const words = prog.reduce((s, p) => s + (p.wordsRead || 0), 0);
  return { inProgress, finished, hoursRead: Math.round(words / 200 / 60) };
}

async function libraryList(userId, list) {
  const items = await LibraryItem.find({ userId, list }).sort({ updatedAt: -1 }).lean();
  if (!items.length) return [];
  const books = await Book.find({ id: { $in: items.map(i => i.storyId) } }).lean();
  const bm = {};
  books.forEach(b => { bm[b.id] = b; });
  const am = await authorMap(books.map(b => b.authorId));
  return items.map(i => {
    const b = bm[i.storyId];
    if (!b) return null;
    const card = cardShape(b, am[b.authorId]);
    card.ch = 'Ch. ' + (i.currentChN || 0);
    card.pct = i.pct || 0;
    card.status = i.status;
    return card;
  }).filter(Boolean);
}

// Reader story read. Delegates to books.getBookDetail so /api/stories/:id and
// /api/books/:id return the SAME contract — the story page needs engagement,
// the writer card and reactions from whichever spelling it reached.
async function storyDetail(id, viewerId) {
  const books = require('./books.service');
  const full = await books.getBookDetail(id, viewerId);
  const w = full.writer;
  return Object.assign({}, full, {
    authorName: w ? w.name : '',
    authorHandle: w ? w.handle : '',
    authorAv: w ? w.avatar : '',
  });
}

function badList(list) {
  return !['library', 'saved', 'history', 'continue', 'later'].includes(list);
}
async function libraryAdd({ userId, storyId, list }) {
  if (badList(list)) { const e = new Error('bad_list'); e.status = 400; throw e; }
  const { Book } = require('../models/content.model');
  const book = await Book.findOne({ id: storyId }).lean();
  if (!book) { const e = new Error('story_not_found'); e.status = 404; throw e; }
  const existing = await LibraryItem.findOne({ userId: String(userId), storyId: String(storyId), list });
  if (existing) return existing.toJSON();
  const doc = await LibraryItem.create({ userId: String(userId), storyId: String(storyId), list });
  return doc.toJSON();
}
async function libraryRemove({ userId, storyId, list }) {
  const filter = { userId: String(userId), storyId: String(storyId) };
  if (list) {
    if (badList(list)) { const e = new Error('bad_list'); e.status = 400; throw e; }
    filter.list = list;
  }
  const r = await LibraryItem.deleteMany(filter);
  return { ok: true, removed: r.deletedCount || 0 };
}
async function libraryMove({ userId, storyId, from, to }) {
  if (badList(from) || badList(to)) { const e = new Error('bad_list'); e.status = 400; throw e; }
  await LibraryItem.deleteMany({ userId: String(userId), storyId: String(storyId), list: from });
  const doc = await LibraryItem.findOneAndUpdate(
    { userId: String(userId), storyId: String(storyId), list: to },
    { $setOnInsert: { userId: String(userId), storyId: String(storyId), list: to } },
    { upsert: true, new: true }
  );
  return doc.toJSON();
}

module.exports = {
  home, discoverData, discoverStories, libraryStats, libraryList,
  libraryAdd, libraryRemove, libraryMove,
  storyDetail, cardShape, topBooks, topWriters,
};
