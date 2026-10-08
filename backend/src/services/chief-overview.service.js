'use strict';
// Chief overview service: dashboard aggregates, queue triage, performance.
//
// REAL numbers only — no invented metrics:
// - performance() aggregates AdStat impressions/clicks per day plus User
//   signups per day (User.createdAt) over the requested window.
// - Queue mapping: dispute -> Dispute, policy -> Appeal (appeals against
//   moderation/policy decisions), contract -> Contract (pending/sent).
const mongoose = require('mongoose');
const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const { Report, Dispute, Appeal } = require('../models/editorial.model');
const { Contract } = require('../models/contract.model');
const { AdStat, ActivityLog } = require('../models/platform.model');

const USER_ROLES = ['reader', 'writer', 'senior_editor', 'chief_editor', 'finance', 'admin'];
const QUEUE_TYPES = ['dispute', 'policy', 'contract'];

function bad(what, status) {
  const e = new Error(what || 'bad_request');
  e.status = status || 400;
  throw e;
}

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

// Slim counts: users by role, books by status, open reports, pending contracts.
async function stats() {
  const [roleCounts, bookGroups, usersTotal, booksTotal, reportsOpen, contractsPending] = await Promise.all([
    User.aggregate([{ $unwind: '$roles' }, { $match: { roles: { $in: USER_ROLES } } }, { $group: { _id: '$roles', n: { $sum: 1 } } }]),
    Book.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.countDocuments({}),
    Book.countDocuments({}),
    Report.countDocuments({ status: 'pending' }),
    Contract.countDocuments({ status: { $in: ['pending', 'sent'] } }),
  ]);
  const usersByRole = {};
  USER_ROLES.forEach((r) => { usersByRole[r] = 0; });
  roleCounts.forEach((r) => { usersByRole[r._id] = r.n; });
  const booksByStatus = {};
  bookGroups.forEach((g) => { booksByStatus[g._id || 'unknown'] = g.n; });
  return { usersByRole, usersTotal, booksByStatus, booksTotal, reportsOpen, contractsPending };
}

// Full dashboard: counts + queue depths + latest activity (top 5).
async function dashboard() {
  const [counts, disputesOpen, appealsOpen, policiesDraft, recentActivity] = await Promise.all([
    stats(),
    Dispute.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    Appeal.countDocuments({ status: { $in: ['open', 'in_review'] } }),
    Contract.countDocuments({ status: { $in: ['pending', 'sent'] } }),
    ActivityLog.find({}).sort({ at: -1 }).limit(5).lean(),
  ]);
  return {
    counts,
    queues: { disputesOpen, appealsOpen, contractsPending: policiesDraft },
    recentActivity,
  };
}

async function queues(type, query) {
  if (!QUEUE_TYPES.includes(type)) bad('bad_queue', 400);
  if (type === 'dispute') return paged(Dispute, { status: { $in: ['open', 'in_review'] } }, { updatedAt: -1 }, query);
  if (type === 'policy') return paged(Appeal, { status: { $in: ['open', 'in_review'] } }, { updatedAt: -1 }, query);
  return paged(Contract, { status: { $in: ['pending', 'sent'] } }, { updatedAt: -1 }, query);
}

// Per-type action mapping (throws 400 on inapplicable action):
// - dispute (open|in_review|resolved|dismissed): review->in_review, resolve->resolved, dismiss->dismissed.
// - policy/Appeal (open|in_review|upheld|rejected): review->in_review, approve->upheld, reject->rejected.
// - contract (…|approved|…|rejected|…): approve->approved, reject->rejected (no in_review state exists).
async function queueAction({ type, id, action, userId, note }) {
  if (!QUEUE_TYPES.includes(type)) bad('bad_queue', 400);
  const msg = note === undefined ? '' : String(note).slice(0, 1000);
  if (type === 'dispute') {
    const doc = await Dispute.findOne({id: id});
    if (!doc) bad('not_found', 404);
    if (action === 'review') doc.status = 'in_review';
    else if (action === 'resolve') doc.status = 'resolved';
    else if (action === 'dismiss') doc.status = 'dismissed';
    else bad('bad_action', 400);
    if (msg) doc.resolution = (doc.resolution ? doc.resolution + '\n' : '') + '[chief] ' + msg;
    await doc.save();
    return doc.toJSON();
  }
  if (type === 'policy') {
    const doc = await Appeal.findOne({id: id});
    if (!doc) bad('not_found', 404);
    if (action === 'review') doc.status = 'in_review';
    else if (action === 'approve') doc.status = 'upheld';
    else if (action === 'reject') doc.status = 'rejected';
    else bad('bad_action', 400);
    doc.decidedBy = userId;
    if (msg) doc.detail = (doc.detail ? doc.detail + '\n' : '') + '[chief] ' + msg;
    await doc.save();
    return doc.toJSON();
  }
  const doc = await Contract.findOne({id: id});
  if (!doc) bad('not_found', 404);
  if (action === 'approve') doc.status = 'approved';
  else if (action === 'reject') doc.status = 'rejected';
  else bad('bad_action', 400);
  if (msg) doc.replies.push({ from: String(userId), message: '[chief] ' + msg });
  await doc.save();
  return doc.toJSON();
}

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

async function performance(period) {
  const key = PERIOD_DAYS[period] ? period : '30d';
  const days = PERIOD_DAYS[key];
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  const dayFmt = { $dateToString: { format: '%Y-%m-%d', date: '$day' } };
  const signupFmt = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  const [ads, signups] = await Promise.all([
    AdStat.aggregate([
      { $match: { day: { $gte: from, $lte: to } } },
      { $group: { _id: dayFmt, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: signupFmt, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const byDay = {};
  ads.forEach((a) => { byDay[a._id] = { day: a._id, impressions: a.impressions, clicks: a.clicks, signups: 0 }; });
  signups.forEach((s) => {
    if (!byDay[s._id]) byDay[s._id] = { day: s._id, impressions: 0, clicks: 0, signups: 0 };
    byDay[s._id].signups = s.n;
  });
  const rows = Object.keys(byDay).sort().map((d) => byDay[d]);
  const totals = rows.reduce((acc, r) => ({
    impressions: acc.impressions + r.impressions,
    clicks: acc.clicks + r.clicks,
    signups: acc.signups + r.signups,
  }), { impressions: 0, clicks: 0, signups: 0 });
  return { period: key, days, from, to, totals, byDay: rows };
}

// Top senior editors by resolved reports (resolvedBy attribution on Report).
async function editorialTeam() {
  const rows = await Report.aggregate([
    { $match: { status: 'resolved', resolvedBy: { $ne: null } } },
    { $group: { _id: '$resolvedBy', resolved: { $sum: 1 } } },
    { $sort: { resolved: -1 } },
    { $limit: 10 },
  ]);
  const ids = rows.map((r) => r._id).filter((v) => typeof v === 'string' && v.length > 0);
  const users = await User.find({ id: { $in: ids } }).select('fullName username roles').lean();
  const byId = {};
  users.forEach((u) => { byId[String(u.id)] = u; });
  const items = rows.map((r) => {
    const u = byId[String(r._id)];
    return {
      userId: r._id,
      name: u ? (u.fullName || u.username) : String(r._id),
      username: u ? u.username : '',
      roles: u ? u.roles : [],
      resolved: r.resolved,
    };
  });
  return { items, total: items.length };
}

async function activity({ limit } = {}) {
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total] = await Promise.all([
    ActivityLog.find({}).sort({ at: -1 }).limit(lim).lean(),
    ActivityLog.countDocuments({}),
  ]);
  return { items, total, limit: lim };
}

module.exports = { stats, dashboard, queues, queueAction, performance, editorialTeam, activity };
