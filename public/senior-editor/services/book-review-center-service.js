/**
 * book-review-center-service.js — Book Review Center page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false (uses DroboardAPI demo layer).
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
    console.warn('[BookReviewCenterService] backend unavailable, using demo data', e);
    return null;
  }
}

let activeTab = 'all', currentPage = 1;
const PER_PAGE = 8;
let allReviews = [];
let _bound = false;

function statusPillHtml(s) { const c = {approved:'approved',pending:'pending',reviewing:'reviewing',rejected:'rejected'}[s] || 'pending'; return '<span class="status-pill ' + c + '"><span class="dot"></span>' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>'; }

async function refresh() {
  try {
    const q = document.getElementById('tableSearch').value.trim(), cat = document.getElementById('fCategory').value, stat = document.getElementById('fStatus').value;
    // Backend swap point: when USE_API=true, prefer callBackend over DroboardAPI demo layer.
    let backend = await callBackend('/book-reviews?tab=' + encodeURIComponent(activeTab) + '&search=' + encodeURIComponent(q));
    if (backend && backend.items) { allReviews = backend.items; }
    else {
      const res = await DroboardAPI.getReviews({tab:activeTab,search:q,category:cat,genre:stat==='All Status'?null:stat,status:stat==='All Status'?null:stat});
      allReviews = res.items;
    }
    renderTable(); renderStats(); renderTabs();
  } catch (e) { toast('Error: ' + e.message); }
}

function renderTable() {
  const body = document.getElementById('tableBody'), total = allReviews.length, tp = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > tp) currentPage = tp;
  const start = (currentPage - 1) * PER_PAGE, page = allReviews.slice(start, start + PER_PAGE);
  if (!page.length) { body.innerHTML = '<tr class="empty-row"><td colspan="7"><i class="fas fa-inbox"></i>No reviews match this filter.</td></tr>'; }
  else {
    body.innerHTML = page.map(r => '<tr><td data-label="Book Details"><div style="display:flex;align-items:center;gap:12px"><div class="cover"><img src="' + r.img + '" alt=""/></div><div><div class="title">' + r.title + '</div><div class="id">ID: ' + r.id + '</div></div></div></td><td data-label="Author"><div class="author-cell"><img src="' + r.writerAv + '" alt=""/><span style="font-weight:600;font-size:12.5px">' + r.writer + '</span></div></td><td data-label="Category" class="cat-main">' + r.cat + '</td><td data-label="Rating" class="rating-cell">★ ' + r.rating + '</td><td data-label="Status">' + statusPillHtml(r.status) + '</td><td data-label="Likes" class="likes-cell">❤️ ' + r.likes + '</td><td data-label="Actions"><div class="actions-cell">' + (r.status === 'pending' || r.status === 'reviewing' ? '<button class="act-btn approve" title="Approve" onclick="approveReview(\'' + r.id + '\')"><i class="fas fa-check"></i></button><button class="act-btn reject" title="Reject" onclick="rejectReview(\'' + r.id + '\')"><i class="fas fa-xmark"></i></button>' : '') + '<button class="act-btn" title="View" onclick="viewReview(\'' + r.id + '\')"><i class="fas fa-eye"></i></button></div></td></tr>').join('');
  }
  document.getElementById('pageInfo').innerHTML = total ? 'Showing <b>' + (start + 1) + '</b> to <b>' + Math.min(start + PER_PAGE, total) + '</b> of <b>' + total + '</b> reviews' : 'No reviews found';
  renderPagination(tp);
}

function renderPagination(tp) {
  const w = document.getElementById('pageBtns');
  if (tp <= 1) { w.innerHTML = ''; return; }
  let h = '<button class="pg-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' onclick="goPage(' + (currentPage - 1) + ')"><i class="fas fa-chevron-left"></i></button>';
  const sP = Math.max(1, currentPage - 2), eP = Math.min(tp, currentPage + 2);
  if (sP > 1) h += '<button class="pg-btn" onclick="goPage(1)">1</button>' + (sP > 2 ? '<span class="pg-dots">…</span>' : '');
  for (let i = sP; i <= eP; i++) h += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" onclick="goPage(' + i + ')">' + i + '</button>';
  if (eP < tp) h += (eP < tp - 1 ? '<span class="pg-dots">…</span>' : '') + '<button class="pg-btn" onclick="goPage(' + tp + ')">' + tp + '</button>';
  h += '<button class="pg-btn"' + (currentPage >= tp ? ' disabled' : '') + ' onclick="goPage(' + (currentPage + 1) + ')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML = h;
}

function goPage(p) { currentPage = p; renderTable(); }

function renderStats() {
  const b = DroboardAPI._reviews, t = b.length, p = b.filter(x => x.status === 'pending' || x.status === 'reviewing').length, a = b.filter(x => x.status === 'approved').length, r = b.filter(x => x.status === 'rejected').length;
  document.getElementById('statsGrid').innerHTML = '<div class="stat-card"><div class="stat-top"><div class="stat-ico green"><i class="fas fa-clipboard-check"></i></div><span class="stat-delta">+12%</span></div><div class="stat-num">' + a + '</div><div class="stat-lbl">Approved</div></div><div class="stat-card"><div class="stat-top"><div class="stat-ico amber"><i class="fas fa-clock"></i></div><span class="stat-delta">+5 new</span></div><div class="stat-num">' + p + '</div><div class="stat-lbl">Pending Review</div></div><div class="stat-card"><div class="stat-top"><div class="stat-ico red"><i class="fas fa-xmark-circle"></i></div><span class="stat-delta">-3%</span></div><div class="stat-num">' + r + '</div><div class="stat-lbl">Rejected</div></div><div class="stat-card"><div class="stat-top"><div class="stat-ico blue"><i class="fas fa-star"></i></div><span class="stat-delta">+18%</span></div><div class="stat-num">' + t + '</div><div class="stat-lbl">Total Reviews</div></div>';
}

function renderTabs() {
  const counts = {all:DroboardAPI._reviews.length,pending:DroboardAPI._reviews.filter(r => r.status === 'pending').length,reviewing:DroboardAPI._reviews.filter(r => r.status === 'reviewing').length,approved:DroboardAPI._reviews.filter(r => r.status === 'approved').length,rejected:DroboardAPI._reviews.filter(r => r.status === 'rejected').length};
  document.getElementById('countAll').textContent = counts.all;
  document.querySelectorAll('.tab-item').forEach(t => { const k = t.dataset.tab, c = t.querySelector('.tab-count'); if (c && counts[k] !== undefined) c.textContent = counts[k]; });
}

function bindEvents() {
  if (_bound) return; _bound = true;
  document.querySelectorAll('.tab-item').forEach(tab => { tab.addEventListener('click', () => { document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active')); tab.classList.add('active'); activeTab = tab.dataset.tab; currentPage = 1; refresh(); }); });
  ['tableSearch','fCategory','fStatus'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener(id === 'tableSearch' ? 'input' : 'change', () => { currentPage = 1; refresh(); }); });
}

async function approveReview(id) { await DroboardAPI.approveReview(id); toast('✅ Review approved'); refresh(); }
async function rejectReview(id) { await DroboardAPI.rejectReview(id); toast('❌ Review rejected'); refresh(); }

function viewReview(id) {
  const r = DroboardAPI._reviews.find(x => x.id === id);
  if (!r) return;
  DroboardModal.show('<h2>' + r.title + '</h2><div class="sub">by ' + r.writer + ' · ★ ' + r.rating + ' · ❤️ ' + r.likes + '</div><div style="margin:16px 0"><img src="' + r.img + '" style="width:100%;height:140px;border-radius:8px;object-fit:cover;border:1px solid var(--border)"/></div><div class="drm-form-group"><label>Category</label><div style="font-size:13px;font-weight:600">' + r.cat + '</div></div><div class="drm-form-group"><label>Submitted</label><div style="font-size:13px;color:var(--text-muted)">' + new Date(r.submitted).toLocaleString() + '</div></div><div class="drm-form-actions"><button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Close</button></div>');
}

function attachShell() {
  if (!window.SeniorEditorSidebar || !window.SeniorEditorSidebar.attach) return;
  SeniorEditorSidebar.attach('#dashboardRoot', {activeItem:'book-review-center',title:'Book Review Center',subtitle:'Review and approve submitted books',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,searchPlaceholder:'Search by title, author, or category...',mobileSearchTarget:'#tableSearch',onSearch:(v) => { document.getElementById('tableSearch').value = v; refresh(); }});
}

function init() {
  attachShell();
  window.goPage = goPage;
  window.approveReview = approveReview;
  window.rejectReview = rejectReview;
  window.viewReview = viewReview;
  window.refresh = refresh;
  bindEvents();
  refresh();
}

function openDateFilter(){ return callBackend('/book-reviews/date-filter').then(function(r){ if(!r) toast('Date filter opened'); }); }

window.BookReviewCenterService = { init: init, openDateFilter: openDateFilter };

})();
