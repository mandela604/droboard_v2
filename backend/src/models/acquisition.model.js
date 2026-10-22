'use strict';
/* models/acquisition.model.js — paid-acquisition attribution store for the
 * backend contract documented in public/services/acquisition-service.js:
 *   GET  /api/acquisition/summary?days=30   cohorts + spend + P&L per campaign
 *   GET  /api/acquisition/spend             manual spend ledger
 *   POST /api/acquisition/spend   { date, campaignId, amount, note }
 *   POST /api/acquisition/events  { type, visitorId, campaignId, meta }
 * Events are one row per (visitor, touch) — cohorts (firstDate, registered,
 * firstRead, meaningfulRead, pages, impressions, purchase, d7) are derived
 * from them server-side, matching the console's grouping fields. */
const mongoose = require('mongoose');

const acquisitionEventSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, index: true },
  campaignId: { type: String, default: 'direct', index: true },
  type: {
    type: String,
    enum: ['landing', 'return_visit', 'sign_up', 'story_open', 'chapter_read', 'coin_purchase'],
    default: 'landing',
  },
  storyId: { type: String, default: '' },
  amount: { type: Number, default: 0 }, // attributed coin purchase, USD
  coins: { type: Number, default: 0 },
  pages: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 }, // ad impressions seen on the touch
  ts: { type: Date, default: Date.now },
  date: { type: String, default: '' }, // YYYY-MM-DD (touch day)
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
acquisitionEventSchema.index({ visitorId: 1, campaignId: 1, date: 1 });

const acquisitionSpendSchema = new mongoose.Schema({
  date: { type: String, default: '' }, // YYYY-MM-DD
  campaignId: { type: String, required: true, index: true },
  amount: { type: Number, default: 0 },
  note: { type: String, default: '' },
}, { timestamps: true });
acquisitionSpendSchema.index({ date: 1, campaignId: 1 });

module.exports = {
  AcquisitionEvent: mongoose.model('AcquisitionEvent', acquisitionEventSchema),
  AcquisitionSpend: mongoose.model('AcquisitionSpend', acquisitionSpendSchema),
};
