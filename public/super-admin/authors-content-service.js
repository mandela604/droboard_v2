/**
 * authors-content-service.js — Data layer for Authors & Content page
 * Reads from window.AdminDemo.AUTHORS_*
 * Falls back to empty arrays if demo data is missing.
 * Backend-ready: swap USE_API=true, no HTML change.
 */
(function(){
'use strict';
if(window.__authorsContentService) return;
window.__authorsContentService = true;

/* Demo-data self-load: page HTML no longer includes data/admin-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.AdminDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="data/admin-demo-data.js"><\/script>');
}

var USE_API = false;
var API_BASE = window.DROBOARD_API_BASE || '/api/super-admin/authors-content';
var TIMEOUT_MS = 2500;
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

var _authors = [];
var _genreColors = {};
var _genres = [];

function loadFromDemo(){
  var D = window.AdminDemo || {};
  _authors = JSON.parse(JSON.stringify(D.AUTHORS_AUTHORS || []));
  _genreColors = D.AUTHORS_GENRE_COLORS || {};
  _genres = D.AUTHORS_GENRES || [];
}
loadFromDemo();
/* Data script self-injected above executes after this file — re-sync once parsed (renders only, no re-bind). */
if(!_authors.length) window.addEventListener('DOMContentLoaded', function(){ loadFromDemo(); renderStatCards(); applyFilters(); renderGenreBreakdown(); });

function authors(){ return _authors; }
function genreColors(){ return _genreColors; }
function genres(){ return _genres; }

function byId(id){ return _authors.find(function(a){ return a.id === id; }); }

function stats(){
  var total = _authors.length;
  var active = _authors.filter(function(a){ return a.status==='active'; }).length;
  var pending = _authors.filter(function(a){ return a.status==='pending'; }).length;
  var suspended = _authors.filter(function(a){ return a.status==='suspended'; }).length;
  var totalBooks = _authors.reduce(function(s,a){ return s+a.books; },0);
  var totalRevenue = _authors.reduce(function(s,a){ return s+a.revenue; },0);
  return { total:total, active:active, pending:pending, suspended:suspended, totalBooks:totalBooks, totalRevenue:totalRevenue };
}

function search(query, status, sort){
  var q = (query||'').toLowerCase();
  var list = _authors.filter(function(a){
    var matchQ = !q || a.name.toLowerCase().indexOf(q)!==-1 || a.id.indexOf(q)!==-1;
    var matchS = !status || a.status === status;
    return matchQ && matchS;
  });
  if(sort==='reads') list.sort(function(a,b){ return b.reads-a.reads; });
  else if(sort==='revenue') list.sort(function(a,b){ return b.revenue-a.revenue; });
  else if(sort==='books') list.sort(function(a,b){ return b.books-a.books; });
  else if(sort==='recent') list.sort(function(a,b){ return a.joinedDaysAgo-b.joinedDaysAgo; });
  else if(sort==='name') list.sort(function(a,b){ return a.name.localeCompare(b.name); });
  return list;
}

function updateAuthor(id, changes){
  var a = byId(id);
  if(!a) return null;
  if(changes.status) a.status = changes.status;
  if(changes.verified !== undefined) a.verified = changes.verified;
  if(changes.genre) a.genre = changes.genre;
  return a;
}

function deleteAuthor(id){
  var idx = _authors.findIndex(function(a){ return a.id === id; });
  if(idx === -1) return null;
  return _authors.splice(idx, 1)[0];
}

function genreBreakdown(){
  var counts = {};
  _genres.forEach(function(g){ counts[g]=0; });
  _authors.forEach(function(a){ if(counts[a.genre] !== undefined) counts[a.genre]++; });
  return counts;
}

window.__authorsContentAPI = {
  authors: authors,
  genreColors: genreColors,
  genres: genres,
  byId: byId,
  stats: stats,
  search: search,
  updateAuthor: updateAuthor,
  deleteAuthor: deleteAuthor,
  genreBreakdown: genreBreakdown
};

})();

/* ═══════════════════════════════════════════════════════════════════
 * PAGE CONTROLLER — moved VERBATIM from authors-content.html inline <script>
 * Calls window.__authorsContentAPI + SuperAdminSidebar.attach and renders.
 * NO renames / NO refactors — behavior unchanged.
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';

const API = window.__authorsContentAPI;

const shell = SuperAdminSidebar.attach('#authorsRoot', {
  activeItem: 'authors-content',
  title: 'Authors & Content',
  subtitle: 'Roster and content health',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

function toast(m){
  const t=document.getElementById('toastEl');
  t.textContent=m;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},2400);
}

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

let filtered = [];
let page = 1;
const PAGE_SIZE = 15;

function fmtNum(n){
  if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if(n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return n.toString();
}
function fmtDays(d){
  if(d<30) return d+'d ago';
  if(d<365) return Math.floor(d/30)+'mo ago';
  return Math.floor(d/365)+'y ago';
}

function renderStatCards(){
  const s = API.stats();
  const stats = [
    { n: fmtNum(s.total)+'+', l:'Total Authors', ico:'fa-user-pen', cls:'gold' },
    { n: fmtNum(s.active), l:'Active Authors', ico:'fa-circle-check', cls:'green' },
    { n: fmtNum(s.totalBooks), l:'Published Books', ico:'fa-book-open', cls:'blue' },
    { n: '$'+fmtNum(s.totalRevenue), l:'Author Revenue (est.)', ico:'fa-sack-dollar', cls:'purple' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="kpi-card">
      <div class="kpi-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="kpi-num">${s.n}</div><div class="kpi-lbl">${s.l}</div></div>
    </div>`).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim();
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;
  filtered = API.search(q, status, sort);
  page = 1;
  renderList();
}

function renderList(){
  const start = (page-1)*PAGE_SIZE;
  const pageItems = filtered.slice(start, start+PAGE_SIZE);
  const listEl = document.getElementById('authorList');
  const gc = API.genreColors();

  if(pageItems.length === 0){
    listEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i>No authors match your filters.</div>`;
  } else {
    listEl.innerHTML = pageItems.map(a=>{
      const colorKey = gc[a.genre] ? Object.keys(ICO_MAP).find(k=>ICO_MAP[k]===gc[a.genre]) || 'gold' : 'gold';
      return `
      <div class="author-row" data-id="${a.id}">
        <div class="author-main">
          <img class="a-avatar" src="${a.avatar}" alt=""/>
          <div class="a-info">
            <div class="a-name">${a.name} ${a.verified?'<i class="fas fa-badge-check verified" title="Verified"></i>':''}</div>
            <div class="a-meta">${a.id}</div>
          </div>
        </div>
        <div class="col-hide num-cell faint">${a.books}</div>
        <div class="col-hide num-cell">${fmtNum(a.reads)}</div>
        <div class="num-cell">$${fmtNum(a.revenue)}</div>
        <div class="col-hide"><span class="genre-pill" style="background:${BG_MAP[colorKey]};color:${ICO_MAP[colorKey]}">${a.genre}</span></div>
        <div><span class="status-chip ${a.status}"><i class="fas fa-circle"></i>${a.status}</span></div>
        <div class="col-hide" style="font-size:11px;color:var(--text-faint)">${fmtDays(a.joinedDaysAgo)}</div>
        <div class="row-actions">
          <a class="icon-btn" href="../Pages/profile.html?id=${a.id}" title="View profile"><i class="fas fa-eye"></i></a>
          <div class="row-menu">
            <button class="row-menu-btn" data-action="toggle-menu" data-id="${a.id}" title="More actions"><i class="fas fa-ellipsis-vertical"></i></button>
            <div class="dropdown" id="menu-${a.id}">
              <div class="dropdown-item" data-action="view" data-id="${a.id}"><i class="fas fa-eye"></i> View Profile</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  renderFooter();
}

function renderFooter(){
  const total = filtered.length;
  const start = total === 0 ? 0 : (page-1)*PAGE_SIZE+1;
  const end = Math.min(page*PAGE_SIZE, total);
  document.getElementById('footerInfo').textContent = `Showing ${start}–${end} of ${fmtNum(total)} authors`;

  const totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  let html = `<button ${page===1?'disabled':''} data-p="prev"><i class="fas fa-chevron-left"></i></button>`;
  const pagesToShow = new Set([1, totalPages, page, page-1, page+1]);
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pagesToShow.has(p)) continue;
    if(p - last > 1) html += `<span class="pager-gap">…</span>`;
    html += `<button data-p="${p}" class="${p===page?'active':''}">${p}</button>`;
    last = p;
  }
  html += `<button ${page===totalPages?'disabled':''} data-p="next"><i class="fas fa-chevron-right"></i></button>`;
  document.getElementById('pager').innerHTML = html;

  document.querySelectorAll('#pager button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = btn.dataset.p;
      const totalPages2 = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
      if(p==='prev') page = Math.max(1, page-1);
      else if(p==='next') page = Math.min(totalPages2, page+1);
      else page = parseInt(p,10);
      renderList();
      document.querySelector('.panel').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

function renderGenreBreakdown(){
  const counts = API.genreBreakdown();
  const genres = API.genres();
  const gc = API.genreColors();
  const max = Math.max(...Object.values(counts), 1);
  const total = Object.values(counts).reduce((s,v)=>s+v,0);
  document.getElementById('genreTotalChip').textContent = fmtNum(total) + ' authors';
  document.getElementById('genreBreakdown').innerHTML = genres.map(g=>{
    const pct = Math.round((counts[g]/max)*100);
    const color = gc[g] || '#888';
    return `<div class="genre-card">
      <div class="genre-card-top">
        <span class="genre-card-name">${g}</span>
        <span class="genre-card-count" style="color:${color}">${counts[g]}</span>
      </div>
      <div class="genre-bar-track"><div class="genre-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

document.getElementById('authorList').addEventListener('click', function(e){
  const menuBtn = e.target.closest('[data-action="toggle-menu"]');
  if(menuBtn){
    const id = menuBtn.dataset.id;
    const dropdown = document.getElementById('menu-'+id);
    document.querySelectorAll('.dropdown.open').forEach(function(d){ if(d!==dropdown) d.classList.remove('open'); });
    dropdown.classList.toggle('open');
    return;
  }
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  document.querySelectorAll('.dropdown.open').forEach(function(d){ d.classList.remove('open'); });
  if(action==='view'){
    window.location.href = '../Pages/profile.html?id='+id;
  }
});

document.addEventListener('click', function(e){
  if(!e.target.closest('.row-menu')) document.querySelectorAll('.dropdown.open').forEach(function(d){ d.classList.remove('open'); });
});

document.getElementById('exportBtn').addEventListener('click', function(){
  const rows = [['ID','Name','Status','Books','Reads','Revenue','Genre','Verified','Joined']];
  filtered.forEach(function(a){
    rows.push([a.id,a.name,a.status,a.books,a.reads,a.revenue,a.genre,a.verified?'Yes':'No',fmtDays(a.joinedDaysAgo)]);
  });
  const csv = rows.map(function(r){ return r.join(','); }).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'authors-export.csv'; link.click();
  URL.revokeObjectURL(url);
  toast('📥 CSV exported ('+filtered.length+' authors)');
});

function init(){
  renderStatCards();
  applyFilters();
  renderGenreBreakdown();
}
init();
