/**
 * models/admin.model.js — Super Admin console: custom roles, system pages,
 * awards catalog + grants. IDs via global ids plugin (arl-/spg-/awd-/uaw-).
 */
const mongoose = require('mongoose');

// Custom staff roles (frontend Role shape: flat permission flags, one per
// guarded capability in the staff modules — mirrors roles-service.js).
const PERM_KEYS = [
  // Editorial — Chief Editor
  'view_editors', 'manage_editors', 'approve_contracts', 'read_flagged_books',
  'manage_editorial_policy', 'set_editorial_strategy', 'publish_announcements',
  // Editorial — Senior Editor
  'manage_submissions', 'review_completions', 'manage_authors', 'view_authors',
  'review_contracts', 'resolve_reports', 'view_own_earnings',
  // Marketing & Growth
  'view_campaigns', 'create_campaigns', 'manage_ads', 'manage_rate_card',
  'manage_audience', 'manage_league', 'approve_budget',
  // Finance
  'release_payouts', 'view_financials', 'resolve_payment_disputes',
  'manage_coin_store', 'manage_payment_methods',
  // Reports & Moderation
  'view_reports', 'ban_users',
  // Platform Control
  'manage_users', 'manage_roles', 'edit_stories', 'edit_rates', 'manage_billing',
  'manage_settings', 'manage_system_pages', 'manage_awards', 'view_analytics',
];
const adminRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // slug is the User.roles token this role grants. Only set on system roles;
  // custom roles stay slug='' and never auto-write-through to User.roles.
  slug: { type: String, trim: true, default: '' },
  desc: { type: String, default: '' },
  icon: { type: String, default: 'fa-user-shield' },
  color: { type: String, default: 'blue' },
  system: { type: Boolean, default: false }, // system roles can't be deleted
  memberIds: [{ type: String, ref: 'User', default: [] }],
  perms: { type: Map, of: Boolean, default: {} },
}, { timestamps: true, collection: 'adminroles' });
adminRoleSchema.index({ name: 1 });
adminRoleSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string', $ne: '' } } });

// Static CMS pages (frontend SystemPage cards).
// content: plain text body for normal pages; questions: Q&A pairs for FAQ.
// The public /Pages renderers wrap paragraphs in <p> — admins never type HTML.
const systemPageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  icon: { type: String, default: 'fa-file-lines' },
  tone: { type: String, default: 'blue' }, // pink|blue|amber|purple|green
  status: { type: String, enum: ['active', 'draft', 'hidden'], default: 'draft', index: true },
  content: { type: String, default: '' },
  questions: [{ q: { type: String, default: '' }, a: { type: String, default: '' } }],
  updatedBy: { type: String, ref: 'User', default: null },
}, { timestamps: true, collection: 'systempages' });

// Awards catalog (frontend AwardPayload + Award).
const awardSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: 'fa-award' },
  color: { type: String, default: 'gold' },
  desc: { type: String, default: '' },
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
  criteria: {
    metric: { type: String, enum: ['reads', 'books', 'followers', 'rating', 'genre_rank', 'growth', 'platform_tips', 'manual'], default: 'manual' },
    op: { type: String, enum: ['>=', 'top', 'admin'], default: 'admin' },
    value: { type: Number, default: 0 },
    genre: { type: String, default: '' },
    period: { type: String, default: null }, // 2025|2025-H2|null (all-time)
  },
  createdBy: { type: String, ref: 'User', default: null },
}, { timestamps: true, collection: 'awards' });

// Award grants to handles (frontend UserAward).
const userAwardSchema = new mongoose.Schema({
  awardId: { type: String, ref: 'Award', required: true, index: true },
  userId: { type: String, ref: 'User', default: null, index: true },
  handle: { type: String, required: true, index: true }, // username snapshot
  grantedAt: { type: Date, default: Date.now },
  grantedBy: { type: String, ref: 'User', default: null },
}, { timestamps: false, collection: 'userawards' });
userAwardSchema.index({ awardId: 1, handle: 1 });

module.exports = {
  PERM_KEYS,
  AdminRole: mongoose.model('AdminRole', adminRoleSchema),
  SystemPage: mongoose.model('SystemPage', systemPageSchema),
  Award: mongoose.model('Award', awardSchema),
  UserAward: mongoose.model('UserAward', userAwardSchema),
};
