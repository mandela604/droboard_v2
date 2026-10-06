/**
 * book-overview-service.js — Data layer for book-overview.html.
 * TODO backend: GET /api/author/books/:id/overview
 */
(function () {
  'use strict';
  if (window.BookOverviewService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  async function callBackend(path) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, { signal: c.signal }); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }
  window.BookOverviewService = {
    async getOverview(bookId) {
      if (CFG.USE_API) { try { return await callBackend('/books/' + (bookId || 'b1') + '/overview'); } catch (e) {} }
      await delay();
      return { stats: { reads: '2.3M', likes: '189K', chapters: 56 }, activity: [{ text: 'Chapter 56 submitted', time: '2h ago' }, { text: 'New follower milestone', time: '1d ago' }], quickActions: ['New Chapter', 'Plotting', 'Characters'] };
    }
  };
})();
