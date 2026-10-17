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
    return statuses.viewStatus({ status, userId: req.user && req.user.id });
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

module.exports = { home, me, create, view, like, remove };
