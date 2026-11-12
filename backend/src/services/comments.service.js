'use strict';
const { Comment, Reaction, Status } = require('../models/social.model');
const { User } = require('../models/user.model');
const { userRefFilter } = require('./user-ref');
const counters = require('./user-counters');
const boards = require('./genres.service');

// Reader card reaction strip. Must match the keys reaction-picker.js uses
// (love/crying/angry/shocked/broken/emotional/savage/sus/twist/laughing).
const CARD_RX = ['love', 'crying', 'angry', 'shocked', 'broken', 'emotional', 'savage', 'sus', 'twist', 'laughing'];

function relTime(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(date).toISOString().slice(0, 10);
}

// Attach display author ({name, avatar}) to lean comment rows so clients
// never need a second lookup per comment.
async function withAuthors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(list.map(c => String(c.authorId || '')).filter(Boolean))];
  if (!ids.length) return list;
  const users = await User.find(userRefFilter(ids))
    .select('id username fullName avatar emailVerified').lean().catch(() => []);
  const byId = {};
  (users || []).forEach(u => {
    const key = String(u.id || u._id || '');
    if (key) byId[key] = { name: u.username || 'User', handle: u.username || '', avatar: u.avatar || '', verified: !!u.emailVerified };
  });
  list.forEach(c => { c.author = byId[String(c.authorId || '')] || { name: 'User', avatar: '' }; });
  return list;
}

// Rows in, FE card out. Adds viewer-scoped `liked` + `userRx`, joins live
// Status docs for the ring, and flattens `author` onto the top-level fields
// `comment-section.js` reads (name, avatar, verified, wid).
async function shapeForReader(rows, viewerId) {
  const list = Array.isArray(rows) ? rows : [];
  await withAuthors(list);
  const vids = Array.from(new Set(list.map(r => String(r.authorId || '')).filter(Boolean)));
  let statusMap = {};
  if (vids.length) {
    const live = await Status.find({ userId: { $in: vids }, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 }).limit(vids.length * 20).lean().catch(() => []);
    live.forEach(s => {
      const k = String(s.userId);
      (statusMap[k] = statusMap[k] || []).push({
        bg: s.bg || '', quote: s.quote || '', caption: s.caption || '', time: relTime(s.createdAt),
      });
    });
  }
  const rxIds = list.map(r => String(r.id || '')).filter(Boolean);
  let myRx = {};
  if (viewerId && rxIds.length) {
    const rows2 = await Reaction.find({ userId: String(viewerId), targetType: 'comment', targetId: { $in: rxIds } })
      .select('targetId rid').lean().catch(() => []);
    rows2.forEach(x => { myRx[String(x.targetId)] = x.rid; });
  }
  return list.map(r => {
    const rxObj = {};
    const src = r.reactions instanceof Map ? Object.fromEntries(r.reactions) : (r.reactions || {});
    CARD_RX.forEach(k => { rxObj[k] = src[k] || 0; });
    Object.keys(src).forEach(k => { if (!CARD_RX.includes(k)) rxObj[k] = src[k] || 0; });
    rxObj.userRx = myRx[String(r.id || '')] || null;
    const liked = !!(r.likedBy || []).map(String).includes(String(viewerId || ''));
    const statuses = statusMap[String(r.authorId || '')] || [];
    return {
      id: String(r.id || ''),
      name: r.author.name, handle: r.author.handle, avatar: r.author.avatar,
      verified: r.author.verified, wid: String(r.authorId || ''),
      time: relTime(r.createdAt), edited: !!r.edited,
      text: r.text, likes: r.likes || 0, liked,
      reactions: rxObj,
      team: r.team || null,
      statusRing: statuses.length ? 'has' : 'none',
      statuses,
      repliesCount: r.repliesCount || 0,
      scope: r.scope, storyId: r.storyId || null, chapterId: r.chapterId || null,
      postId: r.postId || null, discussionId: r.discussionId || null,
      parentId: r.parentId || null,
      // Viewer authority — the FE hides the delete/edit affordances when false.
      mine: viewerId ? String(r.authorId || '') === String(viewerId) : false,
    };
  });
}

function canWrite(comment, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(comment.authorId) === String(user.id);
}

async function createComment({ authorId, user, data }) {
  const { scope, storyId, chapterId, postId, discussionId, parentId, team, text } = data;
  const actor = user || { id: authorId, roles: [] };
  let parent = null;
  if (parentId) {
    parent = await Comment.findOne({ id: parentId }).lean();
    if (!parent) { const e = new Error('no_parent'); e.status = 404; throw e; }
  }
  if (scope === 'discussion') {
    const { Discussion } = require('../models/social.model');
    const disc = await Discussion.findOne({ id: String(discussionId || postId || '') }).select('id genreId').lean();
    if (!disc) { const e = new Error('no_discussion'); e.status = 404; throw e; }
    // Replying inside a board is a board action, so it needs board membership.
    await boards.assertBoardMember(actor, { genreId: disc.genreId });
    await Discussion.updateOne({ id: disc.id }, { $inc: { commentsCount: 1 } });
  } else if (parent && parent.scope === 'discussion' && parent.discussionId) {
    const { Discussion } = require('../models/social.model');
    const disc = await Discussion.findOne({ id: parent.discussionId }).select('id genreId').lean();
    if (disc) await boards.assertBoardMember(actor, { genreId: disc.genreId });
  }
  const comment = await Comment.create({
    authorId, scope, storyId, chapterId, postId, discussionId: scope === 'discussion' ? String(discussionId || postId || '') : null,
    parentId: parentId || null, team: team || null, text,
  });
  await counters.bump(authorId, 'commentCount', 1);
  if (parentId) await Comment.updateOne({ id: parentId }, { $inc: { repliesCount: 1 } });
  // Keep Post.commentsCount in sync for feed post comments
  if (scope === 'post' && postId) {
    const { Post } = require('../models/social.model');
    await Post.updateOne({ id: postId }, { $inc: { commentsCount: 1 } });
  }
  const [card] = await shapeForReader([comment.toObject()], authorId);
  return card;
}

async function listComments({ scope, storyId, chapterId, postId, discussionId, page, limit, viewerId }) {
  const filter = { parentId: null };
  if (scope) filter.scope = scope;
  if (storyId) filter.storyId = storyId;
  if (chapterId) filter.chapterId = chapterId;
  if (postId) filter.postId = postId;
  if (discussionId) filter.discussionId = discussionId;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [top, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Comment.countDocuments(filter),
  ]);
  // Reply pass: fetch two levels deep so replies-of-replies are included.
  const parentIds = top.map(c => String(c.id)).filter(Boolean);
  let byParent = {};
  if (parentIds.length) {
    const level1 = await Comment.find({ parentId: { $in: parentIds } }).sort({ createdAt: 1 }).lean();
    level1.forEach(k => { const p = String(k.parentId); (byParent[p] = byParent[p] || []).push(k); });
    // Second level — replies to replies
    const level1Ids = level1.map(c => String(c.id)).filter(Boolean);
    if (level1Ids.length) {
      const level2 = await Comment.find({ parentId: { $in: level1Ids } }).sort({ createdAt: 1 }).lean();
      level2.forEach(k => { const p = String(k.parentId); (byParent[p] = byParent[p] || []).push(k); });
    }
  }
  const allRows = top.concat(parentIds.reduce((acc, p) => acc.concat(byParent[p] || []), []));
  const shaped = await shapeForReader(allRows, viewerId);
  const byIdShaped = {};
  shaped.forEach(c => { byIdShaped[c.id] = c; });
  const items = top.map(t => {
    const card = byIdShaped[String(t.id)];
    card.replies = (byParent[String(t.id)] || []).map(k => byIdShaped[String(k.id)]).filter(Boolean);
    return card;
  });
  return { items, total, page: pg, limit: lim };
}

async function getReplies({ comment, viewerId }) {
  const rows = await Comment.find({ parentId: comment.id }).sort({ createdAt: 1 }).lean();
  return shapeForReader(rows, viewerId);
}

async function toggleLike({ comment, userId }) {
  const i = (comment.likedBy || []).map(String).indexOf(String(userId));
  if (i === -1) { comment.likedBy.push(userId); comment.likes += 1; }
  else { comment.likedBy.splice(i, 1); comment.likes = Math.max(0, comment.likes - 1); }
  await comment.save();
  return { liked: i === -1, likes: comment.likes };
}

async function deleteComment({ comment }) {
  // Count the replies from the rows themselves — repliesCount can drift, and the
  // same rows are what we need in order to drop their authors' counters.
  const replyRows = await Comment.find({ parentId: comment.id }).select('authorId').lean();
  await Comment.deleteMany({ parentId: comment.id });
  if (comment.parentId) await Comment.updateOne({ id: comment.parentId }, { $inc: { repliesCount: -1 } });
  if (comment.scope === 'discussion' && comment.discussionId) {
    const { Discussion } = require('../models/social.model');
    await Discussion.updateOne({ id: comment.discussionId }, { $inc: { commentsCount: -(1 + replyRows.length) } });
  }
  await comment.deleteOne();
  await Promise.all([
    counters.bump(comment.authorId, 'commentCount', -1),
    counters.bumpByAuthor(replyRows, 'commentCount', -1),
  ]);
  return { ok: true };
}

async function updateComment({ comment, text, viewerId }) {
  comment.text = text;
  comment.edited = true;
  await comment.save();
  const [card] = await shapeForReader([comment.toObject()], viewerId);
  return card;
}

function commentReactionCounts(comment) {
  const out = {};
  const m = comment.reactions instanceof Map ? Object.fromEntries(comment.reactions) : (comment.reactions || {});
  Object.keys(m).forEach(k => { out[k] = m[k] || 0; });
  return out;
}
async function reactToComment({ comment, userId, rid }) {
  const uid = String(userId);
  const prev = await Reaction.findOne({ userId: uid, targetType: 'comment', targetId: comment.id });
  if (prev && prev.rid === rid) return { counts: commentReactionCounts(comment), userRx: rid };
  if (prev) {
    const pc = Math.max(0, (comment.reactions.get(prev.rid) || 0) - 1);
    if (pc) comment.reactions.set(prev.rid, pc); else comment.reactions.delete(prev.rid);
    prev.rid = rid;
    await prev.save();
  } else {
    await Reaction.create({ userId: uid, targetType: 'comment', targetId: comment.id, rid });
  }
  comment.reactions.set(rid, (comment.reactions.get(rid) || 0) + 1);
  await comment.save();
  return { counts: commentReactionCounts(comment), userRx: rid };
}
async function unreactComment({ comment, userId }) {
  const prev = await Reaction.findOneAndDelete({ userId: String(userId), targetType: 'comment', targetId: comment.id });
  if (!prev) return { counts: commentReactionCounts(comment), userRx: null };
  const pc = Math.max(0, (comment.reactions.get(prev.rid) || 0) - 1);
  if (pc) comment.reactions.set(prev.rid, pc); else comment.reactions.delete(prev.rid);
  await comment.save();
  return { counts: commentReactionCounts(comment), userRx: null };
}

async function loadOr404(id) {
  const comment = await Comment.findOne({ id });
  if (!comment) { const e = new Error('not_found'); e.status = 404; throw e; }
  return comment;
}

module.exports = { createComment, listComments, getReplies, toggleLike, deleteComment, updateComment, reactToComment, unreactComment, loadOr404, canWrite, shapeForReader, CARD_RX, relTime };
