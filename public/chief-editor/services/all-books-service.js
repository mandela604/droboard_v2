/**
 * all-books-service.js — All Books page controller (migrated from all-books.html inline script).
 * Pure call-and-render: init() attaches the sidebar shell and renders from data.
 * Backend-ready: set USE_API=true and serve JSON under API_BASE;
 * demo paths (window.EditorDemo) keep working when USE_API=false.
 * Inline onclick handlers (viewBook/editBook/flagBook/unflagBook/goPage) are re-exposed on window.
 * Flagging matches senior-editor book-management: modal with reason + details + password,
 * demo mode stores flagPrevStatus/flagReason/flagNote, unflag restores prior status.
 */
(function(){
'use strict';
if(window.AllBooksService) return;

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief';
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

function statusClass(s){return{Published:'published',Draft:'draft',Paused:'paused','Under Review':'review',Flagged:'flagged'}[s]||'draft';}
function statusPillHtml(s){return'<span class="status-pill '+statusClass(s)+'"><span class="dot"></span>'+s+'</span>';}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ── Flag / unflag (same process as senior-editor book-management) ── */
var FLAG_REASONS=[
  'Plagiarism / stolen content',
  'Copyright infringement',
  'Adult / NSFW content',
  'Violence or hate speech',
  'Spam or scam',
  'Misleading title or cover',
  'Other (see details)'
];
var modalBookId=null, modalMode='flag';

function flagApi(id,payload){
  return callBackend('/books/'+encodeURIComponent(id)+'/flag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    .then(function(remote){var b=books.find(function(x){return x.id===id;});if(b){b.flagPrevStatus=b.status;b.status='Flagged';b.flagReason=payload.reason;b.flagNote=payload.note||'';}return remote||b;});
}
function unflagApi(id,payload){
  return callBackend('/books/'+encodeURIComponent(id)+'/unflag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})})
    .then(function(remote){var b=books.find(function(x){return x.id===id;});if(b){b.status=b.flagPrevStatus&&b.flagPrevStatus!=='Flagged'?b.flagPrevStatus:'Published';b.flagReason='';b.flagNote='';}return remote||b;});
}

function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
function closeBmFlag(){closeOverlay('bmFlagOv');}
function submitBmFlag(){submitFlag();}

function ensureFlagModal(){
  if(document.getElementById('bmFlagOv'))return;
  var css=''+
    '.bm-ov{position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}.bm-ov.open{display:flex}'+
    '.bm-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:430px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px;animation:bmIn .18s ease}'+
    '@keyframes bmIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}'+
    '.bm-modal-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}'+
    '.bm-modal-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}.bm-modal-ico.red{background:var(--red-bg);color:var(--red)}.bm-modal-ico.green{background:var(--green-bg);color:var(--green)}'+
    '.bm-modal-title{font-size:15px;font-weight:800}.bm-modal-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}'+
    '.bm-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}.bm-x:hover{color:var(--red);border-color:var(--red)}'+
    '.bm-label{font-size:11px;font-weight:700;display:block;margin-bottom:5px}.bm-label span{color:var(--red)}'+
    '.bm-field{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;margin-bottom:12px}.bm-field:focus{border-color:var(--accent)}'+
    'select.bm-field{appearance:none;cursor:pointer}'+
    'textarea.bm-field{resize:vertical;min-height:64px}'+
    '.bm-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px}'+
    '.bm-err{font-size:11.5px;color:var(--red);font-weight:600;min-height:16px;margin-bottom:8px}'+
    '.bm-actions{display:flex;gap:8px;justify-content:flex-end}'+
    '.bm-btn{font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;transition:.12s}.bm-btn:hover{border-color:var(--accent);color:var(--accent)}.bm-btn.primary{background:var(--accent);border-color:transparent;color:#fff}.bm-btn.danger{background:var(--red);border-color:transparent;color:#fff}.bm-btn:disabled{opacity:.5;cursor:default}'+
    '.flag-mini{font-size:10px;color:var(--red);font-weight:600;margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
  var style=document.createElement('style');
  style.id='bmModalCss';
  style.textContent=css;
  document.head.appendChild(style);

  var wrap=document.createElement('div');
  wrap.innerHTML=''+
    '<div class="bm-ov" id="bmFlagOv">'+
      '<div class="bm-modal">'+
        '<div class="bm-modal-head">'+
          '<div class="bm-modal-ico red" id="bmFlagIco"><i class="fas fa-flag"></i></div>'+
          '<div><div class="bm-modal-title" id="bmFlagHeading">Flag Book</div><div class="bm-modal-sub" id="bmFlagBook"></div></div>'+
          '<div class="bm-x" onclick="closeBmFlag()"><i class="fas fa-xmark"></i></div>'+
        '</div>'+
        '<div class="bm-hint" id="bmFlagHint"></div>'+
        '<div id="bmFlagReasonWrap">'+
          '<label class="bm-label">Reason <span>*</span></label>'+
          '<select class="bm-field" id="bmFlagReason">'+
            '<option value="">Select a reason\u2026</option>'+
            FLAG_REASONS.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('')+
          '</select>'+
        '</div>'+
        '<div id="bmFlagNoteWrap">'+
          '<label class="bm-label">Details <span style="color:var(--text-faint)">(optional)</span></label>'+
          '<textarea class="bm-field" id="bmFlagNote" placeholder="Chapter links, screenshots described, context\u2026"></textarea>'+
        '</div>'+
        '<label class="bm-label">Your password <span>*</span></label>'+
        '<input type="password" class="bm-field" id="bmFlagPass" placeholder="Enter password to confirm" autocomplete="current-password"/>'+
        '<div class="bm-err" id="bmFlagErr"></div>'+
        '<div class="bm-actions">'+
          '<button class="bm-btn" onclick="closeBmFlag()">Cancel</button>'+
          '<button class="bm-btn danger" id="bmFlagSubmit" onclick="submitBmFlag()"><i class="fas fa-flag"></i> Flag Book</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  document.getElementById('bmFlagOv').addEventListener('click',function(e){if(e.target===this)closeOverlay('bmFlagOv');});
  document.getElementById('bmFlagPass').addEventListener('keydown',function(e){if(e.key==='Enter')submitFlag();});
}

function openFlagModal(id,mode,b){
  modalBookId=id;
  modalMode=mode;
  var isFlag=mode==='flag';
  document.getElementById('bmFlagIco').className='bm-modal-ico '+(isFlag?'red':'green');
  document.getElementById('bmFlagIco').innerHTML='<i class="fas fa-flag'+(isFlag?'':'-circle-check')+'"></i>';
  document.getElementById('bmFlagHeading').textContent=isFlag?'Flag Book':'Unflag Book';
  document.getElementById('bmFlagBook').textContent=b.title;
  document.getElementById('bmFlagReasonWrap').style.display=isFlag?'':'none';
  document.getElementById('bmFlagNoteWrap').style.display=isFlag?'':'none';
  document.getElementById('bmFlagHint').textContent=isFlag
    ?'A reason is required. Confirm with your account password \u2014 this action is logged.'
    :'Confirm with your account password to restore this book.';
  document.getElementById('bmFlagReason').value='';
  document.getElementById('bmFlagNote').value='';
  document.getElementById('bmFlagPass').value='';
  document.getElementById('bmFlagErr').textContent='';
  var btn=document.getElementById('bmFlagSubmit');
  btn.innerHTML='<i class="fas fa-flag"></i> '+(isFlag?'Flag Book':'Unflag Book');
  btn.className='bm-btn '+(isFlag?'danger':'primary');
  openOverlay('bmFlagOv');
}

async function submitFlag(){
  var b=books.find(function(x){return x.id===modalBookId;});if(!b)return;
  var errEl=document.getElementById('bmFlagErr');
  errEl.textContent='';
  var reason=modalMode==='flag'?document.getElementById('bmFlagReason').value:'';
  var note=modalMode==='flag'?document.getElementById('bmFlagNote').value.trim():'';
  var pass=document.getElementById('bmFlagPass').value;
  if(modalMode==='flag'&&!reason){errEl.textContent='Select a reason for flagging.';return;}
  if(!pass){errEl.textContent='Enter your password to confirm.';return;}
  if(!USE_API&&pass.length<4){errEl.textContent='Demo mode: password must be at least 4 characters.';return;}
  var btn=document.getElementById('bmFlagSubmit');
  btn.disabled=true;
  try{
    if(modalMode==='flag')await flagApi(modalBookId,{reason:reason,note:note,password:pass});
    else await unflagApi(modalBookId,{password:pass});
    closeOverlay('bmFlagOv');
    toast(b.title+(modalMode==='flag'?' flagged':' unflagged'));
    refresh();
  }catch(e){
    errEl.textContent=e.status===401?'Incorrect password.':(e.message||'Action failed.');
  }finally{btn.disabled=false;}
}

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
  ['Published','Paused','Under Review','Flagged'].forEach(function(s){counts[s]=books.filter(function(b){return b.status===s;}).length;});
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
      var isF=b.status==='Flagged';
      return'<tr>'+
        '<td data-label="Book Details"><div class="book-cell"><div class="book-cover"><img src="'+b.img+'" alt=""/></div><div><div class="book-title">'+b.title+'</div><div class="book-id">ID: '+b.id+'</div></div></div></td>'+
        '<td data-label="Author"><div class="author-cell"><img src="'+b.avatar+'" alt=""/><span class="author-name">'+b.author+'</span></div></td>'+
        '<td data-label="Genre"><div class="cat-main"><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:'+gc.bg+';color:'+gc.fg+'">'+b.genre+'</span></div></td>'+
        '<td data-label="Status">'+statusPillHtml(b.status)+(isF&&b.flagReason?'<div class="flag-mini" title="'+esc(b.flagNote||b.flagReason)+'"><i class="fas fa-flag"></i> '+esc(b.flagReason)+'</div>':'')+'</td>'+
        '<td data-label="Reads" class="views-cell">'+b.views+'</td>'+
        '<td data-label="Rating" class="muted-cell">★ '+(b.rating==null?'—':b.rating)+'</td>'+
        '<td data-label="Actions"><div class="actions-cell">'+
          '<button class="act-btn" title="View" onclick="viewBook(\''+b.id+'\')"><i class="fas fa-eye"></i></button>'+
          '<button class="act-btn" title="Edit" onclick="editBook(\''+b.id+'\')"><i class="fas fa-pen"></i></button>'+
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
  if(b)openFlagModal(id,'flag',b);
}
function unflagBook(id){
  var b=books.find(function(x){return x.id===id;});
  if(b)openFlagModal(id,'unflag',b);
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
window.unflagBook=unflagBook;
window.closeBmFlag=closeBmFlag;
window.submitBmFlag=submitBmFlag;
document.addEventListener('keydown',function(e){
  if(e.key==='Escape')closeOverlay('bmFlagOv');
});

/* Init */
ensureFlagModal();
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
