/* ═══════════════════════════════════════════════════════════════
   HOME DATA SERVICE — single source for Pages/index.html
   Demo: reads window.DemoData (central-demo-data.js) + AdService
   Live: set USE_API=true, backend GET /api/home returns same shape
   Pages/index.html never touches DemoData directly.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const USE_API = false;
  const API_BASE = '/api';

  async function getHomeData() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/home`, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Home API failed: ' + res.status);
      return res.json(); // { statuses, heroStories, notifCount }
    }
    // demo — unify all homepage demo slices from central-demo-data.js
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData || {};
    // HERO_STORIES already interleaves stories + promo ads (HOME_CD/HOME_AD/HOME_HD) — curated in central-demo-data.js:730
    // STATUSES is the status ring data — central-demo-data.js:800
    // ADS.promoSlides can also come from AdService promo pool for home placement
    let promoSlides = [];
    try {
      if (window.AdService && typeof AdService.getPromoSlides === 'function') {
        promoSlides = await AdService.getPromoSlides({ page: 'home' });
      }
    } catch (e) { promoSlides = d.ADS ? d.ADS.promoSlides : []; }
    return {
      statuses: d.STATUSES || [],
      heroStories: d.HERO_STORIES || [],
      promoSlides: promoSlides.length ? promoSlides : (d.ADS ? d.ADS.promoSlides : []),
      notifCount: 3
    };
  }

  async function getNotifCount() {
    if (USE_API) {
      const r = await fetch(`${API_BASE}/notifications/unread-count`, { credentials: 'include' });
      if (!r.ok) throw new Error('Notif API failed');
      return (await r.json()).count;
    }
    await new Promise(r => setTimeout(r, 40));
    return 3;
  }

  window.HomeData = { getHomeData, getNotifCount, USE_API };
})();
