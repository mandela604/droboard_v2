/**
 * dashboard-service.js — Super Admin Dashboard
 * Live API only, no hardcoded demo data.
 */
(function(){
'use strict';

const API_BASE = '/api/super-admin';

const shell = SuperAdminSidebar.attach('#dashRoot',{
  activeItem:'dashboard', title:'Super Admin Dashboard', subtitle:'Platform-wide overview across users, revenue, content and the admin team',
  user:{name:'Tobenna Achebe',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=51'}, notifCount:9,
  searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const ROLE_CLS = { 'Super Admin':'accent', 'Chief Editor':'purple', 'Finance Admin':'green', 'Content Moderator':'red', 'Support Admin':'blue' };

function fmtNum(n){ return n>=1000000?(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'K':String(n||0); }
function fmtMoney(n){ if(window.DroboardCurrency && DroboardCurrency.ngnToMoney) return DroboardCurrency.ngnToMoney(n); return '₦'+fmtNum(n); }
function prose(t){ return (window.DroboardCurrency && DroboardCurrency.usdProse) ? DroboardCurrency.usdProse(t) : t; }

function showError(section, msg){
  const el = document.getElementById(section);
  if(el) el.innerHTML = `<div style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ${msg}</div>`;
}

async function callApi(path){
  const res = await fetch(API_BASE + path, { credentials:'include' });
  if(!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

/* ── KPI cards ── */
async function loadKpis(){
  try {
    const kpis = await callApi('/dashboard/kpis');
    document.getElementById('kpiGrid').innerHTML = kpis.map(k=>`
      <div class="kpi-card">
        <div class="kpi-top">
          <div class="kpi-ico" style="background:${BG_MAP[k.cls]||BG_MAP.blue};color:${ICO_MAP[k.cls]||ICO_MAP.blue}"><i class="fas ${k.ico}"></i></div>
          <span class="kpi-trend ${k.up?'up':'down'}"><i class="fas fa-arrow-${k.up?'up':'down'}" style="font-size:8px"></i> ${k.trend}</span>
        </div>
        <div class="kpi-num">${k.n}</div>
        <div class="kpi-lbl">${k.l}</div>
      </div>`).join('');
  } catch(e){
    showError('kpiGrid', 'Failed to load KPIs: ' + e.message);
  }
}

/* ── Revenue chart ── */
async function loadRevenue(){
  try {
    const revenue = await callApi('/dashboard/revenue');
    const maxRev = Math.max(...revenue.map(r=>r.v), 1);
    document.getElementById('revTotal').textContent = fmtMoney(maxRev);
    document.getElementById('chartWrap').innerHTML = revenue.map((r,i)=>`
      <div class="chart-col">
        <span class="chart-val">${fmtMoney(r.v)}</span>
        <div class="chart-bar ${i===revenue.length-1?'current':''}" style="height:${Math.max(10,r.v/maxRev*100)}%" title="${r.m}: ${fmtMoney(r.v)}"></div>
        <span class="chart-lbl">${r.m}</span>
      </div>`).join('');
  } catch(e){
    showError('chartWrap', 'Failed to load revenue: ' + e.message);
  }
}

/* ── Top stories ── */
async function loadTopStories(){
  try {
    const stories = await callApi('/dashboard/top-stories');
    document.getElementById('topStoriesBody').innerHTML = stories.map(s=>`
      <tr>
        <td><div class="story-cell"><img src="${s.cover}" alt=""/><div><b>${s.title}</b><span>${s.writer}</span></div></div></td>
        <td>${s.genre}</td>
        <td>${fmtNum(s.reads)}</td>
        <td>${fmtMoney(s.revenue)}</td>
        <td><span class="trend-pill ${s.up?'up':'down'}"><i class="fas fa-arrow-${s.up?'up':'down'}" style="font-size:8px"></i> ${s.trend}%</span></td>
      </tr>`).join('');
  } catch(e){
    showError('topStoriesBody', 'Failed to load top stories: ' + e.message);
  }
}

/* ── Activity feed ── */
async function loadActivity(){
  try {
    const activity = await callApi('/dashboard/activity');
    document.getElementById('activityFeed').innerHTML = activity.map(a=>`
      <div class="feed-item">
        <div class="feed-ico" style="background:${BG_MAP[a.cls]||BG_MAP.blue};color:${ICO_MAP[a.cls]||ICO_MAP.blue}"><i class="fas ${a.ico}"></i></div>
        <div class="feed-body"><p>${prose(a.text)}</p><div class="feed-time">${a.time}</div></div>
      </div>`).join('');
  } catch(e){
    showError('activityFeed', 'Failed to load activity: ' + e.message);
  }
}

/* ── Admin team (full CRUD) ── */
let ADMINS = [];
let editingAdminId = null;
let pendingDeleteId = null;

async function loadAdmins(){
  try {
    ADMINS = await callApi('/admins');
    renderAdminList();
  } catch(e){
    showError('adminList', 'Failed to load admins: ' + e.message);
  }
}

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

document.getElementById('adminList').addEventListener('click', e=>{
  const menuBtn = e.target.closest('[data-menu]');
  if(menuBtn){
    const id = menuBtn.dataset.menu;
    document.querySelector('.admin-inline-menu')?.remove();
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
  document.getElementById('pContracts').checked=!!(a.perms&&a.perms.contracts);
  document.getElementById('pCampaigns').checked=!!(a.perms&&a.perms.campaigns);
  document.getElementById('pModeration').checked=!!(a.perms&&a.perms.moderation);
  document.getElementById('pFinance').checked=!!(a.perms&&a.perms.finance);
  document.getElementById('pAdmins').checked=!!(a.perms&&a.perms.admins);
  document.getElementById('adminModalTitle').innerHTML='<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Admin';
  openModal('adminModal');
}

document.getElementById('addAdminBtn').addEventListener('click', openAddAdmin);
document.getElementById('aSaveBtn').addEventListener('click', async ()=>{
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
  try {
    if(editingAdminId){
      const res = await fetch(API_BASE+'/admins/'+editingAdminId, { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if(!res.ok) throw new Error('API error ' + res.status);
      toast(`Updated ${name}'s admin profile`, 'fa-circle-check');
    } else {
      const res = await fetch(API_BASE+'/admins', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if(!res.ok) throw new Error('API error ' + res.status);
      toast(`${name} added to the admin team`, 'fa-circle-plus');
    }
    closeModal('adminModal');
    loadAdmins();
  } catch(e){
    toast('Failed to save: ' + e.message, 'fa-triangle-exclamation');
  }
});

function openConfirmDelete(id){
  const a = ADMINS.find(x=>x.id===id); if(!a) return;
  pendingDeleteId=id;
  document.getElementById('confirmName').textContent=a.name;
  openModal('confirmModal');
}
document.getElementById('confirmDeleteBtn').addEventListener('click', async ()=>{
  const a = ADMINS.find(x=>x.id===pendingDeleteId);
  try {
    const res = await fetch(API_BASE+'/admins/'+pendingDeleteId, { method:'DELETE', credentials:'include' });
    if(!res.ok) throw new Error('API error ' + res.status);
    closeModal('confirmModal');
    toast(`Removed ${a?a.name:'admin'} from the team`, 'fa-trash');
    pendingDeleteId=null;
    loadAdmins();
  } catch(e){
    closeModal('confirmModal');
    toast('Failed to remove admin: ' + e.message, 'fa-triangle-exclamation');
  }
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

/* ── Boot ── */
loadKpis();
loadRevenue();
loadTopStories();
loadActivity();
loadAdmins();

})();
