/**
 * editorial-team-service.js — Editorial Team page controller (call-and-render).
 *
 * Rebuilt to mirror the four real staff modules instead of a generated roster:
 *   Senior Editor → public/senior-editor/*   (route guard: senior_editor|chief_editor|admin)
 *   Chief Editor  → public/chief-editor/*    (route guard: chief_editor|admin)
 *   Marketing     → public/marketing/*       (route guard: marketing|admin)
 *   Finance       → public/finance/*         (route guard: finance|admin)
 *
 * Demo data only. The roster is copied from the module demos, so the per-person
 * figures add up to the module dashboards: 14 senior editors, 4 contracts
 * awaiting countersignature, 10 campaigns (6 live), 9 queued withdrawals,
 * $182,400 monthly volume, 4 open disputes.
 *
 * Backend contract when USE_API flips (pattern only, no wiring yet):
 *   GET /api/super-admin/editorial-team?page=&limit=&q=&role=&status=
 *   → { items:[{ id,name,email,avatar,roles[],status,joinedAt, metrics:{...} }], total, page, limit }
 */
(function(){
const USE_API = true, API_BASE = '/api/super-admin';
'use strict';
const shell = SuperAdminSidebar.attach('#editorialRoot', {
  activeItem: 'editorial-team',
  title: 'Editorial Team',
  subtitle: 'Every staff member and what their module lets them do',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

/* Authority + module map mirrors the sidebar nav and the route guards, not a
   wish list. `modules` are the pages that role actually owns. */
const ROLE_META = {
  senior_editor: {
    label:'Senior Editor', short:'SE', icon:'fa-user-tie', cls:'blue',
    scope:'Authors, contracts & reviews',
    page:'../senior-editor/dashboard.html',
    can:[
      'Reviews submissions, chapter edits, completions and book stories',
      'Manages assigned authors, invites, verification and messages',
      'Reviews contracts and countersigns with the chief editor',
      'Flags books and resolves reader and author reports',
      'Reads own earnings and requests a withdrawal',
    ],
    modules:[
      { label:'Review Queue', href:'../senior-editor/review-queue.html', icon:'fa-inbox' },
      { label:'Book Management', href:'../senior-editor/book-management.html', icon:'fa-book' },
      { label:'Contract Review', href:'../senior-editor/contract-review.html', icon:'fa-file-signature' },
      { label:'Authors', href:'../senior-editor/authors.html', icon:'fa-users' },
      { label:'Reports & Flags', href:'../senior-editor/reports-flags.html', icon:'fa-flag' },
      { label:'My Earnings', href:'../senior-editor/editor-bill-review.html', icon:'fa-sack-dollar' },
    ],
  },
  chief_editor: {
    label:'Chief Editor', short:'CE', icon:'fa-crown', cls:'red',
    scope:'Editor pod & policy',
    page:'../chief-editor/dashboard.html',
    can:[
      'Owns the senior-editor roster, quotas and author assignments',
      'Countersigns contracts and oversees contract payments',
      'Reads every flagged book; the final moderation call is theirs',
      'Owns policies, appeals, plagiarism and genre taxonomy',
      'Sets editorial strategy, featured stories and partnerships',
      'Publishes platform-wide announcements',
    ],
    modules:[
      { label:'Senior Editors', href:'../chief-editor/senior-editors.html', icon:'fa-user-tie' },
      { label:'Contracts & Payments', href:'../chief-editor/contracts-payments.html', icon:'fa-file-signature' },
      { label:'Story Reports', href:'../chief-editor/reports-flags.html', icon:'fa-flag' },
      { label:'All Books', href:'../chief-editor/all-books.html', icon:'fa-book' },
      { label:'Editorial Strategy', href:'../chief-editor/editorial-strategy.html', icon:'fa-compass' },
      { label:'Featured Stories', href:'../chief-editor/featured-stories.html', icon:'fa-star' },
      { label:'Categories & Genres', href:'../chief-editor/categories-genres.html', icon:'fa-layer-group' },
    ],
  },
  marketing: {
    label:'Marketing', short:'MK', icon:'fa-bullhorn', cls:'amber',
    scope:'Campaigns & growth',
    page:'../marketing/dashboard.html',
    can:[
      'Creates and runs ad campaigns, creatives and placements',
      'Manages ad inventory, the rate card and audience segments',
      'Configures league boards and acquisition spend',
      'Reads marketing analytics and traffic activity',
    ],
    modules:[
      { label:'Campaigns', href:'../marketing/campaigns.html', icon:'fa-bullhorn' },
      { label:'Ad Manager', href:'../marketing/ad-manager.html', icon:'fa-rectangle-ad' },
      { label:'Flyer Templates', href:'../marketing/templates.html', icon:'fa-palette' },
      { label:'Traffic & Activity', href:'../marketing/traffic.html', icon:'fa-chart-line' },
      { label:'Acquisition', href:'../marketing/acquisition.html', icon:'fa-filter-circle-dollar' },
      { label:'Marketing Analytics', href:'../marketing/marketing-analytics.html', icon:'fa-chart-pie' },
    ],
  },
  finance: {
    label:'Finance', short:'FN', icon:'fa-sack-dollar', cls:'purple',
    scope:'Payouts & disputes',
    page:'../finance/dashboard.html',
    can:[
      'Processes withdrawals and author/editor payouts',
      'Manages payment methods and resolves payment disputes',
      'Configures the coin store and reviews coin transactions',
      'Generates financial reports',
    ],
    modules:[
      { label:'Withdrawals', href:'../finance/withdrawals.html', icon:'fa-building-columns' },
      { label:'Coin Transactions', href:'../finance/coin-transactions.html', icon:'fa-coins' },
      { label:'Payment Disputes', href:'../finance/payment-disputes.html', icon:'fa-scale-balanced' },
      { label:'Financial Reports', href:'../finance/financial-reports.html', icon:'fa-chart-pie' },
    ],
  },
};

/* ── Roster — loaded live from API ── */
const API_BASE_TEAM = '/api/super-admin/editorial-team';

async function callTeamApi(path, opts){
  opts = opts || {};
  var res = await fetch(API_BASE_TEAM + (path||''), Object.assign({ credentials:'include' }, opts));
  if(!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

let TEAM = [];

async function loadTeam(){
  try {
    const data = await callTeamApi('');
    TEAM = Array.isArray(data) ? data : (data.items || []);
    renderStatCards();
    applyFilters();
  } catch(e){
    document.getElementById('teamTable').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> Failed to load editorial team: ${e.message}</td></tr>`;
  }
}

const TABS = [
  { key:'all',          label:'All staff',    icon:'fa-users' },
  { key:'senior_editor',label:'Senior Editor',icon:'fa-user-tie' },
  { key:'chief_editor', label:'Chief Editor', icon:'fa-crown' },
  { key:'marketing',    label:'Marketing',    icon:'fa-bullhorn' },
  { key:'finance',      label:'Finance',      icon:'fa-sack-dollar' },
];

const COLUMNS = {
  all: [
    { k:'staff',  l:'Staff',     g:'minmax(0,2.2fr)' },
    { k:'role',   l:'Role',      g:'150px' },
    { k:'scope',  l:'Module scope', g:'170px', hide:true },
    { k:'metric', l:'Workload',  g:'130px', num:true },
    { k:'status', l:'Status',    g:'110px' },
    { k:'joined', l:'Joined',    g:'100px', hide:true },
  ],
  senior_editor: [
    { k:'staff',   l:'Senior Editor',   g:'minmax(0,2fr)' },
    { k:'seAuthors', l:'Assigned authors', g:'160px', num:true },
    { k:'seInvited', l:'Invited',       g:'90px', num:true, hide:true },
    { k:'seReports', l:'Open reports',  g:'100px', num:true },
    { k:'sePay',     l:'Pay',           g:'120px', num:true },
    { k:'status',    l:'Status',        g:'110px' },
    { k:'joined',    l:'Joined',        g:'100px', hide:true },
  ],
  chief_editor: [
    { k:'staff',   l:'Chief Editor', g:'minmax(0,2fr)' },
    { k:'ceEditors', l:'Editors',    g:'90px', num:true },
    { k:'ceContracts', l:'To countersign', g:'110px', num:true },
    { k:'ceEscalated', l:'Escalations', g:'110px', num:true },
    { k:'cePolicies', l:'Policies',  g:'90px', num:true, hide:true },
    { k:'status',  l:'Status',       g:'110px' },
    { k:'joined',  l:'Joined',       g:'100px', hide:true },
  ],
  marketing: [
    { k:'staff',   l:'Marketer',     g:'minmax(0,2fr)' },
    { k:'mkCampaigns', l:'Campaigns', g:'100px', num:true },
    { k:'mkLive',  l:'Live',         g:'80px', num:true },
    { k:'mkImpressions', l:'Impressions', g:'120px', num:true },
    { k:'mkSpend', l:'Ad spend',     g:'110px', num:true },
    { k:'status',  l:'Status',       g:'110px' },
    { k:'joined',  l:'Joined',       g:'100px', hide:true },
  ],
  finance: [
    { k:'staff',   l:'Finance',      g:'minmax(0,2fr)' },
    { k:'fnQueue', l:'In queue',     g:'90px', num:true },
    { k:'fnVolume', l:'Volume MTD',  g:'130px', num:true },
    { k:'fnDisputes', l:'Disputes',  g:'100px', num:true },
    { k:'fnCoins', l:'Coin reviews', g:'110px', num:true, hide:true },
    { k:'status',  l:'Status',       g:'110px' },
    { k:'joined',  l:'Joined',       g:'100px', hide:true },
  ],
};

const PAGE_SIZE = 8;
let activeTab = 'all';
let page = 1;
let filtered = [];

/* ── helpers ── */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function money(usd){
  return (window.DroboardCurrency && DroboardCurrency.usdToMoney)
    ? DroboardCurrency.usdToMoney(usd)
    : '$' + Number(usd || 0).toLocaleString();
}
function prose(t){
  return (window.DroboardCurrency && DroboardCurrency.usdProse) ? DroboardCurrency.usdProse(t) : t;
}
function fmtCompact(n){
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
function fmtJoined(s){ return esc(s || '—'); }
function roleMeta(row){ return ROLE_META[row.roles[0]]; }
function memberOf(row, key){ return key === 'all' || row.roles.indexOf(key) !== -1; }
function rolePill(row){
  var m = roleMeta(row), extra = row.roles.length - 1;
  return '<span class="role-pill" style="background:' + BG_MAP[m.cls] + ';color:' + ICO_MAP[m.cls] + '" title="' + esc(row.roles.map(function(r){ return ROLE_META[r].label; }).join(', ')) + '">'
    + '<i class="fas ' + m.icon + '"></i> ' + esc(m.label) + (extra > 0 ? ' +' + extra : '') + '</span>';
}
function accountChip(row){
  if (row.account !== 'active') {
    return '<span class="status-chip ' + esc(row.account) + '"><i class="fas fa-circle"></i>' + esc(row.account.replace('_', ' ')) + '</span>';
  }
  if (row.se) {
    var q = row.se.quota;
    return '<span class="status-chip ' + q + '"><i class="fas fa-circle"></i>' + (q === 'on-track' ? 'On track' : q) + '</span>';
  }
  return '<span class="status-chip active"><i class="fas fa-circle"></i>Active</span>';
}
function quotaBar(se){
  var pct = Math.round(se.authors / se.target * 100);
  var cls = se.quota === 'behind' ? 'low' : (se.quota === 'ahead' ? '' : '');
  return '<div class="metric">' + se.authors + '<span class="of">/' + se.target + '</span>'
    + '<small>' + pct + '% of quota</small>'
    + '<div class="quota-bar ' + cls + '"><i style="width:' + Math.min(100, pct) + '%"></i></div></div>';
}
function primaryCell(row){
  if (row.se) return quotaBar(row.se);
  if (row.ce) return '<div class="metric">' + row.ce.editors + '<small>editors managed</small></div>';
  if (row.mkt) return '<div class="metric">' + row.mkt.campaigns + '<small>campaigns · ' + row.mkt.live + ' live</small></div>';
  if (row.fin) return '<div class="metric">' + row.fin.queue + '<small>in withdrawal queue</small></div>';
  return '<div class="metric">—</div>';
}
function workload(row){
  if (row.se) return Math.round(row.se.authors / row.se.target * 100) + (row.se.openReports * 3);
  if (row.ce) return row.ce.editors * 10 + row.ce.contractsToSign * 5 + row.ce.escalated * 3;
  if (row.mkt) return row.mkt.campaigns * 12 + row.mkt.live * 8 + row.mkt.openItems * 4;
  if (row.fin) return row.fin.queue * 10 + row.fin.disputes * 6;
  return 0;
}

/* ── cells ── */
function staffCell(row){
  var m = roleMeta(row);
  return '<div class="editor-main"><img class="e-avatar" src="' + esc(row.avatar) + '" alt=""/>'
    + '<div class="e-info"><div class="e-name">' + esc(row.name)
    + (row.roles.length > 1 ? ' <i class="fas fa-layer-group lead" title="Holds more than one platform role"></i>' : '')
    + '</div><div class="e-meta">' + esc(row.id) + ' · ' + esc(row.email) + '</div></div></div>';
}
function scopeCell(row){
  var m = roleMeta(row);
  return '<div class="scope">' + esc(m.label) + '<small>' + esc(m.scope) + '</small></div>';
}
function cell(row, col){
  switch (col.k) {
    case 'staff':        return staffCell(row);
    case 'role':         return rolePill(row);
    case 'scope':        return scopeCell(row);
    case 'metric':       return primaryCell(row);
    case 'status':       return accountChip(row);
    case 'joined':       return '<div style="font-size:11px;color:var(--text-faint)">' + fmtJoined(row.joined) + '</div>';
    case 'seAuthors':    return row.se ? quotaBar(row.se) : '<div class="metric">—</div>';
    case 'seInvited':    return row.se ? '<div class="metric">' + row.se.invited + '</div>' : '<div class="metric">—</div>';
    case 'seReports':    return row.se ? '<div class="metric">' + row.se.openReports + '</div>' : '<div class="metric">—</div>';
    case 'sePay':        return row.se
      ? '<div class="metric">' + prose('$' + row.se.payUsd.toLocaleString()) + '<small>' + (row.se.share || 'fixed monthly') + '</small></div>'
      : '<div class="metric">—</div>';
    case 'ceEditors':    return row.ce ? '<div class="metric">' + row.ce.editors + '</div>' : '<div class="metric">—</div>';
    case 'ceContracts':  return row.ce ? '<div class="metric">' + row.ce.contractsToSign + '</div>' : '<div class="metric">—</div>';
    case 'ceEscalated':  return row.ce ? '<div class="metric">' + row.ce.escalated + '</div>' : '<div class="metric">—</div>';
    case 'cePolicies':   return row.ce ? '<div class="metric">' + row.ce.policies + '</div>' : '<div class="metric">—</div>';
    case 'mkCampaigns':  return row.mkt ? '<div class="metric">' + row.mkt.campaigns + '</div>' : '<div class="metric">—</div>';
    case 'mkLive':       return row.mkt ? '<div class="metric">' + row.mkt.live + '</div>' : '<div class="metric">—</div>';
    case 'mkImpressions':return row.mkt ? '<div class="metric">' + fmtCompact(row.mkt.impressions) + '</div>' : '<div class="metric">—</div>';
    case 'mkSpend':      return row.mkt ? '<div class="metric">' + money(row.mkt.spendUsd) + '</div>' : '<div class="metric">—</div>';
    case 'fnQueue':      return row.fin ? '<div class="metric">' + row.fin.queue + '</div>' : '<div class="metric">—</div>';
    case 'fnVolume':     return row.fin ? '<div class="metric">' + money(row.fin.volumeUsd) + '</div>' : '<div class="metric">—</div>';
    case 'fnDisputes':   return row.fin ? '<div class="metric">' + row.fin.disputes + '</div>' : '<div class="metric">—</div>';
    case 'fnCoins':      return row.fin ? '<div class="metric">' + row.fin.coins + '</div>' : '<div class="metric">—</div>';
    default:             return '';
  }
}

/* ── tabs ── */
function renderTabs(){
  document.getElementById('roleTabs').innerHTML = TABS.map(function(t){
    var n = TEAM.filter(function(r){ return memberOf(r, t.key); }).length;
    return '<button class="role-tab' + (t.key === activeTab ? ' active' : '') + '" data-tab="' + t.key + '">'
      + '<i class="fas ' + t.icon + '"></i>' + esc(t.label) + '<span class="n">' + n + '</span></button>';
  }).join('');
  document.querySelectorAll('#roleTabs .role-tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      activeTab = btn.dataset.tab;
      page = 1;
      renderAll();
    });
  });
}

function renderPanelSub(){
  var map = {
    all: 'One roster across the four staff modules. Each tab switches to that module\u2019s own columns, exactly the figures its dashboard works from.',
    senior_editor: 'Owns the author pod assigned by the chief editor: review queue, book management, contracts and reports. 290 authors managed across 14 editors at a 50-author quota.',
    chief_editor: 'Owns the editor pod, countersignature and the final moderation call. 14 senior editors split across 2 chiefs; 4 contracts await a countersignature.',
    marketing: 'Owns campaigns, ad creatives and placements, inventory, the rate card and acquisition spend. Campaign figures are the same rows the Marketing dashboard lists.',
    finance: 'Owns withdrawals, payouts, payment disputes and the coin store. Totals match the Finance dashboard: 9 queued withdrawals, $182,400 volume, 4 open disputes.',
  };
  document.getElementById('panelSub').textContent = prose(map[activeTab] || map.all);
}

/* ── stat cards ── */
function sum(list, fn){ return list.reduce(function(s, r){ return s + (fn(r) || 0); }, 0); }
function statsFor(tab){
  var rows = TEAM.filter(function(r){ return memberOf(r, tab); });
  var ses = TEAM.filter(function(r){ return r.se; });
  var ces = TEAM.filter(function(r){ return r.ce; });
  var mks = TEAM.filter(function(r){ return r.mkt; });
  var fins = TEAM.filter(function(r){ return r.fin; });

  if (tab === 'senior_editor') {
    var authors = sum(ses, function(r){ return r.se.authors; });
    var target = sum(ses, function(r){ return r.se.target; });
    return [
      { n: authors, l:'Authors managed', ico:'fa-users', cls:'gold' },
      { n: Math.round(authors / target * 100) + '%', l:'Against 50-author quota', ico:'fa-gauge-high', cls:'blue' },
      { n: ses.filter(function(r){ return r.se.quota === 'behind'; }).length, l:'Behind quota', ico:'fa-arrow-trend-down', cls:'amber' },
      { n: sum(ses, function(r){ return r.se.openReports; }), l:'Open reports', ico:'fa-flag', cls:'red' },
    ];
  }
  if (tab === 'chief_editor') {
    return [
      { n: sum(ces, function(r){ return r.ce.editors; }), l:'Senior editors managed', ico:'fa-user-tie', cls:'gold' },
      { n: sum(ces, function(r){ return r.ce.contractsToSign; }), l:'Awaiting countersignature', ico:'fa-file-signature', cls:'blue' },
      { n: sum(ces, function(r){ return r.ce.escalated; }), l:'Open escalations', ico:'fa-flag', cls:'red' },
      { n: sum(ces, function(r){ return r.ce.policies; }), l:'Policies pending', ico:'fa-scroll', cls:'purple' },
    ];
  }
  if (tab === 'marketing') {
    return [
      { n: sum(mks, function(r){ return r.mkt.campaigns; }), l:'Campaigns', ico:'fa-bullhorn', cls:'gold' },
      { n: sum(mks, function(r){ return r.mkt.live; }), l:'Live now', ico:'fa-tower-broadcast', cls:'green' },
      { n: fmtCompact(sum(mks, function(r){ return r.mkt.impressions; })), l:'Campaign impressions', ico:'fa-eye', cls:'blue' },
      { n: money(sum(mks, function(r){ return r.mkt.spendUsd; })), l:'Ad spend', ico:'fa-filter-circle-dollar', cls:'amber' },
    ];
  }
  if (tab === 'finance') {
    return [
      { n: sum(fins, function(r){ return r.fin.queue; }), l:'Withdrawals queued', ico:'fa-building-columns', cls:'blue' },
      { n: money(sum(fins, function(r){ return r.fin.volumeUsd; })), l:'Volume this month', ico:'fa-arrow-up-right-dots', cls:'gold' },
      { n: sum(fins, function(r){ return r.fin.disputes; }), l:'Open disputes', ico:'fa-scale-balanced', cls:'red' },
      { n: prose('$14,860'), l:'Pending payout value', ico:'fa-hourglass-half', cls:'amber' },
    ];
  }
  var seCount = TEAM.filter(function(r){ return r.se; }).length;
  var ceCount = TEAM.filter(function(r){ return r.ce; }).length;
  return [
    { n: rows.length, l:'Staff with module access', ico:'fa-users', cls:'gold' },
    { n: seCount, l:'Senior editors', ico:'fa-user-tie', cls:'blue' },
    { n: ceCount, l:'Chief editors', ico:'fa-crown', cls:'red' },
    { n: TEAM.filter(function(r){ return r.mkt || r.fin; }).length, l:'Marketing & finance', ico:'fa-briefcase', cls:'purple' },
  ];
}

function renderStats(){
  var stats = statsFor(activeTab);
  document.getElementById('statCards').innerHTML = stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:' + BG_MAP[s.cls] + ';color:' + ICO_MAP[s.cls] + '">'
      + '<i class="fas ' + s.ico + '"></i></div><div><div class="stat-num">' + s.n + '</div>'
      + '<div class="stat-lbl">' + esc(s.l) + '</div></div></div>';
  }).join('');
}

/* ── list ── */
function renderHead(){
  var cols = COLUMNS[activeTab];
  var tmpl = cols.map(function(c){ return c.g; }).join(' ');
  var head = document.getElementById('listHead');
  head.className = 'list-cols';
  head.style.gridTemplateColumns = tmpl;
  head.innerHTML = cols.map(function(c){
    return '<span class="' + (c.num ? 'num ' : '') + (c.hide ? 'col-hide' : '') + '">' + esc(c.l) + '</span>';
  }).join('');
}

function applyFilters(){
  var q = document.getElementById('searchInput').value.trim().toLowerCase();
  var status = document.getElementById('statusFilter').value;
  var sort = document.getElementById('sortFilter').value;

  filtered = TEAM.filter(function(r){
    if (!memberOf(r, activeTab)) return false;
    if (q) {
      var hay = (r.name + ' ' + r.id + ' ' + r.email + ' ' + r.roles.map(function(k){ return ROLE_META[k].label; }).join(' ')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (status === 'active' && r.account !== 'active') return false;
    if (status === 'suspended' && r.account !== 'suspended') return false;
    if (status === 'behind' && !(r.se && r.se.quota === 'behind')) return false;
    return true;
  });

  if (sort === 'name') filtered.sort(function(a, b){ return a.name.localeCompare(b.name); });
  else if (sort === 'recent') filtered.sort(function(a, b){ return (Date.parse(b.joined) || 0) - (Date.parse(a.joined) || 0); });
  else filtered.sort(function(a, b){ return workload(b) - workload(a); });

  page = 1;
  renderList();
}

function renderList(){
  var cols = COLUMNS[activeTab];
  var tmpl = cols.map(function(c){ return c.g; }).join(' ');
  var start = (page - 1) * PAGE_SIZE;
  var items = filtered.slice(start, start + PAGE_SIZE);
  var listEl = document.getElementById('editorList');

  if (!items.length) {
    listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i>No staff match these filters.</div>';
  } else {
    listEl.innerHTML = items.map(function(r){
      return '<div class="editor-row" data-staff="' + esc(r.id) + '" data-tab="' + activeTab + '" style="grid-template-columns:' + tmpl + '">'
        + cols.map(function(c){
          return '<div class="' + (c.hide ? 'col-hide' : '') + '">' + cell(r, c) + '</div>';
        }).join('')
        + '</div>';
    }).join('');
    listEl.querySelectorAll('.editor-row').forEach(function(row){
      row.addEventListener('click', function(ev){
        if (ev.target.closest('a,button')) return;
        openEdModal(row.dataset.staff);
      });
    });
  }
  renderFooter();
}

function renderFooter(){
  var total = filtered.length;
  var start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  var end = Math.min(page * PAGE_SIZE, total);
  document.getElementById('footerInfo').textContent = 'Showing ' + start + '\u2013' + end + ' of ' + total + ' staff';

  var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  var html = '<button ' + (page === 1 ? 'disabled' : '') + ' data-p="prev"><i class="fas fa-chevron-left"></i></button>';
  var show = new Set([1, totalPages, page, page - 1, page + 1]);
  var last = 0;
  for (var p = 1; p <= totalPages; p++) {
    if (!show.has(p)) continue;
    if (p - last > 1) html += '<span class="pager-gap">\u2026</span>';
    html += '<button data-p="' + p + '" class="' + (p === page ? 'active' : '') + '">' + p + '</button>';
    last = p;
  }
  html += '<button ' + (page === totalPages ? 'disabled' : '') + ' data-p="next"><i class="fas fa-chevron-right"></i></button>';
  document.getElementById('pager').innerHTML = html;

  document.querySelectorAll('#pager button').forEach(function(btn){
    btn.addEventListener('click', function(){
      var p = btn.dataset.p;
      if (p === 'prev') page = Math.max(1, page - 1);
      else if (p === 'next') page = Math.min(totalPages, page + 1);
      else page = parseInt(p, 10);
      renderList();
      document.querySelector('.panel').scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

/* ── detail modal ── */
let selectedEditor = null;
let resetTarget = null;

function modalStats(row){
  if (row.se) {
    return [
      { v: row.se.authors + '/' + row.se.target, l:'Authors / quota' },
      { v: row.se.invited, l:'Authors invited' },
      { v: row.se.openReports, l:'Open reports' },
    ];
  }
  if (row.ce) {
    return [
      { v: row.ce.editors, l:'Editors managed' },
      { v: row.ce.contractsToSign, l:'To countersign' },
      { v: row.ce.escalated, l:'Escalations' },
    ];
  }
  if (row.mkt) {
    return [
      { v: row.mkt.campaigns + '/' + row.mkt.live, l:'Campaigns / live' },
      { v: fmtCompact(row.mkt.impressions), l:'Impressions' },
      { v: money(row.mkt.spendUsd), l:'Ad spend' },
    ];
  }
  if (row.fin) {
    return [
      { v: row.fin.queue, l:'In withdrawal queue' },
      { v: money(row.fin.volumeUsd), l:'Volume MTD' },
      { v: row.fin.disputes, l:'Open disputes' },
    ];
  }
  return [];
}

function detailRow(label, value){
  return '<div class="ed-modal-detail"><span class="lbl">' + esc(label) + '</span><span class="val">' + value + '</span></div>';
}

function modalDetails(row){
  var out = detailRow('Staff ID', esc(row.id))
    + detailRow('Account', accountChip(row))
    + detailRow('Primary module', '<a class="mod-link" style="padding:2px 7px" href="' + roleMeta(row).page + '">' + esc(roleMeta(row).label) + '</a>')
    + detailRow('Platform roles', esc(row.roles.map(function(k){ return ROLE_META[k].label; }).join(', ')))
    + detailRow('Joined', fmtJoined(row.joined))
    + detailRow('Email', esc(row.email));

  if (row.se) {
    out += detailRow('Quota', esc(row.se.authors + ' of ' + row.se.target + ' authors'))
      + detailRow('Pay', prose('$' + row.se.payUsd.toLocaleString()) + (row.se.share ? ' + ' + esc(row.se.share) + ' revenue share' : ' fixed'))
      + detailRow('YTD paid', prose('$' + row.se.ytdUsd.toLocaleString()))
      + detailRow('Quota deadline', esc(row.se.deadline));
  }
  if (row.ce) {
    out += detailRow('Pod size', esc(row.ce.editors + ' senior editors'))
      + detailRow('Submissions reviewed', esc(row.ce.submissions.toLocaleString()))
      + detailRow('Policies pending', esc(row.ce.policies))
      + detailRow('Partnerships', esc(row.ce.partnerships));
  }
  if (row.mkt) {
    out += detailRow('Campaigns', esc(row.mkt.campaigns + ' (' + row.mkt.live + ' live)'))
      + detailRow('Impressions', esc(fmtCompact(row.mkt.impressions)))
      + detailRow('Ad spend', money(row.mkt.spendUsd))
      + detailRow('Needs action', esc(row.mkt.openItems + ' campaign' + (row.mkt.openItems === 1 ? '' : 's')));
  }
  if (row.fin) {
    out += detailRow('Withdrawals queued', esc(row.fin.queue))
      + detailRow('Volume this month', money(row.fin.volumeUsd))
      + detailRow('Open disputes', esc(row.fin.disputes))
      + detailRow('Coin reviews', esc(row.fin.coins));
  }
  return out;
}

function modalModules(row){
  var seen = {}, links = [];
  row.roles.forEach(function(key){
    ROLE_META[key].modules.forEach(function(m){
      if (seen[m.href]) return;
      seen[m.href] = 1;
      links.push('<a class="mod-link" href="' + m.href + '"><i class="fas ' + m.icon + '"></i>' + esc(m.label) + '</a>');
    });
  });
  return links.join('') || '<span style="font-size:11.5px;color:var(--text-faint)">No module pages.</span>';
}

function modalAuthority(row){
  var primary = ROLE_META[row.roles[0]];
  return '<div class="ed-modal-section"><i class="fas fa-shield-halved"></i> What this role can do</div>'
    + primary.can.map(function(c){
      return '<div class="ed-modal-detail"><span class="lbl" style="flex:1;font-weight:600">' + esc(c) + '</span></div>';
    }).join('');
}

function openEdModal(id){
  var row = TEAM.find(function(r){ return r.id === id; });
  if (!row) return;
  selectedEditor = row;

  document.getElementById('edModalAvatar').src = row.avatar;
  document.getElementById('edModalName').textContent = row.name;
  document.getElementById('edModalRole').textContent =
    row.roles.map(function(k){ return ROLE_META[k].label; }).join(' · ') + ' · ' + row.id;

  document.getElementById('edModalStats').innerHTML = modalStats(row).map(function(s){
    return '<div class="ed-modal-stat"><b>' + esc(s.v) + '</b><span>' + esc(s.l) + '</span></div>';
  }).join('');

  document.getElementById('edModalDetails').innerHTML = modalDetails(row) + modalAuthority(row);
  document.getElementById('edModalModules').innerHTML = modalModules(row);
  document.getElementById('edModalBg').classList.add('open');
}
function closeEdModal(){ document.getElementById('edModalBg').classList.remove('open'); selectedEditor = null; }

function renderAll(){
  renderTabs();
  renderPanelSub();
  renderStats();
  renderHead();
  applyFilters();
}

/* ── wiring ── */
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') { closeEdModal(); closePwModal(); }
});

document.getElementById('edModalClose').addEventListener('click', closeEdModal);
document.getElementById('edModalBg').addEventListener('click', function(e){ if (e.target.id === 'edModalBg') closeEdModal(); });
document.getElementById('edModalOpenModule').addEventListener('click', function(){
  if (selectedEditor) window.location.href = ROLE_META[selectedEditor.roles[0]].page;
});
document.getElementById('edModalReset').addEventListener('click', function(){
  if (!selectedEditor) return;
  resetTarget = selectedEditor;
  closeEdModal();
  document.getElementById('pwEditorName').textContent = resetTarget.name;
  document.getElementById('pwNew').value = '';
  document.getElementById('pwConfirm').value = '';
  document.getElementById('pwErr').classList.remove('show');
  document.getElementById('pwModalForm').style.display = '';
  document.getElementById('pwSuccess').classList.remove('show');
  document.getElementById('pwModalBg').classList.add('open');
});

/* password reset modal */
function closePwModal(){ document.getElementById('pwModalBg').classList.remove('open'); }
document.getElementById('pwModalClose').addEventListener('click', closePwModal);
document.getElementById('pwCancel').addEventListener('click', closePwModal);
document.getElementById('pwModalBg').addEventListener('click', function(e){ if (e.target.id === 'pwModalBg') closePwModal(); });
document.getElementById('pwConfirmBtn').addEventListener('click', function(){
  var pw = document.getElementById('pwNew').value;
  var pw2 = document.getElementById('pwConfirm').value;
  var err = document.getElementById('pwErr');
  if (pw.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.classList.add('show'); return; }
  if (pw !== pw2) { err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
  err.classList.remove('show');
  var btn = document.getElementById('pwConfirmBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting…';
  setTimeout(function(){
    btn.disabled = false; btn.innerHTML = 'Reset Password';
    document.getElementById('pwModalForm').style.display = 'none';
    document.getElementById('pwSuccessMsg').textContent = 'New password has been set for ' + (resetTarget ? resetTarget.name : 'the staff member') + '. They can now log in with the new password.';
    document.getElementById('pwSuccess').classList.add('show');
  }, 1200);
});

var _searchEl = document.getElementById('searchInput');
if (_searchEl) { _searchEl.value = ''; }
document.getElementById('sortFilter').value = 'metric';
loadTeam();

/* No window exports: every handler is addEventListener; the only inline onclick
 * in the shell is native event.stopPropagation(). */
})();
