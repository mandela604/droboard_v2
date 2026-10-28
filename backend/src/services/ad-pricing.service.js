'use strict';
/* services/ad-pricing.service.js — what an impression and a click cost.
 *
 * Priced per currency, never converted. This is the same rule the platform
 * applies to coin ladders (public/services/currency-service.js): each market
 * carries its own authored price, so moving the naira price never silently
 * reprices the dollar one.
 *
 * The USD leg is also what the ad revenue ledger books, because the
 * super-admin earnings console has always reported in dollars — so a campaign
 * billed in NGN still contributes its dollar-equivalent to reports, without
 * either number being derived from the other at runtime.
 */
const { AdRateCard } = require('../models/marketing.model');

const CURRENCIES = ['NGN', 'USD', 'GBP'];

const DEFAULTS = {
  active: 'NGN',
  prices: {
    NGN: { impression: 8, click: 560 },
    USD: { impression: 0.005, click: 0.35 },
    GBP: { impression: 0.004, click: 0.28 },
  },
};

let CACHE = { at: 0, data: null };
const TTL = 60 * 1000;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function normalise(doc) {
  const prices = {};
  CURRENCIES.forEach(c => {
    const row = (doc && doc.prices && doc.prices[c]) || {};
    const d = DEFAULTS.prices[c];
    prices[c] = {
      impression: num(row.impression, d.impression),
      click: num(row.click, d.click),
    };
  });
  return {
    active: CURRENCIES.includes(doc && doc.active) ? doc.active : DEFAULTS.active,
    prices,
    updatedAt: (doc && doc.updatedAt) || null,
  };
}
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function get() {
  if (CACHE.data && Date.now() - CACHE.at < TTL) return CACHE.data;
  let doc = null;
  try { doc = await AdRateCard.findOne({ key: 'rates' }).lean(); } catch (e) { doc = null; }
  if (!doc) {
    const seed = normalise(null);
    try { await AdRateCard.create({ key: 'rates', active: seed.active, prices: seed.prices }); } catch (e) { /* another request seeded it */ }
    CACHE = { at: Date.now(), data: seed };
    return seed;
  }
  const data = normalise(doc);
  CACHE = { at: Date.now(), data };
  return data;
}

/* Refuses a partial card rather than filling gaps with defaults — a currency
   that was not submitted keeps its stored price, which is what an operator
   editing one market expects. */
async function save(body, actor) {
  const cur = await get();
  const next = clone(cur.prices);
  const incoming = (body && body.prices) || {};
  Object.keys(incoming).forEach(c => {
    if (!CURRENCIES.includes(c)) return;
    const row = incoming[c] || {};
    if (row.impression !== undefined) next[c].impression = Math.max(0, +row.impression || 0);
    if (row.click !== undefined) next[c].click = Math.max(0, +row.click || 0);
  });
  const active = CURRENCIES.includes(body && body.active) ? body.active : cur.active;
  await AdRateCard.updateOne(
    { key: 'rates' },
    { $set: { active, prices: next, updatedBy: String((actor && actor.id) || '') } },
    { upsert: true }
  );
  CACHE = { at: 0, data: null };
  return get();
}

/* The price of one event, in the currency the campaign is billed in. */
async function rateFor(currency, event) {
  const card = await get();
  const c = CURRENCIES.includes(currency) ? currency : card.active;
  const row = card.prices[c] || card.prices.USD;
  return event === 'click' ? row.click : row.impression;
}

function clearCache() { CACHE = { at: 0, data: null }; }

module.exports = { CURRENCIES, DEFAULTS, get, save, rateFor, clearCache };
