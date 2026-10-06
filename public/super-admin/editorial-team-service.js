/**
 * editorial-team-service.js — Editorial Team page controller (call-and-render).
 * Extracted VERBATIM from editorial-team.html inline <script>; NO renames, NO refactors, NO behavior changes.
 * All editors across roles (54-editor generated roster, filters, pagination, detail + password-reset modals).
 * Backend-ready (pattern only): flip USE_API to true and point API_BASE at the real
 * endpoint when the backend lands. No HTML change required.
 */
(function(){
/* Pattern-only backend switch — page currently renders from local data below. */
const USE_API = false, API_BASE = '/api';
'use strict';
const shell = SuperAdminSidebar.attach('#editorialRoot', {
  activeItem: 'editorial-team',
  title: 'Editorial Team',
  subtitle: 'All editors across roles on Droboard',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };
const ROLE_CLS = { 'Senior Editor':'green', 'Chief Editor':'red', Marketing:'amber', Finance:'purple', 'Senior Editor + Chief Editor':'red' };
const ROLE_ICO = { 'Senior Editor':'fa-user-tie', 'Chief Editor':'fa-crown', Marketing:'fa-bullhorn', Finance:'fa-sack-dollar' };
const ALL_ROLES = ['Senior Editor','Chief Editor','Marketing','Finance'];

const FIRST = ['Chioma','Femi','Ada','Wren','Rita','Sam','Ngozi','Ola','Diego','Priya','Kelo','Tari','Ife','Marcus','Zara','Aminah','Chidi','Bola','Emeka','Sade'];
const LAST = ['Reddy','Okoro','Lin','Okonkwo','Chen','Okafor','Fields','Adeyemi','Marsh','Nandan','Writes','Benson','Solarin','Webb','Cole','Blackwood','Okafor','Ibrahim','Nnamdi','Bakare'];
const STATUSES = ['active','active','active','active','active','leave','suspended'];

function generateEditors(n){
  const out = [];
  var seeded = [
    { name:'Tobenna Achebe', role:'Chief Editor', lead:true, authors:58, contracts:42, reports:87, status:'active', joinedDaysAgo:920, avatar:'https://i.pravatar.cc/60?img=68', platformRoles:['Senior Editor'] },
    { name:'Chioma Reddy', role:'Senior Editor', lead:true, authors:45, contracts:38, reports:62, status:'active', joinedDaysAgo:780, avatar:'https://i.pravatar.cc/60?img=5', platformRoles:[] },
    { name:'Femi Okoro', role:'Senior Editor', lead:false, authors:41, contracts:35, reports:55, status:'active', joinedDaysAgo:650, avatar:'https://i.pravatar.cc/60?img=12', platformRoles:['Marketing'] },
    { name:'Ada Lin', role:'Senior Editor', lead:false, authors:38, contracts:30, reports:48, status:'active', joinedDaysAgo:540, avatar:'https://i.pravatar.cc/60?img=9', platformRoles:[] },
    { name:'Wren Okonkwo', role:'Marketing', lead:false, authors:22, contracts:18, reports:34, status:'active', joinedDaysAgo:420, avatar:'https://i.pravatar.cc/60?img=41', platformRoles:['Senior Editor'] },
    { name:'Rita Chen', role:'Finance', lead:false, authors:15, contracts:12, reports:28, status:'active', joinedDaysAgo:380, avatar:'https://i.pravatar.cc/60?img=44', platformRoles:[] },
    { name:'Sam Okafor', role:'Senior Editor', lead:false, authors:36, contracts:28, reports:44, status:'leave', joinedDaysAgo:310, avatar:'https://i.pravatar.cc/60?img=14', platformRoles:['Marketing','Finance'] },
    { name:'Ngozi Fields', role:'Chief Editor', lead:false, authors:52, contracts:40, reports:71, status:'active', joinedDaysAgo:860, avatar:'https://i.pravatar.cc/60?img=23', platformRoles:['Senior Editor','Marketing'] },
    { name:'Ola Adeyemi', role:'Senior Editor', lead:false, authors:33, contracts:25, reports:39, status:'active', joinedDaysAgo:250, avatar:'https://i.pravatar.cc/60?img=31', platformRoles:[] },
    { name:'Diego Marsh', role:'Marketing', lead:false, authors:18, contracts:14, reports:22, status:'suspended', joinedDaysAgo:190, avatar:'https://i.pravatar.cc/60?img=53', platformRoles:[] },
    { name:'Priya Nandan', role:'Senior Editor', lead:false, authors:40, contracts:32, reports:51, status:'active', joinedDaysAgo:700, avatar:'https://i.pravatar.cc/60?img=25', platformRoles:['Finance'] },
    { name:'Kelo Writes', role:'Finance', lead:false, authors:12, contracts:9, reports:16, status:'active', joinedDaysAgo:150, avatar:'https://i.pravatar.cc/60?img=36', platformRoles:[] },
    { name:'Tari Benson', role:'Senior Editor', lead:false, authors:29, contracts:22, reports:35, status:'active', joinedDaysAgo:440, avatar:'https://i.pravatar.cc/60?img=47', platformRoles:['Marketing'] },
    { name:'Ife Solarin', role:'Chief Editor', lead:false, authors:48, contracts:36, reports:64, status:'active', joinedDaysAgo:1020, avatar:'https://i.pravatar.cc/60?img=20', platformRoles:['Senior Editor'] },
    { name:'Marcus Webb', role:'Senior Editor', lead:false, authors:35, contracts:27, reports:42, status:'leave', joinedDaysAgo:340, avatar:'https://i.pravatar.cc/60?img=59', platformRoles:['Finance','Marketing'] },
    { name:'Zara Cole', role:'Marketing', lead:false, authors:20, contracts:16, reports:26, status:'active', joinedDaysAgo:280, avatar:'https://i.pravatar.cc/60?img=32', platformRoles:[] },
  ];
  for(let i=0;i<seeded.length;i++){
    out.push(Object.assign({ id:'ed-'+(10000+i) }, seeded[i]));
  }
  for(let i=seeded.length;i<n;i++){
    const name = FIRST[i%FIRST.length]+' '+LAST[(i*3)%LAST.length];
    const status = STATUSES[i % STATUSES.length];
    const role = ALL_ROLES[i % ALL_ROLES.length];
    const authors = 8 + (i % 50);
    const contracts = Math.round(authors * (0.5 + Math.random()*0.4));
    const reports = Math.floor(Math.random()*40) + (i % 15);
    const joinedDaysAgo = 30 + (i*23)%1100;
    out.push({
      id:'ed-'+(10000+i), name, role, status, authors, contracts, reports,
      lead: false, joinedDaysAgo, platformRoles:[],
      avatar: 'https://i.pravatar.cc/60?img='+((i%70)+1),
    });
  }
  return out;
}

const ALL_EDITORS = generateEditors(54);
let filtered = ALL_EDITORS.slice();
let page = 1;
const pageSize = 12;

function fmtDays(d){
  if(d<30) return d+'d ago';
  if(d<365) return Math.floor(d/30)+'mo ago';
  return Math.floor(d/365)+'y ago';
}

function renderStatCards(){
  const total = ALL_EDITORS.length;
  const active = ALL_EDITORS.filter(e=>e.status==='active').length;
  const avgAuthors = Math.round(ALL_EDITORS.reduce((s,e)=>s+e.authors,0)/total);
  const roleCounts = {};
  ALL_EDITORS.forEach(function(e){ roleCounts[e.role]=(roleCounts[e.role]||0)+1; });
  const stats = [
    { n: total, l:'Total Editors', ico:'fa-user-tie', cls:'gold' },
    { n: active, l:'Active Editors', ico:'fa-circle-check', cls:'green' },
    { n: roleCounts['Senior Editor']||0, l:'Senior Editors', ico:'fa-user-tie', cls:'blue' },
    { n: roleCounts['Chief Editor']||0, l:'Chief Editors', ico:'fa-crown', cls:'red' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>
    '<div class="stat-card"><div class="stat-ico" style="background:'+BG_MAP[s.cls]+';color:'+ICO_MAP[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>'
  ).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;

  filtered = ALL_EDITORS.filter(function(e){
    if(q && !(e.name.toLowerCase().includes(q) || e.id.includes(q) || e.role.toLowerCase().includes(q))) return false;
    if(status && e.status !== status) return false;
    return true;
  });

  if(sort==='authors') filtered.sort(function(a,b){return b.authors-a.authors;});
  else if(sort==='contracts') filtered.sort(function(a,b){return b.contracts-a.contracts;});
  else if(sort==='reports') filtered.sort(function(a,b){return b.reports-a.reports;});
  else if(sort==='recent') filtered.sort(function(a,b){return a.joinedDaysAgo-b.joinedDaysAgo;});
  else if(sort==='name') filtered.sort(function(a,b){return a.name.localeCompare(b.name);});
  else if(sort==='role') filtered.sort(function(a,b){return a.role.localeCompare(b.role) || b.authors-a.authors;});

  page = 1;
  renderList();
}

function renderList(){
  const start = (page-1)*pageSize;
  const pageItems = filtered.slice(start, start+pageSize);
  const listEl = document.getElementById('editorList');

  if(pageItems.length === 0){
    listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i>No editors match your filters.</div>';
  } else {
    listEl.innerHTML = pageItems.map(function(e){
      var rcls = ROLE_CLS[e.role]||'blue';
      var extra = (e.platformRoles||[]).length;
      var roleLabel = e.role + (extra>0 ? ' +'+extra : '');
      var roleBadge = '<span class="role-pill" style="background:'+BG_MAP[rcls]+';color:'+ICO_MAP[rcls]+'"><i class="fas '+(ROLE_ICO[e.role]||'fa-shield')+'"></i> '+roleLabel+'</span>';
      return '<div class="editor-row" data-edid="'+e.id+'" style="cursor:pointer">'
        + '<div class="editor-main"><img class="e-avatar" src="'+e.avatar+'" alt=""/><div class="e-info"><div class="e-name">'+e.name+(e.lead?' <i class="fas fa-star lead" title="Team Lead"></i>':'')+'</div><div class="e-meta">'+e.id+'</div></div></div>'
        + '<div class="col-hide">'+roleBadge+'</div>'
        + '<div class="col-hide num-cell faint">'+e.authors+'</div>'
        + '<div class="col-hide num-cell">'+e.contracts+'</div>'
        + '<div class="num-cell">'+e.reports+'</div>'
        + '<div><span class="status-chip '+e.status+'"><i class="fas fa-circle"></i>'+(e.status==='leave'?'On Leave':e.status)+'</span></div>'
        + '<div class="col-hide" style="font-size:11px;color:var(--text-faint)">'+fmtDays(e.joinedDaysAgo)+'</div>'
        + '<div class="row-actions"><a class="icon-btn" href="../Pages/profile.html?id='+e.id+'" title="View profile"><i class="fas fa-eye"></i></a><div class="row-menu"><button class="row-menu-btn" data-action="toggle-menu" data-id="'+e.id+'" title="More"><i class="fas fa-ellipsis-vertical"></i></button><div class="dropdown" id="menu-'+e.id+'"><a class="dropdown-item" href="../Pages/profile.html?id='+e.id+'"><i class="fas fa-eye"></i> View Profile</a></div></div></div>'
        + '</div>';
    }).join('');

    listEl.querySelectorAll('.editor-row').forEach(function(row){
      row.addEventListener('click', function(ev){
        if(ev.target.closest('.row-actions')) return;
        openEdModal(row.dataset.edid);
      });
    });
  }
  renderFooter();
}

function renderFooter(){
  const total = filtered.length;
  const start = total === 0 ? 0 : (page-1)*pageSize+1;
  const end = Math.min(page*pageSize, total);
  document.getElementById('footerInfo').textContent = 'Showing '+start+'\u2013'+end+' of '+total+' editors';

  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  var html = '<button '+(page===1?'disabled':'')+' data-p="prev"><i class="fas fa-chevron-left"></i></button>';
  const pagesToShow = new Set([1, totalPages, page, page-1, page+1]);
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pagesToShow.has(p)) continue;
    if(p - last > 1) html += '<span class="pager-gap">\u2026</span>';
    html += '<button data-p="'+p+'" class="'+(p===page?'active':'')+'">'+p+'</button>';
    last = p;
  }
  html += '<button '+(page===totalPages?'disabled':'')+' data-p="next"><i class="fas fa-chevron-right"></i></button>';
  document.getElementById('pager').innerHTML = html;

  document.querySelectorAll('#pager button').forEach(function(btn){
    btn.addEventListener('click', function(){
      const p = btn.dataset.p;
      const totalPages2 = Math.max(1, Math.ceil(filtered.length/pageSize));
      if(p==='prev') page = Math.max(1, page-1);
      else if(p==='next') page = Math.min(totalPages2, page+1);
      else page = parseInt(p,10);
      renderList();
      document.querySelector('.panel').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){closeEdModal();closePwModal();}
});

document.addEventListener('click', function(e){
  var btn = e.target.closest('[data-action="toggle-menu"]');
  if(btn){
    e.stopPropagation();
    var id = btn.dataset.id;
    document.querySelectorAll('.dropdown.open').forEach(function(d){ if(d.id!=='menu-'+id) d.classList.remove('open'); });
    document.getElementById('menu-'+id).classList.toggle('open');
    return;
  }
  document.querySelectorAll('.dropdown.open').forEach(function(d){ d.classList.remove('open'); });
});

function init(){
  renderStatCards();
  document.getElementById('sortFilter').value = 'authors';
  applyFilters();
}

/* editor detail modal */
let selectedEditor = null;
function openEdModal(id){
  var ed = ALL_EDITORS.find(function(e){return e.id===id;});
  if(!ed) return;
  selectedEditor = ed;
  document.getElementById('edModalAvatar').src = ed.avatar;
  document.getElementById('edModalName').textContent = ed.name + (ed.lead ? ' ★' : '');
  document.getElementById('edModalRole').textContent = ed.role;

  /* Stats based on role */
  var statsHtml = '';
  if(ed.role === 'Chief Editor'){
    statsHtml = '<div class="ed-modal-stat"><b>'+ed.authors+'</b><span>Editors Managed</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.contracts+'</b><span>Contracts Oversight</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.reports+'</b><span>Reports Reviewed</span></div>';
  } else if(ed.role === 'Senior Editor'){
    statsHtml = '<div class="ed-modal-stat"><b>'+ed.authors+'</b><span>Assigned Authors</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.contracts+'</b><span>Contracts</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.reports+'</b><span>Reports</span></div>';
  } else if(ed.role === 'Marketing'){
    statsHtml = '<div class="ed-modal-stat"><b>'+ed.authors+'</b><span>Campaigns</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.contracts+'</b><span>Content Pieces</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.reports+'</b><span>Reports</span></div>';
  } else if(ed.role === 'Finance'){
    statsHtml = '<div class="ed-modal-stat"><b>'+ed.authors+'</b><span>Transactions</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.contracts+'</b><span>Payouts Processed</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.reports+'</b><span>Reports</span></div>';
  } else {
    statsHtml = '<div class="ed-modal-stat"><b>'+ed.authors+'</b><span>Authors</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.contracts+'</b><span>Contracts</span></div>'
      +'<div class="ed-modal-stat"><b>'+ed.reports+'</b><span>Reports</span></div>';
  }
  document.getElementById('edModalStats').innerHTML = statsHtml;

  var joined = new Date(Date.now() - ed.joinedDaysAgo*86400000);
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var joinedStr = monthNames[joined.getMonth()]+' '+joined.getDate()+', '+joined.getFullYear();
  document.getElementById('edModalDetails').innerHTML =
    '<div class="ed-modal-detail"><span class="lbl">Editor ID</span><span class="val">'+ed.id+'</span></div>'
    +'<div class="ed-modal-detail"><span class="lbl">Status</span><span class="val"><span class="status-chip '+ed.status+'"><i class="fas fa-circle"></i>'+(ed.status==='leave'?'On Leave':ed.status)+'</span></span></div>'
    +'<div class="ed-modal-detail"><span class="lbl">Role</span><span class="val">'+ed.role+'</span></div>'
    +(ed.platformRoles&&ed.platformRoles.length?'<div class="ed-modal-detail"><span class="lbl">Platform Roles</span><span class="val">'+ed.platformRoles.join(', ')+'</span></div>':'')
    +'<div class="ed-modal-detail"><span class="lbl">Joined</span><span class="val">'+joinedStr+'</span></div>'
    +'<div class="ed-modal-detail"><span class="lbl">Email</span><span class="val">'+ed.name.toLowerCase().replace(/ /g,'.')+'@droboard.io</span></div>';
  document.getElementById('edModalBg').classList.add('open');
}
function closeEdModal(){document.getElementById('edModalBg').classList.remove('open');selectedEditor=null;}

document.getElementById('edModalClose').addEventListener('click',closeEdModal);
document.getElementById('edModalBg').addEventListener('click',function(e){if(e.target.id==='edModalBg')closeEdModal();});
document.getElementById('edModalProfile').addEventListener('click',function(){
  if(selectedEditor) window.location.href='../Pages/profile.html?id='+selectedEditor.id;
});
document.getElementById('edModalReset').addEventListener('click',function(){
  closeEdModal();
  document.getElementById('pwEditorName').textContent = selectedEditor ? selectedEditor.name : '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwConfirm').value = '';
  document.getElementById('pwErr').classList.remove('show');
  document.getElementById('pwModalForm').style.display = '';
  document.getElementById('pwSuccess').classList.remove('show');
  document.getElementById('pwModalBg').classList.add('open');
});

/* password reset modal */
function closePwModal(){document.getElementById('pwModalBg').classList.remove('open');}
document.getElementById('pwModalClose').addEventListener('click',closePwModal);
document.getElementById('pwCancel').addEventListener('click',closePwModal);
document.getElementById('pwModalBg').addEventListener('click',function(e){if(e.target.id==='pwModalBg')closePwModal();});
document.getElementById('pwConfirmBtn').addEventListener('click',function(){
  var pw = document.getElementById('pwNew').value;
  var pw2 = document.getElementById('pwConfirm').value;
  var err = document.getElementById('pwErr');
  if(pw.length < 8){err.textContent='Password must be at least 8 characters.';err.classList.add('show');return;}
  if(pw !== pw2){err.textContent='Passwords do not match.';err.classList.add('show');return;}
  err.classList.remove('show');
  var btn = document.getElementById('pwConfirmBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting…';
  setTimeout(function(){
    btn.disabled = false; btn.innerHTML = 'Reset Password';
    document.getElementById('pwModalForm').style.display = 'none';
    document.getElementById('pwSuccessMsg').textContent = 'New password has been set for '+(selectedEditor?selectedEditor.name:'the editor')+'. They can now log in with the new password.';
    document.getElementById('pwSuccess').classList.add('show');
  },1200);
});

init();
/* Window exports: none required — no inline onclick in markup or generated templates
 * references page functions (all-posts.html uses only native event.stopPropagation();
 * all other wiring is via addEventListener/delegation). Nothing exported by design. */
})();
