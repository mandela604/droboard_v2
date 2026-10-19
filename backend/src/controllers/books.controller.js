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

async function createBatch(req, res) {
  return base.wrap(res, async () => {
    // Chapter pricing is staff territory (admin/editor module) — not the wizard.
    const list = req.valid.body.chapters || [];
    if (!books.isStaff(req.user) && list.some(c => c && c.price !== undefined)) {
      const e = new Error('price_staff_only'); e.status = 403; throw e;
    }
    const out = await books.createBookWithChapters({
      authorId: req.user.id,
      book: req.valid.body.book,
      chapters: req.valid.body.chapters,
    });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => books.listBooks(Object.assign({}, req.valid.query, {
    viewer: req.user ? { roles: req.user.roles } : null,
  })));
}

async function get(req, res) {
  return base.wrap(res, async () => {
    const book = await books.getBook(req.valid.params.id);
    // Public reads show ONLY approved/live books (staff preview via /api/chief).
    if (!books.VISIBLE_BOOK_STATUS.includes(book.status)) { const e = new Error('not_found'); e.status = 404; throw e; }
    return book;
  });
}

async function detail(req, res) {
  return base.wrap(res, async () => {
    const out = await books.getBookDetail(req.valid.params.id);
    if (!books.VISIBLE_BOOK_STATUS.includes(out.status)) { const e = new Error('not_found'); e.status = 404; throw e; }
    return out;
  });
}

async function update(req, res) {
  return base.wrap(res, async () => {
    // Mutations are id-only (never slug).
    const book = await books.loadBookById(req.valid.params.id);
    if (!books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    const body = req.valid.body || {};
    const wantsContent = books.BOOK_CONTENT_FIELDS.some(k => body[k] !== undefined);
    const wantsPublish = body.status !== undefined && books.VISIBLE_BOOK_STATUS.includes(body.status);
    // Author editing live content OR asking to publish → proposal for editor
    // approval (202, nothing applied). Every submitted book appears on the
    // platform only after approve. Staff, drafts, and non-visible workflow
    // states (e.g. submit draft→under_review) apply directly.
    if (!books.isStaff(req.user) && (wantsPublish || (wantsContent && books.bookNeedsProposal(book)))) {
      const proposal = await books.proposeBookEdit({ book, authorId: req.user.id, data: body });
      res.status(202);
      return { applied: false, proposal };
    }
    return books.updateBook({ book, data: body });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const book = await books.loadBookById(req.valid.params.id);
    if (!books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return books.deleteBook({ book });
  });
}

module.exports = { create, createBatch, list, get, detail, update, remove };
