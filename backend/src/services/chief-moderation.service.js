'use strict';
// Chief moderation service: disputes + appeals + trust-&-safety filtered views.
// REUSES Dispute + Appeal from editorial.model.js (never redefined here).
//
// Honest-schema notes (documented choices):
// - escalatedReports = Dispute docs with status 'in_review' (escalation queue).
// - copyright-disputes = Dispute with category 'copyright';
//   plagiarism-cases = Dispute with category 'plagiarism'. Both rely on the
//   ADDITIVE Dispute.category field (defaults 'general', no migration).
// - escalate-legal keeps status 'in_review' and records the hand-off in
//   `resolution` (legal queue is external; Dispute enum has no legal state).
const { Dispute, Appeal } = require('../models/editorial.model');

function pg(query) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20)),
  };
}
async function paged(Model, filter, sort, query) {
  const { page, limit } = pg(query || {});
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort || { updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}
function notFound(what) {
  const e = new Error(what || 'not_found');
  e.status = 404;
  throw e;
}

async function disputesAppeals(query) {
  const [disputes, appeals, escalatedReports] = await Promise.all([
    paged(Dispute, {}, { updatedAt: -1 }, query),
    paged(Appeal, {}, { updatedAt: -1 }, query),
    Dispute.find({ status: 'in_review' }).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  return { disputes, appeals, escalatedReports };
}

async function listAppeals(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return paged(Appeal, filter, { updatedAt: -1 }, query);
}

// uphold -> 'upheld', overturn -> 'rejected', investigate -> 'in_review'.
// Appeal enum is open|in_review|upheld|rejected; decidedBy = acting chief.
async function decideAppeal({ id, decision, userId, note }) {
  const doc = await Appeal.findOne({id: id});
  if (!doc) notFound('appeal_not_found');
  const map = { uphold: 'upheld', overturn: 'rejected', investigate: 'in_review' };
  doc.status = map[decision];
  doc.decidedBy = userId;
  if (note) doc.detail = (doc.detail ? doc.detail + '\n' : '') + '[chief] ' + String(note).slice(0, 500);
  await doc.save();
  return doc.toJSON();
}

async function copyrightDisputes(query) {
  return paged(Dispute, { category: 'copyright' }, { updatedAt: -1 }, query);
}

async function resolveCopyrightDispute({ id, userId, resolution }) {
  const doc = await Dispute.findOne({id: id});
  if (!doc) notFound('dispute_not_found');
  doc.status = 'resolved';
  if (resolution) doc.resolution = String(resolution).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

async function plagiarismCases(query) {
  return paged(Dispute, { category: 'plagiarism' }, { updatedAt: -1 }, query);
}

// confirm -> resolved (action taken, note recorded); clear -> dismissed.
async function confirmPlagiarism({ id, userId, note }) {
  const doc = await Dispute.findOne({id: id});
  if (!doc) notFound('dispute_not_found');
  doc.status = 'resolved';
  doc.resolution = '[plagiarism confirmed] ' + String(note || 'action taken').slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}
async function clearPlagiarism({ id, userId, note }) {
  const doc = await Dispute.findOne({id: id});
  if (!doc) notFound('dispute_not_found');
  doc.status = 'dismissed';
  if (note) doc.resolution = String(note).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

async function escalatedReports(query) {
  return paged(Dispute, { status: 'in_review' }, { updatedAt: -1 }, query);
}

async function resolveEscalated({ id, userId, resolution }) {
  const doc = await Dispute.findOne({id: id});
  if (!doc) notFound('dispute_not_found');
  doc.status = 'resolved';
  if (resolution) doc.resolution = String(resolution).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

// Legal escalation: no 'legal' status exists in the Dispute enum, so the doc
// STAYS in_review and the hand-off is recorded in `resolution` (auditable,
// reversible). A future enum addition can migrate these via resolution prefix.
async function escalateLegal({ id, userId, note }) {
  const doc = await Dispute.findOne({id: id});
  if (!doc) notFound('dispute_not_found');
  doc.status = 'in_review';
  doc.resolution = '[escalated to legal] ' + String(note || '').slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

// Both models' terminal states, newest first, capped at 50.
async function resolutionHistory() {
  const [disputes, appeals] = await Promise.all([
    Dispute.find({ status: { $in: ['resolved', 'dismissed'] } }).sort({ updatedAt: -1 }).limit(50).lean(),
    Appeal.find({ status: { $in: ['upheld', 'rejected'] } }).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  const items = disputes.map(d => Object.assign({ kind: 'dispute' }, d))
    .concat(appeals.map(a => Object.assign({ kind: 'appeal' }, a)));
  items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return items.slice(0, 50);
}

module.exports = {
  disputesAppeals,
  listAppeals,
  decideAppeal,
  copyrightDisputes,
  resolveCopyrightDispute,
  plagiarismCases,
  confirmPlagiarism,
  clearPlagiarism,
  escalatedReports,
  resolveEscalated,
  escalateLegal,
  resolutionHistory,
};
