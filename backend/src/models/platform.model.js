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
const adInventorySchema = new mongoose.Schema({
  format: { type: String, enum: ['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo'], required: true, index: true },
  brand: { type: String, default: '' },
  title: { type: String, default: '' }, // internal label for embed
  heading: { type: String, default: '' },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  code: { type: String, default: '' }, // network embed script/HTML
  cta: { type: String, default: '' },
  pages: { type: [String], default: [] }, // placement targeting
  genre: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
}, { timestamps: true });

const adPlacementSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true }, // discover|feed|genreHub|fullReader|scrollReader|library|store
  interval: { type: Number, default: 4 },
  cycle: { type: [String], default: [] },
  format: { type: String, default: 'auto' }, // auto|embed|native|book|platform|banner
  topPromo: { type: Boolean, default: false },
  promoSlider: { type: Boolean, default: true },
}, { timestamps: true });

const adStatSchema = new mongoose.Schema({
  adId: { type: String, required: true, index: true },
  day: { type: Date, required: true, index: true },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
}, { timestamps: false });
adStatSchema.index({ adId: 1, day: 1 }, { unique: true });

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
  ActivityLog: mongoose.model('ActivityLog', activityLogSchema),
};
