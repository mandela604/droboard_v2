(function(){
'use strict';

/* ── Backend-ready header (for future API use; demo paths keep working) ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}
// Throwing variant — used for writes (regenerate) that must not look successful.
async function apiFetch(path, options){
  if (!USE_API) return { demo: true };
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}
function authHeaders(){
  let t = null;
  try { t = localStorage.getItem('dro_access_token'); } catch(e){}
  return Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {});
}

/* EditorAssignment-backed endpoints (live). Everything degrades to demo. */
const Crud = {
  // This editor's own writers + their invite provenance (invite | assigned).
  myAuthors: () => apiFetch('/my-authors?limit=100'),
  getCode: () => apiFetch('/referral-code'),
  rotateCode: () => apiFetch('/referral-code/regenerate', { method: 'POST', headers: authHeaders() }),
};

// Populated by syncFromBackend() when the backend is live; null ⇒ demo mode.
var backendCode = null;
var backendAuthors = null;

var _inited = false;

const SE_ID = 'SE-01';
const SE_NAME = 'Chioma Reddy';
const LS_CODE = 'se_referral_code_'+SE_ID;
const LS_AUTHORS = 'se_referred_authors_'+SE_ID;

function attachShell(){
  SeniorEditorSidebar.attach('#inviteRoot',{
    activeItem:'invite-authors', title:'Invite Authors', subtitle:'Generate a code or link — writers who sign up with it are auto-assigned to you and active immediately',
    user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'}, notifCount:3,
    searchPlaceholder:'Search writers…',
    onSearch:(v)=>{ const inp=document.getElementById('searchInput'); if(inp){ inp.value=v; currentPage=1; filterAndRender(); } }
  });
}

function genCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='SE-';
  for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
// The editor's real invite code. Backend wins when live; localStorage is the
// demo stand-in. Signup with this code ⇒ writer role + auto-assignment.
function getCode(){
  if (backendCode) return backendCode;
  let c=localStorage.getItem(LS_CODE);
  if(!c){ c=genCode(); localStorage.setItem(LS_CODE,c); }
  return c;
}
function setCode(newCode){
  backendCode = newCode;
  localStorage.setItem(LS_CODE,newCode);
  renderCode();
}
// Backend row → the shape the table/pager already expects.
function mapBackendWriter(u){
  return {
    id: u.id, name: u.name || u.fullName || '', email: u.email || '', avatar: u.avatar || '',
    code: u.code || getCode(),
    via: u.via || 'assigned',
    signedUp: u.signedUp || u.createdAt || new Date().toISOString(),
    status: u.status || 'active',
  };
}
// Live rows when synced, else the seeded demo list.
function writers(){
  return backendAuthors ? backendAuthors.map(mapBackendWriter) : authors;
}
function getLink(code){
  // Support both /public/Pages/signup.html and /public/signup.html
  const base = window.location.origin + window.location.pathname.replace(/\/senior-editor\/.*/, '/Pages/signup.html');
  return base + '?ref=' + encodeURIComponent(code);
}
function getAltLink(code){
  return window.location.origin + '/public/signup.html?ref=' + encodeURIComponent(code);
}
function loadAuthors(){
  try{ return JSON.parse(localStorage.getItem(LS_AUTHORS)||'[]'); }catch(e){ return []; }
}
function saveAuthors(list){
  localStorage.setItem(LS_AUTHORS, JSON.stringify(list));
}
function seedIfEmpty(){
  let list=loadAuthors();
  const SEED_V='3';
  const ver=localStorage.getItem(LS_AUTHORS+'_v');
  if(list.length===0 || ver!==SEED_V){
    const c=getCode();
    const demo=[
      {id:'WR-101', name:'Adaeze Cole', email:'adaeze.cole@example.com', avatar:'https://i.pravatar.cc/100?img=26', code:c, via:'link', signedUp:new Date(Date.now()-86400000*2).toISOString(), status:'active'},
      {id:'WR-102', name:'Tunde Martins', email:'tunde.martins@example.com', avatar:'https://i.pravatar.cc/100?img=12', code:c, via:'code', signedUp:new Date(Date.now()-86400000*5).toISOString(), status:'active'},
      {id:'WR-103', name:'Zainab Bello', email:'zainab.bello@example.com', avatar:'https://i.pravatar.cc/100?img=45', code:c, via:'link', signedUp:new Date(Date.now()-86400000*7).toISOString(), status:'active'},
      {id:'WR-104', name:'Emeka Obi', email:'emeka.obi@example.com', avatar:'https://i.pravatar.cc/100?img=33', code:c, via:'code', signedUp:new Date(Date.now()-86400000*9).toISOString(), status:'active'},
      {id:'WR-105', name:'Funke Adeyemi', email:'funke.adeyemi@example.com', avatar:'https://i.pravatar.cc/100?img=20', code:c, via:'link', signedUp:new Date(Date.now()-86400000*11).toISOString(), status:'active'},
      {id:'WR-106', name:'Ibrahim Sule', email:'ibrahim.sule@example.com', avatar:'https://i.pravatar.cc/100?img=51', code:c, via:'code', signedUp:new Date(Date.now()-86400000*13).toISOString(), status:'active'},
      {id:'WR-107', name:'Chidinma Eze', email:'chidinma.eze@example.com', avatar:'https://i.pravatar.cc/100?img=47', code:c, via:'link', signedUp:new Date(Date.now()-86400000*15).toISOString(), status:'active'},
      {id:'WR-108', name:'Bola Adebayo', email:'bola.adebayo@example.com', avatar:'https://i.pravatar.cc/100?img=9', code:c, via:'code', signedUp:new Date(Date.now()-86400000*17).toISOString(), status:'active'},
      {id:'WR-109', name:'Segun Oyelaran', email:'segun.oyelaran@example.com', avatar:'https://i.pravatar.cc/100?img=15', code:c, via:'link', signedUp:new Date(Date.now()-86400000*19).toISOString(), status:'active'},
      {id:'WR-110', name:'Aisha Mohammed', email:'aisha.mohammed@example.com', avatar:'https://i.pravatar.cc/100?img=32', code:c, via:'code', signedUp:new Date(Date.now()-86400000*21).toISOString(), status:'active'},
      {id:'WR-111', name:'Kelechi Nwosu', email:'kelechi.nwosu@example.com', avatar:'https://i.pravatar.cc/100?img=60', code:c, via:'link', signedUp:new Date(Date.now()-86400000*23).toISOString(), status:'active'},
      {id:'WR-112', name:'Yusuf Danjuma', email:'yusuf.danjuma@example.com', avatar:'https://i.pravatar.cc/100?img=68', code:c, via:'code', signedUp:new Date(Date.now()-86400000*25).toISOString(), status:'active'},
    ];
    saveAuthors(demo);
    localStorage.setItem(LS_AUTHORS+'_v', SEED_V);
    list=demo;
  }
  return list;
}
let authors = seedIfEmpty();

/* ── Pagination (10 per page) ── */
const PER_PAGE = 10;
let currentPage = 1;
let filteredList = [];   /* last filtered/sorted result, used by pager */

function fmtDate(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200);
}
function copyText(txt, msg){
  if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(()=>toast(msg||'Copied!')).catch(()=>fallbackCopy(txt,msg)); }
  else fallbackCopy(txt,msg);
}
function fallbackCopy(txt,msg){
  const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy'); toast(msg||'Copied!');}catch(e){prompt('Copy:',txt);} ta.remove();
}
function renderQR(code){
  const box=document.getElementById('qrBox');
  // Simple fake QR using grid seeded by code
  let hash=0; for(let i=0;i<code.length;i++) hash=(hash*31 + code.charCodeAt(i))>>>0;
  let html='<div class="qr-grid">';
  for(let i=0;i<49;i++){
    const on = ((hash>> (i%24)) & 1) ^ (i%3===0?1:0);
    // keep finder patterns in corners always on for look
    const r=Math.floor(i/7), c=i%7;
    const isFinder = (r<2&&c<2)||(r<2&&c>4)||(r>4&&c<2);
    html+=`<div class="qr-cell ${isFinder? 'on' : (on?'on':'off')}"></div>`;
  }
  html+='</div>';
  box.innerHTML=html;
}
function renderCode(){
  const code=getCode();
  document.getElementById('codePill').textContent=code;
  const link=getLink(code);
  document.getElementById('linkInput').value=link;
  document.getElementById('openSignupLink').href=link;
  renderQR(code);
}
function renderStats(){
  const list=writers();
  const total=list.length;
  const active=list.filter(a=>a.status==='active').length;
  const thisMonth=list.filter(a=> new Date(a.signedUp).getMonth()===new Date().getMonth()).length;
  document.getElementById('statCards').innerHTML=[
    {n:total, l:'Total Referred', ico:'fa-users', cls:'accent', bg:'rgba(255,0,80,.1)', fg:'var(--accent)'},
    {n:active, l:'Active Writers', ico:'fa-circle-check', cls:'green', bg:'#e2f8ea', fg:'#16a34a'},
    {n:thisMonth, l:'This Month', ico:'fa-calendar', cls:'blue', bg:'#e3ecfd', fg:'#2f7de1'},
  ].map(s=>`<div class="stat-card"><div class="stat-ico" style="background:${s.bg};color:${s.fg}"><i class="fas ${s.ico}"></i></div><div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div></div>`).join('');
  document.getElementById('referredCount').textContent=total;
}
function filterAndRender(){
  const q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  const sort=document.getElementById('sortSelect').value;
  let list=writers().slice();
  if(q) list=list.filter(a=> (a.name||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q));
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  else list.sort((a,b)=> new Date(b.signedUp)-new Date(a.signedUp));
  filteredList=list;
  const totalPages=Math.max(1, Math.ceil(list.length/PER_PAGE));
  if(currentPage>totalPages) currentPage=totalPages;
  if(currentPage<1) currentPage=1;
  renderTable(list);
}
function renderPager(){
  const total=filteredList.length;
  const totalPages=Math.max(1, Math.ceil(total/PER_PAGE));
  let host=document.getElementById('writersPager');
  if(!host){
    host=document.createElement('div');
    host.id='writersPager';
    host.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px';
    document.getElementById('writersBody').closest('table').parentElement.parentElement.appendChild(host);
  }
  if(total<=PER_PAGE){ host.innerHTML=''; host.style.display='none'; return; }
  host.style.display='flex';
  const start=(currentPage-1)*PER_PAGE+1;
  const end=Math.min(currentPage*PER_PAGE,total);
  host.innerHTML=
    '<span style="font-size:11.5px;color:var(--text-faint,#9694ac);font-weight:600">Showing '+start+'–'+end+' of '+total+'</span>'+
    '<span style="display:inline-flex;gap:6px;align-items:center">'+
      '<button class="mini-btn" id="pagerPrev" '+(currentPage<=1?'disabled':'')+'><i class="fas fa-chevron-left"></i> Prev</button>'+
      '<span style="font-size:11.5px;font-weight:700;color:var(--text,#1a1730)">Page '+currentPage+' / '+totalPages+'</span>'+
      '<button class="mini-btn" id="pagerNext" '+(currentPage>=totalPages?'disabled':'')+'>Next <i class="fas fa-chevron-right"></i></button>'+
    '</span>';
  const prev=document.getElementById('pagerPrev');
  const next=document.getElementById('pagerNext');
  if(prev) prev.onclick=()=>{ if(currentPage>1){ currentPage--; renderTable(filteredList); window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); } };
  if(next) next.onclick=()=>{ if(currentPage<totalPages){ currentPage++; renderTable(filteredList); window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); } };
}
function renderTable(list){
  const body=document.getElementById('writersBody');
  const empty=document.getElementById('emptyState');
  if(!list.length){
    body.innerHTML='';
    empty.style.display='block';
    renderPager();
    return;
  }
  empty.style.display='none';
  const totalPages=Math.max(1, Math.ceil(list.length/PER_PAGE));
  if(currentPage>totalPages) currentPage=totalPages;
  const slice=list.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);
  body.innerHTML=slice.map(a=>{
    // 'invite'  = signed up with THIS editor's code/link
    // 'assigned'= placed here by the Chief Editor
    // ('link'/'code' are legacy demo values that also mean "via your invite")
    const viaInvite = a.via==='invite' || a.via==='link' || a.via==='code';
    const viaLabel = viaInvite
      ? '<div style="font-size:9.5px;color:var(--text-faint,#9694ac);margin-top:3px" title="Signed up with your referral code or link"><i class="fas fa-link" style="font-size:8.5px"></i> via your invite</div>'
      : '<div style="font-size:9.5px;color:var(--text-faint,#9694ac);margin-top:3px" title="Placed under you by the Chief Editor"><i class="fas fa-user-tie" style="font-size:8.5px"></i> assigned by Chief</div>';
    return `
    <tr>
      <td><div class="author-cell"><img src="${a.avatar}" alt=""/><div><div class="author-name">${a.name}</div><div class="author-email">${a.email}</div></div></div></td>
      <td><span style="font-family:monospace;font-weight:700;letter-spacing:.06em;background:var(--table-head,#faf9ff);padding:4px 8px;border-radius:6px;border:1px solid var(--border,#eceaf5)">${a.code}</span>${viaLabel}</td>
      <td style="white-space:nowrap">${fmtDate(a.signedUp)}</td>
      <td><span class="status-badge active">Active</span></td>
    </tr>
  `;}).join('');
  renderPager();
}

function bindEvents(){
  document.getElementById('copyCodeBtn').addEventListener('click',()=> copyText(getCode(),'Code copied!'));
  document.getElementById('copyLinkBtn').addEventListener('click',()=> copyText(document.getElementById('linkInput').value,'Link copied!'));
  document.getElementById('shareBtn').addEventListener('click', async ()=>{
    const code=getCode(); const link=getLink(code);
    const shareData={title:'Join Droboard — write with '+SE_NAME, text:'Sign up as a writer with my referral code '+code+' and start publishing today.', url:link};
    if(navigator.share){
      try{ await navigator.share(shareData); toast('Shared!'); }catch(e){}
    } else {
      copyText(link,'Link copied — share it!');
    }
  });
  document.getElementById('regenBtn').addEventListener('click',()=>{
    confirmDialog({
      title:'Regenerate referral code?',
      body:'A new code will replace <b>'+getCode()+'</b>. Old links with the previous code will stop working, and writers you already referred stay in your list.',
      confirmText:'Regenerate',
      danger:true
    }).then(ok=>{
      if(!ok) return;
      if(USE_API){
        // Live: the server mints + stores the replacement (old code stops resolving).
        const btn=document.getElementById('regenBtn');
        const icon=btn.querySelector('i');
        btn.disabled=true; if(icon) icon.className='fas fa-spinner fa-spin';
        Crud.rotateCode()
          .then(res=>{ setCode(res && res.code ? res.code : genCode()); toast('New code generated: '+getCode()); })
          .catch(()=>{ toast('Could not reach the server — code unchanged','fa-triangle-exclamation'); })
          .then(()=>{ btn.disabled=false; if(icon) icon.className='fas fa-rotate'; });
        return;
      }
      const newCode=genCode();
      setCode(newCode);
      // keep referral history (authors keep the code they signed up with)
      toast('New code generated: '+newCode);
    });
  });
  document.getElementById('searchInput').addEventListener('input', ()=>{ currentPage=1; filterAndRender(); });
  document.getElementById('sortSelect').addEventListener('change', ()=>{ currentPage=1; filterAndRender(); });
  document.getElementById('exportBtn').addEventListener('click',()=>{
    const list=writers();
    if(!list.length) return toast('Nothing to export');
    const csv=['Name,Email,Code,SignedUp,Status'].concat(list.map(a=>`"${a.name}","${a.email}","${a.code}","${a.signedUp}","${a.status}"`)).join('\n');
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='referred-writers-'+getCode()+'.csv'; a.click(); URL.revokeObjectURL(url);
    toast('CSV downloaded');
  });
}

function handleIncomingRef(){
  const params=new URLSearchParams(window.location.search);
  const ref=params.get('ref');
  if(ref){ try{ localStorage.setItem('dro_pending_ref', ref); }catch(e){} }
}

/* ── Custom confirm modal (replaces browser confirm()) ── */
function ensureConfirmModal(){
  if(document.getElementById('iaConfirmOv')) return;
  const style=document.createElement('style');
  style.textContent=
    '.ia-ov{position:fixed;inset:0;background:rgba(15,12,35,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:500;padding:20px}'+
    '.ia-ov.open{display:flex}'+
    '.ia-modal{background:var(--card,#fff);border:1px solid var(--border,#eceaf5);border-radius:16px;width:100%;max-width:400px;padding:24px;box-shadow:0 24px 64px -16px rgba(20,10,50,.35);animation:iaPop .16s ease}'+
    '@keyframes iaPop{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}'+
    '.ia-mhead{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}'+
    '.ia-mico{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,0,80,.1);color:var(--accent,#ff0050);font-size:16px}'+
    '.ia-mtitle{font-size:15px;font-weight:800;color:var(--text,#1a1730)}'+
    '.ia-mbody{font-size:12.5px;color:var(--text-muted,#71708a);line-height:1.6;margin-bottom:18px}'+
    '.ia-mactions{display:flex;gap:8px;justify-content:flex-end}'+
    '.ia-mbtn{font-size:12.5px;font-weight:700;padding:10px 18px;border-radius:10px;border:1px solid var(--input-border,#e4e2f1);background:var(--input-bg,#fff);color:var(--text,#1a1730);cursor:pointer;font-family:inherit;transition:.12s}'+
    '.ia-mbtn:hover{border-color:var(--accent,#ff0050);color:var(--accent,#ff0050)}'+
    '.ia-mbtn.danger{background:var(--accent,#ff0050);border-color:transparent;color:#fff}'+
    '.ia-mbtn.danger:hover{filter:brightness(1.06);color:#fff}';
  document.head.appendChild(style);

  const ov=document.createElement('div');
  ov.className='ia-ov';
  ov.id='iaConfirmOv';
  ov.innerHTML=
    '<div class="ia-modal" role="alertdialog" aria-modal="true">'+
      '<div class="ia-mhead">'+
        '<div class="ia-mico"><i class="fas fa-triangle-exclamation"></i></div>'+
        '<div class="ia-mtitle" id="iaConfirmTitle"></div>'+
      '</div>'+
      '<div class="ia-mbody" id="iaConfirmBody"></div>'+
      '<div class="ia-mactions">'+
        '<button class="ia-mbtn" id="iaConfirmCancel">Cancel</button>'+
        '<button class="ia-mbtn danger" id="iaConfirmOk">Confirm</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) closeConfirm(false); });
  document.getElementById('iaConfirmCancel').addEventListener('click', ()=>closeConfirm(false));
  document.getElementById('iaConfirmOk').addEventListener('click', ()=>closeConfirm(true));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeConfirm(false); });
}
let _confirmResolve=null;
function closeConfirm(val){
  const ov=document.getElementById('iaConfirmOv');
  if(ov) ov.classList.remove('open');
  if(_confirmResolve){ const r=_confirmResolve; _confirmResolve=null; r(val); }
}
function confirmDialog(opts){
  ensureConfirmModal();
  document.getElementById('iaConfirmTitle').textContent=opts.title||'Are you sure?';
  document.getElementById('iaConfirmBody').innerHTML=opts.body||'';
  const ok=document.getElementById('iaConfirmOk');
  ok.textContent=opts.confirmText||'Confirm';
  ok.classList.toggle('danger', !!opts.danger);
  document.getElementById('iaConfirmOv').classList.add('open');
  setTimeout(()=>ok.focus(),40);
  return new Promise(res=>{ _confirmResolve=res; });
}

function init(){
  if(_inited) return;
  _inited = true;
  attachShell();
  // For demo: simulate a writer signup via this referral to test auto-assign
  window._simulateWriterSignup = function(name,email){
    const code=getCode();
    const entry={id:'WR-'+Date.now(), name:name||'New Writer '+Math.floor(Math.random()*1000), email:email||'writer'+Date.now()+'@example.com', avatar:'https://i.pravatar.cc/100?img='+(Math.floor(Math.random()*70)+1), code:code, via:'invite', signedUp:new Date().toISOString(), status:'active'};
    authors.unshift(entry); saveAuthors(authors); renderStats(); filterAndRender(); toast('Writer auto-assigned to you!');
    return entry;
  };
  // Also handle if someone lands on signup with ?ref param — store for later assignment (demo helper)
  handleIncomingRef();
  bindEvents();
  renderCode();
  renderStats();
  filterAndRender();
  syncFromBackend();
}

// Pull the real code + writers when the backend is live. No-op in demo mode —
// everything above keeps working off localStorage.
function syncFromBackend(){
  if(!USE_API) return Promise.resolve();
  return Promise.all([Crud.getCode(), Crud.myAuthors()]).then(function(res){
    const codeRes = res[0], authorsRes = res[1];
    if(codeRes && codeRes.code) backendCode = codeRes.code;
    if(authorsRes && authorsRes.items) backendAuthors = authorsRes.items;
    renderCode(); renderStats(); filterAndRender();
  }).catch(function(){ /* stay on demo data */ });
}

window.InviteAuthorsService = { init: init };

})();
