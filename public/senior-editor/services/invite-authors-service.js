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
    onSearch:(v)=>{ const inp=document.getElementById('searchInput'); if(inp){ inp.value=v; filterAndRender(); } }
  });
}

function genCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='SE-';
  for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}
function getCode(){
  let c=localStorage.getItem(LS_CODE);
  if(!c){ c=genCode(); localStorage.setItem(LS_CODE,c); }
  return c;
}
function setCode(newCode){
  localStorage.setItem(LS_CODE,newCode);
  renderCode();
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
  if(list.length===0){
    const demo=[
      {id:'WR-101', name:'Adaeze Cole', email:'adaeze.cole@example.com', avatar:'https://i.pravatar.cc/100?img=26', code:getCode(), signedUp:new Date(Date.now()-86400000*2).toISOString(), status:'active'},
      {id:'WR-102', name:'Tunde Martins', email:'tunde.martins@example.com', avatar:'https://i.pravatar.cc/100?img=12', code:getCode(), signedUp:new Date(Date.now()-86400000*5).toISOString(), status:'active'},
    ];
    saveAuthors(demo);
    list=demo;
  }
  return list;
}
let authors = seedIfEmpty();

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
  const total=authors.length;
  const active=authors.filter(a=>a.status==='active').length;
  const thisMonth=authors.filter(a=> new Date(a.signedUp).getMonth()===new Date().getMonth()).length;
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
  let list=authors.slice();
  if(q) list=list.filter(a=> a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  else list.sort((a,b)=> new Date(b.signedUp)-new Date(a.signedUp));
  renderTable(list);
}
function renderTable(list){
  const body=document.getElementById('writersBody');
  const empty=document.getElementById('emptyState');
  if(!list.length){
    body.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  body.innerHTML=list.map(a=>`
    <tr>
      <td><div class="author-cell"><img src="${a.avatar}" alt=""/><div><div class="author-name">${a.name}</div><div class="author-email">${a.email}</div></div></div></td>
      <td><span style="font-family:monospace;font-weight:700;letter-spacing:.06em;background:var(--table-head,#faf9ff);padding:4px 8px;border-radius:6px;border:1px solid var(--border,#eceaf5)">${a.code}</span></td>
      <td style="white-space:nowrap">${fmtDate(a.signedUp)}</td>
      <td><span class="status-badge active">Active</span></td>
    </tr>
  `).join('');
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
    if(!confirm('Regenerate your referral code? Old links with the previous code will stop working.')) return;
    const newCode=genCode();
    setCode(newCode);
    // update existing demo authors to new code? keep history, new signups use new code
    toast('New code generated: '+newCode);
  });
  document.getElementById('searchInput').addEventListener('input', filterAndRender);
  document.getElementById('sortSelect').addEventListener('change', filterAndRender);
  document.getElementById('exportBtn').addEventListener('click',()=>{
    if(!authors.length) return toast('Nothing to export');
    const csv=['Name,Email,Code,SignedUp,Status'].concat(authors.map(a=>`"${a.name}","${a.email}","${a.code}","${a.signedUp}","${a.status}"`)).join('\n');
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

function init(){
  if(_inited) return;
  _inited = true;
  attachShell();
  // For demo: simulate a writer signup via this referral to test auto-assign
  window._simulateWriterSignup = function(name,email){
    const code=getCode();
    const entry={id:'WR-'+Date.now(), name:name||'New Writer '+Math.floor(Math.random()*1000), email:email||'writer'+Date.now()+'@example.com', avatar:'https://i.pravatar.cc/100?img='+(Math.floor(Math.random()*70)+1), code:code, signedUp:new Date().toISOString(), status:'active'};
    authors.unshift(entry); saveAuthors(authors); renderStats(); filterAndRender(); toast('Writer auto-assigned to you!');
    return entry;
  };
  // Also handle if someone lands on signup with ?ref param — store for later assignment (demo helper)
  handleIncomingRef();
  bindEvents();
  renderCode();
  renderStats();
  filterAndRender();
}

window.InviteAuthorsService = { init: init };

})();
