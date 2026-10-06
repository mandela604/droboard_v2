/* author-verification-service.js — Author Verification page logic (backend-ready).
 * Demo mode: USE_API=false keeps all demo paths working.
 * Flip USE_API=true and point API_BASE at the real backend to go live. */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    const res = await fetch(API_BASE + path, options || {});
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     ATTACH THE SHARED SHELL — sidebar + topbar wrap the content
     already inside #dashboardRoot above.
     ═══════════════════════════════════════════════════════════ */
  function attachShell(){
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'author-verification.html',
      title: 'Author Verification',
      subtitle: 'Review and approve author identity submissions',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      searchPlaceholder: 'Search by author name or email...',
      mobileSearchTarget: '#tableSearch',
      onSearch: (value) => {
        document.getElementById('tableSearch').value = value;
        refresh();
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     DATA
     ═══════════════════════════════════════════════════════════ */
  const REQUESTS = [
    { name:'Daniel Reyes', email:'daniel.reyes@mail.com', avatar:'https://i.pravatar.cc/100?img=51', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jul 4, 2026', reviewer:null, status:'pending' },
    { name:'Julien Moreau', email:'julien.moreau@mail.com', avatar:'https://i.pravatar.cc/100?img=15', doc:'Passport', docIcon:'fa-passport', submitted:'Jul 3, 2026', reviewer:null, status:'pending' },
    { name:'Kenji Watanabe', email:'kenji.watanabe@mail.com', avatar:'https://i.pravatar.cc/100?img=13', doc:'Driver\u2019s License', docIcon:'fa-id-card-clip', submitted:'Jul 3, 2026', reviewer:null, status:'pending' },
    { name:'Nadia Petrov', email:'nadia.petrov@mail.com', avatar:'https://i.pravatar.cc/100?img=24', doc:'Passport', docIcon:'fa-passport', submitted:'Jul 2, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'pending' },
    { name:'Owen Fitzgerald', email:'owen.fitzgerald@mail.com', avatar:'https://i.pravatar.cc/100?img=6', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jul 1, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'pending' },
    { name:'Sofia Lindqvist', email:'sofia.lindqvist@mail.com', avatar:'https://i.pravatar.cc/100?img=32', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 29, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Amara Okafor', email:'amara.okafor@mail.com', avatar:'https://i.pravatar.cc/100?img=45', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 28, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'approved' },
    { name:'Isabella Rossi', email:'isabella.rossi@mail.com', avatar:'https://i.pravatar.cc/100?img=38', doc:'Driver\u2019s License', docIcon:'fa-id-card-clip', submitted:'Jun 27, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Layla Haddad', email:'layla.haddad@mail.com', avatar:'https://i.pravatar.cc/100?img=48', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 25, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'approved' },
    { name:'Priya Nair', email:'priya.nair@mail.com', avatar:'https://i.pravatar.cc/100?img=27', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 24, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'approved' },
    { name:'Tobias Bergman', email:'tobias.bergman@mail.com', avatar:'https://i.pravatar.cc/100?img=8', doc:'Government ID', docIcon:'fa-id-card', submitted:'Jun 20, 2026', reviewer:{name:'Marcus Webb', avatar:'https://i.pravatar.cc/100?img=33'}, status:'rejected' },
    { name:'Grace Wallace', email:'grace.wallace@mail.com', avatar:'https://i.pravatar.cc/100?img=44', doc:'Passport', docIcon:'fa-passport', submitted:'Jun 18, 2026', reviewer:{name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47'}, status:'rejected' },
  ];

  const RECENT_REVIEWS = [
    { name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', meta:'Approved · Jun 29', status:'approved' },
    { name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', meta:'Approved · Jun 28', status:'approved' },
    { name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', meta:'Approved · Jun 27', status:'approved' },
    { name:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', meta:'Approved · Jun 25', status:'approved' },
    { name:'Tobias Bergman', avatar:'https://i.pravatar.cc/100?img=8', meta:'Rejected · Jun 20', status:'rejected' },
    { name:'Grace Wallace', avatar:'https://i.pravatar.cc/100?img=44', meta:'Rejected · Jun 18', status:'rejected' },
  ];

  /* ═══════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════ */
  let currentView = 'all';

  function statusPillHtml(status){
    if (status === 'approved') return `<span class="status-pill"><span class="dot"></span>Approved</span>`;
    if (status === 'pending') return `<span class="status-pill pending"><span class="dot"></span>Pending</span>`;
    return `<span class="status-pill rejected"><span class="dot"></span>Rejected</span>`;
  }

  function reviewerCellHtml(reviewer){
    if (!reviewer) return `<div class="reviewer-cell unassigned"><span>Unassigned</span></div>`;
    return `<div class="reviewer-cell"><img src="${reviewer.avatar}" alt="${reviewer.name}"/><span>${reviewer.name}</span></div>`;
  }

  function viewSource(){
    if (currentView === 'pending') return REQUESTS.filter(r => r.status === 'pending');
    if (currentView === 'approved') return REQUESTS.filter(r => r.status === 'approved');
    if (currentView === 'rejected') return REQUESTS.filter(r => r.status === 'rejected');
    return REQUESTS;
  }

  function currentFiltered(){
    const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
    const source = viewSource();
    if (!q) return source;
    return source.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }

  function actionsCellHtml(r){
    if (r.status === 'pending'){
      return `<div class="actions-cell">
        <button class="act-btn approve" title="Approve" onclick="toast('Approved \\'${r.name}\\'')"><i class="fas fa-check"></i></button>
        <button class="act-btn reject" title="Reject" onclick="toast('Rejected \\'${r.name}\\'')"><i class="fas fa-xmark"></i></button>
        <button class="act-btn" title="View documents" onclick="toast('Opening documents for \\'${r.name}\\'…')"><i class="fas fa-eye"></i></button>
      </div>`;
    }
    return `<div class="actions-cell">
      <button class="act-btn" title="View documents" onclick="toast('Opening documents for \\'${r.name}\\'…')"><i class="fas fa-eye"></i></button>
      <button class="act-btn" title="More" onclick="toast('More actions for \\'${r.name}\\'')"><i class="fas fa-ellipsis"></i></button>
    </div>`;
  }

  function renderTable(list){
    const body = document.getElementById('tableBody');
    if (!list.length){
      body.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fas fa-folder-open"></i>No verification requests match this search.</td></tr>`;
      return;
    }
    body.innerHTML = list.slice(0,8).map(r => `
      <tr>
        <td data-label="Author">
          <div class="auth-cell">
            <img class="auth-avatar" src="${r.avatar}" alt="${r.name}"/>
            <div>
              <div class="auth-name">${r.name}</div>
              <div class="auth-email">${r.email}</div>
            </div>
          </div>
        </td>
        <td data-label="Document"><div class="doc-cell"><i class="fas ${r.docIcon}"></i>${r.doc}</div></td>
        <td data-label="Submitted" class="plain-cell">${r.submitted}</td>
        <td data-label="Reviewer">${reviewerCellHtml(r.reviewer)}</td>
        <td data-label="Status">${statusPillHtml(r.status)}</td>
        <td data-label="Actions">${actionsCellHtml(r)}</td>
      </tr>`).join('');
  }

  function renderPageInfo(count){
    const totals = { all: 247, pending: 18, approved: 204, rejected: 25 };
    const total = totals[currentView] ?? count;
    const shown = Math.min(8, count);
    document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${shown}</b> of <b>${total.toLocaleString()}</b> requests`;
  }

  function refresh(){
    const list = currentFiltered();
    renderTable(list);
    renderPageInfo(list.length);
  }

  /* ── Recently reviewed grid ── */
  function renderRecentReviews(){
    document.getElementById('authorGrid').innerHTML = RECENT_REVIEWS.map(a => `
      <div class="author-card" onclick="toast('Opening \\'${a.name}\\'\\'s profile…')">
        <img src="${a.avatar}" alt="${a.name}"/>
        <div class="author-card-name">${a.name}</div>
        <div class="author-card-meta">${a.meta}</div>
        ${statusPillHtml(a.status)}
      </div>`).join('');
  }

  /* ── Pagination (visual, matches other admin pages) ── */
  function renderPagination(){
    const wrap = document.getElementById('pageBtns');
    const pages = currentView === 'all' ? [1,2,3,4,5,'...',31] : currentView === 'approved' ? [1,2,3,'...',26] : currentView === 'rejected' ? [1,2,3,4] : [1,2,3];
    wrap.innerHTML = `<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>` +
      pages.map(p => p === '...' ? `<span class="pg-dots" style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>` : `<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('') +
      `<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>`;
    wrap.querySelectorAll('[data-p]').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.pg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function bindEvents(){
    /* ── Top tab switching (All / Pending / Approved / Rejected) ── */
    document.querySelectorAll('.top-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        document.getElementById('tableTitle').textContent =
          currentView === 'all' ? 'All Verification Requests' :
          currentView === 'pending' ? 'Pending Review' :
          currentView === 'approved' ? 'Approved Authors' : 'Rejected Requests';
        document.getElementById('tableSearch').value = '';
        renderPagination();
        refresh();
      });
    });

    /* ── Export button + search wiring ── */
    document.getElementById('exportBtn').addEventListener('click', () => {
      toast('Exporting verification report…');
    });
    document.getElementById('tableSearch').addEventListener('input', refresh);
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init(){
    attachShell();
    bindEvents();
    document.getElementById('pendingCount').textContent = REQUESTS.filter(r => r.status === 'pending').length;
    renderPagination();
    renderRecentReviews();
    refresh();
  }

  window.AuthorVerificationService = { init: init };
})();
