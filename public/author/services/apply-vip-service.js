/** apply-vip-service.js — owns render + bindings for apply-vip.html. TODO: POST /api/author/vip */
(function () { 'use strict';
  if (window.ApplyVipService && window.ApplyVipService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  function validate() { document.getElementById('submitBtn').disabled = !(document.getElementById('statement').value.trim() && document.getElementById('termsCheck').checked); }

  function init() {
    document.getElementById('statement').addEventListener('input', validate);
    document.getElementById('termsCheck').addEventListener('change', validate);
    document.getElementById('submitBtn').addEventListener('click', function () {
      this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying…';
      setTimeout(function () { document.getElementById('formView').style.display = 'none'; document.getElementById('successView').classList.add('show'); }, 1200);
    });
    document.getElementById('doneBtn').addEventListener('click', function () { window.location.href = 'author-center.html'; });
    document.getElementById('backBtn').addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html'; });
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-vip.html'); window.AuthorDrawer.bind(); }
  }

  var api = window.ApplyVipService || {};
  api.submit = api.submit || async function (d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/vip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; };
  api.init = init;
  window.ApplyVipService = api;
})();
