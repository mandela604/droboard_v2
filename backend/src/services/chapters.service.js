'use strict';
const { Chapter, Book } = require('../models/content.model');
const books = require('./books.service');

const SHORT_MAX = 25;

// poll/prediction arrive as { q, opts: [string] } from the API — normalize
// to the model's { t, v } subdocs (objects pass through untouched).
function normOpts(opts) {
  if (!Array.isArray(opts)) return undefined;
  return opts.map(o => (o && typeof o === 'object') ? o : { t: String(o == null ? '' : o), v: 0 });
}
function normPollLike(p) {
  if (p === undefined || p === null) return p;
  const out = p.opts !== undefined ? Object.assign({}, p, { opts: normOpts(p.opts) }) : Object.assign({}, p);
  if (out.expiresAt != null) out.expiresAt = new Date(out.expiresAt);
  else if (out.expiresAt === null) out.expiresAt = null;
  return out;
}

// Chapter content fields that need editor approval on live chapters.
// (status-only transitions, e.g. submit for review, always apply directly.)
const CHAPTER_CONTENT_FIELDS = ['title', 'content', 'words', 'authorNote', 'poll', 'prediction', 'debate', 'n'];
// Drafts / in-pipeline chapters edit freely; live content goes through proposals.
const LIVE_CHAPTER_STATUS = ['live', 'published', 'scheduled'];
function chapterNeedsProposal(ch) {
  return LIVE_CHAPTER_STATUS.includes(ch.status);
}

// Chapter statuses that put content on the platform. Authors can never set
// these directly — every submitted chapter appears only after editor approve.
const PUBLISH_CHAPTER_STATUS = ['live', 'published', 'scheduled'];

async function proposeChapterEdit({ book, ch, authorId, data }) {
  const { ChapterEdit } = require('../models/application.model');
  const proposed = {};
  CHAPTER_CONTENT_FIELDS.forEach(k => { if (data[k] !== undefined) proposed[k] = data[k]; });
  // Publish/schedule requests ride the same queue.
  if (data.status !== undefined && PUBLISH_CHAPTER_STATUS.includes(data.status)) {
    proposed.status = data.status;
    if (data.scheduledAt !== undefined) proposed.scheduledAt = data.scheduledAt;
  }
  if (!Object.keys(proposed).length) { const e = new Error('nothing_to_propose'); e.status = 400; throw e; }
  const dupe = await ChapterEdit.findOne({ chapterId: ch.id, authorId, status: 'pending' }).lean();
  if (dupe) { const e = new Error('proposal_pending'); e.status = 409; throw e; }
  const doc = await ChapterEdit.create({
    bookId: book.id, chapterId: ch.id, chapterN: ch.n,
    authorId, proposed, baseVersion: ch.version, status: 'pending',
  });
  return doc.toJSON();
}

async function applyChapterProposal({ proposal, reviewerId }) {
  if (!proposal || proposal.status !== 'pending') { const e = new Error('not_pending'); e.status = 409; throw e; }
  const ch = await Chapter.findOne({ id: proposal.chapterId });
  if (!ch) { const e = new Error('chapter_not_found'); e.status = 404; throw e; }
  const data = proposal.proposed || {};
  const oldWords = ch.words || 0;
  const oldN = ch.n;
  ['title', 'content', 'words', 'authorNote'].forEach(k => {
    if (data[k] !== undefined) ch[k] = data[k];
  });
  if (data.poll !== undefined) ch.poll = normPollLike(data.poll);
  if (data.prediction !== undefined) ch.prediction = normPollLike(data.prediction);
  if (data.debate !== undefined) ch.debate = normPollLike(data.debate);
  // Editor-approved publish/schedule (the only path onto the platform).
  if (data.status !== undefined && PUBLISH_CHAPTER_STATUS.includes(data.status)) ch.status = data.status;
  if (data.scheduledAt !== undefined) {
    const d = new Date(data.scheduledAt);
    if (isNaN(d.getTime())) { const e = new Error('bad_scheduledAt'); e.status = 400; throw e; }
    ch.scheduledAt = d;
  }
  if (data.content !== undefined && data.words === undefined) ch.words = countWords(ch.content);
  if (data.n != null) {
    const nn = parseInt(data.n, 10);
    if (!Number.isInteger(nn) || nn < 1) { const e = new Error('bad_n'); e.status = 400; throw e; }
    const book = await Book.findOne({ id: ch.bookId }).select('kind').lean();
    if ((book ? book.kind : 'long') === 'short' && nn > SHORT_MAX) { const e = new Error('short_max_25'); e.status = 400; throw e; }
    ch.n = nn;
  }
  if (ch.n !== oldN) {
    const dupe = await Chapter.exists({ bookId: ch.bookId, n: ch.n });
    if (dupe) { const e = new Error('chapter_n_taken'); e.status = 409; throw e; }
  }
  ch.version += 1;
  await ch.save();
  const diff = (ch.words || 0) - oldWords;
  if (diff) await Book.updateOne({ id: ch.bookId }, { $inc: { wordCount: diff } });
  proposal.status = 'approved';
  proposal.reviewerId = reviewerId || null;
  proposal.decidedAt = new Date();
  await proposal.save();
  return ch.toJSON();
}

function countWords(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

async function nextN(bookId) {
  const last = await Chapter.findOne({ bookId }).sort({ n: -1 }).select('n').lean();
  return last ? last.n + 1 : 1;
}

async function createChapter({ bookId, data }) {
  const book = await Book.findOne({ id: bookId }).select('id kind').lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  // short: max 25 chapters. long: unlimited.
  const kind = book.kind || 'long';
  if (kind === 'short') {
    const count = await Chapter.countDocuments({ bookId });
    if (count >= SHORT_MAX) { const e = new Error('short_max_25'); e.status = 400; throw e; }
  }
  const n = data.n != null ? parseInt(data.n, 10) : await nextN(bookId);
  if (!Number.isInteger(n) || n < 1) { const e = new Error('bad_n'); e.status = 400; throw e; }
  if (kind === 'short' && n > SHORT_MAX) { const e = new Error('short_max_25'); e.status = 400; throw e; }
  const exists = await Chapter.exists({ bookId, n });
  if (exists) { const e = new Error('chapter_n_taken'); e.status = 409; throw e; }
  let scheduledAt = null;
  if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
    scheduledAt = new Date(data.scheduledAt);
    if (isNaN(scheduledAt.getTime())) { const e = new Error('bad_scheduledAt'); e.status = 400; throw e; }
  }
  const words = data.words != null ? parseInt(data.words, 10) : countWords(data.content);
  const ch = await Chapter.create({
    bookId, n,
    title: data.title || ('Chapter ' + n),
    content: data.content || '',
    words: Number.isFinite(words) ? words : 0,
    status: data.status || 'draft',
    scheduledAt,
    authorNote: data.authorNote || '',
    price: Number.isFinite(Number(data.price)) && Number(data.price) >= 0 ? Math.floor(Number(data.price)) : 0,
    poll: normPollLike(data.poll), prediction: normPollLike(data.prediction), debate: normPollLike(data.debate),
  });
  await Book.updateOne({ id: bookId }, { $inc: { chapterCount: 1, wordCount: ch.words || 0 } });
  return ch.toJSON();
}

async function listChapters({ bookId, onlyLive }) {
  const filter = { bookId };
  if (onlyLive) filter.status = { $in: ['live', 'published'] };
  return Chapter.find(filter).sort({ n: 1 }).lean();
}

async function getChapter({ bookId, key, onlyLive }) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: key };
  if (onlyLive) q.status = { $in: ['live', 'published'] };
  const ch = await Chapter.findOne(q).lean();
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  return ch;
}

async function updateChapter({ ch, data }) {
  const oldWords = ch.words || 0;
  const oldN = ch.n;
  ['title', 'content', 'words', 'status', 'authorNote'].forEach(k => {
    if (data[k] !== undefined) ch[k] = data[k];
  });
  if (data.poll !== undefined) ch.poll = normPollLike(data.poll);
  if (data.prediction !== undefined) ch.prediction = normPollLike(data.prediction);
  if (data.debate !== undefined) ch.debate = normPollLike(data.debate);
  if (data.price !== undefined) {
    const p = Math.floor(Number(data.price));
    if (Number.isFinite(p) && p >= 0) ch.price = p;
  }
  if (data.scheduledAt !== undefined) {
    if (data.scheduledAt === null) ch.scheduledAt = null;
    else {
      const d = new Date(data.scheduledAt);
      if (isNaN(d.getTime())) { const e = new Error('bad_scheduledAt'); e.status = 400; throw e; }
      ch.scheduledAt = d;
    }
  }
  // recompute words when content changes and words not explicitly supplied
  if (data.content !== undefined && data.words === undefined) ch.words = countWords(ch.content);
  if (data.n != null) {
    const nn = parseInt(data.n, 10);
    if (!Number.isInteger(nn) || nn < 1) { const e = new Error('bad_n'); e.status = 400; throw e; }
    ch.n = nn;
  }
  // enforce short max on renumber too
  if (ch.n > SHORT_MAX) {
    const book = await Book.findOne({ id: ch.bookId }).select('kind').lean();
    const kind = (book && book.kind) || 'long';
    if (kind === 'short') { const e = new Error('short_max_25'); e.status = 400; throw e; }
  }
  if (ch.n !== oldN) {
    const dupe = await Chapter.exists({ bookId: ch.bookId, n: ch.n });
    if (dupe) { const e = new Error('chapter_n_taken'); e.status = 409; throw e; }
  }
  ch.version += 1;
  await ch.save();
  const diff = (ch.words || 0) - oldWords;
  if (diff) await Book.updateOne({ id: ch.bookId }, { $inc: { wordCount: diff } });
  return ch.toJSON();
}

async function deleteChapter({ ch }) {
  const words = ch.words || 0;
  const bookId = ch.bookId;
  await ch.deleteOne();
  await Book.updateOne({ id: bookId }, { $inc: { chapterCount: -1, wordCount: -words } });
  return { ok: true };
}

// BATCH 2: reorder — full chapter order in one call (no N serial PATCHes,
// no n-collisions). Order must contain EVERY chapter id exactly once.
// Two-phase renumber dodges the unique {bookId, n} index.
async function reorderChapters({ bookId, order }) {
  const ids = Array.isArray(order) ? order.map(String) : [];
  if (!ids.length) { const e = new Error('order_required'); e.status = 400; throw e; }
  if (new Set(ids).size !== ids.length) { const e = new Error('order_duplicate'); e.status = 400; throw e; }
  const existing = await Chapter.find({ bookId }).select('id').lean();
  const have = new Set(existing.map(c => String(c.id)));
  if (have.size !== ids.length || !ids.every(x => have.has(x))) {
    const e = new Error('order_must_cover_all_chapters'); e.status = 400; throw e;
  }
  const BASE = 100000;
  await Chapter.bulkWrite(ids.map((cid, i) => ({
    updateOne: { filter: { bookId, id: cid }, update: { n: BASE + i + 1 } },
  })));
  await Chapter.bulkWrite(ids.map((cid, i) => ({
    updateOne: { filter: { bookId, id: cid }, update: { n: i + 1 } },
  })));
  return Chapter.find({ bookId }).sort({ n: 1 }).select('n title words status').lean();
}

async function loadChapterOr404(bookId, key) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: key };
  const ch = await Chapter.findOne(q);
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  return ch;
}

module.exports = { createChapter, listChapters, getChapter, updateChapter, deleteChapter, reorderChapters, loadChapterOr404, books, SHORT_MAX, countWords, CHAPTER_CONTENT_FIELDS, LIVE_CHAPTER_STATUS, PUBLISH_CHAPTER_STATUS, chapterNeedsProposal, proposeChapterEdit, applyChapterProposal };
