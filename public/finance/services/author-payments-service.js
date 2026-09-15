/**
 * author-payments-service.js — Logic for author payments page
 * ──────────────────────────────────────────────────────────────
 * All rendering, filtering, pagination, tabs, schedule/pay modals.
 * Reads from FinanceData; renders into #pageRoot elements.
 */
(function(){
'use strict';

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const PAGE_SIZE = 6;

let AUTHORS = [];
let HISTORY = [];
let searchTerm = '', statusTerm = '', sortMode = 'pending-desc';
let authorPage = 1, historyPage = 1;

function money(n){ return '$' + Number(n||0).toLocaleString('en-US'); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function fmtDateTime(iso){ const d=new Date(iso); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }

async function init(){
  [AUTHORS, HISTORY] = await Promise.all([FinanceData.getAuthorPayments(), FinanceData.getPaymentHistory()]);
  renderStatCards();
  renderAuthors();
  renderHistory();
}

function renderStatCards(){
  const totalPending = AUTHORS.reduce((s,a)=>s+a.pendingPayout,0);
  const totalEarned = AUTHORS.reduce((s,a)=>s+a.totalEarned,0);
  const onHold = AUTHORS.filter(a=>a.status==='on-hold').length;
  const stats = [
    { n:money(totalPending), l:'Pending Payouts', ico:'fa-hourglass-half', cls:'amber' },
    { n:money(totalEarned), l:'Total Earned (All-Time)', ico:'fa-sack-dollar', cls:'accent' },
    { n:AUTHORS.length, l:'Authors on Payroll', ico:'fa-user-tie', cls:'blue' },
    { n:onHold, l:'Payments On Hold', ico:'fa-circle-pause', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function getFilteredAuthors(){
  let list = AUTHORS.slice();
  if(statusTerm) list = list.filter(a=>a.status===statusTerm);
  if(searchTerm) list = list.filter(a=>a.author.toLowerCase().includes(searchTerm.toLowerCase()));
  if(sortMode==='pending-desc') list.sort((a,b)=>b.pendingPayout-a.pendingPayout);
  else if(sortMode==='earned-desc') list.sort((a,b)=>b.totalEarned-a.totalEarned);
  else list.sort((a,b)=>a.author.localeCompare(b.author));
  return list;
}

function renderAuthors(){
  const list = getFilteredAuthors();
  const box = document.getElementById('authorList');
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if(authorPage > totalPages) authorPage = totalPages;
  const start = (authorPage - 1) * PAGE_SIZE;
  const pg = list.slice(start, start + PAGE_SIZE);

  if(!list.length){ box.innerHTML = `<div class="empty-state"><i class="fas fa-user-tie"></i><p>No authors match your filters.</p></div>`; document.getElementById('authorFooter').innerHTML=''; return; }

  box.innerHTML = `<div class="au-list">${pg.map(a=>`
    <div class="au-card" data-id="${a.id}">
      <img class="au-avatar" src="${a.avatar}" alt="${a.author}"/>
      <div class="au-body">
        <div class="au-top">
          <span class="au-name">${a.author}</span>
          <span class="status-pill ${a.status}">${a.status==='on-hold'?'On Hold':'Active'}</span>
          <span class="method-chip">${a.method}</span>
        </div>
        <div class="au-meta">
          <span><i class="fas fa-clock-rotate-left"></i> Last payout ${a.lastPayout ? money(a.lastAmount)+' on '+fmtDate(a.lastPayout) : 'None yet'}</span>
          ${a.nextScheduled ? `<span><i class="fas fa-calendar"></i> Next scheduled ${fmtDate(a.nextScheduled)}</span>` : ''}
        </div>
        ${a.status==='on-hold' ? `<div class="hold-note"><i class="fas fa-circle-info"></i> ${a.holdReason||'Payments on hold.'}</div>` : ''}
      </div>
      <div class="au-figures">
        <div class="au-fig"><b>${money(a.pendingPayout)}</b><span>Pending</span></div>
        <div class="au-fig"><b>${money(a.totalEarned)}</b><span>Total Earned</span></div>
      </div>
      <div class="au-actions">
        <button class="mini-btn" data-action="schedule" data-id="${a.id}"><i class="fas fa-calendar-plus"></i> Schedule</button>
        <button class="mini-btn primary" data-action="pay" data-id="${a.id}" ${a.pendingPayout<=0 || a.status==='on-hold' ? 'disabled':''}><i class="fas fa-paper-plane"></i> Pay Now</button>
      </div>
    </div>`).join('')}</div>`;

  renderAuthorFooter(totalPages, list.length);
}

function renderAuthorFooter(totalPages, total){
  const start = total === 0 ? 0 : (authorPage-1)*PAGE_SIZE+1;
  const end = Math.min(authorPage*PAGE_SIZE, total);
  let html = `<div class="list-footer-info">Showing ${start}–${end} of ${total} authors</div>`;
  html += `<div class="pager">`;
  html += `<button ${authorPage===1?'disabled':''} data-ap="prev"><i class="fas fa-chevron-left"></i></button>`;
  const pages = new Set([1, totalPages, authorPage, authorPage-1, authorPage+1]);
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pages.has(p)) continue;
    if(p - last > 1) html += `<span class="pager-gap">…</span>`;
    html += `<button data-ap="${p}" class="${p===authorPage?'active':''}">${p}</button>`;
    last = p;
  }
  html += `<button ${authorPage===totalPages?'disabled':''} data-ap="next"><i class="fas fa-chevron-right"></i></button>`;
  html += `</div>`;
  document.getElementById('authorFooter').innerHTML = html;
}

document.getElementById('authorFooter').addEventListener('click', e=>{
  const btn = e.target.closest('[data-ap]');
  if(!btn) return;
  const p = btn.dataset.ap;
  const totalPages = Math.max(1, Math.ceil(getFilteredAuthors().length / PAGE_SIZE));
  if(p==='prev') authorPage = Math.max(1, authorPage-1);
  else if(p==='next') authorPage = Math.min(totalPages, authorPage+1);
  else authorPage = parseInt(p,10);
  renderAuthors();
});

function renderHistory(){
  const rows = HISTORY.slice().sort((a,b)=> new Date(b.date)-new Date(a.date));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if(historyPage > totalPages) historyPage = totalPages;
  const start = (historyPage - 1) * PAGE_SIZE;
  const pg = rows.slice(start, start + PAGE_SIZE);

  const tbl = document.getElementById('historyTable');
  tbl.innerHTML = `
    <thead><tr><th>Author</th><th>Amount</th><th>Method</th><th>Date</th><th>Reference</th><th>Status</th></tr></thead>
    <tbody>${pg.map(h=>`
      <tr>
        <td><div class="hist-author"><img src="${h.avatar}" alt="${h.author}"/>${h.author}</div></td>
        <td class="hist-amt">${money(h.amount)}</td>
        <td>${h.method}</td>
        <td>${fmtDateTime(h.date)}</td>
        <td style="color:var(--text-faint)">${h.reference}</td>
        <td><span class="status-pill ${h.status==='completed'?'active':'on-hold'}">${h.status}</span></td>
      </tr>`).join('')}
    </tbody>`;

  renderHistoryFooter(totalPages, rows.length);
}

function renderHistoryFooter(totalPages, total){
  const start = total === 0 ? 0 : (historyPage-1)*PAGE_SIZE+1;
  const end = Math.min(historyPage*PAGE_SIZE, total);
  let html = `<div class="list-footer-info">Showing ${start}–${end} of ${total} payments</div>`;
  html += `<div class="pager">`;
  html += `<button ${historyPage===1?'disabled':''} data-hp="prev"><i class="fas fa-chevron-left"></i></button>`;
  const pages = new Set([1, totalPages, historyPage, historyPage-1, historyPage+1]);
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pages.has(p)) continue;
    if(p - last > 1) html += `<span class="pager-gap">…</span>`;
    html += `<button data-hp="${p}" class="${p===historyPage?'active':''}">${p}</button>`;
    last = p;
  }
  html += `<button ${historyPage===totalPages?'disabled':''} data-hp="next"><i class="fas fa-chevron-right"></i></button>`;
  html += `</div>`;
  document.getElementById('historyFooter').innerHTML = html;
}

document.getElementById('historyFooter').addEventListener('click', e=>{
  const btn = e.target.closest('[data-hp]');
  if(!btn) return;
  const p = btn.dataset.hp;
  const totalPages = Math.max(1, Math.ceil(HISTORY.length / PAGE_SIZE));
  if(p==='prev') historyPage = Math.max(1, historyPage-1);
  else if(p==='next') historyPage = Math.min(totalPages, historyPage+1);
  else historyPage = parseInt(p,10);
  renderHistory();
});

/* ── Tabs ── */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('overviewTab').style.display = tab==='overview' ? 'block':'none';
    document.getElementById('historyTab').style.display = tab==='history' ? 'block':'none';
  });
});

document.getElementById('searchInput').addEventListener('input', e=>{ searchTerm=e.target.value; authorPage=1; renderAuthors(); });
document.getElementById('statusFilter').addEventListener('change', e=>{ statusTerm=e.target.value; authorPage=1; renderAuthors(); });
document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; authorPage=1; renderAuthors(); });

/* ── Schedule Modal ── */
let scheduleTarget = null;

function openScheduleModal(a){
  scheduleTarget = a;
  document.getElementById('scheduleAuthorInfo').innerHTML = `<img src="${a.avatar}" alt=""/><div><div class="modal-author-name">${a.author}</div><div class="modal-author-meta">Pending: ${money(a.pendingPayout)} · ${a.method}</div></div>`;
  document.getElementById('scheduleAmount').value = a.pendingPayout || '';
  document.getElementById('scheduleDate').value = a.nextScheduled || new Date().toISOString().slice(0,10);
  document.getElementById('scheduleOverlay').classList.add('open');
}

function closeScheduleModal(){
  document.getElementById('scheduleOverlay').classList.remove('open');
  scheduleTarget = null;
}

document.getElementById('scheduleClose').addEventListener('click', closeScheduleModal);
document.getElementById('scheduleCancelBtn').addEventListener('click', closeScheduleModal);
document.getElementById('scheduleOverlay').addEventListener('click', function(e){ if(e.target===this) closeScheduleModal(); });

document.getElementById('scheduleSubmitBtn').addEventListener('click', async ()=>{
  if(!scheduleTarget) return;
  const amt = parseFloat(document.getElementById('scheduleAmount').value) || 0;
  const date = document.getElementById('scheduleDate').value;
  if(!date){ toast('Please select a date'); return; }
  if(amt <= 0){ toast('Please enter a valid amount'); return; }

  await FinanceData.schedulePayout(scheduleTarget.id, amt, date);
  scheduleTarget.pendingPayout = amt;
  scheduleTarget.nextScheduled = date;
  toast(`📅 Scheduled ${money(amt)} for ${scheduleTarget.author} on ${fmtDate(date)}`);
  closeScheduleModal();
  renderStatCards();
  renderAuthors();
});

/* ── Pay Confirm Modal ── */
let payTarget = null;

function openPayModal(a){
  payTarget = a;
  document.getElementById('payAuthorInfo').innerHTML = `<img src="${a.avatar}" alt=""/><div><div class="modal-author-name">${a.author}</div><div class="modal-author-meta">${a.method}</div></div>`;
  document.getElementById('payAmountDisplay').textContent = money(a.pendingPayout);
  document.getElementById('payMethodDisplay').innerHTML = `<i class="fas fa-building-columns"></i> ${a.method}`;
  document.getElementById('payOverlay').classList.add('open');
}

function closePayModal(){
  document.getElementById('payOverlay').classList.remove('open');
  payTarget = null;
}

document.getElementById('payClose').addEventListener('click', closePayModal);
document.getElementById('payCancelBtn').addEventListener('click', closePayModal);
document.getElementById('payOverlay').addEventListener('click', function(e){ if(e.target===this) closePayModal(); });

document.getElementById('payConfirmBtn').addEventListener('click', async ()=>{
  if(!payTarget) return;
  const amt = payTarget.pendingPayout;
  await FinanceData.processPayment(payTarget.id);
  payTarget.lastAmount = amt;
  payTarget.lastPayout = new Date().toISOString().slice(0,10);
  payTarget.pendingPayout = 0;
  HISTORY.unshift({ id:'PH-'+Math.floor(Math.random()*9000+1000), author:payTarget.author, avatar:payTarget.avatar, amount:amt, method:payTarget.method, date:new Date().toISOString(), status:'completed', reference:'TXN-'+Math.floor(Math.random()*90000+10000) });
  toast(`✅ Paid ${money(amt)} to ${payTarget.author}`);
  closePayModal();
  renderStatCards();
  renderAuthors();
  renderHistory();
});

/* ── Actions ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const id = el.dataset.id;
  const a = AUTHORS.find(x=>x.id===id);
  if(!a) return;

  if(el.dataset.action==='pay'){
    if(a.pendingPayout<=0 || a.status==='on-hold') return;
    openPayModal(a);
  }
  else if(el.dataset.action==='schedule'){
    openScheduleModal(a);
  }
});

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove('show'), 2400);
}

init();
})();
