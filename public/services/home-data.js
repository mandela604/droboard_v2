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
    // Homepage is a fullscreen swipe deck: every card (story or ad) fills
    // the screen. Promo ads interleave after every N story cards (N from
    // the home placement, default 5). Baked-in demo ad slides are used
    // only when no promo pool exists.
    let promoSlides = [];
    let homeInterval = 5, homeEnabled = true;
    try {
      if (window.AdService) {
        if (typeof AdService.getPlacement === 'function') {
          const pl = await AdService.getPlacement('home');
          if (pl) {
            if (pl.interval) homeInterval = Math.max(1, parseInt(pl.interval, 10) || 5);
            if (pl.enabled === false) homeEnabled = false;
          }
        }
        if (typeof AdService.getPromoSlides === 'function' && homeEnabled) {
          promoSlides = await AdService.getPromoSlides({ page: 'home', slot: 'home:swipe-card' });
        }
      }
    } catch (e) { promoSlides = d.ADS ? d.ADS.promoSlides : []; }
    if (!promoSlides.length && d.ADS) promoSlides = d.ADS.promoSlides || [];
    let heroStories = d.HERO_STORIES || [];
    if (homeEnabled && promoSlides.length) {
      const stories = heroStories.filter(s => s.type !== 'ad-droboard' && s.type !== 'ad-story');
      const deck = [];
      let pi = 0;
      stories.forEach((s, i) => {
        deck.push(s);
        if ((i + 1) % homeInterval === 0) {
          const p = promoSlides[pi % promoSlides.length]; pi++;
          deck.push({
            type: 'ad-story', id: p.id || ('promo-' + pi),
            cover: p.img || p.cover || '', genre: p.genre || '',
            brand: p.title || p.brand || 'Sponsored', author: p.author || '',
            sub: p.sub || '',
          });
        }
      });
      heroStories = deck;
    } else if (!homeEnabled) {
      heroStories = heroStories.filter(s => s.type !== 'ad-droboard' && s.type !== 'ad-story');
    }
    return {
      statuses: d.STATUSES || [],
      heroStories: heroStories,
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
