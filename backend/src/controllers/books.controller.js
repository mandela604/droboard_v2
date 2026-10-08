'use strict';
const books = require('../services/books.service');
const base = require('./base.controller');

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await books.createBook({ authorId: req.user.id, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => books.listBooks(req.valid.query));
}

async function get(req, res) {
  return base.wrap(res, async () => books.getBook(req.valid.params.id));
}

async function detail(req, res) {
  return base.wrap(res, async () => books.getBookDetail(req.valid.params.id));
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const book = await books.loadBookOr404(req.valid.params.id);
    if (!books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return books.updateBook({ book, data: req.valid.body });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const book = await books.loadBookOr404(req.valid.params.id);
    if (!books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return books.deleteBook({ book });
  });
}

module.exports = { create, list, get, detail, update, remove };
