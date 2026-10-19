'use strict';
// Genre-hub discussion threads. Threads live under a Genre (genreId); a
// category hub lists threads across ALL child genres. Comments are handled
// by comments.service with scope='discussion' + discussionId — this service
// keeps Discussion.commentsCount in sync via the comments service hooks.
const { Discussion, Comment } = require('../models/social.model');
const { Genre, Category } = require('../models/content.model');
const { User } = require('../models/user.model');
const { validateMediaUrl } = require('./media.service');

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

// Single genre resolution for writes — threads attach to ONE genre, never a
// whole category. A category slug is rejected on create.
async function resolveOneGenre(slugOrId) {
  const g = await Genre.findOne({ $or: [{ slug: slugOrId }, { id: slugOrId }] }).lean();
  if (!g) err('genre_not_found', 404);
  return g;
}

async function withAuthors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(list.map(r => String(r.authorId || '')).filter(Boolean))];
  if (!ids.length) return list;
  const users = await User.find({ $or: [{ id: { $in: ids } }, { _id: { $in: ids } }] })
    .select('id username fullName avatar emailVerified').lean().catch(() => []);
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
  return {
    id: d.id, genreId: d.genreId,
    title: d.title, body: d.body || '', tag: d.tag, media: d.media || '',
    trope: d.trope || '', story: d.story || null,
    likes: d.likes || 0, liked: uid ? (d.likedBy || []).map(String).includes(uid) : false,
    hot: !!d.hot, commentsCount: d.commentsCount || 0, score: d.score || 0,
    createdAt: d.createdAt, author: d.author,
  };
}

function sortSpec(sort) {
  if (sort === 'top') return { likes: -1, createdAt: -1 };
  if (sort === 'hot') return { hot: -1, score: -1, createdAt: -1 };
  return { createdAt: -1 };
}

async function listThreads({ genre, tag, sort, page, limit, viewerId }) {
  const { genreIds } = await resolveGenreIds(genre);
  const filter = { genreId: { $in: genreIds } };
  if (tag) filter.tag = tag;
  const { page: pg, limit: lim } = paging({ page, limit });
  const [items, total] = await Promise.all([
    Discussion.find(filter).sort(sortSpec(sort)).skip((pg - 1) * lim).limit(lim).lean(),
    Discussion.countDocuments(filter),
  ]);
  await withAuthors(items);
  return { items: items.map(d => toCard(d, viewerId)), total, page: pg, limit: lim };
}

const TAGS = ['discussion', 'recommendation', 'theory', 'question', 'controversial'];
function normTag(tag) {
  const t = String(tag || 'discussion').toLowerCase().trim();
  if (!TAGS.includes(t)) err('bad_tag', 400);
  return t;
}

async function createThread({ userId, genre, title, body, tag, media, trope, story }) {
  const g = await resolveOneGenre(genre);
  const doc = await Discussion.create({
    genreId: g.id, authorId: userId,
    title: String(title).slice(0, 200), body: String(body || '').slice(0, 8000),
    tag: normTag(tag), media: validateMediaUrl(media, 'media'),
    trope: String(trope || '').slice(0, 60), story: story || null,
  });
  const out = doc.toJSON();
  await withAuthors([out]);
  return toCard(out, userId);
}

async function loadOr404(id) {
  const d = await Discussion.findOne({ id: String(id) });
  if (!d) err('not_found', 404);
  return d;
}

async function getThread({ id, viewerId }) {
  const d = await Discussion.findOne({ id: String(id) }).lean();
  if (!d) err('not_found', 404);
  await withAuthors([d]);
  return toCard(d, viewerId);
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
  return toCard(out, userId);
}

async function deleteThread({ id, userId, isAdmin }) {
  const d = await loadOr404(id);
  if (!canWrite(d, userId, isAdmin)) err('forbidden', 403);
  await Comment.deleteMany({ scope: 'discussion', discussionId: d.id });
  await d.deleteOne();
  return { ok: true };
}

async function toggleLike({ id, userId }) {
  const d = await loadOr404(id);
  const i = (d.likedBy || []).map(String).indexOf(String(userId));
  if (i === -1) { d.likedBy.push(userId); d.likes += 1; }
  else { d.likedBy.splice(i, 1); d.likes = Math.max(0, d.likes - 1); }
  await d.save();
  return { liked: i === -1, likes: d.likes };
}

module.exports = { listThreads, createThread, getThread, updateThread, deleteThread, toggleLike, resolveGenreIds, resolveOneGenre, loadOr404, toCard, withAuthors };
