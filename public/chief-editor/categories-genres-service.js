/**
 * categories-genres-service.js — Data layer for Categories & Genres page
 * Reads from window.EditorDemo.CATEGORIES / GENRES / POPULAR_GENRES
 */
(function(){
'use strict';
if(window.__catGenreService) return;
window.__catGenreService = true;

/* ── Backend-ready header ── */
var USE_API = false;
var API_BASE = window.DROBOARD_API_BASE || '/api/chief';
var TIMEOUT_MS = 2500;
async function callBackend(path, opts){
  if(!USE_API) return null;
  return timeoutFetch(API_BASE + path, opts);
}
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }

function getDemo(){
  var D = window.EditorDemo || {};
  return {
    categories: JSON.parse(JSON.stringify(D.CATEGORIES || [])),
    genres: JSON.parse(JSON.stringify(D.GENRES || [])),
    tropes: JSON.parse(JSON.stringify(D.TROPES || [])),
    popularGenres: JSON.parse(JSON.stringify(D.POPULAR_GENRES || []))
  };
}

/* ── Live loaders: GET /categories, /genres, /tropes, /genres/popular → demo shapes ──
   Backend Category/Genre: booksCount (number) → demo `books` (comma string);
   Genre.categoryId → demo `cat` (category name). Trope carries genre name already.
   /genres/popular returns [{name,count}] → demo {name, books:'N books'}.
   Cosmetic icon/bg/color are not on the backend docs — empty values fall back
   to the local ICON_OPTIONS palette so the tables never render blank tiles. */
function toBooks(n){ return (Number(n)||0).toLocaleString('en-US'); }
function icoFor(x){
  var ico = pickIcon(), src = x || {};
  return { icon: src.icon || ico.icon, bg: src.bg || ico.bg, color: src.color || ico.color };
}

function mapCategory(c, genreCounts){
  var ico = icoFor(c);
  return {
    id: c.id,
    name: c.name || '',
    icon: ico.icon, bg: ico.bg, color: ico.color,
    desc: c.desc || '',
    genres: genreCounts[c.id] || 0,
    books: toBooks(c.booksCount),
    status: c.status || 'active'
  };
}
function mapGenre(g, catNameById){
  var ico = icoFor(g);
  return {
    id: g.id,
    name: g.name || '',
    cat: catNameById[g.categoryId] || '',
    icon: ico.icon, bg: ico.bg, color: ico.color,
    books: toBooks(g.booksCount),
    status: g.status || 'active'
  };
}
function mapTrope(t){
  var ico = icoFor(t);
  return {
    id: t.id,
    name: t.name || '',
    genre: t.genre || '',
    icon: ico.icon, bg: ico.bg, color: ico.color,
    books: toBooks(t.booksCount),
    status: t.status || 'active'
  };
}
function mapPopular(p){
  var ico = pickIcon();
  return {
    name: p.name || '',
    icon: ico.icon, bg: ico.bg, color: ico.color,
    books: toBooks(p.count) + ' books'
  };
}
async function itemsOf(path){
  var d = await callBackend(path);
  if(Array.isArray(d)) return d;
  return (d && Array.isArray(d.items)) ? d.items : null;
}
async function loadLive(){
  var rs = await Promise.all([
    itemsOf('/categories?limit=50'),
    itemsOf('/genres?limit=50'),
    itemsOf('/tropes?limit=50'),
    callBackend('/genres/popular'),
  ]);
  var catRaw = rs[0], genRaw = rs[1], troRaw = rs[2], popRaw = rs[3];
  if(!catRaw || !genRaw) return null; // core lists missing → caller falls back to demo

  var catNameById = {}, genreCounts = {};
  catRaw.forEach(function(c){ catNameById[c.id] = c.name; });
  genRaw.forEach(function(g){ if(g.categoryId != null) genreCounts[g.categoryId] = (genreCounts[g.categoryId]||0)+1; });

  var popular = Array.isArray(popRaw) ? popRaw.map(mapPopular) : null;
  return {
    categories: catRaw.map(function(c){ return mapCategory(c, genreCounts); }),
    genres: genRaw.map(function(g){ return mapGenre(g, catNameById); }),
    tropes: (troRaw || []).map(mapTrope),
    popular: (popular && popular.length) ? popular : getDemo().popularGenres,
  };
}

/* ── Live mutation helper: fire-and-forget under USE_API, demo state always applied locally ── */
function jsonOpts(method, body){
  return { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
async function liveCall(path, opts){
  if(!USE_API) return null;
  try { return await callBackend(path, opts); }
  catch(e){ console.warn('[CategoriesGenres] backend call failed:', path, e); return null; }
}

var ICON_OPTIONS = [
  {icon:'fa-heart',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-crown',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-paw',bg:'#eef0f2',color:'#5b6470'},
  {icon:'fa-droplet',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-wand-magic-sparkles',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-gun',bg:'#e7e7ea',color:'#26262b'},
  {icon:'fa-building',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-ring',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-fire',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-rotate-left',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-briefcase',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-shield',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-heart-crack',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-ban',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-book',bg:'#e2f8ea',color:'#16a34a'},
  {icon:'fa-film',bg:'#fef3d8',color:'#d97706'}
];

function pickIcon(){ return ICON_OPTIONS[Math.floor(Math.random()*ICON_OPTIONS.length)]; }

window.CategoriesGenresService = {

  getCategories: function(){
    return getDemo().categories;
  },

  getGenres: function(){
    return getDemo().genres;
  },

  getTropes: function(){
    return getDemo().tropes;
  },

  getPopularGenres: function(){
    return getDemo().popularGenres;
  },

  getIconOptions: function(){ return ICON_OPTIONS.slice(); },

  addCategory: function(payload, categories){
    var ico = pickIcon();
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, genres:0, books:'0'}, payload);
    categories.unshift(item);
    return item;
  },

  updateCategory: function(idx, payload, categories){
    if(idx < 0 || idx >= categories.length) return null;
    Object.assign(categories[idx], payload);
    return categories[idx];
  },

  deleteCategory: function(idx, categories){
    if(idx < 0 || idx >= categories.length) return;
    categories.splice(idx, 1);
  },

  addGenre: function(payload, genres){
    var ico = pickIcon();
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, books:'0'}, payload);
    genres.unshift(item);
    return item;
  },

  updateGenre: function(idx, payload, genres){
    if(idx < 0 || idx >= genres.length) return null;
    Object.assign(genres[idx], payload);
    return genres[idx];
  },

  deleteGenre: function(idx, genres){
    if(idx < 0 || idx >= genres.length) return;
    genres.splice(idx, 1);
  },

  addTrope: function(payload, tropes){
    var ico = pickIcon();
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, books:'0'}, payload);
    tropes.unshift(item);
    return item;
  },

  updateTrope: function(idx, payload, tropes){
    if(idx < 0 || idx >= tropes.length) return null;
    Object.assign(tropes[idx], payload);
    return tropes[idx];
  },

  deleteTrope: function(idx, tropes){
    if(idx < 0 || idx >= tropes.length) return;
    tropes.splice(idx, 1);
  },

  init: init
};

/* ═══ Page UI layer (migrated from categories-genres.html inline script; no data-layer collision) ═══ */
var _cgInitDone = false;
async function init(){
  if(_cgInitDone) return;
  _cgInitDone = true;

ChiefEditorSidebar.attach('#dashboardRoot',{
  activeItem:'categories-genres',title:'Categories & Genres',subtitle:'Organize and manage all categories and genres',
  user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,
  searchPlaceholder:'Search by category or genre name...'
});

var CATEGORIES=[], GENRES=[], TROPES=[], POPULAR_GENRES=[];
var currentView='categories';
var formMode={type:null, action:null, idx:null};

function statusPillHtml(s){
  var active=s==='active';
  return'<span class="status-pill'+(active?'':' inactive')+'"><span class="dot"></span>'+(active?'Active':'Inactive')+'</span>';
}

function renderStats(){
  var totalCat=CATEGORIES.length;
  var totalGen=GENRES.length;
  var totalTro=TROPES.length;
  var activeCat=CATEGORIES.filter(function(c){return c.status==='active'}).length;
  var activeGen=GENRES.filter(function(g){return g.status==='active'}).length;
  var activeTro=TROPES.filter(function(t){return t.status==='active'}).length;
  var pct=totalCat+totalGen+totalTro>0?Math.round((activeCat+activeGen+activeTro)/(totalCat+totalGen+totalTro)*100):0;
  document.getElementById('statsGrid').innerHTML=
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico purple"><i class="fas fa-grip"></i></div></div><div class="stat-num">'+totalCat+'</div><div class="stat-lbl">Total Categories</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico green"><i class="fas fa-book"></i></div></div><div class="stat-num">'+totalGen+'</div><div class="stat-lbl">Total Genres</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico pink"><i class="fas fa-wand-magic-sparkles"></i></div></div><div class="stat-num">'+totalTro+'</div><div class="stat-lbl">Total Tropes</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico blue"><i class="fas fa-shuffle"></i></div></div><div class="stat-num">'+pct+'%</div><div class="stat-lbl">Active</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico amber"><i class="fas fa-tag"></i></div></div><div class="stat-num">'+CATEGORIES.reduce(function(a,c){return a+parseInt((c.books||'0').replace(/,/g,''),10)},0).toLocaleString()+'</div><div class="stat-lbl">Books Assigned</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico pink"><i class="fas fa-eye"></i></div></div><div class="stat-num">'+(CATEGORIES.length*1.4).toFixed(1)+'M</div><div class="stat-lbl">Total Views</div></div>';
}

function renderCategoriesTable(list){
  document.getElementById('tableHead').innerHTML='<tr><th>Category Name</th><th>Description</th><th>Genres</th><th>Books</th><th>Status</th><th>Actions</th></tr>';
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="6"><i class="fas fa-inbox"></i>No categories match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(c){
    var idx=CATEGORIES.indexOf(c);
    return'<tr>'+
      '<td data-label="Category Name"><div class="cat-cell"><div class="cat-icn" style="background:'+c.bg+';color:'+c.color+'"><i class="fas '+c.icon+'"></i></div><div class="cat-name">'+c.name+'</div></div></td>'+
      '<td data-label="Description"><div class="cat-desc">'+c.desc+'</div></td>'+
      '<td data-label="Genres" class="genre-count">'+c.genres+' genres</td>'+
      '<td data-label="Books" class="plain-cell">'+c.books+'</td>'+
      '<td data-label="Status">'+statusPillHtml(c.status)+'</td>'+
      '<td data-label="Actions"><div class="actions-cell">'+
        '<button class="act-btn" title="Edit" data-action="edit" data-idx="'+idx+'"><i class="fas fa-pen"></i></button>'+
        '<button class="act-btn" title="Toggle Status" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-toggle-on"></i></button>'+
        '<button class="act-btn" title="Delete" data-action="delete" data-idx="'+idx+'"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}

function renderGenresTable(list){
  document.getElementById('tableHead').innerHTML='<tr><th>Genre Name</th><th>Tropes</th><th>Books</th><th>Status</th><th>Actions</th></tr>';
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="5"><i class="fas fa-inbox"></i>No genres match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(g){
    var idx=GENRES.indexOf(g);
    var tr=TROPES.filter(function(t){return t.genre===g.name;});
    var tropesHtml;
    if(!tr.length)tropesHtml='<span class="trope-chip">No tropes yet</span>';
    else if(tr.length===1)tropesHtml='<span class="trope-chip">'+tr[0].name+'</span>';
    else tropesHtml='<span class="trope-chip">'+tr[0].name+'</span><span class="trope-more" title="'+tr.slice(1).map(function(t){return t.name;}).join(' · ')+'">+'+(tr.length-1)+' more</span>';
    return'<tr>'+
      '<td data-label="Genre Name"><div class="cat-cell"><div class="cat-icn" style="background:'+g.bg+';color:'+g.color+'"><i class="fas '+g.icon+'"></i></div><div class="cat-name">'+g.name+'</div></div></td>'+
      '<td data-label="Tropes"><div class="trope-cell">'+tropesHtml+'</div></td>'+
      '<td data-label="Books" class="plain-cell">'+g.books+'</td>'+
      '<td data-label="Status">'+statusPillHtml(g.status)+'</td>'+
      '<td data-label="Actions"><div class="actions-cell">'+
        '<button class="act-btn" title="Edit" data-action="edit" data-idx="'+idx+'"><i class="fas fa-pen"></i></button>'+
        '<button class="act-btn" title="Toggle Status" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-toggle-on"></i></button>'+
        '<button class="act-btn" title="Delete" data-action="delete" data-idx="'+idx+'"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}

function renderTropesTable(list){
  document.getElementById('tableHead').innerHTML='<tr><th>Trope Name</th><th>Genre</th><th>Books</th><th>Status</th><th>Actions</th></tr>';
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="5"><i class="fas fa-inbox"></i>No tropes match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(t){
    var idx=TROPES.indexOf(t);
    return'<tr>'+
      '<td data-label="Trope Name"><div class="cat-cell"><div class="cat-icn" style="background:'+t.bg+';color:'+t.color+'"><i class="fas '+t.icon+'"></i></div><div class="cat-name">'+t.name+'</div></div></td>'+
      '<td data-label="Genre" class="plain-cell">'+t.genre+'</td>'+
      '<td data-label="Books" class="plain-cell">'+t.books+'</td>'+
      '<td data-label="Status">'+statusPillHtml(t.status)+'</td>'+
      '<td data-label="Actions"><div class="actions-cell">'+
        '<button class="act-btn" title="Edit" data-action="edit" data-idx="'+idx+'"><i class="fas fa-pen"></i></button>'+
        '<button class="act-btn" title="Toggle Status" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-toggle-on"></i></button>'+
        '<button class="act-btn" title="Delete" data-action="delete" data-idx="'+idx+'"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}

function currentFiltered(){
  var q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();
  var source=currentView==='categories'?CATEGORIES:(currentView==='genres'?GENRES:TROPES);
  if(!q)return source;
  return source.filter(function(x){return x.name.toLowerCase().indexOf(q)!==-1||(x.desc&&x.desc.toLowerCase().indexOf(q)!==-1)||(x.cat&&x.cat.toLowerCase().indexOf(q)!==-1)||(x.genre&&x.genre.toLowerCase().indexOf(q)!==-1);});
}

function renderPageInfo(count){
  var label=currentView==='categories'?'categories':(currentView==='genres'?'genres':'tropes');
  var total=currentView==='categories'?CATEGORIES.length:(currentView==='genres'?GENRES.length:TROPES.length);
  var shown=Math.min(8,count);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(count?1:0)+'</b> to <b>'+shown+'</b> of <b>'+total+'</b> '+label;
}

function renderPagination(){
  var wrap=document.getElementById('pageBtns');
  var total=currentView==='categories'?CATEGORIES.length:(currentView==='genres'?GENRES.length:TROPES.length);
  var tp=Math.max(1,Math.ceil(total/8));
  var pages=[];
  for(var i=1;i<=Math.min(tp,5);i++)pages.push(i);
  wrap.innerHTML='<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>'+
    pages.map(function(p){return'<button class="pg-btn'+(p===1?' active':'')+'" data-p="'+p+'">'+p+'</button>';}).join('')+
    '<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>';
  wrap.querySelectorAll('[data-p]').forEach(function(btn){
    btn.addEventListener('click',function(){wrap.querySelectorAll('.pg-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');});
  });
}

function refresh(){
  var list=currentFiltered();
  if(currentView==='categories')renderCategoriesTable(list);
  else if(currentView==='genres')renderGenresTable(list);
  else renderTropesTable(list);
  renderPageInfo(list.length);
  renderStats();
}

function renderPopularGenres(){
  document.getElementById('genreGrid').innerHTML=POPULAR_GENRES.map(function(g){
    return'<div class="genre-card">'+
      '<div class="genre-ico" style="background:'+g.bg+';color:'+g.color+'"><i class="fas '+g.icon+'"></i></div>'+
      '<div class="genre-name">'+g.name+'</div>'+
      '<div class="genre-books">'+g.books+'</div>'+
      statusPillHtml('active')+
    '</div>';
  }).join('');
}

/* ── Tab switching ── */
document.querySelectorAll('.top-tab').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.top-tab').forEach(function(t){t.classList.remove('active')});
    tab.classList.add('active');
    currentView=tab.dataset.view;
    var titles={categories:'All Categories',genres:'All Genres',tropes:'All Tropes'};
    var adds={categories:'Add New Category',genres:'Add New Genre',tropes:'Add New Trope'};
    var phs={categories:'Search categories...',genres:'Search genres...',tropes:'Search tropes...'};
    document.getElementById('tableTitle').textContent=titles[currentView];
    document.getElementById('addBtnLabel').textContent=adds[currentView];
    document.getElementById('tableSearch').placeholder=phs[currentView];
    document.getElementById('tableSearch').value='';
    renderPagination();
    refresh();
  });
});

/* ── Table actions (edit/toggle/delete) ── */
document.getElementById('tableBody').addEventListener('click',function(e){
  var btn=e.target.closest('[data-action]');
  if(!btn)return;
  var action=btn.dataset.action;
  var idx=parseInt(btn.dataset.idx,10);
  if(action==='edit')openFormModal('edit',idx);
  else if(action==='toggle')doToggleStatus(idx);
  else if(action==='delete')openDeleteModal(idx);
});

/* ── FORM MODAL (Add / Edit) ── */
function openFormModal(action, idx){
  formMode={type:currentView, action:action, idx:idx};
  var isCat=currentView==='categories';
  var isTrope=currentView==='tropes';
  var isEdit=action==='edit';
  var kindLabel=isCat?' Category':(isTrope?' Trope':' Genre');
  document.getElementById('formModalTitle').textContent=(isEdit?'Edit':'Add')+kindLabel;
  document.getElementById('formConfirmLabel').textContent=isEdit?'Save Changes':'Add';
  document.getElementById('formDescGroup').style.display=isCat?'':'none';
  document.getElementById('formCatGroup').style.display=(!isCat&&!isTrope)?'block':'none';
  document.getElementById('formTropeGroup').style.display=isTrope?'block':'none';
  // Wipe leftover text immediately so a previous item's description can
  // never linger (e.g. opening Edit Genre after editing a category).
  // Category-edit repopulates it right below when needed.
  document.getElementById('formDesc').value='';
  if(isCat){
    if(isEdit){
      var c=CATEGORIES[idx];
      document.getElementById('formName').value=c.name;
      document.getElementById('formDesc').value=c.desc||'';
      document.getElementById('formStatus').value=c.status;
    }else{
      document.getElementById('formName').value='';
      document.getElementById('formDesc').value='';
      document.getElementById('formStatus').value='active';
    }
  }else if(isTrope){
    var genreSel=document.getElementById('formTropeGenre');
    genreSel.innerHTML='<option value="">Select genre…</option>';
    for(var k=0;k<GENRES.length;k++){
      var gopt=document.createElement('option');
      gopt.value=GENRES[k].name;
      gopt.textContent=GENRES[k].name;
      genreSel.appendChild(gopt);
    }
    if(isEdit){
      var t=TROPES[idx];
      document.getElementById('formName').value=t.name;
      for(var m=0;m<genreSel.options.length;m++){
        if(genreSel.options[m].value===t.genre){genreSel.selectedIndex=m;break;}
      }
      document.getElementById('formStatus').value=t.status;
    }else{
      document.getElementById('formName').value='';
      genreSel.selectedIndex=0;
      document.getElementById('formStatus').value='active';
    }
  }else{
    var catSel=document.getElementById('formCat');
    catSel.innerHTML='<option value="">Select category…</option>';
    for(var i=0;i<CATEGORIES.length;i++){
      var opt=document.createElement('option');
      opt.value=CATEGORIES[i].name;
      opt.textContent=CATEGORIES[i].name;
      catSel.appendChild(opt);
    }
    if(isEdit){
      var g=GENRES[idx];
      document.getElementById('formName').value=g.name;
      for(var j=0;j<catSel.options.length;j++){
        if(catSel.options[j].value===g.cat){catSel.selectedIndex=j;break;}
      }
      document.getElementById('formStatus').value=g.status;
    }else{
      document.getElementById('formName').value='';
      catSel.selectedIndex=0;
      document.getElementById('formStatus').value='active';
    }
  }
  document.getElementById('formModal').classList.add('open');
  setTimeout(function(){document.getElementById('formName').focus();},200);
}

document.getElementById('formModalClose').addEventListener('click',function(){document.getElementById('formModal').classList.remove('open')});
document.getElementById('formCancel').addEventListener('click',function(){document.getElementById('formModal').classList.remove('open')});
document.getElementById('formModal').addEventListener('click',function(e){if(e.target.id==='formModal')document.getElementById('formModal').classList.remove('open')});

document.getElementById('formConfirm').addEventListener('click',function(){
  var name=document.getElementById('formName').value.trim();
  if(!name){toast('Please enter a name.');return;}
  var isCat=formMode.type==='categories';
  var isTrope=formMode.type==='tropes';
  var isEdit=formMode.action==='edit';
  var status=document.getElementById('formStatus').value;
  if(isCat){
    var desc=document.getElementById('formDesc').value.trim();
    if(isEdit){
      var catPrev=CATEGORIES[formMode.idx];
      var catPrevStatus=catPrev?catPrev.status:null;
      CategoriesGenresService.updateCategory(formMode.idx,{name:name,desc:desc,status:status},CATEGORIES);
      toast('Category updated: '+name);
      if(catPrev&&catPrev.id){
        liveCall('/categories/'+catPrev.id,jsonOpts('PATCH',{name:name,desc:desc}));
        if(catPrevStatus!==status)liveCall('/categories/'+catPrev.id+'/toggle-status',jsonOpts('POST'));
      }
    }else{
      var newCat=CategoriesGenresService.addCategory({name:name,desc:desc,status:status},CATEGORIES);
      toast('Category added: '+name);
      if(newCat){
        liveCall('/categories',jsonOpts('POST',{name:name,desc:desc,icon:newCat.icon,bg:newCat.bg,color:newCat.color}))
          .then(function(created){ if(created&&created.id)newCat.id=created.id; });
      }
    }
  }else if(isTrope){
    var pgenre=document.getElementById('formTropeGenre').value;
    if(!pgenre){toast('Please select a genre.');return;}
    if(isEdit){
      var troPrev=TROPES[formMode.idx];
      CategoriesGenresService.updateTrope(formMode.idx,{name:name,genre:pgenre,status:status},TROPES);
      toast('Trope updated: '+name);
      if(troPrev&&troPrev.id)liveCall('/tropes/'+troPrev.id,jsonOpts('PATCH',{name:name,genre:pgenre,status:status}));
    }else{
      var newTro=CategoriesGenresService.addTrope({name:name,genre:pgenre,status:status},TROPES);
      toast('Trope added: '+name);
      if(newTro){
        liveCall('/tropes',jsonOpts('POST',{name:name,genre:pgenre,status:status}))
          .then(function(created){ if(created&&created.id)newTro.id=created.id; });
      }
    }
  }else{
    var cat=document.getElementById('formCat').value;
    if(!cat){toast('Please select a category.');return;}
    var catRow=null;
    for(var ci=0;ci<CATEGORIES.length;ci++){ if(CATEGORIES[ci].name===cat){catRow=CATEGORIES[ci];break;} }
    if(isEdit){
      var genPrev=GENRES[formMode.idx];
      var genPrevStatus=genPrev?genPrev.status:null;
      CategoriesGenresService.updateGenre(formMode.idx,{name:name,cat:cat,status:status},GENRES);
      toast('Genre updated: '+name);
      if(genPrev&&genPrev.id){
        var gPatch={name:name};
        if(catRow&&catRow.id)gPatch.categoryId=catRow.id;
        liveCall('/genres/'+genPrev.id,jsonOpts('PATCH',gPatch));
        if(genPrevStatus!==status)liveCall('/genres/'+genPrev.id+'/toggle-status',jsonOpts('POST'));
      }
    }else{
      var newGen=CategoriesGenresService.addGenre({name:name,cat:cat,status:status},GENRES);
      toast('Genre added: '+name);
      if(catRow&&catRow.id&&newGen){
        liveCall('/genres',jsonOpts('POST',{name:name,categoryId:catRow.id}))
          .then(function(created){ if(created&&created.id)newGen.id=created.id; });
      }else if(USE_API){
        console.warn('[CategoriesGenres] genre create skipped on backend: category "'+cat+'" has no live id');
      }
    }
  }
  document.getElementById('formModal').classList.remove('open');
  renderPagination();
  refresh();
});

/* ── TOGGLE STATUS ── */
function doToggleStatus(idx){
  if(currentView==='categories'){
    var c=CATEGORIES[idx];
    c.status=c.status==='active'?'inactive':'active';
    CategoriesGenresService.updateCategory(idx,{status:c.status},CATEGORIES);
    toast(c.name+' set to '+c.status);
    var catId=c.id;
    if(catId)liveCall('/categories/'+catId+'/toggle-status',jsonOpts('POST')).then(function(d){ if(d&&d.status)c.status=d.status; });
  }else if(currentView==='genres'){
    var g=GENRES[idx];
    g.status=g.status==='active'?'inactive':'active';
    CategoriesGenresService.updateGenre(idx,{status:g.status},GENRES);
    toast(g.name+' set to '+g.status);
    var genId=g.id;
    if(genId)liveCall('/genres/'+genId+'/toggle-status',jsonOpts('POST')).then(function(d){ if(d&&d.status)g.status=d.status; });
  }else{
    var t=TROPES[idx];
    t.status=t.status==='active'?'inactive':'active';
    CategoriesGenresService.updateTrope(idx,{status:t.status},TROPES);
    toast(t.name+' set to '+t.status);
    var troId=t.id;
    if(troId)liveCall('/tropes/'+troId+'/toggle-status',jsonOpts('POST')).then(function(d){ if(d&&d.status)t.status=d.status; });
  }
  refresh();
}

/* ── DELETE MODAL ── */
var deleteIdx=null;
function openDeleteModal(idx){
  deleteIdx=idx;
  var name=currentView==='categories'?CATEGORIES[idx].name:(currentView==='genres'?GENRES[idx].name:TROPES[idx].name);
  document.getElementById('deleteMsg').textContent='Are you sure you want to delete "'+name+'"? This cannot be undone.';
  document.getElementById('deleteModal').classList.add('open');
}
document.getElementById('deleteModalClose').addEventListener('click',function(){document.getElementById('deleteModal').classList.remove('open')});
document.getElementById('deleteCancel').addEventListener('click',function(){document.getElementById('deleteModal').classList.remove('open')});
document.getElementById('deleteModal').addEventListener('click',function(e){if(e.target.id==='deleteModal')document.getElementById('deleteModal').classList.remove('open')});

document.getElementById('deleteConfirm').addEventListener('click',function(){
  if(deleteIdx===null)return;
  var delPath=null;
  if(currentView==='categories'){
    var name=CATEGORIES[deleteIdx].name;
    delPath=CATEGORIES[deleteIdx].id?'/categories/'+CATEGORIES[deleteIdx].id:null;
    CategoriesGenresService.deleteCategory(deleteIdx,CATEGORIES);
    toast('Deleted category: '+name);
  }else if(currentView==='genres'){
    var name=GENRES[deleteIdx].name;
    delPath=GENRES[deleteIdx].id?'/genres/'+GENRES[deleteIdx].id:null;
    CategoriesGenresService.deleteGenre(deleteIdx,GENRES);
    toast('Deleted genre: '+name);
  }else{
    var name=TROPES[deleteIdx].name;
    delPath=TROPES[deleteIdx].id?'/tropes/'+TROPES[deleteIdx].id:null;
    CategoriesGenresService.deleteTrope(deleteIdx,TROPES);
    toast('Deleted trope: '+name);
  }
  if(delPath)liveCall(delPath,jsonOpts('DELETE'));
  deleteIdx=null;
  document.getElementById('deleteModal').classList.remove('open');
  renderPagination();
  refresh();
});

/* ── Add button ── */
document.getElementById('addBtn').addEventListener('click',function(){openFormModal('add',null);});

/* ── Search ── */
document.getElementById('tableSearch').addEventListener('input',refresh);

/* ── Toast (re-exposed on window for onclick="toast(...)" in markup) ── */
function toast(m){var t=document.getElementById('toastEl');if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:9000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)';document.body.appendChild(t);}
t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0';},2500);}
try{window.toast=toast;}catch(e){}

/* ═══ INIT body (was inline init()) ═══ */
  var live = null;
  if(USE_API){
    try { live = await loadLive(); }
    catch(e){ console.warn('[CategoriesGenres] live load failed, using demo data', e); }
    if(!live) console.warn('[CategoriesGenres] live load returned nothing, using demo data');
  }
  if(live){
    CATEGORIES=live.categories;
    GENRES=live.genres;
    TROPES=live.tropes;
    POPULAR_GENRES=live.popular;
  }else{
    CATEGORIES=CategoriesGenresService.getCategories();
    GENRES=CategoriesGenresService.getGenres();
    TROPES=CategoriesGenresService.getTropes();
    POPULAR_GENRES=CategoriesGenresService.getPopularGenres();
  }
  renderPagination();
  renderPopularGenres();
  refresh();
}
})();
