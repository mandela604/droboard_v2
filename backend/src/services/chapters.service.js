'use strict';
const { Chapter, Book } = require('../models/content.model');
const books = require('./books.service');

const SHORT_MAX = 25;

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
  const words = data.words != null ? parseInt(data.words, 10) : countWords(data.content);
  const ch = await Chapter.create({
    bookId, n,
    title: data.title || ('Chapter ' + n),
    content: data.content || '',
    words: Number.isFinite(words) ? words : 0,
    status: data.status || 'draft',
    authorNote: data.authorNote || '',
    poll: data.poll, prediction: data.prediction, debate: data.debate,
  });
  await Book.updateOne({ id: bookId }, { $inc: { chapterCount: 1, wordCount: ch.words || 0 } });
  return ch.toJSON();
}

async function listChapters({ bookId }) {
  return Chapter.find({ bookId }).sort({ n: 1 }).lean();
}

async function getChapter({ bookId, key }) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: key };
  const ch = await Chapter.findOne(q).lean();
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  return ch;
}

async function updateChapter({ ch, data }) {
  const oldWords = ch.words || 0;
  const oldN = ch.n;
  ['title', 'content', 'words', 'status', 'authorNote', 'poll', 'prediction', 'debate', 'scheduledAt'].forEach(k => {
    if (data[k] !== undefined) ch[k] = data[k];
  });
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

async function loadChapterOr404(bookId, key) {
  const q = /^\d+$/.test(String(key)) ? { bookId, n: parseInt(key, 10) } : { bookId, id: key };
  const ch = await Chapter.findOne(q);
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  return ch;
}

module.exports = { createChapter, listChapters, getChapter, updateChapter, deleteChapter, loadChapterOr404, books, SHORT_MAX, countWords };
