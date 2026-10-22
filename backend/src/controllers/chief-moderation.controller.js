'use strict';
const svc = require('../services/chief-moderation.service');
const surfaces = require('../services/chief-surfaces.service');
const base = require('./base.controller');

// Console read contract: {authorAppeals, copyrightDisputes, plagiarismCases,
// escalatedReports, resolutionHistory} (disputes-appeals-service.js:36-45).
// The canonical {disputes, appeals, escalatedReports} envelope is still served
// by the per-section routes below.
async function disputesAppeals(req, res) {
  return base.wrap(res, async () => surfaces.disputesAppealsComposite(req.valid.query));
}
async function listAppeals(req, res) {
  return base.wrap(res, async () => svc.listAppeals(req.valid.query));
}
function decide(decision) {
  return function (req, res) {
    return base.wrap(res, async () => svc.decideAppeal({
      id: req.valid.params.id, decision, userId: req.user.id, note: req.valid.body && req.valid.body.note,
    }));
  };
}
async function copyrightDisputes(req, res) {
  return base.wrap(res, async () => svc.copyrightDisputes(req.valid.query));
}
async function resolveCopyright(req, res) {
  return base.wrap(res, async () => svc.resolveCopyrightDispute({
    id: req.valid.params.id, userId: req.user.id, resolution: req.valid.body && req.valid.body.resolution,
  }));
}
async function plagiarismCases(req, res) {
  return base.wrap(res, async () => svc.plagiarismCases(req.valid.query));
}
async function confirmPlagiarism(req, res) {
  return base.wrap(res, async () => svc.confirmPlagiarism({
    id: req.valid.params.id, userId: req.user.id, note: req.valid.body && req.valid.body.note,
  }));
}
async function clearPlagiarism(req, res) {
  return base.wrap(res, async () => svc.clearPlagiarism({
    id: req.valid.params.id, userId: req.user.id, note: req.valid.body && req.valid.body.note,
  }));
}
async function escalatedReports(req, res) {
  return base.wrap(res, async () => svc.escalatedReports(req.valid.query));
}
async function resolveEscalated(req, res) {
  return base.wrap(res, async () => svc.resolveEscalated({
    id: req.valid.params.id, userId: req.user.id, resolution: req.valid.body && req.valid.body.resolution,
  }));
}
async function escalateLegal(req, res) {
  return base.wrap(res, async () => svc.escalateLegal({
    id: req.valid.params.id, userId: req.user.id, note: req.valid.body && req.valid.body.note,
  }));
}
async function resolutionHistory(req, res) {
  return base.wrap(res, async () => svc.resolutionHistory());
}

module.exports = {
  disputesAppeals,
  listAppeals,
  uphold: decide('uphold'),
  overturn: decide('overturn'),
  investigate: decide('investigate'),
  copyrightDisputes,
  resolveCopyright,
  plagiarismCases,
  confirmPlagiarism,
  clearPlagiarism,
  escalatedReports,
  resolveEscalated,
  escalateLegal,
  resolutionHistory,
};
