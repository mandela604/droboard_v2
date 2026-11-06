/**
 * models/content.model.js — stories, chapters, characters, plots, genres, categories.
 */
const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, index: 'text' },
  slug: { type: String, unique: true, sparse: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  cover: { type: String, default: '' },
  // short: 1-25 chapters. long: unlimited chapters. No seasons, no series.
  kind: { type: String, enum: ['short', 'long'], default: 'long', index: true },
  genre: { type: String, default: '', index: true },
  categoryId: { type: String, ref: 'Category', default: null },
  synopsis: { type: String, default: '' },
  tags: { type: [String], default: [] },
  tropes: { type: [String], default: [] }, // managed Trope names (CE module)
  status: { type: String, enum: ['draft', 'ongoing', 'under_review', 'published', 'completed', 'paused', 'flagged'], default: 'draft', index: true },
  contractStatus: { type: String, enum: ['none', 'applied', 'review', 'contracted'], default: 'none' },
  vipLocked: { type: Boolean, default: false },
  wordCount: { type: Number, default: 0 },
  chapterCount: { type: Number, default: 0 },
  reads: { type: Number, default: 0 },
  likes: { type: Number, default: 0 }, // sum of reactions — kept in step on every reaction write
  // Reader emoji reactions (love/crying/savage/...). One active rid per reader,
  // tracked in Reaction{targetType:'story'}; these are the display counts.
  reactions: { type: Map, of: Number, default: {} }, // rid -> count (per-user state in Reaction)
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  // Share analytics: one row per click on a confirmed share action. Channel tracking mirrors posts for cross-surface reports.
  sharesCount: { type: Number, default: 0 },
  sharesByChannel: { type: Map, of: Number, default: {} }, // channel -> count (webcopy/whatsapp/twitter/link)
  // Senior-editor flagging (book-management page)
  flagReason: { type: String, default: '' },
  flagNote: { type: String, default: '' },
  flaggedBy: { type: String, default: null },
  flaggedAt: { type: Date, default: null },
  flagPrevStatus: { type: String, default: null },
  // Review routing: stamped on submit. An assigned writer goes straight to
  // their senior editor; a reader has no editor yet, so null means the chief
  // sees it for allocation (the deciding editor is recorded on approve).
  assignedSeId: { type: String, ref: 'User', default: null, index: true },
  submittedAt: { type: Date, default: null },
  // Rejection reason — the author reads it in their workspace.
  reviewFeedback: { type: String, default: '' },
  // Story-wide structured engagement (poll/prediction/debate attached to the
  // whole book, referenced by chapter n). Chapter-wise engagement lives on
  // Chapter below; story-wide debate posts live in /api/posts.
  polls: [{ id: String, chapter: { type: Number, default: null }, q: String, opts: [{ t: String, v: { type: Number, default: 0 } }], expiresAt: { type: Date, default: null } }],
  predictions: [{ id: String, chapter: { type: Number, default: null }, q: String, opts: [{ t: String, v: { type: Number, default: 0 } }], expiresAt: { type: Date, default: null } }],
  debates: [{ id: String, chapter: { type: Number, default: null }, motion: String, forText: String, againstText: String, forV: { type: Number, default: 0 }, agV: { type: Number, default: 0 }, expiresAt: { type: Date, default: null } }],
  // Structured engagement (poll/prediction/debate) is chapter-wise only — lives
  // on Chapter below. Story-wide debate/polls are community Post 'debate'/'poll'
  // via /api/posts (feed/droboard composers).
}, { timestamps: true });

const chapterSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  n: { type: Number, required: true }, // chapter number
  title: { type: String, required: true },
  content: { type: String, default: '' }, // paragraphs HTML
  words: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'pending_review', 'revision_needed', 'scheduled', 'live', 'published'], default: 'draft', index: true },
  scheduledAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
  // coin price to unlock (0 = free). Server-side truth for POST /wallet/unlock;
  // set via the author/editor module (chapters create/patch, staff-gated).
  price: { type: Number, default: 0, min: 0 },
  // author's note (reader-facing, below content) + engagement (polls/predictions)
  authorNote: { type: String, default: '' },
  poll: { q: String, opts: [{ t: String, v: { type: Number, default: 0 } }], expiresAt: { type: Date, default: null } },
  prediction: { q: String, opts: [{ t: String, v: { type: Number, default: 0 } }], expiresAt: { type: Date, default: null } },
  debate: { motion: String, forText: String, againstText: String, forV: { type: Number, default: 0 }, agV: { type: Number, default: 0 }, expiresAt: { type: Date, default: null } },
}, { timestamps: true });
chapterSchema.index({ bookId: 1, n: 1 }, { unique: true });

const engagementVoteSchema = new mongoose.Schema({
  chapterId: { type: String, default: '', index: true }, // '' = story-wide
  bookId: { type: String, default: '', index: true }, // set when chapterId is ''
  // Which poll/prediction/debate inside the book's array. A book can carry
  // several of each, so a vote without this cannot be retracted accurately.
  itemId: { type: String, default: '', index: true },
  userId: { type: String, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['poll', 'prediction', 'debate'], required: true },
  optionIdx: { type: Number, required: true },
}, { timestamps: true });
// One vote per reader per question per user. A book can carry several polls,
// so the row's itemId is part of the key; chapter votes leave bookId '' and
// story-wide votes leave chapterId '', which is why every column is in the
// index instead of two partial ones.
engagementVoteSchema.index({ chapterId: 1, bookId: 1, userId: 1, kind: 1, itemId: 1 }, { unique: true });

const characterSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['lead', 'support', 'antagonist', 'minor'], default: 'support' },
  avatar: { type: String, default: '' },
  meta: { type: String, default: '' },
  bio: { type: String, default: '' },
  arc: { type: String, default: '' },
  traits: { type: [String], default: [] },
}, { timestamps: true });

const plotSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, unique: true },
  acts: [{ name: String, range: String, summary: String, beats: [String], status: { type: String, enum: ['planned', 'written'], default: 'planned' } }],
  roadmap: [{ range: String, title: String, desc: String, status: { type: String, enum: ['planned', 'written'], default: 'planned' } }],
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  icon: { type: String, default: '' },
  bg: { type: String, default: '' },
  color: { type: String, default: '' },
  desc: { type: String, default: '' },
  tagline: { type: String, default: '' },
  cover: { type: String, default: '' },
  // Crew belongs to the BOARD, never to a genre inside it.
  adminIds: { type: [String], default: [] },
  moderatorIds: { type: [String], default: [] },
  // Board house-rules: ordered rule lines the hub editor CRUDs and the pinned
  // rules thread renders. Lives on the BOARD, not on a genre inside it.
  rules: { type: [String], default: [] },
  // Admin-console flagging of the board itself (genre-boards page), mirroring
  // the book flag: the reason is required, the note optional.
  flagReason: { type: String, default: '' },
  flagNote: { type: String, default: '' },
  flaggedBy: { type: String, default: null },
  flaggedAt: { type: Date, default: null },
  booksCount: { type: Number, default: 0 },
  membersCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

const genreSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true, index: true },
  categoryId: { type: String, ref: 'Category', required: true, index: true },
  desc: { type: String, default: '' },
  tagline: { type: String, default: '' },
  about: { type: mongoose.Schema.Types.Mixed, default: null },
  icon: { type: String, default: '' },
  cover: { type: String, default: '' },
  bg: { type: String, default: '' },
  color: { type: String, default: '' },
  booksCount: { type: Number, default: 0 },
  membersCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

// NOTE: genres carry no crew. A genre is a section inside a board; the board
// (Category) holds the single admin + moderator team for all of its children.
const genreMembershipSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  genreId: { type: String, ref: 'Genre', required: true, index: true },
}, { timestamps: true });
genreMembershipSchema.index({ userId: 1, genreId: 1 }, { unique: true });

// Tropes: managed catalog, child of genre (CE categories/genres module).
// Books carry trope NAMES (validated active on write).
const tropeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true, index: true },
  genre: { type: String, default: '', index: true }, // parent genre name
  desc: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

const categoryMembershipSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  categoryId: { type: String, ref: 'Category', required: true, index: true },
}, { timestamps: true });
categoryMembershipSchema.index({ userId: 1, categoryId: 1 }, { unique: true });

// Daily reads snapshot per book (powers true Rising = reads last 7d).
// One doc per (bookId, day). Pruned automatically after 120 days.
const bookDailyStatSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  day: { type: String, required: true, index: true }, // YYYY-MM-DD UTC
  reads: { type: Number, default: 0 },
  finishes: { type: Number, default: 0 },
}, { timestamps: true });
bookDailyStatSchema.index({ bookId: 1, day: 1 }, { unique: true });
bookDailyStatSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 86400 });

module.exports = {
  Book: mongoose.model('Book', bookSchema),
  Chapter: mongoose.model('Chapter', chapterSchema),
  EngagementVote: mongoose.model('EngagementVote', engagementVoteSchema),
  Character: mongoose.model('Character', characterSchema),
  Plot: mongoose.model('Plot', plotSchema),
  Category: mongoose.model('Category', categorySchema),
  Genre: mongoose.model('Genre', genreSchema),
  Trope: mongoose.model('Trope', tropeSchema),
  GenreMembership: mongoose.model('GenreMembership', genreMembershipSchema),
  CategoryMembership: mongoose.model('CategoryMembership', categoryMembershipSchema),
  BookDailyStat: mongoose.model('BookDailyStat', bookDailyStatSchema),
};
