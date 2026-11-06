'use strict';
const { Book } = require('../models/content.model');
const { validateMediaUrl } = require('./media.service');

function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'untitled';
}

const SHORT_MAX = 25;

// New books go live ONLY after editor approval, and only at 5k+ words.
// After the book is live, new chapters publish directly (no approval);
// edits to live books/chapters apply ONLY on approve.
const BOOK_LIVE_MIN_WORDS = 5000;

// Book statuses visible on the platform. Authors can never set these
// directly — every submitted book goes through editor approval first.
const VISIBLE_BOOK_STATUS = ['ongoing', 'published', 'completed'];

async function createBook({ authorId, data }) {
  const kind = data.kind || 'long';
  if (!['short', 'long'].includes(kind)) { const e = new Error('bad_kind'); e.status = 400; throw e; }
  const { season, seriesId, ...rest } = data;
  void season; void seriesId;
  // Validate genre/category exist when supplied (genre matched by name).
  if (rest.genre) {
    const { Genre } = require('../models/content.model');
    const g = await Genre.findOne({ name: rest.genre, status: 'active' }).select('id').lean();
    if (!g) { const e = new Error('bad_genre'); e.status = 400; throw e; }
  }
  if (rest.categoryId) {
    const { Category } = require('../models/content.model');
    const c = await Category.findOne({ id: rest.categoryId, status: 'active' }).select('id').lean();
    if (!c) { const e = new Error('bad_category'); e.status = 400; throw e; }
  }
  if (rest.tropes !== undefined) {
    const list = Array.isArray(rest.tropes) ? rest.tropes.map(String) : [];
    if (list.length > 10) { const e = new Error('too_many_tropes'); e.status = 400; throw e; }
    if (list.length) {
      const { Trope } = require('../models/content.model');
      const n = await Trope.countDocuments({ name: { $in: list }, status: 'active' });
      if (n !== [...new Set(list)].length) { const e = new Error('bad_trope'); e.status = 400; throw e; }
    }
    rest.tropes = [...new Set(list)];
  }
  // BATCH 4: cover must be an http(s) URL or data:image (wizard uploads dataURLs).
  if (rest.cover !== undefined) rest.cover = validateMediaUrl(rest.cover, 'cover');
  const book = await Book.create(Object.assign({}, rest, { authorId, kind }));
  if (!book.slug) {
    book.slug = slugify(book.title) + '-' + String(book.id).slice(-6);
    await book.save();
  }
  // Maintain hub counts (best-effort).
  try {
    const hub = require('./genres.service');
    await Promise.all([
      hub.recountForGenreName(book.genre),
      hub.recountForCategoryId(book.categoryId),
    ]);
  } catch (e) { /* counts best-effort */ }
  return book.toJSON();
}

async function listBooks({ q, genre, status, kind, authorId, page, limit, viewer }) {
  const filter = {};
  const staff = viewer && (viewer.roles || []).some(r => ['admin', 'chief_editor', 'senior_editor'].includes(r));
  // Public catalogue shows ONLY approved/live books. Staff may query any status.
  if (!staff) filter.status = { $in: VISIBLE_BOOK_STATUS };
  else if (status) filter.status = status;
  if (genre) filter.genre = genre;
  if (kind) {
    if (!['short', 'long'].includes(kind)) { const e = new Error('bad_kind'); e.status = 400; throw e; }
    filter.kind = kind;
  }
  if (authorId) filter.authorId = authorId;
  if (q) filter.$text = { $search: q };
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    Book.find(filter).sort({ updatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Book.countDocuments(filter),
  ]);
  return { items, total, page: pg, limit: lim };
}

async function getBook(id) {
  const book = await Book.findOne({ $or: [{ id }, { slug: id }] }).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

// Reader's story page (the bridge) renders its whole first screen from ONE
// call, so this returns the full contract: chapters, the writer card, story-wide
// engagement with the viewer's own votes, stats, emoji reactions, hubs, tip
// count and more-like-this. viewerId is optional — an anonymous reader gets the
// identical shape with the personal fields null/false, so the page never has to
// branch on login to render.
async function getBookDetail(id, viewerId) {
  const { Chapter, Genre, Category } = require('../models/content.model');
  const { User } = require('../models/user.model');
  const { Comment, ShareEvent, Follow, LibraryItem, ReadingProgress } = require('../models/social.model');
  const { LedgerEntry } = require('../models/money.model');
  const engagement = require('./engagement.service');

  const book = await getBook(id);
  const viewer = viewerId ? String(viewerId) : null;
  // Drafts and flagged books never reach a reader, and a reader who muted or
  // blocked the author does not see the story either — 404, not 403, so the
  // catalogue cannot be probed. Both /api/books/:id and /api/stories/:id get
  // this because both now resolve through here.
  if (!VISIBLE_BOOK_STATUS.includes(book.status)) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (viewer && String(book.authorId) !== viewer) {
    const usersSvc = require('./users.service');
    const [mutes, blocks] = await Promise.all([
      usersSvc.mutedIds(viewer).catch(() => new Set()),
      usersSvc.blockedIds(viewer).catch(() => new Set()),
    ]);
    if (new Set([...mutes, ...blocks]).has(String(book.authorId))) {
      const e = new Error('not_found'); e.status = 404; throw e;
    }
  }
  const { CategoryMembership } = require('../models/content.model');
  const [chapters, author, votes, reactions, comments, shares, tipCount, genreHub] = await Promise.all([
    Chapter.find({ bookId: book.id, status: { $in: ['live', 'published'] } }).sort({ n: 1 })
      .select('n title words status views price authorNote poll prediction debate').lean(),
    book.authorId ? User.findOne({ id: book.authorId })
      .select('id username fullName avatar bio emailVerified followerCount').lean() : Promise.resolve(null),
    engagement.storyVotes(book.id, viewer),
    engagement.storyReactionState(book, viewer),
    Comment.countDocuments({ scope: 'story', storyId: book.id }),
    ShareEvent.countDocuments({ targetType: 'story', targetId: book.id }),
    book.authorId ? LedgerEntry.countDocuments({ kind: 'tip', authorId: String(book.authorId) }) : 0,
    book.categoryId ? Category.findOne({ id: book.categoryId }).select('id name icon membersCount slug').lean()
      : Genre.findOne({ name: book.genre }).select('categoryId').lean().then(g =>
        g && g.categoryId ? Category.findOne({ id: g.categoryId }).select('id name icon membersCount slug').lean() : null),
  ]);

  const writer = await writerCard(author, viewer);
  const [boardMembership, saved, reading] = await Promise.all([
    viewer && genreHub ? CategoryMembership.exists({ userId: viewer, categoryId: genreHub.id }) : null,
    viewer ? LibraryItem.findOne({ userId: viewer, storyId: book.id, list: { $in: ['saved', 'library', 'later'] } }).select('list').lean() : null,
    viewer ? ReadingProgress.findOne({ userId: viewer, storyId: book.id }).sort({ updatedAt: -1 }).lean() : null,
  ]);
  const last = chapters[chapters.length - 1] || null;

  return Object.assign({}, book, {
    chapters,
    writer,
    engagement: engagement.shapeStoryEngagement(book, votes),
    stats: {
      comments, reads: book.reads || 0, shares,
      rating: book.rating || 0, ratingCount: book.ratingCount || 0,
      likes: book.likes || 0,
    },
    reactions,
    tipCount,
    hubs: {
      board: genreHub ? {
        id: genreHub.id, name: genreHub.name, slug: genreHub.slug, icon: genreHub.icon || '',
        members: genreHub.membersCount || 0, joined: !!boardMembership,
      } : null,
      // The writer's inner circle is a later version — no membership model
      // ships yet, so it stays null instead of inventing a number.
      circle: null,
    },
    save: { saved: !!saved, list: saved ? saved.list : null },
    continueReading: reading ? {
      chapterId: reading.chapterId || null, pct: reading.pct || 0,
      secondsSpent: reading.secondsSpent || 0, updatedAt: reading.updatedAt || null,
    } : null,
    lastChapterN: last ? last.n : null,
    lastChapterTitle: last ? last.title : null,
    similar: await similarBooks(book, 8),
  });
}

// Card fields the story page shows: name, handle, avatar, bio, follower count,
// whether the viewer follows them, plus the author's live back-catalogue
// numbers. Reads/stories/rating come from the live books, never a stored guess.
async function writerCard(author, viewer) {
  if (!author) return null;
  const { Follow } = require('../models/social.model');
  const [agg, following] = await Promise.all([
    Book.aggregate([
      { $match: { authorId: String(author.id), status: { $in: VISIBLE_BOOK_STATUS } } },
      { $group: {
        _id: null, stories: { $sum: 1 }, reads: { $sum: '$reads' },
        ratedBy: { $sum: '$ratingCount'}, score: { $sum: { $multiply: ['$rating', '$ratingCount'] } },
      } },
    ]),
    viewer ? Follow.exists({ followerId: viewer, followingId: String(author.id) }) : Promise.resolve(null),
  ]);
  const a = agg[0] || { stories: 0, reads: 0, ratedBy: 0, score: 0 };
  return {
    id: author.id, username: author.username, name: author.fullName, avatar: author.avatar || '',
    handle: author.username ? '@' + author.username : '@unknown',
    bio: author.bio || '', followers: author.followerCount || 0,
    verified: !!author.emailVerified, following: !!following,
    stories: a.stories, reads: a.reads,
    rating: a.ratedBy ? Math.round((a.score / a.ratedBy) * 10) / 10 : 0,
  };
}

// More-like-this: this book's own tropes and genre are the signal, live titles
// only, self excluded. Tropes first (a reader here came for that promise), then
// the genre, then the board — so a thin catalogue still fills the row.
async function similarBooks(book, limit) {
  const lim = Math.min(20, Math.max(1, limit || 8));
  const { Genre } = require('../models/content.model');
  const genreName = book.genre;
  const [byTrope, byGenre] = await Promise.all([
    (book.tropes || []).length
      ? Book.find({ id: { $ne: book.id }, status: { $in: VISIBLE_BOOK_STATUS }, tropes: { $in: book.tropes } })
        .sort({ reads: -1 }).limit(lim).lean()
      : Promise.resolve([]),
    Book.find({ id: { $ne: book.id }, status: { $in: VISIBLE_BOOK_STATUS }, genre: genreName })
      .sort({ reads: -1 }).limit(lim).lean(),
  ]);
  const seen = new Set([String(book.id)]);
  const picked = [];
  [...byTrope, ...byGenre].forEach(b => {
    if (picked.length >= lim) return;
    if (!b || seen.has(String(b.id))) return;
    seen.add(String(b.id));
    picked.push(b);
  });
  const ids = picked.map(b => String(b.authorId));
  const authors = await require('../models/user.model').User.find({ id: { $in: ids } })
    .select('id username fullName avatar').lean();
  const byId = {};
  authors.forEach(u => { byId[String(u.id)] = u; });
  const genreSlugs = genreName ? await Genre.find({ name: genreName }).select('slug').lean() : [];
  return picked.map(b => ({
    id: b.id, title: b.title, slug: b.slug || b.id, cover: b.cover || '',
    genre: b.genre || '', tropes: b.tropes || [], reads: b.reads || 0, likes: b.likes || 0,
    rating: b.rating || 0, ratingCount: b.ratingCount || 0, status: b.status,
    chapters: b.chapterCount || 0,
    author: byId[String(b.authorId)]
      ? { id: byId[String(b.authorId)].id, name: byId[String(b.authorId)].fullName, handle: byId[String(b.authorId)].username, avatar: byId[String(b.authorId)].avatar || '' }
      : null,
    genreSlug: (genreSlugs[0] && genreSlugs[0].slug) || '',
  }));
}

// Only the author owns a book. Editors flag/unflag; the chief reads. Neither
// may edit or delete someone else's book, so there is no staff bypass here.
function canWrite(book, user) {
  if (!user) return false;
  return String(book.authorId) === String(user.id);
}

function isStaff(user) {
  return !!user && (user.roles || []).some(r => ['admin', 'chief_editor', 'senior_editor'].includes(r));
}

// Mutations use id ONLY (never slug) — no confusion.
async function loadBookById(id) {
  const book = await Book.findOne({ id });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

// Book content fields that need editor approval on live books.
const BOOK_CONTENT_FIELDS = ['title', 'synopsis', 'genre', 'categoryId', 'cover', 'tags', 'tropes'];
// Drafts edit freely; everything else goes through proposals.
function bookNeedsProposal(book) {
  return book.status !== 'draft';
}

async function proposeBookEdit({ book, authorId, data }) {
  const { BookEdit } = require('../models/application.model');
  const proposed = {};
  BOOK_CONTENT_FIELDS.forEach(k => { if (data[k] !== undefined) proposed[k] = data[k]; });
  // Publish requests ride the same queue: author asks, editor approves.
  if (data.status !== undefined && VISIBLE_BOOK_STATUS.includes(data.status)) proposed.status = data.status;
  if (!Object.keys(proposed).length) { const e = new Error('nothing_to_propose'); e.status = 400; throw e; }
  const dupe = await BookEdit.findOne({ bookId: book.id, authorId, status: 'pending' }).lean();
  if (dupe) { const e = new Error('proposal_pending'); e.status = 409; throw e; }
  const doc = await BookEdit.create({ bookId: book.id, authorId, proposed, status: 'pending' });
  return doc.toJSON();
}

async function applyBookProposal({ proposal, reviewerId }) {
  if (!proposal || proposal.status !== 'pending') { const e = new Error('not_pending'); e.status = 409; throw e; }
  const book = await Book.findOne({ id: proposal.bookId });
  if (!book) { const e = new Error('book_not_found'); e.status = 404; throw e; }
  const data = proposal.proposed || {};
  // Same validation as direct update.
  if (data.genre) {
    const { Genre } = require('../models/content.model');
    const g = await Genre.findOne({ name: data.genre, status: 'active' }).select('id').lean();
    if (!g) { const e = new Error('bad_genre'); e.status = 400; throw e; }
  }
  if (data.categoryId) {
    const { Category } = require('../models/content.model');
    const c = await Category.findOne({ id: data.categoryId, status: 'active' }).select('id').lean();
    if (!c) { const e = new Error('bad_category'); e.status = 400; throw e; }
  }
  if (data.tropes !== undefined) {
    const list = Array.isArray(data.tropes) ? data.tropes.map(String) : [];
    if (list.length > 10) { const e = new Error('too_many_tropes'); e.status = 400; throw e; }
    const { Trope } = require('../models/content.model');
    const n = await Trope.countDocuments({ name: { $in: [...new Set(list)] }, status: 'active' });
    if (n !== [...new Set(list)].length) { const e = new Error('bad_trope'); e.status = 400; throw e; }
    data.tropes = [...new Set(list)];
  }
  if (data.cover !== undefined) data.cover = validateMediaUrl(data.cover, 'cover');
  const oldGenre = book.genre;
  const oldCategoryId = book.categoryId;
  BOOK_CONTENT_FIELDS.forEach(k => { if (data[k] !== undefined) book[k] = data[k]; });
  // Editor-approved publish (the only path onto the platform).
  // New books go live only at 5k+ words.
  if (data.status !== undefined && VISIBLE_BOOK_STATUS.includes(data.status)) {
    if ((book.wordCount || 0) < BOOK_LIVE_MIN_WORDS) {
      const e = new Error('below_min_words_5k'); e.status = 400; throw e;
    }
    book.status = data.status;
  }
  if (data.title) book.slug = slugify(data.title) + '-' + String(book.id).slice(-6);
  await book.save();
  // An approved publish takes the manuscript's draft chapters live with it.
  if (book.status === 'published') {
    const { Chapter } = require('../models/content.model');
    await Chapter.updateMany(
      { bookId: String(book.id), status: 'draft' },
      { $set: { status: 'live' } }
    );
  }
  proposal.status = 'approved';
  proposal.reviewerId = reviewerId || null;
  proposal.decidedAt = new Date();
  await proposal.save();
  try {
    const hub = require('./genres.service');
    if (oldGenre !== book.genre) await Promise.all([hub.recountForGenreName(oldGenre), hub.recountForGenreName(book.genre)]);
    if (String(oldCategoryId || '') !== String(book.categoryId || '')) await Promise.all([hub.recountForCategoryId(oldCategoryId), hub.recountForCategoryId(book.categoryId)]);
  } catch (e) { /* counts best-effort */ }
  return book.toJSON();
}

async function updateBook({ book, data }) {
  const allowed = ['title', 'synopsis', 'genre', 'categoryId', 'cover', 'tags', 'tropes', 'status', 'kind'];
  const norm = Object.assign({}, data);
  if (norm.kind !== undefined) {
    if (!['short', 'long'].includes(norm.kind)) { const e = new Error('bad_kind'); e.status = 400; throw e; }
    // long -> short with >25 chapters is rejected.
    if (norm.kind === 'short' && book.kind !== 'short') {
      const count = await require('../models/content.model').Chapter.countDocuments({ bookId: book.id });
      if (count > SHORT_MAX) { const e = new Error('short_max_25'); e.status = 400; throw e; }
    }
  }
  delete norm.season;
  delete norm.seriesId;
  if (norm.genre !== undefined && norm.genre) {
    const { Genre } = require('../models/content.model');
    const g = await Genre.findOne({ name: norm.genre, status: 'active' }).select('id').lean();
    if (!g) { const e = new Error('bad_genre'); e.status = 400; throw e; }
  }
  if (norm.categoryId !== undefined && norm.categoryId) {
    const { Category } = require('../models/content.model');
    const c = await Category.findOne({ id: norm.categoryId, status: 'active' }).select('id').lean();
    if (!c) { const e = new Error('bad_category'); e.status = 400; throw e; }
  }
  if (norm.tropes !== undefined) {
    const list = Array.isArray(norm.tropes) ? norm.tropes.map(String) : [];
    if (list.length > 10) { const e = new Error('too_many_tropes'); e.status = 400; throw e; }
    if (list.length) {
      const { Trope } = require('../models/content.model');
      const n = await Trope.countDocuments({ name: { $in: list }, status: 'active' });
      if (n !== [...new Set(list)].length) { const e = new Error('bad_trope'); e.status = 400; throw e; }
    }
    norm.tropes = [...new Set(list)];
  }
  const oldGenre = book.genre;
  const oldCategoryId = book.categoryId;
  if (norm.cover !== undefined) norm.cover = validateMediaUrl(norm.cover, 'cover');
  allowed.forEach(k => { if (norm[k] !== undefined) book[k] = norm[k]; });
  if (data.title) book.slug = slugify(data.title) + '-' + String(book.id).slice(-6);
  await book.save();
  try {
    const hub = require('./genres.service');
    if (oldGenre !== book.genre) {
      await Promise.all([hub.recountForGenreName(oldGenre), hub.recountForGenreName(book.genre)]);
    }
    if (String(oldCategoryId || '') !== String(book.categoryId || '')) {
      await Promise.all([hub.recountForCategoryId(oldCategoryId), hub.recountForCategoryId(book.categoryId)]);
    }
  } catch (e) { /* counts best-effort */ }
  return book.toJSON();
}

async function deleteBook({ book }) {
  const { Chapter } = require('../models/content.model');
  const genre = book.genre;
  const categoryId = book.categoryId;
  await Chapter.deleteMany({ bookId: book.id });
  await book.deleteOne();
  try {
    const hub = require('./genres.service');
    await Promise.all([hub.recountForGenreName(genre), hub.recountForCategoryId(categoryId)]);
  } catch (e) { /* counts best-effort */ }
  return { ok: true };
}

// BATCH 1: create-wizard submit — book + chapters in one call.
// New books start as drafts, so chapters apply directly (no proposals).
// At most SHORT_MAX chapters per call; on any chapter failure the book +
// created chapters roll back (no orphans).
async function createBookWithChapters({ authorId, book: bookData, chapters: chapterList }) {
  const chapters = Array.isArray(chapterList) ? chapterList : [];
  if (!chapters.length) { const e = new Error('chapters_required'); e.status = 400; throw e; }
  if (chapters.length > SHORT_MAX) { const e = new Error('batch_too_large'); e.status = 400; throw e; }
  const created = await createBook({ authorId, data: Object.assign({}, bookData, { status: 'draft' }) });
  const done = [];
  try {
    const chaptersSvc = require('./chapters.service');
    for (let i = 0; i < chapters.length; i++) {
      const out = await chaptersSvc.createChapter({ bookId: created.id, data: chapters[i] });
      done.push(out);
    }
  } catch (e) {
    try {
      const { Chapter } = require('../models/content.model');
      await Chapter.deleteMany({ bookId: created.id });
      await Book.deleteOne({ id: created.id });
    } catch (rb) { /* rollback best-effort */ }
    throw e;
  }
  return { book: created, chapters: done };
}

async function loadBookOr404(id) {
  const book = await Book.findOne({ $or: [{ id }, { slug: id }] });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

module.exports = { createBook, createBookWithChapters, listBooks, getBook, getBookDetail, similarBooks, updateBook, deleteBook, loadBookOr404, loadBookById, canWrite, isStaff, slugify, SHORT_MAX, BOOK_LIVE_MIN_WORDS, VISIBLE_BOOK_STATUS, BOOK_CONTENT_FIELDS, bookNeedsProposal, proposeBookEdit, applyBookProposal };
