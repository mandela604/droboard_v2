/**
 * withdrawals-service.js — Logic for withdrawals page
 * ──────────────────────────────────────────────────────────────
 * All rendering, filtering, pagination, detail modal, approve/decline modals.
 * Reads from FinanceData; renders into #pageRoot elements.
 */
(function(){
'use strict';

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const PER_PAGE = 6;

let ALL = [];
let activeStatus = 'all';
let searchTerm = '';
let methodTerm = '';
let sortMode = 'recent';
let page = 1;

function money(n){ return '$' + Number(n||0).toLocaleString('en-US'); }
function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function timeAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff/3600000);
  if(h < 1) return 'Just now';
  if(h < 24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

async function init(){
  ALL = await FinanceData.getWithdrawals();
  renderStatCards();
  renderFilterPills();
  render();
}

function renderStatCards(){
  const pending = ALL.filter(w=>w.status==='pending');
  const approved = ALL.filter(w=>w.status==='approved');
  const declined = ALL.filter(w=>w.status==='declined');
  const pendingTotal = pending.reduce((s,w)=>s+w.amount,0);
  const stats = [
    { n:pending.length, l:'Pending Requests', ico:'fa-hourglass-half', cls:'amber' },
    { n:money(pendingTotal), l:'Pending Amount', ico:'fa-sack-dollar', cls:'blue' },
    { n:approved.length, l:'Approved', ico:'fa-circle-check', cls:'green' },
    { n:declined.length, l:'Declined', ico:'fa-circle-xmark', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function renderFilterPills(){
  const counts = { all:ALL.length, pending:0, approved:0, declined:0 };
  ALL.forEach(w=>counts[w.status]++);
  const pills = [
    { key:'all', label:'All' },
    { key:'pending', label:'Pending' },
    { key:'approved', label:'Approved' },
    { key:'declined', label:'Declined' },
  ];
  document.getElementById('filterPills').innerHTML = pills.map(p=>`
    <button class="f-pill${activeStatus===p.key?' active':''}" data-status="${p.key}">${p.label} <span class="cnt">${counts[p.key]}</span></button>`).join('');
  document.querySelectorAll('.f-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeStatus = btn.dataset.status; page=1; renderFilterPills(); render(); });
  });
}

function getFiltered(){
  let list = ALL.slice();
  if(activeStatus !== 'all') list = list.filter(w=>w.status===activeStatus);
  if(methodTerm) list = list.filter(w=>w.method===methodTerm);
  if(searchTerm) list = list.filter(w=>w.author.toLowerCase().includes(searchTerm.toLowerCase()));
  if(sortMode==='amount-desc') list.sort((a,b)=>b.amount-a.amount);
  else if(sortMode==='amount-asc') list.sort((a,b)=>a.amount-b.amount);
  else list.sort((a,b)=> new Date(b.requested) - new Date(a.requested));
  return list;
}

function render(){
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if(page > totalPages) page = totalPages;
  const pageItems = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const box = document.getElementById('wdList');
  if(!pageItems.length){
    box.innerHTML = `<div class="empty-state"><i class="fas fa-building-columns"></i><p>No withdrawal requests match your filters.</p></div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  box.innerHTML = `<div class="wd-list">${pageItems.map(w=>`
    <div class="wd-card" data-id="${w.id}">
      <img class="wd-avatar" src="${w.avatar}" alt="${w.author}"/>
      <div class="wd-body">
        <div class="wd-top">
          <span class="wd-name">${w.author}</span>
          <span class="wd-amt">${money(w.amount)}</span>
          <span class="method-chip">${w.method}</span>
          <span class="status-pill ${w.status}">${w.status}</span>
        </div>
        <div class="wd-meta">
          <span><i class="fas fa-clock"></i> Requested ${timeAgo(w.requested)}</span>
          <span><i class="fas fa-building-columns"></i> ${w.account}</span>
        </div>
      </div>
      ${w.status==='pending' ? `
      <div class="wd-actions">
        <button class="mini-btn danger" data-action="decline" data-id="${w.id}"><i class="fas fa-xmark"></i> Decline</button>
        <button class="mini-btn primary" data-action="approve" data-id="${w.id}"><i class="fas fa-check"></i> Approve</button>
      </div>` : ''}
    </div>`).join('')}</div>`;

  document.querySelectorAll('.wd-card').forEach(card=>{
    card.addEventListener('click', (e)=>{ if(e.target.closest('[data-action]')) return; openDetail(card.dataset.id); });
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const box = document.getElementById('pagination');
  if(totalPages <= 1){ box.innerHTML=''; return; }
  let html = `<button class="page-btn" ${page===1?'disabled':''} data-p="${page-1}"><i class="fas fa-chevron-left"></i></button>`;
  for(let i=1;i<=totalPages;i++) html += `<button class="page-btn${i===page?' active':''}" data-p="${i}">${i}</button>`;
  html += `<button class="page-btn" ${page===totalPages?'disabled':''} data-p="${page+1}"><i class="fas fa-chevron-right"></i></button>`;
  box.innerHTML = html;
  box.querySelectorAll('.page-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ page = parseInt(btn.dataset.p,10); render(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
}

document.getElementById('searchInput').addEventListener('input', e=>{ searchTerm=e.target.value; page=1; render(); });
document.getElementById('methodFilter').addEventListener('change', e=>{ methodTerm=e.target.value; page=1; render(); });
document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; render(); });

/* ── Detail modal ── */
const dtOverlay = document.getElementById('dtOverlay');
const dtModal = document.getElementById('dtModal');

function openDetail(id){
  const w = ALL.find(x=>x.id===id);
  if(!w) return;
  dtModal.innerHTML = `
    <div class="dt-head">
      <div class="dt-head-top">
        <div class="dt-author">
          <img class="dt-avatar" src="${w.avatar}" alt="${w.author}"/>
          <div><div class="dt-author-name">${w.author}</div><div class="dt-author-sub">${w.id} · <span class="status-pill ${w.status}" style="margin-left:2px">${w.status}</span></div></div>
        </div>
        <button class="dt-close" id="dtClose"><i class="fas fa-xmark"></i></button>
      </div>
    </div>
    <div class="dt-body">
      <div class="dt-amt-card"><div class="dt-amt-num">${money(w.amount)}</div><div class="dt-amt-lbl">Requested Withdrawal</div></div>
      <div class="dt-meta-grid">
        <div class="dt-meta-item"><div class="dt-meta-lbl">Method</div><div class="dt-meta-val">${w.method}</div></div>
        <div class="dt-meta-item"><div class="dt-meta-lbl">Account</div><div class="dt-meta-val" style="font-size:11.5px">${w.account}</div></div>
        <div class="dt-meta-item"><div class="dt-meta-lbl">Requested</div><div class="dt-meta-val" style="font-size:11.5px">${fmtDate(w.requested)}</div></div>
        <div class="dt-meta-item"><div class="dt-meta-lbl">${w.status==='pending'?'Status':'Processed'}</div><div class="dt-meta-val" style="font-size:11.5px">${w.status==='pending' ? 'Awaiting review' : fmtDate(w.processed)}</div></div>
      </div>
      ${w.status==='declined' && w.note ? `<div class="dt-note"><i class="fas fa-circle-info"></i> ${w.note}</div>` : ''}
    </div>
    ${w.status==='pending' ? `
    <div class="dt-foot">
      <button class="mini-btn danger" id="dtDeclineBtn"><i class="fas fa-xmark"></i> Decline</button>
      <button class="mini-btn primary" id="dtApproveBtn"><i class="fas fa-check"></i> Approve</button>
    </div>` : ''}
  `;
  dtOverlay.classList.add('open');
  document.getElementById('dtClose').addEventListener('click', closeDetail);

  if(w.status==='pending'){
    document.getElementById('dtApproveBtn').addEventListener('click', ()=>{ closeDetail(); openApproveModal(w); });
    document.getElementById('dtDeclineBtn').addEventListener('click', ()=>{ closeDetail(); openDeclineModal(w); });
  }
}
function closeDetail(){ dtOverlay.classList.remove('open'); }
dtOverlay.addEventListener('click', e=>{ if(e.target===dtOverlay) closeDetail(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDetail(); closeApproveModal(); closeDeclineModal(); } });

/* ── Approve modal ── */
let approveTarget = null;

function openApproveModal(w){
  approveTarget = w;
  document.getElementById('approveAuthorInfo').innerHTML = `<img src="${w.avatar}" alt=""/><div><div class="modal-author-name">${w.author}</div><div class="modal-author-meta">${w.method} · ${w.account}</div></div>`;
  document.getElementById('approveAmount').textContent = money(w.amount);
  document.getElementById('approveOverlay').classList.add('open');
}
function closeApproveModal(){
  document.getElementById('approveOverlay').classList.remove('open');
  approveTarget = null;
}
document.getElementById('approveClose').addEventListener('click', closeApproveModal);
document.getElementById('approveCancelBtn').addEventListener('click', closeApproveModal);
document.getElementById('approveOverlay').addEventListener('click', function(e){ if(e.target===this) closeApproveModal(); });

document.getElementById('approveConfirmBtn').addEventListener('click', async ()=>{
  if(!approveTarget) return;
  const w = approveTarget;
  await FinanceData.approveWithdrawal(w.id);
  w.status='approved'; w.processed = new Date().toISOString();
  toast(`✅ Approved ${money(w.amount)} payout for ${w.author}`);
  closeApproveModal(); renderStatCards(); renderFilterPills(); render();
});

/* ── Decline modal ── */
let declineTarget = null;

function openDeclineModal(w){
  declineTarget = w;
  document.getElementById('declineAuthorInfo').innerHTML = `<img src="${w.avatar}" alt=""/><div><div class="modal-author-name">${w.author}</div><div class="modal-author-meta">${w.method} · ${w.account}</div></div>`;
  document.getElementById('declineReason').value = '';
  document.getElementById('declineOverlay').classList.add('open');
  document.getElementById('declineReason').focus();
}
function closeDeclineModal(){
  document.getElementById('declineOverlay').classList.remove('open');
  declineTarget = null;
}
document.getElementById('declineClose').addEventListener('click', closeDeclineModal);
document.getElementById('declineCancelBtn').addEventListener('click', closeDeclineModal);
document.getElementById('declineOverlay').addEventListener('click', function(e){ if(e.target===this) closeDeclineModal(); });

document.getElementById('declineConfirmBtn').addEventListener('click', async ()=>{
  if(!declineTarget) return;
  const w = declineTarget;
  const reason = document.getElementById('declineReason').value.trim();
  if(!reason){ document.getElementById('declineReason').focus(); return; }
  await FinanceData.declineWithdrawal(w.id, reason);
  w.status='declined'; w.note = reason; w.processed = new Date().toISOString();
  toast(`↩️ Declined payout for ${w.author}`);
  closeDeclineModal(); renderStatCards(); renderFilterPills(); render();
});

/* ── Quick-action buttons on cards ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el || !el.closest('.wd-card')) return;
  e.stopPropagation();
  const id = el.dataset.id;
  const w = ALL.find(x=>x.id===id);
  if(!w) return;
  if(el.dataset.action==='approve') openApproveModal(w);
  else if(el.dataset.action==='decline') openDeclineModal(w);
});

init();
})();
