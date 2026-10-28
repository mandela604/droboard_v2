'use strict';
// Chief story-reports service: list + triage over editorial.model Report.
// Pagination envelope mirrors posts.service ({ items, total, page, limit }).
const { Report } = require('../models/editorial.model');
const { hydrateReports } = require('./report-hydrate.service');

function notFound() {
  const e = new Error('not_found');
  e.status = 404;
  throw e;
}

async function loadOr404(id) {
  const doc = await Report.findOne({id: id});
  if (!doc) notFound();
  return doc;
}

function escRx(s) {
  return String(s || '').slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listReports({ q, type, status, severity, seId, page, limit }) {
  const and = [];
  if (seId) and.push({ seId });
  if (q) {
    const rx = new RegExp(escRx(q), 'i');
    and.push({ $or: [{ title: rx }, { desc: rx }, { reporterLabel: rx }] });
  }
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (and.length) filter.$and = and;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ filedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Report.countDocuments(filter),
  ]);
  return { items: await hydrateReports(items), total, page: pg, limit: lim };
}

function scopeFor(seId) {
  return seId ? { seId } : {};
}

async function stats({ seId } = {}) {
  const scope = scopeFor(seId);
  const [total, pending, resolved, dismissed, byType] = await Promise.all([
    Report.countDocuments(scope),
    Report.countDocuments(Object.assign({}, scope, { status: 'pending' })),
    Report.countDocuments(Object.assign({}, scope, { status: 'resolved' })),
    Report.countDocuments(Object.assign({}, scope, { status: 'dismissed' })),
    Report.aggregate([{ $match: scope }, { $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  return { total, pending, resolved, dismissed, byType };
}

async function getReport(id) {
  const doc = await Report.findOne({id: id}).lean();
  if (!doc) notFound();
  return doc;
}

async function resolve({ id, userId, note }) {
  const doc = await loadOr404(id);
  doc.status = 'resolved';
  doc.resolvedBy = userId;
  if (note !== undefined) doc.resolutionNote = String(note).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

async function dismiss({ id, userId, note }) {
  const doc = await loadOr404(id);
  doc.status = 'dismissed';
  doc.resolvedBy = userId;
  if (note !== undefined) doc.resolutionNote = String(note).slice(0, 1000);
  await doc.save();
  return doc.toJSON();
}

async function reopen({ id }) {
  const doc = await loadOr404(id);
  doc.status = 'pending';
  doc.resolvedBy = null;
  await doc.save();
  return doc.toJSON();
}

module.exports = { loadOr404, listReports, stats, getReport, resolve, dismiss, reopen };
