'use strict';
const { CoinPack, CoinBundle, SubscriptionPlan, Gift, EarnReward } = require('../models/money.model');

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
  // fold loose UI extras (icon/color/badge/blog/channel) into meta so live
  // round-trips keep what the demo shapes carry at top level
  const extras = ['icon', 'color', 'badge', 'name', 'price', 'available',
    'blogCategory', 'blogUrl', 'channelId', 'channelUrl', 'videoId', 'minWatchSec'];
  const meta = Object.assign({}, data.meta && typeof data.meta === 'object' ? data.meta : null);
  extras.forEach(k => { if (data[k] !== undefined) meta[k] = data[k]; });
  if (Object.keys(meta).length) out.meta = meta;
  return out;
}
async function saveDoc(Model, data, required) {
  if (data.id) {
    const doc = await Model.findOne({ id: String(data.id) });
    if (!doc) throw err(404, 'not_found');
    Object.assign(doc, pick(data, required === 'pack' ? PACK_FIELDS : required === 'reward' ? REWARD_FIELDS : BUNDLE_FIELDS));
    await doc.save();
    return doc.toJSON();
  }
  const fields = required === 'pack' ? PACK_FIELDS : required === 'reward' ? REWARD_FIELDS : BUNDLE_FIELDS;
  const body = pick(data, fields);
  if (!body.code) throw err(400, 'code_required');
  const dupe = await Model.findOne({ code: body.code }).select('_id').lean();
  if (dupe) throw err(409, 'code_taken');
  const doc = await Model.create(body);
  return doc.toJSON();
}
async function deleteDoc(Model, id) {
  const doc = await Model.findOne({ id: String(id) });
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

async function catalog() {
  await Promise.all([
    seed(CoinPack, SEED_PACKS),
    seed(SubscriptionPlan, SEED_SUBS),
    seed(Gift, SEED_GIFTS),
    seed(EarnReward, SEED_REWARDS),
  ]);
  const [packs, subscriptions, gifts, adRewards] = await Promise.all([
    CoinPack.find({ status: 'active' }).lean(),
    SubscriptionPlan.find({ status: 'active' }).lean(),
    Gift.find({ status: 'active' }).lean(),
    EarnReward.find({ status: 'active' }).lean(),
  ]);
  return { packs, subscriptions, gifts, adRewards, bundles: [] };
}

module.exports = {
  catalog,
  listPacks, savePack, deletePack,
  listRewards, saveReward, deleteReward,
  listBundles, saveBundle, deleteBundle,
};
