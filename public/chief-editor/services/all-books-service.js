/**
 * all-books-service.js — All Books page controller (migrated from all-books.html inline script).
 * Pure call-and-render: init() attaches the sidebar shell and renders from data.
 * Backend-ready: set USE_API=true and serve JSON under API_BASE;
 * demo paths (window.EditorDemo) keep working when USE_API=false.
 * Inline onclick handlers (viewBook/editBook/flagBook/goPage) are re-exposed on window.
 */
(function(){
'use strict';
if(window.AllBooksService) return;

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, opts);
  if(!res.ok) throw new Error('Backend error ' + res.status);
  return res.json();
}

function __allBooksMain(){
ChiefEditorSidebar.attach('#booksRoot',{
  activeItem:'all-books',
  title:'All Books',
  subtitle:'Browse every title on the platform',
  user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},
  notifCount:9,
  searchPlaceholder:'Search everything...',
});

(function(){
'use strict';

var D=window.EditorDemo||{};
var books=(D.BOOKS||[]).slice();
var activeTab='all';
var currentPage=1;
var PER_PAGE=12;

var GENRE_COLORS={};
(D.CATEGORIES||[]).forEach(function(c){GENRE_COLORS[c.name]={bg:c.bg,fg:c.color};});
(D.GENRES||[]).forEach(function(g){if(!GENRE_COLORS[g.name])GENRE_COLORS[g.name]={bg:g.bg,fg:g.color};});
GENRE_COLORS['Billionaire Romance']={bg:'#ece3fd',fg:'#7c5cfc'};
GENRE_COLORS['Werewolf Romance']={bg:'#eef0f2',fg:'#5b6470'};
GENRE_COLORS['Mafia Romance']={bg:'#e7e7ea',fg:'#26262b'};
GENRE_COLORS['Vampire Romance']={bg:'#fde3e3',fg:'#e0384d'};
GENRE_COLORS['Royal Romance']={bg:'#ece3fd',fg:'#7c5cfc'};
GENRE_COLORS['Second Chance']={bg:'#ffe1eb',fg:'#ff0050'};
GENRE_COLORS['Revenge']={bg:'#fde3e3',fg:'#e0384d'};
GENRE_COLORS['Family Drama']={bg:'#fef3d8',fg:'#d97706'};
GENRE_COLORS['Twist']={bg:'#ffe1eb',fg:'#ff0050'};
GENRE_COLORS['Betrayal']={bg:'#ffe1eb',fg:'#ff0050'};
GENRE_COLORS['Campus']={bg:'#e3ecfd',fg:'#2f7de1'};
GENRE_COLORS['Elegy']={bg:'#fde3e3',fg:'#e0384d'};

function statusClass(s){return{Published:'published',Draft:'draft','Under Review':'review',Flagged:'flagged'}[s]||'draft';}
function statusPillHtml(s){return'<span class="status-pill '+statusClass(s)+'"><span class="dot"></span>'+s+'</span>';}

function renderStats(){
  var t=books.length;
  var p=books.filter(function(x){return x.status==='Published';}).length;
  var d=books.filter(function(x){return x.status==='Draft';}).length;
  var f=books.filter(function(x){return x.status==='Flagged';}).length;
  var r=books.filter(function(x){return x.status==='Under Review';}).length;
  document.getElementById('statsGrid').innerHTML=
    '<div class="stat-card"><div class="stat-ico purple"><i class="fas fa-book"></i></div><div class="stat-body"><div class="stat-num">'+t+'</div><div class="stat-lbl">Total Books</div></div></div>'+
    '<div class="stat-card"><div class="stat-ico green"><i class="fas fa-circle-check"></i></div><div class="stat-body"><div class="stat-num">'+p+'</div><div class="stat-lbl">Published</div></div></div>'+
    '<div class="stat-card"><div class="stat-ico amber"><i class="fas fa-clock"></i></div><div class="stat-body"><div class="stat-num">'+d+'</div><div class="stat-lbl">Drafts</div></div></div>'+
    '<div class="stat-card"><div class="stat-ico red"><i class="fas fa-flag"></i></div><div class="stat-body"><div class="stat-num">'+f+'</div><div class="stat-lbl">Flagged</div></div></div>'+
    '<div class="stat-card"><div class="stat-ico blue"><i class="fas fa-hourglass-half"></i></div><div class="stat-body"><div class="stat-num">'+r+'</div><div class="stat-lbl">Under Review</div></div></div>';
}

function renderTabs(){
  var counts={all:books.length};
  ['Published','Draft','Under Review','Flagged'].forEach(function(s){counts[s]=books.filter(function(b){return b.status===s;}).length;});
  document.getElementById('countAll').textContent=counts.all;
  document.querySelectorAll('.tab-item').forEach(function(t){
    var k=t.dataset.tab;
    var c=t.querySelector('.tab-count');
    if(c&&counts[k]!==undefined)c.textContent=counts[k];
  });
}

function refresh(){
  var q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();
  var genre=document.getElementById('fGenre').value;
  var stat=document.getElementById('fStatus').value;

  var filtered=books.filter(function(b){
    if(activeTab!=='all'&&b.status!==activeTab)return false;
    if(genre!=='All Genres'&&b.genre!==genre)return false;
    if(stat!=='All Status'&&b.status!==stat)return false;
    if(q&&b.title.toLowerCase().indexOf(q)===-1&&b.author.toLowerCase().indexOf(q)===-1&&b.id.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });

  renderTable(filtered);
  renderStats();
  renderTabs();
}

function renderTable(list){
  var body=document.getElementById('tableBody');
  var total=list.length;
  var totalPages=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>totalPages)currentPage=totalPages;
  var start=(currentPage-1)*PER_PAGE;
  var page=list.slice(start,start+PER_PAGE);

  if(!page.length){
    body.innerHTML='<tr class="empty-row"><td colspan="7"><i class="fas fa-inbox"></i> No books match this filter.</td></tr>';
  }else{
    body.innerHTML=page.map(function(b){
      var gc=GENRE_COLORS[b.genre]||GENRE_COLORS[b.cat]||{bg:'var(--table-head)',fg:'var(--text-muted)'};
      return'<tr>'+
        '<td data-label="Book Details"><div class="book-cell"><div class="book-cover"><img src="'+b.img+'" alt=""/></div><div><div class="book-title">'+b.title+'</div><div class="book-id">ID: '+b.id+'</div></div></div></td>'+
        '<td data-label="Author"><div class="author-cell"><img src="'+b.avatar+'" alt=""/><span class="author-name">'+b.author+'</span></div></td>'+
        '<td data-label="Genre"><div class="cat-main"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:'+gc.bg+';color:'+gc.fg+'">'+b.genre+'</span></div></td>'+
        '<td data-label="Status">'+statusPillHtml(b.status)+'</td>'+
        '<td data-label="Reads" class="views-cell">'+b.views+'</td>'+
        '<td data-label="Rating" class="muted-cell">★ '+(b.rating==null?'—':b.rating)+'</td>'+
        '<td data-label="Actions"><div class="actions-cell">'+
          '<button class="act-btn" title="View" onclick="viewBook(\''+b.id+'\')"><i class="fas fa-eye"></i></button>'+
          '<button class="act-btn" title="Edit" onclick="editBook(\''+b.id+'\')"><i class="fas fa-pen"></i></button>'+
          '<button class="act-btn danger" title="Flag" onclick="flagBook(\''+b.id+'\')"><i class="fas fa-flag"></i></button>'+
        '</div></td></tr>';
    }).join('');
  }

  var pageInfo=document.getElementById('pageInfo');
  pageInfo.innerHTML=total
    ?'Showing <b>'+(start+1)+'</b> to <b>'+Math.min(start+PER_PAGE,total)+'</b> of <b>'+total.toLocaleString()+'</b> books'
    :'No books found';
  renderPagination(totalPages);
}

function renderPagination(tp){
  var w=document.getElementById('pageBtns');
  if(tp<=1){w.innerHTML='';return;}
  var h='<button class="pg-btn"'+(currentPage<=1?' disabled':'')+' onclick="goPage('+(currentPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
  var sP=Math.max(1,currentPage-2);
  var eP=Math.min(tp,currentPage+2);
  if(sP>1)h+='<button class="pg-btn" onclick="goPage(1)">1</button>'+(sP>2?'<span class="pg-dots">…</span>':'');
  for(var i=sP;i<=eP;i++){
    h+='<button class="pg-btn'+(i===currentPage?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
  }
  if(eP<tp)h+=(eP<tp-1?'<span class="pg-dots">…</span>':'')+'<button class="pg-btn" onclick="goPage('+tp+')">'+tp+'</button>';
  h+='<button class="pg-btn"'+(currentPage>=tp?' disabled':'')+' onclick="goPage('+(currentPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML=h;
}

function goPage(p){currentPage=p;refresh();window.scrollTo({top:0,behavior:'smooth'});}

function viewBook(id){window.location.href='../author/book-workspace.html?book='+encodeURIComponent(id);}
function editBook(id){window.location.href='../author/book-workspace.html?book='+encodeURIComponent(id)+'&mode=edit';}
function flagBook(id){
  var b=books.find(function(x){return x.id===id;});
  if(b){b.status=b.status==='Flagged'?'Published':'Flagged';refresh();toast(b.title+' → '+b.status);}
}

function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2200);}

/* Populate genre filter */
(function(){
  var genres={};
  books.forEach(function(b){if(b.genre)genres[b.genre]=1;});
  var sel=document.getElementById('fGenre');
  Object.keys(genres).sort().forEach(function(g){var o=document.createElement('option');o.textContent=g;o.value=g;sel.appendChild(o);});
})();

/* Bind events */
document.querySelectorAll('.tab-item').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.tab-item').forEach(function(t){t.classList.remove('active');});
    tab.classList.add('active');
    activeTab=tab.dataset.tab;
    currentPage=1;
    refresh();
  });
});
document.getElementById('tableSearch').addEventListener('input',function(){currentPage=1;refresh();});
document.getElementById('fGenre').addEventListener('change',function(){currentPage=1;refresh();});
document.getElementById('fStatus').addEventListener('change',function(){currentPage=1;refresh();});

/* Expose for inline onclick */
window.goPage=goPage;
window.viewBook=viewBook;
window.editBook=editBook;
window.flagBook=flagBook;

/* Init */
renderStats();
renderTabs();
refresh();

})();
}

var _abInited = false;
function init(){
  if(_abInited) return;
  _abInited = true;
  __allBooksMain();
}

window.AllBooksService = { init: init };
})();
