'use strict';
const { Book, Category, Genre } = require('../models/content.model');
const { FeaturedSection, FeaturedPlacement, FeaturedHistory } = require('../models/editorial.model');

// ---- helpers (mirror books.service.js / posts.service.js envelope) ----
function paging(query) {
  const pg = Math.max(1, parseInt(query.page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { pg, lim };
}

async function paged(findQuery, countQuery, pg, lim, sort) {
  const [items, total] = await Promise.all([
    findQuery.sort(sort).skip((pg - 1) * lim).limit(lim).lean(),
    countQuery,
  ]);
  return { items, total, page: pg, limit: lim };
}

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

const BOOK_SORTS = {
  recent: { updatedAt: -1 },
  views: { reads: -1 },
  likes: { likes: -1 },
  // Book has no comment counter; rating is the closest engagement proxy.
  comments: { rating: -1 },
};

// ---- Books ----
async function listBooks({ q, genre, status, sort, page, limit }) {
  const filter = {};
  if (genre) filter.genre = genre;
  if (status) filter.status = status;
  if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { authorId: new RegExp(q, 'i') }];
  const { pg, lim } = paging({ page, limit });
  return paged(
    Book.find(filter),
    Book.countDocuments(filter),
    pg, lim,
    BOOK_SORTS[sort] || BOOK_SORTS.recent,
  );
}

async function getBook(id) {
  const book = await Book.findOne({ $or: [{ id: id }, { slug: id }] }).lean();
  if (!book) err('not_found', 404);
  return book;
}

async function loadBookOr404(id) {
  const book = await Book.findOne({ $or: [{ id: id }, { slug: id }] });
  if (!book) err('not_found', 404);
  return book;
}

async function flagBook(id) {
  const book = await loadBookOr404(id);
  if (book.status !== 'published') err('only_published_can_be_flagged', 409);
  book.status = 'flagged';
  await book.save();
  return book.toJSON();
}

async function unflagBook(id) {
  const book = await loadBookOr404(id);
  if (book.status !== 'flagged') err('only_flagged_can_be_unflagged', 409);
  book.status = 'published';
  await book.save();
  return book.toJSON();
}

async function genres() {
  const list = await Book.distinct('genre');
  return list.filter(Boolean).sort();
}

// ---- Featured ----
const STATIC_TAGS = ['trending', 'new', 'top-rated', 'editors-pick', 'hero', 'spotlight', 'completed', 'ongoing'];

async function tags() {
  const [keys, placed] = await Promise.all([
    FeaturedSection.find().distinct('key'),
    FeaturedPlacement.distinct('tag'),
  ]);
  return Array.from(new Set([...keys, ...placed.filter(Boolean), ...STATIC_TAGS])).sort();
}

async function sections() {
  return FeaturedSection.find().lean();
}

async function library({ q, genre, page, limit }) {
  const filter = { status: 'published' };
  if (genre) filter.genre = genre;
  if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { authorId: new RegExp(q, 'i') }];
  const { pg, lim } = paging({ page, limit });
  return paged(
    Book.find(filter).select('id title authorId cover genre synopsis reads likes rating'),
    Book.countDocuments(filter),
    pg, lim,
    { updatedAt: -1 },
  );
}

async function placements({ tag, section, page, limit }) {
  const filter = {};
  if (tag) filter.tag = new RegExp(tag, 'i');
  if (section) filter.sectionKey = section;
  const { pg, lim } = paging({ page, limit });
  return paged(
    FeaturedPlacement.find(filter),
    FeaturedPlacement.countDocuments(filter),
    pg, lim,
    { order: 1, createdAt: -1 },
  );
}

// body map: bookId=storyId, sectionKey=section,
// tag=sub || tags.join(',') || note (placement schema has a single `tag` field).
function toTag({ sub, tags: tg, note }) {
  if (sub) return sub;
  if (Array.isArray(tg) && tg.length) return tg.join(',');
  return note || '';
}

async function addPlacement({ storyId, section, sub, tags: tg, start, end, note, placedBy }) {
  const book = await Book.findOne({id: storyId}).lean();
  if (!book) err('not_found', 404);
  const doc = await FeaturedPlacement.create({
    bookId: storyId,
    sectionKey: section || 'hero-banner',
    tag: toTag({ sub, tags: tg, note }),
    startAt: start ? new Date(start) : new Date(),
    endAt: end ? new Date(end) : null,
    placedBy,
  });
  await FeaturedHistory.create({ bookId: storyId, section: doc.sectionKey, action: 'added', byId: placedBy });
  return doc.toJSON();
}

async function loadPlacementOr404(storyId) {
  const p = await FeaturedPlacement.findOne({ bookId: storyId });
  if (!p) err('not_found', 404);
  return p;
}

async function updatePlacement(storyId, data) {
  const p = await loadPlacementOr404(storyId);
  if (data.section !== undefined) p.sectionKey = data.section;
  if (data.sub !== undefined || data.tags !== undefined || data.note !== undefined) {
    p.tag = toTag({ sub: data.sub, tags: data.tags, note: data.note });
  }
  if (data.start !== undefined) p.startAt = data.start ? new Date(data.start) : p.startAt;
  if (data.end !== undefined) p.endAt = data.end ? new Date(data.end) : null;
  if (data.order !== undefined) p.order = data.order;
  if (data.active !== undefined) p.active = data.active;
  await p.save();
  return p.toJSON();
}

async function removePlacement(storyId, byId) {
  const p = await loadPlacementOr404(storyId);
  const section = p.sectionKey;
  await p.deleteOne();
  await FeaturedHistory.create({ bookId: storyId, section, action: 'removed', byId });
  return { ok: true };
}

async function history({ q, page, limit }) {
  const filter = {};
  if (q) filter.$or = [{ section: new RegExp(q, 'i') }, { bookId: new RegExp(q, 'i') }];
  const { pg, lim } = paging({ page, limit });
  return paged(
    FeaturedHistory.find(filter),
    FeaturedHistory.countDocuments(filter),
    pg, lim,
    { at: -1 },
  );
}

// :index param is accepted as a history id; a plain integer falls back to
// position in newest-first order.
async function refeature(index, byId) {
  let h = null;
  try { h = await FeaturedHistory.findOne({id: index}).lean(); } catch (e) { h = null; }
  if (!h && /^\d+$/.test(String(index))) {
    const rows = await FeaturedHistory.find().sort({ at: -1 }).skip(Number(index)).limit(1).lean();
    h = rows[0] || null;
  }
  if (!h) err('not_found', 404);
  return addPlacement({ storyId: h.bookId, section: h.section || 'hero-banner', placedBy: byId });
}

// ---- Categories ----
function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'untitled';
}

async function listCategories({ q, page, limit, status }) {
  const filter = {};
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (status) filter.status = status;
  const { pg, lim } = paging({ page, limit });
  return paged(Category.find(filter), Category.countDocuments(filter), pg, lim, { name: 1 });
}

async function createCategory(data) {
  const slug = data.slug || slugify(data.name);
  if (await Category.exists({ $or: [{ slug }, { name: data.name }] })) err('category_exists', 409);
  const doc = await Category.create(Object.assign({}, data, { slug }));
  return doc.toJSON();
}

async function updateCategory(id, data) {
  const doc = await Category.findOne({id: id});
  if (!doc) err('not_found', 404);
  if (data.adminIds !== undefined && data.adminIds.length) {
    const { User } = require('../models/user.model');
    const n = await User.countDocuments({ id: { $in: data.adminIds } });
    if (n !== data.adminIds.length) err('bad_admin', 400);
  }
  ['name', 'slug', 'icon', 'bg', 'color', 'desc', 'tagline', 'cover', 'adminIds'].forEach(k => { if (data[k] !== undefined) doc[k] = data[k]; });
  await doc.save();
  return doc.toJSON();
}

async function deleteCategory(id) {
  const doc = await Category.findOne({id: id});
  if (!doc) err('not_found', 404);
  const [genresInUse, booksInUse] = await Promise.all([
    Genre.countDocuments({ categoryId: doc.id }),
    Book.countDocuments({ categoryId: doc.id }),
  ]);
  if (genresInUse || booksInUse) err('category_in_use', 409);
  await doc.deleteOne();
  return { ok: true };
}

async function toggleCategoryStatus(id) {
  const doc = await Category.findOne({id: id});
  if (!doc) err('not_found', 404);
  doc.status = doc.status === 'active' ? 'inactive' : 'active';
  await doc.save();
  return doc.toJSON();
}

// ---- Genres (full hub fields: slug/about/admins) ----
async function listGenres({ q, page, limit, status, categoryId }) {
  const filter = {};
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (status) filter.status = status;
  if (categoryId) filter.categoryId = categoryId;
  const { pg, lim } = paging({ page, limit });
  return paged(Genre.find(filter), Genre.countDocuments(filter), pg, lim, { name: 1 });
}

async function createGenre(data) {
  if (!data.categoryId) err('category_required', 400);
  const cat = await Category.findOne({ id: data.categoryId }).select('id').lean();
  if (!cat) err('bad_category', 400);
  const slug = data.slug || slugify(data.name);
  if (await Genre.exists({ $or: [{ slug }, { name: data.name }] })) err('genre_exists', 409);
  if (data.adminIds && data.adminIds.length) {
    const { User } = require('../models/user.model');
    const n = await User.countDocuments({ id: { $in: data.adminIds } });
    if (n !== data.adminIds.length) err('bad_admin', 400);
  }
  const doc = await Genre.create(Object.assign({}, data, { slug }));
  return doc.toJSON();
}

async function updateGenre(id, data) {
  const doc = await Genre.findOne({id: id});
  if (!doc) err('not_found', 404);
  if (data.categoryId !== undefined && data.categoryId) {
    const cat = await Category.findOne({ id: data.categoryId }).select('id').lean();
    if (!cat) err('bad_category', 400);
  }
  if (data.adminIds !== undefined && data.adminIds.length) {
    const { User } = require('../models/user.model');
    const n = await User.countDocuments({ id: { $in: data.adminIds } });
    if (n !== data.adminIds.length) err('bad_admin', 400);
  }
  if (data.moderatorIds !== undefined && data.moderatorIds.length) {
    const { User } = require('../models/user.model');
    const n = await User.countDocuments({ id: { $in: data.moderatorIds } });
    if (n !== data.moderatorIds.length) err('bad_moderator', 400);
  }
  ['name', 'slug', 'categoryId', 'desc', 'tagline', 'about', 'icon', 'cover', 'bg', 'color', 'adminIds', 'moderatorIds'].forEach(k => { if (data[k] !== undefined) doc[k] = data[k]; });
  await doc.save();
  return doc.toJSON();
}

async function deleteGenre(id) {
  const doc = await Genre.findOne({id: id});
  if (!doc) err('not_found', 404);
  const booksInUse = await Book.countDocuments({ genre: doc.name });
  if (booksInUse) err('genre_in_use', 409);
  await doc.deleteOne();
  return { ok: true };
}

async function toggleGenreStatus(id) {
  const doc = await Genre.findOne({id: id});
  if (!doc) err('not_found', 404);
  doc.status = doc.status === 'active' ? 'inactive' : 'active';
  await doc.save();
  return doc.toJSON();
}

async function popularGenres() {
  return Book.aggregate([
    { $match: { genre: { $ne: '' } } },
    { $group: { _id: '$genre', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, name: '$_id', count: 1 } },
  ]);
}

module.exports = {
  listBooks, getBook, flagBook, unflagBook, genres,
  tags, sections, library, placements, addPlacement, updatePlacement, removePlacement, history, refeature,
  listCategories, createCategory, updateCategory, deleteCategory, toggleCategoryStatus,
  listGenres, createGenre, updateGenre, deleteGenre, toggleGenreStatus, popularGenres,
};
