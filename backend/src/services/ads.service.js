'use strict';
const { AdInventory, AdPlacement, AdStat } = require('../models/platform.model');

async function placement(page) {
  const p = await AdPlacement.findOne({ page }).lean();
  return p || { interval: 4 };
}

/* console inventory: all creatives grouped by format + placement map */
async function inventoryAll() {
  const [ads, map] = await Promise.all([
    AdInventory.find({}).sort({ updatedAt: -1 }).limit(500).lean(),
    placements(),
  ]);
  const pools = { platform: [], book: [], native: [], follow: [], banner: [], embed: [], promo: [] };
  ads.forEach(a => {
    const row = a.toJSON ? a.toJSON() : a;
    if (pools[row.format]) pools[row.format].push(row);
    else pools[row.format] = [row];
  });
  return { pools, placements: map };
}

const AD_FORMATS = ['platform', 'book', 'native', 'follow', 'banner', 'embed', 'promo'];
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
  if (data.startDate !== undefined) out.startAt = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) out.endAt = data.endDate ? new Date(data.endDate) : null;
  return out;
}

async function createAd(data) {
  if (!data.format) { const e = new Error('format_required'); e.status = 400; throw e; }
  const doc = await AdInventory.create(cleanAd(data));
  return doc.toJSON();
}

async function updateAd({ id, data }) {
  const doc = await AdInventory.findOne({ id: String(id) });
  if (!doc) { const e = new Error('not_found'); e.status = 404; throw e; }
  Object.assign(doc, cleanAd(data));
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
      wordsPerSlot: r.wordsPerSlot || 300,
    };
  });
  return map;
}

async function savePlacement({ page, patch }) {
  const allowed = ['enabled', 'interval', 'cycle', 'format', 'topPromo', 'promoSlider', 'wordsPerSlot'];
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
  return { page: doc.page, enabled: doc.enabled !== false, slots: doc.slots || {}, interval: doc.interval };
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
  const empty = { platform: [], book: [], native: [], follow: [], banner: [], embed: [], promo: [] };
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
  const out = { platform: [], book: [], native: [], follow: [], banner: [], embed: [], promo: [] };
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

// POST /api/ads/track {id, event} — daily counters for earnings + CTR.
async function track({ id, event, userId }) {
  if (!id) { const e = new Error('no_id'); e.status = 400; throw e; }
  if (!['impression', 'click'].includes(event)) { const e = new Error('bad_event'); e.status = 400; throw e; }
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const inc = event === 'impression' ? { impressions: 1 } : { clicks: 1 };
  await AdStat.updateOne({ adId: id, day }, { $inc: inc }, { upsert: true });
  if (userId) {
    try {
      const { AdClick, AdView } = require('../models/platform.model');
      if (event === 'click') await AdClick.create({ userId: String(userId), adId: String(id) });
      else {
        const d = new Date().toISOString().slice(0, 10);
        await AdView.updateOne(
          { userId: String(userId), adId: String(id), day: d },
          { $setOnInsert: { userId: String(userId), adId: String(id), day: d } },
          { upsert: true }
        );
      }
    } catch (e) { /* analytics never break tracking */ }
  }
  return { ok: true };
}

module.exports = { placement, placements, savePlacement, pools, inventory, promos, track, inventoryAll, createAd, updateAd, deleteAd };
