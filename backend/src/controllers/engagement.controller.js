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

module.exports = { votePoll, votePrediction, voteDebate, retract, results, progress };
