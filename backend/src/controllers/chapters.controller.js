'use strict';
const chapters = require('../services/chapters.service');
const base = require('./base.controller');

async function loadBook(req) {
  // Mutations are id-only (never slug).
  const book = await chapters.books.loadBookById(req.valid.params.id);
  if (!chapters.books.canWrite(book, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
  return book;
}

function denyPriceForNonStaff(req) {
  // Pricing is platform territory (admin/editor module) — authors can't set it.
  if (req.valid.body && req.valid.body.price !== undefined && !chapters.books.isStaff(req.user)) {
    const e = new Error('price_staff_only'); e.status = 403; throw e;
  }
}

async function create(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    denyPriceForNonStaff(req);
    const out = await chapters.createChapter({ bookId: book.id, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => {
    const book = await chapters.books.loadBookOr404(req.valid.params.id);
    // Public list shows ONLY live chapters. Author preview lives under /api/author.
    return chapters.listChapters({ bookId: book.id, onlyLive: true });
  });
}

async function get(req, res) {
  return base.wrap(res, async () => {
    const book = await chapters.books.loadBookOr404(req.valid.params.id);
    return chapters.getChapter({ bookId: book.id, key: req.valid.params.key, onlyLive: true });
  });
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    denyPriceForNonStaff(req);
    const ch = await chapters.loadChapterOr404(book.id, req.valid.params.key);
    const body = req.valid.body || {};
    const wantsContent = chapters.CHAPTER_CONTENT_FIELDS.some(k => body[k] !== undefined);
    const wantsPublish = body.status !== undefined && chapters.PUBLISH_CHAPTER_STATUS.includes(body.status);
    // YES — PATCH is the chapter edit endpoint. Author saving content edits on
    // live chapters, or asking to publish/schedule, files a proposal for editor
    // approve/reject (202, nothing applied until approve). Staff, drafts and
    // pipeline chapters, and workflow-only saves (e.g. submit for review)
    // apply directly.
    if (!chapters.books.isStaff(req.user) && (wantsPublish || (wantsContent && chapters.chapterNeedsProposal(ch)))) {
      const proposal = await chapters.proposeChapterEdit({ book, ch, authorId: req.user.id, data: body });
      res.status(202);
      return { applied: false, proposal };
    }
    return chapters.updateChapter({ ch, data: body });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    const ch = await chapters.loadChapterOr404(book.id, req.valid.params.key);
    return chapters.deleteChapter({ ch });
  });
}

async function reorder(req, res) {
  return base.wrap(res, async () => {
    const book = await loadBook(req);
    return chapters.reorderChapters({ bookId: book.id, order: req.valid.body.order });
  });
}

module.exports = { create, list, get, update, remove, reorder };
