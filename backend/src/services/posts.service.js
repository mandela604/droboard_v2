'use strict';
const { Post, Reaction } = require('../models/social.model');
const { User } = require('../models/user.model');
// users.service never requires back into posts, so this top-level import is safe.
const { relTime } = require('./users.service');
const counters = require('./user-counters');

const POST_TYPES = ['announcement', 'post', 'debate', 'shoutout', 'repost', 'poll', 'forum-poll', 'ama', 'review', 'recommendation', 'quote', 'chapter-drop'];

// Share channels: must match the 8 data-platform values in share-modal.js (line 422-450).
const SHARE_CHANNELS = ['whatsapp', 'twitter', 'instagram', 'telegram', 'facebook', 'threads', 'reddit', 'copy'];

function canWrite(post, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(post.authorId) === String(user.id);
}

// Composer payload → stored shape. Both dialects converge: poll opts strings
// or {label|t} objects → [{t,v}], q||question → q; debate headline (motion or
// question) → motion+question (post-card reads either); storyRef.author →
// writer; shoutout.id → userId. Client counters/votes are server-owned.
function normContent(data) {
  if (data.poll) {
    const p = data.poll;
    const opts = (Array.isArray(p.opts) ? p.opts : [])
      .map(o => (typeof o === 'string' ? { t: o, v: 0 } : { t: String((o && (o.t || o.label || o.text)) || ''), v: 0 }))
      .filter(o => o.t).slice(0, 4);
    data.poll = { q: String(p.q || p.question || ''), opts, total: 0 };
  }
  if (data.debateData) {
    const d = data.debateData;
    const head = String(d.motion || d.question || '').trim().slice(0, 500);
    data.debateData = {
      motion: head, question: head,
      prompt: String(d.prompt || '').slice(0, 300),
      forText: String(d.forText || '').slice(0, 60),
      againstText: String(d.againstText || '').slice(0, 60),
      forV: 0, agV: 0,
    };
  }
  if (data.storyRef && data.storyRef.author && !data.storyRef.writer) data.storyRef.writer = data.storyRef.author;
  if (data.shoutout) {
    const s = data.shoutout;
    data.shoutout = {
      userId: s.userId || s.id || null, id: s.id || s.userId || null,
      name: s.name || '', avatar: s.avatar || '', handle: s.handle || '',
      tagline: s.tagline || '', role: s.role || '', stats: s.stats || null,
      readingHours: s.readingHours, chaptersRead: s.chaptersRead, streak: s.streak,
      following: s.following === undefined ? undefined : !!s.following,
    };
  }
  // Repost card embeds the source post. `time` is a stored relative label, not
  // a server-derived one — the reshared post lives on another board/author and
  // the card reads the original author's name/avatar from this blob, not from
  // the resharing author.
  if (data.original) {
    const o = data.original;
    data.original = {
      name: o.name || '', avatar: o.avatar || '', time: o.time || '',
      text: o.text || '', cover: o.cover || '', title: o.title || '',
    };
  }
  return data;
}

// Frontend rule: a story must have at least 3 chapters of reading history
// before it can be recommended (public/services/reading-history.js).
const RECOMMEND_MIN_CHAPTERS = 3;

async function createPost({ authorId, data }) {
  if (data.type === 'recommendation' && data.storyRef && data.storyRef.id) {
    const { ReadingProgress } = require('./social.model');
    const read = await ReadingProgress.countDocuments({ userId: String(authorId), storyId: String(data.storyRef.id) });
    if (read < RECOMMEND_MIN_CHAPTERS) {
      const e = new Error('not_enough_reading'); e.status = 403; throw e;
    }
  }
  const payload = normContent(Object.assign({}, data));
  delete payload.id; // server assigns uuid — composers send demo p_<ts> ids
  const post = await Post.create(Object.assign({}, payload, { authorId }));
  await counters.bump(post.authorId, 'postCount', 1);
  return (await shape([post], authorId))[0];
}

// Card-ready authorship. A post row stores only authorId, and the feed renders
// the header from that row alone — with no name/avatar the card prints blank,
// and the shared status ring keys its seen-state off the handle, which only the
// server can supply. `verified` follows the app-wide rule: a verified email.
async function authorCards(ids) {
  const uniq = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id username fullName avatar emailVerified').lean();
  const m = {};
  rows.forEach(u => {
    m[String(u.id)] = {
      name: u.username || '', handle: '@' + (u.username || ''), fullName: u.fullName || '',
      avatar: u.avatar || '', verified: !!u.emailVerified,
    };
  });
  return m;
}

// The viewer's own reaction per post, one query for the whole page.
async function viewerRx(ids, viewerId) {
  if (!viewerId || !ids.length) return {};
  const rows = await Reaction.find({
    userId: String(viewerId), targetType: 'post', targetId: { $in: ids },
  }).lean();
  const m = {};
  rows.forEach(r => { m[String(r.targetId)] = r.rid; });
  return m;
}

// Stored doc → post-card shape. Voter lists (likedBy, savedBy, poll.votes,
// debateData.votes) are reader ids and never leave the server: the card only
// needs the viewer's own flag, which is what the counts already summarize.
function toCard(p, author, viewerId, userRx) {
  const v = viewerId ? String(viewerId) : '';
  const has = (arr) => !!v && (arr || []).map(String).includes(v);
  const c = Object.assign({}, p, author || { name: '', handle: '', fullName: '', avatar: '', verified: false }, {
    time: relTime(p.createdAt),
    likes: p.likesCount || 0,
    comments: p.commentsCount || 0,
    liked: has(p.likedBy),
    saved: has(p.savedBy),
    hidden: has(p.hiddenBy),
    mine: !!v && String(p.authorId) === v,
    reactions: reactionCounts(p),
    userRx: userRx || null,
  });
  delete c.likedBy; delete c.savedBy; delete c.hiddenBy;
  if (p.poll) {
    const mine = v && (p.poll.votes || []).find(x => String(x.user) === v);
    c.poll = Object.assign({}, p.poll, { voted: mine ? mine.opt : -1 });
    delete c.poll.votes;
  }
  if (p.debateData) {
    const mine = v && (p.debateData.votes || []).find(x => String(x.user) === v);
    c.debateData = Object.assign({}, p.debateData, { userVote: mine ? mine.side : null });
    delete c.debateData.votes;
  }
  return c;
}

// Docs (lean or hydrated) + one viewer → the shapes the card consumes.
async function shape(docs, viewerId) {
  const list = docs.map(d => (d && typeof d.toJSON === 'function' ? d.toJSON() : d));
  const [am, rx] = await Promise.all([
    authorCards(list.map(p => p.authorId)),
    viewerRx(list.map(p => String(p.id)), viewerId),
  ]);
  return list.map(p => toCard(p, am[String(p.authorId)], viewerId, rx[String(p.id)]));
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
  // "See less of this": posts this reader hid never come back in their feed.
  if (viewerId) {
    const hidden = await Post.find({ hiddenBy: String(viewerId) }).select('id').lean();
    if (hidden.length) filter.id = { $nin: hidden.map(h => h.id) };
  }
  const [docs, total] = await Promise.all([
    Post.find(filter).sort({ pinned: -1, createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Post.countDocuments(filter),
  ]);
  return { items: await shape(docs, viewerId), total, page: pg, limit: lim };
}

/* The library page's Saved tab: everything this reader saved that is NOT a
   story — chapter drops, reposts, polls, debates, quotes, AMAs, reviews. They
   are all Post docs with the saver in `savedBy`, so this is one query, and it
   goes through the same `shape()` the feed row uses: the card renders a saved
   chapter-drop exactly like the one it just came from. */
async function savedPosts({ userId, page, limit }) {
  const filter = { savedBy: String(userId) };
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [docs, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Post.countDocuments(filter),
  ]);
  return { items: await shape(docs, userId), total, page: pg, limit: lim };
}

async function getPost(id, viewerId) {
  const post = await Post.findOne({ id }).lean();
  if (!post) { const e = new Error('not_found'); e.status = 404; throw e; }
  const [card] = await shape([post], viewerId);
  return card;
}

async function updatePost({ post, data, viewerId }) {
  ['title', 'text', 'note', 'image', 'pinned', 'heading', 'quote', 'caption', 'quoteBg', 'quoteBgCss'].forEach(k => {
    if (data[k] !== undefined) post[k] = data[k];
  });
  // Engagement rewrites reset server-owned counts (votes were for the old content).
  if (data.poll !== undefined) {
    normContent(data);
    post.poll = data.poll;
    post.poll.votes = [];
  }
  if (data.debateData !== undefined) {
    normContent(data);
    post.debateData = data.debateData;
    post.debateData.votes = [];
  }
  await post.save();
  return (await shape([post], viewerId))[0];
}

async function deletePost({ post }) {
  const { Comment } = require('../models/social.model');
  // The post's comments go with it, so their authors lose those counts too.
  const gone = await Comment.find({ postId: post.id }).select('authorId').lean();
  await Comment.deleteMany({ postId: post.id });
  await post.deleteOne();
  await Promise.all([
    counters.bump(post.authorId, 'postCount', -1),
    counters.bumpByAuthor(gone, 'commentCount', -1),
  ]);
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

// "See less of this" — the reader's own hide list. The post row keeps the
// reader id, so hiding is reversible and scoped to that one reader.
async function toggleHide({ post, userId }) {
  const i = (post.hiddenBy || []).map(String).indexOf(String(userId));
  if (i === -1) post.hiddenBy.push(userId);
  else post.hiddenBy.splice(i, 1);
  await post.save();
  return { hidden: i === -1 };
}

// "Clear saved" on the library page: the reader drops every saved post at once.
async function clearSaved({ userId }) {
  const rows = await Post.find({ savedBy: String(userId) }).select('id savedBy').lean();
  await Promise.all(rows.map(r => Post.updateOne({ id: r.id }, { $pull: { savedBy: String(userId) } })));
  return { ok: true, cleared: rows.length };
}

async function votePoll({ post, idx, userId }) {
  if (!post.poll) { const e = new Error('no_poll'); e.status = 400; throw e; }
  post.poll.votes = post.poll.votes || [];
  if (post.poll.votes.some(x => String(x.user) === String(userId))) {
    const e = new Error('already_voted'); e.status = 409; throw e;
  }
  const opts = post.poll.opts || [];
  if (idx < 0 || idx >= opts.length) { const e = new Error('bad_option'); e.status = 400; throw e; }
  opts[idx].v = (opts[idx].v || 0) + 1;
  post.poll.total = (post.poll.total || 0) + 1;
  post.poll.votes.push({ user: String(userId), opt: idx });
  await post.save();
  return (await shape([post], userId))[0];
}

// Pulling a vote back restores exactly the option that reader chose.
async function retractPollVote({ post, userId }) {
  if (!post.poll) { const e = new Error('no_poll'); e.status = 400; throw e; }
  const i = (post.poll.votes || []).findIndex(x => String(x.user) === String(userId));
  if (i === -1) return (await shape([post], userId))[0];
  const idx = post.poll.votes[i].opt;
  if (post.poll.opts[idx]) post.poll.opts[idx].v = Math.max(0, (post.poll.opts[idx].v || 0) - 1);
  post.poll.total = Math.max(0, (post.poll.total || 0) - 1);
  post.poll.votes.splice(i, 1);
  await post.save();
  return (await shape([post], userId))[0];
}

async function voteDebate({ post, side, userId }) {
  if (!post.debateData) { const e = new Error('no_debate'); e.status = 400; throw e; }
  if (side !== 'for' && side !== 'against') { const e = new Error('bad_side'); e.status = 400; throw e; }
  post.debateData.votes = post.debateData.votes || [];
  if (post.debateData.votes.some(x => String(x.user) === String(userId))) {
    const e = new Error('already_voted'); e.status = 409; throw e;
  }
  if (side === 'for') post.debateData.forV += 1; else post.debateData.agV += 1;
  post.debateData.votes.push({ user: String(userId), side });
  await post.save();
  return (await shape([post], userId))[0];
}

async function retractDebateVote({ post, userId }) {
  if (!post.debateData) { const e = new Error('no_debate'); e.status = 400; throw e; }
  const i = (post.debateData.votes || []).findIndex(x => String(x.user) === String(userId));
  if (i === -1) return (await shape([post], userId))[0];
  const { side } = post.debateData.votes[i];
  if (side === 'for') post.debateData.forV = Math.max(0, post.debateData.forV - 1);
  else post.debateData.agV = Math.max(0, post.debateData.agV - 1);
  post.debateData.votes.splice(i, 1);
  await post.save();
  return (await shape([post], userId))[0];
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
  let isNew = false;
  if (prev && prev.rid === rid) return { counts: reactionCounts(post), userRx: rid };
  if (prev) {
    const pc = Math.max(0, (post.reactions.get(prev.rid) || 0) - 1);
    if (pc) post.reactions.set(prev.rid, pc); else post.reactions.delete(prev.rid);
    prev.rid = rid;
    await prev.save();
  } else {
    await Reaction.create({ userId: uid, targetType: 'post', targetId: post.id, rid });
    isNew = true;
  }
  post.reactions.set(rid, (post.reactions.get(rid) || 0) + 1);
  await post.save();
  if (isNew && String(post.authorId) !== uid) {
    try {
      const actor = await User.findOne({ id: uid }).select('username fullName avatar').lean();
      const { notify } = require('./notifications.service');
      await notify({
        recipientId: String(post.authorId), actorId: uid, type: 'like',
        title: (actor && (actor.fullName || actor.username)) || 'A user',
        desc: (actor && (actor.fullName || actor.username)) || 'A user',
        link: '/post/' + post.id,
        key: 'like:' + uid + ':' + post.id,
        avatar: actor && actor.avatar,
      });
    } catch (e) {}
  }
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
  if (!SHARE_CHANNELS.includes(channel)) { const e = new Error('bad_channel'); e.status = 400; throw e; }
  // One share per user per hour prevents burst spam.
  const { ShareEvent } = require('../models/social.model');
  const recent = await ShareEvent.findOne({ userId: String(userId), targetType: 'post', targetId: String(post.id), channel, createdAt: { $gte: new Date(Date.now() - 3600000) } });
  if (recent) { return { sharesCount: post.sharesCount || 0, byChannel: Object.fromEntries((post.sharesByChannel || new Map())) }; }
  post.sharesCount = (post.sharesCount || 0) + 1;
  const ch = post.sharesByChannel || (post.sharesByChannel = new Map());
  ch.set(channel, (ch.get(channel) || 0) + 1);
  await post.save();
  if (userId) {
    try {
      await ShareEvent.updateOne(
        { userId: String(userId), targetType: 'post', targetId: String(post.id), channel },
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
  POST_TYPES, createPost, listPosts, savedPosts, getPost, updatePost, deletePost,
  shape,
  toggleLike, toggleSave, toggleHide, clearSaved, votePoll, retractPollVote, voteDebate, retractDebateVote, loadOr404, canWrite,
  reactToPost, unreactPost, reactionState, sharePost,
};
