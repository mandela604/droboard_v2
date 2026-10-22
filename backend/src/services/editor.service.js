'use strict';
// Editor namespace backing editor/*.html pages.
// Generic resource engine + special cases. All demo-readable, backend-writable.
const { Book, Category, Genre } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Announcement } = require('../models/editorial.model');
const { Report } = require('../models/editorial.model');
const { AuthorVerification, ReviewSubmission, Contract: ContractModel } = require('../models/application.model');
const { Contract, ContractTemplate } = require('../models/contract.model');
const { Conversation, Message, Notification } = require('../models/social.model');
const { Withdrawal, Payout, AuthorTransaction } = require('../models/money.model');
const { Announcement: Ann2 } = require('../models/editorial.model');
const { PlatformSetting, AdInventory } = require('../models/platform.model');
const { Promo } = require('../models/editorial.model');

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

async function stats() {
  const [books, pendingReviews, authors, reports] = await Promise.all([
    Book.countDocuments(),
    ReviewSubmission.countDocuments({ status: 'pending' }),
    User.countDocuments({ roles: 'writer' }),
    Report.countDocuments({ status: 'pending' }),
  ]);
  return { books, pendingReviews, authors, reports };
}

async function activity({ limit }) {
  const logs = await require('../models/user.model').AuditLog
    .find({}).sort({ at: -1 }).limit(Math.min(50, parseInt(limit, 10) || 20)).lean();
  return logs;
}

async function logs(query) {
  return paged(require('../models/user.model').AuditLog,
    searchFilter(query.q, ['action', 'entity', 'actorId']), { at: -1 }, query);
}

// Generic resource factory: list/get/create/update/delete + approve/reject.
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

// categories-genres-service.js — one read for the whole catalog page.
async function categoriesGenres(query) {
  const [cats, genres] = await Promise.all([
    Category.find({}).sort({ updatedAt: -1 }).lean(),
    Genre.find({}).sort({ updatedAt: -1 }).lean(),
  ]);
  const catName = new Map(cats.map(c => [c.id, c.name]));
  const genreCount = {};
  for (const g of genres) genreCount[g.categoryId] = (genreCount[g.categoryId] || 0) + 1;
  return {
    categories: cats.map(c => ({
      id: c.id, name: c.name, icon: c.icon || '', bg: c.bg || '', color: c.color || '',
      desc: c.desc || '', genres: genreCount[c.id] || 0, books: c.booksCount || 0,
      status: c.status,
    })),
    genres: genres.map(g => ({
      id: g.id, name: g.name, cat: catName.get(g.categoryId) || '', icon: g.icon || '',
      bg: g.bg || '', color: g.color || '', books: g.booksCount || 0, status: g.status,
    })),
  };
}

// contract-templates-service.js — same shape as senior /contract-templates.
async function contractTemplates(query) {
  const { items, total, page, limit } =
    await paged(ContractTemplate, {}, { updatedAt: -1 }, query || {});
  const { User: UserM } = require('../models/user.model');
  const users = await UserM.find({ id: { $in: items.map(t => t.updatedBy).filter(Boolean) } })
    .select('id fullName username avatar').lean();
  const byId = new Map(users.map(u => [String(u.id), u.fullName || u.username || '']));
  return {
    items: items.map(t => ({
      id: t.id,
      name: t.name,
      desc: t.desc || '',
      type: t.type,
      status: t.status,
      clauses: t.clauses || 0,
      preview: t.preview || { title: '', body: '' },
      updated: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
      by: byId.get(String(t.updatedBy)) || t.updatedBy || '',
    })),
    total, page, limit,
  };
}

const R = {
  announcements: () => resource(Announcement, { searchFields: ['title', 'content'] }),
  messages: () => resource(Conversation, {}),
  verifications: () => resource(AuthorVerification, {}),
  authors: () => resource(User, {}),
  books: () => resource(Book, {}),
  reviews: () => resource(ReviewSubmission, {}),
  categories: () => resource(Category, {}),
  genres: () => resource(Genre, {}),
  templates: () => resource(ContractTemplate, {}),
  contracts: () => resource(Contract, {}),
  banners: () => resource(AdInventory, {}),
  payments: () => resource(Payout, {}),
  settings: () => resource(PlatformSetting, {}),
  promotions: () => resource(Promo, {}),
  reports: () => resource(Report, {}),
  withdrawals: () => resource(Withdrawal, {}),
};

module.exports = { pg, paged, searchFilter, stats, activity, logs, resource, R,
  categoriesGenres, contractTemplates };
