/**
 * services/contracts-page-service.js — Contracts page logic (contracts + templates + signed tabs).
 * Pure call-and-render: contracts.html only loads this + init().
 * Data layer: window.ContractsService (services/contracts-service.js, backend-first).
 * Backend-ready: set USE_API=true and implement endpoints below.
 */
(function () {
'use strict';
if (window.ContractsPageService) return;

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[ContractsPageService] backend unavailable, using demo data', e);
    return null;
  }
}

var ICO = { red: 'var(--red)', amber: 'var(--amber)', blue: 'var(--blue)', purple: 'var(--purple)', green: 'var(--green)', accent: 'var(--accent)' };
var BG = { red: 'var(--red-bg)', amber: 'var(--amber-bg)', blue: 'var(--blue-bg)', purple: 'var(--purple-bg)', green: 'var(--green-bg)', accent: 'rgba(255,0,80,.1)' };

var allContracts = [], allTemplates = [], allSigned = [];
var activeTab = 'contracts', contractPage = 1, tplSelectedId = null, signedSelectedId = null;
var PER_PAGE = 8;

function statusPill(s) {
  var m = { awaiting: 'awaiting', signed: 'signed', active: 'active', rejected: 'rejected', expired: 'expired' };
  var l = { awaiting: 'Awaiting Signature', signed: 'Signed', active: 'Active', rejected: 'Rejected', expired: 'Expired' };
  return '<span class="status-pill ' + (m[s] || '') + '"><span class="dot"></span>' + (l[s] || s) + '</span>';
}

function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }

async function init() {
  SeniorEditorSidebar.attach('#pageRoot', {
    activeItem: 'contracts', title: 'Contracts', subtitle: 'Manage contracts, templates & signed agreements',
    user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' }, notifCount: 8,
    searchPlaceholder: 'Search contracts…', mobileSearchTarget: '#searchInput',
    onSearch: function (v) { document.getElementById('searchInput').value = v; contractPage = 1; renderContracts(); }
  });
  var backend = await callBackend('/contracts/overview');
  if (backend) {
    allContracts = backend.contracts || [];
    allTemplates = backend.templates || [];
    allSigned = backend.signed || [];
  } else {
    allContracts = await ContractsService.getContracts();
    allTemplates = await ContractsService.getTemplates();
    allSigned = await ContractsService.getSignedContracts();
  }
  tplSelectedId = allTemplates[0] ? allTemplates[0].id : null;
  signedSelectedId = allSigned[0] ? allSigned[0].id : null;
  renderStats(); renderTabs(); renderContracts(); renderTemplateSelect();
  bindEvents();
  window.toast = toast;
}

/* ── Stats ── */
function renderStats() {
  var awaiting = allContracts.filter(function (c) { return c.status === 'awaiting'; }).length;
  var signedActive = allContracts.filter(function (c) { return c.status === 'signed' || c.status === 'active'; }).length;
  var rejected = allContracts.filter(function (c) { return c.status === 'rejected'; }).length;
  var total = allContracts.length;
  document.getElementById('statsGrid').innerHTML =
    '<div class="stat-card"><div class="stat-ico" style="background:var(--amber-bg);color:var(--amber)"><i class="fas fa-clock"></i></div><div><div class="stat-num">' + awaiting + '</div><div class="stat-lbl">Awaiting Signature</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico" style="background:var(--green-bg);color:var(--green)"><i class="fas fa-shield-halved"></i></div><div><div class="stat-num">' + signedActive + '</div><div class="stat-lbl">Active / Signed</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico" style="background:var(--red-bg);color:var(--red)"><i class="fas fa-xmark-circle"></i></div><div><div class="stat-num">' + rejected + '</div><div class="stat-lbl">Rejected</div></div></div>' +
    '<div class="stat-card"><div class="stat-ico" style="background:var(--blue-bg);color:var(--blue)"><i class="fas fa-file-contract"></i></div><div><div class="stat-num">' + total + '</div><div class="stat-lbl">Total Contracts</div></div></div>';
}

/* ── Tabs ── */
function renderTabs() {
  document.getElementById('cntContracts').textContent = allContracts.length;
  document.getElementById('cntTemplates').textContent = allTemplates.length;
  document.getElementById('cntSigned').textContent = allSigned.length;
}

/* ═══════════════════════════════════════════════════════════
   CONTRACTS TAB
   ═══════════════════════════════════════════════════════════ */
function getFilteredContracts() {
  var q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  var status = document.getElementById('statusFilter').value;
  var type = document.getElementById('typeFilter').value;
  var list = allContracts.slice();
  if (status) list = list.filter(function (c) { return c.status === status; });
  if (type) list = list.filter(function (c) { return c.type === type; });
  if (q) list = list.filter(function (c) { return c.id.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || c.book.toLowerCase().includes(q); });
  return list;
}

function renderContracts() {
  var list = getFilteredContracts();
  var tp = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (contractPage > tp) contractPage = tp;
  var start = (contractPage - 1) * PER_PAGE;
  var page = list.slice(start, start + PER_PAGE);
  var body = document.getElementById('contractBody');
  if (!page.length) { body.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-file-contract"></i><p>No contracts match this filter.</p></td></tr>'; document.getElementById('pageInfo').innerHTML = ''; document.getElementById('pageBtns').innerHTML = ''; return; }
  body.innerHTML = page.map(function (c) {
    var idx = allContracts.indexOf(c);
    var ibg = c.status === 'awaiting' ? 'var(--amber-bg)' : c.status === 'signed' || c.status === 'active' ? 'var(--green-bg)' : c.status === 'rejected' ? 'var(--red-bg)' : 'var(--table-head)';
    var ic = c.status === 'awaiting' ? 'var(--amber)' : c.status === 'signed' || c.status === 'active' ? 'var(--green)' : c.status === 'rejected' ? 'var(--red)' : 'var(--text-faint)';
    var acts = '';
    if (c.status === 'awaiting') {
      acts = '<button class="act-btn approve" title="Approve" data-action="approve" data-idx="' + idx + '"><i class="fas fa-check"></i></button>' +
             '<button class="act-btn reject" title="Reject" data-action="reject" data-idx="' + idx + '"><i class="fas fa-xmark"></i></button>';
    }
    acts += '<button class="act-btn" title="View" data-action="view" data-idx="' + idx + '"><i class="fas fa-eye"></i></button>';
    return '<tr data-idx="' + idx + '">' +
      '<td><div class="contract-cell"><div class="contract-icon" style="background:' + ibg + ';color:' + ic + '"><i class="fas fa-file-contract"></i></div><div><div class="contract-id">' + c.id + '</div><div class="contract-type">' + c.type + '</div></div></div></td>' +
      '<td><div class="author-cell"><img src="' + c.authorAv + '" alt=""/><span class="author-name">' + c.author + '</span></div></td>' +
      '<td><div class="book-title">' + c.book + '</div></td>' +
      '<td>' + statusPill(c.status) + '</td>' +
      '<td class="date-cell">' + c.dateSent + '</td>' +
      '<td class="date-cell">' + c.signedDate + '</td>' +
      '<td><div class="actions-cell">' + acts + '</div></td>' +
    '</tr>';
  }).join('');
  document.getElementById('pageInfo').innerHTML = 'Showing <b>' + (start + 1) + '</b> to <b>' + Math.min(start + PER_PAGE, list.length) + '</b> of <b>' + list.length + '</b>';
  renderPageBtns(tp);
}

function renderPageBtns(tp) {
  var w = document.getElementById('pageBtns');
  if (tp <= 1) { w.innerHTML = ''; return; }
  var h = '<button class="pg-btn"' + (contractPage <= 1 ? ' disabled' : '') + ' data-p="' + (contractPage - 1) + '"><i class="fas fa-chevron-left"></i></button>';
  for (var i = 1; i <= tp; i++) h += '<button class="pg-btn' + (i === contractPage ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
  h += '<button class="pg-btn"' + (contractPage >= tp ? ' disabled' : '') + ' data-p="' + (contractPage + 1) + '"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML = h;
  w.querySelectorAll('.pg-btn').forEach(function (b) { b.addEventListener('click', function () { contractPage = parseInt(b.dataset.p, 10); renderContracts(); }); });
}

function doApproveContract(idx) {
  var c = allContracts[idx]; c.status = 'signed'; c.signedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  toast('Contract approved — author notified'); renderStats(); renderContracts();
}
function doRejectContract(idx) {
  var note = prompt('Reason for rejection (shown to author):', '');
  if (note === null) return;
  allContracts[idx].status = 'rejected'; allContracts[idx].notes = note || allContracts[idx].notes;
  toast('Contract rejected'); renderStats(); renderContracts();
}

/* ── View Modal ── */
function chatTime(iso) {
  if (!iso) return '';
  if (iso.includes('T')) { var d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  return iso;
}
function renderChatMsgs(c) {
  var replies = c.replies || [];
  if (!replies.length) return '<div class="chat-empty"><i class="fas fa-comments"></i>No messages yet. Start the conversation below.</div>';
  return replies.map(function (r) {
    var isEditor = r.from === 'Reina Morgan';
    return '<div class="chat-msg ' + (isEditor ? 'sent' : 'received') + '">' +
      '<img class="chat-av" src="' + (isEditor ? 'https://i.pravatar.cc/100?img=47' : c.authorAv) + '" alt=""/>' +
      '<div class="chat-bubble"><div class="chat-name">' + r.from + '</div><div class="chat-msg-text">' + r.message + '</div><div class="chat-time">' + chatTime(r.time) + '</div></div>' +
    '</div>';
  }).join('');
}
function openViewModal(c) {
  var replies = c.replies || [];
  var isSettled = !!c.settled;
  var hasSentReply = replies.some(function (r) { return r.from === 'Reina Morgan'; });
  var chatSection =
    '<div class="chat-section">' +
      '<div class="chat-section-title"><i class="fas fa-comments"></i> Conversation with ' + c.author + (isSettled ? '<span class="settled-badge"><i class="fas fa-check-circle"></i> Settled</span>' : '') + '</div>' +
      '<div class="chat-area" id="chatArea">' + renderChatMsgs(c) + '</div>' +
      (isSettled ?
        '<div class="chat-input-row"><div class="chat-input-wrap"><textarea id="chatInput" placeholder="Author can no longer reply. You can still send a message…" disabled></textarea></div>' +
        '<button class="chat-send-btn settle" id="chatSendBtn" disabled title="Settled"><i class="fas fa-check-circle"></i></button></div>' :
        '<div class="chat-input-row"><div class="chat-input-wrap"><textarea id="chatInput" placeholder="Type a message to ' + c.author + '…" rows="1"></textarea></div>' +
        '<button class="chat-send-btn send" id="chatSendBtn" title="' + (hasSentReply ? 'Settle this conversation' : 'Send message') + '"><i class="fas ' + (hasSentReply ? 'fa-check-circle' : 'fa-paper-plane') + '"></i></button></div>'
      ) +
    '</div>';
  document.getElementById('viewModalBody').innerHTML =
    '<div class="view-detail"><div><div class="view-label">Contract ID</div><div class="view-value">' + c.id + '</div></div><div><div class="view-label">Status</div>' + statusPill(c.status) + '</div></div>' +
    '<div class="view-detail"><div><div class="view-label">Author</div><div class="view-value">' + c.author + '</div></div><div><div class="view-label">Book</div><div class="view-value">' + c.book + '</div></div></div>' +
    '<div class="view-detail"><div><div class="view-label">Type</div><div class="view-value">' + c.type + '</div></div><div><div class="view-label">Duration</div><div class="view-value">' + c.duration + '</div></div></div>' +
    '<div class="view-detail"><div><div class="view-label">Revenue Split</div><div class="view-value">' + c.revenue + '%</div></div><div><div class="view-label">Advance</div><div class="view-value">' + money(c.advance) + '</div></div></div>' +
    '<div class="view-detail"><div><div class="view-label">Date Sent</div><div class="view-value">' + c.dateSent + '</div></div><div><div class="view-label">Signed Date</div><div class="view-value">' + c.signedDate + '</div></div></div>' +
    (c.notes ? '<div class="view-detail"><div><div class="view-label">Notes</div><div class="view-value">' + c.notes + '</div></div></div>' : '') +
    chatSection;
  var acts = '';
  if (c.status === 'awaiting') {
    acts = '<button class="btn-cancel" id="viewClose">Close</button>' +
         '<button class="btn-send" style="background:var(--red)" id="viewReject"><i class="fas fa-xmark"></i> Reject</button>' +
         '<button class="btn-send" id="viewApprove"><i class="fas fa-check"></i> Approve</button>';
  } else {
    acts = '<button class="btn-cancel" id="viewClose">Close</button>';
  }
  document.getElementById('viewModalActions').innerHTML = acts;
  document.getElementById('viewModal').classList.add('open');
  var chatArea = document.getElementById('chatArea');
  if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
  var chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('input', function () {
      this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('chatSendBtn').click(); }
    });
  }
  document.getElementById('viewClose').addEventListener('click', function () { document.getElementById('viewModal').classList.remove('open'); });
  var apprBtn = document.getElementById('viewApprove');
  if (apprBtn) apprBtn.addEventListener('click', function () { doApproveContract(allContracts.indexOf(c)); document.getElementById('viewModal').classList.remove('open'); });
  var rejBtn = document.getElementById('viewReject');
  if (rejBtn) rejBtn.addEventListener('click', function () { doRejectContract(allContracts.indexOf(c)); document.getElementById('viewModal').classList.remove('open'); });
  var sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn && !isSettled) {
    sendBtn.addEventListener('click', function () {
      var hasSent = replies.some(function (r) { return r.from === 'Reina Morgan'; });
      if (hasSent && !c.settled) {
        c.settled = true;
        if (!c.replies) c.replies = [];
        c.replies.push({ from: 'System', message: 'This conversation has been settled by Reina Morgan.', time: new Date().toISOString() });
        toast('Conversation settled — ' + c.author + ' can no longer reply');
        openViewModal(c);
        return;
      }
      var inp = document.getElementById('chatInput');
      var msg = inp.value.trim();
      if (!msg) { toast('Please type a message.'); return; }
      if (!c.replies) c.replies = [];
      c.replies.push({ from: 'Reina Morgan', message: msg, time: new Date().toISOString() });
      inp.value = ''; inp.style.height = 'auto';
      document.getElementById('chatArea').innerHTML = renderChatMsgs(c);
      document.getElementById('chatArea').scrollTop = document.getElementById('chatArea').scrollHeight;
      var nowHasSent = c.replies.some(function (r) { return r.from === 'Reina Morgan'; });
      if (nowHasSent) {
        sendBtn.className = 'chat-send-btn settle';
        sendBtn.innerHTML = '<i class="fas fa-check-circle"></i>';
        sendBtn.title = 'Settle this conversation';
      }
      toast('Message sent to ' + c.author);
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATES TAB
   ═══════════════════════════════════════════════════════════ */
function renderTemplates() {
  var body = document.getElementById('templateBody');
  body.innerHTML = allTemplates.map(function (t) {
    var sel = t.id === tplSelectedId ? 'selected' : '';
    var sp = t.status === 'active' ? '<span class="status-pill"><span class="dot"></span>Active</span>' : t.status === 'draft' ? '<span class="status-pill awaiting"><span class="dot"></span>Draft</span>' : '<span class="status-pill expired"><span class="dot"></span>Archived</span>';
    return '<tr class="' + sel + '" data-tid="' + t.id + '">' +
      '<td><div class="contract-cell"><div class="contract-icon" style="background:' + t.bg + ';color:' + t.color + '"><i class="fas ' + t.icon + '"></i></div><div><div class="contract-id">' + t.name + '</div><div class="contract-type">' + t.desc + '</div></div></div></td>' +
      '<td class="date-cell">' + t.type + '</td>' +
      '<td>' + sp + '</td>' +
      '<td class="date-cell">' + t.updated + '</td>' +
      '<td><div class="actions-cell"><button class="act-btn" title="Preview"><i class="fas fa-eye"></i></button><button class="act-btn" title="Edit"><i class="fas fa-pen"></i></button></div></td>' +
    '</tr>';
  }).join('');
  body.querySelectorAll('tr[data-tid]').forEach(function (row) {
    row.addEventListener('click', function () { tplSelectedId = parseInt(row.dataset.tid, 10); renderTemplates(); renderTplDetail(); });
  });
  renderTplDetail();
}

var tplDetailTab = 'preview';
function renderTplDetail() {
  var t = allTemplates.find(function (x) { return x.id === tplSelectedId; }) || allTemplates[0];
  if (!t) { document.getElementById('tplDetail').innerHTML = '<div class="empty-state"><p>No templates found.</p></div>'; return; }
  var content = '';
  if (tplDetailTab === 'preview') {
    content = '<h3>' + t.preview.title.toUpperCase() + '</h3><p>' + t.preview.body + '</p>';
  } else if (tplDetailTab === 'details') {
    content = '<div class="tpl-dp-detail-row"><span>Template ID</span><b>TPL-' + String(t.id).padStart(4, '0') + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Type</span><b>' + t.type + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Status</span><b>' + t.status.charAt(0).toUpperCase() + t.status.slice(1) + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Clauses</span><b>' + t.clauses + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Updated</span><b>' + t.updated + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>By</span><b>' + t.by + '</b></div>';
  } else if (tplDetailTab === 'clauses') {
    var labels = ['Grant of Rights', 'Author Representations', 'Royalties & Payment', 'Term & Termination', 'Confidentiality', 'Indemnification', 'Governing Law', 'Assignment', 'Force Majeure', 'Notices', 'Entire Agreement', 'Amendments', 'Severability', 'Dispute Resolution'];
    content = '<div>' + Array.from({ length: t.clauses }).map(function (_, i) { return '<div class="tpl-dp-clause"><i class="fas fa-check"></i>' + (i + 1) + '. ' + labels[i] + '</div>'; }).join('') + '</div>';
  } else {
    content = '<div class="tpl-dp-detail-row"><span>Created</span><b>Jan 18, 2026</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Last Edited</span><b>' + t.updated + '</b></div>' +
      '<div class="tpl-dp-detail-row"><span>Used in Contracts</span><b>' + Math.floor(Math.random() * 30 + 5) + '</b></div>';
  }
  document.getElementById('tplDetail').innerHTML =
    '<div class="tpl-dp-head"><div class="tpl-dp-icn" style="background:' + t.bg + ';color:' + t.color + '"><i class="fas ' + t.icon + '"></i></div><div><div class="tpl-dp-title">' + t.name + '</div><div class="tpl-dp-meta">' + t.type + ' · ' + t.clauses + ' clauses</div></div></div>' +
    '<div class="tpl-dp-tabs"><div class="tpl-dp-tab' + (tplDetailTab === 'preview' ? ' active' : '') + '" data-t="preview">Preview</div><div class="tpl-dp-tab' + (tplDetailTab === 'details' ? ' active' : '') + '" data-t="details">Details</div><div class="tpl-dp-tab' + (tplDetailTab === 'clauses' ? ' active' : '') + '" data-t="clauses">Clauses</div><div class="tpl-dp-tab' + (tplDetailTab === 'history' ? ' active' : '') + '" data-t="history">History</div></div>' +
    '<div class="tpl-dp-preview">' + content + '</div>' +
    '<div class="tpl-dp-actions"><button class="tpl-dp-btn" onclick="toast(\'Editing template…\')"><i class="fas fa-pen"></i> Edit</button><button class="tpl-dp-btn" onclick="toast(\'Duplicating template…\')"><i class="fas fa-copy"></i> Duplicate</button></div>';
  document.querySelectorAll('.tpl-dp-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { tplDetailTab = tab.dataset.t; renderTplDetail(); });
  });
}

/* ═══════════════════════════════════════════════════════════
   SIGNED TAB
   ═══════════════════════════════════════════════════════════ */
function renderSignedList() {
  var body = document.getElementById('signedBody');
  body.innerHTML = allSigned.map(function (c) {
    var sel = c.id === signedSelectedId ? 'selected' : '';
    return '<tr class="' + sel + '" data-sid="' + c.id + '">' +
      '<td><div class="contract-cell"><div class="contract-icon" style="background:var(--green-bg);color:var(--green)"><i class="fas fa-file-signature"></i></div><div><div class="contract-id">' + c.id + '</div><div class="contract-type">' + c.type + '</div></div></div></td>' +
      '<td><div class="author-cell"><img src="' + c.authorAv + '" alt=""/><span class="author-name">' + c.author + '</span></div></td>' +
      '<td><div class="book-title">' + c.title + '</div></td>' +
      '<td class="date-cell">' + c.duration + '</td>' +
      '<td class="date-cell">' + c.signedAt + '</td>' +
      '<td><div class="actions-cell"><button class="act-btn" title="View"><i class="fas fa-eye"></i></button><button class="act-btn" title="Download"><i class="fas fa-download"></i></button></div></td>' +
    '</tr>';
  }).join('');
  body.querySelectorAll('tr[data-sid]').forEach(function (row) {
    row.addEventListener('click', function () { signedSelectedId = row.dataset.sid; renderSignedList(); renderSignedDetail(); });
  });
  renderSignedDetail();
}

function renderSignedDetail() {
  var c = allSigned.find(function (x) { return x.id === signedSelectedId; }) || allSigned[0];
  if (!c) { document.getElementById('signedDetail').innerHTML = '<div class="empty-state"><p>No signed contracts.</p></div>'; return; }
  document.getElementById('signedDetail').innerHTML =
    '<div class="signed-hero"><img class="signed-cover" src="' + c.cover + '" alt=""/><div><h2 style="font-size:16px;font-weight:800">' + c.title + '</h2><div style="margin-top:4px">' + statusPill('active') + '</div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">' + c.author + ' · ' + c.type + '</div></div></div>' +
    '<div class="signed-detail-grid">' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Contract ID</div><div class="signed-meta-val">' + c.id + '</div></div>' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Status</div><div class="signed-meta-val">Active</div></div>' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Effective Date</div><div class="signed-meta-val">' + c.effective + '</div></div>' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Expiry Date</div><div class="signed-meta-val">' + c.expiry + '</div></div>' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Revenue Split</div><div class="signed-meta-val">' + c.revenue + '%</div></div>' +
      '<div class="signed-meta"><div class="signed-meta-lbl">Advance</div><div class="signed-meta-val">' + money(c.advance) + '</div></div>' +
    '</div>' +
    '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Contract Clauses</div>' +
    c.clauses.map(function (cl, i) { return '<div class="signed-clause"><i class="fas fa-check-circle"></i>' + (i + 1) + '. ' + cl + '</div>'; }).join('') +
    '<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Signed By</div>' +
    '<div style="display:flex;align-items:center;gap:10px"><img src="' + c.editorAvatar + '" style="width:28px;height:28px;border-radius:50%"/><div><div style="font-size:12.5px;font-weight:700">' + c.editor + '</div><div style="font-size:11px;color:var(--text-muted)">' + c.signedAt + '</div></div></div></div>';
}

/* ═══════════════════════════════════════════════════════════
   SEND CONTRACT MODAL
   ═══════════════════════════════════════════════════════════ */
function renderTemplateSelect() {
  var sel = document.getElementById('sendTemplate');
  sel.innerHTML = '<option value="">Select template…</option>' + allTemplates.filter(function (t) { return t.status === 'active'; }).map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('');
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      activeTab = t.dataset.tab;
      document.getElementById('tabContracts').style.display = activeTab === 'contracts' ? '' : 'none';
      document.getElementById('tabTemplates').style.display = activeTab === 'templates' ? '' : 'none';
      document.getElementById('tabSigned').style.display = activeTab === 'signed' ? '' : 'none';
      if (activeTab === 'contracts') renderContracts();
      else if (activeTab === 'templates') renderTemplates();
      else renderSignedList();
    });
  });

  document.getElementById('searchInput').addEventListener('input', function () { contractPage = 1; renderContracts(); });
  document.getElementById('statusFilter').addEventListener('change', function () { contractPage = 1; renderContracts(); });
  document.getElementById('typeFilter').addEventListener('change', function () { contractPage = 1; renderContracts(); });

  document.getElementById('contractBody').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (btn) {
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.idx, 10);
      if (action === 'view') openViewModal(allContracts[idx]);
      else if (action === 'approve') doApproveContract(idx);
      else if (action === 'reject') doRejectContract(idx);
      return;
    }
    var row = e.target.closest('tr[data-idx]');
    if (row) {
      var idx = parseInt(row.dataset.idx, 10);
      openViewModal(allContracts[idx]);
    }
  });

  document.getElementById('btnSend').addEventListener('click', function () { document.getElementById('sendModal').classList.add('open'); });
  document.getElementById('closeSendModal').addEventListener('click', function () { document.getElementById('sendModal').classList.remove('open'); });
  document.getElementById('cancelSend').addEventListener('click', function () { document.getElementById('sendModal').classList.remove('open'); });
  document.getElementById('sendModal').addEventListener('click', function (e) { if (e.target.id === 'sendModal') document.getElementById('sendModal').classList.remove('open'); });

  document.getElementById('confirmSend').addEventListener('click', function () {
    var author = document.getElementById('sendAuthor').value;
    var book = document.getElementById('sendBook').value;
    if (!author || !book) { toast('Please fill in author and book title'); return; }
    allContracts.unshift({
      id: 'CNTR-2026-' + String(allContracts.length + 1).padStart(3, '0'),
      author: author,
      authorAv: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 50 + 1),
      book: book,
      type: document.getElementById('sendType').value,
      status: 'awaiting',
      dateSent: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      signedDate: '—',
      duration: document.getElementById('sendDuration').value,
      revenue: +document.getElementById('sendRevenue').value || 70,
      advance: +document.getElementById('sendAdvance').value || 0,
      notes: document.getElementById('sendNotes').value,
      replies: []
    });
    document.getElementById('sendModal').classList.remove('open');
    document.getElementById('sendAuthor').value = ''; document.getElementById('sendBook').value = '';
    document.getElementById('sendNotes').value = ''; document.getElementById('sendRevenue').value = ''; document.getElementById('sendAdvance').value = '';
    toast('Contract sent to ' + author);
    renderStats(); renderTabs(); renderContracts();
  });

  document.getElementById('viewModal').addEventListener('click', function (e) { if (e.target.id === 'viewModal') document.getElementById('viewModal').classList.remove('open'); });
}

/* ── Toast ── */
function toast(m) {
  var t = document.getElementById('toastEl');
  if (!t) {
    t = document.createElement('div'); t.id = 'toastEl';
    t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:9000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)';
    document.body.appendChild(t);
  }
  t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  window.toast = toast;
}

window.ContractsPageService = { init: init };
})();
