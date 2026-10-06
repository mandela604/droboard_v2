/**
 * roles-service.js — Roles & Permissions page logic (call-and-render)
 * ────────────────────────────────────────────────────────────────────
 * Verbatim page logic moved from roles.html inline script.
 * Backend later owns roles/permissions persistence.
 * Going live: swap USE_API=true, no HTML change.
 */
(function(){
'use strict';
const USE_API = false;
const API_BASE = '/api/super-admin/roles';

const shell = SuperAdminSidebar.attach('#rolesRoot', {
  activeItem: 'roles',
  title: 'Roles & Permissions',
  subtitle: 'Manage team access across the platform',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search roles…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

/* ─────────────────────────────────────────
   PERMISSION SCHEMA
───────────────────────────────────────── */
const PERMISSION_CATEGORIES = [
  { key:'editorial', label:'Editorial Team', icon:'fa-user-tie', perms:[
      { key:'view_editors', name:'View Senior Editors', desc:'See editor list and profiles' },
      { key:'manage_editors', name:'Manage Senior Editors', desc:'Add, edit, suspend editors' },
      { key:'approve_contracts', name:'Countersign Contracts', desc:'Approve author agreements' },
  ]},
  { key:'authors', label:'Authors & Content', icon:'fa-book', perms:[
      { key:'view_authors', name:'View Authors & Stories', desc:'Browse author and story data' },
      { key:'edit_stories', name:'Edit / Unpublish Stories', desc:'Modify or take down content' },
      { key:'manage_submissions', name:'Manage Submissions', desc:'Approve or reject new stories' },
  ]},
  { key:'marketing', label:'Marketing & Growth', icon:'fa-bullseye', perms:[
      { key:'view_campaigns', name:'View Campaigns', desc:'See active and past campaigns' },
      { key:'create_campaigns', name:'Create / Edit Campaigns', desc:'Launch and manage promotions' },
      { key:'approve_budget', name:'Approve Campaign Budgets', desc:'Sign off on spend above $5k' },
  ]},
  { key:'financials', label:'Financials & Payouts', icon:'fa-sack-dollar', perms:[
      { key:'view_financials', name:'View Financial Reports', desc:'Revenue, payouts, statements' },
      { key:'release_payouts', name:'Release Payouts', desc:'Approve and send author payouts' },
      { key:'edit_rates', name:'Edit Payout Rates', desc:'Change revenue-share terms' },
  ]},
  { key:'moderation', label:'Reports & Moderation', icon:'fa-shield-halved', perms:[
      { key:'view_reports', name:'View Reports Queue', desc:'See flagged users and content' },
      { key:'resolve_reports', name:'Resolve Reports', desc:'Dismiss, warn, or escalate' },
      { key:'ban_users', name:'Suspend / Ban Users', desc:'Take account-level action' },
  ]},
  { key:'platform', label:'Platform Settings', icon:'fa-gear', perms:[
      { key:'manage_roles', name:'Manage Roles & Permissions', desc:'This page — full control', locked:true },
      { key:'manage_billing', name:'Manage Platform Billing', desc:'Payment methods, invoices' },
      { key:'view_analytics', name:'View Platform Analytics', desc:'Traffic, growth, health metrics' },
  ]},
];

const COLORS = ['gold','blue','purple','green','red','amber'];

/* ─────────────────────────────────────────
   ROLES DATA
───────────────────────────────────────── */
let ROLES = [
  { id:'super-admin', name:'Super Admin', desc:'Full access to every part of Droboard.', icon:'fa-crown', color:'gold', system:true, memberCount:2,
    members:[{name:'Tobi Adenuga',email:'tobi@droboard.io',avatar:'https://i.pravatar.cc/60?img=68'},{name:'Ngozi Fields',email:'ngozi@droboard.io',avatar:'https://i.pravatar.cc/60?img=45'}],
    perms: Object.fromEntries(PERMISSION_CATEGORIES.flatMap(c=>c.perms.map(p=>[p.key,true]))) },
  { id:'chief-editor', name:'Chief Editor', desc:'Oversees editorial team and content quality.', icon:'fa-feather-pointed', color:'blue', system:true, memberCount:3,
    members:[{name:'Chioma Reddy',email:'chioma@droboard.io',avatar:'https://i.pravatar.cc/60?img=32'},{name:'Femi Okoro',email:'femi@droboard.io',avatar:'https://i.pravatar.cc/60?img=12'},{name:'Ada Lin',email:'ada@droboard.io',avatar:'https://i.pravatar.cc/60?img=25'}],
    perms:{view_editors:true,manage_editors:true,approve_contracts:true,view_authors:true,edit_stories:true,manage_submissions:true,view_campaigns:false,create_campaigns:false,approve_budget:false,view_financials:false,release_payouts:false,edit_rates:false,view_reports:true,resolve_reports:true,ban_users:false,manage_roles:false,manage_billing:false,view_analytics:true} },
  { id:'marketing-lead', name:'Marketing & Growth', desc:'Runs campaigns and promotional pushes.', icon:'fa-bullseye', color:'purple', system:true, memberCount:4,
    members:[{name:'Tari Benson',email:'tari@droboard.io',avatar:'https://i.pravatar.cc/60?img=32'},{name:'Kelechi Uba',email:'kelechi@droboard.io',avatar:'https://i.pravatar.cc/60?img=15'}],
    perms:{view_editors:false,manage_editors:false,approve_contracts:false,view_authors:true,edit_stories:false,manage_submissions:false,view_campaigns:true,create_campaigns:true,approve_budget:false,view_financials:false,release_payouts:false,edit_rates:false,view_reports:false,resolve_reports:false,ban_users:false,manage_roles:false,manage_billing:false,view_analytics:true} },
  { id:'finance', name:'Financials & Payouts', desc:'Handles revenue, statements, and author payouts.', icon:'fa-sack-dollar', color:'green', system:true, memberCount:2,
    members:[{name:'Adaeze Bello',email:'adaeze@droboard.io',avatar:'https://i.pravatar.cc/60?img=9'}],
    perms:{view_editors:false,manage_editors:false,approve_contracts:false,view_authors:false,edit_stories:false,manage_submissions:false,view_campaigns:false,create_campaigns:false,approve_budget:true,view_financials:true,release_payouts:true,edit_rates:true,view_reports:false,resolve_reports:false,ban_users:false,manage_roles:false,manage_billing:false,view_analytics:false} },
  { id:'moderator', name:'Trust & Safety', desc:'Reviews reports and moderates the platform.', icon:'fa-shield-halved', color:'red', system:true, memberCount:5,
    members:[{name:'Sam Okafor',email:'sam@droboard.io',avatar:'https://i.pravatar.cc/60?img=5'},{name:'Rita Chen',email:'rita@droboard.io',avatar:'https://i.pravatar.cc/60?img=44'}],
    perms:{view_editors:false,manage_editors:false,approve_contracts:false,view_authors:true,edit_stories:false,manage_submissions:false,view_campaigns:false,create_campaigns:false,approve_budget:false,view_financials:false,release_payouts:false,edit_rates:false,view_reports:true,resolve_reports:true,ban_users:true,manage_roles:false,manage_billing:false,view_analytics:false} },
  { id:'support-agent', name:'Support Agent', desc:'Custom role for reader-facing support staff.', icon:'fa-headset', color:'amber', system:false, memberCount:6,
    members:[{name:'Diego Marsh',email:'diego@droboard.io',avatar:'https://i.pravatar.cc/60?img=51'}],
    perms:{view_editors:false,manage_editors:false,approve_contracts:false,view_authors:true,edit_stories:false,manage_submissions:false,view_campaigns:false,create_campaigns:false,approve_budget:false,view_financials:false,release_payouts:false,edit_rates:false,view_reports:true,resolve_reports:false,ban_users:false,manage_roles:false,manage_billing:false,view_analytics:false} },
];

let activeRoleId = ROLES[0].id;
let wizStep = 1;
let editingRoleId = null;
let draftPerms = {};
let draftColor = 'gold';

function totalMembers(){ return ROLES.reduce((s,r)=>s+r.memberCount,0); }
function permCount(role){ return Object.values(role.perms).filter(Boolean).length; }

function renderStatCards(){
  const custom = ROLES.filter(r=>!r.system).length;
  const stats = [
    { n:ROLES.length, l:'Total Roles', ico:'fa-user-shield', cls:'gold' },
    { n:totalMembers(), l:'Members Assigned', ico:'fa-people-group', cls:'blue' },
    { n:custom, l:'Custom Roles', ico:'fa-sliders', cls:'purple' },
    { n:'1', l:'Pending Invites', ico:'fa-paper-plane', cls:'amber' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function renderRolesList(){
  document.getElementById('rolesList').innerHTML = ROLES.map(r=>`
    <div class="role-card ${r.id===activeRoleId?'active':''}" data-id="${r.id}">
      <div class="role-card-top">
        <div class="role-card-ico" style="background:${BG_MAP[r.color]};color:${ICO_MAP[r.color]}"><i class="fas ${r.icon}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="role-card-name">${r.name} ${r.system?'<span class="system-chip">System</span>':''}</div>
          <div class="role-card-desc">${r.desc}</div>
        </div>
      </div>
      <div class="role-card-meta">
        <span><i class="fas fa-users"></i>${r.memberCount} members</span>
        <span><i class="fas fa-key"></i>${permCount(r)} permissions</span>
      </div>
    </div>`).join('');
  document.querySelectorAll('.role-card').forEach(c=>{
    c.addEventListener('click', ()=>{ activeRoleId = c.dataset.id; renderRolesList(); renderDetail(); renderMembers(); });
  });
}

function renderDetail(){
  const role = ROLES.find(r=>r.id===activeRoleId);
  if(!role) return;
  const catsHtml = PERMISSION_CATEGORIES.map(cat=>`
    <div class="perm-cat">
      <div class="perm-cat-title"><i class="fas ${cat.icon}"></i> ${cat.label}</div>
      <table class="perm-table">
        ${cat.perms.map(p=>`
          <tr>
            <td><div class="perm-name">${p.name}<small>${p.desc}</small></div></td>
            <td class="perm-cell">
              <span class="perm-toggle ${role.perms[p.key]?'on':''} ${p.locked && role.id==='super-admin' ? 'locked':''}"
                    data-role="${role.id}" data-perm="${p.key}"></span>
            </td>
          </tr>`).join('')}
      </table>
    </div>`).join('');

  document.getElementById('detailPanel').innerHTML = `
    <div class="detail-head">
      <div class="detail-ico" style="background:${BG_MAP[role.color]};color:${ICO_MAP[role.color]}"><i class="fas ${role.icon}"></i></div>
      <div>
        <div class="detail-name">${role.name} ${role.system?'<span class="system-chip">System</span>':''}</div>
        <div class="detail-desc">${role.desc}</div>
      </div>
      <div class="detail-actions">
        <button class="btn" id="editRoleBtn"><i class="fas fa-pen"></i> Edit</button>
        ${role.system ? '' : `<button class="btn" id="deleteRoleBtn" style="color:var(--red);border-color:var(--red-bg)"><i class="fas fa-trash"></i></button>`}
      </div>
    </div>
    ${catsHtml}`;

  document.querySelectorAll('.perm-toggle').forEach(t=>{
    if(t.classList.contains('locked')) return;
    t.addEventListener('click', ()=>{
      const rid = t.dataset.role, pk = t.dataset.perm;
      const r = ROLES.find(x=>x.id===rid);
      r.perms[pk] = !r.perms[pk];
      t.classList.toggle('on', r.perms[pk]);
      renderRolesList();
      renderStatCards();
    });
  });

  document.getElementById('editRoleBtn')?.addEventListener('click', ()=>openModal(role.id));
  document.getElementById('deleteRoleBtn')?.addEventListener('click', ()=>{
    if(confirm(`Delete the "${role.name}" role? Members will need to be reassigned.`)){
      ROLES = ROLES.filter(r=>r.id!==role.id);
      activeRoleId = ROLES[0].id;
      renderRolesList(); renderDetail(); renderMembers(); renderStatCards();
    }
  });
}

function renderMembers(){
  const role = ROLES.find(r=>r.id===activeRoleId);
  if(!role) return;
  document.getElementById('membersPanel').innerHTML = `
    <div class="panel-head"><h2><i class="fas fa-users" style="color:var(--blue)"></i> Members (${role.memberCount})</h2>
      <button class="btn" id="inviteBtn"><i class="fas fa-user-plus"></i> Invite</button>
    </div>
    ${role.members.map(m=>`
      <div class="members-row">
        <img class="m-avatar" src="${m.avatar}" alt=""/>
        <div class="m-body"><div class="m-name">${m.name}</div><div class="m-email">${m.email}</div></div>
        <button class="mini-btn danger">Remove</button>
      </div>`).join('')}
    ${role.memberCount > role.members.length ? `<div style="font-size:11px;color:var(--text-faint);margin-top:8px;text-align:center">+ ${role.memberCount - role.members.length} more not shown</div>` : ''}`;
}

/* ─────────────────────────────────────────
   CREATE / EDIT ROLE WIZARD
───────────────────────────────────────── */
function buildColorPicker(selected){
  document.getElementById('colorPicker').innerHTML = COLORS.map(c=>`
    <div data-color="${c}" style="width:30px;height:30px;border-radius:9px;cursor:pointer;background:${BG_MAP[c]};color:${ICO_MAP[c]};display:flex;align-items:center;justify-content:center;border:2px solid ${c===selected?ICO_MAP[c]:'transparent'}">
      <i class="fas fa-check" style="font-size:11px;opacity:${c===selected?1:0}"></i>
    </div>`).join('');
  document.querySelectorAll('#colorPicker > div').forEach(el=>{
    el.addEventListener('click', ()=>{
      draftColor = el.dataset.color;
      buildColorPicker(draftColor);
    });
  });
}

function buildModalPerms(){
  document.getElementById('modalPermCats').innerHTML = PERMISSION_CATEGORIES.map(cat=>`
    <div class="perm-cat" style="margin-top:14px">
      <div class="perm-cat-title"><i class="fas ${cat.icon}"></i> ${cat.label}</div>
      <table class="perm-table">
        ${cat.perms.map(p=>`
          <tr>
            <td><div class="perm-name">${p.name}<small>${p.desc}</small></div></td>
            <td class="perm-cell"><span class="perm-toggle ${draftPerms[p.key]?'on':''}" data-perm="${p.key}"></span></td>
          </tr>`).join('')}
      </table>
    </div>`).join('');
  document.querySelectorAll('#modalPermCats .perm-toggle').forEach(t=>{
    t.addEventListener('click', ()=>{
      const pk = t.dataset.perm;
      draftPerms[pk] = !draftPerms[pk];
      t.classList.toggle('on', draftPerms[pk]);
    });
  });
}

function openModal(roleId){
  editingRoleId = roleId || null;
  wizStep = 1;
  const role = roleId ? ROLES.find(r=>r.id===roleId) : null;
  document.getElementById('modalTitle').textContent = role ? `Edit "${role.name}"` : 'Create New Role';
  document.getElementById('roleNameInput').value = role ? role.name : '';
  document.getElementById('roleDescInput').value = role ? role.desc : '';
  draftColor = role ? role.color : 'gold';
  draftPerms = role ? {...role.perms} : Object.fromEntries(PERMISSION_CATEGORIES.flatMap(c=>c.perms.map(p=>[p.key,false])));
  buildColorPicker(draftColor);
  showWizStep(1);
  document.getElementById('roleModal').classList.add('show');
}

function showWizStep(n){
  wizStep = n;
  document.getElementById('wizStep1').style.display = n===1 ? '' : 'none';
  document.getElementById('wizStep2').style.display = n===2 ? '' : 'none';
  document.getElementById('step1dot').classList.toggle('active', n>=1);
  document.getElementById('step2dot').classList.toggle('active', n>=2);
  document.getElementById('wizBack').style.display = n===1 ? 'none' : '';
  document.getElementById('wizNext').innerHTML = n===1 ? 'Next <i class="fas fa-arrow-right"></i>' : `<i class="fas fa-check"></i> ${editingRoleId?'Save Changes':'Create Role'}`;
  if(n===2) buildModalPerms();
}

document.getElementById('wizNext').addEventListener('click', ()=>{
  if(wizStep===1){
    const name = document.getElementById('roleNameInput').value.trim();
    if(!name){ alert('Please give the role a name.'); return; }
    showWizStep(2);
  } else {
    const name = document.getElementById('roleNameInput').value.trim();
    const desc = document.getElementById('roleDescInput').value.trim();
    if(editingRoleId){
      const r = ROLES.find(x=>x.id===editingRoleId);
      r.name = name; r.desc = desc; r.color = draftColor; r.perms = {...draftPerms};
    } else {
      ROLES.push({
        id:'role-'+Date.now(), name, desc, icon:'fa-user-gear', color:draftColor, system:false,
        memberCount:0, members:[], perms:{...draftPerms}
      });
      activeRoleId = ROLES[ROLES.length-1].id;
    }
    closeModal();
    renderRolesList(); renderDetail(); renderMembers(); renderStatCards();
  }
});
document.getElementById('wizBack').addEventListener('click', ()=>showWizStep(1));
function closeModal(){ document.getElementById('roleModal').classList.remove('show'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('roleModal').addEventListener('click', e=>{ if(e.target.id==='roleModal') closeModal(); });
document.getElementById('newRoleBtn').addEventListener('click', ()=>openModal(null));

function init(){
  renderStatCards();
  renderRolesList();
  renderDetail();
  renderMembers();
}
init();

/* ── API contract (when USE_API=true) ──
GET    /api/super-admin/roles         -> Role[]
POST   /api/super-admin/roles         body { name, desc, color, perms }
PUT    /api/super-admin/roles/:id     body Partial<Role>
DELETE /api/super-admin/roles/:id
*/
})();
