/**
 * services/book-management-service.js — Book Management page logic.
 * Pure call-and-render: book-management.html only loads this + init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 */
(function () {
'use strict';
if (window.BookManagementService) return;

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[BookManagementService] backend unavailable, using demo data', e);
    return null;
  }
}

var D = window.EditorDemo || {};
var books = (D.BOOKS || []).slice();
var activeTab = 'all';
var currentPage = 1;
var PER_PAGE = 12;
var openRowId = null;

var GENRE_COLORS = {};
(D.CATEGORIES || []).forEach(function (c) { GENRE_COLORS[c.name] = { bg: c.bg, fg: c.color }; });
(D.GENRES || []).forEach(function (g) { if (!GENRE_COLORS[g.name]) GENRE_COLORS[g.name] = { bg: g.bg, fg: g.color }; });
GENRE_COLORS['Billionaire Romance'] = { bg: '#ece3fd', fg: '#7c5cfc' };
GENRE_COLORS['Werewolf Romance'] = { bg: '#eef0f2', fg: '#5b6470' };
GENRE_COLORS['Mafia Romance'] = { bg: '#e7e7ea', fg: '#26262b' };
GENRE_COLORS['Vampire Romance'] = { bg: '#fde3e3', fg: '#e0384d' };
GENRE_COLORS['Royal Romance'] = { bg: '#ece3fd', fg: '#7c5cfc' };
GENRE_COLORS['Second Chance'] = { bg: '#ffe1eb', fg: '#ff0050' };
GENRE_COLORS['Revenge'] = { bg: '#fde3e3', fg: '#e0384d' };
GENRE_COLORS['Family Drama'] = { bg: '#fef3d8', fg: '#d97706' };
GENRE_COLORS['Twist'] = { bg: '#ffe1eb', fg: '#ff0050' };
GENRE_COLORS['Betrayal'] = { bg: '#ffe1eb', fg: '#ff0050' };
GENRE_COLORS['Campus'] = { bg: '#e3ecfd', fg: '#2f7de1' };
GENRE_COLORS['Elegy'] = { bg: '#fde3e3', fg: '#e0384d' };

function statusClass(s) { return { Published: 'published', Draft: 'draft', 'Under Review': 'review', Flagged: 'flagged' }[s] || 'draft'; }
function statusPillHtml(s) { return '<span class="status-pill ' + statusClass(s) + '"><span class="dot"></span>' + s + '</span>'; }

function renderStats() {
  var t = books.length;
  var p = books.filter(function (x) { return x.status === 'Published'; }).length;
  var d = books.filter(function (x) { return x.status === 'Draft'; }).length;
  var f = books.filter(function (x) { return x.status === 'Flagged'; }).length;
  var r = books.filter(function (x) { return x.status === 'Under Review'; }).length;
  document.getElementById('statsGrid').innerHTML =
    '<div class="stat-card"><div class="stat-ico purple"><i class="fas fa-book"></i></div><div class="stat-body"><div class="stat-num">' + t + '</div><div class="stat-lbl">Total Books</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico green"><i class="fas fa-circle-check"></i></div><div class="stat-body"><div class="stat-num">' + p + '</div><div class="stat-lbl">Published</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico amber"><i class="fas fa-clock"></i></div><div class="stat-body"><div class="stat-num">' + d + '</div><div class="stat-lbl">Drafts</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico red"><i class="fas fa-flag"></i></div><div class="stat-body"><div class="stat-num">' + f + '</div><div class="stat-lbl">Flagged</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico blue"><i class="fas fa-hourglass-half"></i></div><div class="stat-body"><div class="stat-num">' + r + '</div><div class="stat-lbl">Under Review</div></div></div>';
}

function renderTabs() {
  var counts = { all: books.length };
  ['Published', 'Draft', 'Under Review', 'Flagged'].forEach(function (s) { counts[s] = books.filter(function (b) { return b.status === s; }).length; });
  document.getElementById('countAll').textContent = counts.all;
  document.querySelectorAll('.tab-item').forEach(function (t) {
    var k = t.dataset.tab;
    var c = t.querySelector('.tab-count');
    if (c && counts[k] !== undefined) c.textContent = counts[k];
  });
}

async function refresh() {
  var backend = await callBackend('/books?tab=' + encodeURIComponent(activeTab));
  if (backend && backend.items) books = backend.items;
  var q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
  var genre = document.getElementById('fGenre').value;
  var stat = document.getElementById('fStatus').value;

  var filtered = books.filter(function (b) {
    if (activeTab !== 'all' && b.status !== activeTab) return false;
    if (genre !== 'All Genres' && b.genre !== genre) return false;
    if (stat !== 'All Status' && b.status !== stat) return false;
    if (q && b.title.toLowerCase().indexOf(q) === -1 && b.author.toLowerCase().indexOf(q) === -1 && b.id.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  renderTable(filtered);
  renderStats();
  renderTabs();
}

function renderTable(list) {
  var body = document.getElementById('tableBody');
  var total = list.length;
  var totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  var start = (currentPage - 1) * PER_PAGE;
  var page = list.slice(start, start + PER_PAGE);

  if (!page.length) {
    body.innerHTML = '<div class="empty-msg"><i class="fas fa-inbox" style="font-size:20px;margin-bottom:8px;display:block"></i>No books match this filter.</div>';
  } else {
    body.innerHTML = page.map(function (b) {
      var gc = GENRE_COLORS[b.genre] || GENRE_COLORS[b.cat] || { bg: 'var(--table-head)', fg: 'var(--text-muted)' };
      var isOpen = openRowId === b.id;
      return '<div>' +
        '<div class="book-row' + (isOpen ? ' is-open' : '') + '" data-id="' + b.id + '">' +
          '<i class="fas fa-chevron-right expand-ico"></i>' +
          '<div class="book-cell"><div class="book-cover"><img src="' + b.img + '" alt=""/></div><div><div class="book-title">' + b.title + '</div><div class="book-id">ID: ' + b.id + '</div></div></div>' +
          '<div class="col-genre"><span class="genre-chip" style="background:' + gc.bg + ';color:' + gc.fg + '">' + b.genre + '</span></div>' +
          '<div>' + statusPillHtml(b.status) + '</div>' +
          '<div class="col-num">' + b.views + '</div>' +
          '<div class="col-num muted-cell">' + (b.rating || '—') + '</div>' +
          '<div class="actions-cell">' +
            '<button class="act-btn" title="View" onclick="event.stopPropagation();viewBook(\'' + b.id + '\')"><i class="fas fa-eye"></i></button>' +
            '<button class="act-btn" title="Edit" onclick="event.stopPropagation();editBook(\'' + b.id + '\')"><i class="fas fa-pen"></i></button>' +
            '<button class="act-btn danger" title="Flag" onclick="event.stopPropagation();flagBook(\'' + b.id + '\')"><i class="fas fa-flag"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="book-detail' + (isOpen ? ' show' : '') + '" id="detail-' + b.id + '"></div>' +
      '</div>';
    }).join('');
    if (openRowId && page.some(function (b) { return b.id === openRowId; })) renderDetailPanel(openRowId);
  }

  var pageInfo = document.getElementById('pageInfo');
  pageInfo.innerHTML = total
    ? 'Showing <b>' + (start + 1) + '</b> to <b>' + Math.min(start + PER_PAGE, total) + '</b> of <b>' + total.toLocaleString() + '</b> books'
    : 'No books found';
  renderPagination(totalPages);
}

function renderDetailPanel(id) {
  var b = books.find(function (x) { return x.id === id; }); if (!b) return;
  var panel = document.getElementById('detail-' + id); if (!panel) return;
  var gc = GENRE_COLORS[b.genre] || GENRE_COLORS[b.cat] || { bg: 'var(--table-head)', fg: 'var(--text-muted)' };

  var html = '<div class="detail-inner">';
  if (b.desc) html += '<div class="detail-desc">' + b.desc + '</div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-circle-info"></i> Overview</div><div class="detail-grid">';
  html += '<div class="detail-item"><span>Category</span><b>' + b.cat + '</b></div>';
  html += '<div class="detail-item"><span>Genre</span><b><span class="genre-chip" style="background:' + gc.bg + ';color:' + gc.fg + '">' + b.genre + '</span></b></div>';
  html += '<div class="detail-item accent"><span>Reads</span><b>' + b.views + '</b></div>';
  html += '<div class="detail-item"><span>Rating</span><b>' + (b.rating ? '★ ' + b.rating : '—') + '</b></div>';
  html += '<div class="detail-item"><span>Status</span><b>' + statusPillHtml(b.status) + '</b></div>';
  html += '<div class="detail-item"><span>Added</span><b>' + b.added + '</b></div>';
  html += '<div class="detail-item"><span>Author</span><b>' + b.author + '</b></div>';
  html += '<div class="detail-item"><span>Chapters</span><b>' + (b.chapters || '—') + '</b></div>';
  html += '</div></div>';
  html += '<div class="detail-foot">';
  html += '<button class="mini-btn primary" onclick="viewBook(\'' + b.id + '\')"><i class="fas fa-eye"></i> View Book</button>';
  html += '<button class="mini-btn" onclick="editBook(\'' + b.id + '\')"><i class="fas fa-pen"></i> Edit</button>';
  html += '<button class="mini-btn danger" onclick="flagBook(\'' + b.id + '\')"><i class="fas fa-flag"></i> ' + (b.status === 'Flagged' ? 'Unflag' : 'Flag') + '</button>';
  html += '</div></div>';
  panel.innerHTML = html;
}

function renderPagination(tp) {
  var w = document.getElementById('pageBtns');
  if (tp <= 1) { w.innerHTML = ''; return; }
  var h = '<button class="pg-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' onclick="goPage(' + (currentPage - 1) + ')"><i class="fas fa-chevron-left"></i></button>';
  var sP = Math.max(1, currentPage - 2);
  var eP = Math.min(tp, currentPage + 2);
  if (sP > 1) h += '<button class="pg-btn" onclick="goPage(1)">1</button>' + (sP > 2 ? '<span class="pg-dots">…</span>' : '');
  for (var i = sP; i <= eP; i++) {
    h += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" onclick="goPage(' + i + ')">' + i + '</button>';
  }
  if (eP < tp) h += (eP < tp - 1 ? '<span class="pg-dots">…</span>' : '') + '<button class="pg-btn" onclick="goPage(' + tp + ')">' + tp + '</button>';
  h += '<button class="pg-btn"' + (currentPage >= tp ? ' disabled' : '') + ' onclick="goPage(' + (currentPage + 1) + ')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML = h;
}

function goPage(p) { currentPage = p; refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function viewBook(id) { window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id); }
function editBook(id) { window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id) + '&mode=edit'; }
function flagBook(id) {
  var b = books.find(function (x) { return x.id === id; });
  if (b) { b.status = b.status === 'Flagged' ? 'Published' : 'Flagged'; openRowId = null; refresh(); toast(b.title + ' → ' + b.status); }
}

function toast(m) { var t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2200); }

function bindEvents() {
  document.addEventListener('click', function (e) {
    var row = e.target.closest('.book-row');
    if (row && !e.target.closest('.actions-cell')) {
      var id = row.dataset.id;
      openRowId = openRowId === id ? null : id;
      refresh();
    }
  });

  document.querySelectorAll('.tab-item').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab-item').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      currentPage = 1;
      refresh();
    });
  });
  document.getElementById('tableSearch').addEventListener('input', function () { currentPage = 1; refresh(); });
  document.getElementById('fGenre').addEventListener('change', function () { currentPage = 1; refresh(); });
  document.getElementById('fStatus').addEventListener('change', function () { currentPage = 1; refresh(); });

  (function () {
    var genres = {};
    books.forEach(function (b) { if (b.genre) genres[b.genre] = 1; });
    var sel = document.getElementById('fGenre');
    Object.keys(genres).sort().forEach(function (g) { var o = document.createElement('option'); o.textContent = g; o.value = g; sel.appendChild(o); });
  })();

  window.goPage = goPage;
  window.viewBook = viewBook;
  window.editBook = editBook;
  window.flagBook = flagBook;
}

function init() {
  SeniorEditorSidebar.attach('#dashboardRoot', {
    activeItem: 'book-management',
    title: 'Book Management',
    subtitle: 'Manage and organize all books on your platform',
    user: { name: 'Reina Morgan', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
    notifCount: 8,
    searchPlaceholder: 'Search everything...',
  });
  if (!document.getElementById('tableBody')) return;
  bindEvents();
  refresh();
}

window.BookManagementService = { init: init };
})();
