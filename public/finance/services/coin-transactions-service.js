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
const DEMO_EARN = [
  { id:'ad1', action:'Watch Ad', coins:10, cooldown:'5 min', icon:'fa-film', available:true, status:'active', createdAt:'2026-01-15', type:'watch_ad' },
  { id:'ad2', action:'Daily Check-in', coins:25, cooldown:'24 hr', icon:'fa-calendar-check', available:true, status:'active', createdAt:'2026-01-16', type:'checkin' },
  { id:'ad3', action:'Rate Story', coins:5, cooldown:'1 hr', icon:'fa-star', available:true, status:'active', createdAt:'2026-01-17', type:'rate' },
  { id:'ad4', action:'Share Story', coins:15, cooldown:'2 hr', icon:'fa-share-nodes', available:true, status:'active', createdAt:'2026-01-18', type:'share' },
  { id:'ad5', action:'Read Blog — Tech Niche (3 pages)', coins:25, cooldown:'24 hr', icon:'fa-microchip', available:true, status:'active', createdAt:'2026-01-19', type:'blog_read', pagesRequired:3, blogCategory:'tech', blogUrl:'Pages/blog.html?cat=tech' },
  { id:'ad8', action:'Read Blog — Health Niche (3 pages)', coins:25, cooldown:'24 hr', icon:'fa-heart-pulse', available:true, status:'active', createdAt:'2026-01-22', type:'blog_read', pagesRequired:3, blogCategory:'health', blogUrl:'Pages/blog.html?cat=health' },
  { id:'ad6', action:'Subscribe on YouTube', coins:30, cooldown:'30d', icon:'fa-youtube', available:true, status:'active', createdAt:'2026-01-20', type:'youtube_sub', channelId:'UCxxxxDroboard' },
  { id:'ad7', action:'Watch YouTube Video', coins:15, cooldown:'24 hr', icon:'fa-circle-play', available:true, status:'active', createdAt:'2026-01-21', type:'youtube_watch', videoId:'dQw4w9WgXcQ', minWatchSec:60 },
];
const DEMO_BUNDLES = [
  { id:'b1', name:'Starter Bundle', coins:500, bonus:50, price:'$3.99', icon:'fa-seedling', color:'#22c55e', status:'active', createdAt:'2026-02-01' },
  { id:'b2', name:'Pro Bundle', coins:1500, bonus:300, price:'$9.99', icon:'fa-fire', color:'#FF2D6A', status:'active', createdAt:'2026-02-05' },
  { id:'b3', name:'Elite Bundle', coins:5000, bonus:1500, price:'$29.99', icon:'fa-crown', color:'#D6165A', status:'active', createdAt:'2026-02-10' },
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
let PACKAGES = [], GIFTS = [], SUBSCRIPTIONS = [], EARN = [], BUNDLES = [], HISTORY = [];
let activeTab = 'transactions';
let activeType = 'all';
let searchTerm = '', statusTerm = '', sortMode = 'recent';
let page = 1, pkgPage = 1, bundlePage = 1, giftPage = 1, subPage = 1, earnPage = 1, histPage = 1;
let activeHistFilter = 'all';

function money(n){ const v = Number(n||0); return (v<0?'-':'') + '$' + Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function coinsFmt(n){ const v=Number(n||0); return (v>0?'+':'') + v.toLocaleString('en-US'); }
function fmtDateTime(iso){ const d=new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function isToday(iso){ const d=new Date(iso), t=new Date(); return d.toDateString()===t.toDateString(); }
function extractYTId(u){
  try{
    if(!u) return u;
    if(!u.includes('http')) return u;
    const url=new URL(u);
    if(url.searchParams.get('v')) return url.searchParams.get('v');
    const path=url.pathname.split('/').filter(Boolean).pop();
    return path||u;
  }catch(e){ return u; }
}

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
    try{ const er=await apiFetch('/coin-earn'); EARN=er; }catch(_){ EARN=JSON.parse(JSON.stringify(DEMO_EARN)); }
    try{ const bl=await apiFetch('/coin-bundles'); BUNDLES=bl; }catch(_){ BUNDLES=JSON.parse(JSON.stringify(DEMO_BUNDLES)); }
  }catch(e){
    PACKAGES = JSON.parse(JSON.stringify(DEMO_PACKAGES));
    GIFTS = JSON.parse(JSON.stringify(DEMO_GIFTS));
    SUBSCRIPTIONS = JSON.parse(JSON.stringify(DEMO_SUBSCRIPTIONS));
    HISTORY = JSON.parse(JSON.stringify(DEMO_HISTORY));
    EARN = JSON.parse(JSON.stringify(DEMO_EARN));
    BUNDLES = JSON.parse(JSON.stringify(DEMO_BUNDLES));
    try{ const storedP=JSON.parse(localStorage.getItem('dro_finance_packs')||'null'); if(Array.isArray(storedP)&&storedP.length){ /* keep PACKAGES as demo, but store packs already there */ } }catch(_){}
    try{ const storedR=JSON.parse(localStorage.getItem('dro_finance_rewards')||'null'); if(Array.isArray(storedR)&&storedR.length) EARN = storedR.map(r=>Object.assign({status:r.available?'active':'inactive', createdAt:new Date().toISOString().slice(0,10)}, r)); }catch(_){}
    try{ const storedB=JSON.parse(localStorage.getItem('dro_finance_bundles')||'null'); if(Array.isArray(storedB)&&storedB.length) BUNDLES = storedB.map(b=>Object.assign({status:'active', createdAt:new Date().toISOString().slice(0,10)}, b)); }catch(_){}
    usingDemoConfig = true;
  }
  syncPacksToStore(); syncEarnToStore(); syncBundlesToStore();
}
function logHistory(action, itemType, itemName, details){
  const entry = { id:'CFG-'+String(HISTORY.length+1).padStart(3,'0'), action, itemType, itemName, actor:'Ngozi Falade', date:new Date().toISOString(), details };
  HISTORY.unshift(entry);
  if(!usingDemoConfig) apiFetch('/coin-config-history', { method:'POST', body: JSON.stringify(entry) }).catch(()=>{});
}
function syncPacksToStore(){
  try{
    const storePacks = PACKAGES.filter(p=>p.status==='active').map(p=>({ id:p.id, coins:p.coins, price:'$'+Number(p.priceUsd).toFixed(2), badge:p.bonusPercent?'+'+p.bonusPercent+'% bonus':'', color: p.coins>=5000?'#D6165A':p.coins>=1000?'#FF2D6A':'#635F6E' }));
    if(storePacks.length) localStorage.setItem('dro_finance_packs', JSON.stringify(storePacks));
  }catch(e){}
}
function syncEarnToStore(){
  try{
    const storeRewards = EARN.map(r=>({ id:r.id, action:r.action, coins:r.coins, cooldown:r.cooldown, icon:r.icon, available:r.available!==false && r.status==='active' }));
    localStorage.setItem('dro_finance_rewards', JSON.stringify(storeRewards));
  }catch(e){}
}
function syncBundlesToStore(){
  try{
    const storeBundles = BUNDLES.filter(b=>b.status==='active').map(b=>({ id:b.id, name:b.name, coins:b.coins, bonus:b.bonus, price:b.price, icon:b.icon, color:b.color }));
    if(storeBundles.length) localStorage.setItem('dro_finance_bundles', JSON.stringify(storeBundles));
    else localStorage.setItem('dro_finance_bundles', JSON.stringify(BUNDLES.map(b=>({ id:b.id, name:b.name, coins:b.coins, bonus:b.bonus, price:b.price, icon:b.icon, color:b.color }))));
  }catch(e){}
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
  document.getElementById('pricingCount').textContent = PACKAGES.length + GIFTS.length + SUBSCRIPTIONS.length + EARN.length + BUNDLES.length;

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

  /* ── Bundles ── */
  const bundleTotalPages = Math.max(1, Math.ceil(BUNDLES.length / PKG_PER_PAGE));
  if(bundlePage>bundleTotalPages) bundlePage = bundleTotalPages;
  const bundlePageItems = BUNDLES.slice((bundlePage-1)*PKG_PER_PAGE, bundlePage*PKG_PER_PAGE);
  document.getElementById('bundleList').innerHTML = bundlePageItems.length ? bundlePageItems.map(b=>`
    <div class="pkg-card" data-id="${b.id}">
      <div class="pkg-top"><span class="pkg-name">${b.name}</span><span class="status-pill ${b.status}">${b.status}</span></div>
      <div class="pkg-coins"><i class="fas ${b.icon}" style="font-size:15px"></i>${b.coins.toLocaleString()} <span style="font-size:11px;color:var(--green)">+${b.bonus} bonus</span></div>
      <div class="pkg-price">${b.price}</div>
      <div class="pkg-meta"><i class="fas fa-calendar"></i> Created ${fmtDate(b.createdAt)} · <span style="color:${b.color}">${b.color}</span></div>
      <div class="pkg-actions">
        <button class="mini-btn" data-action="bundle-toggle" data-id="${b.id}"><i class="fas fa-power-off"></i> ${b.status==='active'?'Deactivate':'Activate'}</button>
        <button class="mini-btn" data-action="bundle-edit" data-id="${b.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="mini-btn danger" data-action="bundle-delete" data-id="${b.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-box-open"></i><p>No bundles yet.</p></div>`;
  renderMiniPagination('bundlePagination', bundleTotalPages, bundlePage, (p)=>{ bundlePage=p; renderPricing(); });

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

  /* ── Earn Rewards ── */
  const earnTotalPages = Math.max(1, Math.ceil(EARN.length / PKG_PER_PAGE));
  if(earnPage>earnTotalPages) earnPage = earnTotalPages;
  const earnPageItems = EARN.slice((earnPage-1)*PKG_PER_PAGE, earnPage*PKG_PER_PAGE);
  document.getElementById('earnList').innerHTML = earnPageItems.length ? earnPageItems.map(r=>`
    <div class="pkg-card" data-id="${r.id}">
      <div class="pkg-top"><span class="pkg-name">${r.action}</span><span class="status-pill ${r.status}">${r.status}</span></div>
      <div class="pkg-coins" style="color:var(--green)"><i class="fas ${r.icon}" style="font-size:15px"></i> +${r.coins} coins</div>
      <div class="pkg-price">Every ${r.cooldown} · <i class="fas ${r.icon}"></i> ${r.icon}</div>
      <div class="pkg-meta"><i class="fas fa-calendar"></i> Created ${fmtDate(r.createdAt)} · ${r.available?'Available':'Disabled'}</div>
      <div class="pkg-actions">
        <button class="mini-btn" data-action="earn-toggle" data-id="${r.id}"><i class="fas fa-power-off"></i> ${r.status==='active'?'Deactivate':'Activate'}</button>
        <button class="mini-btn" data-action="earn-edit" data-id="${r.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="mini-btn danger" data-action="earn-delete" data-id="${r.id}"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-film"></i><p>No earn rewards yet.</p></div>`;
  renderMiniPagination('earnPagination', earnTotalPages, earnPage, (p)=>{ earnPage=p; renderPricing(); });
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
  const isEarn=kind==='earn';
  const isBundle=kind==='bundle';
  document.getElementById('nameLabel').parentElement.style.display = isEarn?'none':'block';
  if(!isEarn){
    if(isBundle){ document.getElementById('nameLabel').textContent='Bundle Name'; document.getElementById('itemName').placeholder='e.g. Starter Bundle'; }
    else { document.getElementById('nameLabel').textContent = kind==='package' ? 'Package Name' : kind==='gift' ? 'Gift Name' : 'Subscription Name'; document.getElementById('itemName').placeholder = kind==='package' ? 'e.g. Reader Bundle' : kind==='gift' ? 'e.g. Rose' : 'e.g. Premium Monthly'; }
  }
  document.getElementById('packageFields').style.display = kind==='package' ? 'flex' : 'none';
  document.getElementById('packageFields').style.flexDirection = 'column';
  document.getElementById('packageFields').style.gap = '12px';
  document.getElementById('bundleFields').style.display = kind==='bundle' ? 'flex' : 'none';
  document.getElementById('bundleFields').style.flexDirection = 'column';
  document.getElementById('bundleFields').style.gap = '12px';
  document.getElementById('giftFields').style.display = kind==='gift' ? 'block' : 'none';
  document.getElementById('subFields').style.display = kind==='subscription' ? 'flex' : 'none';
  document.getElementById('subFields').style.flexDirection = 'column';
  document.getElementById('subFields').style.gap = '12px';
  document.getElementById('earnFields').style.display = kind==='earn' ? 'block' : 'none';
}

function openCreateModal(kind){
  editingItemId = null;
  document.getElementById('formModalTitle').textContent = kind==='earn' ? 'New Earn Reward' : kind==='bundle' ? 'New Bundle' : kind==='gift' ? 'New Gift Item' : kind==='subscription' ? 'New Subscription' : 'New Coin Package';
  document.getElementById('formModalSub').textContent = kind==='earn' ? 'Set up a watch-to-earn reward for the Store.' : kind==='bundle' ? 'Set up a coin bundle with bonus for the Store.' : 'Set up a coin package, giftable item, or reader subscription.';
  document.getElementById('itemName').value = '';
  document.getElementById('pkgCoins').value = '';
  document.getElementById('pkgPrice').value = '';
  document.getElementById('pkgBonus').value = '';
  document.getElementById('bundleCoins').value = '';
  document.getElementById('bundleBonus').value = '';
  document.getElementById('bundlePrice').value = '';
  document.getElementById('bundleIcon').value = '';
  document.getElementById('bundleColor').value = '#22c55e';
  document.getElementById('giftIcon').value = '';
  document.getElementById('giftCost').value = '';
  document.getElementById('subPrice').value = '';
  document.getElementById('subDuration').value = '';
  document.getElementById('subCoinsPerDay').value = '';
  document.getElementById('subBonus').value = '';
  document.getElementById('earnAction').value = '';
  document.getElementById('earnType').value = 'watch_ad';
  document.getElementById('earnCoins').value = '';
  document.getElementById('earnCooldown').value = '';
  document.getElementById('earnIcon').value = '';
  document.getElementById('earnAvailable').value = 'true';
  document.getElementById('earnBlogUrl').value = 'Pages/blog.html?cat=tech';
  document.getElementById('earnPages').value = '3';
  document.getElementById('earnBlogCat').value = 'tech';
  document.getElementById('earnChannelId').value = '';
  document.getElementById('earnVideoId').value = '';
  document.getElementById('earnWatchSec').value = '60';
  document.getElementById('itemStatus').value = 'active';
  document.getElementById('formModalError').classList.remove('show');
  setFormKind(kind || 'package', false);
  updateEarnExtras();
  document.getElementById('formConfirmBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save';
  document.getElementById('formModalOv').classList.add('open');
}

function openEditModal(kind, id){
  const list = kind==='package' ? PACKAGES : kind==='bundle' ? BUNDLES : kind==='gift' ? GIFTS : kind==='earn' ? EARN : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  editingItemId = id;
  document.getElementById('formModalTitle').textContent = kind==='earn' ? 'Edit Earn Reward' : kind==='bundle' ? 'Edit Bundle' : kind==='gift' ? 'Edit Gift Item' : kind==='subscription' ? 'Edit Subscription' : 'Edit Coin Package';
  document.getElementById('formModalSub').textContent = 'Update the details below and save your changes.';
  document.getElementById('itemName').value = item.name || item.action || '';
  if(kind==='package'){
    document.getElementById('pkgCoins').value = item.coins;
    document.getElementById('pkgPrice').value = item.priceUsd;
    document.getElementById('pkgBonus').value = item.bonusPercent || '';
  }else if(kind==='bundle'){
    document.getElementById('bundleCoins').value = item.coins;
    document.getElementById('bundleBonus').value = item.bonus || '';
    document.getElementById('bundlePrice').value = item.price;
    document.getElementById('bundleIcon').value = item.icon;
    document.getElementById('bundleColor').value = item.color || '#22c55e';
  }else if(kind==='gift'){
    document.getElementById('giftIcon').value = item.icon;
    document.getElementById('giftCost').value = item.costCoins;
  }else if(kind==='earn'){
    document.getElementById('earnAction').value = item.action;
    document.getElementById('earnType').value = item.type || 'watch_ad';
    document.getElementById('earnCoins').value = item.coins;
    document.getElementById('earnCooldown').value = item.cooldown;
    document.getElementById('earnIcon').value = item.icon;
    document.getElementById('earnAvailable').value = String(item.available!==false && item.status==='active');
    document.getElementById('earnBlogUrl').value = item.blogUrl || 'Pages/blog.html?cat=tech';
    document.getElementById('earnPages').value = item.pagesRequired || 3;
    document.getElementById('earnBlogCat').value = item.blogCategory || 'tech';
    document.getElementById('earnChannelId').value = item.channelId || item.channelUrl || '';
    document.getElementById('earnVideoId').value = item.videoId || '';
    document.getElementById('earnWatchSec').value = item.minWatchSec || 60;
  }else{
    document.getElementById('subPrice').value = item.priceUsd;
    document.getElementById('subDuration').value = item.durationDays;
    document.getElementById('subCoinsPerDay').value = item.coinsPerDay;
    document.getElementById('subBonus').value = item.bonusPercent || '';
  }
  document.getElementById('itemStatus').value = item.status;
  document.getElementById('formModalError').classList.remove('show');
  setFormKind(kind, true);
  if(kind==='earn') updateEarnExtras();
  document.getElementById('formConfirmBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
  document.getElementById('formModalOv').classList.add('open');
}

function closeFormModal(){ document.getElementById('formModalOv').classList.remove('open'); editingItemId = null; }

function updateEarnExtras(){
  const t=document.getElementById('earnType').value;
  document.getElementById('earnExtraBlog').style.display = t==='blog_read' ? 'block':'none';
  document.getElementById('earnExtraYTSub').style.display = t==='youtube_sub' ? 'block':'none';
  document.getElementById('earnExtraYTWatch').style.display = t==='youtube_watch' ? 'block':'none';
}

document.querySelectorAll('#kindRow .radio-opt').forEach(el=>{
  el.addEventListener('click', ()=>{ if(!editingItemId) setFormKind(el.dataset.kind, false); });
});
document.getElementById('earnType').addEventListener('change', updateEarnExtras);

async function submitForm(){
  const name = document.getElementById('itemName').value.trim();
  const status = document.getElementById('itemStatus').value;
  const errBox = document.getElementById('formModalError');
  if(formKind!=='earn' && !name){ errBox.textContent='Please enter a name.'; errBox.classList.add('show'); return; }

  let payload;
  if(formKind==='package'){
    const coins = parseInt(document.getElementById('pkgCoins').value,10) || 0;
    const priceUsd = parseFloat(document.getElementById('pkgPrice').value) || 0;
    const bonusPercent = parseInt(document.getElementById('pkgBonus').value,10) || 0;
    if(coins<=0){ errBox.textContent='Please enter a coin amount.'; errBox.classList.add('show'); return; }
    if(priceUsd<=0){ errBox.textContent='Please enter a price.'; errBox.classList.add('show'); return; }
    payload = { name, coins, priceUsd, bonusPercent, status };
  }else if(formKind==='bundle'){
    const coins = parseInt(document.getElementById('bundleCoins').value,10) || 0;
    const bonus = parseInt(document.getElementById('bundleBonus').value,10) || 0;
    const price = document.getElementById('bundlePrice').value.trim();
    const icon = document.getElementById('bundleIcon').value.trim() || 'fa-box-open';
    const color = document.getElementById('bundleColor').value || '#22c55e';
    if(coins<=0){ errBox.textContent='Please enter coins.'; errBox.classList.add('show'); return; }
    if(!price){ errBox.textContent='Please enter price.'; errBox.classList.add('show'); return; }
    payload = { name, coins, bonus, price, icon, color, status };
  }else if(formKind==='gift'){
    const icon = document.getElementById('giftIcon').value.trim() || '🎁';
    const costCoins = parseInt(document.getElementById('giftCost').value,10) || 0;
    if(costCoins<=0){ errBox.textContent='Please enter a coin cost.'; errBox.classList.add('show'); return; }
    payload = { name, icon, costCoins, status };
  }else if(formKind==='earn'){
    const action = document.getElementById('earnAction').value.trim();
    const type = document.getElementById('earnType').value;
    const coins = parseInt(document.getElementById('earnCoins').value,10) || 0;
    const cooldown = document.getElementById('earnCooldown').value.trim() || '—';
    const icon = document.getElementById('earnIcon').value.trim() || 'fa-film';
    const available = document.getElementById('earnAvailable').value==='true';
    if(!action){ errBox.textContent='Please enter action label.'; errBox.classList.add('show'); return; }
    if(coins<=0){ errBox.textContent='Please enter coins.'; errBox.classList.add('show'); return; }
    payload = { action, type, coins, cooldown, icon, available, status: available?'active':'inactive' };
    if(type==='blog_read'){
      payload.blogUrl = document.getElementById('earnBlogUrl').value.trim() || 'Pages/blog.html?cat=tech';
      payload.pagesRequired = parseInt(document.getElementById('earnPages').value,10) || 3;
      payload.blogCategory = document.getElementById('earnBlogCat').value.trim() || 'tech';
    } else if(type==='youtube_sub'){
      const ch=document.getElementById('earnChannelId').value.trim();
      if(!ch){ errBox.textContent='Channel ID required.'; errBox.classList.add('show'); return; }
      payload.channelId = ch; payload.channelUrl = ch;
    } else if(type==='youtube_watch'){
      const vid=document.getElementById('earnVideoId').value.trim();
      if(!vid){ errBox.textContent='Video ID required.'; errBox.classList.add('show'); return; }
      payload.videoId = vid.includes('youtube.com') || vid.includes('youtu.be') ? extractYTId(vid) : vid;
      payload.minWatchSec = parseInt(document.getElementById('earnWatchSec').value,10) || 60;
    }
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
    const list = formKind==='package' ? PACKAGES : formKind==='bundle' ? BUNDLES : formKind==='gift' ? GIFTS : formKind==='earn' ? EARN : SUBSCRIPTIONS;
    const endpoint = formKind==='package' ? '/coin-packages' : formKind==='bundle' ? '/coin-bundles' : formKind==='gift' ? '/coin-gifts' : formKind==='earn' ? '/coin-earn' : '/coin-subscriptions';
    if(editingItemId){
      const item = list.find(x=>x.id===editingItemId);
      try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+editingItemId, { method:'PUT', body: JSON.stringify(payload) }); }catch(_){}
      Object.assign(item, payload);
      if(formKind==='earn'){ item.status = payload.available?'active':'inactive'; }
      const dName = formKind==='earn' ? payload.action : name;
      const details = formKind==='package' ? `${payload.coins.toLocaleString()} coins for ${money(payload.priceUsd)}` : formKind==='bundle' ? `${payload.coins} +${payload.bonus} bonus for ${payload.price}` : formKind==='gift' ? `${payload.costCoins.toLocaleString()} coins per gift` : formKind==='earn' ? `${payload.coins} coins / ${payload.cooldown}` : `${payload.coinsPerDay}/day for ${money(payload.priceUsd)}/${payload.durationDays}d`;
      logHistory('updated', formKind, dName, details);
      toast(`✏️ "${dName}" updated`);
    }else{
      let created = null;
      try{ if(!usingDemoConfig) created = await apiFetch(endpoint, { method:'POST', body: JSON.stringify(payload) }); }catch(_){}
      if(!created){
        const prefix = formKind==='package' ? 'PKG-' : formKind==='bundle' ? 'BND-' : formKind==='gift' ? 'GFT-' : formKind==='earn' ? 'ad' : 'SUB-';
        const baseId = formKind==='earn' ? 'ad'+String(list.length+1) : prefix+String(list.length+1).padStart(2,'0');
        created = Object.assign({ id: baseId, createdAt: new Date().toISOString().slice(0,10), status: payload.status||'active' }, payload);
      }
      list.unshift(created);
      const dName2 = formKind==='earn' ? payload.action : name;
      const details = formKind==='package' ? `${payload.coins.toLocaleString()} coins for ${money(payload.priceUsd)}` : formKind==='bundle' ? `${payload.coins} +${payload.bonus} bonus for ${payload.price}` : formKind==='gift' ? `${payload.costCoins.toLocaleString()} coins per gift` : formKind==='earn' ? `${payload.coins} coins / ${payload.cooldown}` : `${payload.coinsPerDay}/day for ${money(payload.priceUsd)}/${payload.durationDays}d`;
      logHistory('created', formKind, dName2, details);
      toast(`✅ "${dName2}" created`);
    }
    if(formKind==='package') syncPacksToStore();
    if(formKind==='bundle') syncBundlesToStore();
    if(formKind==='earn') syncEarnToStore();
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
  const list = kind==='package' ? PACKAGES : kind==='bundle' ? BUNDLES : kind==='gift' ? GIFTS : kind==='earn' ? EARN : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  const newStatus = item.status==='active' ? 'inactive' : 'active';
  const endpoint = kind==='package' ? '/coin-packages' : kind==='bundle' ? '/coin-bundles' : kind==='gift' ? '/coin-gifts' : kind==='earn' ? '/coin-earn' : '/coin-subscriptions';
  try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+id, { method:'PUT', body: JSON.stringify({ status:newStatus }) }); }catch(_){}
  item.status = newStatus;
  if(kind==='earn') item.available = newStatus==='active';
  const dispName = kind==='earn' ? item.action : item.name;
  logHistory(newStatus==='active'?'activated':'deactivated', kind, dispName, newStatus==='active' ? 'Re-enabled for purchase/use' : 'Temporarily disabled');
  toast(`${newStatus==='active'?'✅':'⏸️'} "${dispName}" ${newStatus}`);
  if(kind==='package') syncPacksToStore();
  if(kind==='bundle') syncBundlesToStore();
  if(kind==='earn') syncEarnToStore();
  renderPricing(); renderHistFilterPills(); renderHistory();
}

/* ── Delete confirm modal ── */
let delTarget = null;
function openDelModal(kind, id){
  const list = kind==='package' ? PACKAGES : kind==='bundle' ? BUNDLES : kind==='gift' ? GIFTS : kind==='earn' ? EARN : SUBSCRIPTIONS;
  const item = list.find(x=>x.id===id); if(!item) return;
  const dispName = kind==='earn' ? item.action : item.name;
  delTarget = { kind, id, name:dispName };
  document.getElementById('delModalSub').textContent = `Delete "${dispName}"? This can't be undone.`;
  document.getElementById('delModalOv').classList.add('open');
}
function closeDelModal(){ document.getElementById('delModalOv').classList.remove('open'); delTarget = null; }
async function submitDel(){
  if(!delTarget) return;
  const { kind, id, name } = delTarget;
  const endpoint = kind==='package' ? '/coin-packages' : kind==='bundle' ? '/coin-bundles' : kind==='gift' ? '/coin-gifts' : kind==='earn' ? '/coin-earn' : '/coin-subscriptions';
  try{ if(!usingDemoConfig) await apiFetch(endpoint+'/'+id, { method:'DELETE' }); }catch(_){}
  if(kind==='package') PACKAGES = PACKAGES.filter(x=>x.id!==id);
  else if(kind==='bundle') BUNDLES = BUNDLES.filter(x=>x.id!==id);
  else if(kind==='gift') GIFTS = GIFTS.filter(x=>x.id!==id);
  else if(kind==='earn') EARN = EARN.filter(x=>x.id!==id);
  else SUBSCRIPTIONS = SUBSCRIPTIONS.filter(x=>x.id!==id);
  logHistory('deleted', kind, name, 'Removed from catalog');
  toast(`🗑️ "${name}" deleted`);
  closeDelModal();
  if(kind==='package') syncPacksToStore();
  if(kind==='bundle') syncBundlesToStore();
  if(kind==='earn') syncEarnToStore();
  renderPricing(); renderHistFilterPills(); renderHistory();
}

/* ── History tab ── */
function renderHistFilterPills(){
  document.getElementById('historyCount').textContent = HISTORY.length;
  const counts = { all:HISTORY.length, package:0, bundle:0, gift:0, subscription:0, earn:0 };
  HISTORY.forEach(h=>{ if(counts[h.itemType]!=null) counts[h.itemType]++; });
  const pills = [ {key:'all',label:'All'}, {key:'package',label:'Packages'}, {key:'bundle',label:'Bundles'}, {key:'gift',label:'Gifts'}, {key:'subscription',label:'Subscriptions'}, {key:'earn',label:'Earn'} ];
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
document.getElementById('addBundleBtn').addEventListener('click', ()=>openCreateModal('bundle'));
document.getElementById('addGiftBtn').addEventListener('click', ()=>openCreateModal('gift'));
document.getElementById('addSubBtn').addEventListener('click', ()=>openCreateModal('subscription'));
document.getElementById('addEarnBtn').addEventListener('click', ()=>openCreateModal('earn'));

/* ── Event delegation ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action, id = el.dataset.id;

  if(action==='pkg-edit') openEditModal('package', id);
  else if(action==='bundle-edit') openEditModal('bundle', id);
  else if(action==='gift-edit') openEditModal('gift', id);
  else if(action==='earn-edit') openEditModal('earn', id);
  else if(action==='sub-edit') openEditModal('subscription', id);
  else if(action==='pkg-delete') openDelModal('package', id);
  else if(action==='bundle-delete') openDelModal('bundle', id);
  else if(action==='gift-delete') openDelModal('gift', id);
  else if(action==='earn-delete') openDelModal('earn', id);
  else if(action==='sub-delete') openDelModal('subscription', id);
  else if(action==='pkg-toggle') toggleStatus('package', id);
  else if(action==='bundle-toggle') toggleStatus('bundle', id);
  else if(action==='gift-toggle') toggleStatus('gift', id);
  else if(action==='earn-toggle') toggleStatus('earn', id);
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
