/* authors-service.js — Authors page logic (backend-ready).
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
      activeFile: 'authors.html',
      title: 'Authors',
      subtitle: 'Manage all authors on your platform',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      searchPlaceholder: 'Search by author name or email...',
      mobileSearchTarget: '#tableSearch',
      onSearch: (value) => {
        document.getElementById('tableSearch').value = value;
        refresh();
      },
    });

    /* Force this page's accent to black + pink (#ff0050), regardless of
       whatever default --accent the shared shell CSS ships with. Setting
       it as an inline style on <html> always wins over stylesheet rules,
       no matter which loads/injects last. */
    document.documentElement.style.setProperty('--accent', '#ff0050');
    document.documentElement.style.setProperty('--accent-2', '#000000');
    document.documentElement.style.setProperty('--accent-soft', 'rgba(255,0,80,.14)');
  }

  /* ═══════════════════════════════════════════════════════════
     DATA
     ═══════════════════════════════════════════════════════════ */
  const AUTHORS = [
    { name:'Sofia Lindqvist', email:'sofia.lindqvist@mail.com', avatar:'https://i.pravatar.cc/100?img=32', books:24, followers:'48.2K', earnings:'$18,420', joined:'Jan 2023', status:'verified' },
    { name:'Marcus Chen', email:'marcus.chen@mail.com', avatar:'https://i.pravatar.cc/100?img=12', books:16, followers:'31.7K', earnings:'$12,890', joined:'Mar 2023', status:'verified' },
    { name:'Amara Okafor', email:'amara.okafor@mail.com', avatar:'https://i.pravatar.cc/100?img=45', books:31, followers:'62.5K', earnings:'$24,110', joined:'Aug 2022', status:'verified' },
    { name:'Daniel Reyes', email:'daniel.reyes@mail.com', avatar:'https://i.pravatar.cc/100?img=51', books:9, followers:'12.3K', earnings:'$4,560', joined:'Nov 2023', status:'pending' },
    { name:'Priya Nair', email:'priya.nair@mail.com', avatar:'https://i.pravatar.cc/100?img=27', books:19, followers:'27.9K', earnings:'$9,340', joined:'Jun 2023', status:'verified' },
    { name:'Julien Moreau', email:'julien.moreau@mail.com', avatar:'https://i.pravatar.cc/100?img=15', books:5, followers:'6.1K', earnings:'$1,980', joined:'Feb 2024', status:'pending' },
    { name:'Isabella Rossi', email:'isabella.rossi@mail.com', avatar:'https://i.pravatar.cc/100?img=38', books:27, followers:'55.6K', earnings:'$21,050', joined:'Sep 2022', status:'verified' },
    { name:'Tobias Bergman', email:'tobias.bergman@mail.com', avatar:'https://i.pravatar.cc/100?img=8', books:3, followers:'2.4K', earnings:'$640', joined:'Apr 2024', status:'suspended' },
    { name:'Layla Haddad', email:'layla.haddad@mail.com', avatar:'https://i.pravatar.cc/100?img=48', books:22, followers:'40.3K', earnings:'$15,780', joined:'Dec 2022', status:'verified' },
    { name:'Kenji Watanabe', email:'kenji.watanabe@mail.com', avatar:'https://i.pravatar.cc/100?img=13', books:11, followers:'18.8K', earnings:'$6,920', joined:'Jul 2023', status:'pending' },
  ];

  const TOP_AUTHORS = [
    { name:'Amara Okafor', avatar:'https://i.pravatar.cc/100?img=45', books:'31 books', verified:true },
    { name:'Isabella Rossi', avatar:'https://i.pravatar.cc/100?img=38', books:'27 books', verified:true },
    { name:'Sofia Lindqvist', avatar:'https://i.pravatar.cc/100?img=32', books:'24 books', verified:true },
    { name:'Layla Haddad', avatar:'https://i.pravatar.cc/100?img=48', books:'22 books', verified:true },
    { name:'Priya Nair', avatar:'https://i.pravatar.cc/100?img=27', books:'19 books', verified:true },
    { name:'Marcus Chen', avatar:'https://i.pravatar.cc/100?img=12', books:'16 books', verified:true },
  ];

  /* ═══════════════════════════════════════════════════════════
     STATE
     ═══════════════════════════════════════════════════════════ */
  let currentView = 'all';

  function statusPillHtml(status){
    if (status === 'verified') return `<span class="status-pill"><span class="dot"></span>Verified</span>`;
    if (status === 'pending') return `<span class="status-pill pending"><span class="dot"></span>Pending</span>`;
    return `<span class="status-pill suspended"><span class="dot"></span>Suspended</span>`;
  }

  async function renderTable() {
    const res = await DroboardAPI.getAuthors({ view: currentView, search: (document.getElementById('tableSearch').value || '').trim() });
    const list = res.items;
    const body = document.getElementById('tableBody');
    if (!list.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fas fa-user-slash"></i>No authors match this search.</td></tr>`;
      return;
    }
    body.innerHTML = list.slice(0, 8).map(a => `
      <tr>
        <td data-label="Author">
          <div class="auth-cell">
            <img class="auth-avatar" src="${a.avatar}" alt="${a.name}"/>
            <div>
              <div class="auth-name">${a.name}${a.status === 'verified' ? '<i class="fas fa-badge-check"></i>' : ''}</div>
              <div class="auth-email">${a.email}</div>
            </div>
          </div>
        </td>
        <td data-label="Books" class="plain-cell">${a.books}</td>
        <td data-label="Followers" class="plain-cell">${a.followers}</td>
        <td data-label="Earnings" class="earn-cell">${a.earnings}</td>
        <td data-label="Joined" class="plain-cell">${a.joined}</td>
        <td data-label="Status">${statusPillHtml(a.status)}</td>
        <td data-label="Actions">
          <div class="actions-cell">
            <button class="act-btn" title="View profile" onclick="toast('Opening \\'${a.name}\\'\\'s profile…')"><i class="fas fa-eye"></i></button>
            <button class="act-btn" title="Message" onclick="toast('Opening chat with \\'${a.name}\\'…')"><i class="fas fa-comment-dots"></i></button>
            <button class="act-btn" title="More" onclick="toast('More actions for \\'${a.name}\\'')"><i class="fas fa-ellipsis"></i></button>
          </div>
        </td>
      </tr>`).join('');
    renderPageInfo(list.length, res.grandTotal);
  }

  function renderPageInfo(count, grandTotal) {
    const totals = { all: grandTotal, verified: grandTotal, pending: grandTotal }; // Simplified for mock
    const total = count; // Showing current count for search
    const shown = Math.min(8, count);
    document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${shown}</b> of <b>${count.toLocaleString()}</b> authors`;
  }

  async function refresh() {
    await renderTable();
  }

  /* ── Top performing authors grid ── */
  async function renderTopAuthors() {
    const res = await DroboardAPI.getAuthors();
    const topAuthors = res.items.slice(0, 6);
    document.getElementById('authorGrid').innerHTML = topAuthors.map(a => `
      <div class="author-card" onclick="toast('Opening \\'${a.name}\\'\\'s profile…')">
        <img src="${a.avatar}" alt="${a.name}"/>
        <div class="author-card-name">${a.name}${a.status === 'verified' ? '<i class="fas fa-badge-check"></i>' : ''}</div>
        <div class="author-card-books">${a.books} books</div>
        ${statusPillHtml(a.status)}
      </div>`).join('');
  }

  /* ── Pagination (visual, matches other admin pages) ── */
  function renderPagination(){
    const wrap = document.getElementById('pageBtns');
    const pages = currentView === 'all' ? [1,2,3,4,5,'...',161] : currentView === 'verified' ? [1,2,3,'...',112] : [1,2,3,4,5,6];
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
    /* ── Top tab switching (All / Verified / Pending) ── */
    document.querySelectorAll('.top-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        document.getElementById('tableTitle').textContent =
          currentView === 'all' ? 'All Authors' : currentView === 'verified' ? 'Verified Authors' : 'Pending Verification';
        document.getElementById('tableSearch').value = '';
        renderPagination();
        await refresh();
      });
    });

    /* ── Add button + search wiring ── */
    document.getElementById('addBtn').addEventListener('click', () => {
      toast('Opening new author form…');
    });
    document.getElementById('tableSearch').addEventListener('input', refresh);
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init(){
    attachShell();
    bindEvents();
    renderPagination();
    renderTopAuthors();
    refresh();
  }

  window.AuthorsService = { init: init };
})();
