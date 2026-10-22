'use strict';
/**
 * models/marketing.model.js — marketing console state.
 * Campaign rows carry the EXACT field names campaigns-page-service.js
 * renders (name, status, story* fields, placements, startDate, endDate,
 * budget, ...), so no adapter layer is needed between console and DB.
 *
 * League config is the reader-league policy the console edits
 * (marketing-data.js getLeagueConfig/saveLeagueConfig) and the reader
 * league-service reads weights from.
 */
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // console filter pills: all|live|scheduled|draft|paused|ended
  status: { type: String, enum: ['live', 'scheduled', 'draft', 'paused', 'ended'], default: 'draft', index: true },
  type: { type: String, default: 'story' },
  objective: { type: String, default: '' },
  storyId: { type: String, default: '' },
  storyTitle: { type: String, default: '' },
  storyAuthor: { type: String, default: '' },
  storyCover: { type: String, default: '' },
  storyGenre: { type: String, default: '' },
  placements: { type: [String], default: [] },
  // The console renders/edits these as plain 'YYYY-MM-DD' strings — stored
  // as strings so a round-trip never changes the displayed value.
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  hasBudget: { type: Boolean, default: false },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  owner: { type: String, default: '' },
  description: { type: String, default: '' },
  reach: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
}, { timestamps: { createdAt: false, updatedAt: 'updatedAt' } });
campaignSchema.index({ updatedAt: -1 });

// Reader league policy (console tab). One document, keyed 'league'.
const leagueConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'league', unique: true },
  enabled: { type: Boolean, default: true },
  weights: { type: mongoose.Schema.Types.Mixed, default: {} },
  actionLabels: { type: mongoose.Schema.Types.Mixed, default: {} },
  actionIcons: { type: mongoose.Schema.Types.Mixed, default: {} },
  prizes: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

// POST /api/league/track — real points earned per reader per season.
const leagueActivitySchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  season: { type: String, required: true, index: true }, // YYYY-Www
  action: { type: String, required: true, index: true }, // chapter|hour|reaction|…
  n: { type: Number, default: 1, min: 1 },
  points: { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });
leagueActivitySchema.index({ userId: 1, season: -1, action: 1 });

module.exports = {
  Campaign: mongoose.model('Campaign', campaignSchema),
  LeagueConfig: mongoose.model('LeagueConfig', leagueConfigSchema),
  LeagueActivity: mongoose.model('LeagueActivity', leagueActivitySchema),
};
