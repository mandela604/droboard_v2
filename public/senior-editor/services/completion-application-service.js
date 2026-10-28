/**
 * completion-application-service.js — Completion Application page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[CompletionApplicationService] backend unavailable, using demo data', e);
    return null;
  }
}

var items = [
  {id:'CMP-001',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',genre:'Mafia Romance',chapters:7,wordCount:'42,800',submitted:'8h ago',status:'approved',notes:'All 7 chapters are done and the arc closes exactly the way I planned it from chapter one. Ready to mark this one complete.'},
  {id:'CMP-002',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',genre:'Historical Romance',chapters:31,wordCount:'186,400',submitted:'1d ago',status:'approved',notes:'All 31 chapters are written and the ending landed exactly as I intended. Submitting for completion approval.'},
  {id:'CMP-003',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',genre:'Paranormal Romance',chapters:12,wordCount:'78,200',submitted:'2d ago',status:'pending',notes:'The story is finished at 12 chapters — the final chapter ties off Ren and the Luna vow. Please review.'},
  {id:'CMP-004',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',genre:'Contemporary Romance',chapters:9,wordCount:'54,100',submitted:'3d ago',status:'pending',notes:'Complete at 9 chapters. I know it\'s short, but the revenge arc lands as planned and this is the story I set out to tell.'},
  {id:'CMP-005',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',genre:'Romantic Comedy',chapters:19,wordCount:'112,600',submitted:'4d ago',status:'rejected',notes:'I believe the story is finished at 19 chapters and the rom-com beat lands. Submitting for completion.'},
  {id:'CMP-006',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',genre:'Contemporary Romance',chapters:15,wordCount:'89,300',submitted:'5d ago',status:'approved',notes:'Story is complete at 15 chapters. The final confession scene wraps up the three-rejection arc.'},
  {id:'CMP-007',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',genre:'Suspense Romance',chapters:22,wordCount:'134,500',submitted:'6d ago',status:'pending',notes:'Final chapter draft submitted — 22 chapters total. Would appreciate a quick review so I can schedule the epilogue bonus.'},
  {id:'CMP-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',genre:'Family Drama',chapters:28,wordCount:'167,200',submitted:'1w ago',status:'approved',notes:'The family saga is complete at 28 chapters and every clause in the will gets resolved in the finale.'},
  {id:'CMP-009',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',genre:'Office Romance',chapters:35,wordCount:'210,800',submitted:'1w ago',status:'rejected',notes:'Submitting for completion at 35 chapters. I feel the story has found its ending and the son reveal pays off.'},
  {id:'CMP-010',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',genre:'Paranormal Romance',chapters:42,wordCount:'252,100',submitted:'2w ago',status:'approved',notes:'Series finale is complete at 42 chapters. Every pack arc is closed — this one is ready.'},
  {id:'CMP-011',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',genre:'Office Romance',chapters:18,wordCount:'108,400',submitted:'2w ago',status:'pending',notes:'Completed at 18 chapters. The forbidden-love arc resolves in the epilogue as promised.'},
  {id:'CMP-012',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',genre:'Fantasy Romance',chapters:25,wordCount:'156,700',submitted:'2w ago',status:'approved',notes:'All 25 chapters are done. The guard\'s vow pays off in the last act, exactly as set up in chapter one.'},
  {id:'CMP-013',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',genre:'Contemporary Romance',chapters:20,wordCount:'124,300',submitted:'3w ago',status:'pending',notes:'Story is complete at 20 chapters. The Lagos arc ends where I wanted it to — submitting for review.'},
  {id:'CMP-014',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',genre:'Romantic Suspense',chapters:16,wordCount:'96,500',submitted:'3w ago',status:'rejected',notes:'Submitting the completed 16-chapter story. I believe the suspense beats resolve cleanly in the final chapters.'},
  {id:'CMP-015',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',genre:'Mafia Romance',chapters:30,wordCount:'182,600',submitted:'3w ago',status:'approved',notes:'Sequel complete at 30 chapters. I carried the quality from book one all the way through to the finale.'},
  {id:'CMP-016',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',genre:'New Adult Romance',chapters:14,wordCount:'84,200',submitted:'1mo ago',status:'approved',notes:'Campus story done at 14 chapters. The queen\'s arc comes full circle in the final act.'},
  {id:'CMP-017',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'Blood Ties',genre:'Paranormal Romance',chapters:38,wordCount:'228,900',submitted:'1mo ago',status:'approved',notes:'Epic saga finished at 38 chapters. Submitting for completion — this is the story I\'m proudest of.'},
  {id:'CMP-018',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'The Inheritance',genre:'Family Drama',chapters:24,wordCount:'144,100',submitted:'1mo ago',status:'rejected',notes:'Submitting the completed 24-chapter story. The inheritance mystery is fully resolved to my satisfaction.'},
  {id:'CMP-019',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Midnight Omega',genre:'Paranormal Romance',chapters:26,wordCount:'156,400',submitted:'1mo ago',status:'approved',notes:'Omega-verse story is complete at 26 chapters. The bond arc closes in the finale — ready for approval.'},
  {id:'CMP-020',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Her Fake Fiance',genre:'Romantic Comedy',chapters:21,wordCount:'126,800',submitted:'1mo ago',status:'approved',notes:'21 chapters, rom-com fully wrapped. The fake-dating arc ends exactly where my readers hoped it would.'}
];
var currentPage = 1, PER_PAGE = 5, openRowId = null;
var _bound = false;
var LIVE = false;

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
  if (d && Array.isArray(d.items)) { LIVE = true; items = d.items.map(mapBackendItem); }
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

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

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

function toast(m) { var t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

async function decide(id, action) {
  var a = items.find(function (x) { return x.id === id; });
  if (!a || a.status !== 'pending') return;
  // URL verb is approve/reject (backend routes); the UI status stays approved/rejected.
  var verb = action === 'approved' ? 'approve' : 'reject';
  var r = await callBackend('/completion-applications/' + encodeURIComponent(id) + '/' + verb, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!r && LIVE) { toast('Could not reach the server — try again'); return; }
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
  render();
  loadItems().then(function () { render(); });
}

window.CompletionApplicationService = { init: init };

})();
