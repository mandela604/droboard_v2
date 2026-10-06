(function(){
'use strict';

/* ── Backend-ready header (for future API use; demo paths keep working) ──
   NOTE: API_BASE is defined below (window.DROBOARD_API_BASE || '/api/senior-editor');
   USE_API/callBackend wrap future live calls while demo fallback paths keep working. */
const USE_API = false;
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor';
const PER_PAGE = 4;
let usingDemoData = false;

async function apiFetch(path, options){
  const res = await fetch(`${API_BASE}${path}`, {
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    ...options,
  });
  if(!res.ok){
    let msg = `Request failed (${res.status})`;
    try{ const body = await res.json(); if(body && body.message) msg = body.message; }catch(_){/* ignore */}
    throw new Error(msg);
  }
  return res.status===204 ? null : res.json();
}

/* ─────────────────────────────────────────
   DEMO FALLBACK DATA
───────────────────────────────────────── */
const todayISO = new Date().toISOString().slice(0,10);
function fmtDate(iso){ return new Date(iso+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }

const DEMO_ANNOUNCEMENTS = [
  { id:'ANN-001', title:'New Submission Guidelines', audience:'authors', content:'Updated guidelines for chapter submissions are now in effect. Minimum chapter length is now 2,000 words.', image:null, status:'published', createdDate:'2026-07-25', created:fmtDate('2026-07-25'), scheduledDate:null, scheduled:'' },
  { id:'ANN-002', title:'Platform Maintenance July 30', audience:'all', content:'The platform will be under maintenance on July 30 from 2-4 AM EST. No submissions will be accepted during this window.', image:'https://i.postimg.cc/N9jY0w4m/5.jpg', status:'published', createdDate:'2026-07-24', created:fmtDate('2026-07-24'), scheduledDate:null, scheduled:'' },
  { id:'ANN-003', title:'Writing Contest: Summer Romance', audience:'authors', content:'Submit your best romance chapters for a chance to win $5,000 and a featured placement!', image:'https://i.postimg.cc/tY7KnJyr/images.jpg', status:'scheduled', createdDate:'2026-07-22', created:fmtDate('2026-07-22'), scheduledDate:'2026-08-01', scheduled:fmtDate('2026-08-01') },
  { id:'ANN-004', title:'New Feature: Beta Reading', audience:'readers', content:'Readers can now sign up as beta readers for upcoming chapters. Opt in from your profile settings.', image:null, status:'draft', createdDate:'2026-07-20', created:fmtDate('2026-07-20'), scheduledDate:null, scheduled:'' },
  { id:'ANN-005', title:'Editor Spotlight: July Picks', audience:'readers', content:'Check out this month\'s editor-selected reads across every genre, hand-picked by our senior editorial team.', image:'https://i.postimg.cc/cgLZJNmC/8.jpg', status:'published', createdDate:'2026-07-10', created:fmtDate('2026-07-10'), scheduledDate:null, scheduled:'' },
  { id:'ANN-006', title:'Holiday Submission Freeze', audience:'authors', content:'No new chapter submissions will be accepted between Dec 24 and Jan 2 while the editorial team is off.', image:null, status:'scheduled', createdDate:'2026-07-15', created:fmtDate('2026-07-15'), scheduledDate:'2026-12-20', scheduled:fmtDate('2026-12-20') },
];

let ANNOUNCEMENTS = [];
let filtered = [];
let activeStatus = 'all';
let currentPg = 1;
let editingId = null;
let pendingImage = null; // data URL staged in the modal before save
let shell = null;
let schedTimer = null;
let wired = false;

/* ─────────────────────────────────────────
   LOAD
───────────────────────────────────────── */
async function loadAnnouncements(){
  try{
    const data = await apiFetch('/announcements');
    ANNOUNCEMENTS = Array.isArray(data) ? data : data.announcements;
    usingDemoData = false;
  }catch(err){
    console.warn('Announcements API unavailable, falling back to demo data:', err.message);
    ANNOUNCEMENTS = JSON.parse(JSON.stringify(DEMO_ANNOUNCEMENTS));
    usingDemoData = true;
  }
  checkScheduled(true);
  renderStats();
  buildFilterPills();
  applyFilters();
}

/* ─────────────────────────────────────────
   SCHEDULE CHECK — this is what makes
   "schedule" actually do something: any
   scheduled item whose date has arrived
   gets auto-published, same as a real
   backend cron would do.
───────────────────────────────────────── */
function checkScheduled(silent){
  const now = new Date();
  let changed = false;
  ANNOUNCEMENTS.forEach(a=>{
    if(a.status==='scheduled' && a.scheduledDate){
      const due = new Date(a.scheduledDate+'T00:00:00');
      if(due <= now){
        a.status = 'published';
        changed = true;
        if(!silent) toast(`📣 "${a.title}" just went live (scheduled time reached)`);
      }
    }
  });
  if(changed && !silent){ renderStats(); buildFilterPills(); applyFilters(); }
  return changed;
}

/* ─────────────────────────────────────────
   STATS
───────────────────────────────────────── */
function renderStats(){
  const published = ANNOUNCEMENTS.filter(a=>a.status==='published').length;
  const scheduled = ANNOUNCEMENTS.filter(a=>a.status==='scheduled').length;
  const draft = ANNOUNCEMENTS.filter(a=>a.status==='draft').length;
  const stats = [
    { n:ANNOUNCEMENTS.length, l:'Total Announcements', ico:'fa-bullhorn', cls:'accent', bg:'rgba(255,0,80,.1)' },
    { n:published, l:'Published', ico:'fa-circle-check', cls:'green', bg:'var(--green-bg)' },
    { n:scheduled, l:'Scheduled', ico:'fa-clock', cls:'blue', bg:'var(--blue-bg)' },
    { n:draft, l:'Drafts', ico:'fa-file-pen', cls:'amber', bg:'var(--amber-bg)' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${s.bg};color:var(--${s.cls})"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   FILTER PILLS (status)
───────────────────────────────────────── */
function buildFilterPills(){
  const statuses = ['all','published','scheduled','draft'];
  const counts = { all: ANNOUNCEMENTS.length };
  ANNOUNCEMENTS.forEach(a=>{ counts[a.status] = (counts[a.status]||0)+1; });

  document.getElementById('filterRow').innerHTML = statuses.map(st=>{
    const label = st==='all' ? 'All' : st.charAt(0).toUpperCase()+st.slice(1);
    return `<button class="filter-pill${st===activeStatus?' on':''}" data-status="${st}">${label}<span class="pill-count">${counts[st]||0}</span></button>`;
  }).join('');

  document.querySelectorAll('.filter-pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      activeStatus = p.dataset.status;
      currentPg = 1;
      document.querySelectorAll('.filter-pill').forEach(x=>x.classList.toggle('on', x===p));
      applyFilters();
    });
  });
}

/* ─────────────────────────────────────────
   FILTER + PAGINATION
───────────────────────────────────────── */
function audienceLabel(v){ return v==='all' ? 'Everyone' : v.charAt(0).toUpperCase()+v.slice(1); }

function applyFilters(){
  const q = document.getElementById('annSearch').value.trim().toLowerCase();
  const aud = document.getElementById('audienceFilter').value;

  filtered = ANNOUNCEMENTS.filter(a=>{
    const matchesSt = activeStatus==='all' || a.status===activeStatus;
    const matchesQ = !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    const matchesAud = !aud || a.audience===aud;
    return matchesSt && matchesQ && matchesAud;
  });

  // newest first
  filtered.sort((a,b)=> new Date(b.createdDate) - new Date(a.createdDate));

  const maxPg = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if(currentPg > maxPg) currentPg = maxPg;

  document.getElementById('annCount').textContent = `${filtered.length} of ${ANNOUNCEMENTS.length}`;
  renderPage();
}

function renderPage(){
  const start = (currentPg-1)*PER_PAGE;
  const page = filtered.slice(start, start+PER_PAGE);
  const box = document.getElementById('annList');

  if(!page.length){
    box.innerHTML = `<div class="empty-msg">No announcements match your search.</div>`;
    document.getElementById('pgn').innerHTML = '';
    return;
  }

  box.innerHTML = page.map(a=>`
    <div class="ann-card" data-id="${a.id}">
      <div class="ann-thumb-wrap">
        ${a.image ? `<img class="ann-thumb" src="${a.image}" alt="${a.title}"/>` : `<div class="ann-thumb-placeholder"><i class="fas fa-image"></i></div>`}
      </div>
      <div class="ann-body">
        <div class="ann-top">
          <div class="ann-title">${a.title} <span class="status-pill ${a.status}">${a.status}</span> <span class="audience-tag">${audienceLabel(a.audience)}</span></div>
        </div>
        <div class="ann-content">${a.content}</div>
        <div class="ann-meta">
          <span><i class="fas fa-calendar"></i> Created ${a.created}</span>
          ${a.scheduled ? `<span><i class="fas fa-clock"></i> Scheduled for ${a.scheduled}</span>` : ''}
        </div>
        <div class="ann-actions">
          ${a.status!=='published' ? `<button class="mini-btn primary" data-action="publish-now" data-id="${a.id}"><i class="fas fa-paper-plane"></i> Publish Now</button>` : ''}
          <button class="mini-btn" data-action="edit-ann" data-id="${a.id}"><i class="fas fa-pen"></i> Edit</button>
          <button class="mini-btn danger" data-action="delete-ann" data-id="${a.id}"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>`).join('');

  renderPagination();
}

function renderPagination(){
  const total = filtered.length;
  const maxPg = Math.ceil(total / PER_PAGE);
  if(maxPg <= 1){ document.getElementById('pgn').innerHTML = ''; return; }

  const start = (currentPg-1)*PER_PAGE+1;
  const end = Math.min(currentPg*PER_PAGE, total);
  let btns = '';
  for(let i=1;i<=maxPg;i++){
    if(maxPg>6 && i>2 && i<maxPg-1 && Math.abs(i-currentPg)>1){
      if(i===3 || i===maxPg-2) btns += `<span style="color:var(--text-faint);padding:0 3px;font-size:12px">…</span>`;
      continue;
    }
    btns += `<button class="pgn-btn${i===currentPg?' on':''}" data-pg="${i}">${i}</button>`;
  }

  document.getElementById('pgn').innerHTML = `
    <span class="pgn-info">Showing ${start}–${end} of ${total}</span>
    <div class="pgn-btns">
      <button class="pgn-btn" id="pgPrev"${currentPg===1?' disabled':''}><i class="fas fa-chevron-left" style="font-size:10px"></i></button>
      ${btns}
      <button class="pgn-btn" id="pgNext"${currentPg===maxPg?' disabled':''}><i class="fas fa-chevron-right" style="font-size:10px"></i></button>
    </div>`;

  document.getElementById('pgPrev').addEventListener('click', ()=>{ currentPg--; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); });
  document.getElementById('pgNext').addEventListener('click', ()=>{ currentPg++; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); });
  document.querySelectorAll('.pgn-btn[data-pg]').forEach(b=>{
    b.addEventListener('click', ()=>{ currentPg = parseInt(b.dataset.pg,10); renderPage(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
}

/* ─────────────────────────────────────────
   IMAGE FIELD (upload / preview / remove)
───────────────────────────────────────── */
function renderImageField(){
  const area = document.getElementById('imageFieldArea');
  if(pendingImage){
    area.innerHTML = `
      <div class="image-preview-wrap">
        <img src="${pendingImage}" alt="Announcement image preview"/>
        <button type="button" class="image-remove-btn" id="removeImageBtn"><i class="fas fa-xmark"></i></button>
      </div>`;
    document.getElementById('removeImageBtn').addEventListener('click', ()=>{ pendingImage = null; renderImageField(); });
  }else{
    area.innerHTML = `
      <label class="image-drop">
        <i class="fas fa-cloud-arrow-up"></i>
        <span>Click to upload an image (JPG, PNG — up to ~2MB)</span>
        <input type="file" accept="image/*" id="imageFileInput"/>
      </label>`;
    document.getElementById('imageFileInput').addEventListener('change', handleImageChange);
  }
}

function handleImageChange(e){
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('⚠️ Please choose an image file'); return; }
  if(file.size > 4*1024*1024){ toast('⚠️ Image is too large (max ~4MB)'); return; }
  const reader = new FileReader();
  reader.onload = ()=>{ pendingImage = reader.result; renderImageField(); };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────
   CREATE / EDIT MODAL
───────────────────────────────────────── */
let whenMode = 'now';

function openCreateModal(){
  editingId = null;
  document.getElementById('createModalTitle').textContent = 'New Announcement';
  document.getElementById('createModalSub').textContent = "Choose who sees it and whether it goes out now, later, or stays a draft.";
  document.getElementById('annTitleInput').value = '';
  document.getElementById('annAudienceInput').value = 'all';
  document.getElementById('annContentInput').value = '';
  document.getElementById('annScheduleInput').value = '';
  document.getElementById('annScheduleInput').min = todayISO;
  document.getElementById('createModalError').classList.remove('show');
  pendingImage = null;
  renderImageField();
  setWhenMode('now');
  document.getElementById('createConfirmBtn').innerHTML = '<i class="fas fa-paper-plane"></i> Save';
  document.getElementById('createModalOv').classList.add('open');
}

function openEditModal(id){
  const a = ANNOUNCEMENTS.find(x=>x.id===id); if(!a) return;
  editingId = id;
  document.getElementById('createModalTitle').textContent = 'Edit Announcement';
  document.getElementById('createModalSub').textContent = "Update the details below and save your changes.";
  document.getElementById('annTitleInput').value = a.title;
  document.getElementById('annAudienceInput').value = a.audience;
  document.getElementById('annContentInput').value = a.content;
  document.getElementById('annScheduleInput').value = a.scheduledDate || '';
  document.getElementById('annScheduleInput').min = todayISO;
  document.getElementById('createModalError').classList.remove('show');
  pendingImage = a.image || null;
  renderImageField();
  setWhenMode(a.status==='published' ? 'now' : a.status);
  document.getElementById('createConfirmBtn').innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
  document.getElementById('createModalOv').classList.add('open');
}

function closeCreateModal(){
  document.getElementById('createModalOv').classList.remove('open');
  editingId = null;
}

function setWhenMode(mode){
  whenMode = mode;
  document.querySelectorAll('#whenRadioRow .radio-opt').forEach(el=>{
    const active = el.dataset.when===mode;
    el.classList.toggle('active', active);
    el.querySelector('input').checked = active;
  });
  document.getElementById('scheduleDateGroup').style.display = mode==='schedule' ? 'block' : 'none';
}

async function submitCreate(){
  const title = document.getElementById('annTitleInput').value.trim();
  const audience = document.getElementById('annAudienceInput').value;
  const content = document.getElementById('annContentInput').value.trim();
  const scheduleDate = document.getElementById('annScheduleInput').value;
  const errBox = document.getElementById('createModalError');

  if(!title){ errBox.textContent = 'Please add a title.'; errBox.classList.add('show'); return; }
  if(!content){ errBox.textContent = 'Please add some content.'; errBox.classList.add('show'); return; }
  if(whenMode==='schedule' && !scheduleDate){ errBox.textContent = 'Pick a date to schedule this for.'; errBox.classList.add('show'); return; }
  if(whenMode==='schedule' && scheduleDate < todayISO){ errBox.textContent = 'Scheduled date must be today or later.'; errBox.classList.add('show'); return; }
  errBox.classList.remove('show');

  const status = whenMode==='now' ? 'published' : whenMode==='schedule' ? 'scheduled' : 'draft';
  const scheduledDate = whenMode==='schedule' ? scheduleDate : null;
  const scheduled = scheduledDate ? fmtDate(scheduledDate) : '';

  const btn = document.getElementById('createConfirmBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

  const payload = { title, audience, content, image: pendingImage, status, scheduledDate, scheduled };

  try{
    if(editingId){
      const a = ANNOUNCEMENTS.find(x=>x.id===editingId);
      try{
        if(!usingDemoData) await apiFetch(`/announcements/${editingId}`, { method:'PUT', body: JSON.stringify(payload) });
      }catch(_){/* demo mode / offline: apply locally anyway */}
      Object.assign(a, payload);
      toast(`✏️ "${a.title}" updated`);
    }else{
      let created = null;
      try{
        if(!usingDemoData){
          const result = await apiFetch('/announcements', { method:'POST', body: JSON.stringify(payload) });
          created = (result && result.item) ? result.item : result;
        }
      }catch(_){/* fall through to local create */}
      if(!created){
        created = Object.assign({
          id: 'ANN-' + String(ANNOUNCEMENTS.length+1).padStart(3,'0'),
          createdDate: todayISO,
          created: fmtDate(todayISO),
        }, payload);
      }
      ANNOUNCEMENTS.unshift(created);
      toast(status==='published' ? '📣 Announcement published' : status==='scheduled' ? '🗓️ Announcement scheduled' : '📝 Draft saved');
    }
    closeCreateModal();
    renderStats(); buildFilterPills(); applyFilters();
  }catch(err){
    errBox.textContent = 'Something went wrong. Please try again.';
    errBox.classList.add('show');
  }finally{
    btn.disabled = false;
    btn.innerHTML = editingId ? '<i class="fas fa-floppy-disk"></i> Save Changes' : '<i class="fas fa-paper-plane"></i> Save';
  }
}

/* ─────────────────────────────────────────
   ROW ACTIONS
───────────────────────────────────────── */
async function publishNow(id){
  const a = ANNOUNCEMENTS.find(x=>x.id===id); if(!a) return;
  try{ if(!usingDemoData) await apiFetch(`/announcements/${id}`, { method:'PUT', body: JSON.stringify({ status:'published' }) }); }catch(_){/* demo fallback */}
  a.status = 'published';
  a.scheduled = '';
  a.scheduledDate = null;
  toast(`📣 "${a.title}" published`);
  renderStats(); buildFilterPills(); applyFilters();
}

async function deleteAnnouncement(id){
  const a = ANNOUNCEMENTS.find(x=>x.id===id); if(!a) return;
  try{ if(!usingDemoData) await apiFetch(`/announcements/${id}`, { method:'DELETE' }); }catch(_){/* demo fallback */}
  ANNOUNCEMENTS = ANNOUNCEMENTS.filter(x=>x.id!==id);
  toast(`🗑️ "${a.title}" deleted`);
  renderStats(); buildFilterPills(); applyFilters();
}

/* ─────────────────────────────────────────
   EVENT DELEGATION
───────────────────────────────────────── */
function handleDocClick(e){
  const el = e.target.closest('[data-action]');
  if(!el){
    const whenOpt = e.target.closest('.radio-opt');
    if(whenOpt && whenOpt.closest('#whenRadioRow')) setWhenMode(whenOpt.dataset.when);
    return;
  }
  const action = el.dataset.action;
  const id = el.dataset.id;

  if(action==='open-create-modal') openCreateModal();
  else if(action==='close-create-modal') closeCreateModal();
  else if(action==='submit-create') submitCreate();
  else if(action==='publish-now') publishNow(id);
  else if(action==='edit-ann') openEditModal(id);
  else if(action==='delete-ann') deleteAnnouncement(id);
}

function wireEvents(){
  if (wired) return;
  wired = true;
  document.addEventListener('click', handleDocClick);
  document.getElementById('createModalOv').addEventListener('click', e=>{ if(e.target.id==='createModalOv') closeCreateModal(); });
  document.getElementById('annSearch').addEventListener('input', ()=>{ currentPg=1; applyFilters(); });
  document.getElementById('audienceFilter').addEventListener('change', ()=>{ currentPg=1; applyFilters(); });
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function init(){
  shell = SeniorEditorSidebar.attach('#annRoot',{
    activeItem:'announcements', title:'Announcements', subtitle:'Publish updates to authors and readers',
    user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'}, notifCount:4,
    searchPlaceholder:'Search announcements…',
    onSearch:(v)=>{ document.getElementById('annSearch').value = v; currentPg = 1; applyFilters(); }
  });
  wireEvents();
  if (!schedTimer) schedTimer = setInterval(()=>checkScheduled(false), 20000);
  return loadAnnouncements();
}

window.AnnouncementsService = { init };

})();
