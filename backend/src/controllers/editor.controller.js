'use strict';
const ed = require('../services/editor.service');
const base = require('./base.controller');

function res(name) {
  return {
    list: async (req, res) => base.wrap(res, async () => ed.R[name]().list(req.valid.query)),
    get: async (req, res) => base.wrap(res, async () => ed.R[name]().get(req.valid.params.id)),
    create: async (req, res) => base.wrap(res, async () => {
      const out = await ed.R[name]().create(req.valid.body);
      res.status(201);
      return out;
    }),
    update: async (req, res) => base.wrap(res, async () =>
      ed.R[name]().update(req.valid.params.id, req.valid.body)),
    remove: async (req, res) => base.wrap(res, async () =>
      ed.R[name]().remove(req.valid.params.id)),
    approve: async (req, res) => base.wrap(res, async () =>
      ed.R[name]().setStatus(req.valid.params.id, 'approved')),
    reject: async (req, res) => base.wrap(res, async () =>
      ed.R[name]().setStatus(req.valid.params.id, 'rejected')),
  };
}

async function stats(req, res) {
  return base.wrap(res, async () => ed.stats());
}
async function activity(req, res) {
  return base.wrap(res, async () => ed.activity());
}
async function logs(req, res) {
  return base.wrap(res, async () => ed.logs(req.valid.query));
}

async function markNotificationsRead(req, res) {
  return base.wrap(res, async () => {
    const { Notification } = require('../models/social.model');
    const r = await Notification.updateMany({ recipientId: String(req.user.id), unread: true }, { unread: false });
    return { ok: true, modified: r.modifiedCount || 0 };
  });
}

module.exports = { res, stats, activity, logs, markNotificationsRead };
