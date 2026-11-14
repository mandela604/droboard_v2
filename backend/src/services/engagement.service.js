'use strict';
const { Chapter, Book, EngagementVote } = require('../models/content.model');
const { ReadingProgress } = require('../models/social.model');

async function loadChapter(bookId, key) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: key };
  const ch = await Chapter.findOne(q);
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  return ch;
}

function pickTarget(ch, kind) {
  if (kind === 'poll') return ch.poll;
  if (kind === 'prediction') return ch.prediction;
  return null;
}

async function vote({ chapter, userId, kind, option }) {
  if (kind === 'debate') {
    if (option !== 'for' && option !== 'against') { const e = new Error('bad_side'); e.status = 400; throw e; }
    try {
      await EngagementVote.create({ chapterId: chapter.id, userId, kind, optionIdx: option === 'for' ? 0 : 1 });
    } catch (e) {
      if (e.code === 11000) { const err = new Error('already_voted'); err.status = 409; throw err; }
      throw e;
    }
    chapter.debate = chapter.debate || {};
    if (option === 'for') chapter.debate.forV = (chapter.debate.forV || 0) + 1;
    else chapter.debate.agV = (chapter.debate.agV || 0) + 1;
    await chapter.save();
    return { kind, side: option, forV: chapter.debate.forV, agV: chapter.debate.agV };
  }
  const target = pickTarget(chapter, kind);
  if (!target || !target.q) { const e = new Error('no_' + kind); e.status = 400; throw e; }
  const idx = parseInt(option, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= (target.opts || []).length) {
    const e = new Error('bad_option'); e.status = 400; throw e;
  }
  try {
    await EngagementVote.create({ chapterId: chapter.id, userId, kind, optionIdx: idx });
  } catch (e) {
    if (e.code === 11000) { const err = new Error('already_voted'); err.status = 409; throw err; }
    throw e;
  }
  await Chapter.updateOne(
    { id: chapter.id },
    { $inc: { [(kind === 'poll' ? 'poll' : 'prediction') + '.opts.' + idx + '.v']: 1 } }
  );
  const fresh = await Chapter.findOne({ id: chapter.id }).select(kind === 'poll' ? 'poll' : 'prediction').lean();
  return Object.assign({ kind }, fresh[kind]);
}

async function retract({ chapter, userId, kind }) {
  const vote = await EngagementVote.findOneAndDelete({ chapterId: chapter.id, userId, kind });
  if (!vote) { const e = new Error('no_vote'); e.status = 404; throw e; }
  if (kind === 'debate') {
    if (vote.optionIdx === 0) chapter.debate.forV = Math.max(0, (chapter.debate.forV || 0) - 1);
    else chapter.debate.agV = Math.max(0, (chapter.debate.agV || 0) - 1);
    await chapter.save();
  } else {
    const path = (kind === 'poll' ? 'poll' : 'prediction') + '.opts.' + vote.optionIdx + '.v';
    await Chapter.updateOne({ id: chapter.id }, { $inc: { [path]: -1 } });
  }
  return { ok: true, kind };
}

async function results({ chapter, userId }) {
  const mine = await EngagementVote.find({ chapterId: chapter.id, userId }).lean();
  const myVotes = {};
  mine.forEach(v => { myVotes[v.kind] = v.optionIdx; });
  // Must be plain: base.wrap's normalize() walks every key, and a live
  // subdocument's $parent/$__ point back at the parent doc forever.
  const c = chapter.toObject({ virtuals: false });
  return {
    poll: c.poll || null,
    prediction: c.prediction || null,
    debate: c.debate || null,
    authorNote: c.authorNote || '',
    myVotes,
  };
}

// Reader boot state: coin-unlocked chapters + per-chapter progress + continue point.
async function readState({ userId, bookId }) {
  const sid = String(bookId);
  const uid = String(userId);
  const { Book } = require('../models/content.model');
  const { Entitlement } = require('../models/money.model');
  const [book, progress, unlocks] = await Promise.all([
    Book.findOne({ id: sid }).select('id vipLocked').lean().catch(() => null),
    ReadingProgress.find({ userId: uid, storyId: sid }).select('chapterId pct finished secondsSpent lastReadAt').lean().catch(() => []),
    // Ownership rows, not a guess from the accounting journal.
    Entitlement.find({ userId: uid, bookId: sid }).select('chapterId').lean().catch(() => []),
  ]);
  const unlocked = unlocks.map(u => String(u.chapterId));
  const pmap = {};
  let lastId = null, lastAt = 0;
  progress.forEach(p => {
    const cid = String(p.chapterId || '');
    if (!cid) return;
    pmap[cid] = { pct: p.pct || 0, finished: !!p.finished, secondsSpent: p.secondsSpent || 0 };
    const t = p.lastReadAt ? new Date(p.lastReadAt).getTime() : 0;
    if (t > lastAt) { lastAt = t; lastId = cid; }
  });
  return { bookId: sid, vipLocked: !!(book && book.vipLocked), unlocked, progress: pmap, lastChapterId: lastId };
}

// Record reading time. Upserts per (user, story, chapter), clamps deltas to
// stop clock abuse. The FIRST time this reader opens a chapter credits it as a
// read (Chapter.views +1, Book.reads +1, today's BookDailyStat.reads +1) —
// opens and finishes used to credit separately, which meant a reader who
// viewed a chapter but never scrolled to the end left Reads at zero. The
// readCredited flag guarantees exactly one read per reader per chapter.
async function trackProgress({ bookId, chapterId, storyId, userId, secondsSpent, pct, finished, wordsRead }) {
  const secs = Math.min(3600, Math.max(0, parseInt(secondsSpent, 10) || 0));
  const sid = String(storyId || bookId);
  const cid = String(chapterId || '');
  const prev = await ReadingProgress.findOne({ userId: String(userId), storyId: sid, chapterId: cid }).select('finished readCredited').lean();
  const creditRead = !!cid && (!prev || !prev.readCredited);
  const update = {
    $inc: { secondsSpent: secs, wordsRead: Math.max(0, parseInt(wordsRead, 10) || 0) },
    $set: { lastReadAt: new Date() },
  };
  if (creditRead) update.$set.readCredited = true;
  if (pct !== undefined) update.$set.pct = Math.min(100, Math.max(0, Number(pct) || 0));
  if (finished !== undefined) update.$set.finished = !!finished;
  const doc = await ReadingProgress.findOneAndUpdate(
    { userId: String(userId), storyId: sid, chapterId: cid },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  // First open of this chapter by this user = one read.
  if (creditRead) {
    try {
      const { Book, Chapter, BookDailyStat } = require('../models/content.model');
      const day = new Date().toISOString().slice(0, 10);
      await Promise.all([
        Chapter.updateOne({ id: cid }, { $inc: { views: 1 } }).catch(() => {}),
        Book.updateOne({ id: sid }, { $inc: { reads: 1 } }).catch(() => {}),
        BookDailyStat.updateOne(
          { bookId: sid, day },
          { $inc: { reads: 1 } },
          { upsert: true }
        ).catch(() => {}),
      ]);
    } catch (e) { /* reads never break tracking */ }
  }
  // Finish counts are separate from read credit so finishes cannot inflate.
  if (finished && (!prev || !prev.finished)) {
    try {
      const { BookDailyStat } = require('../models/content.model');
      const day = new Date().toISOString().slice(0, 10);
      await BookDailyStat.updateOne(
        { bookId: sid, day },
        { $inc: { finishes: 1 } },
        { upsert: true }
      ).catch(() => {});
    } catch (e) { /* reads never break tracking */ }
  }
  // Finishing the book's last chapter marks it finished in read history
  // (powers Finishers segment + finished shelves).
  if (finished && cid) {
    try {
      const { LibraryItem } = require('../models/social.model');
      const { Chapter } = require('../models/content.model');
      let n = /^\d+$/.test(cid) ? parseInt(cid, 10) : null;
      if (n === null) {
        const chx = await Chapter.findOne({ id: cid }).select('n bookId').lean().catch(() => null);
        if (chx && String(chx.bookId) === sid) n = chx.n;
      }
      if (n !== null && Number.isInteger(n)) {
        const last = await Chapter.findOne({ bookId: sid }).sort({ n: -1 }).select('n').lean().catch(() => null);
        if (last && n >= last.n) {
          await LibraryItem.findOneAndUpdate(
            { userId: String(userId), storyId: sid, list: 'history' },
            { $set: { status: 'finished' } },
            { upsert: true, new: true }
          ).catch(() => {});
        }
      }
    } catch (e) { /* reads never break tracking */ }
  }
  let referral = null;
  try {
    const referrals = require('./referrals.service');
    referral = await referrals.checkReadReward(String(userId));
  } catch (e) { /* rewards never break reading */ }
  const totalAgg = await ReadingProgress.aggregate([
    { $match: { userId: String(userId) } },
    { $group: { _id: null, secs: { $sum: '$secondsSpent' } } },
  ]);
  return { progress: doc, totalSecs: (totalAgg[0] && totalAgg[0].secs) || 0, referral };
}

/* ══ STORY-WIDE ENGAGEMENT (book-level poll/prediction/debate) ══
   Same shapes as chapter-wise but keyed by bookId with chapterId '' plus the
   engagement row's itemId, so a book can run several polls and retract still
   finds the right one. Vote mutates the Book's embedded arrays in place. */

const ENGAGEMENT_LISTS = { poll: 'polls', prediction: 'predictions', debate: 'debates' };

function plain(o) { return o && typeof o.toJSON === 'function' ? o.toJSON() : o; }

// One mapper for every story-wide read (GET /engagement, the story detail
// read, and the post-vote response) so the reader always gets the fields it
// needs to vote again: id + kind (the vote body), totals, closed, myVote.
function shapeStoryEngagement(book, myVotes) {
  const votes = myVotes || {};
  const out = { polls: [], predictions: [], debates: [] };
  Object.keys(ENGAGEMENT_LISTS).forEach(kind => {
    const key = ENGAGEMENT_LISTS[kind];
    out[key] = (book[key] || []).map(raw => {
      const item = plain(raw) || {};
      const mine = votes[kind + ':' + item.id];
      const shaped = {
        id: item.id, kind,
        chapter: item.chapter == null ? null : item.chapter,
        expiresAt: item.expiresAt || null,
        closed: !!(item.expiresAt && new Date(item.expiresAt) < new Date()),
        myVote: mine === undefined ? null : mine,
      };
      if (kind === 'debate') {
        shaped.motion = item.motion || '';
        shaped.forText = item.forText || 'For';
        shaped.againstText = item.againstText || 'Against';
        shaped.forV = item.forV || 0;
        shaped.agV = item.agV || 0;
        shaped.totalVotes = shaped.forV + shaped.agV;
      } else {
        shaped.q = item.q || '';
        shaped.opts = (item.opts || []).map((o, i) => ({
          t: o.t, v: o.v || 0,
          pct: optsTotal(item) ? Math.round(((o.v || 0) / optsTotal(item)) * 100) : 0,
          picked: mine === i,
        }));
        shaped.totalVotes = optsTotal(item);
      }
      return shaped;
    });
  });
  return out;
}
function optsTotal(item) {
  return (item.opts || []).reduce((a, o) => a + (o.v || 0), 0);
}

// Votes are stored as optionIdx (debate: 0=for, 1=against); readers want the
// same spelling the vote body takes, so map debate back to its side word.
function myVoteMap(rows) {
  const out = {};
  rows.forEach(v => {
    out[v.kind + ':' + v.itemId] = v.kind === 'debate' ? (v.optionIdx === 0 ? 'for' : 'against') : v.optionIdx;
  });
  return out;
}

async function storyVotes(bookId, userId) {
  if (!userId) return {};
  const rows = await EngagementVote.find({ bookId, userId, chapterId: '' }).lean();
  return myVoteMap(rows);
}

// Reads resolve id OR slug exactly like the detail route, so a story reached
// by slug can still be voted on.
async function storyBook(id) {
  const book = await Book.findOne({ $or: [{ id }, { slug: id }] });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

async function bookEngagement({ bookId, userId }) {
  const book = await storyBook(bookId);
  const votes = await storyVotes(book.id, userId);
  return { bookId: book.id, engagement: shapeStoryEngagement(book, votes) };
}

async function bookVote({ bookId, userId, kind, id, option }) {
  const book = await storyBook(bookId);
  const list = kind ? book[ENGAGEMENT_LISTS[kind]] : null;
  if (!list) { const e = new Error('bad_kind'); e.status = 400; throw e; }
  const item = list.find(p => String(p.id) === String(id));
  if (!item) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (item.expiresAt && new Date(item.expiresAt) < new Date()) { const e = new Error('closed'); e.status = 409; throw e; }

  let optionIdx;
  if (kind === 'debate') {
    if (option !== 'for' && option !== 'against') { const e = new Error('bad_side'); e.status = 400; throw e; }
    optionIdx = option === 'for' ? 0 : 1;
  } else {
    optionIdx = parseInt(option, 10);
    if (!Number.isInteger(optionIdx) || optionIdx < 0 || optionIdx >= (item.opts || []).length) {
      const e = new Error('bad_option'); e.status = 400; throw e;
    }
  }
  // The unique index is the real guarantee, but an insert into a collection
  // whose indexes are still building succeeds — so the row is checked first
  // and a second vote for the same item always answers already_voted.
  const already = await EngagementVote
    .findOne({ chapterId: '', bookId: book.id, userId, kind, itemId: String(item.id) }).lean();
  if (already) { const err = new Error('already_voted'); err.status = 409; throw err; }
  try {
    await EngagementVote.create({ chapterId: '', bookId: book.id, itemId: String(item.id), userId, kind, optionIdx });
  } catch (e) {
    if (e.code === 11000) { const err = new Error('already_voted'); err.status = 409; throw err; }
    throw e;
  }
  if (kind === 'debate') {
    if (optionIdx === 0) item.forV = (item.forV || 0) + 1;
    else item.agV = (item.agV || 0) + 1;
  } else {
    item.opts[optionIdx].v = (item.opts[optionIdx].v || 0) + 1;
  }
  await book.save();
  const votes = await storyVotes(book.id, userId);
  return { kind, item: shapeStoryEngagement(book, votes)[ENGAGEMENT_LISTS[kind]].find(p => p.id === item.id) };
}

async function bookRetract({ bookId, userId, kind, itemId }) {
  const book = await storyBook(bookId);
  const filter = { bookId: book.id, userId, kind, chapterId: '' };
  // Without an itemId the caller means "whatever I voted for this kind" —
  // with one, only that row's vote is removed.
  if (itemId) filter.itemId = String(itemId);
  const vote = await EngagementVote.findOneAndDelete(filter);
  if (!vote) { const e = new Error('no_vote'); e.status = 404; throw e; }
  const item = (book[ENGAGEMENT_LISTS[kind]] || []).find(p => String(p.id) === String(vote.itemId));
  if (item) {
    if (kind === 'debate') {
      if (vote.optionIdx === 0) item.forV = Math.max(0, (item.forV || 0) - 1);
      else item.agV = Math.max(0, (item.agV || 0) - 1);
    } else if (item.opts && item.opts[vote.optionIdx] != null) {
      item.opts[vote.optionIdx].v = Math.max(0, (item.opts[vote.optionIdx].v || 0) - 1);
    }
    await book.save();
  }
  const votes = await storyVotes(book.id, userId);
  return { ok: true, kind, itemId: vote.itemId || null, engagement: shapeStoryEngagement(book, votes) };
}

/* ══ STORY REACTIONS (the bridge page's emoji grid + topbar love) ══
   One active reaction per reader per story, same contract as post reactions:
   per-user state in Reaction{targetType:'story'}, display counts denormalized
   on Book.reactions. Book.likes is kept as their sum so the catalogue sorts
   and the "Likes" stat can never drift from the grid. */

const STORY_RX = ['love', 'crying', 'angry', 'shocked', 'broken', 'emotional', 'savage', 'sus', 'twist', 'laughing'];

function rxCounts(book) {
  const raw = book.reactions instanceof Map
    ? Object.fromEntries(book.reactions)
    : (book.reactions || {});
  const counts = {};
  STORY_RX.forEach(rid => { counts[rid] = raw[rid] || 0; });
  return counts;
}

function rxTotal(counts) {
  return Object.keys(counts).reduce((a, k) => a + (counts[k] || 0), 0);
}

// rid === 'love' IS the topbar like: the picker and the grid are one surface.
async function reactStory({ bookId, userId, rid }) {
  if (!STORY_RX.includes(rid)) { const e = new Error('bad_reaction'); e.status = 400; throw e; }
  const book = await storyBook(bookId);
  const { Reaction } = require('../models/social.model');
  const prev = await Reaction.findOne({ userId: String(userId), targetType: 'story', targetId: book.id });
  if (prev && prev.rid === rid) {
    return { counts: rxCounts(book), userRx: rid, likes: book.likes || 0 };
  }
  if (prev) {
    const left = Math.max(0, (book.reactions.get(prev.rid) || 0) - 1);
    if (left) book.reactions.set(prev.rid, left); else book.reactions.delete(prev.rid);
    await Reaction.deleteOne({ userId: String(userId), targetType: 'story', targetId: book.id });
  }
  await Reaction.create({ userId: String(userId), targetType: 'story', targetId: book.id, rid });
  book.reactions.set(rid, (book.reactions.get(rid) || 0) + 1);
  const counts = rxCounts(book);
  book.likes = rxTotal(counts);
  await book.save();
  return { counts, userRx: rid, likes: book.likes };
}

async function unreactStory({ bookId, userId }) {
  const book = await storyBook(bookId);
  const { Reaction } = require('../models/social.model');
  const prev = await Reaction.findOneAndDelete({ userId: String(userId), targetType: 'story', targetId: book.id });
  if (prev) {
    const left = Math.max(0, (book.reactions.get(prev.rid) || 0) - 1);
    if (left) book.reactions.set(prev.rid, left); else book.reactions.delete(prev.rid);
    book.likes = rxTotal(rxCounts(book));
    await book.save();
  }
  return { counts: rxCounts(book), userRx: null, likes: book.likes || 0 };
}

async function storyReactionState(book, userId) {
  const counts = rxCounts(book);
  if (!userId) return { counts, userRx: null };
  const { Reaction } = require('../models/social.model');
  const mine = await Reaction.findOne({ userId: String(userId), targetType: 'story', targetId: book.id }).lean();
  return { counts, userRx: mine ? mine.rid : null };
}

/* ── Per-chapter reactions ─────────────────────────────────────────────
   The chapter end card is the reaction surface readers actually use. One
   active reaction per reader per chapter, stored as
   Reaction{targetType:'chapter', targetId:chapter.id}; the display counts
   live on Chapter.reactions and Chapter.likes stays in step. */
function chapterRxCounts(ch) {
  const raw = ch.reactions instanceof Map
    ? Object.fromEntries(ch.reactions)
    : (ch.reactions || {});
  const counts = {};
  STORY_RX.forEach(rid => { counts[rid] = raw[rid] || 0; });
  Object.keys(raw).forEach(rid => { if (!(rid in counts)) counts[rid] = raw[rid] || 0; });
  return counts;
}

async function loadChapterReaction(bookId, key) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: String(key) };
  q.status = { $in: ['live', 'published'] };
  const ch = await Chapter.findOne(q);
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  // Chapters created before reactions existed have no Map yet.
  if (!(ch.reactions instanceof Map)) ch.reactions = new Map(Object.entries(ch.reactions || {}));
  return ch;
}

async function reactChapter({ bookId, key, userId, rid }) {
  if (!STORY_RX.includes(rid)) { const e = new Error('bad_reaction'); e.status = 400; throw e; }
  const ch = await loadChapterReaction(bookId, key);
  const { Reaction } = require('../models/social.model');
  const prev = await Reaction.findOne({ userId: String(userId), targetType: 'chapter', targetId: ch.id });
  if (prev && prev.rid === rid) {
    return { counts: chapterRxCounts(ch), userRx: rid, likes: ch.likes || 0 };
  }
  if (prev) {
    const left = Math.max(0, (ch.reactions.get(prev.rid) || 0) - 1);
    if (left) ch.reactions.set(prev.rid, left); else ch.reactions.delete(prev.rid);
    await Reaction.deleteOne({ userId: String(userId), targetType: 'chapter', targetId: ch.id });
  }
  await Reaction.create({ userId: String(userId), targetType: 'chapter', targetId: ch.id, rid });
  ch.reactions.set(rid, (ch.reactions.get(rid) || 0) + 1);
  const counts = chapterRxCounts(ch);
  ch.likes = rxTotal(counts);
  await ch.save();
  return { counts, userRx: rid, likes: ch.likes };
}

async function unreactChapter({ bookId, key, userId }) {
  const ch = await loadChapterReaction(bookId, key);
  const { Reaction } = require('../models/social.model');
  const prev = await Reaction.findOneAndDelete({ userId: String(userId), targetType: 'chapter', targetId: ch.id });
  if (prev) {
    const left = Math.max(0, (ch.reactions.get(prev.rid) || 0) - 1);
    if (left) ch.reactions.set(prev.rid, left); else ch.reactions.delete(prev.rid);
    ch.likes = rxTotal(chapterRxCounts(ch));
    await ch.save();
  }
  return { counts: chapterRxCounts(ch), userRx: null, likes: ch.likes || 0 };
}

async function chapterReactionState({ bookId, key, userId }) {
  const ch = await loadChapterReaction(bookId, key);
  const counts = chapterRxCounts(ch);
  if (!userId) return { counts, userRx: null, likes: ch.likes || 0 };
  const { Reaction } = require('../models/social.model');
  const mine = await Reaction.findOne({ userId: String(userId), targetType: 'chapter', targetId: ch.id }).lean();
  return { counts, userRx: mine ? mine.rid : null, likes: ch.likes || 0 };
}

// Share channels: must match the 8 data-platform values in share-modal.js (line 422-450).
const SHARE_CHANNELS = ['whatsapp', 'twitter', 'instagram', 'telegram', 'facebook', 'threads', 'reddit', 'copy'];

function shareCounts(book) {
  return { sharesCount: book.sharesCount || 0 };
}

function shareChannelCounts(book) {
  const raw = book.sharesByChannel instanceof Map
    ? Object.fromEntries(book.sharesByChannel)
    : (book.sharesByChannel || {});
  return { channelShares: raw };
}

async function shareStory({ bookId, userId, channel }) {
  if (!SHARE_CHANNELS.includes(channel)) { const e = new Error('bad_channel'); e.status = 400; throw e; }
  const book = await storyBook(bookId);
  // One share per user per hour per channel prevents burst spam.
  const { ShareEvent } = require('../models/social.model');
  const recent = await ShareEvent.findOne({
    userId: String(userId), targetType: 'story', targetId: String(book.id), channel,
    createdAt: { $gte: new Date(Date.now() - 3600000) },
  });
  if (recent) { return { counts: shareCounts(book), channelShares: shareChannelCounts(book) }; }
  book.sharesCount = (book.sharesCount || 0) + 1;
  const byCh = book.sharesByChannel.get(channel) || 0;
  book.sharesByChannel.set(channel, byCh + 1);
  await book.save();
  await ShareEvent.create({ userId: String(userId), targetType: 'story', targetId: String(book.id), channel });
  return { counts: shareCounts(book), channelShares: shareChannelCounts(book) };
}

module.exports = {
  loadChapter, vote, retract, results, trackProgress, readState,
  bookEngagement, bookVote, bookRetract,
  // The story detail read builds the same engagement block, so it borrows the
  // mapper instead of growing a second one.
  shapeStoryEngagement, storyVotes, ENGAGEMENT_LISTS,
  reactStory, unreactStory, storyReactionState, STORY_RX,
  chapterRxCounts, reactChapter, unreactChapter, chapterReactionState,
  shareStory, SHARE_CHANNELS,
};
