/**
 * models/editorial.model.js — merchandising, trust & safety, campaigns.
 * Governance: SEs nominate (EditorPicks), CEs own Featured placements.
 */
const mongoose = require('mongoose');

const featuredSectionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  limit: { type: Number, default: 5 },
}, { timestamps: false });

const featuredPlacementSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  sectionKey: { type: String, default: 'hero-banner' },
  tag: { type: String, default: '' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true },
  startAt: { type: Date, default: Date.now },
  endAt: { type: Date, default: null },
  placedBy: { type: String, ref: 'User' }, // CE owner attribution
}, { timestamps: true });

const featuredHistorySchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', index: true },
  section: { type: String, default: '' },
  action: { type: String, enum: ['added', 'removed', 'expired'], required: true },
  byId: { type: String, ref: 'User' },
  at: { type: Date, default: Date.now },
}, { timestamps: false });

const editorPickSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, unique: true },
  category: { type: String, default: '', index: true },
  reason: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true },
  pickedBy: { type: String, ref: 'User' },
  pickedAt: { type: Date, default: Date.now },
  log: [{ bookId: String, action: { type: String, enum: ['added', 'archived'] }, at: Date, byId: String }],
}, { timestamps: true });

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  audience: { type: String, enum: ['all', 'authors', 'readers'], default: 'all', index: true },
  content: { type: String, required: true },
  image: { type: String, default: '' },
  type: { type: String, enum: ['update', 'event', 'system', 'policy', 'program', 'news', 'security'], default: 'update' },
  status: { type: String, enum: ['draft', 'scheduled', 'published'], default: 'draft', index: true },
  scheduledAt: { type: Date, default: null },
  views: { type: Number, default: 0 },
}, { timestamps: true });

const reportSchema = new mongoose.Schema({
  storyId: { type: String, ref: 'Book' },
  chapterId: { type: String, ref: 'Chapter' },
  title: { type: String, required: true },
  desc: { type: String, required: true },
  type: { type: String, enum: ['content', 'spam', 'plagiarism', 'abuse', 'other'], default: 'other', index: true },
  reporterId: { type: String, ref: 'User' },
  reporterLabel: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', index: true },
  resolutionNote: { type: String, default: '' },
  resolvedBy: { type: String, ref: 'User' },
}, { timestamps: { createdAt: 'filedAt', updatedAt: true } });

const disputeSchema = new mongoose.Schema({
  claimantId: { type: String, ref: 'User', required: true },
  respondentId: { type: String, ref: 'User' },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  // ADDITIVE (chief slice): optional workflow category so chief views
  // (copyright-disputes, plagiarism-cases) can filter without keyword hacks.
  // Defaults to 'general'; no migration needed for existing docs.
  category: { type: String, default: 'general', index: true },
  status: { type: String, enum: ['open', 'in_review', 'resolved', 'dismissed'], default: 'open', index: true },
  resolution: { type: String, default: '' },
}, { timestamps: true });

const appealSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true },
  type: { type: String, required: true },
  detail: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
  status: { type: String, enum: ['open', 'in_review', 'upheld', 'rejected'], default: 'open', index: true },
  decidedBy: { type: String, ref: 'User' },
}, { timestamps: { createdAt: 'filedAt', updatedAt: true } });

const launchCampaignSchema = new mongoose.Schema({
  writerId: { type: String, ref: 'User', index: true },
  campaignName: { type: String, required: true },
  campaignType: { type: String, enum: ['book', 'profile'], default: 'book' },
  desc: { type: String, default: '' },
  image: { type: String, default: '' },
  imageWide: { type: String, default: '' },
  link: { type: String, default: '' },
  cta: { type: String, default: '' },
  launchDate: { type: Date },
  status: { type: String, enum: ['draft', 'scheduled', 'active'], default: 'draft', index: true },
  referralCode: { type: String, default: '' },
}, { timestamps: true });

const promoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  desc: { type: String, default: '' },
  type: { type: String, enum: ['discount', 'bundle', 'flash', 'referral', 'trial'], default: 'discount', index: true },
  discount: { type: String, default: '' },
  status: { type: String, enum: ['active', 'scheduled', 'expired', 'draft'], default: 'draft', index: true },
  used: { type: Number, default: 0 },
  cap: { type: Number, default: null },
  startAt: { type: Date },
  endAt: { type: Date },
}, { timestamps: true });

module.exports = {
  FeaturedSection: mongoose.model('FeaturedSection', featuredSectionSchema),
  FeaturedPlacement: mongoose.model('FeaturedPlacement', featuredPlacementSchema),
  FeaturedHistory: mongoose.model('FeaturedHistory', featuredHistorySchema),
  EditorPick: mongoose.model('EditorPick', editorPickSchema),
  Announcement: mongoose.model('Announcement', announcementSchema),
  Report: mongoose.model('Report', reportSchema),
  Dispute: mongoose.model('Dispute', disputeSchema),
  Appeal: mongoose.model('Appeal', appealSchema),
  LaunchCampaign: mongoose.model('LaunchCampaign', launchCampaignSchema),
  Promo: mongoose.model('Promo', promoSchema),
};
