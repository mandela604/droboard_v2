'use strict';
// Marketing console surfaces — the exact shapes marketing-data.js consumes
// (callBackend has NO demo gate: every marketing page hits these paths today
// and falls back only when they 404/timeout).
//
// Each function documents the frontend file:line it satisfies.
const { Campaign, LeagueConfig, LeagueActivity } = require('../models/marketing.model');
const { AdInventory, AdPlacement, AdStat, ActivityLog } = require('../models/platform.model');
const { LaunchCampaign, Promo } = require('../models/editorial.model');
const ads = require('./ads.service');

function bad(msg, status) { const e = new Error(msg); e.status = status || 400; throw e; }

function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(v);
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bold(s) { return '<b>' + esc(s) + '</b>'; }
function rel(d) {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + 'd ago';
  if (dd < 30) return Math.floor(dd / 7) + 'w ago';
  return Math.floor(dd / 30) + 'mo ago';
}
function dateLabel(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return 'Starts ' + dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function pct(clicks, impressions) {
  if (!impressions) return '0%';
  return (Math.round((clicks / impressions) * 1000) / 10).toFixed(1) + '%';
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/marketing/dashboard  (marketing-data.js:240 →
 * dashboard-page-service.js:69-80,142,159,173)
 * ───────────────────────────────────────────────────────────── */
const MK_ACT = {
  create: { icon: 'fa-circle-plus', color: 'green' },
  update: { icon: 'fa-pen', color: 'blue' },
  delete: { icon: 'fa-trash', color: 'red' },
  login: { icon: 'fa-right-to-bracket', color: 'amber' },
  payout: { icon: 'fa-money-check-dollar', color: 'accent' },
  review: { icon: 'fa-scale-balanced', color: 'purple' },
};

async function adStatsMap() {
  const rows = await AdStat.aggregate([{ $group: { _id: '$adId', imp: { $sum: '$impressions' }, clk: { $sum: '$clicks' } } }]);
  const m = {};
  rows.forEach(r => { m[String(r._id)] = { imp: r.imp || 0, clk: r.clk || 0 }; });
  return m;
}

async function dashboard() {
  const now = new Date();

  const [camps, invRows, placeRows, launches, promos, activity] = await Promise.all([
    Campaign.find({}).lean(),
    AdInventory.find({}).lean().limit(500),
    AdPlacement.find({}).lean(),
    LaunchCampaign.find({ status: { $in: ['scheduled', 'active'] } }).sort({ launchDate: 1 }).limit(8).lean(),
    Promo.find({ status: 'scheduled' }).sort({ startAt: 1 }).limit(8).lean(),
    ActivityLog.find({}).sort({ at: -1 }).limit(20).lean(),
  ]);

  const active = camps.filter(c => ['live', 'scheduled'].includes(c.status)).length;
  const liveCamps = camps.filter(c => c.status === 'live').length;
  const liveAds = invRows.filter(a => a.active !== false).length;
  // Homepage banners = placements carrying a promo/banner surface turned on.
  const bannerPages = placeRows.filter(p => p.enabled !== false && (p.topPromo || p.promoSlider !== false)).length;

  const totImp = camps.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
  const totClk = camps.reduce((s, c) => s + (Number(c.clicks) || 0), 0);

  const upcomingEvents = [];
  launches.forEach(l => {
    if (!l.launchDate || new Date(l.launchDate) < now) return;
    upcomingEvents.push({
      name: l.campaignName, type: 'Event', date: dateLabel(l.launchDate),
      detail: esc(l.desc || l.cta || 'Scheduled platform launch'),
    });
  });
  promos.forEach(p => {
    if (!p.startAt || new Date(p.startAt) < now) return;
    upcomingEvents.push({
      name: p.title, type: p.type === 'flash' ? 'Contest' : 'Event', date: dateLabel(p.startAt),
      detail: esc(p.desc || (p.code ? 'Promo code ' + p.code : 'Scheduled promotion')),
    });
  });

  const recentActivity = activity.map(a => {
    const style = MK_ACT[a.type] || { icon: 'fa-circle-info', color: 'accent' };
    return {
      icon: style.icon, color: style.color,
      text: bold(a.userLabel || 'Platform') + (a.detail ? ' ' + esc(a.detail) : ''),
      time: rel(a.at),
    };
  });

  const analyticsSnapshot = {
    impressions: compact(totImp),
    clicks: compact(totClk),
    ctr: pct(totClk, totImp),
    conversions: compact(camps.reduce((s, c) => s + (Number(c.conversions) || 0), 0)),
    revenueLift: '+0%',
  };

  return {
    activeCampaigns: active,
    livePromotions: liveCamps,
    sponsoredPlacementsLive: liveAds,
    homepageBannersLive: bannerPages,
    avgEngagementRate: pct(totClk, totImp),
    upcomingEventsCount: upcomingEvents.length,
    quickActions: [
      { label: 'Launch New Campaign', icon: 'fa-bullhorn', cls: 'accent', href: 'campaigns.html?new=1' },
      { label: 'Create New Ad', icon: 'fa-ad', cls: 'blue', href: 'ad-setup.html' },
      { label: 'Manage Ad Placements', icon: 'fa-table-cells', cls: 'purple', href: 'ad-manager.html' },
      { label: 'Design Flyer Template', icon: 'fa-pen-ruler', cls: 'green', href: 'templates.html' },
    ],
    upcomingEvents,
    analyticsSnapshot,
    recentActivity,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Campaigns CRUD (marketing-data.js:253-304 → campaigns-page-service.js
 * :67,115,134,466,488). Campaign stats are recomputed from the AdStat rows
 * of its linked creatives so cards show real numbers.
 * ───────────────────────────────────────────────────────────── */
const CAMPAIGN_FIELDS = ['name', 'status', 'type', 'objective', 'storyId', 'storyTitle', 'storyAuthor',
  'storyCover', 'storyGenre', 'placements', 'startDate', 'endDate', 'hasBudget', 'budget', 'spent',
  'owner', 'description', 'reach', 'impressions', 'clicks', 'ctr', 'conversions'];

async function campaigns() {
  const [docs, linked, stats] = await Promise.all([
    Campaign.find({}).sort({ updatedAt: -1 }).limit(300).lean(),
    AdInventory.find({ campaign: { $ne: '' } }).select('campaign').lean(),
    adStatsMap(),
  ]);
  const adsByCampaign = {};
  linked.forEach(a => {
    const k = String(a.campaign);
    if (!adsByCampaign[k]) adsByCampaign[k] = [];
    adsByCampaign[k].push(String(a.id));
  });
  return docs.map(c => {
    const row = Object.assign({}, c);
    const ids = adsByCampaign[String(c.id)] || [];
    if (ids.length) {
      // Only show live stats for ads that are actually serving.
      const imps = ids.reduce((s, id) => s + ((stats[id] && stats[id].imp) || 0), 0);
      const clks = ids.reduce((s, id) => s + ((stats[id] && stats[id].clk) || 0), 0);
      if (imps > 0) {
        row.impressions = imps;
        row.clicks = clks;
        row.ctr = Number(pct(clks, imps).replace('%', '')) || 0;
        row.reach = Math.max(Number(row.reach) || 0, imps);
      }
    }
    return row;
  });
}

async function createCampaign(payload) {
  const b = {};
  CAMPAIGN_FIELDS.forEach(k => { if (payload && payload[k] !== undefined) b[k] = payload[k]; });
  if (!b.name) bad('name_required');
  b.status = ['live', 'scheduled', 'draft', 'paused', 'ended'].includes(b.status) ? b.status : 'draft';
  b.placements = Array.isArray(b.placements) ? b.placements.map(String).slice(0, 20) : [];
  const doc = await Campaign.create(b);
  return doc.toJSON();
}

async function loadCampaignOr404(id) {
  const doc = await Campaign.findOne({ id: String(id) });
  if (!doc) bad('not_found', 404);
  return doc;
}

// Pausing/ending a campaign switches its linked ads off (autoPaused), and
// resuming restores ONLY those — an ad an operator switched off by hand
// stays off (marketing-data.js "Campaign ↔ ad connection" comment).
async function cascadeAds(campaignId, status) {
  const stopping = ['paused', 'ended'].includes(status);
  if (stopping) {
    await AdInventory.updateMany(
      { campaign: String(campaignId), active: true, autoPaused: false },
      { $set: { active: false, autoPaused: true } });
  } else if (['live', 'scheduled'].includes(status)) {
    await AdInventory.updateMany(
      { campaign: String(campaignId), autoPaused: true },
      { $set: { active: true, autoPaused: false } });
  }
}

async function updateCampaign(id, payload) {
  const doc = await loadCampaignOr404(id);
  const b = {};
  CAMPAIGN_FIELDS.forEach(k => { if (payload && payload[k] !== undefined) b[k] = payload[k]; });
  if (b.status !== undefined && !['live', 'scheduled', 'draft', 'paused', 'ended'].includes(b.status)) bad('bad_status');
  if (b.placements !== undefined) b.placements = Array.isArray(b.placements) ? b.placements.map(String).slice(0, 20) : [];
  Object.assign(doc, b);
  await doc.save();
  if (b.status !== undefined) await cascadeAds(doc.id, b.status);
  return doc.toJSON();
}

async function deleteCampaign(id) {
  const doc = await loadCampaignOr404(id);
  await doc.deleteOne();
  // Unlink creatives instead of orphaning a paused campaign state.
  await AdInventory.updateMany(
    { campaign: String(id) },
    { $set: { campaign: '', autoPaused: false, active: true } });
  return { id: String(id), deleted: true };
}

/* ── GET /api/marketing/ads?campaign=CMP-… (marketing-data.js:309-317) ── */
async function adsByCampaign(campaignId) {
  const rows = await AdInventory.find({ campaign: String(campaignId) }).lean().limit(200);
  const pools = {};
  rows.forEach(r => {
    if (!pools[r.format]) pools[r.format] = [];
    pools[r.format].push(r);
  });
  return { pools };
}

/* ── GET /api/marketing/ads/stats (marketing-data.js:455) —
 * ad-manager.js:645 renders [{id,format,title,active,impressions,clicks,ctr}]. */
async function adStats() {
  const [rows, stats] = await Promise.all([AdInventory.find({}).lean().limit(500), adStatsMap()]);
  return rows.map(a => {
    const s = stats[String(a.id)] || { imp: 0, clk: 0 };
    return {
      id: a.id,
      format: a.format,
      title: a.title || a.heading || a.brand || a.name || a.id,
      active: a.active !== false,
      impressions: s.imp,
      clicks: s.clk,
      ctr: s.imp ? ((s.clk / s.imp) * 100).toFixed(1) : '0.0',
    };
  });
}

/* ── POST /api/marketing/ads/reset (marketing-data.js:402-410) ──
 * The demo reset clears *localStorage* ad overrides. The backend keeps no
 * such override store (serving reads the DB directly), so the honest server
 * behaviour is: return the current inventory unchanged. */
async function resetAds() {
  return ads.inventoryAll();
}

/* ─────────────────────────────────────────────────────────────
 * Reader league (marketing-data.js:413-449; league-service.js:184 track)
 * ───────────────────────────────────────────────────────────── */
const DEFAULT_LEAGUE = {
  enabled: true,
  weights: { chapter: 10, hour: 5, reaction: 2, comment: 8, reply: 8, debate: 4, win: 25, streak: 6 },
  actionLabels: {},
  actionIcons: {},
  prizes: [
    { place: 1, badge: 'League Champion', icon: 'fa-crown', color: '#f59e0b', perks: ['Champion frame', 'Ad-free week', 'Shoutout spotlight'], adFreeDays: 7 },
    { place: 2, badge: 'League 2nd', icon: 'fa-medal', color: '#a0a0b0', perks: ['Ad-free week'], adFreeDays: 7 },
    { place: 3, badge: 'League 3rd', icon: 'fa-medal', color: '#a07040', perks: [], adFreeDays: 0 },
  ],
};

function leagueOut(doc) {
  return {
    enabled: doc.enabled !== false,
    weights: (doc.weights && typeof doc.weights === 'object') ? doc.weights : {},
    actionLabels: (doc.actionLabels && typeof doc.actionLabels === 'object') ? doc.actionLabels : {},
    actionIcons: (doc.actionIcons && typeof doc.actionIcons === 'object') ? doc.actionIcons : {},
    prizes: Array.isArray(doc.prizes) ? doc.prizes : [],
  };
}

async function leagueConfig() {
  const doc = await LeagueConfig.findOne({ key: 'league' }).catch(() => null);
  if (doc) return leagueOut(doc);
  const created = await LeagueConfig.create(Object.assign({ key: 'league' }, DEFAULT_LEAGUE));
  return leagueOut(created);
}

async function saveLeagueConfig(patch) {
  const doc = await LeagueConfig.findOne({ key: 'league' })
    || await LeagueConfig.create(Object.assign({ key: 'league' }, DEFAULT_LEAGUE));
  const b = patch || {};
  if (b.enabled !== undefined) doc.enabled = !!b.enabled;
  if (b.weights && typeof b.weights === 'object') {
    const w = Object.assign({}, doc.weights && typeof doc.weights === 'object' ? doc.weights : {});
    Object.keys(b.weights).forEach(k => { w[String(k).slice(0, 40)] = Number(b.weights[k]) || 0; });
    doc.weights = w;
  }
  if (b.actionLabels && typeof b.actionLabels === 'object') {
    doc.actionLabels = Object.assign({}, doc.actionLabels || {}, b.actionLabels);
  }
  if (b.actionIcons && typeof b.actionIcons === 'object') {
    doc.actionIcons = Object.assign({}, doc.actionIcons || {}, b.actionIcons);
  }
  if (Array.isArray(b.prizes) && b.prizes.length) doc.prizes = b.prizes.slice(0, 20);
  // console sends removeActions:[] when the operator deletes a tracked action
  const removes = Array.isArray(b.removeActions) ? b.removeActions : [];
  if (removes.length) {
    const w = Object.assign({}, doc.weights || {});
    const l = Object.assign({}, doc.actionLabels || {});
    const i = Object.assign({}, doc.actionIcons || {});
    removes.forEach(k => { delete w[k]; delete l[k]; delete i[k]; });
    doc.weights = w; doc.actionLabels = l; doc.actionIcons = i;
  }
  await doc.save();
  return leagueOut(doc);
}

async function resetLeague() {
  const doc = await LeagueConfig.findOne({ key: 'league' });
  if (doc) { Object.assign(doc, DEFAULT_LEAGUE); doc.key = 'league'; await doc.save(); return leagueOut(doc); }
  const created = await LeagueConfig.create(Object.assign({ key: 'league' }, DEFAULT_LEAGUE));
  return leagueOut(created);
}

// season id matches league-service.js seasonId(): ISO year + week number.
function seasonId(d) {
  const dt = d ? new Date(d) : new Date();
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 864e5) + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

async function track(action, n, userId) {
  const cfg = await leagueConfig();
  if (!cfg.enabled) return { ok: true, points: 0, enabled: false };
  const weight = Number(cfg.weights && cfg.weights[action]) || 0;
  if (!weight) return { ok: true, points: 0, enabled: true };
  const count = Math.max(1, Math.min(500, Number(n) || 1));
  const points = weight * count;
  if (userId) {
    await LeagueActivity.create({
      userId: String(userId), season: seasonId(), action: String(action).slice(0, 40),
      n: count, points,
    }).catch(() => null);
  }
  return { ok: true, points, enabled: true };
}

module.exports = {
  dashboard,
  campaigns, createCampaign, updateCampaign, deleteCampaign,
  adsByCampaign, adStats, resetAds,
  leagueConfig, saveLeagueConfig, resetLeague, track, seasonId,
};
