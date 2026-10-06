/** apply-contract-service.js — TODO: GET/POST /api/author/contracts */
(function () { 'use strict'; if (window.ApplyContractService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  window.ApplyContractService = {
    async list() { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; },
    async submit(d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true, id: 'CT-' + Date.now() }; }
  };
})();
