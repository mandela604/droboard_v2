'use strict';
/* collections front-to-back: profile create/update/delete (name + privacy +
   stories), public discover, detail + story cards in page shape,
   follow/unfollow/share, privacy gating (public/private/followers).
   Keeps the original exports working (createCollection/listCollections/
   getCollection/updateCollection/deleteCollection/getStories/addStory/
   removeStory/loadOr404/canWrite). */
const { Collection, CollectionFollow, Follow, ReadingProgress, LibraryItem } = require('../models/social.model');
const { Book } = require('../models/content.model');
const { User } = require('../models/user.model');

function err(status, message) { return Object.assign(new Error(message), { status }); }
const HEX24 = /^[0-9a-fA-F]{24}$/;

/* STORY ACCESS RULE — which stories a user may put in a collection.
   mode 'any': any existing story (zero friction, discovery-first).
   mode 'read': only own books + stories where the user has read >= minChapters
     distinct chapters (ReadingProgress.chapterId). Flip one line to change. */
const STORY_ACCESS_RULE = { mode: 'any', minChapters: 15 };

function canWrite(col, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(col.ownerId) === String(user.id);
}

/* privacy: accept Public/Private/Followers in any case -> stored lowercase */
function normPrivacy(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === 'public' || s === 'private' || s === 'followers') return s;
  throw err(400, 'bad_privacy');
}
function displayPrivacy(p) {
  const s = String(p || 'public').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function escRx(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* dual-flavor lookups: uuid `id` first, ObjectId `_id` fallback.
   NOTE: select strings always keep the stored `id` (lean+select would drop it). */
function withIds(select) {
  if (!select) return undefined;
  const parts = String(select).split(/\s+/).filter(Boolean);
  if (!parts.includes('id')) parts.unshift('id');
  return parts.join(' ');
}
async function usersByIds(vals, select) {
  const uniq = [...new Set((vals || []).map(v => String(v)).filter(Boolean))];
  if (!uniq.length) return [];
  const hex = uniq.filter(v => HEX24.test(v));
  const or = [{ id: { $in: uniq } }];
  if (hex.length) or.push({ _id: { $in: hex } });
  let q = User.find({ $or: or });
  const s = withIds(select);
  if (s) q = q.select(s);
  return q.lean();
}
async function booksByIds(vals, select) {
  const uniq = [...new Set((vals || []).map(v => String(v)).filter(Boolean))];
  if (!uniq.length) return [];
  const hex = uniq.filter(v => HEX24.test(v));
  const or = [{ id: { $in: uniq } }];
  if (hex.length) or.push({ _id: { $in: hex } });
  let q = Book.find({ $or: or });
  const s = withIds(select);
  if (s) q = q.select(s);
  return q.lean();
}

async function userFlavors(userId) {
  const me = (await usersByIds([userId]))[0];
  if (!me) return [String(userId)];
  return [...new Set([String(me.id), String(me._id)])];
}
async function chaptersReadMap(userId, storyIds) {
  const flavors = await userFlavors(userId);
  const rows = await ReadingProgress.aggregate([
    { $match: { userId: { $in: flavors }, storyId: { $in: storyIds.map(String) }, chapterId: { $ne: null } } },
    { $group: { _id: '$storyId', chapters: { $addToSet: '$chapterId' } } },
  ]);
  const m = {};
  rows.forEach(r => { m[String(r._id)] = r.chapters.length; });
  return m;
}
/* existence + access rule in one gate (404 unknown, 403 unread in read mode) */
async function assertStoryEligible({ userId, storyId, isAdmin }) {
  const book = (await booksByIds([storyId], 'authorId status'))[0] || null;
  if (!book) throw err(404, 'story_not_found');
  if (isAdmin) return book;
  const flavors = await userFlavors(userId);
  if (flavors.includes(String(book.authorId))) return book; // own book, always
  if (STORY_ACCESS_RULE.mode !== 'read') return book;
  const cmap = await chaptersReadMap(userId, [String(storyId)]);
  const keys = [String(storyId), String(book.id), book._id ? String(book._id) : null].filter(Boolean);
  const n = Math.max(0, ...keys.map(k => cmap[k] || 0));
  if (n >= STORY_ACCESS_RULE.minChapters) return book;
  const e = err(403, 'insufficient_reading');
  e.required = STORY_ACCESS_RULE.minChapters;
  e.chaptersRead = n;
  throw e;
}

async function findByIdOrSlug(idOrSlug) {
  const key = String(idOrSlug || '');
  let col = await Collection.findOne({ id: key });
  if (!col && key && !HEX24.test(key)) {
    const cands = await Collection.find({}).select('id title').limit(500).lean();
    const hit = cands.find(c => slugify(c.title) === key.toLowerCase());
    if (hit) col = await Collection.findOne({ id: hit.id });
  }
  return col;
}

/* visibility: owner always; public to all; private owner-only;
   followers = viewer follows the owner */
async function canView(col, viewerId) {
  if (!col) return false;
  if (viewerId && String(col.ownerId) === String(viewerId)) return true;
  if (col.privacy === 'public') return true;
  if (col.privacy === 'private') return false;
  if (!viewerId) return false;
  const f = await Follow.findOne({ followerId: String(viewerId), followingId: String(col.ownerId) }).select('_id').lean();
  return !!f;
}
async function assertViewable(col, viewerId) {
  if (!col) throw err(404, 'not_found');
  if (viewerId && String(col.ownerId) === String(viewerId)) return col;
  if (col.privacy === 'public') return col;
  if (col.privacy === 'private') throw err(404, 'not_found');
  if (!viewerId) throw err(403, 'followers_only');
  const ok = await canView(col, viewerId);
  if (!ok) throw err(403, 'followers_only');
  return col;
}

function storyCard(b, authorName) {
  const st = String(b.status || 'ongoing');
  return {
    id: b.id, title: b.title, cover: b.cover || '',
    cat: b.genre || '', author: authorName || '',
    reads: b.reads || 0, likes: b.likes || 0,
    chapters: b.chapterCount || 0, status: st,
    badge: st.charAt(0).toUpperCase() + st.slice(1),
  };
}

async function authorNames(authorIds) {
  const users = await usersByIds([...new Set(authorIds.filter(Boolean))], 'fullName username');
  const m = {};
  users.forEach(u => {
    const n = u.fullName || u.username || '';
    m[String(u.id)] = n;
    if (u._id) m[String(u._id)] = n;
  });
  return aid => m[String(aid)] || '';
}

/* full detail card (page shape) incl. ordered storyList */
async function toCard(col, viewerId) {
  const c = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const [owners, books] = await Promise.all([
    usersByIds([c.ownerId], 'fullName username avatar emailVerified'),
    booksByIds(c.stories || [], 'title cover genre authorId reads likes chapterCount status rating'),
  ]);
  const owner = owners[0] || null;
  const bmap = {};
  books.forEach(b => { bmap[String(b.id)] = b; if (b._id) bmap[String(b._id)] = b; });
  const ordered = (c.stories || []).map(s => bmap[String(s)]).filter(Boolean);
  const nameOf = await authorNames(ordered.map(b => String(b.authorId)));
  const cards = ordered.map(b => storyCard(b, nameOf(String(b.authorId))));
  const covers = cards.slice(0, 4).map(s => s.cover).filter(Boolean);
  const avg = ordered.length
    ? ordered.reduce((t, b) => t + (Number(b.rating) || 0), 0) / ordered.length
    : 0;
  let following = false;
  const isOwner = !!viewerId && String(c.ownerId) === String(viewerId);
  if (viewerId && !isOwner) {
    following = !!(await CollectionFollow.findOne({ userId: String(viewerId), collectionId: String(c.id) }).select('_id').lean());
  }
  return {
    id: c.id, name: c.title, title: c.title, sub: c.sub || '',
    about: c.about || '', cover: c.cover || covers[0] || '', covers,
    icon: c.icon || '',
    author: owner ? (owner.fullName || owner.username || '') : '',
    authorAv: (owner && owner.avatar) || '', authorId: c.ownerId,
    verified: !!(owner && owner.emailVerified),
    stories: c.storiesCount != null ? c.storiesCount : cards.length,
    count: c.storiesCount != null ? c.storiesCount : cards.length,
    followers: c.followers || 0, visits: c.visits || 0,
    rating: avg ? +avg.toFixed(1) : '',
    genres: c.genres || [], privacy: displayPrivacy(c.privacy),
    sharesCount: c.sharesCount || 0,
    storyIds: (c.stories || []).map(String),
    storyList: cards,
    createdAt: c.createdAt,
    isOwner: viewerId ? isOwner : undefined,
    following: viewerId ? (isOwner ? false : following) : undefined,
  };
}

/* light batched cards for lists (discover / profile grids) */
async function listCards(rows, viewerId) {
  const owners = await usersByIds([...new Set(rows.map(c => String(c.ownerId)).filter(Boolean))], 'fullName username avatar emailVerified');
  const omap = {};
  owners.forEach(u => { omap[String(u.id)] = u; if (u._id) omap[String(u._id)] = u; });
  const want = [];
  rows.forEach(c => (c.stories || []).slice(0, 4).forEach(s => want.push(String(s))));
  const books = await booksByIds([...new Set(want)], 'title cover');
  const bmap = {};
  books.forEach(b => { bmap[String(b.id)] = b; if (b._id) bmap[String(b._id)] = b; });
  let follows = new Set();
  if (viewerId) {
    const fr = await CollectionFollow.find({ userId: String(viewerId), collectionId: { $in: rows.map(c => String(c.id)) } }).select('collectionId').lean();
    follows = new Set(fr.map(r => String(r.collectionId)));
  }
  return rows.map(c => {
    const o = omap[String(c.ownerId)] || null;
    const covers = (c.stories || []).slice(0, 4).map(s => bmap[String(s)]).filter(Boolean).map(b => b.cover).filter(Boolean);
    const isOwner = !!viewerId && String(c.ownerId) === String(viewerId);
    return {
      id: c.id, name: c.title, title: c.title, sub: c.sub || '',
      about: c.about || '', cover: c.cover || covers[0] || '', covers,
      icon: c.icon || '',
      author: o ? (o.fullName || o.username || '') : '',
      authorAv: (o && o.avatar) || '', authorId: c.ownerId,
      verified: !!(o && o.emailVerified),
      stories: c.storiesCount || 0, count: c.storiesCount || 0,
      followers: c.followers || 0, visits: c.visits || 0,
      genres: c.genres || [], privacy: displayPrivacy(c.privacy),
      sharesCount: c.sharesCount || 0,
      storyIds: (c.stories || []).map(String),
      createdAt: c.createdAt,
      isOwner: viewerId ? isOwner : undefined,
      following: viewerId ? (isOwner ? false : follows.has(String(c.id))) : undefined,
    };
  });
}

async function createCollection({ ownerId, data, isAdmin }) {
  const title = String((data && (data.title || data.name)) || '').trim().slice(0, 120);
  if (!title) throw err(400, 'name_required');
  const privacy = normPrivacy(data && data.privacy) || 'public';
  const rawStories = Array.isArray(data && data.stories)
    ? data.stories.map(s => (s && typeof s === 'object' ? s.id : s)).map(String).filter(Boolean)
    : [];
  const storyIds = [...new Set(rawStories)].slice(0, 200);
  for (const sid of storyIds) await assertStoryEligible({ userId: ownerId, storyId: sid, isAdmin });
  const col = await Collection.create({
    ownerId: String(ownerId), title,
    sub: String((data && data.sub) || '').slice(0, 200),
    about: String((data && data.about) || '').slice(0, 2000),
    cover: String((data && data.cover) || '').slice(0, 500),
    icon: String((data && data.icon) || '').slice(0, 40),
    privacy, genres: Array.isArray(data && data.genres) ? data.genres.map(String).slice(0, 10) : [],
    stories: storyIds, storiesCount: storyIds.length,
  });
  const cards = await listCards([col.toJSON()], ownerId);
  return cards[0];
}

/* list returns a plain ARRAY (frontend CollectionData/droboard/feed consume arrays) */
async function listCollections({ q, ownerId, owner, followed, privacy, genre, sort, page, limit, viewerId }) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 30));
  const filter = {};
  const who = owner !== undefined ? owner : ownerId;
  if (who === 'me') {
    if (!viewerId) throw err(401, 'unauthorized');
    filter.ownerId = String(viewerId);
  } else if (who) {
    const byId = await usersByIds([who]);
    let u = byId[0] || null;
    if (!u) u = await User.findOne({ username: String(who).replace(/^@/, '').toLowerCase() }).lean();
    if (!u) return [];
    filter.ownerId = { $in: [String(u.id), String(u._id)] };
  }
  if (followed !== undefined && String(followed) !== '0' && String(followed).toLowerCase() !== 'false') {
    if (!viewerId) throw err(401, 'unauthorized');
    const rows = await CollectionFollow.find({ userId: String(viewerId) }).select('collectionId').lean();
    const ids = rows.map(r => String(r.collectionId));
    if (!ids.length) return [];
    filter.id = { $in: ids };
  }
  if (genre) filter.genres = String(genre).slice(0, 30);
  if (privacy) {
    const p = normPrivacy(privacy);
    if (p) filter.privacy = p;
  }
  if (q) {
    const rx = { $regex: escRx(q).slice(0, 80), $options: 'i' };
    filter.$or = [{ title: rx }, { sub: rx }];
  }
  const sorts = { popular: { followers: -1 }, stories: { storiesCount: -1 }, oldest: { createdAt: 1 } };
  const rows = await Collection.find(filter).sort(sorts[sort] || { updatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
  const visible = [];
  for (const c of rows) {
    if (await canView(c, viewerId)) visible.push(c);
  }
  return listCards(visible, viewerId);
}

async function getCollection(id, viewerId) {
  const doc = await findByIdOrSlug(id);
  await assertViewable(doc, viewerId);
  const c0 = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
  await Collection.updateOne({ id: c0.id }, { $inc: { visits: 1 } }).catch(() => {});
  const card = await toCard(doc, viewerId);
  card.visits = (card.visits || 0) + 1;
  return card;
}

async function updateCollection({ col, data, userId, isAdmin }) {
  if (data.title !== undefined || data.name !== undefined) {
    const t = String(data.title !== undefined ? data.title : data.name).trim().slice(0, 120);
    if (!t) throw err(400, 'name_required');
    col.title = t;
  }
  ['sub', 'about', 'cover', 'icon'].forEach(k => {
    if (data[k] !== undefined) col[k] = String(data[k]).slice(0, k === 'about' ? 2000 : k === 'sub' ? 200 : k === 'cover' ? 500 : 40);
  });
  if (data.privacy !== undefined) col.privacy = normPrivacy(data.privacy) || col.privacy;
  if (data.genres !== undefined) col.genres = Array.isArray(data.genres) ? data.genres.map(String).slice(0, 10) : [];
  if (data.stories !== undefined) {
    const raw = Array.isArray(data.stories)
      ? data.stories.map(s => (s && typeof s === 'object' ? s.id : s)).map(String).filter(Boolean)
      : [];
    const storyIds = [...new Set(raw)].slice(0, 200);
    for (const sid of storyIds) await assertStoryEligible({ userId: userId || col.ownerId, storyId: sid, isAdmin });
    col.stories = storyIds;
    col.storiesCount = storyIds.length;
  }
  await col.save();
  const cards = await listCards([col.toJSON()], null);
  return cards[0];
}

async function deleteCollection({ col }) {
  const plain = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const cid = String(plain.id);
  await col.deleteOne();
  await CollectionFollow.deleteMany({ collectionId: String(cid) }).catch(() => {});
  return { ok: true };
}

async function getStories(collectionId, viewerId) {
  const col = await findByIdOrSlug(collectionId);
  await assertViewable(col, viewerId);
  const c = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const books = await booksByIds(c.stories || [], 'title cover genre authorId reads likes chapterCount status');
  const bmap = {};
  books.forEach(b => { bmap[String(b.id)] = b; if (b._id) bmap[String(b._id)] = b; });
  const ordered = (c.stories || []).map(s => bmap[String(s)]).filter(Boolean);
  const nameOf = await authorNames(ordered.map(b => String(b.authorId)));
  return ordered.map(b => storyCard(b, nameOf(String(b.authorId))));
}

async function addStory({ col, storyId, userId, isAdmin }) {
  await assertStoryEligible({ userId: userId || col.ownerId, storyId, isAdmin });
  if (!(col.stories || []).map(String).includes(String(storyId))) {
    col.stories = (col.stories || []).concat([String(storyId)]);
    col.storiesCount = col.stories.length;
    await col.save();
  }
  return col.toJSON();
}

async function removeStory({ col, storyId }) {
  col.stories = (col.stories || []).filter(s => String(s) !== String(storyId));
  col.storiesCount = col.stories.length;
  await col.save();
  return col.toJSON();
}

async function loadOr404(id) {
  const col = await findByIdOrSlug(id);
  if (!col) { const e = new Error('not_found'); e.status = 404; throw e; }
  return col;
}

async function followCollection({ userId, id }) {
  const col = await findByIdOrSlug(id);
  if (!col) throw err(404, 'not_found');
  if (String(col.ownerId) === String(userId)) throw err(400, 'own_collection');
  if (col.privacy === 'private') throw err(404, 'not_found');
  const plain = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const cid = String(plain.id);
  try {
    await CollectionFollow.create({ userId: String(userId), collectionId: String(cid) });
  } catch (e) { if (e.code !== 11000) throw e; }
  const n = await CollectionFollow.countDocuments({ collectionId: String(cid) });
  await Collection.updateOne({ id: cid }, { $set: { followers: n } }).catch(() => {});
  return { ok: true, following: true, followers: n };
}

async function unfollowCollection({ userId, id }) {
  const col = await findByIdOrSlug(id);
  if (!col) throw err(404, 'not_found');
  const plain = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const cid = String(plain.id);
  await CollectionFollow.deleteOne({ userId: String(userId), collectionId: String(cid) }).catch(() => {});
  const n = await CollectionFollow.countDocuments({ collectionId: String(cid) });
  await Collection.updateOne({ id: cid }, { $set: { followers: n } }).catch(() => {});
  return { ok: true, following: false, followers: n };
}

async function shareCollection({ userId, id, channel }) {
  const col = await findByIdOrSlug(id);
  await assertViewable(col, userId || null);
  const plain = typeof col.toJSON === 'function' ? col.toJSON() : col;
  const cid = String(plain.id);
  const ch = String(channel || 'copy').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'copy';
  const inc = { sharesCount: 1 };
  inc['sharesByChannel.' + ch] = 1;
  await Collection.updateOne({ id: cid }, { $inc: inc }).catch(() => {});
  const fresh = await Collection.findOne({ id: cid }).select('sharesCount').lean();
  return { ok: true, sharesCount: (fresh && fresh.sharesCount) || 0 };
}

/* picker source: own books + saved + read progress, annotated with the rule */
async function eligibleStories({ userId }) {
  const flavors = await userFlavors(userId);
  const [mine, saved, prog] = await Promise.all([
    Book.find({ authorId: { $in: flavors } }).select('id title cover genre authorId').limit(200).lean(),
    LibraryItem.find({ userId: { $in: flavors } }).select('storyId').limit(500).lean(),
    ReadingProgress.aggregate([
      { $match: { userId: { $in: flavors }, chapterId: { $ne: null } } },
      { $group: { _id: '$storyId', chapters: { $addToSet: '$chapterId' } } },
    ]),
  ]);
  const readMap = {};
  prog.forEach(r => { readMap[String(r._id)] = r.chapters.length; });
  const savedIds = [...new Set(saved.map(i => String(i.storyId)).filter(Boolean))].slice(0, 200);
  const books = await booksByIds(savedIds, 'id title cover genre authorId');
  const seen = new Map();
  mine.forEach(b => { if (b.id) seen.set(String(b.id), { b, mine: true }); });
  books.forEach(b => { if (b.id && !seen.has(String(b.id))) seen.set(String(b.id), { b, mine: false }); });
  const nameOf = await authorNames([...seen.values()].map(x => String(x.b.authorId)));
  const rule = { mode: STORY_ACCESS_RULE.mode, minChapters: STORY_ACCESS_RULE.minChapters };
  const items = [];
  for (const { b, mine: isMine } of seen.values()) {
    const keys = [String(b.id), b._id ? String(b._id) : null].filter(Boolean);
    const chapters = Math.max(0, ...keys.map(k => readMap[k] || 0));
    items.push({
      id: b.id, title: b.title, cover: b.cover || '', genre: b.genre || '',
      author: nameOf(String(b.authorId)), chaptersRead: chapters,
      mine: isMine, eligible: rule.mode !== 'read' || isMine || chapters >= rule.minChapters,
    });
  }
  items.sort((a, b2) => ((b2.eligible ? 1 : 0) - (a.eligible ? 1 : 0)) || (b2.chaptersRead - a.chaptersRead));
  return { rule, items: items.slice(0, 200) };
}

module.exports = {
  createCollection, listCollections, getCollection, updateCollection,
  deleteCollection, getStories, addStory, removeStory, loadOr404, canWrite,
  getDetail: getCollection, getStoryCards: getStories,
  followCollection, unfollowCollection, shareCollection, eligibleStories,
  STORY_ACCESS_RULE, assertStoryEligible,
  normPrivacy, displayPrivacy, slugify, toCard, listCards, findByIdOrSlug,
};
