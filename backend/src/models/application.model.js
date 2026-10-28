/**
 * models/application.model.js — author applications + review pipeline.
 */
const mongoose = require('mongoose');

// Identity check submitted with a contract application. `type` is the signing
// path: self (18+ with NIN), guardian (under 18, guardian co-signs), pending
// (18+ without a NIN yet, signs on an alternate document).
const kycSchema = new mongoose.Schema({
  type: { type: String, enum: ['self', 'guardian', 'pending', ''], default: '' },
  dob: { type: String, default: '' },
  age: { type: Number, default: null },
  nin: { type: String, default: '' },
  altId: {
    type: { type: String, default: '' },
    no: { type: String, default: '' },
  },
  guardian: {
    name: { type: String, default: '' },
    relationship: { type: String, default: '' },
    idNo: { type: String, default: '' },
  },
  // Cloudflare Images delivery URLs — same storage rule as covers/avatars.
  idPhotos: {
    front: { type: String, default: '' },
    back: { type: String, default: '' },
  },
}, { _id: false });

const contractApplicationSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  // Books go live with no contract and can sign later, so an application
  // carries no deal type — the editor assigns one at review.
  type: { type: String, enum: ['', 'Exclusive_Publishing', 'Non_Exclusive', 'Revenue_Share', 'License_Agreement'], default: '' },
  status: { type: String, enum: ['none', 'applied', 'review', 'contracted', 'rejected'], default: 'applied', index: true },
  // Identity lives on AuthorVerification (one record per writer) so a badge
  // and a contract never duplicate the same photos.
  verificationId: { type: String, ref: 'AuthorVerification', default: '' },
  // The owning editor decides; an offer (review) is a Contract in 'sent'.
  contractId: { type: String, ref: 'Contract', default: '' },
  reviewerId: { type: String, ref: 'User', default: '' },
  reviewNote: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
contractApplicationSchema.index({ bookId: 1, status: 1 });

const completionApplicationSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  chapters: { type: Number, required: true },
  wordCount: { type: Number, default: 0 },
  genre: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  authorNote: { type: String, default: '' },
  reviewerId: { type: String, ref: 'User' },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });

const vipApplicationSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  scope: { type: String, enum: ['book_lock', 'chapter_lock'], default: 'book_lock' },
  lockChapters: [{ type: String, ref: 'Chapter' }],
  reason: { type: String, default: '' },
  notes: { type: String, default: '' }, // reviewer notes shown on the review page
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerId: { type: String, ref: 'User' },
}, { timestamps: true });

const chapterReviewRequestSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  chapterId: { type: String, ref: 'Chapter' },
  chapterNum: { type: Number, required: true },
  title: { type: String, default: '' },
  words: { type: Number, default: 0 },
  editType: { type: String, enum: ['Rewrite', 'Minor_Edit', 'Major_Rewrite', 'Grammar_Fix'], default: 'Minor_Edit' },
  authorNote: { type: String, default: '' }, // author's own words
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  feedback: { type: String, default: '' },
  reviewerId: { type: String, ref: 'User' },
}, { timestamps: true });

const storyChangeRequestSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  editType: { type: String, enum: ['Title_Change', 'Cover_Update', 'Description_Edit', 'Genre_Change', 'Story_Name', 'Title_Cover', 'Full_Rebrand'], required: true },
  changes: [{ type: { type: String }, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  authorNote: { type: String, default: '' },
  reviewerId: { type: String, ref: 'User' },
}, { timestamps: true });

const reviewSubmissionSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  cover: { type: String, default: '' },
  synopsis: { type: String, default: '' },
  category: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  assignedSeId: { type: String, ref: 'User' },
  feedback: { type: String, default: '' },
}, { timestamps: true });

const reviewFeedbackSchema = new mongoose.Schema({
  submissionId: { type: String, ref: 'ReviewSubmission', required: true, index: true },
  reviewerId: { type: String, ref: 'User', required: true },
  decision: { type: String, enum: ['approved', 'rejected', 'revision'], required: true },
  comment: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const authorVerificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  userId: { type: String, ref: 'User', default: null, index: true },
  avatar: { type: String, default: '' },
  docType: { type: String, enum: ['Government_ID', 'Passport', 'Drivers_License'] },
  docUrl: { type: String, default: '' },
  // Signing path + document photos, shared by the profile badge and contract
  // applications (one upload, both consumers).
  kyc: { type: kycSchema, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerId: { type: String, ref: 'User' },
  reviewNote: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });
authorVerificationSchema.index({ userId: 1, status: 1 });

const inviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: String, ref: 'User' },
  authorName: { type: String, default: '' },
  authorEmail: { type: String, default: '' },
  status: { type: String, enum: ['active', 'used', 'revoked'], default: 'active', index: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

const chapterEditSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  chapterId: { type: String, ref: 'Chapter', required: true, index: true },
  chapterN: { type: Number, default: null },
  authorId: { type: String, ref: 'User', required: true, index: true },
  // Proposed content (title/content/words/authorNote/poll/prediction/debate/n).
  // Applied to the chapter ONLY on approve — live chapter untouched until then.
  proposed: { type: mongoose.Schema.Types.Mixed, required: true },
  baseVersion: { type: Number, default: null },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerId: { type: String, ref: 'User', default: null },
  reviewNote: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });
chapterEditSchema.index({ chapterId: 1, status: 1 });

// Book-level edit proposals (description/cover/title/genre/tags/...).
// Same rule: applied ONLY on editor approve.
const bookEditSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  proposed: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerId: { type: String, ref: 'User', default: null },
  reviewNote: { type: String, default: '' },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });
bookEditSchema.index({ bookId: 1, status: 1 });

const storyChangeSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  editType: { type: String, default: '' },
  changeFrom: { type: String, default: '' },
  changeTo: { type: String, default: '' },
  authorNote: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerId: { type: String, ref: 'User' },
}, { timestamps: true });

module.exports = {
  ContractApplication: mongoose.model('ContractApplication', contractApplicationSchema),
  CompletionApplication: mongoose.model('CompletionApplication', completionApplicationSchema),
  VipApplication: mongoose.model('VipApplication', vipApplicationSchema),
  ChapterReviewRequest: mongoose.model('ChapterReviewRequest', chapterReviewRequestSchema),
  StoryChangeRequest: mongoose.model('StoryChangeRequest', storyChangeRequestSchema),
  ReviewSubmission: mongoose.model('ReviewSubmission', reviewSubmissionSchema),
  ReviewFeedback: mongoose.model('ReviewFeedback', reviewFeedbackSchema),
  AuthorVerification: mongoose.model('AuthorVerification', authorVerificationSchema),
  InviteCode: mongoose.model('InviteCode', inviteCodeSchema),
  ChapterEdit: mongoose.model('ChapterEdit', chapterEditSchema),
  BookEdit: mongoose.model('BookEdit', bookEditSchema),
  StoryChange: mongoose.model('StoryChange', storyChangeSchema),
};
