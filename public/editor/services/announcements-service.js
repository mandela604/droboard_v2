/* announcements-service.js — Announcements page logic (backend-ready).
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
     already inside #dashboardRoot above. Uses the default nav —
     "Announcements" already lives under Promotions & Marketing.
     ═══════════════════════════════════════════════════════════ */
  function attachShell(){
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'announcements.html',
      title: 'Announcements',
      subtitle: 'Create, manage and track all platform announcements',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 0,
      searchPlaceholder: 'Search by title or announcement ID...',
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
  const TYPE_META = {
    update:   { label: 'Update',   icon: 'fa-rocket',        tile: 'linear-gradient(135deg,#2d2154,#5b4bcf)' },
    event:    { label: 'Event',    icon: 'fa-trophy',        tile: 'linear-gradient(135deg,#b8860b,#f2a900)' },
    system:   { label: 'System',   icon: 'fa-gear',          tile: 'linear-gradient(135deg,#1f3a63,#2f7de1)' },
    policy:   { label: 'Policy',   icon: 'fa-file-lines',    tile: 'linear-gradient(135deg,#3c8f6f,#16a34a)' },
    program:  { label: 'Program',  icon: 'fa-star',          tile: 'linear-gradient(135deg,#c2185b,#ff0050)' },
    news:     { label: 'News',     icon: 'fa-chart-line',    tile: 'linear-gradient(135deg,#0f766e,#14b8a6)' },
    security: { label: 'Security', icon: 'fa-shield-halved', tile: 'linear-gradient(135deg,#3a3a45,#5c5c6b)' },
  };

  const ANNOUNCEMENTS = [
    { id:'ANN-2026-0132', title:'Introducing Book Analytics', desc:'Explore detailed analytics for your books and track your performance.', type:'update', status:'published', audience:'All Authors', date:'Jun 17, 2026', time:'10:24 AM', views:'8,420' },
    { id:'ANN-2026-0131', title:'Payment System Update', desc:'We\u2019ve improved payout speed and added new payment options.', type:'update', status:'published', audience:'All Authors', date:'Jun 15, 2026', time:'09:15 AM', views:'6,120' },
    { id:'ANN-2026-0130', title:'Summer Writing Contest 2026', desc:'Join our annual writing contest and win exciting rewards.', type:'event', status:'published', audience:'All Authors', date:'Jun 10, 2026', time:'11:00 AM', views:'12,850' },
    { id:'ANN-2026-0129', title:'Scheduled Maintenance', desc:'The platform will be under maintenance for system improvements.', type:'system', status:'scheduled', audience:'All Authors', date:'Jun 20, 2026', time:'02:00 AM', views:'—' },
    { id:'ANN-2026-0128', title:'Content Guidelines Update', desc:'Please review our updated content guidelines and policies.', type:'policy', status:'draft', audience:'All Authors', date:'—', time:'', views:'—' },
    { id:'ANN-2026-0127', title:'Author Spotlight Program', desc:'Nominate your favorite authors for our monthly spotlight!', type:'program', status:'scheduled', audience:'All Authors', date:'Jun 25, 2026', time:'10:00 AM', views:'—' },
    { id:'ANN-2026-0126', title:'We Reached 100K Books!', desc:'Thank you for being part of this amazing journey.', type:'news', status:'published', audience:'All Authors', date:'Jun 5, 2026', time:'04:30 PM', views:'9,430' },
    { id:'ANN-2026-0125', title:'Security Best Practices', desc:'Tips to keep your account and content safe.', type:'security', status:'draft', audience:'All Authors', date:'—', time:'', views:'—' },
  ];

  const OVERVIEW_BREAKDOWN = [
    { label:'Updates',  value:12, pct:37.5, color:'#5b4bcf' },
    { label:'Events',   value:6,  pct:18.8, color:'var(--amber)' },
    { label:'System',   value:5,  pct:15.6, color:'var(--blue)' },
    { label:'Policies', value:4,  pct:12.5, color:'var(--text-faint)' },
    { label:'Programs', value:3,  pct:9.4,  color:'#ff0050' },
    { label:'News',     value:2,  pct:6.2,  color:'var(--green)' },
  ];

  const QUICK_ACTIONS = [
    { label:'Create Announcement',    icon:'fa-plus',     cls:'purple' },
    { label:'Manage Categories',      icon:'fa-tags',      cls:'pink' },
    { label:'Announcement Templates', icon:'fa-file-lines',cls:'blue' },
    { label:'Notification Settings',  icon:'fa-bell',      cls:'amber' },
  ];

  const RECENT = [
    { title:'Introducing Book Analytics', status:'published', date:'Jun 17, 2026' },
    { title:'Payment System Update',       status:'published', date:'Jun 15, 2026' },
    { title:'Summer Writing Contest 2026', status:'published', date:'Jun 10, 2026' },
    { title:'Scheduled Maintenance',       status:'scheduled', date:'Jun 20, 2026' },
  ];

  /* ═══════════════════════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════════════════════ */
  function statusPillHtml(status){
    const map = {
      published: { cls:'', label:'Published' },
      scheduled: { cls:'scheduled', label:'Scheduled' },
      draft:     { cls:'draft', label:'Draft' },
      archived:  { cls:'archived', label:'Archived' },
    };
    const m = map[status] || map.published;
    return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`;
  }

  function typePillHtml(type){
    const m = TYPE_META[type] || TYPE_META.update;
    return `<span class="type-pill ${type}">${m.label}</span>`;
  }

  function tileHtml(row){
    const m = TYPE_META[row.type] || TYPE_META.update;
    return `<div class="ann-tile" style="background:${m.tile}"><i class="fas ${m.icon}"></i><span>${m.label}</span></div>`;
  }

  let currentView = 'all';

  function viewSource(){
    if (currentView === 'all') return ANNOUNCEMENTS;
    return ANNOUNCEMENTS.filter(r => r.status === currentView);
  }

  function currentFiltered(){
    const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
    const type = document.getElementById('typeSelect').value;
    const status = document.getElementById('statusSelect').value;
    let list = viewSource();
    if (status) list = list.filter(r => r.status === status);
    if (type) list = list.filter(r => r.type === type);
    if (q) list = list.filter(r => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
    return list;
  }

  function renderTable(list){
    const body = document.getElementById('tableBody');
    if (!list.length){
      body.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fas fa-bullhorn"></i>No announcements match this search.</td></tr>`;
      return;
    }
    body.innerHTML = list.slice(0,8).map(r => `
      <tr>
        <td data-label="Announcement">
          <div class="ann-cell">
            ${tileHtml(r)}
            <div><div class="ann-title">${r.title}</div><div class="ann-desc">${r.desc}</div></div>
          </div>
        </td>
        <td data-label="Type">${typePillHtml(r.type)}</td>
        <td data-label="Status">${statusPillHtml(r.status)}</td>
        <td data-label="Audience" class="audience-cell">${r.audience}</td>
        <td data-label="Published / Scheduled" class="date-cell">${r.date}${r.time ? `<span class="sub">${r.time}</span>` : ''}</td>
        <td data-label="Views" class="views-cell">${r.views}</td>
        <td data-label="Actions">
          <div class="actions-cell">
            <button class="act-btn" title="View" onclick="toast('Opening \\'${r.title}\\'…')"><i class="fas fa-eye"></i></button>
            <button class="act-btn" title="Edit" onclick="toast('Editing \\'${r.title}\\'…')"><i class="fas fa-pen"></i></button>
            <button class="act-btn" title="More" onclick="toast('More actions for \\'${r.title}\\'')"><i class="fas fa-ellipsis"></i></button>
          </div>
        </td>
      </tr>`).join('');
  }

  function renderPageInfo(count){
    const totals = { all:32, published:24, scheduled:6, draft:2, archived:0 };
    const total = totals[currentView] ?? count;
    const shown = Math.min(8, count);
    document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${shown}</b> of <b>${total.toLocaleString()}</b> announcements`;
  }

  function refresh(){
    const list = currentFiltered();
    renderTable(list);
    renderPageInfo(list.length);
  }

  /* ── Pagination (visual, matches other admin pages) ── */
  function renderPagination(){
    const wrap = document.getElementById('pageBtns');
    const pageSets = { all:[1,2,3,4], published:[1,2,3], scheduled:[1], draft:[1], archived:[1] };
    const pages = pageSets[currentView] || [1];
    wrap.innerHTML = `<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>` +
      pages.map(p => `<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('') +
      `<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>`;
    wrap.querySelectorAll('[data-p]').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.pg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function bindEvents(){
    /* ── Sub-tab switching ── */
    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        document.getElementById('statusSelect').value = '';
        renderPagination();
        refresh();
      });
    });

    /* ── Filters wiring ── */
    document.getElementById('tableSearch').addEventListener('input', refresh);
    document.getElementById('typeSelect').addEventListener('change', refresh);
    document.getElementById('statusSelect').addEventListener('change', (e) => {
      const status = e.target.value;
      currentView = status || 'all';
      document.querySelectorAll('.sub-tab').forEach(t => t.classList.toggle('active', t.dataset.view === currentView));
      renderPagination();
      refresh();
    });

    /* ── Create button ── */
    document.getElementById('newAnnouncementBtn').addEventListener('click', () => toast('Opening new announcement form…'));
  }

  /* ── Overview donut + legend ── */
  function renderDonut(){
    let acc = 0;
    const stops = OVERVIEW_BREAKDOWN.map(s => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    }).join(', ');
    document.getElementById('overviewDonut').style.background = `conic-gradient(${stops})`;

    document.getElementById('overviewLegend').innerHTML = OVERVIEW_BREAKDOWN.map(s => `
      <div class="legend-row">
        <div class="legend-lbl"><span class="legend-dot" style="background:${s.color}"></span>${s.label}</div>
        <div class="legend-val">${s.value} (${s.pct}%)</div>
      </div>`).join('');
  }

  /* ── Quick actions ── */
  function renderQuickActions(){
    document.getElementById('quickActions').innerHTML = QUICK_ACTIONS.map(a => `
      <div class="qa-item" onclick="toast('${a.label}…')">
        <div class="qa-ico ${a.cls}"><i class="fas ${a.icon}"></i></div>
        <span class="qa-lbl">${a.label}</span>
        <i class="fas fa-chevron-right"></i>
      </div>`).join('');
  }

  /* ── Recent announcements ── */
  function renderRecent(){
    document.getElementById('recentList').innerHTML = RECENT.map(r => `
      <div class="recent-row">
        <div class="recent-title">${r.title}</div>
        <div class="recent-right">
          ${statusPillHtml(r.status)}
          <div class="recent-date">${r.date}</div>
        </div>
      </div>`).join('');
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init(){
    attachShell();
    bindEvents();
    renderPagination();
    renderDonut();
    renderQuickActions();
    renderRecent();
    refresh();
  }

  window.AnnouncementsService = { init: init };
})();
