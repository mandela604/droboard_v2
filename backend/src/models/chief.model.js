/**
 * models/chief.model.js — chief-editor workspace: senior-editor invites + assignments,
 * policies, partnerships, strategy.
 * Quota overrides live on EditorAssignment.quota (User schema stays untouched).
 *
 * NOTE: taxonomy lives in content.model.js (Category/Genre). No duplicate here.
 */
const mongoose = require('mongoose');

const editorInviteSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  target: { type: Number, default: 0 },
  paymentType: { type: String, default: '' },
  monthlyPay: { type: Number, default: 0 },
  revenueShare: { type: Number, default: 0 },
  deadline: { type: Date, default: null },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'cancelled'], default: 'pending', index: true },
  tokenHash: { type: String, unique: true, sparse: true, index: true },
  // Invites expire 72h after issue (also refreshed on resend). Missing value
  // on legacy docs is treated as expired — fail closed.
  expiresAt: { type: Date, default: () => new Date(Date.now() + 72 * 3600 * 1000), index: true },
  invitedBy: { type: String, ref: 'User', default: null },
}, { timestamps: true });

const editorAssignmentSchema = new mongoose.Schema({
  editorId: { type: String, ref: 'User', required: true, unique: true, index: true },
  authorIds: { type: [String], default: [] },
  quota: { type: mongoose.Schema.Types.Mixed, default: {} }, // quota overrides; User schema untouched
  updatedBy: { type: String, ref: 'User', default: null },
}, { timestamps: true });

const policySchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  author: { type: String, ref: 'User', default: '' },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
  version: { type: Number, default: 1 },
}, { timestamps: true });

const policyHistorySchema = new mongoose.Schema({
  policyId: { type: String, ref: 'Policy', required: true, index: true },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  version: { type: Number, default: 1 },
  at: { type: Date, default: Date.now },
  byId: { type: String, ref: 'User' },
}, { timestamps: false });

const partnershipSchema = new mongoose.Schema({
  kind: { type: String, enum: ['publishing', 'translation', 'contest', 'ip-media'], required: true, index: true },
  name: { type: String, required: true },
  detail: { type: String, default: '' },
  status: { type: String, default: 'active', index: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const partnershipRequestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  detail: { type: String, default: '' },
  status: { type: String, enum: ['under-review', 'exploring', 'approved', 'declined'], default: 'under-review', index: true },
}, { timestamps: true });

const editorialStrategySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'current' }, // single doc, key='current'
  notes: { type: String, default: '' },
  genrePriorities: { type: [mongoose.Schema.Types.Mixed], default: [] },
  quarterlyGoals: { type: [mongoose.Schema.Types.Mixed], default: [] },
  campaigns: { type: [mongoose.Schema.Types.Mixed], default: [] },
  acquisitionTargets: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

module.exports = {
  EditorInvite: mongoose.model('EditorInvite', editorInviteSchema),
  EditorAssignment: mongoose.model('EditorAssignment', editorAssignmentSchema),
  Policy: mongoose.model('Policy', policySchema),
  PolicyHistory: mongoose.model('PolicyHistory', policyHistorySchema),
  Partnership: mongoose.model('Partnership', partnershipSchema),
  PartnershipRequest: mongoose.model('PartnershipRequest', partnershipRequestSchema),
  EditorialStrategy: mongoose.model('EditorialStrategy', editorialStrategySchema),
};
