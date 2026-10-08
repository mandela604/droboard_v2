'use strict';
const { AdInventory, AdPlacement, AdStat } = require('../models/platform.model');

async function placement(page) {
  const p = await AdPlacement.findOne({ page }).lean();
  return p || { interval: 4 };
}

async function pools(page) {
  const all = await AdInventory.find({ active: true }).lean();
  const now = new Date();
  const live = all.filter(a => {
    if (a.startAt && new Date(a.startAt) > now) return false;
    if (a.endAt && new Date(a.endAt) < now) return false;
    if (page && Array.isArray(a.pages) && a.pages.length && !a.pages.includes(page)) return false;
    return true;
  });
  const out = { platform: [], book: [], native: [], follow: [], banner: [], embed: [], promo: [] };
  live.forEach(a => { if (out[a.format]) out[a.format].push(a); });
  return out;
}

async function inventory(page) {
  const [place, p] = await Promise.all([placement(page), pools(page)]);
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
  return { ok: true };
}

module.exports = { placement, pools, inventory, promos, track };
