'use strict';
const statuses = require('../services/statuses.service');
const base = require('./base.controller');

async function home(req, res) {
  return base.wrap(res, async () => statuses.homeStatuses({ userId: req.user && req.user.id }));
}

// Frontend contract: GET /api/statuses/me → { statuses: [{bg,quote,caption,time}] }
async function me(req, res) {
  return base.wrap(res, async () => statuses.myStatuses({ userId: req.user.id }));
}

// GET /api/statuses/state?handles=a,b,c — per-author ring state across surfaces.
async function state(req, res) {
  return base.wrap(res, async () => statuses.stateStatuses({
    viewerId: req.user && req.user.id,
    handles: String((req.valid.query && req.valid.query.handles) || '').split(','),
  }));
}

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await statuses.createStatus({ userId: req.user.id, file: req.file, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function view(req, res) {
  return base.wrap(res, async () => {
    const status = await statuses.loadOr404(req.valid.params.id);
    const body = req.valid.body || {};
    return statuses.viewStatus({
      status,
      userId: req.user && req.user.id,
      anonId: body.anonId || body.viewerId,
    });
  });
}

// GET /api/statuses/:id/viewers — owner/admin only (named readers + guest total).
async function viewers(req, res) {
  return base.wrap(res, async () => {
    const status = await statuses.loadOr404(req.valid.params.id);
    return statuses.statusViewers({ status, user: req.user });
  });
}

async function like(req, res) {
  return base.wrap(res, async () => {
    const status = await statuses.loadOr404(req.valid.params.id);
    return statuses.toggleLike({ status, userId: req.user.id });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const status = await statuses.loadOr404(req.valid.params.id);
    if (!statuses.canWrite(status, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return statuses.deleteStatus({ status });
  });
}

module.exports = { home, me, state, create, view, viewers, like, remove };
