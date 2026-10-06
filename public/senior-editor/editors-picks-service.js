/**
 * editors-picks-service.js — Data layer for Editor's Picks page
 * Reads from window.EditorDemo.EDITORS_PICKS / window.EditorDemo.EDITORS_PICKS_LOG
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__editorsPicksService) return;
window.__editorsPicksService = true;

/* Demo-data self-load: page HTML no longer includes ../data/editor-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.EditorDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="../data/editor-demo-data.js"><\/script>');
}

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/editors-picks';
var TIMEOUT_MS = 2500;

/* ── Backend-ready header (USE_API/callBackend added; existing API_BASE kept) ── */
var USE_API = false;
async function callBackend(path, opts){
  if(!USE_API) return null;
  return timeoutFetch(API_BASE + path, opts);
}
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

var _picks = [];
var _log = [];

function loadFromDemo(){
  var D = window.EditorDemo || {};
  _picks = JSON.parse(JSON.stringify(D.EDITORS_PICKS || []));
  _log = JSON.parse(JSON.stringify(D.EDITORS_PICKS_LOG || []));
}
loadFromDemo();
/* Injected data script executes after this file — re-sync once parsed (renders only, no re-bind). */
if(!_picks.length) window.addEventListener('DOMContentLoaded', function(){ loadFromDemo(); renderAll(); });

function picks(){ return _picks; }
function log(){ return _log; }

function activePicks(){ return _picks.filter(function(p){ return p.active; }); }
function archivedPicks(){ return _picks.filter(function(p){ return !p.active; }); }

function byId(id){ return _picks.find(function(p){ return p.id === id; }); }

function categories(){
  var cats = {};
  _picks.forEach(function(p){
    if(!cats[p.category]) cats[p.category] = 0;
    cats[p.category]++;
  });
  return cats;
}

function stats(){
  var active = activePicks().length;
  var archived = archivedPicks().length;
  var cats = categories();
  var catCount = Object.keys(cats).length;
  var avgRating = 0;
  if(_picks.length){
    var total = _picks.reduce(function(s,p){ return s + p.rating; }, 0);
    avgRating = (total / _picks.length).toFixed(1);
  }
  return { active: active, archived: archived, categories: catCount, avgRating: avgRating };
}

function addPick(id, category, reason){
  var existing = _picks.find(function(p){ return p.id === id; });
  if(existing){
    existing.active = true;
    existing.category = category;
    existing.reason = reason;
    existing.pickedDate = new Date().toISOString().slice(0,10);
    return existing;
  }
  return null;
}

function removePick(id){
  var p = _picks.find(function(x){ return x.id === id; });
  if(p){
    p.active = false;
    _log.unshift({ action:'removed', story:p.title, by:p.pickedBy, date:new Date().toISOString().slice(0,10), note:'Removed from picks' });
  }
  return p;
}

function togglePick(id){
  var p = _picks.find(function(x){ return x.id === id; });
  if(p) p.active = !p.active;
  return p;
}

function searchPicks(query){
  var q = (query||'').toLowerCase();
  return _picks.filter(function(p){
    return !q || p.title.toLowerCase().indexOf(q)!==-1 || p.author.toLowerCase().indexOf(q)!==-1 || p.category.toLowerCase().indexOf(q)!==-1;
  });
}

function filterByCategory(cat){
  if(!cat || cat==='all') return _picks;
  return _picks.filter(function(p){ return p.category === cat; });
}

window.__editorsPicksAPI = {
  picks: picks,
  log: log,
  activePicks: activePicks,
  archivedPicks: archivedPicks,
  byId: byId,
  categories: categories,
  stats: stats,
  addPick: addPick,
  removePick: removePick,
  togglePick: togglePick,
  searchPicks: searchPicks,
  filterByCategory: filterByCategory
};

/* ═══ Page UI layer (migrated verbatim from editors-picks.html inline script) ═══ */
var _epInitDone = false;
function init(){
  if(_epInitDone) return;
  _epInitDone = true;

'use strict';

const API = window.__editorsPicksAPI;

const shell = SeniorEditorSidebar.attach('#epRoot', {
  activeItem: 'editors-picks',
  title: "Editor's Picks",
  subtitle: 'Handpicked stories for readers',
  user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
  notifCount: 3,
  onSearch: function(v){}
});

function toast(m){
  const t=document.getElementById('toastEl');
  t.textContent=m;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},2400);
}

let activeTab = 'active';
let activeCategory = 'all';
let page = 1;
const PAGE_SIZE = 6;

function getFilteredList(){
  let list = activeTab==='active' ? API.activePicks() : API.picks();
  if(activeCategory && activeCategory!=='all') list = list.filter(function(p){ return p.category === activeCategory; });
  return list;
}

function categoryClass(cat){
  if(cat==='Best Completed') return 'best';
  if(cat==='Must Read') return 'must';
  if(cat==="Editor's Choice") return 'editor';
  if(cat==='Rising Star') return 'rising';
  return '';
}

function renderStats(){
  const s = API.stats();
  const cards = [
    { n: s.active, l:'Active Picks', ico:'fa-award', cls:'purple' },
    { n: s.archived, l:'Archived', ico:'fa-box-archive', cls:'amber' },
    { n: s.categories, l:'Categories', ico:'fa-folder', cls:'blue' },
    { n: s.avgRating, l:'Avg Rating', ico:'fa-star', cls:'green' },
  ];
  document.getElementById('statCards').innerHTML = cards.map(function(c){
    return '<div class="stat-card"><div class="stat-ico" style="background:var(--'+c.cls+'-bg);color:var(--'+c.cls+')"><i class="fas '+c.ico+'"></i></div><div><div class="stat-num">'+c.n+'</div><div class="stat-lbl">'+c.l+'</div></div></div>';
  }).join('');
}

function renderTabs(){
  const active = API.activePicks().length;
  const all = API.picks().length;
  const tabs = [
    { key:'active', label:'Active Picks', count:active },
    { key:'all', label:'All Picks', count:all },
  ];
  document.getElementById('tabBar').innerHTML = '<div class="top-tabs">' + tabs.map(function(t){
    return '<div class="top-tab'+(activeTab===t.key?' active':'')+'" data-tab="'+t.key+'">'+t.label+' <span style="opacity:.6">('+t.count+')</span></div>';
  }).join('') + '</div>';

  const cats = API.categories();
  document.getElementById('categoryFilter').innerHTML = '<option value="all">All Categories</option>' + Object.keys(cats).map(function(c){
    return '<option value="'+c+'"'+(activeCategory===c?' selected':'')+'>'+c+' ('+cats[c]+')</option>';
  }).join('');
}

function renderTable(){
  const list = getFilteredList();
  document.getElementById('tableHead').innerHTML = '<tr><th>Story</th><th>Category</th><th>Rating</th><th>Reason</th><th>Status</th><th>Actions</th></tr>';

  const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if(page > total) page = total;
  if(page < 1) page = 1;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  if(!list.length){
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="6"><div class="empty-msg">No picks match this filter.</div></td></tr>';
    document.getElementById('pageInfo').textContent = '';
    document.getElementById('pageBtns').innerHTML = '';
    return;
  }

  document.getElementById('tableBody').innerHTML = pageItems.map(function(p){
    const catCls = categoryClass(p.category);
    return '<tr>'+
      '<td><div class="story-cell"><img class="story-cover" src="'+p.cover+'" alt=""/><div class="story-info"><div class="story-title">'+p.title+'</div><div class="story-author">✍️ '+p.author+'</div><div class="story-genre">'+p.genre+'</div></div></div></td>'+
      '<td><span class="category-chip '+catCls+'">'+p.category+'</span></td>'+
      '<td class="rating-cell">'+p.rating+'<span class="stars"><i class="fas fa-star"></i></span></td>'+
      '<td class="reason-cell" title="'+p.reason+'">'+p.reason+'</td>'+
      '<td><span class="status-pill '+(p.active?'active':'archived')+'"><span class="dot"></span>'+(p.active?'Active':'Archived')+'</span></td>'+
      '<td><div class="actions-cell">'+
        '<button class="act-btn" data-action="view" data-id="'+p.id+'" title="View details"><i class="fas fa-eye"></i></button>'+
        '<button class="act-btn danger" data-action="toggle" data-id="'+p.id+'" title="'+(p.active?'Archive':'Restore')+'"><i class="fas fa-'+(p.active?'box-archive':'rotate-left')+'"></i></button>'+
      '</div></td>'+
    '</tr>';
  }).join('');

  document.getElementById('pageInfo').innerHTML = 'Showing <b>'+(start+1)+'</b> to <b>'+Math.min(start+PAGE_SIZE, list.length)+'</b> of <b>'+list.length+'</b> picks';

  let btns = '';
  btns += '<button data-page="prev" '+(page<=1?'disabled':'')+'><i class="fas fa-chevron-left"></i></button>';
  for(var i=1;i<=total;i++) btns += '<button class="'+(i===page?'active':'')+'" data-page="'+i+'">'+i+'</button>';
  btns += '<button data-page="next" '+(page>=total?'disabled':'')+'><i class="fas fa-chevron-right"></i></button>';
  document.getElementById('pageBtns').innerHTML = btns;
}

function renderLog(){
  const entries = API.log().slice(0, 8);
  document.getElementById('logList').innerHTML = entries.map(function(e){
    const cls = e.action==='picked' ? 'pick' : 'remove';
    const ico = e.action==='picked' ? 'fa-award' : 'fa-box-archive';
    return '<div class="log-item"><div class="log-icon '+cls+'"><i class="fas '+ico+'"></i></div><div><div class="log-text"><b>'+e.action+'</b> — '+e.story+' <span style="color:var(--text-faint)">by '+e.by+'</span></div><div class="log-date">'+e.date+' · '+e.note+'</div></div></div>';
  }).join('');
}

function renderAll(){ renderStats(); renderTabs(); renderTable(); renderLog(); }

document.getElementById('tabBar').addEventListener('click', function(e){
  var tab = e.target.closest('[data-tab]');
  if(!tab) return;
  activeTab = tab.dataset.tab;
  page = 1;
  renderAll();
});
document.getElementById('categoryFilter').addEventListener('change', function(){
  activeCategory = this.value;
  page = 1;
  renderAll();
});
document.getElementById('pageBtns').addEventListener('click', function(e){
  var btn = e.target.closest('[data-page]');
  if(!btn || btn.disabled) return;
  var action = btn.dataset.page;
  if(action==='prev') page--;
  else if(action==='next') page++;
  else page = parseInt(action, 10);
  renderTable();
});
document.getElementById('tableBody').addEventListener('click', function(e){
  var btn = e.target.closest('[data-action]');
  if(!btn) return;
  var action = btn.dataset.action;
  var id = btn.dataset.id;
  if(action==='toggle'){
    var p = API.togglePick(id);
    if(p) toast(p.active ? '⭐ Restored to picks' : '📦 Archived from picks');
    renderAll();
  } else if(action==='view'){
    var pick = API.byId(id);
    if(pick) toast('📖 '+pick.title+' — '+pick.reason);
  }
});

renderAll();
  // expose toast for parity with inline (was window-level); no onclick needs it but keep global
  try{ window.toast = toast; }catch(e){}
}
window.__editorsPicksAPI.init = init;
window.EditorsPicksService = window.__editorsPicksAPI;

})();
