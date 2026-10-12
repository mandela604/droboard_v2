'use strict';
// Read-side feeds for home/discover/library/book catalogue/story detail.
// Shapes match what the frontend services already consume.
const { Book, Chapter, Genre } = require('../models/content.model');
const { User } = require('../models/user.model');
const { LibraryItem, ReadingProgress } = require('../models/social.model');
const { AdInventory, AdPlacement } = require('../models/platform.model');

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
    genre: b.genre || '', cat: b.genre || '', cover: b.cover || '', img: b.cover || '',
    preview: (b.synopsis || '').slice(0, 140),
    reads: b.reads || 0, likes: b.likes || 0, rating: b.rating || 0,
    chapter: 'Ch. ' + (b.chapterCount || 0), chapters: b.chapterCount || 0,
    status: b.status || 'ongoing',
  };
}

async function topBooks(sort, limit, viewerId) {
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
        { authorId: viewerId }, // always see your own stories
      ];
    }
  }
  const books = await Book.find(filter).sort(sort).limit(limit || 10).lean();
  const am = await authorMap(books.map(b => b.authorId));
  return books.map(b => cardShape(b, am[b.authorId]));
}

async function home(viewerId) {
  const [top, rated, promos] = await Promise.all([
    topBooks({ reads: -1 }, 8, viewerId),
    topBooks({ rating: -1 }, 5, viewerId),
    AdInventory.find({ format: 'promo', active: true }).limit(5).lean(),
  ]);
  const recentUsers = await User.find({}).sort({ updatedAt: -1 }).limit(8)
    .select('id username fullName avatar').lean();
  return {
    statuses: recentUsers.map(u => ({
      id: u.id, name: u.username, avatar: u.avatar || '',
      ring: 'ring-has', statuses: [{ viewed: false }],
    })),
    heroStories: top.slice(0, 5),
    promoSlides: promos.map(p => ({ title: p.title, author: '', cta: p.cta, img: p.image })),
    trending: top, topRated: rated,
    notifCount: 0,
  };
}

async function discoverData(viewerId) {
  const [heroes, trending, rated, recent] = await Promise.all([
    topBooks({ reads: -1 }, 5, viewerId),
    topBooks({ reads: -1 }, 10, viewerId),
    topBooks({ rating: -1 }, 8, viewerId),
    topBooks({ updatedAt: -1 }, 8, viewerId),
  ]);
  const am = await authorMap(recent.map(b => b.authorId));
  const shape = (b) => cardShape(b, am[b.authorId]);
  const cont = recent.slice(0, 4).map(shape);
  return {
    heroes, continueReading: cont,
    topRomance: trending.filter(t => /romance/i.test(t.genre)).slice(0, 8),
    trending, collections: [],
    newReleases: recent.map(shape), editorsPicks: rated.slice(0, 6),
    recommended: trending.slice(0, 8),
    complete: [], recentlyUpdated: recent.map(shape), moreStories: trending,
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
    Book.find(filter).sort({ updatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
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

async function storyDetail(id, viewerId) {
  const books = require('./books.service');
  const book = await books.getBook(id);
  // Public detail: live book + live chapters only.
  if (!['ongoing', 'published', 'completed'].includes(book.status)) {
    const e = new Error('not_found'); e.status = 404; throw e;
  }
  // Blocked/muted authors' stories are hidden from viewers (except own).
  if (viewerId && String(book.authorId) !== String(viewerId)) {
    const usersSvc = require('./users.service');
    const [mutes, blocks] = await Promise.all([
      usersSvc.mutedIds(viewerId).catch(() => new Set()),
      usersSvc.blockedIds(viewerId).catch(() => new Set()),
    ]);
    const excluded = new Set([...mutes, ...blocks]);
    if (excluded.has(String(book.authorId))) {
      const e = new Error('not_found'); e.status = 404; throw e;
    }
  }
  const chapters = await Chapter.find({ bookId: book.id, status: { $in: ['live', 'published'] } }).sort({ n: 1 }).lean();
  const author = book.authorId ? await User.findOne({ id: book.authorId }).select('username fullName avatar').lean() : null;
  return Object.assign({}, book, {
    authorName: author ? author.fullName : '',
    authorHandle: author ? '@' + author.username : '',
    authorAv: author ? author.avatar : '',
    chapters,
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
  storyDetail, cardShape, topBooks,
};
