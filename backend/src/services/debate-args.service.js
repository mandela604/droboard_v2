'use strict';
// Debate arguments (debate-args.js). One row per side-post under a debate
// Post. Replying inherits the parent's side; voting flips by re-vote and
// retracts by the same route with `vote:null`. Authorship must pick a side
// on Post.debateData before posting, so the argument never disagrees with
// the vote tally.
const { DebateArg, Post, Status } = require('../models/social.model');
const { User } = require('../models/user.model');
const { userRefFilter } = require('./user-ref');

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function relTime(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(date).toISOString().slice(0, 10);
}

async function authorsByIds(ids) {
  const uniq = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!uniq.length) return {};
  const rows = await User.find(userRefFilter(uniq))
    .select('id username fullName avatar emailVerified').lean().catch(() => []);
  const map = {};
  rows.forEach(u => {
    map[String(u.id || u._id)] = {
      name: u.username || 'User', handle: u.username || '', avatar: u.avatar || '',
      verified: !!u.emailVerified,
    };
  });
  return map;
}

async function shapeCards(rows, viewerId) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];
  const authorMap = await authorsByIds(list.map(r => r.authorId));
  const liveIds = Object.keys(authorMap);
  let statusMap = {};
  if (liveIds.length) {
    const live = await Status.find({ userId: { $in: liveIds }, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 }).limit(liveIds.length * 20).lean().catch(() => []);
    live.forEach(s => {
      const k = String(s.userId);
      (statusMap[k] = statusMap[k] || []).push({
        bg: s.bg || '', quote: s.quote || '', caption: s.caption || '', time: relTime(s.createdAt),
      });
    });
  }
  return list.map(r => {
    const a = authorMap[String(r.authorId)] || { name: 'User', handle: '', avatar: '', verified: false };
    const statuses = statusMap[String(r.authorId)] || [];
    const votedByMap = r.votedBy instanceof Map ? Object.fromEntries(r.votedBy) : (r.votedBy || {});
    const mv = viewerId ? votedByMap[String(viewerId)] : null;
    return {
      id: String(r.id || ''),
      name: a.name, handle: a.handle, avatar: a.avatar, verified: a.verified,
      wid: String(r.authorId || ''),
      side: r.side,
      text: r.text,
      time: relTime(r.createdAt),
      edited: !!r.edited,
      up: r.up || 0,
      down: r.down || 0,
      myVote: mv === 'up' ? 1 : mv === 'down' ? -1 : null,
      statusRing: statuses.length ? 'has' : 'none',
      statuses,
      repliesCount: r.repliesCount || 0,
      parentId: r.parentId || null,
      postId: String(r.postId || ''),
      mine: viewerId ? String(r.authorId || '') === String(viewerId) : false,
    };
  });
}

async function loadPostOr404(postId) {
  const post = await Post.findOne({ id: String(postId) }).lean();
  if (!post) err('no_post', 404);
  if (post.type !== 'debate' || !post.debateData) err('not_a_debate', 400);
  return post;
}

async function assertVotedSide(post, userId) {
  const votes = (post && post.debateData && post.debateData.votes) || [];
  if (!Array.isArray(votes)) err('pick_side_first', 403);
  const voted = votes.find(v => String(v.user) === String(userId));
  if (!voted) err('pick_side_first', 403);
  return voted.side;
}

async function listArgs({ postId, side, sort, viewerId }) {
  await loadPostOr404(postId);
  const filter = { postId: String(postId), parentId: null };
  if (side === 'for' || side === 'against') filter.side = side;
  const order = sort === 'new' ? { createdAt: -1 } : { up: -1, createdAt: -1 };
  const tops = await DebateArg.find(filter).sort(order).limit(200).lean();
  const topIds = tops.map(t => String(t.id));
  let byParent = {};
  if (topIds.length) {
    const kids = await DebateArg.find({ parentId: { $in: topIds } }).sort({ createdAt: 1 }).lean();
    kids.forEach(k => { const p = String(k.parentId); (byParent[p] = byParent[p] || []).push(k); });
  }
  const allRows = tops.concat(topIds.reduce((acc, p) => acc.concat(byParent[p] || []), []));
  const shaped = await shapeCards(allRows, viewerId);
  const byId = {};
  shaped.forEach(c => { byId[c.id] = c; });
  const items = tops.map(t => {
    const card = byId[String(t.id)];
    card.replies = (byParent[String(t.id)] || []).map(k => byId[String(k.id)]).filter(Boolean);
    return card;
  });
  return { items, total: items.length };
}

async function createArg({ postId, userId, text, side, parentId }) {
  const post = await loadPostOr404(postId);
  const votedSide = await assertVotedSide(post, userId);
  let parent = null;
  if (parentId) {
    parent = await DebateArg.findOne({ id: String(parentId), postId: String(postId) }).lean();
    if (!parent) err('no_parent', 404);
    // Replies inherit the parent's side; the composer never lets you disagree.
    side = parent.side;
  }
  if (side !== 'for' && side !== 'against') err('bad_side', 400);
  if (side !== votedSide) err('side_mismatch', 403);
  const body = String(text || '').trim();
  if (!body) err('text_required', 400);
  if (body.length > 2000) err('text_too_long', 400);
  const arg = await DebateArg.create({
    postId: String(postId), authorId: String(userId),
    parentId: parent ? String(parent.id) : null,
    side, text: body,
  });
  if (parent) await DebateArg.updateOne({ id: parent.id }, { $inc: { repliesCount: 1 } });
  const [card] = await shapeCards([arg.toObject()], userId);
  return card;
}

async function voteArg({ id, userId, vote }) {
  const arg = await DebateArg.findOne({ id: String(id) });
  if (!arg) err('not_found', 404);
  const key = String(userId);
  const cur = arg.votedBy.get(key) || null;
  if (vote === null || vote === 0 || vote === 'clear') {
    if (cur) {
      if (cur === 'up') arg.up = Math.max(0, arg.up - 1); else arg.down = Math.max(0, arg.down - 1);
      arg.votedBy.delete(key);
      await arg.save();
    }
  } else {
    const target = (vote === 1 || vote === 'up' || vote === true) ? 'up'
      : (vote === -1 || vote === 'down') ? 'down' : null;
    if (!target) err('bad_vote', 400);
    if (cur === target) { /* no-op */ }
    else {
      if (cur === 'up') arg.up = Math.max(0, arg.up - 1);
      else if (cur === 'down') arg.down = Math.max(0, arg.down - 1);
      if (target === 'up') arg.up += 1; else arg.down += 1;
      arg.votedBy.set(key, target);
      await arg.save();
    }
  }
  const [card] = await shapeCards([arg.toObject()], userId);
  return card;
}

async function editArg({ id, userId, text, side }) {
  const arg = await DebateArg.findOne({ id: String(id) });
  if (!arg) err('not_found', 404);
  if (String(arg.authorId) !== String(userId)) err('forbidden', 403);
  const body = String(text || '').trim();
  if (!body) err('text_required', 400);
  if (body.length > 2000) err('text_too_long', 400);
  arg.text = body;
  if (side && !arg.parentId) {
    // Top-level args may change side; replies always inherit.
    if (side !== 'for' && side !== 'against') err('bad_side', 400);
    const post = await loadPostOr404(arg.postId);
    const votedSide = await assertVotedSide(post, userId);
    if (side !== votedSide) err('side_mismatch', 403);
    arg.side = side;
  }
  arg.edited = true;
  await arg.save();
  const [card] = await shapeCards([arg.toObject()], userId);
  return card;
}

async function deleteArg({ id, user }) {
  const arg = await DebateArg.findOne({ id: String(id) });
  if (!arg) err('not_found', 404);
  const isAdmin = (user.roles || []).includes('admin');
  if (!isAdmin && String(arg.authorId) !== String(user.id)) err('forbidden', 403);
  const kids = await DebateArg.find({ parentId: arg.id }).select('authorId').lean();
  await DebateArg.deleteMany({ parentId: arg.id });
  if (arg.parentId) await DebateArg.updateOne({ id: arg.parentId }, { $inc: { repliesCount: -1 } });
  await arg.deleteOne();
  return { ok: true, removed: 1 + kids.length };
}

async function loadOr404(id) {
  const arg = await DebateArg.findOne({ id });
  if (!arg) err('not_found', 404);
  return arg;
}

module.exports = { listArgs, createArg, voteArg, editArg, deleteArg, loadOr404, shapeCards };
