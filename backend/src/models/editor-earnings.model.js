/**
 * models/editor-earnings.model.js — senior-editor pay.
 * One accrual row per payable event, one withdrawal row per request. Both
 * carry the custom uuidv7 `id` via the global ids plugin; the ledger is the
 * balance authority (debit the funding pool, credit liability:editor:<id>).
 *
 * `editorId + sourceType + sourceId` is unique: a retried author credit can
 * never pay the same commission twice, and a monthly bill can only be minted
 * once per period.
 */
const mongoose = require('mongoose');

const editorEarningSchema = new mongoose.Schema({
  editorId: { type: String, ref: 'User', required: true, index: true },
  authorId: { type: String, ref: 'User', default: '', index: true }, // '' for fixed monthly
  sourceType: {
    type: String,
    enum: ['revenue_share', 'tip_share', 'fixed_monthly', 'adjustment'],
    required: true, index: true,
  },
  sourceId: { type: String, default: '' }, // AuthorTransaction.id, or YYYY-MM for fixed
  bookId: { type: String, ref: 'Book', default: '' },
  baseAmount: { type: Number, default: 0 }, // what the author was credited
  rate: { type: Number, default: 0 },       // pct of baseAmount (0 for fixed)
  amount: { type: Number, required: true }, // commission owed, base currency
  currency: { type: String, default: 'NGN' },
  fund: { type: String, enum: ['editors', 'platform'], default: 'editors' },
  period: { type: String, default: '', index: true }, // YYYY-MM
  // accrued = owed and withdrawable; void = reversed with a contra ledger leg.
  // Withdrawals are tracked separately, so an earning never changes to "paid".
  status: { type: String, enum: ['accrued', 'void'], default: 'accrued', index: true },
  note: { type: String, default: '' },
  createdBy: { type: String, ref: 'User', default: null },
}, { timestamps: true });

editorEarningSchema.index({ editorId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
editorEarningSchema.index({ editorId: 1, createdAt: -1 });
editorEarningSchema.index({ status: 1, createdAt: -1 });
editorEarningSchema.index({ period: 1, editorId: 1 });

// An editor withdraws like an author: request → finance approves → paid.
const editorPayoutSchema = new mongoose.Schema({
  editorId: { type: String, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'NGN' },
  method: { type: String, default: '' },    // display label from PaymentMethod
  methodId: { type: String, default: '' },
  account: { type: String, default: '' },   // masked account, as the author flow stores it
  status: { type: String, enum: ['requested', 'approved', 'paid', 'declined'], default: 'requested', index: true },
  reference: { type: String, default: '' },
  note: { type: String, default: '' },
  declineReason: { type: String, default: '' },
  reviewedBy: { type: String, ref: 'User', default: null },
  processedBy: { type: String, ref: 'User', default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

editorPayoutSchema.index({ editorId: 1, createdAt: -1 });
editorPayoutSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  EditorEarning: mongoose.model('EditorEarning', editorEarningSchema),
  EditorPayout: mongoose.model('EditorPayout', editorPayoutSchema),
};
