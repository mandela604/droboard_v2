'use strict';
const { CoinPack, CoinBundle, SubscriptionPlan, Gift, EarnReward } = require('../models/money.model');
const rules = require('./earn-rules');

const SEED_PACKS = [
  { code: 'pack1', coins: 100, bonusPct: 0, basePriceNGN: 1500, status: 'active' },
  { code: 'pack2', coins: 500, bonusPct: 5, basePriceNGN: 7000, status: 'active' },
  { code: 'pack3', coins: 1200, bonusPct: 10, basePriceNGN: 16000, status: 'active' },
  { code: 'pack4', coins: 2500, bonusPct: 15, basePriceNGN: 32000, status: 'active' },
];
const SEED_SUBS = [
  { code: 'sub-daily', name: 'Daily', period: 'day', durationDays: 1, basePriceNGN: 500, features: ['Unlimited reading for 24 hours'], status: 'active' },
  { code: 'sub-weekly', name: 'Weekly', period: 'week', durationDays: 7, basePriceNGN: 2000, features: ['Unlimited reading for 7 days'], status: 'active' },
  { code: 'sub-monthly', name: 'Monthly', period: 'month', durationDays: 30, basePriceNGN: 6000, features: ['Unlimited reading for 30 days'], status: 'active' },
  { code: 'sub-yearly', name: 'Yearly', period: 'year', durationDays: 365, basePriceNGN: 40000, features: ['Unlimited reading for 365 days'], status: 'active' },
  { code: 'sub-merge', name: 'Merge Pass', period: 'month', durationDays: 30, basePriceNGN: 8000, features: ['Ad-free browsing', 'Unlimited reading'], status: 'active' },
];
const SEED_GIFTS = [
  { code: 'gift-rose', name: 'Rose', costCoins: 10, color: '#FF2D6A', status: 'active' },
  { code: 'gift-heart', name: 'Big Heart', costCoins: 50, color: '#E11D48', status: 'active' },
  { code: 'gift-diamond', name: 'Diamond', costCoins: 100, color: '#0EA5E9', status: 'active' },
  { code: 'gift-crown', name: 'Crown', costCoins: 250, color: '#F59E0B', status: 'active' },
  { code: 'gift-rocket', name: 'Rocket', costCoins: 500, color: '#7C3AED', status: 'active' },
  { code: 'gift-dragon', name: 'Dragon', costCoins: 1000, color: '#16A34A', status: 'active' },
];
const SEED_REWARDS = [
  { code: 'ad1', action: 'Watch Ad', type: 'watch_ad', coins: 10, cooldown: '5 min', status: 'active' },
  { code: 'ad2', action: 'Daily Check-in', type: 'checkin', coins: 25, cooldown: '24 hr', status: 'active' },
];

const SEED_BUNDLES = [
  { code: 'b1', name: 'Starter Bundle', coins: 500, bonus: 50, basePriceNGN: 2400, status: 'active' },
  { code: 'b2', name: 'Pro Bundle', coins: 1500, bonus: 300, basePriceNGN: 6000, status: 'active' },
  { code: 'b3', name: 'Elite Bundle', coins: 5000, bonus: 1500, basePriceNGN: 18000, status: 'active' },
];

async function seed(Model, rows) {
  if ((await Model.countDocuments()) === 0) await Model.insertMany(rows);
}

function err(status, message) { return Object.assign(new Error(message), { status }); }

/* ── Store settings admin (finance console): coin packs, ad rewards, bundles.
   POST upserts by uuid id when present, else creates (code must be unique). */
const PACK_FIELDS = ['code', 'coins', 'bonusPct', 'basePriceNGN', 'prices', 'status', 'meta'];
const REWARD_FIELDS = ['code', 'action', 'type', 'coins', 'cooldown', 'pagesRequired', 'status', 'meta'];
const BUNDLE_FIELDS = ['code', 'name', 'coins', 'bonus', 'basePriceNGN', 'icon', 'color', 'status', 'meta'];

function pick(data, fields) {
  const out = {};
  fields.forEach(k => { if (data[k] !== undefined) out[k] = data[k]; });
  // fold loose UI extras (icon/color/badge/blog/channel/ad-url) into meta so
  // live round-trips keep what the demo shapes carry at top level
  const extras = ['icon', 'color', 'badge', 'name', 'price', 'available',
    'blogCategory', 'blogUrl', 'channelId', 'channelUrl', 'videoId', 'minWatchSec', 'adUrl'];
  const meta = Object.assign({}, data.meta && typeof data.meta === 'object' ? data.meta : null);
  extras.forEach(k => { if (data[k] !== undefined) meta[k] = data[k]; });
  if (Object.keys(meta).length) out.meta = meta;
  return out;
}
// Rows are addressed by catalog code (the console's own id); only fall back to
// the Mongo id when the value really is one — a bare { id: 'SUB-01' } query
// casts to _id and throws.
function byIdOrCode(Model, id) {
  const s = String(id);
  return Model.findOne({ code: s }).then((doc) => doc
    || (require('mongoose').Types.ObjectId.isValid(s) ? Model.findOne({ _id: s }) : null));
}
async function saveDoc(Model, data, required) {
  const check = (candidate) => {
    if (required !== 'reward') return;
    const errs = rules.validate(candidate);
    if (errs.length) { const e = err(400, 'reward_invalid'); e.errors = errs; throw e; }
  };
  if (data.id) {
    const doc = await byIdOrCode(Model, data.id);
    if (!doc) throw err(404, 'not_found');
    const body = pick(data, required === 'pack' ? PACK_FIELDS : required === 'reward' ? REWARD_FIELDS : BUNDLE_FIELDS);
    Object.assign(doc, body);
    check(doc);
    await doc.save();
    return doc.toJSON();
  }
  const fields = required === 'pack' ? PACK_FIELDS : required === 'reward' ? REWARD_FIELDS : BUNDLE_FIELDS;
  const body = pick(data, fields);
  if (!body.code) throw err(400, 'code_required');
  check(body);
  const dupe = await Model.findOne({ code: body.code }).select('_id').lean();
  if (dupe) throw err(409, 'code_taken');
  const doc = await Model.create(body);
  return doc.toJSON();
}
async function deleteDoc(Model, id) {
  const doc = await byIdOrCode(Model, id);
  if (!doc) throw err(404, 'not_found');
  await doc.deleteOne();
  return { ok: true, id: String(id) };
}

async function listPacks() { return CoinPack.find({}).sort({ coins: 1 }).lean(); }
async function savePack(data) { return saveDoc(CoinPack, data, 'pack'); }
async function deletePack(id) { return deleteDoc(CoinPack, id); }
async function listRewards() { return EarnReward.find({}).sort({ coins: 1 }).lean(); }
async function saveReward(data) { return saveDoc(EarnReward, data, 'reward'); }
async function deleteReward(id) { return deleteDoc(EarnReward, id); }
async function listBundles() { return CoinBundle.find({}).sort({ coins: 1 }).lean(); }
async function saveBundle(data) { return saveDoc(CoinBundle, data, 'bundle'); }
async function deleteBundle(id) { return deleteDoc(CoinBundle, id); }

/* ── Reader-facing catalog (store.html). The page renders these shapes
   directly and prices them through DroboardCurrency.resolve(), which wants a
   ladder of display STRINGS keyed by currency — never raw numbers. Extra UI
   fields ride in meta (see pick()), so they come back out at top level. */
const LEG_SYMBOL = { NGN: '₦', USD: '$', GBP: '£' };

function legText(cur, v) {
  if (typeof v === 'string' && v.trim()) return v.trim();
  const n = Number(v);
  if (!isFinite(n)) return '';
  const dec = cur === 'NGN' ? 0 : 2;
  return (LEG_SYMBOL[cur] || '') + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function legsOf(doc) {
  const raw = (doc && doc.prices instanceof Map) ? Object.fromEntries(doc.prices) : (doc && doc.prices) || {};
  const out = {};
  ['NGN', 'USD', 'GBP'].forEach((cur) => {
    const s = legText(cur, raw[cur]);
    if (s) out[cur] = s;
  });
  if (!out.NGN) {
    const s = legText('NGN', doc && doc.basePriceNGN);
    if (s) out.NGN = s;
  }
  return out;
}
function usdOf(legs, doc) {
  if (legs.USD) return parseFloat(legs.USD.replace(/[^0-9.]/g, '')) || 0;
  const n = Number(doc && doc.basePriceNGN);
  return isFinite(n) ? n : 0;
}
function metaOf(doc) {
  return doc && doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
}
function priceLine(legs, doc) {
  return legs.NGN || legs.USD || legs.GBP || legText('NGN', doc && doc.basePriceNGN) || '';
}

function baseNGNOf(doc, legs) {
  const n = Number(doc && doc.basePriceNGN);
  if (isFinite(n) && n > 0) return n;
  return legNum(legs.NGN);
}
function legNum(s) {
  const n = parseFloat(String(s || '').replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}
function packOut(p) {
  const m = metaOf(p), prices = legsOf(p);
  const bonusPct = Number(p.bonusPct) || 0;
  return {
    id: p.code, code: p.code, coins: p.coins, bonusPct,
    bonusCoins: Math.round((p.coins || 0) * bonusPct / 100),
    basePriceNGN: baseNGNOf(p, prices),
    price: m.price || priceLine(prices, p), priceUSD: usdOf(prices, p), prices,
    badge: m.badge || '', color: m.color || '#FF2D6A', icon: m.icon || 'fa-coins',
    title: m.name || (p.coins + ' Coins'),
  };
}
function bundleOut(b) {
  const m = metaOf(b), prices = legsOf(b);
  return {
    id: b.code, code: b.code, name: m.name || b.name, coins: b.coins, bonus: Number(b.bonus) || 0,
    basePriceNGN: baseNGNOf(b, prices),
    price: m.price || priceLine(prices, b), priceUSD: usdOf(prices, b), prices,
    icon: m.icon || b.icon || 'fa-gift', color: m.color || b.color || '#7c3aed',
  };
}
function subOut(s) {
  const m = metaOf(s), prices = legsOf(s);
  return {
    id: s.code, code: s.code, name: m.name || s.name, period: s.period, durationDays: s.durationDays,
    features: s.features || [], badge: m.badge || s.badge || '', icon: m.icon || s.icon || 'fa-crown',
    color: m.color || s.color || '#FF2D6A',
    basePriceNGN: baseNGNOf(s, prices),
    price: m.price || priceLine(prices, s), priceUSD: usdOf(prices, s), prices,
    coinsPerDay: s.coinsPerDay, bonusPercent: s.bonusPercent,
  };
}
function giftOut(g) {
  const m = metaOf(g);
  // The tip picker renders `<i class="fas ${faIcon}">`, so faIcon must be a
  // Font Awesome class; a staff-entered emoji stays in `icon` only.
  const ico = String(m.icon || g.icon || '');
  return {
    id: g.code, code: g.code, name: g.name, price: g.costCoins, coins: g.costCoins,
    icon: ico || 'fa-gem', faIcon: m.faIcon || (/^fa-/.test(ico) ? ico : 'fa-gem'),
    color: m.color || g.color || '#FF2D6A', desc: m.desc || g.desc || '',
  };
}
// Only rewards that still pass earn-rules are served: a task with no ad URL, a
// bad YouTube id or no cooldown is not offered at all, because the server would
// have to refuse its claim anyway.
function rewardOut(r) {
  return rules.shaped(r);
}

async function catalog() {
  await Promise.all([
    seed(CoinPack, SEED_PACKS),
    seed(SubscriptionPlan, SEED_SUBS),
    seed(Gift, SEED_GIFTS),
    seed(EarnReward, SEED_REWARDS),
    seed(CoinBundle, SEED_BUNDLES),
  ]);
  const [p, s, g, a, b] = await Promise.all([
    CoinPack.find({ status: 'active' }).sort({ coins: 1 }).lean(),
    SubscriptionPlan.find({ status: 'active' }).sort({ durationDays: 1 }).lean(),
    Gift.find({ status: 'active' }).sort({ costCoins: 1 }).lean(),
    EarnReward.find({ status: 'active' }).sort({ coins: 1 }).lean(),
    CoinBundle.find({ status: 'active' }).sort({ coins: 1 }).lean(),
  ]);
  const subs = s.map(subOut);
  // The Merge Pass is a separate card on the page, not another row in the plans grid.
  const merge = subs.find((x) => x.code === 'sub-merge');
  return {
    packs: p.map(packOut),
    bundles: b.map(bundleOut),
    gifts: g.map(giftOut),
    adRewards: a.map(rewardOut).filter(Boolean),
    subscriptions: subs.filter((x) => x.code !== 'sub-merge'),
    mergeSub: merge || {},
  };
}

module.exports = {
  catalog,
  listPacks, savePack, deletePack,
  listRewards, saveReward, deleteReward,
  listBundles, saveBundle, deleteBundle,
};
