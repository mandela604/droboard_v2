'use strict';
/* services/ad-revenue.service.js — ad revenue ledger for the super-admin
   ad-earnings console (public/super-admin/ad-earnings.html →
   services/ad-revenue-service.js) and marketing analytics.
   Write path: POST /api/ads/track (ads.service.track) upserts one row per
     (date, storyId, adId, slot, page).
   Read path:  GET /api/super-admin/ad-revenue/{ledger,summary}, POST /pay.
   Math mirrors the frontend service exactly:
     impression $0.005, click $0.35; story-owned slots (fullReader,
     scrollReader, series, comments) split 70% platform / 30% author,
     every other surface is 100% platform. */
const { AdRevenueLedger } = require('../models/revenue.model');
const { Book } = require('../models/content.model');
const { User } = require('../models/user.model');

const RATES = { impression: 0.005, click: 0.35 };
const PLATFORM_PCT = 0.70;
const AUTHOR_PCT = 0.30;
const STORY_SLOT_RE = /^(fullReader|scrollReader|series|comments)[:.]/;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function dayStr(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* story → {storyTitle, authorId, authorName} (tiny TTL cache; the track
   endpoint is hot and every event would otherwise cost two lookups). */
const storyCache = new Map();
const STORY_CACHE_MS = 60000;
async function resolveStory(storyId) {
  const hit = storyCache.get(storyId);
  if (hit && hit.at > Date.now() - STORY_CACHE_MS) return hit.val;
  let book = null;
  try {
    const q = mongooseValid(storyId) ? [{ id: storyId }, { _id: storyId }] : [{ id: storyId }];
    book = await Book.findOne({ $or: q }).select('title authorId').lean();
  } catch (e) { book = null; }
  const val = book
    ? { storyTitle: book.title || '', authorId: book.authorId || '', authorName: '' }
    : { storyTitle: '', authorId: '', authorName: '' };
  if (val.authorId) {
    try {
      const u = await User.findOne({ $or: [{ id: val.authorId }, { _id: val.authorId }] })
        .select('fullName username penName').lean();
      if (u) val.authorName = u.fullName || u.penName || u.username || '';
    } catch (e) { /* author label stays blank */ }
  }
  storyCache.set(storyId, { at: Date.now(), val });
  if (storyCache.size > 500) storyCache.clear();
  return val;
}
function mongooseValid(id) {
  try { return require('mongoose').Types.ObjectId.isValid(id) && String(id).length === 24; }
  catch (e) { return false; }
}

/* ── write path (called from ads.service.track) ── */
async function record({ id, event, page, slot, storyId, ts }) {
  const rev = RATES[event];
  if (!id || !rev) return null;
  const sl = String(slot || '');
  const sid = String(storyId || '');
  const owned = !!sid && STORY_SLOT_RE.test(sl);
  const meta = owned ? await resolveStory(sid) : null;
  const date = dayStr(ts);
  const $inc = { revenue: rev, platformShare: owned ? rev * PLATFORM_PCT : rev, authorShare: owned ? rev * AUTHOR_PCT : 0 };
  if (event === 'click') $inc.clicks = 1;
  else $inc.impressions = 1;
  const $set = { date, storyId: owned ? sid : '', adId: String(id), slot: sl, page: String(page || '') };
  if (meta) {
    $set.storyTitle = meta.storyTitle;
    $set.authorId = meta.authorId;
    $set.authorName = meta.authorName;
  }
  await AdRevenueLedger.updateOne(
    { date, storyId: $set.storyId, adId: $set.adId, slot: sl, page: $set.page },
    { $inc, $set },
    { upsert: true }
  );
  return true;
}

/* window filter: ?days=N (last N days incl. today) or explicit from/to */
function window(days, from, to) {
  const q = {};
  if (from || to) {
    if (from) q.date = Object.assign(q.date || {}, { $gte: String(from) });
    if (to) q.date = Object.assign(q.date || {}, { $lte: String(to) });
    return q;
  }
  const n = Math.min(Math.max(num(days, 30) || 30, 1), 730);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  return { date: { $gte: dayStr(d.getTime()) } };
}

function toRow(r) {
  const o = r.toJSON ? r.toJSON() : r;
  return {
    id: o.id || o._id, date: o.date,
    storyId: o.storyId || '', storyTitle: o.storyTitle || '',
    authorId: o.authorId || '', authorName: o.authorName || '',
    adId: o.adId || '', slot: o.slot || '', page: o.page || '',
    impressions: num(o.impressions, 0), clicks: num(o.clicks, 0),
    revenue: num(o.revenue, 0), platformShare: num(o.platformShare, 0),
    authorShare: num(o.authorShare, 0),
    paidAt: o.paidAt || null, paid: !!o.paidAt,
  };
}

/* GET /ad-revenue/ledger → {rows, total} (FE reads r.rows) */
async function ledger({ days, from, to, page, limit }) {
  const q = window(days, from, to);
  const lim = Math.min(Math.max(num(limit, 500) || 500, 1), 2000);
  const pg = Math.max(num(page, 1) || 1, 1);
  const [rows, total] = await Promise.all([
    AdRevenueLedger.find(q).sort({ date: -1, revenue: -1 })
      .skip((pg - 1) * lim).limit(lim).lean(),
    AdRevenueLedger.countDocuments(q),
  ]);
  return { rows: rows.map(toRow), total, page: pg, limit: lim };
}

/* group rows exactly like the frontend groupBy (label, metrics, story/author) */
function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!k) return;
    let g = map.get(k);
    if (!g) {
      g = {
        key: k, label: k, impressions: 0, clicks: 0, revenue: 0,
        platformShare: 0, authorShare: 0,
        storyId: '', storyTitle: '', authorId: '', authorName: '',
      };
      map.set(k, g);
    }
    g.impressions += r.impressions;
    g.clicks += r.clicks;
    g.revenue = round2(g.revenue + r.revenue);
    g.platformShare = round2(g.platformShare + r.platformShare);
    g.authorShare = round2(g.authorShare + r.authorShare);
    if (r.storyId) { g.storyId = r.storyId; g.storyTitle = r.storyTitle; }
    if (r.authorId) { g.authorId = r.authorId; g.authorName = r.authorName; }
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/* GET /ad-revenue/summary → {totals, bySurface, byStory, byAuthor, days} */
async function summary({ days }) {
  const n = Math.min(Math.max(num(days, 30) || 30, 1), 730);
  const rows = (await AdRevenueLedger.find(window(n)).lean()).map(toRow);
  const totals = {
    impressions: 0, clicks: 0, revenue: 0, platformShare: 0,
    authorShare: 0, authorShareUnpaid: 0,
  };
  rows.forEach((r) => {
    totals.impressions += r.impressions;
    totals.clicks += r.clicks;
    totals.revenue = round2(totals.revenue + r.revenue);
    totals.platformShare = round2(totals.platformShare + r.platformShare);
    totals.authorShare = round2(totals.authorShare + r.authorShare);
    if (!r.paid) totals.authorShareUnpaid = round2(totals.authorShareUnpaid + r.authorShare);
  });
  const byStory = groupBy(rows, (r) => r.storyId || '').filter((g) => !!g.storyId);
  const bySurface = groupBy(rows, (r) => (r.storyId ? 'story:' + ((r.slot.split(':')[0]) || r.slot) : (r.page || r.slot || 'other')));
  const byAuthor = groupBy(rows, (r) => r.authorId || '')
    .filter((g) => !!g.authorId)
    .map((g) => {
      const mine = rows.filter((r) => r.authorId === g.authorId);
      g.paid = mine.every((r) => r.paid);
      g.unpaid = g.paid ? 0 : g.authorShare;
      return g;
    });
  return { totals, bySurface, byStory, byAuthor, days: n };
}

/* POST /ad-revenue/pay {authorId} → {ok, modified} */
async function pay({ authorId, by }) {
  if (!authorId) { const e = new Error('author_required'); e.status = 400; throw e; }
  const r = await AdRevenueLedger.updateMany(
    { authorId: String(authorId), paidAt: null },
    { $set: { paidAt: new Date() } }
  );
  return { ok: true, modified: r.modifiedCount || 0, by: by || null };
}

module.exports = { record, ledger, summary, pay, RATES, STORY_SLOT_RE };
