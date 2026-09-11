/* ═══════════════════════════════════════════════════════════════
   AD SERVICE
   Single source of ad inventory for all client pages.
   Demo: central-demo-data.js pools, overlaid with ad-manager edits
   stored in localStorage. Live: GET /api/ads?placement=<page>.

   When going live: set USE_API = true, point API_BASE at the backend.
   Pages and marketing/ad-manager.html keep working unchanged.

   API contract (backend):
     GET  /api/ads?placement=discover|feed|genreHub
       → { placement: { interval, cycle?, topPromo? },
           pools: { platform: [], book: [], native: [], follow: [], banner: [] } }
     POST /api/ads/track  { id, event: 'impression' | 'click' }
     (admin CRUD lives under /api/marketing/ads — see ad-manager page)
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';
  const OVERRIDE_KEY = 'dro_ads_override';
  const STATS_KEY = 'dro_ads_stats';

  function readOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function demoInventory() {
    const d = window.DemoData || {};
    const ov = readOverrides();
    return {
      placement: null, // resolved per page below
      pools: (ov.pools && Object.keys(ov.pools).length ? ov.pools : null) || d.AD_POOLS || {},
      placements: ov.placements || d.AD_PLACEMENTS || {},
    };
  }

  async function getInventory(page) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/ads?placement=${encodeURIComponent(page || '')}`);
      if (!res.ok) throw new Error('Ads API failed');
      return res.json();
    }
    /* Demo serves through the ad-manager layer (MarketingData), which
       itself reads the central store — one source in demo and live. */
    if (window.MarketingData && typeof MarketingData.getAdInventory === 'function') {
      const inv = await MarketingData.getAdInventory();
      const placement = (inv.placements && inv.placements[page]) || { interval: 4 };
      return { placement, pools: inv.pools || {} };
    }
    await new Promise(r => setTimeout(r, 40));
    const inv = demoInventory();
    const placement = (inv.placements && inv.placements[page]) || { interval: 4 };
    return { placement, pools: inv.pools };
  }

  /* Placement config for a page: { interval, cycle?, topPromo? } */
  async function getPlacement(page) {
    const inv = await getInventory(page);
    return inv.placement || { interval: 4 };
  }

  function dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  /* True when an ad is inside its schedule window (blank dates = always). */
  function inSchedule(ad, now) {
    now = now || dayStart(new Date());
    if (ad.startDate) {
      const s = dayStart(ad.startDate);
      if (isNaN(s) || s > now) return isNaN(s) ? true : false;
    }
    if (ad.endDate) {
      const e = dayStart(ad.endDate);
      if (isNaN(e) || e < now) return isNaN(e) ? true : false;
    }
    return true;
  }

  /* Serving pools, filtered for a page: inactive, unscheduled and
     untargeted ads are excluded. Admin sees everything. */
  async function getAds(opts) {
    const page = opts && opts.page;
    const inv = await getInventory(page);
    const pools = inv.pools || {};
    const now = dayStart(new Date());
    const out = {};
    ['platform', 'book', 'native', 'follow', 'banner', 'promo'].forEach(k => {
      out[k] = (Array.isArray(pools[k]) ? pools[k] : []).filter(ad => {
        if (ad.active === false) return false;
        if (!inSchedule(ad, now)) return false;
        if (page && Array.isArray(ad.pages) && ad.pages.length && !ad.pages.includes(page)) return false;
        return true;
      });
    });
    return out;
  }

  /* Impression / click tracking. Demo: local counters the ad-manager reads. */
  function track(id, event) {
    if (!id) return;
    if (USE_API) {
      fetch(`${API_BASE}/ads/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, event: event || 'impression' }),
      }).catch(() => {});
      return;
    }
    try {
      const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {};
      const row = stats[id] || { impressions: 0, clicks: 0 };
      if (event === 'click') row.clicks += 1;
      else row.impressions += 1;
      stats[id] = row;
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function readStats() {
    try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  /* Promo slider slides for a page (library / genreHub), narrowed by
     genre when the slides carry one. Powers library + hub sliders. */
  async function getPromoSlides(opts) {
    const page = opts && opts.page, genre = opts && opts.genre;
    const pools = await getAds({ page });
    return (pools.promo || []).filter(s => {
      if (!genre) return true;
      return !s.genre || s.genre === genre;
    });
  }

  window.AdService = { getPlacement, getAds, getPromoSlides, getInventory, track, readStats };
})();
