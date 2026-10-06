/** request-series-change-service.js — TODO: GET/POST /api/author/series-changes */
(function () { 'use strict'; if (window.SeriesChangeService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  window.SeriesChangeService = {
    async list() { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/series-changes'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; },
    async submit(d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/series-changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; }
  };
})();
