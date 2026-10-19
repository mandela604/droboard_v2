'use strict';
/**
 * services/ratings.service.js — per-book star ratings.
 * Contract (public/component/rate-modal.js):
 *   getRating(storyId)    -> { ok, mine: {stars,text,spoiler}|null, avg, count }
 *   submitRate(storyId, { stars, text, spoiler }) -> { ok, ... }
 * Gate: 12 chapters read (rate-modal MIN_CHAPTERS) — enforced server-side
 * from ReadingProgress rows, not the client-supplied chaptersRead.
 */
const { Book } = require('../models/content.model');
const { BookRating, ReadingProgress } = require('../models/social.model');

const MIN_CHAPTERS = 12;
const READABLE = ['ongoing', 'published', 'completed'];

function fail(msg, status) { const e = new Error(msg); e.status = status; throw e; }

async function loadLiveBook(bookId) {
  const book = await Book.findOne({ id: bookId });
  if (!book || !READABLE.includes(book.status)) fail('not_found', 404);
  return book;
}

async function getRating(bookId, userId) {
  const book = await loadLiveBook(bookId);
  const mine = userId
    ? await BookRating.findOne({ bookId: book.id, userId: String(userId) }).lean()
    : null;
  return {
    ok: true,
    mine: mine ? { stars: mine.stars, text: mine.text || '', spoiler: !!mine.spoiler } : null,
    avg: book.rating || 0,
    count: book.ratingCount || 0,
  };
}

async function submitRating(bookId, userId, { stars, text, spoiler }) {
  const book = await loadLiveBook(bookId);
  const read = await ReadingProgress.countDocuments({ userId: String(userId), storyId: book.id });
  if (read < MIN_CHAPTERS) fail('not_enough_reading', 403);
  await BookRating.findOneAndUpdate(
    { bookId: book.id, userId: String(userId) },
    { $set: { stars, text: text || '', spoiler: !!spoiler } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const agg = await BookRating.aggregate([
    { $match: { bookId: book.id } },
    { $group: { _id: null, avg: { $avg: '$stars' }, count: { $sum: 1 } } },
  ]);
  const avg = agg.length ? Math.round(agg[0].avg * 10) / 10 : 0;
  const count = agg.length ? agg[0].count : 0;
  await Book.updateOne({ id: book.id }, { $set: { rating: avg, ratingCount: count } });
  return { ok: true, mine: { stars, text: text || '', spoiler: !!spoiler }, avg, count };
}

module.exports = { getRating, submitRating, MIN_CHAPTERS };
