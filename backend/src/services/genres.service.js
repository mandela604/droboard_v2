'use strict';
// Genre + Category hub: public reads (about, admins, stories, members),
// join/leave, live counts. Everything keyed by custom `id`; public lookup by slug.
//
// Hub rule: hub is created by the PARENT (category) even though it is called
// "genre hub" — all child genres enter it. GET /api/genres/:slug accepts a
// genre slug OR a category slug (parent hub with children + aggregated stories).
const { Book, Chapter, Genre, Category, GenreMembership, CategoryMembership, BookDailyStat } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Discussion, Follow } = require('../models/social.model');

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
    booksCount: g.booksCount || 0, membersCount: g.membersCount || 0,
    status: g.status, createdAt: g.createdAt, updatedAt: g.updatedAt,
    // Same board-facing aliases as toCategory: display labels, printed as-is.
    // The numbers stay under booksCount / membersCount for the CE console.
    blurb: g.desc || '',
    stories: compact(g.booksCount || 0),
    members: compact(g.membersCount || 0),
  };
}

// Board cards show "1.2K members", not "1234" — the label travels with the
// number so the board never has to guess a locale.
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

function toCategory(c) {
  return {
    id: c.id, name: c.name, slug: c.slug,
    icon: c.icon || '', bg: c.bg || '', color: c.color || '',
    desc: c.desc || '', tagline: c.tagline || '', cover: c.cover || '',
    adminIds: c.adminIds || [], moderatorIds: c.moderatorIds || [],
    rules: c.rules || [],
    booksCount: c.booksCount || 0, membersCount: c.membersCount || 0,
    status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt,
    // Board contract: a board IS the category the CE created. The reader-side
    // surfaces print these names directly, so they are display labels; the raw
    // numbers stay in booksCount / membersCount for the CE console.
    blurb: c.desc || '',
    stories: compact(c.booksCount || 0),
    members: compact(c.membersCount || 0),
  };
}

// The board's crew: one admin team + one moderator team for the whole category.
// Genres are sections inside the board and carry no crew of their own.
async function boardCrew(c) {
  const adminIds = (c.adminIds || []).map(String);
  const modIds = (c.moderatorIds || []).map(String);
  const ids = [...new Set([...adminIds, ...modIds])];
  const users = ids.length
    ? await User.find({ id: { $in: ids } }).select('id username fullName avatar').lean()
    : [];
  const shape = u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar });
  const pick = list => users.filter(u => list.includes(String(u.id))).map(shape);
  return { admins: pick(adminIds), moderators: pick(modIds) };
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

// Boards are categories. The boards explorer splits its two sections from this:
// joined=me returns only the boards the reader joined, and every row carries
// isJoined so a single call can paint both halves.
async function listCategories({ q, page, limit, viewerId, joined }) {
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { status: 'active' };
  if (q) filter.name = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  let memberIds = [];
  if (viewerId) {
    memberIds = (await CategoryMembership.find({ userId: viewerId }).select('categoryId').lean())
      .map(m => String(m.categoryId));
    if (joined === 'me') {
      if (!memberIds.length) return { items: [], total: 0, page: pg, limit: lim };
      filter.id = { $in: memberIds };
    }
  } else if (joined === 'me') {
    return { items: [], total: 0, page: pg, limit: lim };
  }
  const [items, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Category.countDocuments(filter),
  ]);
  const joinedSet = new Set(memberIds);
  return {
    items: items.map(c => Object.assign(toCategory(c), { isJoined: joinedSet.has(String(c.id)) })),
    total, page: pg, limit: lim,
  };
}

// ---- hub detail: PARENT ONLY ----
// One hub per category. A genre slug (billionaire, marriage) resolves to its
// parent category hub — so both slugs return the SAME hub with ALL books
// under the parent, no matter the child genre.
async function parentHub(categoryId, viewerId) {
  const c = await Category.findOne({ $or: [{ slug: categoryId }, { id: categoryId }] }).lean();
  if (!c || c.status !== 'active') err('not_found', 404);
  // Genres first: the discussion count filters on their ids, and referencing the
  // destructured binding inside the same Promise.all is a TDZ error.
  const genres = await Genre.find({ categoryId: c.id, status: 'active' }).sort({ name: 1 }).lean();
  const [stories, members, discussions, crew] = await Promise.all([
    Book.countDocuments({ categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } }),
    CategoryMembership.countDocuments({ categoryId: c.id }),
    Discussion.countDocuments({ genreId: { $in: genres.map(g => g.id) } }), // discussions in child genres
    boardCrew(c),
  ]);
  let isJoined = false;
  if (viewerId) {
    const m = await CategoryMembership.exists({ userId: viewerId, categoryId: c.id });
    isJoined = !!m;
  }
  return Object.assign(toCategory(c), {
    isParent: true,
    genres: genres.map(toGenre),
    storiesCount: stories, discussionsCount: discussions,
    membersCount: members, isJoined,
    // The board prints these live values (as labels), not the stored counts
    // toCategory aliased. Raw numbers stay in the *Count fields above.
    stories: compact(stories), members: compact(members), discussions: compact(discussions),
    admins: crew.admins, moderators: crew.moderators,
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
  const [genres, stories, members, crew] = await Promise.all([
    Genre.find({ categoryId: c.id, status: 'active' }).sort({ name: 1 }).lean(),
    Book.countDocuments({ categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } }),
    CategoryMembership.countDocuments({ categoryId: c.id }),
    boardCrew(c),
  ]);
  let isJoined = false;
  if (viewerId) {
    const m = await CategoryMembership.exists({ userId: viewerId, categoryId: c.id });
    isJoined = !!m;
  }
  const discussions = await Discussion.countDocuments({ genreId: { $in: genres.map(g => g.id) } });
  return Object.assign(toCategory(c), {
    genres: genres.map(toGenre), storiesCount: stories, discussionsCount: discussions,
    membersCount: members, isJoined,
    stories: compact(stories), members: compact(members), discussions: compact(discussions),
    admins: crew.admins, moderators: crew.moderators,
  });
}

// ---- stories in hub ----
// top = most reads. new = newest books. rising = reads velocity
// (reads per day since creation) — fully automatic, no manual picks.
const STORY_FIELDS = 'id title authorId cover genre synopsis reads likes rating chapterCount kind status createdAt';

// Board story rows render through the shared book card. The UI knows the writer
// under two names depending on the component (`s.author || s.writer`), so both
// keys carry the same bare username — the card adds the "@" itself.
//
// `latestChapterAt` is the only "New" signal the board has: the front end used
// to roll dice for it. A row is new when its newest live chapter is recent.
async function storyCards(docs) {
  const ids = Array.from(new Set(docs.map(d => String(d.authorId || '')).filter(Boolean)));
  const bookIds = docs.map(d => String(d.id));
  const [users, drops] = await Promise.all([
    ids.length ? User.find({ id: { $in: ids } }).select('id username').lean() : [],
    bookIds.length ? Chapter.aggregate([
      { $match: { bookId: { $in: bookIds }, status: { $in: ['live', 'published', 'scheduled'] } } },
      { $group: { _id: '$bookId', latestChapterAt: { $max: '$createdAt' } } },
    ]) : [],
  ]);
  const nameOf = {};
  users.forEach(u => { nameOf[String(u.id)] = u.username || ''; });
  const dropOf = {};
  drops.forEach(d => { dropOf[String(d._id)] = d; });
  return docs.map(b => {
    const w = nameOf[String(b.authorId)] || '';
    const drop = dropOf[String(b.id)] || {};
    return Object.assign({}, b, {
      chapters: b.chapterCount || 0,
      writer: w, author: w,
      latestChapterAt: drop.latestChapterAt ? new Date(drop.latestChapterAt).toISOString() : null,
    });
  });
}

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
  return { category: toCategory(c), genres: genres.map(toGenre), items: await storyCards(items), total, page: pg, limit: lim, sort: storySort(sort), isParent: true };
}

async function categoryStories(slugOrId, { page, limit, sort }) {
  const c = await resolveCategory(slugOrId);
  const { page: pg, limit: lim } = paging({ page, limit });
  const filter = { categoryId: c.id, status: { $in: ['ongoing', 'completed', 'published'] } };
  const { items, total } = await sortedStories(filter, sort, pg, lim);
  return { category: toCategory(c), items: await storyCards(items), total, page: pg, limit: lim, sort: storySort(sort) };
}

// ---- members: parent only (genre slug → parent category members) ----
async function genreMembers(slugOrId, { page, limit, viewerId }) {
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
    ? await User.find({ id: { $in: edges.map(e => e.userId) } }).select('id username fullName avatar bio roles').lean()
    : [];
  // The member list is the shared FollowList component, so each row needs the
  // viewer's follow state — otherwise every joined member reads "Follow".
  let following = new Set();
  if (viewerId && users.length) {
    following = new Set((await Follow.find({
      followerId: viewerId, followingId: { $in: users.map(u => String(u.id)) },
    }).select('followingId').lean()).map(f => String(f.followingId)));
  }
  return {
    items: users.map(u => {
      const login = u.username || String(u.fullName || '').toLowerCase().replace(/\s+/g, '_');
      // FollowList uses `handle` as the key it links and follows by, and prints
      // "@" itself — so both name and handle are the bare username.
      return {
        id: u.id, username: u.username, fullName: u.fullName,
        name: login, handle: login,
        av: u.avatar || '', avatar: u.avatar || '',
        meta: u.bio || (u.roles || []).join(' · '),
        roles: u.roles || [], isWriter: (u.roles || []).some(r => ['writer', 'senior_editor', 'chief_editor'].includes(r)),
        following: following.has(String(u.id)),
      };
    }),
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

// ---- board membership gate for writes ----
// Reading a board is open to everyone; writing in it is not. A thread attaches
// to a child genre, but the board the reader joins is the PARENT category, so
// every check resolves genre → category first.
//
// The people who run a board are the crew assigned to the board row by the
// admin console: Category.adminIds + Category.moderatorIds. That crew is the
// only crew — a genre is a section inside the board and grants nothing. They
// act without joining; a plain reader or writer does not get in.
const BOARD_STAFF = ['chief_editor', 'senior_editor', 'admin', 'super_admin', 'moderator', 'support'];

async function boardCategoryOf({ genreId, categoryId }) {
  if (categoryId) {
    const c = await Category.findOne({ $or: [{ id: categoryId }, { slug: categoryId }] }).select('id').lean();
    return c ? c.id : null;
  }
  if (genreId) {
    const g = await Genre.findOne({ $or: [{ id: genreId }, { slug: genreId }] }).select('categoryId').lean();
    if (g && g.categoryId) return g.categoryId;
    // A category slug also reaches this helper — boards accept either key.
    const c = await Category.findOne({ $or: [{ id: genreId }, { slug: genreId }] }).select('id').lean();
    return c ? c.id : null;
  }
  return null;
}

async function isBoardMember(userId, ref) {
  const cid = await boardCategoryOf(ref);
  if (!cid || !userId) return false;
  if (await CategoryMembership.exists({ userId, categoryId: cid })) return true;
  const c = await Category.findOne({ id: cid }).select('adminIds moderatorIds').lean();
  if (!c) return false;
  const crew = [...(c.adminIds || []), ...(c.moderatorIds || [])].map(String);
  return crew.includes(String(userId));
}

function assertBoardMember(user, ref) {
  if (!user || !user.id) { const e = new Error('unauthenticated'); e.status = 401; throw e; }
  const roles = user.roles || [];
  if (roles.some(r => BOARD_STAFF.includes(String(r)))) return Promise.resolve(true);
  return isBoardMember(user.id, ref).then(ok => {
    if (ok) return true;
    const e = new Error('join_board_first'); e.status = 403; throw e;
  });
}

module.exports = {
  slugify, toGenre, toCategory,
  listGenres, listCategories, genreHub, categoryHub,
  genreStories, categoryStories, genreMembers,
  joinGenre, leaveGenre, joinCategory, leaveCategory,
  recountForGenreName, recountForCategoryId,
  boardCategoryOf, isBoardMember, assertBoardMember,
};
