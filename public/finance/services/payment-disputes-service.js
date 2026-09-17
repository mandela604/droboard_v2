/**
 * payment-disputes-service.js — Logic for payment disputes page
 * ──────────────────────────────────────────────────────────────
 * All rendering, filtering, pagination, detail modal, actions.
 * Reads from FinanceData; renders into #pageRoot elements.
 */
(function(){
'use strict';

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const PER_PAGE = 10;

let ALL = [];
let activeStatus = 'all';
let searchTerm = '';
let sortMode = 'recent';
let page = 1;

function money(n){ return '$' + Number(n||0).toLocaleString('en-US'); }
function fmtDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' · ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function timeAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff/3600000);
  if(h < 1) return 'Just now';
  if(h < 24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function statusLabel(s){
  return { open:'Open', investigating:'Investigating', resolved:'Resolved', rejected:'Rejected' }[s] || s;
}

async function init(){
  ALL = await FinanceData.getPaymentDisputes();
  renderStatCards();
  renderFilterPills();
  render();
}

function renderStatCards(){
  const open = ALL.filter(d=>d.status==='open').length;
  const investigating = ALL.filter(d=>d.status==='investigating').length;
  const resolved = ALL.filter(d=>d.status==='resolved').length;
  const disputedAmount = ALL.filter(d=>d.status==='open' || d.status==='investigating').reduce((s,d)=>s+d.amount,0);
  const stats = [
    { n:open, l:'Open Cases', ico:'fa-triangle-exclamation', cls:'amber' },
    { n:investigating, l:'Under Investigation', ico:'fa-magnifying-glass', cls:'blue' },
    { n:resolved, l:'Resolved', ico:'fa-circle-check', cls:'green' },
    { n:money(disputedAmount), l:'Amount In Dispute', ico:'fa-scale-balanced', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function renderFilterPills(){
  const counts = { all:ALL.length, open:0, investigating:0, resolved:0, rejected:0 };
  ALL.forEach(d=>{ if(counts[d.status]!=null) counts[d.status]++; });
  const pills = [
    { key:'all', label:'All' },
    { key:'open', label:'Open' },
    { key:'investigating', label:'Investigating' },
    { key:'resolved', label:'Resolved' },
    { key:'rejected', label:'Rejected' },
  ];
  document.getElementById('filterPills').innerHTML = pills.map(p=>`
    <button class="f-pill${activeStatus===p.key?' active':''}" data-status="${p.key}">${p.label} <span class="cnt">${counts[p.key]}</span></button>`).join('');
  document.querySelectorAll('.f-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{ activeStatus = btn.dataset.status; page=1; renderFilterPills(); render(); });
  });
}

function getFiltered(){
  let list = ALL.slice();
  if(activeStatus!=='all') list = list.filter(d=>d.status===activeStatus);
  if(searchTerm){
    const q = searchTerm.toLowerCase();
    list = list.filter(d=>d.author.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q));
  }
  if(sortMode==='amount-desc') list.sort((a,b)=>b.amount-a.amount);
  else if(sortMode==='amount-asc') list.sort((a,b)=>a.amount-b.amount);
  else list.sort((a,b)=> new Date(b.filed) - new Date(a.filed));
  return list;
}

function render(){
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length/PER_PAGE));
  if(page>totalPages) page = totalPages;
  const pageItems = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const box = document.getElementById('pdList');
  if(!pageItems.length){
    box.innerHTML = `<div class="empty-state"><i class="fas fa-scale-balanced"></i><p>No disputes match your filters.</p></div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  box.innerHTML = `<div class="pd-list">${pageItems.map(d=>`
    <div class="pd-card" data-id="${d.id}">
      <img class="pd-avatar" src="${d.avatar}" alt="${d.author}"/>
      <div class="pd-body">
        <div class="pd-top">
          <span class="pd-name">${d.author}</span>
          <span class="pd-amt">${money(d.amount)}</span>
          <span class="status-pill ${d.status}">${statusLabel(d.status)}</span>
        </div>
        <div class="pd-reason">${d.reason}</div>
        <div class="pd-meta">
          <span><i class="fas fa-clock"></i> Filed ${timeAgo(d.filed)}</span>
          <span><i class="fas fa-hashtag"></i> ${d.id}</span>
        </div>
      </div>
      ${d.status==='open' || d.status==='investigating' ? `
      <div class="pd-actions">
        ${d.status==='open' ? `<button class="mini-btn blue-variant" data-action="investigate" data-id="${d.id}"><i class="fas fa-magnifying-glass"></i> Investigate</button>` : ''}
        <button class="mini-btn danger" data-action="reject-quick" data-id="${d.id}"><i class="fas fa-xmark"></i> Reject</button>
        <button class="mini-btn green-variant" data-action="resolve-quick" data-id="${d.id}"><i class="fas fa-check"></i> Resolve</button>
      </div>` : ''}
    </div>`).join('')}</div>`;

  document.querySelectorAll('.pd-card').forEach(card=>{
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
document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; render(); });

/* ── Detail modal ── */
const dtOverlay = document.getElementById('dtOverlay');
const dtModal = document.getElementById('dtModal');
let dtNoteMode = null;
let dtReplyMode = false;

function openDetail(id){
  const d = ALL.find(x=>x.id===id);
  if(!d) return;
  dtNoteMode = null;
  dtReplyMode = false;
  renderDetailModal(d);
  dtOverlay.classList.add('open');
}
function closeDetail(){ dtOverlay.classList.remove('open'); dtNoteMode = null; dtReplyMode = false; }

function renderDetailModal(d){
  const canAct = d.status==='open' || d.status==='investigating';
  const replies = d.replies || [];

  let noteSectionHtml = '';
  if(d.status==='resolved' && d.resolutionNote){
    noteSectionHtml = `<div class="dt-note-box resolved"><i class="fas fa-circle-check"></i>${d.resolutionNote}</div>`;
  } else if(d.status==='rejected' && d.resolutionNote){
    noteSectionHtml = `<div class="dt-note-box rejected"><i class="fas fa-circle-xmark"></i>${d.resolutionNote}</div>`;
  }

  let actionNoteHtml = '';
  if(canAct && dtNoteMode){
    actionNoteHtml = `
      <div class="dt-action-box">
        <label>${dtNoteMode==='resolve' ? 'Resolution note (shown to the author)' : 'Reason for rejection (shown to the author)'}</label>
        <textarea id="dtNoteInput" placeholder="${dtNoteMode==='resolve' ? 'Explain how this was resolved…' : 'Explain why this dispute is being rejected…'}"></textarea>
      </div>`;
  }

  let replySectionHtml = '';
  if(replies.length){
    replySectionHtml = '<div style="margin-top:12px"><div style="font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:8px">Replies to Author</div>' +
      replies.map(function(r){
        return '<div style="background:var(--blue-bg);border-radius:10px;padding:11px 13px;margin-bottom:8px">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;font-weight:700;color:var(--blue)">'+r.from+'</span><span style="font-size:10px;color:var(--text-faint)">'+timeAgo(r.time)+'</span></div>'+
          '<div style="font-size:12.5px;color:var(--text);line-height:1.5">'+r.message+'</div>'+
        '</div>';
      }).join('') + '</div>';
  }

  let replyInputHtml = '';
  if(dtReplyMode){
    replyInputHtml = `
      <div class="dt-action-box">
        <label>Reply to ${d.author} (will be visible to them)</label>
        <textarea id="dtReplyInput" placeholder="Type your reply to the author…"></textarea>
      </div>`;
  }

  dtModal.innerHTML = `
    <div class="dt-head">
      <div class="dt-head-top">
        <div class="dt-author">
          <img class="dt-avatar" src="${d.avatar}" alt="${d.author}"/>
          <div><div class="dt-author-name">${d.author}</div><div class="dt-author-sub">${d.id} · <span class="status-pill ${d.status}" style="margin-left:2px">${statusLabel(d.status)}</span></div></div>
        </div>
        <button class="dt-close" id="dtClose"><i class="fas fa-xmark"></i></button>
      </div>
    </div>
    <div class="dt-body">
      <div class="dt-amt-card"><div class="dt-amt-num">${money(d.amount)}</div><div class="dt-amt-lbl">Disputed Amount</div></div>
      <div class="dt-meta-grid">
        <div class="dt-meta-item"><div class="dt-meta-lbl">Filed</div><div class="dt-meta-val" style="font-size:12px">${fmtDateTime(d.filed)}</div></div>
        <div class="dt-meta-item"><div class="dt-meta-lbl">Status</div><div class="dt-meta-val" style="font-size:12px">${statusLabel(d.status)}</div></div>
        <div class="dt-meta-item full"><div class="dt-meta-lbl">Reason for Dispute</div></div>
      </div>
      <div class="dt-reason-box">${d.reason}</div>
      ${noteSectionHtml}
      ${replySectionHtml}
      ${actionNoteHtml}
      ${replyInputHtml}
    </div>
    ${canAct ? `
    <div class="dt-foot">
      ${d.status==='open' ? `<button class="mini-btn blue-variant" id="dtInvestigateBtn"><i class="fas fa-magnifying-glass"></i> Investigate</button>` : ''}
      <button class="mini-btn" id="dtReplyBtn" style="background:var(--blue-bg);border-color:transparent;color:var(--blue)"><i class="fas fa-reply"></i> ${dtReplyMode ? 'Send Reply' : 'Reply'}</button>
      <button class="mini-btn danger" id="dtRejectBtn"><i class="fas fa-xmark"></i> ${dtNoteMode==='reject' ? 'Confirm Reject' : 'Reject'}</button>
      <button class="mini-btn green-variant" id="dtResolveBtn"><i class="fas fa-check"></i> ${dtNoteMode==='resolve' ? 'Confirm Resolve' : 'Resolve'}</button>
    </div>` : `
    <div class="dt-foot">
      <button class="mini-btn" id="dtReplyBtn" style="background:var(--blue-bg);border-color:transparent;color:var(--blue)"><i class="fas fa-reply"></i> ${dtReplyMode ? 'Send Reply' : 'Reply'}</button>
    </div>`}
  `;

  document.getElementById('dtClose').addEventListener('click', closeDetail);

  document.getElementById('dtReplyBtn').addEventListener('click', ()=>{
    if(!dtReplyMode){ dtReplyMode=true; dtNoteMode=null; renderDetailModal(d); document.getElementById('dtReplyInput')?.focus(); }
    else{
      const msg = document.getElementById('dtReplyInput').value.trim();
      if(!msg){ toast('Please type a reply.'); return; }
      doReply(d.id, msg);
    }
  });

  if(canAct){
    const investigateBtn = document.getElementById('dtInvestigateBtn');
    if(investigateBtn) investigateBtn.addEventListener('click', ()=>doInvestigate(d.id));

    document.getElementById('dtResolveBtn').addEventListener('click', ()=>{
      if(dtNoteMode!=='resolve'){ dtNoteMode='resolve'; dtReplyMode=false; renderDetailModal(d); document.getElementById('dtNoteInput')?.focus(); }
      else{
        const note = document.getElementById('dtNoteInput').value.trim();
        doResolve(d.id, note);
      }
    });
    document.getElementById('dtRejectBtn').addEventListener('click', ()=>{
      if(dtNoteMode!=='reject'){ dtNoteMode='reject'; dtReplyMode=false; renderDetailModal(d); document.getElementById('dtNoteInput')?.focus(); }
      else{
        const note = document.getElementById('dtNoteInput').value.trim();
        doReject(d.id, note);
      }
    });
  }
}

dtOverlay.addEventListener('click', e=>{ if(e.target===dtOverlay) closeDetail(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDetail(); });

/* ── Actions ── */
function doInvestigate(id){
  const d = ALL.find(x=>x.id===id); if(!d) return;
  d.status = 'investigating';
  toast(`🔎 Marked "${d.id}" as under investigation`);
  closeDetail(); renderStatCards(); renderFilterPills(); render();
}
async function doResolve(id, note){
  const d = ALL.find(x=>x.id===id); if(!d) return;
  await FinanceData.resolveDispute(id, note);
  d.status = 'resolved'; d.resolutionNote = note || 'Resolved by Finance.';
  toast(`✅ Resolved dispute for ${d.author}`);
  closeDetail(); renderStatCards(); renderFilterPills(); render();
}
async function doReject(id, note){
  const d = ALL.find(x=>x.id===id); if(!d) return;
  await FinanceData.rejectDispute(id, note);
  d.status = 'rejected'; d.resolutionNote = note || 'Rejected by Finance.';
  toast(`↩️ Rejected dispute for ${d.author}`);
  closeDetail(); renderStatCards(); renderFilterPills(); render();
}
async function doReply(id, message){
  const d = ALL.find(x=>x.id===id); if(!d) return;
  if(!d.replies) d.replies = [];
  d.replies.push({ from:'Ngozi Falade', message:message, time:new Date().toISOString() });
  dtReplyMode = false;
  renderDetailModal(d);
  toast('Reply sent to ' + d.author);
  FinanceData.replyToDispute(id, message).catch(()=>{});
}

/* ── Quick-action buttons on cards ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el || !el.closest('.pd-card')) return;
  e.stopPropagation();
  const id = el.dataset.id;
  const action = el.dataset.action;

  if(action==='investigate') doInvestigate(id);
  else if(action==='resolve-quick'){
    const note = prompt('Resolution note (shown to the author):', '');
    if(note===null) return;
    doResolve(id, note.trim());
  }
  else if(action==='reject-quick'){
    const note = prompt('Reason for rejecting this dispute (shown to the author):', '');
    if(note===null) return;
    doReject(id, note.trim());
  }
});

init();
})();
