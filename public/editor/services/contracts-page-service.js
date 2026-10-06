/**
 * services/contracts-page-service.js — Contract Center page logic (pure call-and-render).
 * contracts.html only loads this service + ContractsPageService.init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';
if (window.ContractsPageService) return;

const USE_API = false;
const API_BASE = '/api/editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[ContractsPageService] backend unavailable, using demo data', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */
const TYPE_META = {
  'Exclusive Publishing': { icon: 'fa-book', cls: 'purple' },
  'Revenue Share': { icon: 'fa-hand-holding-dollar', cls: 'green' },
  'License Agreement': { icon: 'fa-file-shield', cls: 'grey' },
};

const CONTRACTS = [
  { id:'CNTR-2026-00125', cover:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&q=80', title:'Bound by the Ruthless Alpha', author:'Luna Skye', type:'Exclusive Publishing', status:'active', effective:'Jun 14, 2026', expiry:'Jun 14, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
  { id:'CNTR-2026-00124', cover:'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&q=80', title:'The Ruthless CEO', author:'Ava Winters', type:'Exclusive Publishing', status:'active', effective:'Jun 10, 2026', expiry:'Jun 10, 2028', expirySub:'(2 years)', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
  { id:'CNTR-2026-00123', cover:'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=100&q=80', title:'Reborn to Revenge', author:'Mia Carter', type:'Revenue Share', status:'pending', effective:'Jun 8, 2026', expiry:'—', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
  { id:'CNTR-2026-00122', cover:'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=100&q=80', title:'His Hidden Luna', author:'Lyra Night', type:'Exclusive Publishing', status:'active', effective:'Jun 5, 2026', expiry:'Jun 5, 2028', expirySub:'(2 years)', editor:'Ethan Walker', editorAvatar:'https://i.pravatar.cc/100?img=53' },
  { id:'CNTR-2026-00121', cover:'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=100&q=80', title:'Claimed by the Mafia King', author:'Bella King', type:'Exclusive Publishing', status:'expiring', effective:'May 20, 2024', expiry:'May 20, 2026', expirySub:'(in 18 days)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
  { id:'CNTR-2026-00120', cover:'https://images.unsplash.com/photo-1526398006332-190020ec2fb9?w=100&q=80', title:'The Vampire\u2019s Obsession', author:'Ethan Vale', type:'License Agreement', status:'expired', effective:'Apr 15, 2024', expiry:'Apr 15, 2026', expirySub:'', editor:'Daniel Carter', editorAvatar:'https://i.pravatar.cc/100?img=12' },
  { id:'CNTR-2026-00119', cover:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=100&q=80', title:'Broken Vows', author:'Sophie Lane', type:'Exclusive Publishing', status:'terminated', effective:'Mar 10, 2024', expiry:'Mar 10, 2026', expirySub:'', editor:'Sophia Bennett', editorAvatar:'https://i.pravatar.cc/100?img=29' },
  { id:'CNTR-2026-00118', cover:'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80', title:'The Prince\u2019s Secret Wife', author:'Isabella Rose', type:'Revenue Share', status:'active', effective:'May 1, 2026', expiry:'May 1, 2028', expirySub:'(2 years)', editor:'Reina Morgan', editorAvatar:'https://i.pravatar.cc/100?img=47' },
];

const EXPIRING_SOON = [
  { cover:'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=100&q=80', title:'Claimed by the Mafia King', author:'Bella King', date:'May 20, 2026', inDays:'in 18 days' },
  { cover:'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&q=80', title:'The Ruthless CEO', author:'Ava Winters', date:'Jun 10, 2026', inDays:'in 39 days' },
  { cover:'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=100&q=80', title:'His Hidden Luna', author:'Lyra Night', date:'Jun 30, 2026', inDays:'in 59 days' },
  { cover:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100&q=80', title:'Bound by the Ruthless Alpha', author:'Luna Skye', date:'Jul 14, 2026', inDays:'in 73 days' },
];

const STATS_BREAKDOWN = [
  { label:'Active', value:198, pct:80.8, color:'var(--green)' },
  { label:'Pending', value:17, pct:6.9, color:'var(--amber)' },
  { label:'Expiring Soon', value:12, pct:4.9, color:'var(--red)' },
  { label:'Expired', value:18, pct:7.4, color:'var(--text-faint)' },
  { label:'Terminated', value:0, pct:0, color:'#8a86a8' },
];

const CONTRACT_TYPES = [
  { label:'Exclusive Publishing', value:156, pct:63.7, icon:'fa-book', cls:'purple', color:'#5b4bcf' },
  { label:'Revenue Share', value:48, pct:19.6, icon:'fa-hand-holding-dollar', cls:'green', color:'var(--green)' },
  { label:'License Agreement', value:25, pct:10.2, icon:'fa-file-shield', cls:'grey', color:'var(--text-faint)' },
  { label:'Translation Rights', value:10, pct:4.1, icon:'fa-globe', cls:'red', color:'var(--red)' },
  { label:'Other Agreements', value:6, pct:2.4, icon:'fa-ellipsis', cls:'amber', color:'var(--amber)' },
];

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let currentView = 'all';
let _bound = false;

/* ═══════════════════════════════════════════════════════════
   RENDER HELPERS
   ═══════════════════════════════════════════════════════════ */
function statusPillHtml(status){
  const map = {
    active: { cls:'', label:'Active' },
    pending: { cls:'pending', label:'Pending' },
    expiring: { cls:'expiring', label:'Expiring Soon' },
    expired: { cls:'expired', label:'Expired' },
    terminated: { cls:'terminated', label:'Terminated' },
  };
  const m = map[status] || map.active;
  return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

function cidIconHtml(row){
  const meta = TYPE_META[row.type] || { icon:'fa-file', cls:'grey' };
  let cls = meta.cls;
  if (row.status === 'expiring') cls = 'red';
  if (row.status === 'terminated') cls = 'red';
  return `<div class="cid-ico ${cls}"><i class="fas ${meta.icon}"></i></div>`;
}

function viewSource(){
  if (currentView === 'all') return CONTRACTS;
  return CONTRACTS.filter(r => r.status === currentView);
}

function currentFiltered(){
  const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
  const type = document.getElementById('typeSelect').value;
  const status = document.getElementById('statusSelect').value;
  const editor = document.getElementById('editorSelect').value;
  let list = viewSource();
  if (status) list = list.filter(r => r.status === status);
  if (type) list = list.filter(r => r.type === type);
  if (editor) list = list.filter(r => r.editor === editor);
  if (q) list = list.filter(r => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.author.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
  return list;
}

function renderTable(list){
  const body = document.getElementById('tableBody');
  if (!list.length){
    body.innerHTML = `<tr class="empty-row"><td colspan="8"><i class="fas fa-folder-open"></i>No contracts match this search.</td></tr>`;
    return;
  }
  body.innerHTML = list.slice(0,8).map(r => `
    <tr>
      <td data-label="Contract ID"><div class="cid-cell">${cidIconHtml(r)}${r.id}</div></td>
      <td data-label="Book & Author">
        <div class="book-cell">
          <img class="book-cover" src="${r.cover}" alt="${r.title}"/>
          <div><div class="book-title">${r.title}</div><div class="book-author">by ${r.author}</div></div>
        </div>
      </td>
      <td data-label="Type" class="type-cell">${r.type}</td>
      <td data-label="Status">${statusPillHtml(r.status)}</td>
      <td data-label="Effective Date" class="date-cell">${r.effective}</td>
      <td data-label="Expiry Date" class="date-cell">${r.expiry}${r.expirySub ? `<span class="sub${r.status==='expiring'?' warn':''}">${r.expirySub}</span>` : ''}</td>
      <td data-label="Editor"><div class="editor-cell"><img src="${r.editorAvatar}" alt="${r.editor}"/><span>${r.editor}</span></div></td>
      <td data-label="Actions">
        <div class="actions-cell">
          <button class="act-btn" title="View" onclick="toast('Opening \\'${r.id}\\'…')"><i class="fas fa-eye"></i></button>
          <button class="act-btn" title="More" onclick="toast('More actions for \\'${r.id}\\'')"><i class="fas fa-ellipsis"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function renderPageInfo(count){
  const totals = { all:245, active:198, pending:17, expiring:12, expired:18, terminated:0 };
  const total = totals[currentView] ?? count;
  const shown = Math.min(8, count);
  document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${shown}</b> of <b>${total.toLocaleString()}</b> contracts`;
}

function refresh(){
  const list = currentFiltered();
  renderTable(list);
  renderPageInfo(list.length);
}

/* ── Pagination (visual, matches other admin pages) ── */
function renderPagination(){
  const wrap = document.getElementById('pageBtns');
  const pageSets = { all:[1,2,3,4,5,'...',31], active:[1,2,3,'...',25], pending:[1,2,3], expiring:[1,2], expired:[1,2,3], terminated:[1] };
  const pages = pageSets[currentView] || [1];
  wrap.innerHTML = `<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>` +
    pages.map(p => p === '...' ? `<span style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>` : `<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('') +
    `<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>`;
  wrap.querySelectorAll('[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.pg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ── Expiring soon list ── */
function renderExpiringSoon(){
  document.getElementById('expiringList').innerHTML = EXPIRING_SOON.map(e => `
    <div class="exp-row">
      <img class="exp-cover" src="${e.cover}" alt="${e.title}"/>
      <div class="exp-info"><div class="exp-title">${e.title}</div><div class="exp-author">by ${e.author}</div></div>
      <div class="exp-date"><b>${e.date}</b><span>${e.inDays}</span></div>
    </div>`).join('');
}

/* ── Contract statistics donut + legend ── */
function renderDonut(){
  let acc = 0;
  const stops = STATS_BREAKDOWN.map(s => {
    const start = acc;
    acc += s.pct;
    return `${s.color} ${start}% ${acc}%`;
  }).join(', ');
  document.getElementById('statsDonut').style.background = `conic-gradient(${stops})`;

  document.getElementById('statsLegend').innerHTML = STATS_BREAKDOWN.map(s => `
    <div class="legend-row">
      <div class="legend-lbl"><span class="legend-dot" style="background:${s.color}"></span>${s.label}</div>
      <div class="legend-val">${s.value} (${s.pct}%)</div>
    </div>`).join('');
}

/* ── Contract types bars ── */
function renderTypes(){
  document.getElementById('typesList').innerHTML = CONTRACT_TYPES.map(t => `
    <div class="type-row">
      <div class="type-row-top">
        <div class="type-ico ${t.cls}"><i class="fas ${t.icon}"></i></div>
        <div class="type-name">${t.label}</div>
        <div class="type-val">${t.value} (${t.pct}%)</div>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${t.pct}%;background:${t.color}"></div></div>
    </div>`).join('');
}

function bindEvents(){
  if (_bound) return; _bound = true;
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
  document.getElementById('editorSelect').addEventListener('change', refresh);
  document.getElementById('statusSelect').addEventListener('change', (e) => {
    const status = e.target.value;
    currentView = status || 'all';
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.toggle('active', t.dataset.view === currentView));
    renderPagination();
    refresh();
  });
  /* ── New Contract ── */
  document.getElementById('newContractBtn').addEventListener('click', () => toast('Opening new contract form…'));
}

function attachShell(){
  /* Contract Center is added to the Contract Management group so it highlights as active. */
  const NAV = JSON.parse(JSON.stringify(DroboardShell.DEFAULT_NAV));
  const contractGroup = NAV.find(g => g.section === 'Contract Management');
  if (contractGroup) {
    contractGroup.items.push({ label: 'Contract Center', icon: 'fa-diagram-project', href: 'contract-center.html' });
  }

  DroboardShell.attach('#dashboardRoot', {
    navItems: NAV,
    activeFile: 'contracts.html',
    title: 'Contract Center',
    subtitle: 'Manage, monitor and track all platform contracts',
    user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
    notifCount: 8,
    searchPlaceholder: 'Search by contract ID, book, author or type...',
    mobileSearchTarget: '#tableSearch',
    onSearch: (value) => {
      document.getElementById('tableSearch').value = value;
      refresh();
    },
  });
}

function init(){
  attachShell();
  window.refresh = refresh;
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/contracts').then(function (data) { if (data) refresh(); });
  callBackend('/contracts');
  bindEvents();
  renderPagination();
  renderExpiringSoon();
  renderDonut();
  renderTypes();
  refresh();
}

window.ContractsPageService = { init: init };

})();
