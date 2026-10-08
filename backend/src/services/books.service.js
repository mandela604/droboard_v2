'use strict';
const { Book } = require('../models/content.model');

function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'untitled';
}

const SHORT_MAX = 25;

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

async function listBooks({ q, genre, status, kind, authorId, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
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
async function getBookDetail(id) {
  const book = await getBook(id);
  const chapters = await require('../models/content.model').Chapter
    .find({ bookId: book.id }).sort({ n: 1 }).select('n title words status views').lean();
  return Object.assign({}, book, { chapters });
}

function canWrite(book, user) {
  if (!user) return false;
  if ((user.roles || []).some(r => ['admin', 'chief_editor', 'senior_editor'].includes(r))) return true;
  return String(book.authorId) === String(user.id);
}

async function updateBook({ book, data }) {
  const allowed = ['title', 'synopsis', 'genre', 'categoryId', 'cover', 'tags', 'status', 'kind'];
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
  const oldGenre = book.genre;
  const oldCategoryId = book.categoryId;
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

async function loadBookOr404(id) {
  const book = await Book.findOne({ $or: [{ id }, { slug: id }] });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

module.exports = { createBook, listBooks, getBook, getBookDetail, updateBook, deleteBook, loadBookOr404, canWrite, slugify, SHORT_MAX };
