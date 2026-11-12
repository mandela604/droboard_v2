'use strict';
/**
 * services/ratings.service.js — per-book star ratings.
 * Contract (public/component/rate-modal.js):
 *   getRating(storyId)    -> { ok, mine: {stars,text,spoiler}|null, avg, count }
 *   submitRate(storyId, { stars, text, spoiler }) -> { ok, ... }
 * Gate: chapters read (rate-modal MIN_CHAPTERS) — enforced server-side
 * from ReadingProgress rows, not the client-supplied chaptersRead.
 */
const { Book } = require('../models/content.model');
const { BookRating, RatingHelpful, ReadingProgress, Post } = require('../models/social.model');
const { User } = require('../models/user.model');

// Same gate as recommendations (posts.service RECOMMEND_MIN_CHAPTERS): a
// reader needs a real reading history before judging a story. Capped by the
// book's own chapter count so short books unlock at their full length.
const MIN_CHAPTERS = 3;
const READABLE = ['ongoing', 'published', 'completed'];
// Sort keys the reviews list understands — the same three the page's revSort
// chips use (helpful | newest | rating). Default is 'helpful'.
const REV_SORTS = {
  helpful: { helpfulCount: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  rating: { stars: -1, helpfulCount: -1 },
};

function fail(msg, status) { const e = new Error(msg); e.status = status; throw e; }

/* Gate: MIN_CHAPTERS read, but never more than the book actually has —
   a 5- or 8-chapter book unlocks at its full length, not at 12. */
function gateFor(book) {
  const total = Number(book && book.chapterCount) || 0;
  return total > 0 ? Math.min(MIN_CHAPTERS, total) : MIN_CHAPTERS;
}

async function loadLiveBook(bookId) {
  const book = await Book.findOne({ id: bookId });
  if (!book || !READABLE.includes(book.status)) fail('not_found', 404);
  return book;
}

/* Review post (feed): one per (reviewer, book) — re-rating edits it, clearing
   the text removes it. post-card renders type 'review' (pill + stars + body). */
async function syncReviewPost(book, userId, stars, text) {
  const filter = { type: 'review', authorId: String(userId), 'storyRef.id': book.id };
  const body = String(text || '').trim().slice(0, 600);
  if (!body) { await Post.deleteMany(filter); return null; }
  let writer = '';
  try {
    const u = await User.findOne({ id: book.authorId }).select('username').lean();
    writer = (u && u.username) || '';
  } catch (e) { /* writer label best-effort */ }
  return Post.findOneAndUpdate(
    filter,
    { $set: {
      score: stars,
      reviewText: body,
      storyRef: { id: book.id, title: book.title, cat: book.genre || '', writer, cover: book.cover || '' },
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getRating(bookId, userId) {
  const book = await loadLiveBook(bookId);
  const mine = userId
    ? await BookRating.findOne({ bookId: book.id, userId: String(userId) }).lean()
    : null;
  const need = gateFor(book);
  const chaptersRead = userId
    ? await ReadingProgress.countDocuments({ userId: String(userId), storyId: book.id })
    : 0;
  return {
    ok: true,
    mine: mine ? { stars: mine.stars, text: mine.text || '', spoiler: !!mine.spoiler } : null,
    avg: book.rating || 0,
    count: book.ratingCount || 0,
    chaptersRead,
    need,
    canRate: chaptersRead >= need,
  };
}

async function submitRating(bookId, userId, { stars, text, spoiler }) {
  const book = await loadLiveBook(bookId);
  const read = await ReadingProgress.countDocuments({ userId: String(userId), storyId: book.id });
  if (read < gateFor(book)) fail('not_enough_reading', 403);
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
  await syncReviewPost(book, userId, stars, text);
  return { ok: true, mine: { stars, text: text || '', spoiler: !!spoiler }, avg, count };
}

/* ── reviews list (the reader-facing grid under the story page) ──
   The page renders one card per reader review: author id/name/avatar (so the
   status ring can attach by id), the real stars, text, a helpful tally and the
   mark time. All read from BookRating + a bulk User join — never the debate
   comments the demo used, and never a client-side rating hash. */
async function listRatings(bookId, viewerId, { page, limit, sort } = {}) {
  const book = await loadLiveBook(bookId);
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const order = REV_SORTS[sort] || REV_SORTS.helpful;

  const [rows, total] = await Promise.all([
    BookRating.find({ bookId: book.id }).sort(order).skip((pg - 1) * lim).limit(lim).lean(),
    BookRating.countDocuments({ bookId: book.id }),
  ]);
  if (!rows.length) return { items: [], total, page: pg, limit: lim };

  const ids = [...new Set(rows.map(r => String(r.userId)))];
  const viewer = viewerId ? String(viewerId) : null;
  const [authors, marks] = await Promise.all([
    User.find({ id: { $in: ids } }).select('id username fullName avatar').lean(),
    viewer
      ? RatingHelpful.find({ userId: viewer, ratingId: { $in: rows.map(r => String(r.id)) } }).select('ratingId').lean()
      : Promise.resolve([]),
  ]);
  const byId = {};
  authors.forEach(u => { byId[String(u.id)] = u; });
  const mine = new Set(marks.map(m => String(m.ratingId)));

  return {
    items: rows.map(r => {
      const u = byId[String(r.userId)] || {};
      return {
        id: String(r.id),
        userId: String(r.userId),
        name: u.fullName || u.username || '',
        avatar: u.avatar || '',
        stars: r.stars,
        text: r.text || '',
        spoiler: !!r.spoiler,
        createdAt: new Date(r.createdAt).getTime(),
        helpful: r.helpfulCount || 0,
        mineHelpful: mine.has(String(r.id)),
      };
    }),
    total, page: pg, limit: lim,
  };
}

/* One "helpful" mark per (rating, user). The tally is denormalized on
   BookRating.helpfulCount and paired 1:1 with a RatingHelpful row, so a mark
   that already exists (or an unmark of a non-mark) never double-counts. */
async function setHelpful(bookId, ratingId, userId, on) {
  const book = await loadLiveBook(bookId);
  const rating = await BookRating.findOne({ id: String(ratingId), bookId: book.id });
  if (!rating) fail('not_found', 404);
  const uid = String(userId);

  if (on) {
    const existing = await RatingHelpful.findOne({ ratingId: String(ratingId), userId: uid });
    if (!existing) {
      try {
        await RatingHelpful.create({ ratingId: String(ratingId), userId: uid });
        await BookRating.updateOne({ id: rating.id }, { $inc: { helpfulCount: 1 } });
      } catch (e) {
        // Unique index won the race — a parallel mark; treat as already counted.
        if (e.code !== 11000) throw e;
      }
    }
  } else {
    const del = await RatingHelpful.deleteOne({ ratingId: String(ratingId), userId: uid });
    if (del.deletedCount > 0) {
      await BookRating.updateOne({ id: rating.id, helpfulCount: { $gt: 0 } }, { $inc: { helpfulCount: -1 } });
    }
  }

  const fresh = await BookRating.findOne({ id: rating.id }).select('helpfulCount').lean();
  return { ok: true, helpful: fresh ? fresh.helpfulCount : 0, mineHelpful: !!on };
}

module.exports = { getRating, submitRating, listRatings, setHelpful, MIN_CHAPTERS };
