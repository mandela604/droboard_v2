'use strict';
const author = require('../services/author.service');
const base = require('./base.controller');

// Multer names the multipart parts idFront/idBack; the service speaks front/back.
function idFilesOf(req) {
  const f = req.files || {};
  return { front: f.idFront, back: f.idBack };
}

async function dashboard(req, res) {
  return base.wrap(res, async () => author.dashboard({ userId: req.user.id }));
}

async function books(req, res) {
  return base.wrap(res, async () => author.books({ userId: req.user.id }));
}

async function overview(req, res) {
  return base.wrap(res, async () => author.overview({ userId: req.user.id, bookId: req.valid.params.id }));
}

async function characters(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    return author.listCharacters({ book });
  });
}

async function saveCharacter(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    const out = await author.saveCharacter({ book, data: req.valid.body, id: req.valid.params.charId });
    if (!req.valid.params.charId) res.status(201);
    return out;
  });
}

async function deleteCharacter(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    return author.deleteCharacter({ book, id: req.valid.params.charId });
  });
}

async function plot(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    return author.getPlot({ book });
  });
}

async function savePlot(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    return author.savePlot({ book, data: req.valid.body });
  });
}

async function bookChapters(req, res) {
  return base.wrap(res, async () => {
    const book = await author.ownBook({ userId: req.user.id, bookId: req.valid.params.id });
    const chapters = require('../services/chapters.service');
    const key = req.valid.params.num;
    if (key) return chapters.getChapter({ bookId: book.id, key });
    return chapters.listChapters({ bookId: book.id });
  });
}

async function book(req, res) {
  return base.wrap(res, async () => author.getBook({ userId: req.user.id, bookId: req.valid.params.id }));
}

async function bookChaptersList(req, res) {
  return base.wrap(res, async () => author.listChapters({
    userId: req.user.id, bookId: req.valid.params.id,
    page: req.valid.query.page, limit: req.valid.query.limit,
  }));
}

async function saveBookChapter(req, res) {
  return base.wrap(res, async () => author.saveBookChapter({
    userId: req.user.id, bookId: req.valid.params.id,
    num: req.valid.params.num, data: req.valid.body,
  }));
}

async function requestBookChange(req, res) {
  return base.wrap(res, async () => {
    const out = await author.requestBookChange({
      userId: req.user.id, bookId: req.valid.params.id,
      changes: req.valid.body.changes, details: req.valid.body.details, order: req.valid.body.order,
    });
    res.status(201);
    return out;
  });
}

async function contracts(req, res) {
  return base.wrap(res, async () => author.listContracts({ userId: req.user.id }));
}

async function applyContract(req, res) {
  return base.wrap(res, async () => {
    const out = await author.applyContract({
      userId: req.user.id,
      bookId: req.valid.body.bookId,
      kyc: req.valid.body.kyc,
      idFiles: idFilesOf(req),
    });
    res.status(201);
    return out;
  });
}

async function signContract(req, res) {
  return base.wrap(res, async () => author.signContract({
    userId: req.user.id,
    contractId: req.valid.params.contractId,
  }));
}

async function declineContract(req, res) {
  return base.wrap(res, async () => author.declineContract({
    userId: req.user.id,
    contractId: req.valid.params.contractId,
    reason: req.valid.body.reason,
  }));
}

async function applyCompletion(req, res) {
  return base.wrap(res, async () => {
    const out = await author.applyCompletion({ userId: req.user.id, bookId: req.valid.body.bookId, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function applyVip(req, res) {
  return base.wrap(res, async () => {
    const out = await author.applyVip({ userId: req.user.id, bookId: req.valid.body.bookId, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function chapterReviews(req, res) {
  return base.wrap(res, async () => author.submitChapterReview({ userId: req.user.id, bookId: req.valid.body.bookId, data: req.valid.body }));
}

async function chapterEdits(req, res) {
  return base.wrap(res, async () => author.listChapterEdits({ userId: req.user.id, bookId: req.valid.params.id }));
}

async function bookEdits(req, res) {
  return base.wrap(res, async () => author.listBookEdits({ userId: req.user.id, bookId: req.valid.params.id }));
}

async function launchKit(req, res) {
  return base.wrap(res, async () => author.launchKit({ userId: req.user.id }));
}

async function saveLaunchKit(req, res) {
  return base.wrap(res, async () => {
    const out = await author.saveLaunchKit({ userId: req.user.id, data: req.valid.body, id: req.valid.params.id });
    if (!req.valid.params.id) res.status(201);
    return out;
  });
}

async function verification(req, res) {
  return base.wrap(res, async () => author.getVerification({ userId: req.user.id }));
}

async function submitVerification(req, res) {
  return base.wrap(res, async () => {
    const out = await author.submitVerification({
      userId: req.user.id,
      kyc: req.valid.body.kyc,
      idFiles: idFilesOf(req),
    });
    res.status(201);
    return out;
  });
}

module.exports = {
  dashboard, books, overview, book, bookChaptersList, saveBookChapter, requestBookChange,
  characters, saveCharacter, deleteCharacter,
  plot, savePlot, bookChapters, contracts, applyContract, signContract, declineContract, applyCompletion,
  applyVip, chapterReviews, chapterEdits, bookEdits, launchKit, saveLaunchKit,
  verification, submitVerification,
};
