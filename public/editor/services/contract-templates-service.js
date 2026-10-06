/**
 * services/contract-templates-service.js — Contract Templates page logic (pure call-and-render).
 * contract-templates.html only loads this service + ContractTemplatesService.init().
 * Backend-ready: set USE_API=true and implement endpoints below.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';
if (window.ContractTemplatesService) return;

const USE_API = false;
const API_BASE = '/api/editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[ContractTemplatesService] backend unavailable, using demo data', e);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */
const TEMPLATES = [
  { id:1, name:'Non-Exclusive Publishing Agreement', desc:'Standard agreement for non-exclusive publishing rights.', type:'Publishing', icon:'fa-file-lines', bg:'#ece3fd', color:'#7c5cfc', status:'active', updated:'Jun 15, 2026', by:'Reina Morgan', clauses:12 },
  { id:2, name:'Exclusive Publishing Agreement', desc:'Exclusive rights agreement for publishing and distribution.', type:'Publishing', icon:'fa-file-circle-check', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'Jun 10, 2026', by:'Reina Morgan', clauses:14 },
  { id:3, name:'Revenue Share Agreement', desc:'Agreement for revenue sharing with authors.', type:'Financial', icon:'fa-sack-dollar', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'Jun 8, 2026', by:'Reina Morgan', clauses:9 },
  { id:4, name:'Author Assignment Agreement', desc:'Transfer of certain rights by the author to the platform.', type:'Legal', icon:'fa-user-pen', bg:'#e3ecfd', color:'#2f7de1', status:'active', updated:'Jun 5, 2026', by:'Reina Morgan', clauses:8 },
  { id:5, name:'Confidentiality Agreement (NDA)', desc:'Non-disclosure agreement for confidential information.', type:'Legal', icon:'fa-lock', bg:'#fde3e3', color:'#e0384d', status:'draft', updated:'Jun 2, 2026', by:'Reina Morgan', clauses:6 },
  { id:6, name:'Translation Rights Agreement', desc:'Agreement for translation and foreign language rights.', type:'Rights', icon:'fa-globe', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'May 28, 2026', by:'Reina Morgan', clauses:10 },
  { id:7, name:'Short Story Publishing Agreement', desc:'Agreement template for short story publications.', type:'Publishing', icon:'fa-book', bg:'#e2f8ea', color:'#16a34a', status:'active', updated:'May 25, 2026', by:'Reina Morgan', clauses:7 },
  { id:8, name:'Audiobook Rights Agreement', desc:'Agreement for audiobook production and distribution.', type:'Rights', icon:'fa-headphones', bg:'#fef3d8', color:'#d97706', status:'draft', updated:'May 20, 2026', by:'Reina Morgan', clauses:11 },
  { id:9, name:'Old Standard Agreement', desc:'Previous version of standard publishing agreement.', type:'Publishing', icon:'fa-file', bg:'#eef0f2', color:'#5b6470', status:'archived', updated:'May 15, 2026', by:'Reina Morgan', clauses:9 },
  { id:10, name:'Film & Adaptation Rights Agreement', desc:'Agreement for film, TV, and other adaptations.', type:'Rights', icon:'fa-film', bg:'#fde3e3', color:'#e0384d', status:'active', updated:'May 10, 2026', by:'Reina Morgan', clauses:13 },
  { id:11, name:'Merchandising Rights Agreement', desc:'Agreement covering merchandising and licensing rights.', type:'Rights', icon:'fa-tags', bg:'#ece3fd', color:'#7c5cfc', status:'active', updated:'May 6, 2026', by:'Reina Morgan', clauses:8 },
  { id:12, name:'Co-Authorship Agreement', desc:'Agreement between two or more co-authors of a work.', type:'Legal', icon:'fa-user-group', bg:'#e3ecfd', color:'#2f7de1', status:'active', updated:'May 2, 2026', by:'Reina Morgan', clauses:10 },
];

const HISTORY = [
  { icon:'fa-pen', label:'Edited by Reina Morgan', date:'Jun 15, 2026' },
  { icon:'fa-check', label:'Marked as Active', date:'Jun 15, 2026' },
  { icon:'fa-copy', label:'Duplicated from v1.2', date:'Feb 3, 2026' },
  { icon:'fa-plus', label:'Template created', date:'Jan 18, 2026' },
];

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let selectedId = TEMPLATES[0].id;
let activeDpTab = 'preview';
let _bound = false;

function statusPillHtml(status){
  if (status === 'active') return `<span class="status-pill"><span class="dot"></span>Active</span>`;
  if (status === 'draft') return `<span class="status-pill draft"><span class="dot"></span>Draft</span>`;
  return `<span class="status-pill archived"><span class="dot"></span>Archived</span>`;
}

function currentFiltered(){
  const q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  return TEMPLATES.filter(t => {
    const matchesQ = !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesQ && matchesStatus;
  });
}

function renderTable(list){
  const body = document.getElementById('tableBody');
  if (!list.length){
    body.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fas fa-folder-open"></i>No templates match this search.</td></tr>`;
    return;
  }
  body.innerHTML = list.map(t => `
    <tr class="${t.id === selectedId ? 'selected' : ''}" data-id="${t.id}">
      <td data-label="Template Name">
        <div class="tmpl-cell">
          <div class="tmpl-icn" style="background:${t.bg};color:${t.color}"><i class="fas ${t.icon}"></i></div>
          <div>
            <div class="tmpl-name">${t.name}</div>
            <div class="tmpl-desc">${t.desc}</div>
          </div>
        </div>
      </td>
      <td data-label="Type" class="plain-cell">${t.type}</td>
      <td data-label="Status">${statusPillHtml(t.status)}</td>
      <td data-label="Last Updated" class="meta-cell"><b>${t.updated}</b>by ${t.by}</td>
      <td data-label="Actions">
        <div class="actions-cell">
          <button class="act-btn" title="Preview" onclick="event.stopPropagation();selectTemplate(${t.id})"><i class="fas fa-eye"></i></button>
          <button class="act-btn" title="Edit" onclick="event.stopPropagation();toast('Editing \\'${t.name}\\'…')"><i class="fas fa-pen"></i></button>
          <button class="act-btn" title="More" onclick="event.stopPropagation();toast('More actions for \\'${t.name}\\'')"><i class="fas fa-ellipsis"></i></button>
        </div>
      </td>
    </tr>`).join('');

  body.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => selectTemplate(Number(row.dataset.id)));
  });
}

function renderPageInfo(count){
  document.getElementById('pageInfo').innerHTML = `Showing <b>${count ? 1 : 0}</b> to <b>${count}</b> of <b>12</b> templates`;
}

function dpPreviewHtml(t){
  return `
    <h3>${t.name.toUpperCase()}</h3>
    <p>This ${t.name} ("Agreement") is made and entered into on this ___ day of ___________, 20__, by and between:</p>
    <p><b>NovelX Platform Ltd.</b>, a company registered under the laws of ___________, with its principal place of business at ___________ ("Publisher")</p>
    <p>and</p>
    <p>___________________________ ("Author")</p>
    <div class="clause">1. GRANT OF RIGHTS</div>
    <p>The Author grants to the Publisher a ${t.type === 'Rights' ? 'limited, revocable' : 'non-exclusive, worldwide'}, royalty-bearing license to publish, reproduce, distribute, and make available the Work in digital and/or print formats.</p>
    <div class="clause">2. AUTHOR REPRESENTATIONS</div>
    <p>The Author represents and warrants that the Work is original and does not infringe any third-party rights.</p>
    <div class="clause">3. ROYALTIES AND PAYMENT</div>
    <p>The Publisher shall pay royalties to the Author as set forth in the Revenue Share Agreement associated with this template.</p>
    <div class="clause">4. TERM AND TERMINATION</div>
    <p>This Agreement shall commence on the Effective Date and remain in effect until terminated by either party in accordance with this Agreement.</p>
  `;
}

function dpDetailsHtml(t){
  return `
    <div class="dp-details-list">
      <div class="dp-detail-row"><span>Template ID</span><b>TPL-${String(t.id).padStart(4,'0')}</b></div>
      <div class="dp-detail-row"><span>Type</span><b>${t.type}</b></div>
      <div class="dp-detail-row"><span>Status</span><b>${t.status.charAt(0).toUpperCase()+t.status.slice(1)}</b></div>
      <div class="dp-detail-row"><span>Clauses</span><b>${t.clauses}</b></div>
      <div class="dp-detail-row"><span>Last Updated</span><b>${t.updated}</b></div>
      <div class="dp-detail-row"><span>Updated By</span><b>${t.by}</b></div>
    </div>`;
}

function dpClausesHtml(t){
  const labels = ['Grant of Rights','Author Representations','Royalties and Payment','Term and Termination','Confidentiality','Indemnification','Governing Law','Assignment','Force Majeure','Notices','Entire Agreement','Amendments','Severability','Dispute Resolution'];
  return `<div class="dp-clause-list">${Array.from({length:t.clauses}).map((_,i) => `
    <div class="dp-clause-item"><i class="fas fa-check"></i>${i+1}. ${labels[i] || 'Additional Clause'}</div>`).join('')}</div>`;
}

function dpHistoryHtml(){
  return `<div>${HISTORY.map(h => `
    <div class="dp-history-item"><i class="fas ${h.icon}"></i><div><b>${h.label}</b><span>${h.date}</span></div></div>`).join('')}</div>`;
}

function renderDetailPanel(){
  const t = TEMPLATES.find(x => x.id === selectedId) || TEMPLATES[0];
  const panel = document.getElementById('detailPanel');
  panel.innerHTML = `
    <div class="dp-head">
      <div class="dp-icn" style="background:${t.bg};color:${t.color}"><i class="fas ${t.icon}"></i></div>
      <div>
        <div class="dp-title-row"><div class="dp-title">${t.name}</div>${statusPillHtml(t.status)}</div>
        <div class="dp-meta">Type: ${t.type} Agreement<br/>Last updated: ${t.updated} by ${t.by}</div>
      </div>
    </div>
    <div class="dp-tabs">
      <div class="dp-tab${activeDpTab==='preview'?' active':''}" data-tab="preview">Preview</div>
      <div class="dp-tab${activeDpTab==='details'?' active':''}" data-tab="details">Details</div>
      <div class="dp-tab${activeDpTab==='clauses'?' active':''}" data-tab="clauses">Clauses (${t.clauses})</div>
      <div class="dp-tab${activeDpTab==='history'?' active':''}" data-tab="history">History</div>
    </div>
    <div class="dp-preview">
      ${activeDpTab === 'preview' ? dpPreviewHtml(t) :
        activeDpTab === 'details' ? dpDetailsHtml(t) :
        activeDpTab === 'clauses' ? dpClausesHtml(t) : dpHistoryHtml()}
    </div>
    <div class="dp-actions">
      <button class="dp-btn" onclick="toast('Editing \\'${t.name}\\'…')"><i class="fas fa-pen"></i> Edit Template</button>
      <button class="dp-btn" onclick="toast('Duplicating \\'${t.name}\\'…')"><i class="fas fa-copy"></i> Duplicate</button>
      <button class="dp-btn danger" onclick="toast('Archiving \\'${t.name}\\'…')"><i class="fas fa-box-archive"></i> Archive</button>
    </div>
  `;
  panel.querySelectorAll('.dp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeDpTab = tab.dataset.tab;
      renderDetailPanel();
    });
  });
}

function selectTemplate(id){
  selectedId = id;
  activeDpTab = 'preview';
  refresh();
}

function refresh(){
  const list = currentFiltered();
  renderTable(list);
  renderPageInfo(list.length);
  renderDetailPanel();
}

/* ── Pagination (visual) ── */
function renderPagination(){
  const wrap = document.getElementById('pageBtns');
  const pages = [1,2];
  wrap.innerHTML = `<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>` +
    pages.map(p => `<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('') +
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
  document.getElementById('addBtn').addEventListener('click', () => toast('Opening new template form…'));
  document.getElementById('tableSearch').addEventListener('input', refresh);
  document.getElementById('statusFilter').addEventListener('change', refresh);
}

function attachShell(){
  DroboardShell.attach('#dashboardRoot', {
    activeFile: 'contract-templates.html',
    title: 'Contract Templates',
    subtitle: 'Create, manage and customize your contract templates',
    user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
    notifCount: 8,
    searchPlaceholder: 'Search templates...',
    mobileSearchTarget: '#tableSearch',
    onSearch: (value) => {
      document.getElementById('tableSearch').value = value;
      refresh();
    },
  });
}

function init(){
  attachShell();
  window.selectTemplate = selectTemplate;
  window.refresh = refresh;
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/contract-templates').then(function (data) { if (data) refresh(); });
  callBackend('/contract-templates');
  bindEvents();
  renderPagination();
  refresh();
}

window.ContractTemplatesService = { init: init };

})();
