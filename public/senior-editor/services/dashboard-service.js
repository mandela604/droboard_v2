(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = true;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

let shell = null;
// Live payload replaces the demo arrays only when the request succeeds.
let LIVE = null;

function esc(v){
  return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',accent:'var(--accent)'};
const BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',accent:'rgba(255,0,80,.1)'};

/* ── Demo data ── */
const QUEUES = [
  { key:'contracts',    label:'Contract Review',       icon:'fa-file-signature', desc:'Authors sign first, then contract returns to SE for final platform signature & stamp.', count:5, cls:'amber', href:'contract-review.html' },
  { key:'completion',   label:'Completion Application', icon:'fa-flag-checkered', desc:'Authors apply for book completion. SE approves or rejects.', count:2, cls:'green', href:'completion-application.html' },
  { key:'chapters',     label:'Chapter Edit Review',    icon:'fa-pen-to-square',  desc:'Authors request chapter edits. SE reviews to protect exclusive contracts.', count:8, cls:'red', href:'chapter-edit-review.html' },
  { key:'book-story',  label:'Book Story Review',     icon:'fa-book-open',      desc:'Authors request edits to book details (title, story name, etc.).', count:4, cls:'blue', href:'book-story-review.html' },
];

const RECENT_SUBS = [
  { title:'Chapter Edit — The CEO\'s Hidden Son Ch.24', author:'Luna Skye', meta:'Billionaire & CEO · 3,450 words', time:'2h ago', status:'pending' },
  { title:'Contract Return — Wolf King\'s Vow', author:'Elena Vasquez', meta:'Werewolf & Fantasy · Full contract', time:'4h ago', status:'pending' },
  { title:'VIP Application — His Hidden Luna', author:'Lyra Night', meta:'Werewolf · Chapter lock request', time:'5h ago', status:'pending' },
  { title:'Completion Request — Betrayed by the Mafia Prince', author:'Marcus Webb Jr.', meta:'Mafia & Urban · 7 chapters done', time:'8h ago', status:'approved' },
  { title:'Book Edit — The Duke\'s Secret (title change)', author:'Isabelle Moreau', meta:'Historical & Regency · Metadata', time:'12h ago', status:'approved' },
  { title:'Editor Bill — Wren Okonkwo withdrawal', author:'Wren Okonkwo', meta:'Campus & Revenge · $1,200', time:'1d ago', status:'pending' },
];

const ACTIVITY = [
  { icon:'fa-check-circle', color:'green', text:'Approved <b>Chapter Edit</b> for Wolf King\'s Vow Ch.11', time:'1h ago' },
  { icon:'fa-file-signature', color:'amber', text:'Contract returned by <b>Isabelle Moreau</b> — pending stamp', time:'3h ago' },
  { icon:'fa-crown', color:'purple', text:'VIP registration approved for <b>Luna Skye</b>', time:'5h ago' },
  { icon:'fa-xmark-circle', color:'red', text:'Rejected <b>Chapter Edit</b> — Mafia Prince Ch.6 (policy violation)', time:'8h ago' },
  { icon:'fa-sack-dollar', color:'accent', text:'Editor bill pending — <b>Wren Okonkwo</b> $1,200', time:'1d ago' },
];

/* ── Render ── */
function renderStats(){
  const s = LIVE && LIVE.stats;
  const total = s ? s.totalPending : QUEUES.reduce((n,q)=>n+q.count,0);
  const urgent = s ? s.urgentChapterEdits : QUEUES.filter(q=>q.cls==='red').reduce((n,q)=>n+q.count,0);
  const contracts = QUEUES.find(q=>q.key==='contracts').count;
  document.getElementById('statCards').innerHTML=[
    {n:total,l:'Pending Reviews',ico:'fa-inbox',cls:'amber'},
    {n:urgent,l:'Urgent (Chapter Edits)',ico:'fa-triangle-exclamation',cls:'red'},
    {n:contracts,l:'Contracts',ico:'fa-file-signature',cls:'blue'},
    {n:s ? (s.approvalRate + '%') : 87,l:'Approval Rate',ico:'fa-circle-check',cls:'green'},
    {n:s ? s.avgTurnaround : '3.4h',l:'Avg Turnaround',ico:'fa-clock',cls:'purple'},
  ].map(st=>`<div class="stat-card"><div class="stat-ico" style="background:${BG[st.cls]};color:${ICO[st.cls]}"><i class="fas ${st.ico}"></i></div><div><div class="stat-num">${st.n}</div><div class="stat-lbl">${st.l}</div></div></div>`).join('');
}

function renderQueues(){
  document.getElementById('rqGrid').innerHTML=QUEUES.map(q=>{
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

function renderSubs(){
  const rows = LIVE ? LIVE.recent : RECENT_SUBS;
  if (!rows.length){
    document.getElementById('subList').innerHTML = '<div class="ri-row"><div class="ri-body"><div class="ri-meta">No submissions in your queue yet.</div></div></div>';
    return;
  }
  document.getElementById('subList').innerHTML=rows.map(s=>`
    <div class="ri-row">
      <div class="ri-ico"><i class="fas fa-file-lines"></i></div>
      <div class="ri-body"><div class="ri-title">${s.title}</div><div class="ri-meta"><span>✍️ ${s.author}</span><span>${s.meta}</span><span>${s.time}</span></div></div>
      <span class="status-pill ${s.status}">${s.status}</span>
    </div>`).join('');
}

function renderActivity(){
  const rows = LIVE ? LIVE.activity : ACTIVITY;
  if (!rows.length){
    document.getElementById('activityList').innerHTML = '<div class="act-row"><div class="act-body"><div class="act-meta">No activity yet.</div></div></div>';
    return;
  }
  document.getElementById('activityList').innerHTML=rows.map(a=>`
    <div class="act-row">
      <div class="act-dot" style="background:${BG[a.color]||'var(--table-head)'};color:${ICO[a.color]||'var(--text-faint)'}"><i class="fas ${a.icon}"></i></div>
      <div class="act-body"><div class="act-text">${a.text}</div><div class="act-time">${a.time}</div></div>
    </div>`).join('');
}

function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}

const QUEUE_FIELD = { contracts:'contracts', completion:'completions', chapters:'chapterEdits', 'book-story':'bookEdits' };

async function loadLive(){
  try{
    const d = await callBackend('/dashboard');
    if (!d) return;
    LIVE = d;
    const q = d.queues || {};
    QUEUES.forEach(item=>{
      const field = QUEUE_FIELD[item.key];
      if (field && typeof q[field] === 'number') item.count = q[field];
    });
  }catch(err){
    // Backend unavailable — keep the demo data on screen.
  }
}

function paint(){
  renderStats();
  renderQueues();
  renderSubs();
  renderActivity();
}

function init(){
  shell = SeniorEditorSidebar.attach('#dashRoot',{
    activeItem:'dashboard', title:'Dashboard', subtitle:'Your editorial overview',
    user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'}, notifCount:4,
    searchPlaceholder:'Search anything…',
  });
  paint();
  loadLive().then(paint);
}

window.DashboardService = { init };

})();
