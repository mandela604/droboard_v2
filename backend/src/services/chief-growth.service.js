'use strict';
// Chief growth service: partnerships, strategy, policies, chief profile/sessions.
// REUSES User + RefreshFamily from user.model.js (never redefined here).
//
// Notes:
// - EditorialStrategy is a singleton doc with key 'current'. Marketing seeds
//   it; every reader below returns {} shapes (never 404) when it is missing.
// - Policy.version++ on every update; a PolicyHistory snapshot of the OLD
//   version is written before save.
// - sessions()/revokeOthers() mirror auth.service logout: the live family is
//   identified by verifying the refresh JWT (same secret) or by an explicit
//   familyId passthrough (refresh cookie is path-scoped to /api/auth and may
//   not accompany /api/chief calls).
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, RefreshFamily } = require('../models/user.model');
const { Policy, PolicyHistory, Partnership, PartnershipRequest, EditorialStrategy } = require('../models/chief.model');

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

// ---- partnerships ----
async function listPartnerships(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return paged(Partnership, filter, { updatedAt: -1 }, query);
}
async function listPartnershipsByKind(kind, query) {
  return paged(Partnership, { kind }, { updatedAt: -1 }, query);
}
async function listPartnershipRequests(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return paged(PartnershipRequest, filter, { updatedAt: -1 }, query);
}
async function decideRequest({ id, decision }) {
  const doc = await PartnershipRequest.findOne({id: id});
  if (!doc) notFound('request_not_found');
  doc.status = decision === 'approve' ? 'approved' : 'declined';
  await doc.save();
  return doc.toJSON();
}

// ---- strategy (singleton key='current'; {} shapes when unseeded) ----
async function currentStrategy() {
  return EditorialStrategy.findOne({ key: 'current' }).lean();
}
async function getStrategy() {
  return (await currentStrategy()) || {};
}
async function strategySlice(field) {
  const doc = await currentStrategy();
  if (!doc) return {};
  const out = {};
  out[field] = doc[field] !== undefined ? doc[field] : null;
  return out;
}

// ---- policies ----
async function listPolicies(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return paged(Policy, filter, { updatedAt: -1 }, query);
}
async function createPolicy({ data, userId }) {
  const doc = await Policy.create({
    title: data.title,
    body: data.body || '',
    author: userId,
    status: data.status || 'draft',
    version: 1,
  });
  return doc.toJSON();
}
async function getPolicy(id) {
  const doc = await Policy.findOne({id: id}).lean();
  if (!doc) notFound('policy_not_found');
  return doc;
}
async function updatePolicy({ id, data, userId }) {
  const doc = await Policy.findOne({id: id});
  if (!doc) notFound('policy_not_found');
  await PolicyHistory.create({
    policyId: String(doc.id), title: doc.title, body: doc.body,
    version: doc.version, at: new Date(), byId: userId,
  });
  if (data.title !== undefined) doc.title = data.title;
  if (data.body !== undefined) doc.body = data.body;
  if (data.status !== undefined) doc.status = data.status;
  doc.version = (doc.version || 1) + 1;
  await doc.save();
  return doc.toJSON();
}
// publish/approve -> 'active'; send-back/archive -> 'draft'/'archived'.
// publish|approve|send-back keep the version (workflow transition, not an
// edit); only content updates bump version. History snapshot still written.
async function transitionPolicy({ id, action, userId }) {
  const doc = await Policy.findOne({id: id});
  if (!doc) notFound('policy_not_found');
  const map = { publish: 'active', approve: 'active', 'send-back': 'draft', archive: 'archived' };
  await PolicyHistory.create({
    policyId: String(doc.id), title: doc.title, body: doc.body,
    version: doc.version, at: new Date(), byId: userId,
  });
  doc.status = map[action];
  await doc.save();
  return doc.toJSON();
}
async function policyHistory(query) {
  const filter = {};
  if (query.policyId) filter.policyId = query.policyId;
  return paged(PolicyHistory, filter, { at: -1 }, query);
}

// ---- profile / sessions (req user sans secrets) ----
async function profile(userId) {
  const user = await User.findOne({id: userId}).lean();
  if (!user) notFound('user_not_found');
  delete user.passwordHash;
  delete user.mfaSecret;
  delete user.mfaBackupCodes;
  delete user.emailVerifyTokenHash;
  delete user.resetTokenHash;
  return user;
}
// RefreshFamily fields: familyId,userId,currentHash,prevHash,reused,mfaAt,
// ip,ua,expiresAt + timestamps. Expose session-safe subset only.
async function sessions(userId) {
  const fams = await RefreshFamily.find({ userId }).sort({ updatedAt: -1 }).lean();
  return fams.map(f => ({
    id: f.familyId,
    ip: f.ip || '',
    device: f.ua || '',
    createdAt: f.createdAt,
    expiresAt: f.expiresAt,
  }));
}
function familyIdFromToken(token) {
  try {
    const p = jwt.verify(String(token || ''), env.jwtRefreshSecret);
    return p.fid || null;
  } catch (e) { return null; }
}
async function revokeOtherSessions({ userId, currentFamilyId, currentRefreshToken }) {
  const fid = currentFamilyId || familyIdFromToken(currentRefreshToken);
  const filter = fid ? { userId, familyId: { $ne: fid } } : { userId };
  const out = await RefreshFamily.deleteMany(filter);
  return { ok: true, revoked: out.deletedCount || 0, keptCurrent: Boolean(fid) };
}

module.exports = {
  listPartnerships,
  listPartnershipsByKind,
  listPartnershipRequests,
  decideRequest,
  getStrategy,
  strategySlice,
  listPolicies,
  createPolicy,
  getPolicy,
  updatePolicy,
  transitionPolicy,
  policyHistory,
  profile,
  sessions,
  revokeOtherSessions,
};
