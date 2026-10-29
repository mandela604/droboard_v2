'use strict';
const svc = require('../services/editor-earnings.service');
const base = require('./base.controller');

// Program settings + a pay-scheme overview. Per-editor earnings never pass
// through the chief console — finance owns the money, editors see their own.
module.exports = {
  settings: (req, res) => base.wrap(res, () => svc.settings()),
  saveSettings: (req, res) => base.wrap(res, () => svc.saveSettings(req.valid.body, req.user.id)),
  summary: (req, res) => base.wrap(res, () => svc.programSummary()),
};
