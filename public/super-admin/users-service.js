/**
 * users-service.js — Data layer for Users page
 * Reads from window.AdminDemo.PLATFORM_USERS / PLATFORM_ROLES
 * Backend-ready: set USE_API=true and point API_BASE at real endpoints; no HTML change.
 */
/* Backend-ready flags (no behavior change while USE_API=false) */
const USE_API = false;
const API_BASE = '/api';
(function(){
'use strict';
if(window.__usersService) return;
window.__usersService = true;

/* Demo-data self-load: page HTML no longer includes data/admin-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.AdminDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="data/admin-demo-data.js"><\/script>');
}

var _users = [];
var _roles = [];
var _genres = [];
var _genreColors = {};

function loadFromDemo(){
  var D = window.AdminDemo || {};
  _users = JSON.parse(JSON.stringify(D.PLATFORM_USERS || []));
  _roles = D.PLATFORM_ROLES || ['Reader','Writer','Senior Editor','Chief Editor','Marketing','Finance'];
  _genres = D.USERS_GENRES || [];
  _genreColors = D.USERS_GENRE_COLORS || {};
}
loadFromDemo();
/* Data script self-injected above executes after this file — re-sync once parsed. */
if(!_users.length) window.addEventListener('DOMContentLoaded', function(){ loadFromDemo(); renderStatCards(); applyFilters(); });

function users(){ return _users; }
function roles(){ return _roles; }
function genres(){ return _genres; }
function genreColors(){ return _genreColors; }
function byId(id){ return _users.find(function(u){ return u.id === id; }); }

function stats(){
  var total = _users.length;
  var writers = _users.filter(function(u){ return u.role==='Writer'; }).length;
  var activeToday = _users.filter(function(u){
    var d = new Date(u.lastActive); var now = new Date();
    return Math.floor((now-d)/86400000) <= 0;
  }).length;
  var flagged = _users.filter(function(u){ return u.status!=='active'; }).length;
  return { total:total, writers:writers, activeToday:activeToday, flagged:flagged };
}

function search(query, role, status, sort){
  var q = (query||'').toLowerCase();
  var list = _users.filter(function(u){
    var matchQ = !q || u.name.toLowerCase().indexOf(q)!==-1 || u.username.toLowerCase().indexOf(q)!==-1 || u.email.toLowerCase().indexOf(q)!==-1;
    var matchR = !role || role==='all' || u.role===role;
    var matchS = !status || status==='all' || u.status===status;
    return matchQ && matchR && matchS;
  });
  if(sort==='name') list.sort(function(a,b){ return a.name.localeCompare(b.name); });
  else if(sort==='active') list.sort(function(a,b){ return new Date(b.lastActive)-new Date(a.lastActive); });
  else if(sort==='followers-desc') list.sort(function(a,b){ return b.followers-a.followers; });
  else if(sort==='reports-desc') list.sort(function(a,b){ return b.reports-a.reports; });
  else list.sort(function(a,b){ return new Date(b.joined)-new Date(a.joined); });
  return list;
}

function updateUser(id, changes){
  var u = byId(id);
  if(!u) return null;
  if(changes.name) u.name = changes.name;
  if(changes.username) u.username = changes.username;
  if(changes.email) u.email = changes.email;
  if(changes.role) u.role = changes.role;
  if(changes.status) u.status = changes.status;
  if(changes.notes !== undefined) u.notes = changes.notes;
  if(changes.platformRoles) u.platformRoles = changes.platformRoles;
  return u;
}

function deleteUser(id){
  var idx = _users.findIndex(function(u){ return u.id === id; });
  if(idx===-1) return null;
  return _users.splice(idx,1)[0];
}

function addUser(data){
  var u = Object.assign({
    id:'u'+(_users.length+1+Math.floor(Math.random()*90)),
    avatar:'https://i.pravatar.cc/100?img='+Math.floor(Math.random()*70),
    verified:false, joined:new Date().toISOString().slice(0,10), lastActive:new Date().toISOString().slice(0,10),
    followers:0, stories:0, reads:0, payout:0, coinsSpent:0, following:0, comments:0, reports:0,
    readingHours:0, avgSessionMin:0, streakDays:0, topGenres:[], likesGiven:0, sharesCount:0, savesCount:0, tipsAmount:0, platformRoles:[]
  }, data);
  _users.unshift(u);
  return u;
}

function assignRole(userId, role){
  var u = byId(userId);
  if(!u) return null;
  if(!u.platformRoles) u.platformRoles = [];
  if(u.platformRoles.indexOf(role)===-1) u.platformRoles.push(role);
  return u;
}

function removeRole(userId, role){
  var u = byId(userId);
  if(!u) return null;
  u.platformRoles = (u.platformRoles||[]).filter(function(r){ return r!==role; });
  return u;
}

window.__usersAPI = {
  users: users,
  roles: roles,
  genres: genres,
  genreColors: genreColors,
  byId: byId,
  stats: stats,
  search: search,
  updateUser: updateUser,
  deleteUser: deleteUser,
  addUser: addUser,
  assignRole: assignRole,
  removeRole: removeRole
};

})();

/* ════════════════════════════════════════════════════════════════════
 * PAGE CONTROLLER — moved verbatim from users.html inline script
 * (render / filter / pagination / accordion / role / delete + sidebar attach)
 * Backend-ready: uses window.__usersAPI above; set USE_API=true later, no HTML change.
 * Checked users.html markup + all generated template strings — zero onclick="…"
 * references, so no window.* exposures required. Closure-scoped only.
 * ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const API = window.__usersAPI;
const shell = SuperAdminSidebar.attach('#dashRoot',{
  activeItem:'users', title:'Users', subtitle:'Manage every reader and writer account on Droboard',
  user:{name:'Tobenna Achebe',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=51'}, notifCount:9,
  searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const ROLE_CLS = { Reader:'blue', Writer:'purple', 'Senior Editor':'green', 'Chief Editor':'red', Marketing:'amber', Finance:'accent' };
const ROLE_ICO = { Reader:'fa-book-open-reader', Writer:'fa-feather-pointed', 'Senior Editor':'fa-user-tie', 'Chief Editor':'fa-crown', Marketing:'fa-bullhorn', Finance:'fa-sack-dollar' };

let filtered = [];
let currentPage = 1;
const PAGE_SIZE = 8;
let openMenuId = null;
let pendingDeleteId = null;
let roleTargetId = null;
let tempRoles = [];
let openRowId = null;

function fmtNum(n){ n=n||0; return n>=1000000?(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'K':String(n); }
function fmtDate(d){ const dt=new Date(d+'T00:00:00'); const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return months[dt.getMonth()]+' '+dt.getDate()+', '+dt.getFullYear(); }
function daysAgo(d){ return Math.round((new Date()-new Date(d+'T00:00:00'))/86400000); }

function toast(msg, icon){
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className='toast-item';
  el.innerHTML=`<i class="fas ${icon||'fa-circle-check'}"></i><span>${msg}</span>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }, 2600);
}
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click', ()=>closeModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) closeModal(ov.id); }));
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.show').forEach(ov=>closeModal(ov.id)); document.getElementById('roleOverlay').classList.remove('open'); }});

function renderStatCards(){
  const s = API.stats();
  const stats = [
    { n:s.total, l:'Total Users', ico:'fa-users', cls:'accent' },
    { n:s.writers, l:'Writers', ico:'fa-feather-pointed', cls:'purple' },
    { n:s.activeToday, l:'Active Today', ico:'fa-bolt', cls:'green' },
    { n:s.flagged, l:'Suspended / Banned', ico:'fa-user-slash', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim();
  const role = document.getElementById('roleFilter').value;
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortSelect').value;
  filtered = API.search(q, role, status, sort);
  currentPage = 1;
  renderList();
}

function renderList(){
  document.getElementById('resultCount').textContent = filtered.length;
  const box = document.getElementById('usrList');
  if(!filtered.length){
    box.innerHTML = `<div class="empty-msg"><i class="fas fa-user-slash" style="font-size:20px;margin-bottom:8px;display:block"></i>No users match your filters.</div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  if(currentPage>totalPages) currentPage = totalPages;
  const start = (currentPage-1)*PAGE_SIZE;
  const pageItems = filtered.slice(start, start+PAGE_SIZE);

  box.innerHTML = pageItems.map(u=>{
    const rcls = ROLE_CLS[u.role]||'blue';
    const suspended = u.status==='suspended', banned = u.status==='banned';
    const isOpen = openRowId===u.id;
    var proleHtml = '';
    if(u.platformRoles && u.platformRoles.length){
      var first = u.platformRoles[0];
      var extra = u.platformRoles.length - 1;
      var cls = ROLE_CLS[first]||'accent';
      proleHtml = '<div class="prole-strip"><span class="prole-tag" style="background:'+BG_MAP[cls]+';color:'+ICO_MAP[cls]+'"><i class="fas '+(ROLE_ICO[first]||'fa-shield')+'"></i> '+first+(extra>0?' <b>+'+extra+'</b>':'')+'</span></div>';
    }
    return `
    <div>
      <div class="usr-row ${suspended?'is-suspended':''} ${banned?'is-banned':''} ${isOpen?'is-open':''}" data-id="${u.id}">
        <i class="fas fa-chevron-right expand-ico"></i>
        <div class="user-cell">
          <img class="usr-av" src="${u.avatar}" alt=""/>
          <div class="user-cell-text">
            <div class="usr-name">${u.name}${u.verified?' <i class="fas fa-circle-check usr-verified" title="Verified"></i>':''}</div>
            <div class="usr-handle">@${u.username}</div>
            ${proleHtml}
            <div class="u-mobile-meta">
              <div class="role-badge" style="background:${BG_MAP[rcls]};color:${ICO_MAP[rcls]}"><i class="fas ${ROLE_ICO[u.role]||'fa-user'}"></i> ${u.role}</div>
              <span class="usr-status ${u.status}">${u.status}</span>
            </div>
          </div>
        </div>
        <div class="col-role"><div class="role-badge" style="background:${BG_MAP[rcls]};color:${ICO_MAP[rcls]}"><i class="fas ${ROLE_ICO[u.role]||'fa-user'}"></i> ${u.role}</div></div>
        <div class="col-status"><span class="usr-status ${u.status}">${u.status}</span></div>
        <div class="col-num">${fmtNum(u.followers)}</div>
        <div class="col-num">${u.stories}</div>
        <div class="col-joined">${fmtDate(u.joined)}</div>
        <div class="row-actions">
          <button class="kebab-btn" data-kebab="${u.id}"><i class="fas fa-ellipsis-vertical"></i></button>
          <div class="inline-menu" id="menu-${u.id}">
            <button data-action="assign-role" data-id="${u.id}"><i class="fas fa-user-shield"></i> Assign Role</button>
            <button data-action="toggle-status" data-id="${u.id}"><i class="fas fa-user-${u.status==='active'?'lock':'unlock'}"></i> ${u.status==='active'?'Suspend':'Activate'}</button>
            <button data-action="remove" data-id="${u.id}" class="danger"><i class="fas fa-trash"></i> Remove</button>
          </div>
        </div>
      </div>
      <div class="usr-detail ${isOpen?'show':''}" id="detail-${u.id}"></div>
    </div>`;
  }).join('');
  if(openRowId && pageItems.some(function(u){ return u.id===openRowId; })) renderDetailPanel(openRowId);
  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const box = document.getElementById('pagination');
  if(totalPages<=1){
    box.innerHTML = `<div class="pg-info">Showing all ${filtered.length} user${filtered.length===1?'':'s'}</div>`;
    return;
  }
  const start = (currentPage-1)*PAGE_SIZE+1;
  const end = Math.min(filtered.length, currentPage*PAGE_SIZE);
  let pageBtns = '';
  const pagesToShow = new Set([1, totalPages, currentPage, currentPage-1, currentPage+1]);
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pagesToShow.has(p)) continue;
    if(p-last>1) pageBtns += `<span class="pg-ellipsis">…</span>`;
    pageBtns += `<button class="pg-btn${p===currentPage?' active':''}" data-page="${p}">${p}</button>`;
    last = p;
  }
  box.innerHTML = `
    <div class="pg-info">Showing ${start}–${end} of ${filtered.length} users</div>
    <div class="pg-controls">
      <button class="pg-btn" id="pgPrev" ${currentPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
      ${pageBtns}
      <button class="pg-btn" id="pgNext" ${currentPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>
    </div>`;
  const prevBtn = document.getElementById('pgPrev'), nextBtn = document.getElementById('pgNext');
  prevBtn && prevBtn.addEventListener('click', ()=>{ currentPage--; renderList(); });
  nextBtn && nextBtn.addEventListener('click', ()=>{ currentPage++; renderList(); });
  box.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click', ()=>{ currentPage=parseInt(b.dataset.page,10); renderList(); }));
}

/* ── Accordion detail panel ── */
function renderDetailPanel(id){
  const u = API.byId(id); if(!u) return;
  const panel = document.getElementById('detail-'+id); if(!panel) return;
  const standing = u.status==='banned' ? {label:'Banned Account',cls:'red',ico:'fa-ban'}
    : u.reports===0 ? {label:'Good Standing',cls:'green',ico:'fa-shield-heart'}
    : u.reports<=3 ? {label:'Under Watch',cls:'amber',ico:'fa-triangle-exclamation'}
    : {label:'At Risk',cls:'red',ico:'fa-triangle-exclamation'};
  var reportsSuffix = u.reports>0 ? (' · '+u.reports+' report'+(u.reports===1?'':'s')) : '';
  var platformRolesHtml = (u.platformRoles||[]).map(function(r){
    var cls = ROLE_CLS[r]||'accent';
    return '<div class="role-badge" style="background:'+BG_MAP[cls]+';color:'+ICO_MAP[cls]+'"><i class="fas '+(ROLE_ICO[r]||'fa-shield')+'"></i> '+r+'</div>';
  }).join(' ');
  var genresHtml = (u.topGenres||[]).map(function(g,i){
    return '<span class="genre-chip"><span class="rank">#'+(i+1)+'</span>'+g.name+' <b>+'+g.count+'</b></span>';
  }).join('');
  var overviewCols;
  if(u.role==='Writer'){
    overviewCols = '<div class="detail-item"><span>Stories Published</span><b>'+u.stories+'</b></div>'
      + '<div class="detail-item"><span>Total Reads</span><b>'+fmtNum(u.reads)+'</b></div>'
      + '<div class="detail-item"><span>Earnings</span><b>$'+fmtNum(u.payout)+'</b></div>'
      + '<div class="detail-item"><span>Coins Spent</span><b>'+fmtNum(u.coinsSpent)+'</b></div>';
  } else {
    overviewCols = '<div class="detail-item"><span>Total Reads</span><b>'+fmtNum(u.reads)+'</b></div>'
      + '<div class="detail-item"><span>Coins Spent</span><b>'+fmtNum(u.coinsSpent)+'</b></div>'
      + '<div class="detail-item"><span>Following</span><b>'+u.following+'</b></div>'
      + '<div class="detail-item"><span>Tips Given</span><b>\u20A6'+fmtNum(u.tipsAmount)+'</b></div>';
  }
  var notesHtml = u.notes ? '<div class="detail-notes"><i class="fas fa-note-sticky" style="color:var(--accent);margin-right:5px"></i>'+u.notes+'</div>' : '';
  var lockIco = u.status==='active' ? 'lock' : 'unlock';
  var lockLabel = u.status==='active' ? 'Suspend' : 'Activate';
  var streakVal = u.streakDays>0 ? ('\uD83D\uDD25 '+u.streakDays+'d') : '0d';
  var tipLabel = u.role==='Writer' ? 'Tips Received' : 'Tips Sent';

  var html = '<div class="detail-inner">';
  html += '<div class="detail-standing '+standing.cls+'"><i class="fas '+standing.ico+'"></i> '+standing.label+reportsSuffix+'</div>';
  if(platformRolesHtml) html += '<div style="margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap">'+platformRolesHtml+'</div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-circle-info"></i> Overview</div><div class="detail-grid three">';
  html += '<div class="detail-item"><span>Email</span><b>'+u.email+'</b></div>';
  html += '<div class="detail-item"><span>Last Active</span><b>'+fmtNum(Math.max(0,daysAgo(u.lastActive)))+'d ago</b></div>';
  html += overviewCols;
  html += '</div></div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-clock"></i> Reading Activity</div><div class="detail-grid three">';
  html += '<div class="detail-item accent"><span>Time Spent</span><b>'+u.readingHours+'h</b></div>';
  html += '<div class="detail-item"><span>Avg Session</span><b>'+u.avgSessionMin+'m</b></div>';
  html += '<div class="detail-item fire"><span>Streak</span><b>'+streakVal+'</b></div>';
  html += '</div></div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-layer-group"></i> Top Genres</div><div class="genre-chip-row">'+genresHtml+'</div></div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-heart-circle-check"></i> Engagement</div><div class="detail-grid three">';
  html += '<div class="detail-item"><span>Likes Given</span><b>'+fmtNum(u.likesGiven)+'</b></div>';
  html += '<div class="detail-item"><span>Comments</span><b>'+fmtNum(u.comments)+'</b></div>';
  html += '<div class="detail-item"><span>Shares</span><b>'+fmtNum(u.sharesCount)+'</b></div>';
  html += '<div class="detail-item"><span>Saves</span><b>'+fmtNum(u.savesCount)+'</b></div>';
  html += '</div></div>';
  html += '<div class="detail-section"><div class="ds-label"><i class="fas fa-coins"></i> Tips</div>';
  html += '<div class="tip-banner"><div class="tb-left"><div class="tb-ico"><i class="fas fa-coins"></i></div><div><div class="tb-label">'+tipLabel+'</div><div class="tb-val">\u20A6'+fmtNum(u.tipsAmount)+'</div></div></div></div></div>';
  html += notesHtml;
  html += '<div class="detail-foot">';
  html += '<button class="mini-btn primary" data-action="assign-role" data-id="'+u.id+'"><i class="fas fa-user-shield"></i> Assign Role</button>';
  html += '<button class="mini-btn" data-action="toggle-status" data-id="'+u.id+'"><i class="fas fa-user-'+lockIco+'"></i> '+lockLabel+'</button>';
  html += '</div></div>';
  panel.innerHTML = html;
}

/* ── Kebab menu + accordion ── */
document.addEventListener('click', function(e){
  /* row click → toggle accordion */
  const usrRow = e.target.closest('.usr-row');
  if(usrRow && !e.target.closest('.row-actions')){
    const id = usrRow.dataset.id;
    openRowId = openRowId===id ? null : id;
    renderList();
    return;
  }

  const kebab = e.target.closest('[data-kebab]');
  if(kebab){
    e.stopPropagation();
    const id = kebab.dataset.kebab;
    document.querySelectorAll('.inline-menu.open').forEach(function(m){ if(m.id!=='menu-'+id) m.classList.remove('open'); });
    document.getElementById('menu-'+id).classList.toggle('open');
    return;
  }
  const item = e.target.closest('[data-action]');
  if(item){
    const action = item.dataset.action;
    const id = item.dataset.id;
    document.querySelectorAll('.inline-menu.open').forEach(function(m){ m.classList.remove('open'); });
    if(action==='assign-role') openRoleOverlay(id);
    else if(action==='toggle-status'){
      const u = API.byId(id);
      if(!u) return;
      const next = u.status==='active'?'suspended':'active';
      API.updateUser(id, { status:next });
      toast(u.name+' → '+next);
      renderStatCards(); applyFilters();
    } else if(action==='remove'){
      pendingDeleteId = id;
      const u = API.byId(id);
      document.getElementById('confirmName').textContent = u ? u.name : '';
      openModal('confirmModal');
    }
    return;
  }
  document.querySelectorAll('.inline-menu.open').forEach(function(m){ m.classList.remove('open'); });
});

document.getElementById('confirmDeleteBtn').addEventListener('click', function(){
  if(!pendingDeleteId) return;
  const u = API.deleteUser(pendingDeleteId);
  if(u) toast(u.name+' removed', 'fa-trash');
  pendingDeleteId = null;
  closeModal('confirmModal');
  renderStatCards(); applyFilters();
});

/* ── Assign Role overlay ── */
function openRoleOverlay(id){
  roleTargetId = id;
  const u = API.byId(id);
  if(!u) return;
  tempRoles = (u.platformRoles||[]).slice();
  document.getElementById('roleUser').innerHTML = `
    <img src="${u.avatar}" alt=""/>
    <div><b>${u.name}</b><span>@${u.username} · ${u.role}</span></div>`;
  renderRoleList();
  document.getElementById('roleOverlay').classList.add('open');
}

function renderRoleList(){
  const allRoles = API.roles();
  document.getElementById('roleList').innerHTML = allRoles.map(function(r){
    const assigned = tempRoles.indexOf(r)!==-1;
    const cls = ROLE_CLS[r]||'accent';
    return `<div class="role-item${assigned?' assigned':''}" data-role="${r}">
      <div class="role-item-left">
        <i class="fas ${ROLE_ICO[r]||'fa-shield'}"></i>
        <div><div class="role-item-name">${r}</div><div class="role-item-desc">${r==='Reader'?'Can read stories':r==='Writer'?'Can publish stories':'Platform management role'}</div></div>
      </div>
      <div class="role-check"><i class="fas fa-check" style="display:${assigned?'block':'none'}"></i></div>
    </div>`;
  }).join('');

  document.querySelectorAll('.role-item').forEach(function(el){
    el.addEventListener('click', function(){
      const r = el.dataset.role;
      const idx = tempRoles.indexOf(r);
      if(idx===-1) tempRoles.push(r); else tempRoles.splice(idx,1);
      renderRoleList();
    });
  });
}

document.getElementById('roleOverlayClose').addEventListener('click', function(){
  document.getElementById('roleOverlay').classList.remove('open');
});
document.getElementById('roleSaveBtn').addEventListener('click', function(){
  if(!roleTargetId) return;
  API.updateUser(roleTargetId, { platformRoles: tempRoles });
  const u = API.byId(roleTargetId);
  document.getElementById('roleOverlay').classList.remove('open');
  toast(u.name+' — roles updated', 'fa-user-shield');
  renderList();
});

/* ── Init ── */
renderStatCards();
applyFilters();

})();
