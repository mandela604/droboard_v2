'use strict';
const svc = require('../services/chief-editors.service');
const base = require('./base.controller');

async function list(req, res) {
  return base.wrap(res, async () => svc.listSeniorEditors(req.valid.query));
}
async function quotas(req, res) {
  return base.wrap(res, async () => svc.quotas());
}
async function get(req, res) {
  return base.wrap(res, async () => svc.getSeniorEditor(req.valid.params.id));
}
async function patch(req, res) {
  return base.wrap(res, async () => svc.patchSeniorEditor(req.valid.params.id, req.valid.body, req.user.id));
}
async function createInvite(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createInvite(req.valid.body, req.user.id);
    res.status(201);
    return out;
  });
}
async function listInvites(req, res) {
  return base.wrap(res, async () => svc.listInvites(req.valid.query));
}
async function patchInvite(req, res) {
  return base.wrap(res, async () => svc.patchInvite(req.valid.params.id, req.valid.body));
}
async function resendInvite(req, res) {
  return base.wrap(res, async () => svc.resendInvite(req.valid.params.id));
}
async function cancelInvite(req, res) {
  return base.wrap(res, async () => svc.cancelInvite(req.valid.params.id));
}
async function inviteByToken(req, res) {
  return base.wrap(res, async () => svc.getByToken(req.valid.params.token));
}
async function acceptInvite(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.acceptInvite(req.valid.body);
    res.status(201);
    return out;
  });
}
async function authors(req, res) {
  return base.wrap(res, async () => svc.listAuthors(req.valid.query));
}
async function assignments(req, res) {
  return base.wrap(res, async () => svc.getAssignments());
}
async function saveAssignments(req, res) {
  return base.wrap(res, async () => svc.saveAssignments(req.valid.params.id, req.valid.body, req.user.id));
}
// Option B queue: writers with no editor (chief picks who takes them).
async function unassigned(req, res) {
  return base.wrap(res, async () => svc.listUnassignedAuthors(req.valid.query));
}
// Invite wizard step 1: live search of registered accounts.
async function searchUsers(req, res) {
  return base.wrap(res, async () => svc.searchPlatformUsers(req.valid.query));
}

module.exports = {
  list, quotas, get, patch,
  createInvite, listInvites, patchInvite, resendInvite, cancelInvite,
  inviteByToken, acceptInvite,
  authors, assignments, saveAssignments, unassigned, searchUsers,
};
