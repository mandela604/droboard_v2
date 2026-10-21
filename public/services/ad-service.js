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
            pools: { platform: [], book: [], native: [], follow: [], banner: [], minibanner: [] } }
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
    let pools;
    if (ov.pools && Object.keys(ov.pools).length) {
      pools = {};
      const base = d.AD_POOLS || {};
      const keys = new Set([...Object.keys(base), ...Object.keys(ov.pools)]);
      keys.forEach(k => {
        const baseAds = (base[k] || []).filter(a => !(ov.pools[k] || []).some(b => b.id === a.id));
        pools[k] = [...(ov.pools[k] || []), ...baseAds];
      });
    } else {
      pools = d.AD_POOLS || {};
    }
    return {
      placement: null,
      pools,
      placements: ov.placements || d.AD_PLACEMENTS || {},
    };
  }

  function slotCfg(placement, slot) {
    if (!slot || !placement || !placement.slots) return null;
    var raw = placement.slots[slot];
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'boolean') return { enabled: raw };
    if (typeof raw === 'object') return raw;
    return null;
  }
  function orderPinned(pools, adIds) {
    if (!adIds || !adIds.length) return pools;
    var rank = {};
    adIds.forEach(function (id, i) { if (rank[id] === undefined) rank[id] = i; });
    Object.keys(pools).forEach(function (k) {
      (pools[k] || []).sort(function (x, y) {
        var ax = rank[x.id] !== undefined ? rank[x.id] : 1e9;
        var bx = rank[y.id] !== undefined ? rank[y.id] : 1e9;
        return ax - bx;
      });
    });
    return pools;
  }

  /* Serving pools, filtered for a page + optional slot: inactive,
     unscheduled, untargeted and slot-disabled ads are excluded. */
  async function getInventory(page, slot) {
    if (USE_API) {
      var url = `${API_BASE}/ads?placement=${encodeURIComponent(page || '')}`;
      if (slot) url += `&slot=${encodeURIComponent(slot)}`;
      const res = await fetch(url, { credentials: 'include' });
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

  /* Backend placement map (kill switches + slot flags) + entitlements,
     cached per page-load so every slot check stays local. */
  var _placements = null, _placementsAt = 0, _ent = null;
  function backendPlacements() {
    if (_placements && Date.now() - _placementsAt < 10 * 60 * 1000) return Promise.resolve(_placements);
    /* Demo (no backend): read the same localStorage-backed placements the
       ad-manager writes via MarketingData, so manager on/off + slot
       programming actually reach client pages. Live: GET /api/ads/placements
       (identical shape — flip USE_API and nothing else changes). */
    if (!USE_API && window.MarketingData && typeof MarketingData.getAdInventory === 'function') {
      return MarketingData.getAdInventory().then(function (inv) {
        _placements = (inv && inv.placements) || {};
        _placementsAt = Date.now();
        return _placements;
      }).catch(function () { return _placements || {}; });
    }
    try {
      return fetch(`${API_BASE}/ads/placements`, { credentials: 'include' }).then(function (r) {
        if (!r.ok) return {};
        return r.json();
      }).then(function (j) {
        _placements = j || {};
        _placementsAt = Date.now();
        return _placements;
      }).catch(function () { return _placements || {}; });
    } catch (e) { return Promise.resolve(_placements || {}); }
  }
  function myEntitlements() {
    if (window.DroboardAdsFreeEverywhere) return Promise.resolve({ adsFreeEverywhere: true });
    if (_ent !== null && _ent !== undefined) return Promise.resolve(_ent);
    try {
      return fetch('/api/wallet/entitlements', { credentials: 'include' }).then(function (r) {
        if (!r.ok) { _ent = false; return _ent; }
        return r.json();
      }).then(function (j) {
        _ent = j || false;
        return _ent;
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function emptyPools() {
    return { platform: [], book: [], native: [], embed: [], follow: [], banner: [], minibanner: [], promo: [], spotlight: [] };
  }

  /* Placement config for a page: { interval, cycle?, topPromo? } */
  async function getPlacement(page) {
    const inv = await getInventory(page);
    const base = inv.placement || { interval: 4 };
    try {
      const map = await backendPlacements();
      const live = map && map[page];
      if (live) return Object.assign({}, base, live);
    } catch (e) {}
    return base;
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
    const slot = opts && opts.slot;
    // Merge Pass: ad-free everywhere except Discover.
    try {
      if (!window.DroboardAdsFreeEverywhere) {
        const ent = await myEntitlements();
        if (ent && ent.adsFreeEverywhere && page !== 'discover') return emptyPools();
      } else if (page !== 'discover') return emptyPools();
      /* League perk: weekly top-3 readers read ad-free for 7 days (zero cash). */
      if (page !== 'discover' && window.ReaderLeague && typeof window.ReaderLeague.adFreeActive === 'function' && window.ReaderLeague.adFreeActive()) return emptyPools();
    } catch (e) {}
    const inv = await getInventory(page, slot);
    // backend kill switch (marketing toggle) empties pools in any mode
    try {
      const map = await backendPlacements();
      const live = map && map[page];
      if (live && live.enabled === false) return emptyPools();
      var cfg = slotCfg(live, slot);
      if (cfg && cfg.enabled === false) return emptyPools();
    } catch (e) {}
    const pools = inv.pools || {};
    // slot programming in demo mode (backend already filters when live)
    try {
      if (!USE_API) {
        const map2 = await backendPlacements();
        var cfg2 = slotCfg(map2 && map2[page], slot);
        if (cfg2) {
          if (cfg2.formats && cfg2.formats.length) {
            Object.keys(pools).forEach(function (k) {
              if (pools[k] && cfg2.formats.indexOf(k) === -1) pools[k] = [];
            });
          }
          orderPinned(pools, cfg2.adIds);
        }
      }
    } catch (e) {}
    const now = dayStart(new Date());
    const out = {};
    ['platform', 'book', 'native', 'embed', 'follow', 'banner', 'minibanner', 'promo', 'spotlight'].forEach(k => {
      out[k] = (Array.isArray(pools[k]) ? pools[k] : []).filter(ad => {
        if (ad.active === false) return false;
        if (!inSchedule(ad, now)) return false;
        if (page && Array.isArray(ad.pages) && ad.pages.length && !ad.pages.includes(page)) return false;
        if (slot && ad.slots && ad.slots.length && ad.slots.indexOf(slot) === -1) return false;
        return true;
      });
    });
    if (!USE_API) {
      try {
        const map3 = await backendPlacements();
        var cfg3 = slotCfg(map3 && map3[page], slot);
        if (cfg3) orderPinned(out, cfg3.adIds);
      } catch (e) {}
    }
    return out;
  }

  /* Impression / click tracking. Demo: local counters the ad-manager reads.
     Live-first: also POSTs /api/ads/track (per-user trail); subscribers
     (window.DroboardAdsFree) see no ads, so nothing is sent.
     ctx: { page, slot, postId, storyId } — userId is resolved server-side
     from session (never trust client). Demo attaches a stable anonymous
     viewerId (localStorage) so per-user counts work before login. */
  function getViewerId() {
    try {
      if (window.DroboardUser && (window.DroboardUser.id || window.DroboardUser.uid)) {
        return String(window.DroboardUser.id || window.DroboardUser.uid);
      }
      var k = 'dro_viewer_id', v = localStorage.getItem(k);
      if (!v) {
        v = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return 'anon'; }
  }
  function track(id, event, ctx) {
    if (!id) return;
    if (window.DroboardAdsFree) return;
    ctx = ctx || {};
    var payload = {
      id: id,
      event: event || 'impression',
      page: ctx.page || '',
      slot: ctx.slot || '',
      postId: ctx.postId || ctx.storyId || '',
      storyId: ctx.storyId || ctx.postId || '',
      viewerId: ctx.viewerId || getViewerId(),
      ts: Date.now(),
    };
    try { if (window.AdRevenue && AdRevenue.record) AdRevenue.record(payload); } catch (e) {}
    if (USE_API) {
      fetch(`${API_BASE}/ads/track`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
      return;
    }
    try {
      fetch(`${API_BASE}/ads/track`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch (e) {}
    try {
      const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {};
      const row = stats[id] || { impressions: 0, clicks: 0, viewers: {} };
      if (!row.viewers) row.viewers = {};
      if (event === 'click') row.clicks += 1;
      else row.impressions += 1;
      if (payload.viewerId) row.viewers[payload.viewerId] = (row.viewers[payload.viewerId] || 0) + 1;
      row.last = { page: payload.page, slot: payload.slot, postId: payload.postId, ts: payload.ts };
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
    const page = opts && opts.page, genre = opts && opts.genre, slot = opts && opts.slot;
    const pools = await getAds({ page, slot });
    return (pools.promo || []).filter(s => {
      if (!genre) return true;
      return !s.genre || s.genre === genre;
    });
  }

  window.AdService = { getPlacement, getAds, getPromoSlides, getInventory, track, readStats, getViewerId };
})();
