/**
 * featured-stories-service.js — Data layer for Featured Stories page
 * Reads from window.EditorDemo.FEATURED_* demo data.
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__featuredStoriesService) return;
window.__featuredStoriesService = true;

/* Demo-data self-load: page HTML no longer includes ../data/editor-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.EditorDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="../data/editor-demo-data.js"><\/script>');
}

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/featured-stories';
var TIMEOUT_MS = 2500;

/* ── Backend-ready header (USE_API/callBackend added; existing API_BASE kept byte-identical) ── */
var USE_API = false;
async function callBackend(path, opts){
  if(!USE_API) return null;
  return timeoutFetch(API_BASE + path, opts);
}
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

function getTags(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_TAGS || {})); }
function getSections(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_SECTIONS || [])); }
function getLibrary(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_LIBRARY || [])); }
function getPlacements(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_PLACEMENTS || [])); }
function getHistory(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_HISTORY || [])); }

/* ── State stored in closure ── */
var _tags, _sections, _library, _placements, _history;
function loadFromDemo(){
  _tags = getTags();
  _sections = getSections();
  _library = getLibrary();
  _placements = getPlacements();
  _history = getHistory();
  _placements.forEach(function(f){
    if(typeof f.start === 'string') f.start = new Date(f.start);
    if(typeof f.end === 'string') f.end = new Date(f.end);
  });
}

/* ── Public API ── */
function loadAll(){
  return Promise.resolve().then(function(){
    return timeoutFetch(API_BASE);
  }).then(function(data){
    _tags = data.tags || {};
    _sections = data.sections || [];
    _library = data.library || [];
    _placements = data.placements || [];
    _history = data.history || [];
  }).catch(function(){
    loadFromDemo();
  });
}

function tags(){ return _tags; }
function sections(){ return _sections; }
function library(){ return _library; }
function placements(){ return _placements; }
function history(){ return _history; }

function byId(id){ return _library.find(function(s){ return s.id === id; }); }
function isFeatured(id){ return _placements.some(function(f){ return f.id === id; }); }

function placementOf(sectionId){ return _sections.find(function(s){ return s.id === sectionId; }) || {}; }

function featuredList(tag){
  if(!tag || tag === 'all') return _placements;
  return _placements.filter(function(f){ return f.tags.indexOf(tag) !== -1; });
}

function libraryList(query, genre){
  var q = (query||'').toLowerCase();
  var g = (genre||'');
  return _library.filter(function(s){
    var matchQ = !q || s.title.toLowerCase().indexOf(q) !== -1 || s.author.toLowerCase().indexOf(q) !== -1;
    var matchG = !g || s.genre === g;
    return matchQ && matchG;
  });
}

function historyList(query){
  var q = (query||'').toLowerCase();
  return _history.filter(function(h){
    return !q || h.title.toLowerCase().indexOf(q) !== -1 || h.author.toLowerCase().indexOf(q) !== -1;
  }).map(function(h){ return { h: h, i: _history.indexOf(h) }; });
}

function tabsPresent(){
  var tags = [];
  _placements.forEach(function(f){
    f.tags.forEach(function(t){
      if(t !== 'featured' && tags.indexOf(t) === -1) tags.push(t);
    });
  });
  return tags;
}

function stats(){
  var active = _placements.length;
  var heroes = _placements.filter(function(f){ return f.placement.section === 'hero-banner'; }).length;
  var genres = new Set();
  _placements.forEach(function(f){
    var s = byId(f.id);
    if(s) genres.add(s.genre);
  });
  var avgDays = 0;
  if(active){
    var total = _placements.reduce(function(sum,f){
      var start = new Date(f.start); var end = new Date(f.end);
      return sum + Math.ceil((end - start) / 86400000);
    }, 0);
    avgDays = Math.round(total / active);
  }
  return { active: active, heroes: heroes, genres: genres.size, avgDays: avgDays };
}

function addFeature(storyId, section, sub, start, end, tagsArr, note){
  if(!byId(storyId)) throw new Error('Story not found');
  var s = typeof start === 'string' ? new Date(start) : start;
  var e = typeof end === 'string' ? new Date(end) : end;
  var entry = { id: storyId, placement: { section: section, sub: sub }, tags: tagsArr, start: s, end: e, note: note||'' };
  _placements.push(entry);
  return entry;
}

function removeFeature(storyId){
  var idx = _placements.findIndex(function(f){ return f.id === storyId; });
  if(idx === -1) return null;
  var removed = _placements.splice(idx, 1)[0];
  var s = byId(storyId);
  if(s){
    _history.unshift({
      title: s.title, author: s.author, cover: s.cover, genre: s.genre, rating: s.rating,
      placement: removed.placement,
      tags: removed.tags.filter(function(t){ return t !== 'featured'; }),
      period: fmtDate(new Date(removed.start)) + ' – ' + fmtDate(new Date())
    });
  }
  return removed;
}

function updatePlacement(storyId, changes){
  var f = _placements.find(function(x){ return x.id === storyId; });
  if(!f) return null;
  if(changes.tags) f.tags = changes.tags;
  if(changes.section) f.placement.section = changes.section;
  if(changes.sub !== undefined) f.placement.sub = changes.sub;
  if(changes.start) f.start = changes.start;
  if(changes.end) f.end = changes.end;
  if(changes.note !== undefined) f.note = changes.note;
  return f;
}

function fmtDate(d){
  if(typeof d === 'string') d = new Date(d);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

loadFromDemo();

window.__featuredStoriesAPI = {
  loadAll: loadAll,
  tags: tags,
  sections: sections,
  library: library,
  placements: placements,
  history: history,
  byId: byId,
  isFeatured: isFeatured,
  placementOf: placementOf,
  featuredList: featuredList,
  libraryList: libraryList,
  historyList: historyList,
  tabsPresent: tabsPresent,
  stats: stats,
  addFeature: addFeature,
  removeFeature: removeFeature,
  updatePlacement: updatePlacement,
  fmtDate: fmtDate
};

/* ═══ Page UI layer (migrated from featured-stories.html inline script; collisions renamed byId->byIdUI, fmtDate->fmtDateUI) ═══ */
var _fsInitDone = false;
function init(){
  if(_fsInitDone) return;
  _fsInitDone = true;

'use strict';

const shell = SeniorEditorSidebar.attach('#fsRoot', {
  activeItem: 'featured-stories',
  title: 'Featured Stories',
  subtitle: "Discover placements & editor's picks",
  user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
  notifCount: 4,
  onSearch: function(v){ /* main table has its own search bars per tab; top search left as global quick-jump */ }
});

function toast(m){
  const t=document.getElementById('toastEl');
  t.textContent=m;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},2400);
}

/* ─────────────────────────────────────────
   DATA — loaded from service (central demo data)
───────────────────────────────────────── */
const API = window.__featuredStoriesAPI;
const TAGS = API.tags();
const SECTIONS = API.sections();
let LIBRARY = API.library();
let FEATURED = API.placements();
let HISTORY = API.history();
function sectionOf(id){ return SECTIONS.find(s=>s.id===id); }
function placementLabel(p){
  if(!p) return '—';
  const sec = sectionOf(p.section); if(!sec) return '—';
  return (sec.needsSub && p.sub) ? `${sec.label} — ${p.sub}` : sec.label;
}
function placementIcon(p){ const sec=sectionOf(p&&p.section); return sec?sec.icon:'📍'; }
function sectionOptionsHtml(selectedId){ return SECTIONS.map(s=>`<option value="${s.id}"${s.id===selectedId?' selected':''}>${s.icon} ${s.label}</option>`).join(''); }
function subOptionsHtml(sectionId, selectedSub){ const sec=sectionOf(sectionId); if(!sec||!sec.needsSub) return ''; return sec.subOptions.map(o=>`<option value="${o}"${o===selectedSub?' selected':''}>${o}</option>`).join(''); }
function byIdUI(id){ return LIBRARY.find(s=>s.id===id); }
function findLibraryMatch(title,author){ return LIBRARY.find(s=>s.title===title && s.author===author); }

let mainTab = 'featured';   // 'featured' | 'add' | 'history'  — never defaults to history
let activeTag = 'all';      // secondary filter for featured tab
let activeFilter = 'all';   // 'all' | 'active' — filter by active status
let sectionFilter = 'all';  // section dropdown filter
let pages = { featured:1, add:1, history:1 };

/* Sheet state — the ONE place all editing happens */
let sheetStoryId = null;
let sheetHistIdx = null;
let sheetMode = null;       // 'featured' | 'add'
let sheetTagPickerOpen = false;
let sheetDurationEditOpen = false;
let sheetAddConfigOpen = false;
let sheetAddTags = [];
let sheetCfgPlacement = { section:'hero-banner', sub:null };

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fmtDateUI(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function toInputDate(d){ return d.toISOString().slice(0,10); }
function daysLeft(end){ return Math.ceil((end-new Date())/86400000); }
function daysBadgeHtml(end){
  const dl = daysLeft(end);
  if(dl<0) return `<span class="days-badge over">Ended</span>`;
  if(dl<=3) return `<span class="days-badge soon">${dl}d left</span>`;
  return `<span class="days-badge ok">${dl}d left</span>`;
}
function tagChip(tag, removable, action){
  const t = TAGS[tag]; if(!t) return '';
  return `<span class="tag-chip" style="background:${t.bg};color:${t.fg}">${t.label}${removable?`<button data-action="${action}" data-tag="${tag}"><i class="fas fa-xmark"></i></button>`:''}</span>`;
}
function tagPickerHtml(currentTags, action){
  return Object.keys(TAGS).map(k=>{
    const active = currentTags.includes(k);
    return `<span class="tag-opt${active?' active':''}" data-action="${action}" data-tag="${k}">${TAGS[k].label}</span>`;
  }).join('');
}
function getPageSize(){ return window.innerWidth < 640 ? 4 : 5; }
function storyHistoryFor(title, author, excludeIdx){
  return HISTORY.map((h,i)=>({...h,idx:i})).filter(h=>h.title===title && h.author===author && h.idx!==excludeIdx);
}

/* ─────────────────────────────────────────
   STATS
───────────────────────────────────────── */
function renderStats(){
  const pickCount = FEATURED.filter(f=>f.tags.includes('editors-pick')).length;
  const endingSoon = FEATURED.filter(f=>daysLeft(f.end)<=3 && daysLeft(f.end)>=0).length;
  const stats = [
    { n:FEATURED.length, l:'Active Placements', ico:'fa-star', cls:'amber' },
    { n:pickCount, l:"Editor's Picks Live", ico:'fa-award', cls:'purple' },
    { n:endingSoon, l:'Ending This Week', ico:'fa-hourglass-half', cls:'red' },
    { n:LIBRARY.length, l:'Stories In Your Library', ico:'fa-book', cls:'blue' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:var(--${s.cls}-bg);color:var(--${s.cls})"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   MAIN TABS (Featured / Add / History — ONE table)
───────────────────────────────────────── */
function renderMainTabs(){
  const featuredCount = sectionFilter && sectionFilter!=='all' ? FEATURED.filter(f=>f.placement.section===sectionFilter).length : FEATURED.length;
  const tabs = [
    { key:'featured', label:'Featured', icon:'fa-star', count:featuredCount },
    { key:'add',      label:'Add a Story', icon:'fa-magnifying-glass', count:LIBRARY.length },
    { key:'history',  label:'History', icon:'fa-clock-rotate-left', count:HISTORY.length },
  ];
  document.getElementById('mainTabbar').innerHTML = tabs.map(t=>`
    <button class="main-tab${mainTab===t.key?' on':''}" data-action="set-main-tab" data-tab="${t.key}">
      <i class="fas ${t.icon}"></i> ${t.label} <span class="mtc">${t.count}</span>
    </button>`).join('');

  document.getElementById('tagTabBar').style.display = mainTab==='featured' ? 'flex' : 'none';
  document.getElementById('addSearchBar').style.display = mainTab==='add' ? 'flex' : 'none';
  document.getElementById('histSearchBar').style.display = mainTab==='history' ? 'flex' : 'none';

  const subCopy = {
    featured: "Currently live across Discover. Filter by tag below, or tap a row to manage it.",
    add: "Search your assigned library, then tap a story to configure and feature it.",
    history: "Past placements — tap one to review it and re-feature if you'd like.",
  };
  document.getElementById('tableSub').textContent = subCopy[mainTab];
}

/* ─────────────────────────────────────────
   FEATURED TAG FILTER
───────────────────────────────────────── */
function getTabsPresent(){
  const set = new Set();
  FEATURED.forEach(f=>f.tags.forEach(t=>{ if(t!=='featured') set.add(t); }));
  return Object.keys(TAGS).filter(t=>t!=='featured' && set.has(t));
}
function renderTagTabs(){
  const tabs = [{key:'all',label:'⭐ All Featured'}, {key:'active',label:'🟢 Active'}, ...getTabsPresent().map(t=>({key:t,label:TAGS[t].label}))];
  if(!tabs.find(t=>t.key===activeTag)) activeTag='all';
  const base = sectionFilter && sectionFilter!=='all' ? FEATURED.filter(f=>f.placement.section===sectionFilter) : FEATURED;
  document.getElementById('tagTabBar').innerHTML = tabs.map(t=>{
    const count = t.key==='all' ? base.length : t.key==='active' ? base.filter(f=>daysLeft(f.end)>=0).length : base.filter(f=>f.tags.includes(t.key)).length;
    return `<button class="tab-pill${activeTag===t.key?' on':''}" data-action="set-tag-tab" data-tag="${t.key}">${t.label} <span style="opacity:.7">${count}</span></button>`;
  }).join('');
}

/* ─────────────────────────────────────────
   ROW BUILDERS
───────────────────────────────────────── */
function featuredRow(f){
  const s = byIdUI(f.id); if(!s) return '';
  const visibleTags = f.tags.filter(t=>t!=='featured').slice(0,2);
  return `
  <div class="row-item" data-action="open-detail" data-id="${s.id}">
    <img class="row-cover" src="${s.cover}" alt="${s.title} cover"/>
    <div class="row-main">
      <div class="row-title">${s.title}</div>
      <div class="row-meta">
        <span>✍️ ${s.author}</span>
        <span class="hide-sm">${placementIcon(f.placement)} ${placementLabel(f.placement)}</span>
        ${daysBadgeHtml(f.end)}
      </div>
    </div>
    <div class="row-tags">${visibleTags.map(t=>tagChip(t,false)).join('')}</div>
    <button class="row-quick-btn" data-action="quick-remove" data-id="${f.id}" title="Unfeature"><i class="fas fa-xmark"></i></button>
    <i class="fas fa-chevron-right row-chevron"></i>
  </div>`;
}
function libraryRow(s){
  const isFeatured = FEATURED.some(f=>f.id===s.id);
  return `
  <div class="row-item" data-action="open-detail" data-id="${s.id}">
    <img class="row-cover" src="${s.cover}" alt="${s.title} cover"/>
    <div class="row-main">
      <div class="row-title">${s.title}</div>
      <div class="row-meta"><span>✍️ ${s.author}</span><span class="hide-sm">${s.genre}</span><span><i class="fas fa-star" style="color:#ffd166"></i> ${s.rating}</span></div>
    </div>
    ${isFeatured ? `<span class="row-badge-chip"><i class="fas fa-check"></i> Featured</span>` : ''}
    <i class="fas fa-chevron-right row-chevron"></i>
  </div>`;
}
function historyRow(h,i){
  return `
  <div class="row-item" data-action="open-detail" data-histidx="${i}">
    <img class="row-cover" src="${h.cover}" alt="${h.title} cover"/>
    <div class="row-main">
      <div class="row-title">${h.title}</div>
      <div class="row-meta"><span>✍️ ${h.author}</span><span class="hide-sm">${placementIcon(h.placement)} ${placementLabel(h.placement)}</span><span>📅 ${h.period}</span></div>
    </div>
    <div class="row-tags">${(h.tags||[]).slice(0,1).map(t=>tagChip(t,false)).join('')}</div>
    <i class="fas fa-chevron-right row-chevron"></i>
  </div>`;
}

/* ─────────────────────────────────────────
   UNIFIED TABLE RENDER (with its own pagination per tab)
───────────────────────────────────────── */
function getFeaturedList(){
  let list = activeTag==='all' ? FEATURED : activeTag==='active' ? FEATURED.filter(f=>daysLeft(f.end)>=0) : FEATURED.filter(f=>f.tags.includes(activeTag));
  if(sectionFilter && sectionFilter!=='all') list = list.filter(f=>f.placement.section===sectionFilter);
  return list;
}
function getLibraryList(){
  const q = (document.getElementById('librarySearch').value||'').trim().toLowerCase();
  const g = document.getElementById('libraryGenreFilter').value;
  return LIBRARY.filter(s=>{
    const matchesQ = !q || s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q);
    const matchesG = !g || s.genre===g;
    return matchesQ && matchesG;
  });
}
function getHistoryList(){
  const q = (document.getElementById('historySearch').value||'').trim().toLowerCase();
  return HISTORY.filter((h,i)=>!q || h.title.toLowerCase().includes(q) || h.author.toLowerCase().includes(q))
                .map((h)=>({h,i:HISTORY.indexOf(h)}));
}

function renderTable(){
  renderMainTabs();
  if(mainTab==='featured') renderTagTabs();

  let list, rowFn, emptyText, countLabel;
  if(mainTab==='featured'){
    list = getFeaturedList(); rowFn = featuredRow;
    emptyText = 'No stories match this filter yet.';
    const filtered = sectionFilter && sectionFilter!=='all' ? FEATURED.filter(f=>f.placement.section===sectionFilter).length : FEATURED.length;
    countLabel = sectionFilter && sectionFilter!=='all'
      ? `${filtered} of ${FEATURED.length} in ${sectionOf(sectionFilter).label}`
      : `${FEATURED.length} ${FEATURED.length===1?'story':'stories'} live`;
  } else if(mainTab==='add'){
    list = getLibraryList(); rowFn = libraryRow;
    emptyText = 'No stories match your search.';
    countLabel = `${LIBRARY.length} in library`;
  } else {
    const wrapped = getHistoryList(); list = wrapped;
    rowFn = (item)=>historyRow(item.h,item.i);
    emptyText = 'No past placements match your search.';
    countLabel = `${HISTORY.length} past`;
  }
  document.getElementById('tableCount').textContent = countLabel;

  const pageSize = getPageSize();
  const totalPages = Math.max(1, Math.ceil(list.length/pageSize));
  if(pages[mainTab]>totalPages) pages[mainTab]=totalPages;
  if(pages[mainTab]<1) pages[mainTab]=1;
  const pageItems = list.slice((pages[mainTab]-1)*pageSize, pages[mainTab]*pageSize);

  const box = document.getElementById('tableList');
  if(!list.length){ box.innerHTML = `<div class="empty-msg">${emptyText}</div>`; document.getElementById('wizardNav').innerHTML=''; return; }
  box.innerHTML = pageItems.map(rowFn).join('');
  renderWizardNav(totalPages);
}
function renderWizardNav(totalPages){
  const nav = document.getElementById('wizardNav');
  if(totalPages<=1){ nav.innerHTML=''; return; }
  const cur = pages[mainTab];
  let dots = '';
  for(let i=1;i<=totalPages;i++) dots += `<button class="wiz-dot${i===cur?' on':''}" data-action="go-page" data-page="${i}"></button>`;
  nav.innerHTML = `
    <button class="wiz-btn" data-action="prev-page" ${cur<=1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
    <div class="wiz-dots">${dots}</div>
    <span class="wiz-page-label">Page ${cur} of ${totalPages}</span>
    <button class="wiz-btn" data-action="next-page" ${cur>=totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
}

/* ─────────────────────────────────────────
   CENTERED DETAIL MODAL
───────────────────────────────────────── */
function openSheetForId(id){
  sheetStoryId = id;
  sheetHistIdx = null;
  sheetMode = FEATURED.some(f=>f.id===id) ? 'featured' : 'add';
  sheetTagPickerOpen = false; sheetDurationEditOpen = false; sheetAddConfigOpen = false;
  sheetAddTags = ['featured'];
  sheetCfgPlacement = { section:'hero-banner', sub:null };
  openSheetCommon();
}
function openSheetForHistory(idx){
  const h = HISTORY[idx];
  const match = findLibraryMatch(h.title, h.author);
  sheetStoryId = match ? match.id : null;
  sheetHistIdx = idx;
  sheetMode = 'add';
  sheetTagPickerOpen = false; sheetDurationEditOpen = false; sheetAddConfigOpen = false;
  sheetAddTags = ['featured', ...(h.tags||[])];
  sheetCfgPlacement = { section:h.placement.section, sub:h.placement.sub };
  openSheetCommon();
}
function openSheetCommon(){
  renderSheetBanner();
  renderSheetBody();
  document.getElementById('sheetBackdrop').classList.add('open');
}
function closeSheet(){ document.getElementById('sheetBackdrop').classList.remove('open'); }
function renderSheetBanner(){
  const s = sheetStoryId ? byIdUI(sheetStoryId) : null;
  const h = sheetHistIdx!=null ? HISTORY[sheetHistIdx] : null;
  const cover = s ? s.cover : (h ? h.cover : '');
  const title = s ? s.title : (h ? h.title : '—');
  const author = s ? s.author : (h ? h.author : '—');
  const genre = s ? s.genre : (h ? h.genre : '');
  document.getElementById('sheetCover').src = cover;
  document.getElementById('sheetTitle').textContent = title;
  document.getElementById('sheetAuthor').textContent = `✍️ ${author}${genre?' · '+genre:''}`;
}

function historyBlockHtml(){
  const s = sheetStoryId ? byIdUI(sheetStoryId) : null;
  const h = sheetHistIdx!=null ? HISTORY[sheetHistIdx] : null;
  const title = s ? s.title : (h ? h.title : null);
  const author = s ? s.author : (h ? h.author : null);
  if(!title || !author) return '';
  const entries = storyHistoryFor(title, author, sheetHistIdx);
  let html = `<div class="sheet-section-lbl"><i class="fas fa-clock-rotate-left"></i> Feature History for This Story</div>`;
  if(!entries.length){
    html += `<div class="empty-msg" style="padding:14px">No past placements on file for this story yet.</div>`;
  } else {
    html += entries.map(e=>`
      <div class="hist-entry">
        <div class="hist-ico">${placementIcon(e.placement)}</div>
        <div class="hist-main">
          <div class="hist-place">${placementLabel(e.placement)}</div>
          <div class="hist-period">📅 ${e.period}</div>
        </div>
        <span class="placement-badge">${(e.tags||[]).map(t=>TAGS[t]?TAGS[t].label:t).join(' · ')||'—'}</span>
      </div>`).join('');
  }
  return html;
}

function renderSheetBody(){
  const s = sheetStoryId ? byIdUI(sheetStoryId) : null;
  const h = sheetHistIdx!=null ? HISTORY[sheetHistIdx] : null;
  const rating = s ? s.rating : (h ? h.rating : '—');
  const chapters = s ? s.chapters : '—';
  const words = s ? s.words : null;
  const status = s ? s.status : 'ended';
  const synopsis = s ? s.synopsis : 'No synopsis on file for this archived feature.';

  let html = '';
  html += `<div class="sheet-meta-grid">
    <div class="sheet-meta-item"><b>${rating}</b><span>Rating</span></div>
    <div class="sheet-meta-item"><b>${chapters}</b><span>Chapters</span></div>
    <div class="sheet-meta-item"><b>${words?(words/1000).toFixed(0)+'k':'—'}</b><span>Words</span></div>
    <div class="sheet-meta-item"><b style="text-transform:capitalize">${status}</b><span>Status</span></div>
  </div>`;
  html += `<div class="sheet-section-lbl">Synopsis</div><div class="sheet-synopsis">${synopsis}</div>`;

  if(sheetMode==='featured'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    const sec = sectionOf(f.placement.section);
    html += `<div class="sheet-section-lbl">Manage Placement</div>`;
    html += `<div class="tag-row">${f.tags.map(t=>tagChip(t,true,'sheet-remove-tag')).join('')}
      <button class="tag-add-btn" data-action="sheet-toggle-tagpicker"><i class="fas fa-plus"></i> Tag</button></div>`;
    html += `<div class="tag-picker${sheetTagPickerOpen?' open':''}">${tagPickerHtml(f.tags,'sheet-add-tag')}</div>`;
    html += `<div class="sheet-row-2">
      <div class="sheet-field"><label>Discover Section</label>
        <select data-action="sheet-change-section">${sectionOptionsHtml(f.placement.section)}</select></div>
      ${sec.needsSub?`<div class="sheet-field"><label>${sec.subLabel}</label>
        <select data-action="sheet-change-sub">${subOptionsHtml(sec.id,f.placement.sub)}</select></div>`:''}
    </div>`;
    html += `<div class="feat-duration-line">
      <span>${fmtDateUI(f.start)} — ${fmtDateUI(f.end)}</span>
      ${daysBadgeHtml(f.end)}
      <span class="icon-link" data-action="sheet-toggle-duration"><i class="fas fa-pen"></i> edit</span>
    </div>`;
    html += `<div class="duration-edit${sheetDurationEditOpen?' open':''}">
      <input type="date" id="sheet-start" value="${toInputDate(f.start)}"/>
      <span style="font-size:11px;color:var(--text-faint)">to</span>
      <input type="date" id="sheet-end" value="${toInputDate(f.end)}"/>
      <button class="mini-btn save" data-action="sheet-save-duration">Save</button>
      <button class="mini-btn cancel" data-action="sheet-toggle-duration">Cancel</button>
    </div>`;
    html += `<div class="sheet-field"><label>Editor's Note</label><textarea id="sheet-note" placeholder="Add a note…">${f.note||''}</textarea></div>`;
    html += historyBlockHtml();
    html += `<button class="sheet-action remove" data-action="sheet-remove-feature"><i class="fas fa-xmark"></i> Remove from Featured</button>`;
  } else {
    if(!sheetAddConfigOpen){
      const label = sheetHistIdx!=null ? '<i class="fas fa-rotate-left"></i> Re-feature This Story' : '<i class="fas fa-star"></i> Feature This Story';
      html += `<button class="sheet-action add" data-action="sheet-open-add-config">${label}</button>`;
      html += historyBlockHtml();
    } else {
      const cfgSec = sectionOf(sheetCfgPlacement.section);
      html += `<div class="sheet-section-lbl">${sheetHistIdx!=null?'Re-feature Details':'Feature Details'}</div>`;
      html += `<div class="sheet-row-2">
        <div class="sheet-field"><label>Discover Section</label>
          <select id="sheet-cfg-section">${sectionOptionsHtml(cfgSec.id)}</select></div>
        ${cfgSec.needsSub?`<div class="sheet-field"><label>${cfgSec.subLabel}</label>
          <select id="sheet-cfg-sub">${subOptionsHtml(cfgSec.id,sheetCfgPlacement.sub)}</select></div>`:''}
      </div>`;
      html += `<div class="sheet-row-2">
        <div class="sheet-field"><label>Start</label><input type="date" id="sheet-cfg-start" value="${toInputDate(new Date())}"/></div>
        <div class="sheet-field"><label>End</label><input type="date" id="sheet-cfg-end" value="${toInputDate(new Date(Date.now()+14*86400000))}"/></div>
      </div>`;
      html += `<div class="sheet-field"><label>Tags</label>
        <div class="tag-row" id="sheet-cfg-tags">${tagPickerHtml(sheetAddTags,'sheet-cfg-toggle-tag')}</div></div>`;
      html += `<div class="sheet-field"><label>Editor's Note (optional)</label><textarea id="sheet-cfg-note" placeholder="Why feature this now?">${h&&h.note?h.note:''}</textarea></div>`;
      html += `<div class="sheet-config-actions">
        <button class="mini-btn cancel" data-action="sheet-cancel-add-config">Cancel</button>
        <button class="mini-btn save" data-action="sheet-confirm-add"><i class="fas fa-star"></i> Confirm</button>
      </div>`;
      html += historyBlockHtml();
    }
  }
  document.getElementById('sheetBody').innerHTML = html;
}

/* ─────────────────────────────────────────
   SHARED ACTIONS
───────────────────────────────────────── */
function doRemoveFeature(id){
  const s = byIdUI(id);
  const f = FEATURED.find(x=>x.id===id);
  if(!s || !f) return;
  FEATURED = FEATURED.filter(x=>x.id!==id);
  HISTORY.unshift({ title:s.title, author:s.author, cover:s.cover, genre:s.genre, rating:s.rating, placement:f.placement, tags:f.tags.filter(t=>t!=='featured'), period:`${fmtDateUI(f.start)} – ${fmtDateUI(new Date())}` });
  toast(`⭐ Removed "${s.title}" from Featured`);
  renderAll();
}

/* ─────────────────────────────────────────
   EVENT DELEGATION
───────────────────────────────────────── */
document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  if(action==='set-main-tab'){
    mainTab = el.dataset.tab;
    if(mainTab !== 'featured'){ sectionFilter = 'all'; document.getElementById('sectionFilter').value = 'all'; }
    renderTable();
  }
  else if(action==='open-detail'){
    if(el.dataset.histidx!==undefined) openSheetForHistory(parseInt(el.dataset.histidx,10));
    else openSheetForId(id);
  }
  else if(action==='quick-remove'){ doRemoveFeature(id); }
  else if(action==='set-tag-tab'){ activeTag = el.dataset.tag; pages.featured = 1; renderTable(); }
  else if(action==='prev-page'){ pages[mainTab]--; renderTable(); }
  else if(action==='next-page'){ pages[mainTab]++; renderTable(); }
  else if(action==='go-page'){ pages[mainTab] = parseInt(el.dataset.page,10); renderTable(); }

  /* sheet: featured-mode editing */
  else if(action==='sheet-toggle-tagpicker'){ sheetTagPickerOpen = !sheetTagPickerOpen; renderSheetBody(); }
  else if(action==='sheet-add-tag'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    const tag = el.dataset.tag;
    if(f && !f.tags.includes(tag)) f.tags.push(tag);
    sheetTagPickerOpen = false;
    toast(`🏷️ Tagged "${TAGS[tag].label}"`);
    renderStats(); renderTable(); renderSheetBody();
  }
  else if(action==='sheet-remove-tag'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    if(f) f.tags = f.tags.filter(t=>t!==el.dataset.tag);
    sheetTagPickerOpen = true;
    renderStats(); renderTable(); renderSheetBody();
  }
  else if(action==='sheet-toggle-duration'){ sheetDurationEditOpen = !sheetDurationEditOpen; renderSheetBody(); }
  else if(action==='sheet-save-duration'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    const start = new Date(document.getElementById('sheet-start').value);
    const end = new Date(document.getElementById('sheet-end').value);
    if(end<=start){ toast('⚠️ End date must be after start date'); return; }
    f.start = start; f.end = end;
    sheetDurationEditOpen = false;
    toast('📅 Feature duration updated');
    renderTable(); renderSheetBody();
  }
  else if(action==='sheet-remove-feature'){ const sid = sheetStoryId; closeSheet(); doRemoveFeature(sid); }

  /* sheet: add / re-feature flow */
  else if(action==='sheet-open-add-config'){ sheetAddConfigOpen = true; renderSheetBody(); }
  else if(action==='sheet-cancel-add-config'){ sheetAddConfigOpen = false; renderSheetBody(); }
  else if(action==='sheet-cfg-toggle-tag'){
    const tag = el.dataset.tag;
    const idx = sheetAddTags.indexOf(tag);
    if(idx>-1) sheetAddTags.splice(idx,1); else sheetAddTags.push(tag);
    document.getElementById('sheet-cfg-tags').innerHTML = tagPickerHtml(sheetAddTags,'sheet-cfg-toggle-tag');
  }
  else if(action==='sheet-confirm-add'){
    const s = byIdUI(sheetStoryId);
    if(!s){ toast("⚠️ Can't find this story in your library"); return; }
    const section = document.getElementById('sheet-cfg-section').value;
    const secDef = sectionOf(section);
    const sub = secDef.needsSub ? document.getElementById('sheet-cfg-sub').value : null;
    const start = new Date(document.getElementById('sheet-cfg-start').value);
    const end = new Date(document.getElementById('sheet-cfg-end').value);
    const note = document.getElementById('sheet-cfg-note').value.trim();
    if(end<=start){ toast('⚠️ End date must be after start date'); return; }
    let tags = [...sheetAddTags];
    if(!tags.includes('featured')) tags.unshift('featured');
    FEATURED.push({ id:s.id, placement:{section,sub}, tags, start, end, note });
    if(sheetHistIdx!=null) HISTORY.splice(sheetHistIdx,1);
    toast(`⭐ "${s.title}" is now featured`);
    closeSheet();
    renderAll();
  }
});

document.addEventListener('change', e=>{
  if(e.target.dataset.action==='sheet-change-section'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    const sec = sectionOf(e.target.value);
    f.placement.section = sec.id;
    f.placement.sub = sec.needsSub ? sec.subOptions[0] : null;
    toast('📍 Section updated');
    renderTable(); renderSheetBody();
  }
  else if(e.target.dataset.action==='sheet-change-sub'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    f.placement.sub = e.target.value;
    toast('📍 Placement updated');
    renderTable(); renderSheetBody();
  }
  else if(e.target.id==='sheet-cfg-section'){
    const sec = sectionOf(e.target.value);
    sheetCfgPlacement = { section:sec.id, sub: sec.needsSub ? sec.subOptions[0] : null };
    renderSheetBody();
  }
  else if(e.target.id==='sheet-cfg-sub'){
    sheetCfgPlacement.sub = e.target.value;
  }
});
document.addEventListener('blur', e=>{
  if(e.target.id==='sheet-note'){
    const f = FEATURED.find(x=>x.id===sheetStoryId);
    if(f){ f.note = e.target.value; toast("📝 Editor's note saved"); }
  }
}, true);

document.getElementById('sheetClose').addEventListener('click', closeSheet);
document.getElementById('sheetBackdrop').addEventListener('click', e=>{ if(e.target.id==='sheetBackdrop') closeSheet(); });
document.getElementById('librarySearch').addEventListener('input', ()=>{ pages.add=1; renderTable(); });
document.getElementById('libraryGenreFilter').addEventListener('change', ()=>{ pages.add=1; renderTable(); });
document.getElementById('historySearch').addEventListener('input', ()=>{ pages.history=1; renderTable(); });
document.getElementById('sectionFilter').addEventListener('change', function(){
  const val = this.value;
  if(val !== 'all'){
    mainTab = 'featured';
    activeTag = 'all';
    pages.featured = 1;
    sectionFilter = val;
  } else {
    sectionFilter = 'all';
  }
  renderAll();
});
window.addEventListener('resize', renderTable);

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function renderAll(){ renderStats(); renderTable(); }
const genres = [...new Set(LIBRARY.map(s=>s.genre))];
document.getElementById('libraryGenreFilter').innerHTML = '<option value="">All Genres</option>' + genres.map(g=>`<option value="${g}">${g}</option>`).join('');
document.getElementById('sectionFilter').innerHTML = '<option value="all">All Discover Sections</option>' + SECTIONS.map(s=>`<option value="${s.id}">${s.icon} ${s.label}</option>`).join('');
renderAll();
  // inline toast was window-level (overrode sidebar) — preserve by re-exposing
  try{ window.toast = toast; }catch(e){}
}
window.__featuredStoriesAPI.init = init;
window.FeaturedStoriesService = window.__featuredStoriesAPI;

})();
