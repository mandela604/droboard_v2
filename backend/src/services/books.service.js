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

// Book detail with chapters — everything is keyed by bookId.
// Public: live chapters only (drafts never leak onto the platform).
async function getBookDetail(id) {
  const book = await getBook(id);
  const chapters = await require('../models/content.model').Chapter
    .find({ bookId: book.id, status: { $in: ['live', 'published'] } }).sort({ n: 1 }).select('n title words status views').lean();
  return Object.assign({}, book, { chapters });
}

function canWrite(book, user) {
  if (!user) return false;
  if ((user.roles || []).some(r => ['admin', 'chief_editor', 'senior_editor'].includes(r))) return true;
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

module.exports = { createBook, createBookWithChapters, listBooks, getBook, getBookDetail, updateBook, deleteBook, loadBookOr404, loadBookById, canWrite, isStaff, slugify, SHORT_MAX, BOOK_LIVE_MIN_WORDS, VISIBLE_BOOK_STATUS, BOOK_CONTENT_FIELDS, bookNeedsProposal, proposeBookEdit, applyBookProposal };
