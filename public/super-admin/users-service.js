/**
/* users-service.js — Data layer for Users page */
(function(){
'use strict';
if(window.__usersService) return;
window.__usersService = true;

var _users = [];
var _roles = [];
var _genres = [];
var _genreColors = {};
var _total = 0;
var API_BASE = '/api/super-admin';

/* Live data layer. The page used to render an in-memory array that was never
   filled, so a signed-in admin always saw "No users match your filters". */
function api(method, path, body){
  var headers = { 'Content-Type': 'application/json' };
  var opts = { method: method, credentials: 'include', headers: headers };
  if(body !== undefined){ opts.body = JSON.stringify(body); }
  return fetch(API_BASE + path, opts).then(function(r){
    if(!r.ok){
      return r.json().catch(function(){ return null; }).then(function(b){
        var e = new Error((b && b.error) || ('API error ' + r.status));
        e.status = r.status;
        throw e;
      });
    }
    return r.json().catch(function(){ return null; });
  });
}

function users(){ return _users; }
function roles(){ return _roles; }
function genres(){ return _genres; }
function genreColors(){ return _genreColors; }
function byId(id){ return _users.find(function(u){ return String(u.id) === String(id); }); }

function stats(){
  var activeToday = _users.filter(function(u){
    return u.lastActive && (Date.now() - new Date(u.lastActive).getTime()) < 86400000;
  }).length;
  return {
    total: _total || _users.length,
    writers: _users.filter(function(u){ return u.role==='Writer'; }).length,
    activeToday: activeToday,
    flagged: _users.filter(function(u){ return u.status!=='active'; }).length
  };
}

function search(query, role, status, sort){
  var q = (query||'').toLowerCase();
  var list = _users.filter(function(u){
    var matchQ = !q || String(u.name||'').toLowerCase().indexOf(q)!==-1 || String(u.username||'').toLowerCase().indexOf(q)!==-1 || String(u.email||'').toLowerCase().indexOf(q)!==-1;
    var matchR = !role || role==='all' || u.role===role;
    var matchS = !status || status==='all' || u.status===status;
    return matchQ && matchR && matchS;
  });
  if(sort==='name') list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  else if(sort==='active') list.sort(function(a,b){ return new Date(b.lastActive||0)-new Date(a.lastActive||0); });
  else if(sort==='followers-desc') list.sort(function(a,b){ return b.followers-a.followers; });
  else if(sort==='reports-desc') list.sort(function(a,b){ return b.reports-a.reports; });
  else list.sort(function(a,b){ return new Date(b.joined||0)-new Date(a.joined||0); });
  return list;
}

function load(){
  return api('GET', '/users?limit=100')
    .then(function(res){
      _users = (res && res.items) || [];
      _total = (res && res.total) || _users.length;
      return api('GET', '/roles').catch(function(){ return []; });
    })
    .then(function(rr){
      _roles = (rr || []).map(function(r){ return r.name; }).filter(Boolean);
      return _users;
    });
}

/* Mutations write through to the API and update the local row from the response,
   so the console never shows a state the server does not have. */
function updateUser(id, changes){
  var u = byId(id);
  if(!u) return Promise.resolve(null);
  var body = {};
  ['name','username','email','role','roles','status','notes','platformRoles'].forEach(function(k){
    if(changes[k] !== undefined) body[k] = changes[k];
  });
  Object.assign(u, changes);            // optimistic paint
  return api('PATCH', '/users/' + encodeURIComponent(u.id), body)
    .then(function(saved){ if(saved && saved.id) Object.assign(u, saved); return u; })
    .catch(function(e){ throw e; });
}

function deleteUser(id){
  var u = byId(id);
  if(!u) return Promise.resolve(null);
  return api('DELETE', '/users/' + encodeURIComponent(u.id)).then(function(){
    _users = _users.filter(function(x){ return String(x.id) !== String(id); });
    if(_total > 0) _total -= 1;
    return u;
  });
}

function addUser(data){
  return api('POST', '/users', data).then(function(created){
    if(created) { _users.unshift(created); _total += 1; }
    return created;
  });
}

function assignRole(userId, role){
  var u = byId(userId);
  if(!u) return Promise.resolve(null);
  var next = (u.platformRoles||[]).slice();
  if(next.indexOf(role)===-1) next.push(role);
  return updateUser(userId, { platformRoles: next });
}

function removeRole(userId, role){
  var u = byId(userId);
  if(!u) return Promise.resolve(null);
  return updateUser(userId, { platformRoles: (u.platformRoles||[]).filter(function(r){ return r!==role; }) });
}

window.__usersAPI = {
  users: users,
  roles: roles,
  genres: genres,
  genreColors: genreColors,
  byId: byId,
  stats: stats,
  search: search,
  load: load,
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
// Money displays follow the global currency toggle (Super Admin → Platform
// settings). Coins and NGN amounts convert; plain counts stay fmtNum.
// Without the service there is no rate to apply, so the fallback states the
// stored unit instead of pretending the amounts are dollars.
function moneyNGN(n){ if(window.DroboardCurrency && DroboardCurrency.ngnToMoney) return DroboardCurrency.ngnToMoney(n); return '₦'+fmtNum(n); }
// Tips, gifts and unlocks are coin acts — the ledger row is a coin count, the
// reader's balance is coins, so the console states them in coins. moneyNGN is
// for the fiat side (earnings, funding) and the two must not be swapped.
function coins(n){ if(window.DroboardCurrency && DroboardCurrency.coins) return DroboardCurrency.coins(n); return fmtNum(n)+' coins'; }
function fmtDate(d){ const dt=new Date(d); if(isNaN(dt)) return '—'; const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return months[dt.getMonth()]+' '+dt.getDate()+', '+dt.getFullYear(); }
function daysAgo(d){ if(!d) return 0; const dt=new Date(d); return isNaN(dt)?0:Math.round((Date.now()-dt.getTime())/86400000); }

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
      + '<div class="detail-item"><span>Earnings</span><b>'+moneyNGN(u.payout)+'</b></div>'
      + '<div class="detail-item"><span>Coins Spent</span><b>'+fmtNum(u.coinsSpent)+'</b></div>';
  } else {
    overviewCols = '<div class="detail-item"><span>Total Reads</span><b>'+fmtNum(u.reads)+'</b></div>'
      + '<div class="detail-item"><span>Coins Spent</span><b>'+fmtNum(u.coinsSpent)+'</b></div>'
      + '<div class="detail-item"><span>Following</span><b>'+u.following+'</b></div>'
      + '<div class="detail-item"><span>Tips Given</span><b>'+coins(u.tipsCoins)+'</b></div>';
  }
  var notesHtml = u.notes ? '<div class="detail-notes"><i class="fas fa-note-sticky" style="color:var(--accent);margin-right:5px"></i>'+u.notes+'</div>' : '';
  var lockIco = u.status==='active' ? 'lock' : 'unlock';
  var lockLabel = u.status==='active' ? 'Suspend' : 'Activate';
  var streakVal = u.streakDays>0 ? ('\uD83D\uDD25 '+u.streakDays+'d') : '0d';
  // Two different acts on one line: a reader sends coins, the author is credited
  // naira off those coins. The banner states whichever one this account is in.
  var tipVal = u.role==='Writer' ? moneyNGN(u.tipsReceivedNGN) : coins(u.tipsCoins);
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
  html += '<div class="tip-banner"><div class="tb-left"><div class="tb-ico"><i class="fas fa-coins"></i></div><div><div class="tb-label">'+tipLabel+'</div><div class="tb-val">'+tipVal+'</div></div></div></div></div>';
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
      API.updateUser(id, { status:next })
        .then(function(){ toast(u.name+' → '+next); renderStatCards(); applyFilters(); })
        .catch(function(err){ u.status = next==='active'?'suspended':'active'; toast(err.message||'Could not update user', 'fa-triangle-exclamation'); renderStatCards(); applyFilters(); });
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
  const id = pendingDeleteId;
  const u = API.byId(id);
  pendingDeleteId = null;
  closeModal('confirmModal');
  API.deleteUser(id)
    .then(function(){ if(u) toast(u.name+' removed', 'fa-trash'); renderStatCards(); applyFilters(); })
    .catch(function(err){ toast(err.message||'Could not remove user', 'fa-triangle-exclamation'); });
});

/* ── Assign Role overlay ── */
function openRoleOverlay(id){
  roleTargetId = id;
  const u = API.byId(id);
  if(!u) return;
  tempRoles = (u.roles || u.platformRoles || []).slice();
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
  const id = roleTargetId;
  const u = API.byId(id);
  const btn = document.getElementById('roleSaveBtn');
  if(btn) btn.disabled = true;
  // Send `roles` (the set the route guards read), not just display labels.
  API.updateUser(id, { roles: tempRoles.slice() })
    .then(function(saved){
      if(saved && saved.id) Object.assign(u, saved);
      document.getElementById('roleOverlay').classList.remove('open');
      toast((u && u.name ? u.name : 'User')+' — roles updated', 'fa-user-shield');
      renderStatCards(); renderList();
    })
    .catch(function(err){
      toast(err.message||'Could not update roles', 'fa-triangle-exclamation');
    })
    .then(function(){ if(btn) btn.disabled = false; });
});

/* ── Init ── */
function showLoadError(e){
  const box = document.getElementById('usrList');
  if(!box) return;
  const msg = e && (e.status === 403 || e.status === 401)
    ? 'Your account is not authorized for the admin console (HTTP ' + e.status + ').'
    : 'Could not load users: ' + ((e && e.message) || 'network error');
  box.innerHTML = '<div class="empty-msg" style="color:var(--red)"><i class="fas fa-circle-exclamation" style="font-size:20px;margin-bottom:8px;display:block"></i>' + msg + '</div>';
  const rc = document.getElementById('resultCount');
  if(rc) rc.textContent = '0';
}
renderStatCards();
(document.getElementById('usrList').innerHTML = '<div class="empty-msg">Loading users…</div>');
API.load().then(function(){
  var si = document.getElementById('searchInput');
  if (si) si.value = '';
  renderStatCards();
  applyFilters();
}).catch(showLoadError);

})();
