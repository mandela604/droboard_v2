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
      placements: Object.assign({}, d.AD_PLACEMENTS || {}, ov.placements || {}),
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
        /* Behavior targeting from the ad setup Audience step. Unknown
           service (older page) serves the ad rather than hiding it. */
        var aud = ad.audience || {};
        if (window.DroboardAudience && Array.isArray(aud.segments) && aud.segments.length) {
          if (!DroboardAudience.matches(aud.segments, aud.match || 'any')) return false;
        }
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

  /* Lifecycle tracking. Demo: local counters the ad-manager reads (+ a
     best-effort POST so a running backend fills too). Live: server is the
     source of truth. Subscribers (window.DroboardAdsFree) see no ads, so
     nothing is sent.
     ctx: { page, slot, postId, storyId, statusId, showingId, value, currency,
     orderId }.
     Impression = one per rendered ad instance ("showing"), so the same
     creative legitimately logs many impressions across page views, slides
     and slots. Only the same showing retried twice is deduped (showingId;
     the backend enforces it with a unique eventKey). Reach is deduped
     separately by viewerId, never by hiding impressions.
     viewable = IAB standard: >=50% of the creative visible for 1s.
     Events: impression | viewable | click | complete | skip | conversion. */
  const STAT_FIELDS = { impression: 'impressions', viewable: 'viewables', click: 'clicks', complete: 'completes', skip: 'skips', conversion: 'conversions' };
  var _shown = {}; // showingId -> true (session scope: retry guard only)

  /* One id per rendered ad instance. Call it when the creative is mounted
     and pass it to every event for that instance. */
  function newShowing() {
    return 'sh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

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

  /* Small retry queue: a network blip must not lose billable events. */
  var _queue = [];
  function _post(payload) {
    var body = JSON.stringify(payload);
    fetch(`${API_BASE}/ads/track`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    }).then(function (r) {
      if (!r.ok) throw new Error('track_failed');
    }).catch(function () {
      _queue.push(payload);
      if (_queue.length > 40) _queue.shift();
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(API_BASE + '/ads/track', new Blob([body], { type: 'application/json' }));
        }
      } catch (e) {}
    });
  }
  function _flushQueue() {
    if (!_queue.length) return;
    var batch = _queue;
    _queue = [];
    batch.forEach(_post);
  }
  try { window.addEventListener('online', _flushQueue); } catch (e) {}

  function track(id, event, ctx) {
    if (!id) return;
    if (window.DroboardAdsFree) return;
    ctx = ctx || {};
    event = event || 'impression';
    if (!STAT_FIELDS[event]) return;

    var showingId = String(ctx.showingId || '');
    if (event === 'impression' || event === 'viewable') {
      if (!showingId) showingId = newShowing(); // each call = a fresh showing
      var seenKey = event + ':' + showingId;
      if (_shown[seenKey]) return;              // same event retried = ignore
      _shown[seenKey] = 1;
    }

    var payload = {
      id: id,
      event: event,
      page: ctx.page || '',
      slot: ctx.slot || '',
      postId: ctx.postId || ctx.storyId || '',
      storyId: ctx.storyId || ctx.postId || '',
      statusId: ctx.statusId || '',
      showingId: showingId,
      viewerId: ctx.viewerId || getViewerId(),
      ts: Date.now(),
    };
    if (event === 'conversion') {
      if (ctx.value != null) payload.value = Number(ctx.value) || 0;
      if (ctx.currency) payload.currency = String(ctx.currency).slice(0, 8);
      if (ctx.orderId) payload.orderId = String(ctx.orderId).slice(0, 120);
    }

    try { if (window.AdRevenue && AdRevenue.record) AdRevenue.record(payload); } catch (e) {}

    // Last-click attribution for later conversions (checkout success).
    if (event === 'click') {
      try {
        localStorage.setItem(ATTR_KEY, JSON.stringify({
          id: id, page: payload.page, slot: payload.slot,
          storyId: payload.storyId, at: payload.ts,
        }));
      } catch (e) {}
    }

    if (USE_API) { _post(payload); return; }

    // Demo: keep local counters AND best-effort post (backend may be running).
    _post(payload);
    try {
      const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {};
      const row = stats[id] || {};
      Object.keys(STAT_FIELDS).forEach(function (k) { if (!row[STAT_FIELDS[k]]) row[STAT_FIELDS[k]] = 0; });
      if (!row.viewers) row.viewers = {};
      row[STAT_FIELDS[event]] += 1;
      if (event === 'conversion' && payload.value) row.value = (row.value || 0) + payload.value;
      if (event === 'impression' && payload.viewerId) {
        row.viewers[payload.viewerId] = (row.viewers[payload.viewerId] || 0) + 1;
      }
      row.last = { event: event, page: payload.page, slot: payload.slot, postId: payload.postId, ts: payload.ts };
      stats[id] = row;
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  /* IAB viewability: send `viewable` once the creative has been >=50%
     visible for 1s continuously. Pass the same showingId as the impression
     so both events describe the same rendered instance. */
  function observe(el, id, ctx) {
    ctx = Object.assign({}, ctx || {});
    if (!ctx.showingId) ctx.showingId = newShowing();
    if (!el || !id || window.DroboardAdsFree) return ctx.showingId;
    try {
      if (!('IntersectionObserver' in window)) return ctx.showingId;
      var timer = null, done = false;
      var ob = new IntersectionObserver(function (entries) {
        var en = entries[entries.length - 1];
        if (!en || done) return;
        if (en.isIntersecting && en.intersectionRatio >= 0.5) {
          if (!timer) timer = setTimeout(function () {
            if (done) return;
            done = true;
            try { ob.disconnect(); } catch (e) {}
            track(id, 'viewable', ctx);
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }, { threshold: [0, 0.5, 1] });
      ob.observe(el);
    } catch (e) {}
    return ctx.showingId;
  }

  /* Attribute a conversion (checkout success, subscription, tip…). Uses the
     last clicked ad when no id is passed; orderId keeps retries idempotent. */
  const ATTR_KEY = 'dro_ad_attr';
  const ATTR_TTL = 30 * 24 * 3600 * 1000;
  function lastClick() {
    try {
      var a = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null');
      if (!a || !a.id) return null;
      if (a.at && Date.now() - a.at > ATTR_TTL) return null;
      return a;
    } catch (e) { return null; }
  }
  function convert(opts) {
    opts = opts || {};
    var attr = null;
    if (!opts.id && !opts.adId) attr = lastClick();
    var id = opts.id || opts.adId || (attr && attr.id);
    if (!id) return;
    track(id, 'conversion', {
      page: opts.page || (attr && attr.page),
      slot: opts.slot || (attr && attr.slot),
      storyId: opts.storyId || (attr && attr.storyId),
      postId: opts.postId, statusId: opts.statusId,
      value: opts.value, currency: opts.currency, orderId: opts.orderId,
    });
    // One attributed conversion per click.
    if (!opts.id && !opts.adId) {
      try { localStorage.removeItem(ATTR_KEY); } catch (e) {}
    }
  }

  /* Real per-slot numbers from the backend (null when unavailable so
     dashboards can fall back to demo data). */
  function getPerformance(opts) {
    opts = opts || {};
    if (!USE_API) return Promise.resolve(null);
    var qs = '?days=' + encodeURIComponent(opts.days || 30);
    if (opts.page) qs += '&page=' + encodeURIComponent(opts.page);
    return fetch(API_BASE + '/ads/performance' + qs, { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function readStats() {
    try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  /* Rolled-up Discover spotlight performance for marketing + admin.
     Demo reads the tracked counters; live dashboards should read the
     backend aggregate instead. */
  function spotlightStats() {
    var pool = [];
    try {
      var inv = demoInventory();
      pool = (inv.pools || {}).spotlight || [];
    } catch (e) {}
    var tracked = readStats();
    var impressions = 0, clicks = 0, viewers = {};
    var creatives = pool.map(function (ad) {
      var t = tracked[ad.id] || {};
      var imp = +t.impressions || 0;
      var clk = +t.clicks || 0;
      impressions += imp;
      clicks += clk;
      if (t.viewers) Object.keys(t.viewers).forEach(function (v) { viewers[v] = 1; });
      return {
        id: ad.id,
        title: ad.title || ad.heading || ad.name || ad.handle || ad.id,
        kind: (ad.kind === 'user' || ad.promoKind === 'user') ? 'user' : 'story',
        impressions: imp,
        clicks: clk,
        ctr: imp ? (clk / imp) * 100 : 0,
      };
    }).sort(function (a, b) { return b.impressions - a.impressions; });
    return {
      impressions: impressions,
      clicks: clicks,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      viewers: Object.keys(viewers).length,
      creatives: creatives,
    };
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

  window.AdService = { getPlacement, getAds, getPromoSlides, getInventory, track, observe, newShowing, convert, getPerformance, readStats, getViewerId, spotlightStats };
})();
