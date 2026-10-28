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
  return {
    poll: chapter.poll || null,
    prediction: chapter.prediction || null,
    debate: chapter.debate || null,
    authorNote: chapter.authorNote || '',
    myVotes,
  };
}

// Reader boot state: coin-unlocked chapters + per-chapter progress + continue point.
async function readState({ userId, bookId }) {
  const sid = String(bookId);
  const uid = String(userId);
  const { Book } = require('../models/content.model');
  const { LedgerEntry } = require('../models/money.model');
  const [book, progress, unlocks] = await Promise.all([
    Book.findOne({ id: sid }).select('id vipLocked').lean().catch(() => null),
    ReadingProgress.find({ userId: uid, storyId: sid }).select('chapterId pct finished secondsSpent lastReadAt').lean().catch(() => []),
    LedgerEntry.find({ debitAcct: 'wallet:' + uid, kind: 'spend', memo: /^unlock ch / }).select('saleId').lean().catch(() => []),
  ]);
  const unlocked = [];
  unlocks.forEach(u => {
    const parts = String(u.saleId || '').split(':');
    if (parts.length >= 4 && parts[1] === uid && parts[2] === sid) unlocked.push(parts.slice(3).join(':'));
  });
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
// stop clock abuse. On finish-transition (first time this user finishes this
// chapter) increments Chapter.views + Book.reads and writes today's
// BookDailyStat snapshot (powers Rising = reads last 7d).
async function trackProgress({ bookId, chapterId, storyId, userId, secondsSpent, pct, finished, wordsRead }) {
  const secs = Math.min(3600, Math.max(0, parseInt(secondsSpent, 10) || 0));
  const sid = String(storyId || bookId);
  const cid = String(chapterId || '');
  const prev = await ReadingProgress.findOne({ userId: String(userId), storyId: sid, chapterId: cid }).select('finished').lean();
  const update = {
    $inc: { secondsSpent: secs, wordsRead: Math.max(0, parseInt(wordsRead, 10) || 0) },
    $set: { lastReadAt: new Date() },
  };
  if (pct !== undefined) update.$set.pct = Math.min(100, Math.max(0, Number(pct) || 0));
  if (finished !== undefined) update.$set.finished = !!finished;
  const doc = await ReadingProgress.findOneAndUpdate(
    { userId: String(userId), storyId: sid, chapterId: cid },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  // First finish of this chapter by this user = one read.
  if (finished && (!prev || !prev.finished)) {
    try {
      const { Book, Chapter, BookDailyStat } = require('../models/content.model');
      const day = new Date().toISOString().slice(0, 10);
      await Promise.all([
        Chapter.updateOne({ id: cid }, { $inc: { views: 1 } }).catch(() => {}),
        Book.updateOne({ id: sid }, { $inc: { reads: 1 } }).catch(() => {}),
        BookDailyStat.updateOne(
          { bookId: sid, day },
          { $inc: { reads: 1, finishes: 1 } },
          { upsert: true }
        ).catch(() => {}),
      ]);
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
   Same shapes as chapter-wise but keyed by bookId with chapterId '' —
   EngagementVote.bookId set, chapterId ''. Vote mutates the Book's
   embedded arrays in place (matches the reader's record shape). */

async function bookEngagement({ bookId, userId }) {
  const book = await Book.findOne({ id: bookId }).select('id polls predictions debates').lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  const mine = await EngagementVote.find({ bookId: bookId, userId, chapterId: '' }).lean();
  const myVotes = {};
  mine.forEach(v => { myVotes[v.kind] = v.optionIdx; });
  return {
    polls: book.polls || [],
    predictions: book.predictions || [],
    debates: book.debates || [],
    myVotes,
  };
}

async function bookVote({ bookId, userId, kind, id, option }) {
  const book = await Book.findOne({ id: bookId });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  const list = kind === 'poll' ? book.polls : kind === 'prediction' ? book.predictions : kind === 'debate' ? book.debates : null;
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
  try {
    await EngagementVote.create({ chapterId: '', bookId: bookId, userId, kind, optionIdx });
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
  return Object.assign({ kind }, item.toJSON());
}

async function bookRetract({ bookId, userId, kind }) {
  const vote = await EngagementVote.findOneAndDelete({ bookId: bookId, userId, kind, chapterId: '' });
  if (!vote) { const e = new Error('no_vote'); e.status = 404; throw e; }
  const book = await Book.findOne({ id: bookId });
  if (!book) return { ok: true, kind };
  if (kind === 'debate') {
    const deb = book.debates.find(d => d && d.id && d.forV != null);
    if (deb) {
      if (vote.optionIdx === 0) deb.forV = Math.max(0, (deb.forV || 0) - 1);
      else deb.agV = Math.max(0, (deb.agV || 0) - 1);
      await book.save();
    }
  } else {
    const list = kind === 'poll' ? book.polls : book.predictions;
    const item = list.find(p => p && p.opts && p.opts[vote.optionIdx] != null);
    if (item) {
      item.opts[vote.optionIdx].v = Math.max(0, (item.opts[vote.optionIdx].v || 0) - 1);
      await book.save();
    }
  }
  return { ok: true, kind };
}

module.exports = { loadChapter, vote, retract, results, trackProgress, readState, bookEngagement, bookVote, bookRetract };
