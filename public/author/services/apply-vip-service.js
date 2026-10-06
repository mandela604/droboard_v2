/** apply-vip-service.js — TODO: POST /api/author/vip */
(function () { 'use strict'; if (window.ApplyVipService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  window.ApplyVipService = {
    async submit(d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/vip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; }
  };
})();
