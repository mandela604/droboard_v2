/**
 * dashboard-service.js — Super Admin Dashboard
 * Live API only. One aggregate call (GET /api/super-admin/dashboard/summary)
 * feeds every panel, so the KPI strip, chart, story table, activity feed and
 * Admin Team list can never disagree with each other.
 */
(function(){
'use strict';

const API_BASE = '/api/super-admin';

/* Signed-in identity comes from the session, never from a hardcoded demo row.
   AuthSession may not be loaded on this page, so read the same storage keys. */
function sessionUser(){
  try {
    if (window.AuthSession && AuthSession.getStoredUser) {
      const u = AuthSession.getStoredUser();
      if (u) return { name: u.name || u.fullName || u.username || 'Admin', role: 'Super Admin', avatar: u.avatar || '' };
    }
    const raw = localStorage.getItem('droboard_user');
    if (raw) {
      const u = JSON.parse(raw) || {};
      return { name: u.name || u.fullName || u.username || 'Admin', role: 'Super Admin', avatar: u.avatar || '' };
    }
  } catch(e) { /* storage blocked — fall through */ }
  return { name: 'Admin', role: 'Super Admin', avatar: '' };
}

const shell = SuperAdminSidebar.attach('#dashRoot',{
  activeItem:'dashboard', title:'Super Admin Dashboard', subtitle:'Platform-wide overview across users, revenue, content and the admin team',
  user: sessionUser(), searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };
const ROLE_CLS = { 'Super Admin':'accent', 'Chief Editor':'purple', 'Finance Admin':'green', 'Content Moderator':'red', 'Support Admin':'blue', Admin:'accent' };

function fmtNum(n){ n = Number(n)||0; return n>=1000000?(n/1000000).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'K':String(n); }
function fmtMoney(n){ if(window.DroboardCurrency && DroboardCurrency.ngnToMoney) return DroboardCurrency.ngnToMoney(n); return '₦'+fmtNum(n); }
function prose(t){ return (window.DroboardCurrency && DroboardCurrency.usdProse) ? DroboardCurrency.usdProse(t) : t; }
function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function showError(section, msg, retry){
  const el = document.getElementById(section);
  if(!el) return;
  el.innerHTML = `<div style="text-align:center;color:var(--red);padding:32px;font-size:12px">
    <i class="fas fa-circle-exclamation"></i> ${esc(msg)}
    ${retry ? '<div style="margin-top:10px"><button class="mini-btn ghost" data-retry><i class="fas fa-rotate"></i> Try again</button></div>' : ''}
  </div>`;
  if(retry) el.querySelector('[data-retry]').addEventListener('click', boot);
}
function emptyState(text){ return `<div style="text-align:center;color:var(--text-faint);padding:28px;font-size:12px">${esc(text)}</div>`; }

async function callApi(path, opts){
  const res = await fetch(API_BASE + path, Object.assign({ credentials:'include' }, opts || {}));
  if(!res.ok){
    let msg = 'API error ' + res.status;
    try { const b = await res.json(); if(b && b.error) msg = b.error; } catch(e) {}
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return res.json();
}

/* ── panels ── */
function renderKpis(kpis){
  const el = document.getElementById('kpiGrid');
  if(!kpis || !kpis.length){ el.innerHTML = emptyState('No metrics yet'); return; }
  el.innerHTML = kpis.map(k=>{
    const money = /revenue/i.test(k.l);
    return `<div class="kpi-card">
      <div class="kpi-top">
        <div class="kpi-ico" style="background:${BG_MAP[k.cls]||BG_MAP.blue};color:${ICO_MAP[k.cls]||ICO_MAP.blue}"><i class="fas ${esc(k.ico||'fa-chart-simple')}"></i></div>
        <span class="kpi-trend ${k.up?'up':'down'}"><i class="fas fa-arrow-${k.up?'up':'down'}" style="font-size:8px"></i> ${esc(k.trend||'0%')}</span>
      </div>
      <div class="kpi-num">${money ? fmtMoney(k.n) : fmtNum(k.n)}</div>
      <div class="kpi-lbl">${esc(k.l)}</div>
    </div>`;
  }).join('');
}

function renderRevenue(revenue){
  const wrap = document.getElementById('chartWrap');
  const totalEl = document.getElementById('revTotal');
  if(!revenue || !revenue.length){
    if(totalEl) totalEl.textContent = fmtMoney(0);
    wrap.innerHTML = emptyState('No revenue recorded yet');
    return;
  }
  const maxRev = Math.max(...revenue.map(r=>Number(r.v)||0), 1);
  const total = revenue.reduce((s,r)=>s+(Number(r.v)||0), 0);
  if(totalEl) totalEl.textContent = fmtMoney(total);
  wrap.innerHTML = revenue.map((r,i)=>`
    <div class="chart-col">
      <span class="chart-val">${fmtMoney(r.v)}</span>
      <div class="chart-bar ${i===revenue.length-1?'current':''}" style="height:${Math.max(2,(Number(r.v)||0)/maxRev*100)}%" title="${esc(r.m)}: ${fmtMoney(r.v)}"></div>
      <span class="chart-lbl">${esc(r.m)}</span>
    </div>`).join('');
}

function renderTopStories(stories){
  const el = document.getElementById('topStoriesBody');
  if(!stories || !stories.length){ el.innerHTML = `<tr><td colspan="5">${emptyState('No stories published yet')}</td></tr>`; return; }
  el.innerHTML = stories.map(s=>`
    <tr>
      <td><div class="story-cell">${s.cover?`<img src="${esc(s.cover)}" alt=""/>`:''}<div><b>${esc(s.title||'Untitled')}</b><span>${esc(s.writer||'—')}</span></div></div></td>
      <td>${esc(s.genre||'—')}</td>
      <td>${fmtNum(s.reads)}</td>
      <td>${fmtMoney(s.revenue)}</td>
      <td><span class="trend-pill ${s.up?'up':'down'}"><i class="fas fa-arrow-${s.up?'up':'down'}" style="font-size:8px"></i> ${Number(s.trend)||0}%</span></td>
    </tr>`).join('');
}

function renderActivity(activity){
  const el = document.getElementById('activityFeed');
  if(!activity || !activity.length){ el.innerHTML = emptyState('No activity yet'); return; }
  el.innerHTML = activity.map(a=>`
    <div class="feed-item">
      <div class="feed-ico" style="background:${BG_MAP[a.cls]||BG_MAP.blue};color:${ICO_MAP[a.cls]||ICO_MAP.blue}"><i class="fas ${esc(a.ico||'fa-circle-info')}"></i></div>
      <div class="feed-body"><p>${esc(prose(a.text))}</p><div class="feed-time">${esc(a.time||'')}</div></div>
    </div>`).join('');
}

let ADMINS = [];

function renderAdminList(){
  const el = document.getElementById('adminList');
  if(!ADMINS.length){ el.innerHTML = emptyState('No admins yet'); return; }
  el.innerHTML = ADMINS.map(a=>`
    <div class="admin-row">
      ${a.avatar?`<img src="${esc(a.avatar)}" alt=""/>`:'<div style="width:32px;height:32px;border-radius:50%;background:var(--accent-weak,rgba(255,0,80,.1));color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px"><i class="fas fa-user-shield"></i></div>'}
      <div class="admin-info">
        <b>${esc(a.name||'—')}</b>
        <span class="role-badge" style="background:${BG_MAP[ROLE_CLS[a.role]||'blue']};color:${ICO_MAP[ROLE_CLS[a.role]||'blue']}">${esc(a.role||'Admin')}</span>
      </div>
      <span class="status-dot ${esc(a.status||'active')}" title="${esc(a.status||'active')}"></span>
      <div style="position:relative">
        <button class="admin-menu-btn" data-menu="${esc(a.id)}"><i class="fas fa-ellipsis-vertical"></i></button>
      </div>
    </div>`).join('');
}

/* System health is what we can actually observe: the API answered, and the
   counts the aggregate returned. No invented uptime or error-rate numbers. */
function renderHealth(summary){
  const el = document.getElementById('sysHealth');
  if(!el) return;
  const kpi = {};
  (summary.kpiCards||[]).forEach(k=>{ kpi[k.l] = k.n; });
  el.innerHTML = `
    <div class="sh-row"><span>API</span><div class="sh-val"><span class="sh-dot ok"></span>Responding</div></div>
    <div class="sh-row"><span>Users</span><div class="sh-val">${fmtNum(kpi['Total Users']||0)}</div></div>
    <div class="sh-row"><span>Books</span><div class="sh-val">${fmtNum(kpi['Total Books']||0)}</div></div>
    <div class="sh-row"><span>Writers</span><div class="sh-val">${fmtNum(kpi['Total Writers']||0)}</div></div>
    <div class="sh-row"><span>Pending reports</span><div class="sh-val">${fmtNum(kpi['Pending Reports']||0)}</div></div>`;
}

async function loadAll(){
  let summary;
  try {
    summary = await callApi('/dashboard/summary');
  } catch(e){
    const msg = e.status === 401 || e.status === 403
      ? 'Your session expired — sign in again to view the dashboard.'
      : 'Failed to load the dashboard: ' + e.message;
    ['kpiGrid','chartWrap','topStoriesBody','activityFeed','adminList'].forEach(id=>showError(id, msg, true));
    const h = document.getElementById('sysHealth');
    if(h) h.innerHTML = emptyState('Unavailable');
    return;
  }
  renderKpis(summary.kpiCards);
  renderRevenue(summary.revenueChart);
  renderTopStories(summary.topStories);
  renderActivity(summary.activityLog);
  ADMINS = summary.adminTeam || [];
  renderAdminList();
  renderHealth(summary);
}

/* ── Admin Team menu ── */
document.getElementById('adminList').addEventListener('click', e=>{
  const menuBtn = e.target.closest('[data-menu]');
  if(menuBtn){
    const id = menuBtn.dataset.menu;
    document.querySelector('.admin-inline-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'admin-inline-menu';
    menu.style.cssText = 'position:absolute;right:0;top:28px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.15);z-index:5;overflow:hidden;min-width:120px';
    menu.innerHTML = `
      <button style="width:100%;text-align:left;padding:9px 12px;border:none;background:none;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--text)" data-menuact="edit" data-id="${esc(id)}"><i class="fas fa-pen" style="width:14px;color:var(--text-faint)"></i> Edit</button>
      <button style="width:100%;text-align:left;padding:9px 12px;border:none;background:none;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--red)" data-menuact="remove" data-id="${esc(id)}"><i class="fas fa-trash" style="width:14px"></i> Remove</button>`;
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

/* ── Add / edit admin modal ── */
let editingAdminId = null;
let pendingDeleteId = null;

function setPasswordRow(show){
  const row = document.getElementById('aPasswordRow');
  if(row) row.style.display = show ? '' : 'none';
  const input = document.getElementById('aPassword');
  if(input && !show) input.value = '';
}
function resetAdminForm(){
  document.getElementById('aId').value='';
  document.getElementById('aName').value='';
  document.getElementById('aEmail').value='';
  document.getElementById('aRole').value='Chief Editor';
  document.getElementById('aStatus').value='active';
  ['pContracts','pCampaigns','pModeration','pFinance','pAdmins'].forEach(id=>{ const c=document.getElementById(id); if(c) c.checked=false; });
}
function openAddAdmin(){
  editingAdminId=null; resetAdminForm(); setPasswordRow(true);
  document.getElementById('adminModalTitle').innerHTML='<i class="fas fa-user-shield" style="color:var(--accent)"></i> Add Admin';
  openModal('adminModal');
}
function openEditAdmin(id){
  const a = ADMINS.find(x=>String(x.id)===String(id)); if(!a) return;
  editingAdminId=id;
  document.getElementById('aId').value=a.id;
  document.getElementById('aName').value=a.name||'';
  document.getElementById('aEmail').value=a.email||'';
  document.getElementById('aRole').value=a.role||'Admin';
  document.getElementById('aStatus').value=(a.status==='suspended'||a.status==='banned')?'suspended':'active';
  ['Contracts','Campaigns','Moderation','Finance','Admins'].forEach(k=>{
    const c=document.getElementById('p'+k); if(c) c.checked=!!(a.perms && a.perms[k.toLowerCase()]);
  });
  setPasswordRow(false);
  document.getElementById('adminModalTitle').innerHTML='<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Admin';
  openModal('adminModal');
}

document.getElementById('addAdminBtn').addEventListener('click', openAddAdmin);
document.getElementById('aSaveBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('aName').value.trim();
  const email = document.getElementById('aEmail').value.trim();
  if(!name || !email){ toast('Name and email are required', 'fa-triangle-exclamation'); return; }
  const payload = { name, email, role: document.getElementById('aRole').value, status: document.getElementById('aStatus').value };
  try {
    if(editingAdminId){
      await callApi('/admins/'+encodeURIComponent(editingAdminId), { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      toast(`Updated ${name}'s admin profile`, 'fa-circle-check');
    } else {
      const password = document.getElementById('aPassword').value;
      if(password.length < 8){ toast('Set a temporary password of at least 8 characters', 'fa-triangle-exclamation'); return; }
      payload.password = password;
      await callApi('/admins', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      toast(`${name} added to the admin team`, 'fa-circle-plus');
    }
    closeModal('adminModal');
    loadAll();
  } catch(e){
    toast('Failed to save: ' + e.message, 'fa-triangle-exclamation');
  }
});

function openConfirmDelete(id){
  const a = ADMINS.find(x=>String(x.id)===String(id)); if(!a) return;
  pendingDeleteId=id;
  document.getElementById('confirmName').textContent=a.name||'this admin';
  openModal('confirmModal');
}
document.getElementById('confirmDeleteBtn').addEventListener('click', async ()=>{
  const a = ADMINS.find(x=>String(x.id)===String(pendingDeleteId));
  try {
    await callApi('/admins/'+encodeURIComponent(pendingDeleteId), { method:'DELETE' });
    closeModal('confirmModal');
    toast(`Removed ${a?a.name:'admin'} from the team`, 'fa-trash');
    pendingDeleteId=null;
    loadAll();
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
  el.innerHTML=`<i class="fas ${icon||'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }, 2600);
}

/* ── Boot ── */
function boot(){ loadAll(); }
boot();

})();
