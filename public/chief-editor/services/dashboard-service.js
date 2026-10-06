/**
 * dashboard-service.js — Dashboard page controller (migrated from dashboard.html inline script).
 * Pure call-and-render: init() attaches the sidebar shell and renders from data.
 * Backend-ready: set USE_API=true and serve JSON under API_BASE;
 * demo paths (window.ChiefEditorData) keep working when USE_API=false.
 */
(function(){
'use strict';
if(window.DashboardService) return;

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, opts);
  if(!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}
async function loadDashboard(){
  try{
    const d = await callBackend('/dashboard');
    if(d) return d;
  }catch(e){ /* fall through to demo data */ }
  return window.ChiefEditorData.getDashboard();
}
/* Local toast fallback (delegates to window.toast when present; the inline page relied on a global toast). */
function toast(m){
  if(typeof window.toast === 'function'){ window.toast(m); return; }
  try{ console.log('[Dashboard]', m); }catch(e){}
}

function __dashboardMain(){
'use strict';
const shell = ChiefEditorSidebar.attach('#dashRoot',{
  activeItem:'dashboard', title:'Dashboard', subtitle:'Platform-wide editorial overview',
  user:{name:'Adaeze Bello',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=9'}, notifCount:6,
  searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

let DATA = null;
let actPage = 1;
const ACT_PER_PAGE = 8;

async function init(){
  DATA = await loadDashboard();
  renderAll();
}

function renderAll(){
  renderStatCards();
  renderReports();
  renderQuickActions();
  renderQuotas();
  renderPayments();
  renderActivity();
}

function renderStatCards(){
  const stats = [
    { n:DATA.totalSeniorEditors, l:'Senior Editors', ico:'fa-people-group', cls:'accent' },
    { n:DATA.totalAuthors, l:'Total Authors', ico:'fa-user-tie', cls:'blue' },
    { n:DATA.pendingContracts.length, l:'Pending Signatures', ico:'fa-file-signature', cls:'purple' },
    { n:DATA.flaggedReports.length, l:'Flagged Reports', ico:'fa-flag', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ── Flagged Reports (only Chief Editor can act) ── */
function renderReports(){
  const box = document.getElementById('reportsList');
  const top = DATA.flaggedReports.slice(0,3);
  if(!top.length){ box.innerHTML = `<div class="empty-msg">Nothing flagged right now.</div>`; return; }
  box.innerHTML = top.map(r=>`
    <div class="rpt-card" data-id="${r.id}">
      <div class="rpt-top">
        <span class="rpt-target">${r.target}</span>
        <span class="target-pill">${r.targetType==='author'?'Author':'Senior Editor'}</span>
        <span class="sev-pill ${r.severity}">${r.severity}</span>
      </div>
      <div class="rpt-reason">${r.reason}</div>
      <div class="rpt-meta">Reported by ${r.reportedBy} · ${r.filed}</div>
      <div class="rpt-actions">
        ${r.targetType==='author' ? `
          <button class="mini-btn ghost" data-action="dismiss-report" data-id="${r.id}">Dismiss</button>
          <button class="mini-btn" data-action="suspend-report" data-id="${r.id}"><i class="fas fa-pause"></i> Suspend</button>
          <button class="mini-btn danger" data-action="ban-report" data-id="${r.id}"><i class="fas fa-ban"></i> Ban</button>
          <button class="mini-btn danger" data-action="remove-report" data-id="${r.id}"><i class="fas fa-trash"></i> Remove</button>
        ` : `
          <button class="mini-btn ghost" data-action="dismiss-report" data-id="${r.id}">Dismiss</button>
          <button class="mini-btn" data-action="open-editors" data-id="${r.id}"><i class="fas fa-people-group"></i> Review Editor</button>
        `}
      </div>
    </div>`).join('');
}

function resolveReport(id, msg){
  DATA.flaggedReports = DATA.flaggedReports.filter(x=>x.id!==id);
  toast(msg);
  renderReports();
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

/* ── Senior Editor Quotas ── */
function renderQuotas(){
  document.getElementById('quotaList').innerHTML = DATA.editorQuotas.map(q=>{
    const pct = Math.min(100, Math.round(q.invited/q.target*100));
    return `
    <div class="quota-row">
      <div class="quota-top">
        <img class="quota-avatar" src="${q.avatar}" alt="${q.name}"/>
        <div class="quota-name">${q.name}</div>
        <div class="quota-num">${q.invited}/${q.target}</div>
      </div>
      <div class="quota-bar-track"><div class="quota-bar-fill ${q.status}" style="width:${pct}%"></div></div>
      <div class="quota-foot">
        <span class="quota-status ${q.status}">${q.status==='behind'?'Behind':q.status==='ahead'?'Ahead':'On track'}</span>
        ${q.status==='behind' ? `<button class="mini-btn danger" data-action="quota-action" data-name="${q.name}"><i class="fas fa-triangle-exclamation"></i> Take Action</button>` : `<span style="font-size:9.5px;color:var(--text-faint)">Due ${q.deadline}</span>`}
      </div>
    </div>`;
  }).join('');
}

/* ── Payments Due ── */
function renderPayments(){
  document.getElementById('paymentsList').innerHTML = DATA.paymentsQueue.map(p=>`
    <div class="pay-row">
      <img class="pay-avatar" src="${p.avatar}" alt="${p.name}"/>
      <div class="pay-body">
        <div class="pay-name">${p.name}</div>
        <div class="pay-role">${p.role}</div>
      </div>
      <div>
        <div class="pay-amt">${p.amount}</div>
        <div class="pay-due">${p.due}</div>
      </div>
      <span class="pay-status ${p.status}">${p.status}</span>
    </div>`).join('');
}

/* ── Activity feed ── */
function renderActivity(){
  const all = DATA.recentActivity;
  const total = all.length;
  const totalPages = Math.ceil(total / ACT_PER_PAGE);
  if(actPage > totalPages) actPage = totalPages;
  const start = (actPage - 1) * ACT_PER_PAGE;
  const slice = all.slice(start, start + ACT_PER_PAGE);

  document.getElementById('activityList').innerHTML = slice.map(a=>`
    <div class="act-row">
      <div class="act-dot" style="background:${BG_MAP[a.color]||'var(--table-head)'};color:${ICO_MAP[a.color]||'var(--text-faint)'}"><i class="fas ${a.icon}"></i></div>
      <div class="act-body">
        <div class="act-text">${a.text}</div>
        <div class="act-time">${a.time}</div>
      </div>
    </div>`).join('') || '<div class="empty-msg">No recent activity.</div>';

  const pager = document.getElementById('activityPager');
  if(totalPages <= 1){ pager.innerHTML = ''; return; }
  let html = `<button class="pg-btn" data-p="prev" ${actPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  for(let i = 1; i <= totalPages; i++){
    html += `<button class="pg-btn${i===actPage?' active':''}" data-p="${i}">${i}</button>`;
  }
  html += `<button class="pg-btn" data-p="next" ${actPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
  pager.innerHTML = html;
}

/* ── Event delegation ── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(el){
    const action = el.dataset.action;
    const id = el.dataset.id;

    if(action==='dismiss-report') resolveReport(id, '✅ Report dismissed');
    else if(action==='suspend-report'){
      const r = DATA.flaggedReports.find(x=>x.id===id);
      resolveReport(id, `⏸️ Suspended ${r ? r.target : 'author'}`);
    }
    else if(action==='ban-report'){
      const r = DATA.flaggedReports.find(x=>x.id===id);
      resolveReport(id, `🚫 Banned ${r ? r.target : 'author'}`);
    }
    else if(action==='remove-report'){
      const r = DATA.flaggedReports.find(x=>x.id===id);
      resolveReport(id, `🗑️ Removed ${r ? r.target : 'author'} from the platform`);
    }
    else if(action==='open-editors'){ location.href = 'senior-editors.html'; }
    else if(action==='quota-action'){ toast(`⚠️ Opening options for ${el.dataset.name}…`); }
    return;
  }

  const pgBtn = e.target.closest('.pg-btn');
  if(pgBtn && pgBtn.dataset.p){
    const p = pgBtn.dataset.p;
    if(p === 'prev') actPage--;
    else if(p === 'next') actPage++;
    else actPage = parseInt(p);
    renderActivity();
  }
});

init();
}

var _dashInited = false;
function init(){
  if(_dashInited) return;
  _dashInited = true;
  __dashboardMain();
}

window.DashboardService = { init: init };
})();
