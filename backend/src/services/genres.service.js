'use strict';
// Genre + Category hub: public reads (about, admins, stories, members),
// join/leave, live counts. Everything keyed by custom `id`; public lookup by slug.
//
// Hub rule: hub is created by the PARENT (category) even though it is called
// "genre hub" — all child genres enter it. GET /api/genres/:slug accepts a
// genre slug OR a category slug (parent hub with children + aggregated stories).
const { Book, Genre, Category, GenreMembership, CategoryMembership, BookDailyStat } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Discussion } = require('../models/social.model');

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function paging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit };
}

function slugify(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'untitled';
}

function toGenre(g) {
  return {
    id: g.id, name: g.name, slug: g.slug, categoryId: g.categoryId,
    desc: g.desc || '', tagline: g.tagline || '', about: g.about || null,
    icon: g.icon || '', cover: g.cover || '', bg: g.bg || '', color: g.color || '',
    adminIds: g.adminIds || [], moderatorIds: g.moderatorIds || [],
    booksCount: g.booksCount || 0, membersCount: g.membersCount || 0,
    status: g.status, createdAt: g.createdAt, updatedAt: g.updatedAt,
  };
}

function toCategory(c) {
  return {
    id: c.id, name: c.name, slug: c.slug,
    icon: c.icon || '', bg: c.bg || '', color: c.color || '',
    desc: c.desc || '', tagline: c.tagline || '', cover: c.cover || '',
    adminIds: c.adminIds || [],
    booksCount: c.booksCount || 0, membersCount: c.membersCount || 0,
    status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt,
  };
}

async function resolveGenre(slugOrId) {
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!g || g.status !== 'active') err('not_found', 404);
  return g;
}

async function resolveCategory(slugOrId) {
  const c = await Category.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!c || c.status !== 'active') err('not_found', 404);
  return c;
}

// ---- public lists ----
async function listGenres({ q, page, limit }) {
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { status: 'active' };
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    Genre.find(filter).sort({ name: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Genre.countDocuments(filter),
  ]);
  return { items: items.map(toGenre), total, page: pg, limit: lim };
}

async function listCategories({ q, page, limit }) {
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { status: 'active' };
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Category.countDocuments(filter),
  ]);
  return { items: items.map(toCategory), total, page: pg, limit: lim };
}

// ---- hub detail: PARENT ONLY ----
// One hub per category. A genre slug (billionaire, marriage) resolves to its
// parent category hub — so both slugs return the SAME hub with ALL books
// under the parent, no matter the child genre.
async function parentHub(categoryId, viewerId) {
  const c = await Category.findOne({ $or: [{ slug: categoryId }, { id: categoryId }] }).lean();
  if (!c || c.status !== 'active') err('not_found', 404);
  const [genres, stories, members, admins] = await Promise.all([
    Genre.find({ categoryId: c.id, status: 'active' }).sort({ name: 1 }).lean(),
    Book.countDocuments({ categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } }),
    CategoryMembership.countDocuments({ categoryId: c.id }),
    (c.adminIds && c.adminIds.length
      ? User.find({ id: { $in: c.adminIds } }).select('username fullName avatar').lean()
      : Promise.resolve([])),
  ]);
  let isJoined = false;
  if (viewerId) {
    const m = await CategoryMembership.exists({ userId: viewerId, categoryId: c.id });
    isJoined = !!m;
  }
  return Object.assign(toCategory(c), {
    isParent: true,
    genres: genres.map(toGenre),
    storiesCount: stories, discussionsCount: 0,
    membersCount: members, isJoined,
    admins: admins.map(a => ({ id: a.id, username: a.username, fullName: a.fullName, avatar: a.avatar })),
    moderators: [],
  });
}

async function genreHub(slugOrId, viewerId) {
  // Genre slug → parent hub. Category slug → parent hub. Same hub either way.
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g && g.status === 'active') return parentHub(g.categoryId, viewerId);
  return parentHub(slugOrId, viewerId);
}

async function categoryHub(slugOrId, viewerId) {
  const c = await resolveCategory(slugOrId);
  const [genres, stories, members, admins] = await Promise.all([
    Genre.find({ categoryId: c.id, status: 'active' }).sort({ name: 1 }).lean(),
    Book.countDocuments({ categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } }),
    CategoryMembership.countDocuments({ categoryId: c.id }),
    (c.adminIds && c.adminIds.length
      ? User.find({ id: { $in: c.adminIds } }).select('username fullName avatar').lean()
      : Promise.resolve([])),
  ]);
  let isJoined = false;
  if (viewerId) {
    const m = await CategoryMembership.exists({ userId: viewerId, categoryId: c.id });
    isJoined = !!m;
  }
  return Object.assign(toCategory(c), {
    genres: genres.map(toGenre), storiesCount: stories,
    membersCount: members, isJoined,
    admins: admins.map(a => ({ id: a.id, username: a.username, fullName: a.fullName, avatar: a.avatar })),
  });
}

// ---- stories in hub ----
// top = most reads. new = newest books. rising = reads velocity
// (reads per day since creation) — fully automatic, no manual picks.
const STORY_FIELDS = 'title authorId cover genre synopsis reads likes rating chapterCount kind createdAt';

function storySort(sort) {
  const s = String(sort || 'top').toLowerCase();
  if (s === 'new' || s === 'recent') return 'new';
  if (s === 'rising') return 'rising';
  return 'top';
}

async function sortedStories(filter, sort, pg, lim) {
  const mode = storySort(sort);
  if (mode === 'new') {
    const [items, total] = await Promise.all([
      Book.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).select(STORY_FIELDS).lean(),
      Book.countDocuments(filter),
    ]);
    return { items, total };
  }
  if (mode === 'rising') {
    // True Rising = reads in the last 7 days (daily snapshots).
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const bookMatch = {};
    if (filter.genre) bookMatch['book.genre'] = filter.genre;
    if (filter.categoryId) bookMatch['book.categoryId'] = filter.categoryId;
    bookMatch['book.status'] = { $in: ['ongoing', 'completed', 'published'] };
    const [rows, total] = await Promise.all([
      BookDailyStat.aggregate([
        { $match: { day: { $gte: cutoff } } },
        { $group: { _id: '$bookId', reads7d: { $sum: '$reads' } } },
        { $lookup: { from: 'books', localField: '_id', foreignField: 'id', as: 'book' } },
        { $unwind: '$book' },
        { $match: bookMatch },
        { $sort: { reads7d: -1 } },
        { $skip: (pg - 1) * lim },
        { $limit: lim },
        { $replaceRoot: { newRoot: { $mergeObjects: ['$book', { reads7d: '$reads7d' }] } } },
      ]),
      Book.countDocuments(filter),
    ]);
    if (rows.length >= lim || pg > 1) return { items: rows, total };
    // Backfill books with no reads this week (new/quiet books) by Top order.
    const seen = new Set(rows.map(r => String(r.id)));
    const need = lim - rows.length;
    const fill = await Book.find(Object.assign({}, filter, { id: { $nin: [...seen] } }))
      .sort({ reads: -1 }).limit(need)
      .select(STORY_FIELDS).lean();
    return { items: rows.concat(fill.map(f => Object.assign(f, { reads7d: 0 }))), total };
  }
  const [items, total] = await Promise.all([
    Book.find(filter).sort({ reads: -1 }).skip((pg - 1) * lim).limit(lim).select(STORY_FIELDS).lean(),
    Book.countDocuments(filter),
  ]);
  return { items, total };
}

async function genreStories(slugOrId, { page, limit, sort }) {
  // Parent only: genre slug → parent category stories (ALL books under the
  // parent, no matter the child genre). Billionaire + marriage = same list.
  let categoryId = slugOrId;
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g && g.status === 'active') categoryId = g.categoryId;
  const c = await Category.findOne({ $or: [{ slug: categoryId }, { id: categoryId }] }).lean();
  if (!c || c.status !== 'active') err('not_found', 404);
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } };
  const [genres, { items, total }] = await Promise.all([
    Genre.find({ categoryId: c.id, status: 'active' }).sort({ name: 1 }).lean(),
    sortedStories(filter, sort, pg, lim),
  ]);
  return { category: toCategory(c), genres: genres.map(toGenre), items, total, page: pg, limit: lim, sort: storySort(sort), isParent: true };
}

async function categoryStories(slugOrId, { page, limit, sort }) {
  const c = await resolveCategory(slugOrId);
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } };
  const { items, total } = await sortedStories(filter, sort, pg, lim);
  return { category: toCategory(c), items, total, page: pg, limit: lim, sort: storySort(sort) };
}

// ---- members: parent only (genre slug → parent category members) ----
async function genreMembers(slugOrId, { page, limit }) {
  let categoryId = slugOrId;
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g && g.status === 'active') categoryId = g.categoryId;
  const c = await Category.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!c || c.status !== 'active') err('not_found', 404);
  const { page: pg, limit: lim } = paging({ page, limit });
  const [edges, total] = await Promise.all([
    CategoryMembership.find({ categoryId: c.id }).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    CategoryMembership.countDocuments({ categoryId: c.id }),
  ]);
  const users = edges.length
    ? await User.find({ id: { $in: edges.map(e => e.userId) } }).select('username fullName avatar roles').lean()
    : [];
  return {
    items: users.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, roles: u.roles })),
    total, page: pg, limit: lim, isParent: true,
  };
}

// ---- join / leave: parent only (genre slug joins the parent) ----
async function joinGenre(userId, slugOrId) {
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g && g.status === 'active') return joinCategory(userId, g.categoryId);
  // Parent slug → join the parent (category) instead.
  return joinCategory(userId, slugOrId);
}

async function leaveGenre(userId, slugOrId) {
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g && g.status === 'active') return leaveCategory(userId, g.categoryId);
  return leaveCategory(userId, slugOrId);
}

async function joinCategory(userId, slugOrId) {
  const c = await resolveCategory(slugOrId);
  try {
    await CategoryMembership.create({ userId, categoryId: c.id });
  } catch (e) { if (e.code !== 11000) throw e; }
  const count = await CategoryMembership.countDocuments({ categoryId: c.id });
  await Category.updateOne({ id: c.id }, { membersCount: count });
  return { ok: true, joined: true, membersCount: count };
}

async function leaveCategory(userId, slugOrId) {
  const c = await resolveCategory(slugOrId);
  await CategoryMembership.deleteOne({ userId, categoryId: c.id });
  const count = await CategoryMembership.countDocuments({ categoryId: c.id });
  await Category.updateOne({ id: c.id }, { membersCount: count });
  return { ok: true, joined: false, membersCount: count };
}

// ---- counts maintenance (called from books flow) ----
async function recountForGenreName(genreName) {
  if (!genreName) return;
  const g = await Genre.findOne({ name: genreName }).select('id').lean();
  if (!g) return;
  const count = await Book.countDocuments({ genre: genreName });
  await Genre.updateOne({ id: g.id }, { booksCount: count });
}

async function recountForCategoryId(categoryId) {
  if (!categoryId) return;
  const count = await Book.countDocuments({ categoryId });
  await Category.updateOne({ id: categoryId }, { booksCount: count });
}

module.exports = {
  slugify, toGenre, toCategory,
  listGenres, listCategories, genreHub, categoryHub,
  genreStories, categoryStories, genreMembers,
  joinGenre, leaveGenre, joinCategory, leaveCategory,
  recountForGenreName, recountForCategoryId,
};
