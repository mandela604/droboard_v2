'use strict';
const svc = require('../services/chief-reports.service');
const base = require('./base.controller');

async function list(req, res) {
  return base.wrap(res, async () => svc.listReports(req.valid.query));
}

async function stats(req, res) {
  return base.wrap(res, async () => svc.stats(req.valid.query));
}

async function get(req, res) {
  return base.wrap(res, async () => svc.getReport(req.valid.params.id));
}

async function resolve(req, res) {
  return base.wrap(res, async () => svc.resolve({
    id: req.valid.params.id, userId: req.user.id, note: req.valid.body && req.valid.body.note,
  }));
}

async function dismiss(req, res) {
  return base.wrap(res, async () => svc.dismiss({
    id: req.valid.params.id, userId: req.user.id, note: req.valid.body && req.valid.body.note,
  }));
}

async function reopen(req, res) {
  return base.wrap(res, async () => svc.reopen({ id: req.valid.params.id }));
}

module.exports = { list, stats, get, resolve, dismiss, reopen };
