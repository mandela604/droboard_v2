/**
 * models/revenue.model.js — splits config, pools, ads, pricing, FX.
 * The money waterfall lives here. Percentages editable in Super Admin;
 * every ledger write stamps the config version used.
 */
const mongoose = require('mongoose');

// Adjustable cuts: 1 active global + optional per-author overrides.
// CANONICAL SHAPE (single home for all splits):
//   google (fixed 30) + marketing + editors + writerShare = 100 (sale waterfall, flat UI)
//   giftWriterPct (writer 30 / platform 70 of gift face — contractual)
//   subPlatformPct / subWritersPct (default 50/50 of subscription pool)
const revenueConfigSchema = new mongoose.Schema({
  scope: { type: String, enum: ['global', 'author'], required: true, index: true },
  authorId: { type: String, ref: 'User', index: true, sparse: true },
  storeFeePct: { type: Number, required: true, default: 30 }, // == google, immutable
  marketingPct: { type: Number, required: true, default: 20 },
  editorsPct: { type: Number, required: true, default: 10 },
  writerShareOfNetPct: { type: Number, required: true, default: 40 }, // == writerShare; gross: store fee → marketing → editors → net → writerShare% of net.
  giftWriterPct: { type: Number, default: 30 }, // gifts/tips: writer % of coin face (platform keeps 70). Coin-only, no cash gifting.
  subPlatformPct: { type: Number, default: 50 }, // subscription pool: platform %
  subWritersPct: { type: Number, default: 50 }, // subscription pool: writers % (pro-rata by qualifying reads)
  subscriptionCoinRateNGN: { type: Number, default: 10 }, // per-coin face for sub reads
  version: { type: Number, required: true },
  note: { type: String, default: '' },
  updatedBy: { type: String, ref: 'User' },
  effectiveFrom: { type: Date, default: Date.now },
}, { timestamps: true });
revenueConfigSchema.index({ scope: 1, version: 1 }, { unique: true });

// Pool balances (cached; recomputed from ledger, never edited directly)
const poolBalanceSchema = new mongoose.Schema({
  pool: { type: String, enum: ['editors', 'platform', 'marketing'], required: true, unique: true },
  balance: { type: Number, default: 0 },
  recomputedAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Ad impressions → monthly settlement at realized eCPM.
// Page/surface ads: 100% platform. Unlock ads: same waterfall, no store fee.
const adImpressionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', index: true },
  bookId: { type: String, ref: 'Book', index: true },
  chapterId: { type: String, ref: 'Chapter' },
  network: { type: String, default: 'admob' }, // admob|adsense|direct
  adUnitId: { type: String, default: '' },
  kind: { type: String, enum: ['rewarded_unlock', 'page', 'banner'], default: 'page', index: true },
  verified: { type: Boolean, default: false }, // SSV verified (rewarded)
  settled: { type: Boolean, default: false, index: true },
  completedAt: { type: Date, default: Date.now },
}, { timestamps: false });
adImpressionSchema.index({ bookId: 1, kind: 1, completedAt: -1 });

// Ad revenue ledger (super-admin ad-earnings + marketing analytics console).
// One row per (date, storyId, adId, slot, page) — POST /api/ads/track upserts.
// Shape mirrors public/services/ad-revenue-service.js so the console reads
// rows, totals and per-story/per-author splits verbatim.
const adRevenueLedgerSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  storyId: { type: String, default: '', index: true },
  storyTitle: { type: String, default: '' },
  authorId: { type: String, default: '', index: true },
  authorName: { type: String, default: '' },
  adId: { type: String, default: '', index: true },
  slot: { type: String, default: '' },
  page: { type: String, default: '' },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  platformShare: { type: Number, default: 0 },
  authorShare: { type: Number, default: 0 },
  paidAt: { type: Date, default: null },
}, { timestamps: false });
adRevenueLedgerSchema.index({ date: 1, storyId: 1, adId: 1, slot: 1, page: 1 }, { unique: true });
adRevenueLedgerSchema.index({ authorId: 1, paidAt: 1 });

// Per-contract chapter pricing (from contract-monetization component)
const contractPricingSchema = new mongoose.Schema({
  contractId: { type: String, required: true, unique: true },
  bookId: { type: String, ref: 'Book', index: true },
  freeChapters: { type: Number, default: 0 },
  adsPerChapter: { type: Number, default: 0 },
  allowAdUnlock: { type: Boolean, default: true },
  rows: [{ num: Number, title: String, price: Number, ads: Number, free: Boolean }],
  paidCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'signed', 'rejected'], default: 'pending' },
}, { timestamps: true });

// Coin/FX config (single doc, EDITABLE in Super Admin — no code changes).
// Face value, sub rate, minimums, breakage policy all live here.
const coinRateSchema = new mongoose.Schema({
  key: { type: String, default: 'live', unique: true },
  coinFaceNGN: { type: Number, default: 15 },
  fx: { type: Map, of: Number, default: {} }, // currency -> NGN per unit, daily
  bonusExpiryDays: { type: Number, default: 90 },
  dormancyBreakageMonths: { type: Number, default: 12 },
  minChapterCoins: { type: Number, default: 10 },
  minWithdrawal: { type: Number, default: 100 },
  // Global currency switch (Super Admin → Coin Economy). base = settlement
  // currency for finance legs; locked = null → automatic per-location ladders,
  // or one ISO code forced on every page (currency-service.js config).
  base: { type: String, default: 'NGN' },
  locked: { type: String, default: null },
}, { timestamps: true });

// Daily financial rollup (reports)
const financialDailySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  revenue: { type: Number, default: 0 },
  coinSales: { type: Number, default: 0 },
  payouts: { type: Number, default: 0 },
  platformIncome: { type: Number, default: 0 },
  categoryRevenue: { type: Map, of: Number, default: {} },
}, { timestamps: false });
financialDailySchema.index({ date: 1 });

module.exports = {
  RevenueConfig: mongoose.model('RevenueConfig', revenueConfigSchema),
  PoolBalance: mongoose.model('PoolBalance', poolBalanceSchema),
  AdImpression: mongoose.model('AdImpression', adImpressionSchema),
  AdRevenueLedger: mongoose.model('AdRevenueLedger', adRevenueLedgerSchema),
  ContractPricing: mongoose.model('ContractPricing', contractPricingSchema),
  CoinRate: mongoose.model('CoinRate', coinRateSchema),
  FinancialDaily: mongoose.model('FinancialDaily', financialDailySchema),
};
