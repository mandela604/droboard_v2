/**
 * categories-genres-service.js — Data layer for Categories & Genres page
 * Reads from window.EditorDemo.CATEGORIES / GENRES / POPULAR_GENRES
 */
(function(){
'use strict';
if(window.__catGenreService) return;
window.__catGenreService = true;

/* Demo-data self-load: page HTML no longer includes ../data/editor-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.EditorDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="../data/editor-demo-data.js"><\/script>');
}

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, opts||{});
  if(!res.ok) throw new Error('backend ' + res.status);
  return res.json();
}

function getDemo(){
  var D = window.EditorDemo || {};
  return {
    categories: JSON.parse(JSON.stringify(D.CATEGORIES || [])),
    genres: JSON.parse(JSON.stringify(D.GENRES || [])),
    popularGenres: JSON.parse(JSON.stringify(D.POPULAR_GENRES || []))
  };
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

  openFullGenreList: function(){
    if(typeof window.toast==='function'){ try{ window.toast('Opening full genre list…'); return; }catch(e){} }
  }
};

/* ═══ Page UI layer (migrated verbatim from categories-genres.html inline script) ═══ */
var _cgInitDone = false;
function init(){
  if(_cgInitDone) return;
  _cgInitDone = true;

SeniorEditorSidebar.attach('#dashboardRoot',{
  activeItem:'categories-genres',title:'Categories & Genres',subtitle:'Organize and manage all categories and genres',
  user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,
  searchPlaceholder:'Search by category or genre name...',mobileSearchTarget:'#tableSearch',
  onSearch:function(v){document.getElementById('tableSearch').value=v;refresh();}
});

var CATEGORIES=[], GENRES=[], POPULAR_GENRES=[];
var currentView='categories';
var formMode={type:null, action:null, idx:null};

function statusPillHtml(s){
  var active=s==='active';
  return'<span class="status-pill'+(active?'':' inactive')+'"><span class="dot"></span>'+(active?'Active':'Inactive')+'</span>';
}

function renderStats(){
  var totalCat=CATEGORIES.length;
  var totalGen=GENRES.length;
  var activeCat=CATEGORIES.filter(function(c){return c.status==='active'}).length;
  var activeGen=GENRES.filter(function(g){return g.status==='active'}).length;
  var pct=totalCat+totalGen>0?Math.round((activeCat+activeGen)/(totalCat+totalGen)*100):0;
  document.getElementById('statsGrid').innerHTML=
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico purple"><i class="fas fa-grip"></i></div></div><div class="stat-num">'+totalCat+'</div><div class="stat-lbl">Total Categories</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico green"><i class="fas fa-book"></i></div></div><div class="stat-num">'+totalGen+'</div><div class="stat-lbl">Total Genres</div></div>'+
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
  document.getElementById('tableHead').innerHTML='<tr><th>Genre Name</th><th>Category</th><th>Books</th><th>Status</th><th>Actions</th></tr>';
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="5"><i class="fas fa-inbox"></i>No genres match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(g){
    var idx=GENRES.indexOf(g);
    return'<tr>'+
      '<td data-label="Genre Name"><div class="cat-cell"><div class="cat-icn" style="background:'+g.bg+';color:'+g.color+'"><i class="fas '+g.icon+'"></i></div><div class="cat-name">'+g.name+'</div></div></td>'+
      '<td data-label="Category" class="plain-cell">'+g.cat+'</td>'+
      '<td data-label="Books" class="plain-cell">'+g.books+'</td>'+
      '<td data-label="Status">'+statusPillHtml(g.status)+'</td>'+
      '<td data-label="Actions"><div class="actions-cell">'+
        '<button class="act-btn" title="Edit" data-action="edit" data-idx="'+idx+'"><i class="fas fa-pen"></i></button>'+
        '<button class="act-btn" title="Toggle Status" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-toggle-on"></i></button>'+
        '<button class="act-btn" title="Delete" data-action="delete" data-idx="'+idx+'"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}

function currentFiltered(){
  var q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();
  var source=currentView==='categories'?CATEGORIES:GENRES;
  if(!q)return source;
  return source.filter(function(x){return x.name.toLowerCase().indexOf(q)!==-1||(x.desc&&x.desc.toLowerCase().indexOf(q)!==-1)||(x.cat&&x.cat.toLowerCase().indexOf(q)!==-1);});
}

function renderPageInfo(count){
  var label=currentView==='categories'?'categories':'genres';
  var total=currentView==='categories'?CATEGORIES.length:GENRES.length;
  var shown=Math.min(8,count);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(count?1:0)+'</b> to <b>'+shown+'</b> of <b>'+total+'</b> '+label;
}

function renderPagination(){
  var wrap=document.getElementById('pageBtns');
  var total=currentView==='categories'?CATEGORIES.length:GENRES.length;
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
  else renderGenresTable(list);
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
    document.getElementById('tableTitle').textContent=currentView==='categories'?'All Categories':'All Genres';
    document.getElementById('addBtnLabel').textContent=currentView==='categories'?'Add New Category':'Add New Genre';
    document.getElementById('tableSearch').placeholder=currentView==='categories'?'Search categories...':'Search genres...';
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
  var isEdit=action==='edit';
  document.getElementById('formModalTitle').textContent=(isEdit?'Edit':'Add')+(isCat?' Category':' Genre');
  document.getElementById('formConfirmLabel').textContent=isEdit?'Save Changes':'Add';
  document.getElementById('formDescGroup').style.display=isCat?'':'none';
  document.getElementById('formCatGroup').style.display=isCat?'none':'block';
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
  var isEdit=formMode.action==='edit';
  var status=document.getElementById('formStatus').value;
  if(isCat){
    var desc=document.getElementById('formDesc').value.trim();
    if(isEdit){
      CategoriesGenresService.updateCategory(formMode.idx,{name:name,desc:desc,status:status},CATEGORIES);
      toast('Category updated: '+name);
    }else{
      CategoriesGenresService.addCategory({name:name,desc:desc,status:status},CATEGORIES);
      toast('Category added: '+name);
    }
  }else{
    var cat=document.getElementById('formCat').value;
    if(!cat){toast('Please select a category.');return;}
    if(isEdit){
      CategoriesGenresService.updateGenre(formMode.idx,{name:name,cat:cat,status:status},GENRES);
      toast('Genre updated: '+name);
    }else{
      CategoriesGenresService.addGenre({name:name,cat:cat,status:status},GENRES);
      toast('Genre added: '+name);
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
  }else{
    var g=GENRES[idx];
    g.status=g.status==='active'?'inactive':'active';
    CategoriesGenresService.updateGenre(idx,{status:g.status},GENRES);
    toast(g.name+' set to '+g.status);
  }
  refresh();
}

/* ── DELETE MODAL ── */
var deleteIdx=null;
function openDeleteModal(idx){
  deleteIdx=idx;
  var name=currentView==='categories'?CATEGORIES[idx].name:GENRES[idx].name;
  document.getElementById('deleteMsg').textContent='Are you sure you want to delete "'+name+'"? This cannot be undone.';
  document.getElementById('deleteModal').classList.add('open');
}
document.getElementById('deleteModalClose').addEventListener('click',function(){document.getElementById('deleteModal').classList.remove('open')});
document.getElementById('deleteCancel').addEventListener('click',function(){document.getElementById('deleteModal').classList.remove('open')});
document.getElementById('deleteModal').addEventListener('click',function(e){if(e.target.id==='deleteModal')document.getElementById('deleteModal').classList.remove('open')});

document.getElementById('deleteConfirm').addEventListener('click',function(){
  if(deleteIdx===null)return;
  if(currentView==='categories'){
    var name=CATEGORIES[deleteIdx].name;
    CategoriesGenresService.deleteCategory(deleteIdx,CATEGORIES);
    toast('Deleted category: '+name);
  }else{
    var name=GENRES[deleteIdx].name;
    CategoriesGenresService.deleteGenre(deleteIdx,GENRES);
    toast('Deleted genre: '+name);
  }
  deleteIdx=null;
  document.getElementById('deleteModal').classList.remove('open');
  renderPagination();
  refresh();
});

/* ── Add button ── */
document.getElementById('addBtn').addEventListener('click',function(){openFormModal('add',null);});

/* ── Search ── */
document.getElementById('tableSearch').addEventListener('input',refresh);

/* ── Toast ── */
function toast(m){var t=document.getElementById('toastEl');if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:9000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)';document.body.appendChild(t);}
t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0';},2500);}

/* ═══ INIT ═══ */
function initPageData(){
  CATEGORIES=CategoriesGenresService.getCategories();
  GENRES=CategoriesGenresService.getGenres();
  POPULAR_GENRES=CategoriesGenresService.getPopularGenres();
  renderPagination();
  renderPopularGenres();
  refresh();
}
initPageData();
  // markup uses onclick="toast(...)" — expose globally (inline defined window-level toast)
  try{ window.toast = toast; }catch(e){}
  try{ window.refresh = refresh; }catch(e){}
}
window.CategoriesGenresService.init = init;

})();
