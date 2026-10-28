/**
 * services/book-management-service.js — Book Management page logic.
 * Pure call-and-render: book-management.html only loads this + init().
 * Backend-ready: set USE_API=true; endpoints in senior.routes.js:
 *   GET    /api/senior-editor/books            list
 *   GET    /api/senior-editor/books/:id        read one
 *   PUT    /api/senior-editor/books/:id        update meta
 *   DELETE /api/senior-editor/books/:id        delete
 *   POST   /api/senior-editor/books/:id/flag   flag         { reason, note, password }
 *   POST   /api/senior-editor/books/:id/unflag unflag       { password }
 */
(function () {
'use strict';
if (window.BookManagementService) return;

/* Demo-data self-load: page HTML no longer includes ../data/editor-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.EditorDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="../data/editor-demo-data.js?v=3"><\/script>');
}

function resyncDemo(){
  var D = window.EditorDemo || {};
  if(D.BOOKS && D.BOOKS.length && !books.length) books = D.BOOKS.slice();
  var gc = {};
  (D.CATEGORIES || []).forEach(function (c) { gc[c.name] = { bg: c.bg, fg: c.color }; });
  (D.GENRES || []).forEach(function (g) { if (!gc[g.name]) gc[g.name] = { bg: g.bg, fg: g.color }; });
  Object.keys(gc).forEach(function (k) { GENRE_COLORS[k] = gc[k]; });
  buildGenreOptions();
}

var USE_API = true;
var LIVE = false;
var API_BASE = '/api/senior-editor';

/* ── Chief visibility: every flag raised here is mirrored into the shared
   story-reports store (component/reports-table.js) so it appears on the
   Chief Editor's Story Reports accordion. Delete at go-live — the backend
   owns the flow then. ── */
var SE_TAG = { id: 'SE-15', name: 'Reina Morgan' };
function todayLabel() {
  var d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function reportTypeFromReason(reason) {
  var r = String(reason || '').toLowerCase();
  if (r.indexOf('plagiar') !== -1 || r.indexOf('stolen') !== -1 || r.indexOf('copied') !== -1) return 'plagiarism';
  if (r.indexOf('spam') !== -1 || r.indexOf('link') !== -1) return 'spam';
  if (r.indexOf('abus') !== -1 || r.indexOf('harass') !== -1) return 'abuse';
  if (r.indexOf('explicit') !== -1 || r.indexOf('content') !== -1 || r.indexOf('mature') !== -1) return 'content';
  return 'other';
}
function mirrorFlagToChief(b, payload) {
  if (!b || !window.DroboardReportsTable) return;
  DroboardReportsTable.addReport({
    id: 'BOOK-' + b.id,
    seId: SE_TAG.id, seName: SE_TAG.name,
    authorId: b.author || '', storyId: b.id, storyTitle: b.title, author: b.author || '',
    cover: b.img || b.cover || '', chapter: 'Entire story', chN: 1,
    type: reportTypeFromReason(payload.reason), severity: 'medium',
    desc: payload.reason + (payload.note ? ' — ' + payload.note : ''),
    reporter: SE_TAG.name, status: 'pending', date: todayLabel()
  });
}
function mirrorUnflagToChief(b) {
  if (!b || !window.DroboardReportsTable) return;
  // Unflag = leave the chief's view entirely; it only lists live flags.
  DroboardReportsTable.removeReport('BOOK-' + b.id);
}

function authHeaders() {
  var h = { 'Content-Type': 'application/json' };
  var t = null;
  try { t = localStorage.getItem('dro_access_token') || sessionStorage.getItem('dro_access_token'); } catch (e) {}
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    var res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
    if (!res.ok) {
      var body = await res.json().catch(function () { return {}; });
      var err = new Error(body.error || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } catch (e) {
    if (!USE_API) return null;
    throw e;
  }
}

/* ══════════════════════════════════════════════════════════════
   CRUD layer — every operation the page performs lives here.
   Demo mode mutates the local array; USE_API=true hits the backend.
   ══════════════════════════════════════════════════════════════ */
var Crud = {
  /* READ — list (server-paged when live; client-paged in demo) */
  list: async function (query) {
    var qs = [];
    if (query && query.tab && query.tab !== 'all') qs.push('status=' + encodeURIComponent(mapStatusToApi(query.tab)));
    if (query && query.q) qs.push('q=' + encodeURIComponent(query.q));
    var remote = await callBackend('/books' + (qs.length ? '?' + qs.join('&') : ''));
    if (remote && remote.items) { LIVE = true; books = remote.items.map(fromApiBook); }
    return books;
  },

  /* READ — single */
  get: async function (id) {
    var remote = await callBackend('/books/' + encodeURIComponent(id));
    if (remote && remote.id) {
      LIVE = true;
      var mapped = fromApiBook(remote);
      var i = books.findIndex(function (b) { return b.id === id; });
      if (i > -1) books[i] = mapped;
      return mapped;
    }
    return books.find(function (b) { return b.id === id; }) || null;
  },

  /* UPDATE — flag (reason required, password required) */
  flag: async function (id, payload) {
    var remote = LIVE ? await callBackend('/books/' + encodeURIComponent(id) + '/flag', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    }) : null;
    var b = books.find(function (x) { return x.id === id; });
    if (b) {
      b.flagPrevStatus = b.status;
      b.status = 'Flagged';
      b.flagReason = payload.reason;
      b.flagNote = payload.note || '';
    }
    mirrorFlagToChief(b, payload);
    return remote || b;
  },

  /* UPDATE — unflag (password required; restores prior status) */
  unflag: async function (id, payload) {
    var remote = LIVE ? await callBackend('/books/' + encodeURIComponent(id) + '/unflag', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload || {}),
    }) : null;
    var b = books.find(function (x) { return x.id === id; });
    if (b) {
      b.status = b.flagPrevStatus && b.flagPrevStatus !== 'Flagged' ? b.flagPrevStatus : 'Published';
      b.flagReason = '';
      b.flagNote = '';
    }
    mirrorUnflagToChief(b);
    return remote || b;
  },

  /* UPDATE — generic meta (title/desc/status…); kept for go-live completeness */
  update: async function (id, patch) {
    var remote = LIVE ? await callBackend('/books/' + encodeURIComponent(id), {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify(patch),
    }) : null;
    var b = books.find(function (x) { return x.id === id; });
    if (b) Object.assign(b, patch);
    return remote || b;
  },

  /* DELETE — not wired to the UI today; ready for go-live */
  remove: async function (id) {
    var remote = LIVE ? await callBackend('/books/' + encodeURIComponent(id), {
      method: 'DELETE', headers: authHeaders(),
    }) : null;
    books = books.filter(function (x) { return x.id !== id; });
    return remote || { ok: true };
  },
};

/* Backend Book doc → page row shape */
function fromApiBook(b) {
  return {
    id: b.id,
    title: b.title || 'Untitled',
    author: b.authorName || b.author || '—',
    avatar: b.avatar || 'https://i.pravatar.cc/100?img=0',
    cat: b.category || b.cat || b.genre || '',
    genre: b.genre || '—',
    tropes: Array.isArray(b.tropes) ? b.tropes.filter(Boolean) : [],
    status: mapStatusFromApi(b.status),
    views: typeof b.reads === 'number' ? fmtReads(b.reads) : (b.views || '—'),
    added: b.createdAt ? fmtDate(b.createdAt) : (b.added || '—'),
    img: b.cover || b.img || '',
    desc: b.synopsis || b.desc || '',
    chapters: b.chapterCount != null ? b.chapterCount : b.chapters,
    rating: b.rating || 0,
    flagReason: b.flagReason || '',
  };
}
function mapStatusToApi(s) {
  return {
    Published: 'published', Draft: 'draft', 'Under Review': 'under_review', Flagged: 'flagged',
    Ongoing: 'ongoing', Completed: 'completed',
  }[s] || s;
}
function mapStatusFromApi(s) {
  return {
    published: 'Published', draft: 'Draft', under_review: 'Under Review', flagged: 'Flagged',
    ongoing: 'Ongoing', completed: 'Completed', paused: 'Paused',
  }[s] || 'Published';
}
function fmtReads(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}
function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch (e) { return '—'; }
}

/* ── State ── */
var D = window.EditorDemo || {};
var books = (D.BOOKS || []).slice();
var activeTab = 'all';
var currentPage = 1;
var PER_PAGE = 12;
var openRowId = null;
var modalBookId = null;   /* flag/unflag modal target */
var modalMode = 'flag';   /* 'flag' | 'unflag' */

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

var FLAG_REASONS = [
  'Plagiarism / stolen content',
  'Copyright infringement',
  'Adult / NSFW content',
  'Violence or hate speech',
  'Spam or scam',
  'Misleading title or cover',
  'Other (see details)',
];

function statusClass(s) { return { Published: 'published', Draft: 'draft', 'Under Review': 'review', Flagged: 'flagged', Ongoing: 'review', Completed: 'published', Paused: 'draft' }[s] || 'draft'; }
function statusPillHtml(s) { return '<span class="status-pill ' + statusClass(s) + '"><span class="dot"></span>' + s + '</span>'; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function ratingHtml(r) {
  if (!r) return '<span class="muted-cell">—</span>';
  return '<span style="color:#f5b301;font-weight:800;font-size:12px">★ ' + Number(r).toFixed(1).replace(/\.0$/, '') + '</span>';
}
function tropesHtml(b) {
  var list = Array.isArray(b.tropes) ? b.tropes.filter(Boolean) : [];
  if (!list.length) return '<span class="muted-cell">—</span>';
  return list.map(function (t) { return '<span class="trope-chip">' + esc(t) + '</span>'; }).join('');
}

/* ── Render: stats / tabs / table ── */
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
  ['Published', 'Ongoing', 'Completed', 'Draft', 'Under Review', 'Flagged'].forEach(function (s) { counts[s] = books.filter(function (b) { return b.status === s; }).length; });
  document.getElementById('countAll').textContent = counts.all;
  document.querySelectorAll('.tab-item').forEach(function (t) {
    var k = t.dataset.tab;
    var c = t.querySelector('.tab-count');
    if (c && counts[k] !== undefined) c.textContent = counts[k];
  });
}

async function refresh() {
  try {
    await Crud.list({ tab: activeTab });
  } catch (e) {
    if (LIVE) toast('Could not load books: ' + (e.message || 'error'));
  }
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
      var isFlagged = b.status === 'Flagged';
      return '<div>' +
        '<div class="book-row' + (isOpen ? ' is-open' : '') + '" data-id="' + esc(b.id) + '">' +
          '<i class="fas fa-chevron-right expand-ico"></i>' +
          '<div class="book-cell"><div class="book-cover"><img src="' + esc(b.img) + '" alt=""/></div><div><div class="book-title">' + esc(b.title) + '</div><div class="book-id">ID: ' + esc(b.id) + '</div></div></div>' +
          '<div class="col-genre"><span class="genre-chip" style="background:' + gc.bg + ';color:' + gc.fg + '">' + esc(b.genre) + '</span></div>' +
          '<div>' + statusPillHtml(b.status) + '</div>' +
          '<div class="col-num">' + esc(b.views) + '</div>' +
          '<div class="col-num">' + ratingHtml(b.rating) + '</div>' +
          '<div class="actions-cell">' +
            '<button class="act-btn" title="View" onclick="event.stopPropagation();viewBook(\'' + esc(b.id) + '\')"><i class="fas fa-eye"></i></button>' +
            '<button class="act-btn" title="Edit" style="display:none" onclick="event.stopPropagation();editBook(\'' + esc(b.id) + '\')"><i class="fas fa-pen"></i></button>' +
            '<button class="act-btn ' + (isFlagged ? '' : 'danger') + '" title="' + (isFlagged ? 'Unflag' : 'Flag') + '" onclick="event.stopPropagation();' + (isFlagged ? 'unflagBook' : 'flagBook') + '(\'' + esc(b.id) + '\')"><i class="fas fa-flag' + (isFlagged ? '-circle-check' : '') + '"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="book-detail' + (isOpen ? ' show' : '') + '" id="detail-' + esc(b.id) + '"></div>' +
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
  var isFlagged = b.status === 'Flagged';

  var html = '<div class="detail-inner">';
  if (b.desc) html += '<div class="detail-desc">' + esc(b.desc) + '</div>';
  if (isFlagged && b.flagReason) {
    html += '<div class="detail-desc" style="border-color:var(--red);background:var(--red-bg);color:var(--red)"><b><i class="fas fa-flag"></i> Flag reason:</b> ' + esc(b.flagReason) +
      (b.flagNote ? ' — ' + esc(b.flagNote) : '') + '</div>';
  }
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-circle-info"></i> Overview</div><div class="detail-grid">';
  html += '<div class="detail-item"><span>Category</span><b>' + esc(b.cat) + '</b></div>';
  html += '<div class="detail-item"><span>Genre</span><b><span class="genre-chip" style="background:' + gc.bg + ';color:' + gc.fg + '">' + esc(b.genre) + '</span></b></div>';
  html += '<div class="detail-item tropes"><span>Tropes</span><b>' + tropesHtml(b) + '</b></div>';
  html += '<div class="detail-item accent"><span>Reads</span><b>' + esc(b.views) + '</b></div>';
  html += '<div class="detail-item"><span>Status</span><b>' + statusPillHtml(b.status) + '</b></div>';
  html += '<div class="detail-item"><span>Added</span><b>' + esc(b.added) + '</b></div>';
  html += '<div class="detail-item"><span>Author</span><b>' + esc(b.author) + '</b></div>';
  html += '<div class="detail-item"><span>Chapters</span><b>' + (b.chapters != null ? esc(b.chapters) : '—') + '</b></div>';
  html += '</div></div>';
  html += '<div class="detail-foot">';
  html += '<button class="mini-btn primary" onclick="viewBook(\'' + esc(b.id) + '\')"><i class="fas fa-eye"></i> View Book</button>';
  html += '<button class="mini-btn" style="display:none" onclick="editBook(\'' + esc(b.id) + '\')"><i class="fas fa-pen"></i> Edit</button>';
  html += '<button class="mini-btn ' + (isFlagged ? '' : 'danger') + '" onclick="' + (isFlagged ? 'unflagBook' : 'flagBook') + '(\'' + esc(b.id) + '\')"><i class="fas fa-flag"></i> ' + (isFlagged ? 'Unflag' : 'Flag') + '</button>';
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

/* ── Actions ── */
function viewBook(id) { window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id); }
function editBook(id) { window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id) + '&mode=edit'; }

/* Flag / unflag modal */
function flagBook(id) {
  var b = books.find(function (x) { return x.id === id; }); if (!b) return;
  openFlagModal(id, 'flag', b);
}
function unflagBook(id) {
  var b = books.find(function (x) { return x.id === id; }); if (!b) return;
  openFlagModal(id, 'unflag', b);
}
function openFlagModal(id, mode, b) {
  modalBookId = id;
  modalMode = mode;
  var isFlag = mode === 'flag';
  document.getElementById('bmFlagIco').className = 'bm-modal-ico ' + (isFlag ? 'red' : 'green');
  document.getElementById('bmFlagIco').innerHTML = '<i class="fas fa-flag' + (isFlag ? '' : '-circle-check') + '"></i>';
  document.getElementById('bmFlagHeading').textContent = isFlag ? 'Flag Book' : 'Unflag Book';
  document.getElementById('bmFlagBook').textContent = b.title;
  document.getElementById('bmFlagReasonWrap').style.display = isFlag ? '' : 'none';
  document.getElementById('bmFlagNoteWrap').style.display = isFlag ? '' : 'none';
  document.getElementById('bmFlagHint').textContent = isFlag
    ? 'A reason is required. Confirm with your account password — this action is logged.'
    : 'Confirm with your account password to restore this book.';
  document.getElementById('bmFlagReason').value = '';
  document.getElementById('bmFlagNote').value = '';
  document.getElementById('bmFlagPass').value = '';
  document.getElementById('bmFlagErr').textContent = '';
  var btn = document.getElementById('bmFlagSubmit');
  btn.innerHTML = '<i class="fas fa-flag"></i> ' + (isFlag ? 'Flag Book' : 'Unflag Book');
  btn.className = 'bm-btn ' + (isFlag ? 'danger' : 'primary');
  openOverlay('bmFlagOv');
}
async function submitFlag() {
  var b = books.find(function (x) { return x.id === modalBookId; }); if (!b) return;
  var errEl = document.getElementById('bmFlagErr');
  errEl.textContent = '';
  var reason = modalMode === 'flag' ? document.getElementById('bmFlagReason').value : '';
  var note = modalMode === 'flag' ? document.getElementById('bmFlagNote').value.trim() : '';
  var pass = document.getElementById('bmFlagPass').value;
  if (modalMode === 'flag' && !reason) { errEl.textContent = 'Select a reason for flagging.'; return; }
  if (!pass) { errEl.textContent = 'Enter your password to confirm.'; return; }
  if (!USE_API && pass.length < 4) { errEl.textContent = 'Demo mode: password must be at least 4 characters.'; return; }
  var btn = document.getElementById('bmFlagSubmit');
  btn.disabled = true;
  try {
    if (modalMode === 'flag') await Crud.flag(modalBookId, { reason: reason, note: note, password: pass });
    else await Crud.unflag(modalBookId, { password: pass });
    closeOverlay('bmFlagOv');
    toast(b.title + (modalMode === 'flag' ? ' flagged' : ' unflagged'));
    openRowId = null;
    refresh();
  } catch (e) {
    errEl.textContent = e.status === 401 ? 'Incorrect password.' : (e.message || 'Action failed.');
  } finally { btn.disabled = false; }
}

/* ── Modal plumbing (service-injected — page stays call-and-render) ── */
function ensureModals() {
  if (document.getElementById('bmFlagOv')) return;
  var css = '' +
    '.bm-ov{position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}.bm-ov.open{display:flex}' +
    '.bm-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:430px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px;animation:bmIn .18s ease}' +
    '@keyframes bmIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
    '.bm-modal-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}' +
    '.bm-modal-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}.bm-modal-ico.red{background:var(--red-bg);color:var(--red)}.bm-modal-ico.green{background:var(--green-bg);color:var(--green)}.bm-modal-ico.amber{background:var(--amber-bg);color:var(--amber)}' +
    '.bm-modal-title{font-size:15px;font-weight:800}.bm-modal-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}' +
    '.bm-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}.bm-x:hover{color:var(--red);border-color:var(--red)}' +
    '.bm-label{font-size:11px;font-weight:700;display:block;margin-bottom:5px}.bm-label span{color:var(--red)}' +
    '.bm-field{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;margin-bottom:12px}.bm-field:focus{border-color:var(--accent)}' +
    'select.bm-field{appearance:none;cursor:pointer}' +
    'textarea.bm-field{resize:vertical;min-height:64px}' +
    '.bm-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px}' +
    '.bm-err{font-size:11.5px;color:var(--red);font-weight:600;min-height:16px;margin-bottom:8px}' +
    '.bm-actions{display:flex;gap:8px;justify-content:flex-end}' +
    '.bm-btn{font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;transition:.12s}.bm-btn:hover{border-color:var(--accent);color:var(--accent)}.bm-btn.primary{background:var(--accent);border-color:transparent;color:#fff}.bm-btn.danger{background:var(--red);border-color:transparent;color:#fff}.bm-btn:disabled{opacity:.5;cursor:default}' +
    '';
  var style = document.createElement('style');
  style.id = 'bmModalCss';
  style.textContent = css;
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.innerHTML = '' +
    '<div class="bm-ov" id="bmFlagOv">' +
      '<div class="bm-modal">' +
        '<div class="bm-modal-head">' +
          '<div class="bm-modal-ico red" id="bmFlagIco"><i class="fas fa-flag"></i></div>' +
          '<div><div class="bm-modal-title" id="bmFlagHeading">Flag Book</div><div class="bm-modal-sub" id="bmFlagBook"></div></div>' +
          '<div class="bm-x" onclick="closeBmFlag()"><i class="fas fa-xmark"></i></div>' +
        '</div>' +
        '<div class="bm-hint" id="bmFlagHint"></div>' +
        '<div id="bmFlagReasonWrap">' +
          '<label class="bm-label">Reason <span>*</span></label>' +
          '<select class="bm-field" id="bmFlagReason">' +
            '<option value="">Select a reason…</option>' +
            FLAG_REASONS.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div id="bmFlagNoteWrap">' +
          '<label class="bm-label">Details <span style="color:var(--text-faint)">(optional)</span></label>' +
          '<textarea class="bm-field" id="bmFlagNote" placeholder="Chapter links, screenshots described, context…"></textarea>' +
        '</div>' +
        '<label class="bm-label">Your password <span>*</span></label>' +
        '<input type="password" class="bm-field" id="bmFlagPass" placeholder="Enter password to confirm" autocomplete="current-password"/>' +
        '<div class="bm-err" id="bmFlagErr"></div>' +
        '<div class="bm-actions">' +
          '<button class="bm-btn" onclick="closeBmFlag()">Cancel</button>' +
          '<button class="bm-btn danger" id="bmFlagSubmit" onclick="submitBmFlag()"><i class="fas fa-flag"></i> Flag Book</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  document.getElementById('bmFlagOv').addEventListener('click', function (e) { if (e.target === this) closeOverlay('bmFlagOv'); });
  document.getElementById('bmFlagPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitFlag(); });
}
function openOverlay(id) { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }
function closeBmFlag() { closeOverlay('bmFlagOv'); }
function submitBmFlag() { submitFlag(); }

function toast(m) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:600;opacity:0;transition:.3s;pointer-events:none;z-index:9999';
    document.body.appendChild(t);
    var s = document.createElement('style');
    s.textContent = '#toast.show{opacity:1}';
    document.head.appendChild(s);
  }
  t.textContent = m; t.classList.add('show'); clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
}

function buildGenreOptions() {
  var sel = document.getElementById('fGenre');
  if (!sel) return;
  var keep = sel.value;
  sel.innerHTML = '<option>All Genres</option>';
  var genres = {};
  books.forEach(function (b) { if (b.genre) genres[b.genre] = 1; });
  Object.keys(genres).sort().forEach(function (g) {
    var o = document.createElement('option'); o.textContent = g; o.value = g; sel.appendChild(o);
  });
  if (keep) sel.value = keep;
}

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

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeOverlay('bmFlagOv');
  });

  window.goPage = goPage;
  window.viewBook = viewBook;
  window.editBook = editBook;          /* kept — button hidden, not removed */
  window.flagBook = flagBook;
  window.unflagBook = unflagBook;
  window.closeBmFlag = closeBmFlag;
  window.submitBmFlag = submitBmFlag;
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
  ensureModals();
  resyncDemo();
  bindEvents();
  refresh();
}

window.BookManagementService = { init: init };
})();
