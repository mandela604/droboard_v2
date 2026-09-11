/* ═══════════════════════════════════════════════════════════════
   HOME DATA SERVICE
   Same fetch-with-demo-fallback shape as services/feed-data.js and
   services/profile-data.js: USE_API flips this to real endpoints
   later without touching index.html's render code.
═══════════════════════════════════════════════════════════════ */
(function () {
  const USE_API = false;
  const API_BASE = '/api';

  async function getHomeData() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/home`);
      if (!res.ok) throw new Error('Home API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 120));
    const seed = window.HomeDemoSeed;
    return {
      heroStories: seed.HERO_STORIES,
      continueReading: seed.CONTINUE_READING,
      trendingGenres: seed.TRENDING_GENRES,
      chapterDrops: seed.CHAPTER_DROPS,
      writersToFollow: seed.WRITERS_TO_FOLLOW,
      statuses: seed.STATUSES,
      event: seed.EVENT,
      announcement: seed.ANNOUNCEMENT,
      ads: seed.ADS,
    };
  }

  async function getNotifCount() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/notifications/unread-count`);
      if (!res.ok) throw new Error('Notif API failed');
      const d = await res.json();
      return d.count;
    }
    await new Promise(r => setTimeout(r, 60));
    return 3;
  }

  window.HomeData = { getHomeData, getNotifCount };
})();