/**
 * contract-review-service.js — SE Contract Review page.
 * Live API only. The backend returns a bare array of contract applications:
 *   GET /api/senior-editor/contract-applications?page&limit&status
 *   POST /api/senior-editor/contract-applications/:id/approve  {templateId, advance?, note?, pricing?}
 *   POST /api/senior-editor/contract-applications/:id/reject   {reason}
 * Approve sends a Contract built from a chief-editor template for the author
 * to sign; reject closes the application.
 */
(function () {
  'use strict';
  if (window.__contractReviewService) return;
  window.__contractReviewService = true;

  const API_BASE = '/api/senior-editor/contract-applications';
  const PER_PAGE = 8;
  let contracts = [];
  let templates = [];
  let currentPage = 1;
  let activeStatus = 'all';
  let query = '';
  let openId = null;
  let templatesLoaded = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function toast(m) {
    const t = el('toast'); if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fmtNum(n) { return String(n || 0); }

  async function callApi(path, opts) {
    const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, opts || {}));
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((j && j.error) || ('API error ' + res.status));
    return j;
  }

  function showLoading() {
    const body = el('tableBody');
    if (body) body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-faint)"><i class="fas fa-spinner fa-spin"></i> Loading contracts…</div>';
  }
  function showError(msg) {
    const body = el('tableBody');
    if (body) body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)"><i class="fas fa-circle-exclamation"></i> ' + esc(msg) + '</div>';
  }

  async function loadContracts() {
    showLoading();
    try {
      const data = await callApi('?page=' + currentPage + '&limit=' + PER_PAGE + '&status=' + encodeURIComponent(activeStatus));
      contracts = Array.isArray(data) ? data : (data.items || []);
      const total = Array.isArray(data) ? contracts.length : (data.total || 0);
      renderRows();
      renderKpis();
      renderTabs();
      renderPager(total);
      return contracts;
    } catch (e) { showError('Failed to load contracts: ' + e.message); return []; }
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/senior-editor/contract-templates', { credentials: 'include' });
      const j = res.ok ? await res.json() : {};
      templates = Array.isArray(j) ? j : (j.items || []);
      templatesLoaded = true;
    } catch (e) { templates = []; templatesLoaded = true; }
  }

  function statusOf(a) { return a.status || 'pending'; }

  function renderKpis() {
    const counts = { pending: 0, approved: 0, signed: 0, rejected: 0 };
    contracts.forEach(function (a) { const s = statusOf(a); if (counts[s] != null) counts[s]++; });
    const total = contracts.length || 1;
    const map = { pending: ['sP', 'sPPct', 'sPBar'], approved: ['sA', 'sAPct', 'sABar'], signed: ['sS', 'sSPct', 'sSBar'], rejected: ['sR', 'sRPct', 'sRBar'] };
    Object.keys(map).forEach(function (k) {
      const ids = map[k], n = counts[k];
      if (el(ids[0])) el(ids[0]).textContent = n;
      if (el(ids[1])) el(ids[1]).textContent = Math.round((n / total) * 100) + '%';
      if (el(ids[2])) el(ids[2]).style.width = Math.round((n / total) * 100) + '%';
    });
  }

  function renderTabs() {
    const host = el('statusTabs'); if (!host) return;
    const counts = { all: contracts.length, pending: 0, approved: 0, signed: 0, rejected: 0 };
    contracts.forEach(function (a) { const s = statusOf(a); if (counts[s] != null) counts[s]++; });
    const tabs = [
      { k: 'all', l: 'All' }, { k: 'pending', l: 'Pending' }, { k: 'approved', l: 'Approved' },
      { k: 'signed', l: 'Signed' }, { k: 'rejected', l: 'Rejected' },
    ];
    host.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="stab ' + t.k + (activeStatus === t.k ? ' on' : '') + '" data-status="' + t.k + '">'
        + '<span class="dot"></span>' + t.l + '<span class="cnt">' + (counts[t.k] || 0) + '</span></button>';
    }).join('');
    host.querySelectorAll('.stab').forEach(function (b) {
      b.addEventListener('click', function () { activeStatus = b.getAttribute('data-status'); currentPage = 1; loadContracts(); });
    });
  }

  function renderRows() {
    const body = el('tableBody'); if (!body) return;
    let list = contracts.slice();
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(function (a) {
        return [a.author, a.email, a.bookTitle, a.bookGenre, a.id].some(function (v) { return String(v || '').toLowerCase().indexOf(q) !== -1; });
      });
    }
    if (!list.length) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-faint)"><i class="fas fa-inbox" style="font-size:22px;display:block;margin-bottom:8px"></i>No contracts found</div>';
      return;
    }
    body.innerHTML = list.map(function (a) {
      const s = statusOf(a);
      const open = openId === String(a.id);
      return '<div class="item-row' + (open ? ' is-open' : '') + '" data-id="' + esc(a.id) + '">'
        + '<div class="expand-ico"><i class="fas fa-chevron-right"></i></div>'
        + '<div class="author-cell"><img src="' + esc(a.avatar || '../assets/droboard-icon.png') + '" alt=""/>'
          + '<div class="author-info"><span class="author-name">' + esc(a.author || 'Unknown') + '</span><span class="author-id">' + esc(a.email || '') + '</span></div></div>'
        + '<div><div class="book-title">' + esc(a.bookTitle || '') + '</div><div class="book-genre">' + esc(a.bookGenre || '') + '</div></div>'
        + '<div class="contract-type">' + esc(a.ct || a.type || '—') + '</div>'
        + '<span class="status-pill ' + esc(s) + '">' + esc(s) + '</span>'
        + '<span class="submitted">' + esc(a.submitted || '') + '</span>'
        + '</div>'
        + '<div class="item-detail' + (open ? ' show' : '') + '" id="detail-' + esc(a.id) + '">' + detailHtml(a) + '</div>';
    }).join('');

    body.querySelectorAll('.item-row').forEach(function (row) {
      row.addEventListener('click', function () {
        const id = row.getAttribute('data-id');
        openId = openId === id ? null : id;
        renderRows();
      });
    });
    bindDetailEvents(body);
  }

  function detailHtml(a) {
    const s = statusOf(a);
    const pending = s === 'pending';
    let tplOpts = '<option value="">— Choose a template —</option>';
    templates.forEach(function (t) {
      tplOpts += '<option value="' + esc(t.id || t.templateId || t.name) + '">' + esc(t.name || t.label || t.id) + '</option>';
    });
    let body = '<div class="detail-inner"><div class="detail-header">'
      + '<img class="detail-avatar" src="' + esc(a.avatar || '../assets/droboard-icon.png') + '" alt=""/>'
      + '<div class="detail-title"><h3>' + esc(a.author || 'Unknown') + '</h3><p>' + esc(a.email || '') + ' · ' + esc(a.bookTitle || '') + '</p></div></div>'
      + '<div class="detail-grid">'
      + '<div class="detail-card"><label>Status</label><b>' + esc(s) + '</b></div>'
      + '<div class="detail-card"><label>Book</label><b>' + esc(a.bookTitle || '') + '</b></div>'
      + '<div class="detail-card"><label>Submitted</label><b>' + esc(a.submitted || '') + '</b></div>'
      + '<div class="detail-card"><label>Identity</label><b>' + esc(a.verificationStatus || 'none') + '</b></div>'
      + '</div>';
    if (a.verificationStatus !== 'approved') {
      body += '<div class="detail-notes-box"><div class="lbl"><i class="fas fa-triangle-exclamation"></i> Identity not verified</div><p>This writer must be approved in Author Verification before an offer can be sent.</p></div>';
    }
    if (pending && a.verificationStatus === 'approved') {
      body += '<div class="detail-contract-select"><div class="lbl"><i class="fas fa-file-signature"></i> Contract template</div>'
        + '<select id="tpl-' + esc(a.id) + '">' + tplOpts + '</select></div>';
    }
    body += '<div class="detail-actions">';
    if (pending && a.verificationStatus === 'approved') {
      body += '<button class="btn btn-green" data-send="' + esc(a.id) + '"><i class="fas fa-paper-plane"></i> Send offer</button>'
        + '<button class="btn btn-danger" data-reject="' + esc(a.id) + '"><i class="fas fa-xmark"></i> Reject</button>';
    } else if (!pending) {
      body += '<span class="status-pill ' + esc(s) + '">' + esc(s) + '</span>';
    }
    body += '<button class="btn btn-ghost" data-close-detail><i class="fas fa-xmark"></i> Close</button></div></div>';
    return body;
  }

  function bindDetailEvents(body) {
    body.querySelectorAll('[data-close-detail]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); openId = null; renderRows(); });
    });
    body.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = b.getAttribute('data-send');
        const sel = el('tpl-' + id);
        if (!sel || !sel.value) { toast('Choose a contract template first'); return; }
        b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
        callApi('/' + encodeURIComponent(id) + '/approve', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: sel.value }),
        }).then(function () { toast('✅ Offer sent to author'); openId = null; return loadContracts(); })
          .catch(function (err) { toast('Could not send offer — ' + err.message); b.disabled = false; b.innerHTML = '<i class="fas fa-paper-plane"></i> Send offer'; });
      });
    });
    body.querySelectorAll('[data-reject]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = b.getAttribute('data-reject');
        const reason = window.prompt('Reason for rejecting this application (min 5 characters):');
        if (!reason || reason.trim().length < 5) { toast('A reason of at least 5 characters is required'); return; }
        b.disabled = true;
        callApi('/' + encodeURIComponent(id) + '/reject', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() }),
        }).then(function () { toast('Application rejected'); openId = null; return loadContracts(); })
          .catch(function (err) { toast('Could not reject — ' + err.message); b.disabled = false; });
      });
    });
  }

  function renderPager(total) {
    const info = el('pageInfo'), btns = el('pageBtns');
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (info) info.innerHTML = 'Showing <b>' + ((currentPage - 1) * PER_PAGE + 1) + '</b>–<b>' + Math.min(currentPage * PER_PAGE, total) + '</b> of <b>' + total + '</b>';
    if (!btns) return;
    if (pages <= 1) { btns.innerHTML = ''; return; }
    let h = '<button class="pg-btn" data-page="prev"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    for (let i = 1; i <= pages; i++) h += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    h += '<button class="pg-btn" data-page="next"' + (currentPage >= pages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    btns.innerHTML = h;
    btns.querySelectorAll('.pg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        const p = b.getAttribute('data-page');
        if (p === 'prev' && currentPage > 1) currentPage--;
        else if (p === 'next' && currentPage < pages) currentPage++;
        else currentPage = parseInt(p, 10) || 1;
        loadContracts();
      });
    });
  }

  async function init() {
    await Promise.all([loadTemplates(), loadContracts()]);
    // KPI cards act as status filters.
    document.querySelectorAll('#kpiRow .kpi').forEach(function (k) {
      k.addEventListener('click', function () { activeStatus = k.getAttribute('data-status') || 'all'; currentPage = 1; loadContracts(); });
    });
    const s = el('searchInput');
    if (s) s.addEventListener('input', function () { query = s.value.trim(); renderRows(); });
  }

  window.ContractReviewService = { init: init, reload: loadContracts };
  // Auto-init (the page includes this script without a separate init call).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
