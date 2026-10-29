/**
 * models/money.model.js — wallets, double-entry ledger, store catalog,
 * transactions, withdrawals, payouts, bonuses, referrals rewards.
 * RULE: balances derived from ledger; never mutate a balance directly.
 * Every coin movement carries a unique idempotencyKey.
 */
const mongoose = require('mongoose');
const ids = require('./ids');

const walletSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['reader', 'author'], default: 'reader' },
  // Spendable balance. bonusBalance is a TAGGED SUBSET of it, never added on
  // top: the coins with no cash behind them (pack bonus, earn tasks, referral
  // rewards). Bonus reads chapters — drawing bonus first, with no writer/
  // editor/marketing split for that part — and nothing else: a tip or gift
  // refuses when the bought part can't cover it (bonus_no_tip). So free coins
  // can neither be laundered into withdrawable author cash nor given away as
  // if they were money. No expiry job — it is an attribution marker, not a clock.
  coinBalance: { type: Number, default: 0, min: 0 },
  bonusBalance: { type: Number, default: 0, min: 0 },
  lifetimeEarned: { type: Number, default: 0 }, // fiat credited as writer, base currency
  // What the author can actually withdraw: writer share of sales/tips, less
  // payouts already settled. Cached balance of ledger account wallet:author:{id}.
  fiatAvail: { type: Number, default: 0 },
  currency: { type: String, default: 'NGN' },
  // ADDITIVE (finance console): operator-scheduled next payout for an author.
  nextPayoutAt: { type: Date, default: null },
  nextPayoutAmount: { type: Number, default: 0 },
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
ledgerEntrySchema.index({ debitAcct: 1, kind: 1, createdAt: -1 }); // tip/unlock segment lookups

const coinPackSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  coins: { type: Number, required: true },
  bonusPct: { type: Number, default: 0 },
  // Display legs (e.g. { NGN: '₦15,000', USD: '$9.99', GBP: '£7.99' }) — the
  // store/currency UI renders these verbatim, so values are Mixed, not Number.
  // payments-verify.legFor() parses them before amount comparison.
  prices: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }, // ISO currency -> display leg
  basePriceNGN: { type: Number, required: true }, // 100 coins = 1500
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: null }, // UI extras (badge/color/icon)
}, { timestamps: true });

const coinBundleSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  coins: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  basePriceNGN: { type: Number, required: true },
  prices: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }, // ISO currency -> display leg (Mixed: see CoinPack)
  icon: { type: String, default: '' },
  color: { type: String, default: '' },
  status: { type: String, default: 'active' },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

const subscriptionPlanSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // sub-daily|weekly|monthly|yearly|merge
  name: { type: String, required: true },
  period: { type: String, enum: ['day', 'week', 'month', 'year'], required: true },
  durationDays: { type: Number, required: true },
  basePriceNGN: { type: Number, required: true },
  prices: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }, // ISO currency -> display leg (Mixed: see CoinPack)
  features: { type: [String], default: [] },
  badge: { type: String, default: '' },
  // The store card is the plan, the colour and the icon, so those are stored
  // with it — the finance console is what sets them.
  icon: { type: String, default: '' },
  color: { type: String, default: '' },
  // ADDITIVE (finance console): daily coin grant + bonus % the
  // coin-transactions subscriptions tab renders (coinsPerDay, bonusPercent).
  coinsPerDay: { type: Number, default: 0 },
  bonusPercent: { type: Number, default: 0 },
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
  // Type list lives in services/earn-rules.js so the save-time validator, the
  // store catalog and this schema can never drift apart.
  type: { type: String, enum: require('../services/earn-rules').TYPES, required: true, index: true },
  coins: { type: Number, required: true },
  cooldown: { type: String, default: '' },
  pagesRequired: { type: Number, default: 0 },
  status: { type: String, default: 'active' },
  meta: { type: mongoose.Schema.Types.Mixed, default: null }, // UI extras (icon/blog/channel)
}, { timestamps: true });

const coinTransactionSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  // purchase/subscription = money in, spend/gift/tip = coins out,
  // earn = reward claim, refund = reversal.
  type: { type: String, enum: ['purchase', 'gift', 'tip', 'spend', 'earn', 'subscription', 'refund'], required: true, index: true },
  coins: { type: Number, required: true },
  fiatAmount: { type: Number, required: true },
  fiatCurrency: { type: String, default: 'NGN' },
  // Web channels are recorded as the provider that actually took the money.
  channel: { type: String, enum: ['play', 'appstore', 'web', 'paystack', 'flutterwave', 'reward'], default: 'web' },
  storeRef: { type: String, default: '' }, // Play/AppStore purchase token (verified)
  // Store commission withheld at purchase, per channel, and the cash the
  // channel actually settles. 0 for spends/earn; both are purchase-only.
  feeAmount: { type: Number, default: 0 },
  netAmount: { type: Number, default: 0 },
  // NGN value credited to the reader (coins x face) and any amount the reader
  // paid above that value — the international premium platform keeps.
  faceAmount: { type: Number, default: 0 },
  surplusAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'refunded', 'failed'], default: 'completed', index: true },
  note: { type: String, default: '' },
}, { timestamps: true });
coinTransactionSchema.index({ userId: 1, createdAt: -1 });

// Earn-claim cooldown ledger: one row per (user, reward code) so "watch ad
// every 5 min" is enforced server-side instead of by whatever the tab says.
const earnClaimSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  code: { type: String, required: true, index: true },
  type: { type: String, default: '' },
  coins: { type: Number, default: 0 },
  claimCount: { type: Number, default: 1 },
  lastClaimedAt: { type: Date, default: Date.now },
  // The task the reader started but has not claimed yet: { h: hash of a
  // single-use nonce, at: issued ms, exp: deadline ms }. Cleared by a
  // successful claim, so a token cannot be spent twice or replayed.
  pending: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });
earnClaimSchema.index({ userId: 1, code: 1 }, { unique: true });

// Chapter ownership: the reader's right to read a paid chapter, held by the
// server instead of in whatever the device happens to have cached. The unique
// triple is also the double-charge guard — an unlock that already exists is
// free, and the insert cannot race itself into two payments.
const entitlementSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  bookId: { type: String, ref: 'Book', required: true, index: true },
  chapterId: { type: String, required: true },
  // coin = paid from the wallet, ad = paid with a rewarded video, free = chapter
  // priced 0, subscription = granted by an active plan (not used yet — plans
  // buy ad-free, not unlocks).
  kind: { type: String, enum: ['coin', 'ad', 'free', 'subscription'], default: 'coin' },
  priceCoins: { type: Number, default: 0 },
  // The ledger journal this purchase was gated by, for auditing.
  journalId: { type: String, default: '' },
}, { timestamps: { createdAt: 'unlockedAt', updatedAt: false } });
entitlementSchema.index({ userId: 1, bookId: 1, chapterId: 1 }, { unique: true });

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
  routingCode: { type: String, default: '' },
  email: { type: String, default: '' },
  provider: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
}, { timestamps: true });
paymentMethodSchema.index({ authorId: 1, isDefault: 1 });

const paymentDisputeSchema = new mongoose.Schema({
  // A dispute can come from either side: an author about their earnings, or a
  // reader about a store purchase. authorId stays for the author case; userId
  // carries the reader case so both land on the one finance queue.
  authorId: { type: String, ref: 'User', index: true },
  userId: { type: String, ref: 'User', index: true },
  who: { type: String, default: '' },   // display name shown on the finance row
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['reader', 'author', 'staff'], default: 'author' },
  item: { type: String, default: '' },  // what was bought/charged, e.g. "5,000 coins — ₦6,000"
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

// Store catalog audit trail (finance console: coin packages / bundles /
// gifts / earn / subscriptions). Separate from ActivityLog so the console can
// list catalog edits without scanning platform-wide activity.
const storeConfigLogSchema = new mongoose.Schema({
  action: { type: String, enum: ['created', 'updated', 'deleted', 'activated', 'deactivated'], required: true, index: true },
  itemType: { type: String, enum: ['package', 'bundle', 'gift', 'earn', 'subscription'], required: true, index: true },
  itemName: { type: String, default: '' },
  actor: { type: String, default: '' },
  actorId: { type: String, ref: 'User', default: '' },
  details: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
storeConfigLogSchema.index({ at: -1 });

// Public ids (models/ids.js): the finance and author consoles address these
// rows by a stored uuidv7 `id`, never by Mongo `_id`. Without the path, every
// {id: …} lookup silently matched nothing and every row key read back undefined.
[coinTransactionSchema, authorTransactionSchema, withdrawalSchema, payoutSchema,
  paymentMethodSchema, paymentDisputeSchema, storeConfigLogSchema].forEach(ids.plugin);

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
  EarnClaim: mongoose.model('EarnClaim', earnClaimSchema),
  Entitlement: mongoose.model('Entitlement', entitlementSchema),
  AuthorTransaction: mongoose.model('AuthorTransaction', authorTransactionSchema),
  Withdrawal: mongoose.model('Withdrawal', withdrawalSchema),
  Payout: mongoose.model('Payout', payoutSchema),
  PaymentMethod: mongoose.model('PaymentMethod', paymentMethodSchema),
  PaymentDispute: mongoose.model('PaymentDispute', paymentDisputeSchema),
  Bonus: mongoose.model('Bonus', bonusSchema),
  StoreConfigLog: mongoose.model('StoreConfigLog', storeConfigLogSchema),
};
