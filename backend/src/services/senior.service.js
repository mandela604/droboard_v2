'use strict';
// Senior-editor namespace backing senior-editor/services/* callBackend paths.
// Generic resource engine + special flows (review accept, contract sign).
const { Book } = require('../models/content.model');
const { User } = require('../models/user.model');
const { ReviewSubmission, AuthorVerification, CompletionApplication } = require('../models/application.model');
const { InviteCode, ChapterEdit, BookEdit } = require('../models/application.model');
const { Contract } = require('../models/contract.model');
const { Report } = require('../models/editorial.model');
const { Conversation } = require('../models/social.model');
const { AuditLog } = require('../models/user.model');

function pg(query) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20)),
  };
}
async function paged(Model, filter, sort, query) {
  const { page, limit } = pg(query);
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort || { updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}
function searchFilter(q, fields) {
  if (!q) return {};
  const rx = { $regex: String(q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return { $or: fields.map(f => ({ [f]: rx })) };
}

// Generic resource factory.
function resource(Model, opts) {
  opts = opts || {};
  return {
    async list(query) {
      const filter = Object.assign({}, opts.baseFilter);
      if (query.status && opts.statusField) filter[opts.statusField] = query.status;
      if (query.q && opts.searchFields) Object.assign(filter, searchFilter(query.q, opts.searchFields));
      return paged(Model, filter, { updatedAt: -1 }, query);
    },
    async get(id) {
      const doc = await Model.findOne({id: id}).lean();
      if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
      return doc;
    },
    async create(data) {
      const doc = await Model.create(data);
      return doc.toJSON();
    },
    async update(id, data) {
      const doc = await Model.findOne({id: id});
      if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
      Object.assign(doc, data);
      await doc.save();
      return doc.toJSON();
    },
    async remove(id) {
      await Model.deleteOne({ id: id });
      return { ok: true };
    },
    async setStatus(id, status) {
      const doc = await Model.findOne({id: id});
      if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
      doc.status = status;
      await doc.save();
      return doc.toJSON();
    },
  };
}

// Menu-backed resources ONLY (mirrors senior-editor sidebar — 13 items).
// Anything not reachable from the menu has no endpoint here.
const R = {
  stories: () => resource(Book, { searchFields: ['title', 'genre'] }),
  authors: () => resource(User, {}),
  reports: () => resource(Report, {}),
  messages: () => resource(Conversation, {}),
  contracts: () => resource(Contract, {}),
  completions: () => resource(CompletionApplication, {}),
  chapterEdits: () => resource(ChapterEdit, {}),
  bookEdits: () => resource(BookEdit, {}),
  reviews: () => resource(ReviewSubmission, {}),
  verifications: () => resource(AuthorVerification, {}),
  invites: () => resource(InviteCode, {}),
};

async function dashboard() {
  const [pendingReviews, pendingContracts, pendingReports] = await Promise.all([
    ReviewSubmission.countDocuments({ status: 'pending' }),
    Contract.countDocuments({ status: { $in: ['pending', 'sent', 'approved'] } }),
    Report.countDocuments({ status: 'pending' }),
  ]);
  return { pendingReviews, pendingContracts, activeReports: pendingReports };
}

// Edit proposals: approve APPLIES the proposed content (the only time an
// author edit takes effect on live books/chapters). Reject leaves live untouched.
async function approveChapterEdit(id, reviewerId) {
  const proposal = await ChapterEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  const chapters = require('./chapters.service');
  return chapters.applyChapterProposal({ proposal, reviewerId });
}

async function rejectChapterEdit(id, reviewerId, note) {
  const proposal = await ChapterEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (proposal.status !== 'pending') { const e = new Error('not_pending'); e.status = 409; throw e; }
  proposal.status = 'rejected';
  proposal.reviewerId = reviewerId || null;
  proposal.reviewNote = String(note || '').slice(0, 2000);
  proposal.decidedAt = new Date();
  await proposal.save();
  return proposal.toJSON();
}

async function approveBookEdit(id, reviewerId) {
  const proposal = await BookEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  const books = require('./books.service');
  return books.applyBookProposal({ proposal, reviewerId });
}

async function rejectBookEdit(id, reviewerId, note) {
  const proposal = await BookEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (proposal.status !== 'pending') { const e = new Error('not_pending'); e.status = 409; throw e; }
  proposal.status = 'rejected';
  proposal.reviewerId = reviewerId || null;
  proposal.reviewNote = String(note || '').slice(0, 2000);
  proposal.decidedAt = new Date();
  await proposal.save();
  return proposal.toJSON();
}

async function activity(query) {
  return paged(AuditLog, searchFilter(query.q, ['action', 'entity', 'actorId']), { at: -1 }, query);
}

module.exports = { pg, paged, searchFilter, resource, R, dashboard, activity, approveChapterEdit, rejectChapterEdit, approveBookEdit, rejectBookEdit };
