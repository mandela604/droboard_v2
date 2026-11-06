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

// GET /api/statuses/writers?handles=a,b,c — the live slides behind every
// Top Writers ring. Writers with no unexpired Status get an empty list.
async function writers(req, res) {
  return base.wrap(res, async () => statuses.writersByHandles({
    userId: req.user && req.user.id,
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
    const result = await statuses.viewStatus({
      status,
      userId: req.user && req.user.id,
      anonId: body.anonId || body.viewerId,
    });
    // Cross-device repaint: tell every other session this viewer owns that a
    // status was just marked, so the ring on a still-open tab flips grey
    // without a page reload. Same-tab localStorage 'storage' already handles
    // cross-tab in the same browser; this covers different devices.
    const uid = req.user && req.user.id;
    if (uid && String(status.userId) !== String(uid)) {
      try {
        const { User } = require('../models/user.model');
        const author = await User.findOne({ id: String(status.userId) }).select('username').lean();
        const { emitToUser } = require('../socket');
        emitToUser(uid, 'status:viewed', {
          statusId: String(status.id || status._id),
          authorId: String(status.userId),
          handle: author ? String(author.username || '') : '',
        });
      } catch (e) { /* socket is optional; the HTTP view already persisted */ }
    }
    return result;
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

module.exports = { home, me, state, writers, create, view, viewers, like, remove };
