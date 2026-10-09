'use strict';
const { Post, Reaction } = require('../models/social.model');

const POST_TYPES = ['announcement', 'post', 'debate', 'shoutout', 'repost', 'poll', 'forum-poll', 'ama', 'review', 'recommendation', 'quote', 'chapter-drop'];

function canWrite(post, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(post.authorId) === String(user.id);
}

async function createPost({ authorId, data }) {
  const post = await Post.create(Object.assign({}, data, { authorId }));
  return post.toJSON();
}

async function listPosts({ tab, type, authorId, page, limit, viewerId }) {
  const filter = {};
  if (type) filter.type = type;
  if (authorId) filter.authorId = authorId;
  // FIX 6: hide blocked/muted authors from feeds.
  if (viewerId && !authorId) {
    try {
      const usersSvc = require('./users.service');
      const [mutes, blocks] = await Promise.all([
        usersSvc.mutedIds(viewerId).catch(() => new Set()),
        usersSvc.blockedIds(viewerId).catch(() => new Set()),
      ]);
      const excluded = new Set([...mutes, ...blocks]);
      if (excluded.size) filter.authorId = { $nin: [...excluded] };
    } catch (e) { /* filtering best-effort */ }
  }
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    Post.find(filter).sort({ pinned: -1, createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Post.countDocuments(filter),
  ]);
  return { items, total, page: pg, limit: lim };
}

async function getPost(id) {
  const post = await Post.findOne({ id }).lean();
  if (!post) { const e = new Error('not_found'); e.status = 404; throw e; }
  return post;
}

async function updatePost({ post, data }) {
  ['title', 'text', 'note', 'image', 'pinned'].forEach(k => {
    if (data[k] !== undefined) post[k] = data[k];
  });
  await post.save();
  return post.toJSON();
}

async function deletePost({ post }) {
  const { Comment } = require('../models/social.model');
  await Comment.deleteMany({ postId: post.id });
  await post.deleteOne();
  return { ok: true };
}

async function toggleLike({ post, userId }) {
  const i = (post.likedBy || []).map(String).indexOf(String(userId));
  if (i === -1) { post.likedBy.push(userId); post.likesCount += 1; }
  else { post.likedBy.splice(i, 1); post.likesCount = Math.max(0, post.likesCount - 1); }
  await post.save();
  return { liked: i === -1, likesCount: post.likesCount };
}

async function toggleSave({ post, userId }) {
  const i = (post.savedBy || []).map(String).indexOf(String(userId));
  if (i === -1) post.savedBy.push(userId);
  else post.savedBy.splice(i, 1);
  await post.save();
  return { saved: i === -1 };
}

async function votePoll({ post, idx, userId }) {
  if (!post.poll) { const e = new Error('no_poll'); e.status = 400; throw e; }
  post.poll.votedBy = post.poll.votedBy || [];
  if (post.poll.votedBy.map(String).includes(String(userId))) {
    const e = new Error('already_voted'); e.status = 409; throw e;
  }
  const opts = post.poll.opts || [];
  if (idx < 0 || idx >= opts.length) { const e = new Error('bad_option'); e.status = 400; throw e; }
  opts[idx].v = (opts[idx].v || 0) + 1;
  post.poll.total = (post.poll.total || 0) + 1;
  post.poll.votedBy.push(String(userId));
  await post.save();
  return post.toJSON();
}

async function voteDebate({ post, side }) {
  if (!post.debateData) { const e = new Error('no_debate'); e.status = 400; throw e; }
  if (side === 'for') post.debateData.forV += 1;
  else if (side === 'against') post.debateData.agV += 1;
  else { const e = new Error('bad_side'); e.status = 400; throw e; }
  await post.save();
  return post.toJSON();
}

async function loadOr404(id) {
  const post = await Post.findOne({ id });
  if (!post) { const e = new Error('not_found'); e.status = 404; throw e; }
  return post;
}

function reactionCounts(doc) {
  const out = {};
  const m = doc.reactions instanceof Map ? Object.fromEntries(doc.reactions) : (doc.reactions || {});
  Object.keys(m).forEach(k => { out[k] = m[k] || 0; });
  return out;
}

// One active rid per user per post; changing rid moves the count.
async function reactToPost({ post, userId, rid }) {
  const uid = String(userId);
  const prev = await Reaction.findOne({ userId: uid, targetType: 'post', targetId: post.id });
  if (prev && prev.rid === rid) return { counts: reactionCounts(post), userRx: rid };
  if (prev) {
    const pc = Math.max(0, (post.reactions.get(prev.rid) || 0) - 1);
    if (pc) post.reactions.set(prev.rid, pc); else post.reactions.delete(prev.rid);
    prev.rid = rid;
    await prev.save();
  } else {
    await Reaction.create({ userId: uid, targetType: 'post', targetId: post.id, rid });
  }
  post.reactions.set(rid, (post.reactions.get(rid) || 0) + 1);
  await post.save();
  return { counts: reactionCounts(post), userRx: rid };
}
async function unreactPost({ post, userId }) {
  const prev = await Reaction.findOneAndDelete({ userId: String(userId), targetType: 'post', targetId: post.id });
  if (!prev) return { counts: reactionCounts(post), userRx: null };
  const pc = Math.max(0, (post.reactions.get(prev.rid) || 0) - 1);
  if (pc) post.reactions.set(prev.rid, pc); else post.reactions.delete(prev.rid);
  await post.save();
  return { counts: reactionCounts(post), userRx: null };
}
async function reactionState({ post, userId }) {
  const prev = userId ? await Reaction.findOne({ userId: String(userId), targetType: 'post', targetId: post.id }).lean() : null;
  return { counts: reactionCounts(post), userRx: prev ? prev.rid : null };
}
async function sharePost({ post, channel, userId }) {
  post.sharesCount = (post.sharesCount || 0) + 1;
  const ch = post.sharesByChannel || (post.sharesByChannel = new Map());
  ch.set(channel, (ch.get(channel) || 0) + 1);
  await post.save();
  if (userId) {
    try {
      const { ShareEvent } = require('../models/social.model');
      await ShareEvent.updateOne(
        { userId: String(userId), targetType: 'post', targetId: String(post.id) },
        { $setOnInsert: { userId: String(userId), targetType: 'post', targetId: String(post.id), channel: String(channel || '') } },
        { upsert: true }
      );
    } catch (e) { /* analytics never break sharing */ }
  }
  const byChannel = {};
  ch.forEach((v, k) => { byChannel[k] = v; });
  return { sharesCount: post.sharesCount, byChannel };
}

module.exports = {
  POST_TYPES, createPost, listPosts, getPost, updatePost, deletePost,
  toggleLike, toggleSave, votePoll, voteDebate, loadOr404, canWrite,
  reactToPost, unreactPost, reactionState, sharePost,
};
