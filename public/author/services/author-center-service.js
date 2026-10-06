/**
 * author-center-service.js — Data layer for author-center.html (Dashboard).
 * Page calls + renders only. All logic lives here.
 * TODO backend: GET /api/author/dashboard, GET /api/author/books
 */
(function () {
  'use strict';
  if (window.AuthorCenterService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  // Fallback demo (mirrors current inline STATS/BOOKS until backend live)
  function demoStats() { return { books: 6, reads: '2.3M', earnings: 1240, followers: 18900 }; }
  function demoBooks() {
    return [
      { id: 'b1', title: 'Bound By Obsession', genre: 'Romance', status: 'published', chapters: 56, reads: '2.3M', cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' },
      { id: 'b2', title: 'Second Chance', genre: 'Drama', status: 'ongoing', chapters: 24, reads: '480K', cover: 'https://i.pravatar.cc/300?img=12' }
    ];
  }

  window.AuthorCenterService = {
    async getStats() { if (CFG.USE_API) { try { return await callBackend('/dashboard'); } catch (e) {} } await delay(); return demoStats(); },
    async getBooks() { if (CFG.USE_API) { try { return await callBackend('/books'); } catch (e) {} } await delay(); return clone(demoBooks()); }
  };
})();
