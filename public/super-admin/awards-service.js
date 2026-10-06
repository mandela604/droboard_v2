/**
 * awards-service.js — Awards catalog + criteria + auto-grant engine
 * ────────────────────────────────────────────────────────────────────
 * Super Admin defines award types and their criteria.
 * Backend later evaluates criteria and populates user_awards.
 * Going live: swap USE_API=true, no HTML change.
 *
 * Data consumed by profile: window.AwardsEngine.grantedFor(handle)
 * Data shapes: contract is at the BOTTOM of this file.
 */
(function(){
'use strict';
if(window.__awardsService) return; window.__awardsService = true;

/* Demo-data self-load: page HTML no longer includes data/admin-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.AdminDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="data/admin-demo-data.js"><\/script>');
}

const USE_API = false;
const API_BASE = '/api/awards';

// ── Demo catalog ──
// criteria: { metric, op, value, genre?, period? }
// metric: 'reads' | 'books' | 'followers' | 'rating' | 'genre_rank'
// op: '>=' | 'top'  (top N in genre)
// period: '2025' | '2025-H2' | null (all-time)
const CATALOG = [
  { id:'aw_top_romance_2025', name:'Top Romance 2025', icon:'fa-crown', color:'gold',
    desc:'Top-ranked romance writers this season', status:'active',
    criteria:{ metric:'genre_rank', op:'top', value:10, genre:'romance', period:'2025' } },
  { id:'aw_1m_reads', name:'1M+ Reads', icon:'fa-fire', color:'red',
    desc:'One million cumulative reads', status:'active',
    criteria:{ metric:'reads', op:'>=', value:1000000 } },
  { id:'aw_verified_writer', name:'Verified Writer', icon:'fa-check-circle', color:'blue',
    desc:'Identity & manuscript review passed', status:'active',
    criteria:{ metric:'manual', op:'admin', value:0 } },
  { id:'aw_rising_star', name:'Rising Star', icon:'fa-star', color:'purple',
    desc:'Top 20 newcomers by growth in 60 days', status:'draft',
    criteria:{ metric:'growth', op:'top', value:20, period:'2025-H2' } },
  { id:'aw_100k_reads', name:'100K Reads', icon:'fa-bolt', color:'green',
    desc:'One hundred thousand reads', status:'active',
    criteria:{ metric:'reads', op:'>=', value:100000 } },
];

let catalog = JSON.parse(JSON.stringify(CATALOG));

// Seed user_awards auto-resolved from criteria against PLATFORM_USERS / demo stats
// Verified/medal holders also stored here so profile has one source of truth.
let userAwards = [
  { handle:'Ada_Writes', awardId:'aw_top_romance_2025', grantedAt:'2025-06-15' },
  { handle:'Ada_Writes', awardId:'aw_1m_reads', grantedAt:'2025-03-02' },
  { handle:'Ada_Writes', awardId:'aw_verified_writer', grantedAt:'2024-11-10' },
  { handle:'Ifeanyi_Story', awardId:'aw_1m_reads', grantedAt:'2025-01-20' },
  { handle:'Ifeanyi_Story', awardId:'aw_100k_reads', grantedAt:'2024-08-15' },
];

function loadFromDemo(){
  try{
    var D = window.AdminDemo || {};
    // catalog stays as-is for now; if backend later seeds it, it will override
    if(D.AWARDS_CATALOG && Array.isArray(D.AWARDS_CATALOG)) catalog = JSON.parse(JSON.stringify(D.AWARDS_CATALOG));
    if(D.USER_AWARDS && Array.isArray(D.USER_AWARDS)) userAwards = JSON.parse(JSON.stringify(D.USER_AWARDS));
  }catch(e){}
}
if(window.AdminDemo) loadFromDemo(); else window.addEventListener('DOMContentLoaded', function(){ loadFromDemo(); render(); });

function list(){ return catalog.slice(); }
function byId(id){ return catalog.find(function(a){ return a.id===id; }) || null; }
function awardsForHandle(handle){
  return userAwards.filter(function(r){ return r.handle===handle; }).map(function(r){
    var a = byId(r.awardId); if(!a) return null;
    return { id:a.id, name:a.name, icon:a.icon, color:a.color, desc:a.desc, grantedAt:r.grantedAt };
  }).filter(Boolean);
}
function stats(){
  return {
    total: catalog.length,
    active: catalog.filter(function(a){ return a.status==='active'; }).length,
    draft: catalog.filter(function(a){ return a.status==='draft'; }).length,
    auto: catalog.filter(function(a){ return a.criteria.metric!=='manual'; }).length,
    manual: catalog.filter(function(a){ return a.criteria.metric==='manual'; }).length,
  };
}
function createAward(payload){
  var id = 'aw_' + (payload.name||'award').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,24) + '_' + Date.now().toString(36);
  var rec = {
    id:id, name:payload.name||'New Award', icon:payload.icon||'fa-award', color:payload.color||'gold',
    desc:payload.desc||'', status:payload.status||'draft',
    criteria: payload.criteria || { metric:'reads', op:'>=', value:0 }
  };
  catalog.unshift(rec); return rec;
}
function updateAward(id, patch){
  var a = byId(id); if(!a) return null;
  if(patch.name!=null) a.name=patch.name;
  if(patch.icon!=null) a.icon=patch.icon;
  if(patch.color!=null) a.color=patch.color;
  if(patch.desc!=null) a.desc=patch.desc;
  if(patch.status!=null) a.status=patch.status;
  if(patch.criteria!=null) a.criteria=patch.criteria;
  return a;
}
function deleteAward(id){
  var idx = catalog.findIndex(function(a){ return a.id===id; }); if(idx<0) return false;
  catalog.splice(idx,1);
  userAwards = userAwards.filter(function(r){ return r.awardId!==id; });
  return true;
}
function grant(awardId, handle){
  if(!byId(awardId)) return false;
  if(userAwards.some(function(r){ return r.awardId===awardId && r.handle===handle; })) return false;
  userAwards.push({ handle:handle, awardId:awardId, grantedAt:new Date().toISOString().slice(0,10) });
  return true;
}
function revoke(awardId, handle){
  var n = userAwards.length;
  userAwards = userAwards.filter(function(r){ return !(r.awardId===awardId && r.handle===handle); });
  return userAwards.length!==n;
}
function holders(awardId){ return userAwards.filter(function(r){ return r.awardId===awardId; }).map(function(r){ return r.handle; }); }

// ── Auto-grant evaluator (demo) ──
// In production this runs as a backend cron. Here it is a pure function
// so the contract is explicit: criteria in, handles out.
function evaluateCriteria(criteria, users){
  // users: array of { handle, stats:{reads,books,followers,rating}, genreRanks? }
  // Returns array of handles that satisfy criteria.
  if(!criteria) return [];
  if(criteria.metric==='manual') return []; // never auto-grants
  if(criteria.metric==='reads'){
    var v = Number(criteria.value)||0;
    return (users||[]).filter(function(u){ return (u.stats && Number(u.stats.reads)||0) >= v; }).map(function(u){ return u.handle; });
  }
  if(criteria.metric==='genre_rank'){
    // demo: handled by caller that pre-sorted; here treat as reads-gte for simplicity
    var topN = Number(criteria.value)||10;
    var genre = criteria.genre;
    var sorted = (users||[]).filter(function(u){
      var gs = u.genres || u.topGenres || [];
      return !genre || gs.indexOf(genre)!==-1;
    }).sort(function(a,b){ return (Number(b.stats&&b.stats.reads)||0) - (Number(a.stats&&a.stats.reads)||0); });
    return sorted.slice(0, topN).map(function(u){ return u.handle; });
  }
  return [];
}
async function runAutoGrant(){
  // Demo re-resolve: clear auto-granted, re-evaluate. Manual grants are preserved.
  var autoIds = catalog.filter(function(a){ return a.criteria.metric!=='manual'; }).map(function(a){ return a.id; });
  userAwards = userAwards.filter(function(r){ return autoIds.indexOf(r.awardId)===-1; });
  var users = [];
  try{ users = (window.AdminDemo && window.AdminDemo.PLATFORM_USERS) ? window.AdminDemo.PLATFORM_USERS.map(function(u){
    return { handle:u.username||u.handle, stats:u.stats||{}, genres:u.genres||u.topGenres||[] };
  }) : []; }catch(e){}
  // fallback: seed known handles so page isn't empty before AdminDemo loads
  if(!users.length) users = [{handle:'Ada_Writes',stats:{reads:1200000},genres:['romance']},{handle:'Ifeanyi_Story',stats:{reads:980000},genres:['romance']}];
  catalog.filter(function(a){ return a.criteria.metric!=='manual' && a.status==='active'; }).forEach(function(a){
    var winners = evaluateCriteria(a.criteria, users);
    winners.forEach(function(h){
      if(!userAwards.some(function(r){ return r.handle===h && r.awardId===a.id; }))
        userAwards.push({ handle:h, awardId:a.id, grantedAt:new Date().toISOString().slice(0,10) });
    });
  });
  return userAwards.slice();
}

// Expose
window.AwardsService = { list:list, byId:byId, stats:stats, create:createAward, update:updateAward, remove:deleteAward, holders:holders, grant:grant, revoke:revoke, evaluate:evaluateCriteria, runAutoGrant:runAutoGrant };
window.AwardsEngine = { grantedFor:awardsForHandle, runAutoGrant:runAutoGrant };

/* ── API contract (when USE_API=true) ──
GET    /api/awards              -> Award[]
POST   /api/awards              body AwardPayload -> Award
PUT    /api/awards/:id          body Partial<AwardPayload>
DELETE /api/awards/:id
GET    /api/awards/user/:handle -> Award[]  (grantedFor)
POST   /api/awards/:id/grant    body { handle }
POST   /api/awards/:id/revoke   body { handle }
POST   /api/awards/run-auto-grant

AwardPayload: { name, icon, color, desc, status: 'active'|'draft'|'archived', criteria:{ metric, op, value, genre?, period? } }
Award: AwardPayload & { id }
UserAward: { handle, awardId, grantedAt: ISODate }
*/

/* ── DemoData extension (optional) ──
Add to super-admin/data/admin-demo-data.js:
  AWARDS_CATALOG: CATALOG,
  USER_AWARDS: userAwards,
so AdminDemo seeding can inject catalog if desired.
*/

})();

/* ═══════════════════════════════════════════════════════════════════
 * PAGE CONTROLLER — moved VERBATIM from awards.html inline <script> IIFE
 * Uses global AwardsService (stats/list/holders/byId/update/create/remove/runAutoGrant)
 * + SuperAdminSidebar.attach and renders cards/filter/wizard/preview/save/delete.
 * NO renames / NO refactors — behavior unchanged. IDs preserved.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const shell = SuperAdminSidebar.attach('#dashRoot',{
  activeItem:'awards', title:'Awards', subtitle:'Define awards and criteria — backend auto-grants from here',
  user:{ name:'Tobi Adenuga', role:'Super Admin', avatar:'https://i.pravatar.cc/100?img=68' }, notifCount:9
});
let editingId = null;
function statsCards(){
  const s = AwardsService.stats();
  document.getElementById('statGrid').innerHTML = ''
    + card(s.total, 'Total awards', 'fa-award', 'gold')
    + card(s.active, 'Active', 'fa-circle-check', 'green')
    + card(s.auto, 'Auto (criteria)', 'fa-bolt', 'purple')
    + card(s.manual, 'Manual', 'fa-hand', 'blue');
  function card(n,l,ico,cls){
    const iconBg = cls==='gold'?'var(--gold-bg)':cls==='green'?'var(--green-bg)':cls==='purple'?'var(--purple-bg)':'var(--blue-bg)';
    const iconColor = cls==='gold'?'var(--gold)':cls==='green'?'var(--green)':cls==='purple'?'var(--purple)':'var(--blue)';
    return `<div class="stat-card"><div class="stat-ico" style="background:${iconBg};color:${iconColor}"><i class="fas ${ico}"></i></div><div><div class="stat-num">${n}</div><div class="stat-lbl">${l}</div></div></div>`;
  }
}
function criteriaText(c){
  if(!c) return '—';
  if(c.metric==='manual') return 'Manual — no auto-grant';
  if(c.metric==='genre_rank') return `Top ${c.value} in ${c.genre||'any genre'}${c.period?' · '+c.period:''}`;
  if(c.metric==='reads') return `Reads ≥ ${Number(c.value).toLocaleString()}${c.period?' · '+c.period:''}`;
  return `${c.metric} ${c.op} ${c.value}`;
}
function filtered(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  const fs=document.getElementById('fStatus').value;
  const fk=document.getElementById('fKind').value;
  return AwardsService.list().filter(function(a){
    if(q && (a.name.toLowerCase().indexOf(q)===-1 && a.desc.toLowerCase().indexOf(q)===-1)) return false;
    if(fs!=='all' && a.status!==fs) return false;
    const kind = a.criteria.metric==='manual' ? 'manual' : 'auto';
    if(fk!=='all' && kind!==fk) return false;
    return true;
  });
}
function render(){
  statsCards();
  const items = filtered();
  document.getElementById('countChip').textContent = items.length + (items.length===1?' award':' awards');
  const el=document.getElementById('list');
  if(!items.length){ el.innerHTML='<div style="padding:28px;text-align:center;color:var(--text-faint);font-size:13px">No awards match.</div>'; return; }
  el.innerHTML = items.map(function(a){
    const holders = AwardsService.holders(a.id);
    const kind = a.criteria.metric==='manual' ? 'manual' : 'auto';
    const isHex = a.color && a.color.indexOf('#')===0;
    const icoStyle = isHex ? ' style="background:'+hexToSoft(a.color)+';color:'+a.color+';border-color:'+a.color+'"': '';
    const icoCls = isHex ? '' : ' '+a.color;
    return `<div class="aw-card" data-id="${a.id}">
      <div class="aw-ico${icoCls}"${icoStyle}><i class="fas ${a.icon}"></i></div>
      <div class="aw-main">
        <div class="aw-name">${esc(a.name)}</div>
        <div class="aw-desc">${esc(a.desc||'—')}</div>
        <div class="aw-criteria"><i class="fas fa-sliders" style="margin-right:4px"></i>${esc(criteriaText(a.criteria))} · <span class="badge ${kind}">${kind}</span></div>
      </div>
      <div class="aw-badges">
        <span class="badge ${a.status}">${esc(a.status)}</span>
        <span class="badge" style="background:var(--table-head);color:var(--text-muted)">${holders.length} holders</span>
      </div>
      <div class="aw-actions">
        <button class="editBtn" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="del delBtn" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('.aw-card').forEach(function(card){
    const id=card.getAttribute('data-id');
    card.querySelector('.editBtn').addEventListener('click', function(e){ e.stopPropagation(); openEdit(id); });
    card.querySelector('.delBtn').addEventListener('click', function(e){ e.stopPropagation(); onDelete(id); });
  });
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const ICONS = ['fa-award','fa-crown','fa-fire','fa-star','fa-bolt','fa-check-circle','fa-medal','fa-trophy','fa-heart','fa-gem','fa-feather','fa-book-open','fa-fire-flame-curved','fa-sparkles'];
const COLOR_MAP = { gold:'#d4a017', red:'#e0384d', blue:'#2f7de1', purple:'#5b4bcf', green:'#16a34a', pink:'#ff0050', orange:'#d97706' };
let pickedIcon='fa-award', pickedColor='#d4a017';
function iconFor(c){ return COLOR_MAP[c] || c || '#d4a017'; }
function renderIconGrid(){ const g=document.getElementById('iconGrid'); if(!g) return; g.innerHTML=ICONS.map(function(ic){ return '<button type="button" class="icon-opt'+(ic===pickedIcon?' on':'')+'" data-ic="'+ic+'"><i class="fas '+ic+'"></i></button>'; }).join(''); g.querySelectorAll('.icon-opt').forEach(function(b){ b.addEventListener('click', function(){ pickedIcon=b.getAttribute('data-ic'); renderIconGrid(); updatePreview(); }); }); }
function updatePreview(){
  const col=document.getElementById('fColor').value || pickedColor;
  const name=(document.getElementById('fName')?.value||'').trim() || 'Preview Award';
  const hexEl=document.getElementById('fColorHex'); if(hexEl) hexEl.textContent=col;
  const pv=document.getElementById('badgePreview');
  if(pv) pv.innerHTML='<div class="badge-preview-ico" style="background:'+hexToSoft(col)+';color:'+col+'"><i class="fas '+pickedIcon+'"></i></div><span class="badge-preview-chip" style="background:'+hexToSoft(col)+';color:'+col+';border:1px solid '+hexToSoft(col,0.22)+'"><i class="fas '+pickedIcon+'"></i> '+esc(name)+'</span> <span style="font-size:11px;color:var(--text-faint)">How it appears on profile</span>';
}
function hexToSoft(hex, a){ a=a||0.12; try{ hex=hex.replace('#',''); var r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); return 'rgba('+r+','+g+','+b+','+a+')'; }catch(e){ return hex; } }
function openNew(){
  editingId=null;
  document.getElementById('modalTitle').textContent='New award';
  document.getElementById('fName').value=''; document.getElementById('fDesc').value='';
  pickedIcon='fa-award'; pickedColor='#d4a017'; const ci=document.getElementById('fColor'); if(ci) ci.value=pickedColor;
  document.getElementById('fStatus2').value='draft';
  document.getElementById('fMetric').value='reads'; document.getElementById('fValue').value='';
  document.getElementById('fGenre').value=''; document.getElementById('fPeriod').value='';
  renderIconGrid(); updatePreview();
  document.getElementById('modalBg').classList.add('open');
}
function openEdit(id){
  const a=AwardsService.byId(id); if(!a) return;
  editingId=id;
  document.getElementById('modalTitle').textContent='Edit award';
  document.getElementById('fName').value=a.name; document.getElementById('fDesc').value=a.desc||'';
  pickedIcon=a.icon||'fa-award'; pickedColor = iconFor(a.color||'#d4a017');
  const ci=document.getElementById('fColor'); if(ci) ci.value=pickedColor;
  document.getElementById('fStatus2').value=a.status;
  document.getElementById('fMetric').value=a.criteria.metric||'reads';
  document.getElementById('fValue').value=a.criteria.value||'';
  document.getElementById('fGenre').value=a.criteria.genre||'';
  document.getElementById('fPeriod').value=a.criteria.period||'';
  renderIconGrid(); updatePreview();
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }
function collectCriteria(){
  const metric=document.getElementById('fMetric').value;
  if(metric==='manual') return { metric:'manual', op:'admin', value:0 };
  const v = document.getElementById('fValue').value;
  const gv = document.getElementById('fGenre').value;
  const pv = document.getElementById('fPeriod').value.trim();
  const c={ metric:metric, op:metric==='genre_rank'?'top':'>=', value: v?Number(v):0 };
  if(gv) c.genre=gv; if(pv) c.period=pv;
  return c;
}
function onSave(){
  const name=document.getElementById('fName').value.trim();
  if(!name){ toast('Name is required'); return; }
  const payload={
    name:name, desc:document.getElementById('fDesc').value.trim(),
    icon:pickedIcon, color:document.getElementById('fColor').value,
    status:document.getElementById('fStatus2').value, criteria:collectCriteria()
  };
  if(editingId) AwardsService.update(editingId, payload); else AwardsService.create(payload);
  closeModal(); render(); toast(editingId?'Award updated':'Award created');
}
async function onDelete(id){
  const a=AwardsService.byId(id); if(!a) return;
  if(!confirm(`Delete "${a.name}"? This also removes it from all holders.`)) return;
  AwardsService.remove(id); render(); toast('Award deleted');
}
document.getElementById('q').addEventListener('input', render);
document.getElementById('fColor').addEventListener('input', updatePreview);
document.getElementById('fName').addEventListener('input', updatePreview);
document.getElementById('fStatus').addEventListener('change', render);
document.getElementById('fKind').addEventListener('change', render);
document.getElementById('btnNew').addEventListener('click', openNew);
document.getElementById('btnRun').addEventListener('click', async function(){
  const btn=this; btn.disabled=true; const prev=btn.innerHTML; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Running…';
  await AwardsService.runAutoGrant(); render(); toast('Auto-grant evaluated');
  btn.disabled=false; btn.innerHTML=prev;
});
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancel').addEventListener('click', closeModal);
document.getElementById('btnSave').addEventListener('click', onSave);
document.getElementById('modalBg').addEventListener('click', function(e){ if(e.target===this) closeModal(); });
render();
})();
