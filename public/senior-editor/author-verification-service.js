/**
 * author-verification-service.js — Data + rendering for Author Verification.
 * Live API only. Every request shows who submitted it, what identity path and
 * documents they sent, when, who owns it, its status, and real review actions.
 */
(function () {
  'use strict';
  if (window.__authorVerificationService) return;
  window.__authorVerificationService = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/author-verification';
  const TIMEOUT_MS = 8000;
  let requests = [];
  let view = 'all';
  let query = '';
  let openId = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function avatar(src) { return esc(src || '../assets/droboard-icon.png'); }
  function label(r) {
    return r.author || r.name || r.email || 'Unknown author';
  }
  // Never say "No documents" when the record actually carries an NIN, an
  // alternate ID or uploaded ID photos. Older deployments returned a stale
  // label; derive it from the KYC itself as the source of truth.
  function documentOf(r) {
    const k = r.kyc || {};
    const hasAlt = !!(k.altId && (k.altId.type || k.altId.no));
    const hasPhotos = !!(k.idPhotos && (k.idPhotos.front || k.idPhotos.back));
    if (k.type === 'guardian') return (k.guardian && k.guardian.name) ? 'Guardian ID' : 'Guardian ID';
    if (k.type === 'pending' || hasAlt) return (k.altId && k.altId.type) || 'Alternate ID';
    if (k.nin || hasPhotos) return 'National ID (NIN)';
    if (r.document && !/^no documents$/i.test(r.document)) return r.document;
    return r.doc || 'No documents';
  }
  function showError(msg) {
    const el = document.getElementById('tableBody');
    if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ' + esc(msg) + '</td></tr>';
  }
  function loading() {
    const el = document.getElementById('tableBody');
    if (el) el.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading verification requests...</td></tr>';
  }
  async function callApi(path, opts) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: c.signal, credentials: 'include' }, opts || {}));
      clearTimeout(t);
      if (!res.ok) throw new Error('API error ' + res.status);
      const txt = await res.text();
      return txt ? JSON.parse(txt) : [];
    } catch (e) { clearTimeout(t); throw e; }
  }

  function normalize(r) {
    return Object.assign({}, r, {
      id: String(r.id || ''),
      author: label(r),
      name: label(r),
      document: documentOf(r),
      submitted: r.submitted || '—',
      reviewer: typeof r.reviewer === 'object'
        ? ((r.reviewer && (r.reviewer.name || r.reviewer.fullName)) || 'Unassigned')
        : (r.reviewer || 'Unassigned'),
      reviewerAvatar: r.reviewerAvatar || (typeof r.reviewer === 'object' && r.reviewer.avatar) || '',
      status: (r.status || 'pending').toLowerCase(),
    });
  }

  async function loadRequests() {
    loading();
    try {
      const rows = await callApi('/requests');
      requests = (Array.isArray(rows) ? rows : []).map(normalize);
      return requests;
    } catch (e) { showError('Failed to load verification requests: ' + e.message); requests = []; return []; }
  }
  async function loadHistory() {
    try {
      const rows = await callApi('/history');
      requests = (Array.isArray(rows) ? rows : []).map(normalize);
      view = 'all';
      render();
    } catch (e) { showError('Failed to load history: ' + e.message); }
  }
  async function loadRecentReviews() {
    try {
      const rows = await callApi('/recent-reviews');
      return (Array.isArray(rows) ? rows : []).map(normalize);
    } catch (e) { console.error('Failed to load recent reviews:', e); return []; }
  }

  function visible() {
    return requests.filter(function (r) {
      if (view !== 'all' && r.status !== view) return false;
      if (!query) return true;
      const hay = [r.author, r.email, r.document, r.reviewer].join(' ').toLowerCase();
      return hay.indexOf(query.toLowerCase()) !== -1;
    });
  }

  function stats() {
    const out = { all: requests.length, pending: 0, approved: 0, rejected: 0 };
    requests.forEach(function (r) { if (out[r.status] != null) out[r.status]++; });
    return out;
  }
  function renderStats() {
    const mount = document.getElementById('statsGrid');
    if (!mount) return;
    const s = stats();
    const cards = [
      { n: s.all, l: 'All Requests', i: 'fa-list-check', c: 'pink' },
      { n: s.pending, l: 'Pending Review', i: 'fa-clock', c: 'amber' },
      { n: s.approved, l: 'Approved', i: 'fa-circle-check', c: 'green' },
      { n: s.rejected, l: 'Rejected', i: 'fa-circle-xmark', c: 'red' },
      { n: requests.filter(function (r) { return r.kyc && r.kyc.idPhotos && r.kyc.idPhotos.front; }).length,
        l: 'Documents Received', i: 'fa-id-card', c: 'blue' },
    ];
    mount.innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="stat-top"><div class="stat-ico ' + c.c + '"><i class="fas ' + c.i + '"></i></div></div>'
        + '<div class="stat-num">' + c.n + '</div><div class="stat-lbl">' + c.l + '</div></div>';
    }).join('');
  }

  function detailRow(r) {
    if (openId !== String(r.id)) return '';
    const panel = window.KycPanel && typeof KycPanel.html === 'function'
      ? KycPanel.html(r)
      : '<div class="sub-note">Identity details are unavailable on this page.</div>';
    const reason = r.status === 'rejected'
      ? '<div class="rej-box"><div class="rej-lbl"><i class="fas fa-circle-exclamation"></i> Reason for rejection</div>'
        + '<div class="sub-note">' + esc(r.reviewNote || 'No reason recorded.') + '</div></div>'
      : '<div class="rej-box"><div class="rej-lbl"><i class="fas fa-comment-dot"></i> Reject with a reason</div>'
        + '<textarea class="rej-text" data-rej-text="' + esc(r.id) + '" placeholder="Tell the author exactly what to fix…"></textarea>'
        + '<div class="rej-actions"><button class="sub-btn no" data-reject="' + esc(r.id) + '"><i class="fas fa-xmark"></i> Reject request</button></div></div>';
    return '<tr class="detail-row"><td colspan="6"><div class="sub-inner">'
      + '<div class="sub-head"><img class="sub-avatar" src="' + avatar(r.avatar) + '" alt=""/>'
      + '<div class="sub-head-t"><h3>' + esc(label(r)) + '</h3><p>' + esc(r.email || '') + '</p>'
      + '<div class="sub-by">Submitted ' + esc(r.submitted) + ' · Reviewer: ' + esc(r.reviewer) + '</div></div></div>'
      + '<div class="sub-grid">'
      + '<div class="sub-card"><label>Status</label><b>' + esc(r.status) + '</b></div>'
      + '<div class="sub-card"><label>Document</label><b>' + esc(documentOf(r)) + '</b></div>'
      + '<div class="sub-card"><label>Submitted</label><b>' + esc(r.submitted) + '</b></div>'
      + '<div class="sub-card"><label>Request ID</label><b>' + esc(r.id) + '</b></div>'
      + '</div>'
      + panel
      + (r.status === 'pending'
        ? '<div class="sub-actions"><button class="sub-btn ok" data-approve="' + esc(r.id) + '"><i class="fas fa-check"></i> Approve identity</button>'
          + '<button class="sub-btn close" data-close-detail><i class="fas fa-xmark"></i> Close</button></div>' + reason
        : '<div class="sub-actions"><button class="sub-btn close" data-close-detail><i class="fas fa-xmark"></i> Close</button></div>' + reason)
      + '</div></td></tr>';
  }

  function row(r) {
    const open = openId === String(r.id);
    return '<tr class="req-row' + (open ? ' is-open' : '') + '" data-row="' + esc(r.id) + '">'
      + '<td class="auth-cell" data-label="Author"><div class="cell-flex"><span class="row-chev"><i class="fas fa-chevron-right"></i></span>'
      + '<img class="auth-avatar" src="' + avatar(r.avatar) + '" alt=""/>'
      + '<div><div class="auth-name">' + esc(label(r)) + '</div><div class="auth-email">' + esc(r.email || '—') + '</div></div></div></td>'
      + '<td class="doc-cell" data-label="Document"><div class="cell-flex"><i class="fas fa-file"></i> ' + esc(documentOf(r)) + '</div></td>'
      + '<td class="plain-cell" data-label="Submitted">' + esc(r.submitted || '—') + '</td>'
      + '<td class="reviewer-cell" data-label="Reviewer"><div class="cell-flex"><img src="' + avatar(r.reviewerAvatar) + '" alt=""/><span>' + esc(r.reviewer || '—') + '</span></div></td>'
      + '<td data-label="Status"><span class="status-pill ' + esc(r.status) + '">' + esc(r.status) + '</span></td>'
      + '<td class="actions-cell" data-label="Actions"><div class="cell-flex">'
      + (r.status === 'pending'
        ? '<button class="act-btn approve" data-approve="' + esc(r.id) + '" title="Approve"><i class="fas fa-check"></i></button>'
          + '<button class="act-btn reject" data-reject="' + esc(r.id) + '" title="Reject"><i class="fas fa-times"></i></button>'
        : '<span class="sub-note">Reviewed</span>')
      + '</div></td></tr>' + detailRow(r);
  }

  function render() {
    const rows = visible();
    const tbody = document.getElementById('tableBody');
    if (tbody) {
      tbody.innerHTML = rows.length
        ? rows.map(row).join('')
        : '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:40px"><i class="fas fa-inbox" style="font-size:24px;display:block;margin-bottom:8px"></i>No verification requests in this view.</td></tr>';
    }
    renderStats();
    const title = document.getElementById('tableTitle');
    if (title) title.textContent = view === 'all' ? 'All Verification Requests' : view.charAt(0).toUpperCase() + view.slice(1) + ' Requests';
    const info = document.getElementById('pageInfo');
    if (info) info.innerHTML = 'Showing <b>1</b> to <b>' + rows.length + '</b> of <b>' + rows.length + '</b> requests';
    const pending = document.getElementById('pendingCount');
    if (pending) pending.textContent = stats().pending;
    document.querySelectorAll('.top-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === view);
    });
    const recentGrid = document.getElementById('recentPanel');
    if (recentGrid) recentGrid.style.display = view === 'all' ? '' : 'none';
  }

  function bind() {
    document.querySelectorAll('.top-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        view = tab.getAttribute('data-view') || 'all';
        openId = null;
        render();
      });
    });
    const search = document.getElementById('tableSearch');
    if (search) search.addEventListener('input', function () { query = search.value.trim(); render(); });
    const exp = document.getElementById('exportBtn');
    if (exp) exp.addEventListener('click', exportCsv);

    const body = document.getElementById('tableBody');
    if (body) {
      body.addEventListener('click', function (e) {
        const close = e.target.closest('[data-close-detail]');
        if (close) { openId = null; render(); return; }
        const ap = e.target.closest('[data-approve]');
        if (ap) { approveRequest(ap.getAttribute('data-approve')); return; }
        const rej = e.target.closest('[data-reject]');
        if (rej) { rejectRequest(rej.getAttribute('data-reject')); return; }
        const tr = e.target.closest('tr.req-row');
        if (tr) {
          openId = openId === tr.getAttribute('data-row') ? null : tr.getAttribute('data-row');
          render();
        }
      });
    }
    // "View All" in the recently-reviewed panel reads the full history.
    const viewAll = document.querySelector('#recentPanel .panel-head a');
    if (viewAll) viewAll.addEventListener('click', loadHistory);
  }

  function exportCsv() {
    const rows = visible();
    const cols = ['id', 'author', 'email', 'document', 'submitted', 'reviewer', 'status'];
    const csv = [cols.join(',')].concat(rows.map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"'; }).join(',');
    })).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'author-verification.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  async function approveRequest(id) {
    if (!id) return;
    try {
      await callApi('/requests/' + encodeURIComponent(id) + '/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const r = requests.find(function (x) { return String(x.id) === String(id); });
      if (r) r.status = 'approved';
      openId = null;
      render();
      toast('Identity approved');
    } catch (e) { toast('Failed to approve: ' + e.message); }
  }
  async function rejectRequest(id) {
    if (!id) return;
    const box = document.querySelector('[data-rej-text="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]')
      || document.querySelector('[data-rej-text]');
    const reason = (box && box.value || '').trim();
    if (reason.length < 5) { toast('Please enter a reason (at least 5 characters)'); if (box) box.focus(); return; }
    try {
      await callApi('/requests/' + encodeURIComponent(id) + '/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason })
      });
      const r = requests.find(function (x) { return String(x.id) === String(id); });
      if (r) { r.status = 'rejected'; r.reviewNote = reason; }
      openId = null;
      render();
      toast('Request rejected — the author was notified');
    } catch (e) { toast('Failed to reject: ' + e.message); }
  }
  function toast(msg) {
    let t = document.getElementById('verifToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'verifToast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:10px 18px;border-radius:22px;font-size:12px;font-weight:700;z-index:7000;box-shadow:0 10px 30px rgba(0,0,0,.25)';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    clearTimeout(t._t);
    t._t = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  window.AuthorVerificationService = {
    init: async function () {
      if (window.SeniorEditorSidebar) {
        const me = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
        SeniorEditorSidebar.attach('#dashboardRoot', {
          activeItem: 'author-verification',
          title: 'Author Verification',
          subtitle: 'Review and approve author identity requests',
          user: { name: me.name || me.username || 'Editor', role: 'Senior Editor', avatar: me.avatar || '' },
          notifCount: 0,
          searchPlaceholder: 'Search by author name or email...',
        });
      }
      bind();
      await loadRequests();
      render();
      const recent = await loadRecentReviews();
      const grid = document.getElementById('authorGrid');
      if (grid) {
        grid.innerHTML = recent.length
          ? recent.map(function (r) {
            return '<div class="author-card"><img src="' + avatar(r.avatar) + '" alt=""/>'
              + '<div class="author-card-name">' + esc(label(r)) + '</div>'
              + '<div class="author-card-meta">' + esc(r.status || 'Reviewed') + '</div></div>';
          }).join('')
          : '<div style="text-align:center;color:var(--text-faint);padding:20px">No recently reviewed requests.</div>';
      }
    },
    getRequests: loadRequests,
    getRecentReviews: loadRecentReviews,
    approveRequest: approveRequest,
    rejectRequest: rejectRequest,
    openFullHistory: loadHistory,
    setView: function (v) { view = v; openId = null; render(); },
  };
})();
