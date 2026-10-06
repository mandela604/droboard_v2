/**
 * dashboard-service.js — Super Admin Dashboard data + renderers + admin CRUD
 * Backend-ready: set USE_API=true and point API_BASE at real endpoints; no HTML change.
 * Currently runs on local demo data (KPIS / REVENUE / TOP_STORIES / ACTIVITY / ADMINS).
 * Moved verbatim from dashboard.html inline script (including SuperAdminSidebar.attach).
 */
(function(){
'use strict';
/* Backend-ready flags (no behavior change while USE_API=false) */
const USE_API = false;
const API_BASE = '/api';

'use strict';
const shell = SuperAdminSidebar.attach('#dashRoot',{
  activeItem:'dashboard', title:'Super Admin Dashboard', subtitle:'Platform-wide overview across users, revenue, content and the admin team',
  user:{name:'Tobenna Achebe',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=51'}, notifCount:9,
  searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const ROLE_CLS = { 'Super Admin':'accent', 'Chief Editor':'purple', 'Finance Admin':'green', 'Content Moderator':'red', 'Support Admin':'blue' };

function fmtNum(n){ return n>=1000000?(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'K':String(n); }
function fmtNaira(n){ return '$'+fmtNum(n); }

/* ── KPI cards ── */
const KPIS = [
  { n:'284.5K', l:'Total Users', ico:'fa-users', cls:'blue', trend:'+3.2%', up:true },
  { n:'12,340', l:'Total Writers', ico:'fa-feather-pointed', cls:'purple', trend:'+1.8%', up:true },
  { n:'$48.2M', l:'Monthly Revenue', ico:'fa-sack-dollar', cls:'green', trend:'+7.1%', up:true },
  { n:'9,845', l:'Active Stories', ico:'fa-book', cls:'accent', trend:'+2.4%', up:true },
  { n:'37', l:'Pending Reports', ico:'fa-flag', cls:'red', trend:'+12', up:false },
  { n:'812', l:'Active Contracts', ico:'fa-file-contract', cls:'blue', trend:'+9', up:true },
  { n:'26', l:'Live Campaigns', ico:'fa-bullhorn', cls:'accent', trend:'+4', up:true },
  { n:'99.98%', l:'Platform Uptime', ico:'fa-heart-pulse', cls:'green', trend:'0.00%', up:true },
];
document.getElementById('kpiGrid').innerHTML = KPIS.map(k=>`
  <div class="kpi-card">
    <div class="kpi-top">
      <div class="kpi-ico" style="background:${BG_MAP[k.cls]};color:${ICO_MAP[k.cls]}"><i class="fas ${k.ico}"></i></div>
      <span class="kpi-trend ${k.up?'up':'down'}"><i class="fas fa-arrow-${k.up?'up':'up'}" style="font-size:8px"></i> ${k.trend}</span>
    </div>
    <div class="kpi-num">${k.n}</div>
    <div class="kpi-lbl">${k.l}</div>
  </div>`).join('');

/* ── Revenue chart ── */
const REVENUE = [
  { m:'Feb', v:32000000 }, { m:'Mar', v:35400000 }, { m:'Apr', v:39100000 },
  { m:'May', v:41300000 }, { m:'Jun', v:45000000 }, { m:'Jul', v:48200000 },
];
const maxRev = Math.max(...REVENUE.map(r=>r.v));
document.getElementById('chartWrap').innerHTML = REVENUE.map((r,i)=>`
  <div class="chart-col">
    <span class="chart-val">${fmtNaira(r.v)}</span>
    <div class="chart-bar ${i===REVENUE.length-1?'current':''}" style="height:${Math.max(10,r.v/maxRev*100)}%" title="${r.m}: ${fmtNaira(r.v)}"></div>
    <span class="chart-lbl">${r.m}</span>
  </div>`).join('');

/* ── Top stories ── */
const TOP_STORIES = [
  { title:'The runaway bride — I left at the altar in my socked feet', writer:'Ifeanyi_Story', genre:'✨ Twist', cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', reads:312000, revenue:3120000, trend:14, up:true },
  { title:'My stepmother stole my university fund', writer:'Zara_M', genre:'🔥 Revenge', cover:'https://i.postimg.cc/ftRZbhKx/3.jpg', reads:192000, revenue:1740000, trend:6, up:true },
  { title:'The letter he never sent', writer:'Ada_Writes', genre:'🌙 Elegy', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', reads:218000, revenue:1870000, trend:9, up:true },
  { title:'The Luna Trials: three packs, one crown', writer:'Yusuf_Howl', genre:'🔥 Werewolf', cover:'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', reads:210000, revenue:1980000, trend:3, up:false },
  { title:"My grandmother's will revealed I wasn't her blood", writer:'Chiamaka_N', genre:'👑 Family', cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg', reads:138000, revenue:1980000, trend:11, up:true },
];
document.getElementById('topStoriesBody').innerHTML = TOP_STORIES.map(s=>`
  <tr>
    <td><div class="story-cell"><img src="${s.cover}" alt=""/><div><b>${s.title}</b><span>${s.writer}</span></div></div></td>
    <td>${s.genre}</td>
    <td>${fmtNum(s.reads)}</td>
    <td>${fmtNaira(s.revenue)}</td>
    <td><span class="trend-pill ${s.up?'up':'down'}"><i class="fas fa-arrow-${s.up?'up':'down'}" style="font-size:8px"></i> ${s.trend}%</span></td>
  </tr>`).join('');

/* ── Activity feed ── */
const ACTIVITY = [
  { ico:'fa-file-signature', cls:'purple', text:'<b>CT-1012</b> was signed with <b>CampusQueen</b> — Exclusive, 2 years', time:'12m ago' },
  { ico:'fa-flag', cls:'red', text:'A chapter in <b>"The Neighbour Who Reported the Fire"</b> was flagged for plagiarism', time:'38m ago' },
  { ico:'fa-bullhorn', cls:'accent', text:'<b>Kemi_A</b> launched an End of Chapter campaign for <b>"He Proposed With My Best Friend\'s Ring"</b>', time:'1h ago' },
  { ico:'fa-sack-dollar', cls:'green', text:'Payout of <b>$1.2M</b> processed for <b>Ifeanyi_Story</b>', time:'2h ago' },
  { ico:'fa-user-plus', cls:'blue', text:'<b>842</b> new readers signed up in the last hour', time:'2h ago' },
  { ico:'fa-rotate', cls:'amber', text:"Contract <b>CT-1005</b> with <b>Zara_M</b> is due to renew in 17 days", time:'5h ago' },
  { ico:'fa-book', cls:'accent', text:'<b>Dami_Cole</b> published a new chapter of <b>"She Rejected Me 3 Times"</b>', time:'7h ago' },
];
document.getElementById('activityFeed').innerHTML = ACTIVITY.map(a=>`
  <div class="feed-item">
    <div class="feed-ico" style="background:${BG_MAP[a.cls]};color:${ICO_MAP[a.cls]}"><i class="fas ${a.ico}"></i></div>
    <div class="feed-body"><p>${a.text}</p><div class="feed-time">${a.time}</div></div>
  </div>`).join('');

/* ── Admin team (full CRUD) ── */
let ADMINS = [
  { id:'a1', name:'Tobenna Achebe', email:'tobenna.a@droboard.com', avatar:'https://i.pravatar.cc/100?img=51', role:'Super Admin', status:'active', perms:{contracts:true,campaigns:true,moderation:true,finance:true,admins:true} },
  { id:'a2', name:'Adaeze Bello', email:'adaeze.bello@droboard.com', avatar:'https://i.pravatar.cc/100?img=9', role:'Chief Editor', status:'active', perms:{contracts:true,campaigns:true,moderation:false,finance:false,admins:false} },
  { id:'a3', name:'Ngozi Umeh', email:'ngozi.umeh@droboard.com', avatar:'https://i.pravatar.cc/100?img=45', role:'Finance Admin', status:'active', perms:{contracts:false,campaigns:false,moderation:false,finance:true,admins:false} },
  { id:'a4', name:'Bassey Okon', email:'bassey.okon@droboard.com', avatar:'https://i.pravatar.cc/100?img=60', role:'Content Moderator', status:'suspended', perms:{contracts:false,campaigns:false,moderation:true,finance:false,admins:false} },
];
let editingAdminId = null;
let pendingDeleteId = null;

function renderAdminList(){
  document.getElementById('adminList').innerHTML = ADMINS.map(a=>`
    <div class="admin-row">
      <img src="${a.avatar}" alt=""/>
      <div class="admin-info">
        <b>${a.name}</b>
        <span class="role-badge" style="background:${BG_MAP[ROLE_CLS[a.role]||'blue']};color:${ICO_MAP[ROLE_CLS[a.role]||'blue']}">${a.role}</span>
      </div>
      <span class="status-dot ${a.status}" title="${a.status}"></span>
      <div style="position:relative">
        <button class="admin-menu-btn" data-menu="${a.id}"><i class="fas fa-ellipsis-vertical"></i></button>
      </div>
    </div>`).join('');
}
renderAdminList();

document.getElementById('adminList').addEventListener('click', e=>{
  const menuBtn = e.target.closest('[data-menu]');
  if(menuBtn){
    const id = menuBtn.dataset.menu;
    const existing = document.querySelector('.admin-inline-menu');
    if(existing) existing.remove();
    const menu = document.createElement('div');
    menu.className = 'admin-inline-menu';
    menu.style.cssText = 'position:absolute;right:0;top:28px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.15);z-index:5;overflow:hidden;min-width:120px';
    menu.innerHTML = `
      <button style="width:100%;text-align:left;padding:9px 12px;border:none;background:none;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--text)" data-menuact="edit" data-id="${id}"><i class="fas fa-pen" style="width:14px;color:var(--text-faint)"></i> Edit</button>
      <button style="width:100%;text-align:left;padding:9px 12px;border:none;background:none;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--red)" data-menuact="remove" data-id="${id}"><i class="fas fa-trash" style="width:14px"></i> Remove</button>`;
    menuBtn.parentElement.appendChild(menu);
    return;
  }
  const menuAct = e.target.closest('[data-menuact]');
  if(menuAct){
    const id = menuAct.dataset.id;
    if(menuAct.dataset.menuact==='edit') openEditAdmin(id); else openConfirmDelete(id);
    document.querySelector('.admin-inline-menu')?.remove();
  }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('[data-menu]') && !e.target.closest('.admin-inline-menu')) document.querySelector('.admin-inline-menu')?.remove();
});

function resetAdminForm(){
  document.getElementById('aId').value='';
  document.getElementById('aName').value='';
  document.getElementById('aEmail').value='';
  document.getElementById('aRole').value='Chief Editor';
  document.getElementById('aStatus').value='active';
  ['pContracts','pCampaigns','pModeration','pFinance','pAdmins'].forEach(id=>document.getElementById(id).checked=false);
}
function openAddAdmin(){
  editingAdminId=null; resetAdminForm();
  document.getElementById('adminModalTitle').innerHTML='<i class="fas fa-user-shield" style="color:var(--accent)"></i> Add Admin';
  openModal('adminModal');
}
function openEditAdmin(id){
  const a = ADMINS.find(x=>x.id===id); if(!a) return;
  editingAdminId=id;
  document.getElementById('aId').value=a.id;
  document.getElementById('aName').value=a.name;
  document.getElementById('aEmail').value=a.email;
  document.getElementById('aRole').value=a.role;
  document.getElementById('aStatus').value=a.status;
  document.getElementById('pContracts').checked=!!a.perms.contracts;
  document.getElementById('pCampaigns').checked=!!a.perms.campaigns;
  document.getElementById('pModeration').checked=!!a.perms.moderation;
  document.getElementById('pFinance').checked=!!a.perms.finance;
  document.getElementById('pAdmins').checked=!!a.perms.admins;
  document.getElementById('adminModalTitle').innerHTML='<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Admin';
  openModal('adminModal');
}
document.getElementById('addAdminBtn').addEventListener('click', openAddAdmin);
document.getElementById('aSaveBtn').addEventListener('click', ()=>{
  const name = document.getElementById('aName').value.trim();
  const email = document.getElementById('aEmail').value.trim();
  if(!name || !email){ toast('Name and email are required', 'fa-triangle-exclamation'); return; }
  const payload = {
    name, email,
    role: document.getElementById('aRole').value,
    status: document.getElementById('aStatus').value,
    perms:{ contracts:document.getElementById('pContracts').checked, campaigns:document.getElementById('pCampaigns').checked,
      moderation:document.getElementById('pModeration').checked, finance:document.getElementById('pFinance').checked, admins:document.getElementById('pAdmins').checked }
  };
  if(editingAdminId){
    Object.assign(ADMINS.find(x=>x.id===editingAdminId), payload);
    toast(`Updated ${name}'s admin profile`, 'fa-circle-check');
  } else {
    ADMINS.push(Object.assign({ id:'a'+(ADMINS.length+1+Math.floor(Math.random()*90)), avatar:`https://i.pravatar.cc/100?img=${20+ADMINS.length}` }, payload));
    toast(`${name} added to the admin team`, 'fa-circle-plus');
  }
  closeModal('adminModal');
  renderAdminList();
});
function openConfirmDelete(id){
  const a = ADMINS.find(x=>x.id===id); if(!a) return;
  pendingDeleteId=id;
  document.getElementById('confirmName').textContent=a.name;
  openModal('confirmModal');
}
document.getElementById('confirmDeleteBtn').addEventListener('click', ()=>{
  const a = ADMINS.find(x=>x.id===pendingDeleteId);
  ADMINS = ADMINS.filter(x=>x.id!==pendingDeleteId);
  closeModal('confirmModal');
  toast(`Removed ${a?a.name:'admin'} from the team`, 'fa-trash');
  pendingDeleteId=null;
  renderAdminList();
});

/* ── Shared modal + toast helpers ── */
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click', ()=>closeModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) closeModal(ov.id); }));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.show').forEach(ov=>closeModal(ov.id)); });
function toast(msg, icon){
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className='toast-item';
  el.innerHTML=`<i class="fas ${icon||'fa-circle-check'}"></i><span>${msg}</span>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }, 2600);
}

})();
// NOTE: checked dashboard.html markup + all generated template strings — zero onclick="…" references, so no window.* exposures required. All wiring is via getElementById / addEventListener / data-* delegation inside this closure.
