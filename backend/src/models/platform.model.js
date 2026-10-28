/**
 * models/platform.model.js — settings, roles, ads, email, promos infra.
 */
const mongoose = require('mongoose');

const platformSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // general|moderation|payout|email|notifications|finance
  value: mongoose.Schema.Types.Mixed,
  updatedBy: { type: String, ref: 'User' },
}, { timestamps: true });

const roleSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true }, // reader|writer|senior_editor|chief_editor|finance|admin
  permissions: { type: [String], required: true }, // e.g. contracts.sign, payouts.approve
  scope: { type: String, default: 'platform' },
}, { timestamps: true });

const emailTemplateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // welcome|contract|payout|flag
  sender: { type: String, default: '' },
  smtpHost: { type: String, default: '' },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Ad inventory (marketing ad-manager). Embed = network code for slots.
// `strict:false` — the creative fields are per-format (sponsor, author, rating,
// chapters, preview, name, handle, tagline, headline, sub, img, avatar, cover,
// reads, isBook, …) and the console round-trips them as-is; they must survive
// the read back or the edit wizard starts empty. Known fields below are the
// ones serving logic reads.
const adInventorySchema = new mongoose.Schema({
  format: { type: String, enum: ['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo', 'minibanner', 'spotlight'], required: true, index: true },
  brand: { type: String, default: '' },
  title: { type: String, default: '' }, // internal label for embed
  heading: { type: String, default: '' },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  code: { type: String, default: '' }, // network embed script/HTML
  cta: { type: String, default: '' },
  url: { type: String, default: '' }, // destination link
  pages: { type: [String], default: [] }, // placement targeting
  slots: { type: [String], default: [] }, // slot targeting (empty = any slot)
  genre: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  // ADDITIVE (marketing console): campaign link + campaign-driven pause, the
  // audience/offer targeting the ad-setup wizard collects, and the raw
  // 'YYYY-MM-DD' legs the wizard reads back when editing.
  campaign: { type: String, default: '', index: true },
  autoPaused: { type: Boolean, default: false },
  audience: { type: mongoose.Schema.Types.Mixed, default: null },
  offerRef: { type: mongoose.Schema.Types.Mixed, default: null },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
}, { timestamps: true, strict: false });

const adPlacementSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true }, // discover|feed|genreHub|fullReader|scrollReader|library|store|comments|profile|discussion
  enabled: { type: Boolean, default: true, index: true }, // master kill switch for the page
  // Per-slot programming: slotId -> false (off) or
  // { enabled, formats: [subset], adIds: [pinned inventory ids, served first] }.
  // Canonical ids: fullReader:top|per-300-words, scrollReader:per-300-words,
  // comments:list-top|every-nth|thread-top, feed:in-feed, discover:strip, ...
  slots: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  interval: { type: Number, default: 4 },
  wordsPerSlot: { type: Number, default: 300 }, // in-text ad every N words (readers)
  cycle: { type: [String], default: [] },
  format: { type: String, default: 'auto' }, // auto|embed|native|book|platform|banner
  topPromo: { type: Boolean, default: false },
  promoSlider: { type: Boolean, default: true },
  repeat: { type: Boolean, default: false }, // repeat comment/thread ads (marketing-owned; readers default off)
  paidUnlockAds: { type: Boolean, default: false }, // show ads to paid chapter unlocks too (readers)
  // Non-canonical console config, merged on save so a new manager field never
  // 400s the whole bulk PUT: the spotlight schedule (seconds, everyN, allowSkip,
  // adId, delaySeconds, cooldownHours, startHour, endHour, days, audienceMode,
  // match, segments) lives here under page 'spotlight'.
  cfg: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const adStatSchema = new mongoose.Schema({
  adId: { type: String, required: true, index: true },
  day: { type: Date, required: true, index: true },
  impressions: { type: Number, default: 0 }, // one per rendered showing
  viewables: { type: Number, default: 0 },   // IAB: >=50% visible for 1s
  clicks: { type: Number, default: 0 },
  completes: { type: Number, default: 0 }, // creative played to the end
  skips: { type: Number, default: 0 },     // closed / swiped before the end
  conversions: { type: Number, default: 0 },
  conversionValue: { type: Number, default: 0 },
}, { timestamps: false });
adStatSchema.index({ adId: 1, day: 1 }, { unique: true });

// Raw lifecycle stream (impression → viewable → click → complete/skip/…).
// Feeds the marketing console and debugging; TTL keeps 90 days.
// `showingId` identifies one rendered ad instance, so the same creative can
// legitimately produce many impressions. `eventKey` (impression/viewable only)
// is unique per instance — retries and fetch/sendBeacon double-sends collapse.
const adEventSchema = new mongoose.Schema({
  adId: { type: String, required: true, index: true },
  event: { type: String, required: true, index: true },
  page: { type: String, default: '', index: true },
  slot: { type: String, default: '' },
  storyId: { type: String, default: '' },
  showingId: { type: String, default: '' },
  eventKey: { type: String }, // impression/viewable only — unique sparse
  userId: { type: String, default: '', index: true },
  anonId: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
adEventSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
adEventSchema.index({ eventKey: 1 }, { unique: true, sparse: true });

// One row per attributed conversion. `orderId` makes client + advertiser
// postback idempotent (both carry the same id).
const adConversionSchema = new mongoose.Schema({
  adId: { type: String, required: true, index: true },
  orderId: { type: String, index: true },
  userId: { type: String, default: '' },
  anonId: { type: String, default: '' },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  page: { type: String, default: '' },
  slot: { type: String, default: '' },
  storyId: { type: String, default: '' },
  source: { type: String, default: 'client' }, // client | postback
}, { timestamps: { createdAt: true, updatedAt: false } });
adConversionSchema.index({ orderId: 1 }, { unique: true, sparse: true });
adConversionSchema.index({ adId: 1, createdAt: -1 });

// Per-user ad clicks (powers Ad Responders segment; aggregates stay in AdStat).
const adClickSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  adId: { type: String, required: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
adClickSchema.index({ userId: 1, createdAt: -1 });

// Per-user ad views, one row per user+ad+day ("ads seen" + frequency caps).
const adViewSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  adId: { type: String, required: true, index: true },
  day: { type: String, required: true, index: true }, // YYYY-MM-DD UTC
}, { timestamps: { createdAt: true, updatedAt: false } });
adViewSchema.index({ userId: 1, adId: 1, day: 1 }, { unique: true });

// Search queries (what readers look for — trending terms + zero-result hunts).
// Written fire-and-forget from the search route; anonymous searches log too
// (userId '' marks them) so trending works before login.
const searchLogSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', default: '', index: true },
  q: { type: String, required: true, index: true },
  type: { type: String, default: '' },
  results: { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });
searchLogSchema.index({ createdAt: -1 });

const activityLogSchema = new mongoose.Schema({
  userLabel: { type: String, default: '' },
  avatar: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  type: { type: String, enum: ['create', 'update', 'delete', 'login', 'payout', 'review'], default: 'update', index: true },
  detail: { type: String, default: '' },
  ip: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

module.exports = {
  PlatformSetting: mongoose.model('PlatformSetting', platformSettingSchema),
  Role: mongoose.model('Role', roleSchema),
  EmailTemplate: mongoose.model('EmailTemplate', emailTemplateSchema),
  AdInventory: mongoose.model('AdInventory', adInventorySchema),
  AdPlacement: mongoose.model('AdPlacement', adPlacementSchema),
  AdStat: mongoose.model('AdStat', adStatSchema),
  AdEvent: mongoose.model('AdEvent', adEventSchema),
  AdConversion: mongoose.model('AdConversion', adConversionSchema),
  AdClick: mongoose.model('AdClick', adClickSchema),
  AdView: mongoose.model('AdView', adViewSchema),
  SearchLog: mongoose.model('SearchLog', searchLogSchema),
  ActivityLog: mongoose.model('ActivityLog', activityLogSchema),
};
