/**
 * promotions-service.js — Promotions page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and point API_BASE at the real API
 * to fetch data via callBackend(); demo paths keep working with local data.
 */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    try {
      const res = await fetch(API_BASE + path, options || {});
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     DATA
     ═══════════════════════════════════════════════════════════ */
  const TYPE_META = {
    discount: { label: 'Discount Code',  icon: 'fa-percent',           tile: 'linear-gradient(135deg,#2d2154,#5b4bcf)' },
    bundle:   { label: 'Bundle Deal',    icon: 'fa-boxes-stacked',     tile: 'linear-gradient(135deg,#1f3a63,#2f7de1)' },
    flash:    { label: 'Flash Sale',     icon: 'fa-bolt',              tile: 'linear-gradient(135deg,#7a1f2b,#e0384d)' },
    referral: { label: 'Referral Bonus', icon: 'fa-user-plus',         tile: 'linear-gradient(135deg,#0f5132,#16a34a)' },
    trial:    { label: 'Free Trial',     icon: 'fa-hourglass-start',   tile: 'linear-gradient(135deg,#c2185b,#ff0050)' },
  };

  const PROMOTIONS = [
    { id:'PROMO-2026-028', title:'Summer Reading Sale',   code:'SUMMER25',  desc:'Site-wide seasonal discount on all book bundles.', type:'discount', discount:'25% OFF',            status:'active',    used:1240, cap:5000,  start:'Jun 1, 2026',  end:'Jun 30, 2026' },
    { id:'PROMO-2026-027', title:'New Author Bundle',     code:'AUTHOR2X',  desc:'Buy any 2 books from a new author, get 1 free.',   type:'bundle',   discount:'Buy 2 Get 1',        status:'active',    used:380,  cap:1000,  start:'Jun 10, 2026', end:'Jul 10, 2026' },
    { id:'PROMO-2026-026', title:'Flash Friday',          code:'FLASH40',   desc:'One-day flash sale across the whole catalog.',     type:'flash',    discount:'40% OFF',            status:'scheduled', used:0,    cap:2000,  start:'Jul 11, 2026', end:'Jul 12, 2026' },
    { id:'PROMO-2026-025', title:'Refer a Friend',        code:'REFER500',  desc:'Give $5, get $5 when a referral signs up.',    type:'referral', discount:'$5 Credit',   status:'active',    used:892,  cap:null,  start:'Jan 1, 2026',  end:'Dec 31, 2026' },
    { id:'PROMO-2026-024', title:'7-Day Free Trial',      code:'TRY7FREE',  desc:'Full platform access free for the first week.',    type:'trial',    discount:'Free Access',        status:'active',    used:3120, cap:null,  start:'May 1, 2026',  end:'Ongoing' },
    { id:'PROMO-2026-023', title:'Spring Clearance',      code:'SPRING30',  desc:'End-of-season clearance on selected titles.',      type:'discount', discount:'30% OFF',            status:'expired',   used:2450, cap:2500,  start:'Mar 1, 2026',  end:'Mar 31, 2026' },
    { id:'PROMO-2026-022', title:'Loyalty Rewards',       code:'LOYAL15',   desc:'Discount for readers with 10+ purchases.',         type:'bundle',   discount:'15% OFF',            status:'draft',     used:0,    cap:null,  start:'—',            end:'—' },
    { id:'PROMO-2026-021', title:'Independence Day Sale', code:'INDEP50',   desc:'National holiday storewide discount event.',       type:'flash',    discount:'50% OFF',            status:'scheduled', used:0,    cap:3000,  start:'Oct 1, 2026',  end:'Oct 1, 2026' },
  ];

  const MIX_BREAKDOWN = [
    { label:'Discount Code',  value:9, pct:32.1, color:'#5b4bcf' },
    { label:'Bundle Deal',    value:7, pct:25.0, color:'var(--blue)' },
    { label:'Flash Sale',     value:5, pct:17.9, color:'var(--red)' },
    { label:'Free Trial',     value:4, pct:14.3, color:'#ff0050' },
    { label:'Referral Bonus', value:3, pct:10.7, color:'var(--green)' },
  ];

  const TOP_PROMOS = [
    { title:'7-Day Free Trial',    sub:'Free Trial · Ongoing', val:'3,120 uses' },
    { title:'Spring Clearance',    sub:'Discount Code · Ended', val:'2,450 uses' },
    { title:'Summer Reading Sale', sub:'Discount Code · Active', val:'1,240 uses' },
  ];

  const QUICK_ACTIONS = [
    { label:'Create Promotion',       icon:'fa-plus',       cls:'purple' },
    { label:'Manage Discount Codes',  icon:'fa-percent',    cls:'pink' },
    { label:'Promotion Templates',    icon:'fa-file-lines', cls:'blue' },
    { label:'Notification Settings',  icon:'fa-bell',       cls:'amber' },
  ];

  /* ═══════════════════════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════════════════════ */
  function statusPillHtml(status){
    const map = {
      active:    { cls:'', label:'Active' },
      scheduled: { cls:'scheduled', label:'Scheduled' },
      expired:   { cls:'expired', label:'Expired' },
      draft:     { cls:'draft', label:'Draft' },
    };
    const m = map[status] || map.active;
    return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`;
  }

  function typePillHtml(type){
    const m = TYPE_META[type] || TYPE_META.discount;
    return `<span class="type-pill ${type}">${m.label}</span>`;
  }

  function tileHtml(row){
    const m = TYPE_META[row.type] || TYPE_META.discount;
    return `<div class="promo-tile" style="background:${m.tile}"><i class="fas ${m.icon}"></i></div>`;
  }

  function usageHtml(row){
    if (row.cap == null){
      return `<div class="usage-cell"><div class="usage-num">${row.used.toLocaleString()} uses</div><div class="usage-track"><div class="usage-fill" style="width:100%;background:var(--text-faint)"></div></div></div>`;
    }
    const pct = Math.min(100, Math.round((row.used / row.cap) * 100));
    return `<div class="usage-cell"><div class="usage-num">${row.used.toLocaleString()} / ${row.cap.toLocaleString()}</div><div class="usage-track"><div class="usage-fill" style="width:${pct}%"></div></div></div>`;
  }

  let currentView = 'all';

  function viewSource(){
    if (currentView === 'all') return PROMOTIONS;
    return PROMOTIONS.filter(r => r.status === currentView);
  }

  function currentFiltered(){
    const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
    const type = document.getElementById('typeSelect').value;
    const status = document.getElementById('statusSelect').value;
    let list = viewSource();
    if (status) list = list.filter(r => r.status === status);
    if (type) list = list.filter(r => r.type === type);
    if (q) list = list.filter(r => r.title.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    return list;
  }

  function renderTable(list){
    const body = document.getElementById('tableBody');
    if (!list.length){
      body.innerHTML = `<tr class="empty-row"><td colspan="7"><i class="fas fa-tag"></i>No promotions match this search.</td></tr>`;
      return;
    }
    body.innerHTML = list.slice(0,8).map(r => `
      <tr>
        <td data-label="Promotion">
          <div class="promo-cell">
            ${tileHtml(r)}
            <div><div class="promo-title">${r.title} <span class="promo-code">${r.code}</span></div><div class="promo-desc">${r.desc}</div></div>
          </div>
        </td>
        <td data-label="Type">${typePillHtml(r.type)}</td>
        <td data-label="Discount" class="discount-cell">${r.discount}</td>
        <td data-label="Status">${statusPillHtml(r.status)}</td>
        <td data-label="Usage">${usageHtml(r)}</td>
        <td data-label="Start / End Date" class="date-cell">${r.start}<span class="sub">${r.end}</span></td>
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
    const totals = { all:28, active:16, scheduled:5, expired:7, draft:0 };
    const total = totals[currentView] ?? count;
    const shown = Math.min(8, count);
    document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${shown}</b> of <b>${total.toLocaleString()}</b> promotions`;
  }

  function refresh(){
    const list = currentFiltered();
    renderTable(list);
    renderPageInfo(list.length);
  }

  /* ── Pagination (visual, matches other admin pages) ── */
  function renderPagination(){
    const wrap = document.getElementById('pageBtns');
    const pageSets = { all:[1,2,3,4], active:[1,2,3], scheduled:[1], expired:[1], draft:[1] };
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

  /* ── Promotion mix donut + legend ── */
  function renderDonut(){
    let acc = 0;
    const stops = MIX_BREAKDOWN.map(s => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    }).join(', ');
    document.getElementById('overviewDonut').style.background = `conic-gradient(${stops})`;

    document.getElementById('overviewLegend').innerHTML = MIX_BREAKDOWN.map(s => `
      <div class="legend-row">
        <div class="legend-lbl"><span class="legend-dot" style="background:${s.color}"></span><span>${s.label}</span></div>
        <div class="legend-val">${s.value} (${s.pct}%)</div>
      </div>`).join('');
  }

  /* ── Top performing promotions ── */
  function renderTop(){
    document.getElementById('topList').innerHTML = TOP_PROMOS.map((t, i) => `
      <div class="top-row">
        <div class="top-rank">${i + 1}</div>
        <div class="top-info"><div class="top-title">${t.title}</div><div class="top-sub">${t.sub}</div></div>
        <div class="top-val"><b>${t.val}</b></div>
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
    document.getElementById('newPromoBtn').addEventListener('click', () => toast('Opening new promotion form…'));
  }

  let _inited = false;

  /* ═══════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════ */
  function init(){
    /* ATTACH THE SHARED SHELL — sidebar + topbar wrap the content
       already inside #dashboardRoot above. Uses the default nav —
       "Promotions" already lives under Promotions & Marketing. */
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'promotions.html',
      title: 'Promotions',
      subtitle: 'Create, manage and track all platform promotions',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 0,
      searchPlaceholder: 'Search by promotion name or code...',
      mobileSearchTarget: '#tableSearch',
      onSearch: (value) => {
        document.getElementById('tableSearch').value = value;
        refresh();
      },
    });
    if (_inited) { refresh(); return; }
    _inited = true;
    bindEvents();
    renderPagination();
    renderDonut();
    renderTop();
    renderQuickActions();
    refresh();
  }

  window.PromotionsService = { init: init };

})();
