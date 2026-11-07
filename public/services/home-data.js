/* ═══════════════════════════════════════════════════════════════
   HOME DATA SERVICE — single source for Pages/index.html
   Live: GET /api/feed/home?scope=authors
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const API_BASE = '/api';

  async function getHomeData() {
    const res = await fetch(`${API_BASE}/feed/home?scope=authors`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Home API failed: ' + res.status);
    const d = await res.json();
    return {
      statuses: d.statuses || [],
      heroStories: d.heroStories || [],
      promoSlides: d.promoSlides || [],
      notifCount: d.notifCount || 0,
    };
  }

  async function getNotifCount() {
    const r = await fetch(`${API_BASE}/notifications/unread-count`, { credentials: 'include' });
    if (!r.ok) throw new Error('Notif API failed: ' + r.status);
    return (await r.json()).count || 0;
  }

  window.HomeData = { getHomeData, getNotifCount };
})();
