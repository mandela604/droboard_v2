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

module.exports = { catalog };
