/**
 * models/contract.model.js — contracts, templates, signed records.
 * Flow: pending → sent → approved(author signed) → signed(platform signs,
 * pricing locked) → active. Monetization terms live in ContractPricing.
 */
const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['Exclusive_Publishing', 'Revenue_Share', 'License_Agreement', 'Non_Exclusive'], required: true },
  status: { type: String, enum: ['draft', 'pending', 'sent', 'approved', 'signed', 'active', 'rejected', 'expired', 'terminated'], default: 'pending', index: true },
  duration: { type: String, default: '12 months' },
  termMonths: { type: Number, default: 12 },
  effectiveAt: { type: Date, default: null },
  expiryAt: { type: Date, default: null },
  revenueSplit: { type: Number, default: 70 }, // legacy display; live math uses RevenueConfig
  advance: { type: Number, default: 0 },
  authorNote: { type: String, default: '' }, // author's own application words
  editorId: { type: String, ref: 'User' },
  sentAt: { type: Date, default: null },
  signedAt: { type: Date, default: null },
  pdfUrl: { type: String, default: '' },
  signatures: [{ by: String, role: { type: String, enum: ['author', 'editor'] }, at: Date, hash: String }],
  replies: [{ from: String, message: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
contractSchema.index({ authorId: 1, status: 1 });

const contractTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  desc: { type: String, default: '' },
  // `type` widened additively: original four platform kinds plus the
  // label set the Contracts & Payments console filters on. Old values valid.
  type: { type: String, enum: ['Publishing', 'Financial', 'Legal', 'Rights', 'Non-Exclusive', 'Exclusive', 'Renewal', 'Amendment', 'Work-for-Hire'], default: 'Publishing' },
  // `paused` is a console workflow state (distinct from `draft`): the console
  // shows paused vs draft separately and re-activates from either.
  status: { type: String, enum: ['active', 'draft', 'paused', 'archived'], default: 'draft', index: true },
  clauses: { type: Number, default: 0 },        // clause count (existing)
  clauseText: { type: String, default: '' },     // additive: prose the console renders/searches
  body: { type: String, default: '' },
  preview: { title: String, body: String },
  // Additive console economics (all optional; no migration).
  royaltyRate: { type: Number, default: null },
  termLength: { type: String, default: '' },
  signupBonusMin: { type: Number, default: 0 },
  signupBonusMax: { type: Number, default: 0 },
  completionTarget: { type: Number, default: 0 },
  completionWindowMonths: { type: Number, default: 0 },
  profitShareThreshold: { type: Number, default: 0 },
  profitShareBonus: { type: Number, default: 0 },
  autoRenew: { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
  defaultChapterPrice: { type: Number, default: 0 },
  cfHidden: { type: [String], default: [] },
  cfLabels: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: String, ref: 'User' },
}, { timestamps: true });

const signedContractSchema = new mongoose.Schema({
  contractId: { type: String, ref: 'Contract', required: true, unique: true },
  cover: { type: String, default: '' },
  effectiveAt: { type: Date },
  expiryAt: { type: Date },
  clauses: { type: [String], default: [] },
  editorId: { type: String, ref: 'User' },
  pdfUrl: { type: String, required: true },
}, { timestamps: true });

module.exports = {
  Contract: mongoose.model('Contract', contractSchema),
  ContractTemplate: mongoose.model('ContractTemplate', contractTemplateSchema),
  SignedContract: mongoose.model('SignedContract', signedContractSchema),
};
