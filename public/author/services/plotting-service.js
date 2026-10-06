/**
 * plotting-service.js — Data layer for plotting.html.
 * TODO backend: GET/PUT /api/author/books/:id/plot
 */
(function () {
  'use strict';
  if (window.PlottingService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  window.PlottingService = {
    async getPlot(bookId) {
      if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot'); if (r.ok) return await r.json(); } catch (e) {} }
      await delay();
      return clone({ acts: [{ n: 1, title: 'Setup' }, { n: 2, title: 'Confrontation' }, { n: 3, title: 'Resolution' }], roadmap: [], turningPoints: [] });
    },
    async savePlot(bookId, plot) {
      if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot) }); if (r.ok) return await r.json(); } catch (e) {} }
      await delay(200); return { ok: true };
    }
  };
})();
