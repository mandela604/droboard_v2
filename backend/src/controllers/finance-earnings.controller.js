'use strict';
const svc = require('../services/editor-earnings.service');
const base = require('./base.controller');

// Finance owns editor money: the accrual ledger, the withdrawal queue, and the
// tip/minimum knobs the chief console does not set.
module.exports = {
  settings: (req, res) => base.wrap(res, () => svc.settings()),
  saveSettings: (req, res) => base.wrap(res, () => svc.saveSettings(req.valid.body, req.user.id)),

  stats: (req, res) => base.wrap(res, () => svc.financeStats()),
  earnings: (req, res) => base.wrap(res, () => svc.financeEarnings(req.valid.query)),
  payouts: (req, res) => base.wrap(res, () => svc.financePayouts(req.valid.query)),

  approvePayout: (req, res) => base.wrap(res, () =>
    svc.approvePayout(req.valid.params.id, req.user.id)),
  declinePayout: (req, res) => base.wrap(res, () =>
    svc.declinePayout(req.valid.params.id, req.valid.body.reason, req.user.id)),
  payPayout: (req, res) => base.wrap(res, () =>
    svc.payPayout(req.valid.params.id, req.valid.body, req.user.id)),

  runFixed: (req, res) => base.wrap(res, () =>
    svc.runFixedBills(req.valid.body.period, req.user.id)),
  voidEarning: (req, res) => base.wrap(res, () =>
    svc.voidEarning(req.valid.params.id, req.valid.body.reason, req.user.id)),
};
