/**
 * feed-data.js — Droboard Feed Data Service (Live)
 * Single place feed.html asks for feed content.
 * All calls hit the real API — no demo fallback.
 */
(function () {
  'use strict';

  const CFG = { API_BASE: '/api' };

  function configure(opts) { Object.assign(CFG, opts || {}); }

  async function apiFetch(endpoint) {
    const res = await fetch(CFG.API_BASE + endpoint, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const YOU_AV = '';

  // /feed/home answers statuses (ring row) and posts in one call.
  // Both getStories() and getFeedPosts() share the same in-flight request.
  let homePending = null;
  function homeLive() {
    if (!homePending) {
      homePending = apiFetch('/feed/home').finally(() => { homePending = null; });
    }
    return homePending;
  }

  async function getStories() {
    return (await homeLive()).statuses || [];
  }

  async function getFeedPosts() {
    return (await homeLive()).posts || [];
  }

  // "Trending in hubs" community row — GET /discussions/feed
  async function getCommunityPosts() {
    const d = await apiFetch('/discussions/feed?limit=12');
    return (d && d.items) || [];
  }

  // Paginated community for "See all"
  async function getCommunityPage(page, limit) {
    const d = await apiFetch(`/discussions/feed?page=${encodeURIComponent(page || 1)}&limit=${encodeURIComponent(limit || 12)}`);
    return {
      items: (d && d.items) || [],
      total: (d && d.total) || 0,
      page: (d && d.page) || (page || 1),
      hasMore: !!(d && d.hasMore),
    };
  }

  async function getNotifCount() {
    const d = await apiFetch('/notifications/unread-count');
    return d.count || 0;
  }

  window.FeedData = { configure, getStories, getFeedPosts, getCommunityPosts, getCommunityPage, getNotifCount, YOU_AV };
})();
