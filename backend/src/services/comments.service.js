'use strict';
const { Comment, Reaction } = require('../models/social.model');
const { User } = require('../models/user.model');

// Attach display author ({name, avatar}) to lean comment rows so clients
// never need a second lookup per comment.
async function withAuthors(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = [...new Set(list.map(c => String(c.authorId || '')).filter(Boolean))];
  if (!ids.length) return list;
  const users = await User.find({ $or: [{ id: { $in: ids } }, { _id: { $in: ids } }] })
    .select('id username fullName avatar emailVerified').lean().catch(() => []);
  const byId = {};
  (users || []).forEach(u => {
    const key = String(u.id || u._id || '');
    if (key) byId[key] = { name: u.username || 'User', handle: u.username || '', avatar: u.avatar || '', verified: !!u.emailVerified };
  });
  list.forEach(c => { c.author = byId[String(c.authorId || '')] || { name: 'User', avatar: '' }; });
  return list;
}

function canWrite(comment, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(comment.authorId) === String(user.id);
}

async function createComment({ authorId, data }) {
  const { scope, storyId, chapterId, postId, discussionId, parentId, team, text } = data;
  if (parentId) {
    const parent = await Comment.findOne({ id: parentId }).lean();
    if (!parent) { const e = new Error('no_parent'); e.status = 404; throw e; }
  }
  if (scope === 'discussion') {
    const { Discussion } = require('../models/social.model');
    const disc = await Discussion.findOne({ id: String(discussionId || postId || '') }).select('id').lean();
    if (!disc) { const e = new Error('no_discussion'); e.status = 404; throw e; }
    await Discussion.updateOne({ id: disc.id }, { $inc: { commentsCount: 1 } });
  }
  const comment = await Comment.create({
    authorId, scope, storyId, chapterId, postId, discussionId: scope === 'discussion' ? String(discussionId || postId || '') : null,
    parentId: parentId || null, team: team || null, text,
  });
  if (parentId) await Comment.updateOne({ id: parentId }, { $inc: { repliesCount: 1 } });
  const out = comment.toJSON();
  await withAuthors([out]);
  return out;
}

async function listComments({ scope, storyId, chapterId, postId, discussionId, page, limit }) {
  const filter = { parentId: null };
  if (scope) filter.scope = scope;
  if (storyId) filter.storyId = storyId;
  if (chapterId) filter.chapterId = chapterId;
  if (postId) filter.postId = postId;
  if (discussionId) filter.discussionId = discussionId;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Comment.countDocuments(filter),
  ]);
  await withAuthors(items);
  return { items, total, page: pg, limit: lim };
}

async function getReplies({ comment }) {
  const rows = await Comment.find({ parentId: comment.id }).sort({ createdAt: 1 }).lean();
  await withAuthors(rows);
  return rows;
}

async function toggleLike({ comment, userId }) {
  const i = (comment.likedBy || []).map(String).indexOf(String(userId));
  if (i === -1) { comment.likedBy.push(userId); comment.likes += 1; }
  else { comment.likedBy.splice(i, 1); comment.likes = Math.max(0, comment.likes - 1); }
  await comment.save();
  return { liked: i === -1, likes: comment.likes };
}

async function deleteComment({ comment }) {
  const replies = comment.repliesCount || 0;
  await Comment.deleteMany({ parentId: comment.id });
  if (comment.parentId) await Comment.updateOne({ id: comment.parentId }, { $inc: { repliesCount: -1 } });
  if (comment.scope === 'discussion' && comment.discussionId) {
    const { Discussion } = require('../models/social.model');
    await Discussion.updateOne({ id: comment.discussionId }, { $inc: { commentsCount: -(1 + replies) } });
  }
  await comment.deleteOne();
  return { ok: true };
}

async function updateComment({ comment, text }) {
  comment.text = text;
  comment.edited = true;
  await comment.save();
  const out = comment.toJSON();
  await withAuthors([out]);
  return out;
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

module.exports = { createComment, listComments, getReplies, toggleLike, deleteComment, updateComment, reactToComment, unreactComment, loadOr404, canWrite };
