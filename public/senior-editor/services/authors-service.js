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

var shell = null;
var _inited = false;

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const PAGE_SIZE = 5;
let usingDemoData = false;

let AUTHORS = [];
let currentPage = 1;
let expandedId = null;

function attachShell(){
  shell = SeniorEditorSidebar.attach('#authorsRoot',{
    activeItem:'authors', title:'Authors', subtitle:'Manage invited and assigned authors',
    user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'}, notifCount:4,
    searchPlaceholder:'Search authors…',
    onSearch:(v)=>{ document.getElementById('authorSearch').value = v; currentPage = 1; renderAuthors(); }
  });
}

/* ─────────────────────────────────────────
   LOAD DATA — backend first (scoped to THIS editor's assigned authors),
   demo fallback.
───────────────────────────────────────── */
// Backend returns plain users; the page expects the richer demo author shape.
function mapBackendAuthor(u){
  return {
    id: u.id, name: u.fullName || u.username || '', username: u.username || '',
    email: u.email || '', avatar: u.avatar || '',
    genre: (u.genres && u.genres[0]) || u.authorGenre || '—',
    stories: u.books || 0,
    earnings: u.earnings || '—',
    source: u.via ? (u.via === 'assigned' ? 'assigned' : 'invited') : 'assigned',
    status: u.status || 'active',
    warnings: u.warnings || 0,
    joined: u.createdAt
      ? new Date(u.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
      : '—',
  };
}

/* Referred writers live in the same localStorage store as Invite Authors;
   that service exposes them even when its own page hasn't been opened. */
function referredWriters(){
  try{
    const svc = window.InviteAuthorsService;
    return svc && typeof svc.getWriters === 'function' ? (svc.getWriters() || []) : [];
  }catch(e){ return []; }
}
function mapReferredWriter(w){
  const via = w.via || 'invite';
  return {
    id: w.id, name: w.name || w.fullName || w.username || '', username: w.username || '',
    email: w.email || '', avatar: w.avatar || 'https://i.pravatar.cc/100?img=0',
    genre: '—', stories: 0, earnings: '—', warnings: 0,
    status: w.status || 'active',
    source: via === 'assigned' ? 'assigned' : 'invited',
    joined: w.signedUp
      ? new Date(w.signedUp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
      : '—',
  };
}
function authorKey(a){
  return String(a.email || '').trim().toLowerCase() || ('id:' + a.id);
}
function mergeAuthors(assigned, referred){
  const map = new Map();
  assigned.forEach(a => map.set(authorKey(a), a));
  referred.forEach(w => {
    const key = authorKey(w);
    const existing = map.get(key);
    if(!existing){ map.set(key, w); return; }
    map.set(key, Object.assign({}, existing, {
      source: w.source,
      joined: existing.joined && existing.joined !== '—' ? existing.joined : w.joined,
      avatar: existing.avatar || w.avatar,
    }));
  });
  return Array.from(map.values());
}

async function loadAuthors(){
  let assigned = [];
  try{
    const remote = await callBackend('/authors?limit=100');
    if (remote && remote.items) {
      assigned = remote.items.map(mapBackendAuthor);
      usingDemoData = false;
    } else {
      const data = await SeniorEditorData.getAuthors();
      assigned = (Array.isArray(data) ? data : (data.authors || []))
        .map(a => Object.assign({}, a, { source:'assigned' }));
      usingDemoData = false;
    }
  }catch(err){
    console.warn('Authors data unavailable:', err.message);
    usingDemoData = true;
  }
  AUTHORS = mergeAuthors(assigned, referredWriters().map(mapReferredWriter));
  populateGenreFilter();
  renderStats();
  renderAuthors();
}

function populateGenreFilter(){
  const genres = [...new Set(AUTHORS.map(a=>a.genre))];
  document.getElementById('genreFilter').innerHTML = '<option value="">All Genres</option>' + genres.map(g=>`<option value="${g}">${g}</option>`).join('');
}

/* ─────────────────────────────────────────
   STATS
───────────────────────────────────────── */
function renderStats(){
  const invited = AUTHORS.filter(a=>a.source==='invited').length;
  const assigned = AUTHORS.filter(a=>a.source==='assigned').length;
  const active = AUTHORS.filter(a=>a.status==='active').length;
  const suspended = AUTHORS.filter(a=>a.status==='suspended').length;
  const totalWarnings = AUTHORS.reduce((s,a)=>s+a.warnings,0);
  const stats = [
    { n:AUTHORS.length, l:'Total Authors', ico:'fa-users', cls:'accent' },
    { n:invited, l:'Invited Authors', ico:'fa-link', cls:'blue' },
    { n:assigned, l:'Assigned Authors', ico:'fa-user-tie', cls:'purple' },
    { n:active, l:'Active', ico:'fa-circle-check', cls:'green' },
    { n:suspended, l:'Suspended', ico:'fa-ban', cls:'red' },
    { n:totalWarnings, l:'Warnings Issued', ico:'fa-triangle-exclamation', cls:'amber' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:var(--${s.cls}-bg,rgba(0,0,0,.05));color:var(--${s.cls})"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   FILTERING + PAGINATION
───────────────────────────────────────── */
function getFiltered(){
  const q = document.getElementById('authorSearch').value.trim().toLowerCase();
  const src = document.getElementById('sourceFilter').value;
  const g = document.getElementById('genreFilter').value;
  const st = document.getElementById('statusFilter').value;
  return AUTHORS.filter(a=>{
    const matchesQ = !q || a.name.toLowerCase().includes(q);
    const matchesSrc = !src || a.source===src;
    const matchesG = !g || a.genre===g;
    const matchesSt = !st || a.status===st;
    return matchesQ && matchesSrc && matchesG && matchesSt;
  });
}

function renderAuthors(){
  const results = getFiltered();
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage-1)*PAGE_SIZE;
  const pageItems = results.slice(start, start+PAGE_SIZE);

  document.getElementById('authorCount').textContent = `${results.length} of ${AUTHORS.length}`;
  const box = document.getElementById('authorList');

  if(!results.length){
    box.innerHTML = `<div class="empty-msg">No authors match your search.</div>`;
    document.getElementById('paginationBar').innerHTML = '';
    return;
  }

  box.innerHTML = pageItems.map(a=>{
    const open = expandedId===a.id;
    return `
    <div class="lib-row" data-id="${a.id}">
      <div class="lib-row-main" data-action="toggle-row" data-id="${a.id}">
        <img class="lib-cover" src="${a.avatar}" alt="${a.name}"/>
        <div class="lib-info">
          <div class="lib-title">${a.name} <span class="status-pill ${a.status}">${a.status}</span> ${a.source==='invited'
            ? '<span class="via-pill invited" title="Signed up with your referral code or link"><i class="fas fa-link"></i>Invited</span>'
            : '<span class="via-pill assigned" title="Placed under you by the Chief Editor"><i class="fas fa-user-tie"></i>Assigned</span>'} ${a.warnings>0?`<span class="warn-badge"><i class="fas fa-triangle-exclamation"></i>${a.warnings}</span>`:''}</div>
          <div class="lib-meta">${a.genre!=='—'?`${a.genre} · `:''}${a.stories} stories · ${a.earnings!=='—'?`💰 ${a.earnings}`:`Joined ${a.joined}`}</div>
        </div>
        <i class="fas fa-chevron-down chevron${open?' open':''}"></i>
      </div>
      <div class="lib-config${open?' open':''}">
        <div class="mm-grid">
          <div class="mm-item"><div class="mm-lbl">Status</div><div class="mm-val"><span class="status-pill ${a.status}" style="font-size:10px;padding:3px 10px">${a.status}</span></div></div>
          <div class="mm-item"><div class="mm-lbl">Source</div><div class="mm-val" style="font-size:12px">${a.source==='invited'?'Invited by you':'Assigned by Chief'}</div></div>
          <div class="mm-item"><div class="mm-lbl">Stories</div><div class="mm-val">${a.stories}</div></div>
          <div class="mm-item"><div class="mm-lbl">Earnings</div><div class="mm-val">${a.earnings}</div></div>
          <div class="mm-item"><div class="mm-lbl">Genre</div><div class="mm-val" style="font-size:12px">${a.genre}</div></div>
          <div class="mm-item"><div class="mm-lbl">Joined</div><div class="mm-val" style="font-size:12px">${a.joined}</div></div>
        </div>
        <div class="lib-config-actions">
          <div class="action-btns">
            <button class="mini-btn" data-action="message" data-name="${a.name}" data-email="${a.email}" data-id="${a.id}"><i class="fas fa-envelope"></i> Send Message</button>
          </div>
          <a class="profile-link" href="profile.html?id=${a.id}">View full profile <i class="fas fa-arrow-right"></i></a>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination(totalPages, results.length, start, pageItems.length);
}

function renderPagination(totalPages, totalResults, start, shownCount){
  const bar = document.getElementById('paginationBar');
  if(totalResults <= PAGE_SIZE){ bar.innerHTML = ''; return; }
  const from = totalResults ? start+1 : 0;
  const to = start+shownCount;

  let pageBtns = '';
  for(let p=1; p<=totalPages; p++){
    if(totalPages>7 && p!==1 && p!==totalPages && Math.abs(p-currentPage)>1){
      if(p===2 || p===totalPages-1) pageBtns += `<span style="padding:0 4px;color:var(--text-faint)">…</span>`;
      continue;
    }
    pageBtns += `<button class="page-btn${p===currentPage?' active':''}" data-action="goto-page" data-page="${p}">${p}</button>`;
  }

  bar.innerHTML = `
    <div class="pagination-info">Showing ${from}–${to} of ${totalResults}</div>
    <div class="pagination-controls">
      <button class="page-btn" data-action="prev-page" ${currentPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
      ${pageBtns}
      <button class="page-btn" data-action="next-page" ${currentPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>
    </div>`;
}

/* ─────────────────────────────────────────
   EVENT DELEGATION
───────────────────────────────────────── */
function onDocClick(e){
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  if(action==='toggle-row'){ expandedId = expandedId===id ? null : id; renderAuthors(); }
  else if(action==='message'){ window.location.href='author-messages.html'+(el.dataset.name?'?u='+encodeURIComponent(el.dataset.name):''); }
  else if(action==='goto-page'){ currentPage = parseInt(el.dataset.page,10); renderAuthors(); window.scrollTo({top:0,behavior:'smooth'}); }
  else if(action==='prev-page'){ if(currentPage>1){ currentPage--; renderAuthors(); } }
  else if(action==='next-page'){ currentPage++; renderAuthors(); }
}

function bindEvents(){
  document.addEventListener('click', onDocClick);
  document.getElementById('authorSearch').addEventListener('input', ()=>{ currentPage=1; renderAuthors(); });
  document.getElementById('sourceFilter').addEventListener('change', ()=>{ currentPage=1; renderAuthors(); });
  document.getElementById('genreFilter').addEventListener('change', ()=>{ currentPage=1; renderAuthors(); });
  document.getElementById('statusFilter').addEventListener('change', ()=>{ currentPage=1; renderAuthors(); });
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function init(){
  if(_inited) return;
  _inited = true;
  attachShell();
  bindEvents();
  loadAuthors();
}

window.AuthorsService = { init: init };

})();
