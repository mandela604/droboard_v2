'use strict';
const { AdInventory, AdPlacement, AdStat } = require('../models/platform.model');

async function placement(page) {
  // Fail closed: no placement doc means NO ads. There is deliberately no
  // fallback default in production — marketing must program every page.
  const p = await AdPlacement.findOne({ page }).lean().catch(() => null);
  return p || null;
}

/* console inventory: all creatives grouped by format + placement map */
// Every format the ad-setup wizard can create must have a pool key here or
// the creative silently disappears from the console after save.
const AD_FORMATS = ['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo', 'minibanner', 'spotlight'];
function blankPools() {
  const o = {};
  AD_FORMATS.forEach(f => { o[f] = []; });
  return o;
}

async function inventoryAll() {
  const [ads, map] = await Promise.all([
    AdInventory.find({}).sort({ updatedAt: -1 }).limit(500).lean(),
    placements(),
  ]);
  const pools = blankPools();
  ads.forEach(a => {
    const row = a.toJSON ? a.toJSON() : a;
    if (pools[row.format]) pools[row.format].push(row);
    else pools[row.format] = [row];
  });
  return { pools, placements: map };
}

function cleanAd(data) {
  const out = {};
  ['format', 'brand', 'title', 'heading', 'text', 'body', 'image', 'code', 'cta', 'url', 'genre'].forEach(k => {
    if (data[k] !== undefined) out[k === 'body' ? 'text' : k] = String(data[k]).slice(0, k === 'code' ? 20000 : k === 'body' || k === 'text' ? 5000 : 500);
  });
  if (data.format !== undefined && !AD_FORMATS.includes(data.format)) {
    const e = new Error('bad_format'); e.status = 400; throw e;
  }
  if (data.pages !== undefined) out.pages = Array.isArray(data.pages) ? data.pages.map(String).slice(0, 20) : [];
  if (data.slots !== undefined) out.slots = Array.isArray(data.slots) ? data.slots.map(String).slice(0, 40) : [];
  if (data.active !== undefined) out.active = !!data.active;
  // The console round-trips 'YYYY-MM-DD' strings (it reads startDate back when
  // editing); serving filters on the parsed startAt/endAt — keep both in sync.
  if (data.startDate !== undefined) { out.startDate = String(data.startDate).slice(0, 30); out.startAt = out.startDate ? new Date(out.startDate) : null; }
  if (data.endDate !== undefined) { out.endDate = String(data.endDate).slice(0, 30); out.endAt = out.endDate ? new Date(out.endDate) : null; }
  // campaign link + targeting (ad-setup-service.js:642-655 payload)
  if (data.campaign !== undefined) out.campaign = String(data.campaign || '').slice(0, 120);
  if (data.audience !== undefined) out.audience = cleanAudience(data.audience);
  if (data.offerRef !== undefined && data.offerRef && data.offerRef.id) {
    out.offerRef = {
      kind: String(data.offerRef.kind || 'offer').slice(0, 40),
      id: String(data.offerRef.id).slice(0, 120),
      name: String(data.offerRef.name || data.offerRef.id).slice(0, 200),
    };
  } else if (data.offerRef !== undefined) out.offerRef = null;
  // never let a body overwrite the generated public id / internals
  if (data.id !== undefined) delete out.id;
  delete out._id; delete out.__v;
  return out;
}
function cleanAudience(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    segments: Array.isArray(a.segments) ? a.segments.map(String).slice(0, 30) : [],
    genres: Array.isArray(a.genres) ? a.genres.map(String).slice(0, 30) : [],
    countries: Array.isArray(a.countries) ? a.countries.map(String).slice(0, 30) : [],
  };
}

async function createAd(data) {
  if (!data.format) { const e = new Error('format_required'); e.status = 400; throw e; }
  const doc = await AdInventory.create(cleanAd(data));
  return doc.toJSON();
}

async function updateAd({ id, data }) {
  const doc = await AdInventory.findOne({ id: String(id) });
  if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
  const patch = cleanAd(data);
  delete patch.id; delete patch._id; delete patch.__v;
  Object.assign(doc, patch);
  if (data.format !== undefined) doc.format = data.format;
  await doc.save();
  return doc.toJSON();
}

async function deleteAd(id) {
  const doc = await AdInventory.findOne({ id: String(id) });
  if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
  await doc.deleteOne();
  return { ok: true, id: String(id) };
}

/* full placement map for consoles: page -> {enabled, slots, interval, ...} */
async function placements() {
  const rows = await AdPlacement.find({}).lean();
  const map = {};
  rows.forEach(r => {
    map[r.page] = {
      enabled: r.enabled !== false, slots: r.slots || {},
      interval: r.interval, cycle: r.cycle || [], format: r.format || 'auto',
      topPromo: !!r.topPromo, promoSlider: r.promoSlider !== false,
      wordsPerSlot: r.wordsPerSlot || 300, repeat: !!r.repeat,
    };
  });
  return map;
}

async function savePlacement({ page, patch }) {
  const allowed = ['enabled', 'interval', 'cycle', 'format', 'topPromo', 'promoSlider', 'wordsPerSlot', 'repeat'];
  const set = {};
  allowed.forEach(k => { if (patch[k] !== undefined) set[k] = patch[k]; });
  if (set.wordsPerSlot !== undefined) {
    set.wordsPerSlot = Math.min(5000, Math.max(50, parseInt(set.wordsPerSlot, 10) || 300));
  }
  if (patch.slots && typeof patch.slots === 'object') {
    Object.keys(patch.slots).slice(0, 50).forEach(k => {
      const v = patch.slots[k];
      const key = 'slots.' + String(k).slice(0, 80);
      if (typeof v === 'boolean') { set[key] = v; return; }
      if (v && typeof v === 'object') {
        const cfg = {};
        if (v.enabled !== undefined) cfg.enabled = !!v.enabled;
        if (Array.isArray(v.formats)) cfg.formats = v.formats.map(String).slice(0, 10);
        if (Array.isArray(v.adIds)) cfg.adIds = v.adIds.map(String).slice(0, 20);
        set[key] = cfg;
      }
    });
  }
  const doc = await AdPlacement.findOneAndUpdate(
    { page: String(page) },
    { $set: set, $setOnInsert: { page: String(page) } },
    { upsert: true, new: true }
  ).lean();
  return { page: doc.page, enabled: doc.enabled !== false, slots: doc.slots || {}, interval: doc.interval, repeat: !!doc.repeat };
}

function slotCfg(placement, slot) {
  if (!slot || !placement || !placement.slots) return null;
  const raw = typeof placement.slots.get === 'function' ? placement.slots.get(slot) : placement.slots[slot];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'boolean') return { enabled: raw };
  if (typeof raw === 'object') return raw;
  return null;
}

async function pools(page, slot) {
  const place = page ? await AdPlacement.findOne({ page }).lean().catch(() => null) : null;
  const empty = blankPools();
  if (place && place.enabled === false) return empty; // page kill switch
  const cfg = slotCfg(place, slot);
  if (cfg && cfg.enabled === false) return empty; // slot kill switch
  const formats = Array.isArray(cfg && cfg.formats) && cfg.formats.length ? cfg.formats : null;
  const pinned = Array.isArray(cfg && cfg.adIds) ? cfg.adIds.map(String).filter(Boolean) : [];
  const all = await AdInventory.find({ active: true }).lean();
  const now = new Date();
  const live = all.filter(a => {
    if (a.startAt && new Date(a.startAt) > now) return false;
    if (a.endAt && new Date(a.endAt) < now) return false;
    if (page && Array.isArray(a.pages) && a.pages.length && !a.pages.includes(page)) return false;
    if (slot && Array.isArray(a.slots) && a.slots.length && !a.slots.includes(slot)) return false;
    if (formats && !formats.includes(a.format)) return false;
    return true;
  });
  const out = blankPools();
  live.forEach(a => { if (out[a.format]) out[a.format].push(a); });
  if (pinned.length) {
    const rank = {};
    pinned.forEach((id, i) => { rank[id] = i; });
    Object.keys(out).forEach(k => {
      out[k].sort((x, y) => {
        const ax = rank[String(x.id)] !== undefined ? rank[String(x.id)] : 1e9;
        const bx = rank[String(y.id)] !== undefined ? rank[String(y.id)] : 1e9;
        return ax - bx;
      });
    });
  }
  return out;
}

async function inventory(page, slot) {
  const [place, p] = await Promise.all([placement(page), pools(page, slot)]);
  return { placement: place, pools: p };
}

async function promos(page, genre) {
  const p = await pools(page);
  let slides = p.promo || [];
  if (genre) slides = slides.filter(s => !s.genre || s.genre === genre);
  return slides.map(s => ({ title: s.title, author: '', cta: s.cta, img: s.image }));
}

// POST /api/ads/track — lifecycle events from clients. Guests count too
// (anonId); conversions are idempotent on orderId; only impression/click
// reach the revenue ledger. An impression is one rendered ad instance
// (showingId) — the same creative shown again is a new impression; only
// retries of the same instance dedupe (eventKey unique index).
const TRACK_EVENTS = ['impression', 'viewable', 'click', 'complete', 'skip', 'conversion'];
const EVENT_INC = { impression: 'impressions', viewable: 'viewables', click: 'clicks', complete: 'completes', skip: 'skips', conversion: 'conversions' };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function track({ id, event, userId, anonId, page, slot, storyId, showingId, value, currency, orderId, source }) {
  if (!id) { const e = new Error('no_id'); e.status = 400; throw e; }
  if (!TRACK_EVENTS.includes(event)) { const e = new Error('bad_event'); e.status = 400; throw e; }
  const { AdEvent, AdConversion } = require('../models/platform.model');
  const adId = String(id);
  const who = userId ? String(userId) : '';
  const guest = who ? '' : String(anonId || '').slice(0, 80);
  const pageStr = String(page || '').slice(0, 80);
  const slotStr = String(slot || '').slice(0, 120);
  const storyStr = String(storyId || '').slice(0, 120);
  const showStr = String(showingId || '').slice(0, 80);
  const eventKey = (event === 'impression' || event === 'viewable') && showStr
    ? event + ':' + adId + ':' + showStr
    : null;

  if (event === 'conversion') {
    const oid = orderId ? String(orderId).slice(0, 120) : '';
    if (oid) {
      const exists = await AdConversion.findOne({ orderId: oid }).lean().catch(() => null);
      if (exists) return { ok: true, deduped: true };
    }
    const row = {
      adId, userId: who, anonId: guest,
      value: Math.max(0, Number(value) || 0),
      currency: String(currency || 'USD').slice(0, 8),
      page: pageStr, slot: slotStr, storyId: storyStr,
      source: source === 'postback' ? 'postback' : 'client',
    };
    if (oid) row.orderId = oid;
    try { await AdConversion.create(row); }
    catch (e) {
      if (e && e.code === 11000) return { ok: true, deduped: true };
      throw e;
    }
  }

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  // Insert the raw row first for deduped events so a retry that races this
  // request loses on the unique index instead of double-counting AdStat.
  const eventRow = {
    adId, event, page: pageStr, slot: slotStr, storyId: storyStr,
    showingId: showStr, userId: who, anonId: guest,
  };
  if (eventKey) eventRow.eventKey = eventKey;
  if (eventKey) {
    try { await AdEvent.create(eventRow); }
    catch (e) {
      if (e && e.code === 11000) return { ok: true, deduped: true };
      throw e;
    }
  }

  const inc = {};
  inc[EVENT_INC[event]] = 1;
  if (event === 'conversion') {
    const v = Math.max(0, Number(value) || 0);
    if (v) inc.conversionValue = round2(v);
  }
  await AdStat.updateOne({ adId, day }, { $inc: inc }, { upsert: true });

  // Raw stream, fire-and-forget (TTL'd 90 days).
  if (!eventKey) {
    try { AdEvent.create(eventRow).catch(() => {}); } catch (e) { /* lifecycle never breaks tracking */ }
  }

  if (event === 'impression' || event === 'click') {
    try {
      await require('./ad-revenue.service').record({ id: adId, event, page: pageStr, slot: slotStr, storyId: storyStr, ts: Date.now() });
    } catch (e) { /* revenue ledger never breaks tracking */ }
  }
  if (who && event === 'click') {
    try { await AdClick.create({ userId: who, adId }); } catch (e) { /* analytics never break tracking */ }
  } else if (who && event === 'impression') {
    try {
      const d = new Date().toISOString().slice(0, 10);
      await AdView.updateOne(
        { userId: who, adId, day: d },
        { $setOnInsert: { userId: who, adId, day: d } },
        { upsert: true }
      );
    } catch (e) { /* analytics never break tracking */ }
  }
  return { ok: true };
}

/* Real per-slot performance for the marketing console: counts come from the
   raw event stream (guests included), value from attributed conversions. */
async function performance({ days, page }) {
  const { AdEvent, AdConversion } = require('../models/platform.model');
  const n = Math.min(Math.max(parseInt(days, 10) || 30, 1), 90);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (n - 1));
  const evMatch = { at: { $gte: from } };
  if (page) evMatch.page = String(page);
  const convMatch = { createdAt: { $gte: from } };
  if (page) convMatch.page = String(page);
  const viewerKey = { $cond: [{ $gt: ['$userId', ''] }, '$userId', '$anonId'] };
  const [counts, convs, daily, uniques, reach] = await Promise.all([
    AdEvent.aggregate([
      { $match: evMatch },
      { $group: { _id: { adId: '$adId', page: '$page', slot: '$slot', event: '$event' }, n: { $sum: 1 } } },
    ]),
    AdConversion.aggregate([
      { $match: convMatch },
      { $group: { _id: { adId: '$adId', page: '$page', slot: '$slot' }, n: { $sum: 1 }, value: { $sum: '$value' } } },
    ]),
    AdEvent.aggregate([
      { $match: evMatch },
      { $group: {
        _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'UTC' } }, event: '$event' },
        n: { $sum: 1 },
      } },
    ]),
    // Unique reach per creative+slot: distinct logged-in users / guests.
    AdEvent.aggregate([
      { $match: Object.assign({}, evMatch, { event: 'impression' }) },
      { $group: { _id: { adId: '$adId', page: '$page', slot: '$slot' }, viewers: { $addToSet: viewerKey } } },
      { $project: { n: { $size: { $setDifference: ['$viewers', ['']] } } } },
    ]),
    // Unique reach overall: union of viewer ids, not a sum of per-slot sets.
    AdEvent.aggregate([
      { $match: Object.assign({}, evMatch, { event: 'impression' }) },
      { $group: { _id: null, viewers: { $addToSet: viewerKey } } },
      { $project: { n: { $size: { $setDifference: ['$viewers', ['']] } } } },
    ]),
  ]);
  const rows = {};
  const row = (p, s, a) => {
    const k = String(p) + '\u0000' + String(s) + '\u0000' + String(a);
    if (!rows[k]) {
      rows[k] = {
        adId: String(a), page: String(p), slot: String(s),
        impressions: 0, viewables: 0, clicks: 0, completes: 0, skips: 0,
        conversions: 0, value: 0, uniqueViewers: 0,
      };
    }
    return rows[k];
  };
  counts.forEach(c => {
    const r = row(c._id.page, c._id.slot, c._id.adId);
    r[c._id.event] = (r[c._id.event] || 0) + c.n;
  });
  convs.forEach(c => {
    const r = row(c._id.page, c._id.slot, c._id.adId);
    r.conversions = c.n;
    r.value = round2(c.value);
  });
  uniques.forEach(u => {
    row(u._id.page, u._id.slot, u._id.adId).uniqueViewers = u.n || 0;
  });
  const pct = (n, d) => (d ? Math.min(100, round2((n / d) * 100)) : 0);
  const slots = Object.keys(rows).map(k => {
    const r = rows[k];
    return Object.assign(r, {
      ctr: pct(r.clicks, r.impressions),
      viewabilityRate: pct(r.viewables, r.impressions),
      completionRate: pct(r.completes, r.impressions),
      conversionRate: pct(r.conversions, r.clicks),
    });
  }).sort((a, b) => b.impressions - a.impressions);
  const totals = { impressions: 0, viewables: 0, clicks: 0, completes: 0, skips: 0, conversions: 0, value: 0 };
  slots.forEach(r => Object.keys(totals).forEach(k => { totals[k] += r[k] || 0; }));
  totals.value = round2(totals.value);
  totals.uniqueViewers = (reach[0] && reach[0].n) || 0;
  totals.ctr = pct(totals.clicks, totals.impressions);
  totals.viewabilityRate = pct(totals.viewables, totals.impressions);
  totals.completionRate = pct(totals.completes, totals.impressions);
  totals.conversionRate = pct(totals.conversions, totals.clicks);

  // Daily series for the trend chart + CSV (zero-filled so the axis is even).
  const byDay = {};
  daily.forEach(d => {
    const day = d._id.day;
    if (!byDay[day]) byDay[day] = { date: day, impressions: 0, viewables: 0, clicks: 0, completes: 0, skips: 0, conversions: 0 };
    byDay[day][d._id.event] = d.n;
  });
  const series = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push(byDay[key] || { date: key, impressions: 0, viewables: 0, clicks: 0, completes: 0, skips: 0, conversions: 0 });
  }
  return { days: n, from: from.toISOString().slice(0, 10), totals, slots, series };
}

module.exports = { placement, placements, savePlacement, pools, inventory, promos, track, performance, inventoryAll, createAd, updateAd, deleteAd };
