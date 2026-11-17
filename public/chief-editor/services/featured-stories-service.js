/**
 * featured-stories-service.js — Featured Stories data + page controller.
 * Live API only, no demo fallbacks. The HTML calls FeaturedStoriesService.init().
 */
(function(){
'use strict';
if(window.__featuredStoriesService) return;
window.__featuredStoriesService = true;

const API_BASE = window.DROBOARD_API_BASE || '/api/chief/featured';
const CHIEF_BASE = window.DROBOARD_CHIEF_API_BASE || '/api/chief';
const TIMEOUT_MS = 8000;
let BOOK_DETAILS = {};   // bookId -> book (placements/history only carry ids)
let AUTHOR_NAMES = {};   // userId -> display name

function showError(msg) { console.error('Featured stories error:', msg); }

async function callApi(path, opts) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, { signal: c.signal, credentials:'include', ...opts });
    clearTimeout(t);
    if(!res.ok) {
      let detail=''; try { const j=await res.json(); detail=(j && (j.error||j.message))||''; } catch(e){}
      throw new Error(`API error ${res.status}${detail ? ' — '+detail : ''}`);
    }
    return await res.json();
  } catch(e) { clearTimeout(t); throw e; }
}

// GET /featured/tags returns a flat array of tag strings.
async function loadTags() {
  const data = await callApi('/tags');
  return Array.isArray(data) ? data.map(String) : [];
}
async function loadSections() {
  const data = await callApi('/sections');
  return Array.isArray(data) ? data : (data.items || []);
}
async function loadLibrary() {
  const data = await callApi('/library?limit=100');
  return Array.isArray(data) ? data : (data.items || []);
}
async function loadPlacements() {
  const data = await callApi('/placements?limit=100');
  return Array.isArray(data) ? data : (data.items || []);
}
async function loadHistory() {
  const data = await callApi('/history?limit=100');
  return Array.isArray(data) ? data : (data.items || []);
}

async function loadAll() {
  // Each branch keeps its own result on failure so one broken endpoint does
  // not hide the others — but nothing is faked.
  const [tags, sections, library, placements, history] = await Promise.allSettled([
    loadTags(), loadSections(), loadLibrary(), loadPlacements(), loadHistory(),
  ]);
  const value = (r) => r.status === 'fulfilled' ? r.value : [];
  if ([tags, sections, library, placements, history].some(r => r.status === 'rejected')) {
    showError('One or more featured-stories endpoints failed');
  }
  return { tags: value(tags), sections: value(sections), library: value(library), placements: value(placements), history: value(history) };
}

async function createPlacement(placement) {
  return callApi('/placements', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(placement) });
}
async function updatePlacement(id, patch) {
  return callApi(`/placements/${encodeURIComponent(id)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) });
}
async function deletePlacement(id) {
  await callApi(`/placements/${encodeURIComponent(id)}`, { method:'DELETE' });
  return true;
}
async function refeature(index) {
  return callApi(`/history/${encodeURIComponent(index)}/refeature`, { method:'POST' });
}
async function updateSection(id, patch) {
  return callApi(`/sections/${encodeURIComponent(id)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) });
}
async function updateLibraryItem(id, patch) {
  return callApi(`/library/${encodeURIComponent(id)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(patch) });
}

/* ═══════════════════════ PAGE CONTROLLER ═══════════════════════ */
let D = { tags:[], sections:[], library:[], placements:[], history:[] };
let TAB='featured', TAG='all', SECTION='all', PAGE=1;
const PER=10;
let FILTER_Q='';
let DETAIL=null;

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtN(n){ n=+n||0; return n>=1000 ? (n/1000).toFixed(1)+'k' : String(n); }
function toast(msg){
  const t=$('toastEl'); if(!t) return;
  t.textContent=msg; t.classList.add('show'); t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t); t._t=setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(16px)'; },2600);
}
function bookOf(id){
  const key=String(id||'');
  return BOOK_DETAILS[key] || (D.library||[]).find(function(b){ return String(b.id)===key || String(b.bookId)===key; }) || null;
}
// Placements and history rows carry only a bookId, and the featured library
// lists published books only — so look up the missing books (and their authors)
// from the chief's own read-only book endpoint.
async function loadBookDetails(){
  const ids=[];
  D.placements.concat(D.history).forEach(function(x){ if(x && x.bookId) ids.push(String(x.bookId)); });
  const missing=Array.from(new Set(ids)).filter(function(id){
    return !BOOK_DETAILS[id] && !(D.library||[]).some(function(b){ return String(b.id)===id; });
  });
  await Promise.all(missing.map(async function(id){
    try{
      const res=await fetch(CHIEF_BASE+'/books/'+encodeURIComponent(id),{credentials:'include'});
      BOOK_DETAILS[id]=res.ok?await res.json():null;
    }catch(e){ BOOK_DETAILS[id]=null; }
  }));
  const authorIds=[];
  D.placements.concat(D.history).forEach(function(x){
    const b=BOOK_DETAILS[String(x&&x.bookId)]||{};
    if(b.authorId) authorIds.push(String(b.authorId));
  });
  const unknownAuthors=Array.from(new Set(authorIds)).filter(function(id){ return !AUTHOR_NAMES[id]; });
  await Promise.all(unknownAuthors.map(async function(id){
    try{
      const res=await fetch('/api/users/'+encodeURIComponent(id),{credentials:'include'});
      if(res.ok){
        const j=await res.json(); const u=j.profile||j.user||j||{};
        AUTHOR_NAMES[id]=u.fullName||u.name||u.username||'';
      }
    }catch(e){}
  }));
}

function enrich(row){
  const id=row.bookId||row.id;
  const b=bookOf(id)||{};
  const authorId=String(b.authorId||'');
  return Object.assign({}, row, {
    id:id,
    title:b.title||row.title||'Untitled',
    author:AUTHOR_NAMES[authorId]||b.authorName||b.author||authorId||row.author||'',
    cover:b.cover||row.cover||'',
    genre:b.genre||row.genre||'',
    synopsis:b.synopsis||row.synopsis||'',
    reads:b.reads||0,
    rating:b.rating||0,
  });
}
function sectionTitle(key){
  const s=(D.sections||[]).find(function(x){ return String(x.key)===String(key); });
  return s ? (s.title||s.key) : (key||'Unassigned');
}
function daysLeft(row){
  if(!row.endAt) return { label:'No end date', cls:'' };
  const d=Math.ceil((new Date(row.endAt).getTime()-Date.now())/86400000);
  if(d<0) return { label:'Expired', cls:'over' };
  if(d<=3) return { label:d+'d left', cls:'soon' };
  return { label:d+'d left', cls:'ok' };
}
function relTime(v){
  if(!v) return '';
  const s=Math.max(1, Math.round((Date.now()-new Date(v).getTime())/1000));
  if(s<60) return s+'s ago';
  if(s<3600) return Math.round(s/60)+'m ago';
  if(s<86400) return Math.round(s/3600)+'h ago';
  return Math.round(s/86400)+'d ago';
}

function renderStats(){
  const soon=(D.placements||[]).filter(function(p){ const d=daysLeft(p); return d.cls==='soon'||d.cls==='over'; }).length;
  const cards=[
    { icon:'fa-star', color:'#ff0050', bg:'rgba(255,0,80,.1)', num:D.placements.length, label:'Live placements' },
    { icon:'fa-layer-group', color:'#8b5cf6', bg:'rgba(139,92,246,.1)', num:D.sections.length, label:'Discover sections' },
    { icon:'fa-book', color:'#0ea5e9', bg:'rgba(14,165,233,.1)', num:D.library.length, label:'Books in library' },
    { icon:'fa-clock', color:'#f59e0b', bg:'rgba(245,158,11,.1)', num:soon, label:'Ending soon' },
  ];
  const host=$('statCards'); if(!host) return;
  host.innerHTML=cards.map(function(c){
    return '<div class="stat-card"><div class="stat-ico" style="color:'+c.color+';background:'+c.bg+'"><i class="fas '+c.icon+'"></i></div>'+
      '<div><div class="stat-num">'+c.num+'</div><div class="stat-lbl">'+c.label+'</div></div></div>';
  }).join('');
}

function renderTabs(){
  const host=$('mainTabbar'); if(!host) return;
  const tabs=[
    { id:'featured', label:'Featured', icon:'fa-star', n:D.placements.length },
    { id:'add', label:'Add story', icon:'fa-plus', n:D.library.length },
    { id:'history', label:'History', icon:'fa-clock-rotate-left', n:D.history.length },
  ];
  host.innerHTML=tabs.map(function(t){
    return '<button class="main-tab'+(TAB===t.id?' on':'')+'" data-tab="'+t.id+'"><i class="fas '+t.icon+'"></i>'+t.label+'<span class="mtc">'+t.n+'</span></button>';
  }).join('');
  host.querySelectorAll('[data-tab]').forEach(function(b){ b.addEventListener('click',function(){ TAB=b.dataset.tab; PAGE=1; FILTER_Q=''; render(); }); });
}

function renderFilters(){
  const sec=$('sectionFilter');
  if(sec){
    const cur=SECTION;
    sec.innerHTML='<option value="all">All Discover Sections</option>'+
      (D.sections||[]).map(function(s){ return '<option value="'+esc(s.key)+'">'+esc(s.title||s.key)+'</option>'; }).join('');
    sec.value=cur;
    sec.onchange=function(){ SECTION=sec.value; PAGE=1; renderRows(); };
  }
  const tagBar=$('tagTabBar');
  if(tagBar){
    tagBar.style.display=TAB==='featured'?'flex':'none';
    const tags=['all'].concat(D.tags||[]);
    tagBar.innerHTML=tags.map(function(t){ return '<button class="tab-pill'+(TAG===t?' on':'')+'" data-tag="'+esc(t)+'">'+(t==='all'?'All tags':esc(t))+'</button>'; }).join('');
    tagBar.querySelectorAll('[data-tag]').forEach(function(b){ b.addEventListener('click',function(){ TAG=b.dataset.tag; PAGE=1; renderRows(); }); });
  }
  const addBar=$('addSearchBar'); if(addBar) addBar.style.display=TAB==='add'?'flex':'none';
  const histBar=$('histSearchBar'); if(histBar) histBar.style.display=TAB==='history'?'flex':'none';
  const search=$('librarySearch'), hist=$('historySearch');
  if(search){ search.value=FILTER_Q; search.oninput=function(){ FILTER_Q=this.value; PAGE=1; renderRows(); }; }
  if(hist){ hist.value=FILTER_Q; hist.oninput=function(){ FILTER_Q=this.value; PAGE=1; renderRows(); }; }
  const genre=$('libraryGenreFilter');
  if(genre){
    const cur=genre.value;
    const gs={}; (D.library||[]).forEach(function(b){ if(b.genre) gs[b.genre]=1; });
    genre.innerHTML='<option value="">All Genres</option>'+Object.keys(gs).sort().map(function(g){ return '<option value="'+esc(g)+'">'+esc(g)+'</option>'; }).join('');
    genre.value=cur;
    genre.onchange=function(){ PAGE=1; renderRows(); };
  }
}

function currentRows(){
  const q=FILTER_Q.trim().toLowerCase();
  if(TAB==='featured'){
    let rows=(D.placements||[]).slice();
    if(SECTION!=='all') rows=rows.filter(function(p){ return String(p.sectionKey)===String(SECTION); });
    if(TAG!=='all') rows=rows.filter(function(p){ return String(p.tag||'').toLowerCase()===String(TAG).toLowerCase(); });
    return rows.map(enrich);
  }
  if(TAB==='add'){
    let rows=(D.library||[]).slice();
    const g=$('libraryGenreFilter');
    if(g && g.value) rows=rows.filter(function(b){ return String(b.genre)===g.value; });
    if(q) rows=rows.filter(function(b){ return String(b.title||'').toLowerCase().indexOf(q)!==-1 || String(b.authorId||'').toLowerCase().indexOf(q)!==-1; });
    return rows.map(enrich);
  }
  let rows=(D.history||[]).slice();
  if(q) rows=rows.filter(function(x){ return String(x.section||'').toLowerCase().indexOf(q)!==-1 || String(x.bookId||'').toLowerCase().indexOf(q)!==-1; });
  return rows.map(enrich).map(function(r){ return Object.assign(r, { time:r.at, action:r.action||'' }); });
}

function renderRows(){
  const host=$('tableList'); if(!host) return;
  const rows=currentRows();
  const pages=Math.max(1, Math.ceil(rows.length/PER));
  if(PAGE>pages) PAGE=pages;
  const slice=rows.slice((PAGE-1)*PER, PAGE*PER);
  const count=$('tableCount'); if(count) count.textContent=rows.length+' '+(TAB==='featured'?'placements':TAB==='add'?'books':'entries');
  const sub=$('tableSub');
  if(sub) sub.textContent=TAB==='featured'
    ? 'Currently featured stories across Discover. Tap a row to open it and manage everything in one place.'
    : TAB==='add' ? 'Published books you can feature. Adding one creates a live placement.'
    : 'Past feature actions. Refeature puts a book back into its section.';

  if(!slice.length){
    const emptyMsg = TAB==='featured'
      ? 'No stories are featured yet. Open the <b>Add story</b> tab to put one on Discover.'
      : TAB==='add' ? 'No published books match this search.' : 'No past feature actions found.';
    host.innerHTML='<div class="empty-msg"><i class="fas fa-inbox"></i><br/>'+emptyMsg+
      (TAB==='featured'?'<br/><button class="main-tab on" id="emptyAddBtn" style="margin-top:14px"><i class="fas fa-plus"></i> Add story</button>':'')+'</div>';
    const addBtn=$('emptyAddBtn');
    if(addBtn) addBtn.addEventListener('click',function(){ TAB='add'; PAGE=1; FILTER_Q=''; render(); });
    renderPager(pages, rows.length); return;
  }
  host.innerHTML=slice.map(function(r, i){
    const dl=TAB==='featured'?daysLeft(r):null;
    const metaBits=[r.genre, TAB==='featured'?sectionTitle(r.sectionKey):(TAB==='history'?esc(r.action||''):''), fmtN(r.reads)+' reads'].filter(Boolean).join(' · ');
    let right='';
    if(TAB==='featured') right='<span class="days-badge '+(dl?dl.cls:'')+'">'+esc(dl?dl.label:'')+'</span>'+
      '<button class="row-quick-btn" data-act="remove" data-id="'+esc(r.id)+'" title="Remove placement"><i class="fas fa-xmark"></i></button>';
    else if(TAB==='add') right='<button class="row-quick-btn" data-act="add" data-id="'+esc(r.id)+'" title="Add to Discover"><i class="fas fa-plus"></i></button>';
    else right='<button class="row-quick-btn" data-act="refeature" data-id="'+esc(r.id)+'" title="Refeature"><i class="fas fa-rotate-left"></i></button>';
    return '<div class="row-item" data-row="'+((PAGE-1)*PER+i)+'">'+
      (r.cover?'<img class="row-cover" src="'+esc(r.cover)+'" alt=""/>':'<div class="row-cover" style="background:var(--hover)"></div>')+
      '<div class="row-main"><div class="row-title">'+esc(r.title)+'</div><div class="row-meta"><span>'+esc(r.author||'Unknown author')+'</span><span class="hide-sm">'+metaBits+'</span>'+
      (TAB==='history'?'<span>'+esc(relTime(r.time))+'</span>':'')+'</div></div>'+
      '<div class="row-tags">'+(r.tag?'<span class="row-badge-chip">'+esc(r.tag)+'</span>':'')+'</div>'+right+
      '<i class="fas fa-chevron-right row-chevron"></i></div>';
  }).join('');

  host.querySelectorAll('[data-row]').forEach(function(row){
    row.addEventListener('click',function(e){
      if(e.target.closest('[data-act]')) return;
      const r=currentRows()[parseInt(row.dataset.row,10)];
      if(r && TAB==='featured') openDetail(r);
      else if(r) location.href='/Pages/bridge.html?id='+encodeURIComponent(r.id);
    });
  });
  host.querySelectorAll('[data-act]').forEach(function(btn){
    btn.addEventListener('click',async function(e){
      e.stopPropagation();
      const id=btn.dataset.id;
      try{
        if(btn.dataset.act==='remove'){ await deletePlacement(id); toast('Placement removed'); }
        else if(btn.dataset.act==='add'){ await createPlacement({ storyId:id, section:SECTION!=='all'?SECTION:'hero-banner' }); toast('Story added to Discover'); }
        else if(btn.dataset.act==='refeature'){ await refeature(id); toast('Story refeatured'); }
        await reload();
      }catch(err){ toast(err.message||'Could not update — try again'); }
    });
  });
  renderPager(pages, rows.length);
}

function renderPager(pages, total){
  const nav=$('wizardNav'); if(!nav) return;
  if(total<=PER){ nav.innerHTML=''; return; }
  nav.innerHTML='<button class="wiz-btn" data-p="'+(PAGE-1)+'"'+(PAGE<=1?' disabled':'')+'><i class="fas fa-chevron-left"></i></button>'+
    '<span class="wiz-page-label">Page '+PAGE+' of '+pages+'</span>'+
    '<button class="wiz-btn" data-p="'+(PAGE+1)+'"'+(PAGE>=pages?' disabled':'')+'><i class="fas fa-chevron-right"></i></button>';
  nav.querySelectorAll('[data-p]').forEach(function(b){ b.addEventListener('click',function(){ PAGE=+b.dataset.p; renderRows(); }); });
}

function openDetail(r){
  DETAIL=r;
  const cover=$('sheetCover'), title=$('sheetTitle'), author=$('sheetAuthor'), body=$('sheetBody');
  if(!cover||!title||!author||!body) return;
  cover.src=r.cover||''; cover.style.display=r.cover?'block':'none';
  title.textContent=r.title||'Untitled';
  author.textContent=(r.author?('by '+r.author):'')+(r.genre?(' · '+r.genre):'');
  const opts=(D.sections||[]).map(function(s){ return '<option value="'+esc(s.key)+'"'+(String(s.key)===String(r.sectionKey)?' selected':'')+'>'+esc(s.title||s.key)+'</option>'; }).join('');
  const dl=daysLeft(r);
  body.innerHTML=
    '<div class="sheet-meta-grid">'+
      '<div class="sheet-meta-item"><b>'+fmtN(r.reads)+'</b><span>Reads</span></div>'+
      '<div class="sheet-meta-item"><b>'+(r.rating?r.rating:'—')+'</b><span>Rating</span></div>'+
      '<div class="sheet-meta-item"><b>'+esc(sectionTitle(r.sectionKey))+'</b><span>Section</span></div>'+
      '<div class="sheet-meta-item"><b>'+esc(dl.label)+'</b><span>Duration</span></div>'+
    '</div>'+
    '<div class="sheet-section-lbl">Synopsis</div><div class="sheet-synopsis">'+esc(r.synopsis||'No synopsis on this book yet.')+'</div>'+
    '<div class="sheet-section-lbl">Placement</div>'+
    '<div class="sheet-field"><label>Section</label><select id="dsSection">'+opts+'</select></div>'+
    '<div class="sheet-row-2">'+
      '<div class="sheet-field"><label>Label / tag</label><input id="dsTag" value="'+esc(r.tag||'')+'"/></div>'+
      '<div class="sheet-field"><label>Order</label><input id="dsOrder" type="number" value="'+(+r.order||0)+'"/></div>'+
    '</div>'+
    '<div class="sheet-row-2">'+
      '<div class="sheet-field"><label>Starts</label><input id="dsStart" type="date" value="'+esc(r.startAt?String(r.startAt).slice(0,10):'')+'"/></div>'+
      '<div class="sheet-field"><label>Ends (optional)</label><input id="dsEnd" type="date" value="'+esc(r.endAt?String(r.endAt).slice(0,10):'')+'"/></div>'+
    '</div>'+
    '<div class="feat-duration-line"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input id="dsActive" type="checkbox"'+(r.active!==false?' checked':'')+'/> Active</label></div>'+
    '<div class="sheet-config-actions">'+
      '<button class="mini-btn cancel" id="dsRemove" style="margin-right:auto;color:var(--red)">Remove</button>'+
      '<button class="mini-btn cancel" id="dsView">View on story page</button>'+
      '<button class="mini-btn save" id="dsSave">Save changes</button>'+
    '</div>';
  $('sheetBackdrop').classList.add('open');
  $('dsView').onclick=function(){ location.href='/Pages/bridge.html?id='+encodeURIComponent(r.id); };
  $('dsRemove').onclick=async function(){
    try{ await deletePlacement(r.id); closeDetail(); toast('Placement removed'); await reload(); }
    catch(e){ toast(e.message||'Could not remove'); }
  };
  $('dsSave').onclick=async function(){
    const patch={
      section:$('dsSection').value,
      tag:$('dsTag').value.trim(),
      order:+$('dsOrder').value||0,
      active:$('dsActive').checked,
      start:$('dsStart').value||undefined,
      end:$('dsEnd').value||null,
    };
    try{ await updatePlacement(r.id, patch); closeDetail(); toast('Placement saved'); await reload(); }
    catch(e){ toast(e.message||'Could not save'); }
  };
}
function closeDetail(){
  const o=$('sheetBackdrop'); if(o) o.classList.remove('open');
  DETAIL=null;
}

function render(){
  renderTabs(); renderFilters(); renderRows();
}
async function reload(){
  try{
    D=await loadAll();
    await loadBookDetails();
    renderStats(); render();
  }catch(e){
    const h=$('tableList');
    if(h) h.innerHTML='<div class="empty-msg"><i class="fas fa-triangle-exclamation"></i><br/>Could not load — '+esc(e.message)+'</div>';
  }
}

async function init(){
  const close=$('sheetClose'); if(close) close.addEventListener('click',closeDetail);
  const backdrop=$('sheetBackdrop');
  if(backdrop) backdrop.addEventListener('click',function(e){ if(e.target===backdrop) closeDetail(); });
  await reload();
}

window.FeaturedStoriesService = {
  init, loadAll, loadTags, loadSections, loadLibrary, loadPlacements, loadHistory,
  createPlacement, updatePlacement, deletePlacement, refeature, updateSection, updateLibraryItem,
};

})();
