'use strict';
// Author namespace backing author/*.html pages.
// Contracts mirror services/author/*-service.js USE_API declarations:
//   GET /dashboard, /books, /books/:id/overview, /books/:id/characters (CRUD),
//   /books/:id/plot, /books/:bookId/chapters/:num, /contracts, /completion,
//   /vip, /launch-kit, /chapter-reviews
const { Book, Chapter, Character, Plot } = require('../models/content.model');
const {
  ContractApplication, CompletionApplication, VipApplication,
  ChapterReviewRequest,
} = require('../models/application.model');
const { LaunchCampaign } = require('../models/editorial.model');
const { Contract } = require('../models/contract.model');

async function dashboard({ userId }) {
  const [books, contracts] = await Promise.all([
    Book.countDocuments({ authorId: userId }),
    Contract.countDocuments({ authorId: userId }),
  ]);
  const reads = await Book.aggregate([
    { $match: { authorId: userId } },
    { $group: { _id: null, t: { $sum: '$reads' } } },
  ]);
  return {
    stats: {
      books, contracts,
      reads: reads[0] ? reads[0].t : 0,
      pendingReviews: 0,
    },
  };
}

async function books({ userId }) {
  return Book.find({ authorId: userId }).sort({ updatedAt: -1 }).lean();
}

/* single own book + own chapter list/save (book-workspace, edit-chapter) */
async function getBook({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId }).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

async function listChapters({ userId, bookId, page, limit }) {
  const book = await ownBook({ userId, bookId });
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const [items, total] = await Promise.all([
    Chapter.find({ bookId: book.id }).sort({ n: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Chapter.countDocuments({ bookId: book.id }),
  ]);
  return { items, total, page: pg, limit: lim };
}

async function saveBookChapter({ userId, bookId, num, data }) {
  const book = await ownBook({ userId, bookId });
  const n = parseInt(num, 10);
  if (!Number.isInteger(n) || n < 1) { const e = new Error('bad_num'); e.status = 400; throw e; }
  const ch = await Chapter.findOne({ bookId: book.id, n });
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  const chapters = require('./chapters.service');
  return chapters.updateChapter({ ch, data });
}

/* book change request: persists a pending BookEdit proposal for editors */
async function requestBookChange({ userId, bookId, changes, details, order }) {
  const book = await ownBook({ userId, bookId });
  const list = Array.isArray(changes) ? changes.map(String).slice(0, 12) : [];
  if (!list.length && !(order && order.length)) { const e = new Error('empty_request'); e.status = 400; throw e; }
  const { BookEdit } = require('../models/application.model');
  const proposed = { changes: list };
  if (details) proposed.details = String(details).slice(0, 2000);
  if (order) proposed.order = order.map(String).slice(0, 500);
  const doc = await BookEdit.create({ bookId: book.id, authorId: userId, proposed, status: 'pending' });
  return { applied: false, proposal: doc.toJSON() };
}

async function overview({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId }).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  const chapters = await Chapter.countDocuments({ bookId: book.id });
  return {
    stats: { reads: book.reads || 0, likes: book.likes || 0, chapters },
    activity: [],
    quickActions: ['New Chapter', 'Plotting', 'Characters'],
  };
}

async function ownBook({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId });
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

async function listCharacters({ book }) {
  return Character.find({ bookId: book.id }).lean();
}

async function saveCharacter({ book, data, id }) {
  const { validateMediaUrl } = require('./media.service');
  if (data.avatar !== undefined) data.avatar = validateMediaUrl(data.avatar, 'avatar');
  if (id) {
    const c = await Character.findOne({ id, bookId: book.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    ['name', 'role', 'avatar', 'meta', 'bio', 'arc', 'traits'].forEach(k => {
      if (data[k] !== undefined) c[k] = data[k];
    });
    await c.save();
    return c.toJSON();
  }
  const c = await Character.create(Object.assign({}, data, { bookId: book.id }));
  return c.toJSON();
}

async function deleteCharacter({ book, id }) {
  await Character.deleteOne({ id, bookId: book.id });
  return { ok: true };
}

async function getPlot({ book }) {
  let plot = await Plot.findOne({ bookId: book.id }).lean();
  if (!plot) plot = { bookId: book.id, acts: [], roadmap: [] };
  return plot;
}

async function savePlot({ book, data }) {
  const plot = await Plot.findOneAndUpdate(
    { bookId: book.id },
    { acts: data.acts || [], roadmap: data.roadmap || [] },
    { upsert: true, new: true }
  ).lean();
  return plot;
}

async function listContracts({ userId }) {
  return ContractApplication.find({ authorId: userId }).sort({ createdAt: -1 }).lean();
}

async function applyContract({ userId, bookId, data }) {
  const c = await ContractApplication.create(Object.assign({}, data, { bookId, authorId: userId, status: 'applied' }));
  await Book.updateOne({ id: bookId, authorId: userId }, { contractStatus: 'applied' });
  return c.toJSON();
}

async function applyCompletion({ userId, bookId, data }) {
  const c = await CompletionApplication.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

async function applyVip({ userId, bookId, data }) {
  const c = await VipApplication.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

async function submitChapterReview({ userId, bookId, data }) {
  const c = await ChapterReviewRequest.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

// Author's own edit proposals (pending/approved/rejected) per book.
async function listChapterEdits({ userId, bookId }) {
  await ownBook({ userId, bookId });
  const { ChapterEdit } = require('../models/application.model');
  return ChapterEdit.find({ bookId, authorId: userId }).sort({ createdAt: -1 }).lean();
}

async function listBookEdits({ userId, bookId }) {
  await ownBook({ userId, bookId });
  const { BookEdit } = require('../models/application.model');
  return BookEdit.find({ bookId, authorId: userId }).sort({ createdAt: -1 }).lean();
}

async function launchKit({ userId }) {
  const list = await LaunchCampaign.find({ writerId: userId }).sort({ createdAt: -1 }).lean();
  return list;
}

async function saveLaunchKit({ userId, data, id }) {
  if (id) {
    const c = await LaunchCampaign.findOne({ id, writerId: userId });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    Object.assign(c, data);
    await c.save();
    return c.toJSON();
  }
  const c = await LaunchCampaign.create(Object.assign({}, data, { writerId: userId }));
  return c.toJSON();
}

module.exports = {
  dashboard, books, overview, ownBook, getBook, listChapters, saveBookChapter, requestBookChange,
  listCharacters, saveCharacter, deleteCharacter,
  getPlot, savePlot,
  listContracts, applyContract, applyCompletion, applyVip,
  submitChapterReview,
  listChapterEdits, listBookEdits,
  launchKit, saveLaunchKit,
};
