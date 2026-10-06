(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend error ' + res.status);
  return res.json();
}

/* ── DATA ── */
let allPolicies = [];
let filteredPolicies = [];
const PER_PAGE = 4;
let currentPage = 1;

/* ── MODAL LOGIC (refs bound in init) ── */
let ov = null;
let slide = null;
let addOv = null;
let addSlide = null;

function openModal(policy) {
  document.getElementById('modalTitle').textContent = policy.title;
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-meta-grid">
      <div class="modal-meta-item"><div class="mm-label">Status</div><div class="mm-value"><span class="status-pill ${policy.status}">${policy.status}</span></div></div>
      <div class="modal-meta-item"><div class="mm-label">ID</div><div class="mm-value">${policy.id}</div></div>
      <div class="modal-meta-item"><div class="mm-label">Author</div><div class="mm-value">${policy.author}</div></div>
      <div class="modal-meta-item"><div class="mm-label">Updated</div><div class="mm-value">${policy.updated}</div></div>
    </div>
    <div class="modal-section">
      <div class="modal-section-lbl">Summary</div>
      <div class="modal-text">${policy.summary}</div>
    </div>
    <div class="modal-section">
      <div class="modal-section-lbl">Full Content</div>
      <div class="modal-text">${policy.fullBody || policy.summary}</div>
    </div>
    <div class="modal-actions">
      <button class="primary" id="modalEditBtn"><i class="fas fa-pen"></i> Edit Policy</button>
      <button class="danger" id="modalArchiveBtn"><i class="fas fa-archive"></i> Archive</button>
    </div>`;
  ov.classList.add('open');
  slide.classList.add('open');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
  document.getElementById('modalEditBtn').addEventListener('click', () => { toast('✏️ Opening policy editor...'); closeModal(); });
  document.getElementById('modalArchiveBtn').addEventListener('click', () => {
    if (!confirm(`Archive ${policy.title}?`)) return;
    allPolicies = allPolicies.filter(p => p.id !== policy.id);
    toast(`📦 ${policy.title} archived`);
    closeModal();
    applyFilters();
  });
}

function closeModal() {
  ov.classList.remove('open'); slide.classList.remove('open');
}

/* ── ADD NEW POLICY MODAL ── */
function openAddModal() {
  document.getElementById('newTitle').value = '';
  document.getElementById('newBody').value = '';
  document.getElementById('newAuthor').value = 'Reina Morgan';
  addOv.classList.add('open'); addSlide.classList.add('open');
}
function closeAddModal() { addOv.classList.remove('open'); addSlide.classList.remove('open'); }

/* ── RENDER ── */
function applyFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  filteredPolicies = allPolicies.filter(p =>
    p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
  );
  currentPage = 1;
  renderPolicies();
}

function renderPolicies() {
  const totalPages = Math.max(1, Math.ceil(filteredPolicies.length / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PER_PAGE;
  const pageItems = filteredPolicies.slice(start, start + PER_PAGE);

  document.getElementById('policyCount').textContent = `(${filteredPolicies.length} total)`;
  document.getElementById('policiesList').innerHTML = pageItems.length
    ? pageItems.map(p => `
      <div class="policy-card" data-id="${p.id}">
        <div class="pc-title">${p.title} <span class="status-pill ${p.status}">${p.status}</span></div>
        <div class="pc-summary">${p.fullBody || p.summary}</div>
        <div class="pc-meta"><span>📅 ${p.updated}</span><span>✍️ ${p.author}</span><span>🆔 ${p.id}</span></div>
      </div>`).join('')
    : `<div style="text-align:center;padding:40px 16px;color:var(--text-muted)"><i class="fas fa-search" style="font-size:24px;display:block;margin-bottom:10px;color:var(--text-faint)"></i>No policies match your search.</div>`;

  document.querySelectorAll('#policiesList .policy-card').forEach(el => {
    el.addEventListener('click', () => {
      const p = allPolicies.find(x => x.id === el.dataset.id);
      if (p) openModal(p);
    });
  });

  // Pagination
  const pag = document.getElementById('pagination');
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${currentPage<=1?'disabled':''} data-page="${currentPage-1}"><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i===currentPage?'active':''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" ${currentPage>=totalPages?'disabled':''} data-page="${currentPage+1}"><i class="fas fa-chevron-right"></i></button>`;
  pag.innerHTML = html;
  pag.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderPolicies();
    });
  });
}

async function loadData() {
  const d = await ChiefEditorData.getEditorialPolicies();
  // Add fullBody to each policy for modal display
  allPolicies = d.policies.map(p => ({
    ...p,
    fullBody: p.summary + '\n\nThis policy is part of the Droboard platform content moderation system. It outlines the standards and procedures that all authors and editors must follow when publishing content on the platform. Violations may result in content takedown, warnings, or account suspension depending on severity and recurrence.'
  }));
  document.getElementById('historyList').innerHTML = d.policyHistory.map(h => `
    <div class="history-item"><div class="hi-date">${h.date}</div><div>${h.action}</div><div style="color:var(--text-faint);font-size:11px">by ${h.by}</div></div>`).join('');
  applyFilters();
}

function init() {
  const shell = ChiefEditorSidebar.attach('#policiesRoot',{
    activeItem:'editorial-policies',title:'Editorial Policies',subtitle:'Content guidelines & standards',
    user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:6
  });

  ov = document.getElementById('modalOverlay');
  slide = document.getElementById('modalSlide');
  addOv = document.getElementById('addModalOverlay');
  addSlide = document.getElementById('addModalSlide');

  document.getElementById('addPolicyBtn').addEventListener('click', openAddModal);
  document.getElementById('addModalClose').addEventListener('click', closeAddModal);
  document.getElementById('addCancel').addEventListener('click', closeAddModal);
  addOv.addEventListener('click', (e) => { if (e.target === addOv) closeAddModal(); });

  document.getElementById('addSave').addEventListener('click', () => {
    const title = document.getElementById('newTitle').value.trim();
    const body = document.getElementById('newBody').value.trim();
    const author = document.getElementById('newAuthor').value.trim();
    if (!title || !body) { toast('Please add a title and body'); return; }
    const newPolicy = {
      id: 'POL-' + String(allPolicies.length + 1).padStart(3, '0'),
      title, status: 'draft', updated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author, summary: body.substring(0, 120) + (body.length > 120 ? '…' : ''), fullBody: body
    };
    allPolicies.unshift(newPolicy);
    toast(`✅ "${title}" created as draft`);
    closeAddModal();
    applyFilters();
  });

  document.getElementById('searchInput').addEventListener('input', applyFilters);

  return loadData();
}

window.EditorialPoliciesService = { init: init };

})();
