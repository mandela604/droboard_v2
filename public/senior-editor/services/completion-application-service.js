/**
 * completion-application-service.js — Completion Application page logic (backend only, no demo). */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  try {
    const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    throw e;
  }
}

function toast(m) { var t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

function showError(msg) {
  var body = document.getElementById('tableBody');
  var info = document.getElementById('pageInfo');
  var btns = document.getElementById('pageBtns');
  if (body) body.innerHTML = '<div style="padding:40px 16px;text-align:center;color:var(--red)"><i class="fas fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:8px"></i><div style="font-weight:700">Could not load completion applications</div><div style="font-size:11.5px;color:var(--text-faint);margin-top:6px">'+msg+'</div><button class="mini-btn primary" onclick="location.reload()" style="margin-top:10px"><i class="fas fa-rotate"></i> Refresh Page</button></div>';
  if (info) info.innerHTML = '';
  if (btns) btns.innerHTML = '';
}

var items = [];
var currentPage = 1, PER_PAGE = 5, openRowId = null;
var _bound = false;

function mapBackendItem(a) {
  return {
    id: a.id,
    author: a.author || a.authorName || '—',
    avatar: a.avatar || '../assets/droboard-icon.png',
    book: a.book || a.bookTitle || '—',
    genre: a.genre || '—',
    chapters: a.chapters || 0,
    wordCount: typeof a.wordCount === 'number' ? a.wordCount.toLocaleString('en-US') : (a.wordCount || '—'),
    submitted: a.submitted || '—',
    status: a.status || 'pending',
    notes: a.notes || a.authorNote || '',
  };
}

async function loadItems() {
  var d = await callBackend('/completion-applications?limit=100');
  items = (d && Array.isArray(d.items)) ? d.items.map(mapBackendItem) : [];
  return items;
}

function filtered() {
  var q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  var st = document.getElementById('statusFilter').value;
  return items.filter(function (a) { if (st && a.status !== st) return false; if (q && a.author.toLowerCase().indexOf(q) === -1 && a.book.toLowerCase().indexOf(q) === -1 && a.id.toLowerCase().indexOf(q) === -1) return false; return true; });
}

function updateStats() {
  var p = 0, ap = 0, r = 0, t = items.length;
  items.forEach(function (a) { if (a.status === 'pending') p++; else if (a.status === 'approved') ap++; else if (a.status === 'rejected') r++; });
  document.getElementById('statPending').textContent = p;
  document.getElementById('statApproved').textContent = ap;
  document.getElementById('statRejected').textContent = r;
  document.getElementById('statTotal').textContent = t;
}

function statusPill(s) {
  var icons = {pending:'fa-clock',approved:'fa-check-circle',rejected:'fa-times-circle'};
  return '<span class="status-pill ' + s + '"><i class="fas ' + icons[s] + '"></i>' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>';
}

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function render() {
  updateStats();
  var list = filtered(), total = list.length, tp = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > tp) currentPage = tp;
  var start = (currentPage - 1) * PER_PAGE, page = list.slice(start, start + PER_PAGE);
  var body = document.getElementById('tableBody');
  if (!page.length) { body.innerHTML = '<div class="empty-msg"><i class="fas fa-flag-checkered"></i>No applications match your filters.</div>'; document.getElementById('pageBtns').innerHTML = ''; document.getElementById('pageInfo').innerHTML = ''; return; }
  body.innerHTML = page.map(function (a) {
    var isOpen = openRowId === a.id;
    var isDone = a.status !== 'pending';
    return '<div><div class="item-row' + (isOpen ? ' is-open' : '') + '" data-id="' + a.id + '"><div class="expand-ico"><i class="fas fa-chevron-right"></i></div><div class="author-cell col-book"><img src="' + a.avatar + '" alt=""/><div class="author-info"><span class="author-name">' + a.author + '</span><span class="author-id">' + a.id + '</span></div></div><div class="book-cell col-chapters"><span class="book-title">' + a.book + '</span><span class="book-genre">' + a.genre + '</span></div><div class="chapter-badge"><i class="fas fa-book-open"></i>' + a.chapters + ' ch</div><div>' + statusPill(a.status) + '</div><div class="actions-cell' + (isDone ? ' is-done' : '') + '"><button class="btn btn-green" title="Approve" onclick="event.stopPropagation();approve(\'' + a.id + '\')"><i class="fas fa-check"></i></button><button class="btn btn-danger" title="Reject" onclick="event.stopPropagation();reject(\'' + a.id + '\')"><i class="fas fa-xmark"></i></button></div></div><div class="item-detail' + (isOpen ? ' show' : '') + '" id="detail-' + a.id + '"></div></div>';
  }).join('');
  if (openRowId && page.some(function (a) { return a.id === openRowId; })) renderDetail(openRowId);
  document.getElementById('pageInfo').innerHTML = 'Showing <b>' + (start + 1) + '</b> – <b>' + Math.min(start + PER_PAGE, total) + '</b> of <b>' + total + '</b> applications';
  renderPag(tp);
}

function renderDetail(id) {
  var a = items.find(function (x) { return x.id === id; }); if (!a) return;
  var p = document.getElementById('detail-' + id); if (!p) return;
  var isDone = a.status !== 'pending';
  var bookSlug = String(a.book || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  var wsHref = '../author/book-workspace.html?book=' + encodeURIComponent(bookSlug);
  var actionsHtml = '';
  if (isDone) {
    actionsHtml = '<a class="btn btn-ghost" href="' + wsHref + '"><i class="fas fa-eye"></i> Preview Book</a><a class="btn btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  } else {
    actionsHtml = '<button class="btn btn-green" onclick="approve(\'' + a.id + '\')"><i class="fas fa-check"></i> Approve</button><button class="btn btn-danger" onclick="reject(\'' + a.id + '\')"><i class="fas fa-xmark"></i> Reject</button><a class="btn btn-ghost" href="' + wsHref + '"><i class="fas fa-eye"></i> Preview Book</a><a class="btn btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }
  p.innerHTML = '<div class="detail-inner"><div class="detail-header"><img class="detail-avatar" src="' + a.avatar + '" alt=""/><div class="detail-title"><h3>' + a.author + '</h3><p>' + a.id + ' · ' + a.genre + '</p></div>' + statusPill(a.status) + '</div><div class="detail-grid"><div class="detail-card"><label>Book Title</label><b>' + a.book + '</b></div><div class="detail-card accent"><label>Total Chapters</label><b>' + a.chapters + ' chapters</b></div><div class="detail-card"><label>Word Count</label><b>' + a.wordCount + '</b></div><div class="detail-card"><label>Submitted</label><b>' + a.submitted + '</b></div></div><div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Author\u2019s Note</div><p>' + esc(a.notes) + '</p></div><div class="detail-actions">' + actionsHtml + '</div></div>';
}

function renderPag(tp) {
  var w = document.getElementById('pageBtns'); if (tp <= 1) { w.innerHTML = ''; return; }
  var h = '<button class="pg-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' onclick="go(' + (currentPage - 1) + ')"><i class="fas fa-chevron-left"></i></button>';
  for (var i = 1; i <= tp; i++) h += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" onclick="go(' + i + ')">' + i + '</button>';
  h += '<button class="pg-btn"' + (currentPage >= tp ? ' disabled' : '') + ' onclick="go(' + (currentPage + 1) + ')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML = h;
}

function go(p) { currentPage = p; render(); }

async function decide(id, action) {
  var a = items.find(function (x) { return x.id === id; });
  if (!a || a.status !== 'pending') return;
  var verb = action === 'approved' ? 'approve' : 'reject';
  try {
    var r = await callBackend('/completion-applications/' + encodeURIComponent(id) + '/' + verb, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err) {
    toast('Could not reach the server — try again');
    return;
  }
  a.status = action;
  if (r && r.id) Object.assign(a, mapBackendItem(r));
  openRowId = null;
  render();
  toast(a.book + ' — completion ' + (action === 'approved' ? 'approved' : 'rejected'));
}
function approve(id) { decide(id, 'approved'); }
function reject(id) { decide(id, 'rejected'); }

function bindEvents() {
  if (_bound) return; _bound = true;
  document.addEventListener('click', function (e) { var row = e.target.closest('.item-row'); if (row && !e.target.closest('.actions-cell')) { var id = row.dataset.id; openRowId = openRowId === id ? null : id; render(); } });
  var si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', function () { currentPage = 1; render(); });
  var sf = document.getElementById('statusFilter');
  if (sf) sf.addEventListener('change', function () { currentPage = 1; render(); });
}

function init() {
  if (window.SeniorEditorSidebar && window.SeniorEditorSidebar.attach) {
    SeniorEditorSidebar.attach('#dashRoot', {activeItem:'completion-review',title:'Completion Application',subtitle:'Authors apply for book completion approval',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
  }
  window.go = go;
  window.approve = approve;
  window.reject = reject;
  bindEvents();
  loadItems().then(function () { render(); }).catch(function (err) {
    console.error('completion-application backend failed:', err);
    showError('The server is not reachable or your session expired. '+ (err && err.message ? err.message : 'Please refresh the page and try again.'));
  });
}

window.CompletionApplicationService = { init: init };

})();
