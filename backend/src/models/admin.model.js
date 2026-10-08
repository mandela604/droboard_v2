/**
 * models/admin.model.js — Super Admin console: custom roles, system pages,
 * awards catalog + grants. IDs via global ids plugin (arl-/spg-/awd-/uaw-).
 */
const mongoose = require('mongoose');

// Custom staff roles (frontend Role shape: 16 flat permission flags).
const PERM_KEYS = [
  'view_editors', 'manage_editors', 'approve_contracts', 'view_authors',
  'edit_stories', 'manage_submissions', 'view_campaigns', 'create_campaigns',
  'approve_budget', 'view_financials', 'release_payouts', 'edit_rates',
  'view_reports', 'resolve_reports', 'ban_users', 'manage_roles',
  'manage_billing', 'view_analytics',
];
const adminRoleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  desc: { type: String, default: '' },
  icon: { type: String, default: 'fa-user-shield' },
  color: { type: String, default: 'blue' },
  system: { type: Boolean, default: false }, // system roles can't be deleted
  memberIds: [{ type: String, ref: 'User', default: [] }],
  perms: { type: Map, of: Boolean, default: {} },
}, { timestamps: true, collection: 'adminroles' });
adminRoleSchema.index({ name: 1 });

// Static CMS pages (frontend SystemPage cards).
const systemPageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  icon: { type: String, default: 'fa-file-lines' },
  tone: { type: String, default: 'blue' }, // pink|blue|amber|purple|green
  status: { type: String, enum: ['active', 'draft', 'hidden'], default: 'draft', index: true },
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
    metric: { type: String, enum: ['reads', 'books', 'followers', 'rating', 'genre_rank', 'growth', 'manual'], default: 'manual' },
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
