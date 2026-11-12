'use strict';
// Genre-hub discussion threads. Threads live under a Genre (genreId); a
// category hub lists threads across ALL child genres. Comments are handled
// by comments.service with scope='discussion' + discussionId — this service
// keeps Discussion.commentsCount in sync via the comments service hooks.
const { Discussion, Comment } = require('../models/social.model');
const { Genre, Category } = require('../models/content.model');
const { User } = require('../models/user.model');
const { validateMediaUrl } = require('./media.service');
const boards = require('./genres.service');
const { relTime } = require('./users.service');

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function paging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit };
}

// Resolve a slug-or-id to the set of genre ids whose threads belong on that
// hub page: a genre resolves to itself; a category resolves to all children.
async function resolveGenreIds(slugOrId) {
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (g) return { genreIds: [g.id], label: g.name };
  const c = await Category.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!c) err('genre_not_found', 404);
  const kids = await Genre.find({ categoryId: c.id }).select('id').lean();
  return { genreIds: kids.map(k => k.id), label: c.name };
}

// Writes attach a thread to ONE genre, never a whole category. The hub composer
// opens a BOARD (the CE category), so it often names the board rather than a
// child — a genre slug wins outright; a board slug needs the child picked.
async function resolveThreadGenre(slugOrId, childHint) {
  const direct = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (direct) return direct;
  const c = await Category.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!c) err('genre_not_found', 404);
  const kids = await Genre.find({ categoryId: c.id, status: 'active' }).lean();
  if (!kids.length) err('empty_board', 400);
  if (childHint) {
    const kid = kids.find(k => String(k.id) === String(childHint) || String(k.slug) === String(childHint));
    if (!kid) err('genre_not_in_board', 400);
    return kid;
  }
  if (kids.length === 1) return kids[0];
  err('pick_board_genre', 400);
}

async function withAuthors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(list.map(r => String(r.authorId || '')).filter(Boolean))];
  if (!ids.length) return list;
  // authorId always stores the minted uuid `id` (never _id). Querying `{ _id:
  // { $in: ids } }` too makes Mongoose cast each uuid to ObjectId and throw,
  // and the empty catch silently dropped EVERY author to the "User" placeholder.
  const users = await User.find({ id: { $in: ids } })
    .select('id username fullName avatar emailVerified').lean();
  const byId = {};
  (users || []).forEach(u => {
    const key = String(u.id || u._id || '');
    if (key) byId[key] = {
      id: key, handle: u.username || '', name: u.fullName || u.username || 'User',
      avatar: u.avatar || '', verified: !!u.emailVerified,
    };
  });
  list.forEach(r => { r.author = byId[String(r.authorId || '')] || { id: String(r.authorId || ''), handle: '', name: 'User', avatar: '', verified: false }; });
  return list;
}

function toCard(d, viewerId) {
  const uid = String(viewerId || '');
  const rxMap = d.reactions instanceof Map ? Object.fromEntries(d.reactions) : (d.reactions || {});
  const myRx = uid ? null : null; // viewer reaction fetched separately via reactionState
  return {
    id: d.id, genreId: d.genreId,
    title: d.title, body: d.body || '', tag: d.tag, media: d.media || '',
    trope: d.trope || '', story: d.story || null,
    likes: d.likes || 0, liked: uid ? (d.likedBy || []).map(String).includes(uid) : false,
    reactions: rxMap,
    hot: !!d.hot, commentsCount: d.commentsCount || 0, score: d.score || 0,
    badge: d.badge || '', badgeClass: d.badgeClass || '', controversy: d.controversy || 0,
    pinned: !!d.pinned,
    createdAt: d.createdAt, author: d.author,
  };
}

/* The card the reader actually paints. discussion.html and the hub list render
   ONE flat card — name/avatar/time/comments, not a nested author object — and
   that is the same object the feed's "Trending in hubs" row paints, so both
   come out of this one function and can never drift.

   opts.feed=true is the trending ROW: media/trope/story stay stripped, because
   the hub card deliberately shows no image and no book-rec block (asserted by
   smoke-feed-live D4/D8). Without it you get the full OP the thread page and
   the board list need, plus _genreName for the "· Dark Romance" line. */
function toFlatCard(d, viewerId, opts) {
  const c = toCard(d, viewerId);
  const feedRow = !!(opts && opts.feed);
  const tagClass = String(c.tag || 'discussion');
  const a = c.author || { name: '', handle: '', avatar: '', verified: false };
  const out = {
    id: c.id, title: c.title, body: c.body,
    tag: tagClass.charAt(0).toUpperCase() + tagClass.slice(1), tagClass,
    score: c.score, hot: c.hot,
    badge: c.badge, badgeClass: c.badgeClass, controversy: c.controversy,
    pinned: c.pinned,
    likes: c.likes, liked: c.liked, comments: c.commentsCount,
    name: a.name || '', avatar: a.avatar || '', handle: a.handle || '',
    verified: !!a.verified,
    time: relTime(c.createdAt),
    createdAt: c.createdAt,
    _genreId: String(c.genreId || ''),
    _genreName: (opts && opts.genreName) || '',
  };
  if (feedRow) return out;
  return Object.assign(out, {
    genreId: c.genreId, media: c.media, trope: c.trope, story: c.story,
    commentsCount: c.commentsCount,
  });
}

/* "· Dark Romance" on the OP header and the hub subtitle both come from the
   Genre row, not a stored string, so the label is looked up per genre id. */
async function genreNames(rows) {
  const ids = [...new Set(rows.map(r => String(r.genreId || '')).filter(Boolean))];
  if (!ids.length) return {};
  const genres = await Genre.find({ id: { $in: ids } }).select('id name').lean();
  const byId = {};
  genres.forEach(g => { byId[String(g.id)] = g.name; });
  return byId;
}

function sortSpec(sort) {
  if (sort === 'top') return { likes: -1, createdAt: -1 };
  if (sort === 'hot') return { hot: -1, score: -1, createdAt: -1 };
  return { createdAt: -1 };
}

async function listThreads({ genre, tag, sort, page, limit, viewerId }) {
  const { genreIds, label } = await resolveGenreIds(genre);
  const filter = { genreId: { $in: genreIds } };
  if (tag) filter.tag = tag;
  const { page: pg, limit: lim } = paging({ page, limit });
  const [items, total] = await Promise.all([
    Discussion.find(filter).sort(sortSpec(sort)).skip((pg - 1) * lim).limit(lim).lean(),
    Discussion.countDocuments(filter),
  ]);
  await withAuthors(items);
  const gname = await genreNames(items);
  return {
    items: items.map(d => toFlatCard(d, viewerId, { genreName: gname[String(d.genreId)] || label })),
    total, page: pg, limit: lim, hasMore: pg * lim < total,
  };
}

// Cross-genre threads for the reader feed's "Trending in hubs" row. Unlike
// listThreads (one hub), this spans every genre. Returns EXACTLY the flat card
// shape the demo community row renders — nothing more: media/trope/story are
// intentionally omitted (feed-service.js strips them for the demo seed too, so
// the trending card never shows an image or a book-rec block). tag is the
// Title-case pill label the card displays; tagClass is the lowercase CSS key.
// Built on toCard so the two readers never drift.
// Pagination is optional: the feed row calls it with a bare limit (page
// defaults to 1) and only reads `items`, so page/total/hasMore are additive —
// the _id tiebreaker keeps pages from duplicating or dropping rows when heat
// scores tie.
async function feedThreads({ limit, page, viewerId } = {}) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const sort = { hot: -1, score: -1, likes: -1, createdAt: -1, _id: 1 };
  const [rows, total] = await Promise.all([
    Discussion.find({}).sort(sort).skip((pg - 1) * lim).limit(lim).lean(),
    Discussion.countDocuments({}),
  ]);
  await withAuthors(rows);
  const gname = await genreNames(rows);
  return {
    items: rows.map(d => toFlatCard(d, viewerId, {
      feed: true, genreName: gname[String(d.genreId)] || '',
    })),
    total, page: pg, limit: lim, hasMore: pg * lim < total,
  };
}

const TAGS = ['discussion', 'recommendation', 'theory', 'question', 'controversial'];
function normTag(tag) {
  const t = String(tag || 'discussion').toLowerCase().trim();
  if (!TAGS.includes(t)) err('bad_tag', 400);
  return t;
}

async function createThread({ user, genre, genreId, title, body, tag, media, trope, story }) {
  const userId = user && user.id;
  const g = await resolveThreadGenre(genre, genreId);
  // Posting is a board action: the writer must belong to the parent board.
  await boards.assertBoardMember(user, { genreId: g.id });
  const doc = await Discussion.create({
    genreId: g.id, authorId: userId,
    title: String(title).slice(0, 200), body: String(body || '').slice(0, 8000),
    tag: normTag(tag), media: validateMediaUrl(media, 'media'),
    trope: String(trope || '').slice(0, 60), story: story || null,
  });
  const out = doc.toJSON();
  await withAuthors([out]);
  const gname = await genreNames([out]);
  return toFlatCard(out, userId, { genreName: gname[String(out.genreId)] || g.name });
}

async function loadOr404(id) {
  // The public id is a uuidv7, and Mongo refuses an _id cast for a string that
  // is not a 24-char hex ObjectId. Only try the _id form when it could match.
  const or = [{ id: String(id) }];
  if (/^[a-f0-9]{24}$/i.test(String(id))) or.push({ _id: String(id) });
  const d = await Discussion.findOne({ $or: or });
  if (!d) err('not_found', 404);
  return d;
}

async function getThread({ id, viewerId }) {
  const or = [{ id: String(id) }];
  if (/^[a-f0-9]{24}$/i.test(String(id))) or.push({ _id: String(id) });
  const d = await Discussion.findOne({ $or: or }).lean();
  if (!d) err('not_found', 404);
  await withAuthors([d]);
  const gname = await genreNames([d]);
  const card = toFlatCard(d, viewerId, { genreName: gname[String(d.genreId)] || '' });
  // Attach viewer's reaction state if logged in
  if (viewerId) {
    const rx = await Reaction.findOne({ userId: String(viewerId), targetType: 'discussion', targetId: d.id }).lean();
    if (rx) card.userRx = rx.rid;
  }
  return card;
}

function canWrite(d, userId, isAdmin) {
  return isAdmin || String(d.authorId) === String(userId);
}

async function updateThread({ id, userId, isAdmin, title, body, tag, media, trope, story }) {
  const d = await loadOr404(id);
  if (!canWrite(d, userId, isAdmin)) err('forbidden', 403);
  if (title != null) d.title = String(title).slice(0, 200);
  if (body != null) d.body = String(body || '').slice(0, 8000);
  if (tag != null) d.tag = normTag(tag);
  if (media !== undefined) d.media = validateMediaUrl(media, 'media');
  if (trope !== undefined) d.trope = String(trope || '').slice(0, 60);
  if (story !== undefined) d.story = story || null;
  await d.save();
  const out = d.toJSON();
  await withAuthors([out]);
  const gname = await genreNames([out]);
  return toFlatCard(out, userId, { genreName: gname[String(out.genreId)] || '' });
}

async function deleteThread({ id, userId, isAdmin }) {
  const d = await loadOr404(id);
  if (!canWrite(d, userId, isAdmin)) err('forbidden', 403);
  await Comment.deleteMany({ scope: 'discussion', discussionId: d.id });
  await d.deleteOne();
  return { ok: true };
}

async function toggleLike({ id, user }) {
  const d = await loadOr404(id);
  // Liking happens inside a board, so it needs board membership too.
  await boards.assertBoardMember(user, { genreId: d.genreId });
  const i = (d.likedBy || []).map(String).indexOf(String(user.id));
  if (i === -1) { d.likedBy.push(user.id); d.likes += 1; }
  else { d.likedBy.splice(i, 1); d.likes = Math.max(0, d.likes - 1); }
  await d.save();
  return { liked: i === -1, likes: d.likes };
}

function reactionCounts(doc) {
  const m = doc.reactions instanceof Map ? Object.fromEntries(doc.reactions) : (doc.reactions || {});
  const out = {};
  Object.keys(m).forEach(k => { out[k] = m[k] || 0; });
  return out;
}

async function reactToDiscussion({ id, userId, rid }) {
  const d = await loadOr404(id);
  // Reactions happen inside a board, so needs board membership.
  await boards.assertBoardMember(userId, { genreId: d.genreId });
  const uid = String(userId);
  const prev = await Reaction.findOne({ userId: uid, targetType: 'discussion', targetId: d.id });
  if (prev && prev.rid === rid) return { counts: reactionCounts(d), userRx: rid };
  if (prev) {
    const pc = Math.max(0, (d.reactions.get(prev.rid) || 0) - 1);
    if (pc) d.reactions.set(prev.rid, pc); else d.reactions.delete(prev.rid);
    prev.rid = rid;
    await prev.save();
  } else {
    await Reaction.create({ userId: uid, targetType: 'discussion', targetId: d.id, rid });
  }
  d.reactions.set(rid, (d.reactions.get(rid) || 0) + 1);
  // Keep likes in sync as sum of reactions
  const total = Object.values(d.reactions.toObject()).reduce((a, v) => a + (v || 0), 0);
  d.likes = total;
  await d.save();
  return { counts: reactionCounts(d), userRx: rid };
}

async function unreactDiscussion({ id, userId }) {
  const d = await loadOr404(id);
  const prev = await Reaction.findOneAndDelete({ userId: String(userId), targetType: 'discussion', targetId: d.id });
  if (!prev) return { counts: reactionCounts(d), userRx: null };
  const pc = Math.max(0, (d.reactions.get(prev.rid) || 0) - 1);
  if (pc) d.reactions.set(prev.rid, pc); else d.reactions.delete(prev.rid);
  d.likes = Object.values(d.reactions.toObject()).reduce((a, v) => a + (v || 0), 0);
  await d.save();
  return { counts: reactionCounts(d), userRx: null };
}

async function reactionState({ id, userId }) {
  const d = await loadOr404(id);
  const prev = await Reaction.findOne({ userId: String(userId), targetType: 'discussion', targetId: d.id });
  return { counts: reactionCounts(d), userRx: prev ? prev.rid : null };
}

module.exports = { listThreads, feedThreads, createThread, getThread, updateThread, deleteThread, toggleLike, reactToDiscussion, unreactDiscussion, reactionState, resolveGenreIds, resolveThreadGenre, loadOr404, toCard, toFlatCard, withAuthors };
