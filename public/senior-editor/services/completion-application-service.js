/**
 * completion-application-service.js — Completion Application page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[CompletionApplicationService] backend unavailable, using demo data', e);
    return null;
  }
}

var items = [
  {id:'CMP-001',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',genre:'Mafia Romance',chapters:7,wordCount:'42,800',submitted:'8h ago',status:'approved',notes:'All 7 chapters completed. Story arc closed properly. Author delivered on time.'},
  {id:'CMP-002',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',genre:'Historical Romance',chapters:31,wordCount:'186,400',submitted:'1d ago',status:'approved',notes:'Full story. 31 chapters. Well-written conclusion. Premium quality.'},
  {id:'CMP-003',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',genre:'Paranormal Romance',chapters:12,wordCount:'78,200',submitted:'2d ago',status:'pending',notes:'Author requests completion at Ch.12. Need to verify story closure.'},
  {id:'CMP-004',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',genre:'Contemporary Romance',chapters:9,wordCount:'54,100',submitted:'3d ago',status:'pending',notes:'Applied for completion. Pending review. Short but complete arc.'},
  {id:'CMP-005',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',genre:'Romantic Comedy',chapters:19,wordCount:'112,600',submitted:'4d ago',status:'rejected',notes:'Story feels rushed. Needs 2-3 more chapters for proper closure.'},
  {id:'CMP-006',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',genre:'Contemporary Romance',chapters:15,wordCount:'89,300',submitted:'5d ago',status:'approved',notes:'Complete story with satisfying ending. Good pacing.'},
  {id:'CMP-007',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',genre:'Suspense Romance',chapters:22,wordCount:'134,500',submitted:'6d ago',status:'pending',notes:'Completion requested. Author submitted final chapter draft.'},
  {id:'CMP-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',genre:'Family Drama',chapters:28,wordCount:'167,200',submitted:'1w ago',status:'approved',notes:'Beautiful family saga. Rich character development. Approved.'},
  {id:'CMP-009',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',genre:'Office Romance',chapters:35,wordCount:'210,800',submitted:'1w ago',status:'rejected',notes:'Needs more chapters. Ending feels incomplete.'},
  {id:'CMP-010',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',genre:'Paranormal Romance',chapters:42,wordCount:'252,100',submitted:'2w ago',status:'approved',notes:'Epic series finale. Excellent closure on all arcs.'},
  {id:'CMP-011',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',genre:'Office Romance',chapters:18,wordCount:'108,400',submitted:'2w ago',status:'pending',notes:'Author requests completion. Awaiting quality review.'},
  {id:'CMP-012',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',genre:'Fantasy Romance',chapters:25,wordCount:'156,700',submitted:'2w ago',status:'approved',notes:'Strong fantasy world-building. Satisfying conclusion.'},
  {id:'CMP-013',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',genre:'Contemporary Romance',chapters:20,wordCount:'124,300',submitted:'3w ago',status:'pending',notes:'Completion application received. Under review.'},
  {id:'CMP-014',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',genre:'Romantic Suspense',chapters:16,wordCount:'96,500',submitted:'3w ago',status:'rejected',notes:'Plot holes in chapters 14-16. Needs revision.'},
  {id:'CMP-015',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',genre:'Mafia Romance',chapters:30,wordCount:'182,600',submitted:'3w ago',status:'approved',notes:'Excellent sequel. Author maintained quality throughout.'},
  {id:'CMP-016',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',genre:'New Adult Romance',chapters:14,wordCount:'84,200',submitted:'1mo ago',status:'approved',notes:'Fun campus story. Great character development.'},
  {id:'CMP-017',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'Blood Ties',genre:'Paranormal Romance',chapters:38,wordCount:'228,900',submitted:'1mo ago',status:'approved',notes:'Epic paranormal saga. Approved with recommendation.'},
  {id:'CMP-018',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'The Inheritance',genre:'Family Drama',chapters:24,wordCount:'144,100',submitted:'1mo ago',status:'rejected',notes:'Unresolved subplot in chapter 22. Needs expansion.'},
  {id:'CMP-019',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Midnight Omega',genre:'Paranormal Romance',chapters:26,wordCount:'156,400',submitted:'1mo ago',status:'approved',notes:'Strong omega verse story. Approved.'},
  {id:'CMP-020',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Her Fake Fiance',genre:'Romantic Comedy',chapters:21,wordCount:'126,800',submitted:'1mo ago',status:'approved',notes:'Witty dialogue. Charming story. Approved.'}
];
var currentPage = 1, PER_PAGE = 5, openRowId = null;
var _bound = false;

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
  p.innerHTML = '<div class="detail-inner"><div class="detail-header"><img class="detail-avatar" src="' + a.avatar + '" alt=""/><div class="detail-title"><h3>' + a.author + '</h3><p>' + a.id + ' · ' + a.genre + '</p></div>' + statusPill(a.status) + '</div><div class="detail-grid"><div class="detail-card"><label>Book Title</label><b>' + a.book + '</b></div><div class="detail-card accent"><label>Total Chapters</label><b>' + a.chapters + ' chapters</b></div><div class="detail-card"><label>Word Count</label><b>' + a.wordCount + '</b></div><div class="detail-card"><label>Submitted</label><b>' + a.submitted + '</b></div></div><div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Review Notes</div><p>' + a.notes + '</p></div><div class="detail-actions">' + actionsHtml + '</div></div>';
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

function approve(id) { var a = items.find(function (x) { return x.id === id; }); if (a) { a.status = 'approved'; openRowId = null; render(); toast(a.book + ' — completion approved'); } }
function reject(id) { var a = items.find(function (x) { return x.id === id; }); if (a) { a.status = 'rejected'; openRowId = null; render(); toast(a.book + ' — completion rejected'); } }

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
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/completion-applications').then(function (data) { if (data && data.items) { items = data.items; render(); } });
  callBackend('/completion-applications');
  bindEvents();
  render();
}

window.CompletionApplicationService = { init: init };

})();
