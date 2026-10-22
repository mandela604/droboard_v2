'use strict';
/* routes/pricing.routes.js — reader-facing pricing config (mounted at /api):
 *   GET /api/pricing/ladders            services/currency-service.js:201
 *   GET /api/platform-settings/currency services/currency-service.js:206
 * Both are behind USE_API=false today; demo ladders/config stay intact.
 * Ladder shape is a flat map product id -> { NGN:'₦1,500', USD:'$2.50', … }
 * (strings, because the client resolves legs with strict nonEmpty()). */
const base = require('../controllers/base.controller');
const { generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const { CoinPack, CoinBundle, SubscriptionPlan } = require('../models/money.model');
const { CoinRate } = require('../models/revenue.model');

const VALID = ['NGN', 'USD', 'GBP'];
const SYMBOL = { NGN: '₦', USD: '$', GBP: '£' };

function pricesOut(doc) {
  const p = (doc && doc.prices instanceof Map) ? Object.fromEntries(doc.prices) : (doc && doc.prices) || {};
  const out = {};
  Object.keys(p).forEach((k) => {
    const v = p[k];
    const cur = String(k).toUpperCase();
    if (typeof v === 'string' && v.trim()) out[cur] = v.trim();
    else if (typeof v === 'number' && isFinite(v)) {
      const dec = cur === 'NGN' ? 0 : 2;
      out[cur] = (SYMBOL[cur] || '') + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
  });
  return out;
}

router.get('/pricing/ladders', generalLimiter,
  async (req, res) => base.wrap(res, async () => {
    const [packs, bundles, plans] = await Promise.all([
      CoinPack.find({ status: 'active' }).lean().catch(() => []),
      CoinBundle.find({ status: 'active' }).lean().catch(() => []),
      SubscriptionPlan.find({ status: 'active' }).lean().catch(() => []),
    ]);
    const out = {};
    [...packs, ...bundles, ...plans].forEach((d) => {
      const legs = pricesOut(d);
      if (Object.keys(legs).length) out[String(d.id || d._id)] = legs;
    });
    return out;
  }));

router.get('/platform-settings/currency', generalLimiter,
  async (req, res) => base.wrap(res, async () => {
    const r = await CoinRate.findOne({ key: 'live' }).lean().catch(() => null);
    const baseCur = r && VALID.includes(String(r.base || '').toUpperCase()) ? String(r.base).toUpperCase() : 'NGN';
    const locked = r && r.locked != null ? String(r.locked).toUpperCase() : null;
    return { base: baseCur, locked: VALID.includes(locked) ? locked : null };
  }));

module.exports = router;
