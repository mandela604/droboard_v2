/**
 * all-books-service.js — All Books page controller.
 * All data from live API. No hardcoded book arrays.
 */
(function(){
'use strict';
const API_BASE = '/api/super-admin/books';

const shell = SuperAdminSidebar.attach('#booksRoot', {
  activeItem: 'all-books',
  title: 'All Books',
  subtitle: 'Browse every title on the platform',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };
const GENRE_COLORS = { Romance:'red', Fantasy:'purple', Thriller:'blue', 'Sci-Fi':'blue', Horror:'red', Drama:'amber', Werewolf:'purple', 'Teen Fiction':'green', Mystery:'gold' };

let allBooks = [];
let filtered = [];
let page = 1;
const pageSize = 12;
let density = 'normal';

function fmtNum(n){
  if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if(n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return String(n||0);
}
function money(n){
  if(window.DroboardCurrency && DroboardCurrency.usdToMoney) return DroboardCurrency.usdToMoney(n);
  return '$' + fmtNum(Number(n) || 0);
}
function fmtDays(d){
  if(!d && d!==0) return '—';
  if(d===0) return 'Today';
  if(d===1) return 'Yesterday';
  if(d<30) return d+'d ago';
  if(d<365) return Math.floor(d/30)+'mo ago';
  return Math.floor(d/365)+'y ago';
}
function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showError(msg){
  document.getElementById('bookList').innerHTML='<div class="empty-state" style="color:var(--red)"><i class="fas fa-circle-exclamation"></i>'+esc(msg)+'</div>';
}

function renderStatCards(){
  const total = allBooks.length;
  const published = allBooks.filter(b=>b.status==='published').length;
  const flagged = allBooks.filter(b=>b.status==='flagged').length;
  const totalRevenue = allBooks.reduce((s,b)=>s+(b.revenue||0),0);
  const stats = [
    { n: fmtNum(total), l:'Total Books', ico:'fa-book-open', cls:'gold' },
    { n: fmtNum(published), l:'Published', ico:'fa-circle-check', cls:'green' },
    { n: flagged, l:'Flagged for Review', ico:'fa-flag', cls:'red' },
    { n: money(totalRevenue), l:'Total Revenue (est.)', ico:'fa-sack-dollar', cls:'blue' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:'+BG_MAP[s.cls]+';color:'+ICO_MAP[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>';
  }).join('');
}

function populateGenreFilter(){
  const genres = [...new Set(allBooks.map(b=>b.genre).filter(Boolean))].sort();
  document.getElementById('genreFilter').innerHTML = '<option value="">All Genres</option>' +
    genres.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const genre = document.getElementById('genreFilter').value;
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;

  filtered = allBooks.filter(b=>{
    if(q && !(b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || (b.id||'').includes(q))) return false;
    if(genre && b.genre !== genre) return false;
    if(status && b.status !== status) return false;
    return true;
  });

  if(sort==='reads') filtered.sort((a,b)=>(b.reads||0)-(a.reads||0));
  else if(sort==='recent') filtered.sort((a,b)=>(a.updatedDays||0)-(b.updatedDays||0));
  else if(sort==='title') filtered.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
  else if(sort==='revenue') filtered.sort((a,b)=>(b.revenue||0)-(a.revenue||0));

  page = 1;
  renderList();
}

function renderList(){
  const start = (page-1)*pageSize;
  const pageItems = filtered.slice(start, start+pageSize);
  const listEl = document.getElementById('bookList');
  listEl.className = density==='dense' ? 'dense' : '';

  if(!pageItems.length){
    listEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i>No books match your filters.</div>`;
  } else {
    const gc = GENRE_COLORS;
    listEl.innerHTML = pageItems.map(function(b){
      const gcls = gc[b.genre] || 'blue';
      return '<div class="book-row">'
        + '<div class="book-main"><img class="book-thumb" src="'+esc(b.cover||'')+'" alt=""/><div class="book-info"><div class="book-title">'+esc(b.title||'')+'</div><div class="book-meta">by <a href="#">'+esc(b.author||'')+'</a> · '+(b.chapters||0)+' ch · '+esc(b.id||'')+'</div></div></div>'
        + '<div class="col-hide"><span class="genre-chip" style="background:'+BG_MAP[gcls]+';color:'+ICO_MAP[gcls]+'">'+esc(b.genre||'')+'</span></div>'
        + '<div><span class="status-chip '+(b.status||'')+'"><i class="fas fa-circle"></i>'+(b.status||'')+'</span></div>'
        + '<div class="col-hide num-cell">'+fmtNum(b.reads||0)+'</div>'
        + '<div class="col-hide num-cell faint">★ '+(b.rating||0)+'</div>'
        + '<div class="num-cell">'+money(b.revenue||0)+'</div>'
        + '<div class="col-hide" style="font-size:11px;color:var(--text-faint)">'+fmtDays(b.updatedDays)+'</div>'
        + '<div class="row-actions">'
        + '<a class="icon-btn" href="../author/book-workspace.html?book='+esc(b.id)+'" title="View book"><i class="fas fa-eye"></i></a>'
        + '</div></div>';
    }).join('');
  }
  renderFooter();
}

function renderFooter(){
  const total = filtered.length;
  const start = total === 0 ? 0 : (page-1)*pageSize+1;
  const end = Math.min(page*pageSize, total);
  document.getElementById('footerInfo').textContent = `Showing ${start}–${end} of ${fmtNum(total)} books`;

  const totalPages = Math.max(1, Math.ceil(total/pageSize));
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
      const totalPages2 = Math.max(1, Math.ceil(filtered.length/pageSize));
      if(p==='prev') page = Math.max(1, page-1);
      else if(p==='next') page = Math.min(totalPages2, page+1);
      else page = parseInt(p,10);
      renderList();
      document.querySelector('.panel').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('genreFilter').addEventListener('change', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);
document.querySelectorAll('#densitySeg button').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('#densitySeg button').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    density = btn.dataset.density;
    renderList();
  });
});

async function init(){
  try {
    const res = await fetch(API_BASE + '?limit=500', { credentials:'include' });
    if(!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    allBooks = Array.isArray(data) ? data : (data.items || []);
    renderStatCards();
    populateGenreFilter();
    document.getElementById('sortFilter').value = 'reads';
    applyFilters();
  } catch(e) {
    showError('Failed to load books: ' + e.message);
  }
}
init();
})();
