/**
 * revenue-splits-service.js — Revenue Splits page logic (pure call-and-render).
 * revenue-splits.html only loads this + calls init(). No HTML change needed at go-live.
 *
 * Backend-ready: set USE_API=true and implement the endpoints below.
 *
 * BACKEND CONTRACT
 * ────────────────
 * Collections:
 *   revenue_configs  { _id, scope:'global'|'author', authorId?, google, marketing, editors,
 *                      writerShare, version, updatedBy, updatedAt, note }
 *     - exactly one scope:'global' doc is active (highest version); history = all versions desc.
 *     - per-author docs override global for that authorId only.
 *   revenue_ledger   { _id, saleId, authorId, gross, google, marketing, editors, writer,
 *                      configVersion, createdAt }   // configVersion stamps the version used
 *   pool_balances    { _id:'editors_pool'|'platform'|'marketing', balance, recomputedAt }
 *     - cached numbers, recomputed from revenue_ledger (never hand-edited).
 *     - writer wallets live on the user/author doc, summed as "writers payable".
 *
 * Endpoints (API_BASE = '/api/super-admin/revenue'):
 *   GET  /config/active              → current global row
 *   GET  /config/history             → version list desc
 *   POST /config                     { google, marketing, editors, writerShare, note }
 *                                    → creates next version (validates sum === 100,
 *                                      rejects google !== 30 — Google's cut is contractual)
 *   GET  /config/author              → override list (authorId, name, cuts, updatedBy/At)
 *   POST /config/author/:authorId    { google, marketing, editors, writerShare }
 *   DELETE /config/author/:authorId  → removes override (falls back to global)
 *   GET  /pools                      → editors_pool, platform, marketing + writersPayable
 *   GET  /authors?q=                  → author directory search for override picker
 */
(function () {
'use strict';
if (window.RevenueSplitsService && window.RevenueSplitsService.__ready) return;

var USE_API = false;
var API_BASE = '/api/super-admin/revenue';
var TIMEOUT_MS = 2500;

function timeoutFetch(url, opts) {
  var c = new AbortController();
  var t = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({ signal: c.signal }, opts || {}))
    .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(function (e) { clearTimeout(t); throw e; });
}
async function callBackend(path, options) {
  if (!USE_API) return null;
  return timeoutFetch(API_BASE + path, options);
}

/* ── Demo state (replaced by endpoints above at go-live) ── */
var GLOBAL = { version: 3, google: 30, marketing: 20, editors: 10, writerShare: 40, updatedBy: 'Tobi Adenuga', updatedAt: 'Sep 28, 2026', note: 'Launch values' };
var HISTORY = [
  { version: 3, google: 30, marketing: 20, editors: 10, writerShare: 40, updatedBy: 'Tobi Adenuga', updatedAt: 'Sep 28, 2026', note: 'Launch values' },
  { version: 2, google: 30, marketing: 25, editors: 10, writerShare: 35, updatedBy: 'Tobi Adenuga', updatedAt: 'Aug 02, 2026', note: 'Pre-launch test: marketing push' },
  { version: 1, google: 30, marketing: 20, editors: 10, writerShare: 40, updatedBy: 'System', updatedAt: 'Jun 01, 2026', note: 'Initial seed' }
];
var OVERRIDES = [
  { authorId: 'au_1024', name: 'Amara Okafor', handle: '@amara_writes', google: 30, marketing: 15, editors: 10, writerShare: 45, updatedBy: 'Tobi Adenuga', updatedAt: 'Sep 20, 2026' }
];
var POOLS = [
  { id: 'editors_pool', label: 'Editors Pool', balance: 1240500, recomputedAt: 'Today, 06:00' },
  { id: 'platform', label: 'Platform Reserve', balance: 8940200, recomputedAt: 'Today, 06:00' },
  { id: 'marketing', label: 'Marketing Pool', balance: 2310800, recomputedAt: 'Today, 06:00' },
  { id: 'writers', label: 'Writers Payable', balance: 5620400, recomputedAt: 'Today, 06:00' }
];
var AUTHORS = [
  { id: 'au_1024', name: 'Amara Okafor', handle: '@amara_writes', avatar: 'https://i.pravatar.cc/100?img=45' },
  { id: 'au_2041', name: 'Luna Skye', handle: '@luna_skye', avatar: 'https://i.pravatar.cc/100?img=32' },
  { id: 'au_3099', name: 'Tobi Adenuga', handle: '@tobi_adenuga', avatar: 'https://i.pravatar.cc/100?img=68' },
  { id: 'au_4177', name: 'Sofia Lindqvist', handle: '@sofia_l', avatar: 'https://i.pravatar.cc/100?img=47' },
  { id: 'au_5210', name: 'Marcus Chen', handle: '@marcus_chen', avatar: 'https://i.pravatar.cc/100?img=12' }
];
/* Google's 30% is contractual — never editable in UI (backend also rejects changes). */
var GOOGLE_FIXED = 30;
function authorProfile(a) {
  var h = ((a && a.handle) || '').replace(/^@/, '');
  return '../Pages/profile.html?u=' + encodeURIComponent(h);
}
var draft = { google: 30, marketing: 20, editors: 10, writerShare: 40 };
var pickedAuthor = null;

/* ── Helpers ── */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtN(n) { if(window.DroboardCurrency && DroboardCurrency.ngnToMoney) return DroboardCurrency.ngnToMoney(n); return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG'); }
function toast(m) { if (typeof window.toast === 'function') { try { window.toast(m); return; } catch (e) {} } }
function draftSum() { return (Number(draft.google) || 0) + (Number(draft.marketing) || 0) + (Number(draft.editors) || 0) + (Number(draft.writerShare) || 0); }

/* ── Data load (backend-first, demo fallback) ── */
async function loadAll() {
  try {
    var g = await callBackend('/config/active');
    if (g) { GLOBAL = g; draft = { google: g.google, marketing: g.marketing, editors: g.editors, writerShare: g.writerShare }; }
    var h = await callBackend('/config/history');
    if (h && Array.isArray(h.versions)) HISTORY = h.versions;
    var o = await callBackend('/config/author');
    if (o && Array.isArray(o.overrides)) OVERRIDES = o.overrides;
    var p = await callBackend('/pools');
    if (p && Array.isArray(p.pools)) POOLS = p.pools;
  } catch (e) { /* demo paths keep working */ }
}

/* ── Render: pool balances ── */
function renderPools() {
  var el = document.getElementById('poolRow');
  if (!el) return;
  var icons = { editors_pool: 'fa-user-pen', platform: 'fa-vault', marketing: 'fa-bullhorn', writers: 'fa-wallet' };
  el.innerHTML = POOLS.map(function (p) {
    return '<div class="rs-pool"><div class="rs-pool-top"><span class="rs-pool-ico"><i class="fas ' + (icons[p.id] || 'fa-coins') + '"></i></span>'
      + '<span class="rs-pool-lbl">' + esc(p.label) + '</span></div>'
      + '<div class="rs-pool-val">' + fmtN(p.balance) + '</div>'
      + '<div class="rs-pool-sub">Recomputed from ledger · ' + esc(p.recomputedAt) + '</div></div>';
  }).join('');
}

/* ── Render: global sliders ── */
var CUTS = [
  { key: 'google', label: 'Google', hint: 'Fixed by Google — always 30%', locked: true },
  { key: 'marketing', label: 'Marketing', hint: 'Growth pool' },
  { key: 'editors', label: 'Editors', hint: 'Editors pool' },
  { key: 'writerShare', label: 'Writer', hint: 'Writer net share' }
];
function renderSliders() {
  var el = document.getElementById('cutSliders');
  if (!el) return;
  draft.google = GOOGLE_FIXED;
  el.innerHTML = CUTS.map(function (c) {
    var dis = c.locked ? 'disabled' : '';
    var lock = c.locked ? ' <i class="fas fa-lock" title="Fixed"></i>' : '';
    return '<div class="rs-cut"><div class="rs-cut-head"><div><div class="rs-cut-lbl">' + c.label + lock + '</div>'
      + '<div class="rs-cut-hint">' + c.hint + '</div></div>'
      + '<div class="rs-cut-val"><input type="number" min="0" max="100" data-cut="' + c.key + '" value="' + Number(draft[c.key] || 0) + '" ' + dis + '/><span>%</span></div></div>'
      + '<input type="range" min="0" max="100" step="1" data-cut-range="' + c.key + '" value="' + Number(draft[c.key] || 0) + '" ' + dis + '/></div>';
  }).join('');
  el.querySelectorAll('[data-cut]').forEach(function (inp) {
    inp.addEventListener('input', function () { draft[inp.dataset.cut] = Math.max(0, Math.min(100, Number(inp.value) || 0)); syncCutUI(); });
  });
  el.querySelectorAll('[data-cut-range]').forEach(function (rg) {
    rg.addEventListener('input', function () { draft[rg.dataset.cutRange] = Number(rg.value) || 0; syncCutUI(); });
  });
  syncCutUI();
}
function syncCutUI() {
  document.querySelectorAll('#cutSliders [data-cut]').forEach(function (inp) { if (document.activeElement !== inp) inp.value = draft[inp.dataset.cut]; });
  document.querySelectorAll('#cutSliders [data-cut-range]').forEach(function (rg) { if (document.activeElement !== rg) rg.value = draft[rg.dataset.cutRange]; });
  var sum = draftSum();
  var sumEl = document.getElementById('cutSum');
  if (sumEl) {
    sumEl.textContent = sum + '%';
    sumEl.className = 'rs-sum ' + (sum === 100 ? 'ok' : 'bad');
  }
  var saveBtn = document.getElementById('saveConfigBtn');
  if (saveBtn) saveBtn.disabled = sum !== 100;
  renderPreview();
}

/* ── Preview calculator (uses DRAFT values so admin sees effect pre-save) ── */
function renderPreview() {
  var amtEl = document.getElementById('previewAmount');
  var outEl = document.getElementById('previewOut');
  if (!amtEl || !outEl) return;
  var amt = Math.max(0, Number(amtEl.value) || 0);
  function part(pct) { return amt * (Number(pct) || 0) / 100; }
  var rows = [
    ['Google', part(draft.google)],
    ['Marketing pool', part(draft.marketing)],
    ['Editors pool', part(draft.editors)],
    ['Writer', part(draft.writerShare)]
  ];
  outEl.innerHTML = rows.map(function (r) {
    return '<div class="rs-prev-row"><span>' + r[0] + '</span><b>' + fmtN(r[1]) + '</b></div>';
  }).join('');
}

/* ── Render: author overrides ── */
var overrideFilterQ = '';
var historyWho = '';
function renderOverrides() {
  var el = document.getElementById('overrideList');
  if (!el) return;
  var list = OVERRIDES.filter(function (o) {
    if (!overrideFilterQ) return true;
    var q = overrideFilterQ.toLowerCase();
    return o.name.toLowerCase().indexOf(q) !== -1 || (o.handle || '').toLowerCase().indexOf(q) !== -1;
  });
  if (!OVERRIDES.length) {
    el.innerHTML = '<div class="rs-empty">No author overrides — everyone uses the global cuts.</div>';
    return;
  }
  if (!list.length) {
    el.innerHTML = '<div class="rs-empty">No overrides match this filter.</div>';
    return;
  }
  el.innerHTML = list.map(function (o) {
    var a = AUTHORS.find(function (x) { return x.id === o.authorId; }) || {};
    var av = a.avatar ? '<img src="' + esc(a.avatar) + '" alt="" class="rs-av"/>' : '';
    return '<div class="rs-ov">' + av + '<div class="rs-ov-main"><div class="rs-ov-name"><a href="' + authorProfile(a.name ? a : o) + '">' + esc(o.name) + '</a> <span class="rs-ov-handle">' + esc(o.handle || '') + '</span></div>'
      + '<div class="rs-ov-cuts">G ' + o.google + '% · M ' + o.marketing + '% · E ' + o.editors + '% · W ' + o.writerShare + '%</div>'
      + '<div class="rs-ov-meta">by ' + esc(o.updatedBy || '') + ' · ' + esc(o.updatedAt || '') + '</div></div>'
      + '<button class="rs-mini danger" data-del-ov="' + esc(o.authorId) + '">Remove</button></div>';
  }).join('');
  el.querySelectorAll('[data-del-ov]').forEach(function (btn) {
    btn.addEventListener('click', function () { removeOverride(btn.dataset.delOv); });
  });
}
function renderAuthorHits(q) {
  var box = document.getElementById('authorHits');
  if (!box) return;
  q = (q || '').trim().toLowerCase();
  if (!q) { box.innerHTML = ''; box.classList.remove('show'); return; }
  var hits = AUTHORS.filter(function (a) {
    if (OVERRIDES.some(function (o) { return o.authorId === a.id; })) return false;
    return a.name.toLowerCase().indexOf(q) !== -1 || (a.handle || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 6);
  if (!hits.length) { box.innerHTML = '<div class="rs-hit-empty">No matching authors.</div>'; box.classList.add('show'); return; }
  box.innerHTML = hits.map(function (a) {
    var av = a.avatar ? '<img src="' + esc(a.avatar) + '" alt="" class="rs-av sm"/>' : '';
    return '<button class="rs-hit" data-pick="' + esc(a.id) + '">' + av + '<b>' + esc(a.name) + '</b><span>' + esc(a.handle || '') + '</span></button>';
  }).join('');
  box.classList.add('show');
  box.querySelectorAll('[data-pick]').forEach(function (b) {
    b.addEventListener('click', function () { pickAuthor(b.dataset.pick); });
  });
}
function pickAuthor(id) {
  pickedAuthor = AUTHORS.find(function (a) { return a.id === id; }) || null;
  var box = document.getElementById('authorHits');
  if (box) { box.innerHTML = ''; box.classList.remove('show'); }
  var q = document.getElementById('authorSearch');
  if (q) q.value = pickedAuthor ? pickedAuthor.name : '';
  var form = document.getElementById('overrideForm');
  if (form) form.style.display = pickedAuthor ? '' : 'none';
  if (pickedAuthor) {
    var cur = OVERRIDES.find(function (o) { return o.authorId === pickedAuthor.id; });
    var src = cur || GLOBAL;
    var gEl = document.getElementById('oGoogle');
    if (gEl) { gEl.value = GOOGLE_FIXED; gEl.disabled = true; }
    [['oMarketing', 'marketing'], ['oEditors', 'editors'], ['oWriter', 'writerShare']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.value = src[pair[1]];
    });
    var nameEl = document.getElementById('overrideName');
    if (nameEl) {
      var av = pickedAuthor.avatar ? '<img src="' + esc(pickedAuthor.avatar) + '" alt="" class="rs-av sm"/>' : '';
      nameEl.innerHTML = av + '<a href="' + authorProfile(pickedAuthor) + '">' + esc(pickedAuthor.name) + '</a> <span class="rs-ov-handle">' + esc(pickedAuthor.handle || '') + '</span>';
    }
  }
}

/* ── Render: version history ── */
function renderHistoryWho() {
  var sel = document.getElementById('historyWho');
  if (!sel) return;
  var whos = [];
  HISTORY.forEach(function (h) { if (h.updatedBy && whos.indexOf(h.updatedBy) === -1) whos.push(h.updatedBy); });
  sel.innerHTML = '<option value="">All editors</option>' + whos.map(function (w) {
    return '<option value="' + esc(w) + '"' + (historyWho === w ? ' selected' : '') + '>' + esc(w) + '</option>';
  }).join('');
}
function renderHistory() {
  renderHistoryWho();
  var el = document.getElementById('historyBody');
  if (!el) return;
  var list = HISTORY.filter(function (h) { return !historyWho || h.updatedBy === historyWho; });
  if (!HISTORY.length) { el.innerHTML = '<tr class="rs-empty-row"><td colspan="7">No versions yet.</td></tr>'; return; }
  if (!list.length) { el.innerHTML = '<tr class="rs-empty-row"><td colspan="7">No versions match this filter.</td></tr>'; return; }
  el.innerHTML = list.map(function (h, i) {
    return '<tr><td style="font-weight:800;">v' + h.version + (i === 0 ? ' <span class="rs-cur">current</span>' : '') + '</td>'
      + '<td>' + h.google + '%</td><td>' + h.marketing + '%</td><td>' + h.editors + '%</td><td>' + h.writerShare + '%</td>'
      + '<td>' + esc(h.updatedAt || '') + '<div class="rs-sub">by ' + esc(h.updatedBy || '') + '</div></td>'
      + '<td class="rs-note">' + esc(h.note || '') + '</td></tr>';
  }).join('');
  var vEl = document.getElementById('curVersion');
  if (vEl) vEl.textContent = 'v' + GLOBAL.version;
}

/* ── Actions ── */
async function saveConfig() {
  draft.google = GOOGLE_FIXED;
  if (draftSum() !== 100) { toast('Marketing + Editors + Writer must sum to 70% (Google is fixed at 30%).'); return; }
  var note = (document.getElementById('configNote').value || '').trim();
  var payload = { google: GOOGLE_FIXED, marketing: Number(draft.marketing), editors: Number(draft.editors), writerShare: Number(draft.writerShare), note: note };
  try {
    var saved = await callBackend('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (saved && (saved.version || saved.data)) {
      var row = saved.data || saved;
      GLOBAL = row; HISTORY.unshift(row);
    } else throw new Error('demo');
  } catch (e) {
    var next = (HISTORY.length ? HISTORY[0].version : 0) + 1;
    var row2 = Object.assign({ version: next, updatedBy: 'You', updatedAt: 'Just now' }, payload);
    GLOBAL = row2; HISTORY.unshift(row2);
    toast('Global cuts saved as v' + next + '. Takes effect immediately.');
  }
  var noteEl = document.getElementById('configNote');
  if (noteEl) noteEl.value = '';
  renderHistory();
  renderPreview();
}
async function resetDraft() {
  draft = { google: GLOBAL.google, marketing: GLOBAL.marketing, editors: GLOBAL.editors, writerShare: GLOBAL.writerShare };
  syncCutUI();
}
async function saveOverride() {
  if (!pickedAuthor) { toast('Pick an author first.'); return; }
  function num(id) { return Math.max(0, Math.min(100, Number(document.getElementById(id).value) || 0)); }
  var payload = { google: GOOGLE_FIXED, marketing: num('oMarketing'), editors: num('oEditors'), writerShare: num('oWriter') };
  if (payload.marketing + payload.editors + payload.writerShare !== 70) { toast('Marketing + Editors + Writer must sum to 70% (Google is fixed at 30%).'); return; }
  try {
    var saved = await callBackend('/config/author/' + encodeURIComponent(pickedAuthor.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!(saved && (saved.authorId || (saved.data && saved.data.authorId)))) throw new Error('demo');
  } catch (e) { /* demo path below */ }
  var row = Object.assign({ authorId: pickedAuthor.id, name: pickedAuthor.name, handle: pickedAuthor.handle, updatedBy: 'You', updatedAt: 'Just now' }, payload);
  var i = OVERRIDES.findIndex(function (o) { return o.authorId === pickedAuthor.id; });
  if (i > -1) OVERRIDES[i] = row; else OVERRIDES.push(row);
  toast('Override saved for ' + pickedAuthor.name + '.');
  pickedAuthor = null;
  var q = document.getElementById('authorSearch');
  if (q) q.value = '';
  var form = document.getElementById('overrideForm');
  if (form) form.style.display = 'none';
  renderOverrides();
}
async function removeOverride(authorId) {
  try { await callBackend('/config/author/' + encodeURIComponent(authorId), { method: 'DELETE' }); } catch (e) { /* demo path */ }
  var o = OVERRIDES.find(function (x) { return x.authorId === authorId; });
  OVERRIDES = OVERRIDES.filter(function (x) { return x.authorId !== authorId; });
  toast('Override removed' + (o ? ' for ' + o.name : '') + ' — back to global cuts.');
  renderOverrides();
}

/* ── Init ── */
var _initDone = false;
function init() {
  if (_initDone) return;
  _initDone = true;
  SuperAdminSidebar.attach('#dashboardRoot', {
    activeItem: 'revenue-splits', title: 'Revenue Splits', subtitle: 'Global cuts, author overrides & version history',
    user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
    notifCount: 9, hideSearch: true
  });
  if (typeof window.toast !== 'function') {
    window.toast = function (m) {
      var t = document.getElementById('rsToast');
      if (!t) { t = document.createElement('div'); t.id = 'rsToast'; document.body.appendChild(t); }
      t.textContent = m; t.className = 'rs-toast show';
      clearTimeout(t._t); t._t = setTimeout(function () { t.className = 'rs-toast'; }, 2600);
    };
  }
  loadAll().then(function () {
    renderPools();
    renderSliders();
    renderOverrides();
    renderHistory();
    renderPreview();
  });
  var amt = document.getElementById('previewAmount');
  if (amt) amt.addEventListener('input', renderPreview);
  var q = document.getElementById('authorSearch');
  if (q) q.addEventListener('input', function () { renderAuthorHits(q.value); });
  var oq = document.getElementById('overrideFilter');
  if (oq) oq.addEventListener('input', function () { overrideFilterQ = oq.value; renderOverrides(); });
  var hw = document.getElementById('historyWho');
  if (hw) hw.addEventListener('change', function () { historyWho = hw.value; renderHistory(); });
  var saveBtn = document.getElementById('saveConfigBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveConfig);
  var resetBtn = document.getElementById('resetConfigBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetDraft);
  var saveOv = document.getElementById('saveOverrideBtn');
  if (saveOv) saveOv.addEventListener('click', saveOverride);
  document.addEventListener('click', function (e) {
    var box = document.getElementById('authorHits');
    if (box && !e.target.closest('#authorSearch') && !e.target.closest('#authorHits')) { box.innerHTML = ''; box.classList.remove('show'); }
  });
}

window.RevenueSplitsService = { init: init, __ready: true };
})();
