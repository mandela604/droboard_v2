'use strict';
const chapters = require('../services/chapters.service');
const base = require('./base.controller');

async function loadBook(req) {
  const book = await chapters.books.loadBookOr404(req.valid.params.id);
  if (!chapters.books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
  return book;
}

async function create(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    const out = await chapters.createChapter({ bookId: book.id, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => {
    const book = await chapters.books.loadBookOr404(req.valid.params.id);
    return chapters.listChapters({ bookId: book.id });
  });
}

async function get(req, res) {
  return base.wrap(res, async () => {
    const book = await chapters.books.loadBookOr404(req.valid.params.id);
    return chapters.getChapter({ bookId: book.id, key: req.valid.params.key });
  });
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    const ch = await chapters.loadChapterOr404(book.id, req.valid.params.key);
    return chapters.updateChapter({ ch, data: req.valid.body });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    const ch = await chapters.loadChapterOr404(book.id, req.valid.params.key);
    return chapters.deleteChapter({ ch });
  });
}

module.exports = { create, list, get, update, remove };
