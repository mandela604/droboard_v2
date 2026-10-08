'use strict';
const base = require('./base.controller');
const awards = require('../services/awards.service');

const wrap = (fn) => async (req, res) => base.wrap(res, () => fn(req));
const created = (fn) => async (req, res) => {
  try { return res.status(201).json(await fn(req)); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message || 'error' }); }
};

module.exports = {
  list: wrap(async (req) => awards.list(req.valid.query)),
  get: wrap(async (req) => awards.get(req.valid.params.id)),
  create: created(async (req) => awards.create(req.valid.body, req.user && req.user.id)),
  update: wrap(async (req) => awards.update(req.valid.params.id, req.valid.body)),
  remove: wrap(async (req) => awards.remove(req.valid.params.id)),
  holders: wrap(async (req) => awards.holders(req.valid.params.id)),
  byHandle: wrap(async (req) => awards.grantsForHandle(req.valid.params.handle)),
  grant: created(async (req) => awards.grant(req.valid.params.id, req.valid.body.handle, req.user && req.user.id)),
  revoke: wrap(async (req) => awards.revoke(req.valid.params.id, req.valid.body.handle)),
  evaluate: wrap(async (req) => awards.evaluate(req.valid.params.id, req.valid.query.handle)),
  runAutoGrant: wrap(async (req) => awards.runAutoGrant(req.user && req.user.id)),
};
