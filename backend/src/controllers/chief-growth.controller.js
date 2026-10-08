'use strict';
const growth = require('../services/chief-growth.service');
const base = require('./base.controller');

async function partnerships(req, res) {
  return base.wrap(res, async () => growth.listPartnerships(req.valid.query));
}
function partnershipsByKind(kind) {
  return function (req, res) {
    return base.wrap(res, async () => growth.listPartnershipsByKind(kind, req.valid.query));
  };
}
async function partnershipRequests(req, res) {
  return base.wrap(res, async () => growth.listPartnershipRequests(req.valid.query));
}
function decideRequest(decision) {
  return function (req, res) {
    return base.wrap(res, async () => growth.decideRequest({ id: req.valid.params.id, decision }));
  };
}
async function strategy(req, res) {
  return base.wrap(res, async () => growth.getStrategy());
}
function strategySlice(field) {
  return function (req, res) {
    return base.wrap(res, async () => growth.strategySlice(field));
  };
}
async function listPolicies(req, res) {
  return base.wrap(res, async () => growth.listPolicies(req.valid.query));
}
async function createPolicy(req, res) {
  return base.wrap(res, async () => {
    const out = await growth.createPolicy({ data: req.valid.body, userId: req.user.id });
    res.status(201);
    return out;
  });
}
async function getPolicy(req, res) {
  return base.wrap(res, async () => growth.getPolicy(req.valid.params.id));
}
async function updatePolicy(req, res) {
  return base.wrap(res, async () => growth.updatePolicy({
    id: req.valid.params.id, data: req.valid.body, userId: req.user.id,
  }));
}
function transitionPolicy(action) {
  return function (req, res) {
    return base.wrap(res, async () => growth.transitionPolicy({
      id: req.valid.params.id, action, userId: req.user.id,
    }));
  };
}
async function policyHistory(req, res) {
  return base.wrap(res, async () => growth.policyHistory(req.valid.query));
}
async function profile(req, res) {
  return base.wrap(res, async () => growth.profile(req.user.id));
}
async function sessions(req, res) {
  return base.wrap(res, async () => growth.sessions(req.user.id));
}
async function revokeOthers(req, res) {
  return base.wrap(res, async () => growth.revokeOtherSessions({
    userId: req.user.id,
    currentFamilyId: req.valid.body && req.valid.body.currentFamilyId,
    currentRefreshToken: (req.cookies && req.cookies.dro_refresh) || (req.valid.body && req.valid.body.refreshToken),
  }));
}

module.exports = {
  partnerships,
  publishing: partnershipsByKind('publishing'),
  translations: partnershipsByKind('translation'),
  contests: partnershipsByKind('contest'),
  ipMedia: partnershipsByKind('ip-media'),
  partnershipRequests,
  approveRequest: decideRequest('approve'),
  declineRequest: decideRequest('decline'),
  strategy,
  strategyNotes: strategySlice('notes'),
  strategyGenres: strategySlice('genrePriorities'),
  strategyGoals: strategySlice('quarterlyGoals'),
  strategyCampaigns: strategySlice('campaigns'),
  strategyTargets: strategySlice('acquisitionTargets'),
  listPolicies,
  createPolicy,
  getPolicy,
  updatePolicy,
  archivePolicy: transitionPolicy('archive'),
  publishPolicy: transitionPolicy('publish'),
  approvePolicy: transitionPolicy('approve'),
  sendBackPolicy: transitionPolicy('send-back'),
  policyHistory,
  profile,
  sessions,
  revokeOthers,
};
