(function(){
'use strict';

/* ── Backend only — no demo fallbacks ── */
const USE_API = true;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

let shell = null;

function esc(v){
  return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',accent:'var(--accent)'};
const BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',accent:'rgba(255,0,80,.1)'};

function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}

function showError(msg){
  const grid=document.getElementById('statCards');
  const rq=document.getElementById('rqGrid');
  const sub=document.getElementById('subList');
  const act=document.getElementById('activityList');
  if(grid) grid.innerHTML='';
  if(rq) rq.innerHTML='<div class="panel" style="padding:26px;text-align:center;color:var(--red,#e0384d)">' +
    '<i class="fas fa-triangle-exclamation" style="font-size:26px;display:block;margin-bottom:10px"></i>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px">Could not load dashboard</div>' +
    '<div style="font-size:11.5px;color:var(--text-faint,#9694ac);max-width:420px;margin:0 auto 14px">'+msg+'</div>' +
    '<button class="mini-btn primary" onclick="location.reload()"><i class="fas fa-rotate"></i> Refresh Page</button>' +
  '</div>';
  if(sub) sub.innerHTML='<div class="ri-row"><div class="ri-body"><div class="ri-meta">Unable to load submissions.</div></div></div>';
  if(act) act.innerHTML='<div class="act-row"><div class="act-body"><div class="act-meta">Unable to load activity.</div></div></div>';
}

function prose(t){ return (window.DroboardCurrency && DroboardCurrency.usdProse) ? DroboardCurrency.usdProse(t) : t; }

function renderStats(s){
  const total = s && s.stats ? s.stats.totalPending : 0;
  const urgent = s && s.stats ? s.stats.urgentChapterEdits : 0;
  const contracts = s && s.stats ? s.stats.contracts : 0;
  document.getElementById('statCards').innerHTML=[
    {n:total,l:'Pending Reviews',ico:'fa-inbox',cls:'amber'},
    {n:urgent,l:'Urgent (Chapter Edits)',ico:'fa-triangle-exclamation',cls:'red'},
    {n:contracts,l:'Contracts',ico:'fa-file-signature',cls:'blue'},
    {n:s && s.stats ? (s.stats.approvalRate + '%') : '0%',l:'Approval Rate',ico:'fa-circle-check',cls:'green'},
    {n:s && s.stats ? s.stats.avgTurnaround : '0h',l:'Avg Turnaround',ico:'fa-clock',cls:'purple'},
  ].map(st=>`<div class="stat-card"><div class="stat-ico" style="background:${BG[st.cls]};color:${ICO[st.cls]}"><i class="fas ${st.ico}"></i></div><div><div class="stat-num">${st.n}</div><div class="stat-lbl">${st.l}</div></div></div>`).join('');
}

function renderQueues(q){
  const qmap = q && q.queues ? q.queues : {};
  const items = [];
  if(qmap.contracts!=null) items.push({key:'contracts',label:'Contract Review',icon:'fa-file-signature',desc:'Authors sign first, then contract returns to SE for final platform signature & stamp.',count:qmap.contracts,cls:'amber',href:'contract-review.html'});
  if(qmap.completions!=null) items.push({key:'completion',label:'Completion Application',icon:'fa-flag-checkered',desc:'Authors apply for book completion. SE approves or rejects.',count:qmap.completions,cls:'green',href:'completion-application.html'});
  if(qmap.chapterEdits!=null) items.push({key:'chapters',label:'Chapter Edit Review',icon:'fa-pen-to-square',desc:'Authors request chapter edits. SE reviews to protect exclusive contracts.',count:qmap.chapterEdits,cls:'red',href:'chapter-edit-review.html'});
  if(qmap.bookEdits!=null) items.push({key:'book-story',label:'Book Story Review',icon:'fa-book-open',desc:'Authors request edits to book details (title, story name, etc.).',count:qmap.bookEdits,cls:'blue',href:'book-story-review.html'});
  document.getElementById('rqGrid').innerHTML=items.map(q=>{
    const cls=q.count===0?'zero':q.count>=5?'urgent':'normal';
    return `<div class="rq-card" data-href="${q.href}">
      <div class="rq-ico" style="background:${BG[q.cls]};color:${ICO[q.cls]}"><i class="fas ${q.icon}"></i></div>
      <div class="rq-body"><div class="rq-title">${q.label}</div><div class="rq-desc">${q.desc}</div></div>
      <span class="rq-count ${cls}">${q.count}</span>
    </div>`;
  }).join('');
  document.querySelectorAll('.rq-card').forEach(c=>{
    c.addEventListener('click',()=>{ const h=c.dataset.href; if(h&&h!=='#') location.href=h; else toast('Opening queue…'); });
  });
}

function renderSubs(rows){
  if (!rows.length){
    document.getElementById('subList').innerHTML = '<div class="ri-row"><div class="ri-body"><div class="ri-meta">No submissions in your queue yet.</div></div></div>';
    return;
  }
  document.getElementById('subList').innerHTML=rows.map(s=>`
    <div class="ri-row">
      <div class="ri-ico"><i class="fas fa-file-lines"></i></div>
      <div class="ri-body"><div class="ri-title">${esc(s.title)}</div><div class="ri-meta"><span>✍️ ${esc(s.author)}</span><span>${prose(s.meta||'')}</span><span>${s.time||''}</span></div></div>
      <span class="status-pill ${s.status||'pending'}">${s.status||'pending'}</span>
    </div>`).join('');
}

function renderActivity(rows){
  if (!rows.length){
    document.getElementById('activityList').innerHTML = '<div class="act-row"><div class="act-body"><div class="act-meta">No activity yet.</div></div></div>';
    return;
  }
  document.getElementById('activityList').innerHTML=rows.map(a=>`
    <div class="act-row">
      <div class="act-dot" style="background:${BG[a.color]||'var(--table-head)'};color:${ICO[a.color]||'var(--text-faint)'}"><i class="fas ${a.icon||'fa-circle'}"></i></div>
      <div class="act-body"><div class="act-text">${prose(a.text||'')}</div><div class="act-time">${a.time||''}</div></div>
    </div>`).join('');
}

const QUEUE_FIELD = { contracts:'contracts', completion:'completions', chapters:'chapterEdits', 'book-story':'bookEdits' };

async function loadLive(){
  const d = await callBackend('/dashboard');
  LIVE_PAYLOAD = d;
  paint(d);
}

let LIVE_PAYLOAD = null;

function paint(d){
  if(!d){ showError('No data returned from server.'); return; }
  renderStats(d);
  renderQueues(d);
  renderSubs(d.recent || []);
  renderActivity(d.activity || []);
}

function init(){
  shell = SeniorEditorSidebar.attach('#dashRoot',{
    activeItem:'dashboard', title:'Dashboard', subtitle:'Your editorial overview',
    user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'}, notifCount:4,
    searchPlaceholder:'Search anything…',
  });
  loadLive().catch((err)=>{
    console.error('dashboard backend failed:', err);
    showError('The server is not reachable or your session expired. '+ (err && err.message ? err.message : 'Please refresh the page and try again.'));
  });
}

window.DashboardService = { init };

})();
