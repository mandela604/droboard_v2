/**
 * roles-service.js — Roles & Permissions page logic (call-and-render).
 *
 * Rebuilt against the real authority model: every grant below is derived from
 * the requireRole() guard that actually authorizes the route, not from a wish
 * list. Route files:
 *   chief-editors.routes.js / chief-content.routes.js → chief_editor | admin
 *   senior.routes.js                                  → senior_editor | chief_editor | admin
 *   marketing.routes.js                               → marketing | admin
 *   finance.routes.js                                 → finance | admin
 *   admin.routes.js                                   → admin
 *
 * Data loads live from the roles API. Grants for the six system roles are
 * computed from `by`, so they cannot drift from the guard; custom roles keep
 * their stored perms and the page says plainly that route guards read platform
 * roles, not this page.
 *
 * API contract:
 *   GET    /api/super-admin/roles        -> Role[]
 *   GET    /api/super-admin/roles/:id    -> Role + members
 *   POST   /api/super-admin/roles        body { name, desc, color, icon, perms, memberIds }
 *   PUT    /api/super-admin/roles/:id    body Partial<Role>
 *   DELETE /api/super-admin/roles/:id    (system roles are locked)
 */
(function(){
'use strict';
/* Money can appear inside permission copy; usdProse restates only "$" figures
   into the currency Super Admin set and leaves the words alone. */
function prose(t){ return (window.DroboardCurrency && DroboardCurrency.usdProse) ? DroboardCurrency.usdProse(t) : t; }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
const USE_API = true;
const API_BASE = '/api/super-admin/roles';

const shell = SuperAdminSidebar.attach('#rolesRoot', {
  activeItem: 'roles',
  title: 'Roles & Permissions',
  subtitle: 'Every role, and the route guard that enforces it',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search roles…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

/* ─────────────────────────────────────────
   PERMISSION SCHEMA — one row per guarded capability
───────────────────────────────────────── */
const PERMISSION_CATEGORIES = [
  { key:'chief', label:'Editorial — Chief Editor', icon:'fa-crown', perms:[
      { key:'manage_editors', name:'Senior editor roster & quotas', source:'chief-editors.routes.js',
        desc:'Add or suspend senior editors, set quotas and assign author pods', by:['chief_editor','admin'] },
      { key:'approve_contracts', name:'Countersign contracts', source:'chief-editors.routes.js',
        desc:'Final signature on author agreements the senior editor proposed', by:['chief_editor','admin'] },
      { key:'read_flagged_books', name:'Read flagged books', source:'chief-content.routes.js',
        desc:'Read-only view of every book a senior editor flagged', by:['chief_editor','admin'] },
      { key:'manage_editorial_policy', name:'Policies, appeals & taxonomy', source:'chief-content.routes.js',
        desc:'Publish editorial policies, rule on appeals, own categories & genres', by:['chief_editor','admin'] },
      { key:'set_editorial_strategy', name:'Strategy, featured stories & partnerships', source:'chief-content.routes.js',
        desc:'Set editorial direction, curate featured stories and partnerships', by:['chief_editor','admin'] },
      { key:'publish_announcements', name:'Editorial announcements', source:'senior.routes.js · chiefOnly',
        desc:'Publish platform-wide announcements to the editorial team', by:['chief_editor','admin'] },
  ]},
  { key:'senior', label:'Editorial — Senior Editor', icon:'fa-user-tie', perms:[
      { key:'manage_submissions', name:'Review submissions & chapter edits', source:'senior.routes.js',
        desc:'Approve or reject new stories and chapter edits from the review queue', by:['senior_editor','chief_editor','admin'] },
      { key:'review_completions', name:'Book story & completion review', source:'senior.routes.js',
        desc:'Review book stories and completion applications', by:['senior_editor','chief_editor','admin'] },
      { key:'manage_authors', name:'Author roster, invites & verification', source:'senior.routes.js',
        desc:'Manage assigned authors, send invites, verify identities and message them', by:['senior_editor','chief_editor','admin'] },
      { key:'view_authors', name:'View authors & stories', source:'senior.routes.js',
        desc:'Browse author and story data inside the assigned pod', by:['senior_editor','chief_editor','admin'] },
      { key:'review_contracts', name:'Propose contract terms', source:'senior.routes.js',
        desc:'Send a contract template to an author; the chief countersigns', by:['senior_editor','chief_editor','admin'] },
      { key:'resolve_reports', name:'Resolve reports & flags', source:'senior.routes.js',
        desc:'Work the reports queue and flag books for the chief editor', by:['senior_editor','chief_editor','admin'] },
      { key:'view_own_earnings', name:'Own earnings & withdrawal requests', source:'senior.routes.js',
        desc:'Read own earnings and request a withdrawal (finance pays it)', by:['senior_editor','chief_editor','admin'] },
  ]},
  { key:'marketing', label:'Marketing & Growth', icon:'fa-bullhorn', perms:[
      { key:'view_campaigns', name:'View campaigns', source:'marketing.routes.js',
        desc:'See live, scheduled and ended campaigns', by:['marketing','admin'] },
      { key:'create_campaigns', name:'Create & run campaigns', source:'marketing.routes.js',
        desc:'Launch a campaign and edit its story or business brief', by:['marketing','admin'] },
      { key:'manage_ads', name:'Ad creatives, placements & inventory', source:'marketing.routes.js',
        desc:'Build creatives, set placements and manage ad inventory', by:['marketing','admin'] },
      { key:'manage_rate_card', name:'Ad rate card', source:'marketing.routes.js',
        desc:'Set per-placement pricing per currency (no FX on the card)', by:['marketing','admin'] },
      { key:'manage_audience', name:'Audience segments', source:'marketing.routes.js',
        desc:'Define targeting segments and read their reach', by:['marketing','admin'] },
      { key:'manage_league', name:'League boards', source:'marketing.routes.js',
        desc:'Configure league tiers, prize pools and board rules', by:['marketing','admin'] },
      { key:'approve_budget', name:'Acquisition spend', source:'marketing.routes.js',
        desc:'Set acquisition budget and review spend against it', by:['marketing','admin'] },
  ]},
  { key:'finance', label:'Finance', icon:'fa-sack-dollar', perms:[
      { key:'release_payouts', name:'Withdrawals & payouts', source:'finance.routes.js',
        desc:'Approve or decline withdrawals and release author/editor payouts', by:['finance','admin'] },
      { key:'view_financials', name:'Financial reports', source:'finance.routes.js',
        desc:'Revenue, payout statements and period reports', by:['finance','admin'] },
      { key:'resolve_payment_disputes', name:'Payment disputes', source:'finance.routes.js',
        desc:'Investigate and resolve payment disputes', by:['finance','admin'] },
      { key:'manage_coin_store', name:'Coin store & transactions', source:'finance.routes.js',
        desc:'Configure coin packages and review coin transactions', by:['finance','admin'] },
      { key:'manage_payment_methods', name:'Payment methods', source:'finance.routes.js',
        desc:'Review saved payout methods and payee details', by:['finance','admin'] },
  ]},
  { key:'moderation', label:'Reports & Moderation', icon:'fa-shield-halved', perms:[
      { key:'view_reports', name:'View reports queue', source:'senior.routes.js',
        desc:'See flagged users, editors and content', by:['senior_editor','chief_editor','admin'] },
      { key:'ban_users', name:'Suspend / ban users', source:'admin.routes.js',
        desc:'Account-level action after a moderation ruling', by:['chief_editor','admin'] },
  ]},
  { key:'platform', label:'Platform Control', icon:'fa-gear', perms:[
      { key:'manage_users', name:'Users & verification', source:'admin.routes.js',
        desc:'Create, edit and suspend any platform user', by:['admin'] },
      { key:'manage_roles', name:'Roles & permissions', source:'admin.routes.js', locked:true,
        desc:'This page — the only place console roles are assigned', by:['admin'] },
      { key:'edit_stories', name:'Edit / unpublish stories', source:'admin.routes.js',
        desc:'Platform-level content override, outside the editorial flow', by:['admin'] },
      { key:'edit_rates', name:'Revenue splits & coin rate', source:'admin.routes.js',
        desc:'Platform revenue split and coin conversion rate', by:['admin'] },
      { key:'manage_billing', name:'Platform billing', source:'admin.routes.js',
        desc:'Platform invoices and billing configuration', by:['admin'] },
      { key:'manage_settings', name:'Platform settings & audit', source:'admin.routes.js',
        desc:'Feature switches, defaults and the audit trail', by:['admin'] },
      { key:'manage_system_pages', name:'System pages', source:'admin.routes.js',
        desc:'CMS pages reachable from the footer and app shell', by:['admin'] },
      { key:'manage_awards', name:'Awards catalog', source:'admin.routes.js',
        desc:'Award definitions, criteria and manual grants', by:['admin'] },
      { key:'view_analytics', name:'Platform analytics', source:'admin.routes.js',
        desc:'Traffic, growth and platform health metrics', by:['admin'] },
  ]},
];
const ALL_PERMS = PERMISSION_CATEGORIES.reduce(function(a, c){ return a.concat(c.perms); }, []);
const TOTAL_PERM_KEYS = ALL_PERMS.length;

/* ─────────────────────────────────────────
   ROLES — six console roles + one custom role
───────────────────────────────────────── */
const MODULES = {
  admin: [
    { label:'Users', href:'users.html', icon:'fa-users' },
    { label:'Editorial Team', href:'editorial-team.html', icon:'fa-user-tie' },
    { label:'Roles', href:'roles.html', icon:'fa-user-shield' },
    { label:'Revenue Splits', href:'revenue-splits.html', icon:'fa-chart-pie' },
    { label:'Awards', href:'awards.html', icon:'fa-award' },
    { label:'System Pages', href:'system-pages.html', icon:'fa-file-lines' },
    { label:'Platform Settings', href:'platform-settings.html', icon:'fa-gear' },
    { label:'Platform Analytics', href:'platform-analytics.html', icon:'fa-chart-line' },
  ],
  chief_editor: [
    { label:'Senior Editors', href:'../chief-editor/senior-editors.html', icon:'fa-user-tie' },
    { label:'Contracts & Payments', href:'../chief-editor/contracts-payments.html', icon:'fa-file-signature' },
    { label:'Story Reports', href:'../chief-editor/reports-flags.html', icon:'fa-flag' },
    { label:'All Books', href:'../chief-editor/all-books.html', icon:'fa-book' },
    { label:'Editorial Strategy', href:'../chief-editor/editorial-strategy.html', icon:'fa-compass' },
    { label:'Featured Stories', href:'../chief-editor/featured-stories.html', icon:'fa-star' },
    { label:'Categories & Genres', href:'../chief-editor/categories-genres.html', icon:'fa-layer-group' },
  ],
  senior_editor: [
    { label:'Review Queue', href:'../senior-editor/review-queue.html', icon:'fa-inbox' },
    { label:'Book Management', href:'../senior-editor/book-management.html', icon:'fa-book' },
    { label:'Contract Review', href:'../senior-editor/contract-review.html', icon:'fa-file-signature' },
    { label:'Authors', href:'../senior-editor/authors.html', icon:'fa-users' },
    { label:'Reports & Flags', href:'../senior-editor/reports-flags.html', icon:'fa-flag' },
    { label:'My Earnings', href:'../senior-editor/editor-bill-review.html', icon:'fa-sack-dollar' },
  ],
  marketing: [
    { label:'Campaigns', href:'../marketing/campaigns.html', icon:'fa-bullhorn' },
    { label:'Ad Manager', href:'../marketing/ad-manager.html', icon:'fa-rectangle-ad' },
    { label:'Flyer Templates', href:'../marketing/templates.html', icon:'fa-palette' },
    { label:'Traffic & Activity', href:'../marketing/traffic.html', icon:'fa-chart-line' },
    { label:'Acquisition', href:'../marketing/acquisition.html', icon:'fa-filter-circle-dollar' },
    { label:'Marketing Analytics', href:'../marketing/marketing-analytics.html', icon:'fa-chart-pie' },
  ],
  finance: [
    { label:'Withdrawals', href:'../finance/withdrawals.html', icon:'fa-building-columns' },
    { label:'Coin Transactions', href:'../finance/coin-transactions.html', icon:'fa-coins' },
    { label:'Payment Disputes', href:'../finance/payment-disputes.html', icon:'fa-scale-balanced' },
    { label:'Financial Reports', href:'../finance/financial-reports.html', icon:'fa-chart-pie' },
  ],
  support_agent: [],
};

const SE_NAMES = ['Chioma Reddy','Daniel Carter','Sophia Bennett','Marcus Ihejirika','Priya Nair','Elias Thornton','Amara Okafor','Jonas Whitfield','Nadia Petrova','Tobias Adeyemi','Freya Lindqvist','Kwame Asante','Isla Fitzgerald','Rahul Mehta'];
function member(name, img){
  return { name:name, email:name.toLowerCase().replace(/ /g,'.') + '@droboard.io', avatar:'https://i.pravatar.cc/60?img=' + img };
}

let ROLES = [];
let activeRoleId = null;
let wizStep = 1;
let editingRoleId = null;
let draftPerms = {};
let draftColor = 'gold';

const API_BASE_ROLES = '/api/super-admin/roles';

async function loadRoles(){
  try {
    const data = await fetch(API_BASE_ROLES, { credentials:'include' }).then(r => { if(!r.ok) throw new Error('API error '+r.status); return r.json(); });
    ROLES = Array.isArray(data) ? data : (data.items || []);
    if(ROLES.length) activeRoleId = ROLES[0].id;
    renderStatCards();
    renderRolesList();
    renderDetail();
    renderMembers();
  } catch(e){
    document.getElementById('rolesListEl').innerHTML = `<div style="color:var(--red);padding:20px"><i class="fas fa-circle-exclamation"></i> Failed to load roles: ${e.message}</div>`;
  }
}

function permsFor(role){
  if (!role.system) return role.perms || {};
  const out = {};
  ALL_PERMS.forEach(function(p){ out[p.key] = p.by.indexOf(role.id) !== -1; });
  return out;
}
function permCount(role){ const p = permsFor(role); return Object.keys(p).filter(function(k){ return p[k]; }).length; }
function memberCount(role){ return role.members.length; }
function plural(n, word){ return n + ' ' + word + (n === 1 ? '' : 's'); }
function allStaffCount(){
  const seen = {};
  ROLES.forEach(function(r){ r.members.forEach(function(m){ seen[m.email] = 1; }); });
  return Object.keys(seen).length;
}

function renderStatCards(){
  const stats = [
    { n:ROLES.length, l:'Roles', ico:'fa-user-shield', cls:'gold' },
    { n:allStaffCount(), l:'Staff accounts', ico:'fa-people-group', cls:'blue' },
    { n:5, l:'Console modules', ico:'fa-table-columns', cls:'purple' },
    { n:TOTAL_PERM_KEYS, l:'Guarded capabilities', ico:'fa-key', cls:'amber' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(function(s){
    return '<div class="stat-card">'
      + '<div class="stat-ico" style="background:' + BG_MAP[s.cls] + ';color:' + ICO_MAP[s.cls] + '"><i class="fas ' + s.ico + '"></i></div>'
      + '<div><div class="stat-num">' + s.n + '</div><div class="stat-lbl">' + esc(s.l) + '</div></div></div>';
  }).join('');
}

function renderRolesList(){
  document.getElementById('rolesList').innerHTML = ROLES.map(function(r){
    return '<div class="role-card ' + (r.id === activeRoleId ? 'active' : '') + '" data-id="' + esc(r.id) + '">'
      + '<div class="role-card-top">'
      + '<div class="role-card-ico" style="background:' + BG_MAP[r.color] + ';color:' + ICO_MAP[r.color] + '"><i class="fas ' + r.icon + '"></i></div>'
      + '<div style="flex:1;min-width:0"><div class="role-card-name">' + esc(r.name)
      + (r.system ? '<span class="system-chip">System</span>' : '<span class="system-chip" style="background:var(--green-bg);color:var(--green)">Custom</span>')
      + '</div><div class="role-card-desc">' + prose(esc(r.desc)) + '</div></div></div>'
      + '<div class="role-card-meta"><span><i class="fas fa-users"></i>' + plural(memberCount(r), 'member') + '</span>'
      + '<span><i class="fas fa-key"></i>' + plural(permCount(r), 'grant') + '</span>'
      + (MODULES[r.id] && MODULES[r.id].length ? '<span><i class="fas fa-table-columns"></i>' + plural(MODULES[r.id].length, 'page') + '</span>' : '<span><i class="fas fa-ban"></i>no module</span>')
      + '</div></div>';
  }).join('');

  document.querySelectorAll('.role-card').forEach(function(c){
    c.addEventListener('click', function(){
      activeRoleId = c.dataset.id;
      renderRolesList(); renderDetail(); renderMembers();
    });
  });
}

function moduleChips(role){
  const mods = MODULES[role.id] || [];
  if (!mods.length) return '<div class="guard-note"><i class="fas fa-circle-info"></i> A custom role has no console module until it is mapped to a route guard. Its grants are stored on the role only.</div>';
  return '<div class="mod-links">' + mods.map(function(m){
    return '<a class="mod-link" href="' + m.href + '"><i class="fas ' + m.icon + '"></i>' + esc(m.label) + '</a>';
  }).join('') + '</div>';
}

function renderDetail(){
  const role = ROLES.find(function(r){ return r.id === activeRoleId; });
  if (!role) return;
  const granted = permsFor(role);

  const catsHtml = PERMISSION_CATEGORIES.map(function(cat){
    return '<div class="perm-cat">'
      + '<div class="perm-cat-title"><i class="fas ' + cat.icon + '"></i> ' + esc(cat.label) + '</div>'
      + '<table class="perm-table">'
      + cat.perms.map(function(p){
          const on = !!granted[p.key];
          const locked = role.system || p.locked;
          return '<tr><td><div class="perm-name">' + esc(p.name)
            + '<small>' + prose(esc(p.desc)) + '</small>'
            + '<small class="perm-src"><i class="fas fa-' + (role.system ? 'lock' : 'floppy-disk') + '"></i> '
            + (role.system ? 'requireRole(' + p.by.join('|') + ') · ' + esc(p.source) : 'custom grant — stored on this role only')
            + '</small></div></td>'
            + '<td class="perm-cell"><span class="perm-toggle ' + (on ? 'on' : '') + ' ' + (locked ? 'locked' : '') + '"'
            + ' data-role="' + esc(role.id) + '" data-perm="' + p.key + '" title="' + (locked ? 'Enforced by the route guard' : 'Toggle custom grant') + '"></span></td></tr>';
        }).join('')
      + '</table></div>';
  }).join('');

  document.getElementById('detailPanel').innerHTML =
    '<div class="detail-head">'
    + '<div class="detail-ico" style="background:' + BG_MAP[role.color] + ';color:' + ICO_MAP[role.color] + '"><i class="fas ' + role.icon + '"></i></div>'
    + '<div><div class="detail-name">' + esc(role.name)
    + (role.system ? '<span class="system-chip">System</span>' : '<span class="system-chip" style="background:var(--green-bg);color:var(--green)">Custom</span>')
    + '</div><div class="detail-desc">' + prose(esc(role.desc)) + '</div></div>'
    + '<div class="detail-actions">'
    + (role.system ? '' : '<button class="btn" id="editRoleBtn"><i class="fas fa-pen"></i> Edit</button>')
    + (role.system ? '' : '<button class="btn" id="deleteRoleBtn" style="color:var(--red);border-color:var(--red-bg)"><i class="fas fa-trash"></i></button>')
    + '</div></div>'
    + '<div class="perm-cat-title" style="margin-top:14px"><i class="fas fa-table-columns"></i> Module access</div>'
    + moduleChips(role)
    + '<div class="guard-note"><i class="fas fa-shield-halved"></i> '
    + (role.system
        ? 'System role grants are read-only: they come from the requireRole() guard in the route file shown under each row.'
        : 'Custom grants are stored on the role. Route guards only read platform roles, so members must also hold a system role before this grants access.')
    + '</div>'
    + catsHtml;

  document.querySelectorAll('.perm-toggle').forEach(function(t){
    if (t.classList.contains('locked')) return;
    t.addEventListener('click', function(){
      const r = ROLES.find(function(x){ return x.id === t.dataset.role; });
      r.perms[t.dataset.perm] = !r.perms[t.dataset.perm];
      t.classList.toggle('on', r.perms[t.dataset.perm]);
      renderRolesList();
    });
  });

  const editBtn = document.getElementById('editRoleBtn');
  if (editBtn) editBtn.addEventListener('click', function(){ openModal(role.id); });
  const delBtn = document.getElementById('deleteRoleBtn');
  if (delBtn) delBtn.addEventListener('click', function(){
    if (confirm('Delete the "' + role.name + '" role? Members will need to be reassigned.')) {
      ROLES = ROLES.filter(function(r){ return r.id !== role.id; });
      activeRoleId = ROLES[0].id;
      renderRolesList(); renderDetail(); renderMembers(); renderStatCards();
    }
  });
}

function renderMembers(){
  const role = ROLES.find(function(r){ return r.id === activeRoleId; });
  if (!role) return;
  const shown = role.members.slice(0, 8);
  const more = role.members.length - shown.length;
  document.getElementById('membersPanel').innerHTML =
    '<div class="panel-head"><h2><i class="fas fa-users" style="color:var(--blue)"></i> Members (' + role.members.length + ')</h2>'
    + '<a class="btn" href="users.html"><i class="fas fa-user-plus"></i> Assign in Users</a></div>'
    + (role.system
        ? '<div class="panel-sub" style="margin-top:-10px;margin-bottom:12px">Members hold this platform role; the route guards above are what they get.</div>'
        : '')
    + (shown.length ? shown.map(function(m){
        return '<div class="members-row"><img class="m-avatar" src="' + m.avatar + '" alt=""/>'
          + '<div class="m-body"><div class="m-name">' + esc(m.name) + '</div><div class="m-email">' + esc(m.email) + '</div></div>'
          + '<button class="mini-btn danger">Remove</button></div>';
      }).join('') : '<div class="empty-state" style="padding:26px 10px"><i class="fas fa-user-slash"></i>No members yet.</div>')
    + (more > 0 ? '<div style="font-size:11px;color:var(--text-faint);margin-top:8px;text-align:center">+ ' + more + ' more not shown</div>' : '');
}

/* ─────────────────────────────────────────
   CREATE / EDIT CUSTOM ROLE WIZARD
───────────────────────────────────────── */
const COLORS = ['gold','blue','purple','green','red','amber'];

function buildColorPicker(selected){
  document.getElementById('colorPicker').innerHTML = COLORS.map(function(c){
    return '<div data-color="' + c + '" style="width:30px;height:30px;border-radius:9px;cursor:pointer;background:' + BG_MAP[c] + ';color:' + ICO_MAP[c]
      + ';display:flex;align-items:center;justify-content:center;border:2px solid ' + (c === selected ? ICO_MAP[c] : 'transparent') + '">'
      + '<i class="fas fa-check" style="font-size:11px;opacity:' + (c === selected ? 1 : 0) + '"></i></div>';
  }).join('');
  document.querySelectorAll('#colorPicker > div').forEach(function(el){
    el.addEventListener('click', function(){
      draftColor = el.dataset.color;
      buildColorPicker(draftColor);
    });
  });
}

function buildModalPerms(){
  document.getElementById('modalPermCats').innerHTML = PERMISSION_CATEGORIES.map(function(cat){
    return '<div class="perm-cat" style="margin-top:14px">'
      + '<div class="perm-cat-title"><i class="fas ' + cat.icon + '"></i> ' + esc(cat.label) + '</div>'
      + '<table class="perm-table">'
      + cat.perms.map(function(p){
          return '<tr><td><div class="perm-name">' + esc(p.name) + '<small>' + prose(esc(p.desc)) + '</small></div></td>'
            + '<td class="perm-cell"><span class="perm-toggle ' + (draftPerms[p.key] ? 'on' : '') + '" data-perm="' + p.key + '"></span></td></tr>';
        }).join('')
      + '</table></div>';
  }).join('');
  document.querySelectorAll('#modalPermCats .perm-toggle').forEach(function(t){
    t.addEventListener('click', function(){
      const pk = t.dataset.perm;
      draftPerms[pk] = !draftPerms[pk];
      t.classList.toggle('on', draftPerms[pk]);
    });
  });
}

function openModal(roleId){
  editingRoleId = roleId || null;
  wizStep = 1;
  const role = roleId ? ROLES.find(function(r){ return r.id === roleId; }) : null;
  document.getElementById('modalTitle').textContent = role ? 'Edit "' + role.name + '"' : 'Create New Role';
  document.getElementById('roleNameInput').value = role ? role.name : '';
  document.getElementById('roleDescInput').value = role ? role.desc : '';
  draftColor = role ? role.color : 'green';
  draftPerms = role ? Object.assign({}, role.perms) : (function(){ const o = {}; ALL_PERMS.forEach(function(p){ o[p.key] = false; }); return o; })();
  buildColorPicker(draftColor);
  showWizStep(1);
  document.getElementById('roleModal').classList.add('show');
}

function showWizStep(n){
  wizStep = n;
  document.getElementById('wizStep1').style.display = n === 1 ? '' : 'none';
  document.getElementById('wizStep2').style.display = n === 2 ? '' : 'none';
  document.getElementById('step1dot').classList.toggle('active', n >= 1);
  document.getElementById('step2dot').classList.toggle('active', n >= 2);
  document.getElementById('wizBack').style.display = n === 1 ? 'none' : '';
  document.getElementById('wizNext').innerHTML = n === 1 ? 'Next <i class="fas fa-arrow-right"></i>' : '<i class="fas fa-check"></i> ' + (editingRoleId ? 'Save Changes' : 'Create Role');
  if (n === 2) buildModalPerms();
}

document.getElementById('wizNext').addEventListener('click', function(){
  if (wizStep === 1) {
    const name = document.getElementById('roleNameInput').value.trim();
    if (!name) { alert('Please give the role a name.'); return; }
    showWizStep(2);
  } else {
    const name = document.getElementById('roleNameInput').value.trim();
    const desc = document.getElementById('roleDescInput').value.trim();
    if (editingRoleId) {
      const r = ROLES.find(function(x){ return x.id === editingRoleId; });
      r.name = name; r.desc = desc; r.color = draftColor; r.perms = Object.assign({}, draftPerms);
    } else {
      ROLES.push({
        id:'role-' + Date.now(), name:name, desc:desc, icon:'fa-user-gear', color:draftColor,
        system:false, members:[], perms:Object.assign({}, draftPerms),
      });
      activeRoleId = ROLES[ROLES.length - 1].id;
    }
    closeModal();
    renderRolesList(); renderDetail(); renderMembers(); renderStatCards();
  }
});
document.getElementById('wizBack').addEventListener('click', function(){ showWizStep(1); });
function closeModal(){ document.getElementById('roleModal').classList.remove('show'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('roleModal').addEventListener('click', function(e){ if (e.target.id === 'roleModal') closeModal(); });
document.getElementById('newRoleBtn').addEventListener('click', function(){ openModal(null); });

function init(){
  loadRoles();  renderRolesList();
  renderDetail();
  renderMembers();
}
init();
})();
