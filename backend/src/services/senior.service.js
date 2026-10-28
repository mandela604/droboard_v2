'use strict';
// Senior-editor namespace backing senior-editor/services/* callBackend paths.
// Generic resource engine + special flows (review accept, contract sign).
const { Book } = require('../models/content.model');
const { User } = require('../models/user.model');
const { ReviewSubmission, AuthorVerification, CompletionApplication } = require('../models/application.model');
const { InviteCode, ChapterEdit, BookEdit } = require('../models/application.model');
const { Contract } = require('../models/contract.model');
const { Report } = require('../models/editorial.model');
const { hydrateReports } = require('./report-hydrate.service');
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
  // Direct fetches carry the same ownership filter as list() so a scoped editor
  // cannot read/decide another editor's author's row by guessing the id.
  // $and keeps an `id` ownership clause from clobbering the id lookup.
  function guard(id) {
    const bf = opts.baseFilter;
    if (!bf || !Object.keys(bf).length) return { id: id };
    return { $and: [{ id: id }, bf] };
  }
  return {
    async list(query) {
      const filter = Object.assign({}, opts.baseFilter);
      if (query.status && opts.statusField) filter[opts.statusField] = query.status;
      if (query.q && opts.searchFields) Object.assign(filter, searchFilter(query.q, opts.searchFields));
      const out = await paged(Model, filter, { updatedAt: -1 }, query);
      // Optional row decorator (e.g. Reports need story/author/SE joins).
      if (opts.decorate) out.items = await opts.decorate(out.items);
      return out;
    },
    async get(id) {
      const doc = await Model.findOne(guard(id)).lean();
      if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
      return doc;
    },
    async create(data) {
      const doc = await Model.create(data);
      return doc.toJSON();
    },
    async update(id, data) {
      const doc = await Model.findOne(guard(id));
      if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
      Object.assign(doc, data);
      await doc.save();
      return doc.toJSON();
    },
    async remove(id) {
      const n = await Model.deleteOne(guard(id));
      if (!n.deletedCount) { const e = new Error('not_found'); e.status = 404; throw e; }
      return { ok: true };
    },
    async setStatus(id, status) {
      const doc = await Model.findOne(guard(id));
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
  stories: () => resource(Book, { baseFilter: open('books'), searchFields: ['title', 'genre'] }),
  authors: () => resource(User, {}),
  reports: () => resource(Report, { decorate: hydrateReports }),
  messages: () => resource(Conversation, {}),
  contracts: () => resource(Contract, {}),
  completions: () => resource(CompletionApplication, {}),
  chapterEdits: () => resource(ChapterEdit, {}),
  bookEdits: () => resource(BookEdit, {}),
  reviews: () => resource(ReviewSubmission, {}),
  verifications: () => resource(AuthorVerification, {}),
  invites: () => resource(InviteCode, {}),
};

// ── Author-ownership scoping ───────────────────────────────────────────────
// A senior_editor only sees work belonging to THEIR assigned authors
// (EditorAssignment.authorIds). chief_editor/admin bypass — they see everything.
// Book management / reports / messages are intentionally NOT scoped: those are
// platform-level queues, not per-author work.
const { EditorAssignment } = require('../models/chief.model');
// resource-name → Mongo field holding the owning author ('' = the resource IS User)
const OWNED = {
  authors: '',
  books: 'authorId',
  reviews: 'authorId',
  chapterEdits: 'authorId',
  bookEdits: 'authorId',
  completions: 'authorId',
};

// null ⇒ unscoped (chief/admin); [] ⇒ senior_editor with nobody assigned.
async function scopeAuthorIds(user) {
  const roles = (user && user.roles) || [];
  if (roles.includes('chief_editor') || roles.includes('admin')) return null;
  if (!roles.includes('senior_editor')) return [];
  const asg = await EditorAssignment.findOne({ editorId: String(user.id) }).lean();
  return (asg && asg.authorIds ? asg.authorIds : []).map(String);
}

// Write-path ownership check. 404 (not 403) so an editor can't probe for the
// existence of another editor's author's rows. Pass user=null to skip (system).
async function assertOwned(user, authorId) {
  if (!user) return;
  const ids = await scopeAuthorIds(user);
  if (ids === null) return;
  if (!ids.includes(String(authorId))) {
    const e = new Error('not_found'); e.status = 404; throw e;
  }
}

// Per-request resource map. Ownership filter lands in baseFilter, so list()'s
// status/query clauses merge on top of it (Object.assign) rather than replace it.
async function scopedResources(user) {
  const ids = await scopeAuthorIds(user);
  const owned = function (field) {
    if (ids === null) return {};                                  // unscoped
    return field === '' ? { id: { $in: ids } } : { [field]: { $in: ids } };
  };
  const open = function (field) {
    return OWNED[field] === undefined ? {} : owned(OWNED[field]);
  };
  return {
    stories: () => resource(Book, { baseFilter: open('books'), searchFields: ['title', 'genre'] }),
    authors: () => resource(User, { baseFilter: open('authors'), searchFields: ['fullName', 'username', 'email'] }),
    reports: () => resource(Report, { baseFilter: ids === null ? {} : { seId: String(user.id) }, decorate: hydrateReports }),
    // Inbox: only threads the editor is actually a participant in.
    messages: () => resource(Conversation, { baseFilter: ids === null ? {} : { participants: String(user.id) } }),
    // Offers on their authors' books, plus anything they sent themselves.
    contracts: () => resource(Contract, { baseFilter: ids === null ? {} : { $or: [{ authorId: { $in: ids } }, { editorId: String(user.id) }] } }),
    completions: () => resource(CompletionApplication, { baseFilter: open('completions') }),
    chapterEdits: () => resource(ChapterEdit, { baseFilter: open('chapterEdits') }),
    bookEdits: () => resource(BookEdit, { baseFilter: open('bookEdits') }),
    reviews: () => resource(ReviewSubmission, { baseFilter: open('reviews') }),
    verifications: () => resource(AuthorVerification, {}),
    invites: () => resource(InviteCode, {}),
  };
}

async function dashboard(user) {
  // Pending-review count is scoped to the requesting editor's own authors;
  // contracts/reports stay platform-wide (shared queues).
  const ids = await scopeAuthorIds(user);
  const pendingFilter = ids === null
    ? { status: 'pending' }
    : { status: 'pending', authorId: { $in: ids } };
  const [pendingReviews, pendingContracts, pendingReports] = await Promise.all([
    ReviewSubmission.countDocuments(pendingFilter),
    Contract.countDocuments({ status: { $in: ['pending', 'sent', 'approved'] } }),
    Report.countDocuments({ status: 'pending' }),
  ]);
  return { pendingReviews, pendingContracts, activeReports: pendingReports };
}

// Edit proposals: approve APPLIES the proposed content (the only time an
// author edit takes effect on live books/chapters). Reject leaves live untouched.
// `actor` (the logged-in editor) gates ownership — pass null for system calls.
async function approveChapterEdit(id, reviewerId, actor) {
  const proposal = await ChapterEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  await assertOwned(actor, proposal.authorId);
  const chapters = require('./chapters.service');
  return chapters.applyChapterProposal({ proposal, reviewerId });
}

async function rejectChapterEdit(id, reviewerId, note, actor) {
  const proposal = await ChapterEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  await assertOwned(actor, proposal.authorId);
  if (proposal.status !== 'pending') { const e = new Error('not_pending'); e.status = 409; throw e; }
  proposal.status = 'rejected';
  proposal.reviewerId = reviewerId || null;
  proposal.reviewNote = String(note || '').slice(0, 2000);
  proposal.decidedAt = new Date();
  await proposal.save();
  return proposal.toJSON();
}

async function approveBookEdit(id, reviewerId, actor) {
  const proposal = await BookEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  await assertOwned(actor, proposal.authorId);
  const books = require('./books.service');
  return books.applyBookProposal({ proposal, reviewerId });
}

async function rejectBookEdit(id, reviewerId, note, actor) {
  const proposal = await BookEdit.findOne({ id });
  if (!proposal) { const e = new Error('not_found'); e.status = 404; throw e; }
  await assertOwned(actor, proposal.authorId);
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

// ── Invite-authors page ────────────────────────────────────────────────────
// The editor's own authors (EditorAssignment.authorIds), annotated with the
// code they can share + how they got here: 'invite' (signed up with this
// editor's code/link) vs 'assigned' (chief placed them here).
async function myAuthors(user, query) {
  const ids = await scopeAuthorIds(user); // null ⇒ chief/admin ⇒ platform-wide
  const filter = { roles: 'writer' };
  if (ids !== null) filter.id = { $in: ids };
  if (query && query.q) Object.assign(filter, searchFilter(query.q, ['fullName', 'username', 'email']));

  const { page, limit } = pg(query);
  const [docs, total, me] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
    // Own code + _id (referredByUserId stores the inviter's _id, not custom id)
    ids === null ? null : User.findOne({ id: String(user.id) }).select('editorInviteCode _id').lean(),
  ]);

  const code = (me && me.editorInviteCode) || '';
  const myOid = me ? String(me._id) : null;
  const items = docs.map(u => ({
    id: u.id, name: u.fullName || u.username || '', username: u.username || '',
    email: u.email || '', avatar: u.avatar || '',
    code: code,
    via: myOid && String(u.referredByUserId || '') === myOid ? 'invite' : 'assigned',
    signedUp: u.createdAt || null,
    status: u.status || 'active',
  }));
  return { items, total, page, limit, code };
}

// Reports are not a generic approve/reject resource: Report.status only accepts
// pending|resolved|dismissed, so a decision must carry the note and resolvedBy.
// Senior editors can only decide rows attributed to them; chief/admin decide any.
async function decideReport(user, id, status, note) {
  const roles = (user && user.roles) || [];
  const wide = roles.includes('chief_editor') || roles.includes('admin');
  const filter = wide ? { id } : { id, seId: String(user.id) };
  const doc = await Report.findOne(filter);
  if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
  doc.status = status;
  doc.resolvedBy = String(user.id);
  if (note !== undefined && note !== null) doc.resolutionNote = String(note).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

module.exports = {
  pg, paged, searchFilter, resource, R, scopedResources, scopeAuthorIds, assertOwned,
  dashboard, activity, myAuthors, approveChapterEdit, rejectChapterEdit, approveBookEdit, rejectBookEdit,
  decideReport,
};
