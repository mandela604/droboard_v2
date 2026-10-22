'use strict';
// Finance console controller — platform-scoped endpoints consumed by the
// finance pages (finance-data.js, coin-transactions-service.js).
// All handlers are STAFF-gated by their routes (admin|finance), so anonymous
// requests 401 and the frontend keeps its demo fallback.
const svc = require('../services/finance-surfaces.service');
const base = require('./base.controller');

async function dashboard(req, res) {
  return base.wrap(res, async () => svc.dashboard());
}

/* ── withdrawals ── */
async function withdrawals(req, res) {
  return base.wrap(res, async () => svc.withdrawals());
}
async function approveWithdrawal(req, res) {
  return base.wrap(res, async () => svc.approveWithdrawal(req.valid.params.id, req.user.id));
}
async function declineWithdrawal(req, res) {
  return base.wrap(res, async () => svc.declineWithdrawal(
    req.valid.params.id, req.valid.body && req.valid.body.reason, req.user.id));
}

/* ── author payments ── */
async function authorPayments(req, res) {
  return base.wrap(res, async () => svc.authorPayments());
}
async function paymentHistory(req, res) {
  return base.wrap(res, async () => svc.paymentHistory());
}
async function schedulePayout(req, res) {
  return base.wrap(res, async () => svc.schedulePayout(
    req.valid.params.authorId, req.valid.body.amount, req.valid.body.date));
}
async function processPayment(req, res) {
  return base.wrap(res, async () => svc.processPayment(req.valid.params.authorId, req.user.id));
}

/* ── payment disputes ── */
async function paymentDisputes(req, res) {
  return base.wrap(res, async () => svc.paymentDisputes());
}
async function resolveDispute(req, res) {
  return base.wrap(res, async () => svc.resolveDispute(req.valid.params.id, req.valid.body.note));
}
async function rejectDispute(req, res) {
  return base.wrap(res, async () => svc.rejectDispute(req.valid.params.id, req.valid.body.note));
}
async function replyDispute(req, res) {
  return base.wrap(res, async () => svc.replyDispute(
    req.valid.params.id, req.valid.body.message, req.user.id));
}

/* ── coin transactions + catalog config ── */
async function coinTransactions(req, res) {
  return base.wrap(res, async () => svc.coinTransactions());
}
async function coinPackages(req, res) {
  return base.wrap(res, async () => svc.coinPackages());
}
async function coinBundles(req, res) {
  return base.wrap(res, async () => svc.coinBundles());
}
async function coinGifts(req, res) {
  return base.wrap(res, async () => svc.coinGifts());
}
async function coinEarn(req, res) {
  return base.wrap(res, async () => svc.coinEarn());
}
async function coinSubscriptions(req, res) {
  return base.wrap(res, async () => svc.coinSubscriptions());
}
async function coinConfigHistory(req, res) {
  return base.wrap(res, async () => svc.coinConfigHistory());
}
async function logConfig(req, res) {
  return base.wrap(res, async () => {
    const b = req.valid.body;
    const { StoreConfigLog } = require('../models/money.model');
    // Actor comes from the console's profile; fall back to the session user.
    let actor = b.actor || '';
    if (!actor) {
      const u = await require('../models/user.model').User.findOne({ id: String(req.user.id) })
        .select('fullName username').lean().catch(() => null);
      actor = (u && (u.fullName || u.username)) || 'Finance';
    }
    const at = b.date && !isNaN(new Date(b.date).getTime()) ? new Date(b.date) : new Date();
    const doc = await StoreConfigLog.create({
      action: b.action,
      itemType: b.itemType,
      itemName: b.itemName || '',
      actor: String(actor).slice(0, 120),
      actorId: String(req.user.id),
      details: b.details || '',
      at,
    });
    res.status(201);
    return { id: doc.id };
  });
}

function save(kind) {
  return async function (req, res) {
    return base.wrap(res, async () => {
      const out = await svc.saveConfig(kind, req.valid.body, req.user.id);
      if (!req.valid.body.id) res.status(201);
      return out;
    });
  };
}
function patchStatus(kind) {
  return async function (req, res) {
    return base.wrap(res, async () => svc.updateConfigStatus(
      kind, req.valid.params.id, req.valid.body && req.valid.body.status, req.user.id));
  };
}
function put(kind) {
  return async function (req, res) {
    return base.wrap(res, async () => svc.saveConfig(kind, Object.assign({}, req.valid.body, { id: req.valid.params.id }), req.user.id));
  };
}
function remove(kind) {
  return async function (req, res) {
    return base.wrap(res, async () => svc.removeConfig(kind, req.valid.params.id, req.user.id));
  };
}

module.exports = {
  dashboard, withdrawals, approveWithdrawal, declineWithdrawal,
  authorPayments, paymentHistory, schedulePayout, processPayment,
  paymentDisputes, resolveDispute, rejectDispute, replyDispute,
  coinTransactions, coinPackages, coinBundles, coinGifts, coinEarn, coinSubscriptions,
  coinConfigHistory, logConfig,
  savePackage: save('package'), putPackage: put('package'), statusPackage: patchStatus('package'), deletePackage: remove('package'),
  saveBundle: save('bundle'), putBundle: put('bundle'), statusBundle: patchStatus('bundle'), deleteBundle: remove('bundle'),
  saveGift: save('gift'), putGift: put('gift'), statusGift: patchStatus('gift'), deleteGift: remove('gift'),
  saveEarn: save('earn'), putEarn: put('earn'), statusEarn: patchStatus('earn'), deleteEarn: remove('earn'),
  saveSubscription: save('subscription'), putSubscription: put('subscription'), statusSubscription: patchStatus('subscription'), deleteSubscription: remove('subscription'),
};
