'use strict';
// services/fx.service.js — live FX into CoinRate.fx (currency -> NGN per unit).
// International buyers pay their own price ($1.49); the coins are still worth
// coinFaceNGN each, so the surplus between the real naira value of the payment
// and the coin face value belongs to the platform. That comparison needs a
// real rate, not a hardcoded one: this service refreshes it from a keyless
// feed every 6 hours, and wallet.service reads CoinRate.fx when booking a
// purchase. If the feed is down the previous map stays in place; if there has
// never been a rate, wallet falls back to the pack's own naira leg.
const { CoinRate } = require('../models/revenue.model');

const SOURCE = 'open.er-api.com';
const URL = 'https://open.er-api.com/v6/latest/USD';
const REFRESH_MS = 6 * 60 * 60 * 1000;
// Only the currencies the pack legs / country map can produce.
const CURRENCIES = ['USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'INR', 'CAD', 'AUD', 'PHP'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Pure: feed payload -> { USD: 1520, GBP: 1924.05, ... } (NGN per unit).
// The feed quotes per USD, so naira-per-USD divided by units-per-USD gives
// naira per unit of that currency. Missing/zero legs are skipped, never zeroed.
function toNgnPerUnit(payload) {
  const rates = (payload && payload.rates) || {};
  const usd = Number(rates.USD);
  const ngn = Number(rates.NGN);
  if (!(usd > 0) || !(ngn > 0)) return {};
  const ngnPerUsd = ngn / usd;
  const out = {};
  for (const c of CURRENCIES) {
    const r = Number(rates[c]);
    if (!(r > 0)) continue;
    out[c] = round2(ngnPerUsd / r);
  }
  return out;
}

async function refresh() {
  const res = await fetch(URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw Object.assign(new Error('fx_feed_failed'), { status: 502 });
  const body = await res.json().catch(() => ({}));
  const fx = toNgnPerUnit(body);
  if (!Object.keys(fx).length) throw Object.assign(new Error('fx_feed_empty'), { status: 502 });
  await CoinRate.findOneAndUpdate(
    { key: 'live' },
    { $set: { fx, fxUpdatedAt: new Date(), fxSource: SOURCE } },
    { upsert: true }
  );
  return { fx, at: new Date(), source: SOURCE };
}

async function rates() {
  const live = await CoinRate.findOne({ key: 'live' }).lean();
  const map = (live && live.fx) || {};
  const out = {};
  const keys = typeof map.keys === 'function' ? Array.from(map.keys()) : Object.keys(map);
  for (const k of keys) out[k] = Number(typeof map.get === 'function' ? map.get(k) : map[k]);
  return { fx: out, updatedAt: (live && live.fxUpdatedAt) || null, source: (live && live.fxSource) || '' };
}

module.exports = { refresh, rates, toNgnPerUnit, CURRENCIES, REFRESH_MS, SOURCE };
