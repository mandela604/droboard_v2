/**
 * all-books-service.js — All Books page controller (call-and-render).
 * Extracted VERBATIM from all-books.html inline <script>; NO renames, NO refactors, NO behavior changes.
 * Browse every title on the platform (2400-book generated catalog, filters, pagination, flag toggle).
 * Backend-ready (pattern only): flip USE_API to true and point API_BASE at the real
 * endpoint when the backend lands. No HTML change required.
 */
(function(){
/* Pattern-only backend switch — page currently renders from local data below. */
const USE_API = false, API_BASE = '/api';
'use strict';
const shell = SuperAdminSidebar.attach('#booksRoot', {
  activeItem: 'all-books',
  title: 'All Books',
  subtitle: 'Browse every title on the platform',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

function toast(m){
  var t=document.getElementById('toastEl');
  if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(16px);background:var(--text);color:#fff;padding:10px 18px;border-radius:28px;font-size:12.5px;font-weight:700;z-index:900;opacity:0;transition:.28s;pointer-events:none;white-space:nowrap;max-width:88vw;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.25)';document.body.appendChild(t);}
  t.textContent=m;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},2400);
}

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };
const GENRE_COLORS = { Romance:'red', Fantasy:'purple', Thriller:'blue', 'Sci-Fi':'blue', Horror:'red', 'Drama':'amber', 'Werewolf':'purple', 'Teen Fiction':'green', 'Mystery':'gold' };

/* ─────────────────────────────────────────
   MOCK DATASET GENERATOR — simulates a platform-scale catalog
───────────────────────────────────────── */
const GENRES = Object.keys(GENRE_COLORS);
const STATUSES = ['published','published','published','published','draft','paused','flagged'];
const TITLE_WORDS_A = ['Midnight','Broken','Silver','Wicked','Forbidden','Crimson','Shattered','Golden','Reckless','Fated','Stolen','Hollow','Velvet','Savage','Lost'];
const TITLE_WORDS_B = ['Vow','Heart','Kingdom','Bride','Alpha','Duke','Bloodline','Contract','Obsession','Legacy','Promise','Throne','Rebellion','Whisper','Storm'];
const AUTHORS = ['Zara_M','Marcus Webb Jr.','Nadia Cross','Kelo Writes','R.K. Vance','Ife Solarin','Diego Marsh','Lena Okafor','TJ Rourke','Aminah Cole','Chidi Blackwood','Priya Nandan'];

function generateBooks(n){
  const out = [];
  for(let i=0;i<n;i++){
    const title = `${TITLE_WORDS_A[i%TITLE_WORDS_A.length]} ${TITLE_WORDS_B[(i*7)%TITLE_WORDS_B.length]}`;
    const genre = GENRES[i % GENRES.length];
    const status = STATUSES[i % STATUSES.length];
    const reads = Math.floor(Math.pow((i%500)+1, 2.1) * 3.7) + Math.floor(Math.random()*400);
    const rating = (3.4 + ((i*13)%16)/10).toFixed(1);
    const revenue = Math.round(reads * 0.012 * (0.5+Math.random()));
    const daysAgo = i % 240;
    out.push({
      id: 'bk-'+(100000+i),
      title, author: AUTHORS[i % AUTHORS.length], genre, status,
      reads, rating: Math.min(5, parseFloat(rating)), revenue,
      chapters: 12 + (i%180),
      updatedDays: daysAgo,
      cover: `https://picsum.photos/seed/book${i}/80/110`,
    });
  }
  return out;
}

const ALL_BOOKS = generateBooks(2400); // simulated slice of a much larger (100k+) catalog
let filtered = ALL_BOOKS.slice();
let page = 1;
let pageSize = 12;
let density = 'normal';

function fmtNum(n){
  if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if(n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return n.toString();
}
function fmtDays(d){
  if(d===0) return 'Today';
  if(d===1) return 'Yesterday';
  if(d<30) return d+'d ago';
  if(d<365) return Math.floor(d/30)+'mo ago';
  return Math.floor(d/365)+'y ago';
}

function renderStatCards(){
  const total = ALL_BOOKS.length;
  const published = ALL_BOOKS.filter(b=>b.status==='published').length;
  const flagged = ALL_BOOKS.filter(b=>b.status==='flagged').length;
  const totalRevenue = ALL_BOOKS.reduce((s,b)=>s+b.revenue,0);
  const stats = [
    { n: fmtNum(total)+'+', l:'Total Books', ico:'fa-book-open', cls:'gold' },
    { n: fmtNum(published), l:'Published', ico:'fa-circle-check', cls:'green' },
    { n: flagged, l:'Flagged for Review', ico:'fa-flag', cls:'red' },
    { n: '$'+fmtNum(totalRevenue), l:'Total Revenue (est.)', ico:'fa-sack-dollar', cls:'blue' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:'+BG_MAP[s.cls]+';color:'+ICO_MAP[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>';
  }).join('');
}

function populateGenreFilter(){
  document.getElementById('genreFilter').innerHTML = '<option value="">All Genres</option>' +
    GENRES.map(g=>`<option value="${g}">${g}</option>`).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const genre = document.getElementById('genreFilter').value;
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;

  filtered = ALL_BOOKS.filter(b=>{
    if(q && !(b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.id.includes(q))) return false;
    if(genre && b.genre !== genre) return false;
    if(status && b.status !== status) return false;
    return true;
  });

  if(sort==='reads') filtered.sort((a,b)=>b.reads-a.reads);
  else if(sort==='recent') filtered.sort((a,b)=>a.updatedDays-b.updatedDays);
  else if(sort==='title') filtered.sort((a,b)=>a.title.localeCompare(b.title));
  else if(sort==='revenue') filtered.sort((a,b)=>b.revenue-a.revenue);

  page = 1;
  renderList();
}

function renderList(){
  const start = (page-1)*pageSize;
  const pageItems = filtered.slice(start, start+pageSize);
  const listEl = document.getElementById('bookList');
  listEl.className = density==='dense' ? 'dense' : '';

  if(pageItems.length === 0){
    listEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i>No books match your filters.</div>`;
  } else {
    listEl.innerHTML = pageItems.map(function(b){
      return '<div class="book-row">'
        + '<div class="book-main"><img class="book-thumb" src="'+b.cover+'" alt=""/><div class="book-info"><div class="book-title">'+b.title+'</div><div class="book-meta">by <a href="#">'+b.author+'</a> · '+b.chapters+' ch · '+b.id+'</div></div></div>'
        + '<div class="col-hide"><span class="genre-chip" style="background:'+BG_MAP[GENRE_COLORS[b.genre]]+';color:'+ICO_MAP[GENRE_COLORS[b.genre]]+'">'+b.genre+'</span></div>'
        + '<div><span class="status-chip '+b.status+'"><i class="fas fa-circle"></i>'+b.status+'</span></div>'
        + '<div class="col-hide num-cell">'+fmtNum(b.reads)+'</div>'
        + '<div class="col-hide num-cell faint">\u2605 '+b.rating+'</div>'
        + '<div class="num-cell">$'+fmtNum(b.revenue)+'</div>'
        + '<div class="col-hide" style="font-size:11px;color:var(--text-faint)">'+fmtDays(b.updatedDays)+'</div>'
        + '<div class="row-actions">'
        + '<a class="icon-btn" href="../author/book-workspace.html?book='+b.id+'" title="View book"><i class="fas fa-eye"></i></a>'
        + '<div class="row-menu"><button class="row-menu-btn" data-action="toggle-menu" data-id="'+b.id+'" title="More"><i class="fas fa-ellipsis-vertical"></i></button>'
        + '<div class="dropdown" id="menu-'+b.id+'">'
        + '<a class="dropdown-item" href="../author/book-workspace.html?book='+b.id+'"><i class="fas fa-eye"></i> View Book</a>'
        + '<a class="dropdown-item" href="../author/book-workspace.html?book='+b.id+'&mode=edit"><i class="fas fa-pen"></i> Edit Book</a>'
        + '<div class="dropdown-item danger" data-action="flag" data-id="'+b.id+'"><i class="fas fa-flag"></i> Flag for Review</div>'
        + '</div></div></div>'
        + '</div>';
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

document.addEventListener('click', function(e){
  var btn = e.target.closest('[data-action="toggle-menu"]');
  if(btn){
    e.stopPropagation();
    var id = btn.dataset.id;
    document.querySelectorAll('.dropdown.open').forEach(function(d){ if(d.id!=='menu-'+id) d.classList.remove('open'); });
    document.getElementById('menu-'+id).classList.toggle('open');
    return;
  }
  var flagBtn = e.target.closest('[data-action="flag"]');
  if(flagBtn){
    var bookId = flagBtn.dataset.id;
    var book = ALL_BOOKS.find(function(b){return b.id===bookId;});
    if(book){
      book.status = book.status==='flagged' ? 'published' : 'flagged';
      toast(book.title+(book.status==='flagged'?' flagged':' unflagged'));
      renderStatCards(); applyFilters();
    }
    return;
  }
  document.querySelectorAll('.dropdown.open').forEach(function(d){ d.classList.remove('open'); });
});

function init(){
  renderStatCards();
  populateGenreFilter();
  document.getElementById('sortFilter').value = 'reads';
  applyFilters();
}
init();
/* Window exports: none required — no inline onclick in markup or generated templates
 * references page functions (all-posts.html uses only native event.stopPropagation();
 * all other wiring is via addEventListener/delegation). Nothing exported by design. */
})();
