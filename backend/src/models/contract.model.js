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
  type: { type: String, enum: ['Publishing', 'Financial', 'Legal', 'Rights'], default: 'Publishing' },
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft', index: true },
  clauses: { type: Number, default: 0 },
  body: { type: String, default: '' },
  preview: { title: String, body: String },
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
