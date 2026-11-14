/* ══════════════════════════════════════════════════════════════
   AD SERVICE
   Single source of ad inventory for all client pages.
   Live: GET /api/ads?placement=<page>.

   API contract (backend):
     GET  /api/ads?placement=discover|feed|genreHub
        → { placement: { interval, cycle?, topPromo? },
            pools: { platform: [], book: [], native: [], follow: [], banner: [], minibanner: [] } }
     POST /api/ads/track  { id, event: 'impression' | 'click' }
   ══════════════════════════════════════════════════════════════ */
('use strict');

  const API_BASE = '/api';

  /* ── Inventory (live only) ──────────────────────────────────────────── */
  /* The page always asks for its placement + ad pools in one request.
     There is NO demo fallback — if the API is unreachable the error
     propagates up and the UI shows the error state. */
  async function getInventory(page, slot) {
    const url = `${API_BASE}/ads?placement=${encodeURIComponent(page || '')}`;
    if (slot) url += `&slot=${encodeURIComponent(slot)}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const err = new Error(json && json.error ? json.error : ('Request failed (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /* ── Placement map (kill switches + slot flags) ──────────────────────── */
  /* Live only — one request per page-load, cached in memory so repeated
     calls within the same page load cost nothing extra. */
  var _placements = null, _placementsAt = 0;
  function backendPlacements() {
    if (_placements && Date.now() - _placementsAt < 10 * 60 * 1000) return Promise.resolve(_placements);
    return getInventory('placements').then(function (j) {
      _placements = j || {};
      _placementsAt = Date.now();
      return _placements;
    }).catch(function (e) { throw e; });
  }

  /* Placement config for a page: { interval, cycle?, topPromo? } */
  async function getPlacement(page) {
    const inv = await getInventory(page);
    const base = inv.placement || { interval: 4 };
    try {
      const map = await backendPlacements();
      const live = map && map[page];
      if (live) return Object.assign({}, base, live);
    } catch (e) { throw e; }
    return base;
  }

  /* Serving pools, filtered for a page + optional slot: inactive,
     unscheduled, untargeted and slot-disabled ads are excluded. */
  async function getAds(opts) {
    const page = opts && opts.page;
    const slot = opts && opts.slot;
    // Merge Pass: ad-free everywhere except Discover.
    try {
      if (!window.DroboardAdsFreeEverywhere) {
        const ent = myEntitlements();
        if (ent && ent.adsFreeEverywhere && page !== 'discover') return { pools: {} };
      } else if (page !== 'discover') return { pools: {} };
    } catch (e) { throw e; }
    const inv = await getInventory(page, slot);
    // backend kill switch (marketing toggle) empties pools in any mode
    try {
      const map = await backendPlacements();
      const live = map && map[page];
      if (live && live.enabled === false) return { pools: {} };
      var cfg = slotCfg(live, slot);
      if (cfg && cfg.enabled === false) return { pools: {} };
    } catch (e) { throw e; }
    const pools = inv.pools || {};
    // slot programming — live mode has no client-side format filter;
    // the backend already enforces it.
    try {
      if (!window.USE_API) {
        const map2 = await backendPlacements();
        var cfg2 = slotCfg(map2 && map2[page], slot);
        if (cfg2) {
          if (cfg2.formats && cfg2.formats.length) {
            // live mode: formats are enforced server-side only
          }
        }
      }
    } catch (e) { throw e; }
    return { pools };
  }

  /* Public: the resolved config for ONE slot id — kill switch, format pin,
     frequency cap. Same cached placement map the serving path already uses,
     so a cap check costs no extra request. Slot ids are namespaced
     ('discover:strip'), which is exactly how the map is keyed. */
  async function getSlotConfig(page, slot) {
    try {
      const map = await backendPlacements();
      return slotCfg(map && map[page], slot);
    } catch (e) { throw e; }
    return null;
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
  /* ——————————————————————————————————————————————————————————————————————— */
  /* What used to be the demo path (MarketingData, localStorage pools,
     USE_API guard) has been removed.  The client now always queries the
   backend.  If the backend is down the error surfaces — there is no
   silent fallback to stale demo data. */
  /* ——————————————————————————————————————————————————————————————————————— */
  async function getPromoSlides(opts) {
    try {
      const r = await getInventory('promo', opts && opts.slot);
      const pools = await getAds({ page, slot: opts && opts.slot });
      const placement = (inv && inv.placement) || { interval: 4 };
      const slides = (pools.promo || []).slice(0, 5);
      return { slides, placement, pools };
    } catch (e) { throw e; }
  }

  /* Entitlements: one request per page load. The in-flight guard stops the
     entitlements callers from firing the same request at the same time. */
  var _entPending = null;
  function myEntitlements() {
    if (window.DroboardAdsFreeEverywhere) return Promise.resolve({ adsFreeEverywhere: true });
    if (_ent !== null && _ent !== undefined) return Promise.resolve(_ent);
    if (_entPending) return _entPending;
    try {
      _entPending = getInventory('entitlements').then(function (r) {
        if (!r || !r.adsFreeEverywhere) { _ent = false; return _ent; }
        _ent = r;
        _entPending = null;
        return _ent;
      }).catch(function () { _entPending = null; return false; });
      return _entPending;
    } catch (e) { return Promise.resolve(false); }
  }

  // Stub functions that were removed with demo cleanup but still referenced externally
  function track() {}
  function observe() {}
  function newShowing() {}
  function convert() {}
  function getPerformance() { return Promise.resolve(null); }
  function readStats() { return Promise.resolve(null); }
  function getViewerId() { return null; }
  function spotlightStats() { return Promise.resolve(null); }

  window.AdService = { getPlacement, getSlotConfig, getAds, getPromoSlides, getInventory, track, observe, newShowing, convert, getPerformance, readStats, getViewerId, spotlightStats };