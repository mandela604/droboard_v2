'use strict';
const svc = require('../services/chief-overview.service');
const base = require('./base.controller');

async function dashboard(req, res) {
  return base.wrap(res, async () => svc.dashboard());
}

async function stats(req, res) {
  return base.wrap(res, async () => svc.stats());
}

async function performance(req, res) {
  return base.wrap(res, async () => svc.performance(req.valid.query.period));
}

async function queues(req, res) {
  return base.wrap(res, async () => svc.queues(req.valid.params.type, req.valid.query));
}

async function queueAction(req, res) {
  return base.wrap(res, async () => svc.queueAction({
    type: req.valid.params.type, id: req.valid.params.id,
    action: req.valid.body.action, userId: req.user.id, note: req.valid.body.note,
  }));
}

async function editorialTeam(req, res) {
  return base.wrap(res, async () => svc.editorialTeam());
}

async function activity(req, res) {
  return base.wrap(res, async () => svc.activity(req.valid.query));
}

module.exports = { dashboard, stats, performance, queues, queueAction, editorialTeam, activity };
