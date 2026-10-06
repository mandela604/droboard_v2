/**
 * services/categories-genres-service.js — Categories & Genres page logic (pure call-and-render).
 * categories-genres.html only loads this service + CategoriesGenresService.init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';
if (window.CategoriesGenresService) return;

const USE_API = false;
const API_BASE = '/api/editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[CategoriesGenresService] backend unavailable, using demo data', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { name:'Romance', icon:'fa-heart', bg:'#ffe1eb', color:'#ff0050', desc:'Stories about love, relationships, and emotional connections.', genres:17, books:'5,284', status:'active' },
  { name:'Billionaire', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', desc:'Billionaire and rich man romance stories filled with drama and passion.', genres:8, books:'2,156', status:'active' },
  { name:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', desc:'Werewolf, alpha, mate and pack stories.', genres:10, books:'1,896', status:'active' },
  { name:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', desc:'Vampire, bloodline, and immortal romance stories.', genres:7, books:'1,234', status:'active' },
  { name:'Fantasy', icon:'fa-wand-magic-sparkles', bg:'#ece3fd', color:'#7c5cfc', desc:'Magic, kingdoms, mythical creatures and epic adventures.', genres:11, books:'2,045', status:'active' },
  { name:'Mafia', icon:'fa-gun', bg:'#e7e7ea', color:'#26262b', desc:'Mafia, crime families, power and dangerous love.', genres:6, books:'1,102', status:'active' },
  { name:'Urban', icon:'fa-building', bg:'#e3ecfd', color:'#2f7de1', desc:'Modern life, city drama, and contemporary stories.', genres:7, books:'1,567', status:'active' },
  { name:'Marriage', icon:'fa-ring', bg:'#fef3d8', color:'#d97706', desc:'Marriage of convenience, arranged marriage and unions.', genres:6, books:'876', status:'active' },
  { name:'Revenge', icon:'fa-fire', bg:'#fde3e3', color:'#e0384d', desc:'Betrayal, comeuppance and long-awaited reckonings.', genres:5, books:'742', status:'active' },
  { name:'Second Chance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', desc:'Reunited lovers and rekindled relationships.', genres:4, books:'689', status:'inactive' },
];

const GENRES = [
  { name:'CEO Romance', cat:'Billionaire', icon:'fa-briefcase', bg:'#e3ecfd', color:'#2f7de1', books:'1,245', status:'active' },
  { name:'Alpha Romance', cat:'Werewolf', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', books:'987', status:'active' },
  { name:'Secret Baby', cat:'Romance', icon:'fa-shield', bg:'#fef3d8', color:'#d97706', books:'876', status:'active' },
  { name:'Enemies to Lovers', cat:'Romance', icon:'fa-heart-crack', bg:'#fde3e3', color:'#e0384d', books:'754', status:'active' },
  { name:'Second Chance', cat:'Romance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', books:'689', status:'active' },
  { name:'Royal Romance', cat:'Fantasy', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', books:'612', status:'active' },
  { name:'Mafia Romance', cat:'Mafia', icon:'fa-gun', bg:'#e7e7ea', color:'#26262b', books:'588', status:'active' },
  { name:'Vampire Romance', cat:'Vampire', icon:'fa-droplet', bg:'#fde3e3', color:'#e0384d', books:'503', status:'active' },
  { name:'Arranged Marriage', cat:'Marriage', icon:'fa-ring', bg:'#fef3d8', color:'#d97706', books:'411', status:'active' },
  { name:'Forbidden Love', cat:'Romance', icon:'fa-ban', bg:'#ffe1eb', color:'#ff0050', books:'298', status:'inactive' },
];

const POPULAR_GENRES = [
  { name:'CEO Romance', icon:'fa-briefcase', bg:'#e3ecfd', color:'#2f7de1', books:'1,245 books' },
  { name:'Alpha Romance', icon:'fa-paw', bg:'#eef0f2', color:'#5b6470', books:'987 books' },
  { name:'Secret Baby', icon:'fa-shield', bg:'#fef3d8', color:'#d97706', books:'876 books' },
  { name:'Enemies to Lovers', icon:'fa-heart-crack', bg:'#fde3e3', color:'#e0384d', books:'754 books' },
  { name:'Second Chance', icon:'fa-rotate-left', bg:'#ffe1eb', color:'#ff0050', books:'689 books' },
  { name:'Royal Romance', icon:'fa-crown', bg:'#ece3fd', color:'#7c5cfc', books:'612 books' },
];

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let currentView = 'categories';
let _bound = false;

function statusPillHtml(status){
  const active = status === 'active';
  return `<span class="status-pill${active?'':' inactive'}"><span class="dot"></span>${active?'Active':'Inactive'}</span>`;
}

function renderCategoriesTable(list){
  document.getElementById('tableHead').innerHTML = `<tr>
    <th>Category Name</th><th>Description</th><th>Genres</th><th>Books</th><th>Status</th><th>Actions</th>
  </tr>`;
  const body = document.getElementById('tableBody');
  if (!list.length){
    body.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fas fa-inbox"></i>No categories match this search.</td></tr>`;
    return;
  }
  body.innerHTML = list.slice(0,8).map(c => `
    <tr>
      <td data-label="Category Name">
        <div class="cat-cell">
          <div class="cat-icn" style="background:${c.bg};color:${c.color}"><i class="fas ${c.icon}"></i></div>
          <div class="cat-name">${c.name}</div>
        </div>
      </td>
      <td data-label="Description"><div class="cat-desc">${c.desc}</div></td>
      <td data-label="Genres" class="genre-count">${c.genres} genres</td>
      <td data-label="Books" class="plain-cell">${c.books}</td>
      <td data-label="Status">${statusPillHtml(c.status)}</td>
      <td data-label="Actions">
        <div class="actions-cell">
          <button class="act-btn" title="Edit" onclick="toast('Editing \\'${c.name}\\'…')"><i class="fas fa-pen"></i></button>
          <button class="act-btn" title="More" onclick="toast('More actions for \\'${c.name}\\'')"><i class="fas fa-ellipsis"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function renderGenresTable(list){
  document.getElementById('tableHead').innerHTML = `<tr>
    <th>Genre Name</th><th>Category</th><th>Books</th><th>Status</th><th>Actions</th>
  </tr>`;
  const body = document.getElementById('tableBody');
  if (!list.length){
    body.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fas fa-inbox"></i>No genres match this search.</td></tr>`;
    return;
  }
  body.innerHTML = list.slice(0,8).map(g => `
    <tr>
      <td data-label="Genre Name">
        <div class="cat-cell">
          <div class="cat-icn" style="background:${g.bg};color:${g.color}"><i class="fas ${g.icon}"></i></div>
          <div class="cat-name">${g.name}</div>
        </div>
      </td>
      <td data-label="Category" class="plain-cell">${g.cat}</td>
      <td data-label="Books" class="plain-cell">${g.books}</td>
      <td data-label="Status">${statusPillHtml(g.status)}</td>
      <td data-label="Actions">
        <div class="actions-cell">
          <button class="act-btn" title="Edit" onclick="toast('Editing \\'${g.name}\\'…')"><i class="fas fa-pen"></i></button>
          <button class="act-btn" title="More" onclick="toast('More actions for \\'${g.name}\\'')"><i class="fas fa-ellipsis"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function currentFiltered(){
  const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
  const source = currentView === 'categories' ? CATEGORIES : GENRES;
  if (!q) return source;
  return source.filter(x => x.name.toLowerCase().includes(q) || (x.desc && x.desc.toLowerCase().includes(q)) || (x.cat && x.cat.toLowerCase().includes(q)));
}

function refresh(){
  const list = currentFiltered();
  if (currentView === 'categories') renderCategoriesTable(list);
  else renderGenresTable(list);
  renderPageInfo(list.length);
}

function renderPageInfo(count){
  const label = currentView === 'categories' ? 'categories' : 'genres';
  const total = currentView === 'categories' ? 18 : 86;
  const shown = Math.min(8, count);
  document.getElementById('pageInfo').innerHTML = `Showing <b>1</b> to <b>${shown}</b> of <b>${total}</b> ${label}`;
}

/* ── Popular genres grid ── */
function renderPopularGenres(){
  document.getElementById('genreGrid').innerHTML = POPULAR_GENRES.map(g => `
    <div class="genre-card" onclick="toast('Opening \\'${g.name}\\'…')">
      <div class="genre-ico" style="background:${g.bg};color:${g.color}"><i class="fas ${g.icon}"></i></div>
      <div class="genre-name">${g.name}</div>
      <div class="genre-books">${g.books}</div>
      ${statusPillHtml('active')}
    </div>`).join('');
}

/* ── Pagination (visual, matches book-management.html pattern) ── */
function renderPagination(){
  const wrap = document.getElementById('pageBtns');
  const pages = currentView === 'categories' ? [1,2,3] : [1,2,3,4,5,'...',11];
  wrap.innerHTML = `<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>` +
    pages.map(p => p === '...' ? `<span class="pg-dots" style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>` : `<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('') +
    `<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>`;
  wrap.querySelectorAll('[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.pg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function bindEvents(){
  if (_bound) return; _bound = true;
  /* ── Top tab switching (Categories / Genres) ── */
  document.querySelectorAll('.top-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      document.getElementById('tableTitle').textContent = currentView === 'categories' ? 'All Categories' : 'All Genres';
      document.getElementById('addBtnLabel').textContent = currentView === 'categories' ? 'Add New Category' : 'Add New Genre';
      document.getElementById('tableSearch').placeholder = currentView === 'categories' ? 'Search categories...' : 'Search genres...';
      document.getElementById('tableSearch').value = '';
      renderPagination();
      refresh();
    });
  });
  /* ── Add button + search wiring ── */
  document.getElementById('addBtn').addEventListener('click', () => {
    toast(currentView === 'categories' ? 'Opening new category form…' : 'Opening new genre form…');
  });
  document.getElementById('tableSearch').addEventListener('input', refresh);
}

function attachShell(){
  DroboardShell.attach('#dashboardRoot', {
    activeFile: 'categories-genres.html',
    title: 'Categories & Genres',
    subtitle: 'Organize and manage all categories and genres',
    user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
    notifCount: 8,
    searchPlaceholder: 'Search by category or genre name...',
    mobileSearchTarget: '#tableSearch',
    onSearch: (value) => {
      document.getElementById('tableSearch').value = value;
      refresh();
    },
  });
}

function init(){
  attachShell();
  window.refresh = refresh;
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/categories-genres').then(function (data) { if (data) refresh(); });
  callBackend('/categories-genres');
  bindEvents();
  renderPagination();
  renderPopularGenres();
  refresh();
}

window.CategoriesGenresService = { init: init };

})();
