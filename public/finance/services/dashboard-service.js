/**
 * dashboard-service.js — Logic for finance dashboard page
 * ──────────────────────────────────────────────────────────────
 * All rendering. Reads from FinanceData; renders into #dashRoot elements.
 */
(function(){
'use strict';

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

let DATA = null;

function greetByHour(){
  const h = new Date().getHours();
  if(h<12) return 'Good morning, Ngozi 👋';
  if(h<18) return 'Good afternoon, Ngozi 👋';
  return 'Good evening, Ngozi 👋';
}

async function init(){
  document.getElementById('greetTitle').textContent = greetByHour();
  DATA = await FinanceData.getDashboard();
  renderAll();
}

function renderAll(){
  renderWelcomeStats();
  renderStatCards();
  renderPayouts();
  renderQuickActions();
  renderCoinSnapshot();
  renderDisputesSnapshot();
  renderActivity();
}

function renderWelcomeStats(){
  document.getElementById('welcomeStats').innerHTML = `
    <div class="welcome-stat"><b>${DATA.pendingPayoutsTotal}</b><span>Pending Payouts</span></div>
    <div class="welcome-stat"><b>${DATA.totalVolumeMonth}</b><span>Total Volume (Month)</span></div>
    <div class="welcome-stat"><b>${DATA.coinBalance}</b><span>Coin Balance</span></div>
    <div class="welcome-stat"><b>${DATA.openDisputes}</b><span>Open Disputes</span></div>`;
}

function renderStatCards(){
  const stats = [
    { n:DATA.pendingPayoutsCount, l:'Pending Payouts', ico:'fa-building-columns', cls:'blue' },
    { n:DATA.totalVolumeMonth, l:'Total Volume (Month)', ico:'fa-chart-line', cls:'accent' },
    { n:DATA.coinBalance, l:'Coin Balance', ico:'fa-coins', cls:'amber' },
    { n:DATA.openDisputes, l:'Open Disputes', ico:'fa-scale-balanced', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ── Pending Payouts ── */
function renderPayouts(){
  document.getElementById('poCount').textContent = DATA.pendingPayouts.length;
  const box = document.getElementById('payoutsList');
  if(!DATA.pendingPayouts.length){ box.innerHTML = `<div class="empty-msg">No payouts waiting on approval.</div>`; return; }
  box.innerHTML = DATA.pendingPayouts.map(p=>`
    <div class="po-card" data-id="${p.id}">
      <img class="po-avatar" src="${p.avatar}" alt="${p.author}"/>
      <div class="po-body">
        <div class="po-title">${p.author} <span class="po-amt">${p.amount}</span> <span class="method-chip">${p.method}</span></div>
        <div class="po-meta">Requested ${p.requested}</div>
      </div>
      <div class="po-actions">
        <button class="mini-btn danger" data-action="decline-payout" data-id="${p.id}"><i class="fas fa-xmark"></i> Decline</button>
        <button class="mini-btn primary" data-action="approve-payout" data-id="${p.id}"><i class="fas fa-check"></i> Approve</button>
      </div>
    </div>`).join('');
}

function approvePayout(id){
  const p = DATA.pendingPayouts.find(x=>x.id===id); if(!p) return;
  DATA.pendingPayouts = DATA.pendingPayouts.filter(x=>x.id!==id);
  toast(`✅ Approved ${p.amount} payout for ${p.author}`);
  renderPayouts(); renderStatCards(); renderWelcomeStats();
}
function declinePayout(id){
  const p = DATA.pendingPayouts.find(x=>x.id===id); if(!p) return;
  DATA.pendingPayouts = DATA.pendingPayouts.filter(x=>x.id!==id);
  toast(`↩️ Declined payout for ${p.author}`);
  renderPayouts(); renderStatCards(); renderWelcomeStats();
}

/* ── Quick Actions ── */
function renderQuickActions(){
  document.getElementById('qaGrid').innerHTML = DATA.quickActions.map(qa=>`
    <div class="qa-card" data-href="${qa.href||'#'}">
      <div class="qa-ico" style="background:${BG_MAP[qa.cls]};color:${ICO_MAP[qa.cls]}"><i class="fas ${qa.icon}"></i></div>
      <div class="qa-txt"><b>${qa.label}</b><span>${qa.count?qa.count+' waiting':'Ready when you are'}</span></div>
      ${qa.count?`<span class="qa-count">${qa.count}</span>`:''}
    </div>`).join('');
  document.querySelectorAll('.qa-card').forEach(c=>{
    c.addEventListener('click', ()=>{
      const href = c.dataset.href;
      if(href && href!=='#') location.href = href; else toast('Opening…');
    });
  });
}

/* ── Coin Transactions snapshot ── */
function renderCoinSnapshot(){
  const c = DATA.coinSnapshot;
  document.getElementById('coinSnapshot').innerHTML = `
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--amber-bg);color:var(--amber)"><i class="fas fa-coins"></i></div>
      <div class="mini-body"><div class="mini-lbl">Purchased today</div></div><div class="mini-val">${c.purchasedToday}</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--blue-bg);color:var(--blue)"><i class="fas fa-circle-nodes"></i></div>
      <div class="mini-body"><div class="mini-lbl">Coins in circulation</div></div><div class="mini-val">${c.coinsInCirculation}</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--purple-bg);color:var(--purple)"><i class="fas fa-arrow-right-arrow-left"></i></div>
      <div class="mini-body"><div class="mini-lbl">Redeemed today</div></div><div class="mini-val">${c.redeemedToday}</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--green-bg);color:var(--green)"><i class="fas fa-cart-shopping"></i></div>
      <div class="mini-body"><div class="mini-lbl">Avg. purchase size</div></div><div class="mini-val">${c.avgPurchase}</div></div>`;
}

/* ── Disputes snapshot ── */
function renderDisputesSnapshot(){
  const d = DATA.disputesSnapshot;
  document.getElementById('disputesSnapshot').innerHTML = `
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--red-bg);color:var(--red)"><i class="fas fa-triangle-exclamation"></i></div>
      <div class="mini-body"><div class="mini-lbl">Open cases</div></div><div class="mini-val">${d.open}</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--amber-bg);color:var(--amber)"><i class="fas fa-fire"></i></div>
      <div class="mini-body"><div class="mini-lbl">Marked urgent</div></div><div class="mini-val">${d.urgent}</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--blue-bg);color:var(--blue)"><i class="fas fa-hourglass-half"></i></div>
      <div class="mini-body"><div class="mini-lbl">Avg resolution time</div></div><div class="mini-val">${d.avgResolutionDays}d</div></div>
    <div class="mini-stat-row"><div class="mini-ico" style="background:var(--green-bg);color:var(--green)"><i class="fas fa-circle-check"></i></div>
      <div class="mini-body"><div class="mini-lbl">Resolved this week</div></div><div class="mini-val">${d.resolvedThisWeek}</div></div>`;
}

/* ── Activity feed ── */
function renderActivity(){
  document.getElementById('activityList').innerHTML = DATA.recentActivity.map(a=>`
    <div class="act-row">
      <div class="act-dot" style="background:${BG_MAP[a.color]||'var(--table-head)'};color:${ICO_MAP[a.color]||'var(--text-faint)'}"><i class="fas ${a.icon}"></i></div>
      <div class="act-body">
        <div class="act-text">${a.text}</div>
        <div class="act-time">${a.time}</div>
      </div>
    </div>`).join('');
}

/* ── Event delegation ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  if(action==='approve-payout') approvePayout(id);
  else if(action==='decline-payout') declinePayout(id);
});

init();
})();
