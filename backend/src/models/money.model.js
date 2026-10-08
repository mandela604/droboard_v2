/**
 * models/money.model.js — wallets, double-entry ledger, store catalog,
 * transactions, withdrawals, payouts, bonuses, referrals rewards.
 * RULE: balances derived from ledger; never mutate a balance directly.
 * Every coin movement carries a unique idempotencyKey.
 */
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['reader', 'author'], default: 'reader' },
  // spendable balance (purchased + bonus). Bonus tracked separately for expiry.
  coinBalance: { type: Number, default: 0, min: 0 },
  bonusBalance: { type: Number, default: 0, min: 0 }, // spend-only, 90-day expiry
  bonusExpiresAt: { type: Date, default: null },
  lifetimeEarned: { type: Number, default: 0 }, // fiat credited as writer, base currency
  currency: { type: String, default: 'NGN' },
  level: { type: String, default: 'Starter' },
}, { timestamps: true });
walletSchema.index({ userId: 1, kind: 1 }, { unique: true });

// Double-entry ledger — append-only. Reverse with a new entry, never update.
const ledgerEntrySchema = new mongoose.Schema({
  entryId: { type: String, required: true, unique: true },
  journalId: { type: String, required: true, index: true }, // groups both legs
  debitAcct: { type: String, required: true }, // e.g. wallet:usr_x, pool:editors
  creditAcct: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 }, // base currency (NGN)
  coins: { type: Number, default: 0 },
  authorId: { type: String, ref: 'User', index: true },
  saleId: { type: String, index: true },
  kind: { type: String, default: '' }, // sale|spend|referral|ad_settle|payout|bonus|fx_premium|breakage
  configVersion: { type: Number, default: null }, // revenue config stamped at write
  idempotencyKey: { type: String, required: true, unique: true },
  memo: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });
ledgerEntrySchema.index({ authorId: 1, createdAt: -1 });

const coinPackSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  coins: { type: Number, required: true },
  bonusPct: { type: Number, default: 0 },
  prices: { type: Map, of: Number, default: {} }, // countryCode -> local price
  basePriceNGN: { type: Number, required: true }, // 100 coins = 1500
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

const coinBundleSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  coins: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  basePriceNGN: { type: Number, required: true },
  icon: { type: String, default: '' },
  color: { type: String, default: '' },
  status: { type: String, default: 'active' },
}, { timestamps: true });

const subscriptionPlanSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // sub-daily|weekly|monthly|yearly|merge
  name: { type: String, required: true },
  period: { type: String, enum: ['day', 'week', 'month', 'year'], required: true },
  durationDays: { type: Number, required: true },
  basePriceNGN: { type: Number, required: true },
  features: { type: [String], default: [] },
  badge: { type: String, default: '' },
  status: { type: String, default: 'active' },
}, { timestamps: true });

const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  planCode: { type: String, required: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active', index: true },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  autoRenew: { type: Boolean, default: false },
}, { timestamps: true });

// Monthly subscription read pool: finished chapters per author per subscriber
const subscriptionReadSchema = new mongoose.Schema({
  period: { type: String, required: true, index: true }, // YYYY-MM
  userId: { type: String, ref: 'User', required: true, index: true },
  authorId: { type: String, ref: 'User', required: true, index: true },
  chaptersFinished: { type: Number, default: 0 },
  coinValue: { type: Number, default: 0 }, // chapter coins × 10 NGN face
}, { timestamps: true });
subscriptionReadSchema.index({ period: 1, authorId: 1 });

const giftSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String, default: '' },
  costCoins: { type: Number, required: true },
  color: { type: String, default: '' },
  desc: { type: String, default: '' },
  status: { type: String, default: 'active' },
}, { timestamps: true });

const earnRewardSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  type: { type: String, enum: ['watch_ad', 'checkin', 'rate', 'share', 'blog_read', 'youtube_sub', 'youtube_watch'], required: true, index: true },
  coins: { type: Number, required: true },
  cooldown: { type: String, default: '' },
  pagesRequired: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
}, { timestamps: true });

const coinTransactionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['purchase', 'gift', 'subscription', 'refund'], required: true, index: true },
  coins: { type: Number, required: true },
  fiatAmount: { type: Number, required: true },
  fiatCurrency: { type: String, default: 'NGN' },
  channel: { type: String, enum: ['play', 'appstore', 'web'], default: 'web' },
  storeRef: { type: String, default: '' }, // Play/AppStore purchase token (verified)
  status: { type: String, enum: ['completed', 'refunded', 'failed'], default: 'completed', index: true },
  note: { type: String, default: '' },
}, { timestamps: true });
coinTransactionSchema.index({ userId: 1, createdAt: -1 });

const authorTransactionSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['earned', 'bonus', 'withdrawal', 'adjustment'], required: true, index: true },
  desc: { type: String, required: true },
  amount: { type: Number, required: true }, // +credit / -debit, base currency
  bookId: { type: String, ref: 'Book' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
}, { timestamps: true });
authorTransactionSchema.index({ authorId: 1, type: 1 });

// Withdrawals: requested → under_review → approved → paid (human approval mandatory)
const withdrawalSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 100 },
  method: { type: String, enum: ['Bank Transfer', 'PayPal', 'Mobile Money', 'Wire Transfer'], required: true },
  paymentMethodId: { type: String, ref: 'PaymentMethod' },
  account: { type: String, required: true },
  status: { type: String, enum: ['requested', 'under_review', 'approved', 'paid', 'declined', 'failed'], default: 'requested', index: true },
  note: { type: String, default: '' },
  reviewedBy: { type: String, ref: 'User', default: null },
  processedAt: { type: Date, default: null },
}, { timestamps: { createdAt: 'requestedAt', updatedAt: true } });
withdrawalSchema.index({ status: 1, requestedAt: -1 });

const payoutSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  recipient: { type: String, required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
  reference: { type: String, unique: true, sparse: true },
  failReason: { type: String, default: '' },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

const paymentMethodSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['bank', 'paypal', 'mobile'], required: true },
  accountName: { type: String, required: true },
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '', select: false }, // masked on read
  email: { type: String, default: '' },
  provider: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
}, { timestamps: true });
paymentMethodSchema.index({ authorId: 1, isDefault: 1 });

const paymentDisputeSchema = new mongoose.Schema({
  authorId: { type: String, ref: 'User', index: true },
  transactionId: { type: String, index: true },
  withdrawalId: { type: String, ref: 'Withdrawal' },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'rejected'], default: 'open', index: true },
  resolutionNote: { type: String, default: '' },
  replies: [{ from: String, message: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

const bonusSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['Performance', 'Milestone', 'Onboarding', 'Contest', 'Loyalty'], required: true },
  criteria: { type: String, default: '' },
  amountEach: { type: Number, required: true },
  recipients: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'scheduled', 'distributed'], default: 'draft', index: true },
  date: { type: Date },
  createdBy: { type: String, ref: 'User' },
}, { timestamps: true });

module.exports = {
  Wallet: mongoose.model('Wallet', walletSchema),
  LedgerEntry: mongoose.model('LedgerEntry', ledgerEntrySchema),
  CoinPack: mongoose.model('CoinPack', coinPackSchema),
  CoinBundle: mongoose.model('CoinBundle', coinBundleSchema),
  SubscriptionPlan: mongoose.model('SubscriptionPlan', subscriptionPlanSchema),
  Subscription: mongoose.model('Subscription', subscriptionSchema),
  SubscriptionRead: mongoose.model('SubscriptionRead', subscriptionReadSchema),
  Gift: mongoose.model('Gift', giftSchema),
  EarnReward: mongoose.model('EarnReward', earnRewardSchema),
  CoinTransaction: mongoose.model('CoinTransaction', coinTransactionSchema),
  AuthorTransaction: mongoose.model('AuthorTransaction', authorTransactionSchema),
  Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
  Payout: mongoose.model('Payout', payoutSchema),
  PaymentMethod: mongoose.model('PaymentMethod', paymentMethodSchema),
  PaymentDispute: mongoose.model('PaymentDispute', paymentDisputeSchema),
  Bonus: mongoose.model('Bonus', bonusSchema),
};
