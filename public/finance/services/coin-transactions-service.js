/**
 * coin-transactions-service.js — Logic for coin transactions page
 * ──────────────────────────────────────────────────────────────
 * All rendering, filtering, pagination, pricing CRUD, subscriptions.
 * Reads from FinanceData; renders into #pageRoot elements.
 * No "spend" type — only purchases, gifts, and subscriptions.
 */
(function(){
'use strict';

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const TYPE_ICO = { purchase:'fa-circle-plus', gift:'fa-gift', subscription:'fa-star' };
const PER_PAGE = 8, PKG_PER_PAGE = 4, HIST_PER_PAGE = 6;

const API_BASE = window.DROBOARD_API_BASE || '/api/finance';
async function apiFetch(path, options){
  const res = await fetch(API_BASE + path, { headers:{'Content-Type':'application/json'}, ...options });
  if(!res.ok) throw new Error('Request failed: ' + res.status);
  return res.status===204 ? null : res.json();
}
let usingDemoConfig = false;

const DEMO_PACKAGES = [
  { id:'PKG-01', name:'Starter Pack',  coins:1000,  priceUsd:9.99,  bonusPercent:0,  status:'active',   createdAt:'2026-01-15' },
  { id:'PKG-02', name:'Reader Bundle', coins:5000,  priceUsd:49.99, bonusPercent:5,  status:'active',   createdAt:'2026-02-01' },
  { id:'PKG-03', name:'Power Pack',    coins:12000, priceUsd:99.99, bonusPercent:10, status:'active',   createdAt:'2026-03-10' },
  { id:'PKG-04', name:'Trial Pack',    coins:500,   priceUsd:5.99,  bonusPercent:0,  status:'inactive', createdAt:'2025-11-01' },
];
const DEMO_GIFTS = [
  { id:'GFT-01', name:'Rose',    icon:'🌹', costCoins:50,   status:'active',   createdAt:'2026-01-20' },
  { id:'GFT-02', name:'Heart',   icon:'❤️', costCoins:100,  status:'active',   createdAt:'2026-01-20' },
  { id:'GFT-03', name:'Crown',   icon:'👑', costCoins:500,  status:'active',   createdAt:'2026-02-15' },
  { id:'GFT-04', name:'Diamond', icon:'💎', costCoins:1000, status:'active',   createdAt:'2026-03-05' },
  { id:'GFT-05', name:'Trophy',  icon:'🏆', costCoins:2000, status:'inactive', createdAt:'2025-12-01' },
];
const DEMO_SUBSCRIPTIONS = [
  { id:'SUB-01', name:'Basic Monthly',   priceUsd:4.99,  durationDays:30,  coinsPerDay:50,  bonusPercent:0,  status:'active',   createdAt:'2026-01-10' },
  { id:'SUB-02', name:'Premium Monthly',  priceUsd:9.99,  durationDays:30,  coinsPerDay:150, bonusPercent:10, status:'active',   createdAt:'2026-02-01' },
  { id:'SUB-03', name:'VIP Quarterly',    priceUsd:24.99, durationDays:90,  coinsPerDay:200, bonusPercent:15, status:'active',   createdAt:'2026-03-01' },
  { id:'SUB-04', name:'Annual Premium',   priceUsd:89.99, durationDays:365, coinsPerDay:250, bonusPercent:20, status:'inactive', createdAt:'2025-10-01' },
];
const DEMO_HISTORY = [
  { id:'CFG-001', action:'created',    itemType:'package',      itemName:'Starter Pack',     actor:'Ngozi Falade', date:'2026-01-15T10:00:00', details:'1,000 coins for $9.99' },
  { id:'CFG-002', action:'created',    itemType:'gift',         itemName:'Rose',             actor:'Ngozi Falade', date:'2026-01-20T09:30:00', details:'50 coins per gift' },
  { id:'CFG-003', action:'created',    itemType:'gift',         itemName:'Heart',            actor:'Ngozi Falade', date:'2026-01-20T09:32:00', details:'100 coins per gift' },
  { id:'CFG-004', action:'created',    itemType:'package',      itemName:'Reader Bundle',    actor:'Ngozi Falade', date:'2026-02-01T11:15:00', details:'5,000 coins for $49.99 (+5% bonus)' },
  { id:'CFG-005', action:'created',    itemType:'gift',         itemName:'Crown',            actor:'Tari Benson',  date:'2026-02-15T14:00:00', details:'500 coins per gift' },
  { id:'CFG-006', action:'created',    itemType:'package',      itemName:'Power Pack',       actor:'Ngozi Falade', date:'2026-03-10T08:45:00', details:'12,000 coins for $99.99 (+10% bonus)' },
  { id:'CFG-007', action:'created',    itemType:'gift',         itemName:'Diamond',          actor:'Ngozi Falade', date:'2026-03-05T16:20:00', details:'1,000 coins per gift' },
  { id:'CFG-008', action:'deactivated',itemType:'gift',         itemName:'Trophy',           actor:'Ngozi Falade', date:'2026-04-02T09:00:00', details:'Retired seasonal gift item' },
  { id:'CFG-009', action:'created',    itemType:'subscription', itemName:'Basic Monthly',    actor:'Ngozi Falade', date:'2026-01-10T10:00:00', details:'$4.99/mo · 50 coins/day' },
  { id:'CFG-010', action:'created',    itemType:'subscription', itemName:'Premium Monthly',  actor:'Ngozi Falade', date:'2026-02-01T11:00:00', details:'$9.99/mo · 150 coins/day (+10% bonus)' },
  { id:'CFG-011', action:'created',    itemType:'subscription', itemName:'VIP Quarterly',    actor:'Ngozi Falade', date:'2026-03-01T09:00:00', details:'$24.99/90d · 200 coins/day (+15% bonus)' },
];

let ALL = [];
let PACKAGES = [], GIFTS = [], SUBSCRIPTIONS = [], HISTORY = [];
let activeTab = 'transactions';
let activeType = 'all';
let searchTerm = '', statusTerm = '', sortMode = 'recent';
let page = 1, pkgPage = 1, giftPage = 1, subPage = 1, histPage = 1;
let activeHistFilter = 'all';

function money(n){ const v = Number(n||0); return (v<0?'-':'') + '$' + Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function coinsFmt(n){ const v=Number(n||0); return (v>0?'+':'') + v.toLocaleString('en-US'); }
function fmtDateTime(iso){ const d=new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function isToday(iso){ const d=new Date(iso), t=new Date(); return d.toDateString()===t.toDateString(); }

async function init(){
  ALL = await FinanceData.getCoinTransactions();
  await loadConfig();
  renderStatCards();
  renderFilterPills();
  render();
  renderPricing();
  renderHistFilterPills();
  renderHistory();
}

async function loadConfig(){
  try{
    const [p,g,s,h] = await Promise.all([apiFetch('/coin-packages'), apiFetch('/coin-gifts'), apiFetch('/coin-subscriptions'), apiFetch('/coin-config-history')]);
    PACKAGES = p; GIFTS = g; SUBSCRIPTIONS = s; HISTORY = h; usingDemoConfig = false;
  }catch(e){
    PACKAGES = JSON.parse(JSON.stringify(DEMO_PACKAGES));
    GIFTS = JSON.parse(JSON.stringify(DEMO_GIFTS));
    SUBSCRIPTIONS = JSON.parse(JSON.stringify(DEMO_SUBSCRIPTIONS));
    HISTORY = JSON.parse(JSON.stringify(DEMO_HISTORY));
    usingDemoConfig = true;
  }
}
function logHistory(action, itemType, itemName, details){
  const entry = { id:'CFG-'+String(HISTORY.length+1).padStart(3,'0'), action, itemType, itemName, actor:'Ngozi Falade', date:new Date().toISOString(), details };
  HISTORY.unshift(entry);
  if(!usingDemoConfig) apiFetch('/coin-config-history', { method:'POST', body: JSON.stringify(entry) }).catch(()=>{});
}

/* ── Stat cards ── */
function renderStatCards(){
  const purchasedToday = ALL.filter(t=>t.type==='purchase' && t.status==='completed' && isToday(t.date)).reduce((s,t)=>s+t.usd,0);
  const refunded = ALL.filter(t=>t.status==='refunded').length;
  const activeSubs = SUBSCRIPTIONS.filter(s=>s.status==='active').length;
  const stats = [
    { n:money(purchasedToday), l:'Purchased Today', ico:'fa-circle-plus', cls:'green' },
    { n:'4.2M', l:'Coins in Circulation', ico:'fa-coins', cls:'amber' },
    { n:activeSubs, l:'Active Subscriptions', ico:'fa-star', cls:'purple' },
    { n:refunded, l:'Refunded Transactions', ico:'fa-arrow-rotate-left', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ── Tabs ── */
document.querySelectorAll('#tabBar .tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    activeTab = btn.dataset.tab;
    document.querySelectorAll('#tabBar .tab-btn').forEach(b=>b.classList.toggle('active', b===btn));
    document.getElementById('tab-transactions').style.display = activeTab==='transactions' ? 'block':'none';
    document.getElementById('tab-pricing').style.display = activeTab==='pricing' ? 'block':'none';
    document.getElementById('tab-history').style.display = activeTab==='history' ? 'block':'none';
  });
});

/* ── Transactions filter pills ── */
function renderFilterPills(){
  const counts = { all:ALL.length, purchase:0, gift:0, subscription:0 };
  ALL.forEach(t=>{ if(counts[t.type]!=null) counts[t.type]++; });
  const pills = [ {key:'all',label:'All'}, {key:'purchase',label:'Purchases'}, {key:'gift',label:'Gifts'}, {key:'subscription',label:'Subscriptions'} ];
  document.getElementById('filterPills').innerHTML = pills.map(p=>`
    <button class="f-pill${activeType===p.key?' active':''}" data-type="${p.key}">${p.label} <span class="cnt">${counts[p.key]}</span></button>`).join('');
  document.querySelectorAll('#filterPills .f-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeType = btn.dataset.type; page=1; renderFilterPills(); render(); });
  });
}

function getFiltered(){
  let list = ALL.slice();
  if(activeType!=='all') list = list.filter(t=>t.type===activeType);
  if(statusTerm) list = list.filter(t=>t.status===statusTerm);
  if(searchTerm) list = list.filter(t=>t.user.toLowerCase().includes(searchTerm.toLowerCase()));
  if(sortMode==='coins-desc') list.sort((a,b)=>Math.abs(b.coins)-Math.abs(a.coins));
  else if(sortMode==='usd-desc') list.sort((a,b)=>Math.abs(b.usd)-Math.abs(a.usd));
  else list.sort((a,b)=> new Date(b.date)-new Date(a.date));
  return list;
}

function render(){
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length/PER_PAGE));
  if(page>totalPages) page = totalPages;
  const pageItems = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const box = document.getElementById('txList');
  if(!pageItems.length){
    box.innerHTML = `<div class="empty-state"><i class="fas fa-coins"></i><p>No transactions match your filters.</p></div>`;
    document.getElementById('txPagination').innerHTML = '';
    return;
  }

  box.innerHTML = `<div class="tx-list">${pageItems.map(t=>{
    const typeColor = t.type==='purchase'?'green':t.type==='gift'?'purple':'amber';
    return `
    <div class="tx-card" data-id="${t.id}">
      <div class="tx-ico" style="background:${BG_MAP[typeColor]};color:${ICO_MAP[typeColor]}"><i class="fas ${TYPE_ICO[t.type]||'fa-circle-question'}"></i></div>
      <img class="tx-avatar" src="${t.avatar}" alt="${t.user}"/>
      <div class="tx-body">
        <div>
          <div class="tx-user">${t.user}</div>
          <div class="tx-meta">${fmtDateTime(t.date)}${t.note ? ' · '+t.note : ''}</div>
        </div>
        <span class="type-chip ${t.type}">${t.type}</span>
        <span class="status-pill ${t.status}">${t.status}</span>
      </div>
      <div class="tx-figures">
        <div class="tx-coins ${t.coins>0?'pos':''}">${coinsFmt(t.coins)} coins</div>
        <div class="tx-usd">${money(t.usd)}</div>
      </div>
    </div>`;
  }).join('')}</div>`;

  document.querySelectorAll('.tx-card').forEach(card=>{
    card.addEventListener('click', ()=>openTxDetail(card.dataset.id));
  });

  renderTxPagination(totalPages);
}

function renderTxPagination(totalPages){
  const box = document.getElementById('txPagination');
  if(totalPages<=1){ box.innerHTML=''; return; }
  let html = `<button class="page-btn" ${page===1?'disabled':''} data-p="${page-1}"><i class="fas fa-chevron-left"></i></button>`;
  for(let i=1;i<=totalPages;i++) html += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
  html += `<button class="page-btn" ${page===totalPages?'disabled':''} data-p="${page+1}"><i class="fas fa-chevron-right"></i></button>`;
  box.innerHTML = html;
  box.querySelectorAll('.page-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ page=parseInt(btn.dataset.p,10); render(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
}

document.getElementById('searchInput').addEventListener('input', e=>{ searchTerm=e.target.value; page=1; render(); });
document.getElementById('statusFilter').addEventListener('change', e=>{ statusTerm=e.target.value; page=1; render(); });
document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; render(); });

/* ── Transaction detail modal ── */
const ctOverlay = document.getElementById('ctOverlay');
const ctModal = document.getElementById('ctModal');
function openTxDetail(id){
  const t = ALL.find(x=>x.id===id);
  if(!t) return;
  ctModal.innerHTML = `
    <div class="ct-head"><h3>Transaction Detail</h3><button class="ct-close" id="ctClose"><i class="fas fa-xmark"></i></button></div>
    <div class="ct-body">
      <div class="ct-amt-card">
        <div class="ct-amt-num" style="color:${t.coins>0?'var(--green)':'var(--text)'}">${coinsFmt(t.coins)} coins</div>
        <div class="ct-amt-usd">${money(t.usd)}</div>
      </div>
      <div class="ct-meta-grid">
        <div class="ct-meta-item"><div class="ct-meta-lbl">User</div><div class="ct-meta-val">${t.user}</div></div>
        <div class="ct-meta-item"><div class="ct-meta-lbl">Type</div><div class="ct-meta-val" style="text-transform:capitalize">${t.type}</div></div>
        <div class="ct-meta-item"><div class="ct-meta-lbl">Status</div><div class="ct-meta-val" style="text-transform:capitalize">${t.status}</div></div>
        <div class="ct-meta-item"><div class="ct-meta-lbl">Reference</div><div class="ct-meta-val" style="font-size:11px">${t.id}</div></div>
        <div class="ct-meta-item" style="grid-column:1/-1"><div class="ct-meta-lbl">Date</div><div class="ct-meta-val">${fmtDateTime(t.date)}</div></div>
      </div>
      ${t.note ? `<div class="ct-note"><i class="fas fa-circle-info"></i> ${t.note}</div>` : ''}
    </div>`;
  ctOverlay.classList.add('open');
  document.getElementById('ctClose').addEventListener('click', ()=>ctOverlay.classList.remove('open'));
}
ctOverlay.addEventListener('click', e=>{ if(e.target===ctOverlay) ctOverlay.classList.remove('open'); });

/* ══════════════════════════════════════════
   COIN PRICING — Packages, Gifts & Subscriptions
══════════════════════════════════════════ */
function renderPricing(){
  document.getElementById('pricingCount').textContent = PACKAGES.length + GIFTS.length + SUBSCRIPTIONS.length;

  /* ── Packages ── */
  const pkgTotalPages = Math.max(1, Math.ceil(PACKAGES.length / PKG_PER_PAGE));
  if(pkgPage>pkgTotalPages) pkgPage = pkgTotalPages;
  const pkgPageItems = PACKAGES.slice((pkgPage-1)*PKG_PER_PAGE, pkgPage*PKG_PER_PAGE);
  document.getElementById('pkgList').innerHTML = pkgPageItems.length ? pkgPageItems.map(p=>`
    <div class="pkg-card" data-id="${p.id}">
      <div class="pkg-top"><span class="pkg-name">${p.name}</span><span class="status-pill ${p.status}">${p.status}</span></div>
      <div class="pkg-coins"><i class="fas fa-coins" style="font-size:15px"></i>${p.coins.toLocaleString()}</div>
      <div class="pkg-price">${money(p.priceUsd)}${p.bonusPercent>0?` · <span class="pkg-bonus" style="display:inline">+${p.bonusPercent}% bonus</span>`:''}</div>
      <div class="pkg-meta"><i class="fas fa-calendar"></i> Created ${fmtDate(p.createdAt)}</div>
      <div class="pkg-actions">
        <button class="mini-btn" data-action="pkg-toggle" data-id="${p.id}"><i class="fas fa-power-off"></i> ${p.status==='active'?'Deactivate':'Activate'}</button>
        <button class="mini-btn" data-action="pkg-edit" data-id="${p.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="mini-btn danger" data-action="pkg-delete" data-id="${p.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-coins"></i><p>No coin packages yet.</p></div>`;
  renderMiniPagination('pkgPagination', pkgTotalPages, pkgPage, (p)=>{ pkgPage=p; renderPricing(); });

  /* ── Gifts ── */
  const giftTotalPages = Math.max(1, Math.ceil(GIFTS.length / PKG_PER_PAGE));
  if(giftPage>giftTotalPages) giftPage = giftTotalPages;
  const giftPageItems = GIFTS.slice((giftPage-1)*PKG_PER_PAGE, giftPage*PKG_PER_PAGE);
  document.getElementById('giftList').innerHTML = giftPageItems.length ? giftPageItems.map(g=>`
    <div class="pkg-card" data-id="${g.id}">
      <div class="pkg-top">
        <div style="display:flex;align-items:center;gap:10px"><span class="gift-icon-badge">${g.icon}</span><span class="pkg-name">${g.name}</span></div>
        <span class="status-pill ${g.status}">${g.status}</span>
      </div>
      <div class="pkg-gift-cost" style="margin-top:8px"><i class="fas fa-coins" style="font-size:15px;color:var(--amber)"></i>${g.costCoins.toLocaleString()}</div>
      <div class="pkg-meta"><i class="fas fa-calendar"></i> Created ${fmtDate(g.createdAt)}</div>
      <div class="pkg-actions">
        <button class="mini-btn" data-action="gift-toggle" data-id="${g.id}"><i class="fas fa-power-off"></i> ${g.status==='active'?'Deactivate':'Activate'}</button>
        <button class="mini-btn" data-action="gift-edit" data-id="${g.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="mini-btn danger" data-action="gift-delete" data-id="${g.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-gift"></i><p>No gift items yet.</p></div>`;
  renderMiniPagination('giftPagination', giftTotalPages, giftPage, (p)=>{ giftPage=p; renderPricing(); });

  /* ── Subscriptions ── */
  const subTotalPages = Math.max(1, Math.ceil(SUBSCRIPTIONS.length / PKG_PER_PAGE));
  if(subPage>subTotalPages) subPage = subTotalPages;
  const subPageItems = SUBSCRIPTIONS.slice((subPage-1)*PKG_PER_PAGE, subPage*PKG_PER_PAGE);
  document.getElementById('subList').innerHTML = subPageItems.length ? subPageItems.map(s=>`
    <div class="pkg-card" data-id="${s.id}">
      <div class="pkg-top"><span class="pkg-name">${s.name}</span><span class="status-pill ${s.status}">${s.status}</span></div>
      <div class="pkg-coins" style="color:var(--purple)"><i class="fas fa-star" style="font-size:15px"></i>${s.coinsPerDay}/day</div>
      <div class="pkg-price">${money(s.priceUsd)}/${s.durationDays}d${s.bonusPercent>0?` · <span class="pkg-bonus" style="display:inline">+${s.bonusPercent}% bonus</span>`:''}</div>
      <div class="pkg-meta"><i class="fas fa-calendar"></i> Created ${fmtDate(s.createdAt)}</div>
      <div class="pkg-actions">
        <button class="mini-btn" data-action="sub-toggle" data-id="${s.id}"><i class="fas fa-power-off"></i> ${s.status==='active'?'Deactivate':'Activate'}</button>
        <button class="mini-btn" data-action="sub-edit" data-id="${s.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="mini-btn danger" data-action="sub-delete" data-id="${s.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-star"></i><p>No subscriptions yet.</p></div>`;
  renderMiniPagination('subPagination', subTotalPages, subPage, (p)=>{ subPage=p; renderPricing(); });
}

function renderMiniPagination(elId, totalPages, current, onGo){
  const box = document.getElementById(elId);
  if(totalPages<=1){ box.innerHTML=''; return; }
  let html = `<button class="page-btn" ${current===1?'disabled':''} data-p="${current-1}"><i class="fas fa-chevron-left"></i></button>`;
  for(let i=1;i<=totalPages;i++) html += `<button class="page-btn${i===current?' active':''}" data-p="${i}">${i}</button>`;
  html += `<button class="page-btn" ${current===totalPages?'disabled':''} data-p="${current+1}"><i class="fas fa-chevron-right"></i></button>`;
  box.innerHTML = html;
  box.querySelectorAll('.page-btn').forEach(btn=> btn.addEventListener('click', ()=> onGo(parseInt(btn.dataset.p,10))));
}

/* ── Form modal (create/edit package, gift, or subscription) ── */
let formKind = 'package';
let editingItemId = null;

function setFormKind(kind, locked){
  formKind = kind;
  document.querySelectorAll('#kindRow .radio-opt').forEach(el=>{
    const active = el.dataset.kind===kind;
    el.classList.toggle('active', active);
    el.classList.toggle('disabled', !!locked);
    el.querySelector('input').checked = active;
  });
  document.getElementById('nameLabel').textContent = kind==='package' ? 'Package Name' : kind==='gift' ? 'Gift Name' : 'Subscription Name';
  document.getElementById('itemName').placeholder = kind==='package' ? 'e.g. Reader Bundle' : kind==='gift' ? 'e.g. Rose' : 'e.g. Premium Monthly';
  document.getElementById('packageFields').style.display = kind==='package' ? 'flex' : 'none';
  document.getElementById('packageFields').style.flexDirection = 'column';
  document.getElementById('packageFields').style.gap = '12px';
  document.getElementById('giftFields').style.display = kind==='gift' ? 'block' : 'none';
  document.getElementById('subFields').style.display = kind==='subscription' ? 'flex' : 'none';
  document.getElementById('subFields').style.flexDirection = 'column';
  document.getElementById('subFields').style.gap = '12px';
}

function openCreateModal(kind){
  editingItemId = null;
  document.getElementById('formModalTitle').textContent = kind==='gift' ? 'New Gift Item' : kind==='subscription' ? 'New Subscription' : 'New Coin Package';
  document.getElementById('formModalSub').textContent = 'Set up a coin package, giftable item, or reader subscription.';
  document.getElementById('itemName').value = '';
  document.getElementById('pkgCoins').value = '';
  document.getElementById('pkgPrice').value = '';
  document.getElementById('pkgBonus').value = '';
  document.getElementById('giftIcon').value = '';
  document.getElementById('giftCost').value = '';
  document.getElementById('subPrice').value = '';
  document.getElementById('subDuration').value = '';
  document.getElementById('subCoinsPerDay').value = '';
  document.getElementById('subBonus').value = '';
  document.getElementById('itemStatus').value = 'active';
  document.getElementById('formModalError').classList.remove('show');
  setFormKind(kind || 'package', false);
  document.getElementById('formConfirmBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save';
  document.getElementById('formModalOv').classList.add('open');
}

function openEditModal(kind, id){
  const list = kind==='package' ? PACKAGES : kind==='gift' ? GIFTS : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  editingItemId = id;
  document.getElementById('formModalTitle').textContent = kind==='gift' ? 'Edit Gift Item' : kind==='subscription' ? 'Edit Subscription' : 'Edit Coin Package';
  document.getElementById('formModalSub').textContent = 'Update the details below and save your changes.';
  document.getElementById('itemName').value = item.name;
  if(kind==='package'){
    document.getElementById('pkgCoins').value = item.coins;
    document.getElementById('pkgPrice').value = item.priceUsd;
    document.getElementById('pkgBonus').value = item.bonusPercent || '';
  }else if(kind==='gift'){
    document.getElementById('giftIcon').value = item.icon;
    document.getElementById('giftCost').value = item.costCoins;
  }else{
    document.getElementById('subPrice').value = item.priceUsd;
    document.getElementById('subDuration').value = item.durationDays;
    document.getElementById('subCoinsPerDay').value = item.coinsPerDay;
    document.getElementById('subBonus').value = item.bonusPercent || '';
  }
  document.getElementById('itemStatus').value = item.status;
  document.getElementById('formModalError').classList.remove('show');
  setFormKind(kind, true);
  document.getElementById('formConfirmBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
  document.getElementById('formModalOv').classList.add('open');
}

function closeFormModal(){ document.getElementById('formModalOv').classList.remove('open'); editingItemId = null; }

document.querySelectorAll('#kindRow .radio-opt').forEach(el=>{
  el.addEventListener('click', ()=>{ if(!editingItemId) setFormKind(el.dataset.kind, false); });
});

async function submitForm(){
  const name = document.getElementById('itemName').value.trim();
  const status = document.getElementById('itemStatus').value;
  const errBox = document.getElementById('formModalError');
  if(!name){ errBox.textContent='Please enter a name.'; errBox.classList.add('show'); return; }

  let payload;
  if(formKind==='package'){
    const coins = parseInt(document.getElementById('pkgCoins').value,10) || 0;
    const priceUsd = parseFloat(document.getElementById('pkgPrice').value) || 0;
    const bonusPercent = parseInt(document.getElementById('pkgBonus').value,10) || 0;
    if(coins<=0){ errBox.textContent='Please enter a coin amount.'; errBox.classList.add('show'); return; }
    if(priceUsd<=0){ errBox.textContent='Please enter a price.'; errBox.classList.add('show'); return; }
    payload = { name, coins, priceUsd, bonusPercent, status };
  }else if(formKind==='gift'){
    const icon = document.getElementById('giftIcon').value.trim() || '🎁';
    const costCoins = parseInt(document.getElementById('giftCost').value,10) || 0;
    if(costCoins<=0){ errBox.textContent='Please enter a coin cost.'; errBox.classList.add('show'); return; }
    payload = { name, icon, costCoins, status };
  }else{
    const priceUsd = parseFloat(document.getElementById('subPrice').value) || 0;
    const durationDays = parseInt(document.getElementById('subDuration').value,10) || 0;
    const coinsPerDay = parseInt(document.getElementById('subCoinsPerDay').value,10) || 0;
    const bonusPercent = parseInt(document.getElementById('subBonus').value,10) || 0;
    if(priceUsd<=0){ errBox.textContent='Please enter a price.'; errBox.classList.add('show'); return; }
    if(durationDays<=0){ errBox.textContent='Please enter duration in days.'; errBox.classList.add('show'); return; }
    if(coinsPerDay<=0){ errBox.textContent='Please enter coins per day.'; errBox.classList.add('show'); return; }
    payload = { name, priceUsd, durationDays, coinsPerDay, bonusPercent, status };
  }
  errBox.classList.remove('show');

  const btn = document.getElementById('formConfirmBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  try{
    const list = formKind==='package' ? PACKAGES : formKind==='gift' ? GIFTS : SUBSCRIPTIONS;
    const endpoint = formKind==='package' ? '/coin-packages' : formKind==='gift' ? '/coin-gifts' : '/coin-subscriptions';
    if(editingItemId){
      const item = list.find(x=>x.id===editingItemId);
      try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+editingItemId, { method:'PUT', body: JSON.stringify(payload) }); }catch(_){}
      Object.assign(item, payload);
      const details = formKind==='package' ? `${payload.coins.toLocaleString()} coins for ${money(payload.priceUsd)}` : formKind==='gift' ? `${payload.costCoins.toLocaleString()} coins per gift` : `${payload.coinsPerDay}/day for ${money(payload.priceUsd)}/${payload.durationDays}d`;
      logHistory('updated', formKind, name, details);
      toast(`✏️ "${name}" updated`);
    }else{
      let created = null;
      try{ if(!usingDemoConfig) created = await apiFetch(endpoint, { method:'POST', body: JSON.stringify(payload) }); }catch(_){}
      if(!created){
        const prefix = formKind==='package' ? 'PKG-' : formKind==='gift' ? 'GFT-' : 'SUB-';
        created = Object.assign({ id: prefix+String(list.length+1).padStart(2,'0'), createdAt: new Date().toISOString().slice(0,10) }, payload);
      }
      list.unshift(created);
      const details = formKind==='package' ? `${payload.coins.toLocaleString()} coins for ${money(payload.priceUsd)}` : formKind==='gift' ? `${payload.costCoins.toLocaleString()} coins per gift` : `${payload.coinsPerDay}/day for ${money(payload.priceUsd)}/${payload.durationDays}d`;
      logHistory('created', formKind, name, details);
      toast(`✅ "${name}" created`);
    }
    closeFormModal();
    renderPricing(); renderHistFilterPills(); renderHistory();
  }catch(err){
    errBox.textContent = 'Something went wrong. Please try again.'; errBox.classList.add('show');
  }finally{
    btn.disabled = false; btn.innerHTML = editingItemId ? '<i class="fas fa-floppy-disk"></i> Save Changes' : '<i class="fas fa-floppy-disk"></i> Save';
  }
}

/* ── Toggle status ── */
async function toggleStatus(kind, id){
  const list = kind==='package' ? PACKAGES : kind==='gift' ? GIFTS : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  const newStatus = item.status==='active' ? 'inactive' : 'active';
  const endpoint = kind==='package' ? '/coin-packages' : kind==='gift' ? '/coin-gifts' : '/coin-subscriptions';
  try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+id, { method:'PUT', body: JSON.stringify({ status:newStatus }) }); }catch(_){}
  item.status = newStatus;
  logHistory(newStatus==='active'?'activated':'deactivated', kind, item.name, newStatus==='active' ? 'Re-enabled for purchase/use' : 'Temporarily disabled');
  toast(`${newStatus==='active'?'✅':'⏸️'} "${item.name}" ${newStatus}`);
  renderPricing(); renderHistFilterPills(); renderHistory();
}

/* ── Delete confirm modal ── */
let delTarget = null;
function openDelModal(kind, id){
  const list = kind==='package' ? PACKAGES : kind==='gift' ? GIFTS : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  delTarget = { kind, id, name:item.name };
  document.getElementById('delModalSub').textContent = `Delete "${item.name}"? This can't be undone.`;
  document.getElementById('delModalOv').classList.add('open');
}
function closeDelModal(){ document.getElementById('delModalOv').classList.remove('open'); delTarget = null; }
async function submitDel(){
  if(!delTarget) return;
  const { kind, id, name } = delTarget;
  const endpoint = kind==='package' ? '/coin-packages' : kind==='gift' ? '/coin-gifts' : '/coin-subscriptions';
  try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+id, { method:'DELETE' }); }catch(_){}
  if(kind==='package') PACKAGES = PACKAGES.filter(x=>x.id!==id);
  else if(kind==='gift') GIFTS = GIFTS.filter(x=>x.id!==id);
  else SUBSCRIPTIONS = SUBSCRIPTIONS.filter(x=>x.id!==id);
  logHistory('deleted', kind, name, 'Removed from catalog');
  toast(`🗑️ "${name}" deleted`);
  closeDelModal();
  renderPricing(); renderHistFilterPills(); renderHistory();
}

/* ── History tab ── */
function renderHistFilterPills(){
  document.getElementById('historyCount').textContent = HISTORY.length;
  const counts = { all:HISTORY.length, package:0, gift:0, subscription:0 };
  HISTORY.forEach(h=>{ if(counts[h.itemType]!=null) counts[h.itemType]++; });
  const pills = [ {key:'all',label:'All'}, {key:'package',label:'Packages'}, {key:'gift',label:'Gifts'}, {key:'subscription',label:'Subscriptions'} ];
  document.getElementById('histFilterPills').innerHTML = pills.map(p=>`
    <button class="f-pill${activeHistFilter===p.key?' active':''}" data-h="${p.key}">${p.label} <span class="cnt">${counts[p.key]}</span></button>`).join('');
  document.querySelectorAll('#histFilterPills .f-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeHistFilter = btn.dataset.h; histPage=1; renderHistFilterPills(); renderHistory(); });
  });
}

const HIST_ICO = { created:{ico:'fa-circle-plus',cls:'green'}, updated:{ico:'fa-pen',cls:'blue'}, deleted:{ico:'fa-trash',cls:'red'}, activated:{ico:'fa-power-off',cls:'green'}, deactivated:{ico:'fa-power-off',cls:'amber'} };

function renderHistory(){
  let list = activeHistFilter==='all' ? HISTORY.slice() : HISTORY.filter(h=>h.itemType===activeHistFilter);
  list.sort((a,b)=> new Date(b.date)-new Date(a.date));

  const totalPages = Math.max(1, Math.ceil(list.length/HIST_PER_PAGE));
  if(histPage>totalPages) histPage = totalPages;
  const pageItems = list.slice((histPage-1)*HIST_PER_PAGE, histPage*HIST_PER_PAGE);

  const box = document.getElementById('histList');
  if(!pageItems.length){
    box.innerHTML = `<div class="empty-state"><i class="fas fa-clock-rotate-left"></i><p>No history yet.</p></div>`;
    document.getElementById('histPagination').innerHTML = '';
    return;
  }

  box.innerHTML = pageItems.map(h=>{
    const ico = HIST_ICO[h.action] || {ico:'fa-circle-info',cls:'blue'};
    return `<div class="hist-row">
      <div class="hist-ico" style="background:${BG_MAP[ico.cls]};color:${ICO_MAP[ico.cls]}"><i class="fas ${ico.ico}"></i></div>
      <div class="hist-body">
        <div class="hist-text"><b>${h.actor}</b> ${h.action} ${h.itemType} <b>"${h.itemName}"</b></div>
        <div class="hist-detail">${h.details}</div>
      </div>
      <div class="hist-time">${fmtDateTime(h.date)}</div>
    </div>`;
  }).join('');

  renderMiniPagination('histPagination', totalPages, histPage, (p)=>{ histPage=p; renderHistory(); });
}

/* ── New item button ── */
document.getElementById('newItemBtn').addEventListener('click', ()=>{
  activeTab = 'pricing';
  document.querySelectorAll('#tabBar .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab==='pricing'));
  document.getElementById('tab-transactions').style.display = 'none';
  document.getElementById('tab-pricing').style.display = 'block';
  document.getElementById('tab-history').style.display = 'none';
  openCreateModal('package');
});
document.getElementById('addPackageBtn').addEventListener('click', ()=>openCreateModal('package'));
document.getElementById('addGiftBtn').addEventListener('click', ()=>openCreateModal('gift'));
document.getElementById('addSubBtn').addEventListener('click', ()=>openCreateModal('subscription'));

/* ── Event delegation ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action, id = el.dataset.id;

  if(action==='pkg-edit') openEditModal('package', id);
  else if(action==='gift-edit') openEditModal('gift', id);
  else if(action==='sub-edit') openEditModal('subscription', id);
  else if(action==='pkg-delete') openDelModal('package', id);
  else if(action==='gift-delete') openDelModal('gift', id);
  else if(action==='sub-delete') openDelModal('subscription', id);
  else if(action==='pkg-toggle') toggleStatus('package', id);
  else if(action==='gift-toggle') toggleStatus('gift', id);
  else if(action==='sub-toggle') toggleStatus('subscription', id);
  else if(action==='close-form-modal') closeFormModal();
  else if(action==='submit-form') submitForm();
  else if(action==='close-del-modal') closeDelModal();
  else if(action==='submit-del') submitDel();
});
document.getElementById('formModalOv').addEventListener('click', e=>{ if(e.target.id==='formModalOv') closeFormModal(); });
document.getElementById('delModalOv').addEventListener('click', e=>{ if(e.target.id==='delModalOv') closeDelModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeFormModal(); closeDelModal(); ctOverlay.classList.remove('open'); } });

init();
})();
