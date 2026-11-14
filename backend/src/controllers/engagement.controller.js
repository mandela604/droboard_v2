'use strict';
const engagement = require('../services/engagement.service');
const base = require('./base.controller');

async function withChapter(req, res, fn) {
  return base.wrap(res, async () => {
    const books = require('../services/books.service');
    const book = await books.loadBookOr404(req.valid.params.bookId);
    const chapter = await engagement.loadChapter(book.id, req.valid.params.key);
    return fn(chapter);
  });
}

async function votePoll(req, res) {
  return withChapter(req, res, async (chapter) =>
    engagement.vote({ chapter, userId: req.user.id, kind: 'poll', option: req.valid.body.option }));
}

async function votePrediction(req, res) {
  return withChapter(req, res, async (chapter) =>
    engagement.vote({ chapter, userId: req.user.id, kind: 'prediction', option: req.valid.body.option }));
}

async function voteDebate(req, res) {
  return withChapter(req, res, async (chapter) =>
    engagement.vote({ chapter, userId: req.user.id, kind: 'debate', option: req.valid.body.side }));
}

async function retract(req, res) {
  return withChapter(req, res, async (chapter) =>
    engagement.retract({ chapter, userId: req.user.id, kind: req.valid.params.kind }));
}

async function results(req, res) {
  return withChapter(req, res, async (chapter) =>
    engagement.results({ chapter, userId: req.user ? req.user.id : null }));
}

/* ── per-chapter reactions (chapter end card) ── */
async function chapterReactionGet(req, res) {
  return base.wrap(res, async () => engagement.chapterReactionState({
    bookId: req.valid.params.bookId, key: req.valid.params.key,
    userId: req.user ? req.user.id : null,
  }));
}

async function chapterReactionPost(req, res) {
  return base.wrap(res, async () => engagement.reactChapter({
    bookId: req.valid.params.bookId, key: req.valid.params.key,
    userId: req.user.id, rid: req.valid.body.rid,
  }));
}

async function chapterReactionDelete(req, res) {
  return base.wrap(res, async () => engagement.unreactChapter({
    bookId: req.valid.params.bookId, key: req.valid.params.key,
    userId: req.user.id,
  }));
}

async function progress(req, res) {
  return base.wrap(res, async () => {
    const b = req.valid.body || {};
    return engagement.trackProgress({
      bookId: req.valid.params.bookId, chapterId: req.valid.params.key,
      storyId: req.valid.params.bookId, userId: req.user.id,
      secondsSpent: b.secondsSpent, pct: b.pct, finished: b.finished, wordsRead: b.wordsRead,
    });
  });
}

async function readState(req, res) {
  return base.wrap(res, async () => engagement.readState({
    bookId: req.valid.params.bookId, userId: req.user.id,
  }));
}

/* ── story-wide engagement (book-level poll/prediction/debate) ── */

async function bookResults(req, res) {
  return base.wrap(res, async () => engagement.bookEngagement({
    bookId: req.valid.params.bookId, userId: req.user ? req.user.id : null,
  }));
}

// kind + the chosen answer both arrive in the BODY; only bookId is a path
// param. Reading kind off params gives undefined and the service answers
// bad_kind, which is how every reader vote used to 400.
async function bookVote(req, res) {
  const b = req.valid.body;
  return base.wrap(res, async () => engagement.bookVote({
    bookId: req.valid.params.bookId, userId: req.user.id,
    kind: b.kind, id: b.id,
    option: b.kind === 'debate' ? b.side : b.option,
  }));
}

async function bookRetract(req, res) {
  return base.wrap(res, async () => engagement.bookRetract({
    bookId: req.valid.params.bookId, userId: req.user.id,
    kind: req.valid.params.kind, itemId: req.valid.params.itemId,
  }));
}

/* ── ratings (rate-modal contract) ── */

async function ratingGet(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.getRating(req.valid.params.id, req.user ? req.user.id : null);
  });
}

async function ratingPost(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.submitRating(req.valid.params.id, req.user.id, req.valid.body);
  });
}

async function ratingDelete(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.deleteRating(req.valid.params.id, req.user.id);
  });
}

/* ── reviews list + helpful votes (reader-facing story page) ── */

async function ratingsList(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.listRatings(req.valid.params.id, req.user ? req.user.id : null, req.valid.query);
  });
}

async function helpfulMark(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.setHelpful(req.valid.params.id, req.valid.params.ratingId, req.user.id, true);
  });
}

async function helpfulUnmark(req, res) {
  return base.wrap(res, async () => {
    const ratings = require('../services/ratings.service');
    return ratings.setHelpful(req.valid.params.id, req.valid.params.ratingId, req.user.id, false);
  });
}

module.exports = {
  votePoll, votePrediction, voteDebate, retract, results, progress, readState,
  chapterReactionGet, chapterReactionPost, chapterReactionDelete,
  bookResults, bookVote, bookRetract,
  ratingGet, ratingPost, ratingDelete, ratingsList, helpfulMark, helpfulUnmark,
};
