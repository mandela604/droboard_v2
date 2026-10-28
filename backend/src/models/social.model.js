/**
 * models/social.model.js — posts, comments, discussions, collections,
 * library, follows, notifications, statuses, messaging, referrals, reading.
 */
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['announcement', 'post', 'debate', 'shoutout', 'repost', 'poll', 'forum-poll', 'ama', 'review', 'recommendation', 'quote', 'chapter-drop'], required: true, index: true },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  note: { type: String, default: '' },
  heading: { type: String, default: '' }, // text posts: optional bold heading (post-card)
  image: { type: String, default: '' }, // upload or URL (post + announcement)
  pinned: { type: Boolean, default: false, index: true },
  likesCount: { type: Number, default: 0 },
  likedBy: [{ type: String, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },
  savedBy: [{ type: String, ref: 'User' }],
  reactions: { type: Map, of: Number, default: {} }, // rid -> count (per-user state in Reaction)
  sharesCount: { type: Number, default: 0 },
  sharesByChannel: { type: Map, of: Number, default: {} }, // channel -> count
  poll: { q: String, opts: [{ t: String, v: { type: Number, default: 0 } }], total: { type: Number, default: 0 }, votedBy: [{ type: String }] },
  // debate posts (feed/profile/droboard composers): droboard sends {motion},
  // feed sends {question,prompt,forText,againstText} — both stored; renderer
  // reads motion||question and forText/againstText defaults in post-card.
  debateData: { motion: String, question: String, prompt: String, forText: String, againstText: String, forV: { type: Number, default: 0 }, agV: { type: Number, default: 0 } },
  shoutout: {
    userId: { type: String, ref: 'User' }, id: String, name: String, avatar: String,
    handle: String, tagline: String, role: String, stats: { type: mongoose.Schema.Types.Mixed, default: null },
    readingHours: Number, chaptersRead: Number, streak: Number, following: Boolean,
  },
  // quote posts (feed composer): quote + caption + bg hints (post-card styles)
  quote: { type: String, default: '' },
  caption: { type: String, default: '' },
  quoteBg: { type: String, default: '' },
  quoteBgCss: { type: String, default: '' },
  // chapter-drop posts (feed composer): dropped-chapter story card
  chapterRef: { id: String, title: String, author: String, cover: String, ch: String, cat: String },
  storyRef: { id: String, title: String, cat: String, writer: String, cover: String },
  // review posts: star score + review body (post-card renders both)
  score: { type: Number, default: 0 },
  reviewText: { type: String, default: '' },
  amaData: { isLive: Boolean, viewers: Number, title: String, meta: String },
  // moderation (super-admin all-posts console; default keeps reader API unchanged)
  status: { type: String, enum: ['published', 'flagged', 'under-review', 'removed'], default: 'published', index: true },
}, { timestamps: true });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });

const commentSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  scope: { type: String, enum: ['story', 'chapter', 'post', 'discussion'], required: true },
  storyId: { type: String, ref: 'Book', index: true },
  chapterId: { type: String, ref: 'Chapter', index: true },
  postId: { type: String, ref: 'Post', index: true },
  discussionId: { type: String, ref: 'Discussion', default: null, index: true }, // scope=discussion target
  parentId: { type: String, ref: 'Comment', default: null, index: true },
  text: { type: String, required: true },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: String, ref: 'User' }],
  reactions: { type: Map, of: Number, default: {} }, // rid -> count (per-user state in Reaction)
  reactions: { type: Map, of: Number, default: {} },
  team: { type: String, default: null },
  edited: { type: Boolean, default: false },
  repliesCount: { type: Number, default: 0 },
}, { timestamps: true });
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ chapterId: 1, createdAt: -1 });

const discussionSchema = new mongoose.Schema({
  genreId: { type: String, ref: 'Genre', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  tag: { type: String, enum: ['discussion', 'recommendation', 'theory', 'question', 'controversial'], default: 'discussion', index: true },
  media: { type: String, default: '' },
  trope: { type: String, default: '' }, // genre-hub composer: optional trope
  story: { type: mongoose.Schema.Types.Mixed, default: null }, // genre-hub composer: optional linked story {id,title,writer,cover,cat}
  score: { type: Number, default: 0 },
  hot: { type: Boolean, default: false, index: true },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: String, ref: 'User' }], // per-user like toggle state (matches Post/Comment)
  commentsCount: { type: Number, default: 0 },
}, { timestamps: true });

const collectionSchema = new mongoose.Schema({
  ownerId: { type: String, ref: 'User', required: true, index: true },
  title: { type: String, required: true, index: 'text' },
  sub: { type: String, default: '' },
  about: { type: String, default: '' },
  cover: { type: String, default: '' },
  icon: { type: String, default: '' }, // collection icon for save-modal display
  privacy: { type: String, enum: ['public', 'private', 'followers'], default: 'public', index: true },
  stories: [{ type: String, ref: 'Book' }],
  storiesCount: { type: Number, default: 0 },
  followers: { type: Number, default: 0 },
  visits: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  sharesByChannel: { type: Map, of: Number, default: {} }, // channel -> count
  genres: { type: [String], default: [] },
}, { timestamps: true });

// Follows on collections (separate from user Follow: collectionId refs Collection.id).
const collectionFollowSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  collectionId: { type: String, ref: 'Collection', required: true, index: true },
}, { timestamps: true });
collectionFollowSchema.index({ userId: 1, collectionId: 1 }, { unique: true });

const libraryItemSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  storyId: { type: String, ref: 'Book', required: true, index: true },
  list: { type: String, enum: ['library', 'saved', 'history', 'continue', 'later'], required: true, index: true },
  status: { type: String, enum: ['progress', 'finished', 'unread', 'saved'], default: 'unread', index: true },
  currentChN: { type: Number, default: 0 },
  pct: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });
libraryItemSchema.index({ userId: 1, storyId: 1, list: 1 }, { unique: true });

const followSchema = new mongoose.Schema({
  followerId: { type: String, ref: 'User', required: true, index: true },
  followingId: { type: String, ref: 'User', required: true, index: true },
}, { timestamps: true });
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

const blockSchema = new mongoose.Schema({
  blockerId: { type: String, ref: 'User', required: true, index: true },
  blockedId: { type: String, ref: 'User', required: true, index: true },
}, { timestamps: true });
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

const muteSchema = new mongoose.Schema({
  muterId: { type: String, ref: 'User', required: true, index: true },
  mutedId: { type: String, ref: 'User', required: true, index: true },
}, { timestamps: true });
muteSchema.index({ muterId: 1, mutedId: 1 }, { unique: true });

const notificationSchema = new mongoose.Schema({
  recipientId: { type: String, ref: 'User', required: true, index: true },
  actorId: { type: String, ref: 'User' },
  type: { type: String, required: true, index: true }, // like|chapter|reply|mention|coins|follow|contract|tip|payout|security…
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  link: { type: String, default: '' },
  thumb: { type: String, default: '' },
  unread: { type: Boolean, default: true, index: true },
}, { timestamps: true });
notificationSchema.index({ recipientId: 1, unread: 1, createdAt: -1 });

const statusSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  bg: { type: String, required: true },
  quote: { type: String, default: '' },
  caption: { type: String, default: '' },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: String, ref: 'User' }],
  viewedBy: [{ type: String, ref: 'User' }], // per-viewer read tracking (story ring)
  // Append-only view log behind the owner's "seen by" list. `user` is the
  // account id, `anon` the persistent guest id (localStorage) for signed-out
  // viewers; one record per viewer, capped so a viral story stays small.
  viewerRecords: [{
    user: { type: String, default: '' },
    anon: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  isLive: { type: Boolean, default: false },
  viewed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
statusSchema.index({ userId: 1, createdAt: -1 });

const conversationSchema = new mongoose.Schema({
  participants: [{ type: String, ref: 'User', index: true }],
  preview: { type: String, default: '' },
  unreadBy: [{ type: String, ref: 'User' }],
  // Senior-editor inbox controls (persisted; previously write-only in memory).
  flagged: { type: Boolean, default: false },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, ref: 'Conversation', required: true, index: true },
  senderId: { type: String, ref: 'User', required: true, index: true },
  fromRole: { type: String, enum: ['author', 'editor', 'admin', 'user'], default: 'user' },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  read: { type: Boolean, default: false },
}, { timestamps: true });
messageSchema.index({ conversationId: 1, createdAt: 1 });

// Referrals: inviter-only staged rewards (+3 on signup, +2 at 30-min read
// within 7 days). One doc per (inviter, invitee); code is the inviter's
// reusable User.referralCode (NOT unique here — many invitees share it).
const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true },
  ownerId: { type: String, ref: 'User', required: true, index: true }, // referrer
  referredUserId: { type: String, ref: 'User', default: null, index: true },
  referredHandle: { type: String, default: '' },
  status: { type: String, enum: ['invited', 'joined'], default: 'invited', index: true },
  signupRewarded: { type: Boolean, default: false }, // +3 done
  readRewarded: { type: Boolean, default: false }, // +2 done
  earnedCoins: { type: Number, default: 0 },
}, { timestamps: true });
referralSchema.index({ ownerId: 1, referredUserId: 1 }, { unique: true, sparse: true });

// Per-chapter reading progress + sessions (powers subscriptions + streaks).
// secondsSpent backs the subscription rule: a chapter counts as "read" for
// pool distribution only when a premium subscriber spends >= 180s on it.
const readingProgressSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  storyId: { type: String, ref: 'Book', required: true, index: true },
  chapterId: { type: String, ref: 'Chapter', index: true },
  pct: { type: Number, default: 0, min: 0, max: 100 },
  finished: { type: Boolean, default: false, index: true },
  wordsRead: { type: Number, default: 0 },
  secondsSpent: { type: Number, default: 0, min: 0 }, // accumulated read time
  lastReadAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
readingProgressSchema.index({ userId: 1, storyId: 1, chapterId: 1 }, { unique: true });

// Per-user reaction state (picker shows one active rid per user per target).
// Denormalized counts live on Post.reactions / Comment.reactions maps.
const reactionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  targetType: { type: String, required: true, index: true }, // like|chapter|reply|mention|coins|follow|contract|tip|payout|security.
  targetId: { type: String, required: true, index: true },
  rid: { type: String, required: true },
}, { timestamps: true });
reactionSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

// Per-user share log (powers Sharers segment + share analytics).
// Counters stay denormalized on Post/Collection; this is the per-user trail.
const shareEventSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['post', 'comment', 'collection', 'story'], required: true, index: true },
  targetId: { type: String, required: true, index: true },
  channel: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });
shareEventSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

// Per-user content impressions ("which posts did this reader see").
// One row per user+target+day with a repeat count — deduped daily so a
// scroll-past and a re-open both count once per view event.
const contentImpressionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['post', 'discussion', 'story'], required: true, index: true },
  targetId: { type: String, required: true, index: true },
  day: { type: String, required: true }, // YYYY-MM-DD UTC
  count: { type: Number, default: 1 },
}, { timestamps: { createdAt: true, updatedAt: false } });
contentImpressionSchema.index({ userId: 1, targetType: 1, targetId: 1, day: 1 }, { unique: true });
contentImpressionSchema.index({ userId: 1, createdAt: -1 });

// Per-book star rating (rate-modal: stars + optional text + spoiler flag).
// One row per user per book; Book.rating/ratingCount are the denormalized avg.
const bookRatingSchema = new mongoose.Schema({
  bookId: { type: String, ref: 'Book', required: true, index: true },
  userId: { type: String, ref: 'User', required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, default: '' },
  spoiler: { type: Boolean, default: false },
}, { timestamps: true });
bookRatingSchema.index({ bookId: 1, userId: 1 }, { unique: true });

// Surface analytics hits (insights-service.js / shared/insights-tracker.js):
// hub|droboard|profile|collection per target, one row per (surface, target,
// day, user) so charts can bucket by day. Anonymous hits have userId null.
const insightHitSchema = new mongoose.Schema({
  surface: { type: String, required: true, index: true }, // hub|droboard|profile|collection
  targetId: { type: String, default: '', index: true },
  userId: { type: String, ref: 'User', default: null, index: true },
  country: { type: String, default: '' },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  count: { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });
insightHitSchema.index({ surface: 1, targetId: 1, day: 1, userId: 1 }, { unique: true });

module.exports = {
  Post: mongoose.model('Post', postSchema),
  Comment: mongoose.model('Comment', commentSchema),
  Discussion: mongoose.model('Discussion', discussionSchema),
  Collection: mongoose.model('Collection', collectionSchema),
  CollectionFollow: mongoose.model('CollectionFollow', collectionFollowSchema),
  LibraryItem: mongoose.model('LibraryItem', libraryItemSchema),
  Follow: mongoose.model('Follow', followSchema),
  Block: mongoose.model('Block', blockSchema),
  Mute: mongoose.model('Mute', muteSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Status: mongoose.model('Status', statusSchema),
  Conversation: mongoose.model('Conversation', conversationSchema),
  Message: mongoose.model('Message', messageSchema),
  Referral: mongoose.model('Referral', referralSchema),
  ReadingProgress: mongoose.model('ReadingProgress', readingProgressSchema),
  Reaction: mongoose.model('Reaction', reactionSchema),
  ShareEvent: mongoose.model('ShareEvent', shareEventSchema),
  ContentImpression: mongoose.model('ContentImpression', contentImpressionSchema),
  BookRating: mongoose.model('BookRating', bookRatingSchema),
  InsightHit: mongoose.model('InsightHit', insightHitSchema),
};
