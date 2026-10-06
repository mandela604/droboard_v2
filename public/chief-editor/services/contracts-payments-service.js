/**
 * contracts-payments-service.js — Contracts & Payments page controller
 * (migrated from contracts-payments.html inline script).
 * Pure call-and-render: init() attaches the sidebar shell and renders from data.
 * Backend-ready: set USE_API=true and serve JSON under API_BASE;
 * demo paths (window.ChiefEditorData) keep working when USE_API=false.
 */
(function(){
'use strict';
if(window.ContractsPaymentsService) return;

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, opts);
  if(!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}
async function loadContractTemplates(){
  try{
    const d = await callBackend('/contract-templates');
    if(Array.isArray(d)) return d;
    if(d && d.templates) return d.templates;
  }catch(e){ /* fall through to demo data */ }
  return window.ChiefEditorData.getContractTemplates();
}

function __contractsMain(){
'use strict';
const shell = ChiefEditorSidebar.attach('#dashRoot', {
  activeItem: 'contracts-payments',
  title: 'Contracts & Payments',
  subtitle: 'Contract offers senior editors send to writers — bonuses, royalties & terms',
  notifCount: 6,
  searchPlaceholder: 'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const TYPE_ICO = {
  'Non-Exclusive':'fa-file-pen', 'Exclusive':'fa-file-shield', 'Renewal':'fa-rotate',
  'Amendment':'fa-file-circle-plus', 'Work-for-Hire':'fa-file-invoice',
  'Royalty Share':'fa-chart-pie', 'Option':'fa-handshake', 'Serial Rights':'fa-book-open'
};

const TYPE_CLS = {
  'Non-Exclusive': 'green',
  'Exclusive': 'purple',
  'Renewal': 'green',
  'Amendment': 'amber',
  'Work-for-Hire': 'red',
  'Royalty Share': 'green',
  'Option': 'blue',
  'Serial Rights': 'purple'
};

let CONTRACTS = [];
const PAGE_SIZE = 6;
let filtered = [];
let currentPage = 1;
let editingId = null;
let pendingDeleteId = null;

function fmtNum(n){
  n = n || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function fmtUSD(n){ return '$' + (Number(n) || 0); }
function fmtBonusRange(min, max){
  min = Number(min) || 0; max = Number(max) || 0;
  if (!min && !max) return null;
  if (min === max) return fmtUSD(min);
  return fmtUSD(min) + '–' + fmtUSD(max);
}

function toast(msg, icon){
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `<i class="fas ${icon || 'fa-circle-check'}"></i><span>${msg}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.25s'; setTimeout(() => el.remove(), 250); }, 2600);
}
window.toast = toast;

function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(ov => closeModal(ov.id));
});

async function init(){
  CONTRACTS = await loadContractTemplates();
  populateTypeFilter();
  renderStatCards();
  applyFilters();
}

function populateTypeFilter(){
  const types = [...new Set(CONTRACTS.map(c => c.type))].sort();
  const sel = document.getElementById('typeFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All types</option>' + types.map(t => `<option value="${t}">${t}</option>`).join('');
  if (types.includes(current)) sel.value = current;
}

function renderStatCards(){
  const active = CONTRACTS.filter(c => c.status === 'active').length;
  const totalUsage = CONTRACTS.reduce((s, c) => s + (c.usageCount || 0), 0);
  const withBonus = CONTRACTS.filter(c => (c.signupBonusMin || c.signupBonusMax)).length;
  const stats = [
    { n: CONTRACTS.length, l: 'Total Contracts', ico: 'fa-file-contract', cls: 'accent' },
    { n: active, l: 'Active Offers', ico: 'fa-circle-check', cls: 'green' },
    { n: withBonus, l: 'With Signup Bonus', ico: 'fa-gift', cls: 'blue' },
    { n: totalUsage, l: 'Times Sent', ico: 'fa-paper-plane', cls: 'purple' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const typeVal = document.getElementById('typeFilter').value;
  const statusVal = document.getElementById('statusFilter').value;
  const sortVal = document.getElementById('sortSelect').value;

  filtered = CONTRACTS.filter(c => {
    const blob = [c.name, c.type, c.description, c.clauses].join(' ').toLowerCase();
    const matchesQ = !q || blob.includes(q);
    const matchesType = typeVal === 'all' || c.type === typeVal;
    const matchesStatus = statusVal === 'all' || c.status === statusVal;
    return matchesQ && matchesType && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortVal === 'name') return a.name.localeCompare(b.name);
    if (sortVal === 'royalty-desc') return (b.royaltyRate || 0) - (a.royaltyRate || 0);
    if (sortVal === 'usage') return (b.usageCount || 0) - (a.usageCount || 0);
    return (b.lastEdited || '').localeCompare(a.lastEdited || '') || a.name.localeCompare(b.name);
  });

  currentPage = 1;
  renderList();
}

function renderList(){
  document.getElementById('resultCount').textContent = filtered.length;
  const box = document.getElementById('ctrList');

  if (!filtered.length) {
    box.innerHTML = `<div class="empty-msg"><i class="fas fa-folder-open" style="font-size:20px;margin-bottom:8px;display:block"></i>No contracts match your filters.</div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  box.innerHTML = pageItems.map(c => {
    const cls = TYPE_CLS[c.type] || 'blue';
    const bonus = fmtBonusRange(c.signupBonusMin, c.signupBonusMax);
    const paused = c.status === 'paused';
    const archived = c.status === 'archived';

    return `
    <div class="ctr-card ${paused ? 'is-paused' : ''} ${archived ? 'is-archived' : ''}" data-id="${c.id}">
      <div class="ctr-summary" data-toggle="${c.id}">
        <div class="ctr-top">
          <span class="ctr-id">${c.id}</span>
         <div class="ctr-name" style="color:${ICO_MAP[cls]}">${c.name}</div>
          <div class="ctr-type-badge" style="background:${BG_MAP[cls]};color:${ICO_MAP[cls]}">
            <i class="fas ${TYPE_ICO[c.type] || 'fa-file'}"></i> ${c.type}
          </div>
          <span class="ctr-status ${c.status}">${c.status}</span>
          <i class="fas fa-chevron-down ctr-chevron"></i>
        </div>

        <div class="ctr-desc">${c.description || 'No description.'}</div>

        <div class="ctr-terms">
          ${c.royaltyRate != null ? `<span class="ctr-chip royalty"><strong>${c.royaltyRate}%</strong> royalty</span>` : ''}
          <span class="ctr-chip"><strong>${c.termLength}</strong> term</span>
          ${bonus ? `<span class="ctr-chip bonus"><strong>${bonus}</strong> signup bonus</span>` : ''}
          ${c.completionTarget ? `<span class="ctr-chip bonus"><strong>${fmtNum(c.completionTarget)}</strong> reads / ${c.completionWindowMonths || '?'} mo</span>` : ''}
          ${c.profitShareThreshold != null ? `<span class="ctr-chip bonus">Bonus at <strong>$${c.profitShareThreshold}</strong> profit</span>` : ''}
          ${c.autoRenew ? `<span class="ctr-chip">Auto-renew</span>` : ''}
        </div>
      </div>

      <div class="ctr-body">
        <div class="ctr-meta-row">
          <div class="ctr-meta-item"><span>Royalty</span><b>${c.royaltyRate != null ? c.royaltyRate + '%' : '—'}</b></div>
          <div class="ctr-meta-item"><span>Signup Bonus</span><b>${bonus || '—'}</b></div>
          <div class="ctr-meta-item"><span>Term</span><b>${c.termLength}</b></div>
          <div class="ctr-meta-item"><span>Times Sent</span><b>${c.usageCount || 0}</b></div>
          <div class="ctr-meta-item"><span>Last Edited</span><b>${c.lastEdited || '—'}</b></div>
        </div>

        <div class="ctr-actions">
          <button class="mini-btn ghost" data-action="view" data-id="${c.id}"><i class="fas fa-eye"></i> Details</button>
          <button class="mini-btn" data-action="edit" data-id="${c.id}"><i class="fas fa-pen"></i> Edit</button>
          ${c.status === 'active'
            ? `<button class="mini-btn warn" data-action="pause" data-id="${c.id}"><i class="fas fa-pause"></i> Pause</button>`
            : (c.status === 'paused' || c.status === 'draft')
              ? `<button class="mini-btn green" data-action="activate" data-id="${c.id}"><i class="fas fa-play"></i> Activate</button>`
              : ''}
          <button class="mini-btn danger" data-action="remove" data-id="${c.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination(totalPages);
}


function renderPagination(totalPages){
  const box = document.getElementById('pagination');
  if (totalPages <= 1) {
    box.innerHTML = `<div class="pg-info">Showing all ${filtered.length} contract${filtered.length === 1 ? '' : 's'}</div>`;
    return;
  }
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(filtered.length, currentPage * PAGE_SIZE);
  let pageBtns = '';
  const pushBtn = (p) => { pageBtns += `<button class="pg-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`; };
  const pushEllipsis = () => { pageBtns += `<span class="pg-ellipsis">…</span>`; };

  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p++) pushBtn(p);
  } else {
    pushBtn(1);
    if (currentPage > 3) pushEllipsis();
    const from = Math.max(2, currentPage - 1);
    const to = Math.min(totalPages - 1, currentPage + 1);
    for (let p = from; p <= to; p++) pushBtn(p);
    if (currentPage < totalPages - 2) pushEllipsis();
    pushBtn(totalPages);
  }

  box.innerHTML = `
    <div class="pg-info">Showing ${start}–${end} of ${filtered.length} contracts</div>
    <div class="pg-controls">
      <button class="pg-btn" id="pgPrev" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
      ${pageBtns}
      <button class="pg-btn" id="pgNext" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
    </div>`;

  document.getElementById('pgPrev')?.addEventListener('click', () => { currentPage--; renderList(); });
  document.getElementById('pgNext')?.addEventListener('click', () => { currentPage++; renderList(); });
  box.querySelectorAll('[data-page]').forEach(b => {
    b.addEventListener('click', () => { currentPage = parseInt(b.dataset.page, 10); renderList(); });
  });
}

document.getElementById('fAuto').addEventListener('change', e => {
  document.getElementById('fAutoLabel').textContent = e.target.checked ? 'On' : 'Off';
});

function resetForm(){
  document.getElementById('fId').value = '';
  document.getElementById('fName').value = '';
  document.getElementById('fType').value = 'Non-Exclusive';
  document.getElementById('fTerm').value = '1 Year';
  document.getElementById('fRoyalty').value = '15';
  document.getElementById('fBonusMin').value = '20';
  document.getElementById('fBonusMax').value = '50';
  document.getElementById('fCompTarget').value = '150000';
  document.getElementById('fCompMonths').value = '6';
  document.getElementById('fProfitThresh').value = '20';
  document.getElementById('fProfitBonus').value = '50';
  document.getElementById('fAuto').checked = false;
  document.getElementById('fAutoLabel').textContent = 'Off';
  document.getElementById('fStatus').value = 'active';
  document.getElementById('fDesc').value = '';
  document.getElementById('fClauses').value = '';
  document.getElementById('fNameErr').style.display = 'none';
  document.getElementById('fName').classList.remove('invalid');
}

function openAddModal(){
  editingId = null;
  resetForm();
  document.getElementById('formModalTitle').innerHTML = '<i class="fas fa-file-signature" style="color:var(--accent)"></i> New Contract';
  openModal('formModal');
}

function openEditModal(id){
  const c = CONTRACTS.find(x => x.id === id); if (!c) return;
  editingId = id;
  resetForm();
  document.getElementById('fId').value = c.id;
  document.getElementById('fName').value = c.name || '';
  document.getElementById('fType').value = c.type;
  document.getElementById('fTerm').value = c.termLength;
  document.getElementById('fRoyalty').value = c.royaltyRate ?? '';
  document.getElementById('fBonusMin').value = c.signupBonusMin ?? 0;
  document.getElementById('fBonusMax').value = c.signupBonusMax ?? 0;
  document.getElementById('fCompTarget').value = c.completionTarget ?? '';
  document.getElementById('fCompMonths').value = c.completionWindowMonths ?? '';
  document.getElementById('fProfitThresh').value = c.profitShareThreshold ?? '';
  document.getElementById('fProfitBonus').value = c.profitShareBonus ?? 0;
  document.getElementById('fAuto').checked = !!c.autoRenew;
  document.getElementById('fAutoLabel').textContent = c.autoRenew ? 'On' : 'Off';
  document.getElementById('fStatus').value = c.status || 'active';
  document.getElementById('fDesc').value = c.description || '';
  document.getElementById('fClauses').value = c.clauses || '';
  document.getElementById('formModalTitle').innerHTML = '<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Contract';
  openModal('formModal');
}

document.getElementById('addBtn').addEventListener('click', openAddModal);

document.getElementById('fSaveBtn').addEventListener('click', () => {
  const name = document.getElementById('fName').value.trim();
  if (!name) {
    document.getElementById('fNameErr').style.display = 'block';
    document.getElementById('fName').classList.add('invalid');
    return;
  }
  document.getElementById('fNameErr').style.display = 'none';
  document.getElementById('fName').classList.remove('invalid');

  const payload = {
    name,
    type: document.getElementById('fType').value,
    termLength: document.getElementById('fTerm').value,
    royaltyRate: document.getElementById('fRoyalty').value === '' ? null : parseFloat(document.getElementById('fRoyalty').value),
    signupBonusMin: parseFloat(document.getElementById('fBonusMin').value) || 0,
    signupBonusMax: parseFloat(document.getElementById('fBonusMax').value) || 0,
    completionTarget: document.getElementById('fCompTarget').value === '' ? null : parseFloat(document.getElementById('fCompTarget').value),
    completionWindowMonths: document.getElementById('fCompMonths').value === '' ? null : parseFloat(document.getElementById('fCompMonths').value),
    profitShareThreshold: document.getElementById('fProfitThresh').value === '' ? null : parseFloat(document.getElementById('fProfitThresh').value),
    profitShareBonus: parseFloat(document.getElementById('fProfitBonus').value) || 0,
    autoRenew: document.getElementById('fAuto').checked,
    status: document.getElementById('fStatus').value,
    description: document.getElementById('fDesc').value.trim(),
    clauses: document.getElementById('fClauses').value.trim(),
    currency: 'USD',
  };

  if (editingId) {
    const c = CONTRACTS.find(x => x.id === editingId);
    Object.assign(c, payload, { lastEdited: 'Jul 30, 2026' });
    toast(`Saved “${name}”`, 'fa-circle-check');
  } else {
    CONTRACTS.unshift(Object.assign({
      id: 'TPL-' + String(100 + CONTRACTS.length + Math.floor(Math.random() * 50)).padStart(3, '0'),
      usageCount: 0,
      created: 'Jul 30, 2026',
      lastEdited: 'Jul 30, 2026',
    }, payload));
    toast(`Created “${name}”`, 'fa-circle-plus');
  }

  closeModal('formModal');
  populateTypeFilter();
  renderStatCards();
  applyFilters();
});

function openDetailsModal(id){
  const c = CONTRACTS.find(x => x.id === id); if (!c) return;
  const cls = TYPE_CLS[c.type] || 'blue';
  const bonus = fmtBonusRange(c.signupBonusMin, c.signupBonusMax);

  document.getElementById('dModalTitle').innerHTML = `<i class="fas ${TYPE_ICO[c.type] || 'fa-file'}" style="color:var(--accent)"></i> ${c.id}`;

  document.getElementById('detailsBody').innerHTML = `
    <div class="dt-status-row">
      <span class="ctr-status ${c.status}">${c.status}</span>
      <span class="ctr-type-badge" style="background:${BG_MAP[cls]};color:${ICO_MAP[cls]}">
        <i class="fas ${TYPE_ICO[c.type] || 'fa-file'}"></i> ${c.type}
      </span>
      <span style="font-size:11px;color:var(--text-faint);font-weight:600">Edited ${c.lastEdited || '—'}</span>
    </div>

    <div style="font-size:16px;font-weight:800;margin-bottom:8px">${c.name}</div>
    <p style="font-size:12.5px;color:var(--text-muted);line-height:1.6;margin-bottom:18px">${c.description || ''}</p>

    <div class="dt-grid">
      <div class="dt-item"><span>Royalty rate</span><b>${c.royaltyRate != null ? c.royaltyRate + '%' : '—'}</b></div>
      <div class="dt-item"><span>Signup bonus</span><b>${bonus || '—'}</b></div>
      <div class="dt-item"><span>Term</span><b>${c.termLength}</b></div>
      <div class="dt-item"><span>Auto-renew</span><b>${c.autoRenew ? 'Yes' : 'No'}</b></div>
      <div class="dt-item"><span>Times sent</span><b>${c.usageCount || 0}</b></div>
      <div class="dt-item"><span>Created</span><b>${c.created || '—'}</b></div>
    </div>

    ${(c.completionTarget || c.profitShareThreshold != null) ? `
    <div class="dt-section">
      <h4><i class="fas fa-gift" style="font-size:10px;color:var(--accent)"></i> Bonus structure</h4>
      <div class="dt-grid">
        ${c.completionTarget ? `<div class="dt-item"><span>Completion target</span><b>${fmtNum(c.completionTarget)} reads</b></div>` : ''}
        ${c.completionWindowMonths ? `<div class="dt-item"><span>Window</span><b>${c.completionWindowMonths} months</b></div>` : ''}
        ${c.profitShareThreshold != null ? `<div class="dt-item"><span>Profit threshold</span><b>$${c.profitShareThreshold}</b></div>` : ''}
        ${c.profitShareBonus ? `<div class="dt-item"><span>Profit bonus</span><b>$${c.profitShareBonus}</b></div>` : ''}
      </div>
    </div>` : ''}

    ${c.clauses ? `
    <div class="dt-section">
      <h4><i class="fas fa-list-check" style="font-size:10px;color:var(--accent)"></i> Key clauses</h4>
      <div class="dt-clause">${c.clauses}</div>
    </div>` : ''}
  `;

  const canToggle = c.status === 'active' || c.status === 'paused' || c.status === 'draft';
  document.getElementById('detailsFoot').innerHTML = `
    <button class="mini-btn ghost" data-close="detailsModal">Close</button>
    <button class="mini-btn" id="dEditBtn"><i class="fas fa-pen"></i> Edit</button>
    ${canToggle
      ? (c.status === 'active'
        ? `<button class="mini-btn warn" id="dToggleBtn"><i class="fas fa-pause"></i> Pause</button>`
        : `<button class="mini-btn green" id="dToggleBtn"><i class="fas fa-play"></i> Activate</button>`)
      : ''}
    <button class="mini-btn danger" id="dRemoveBtn"><i class="fas fa-trash"></i> Remove</button>`;

  document.getElementById('dEditBtn').addEventListener('click', () => { closeModal('detailsModal'); openEditModal(c.id); });
  const toggleBtn = document.getElementById('dToggleBtn');
  if (toggleBtn) toggleBtn.addEventListener('click', () => { toggleStatus(c.id); closeModal('detailsModal'); });
  document.getElementById('dRemoveBtn').addEventListener('click', () => { closeModal('detailsModal'); openConfirmDelete(c.id); });

  openModal('detailsModal');
}

function toggleStatus(id){
  const c = CONTRACTS.find(x => x.id === id); if (!c) return;
  if (c.status === 'active') {
    c.status = 'paused';
    toast(`Paused “${c.name}”`, 'fa-circle-pause');
  } else {
    c.status = 'active';
    toast(`Activated “${c.name}”`, 'fa-circle-play');
  }
  renderStatCards();
  applyFiltersKeepPage();
}

function applyFiltersKeepPage(){
  const keep = currentPage;
  applyFilters();
  currentPage = keep;
  renderList();
}

function openConfirmDelete(id){
  const c = CONTRACTS.find(x => x.id === id); if (!c) return;
  pendingDeleteId = id;
  document.getElementById('confirmName').textContent = c.name;
  openModal('confirmModal');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const c = CONTRACTS.find(x => x.id === pendingDeleteId);
  CONTRACTS = CONTRACTS.filter(x => x.id !== pendingDeleteId);
  closeModal('confirmModal');
  toast(`Removed “${c ? c.name : 'contract'}”`, 'fa-trash');
  pendingDeleteId = null;
  populateTypeFilter();
  renderStatCards();
  applyFilters();
});

document.getElementById('ctrList').addEventListener('click', e => {
  // Action buttons inside the expanded body
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    e.stopPropagation();
    const id = actionEl.dataset.id;
    const action = actionEl.dataset.action;
    if (action === 'view') openDetailsModal(id);
    else if (action === 'edit') openEditModal(id);
    else if (action === 'pause' || action === 'activate') toggleStatus(id);
    else if (action === 'remove') openConfirmDelete(id);
    return;
  }

  // Toggle accordion
  const summary = e.target.closest('[data-toggle]');
  if (summary) {
    const card = summary.closest('.ctr-card');
    if (card) {
      // Optional: close other open cards (accordion behavior)
      document.querySelectorAll('.ctr-card.is-open').forEach(other => {
        if (other !== card) other.classList.remove('is-open');
      });
      card.classList.toggle('is-open');
    }
  }
});

let searchDebounce;
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyFilters, 180);
});
document.getElementById('typeFilter').addEventListener('change', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortSelect').addEventListener('change', applyFilters);

init();
}

var _cpInited = false;
function init(){
  if(_cpInited) return;
  _cpInited = true;
  __contractsMain();
}

window.ContractsPaymentsService = { init: init };
})();
