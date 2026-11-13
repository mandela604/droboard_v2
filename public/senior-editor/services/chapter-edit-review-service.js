/**
 * chapter-edit-review-service.js — Chapter Edit Review page logic (pure call-and-render) *   GET  /api/senior-editor/chapter-edits           list
 *   POST /api/senior-editor/chapter-edits/:id/approve
 *   POST /api/senior-editor/chapter-edits/:id/reject   { note }
 */
(function(){
'use strict';
var USE_API=true;
var API_BASE='/api/senior-editor';

function authHeaders(){
  var h={'Content-Type':'application/json'};
  var t=null;
  try{t=localStorage.getItem('dro_access_token')||sessionStorage.getItem('dro_access_token');}catch(e){}
  if(t)h['Authorization']='Bearer '+t;
  return h;
}
async function callBackend(path,options){
  if(!USE_API)return null;
  var res=await fetch(API_BASE+path,Object.assign({credentials:'include'},options||{}));
  if(!res.ok){
    var body=await res.json().catch(function(){return {};});
    var err=new Error(body.error||('HTTP '+res.status));
    err.status=res.status;
    throw err;
  }
  return res.json();
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
var LIVE=false;

/* ══════════════════════════════════════════════════════════════
   CRUD layer — every decision the page performs lives here.
   Demo mode fakes a short latency so the button loader is visible;
   USE_API=true hits the real backend and waits for the real resolve.
   ══════════════════════════════════════════════════════════════ */
var Crud={
  list:async function(query){
    var qs=[];
    if(query&&query.status)qs.push('status='+encodeURIComponent(query.status));
    if(query&&query.q)qs.push('q='+encodeURIComponent(query.q));
    var remote=await callBackend('/chapter-edits'+(qs.length?'?'+qs.join('&'):''));
    if(remote&&remote.items){LIVE=true;items=remote.items.map(fromApiItem);}
    return items;
  },
  approve:async function(id){
    var res=await callBackend('/chapter-edits/'+encodeURIComponent(id)+'/approve',{method:'POST',headers:authHeaders()});
    var a=items.find(function(x){return x.id===id;});
    if(a)a.status='approved';
    return res;
  },
  reject:async function(id,reason){
    var res=await callBackend('/chapter-edits/'+encodeURIComponent(id)+'/reject',{
      method:'POST',headers:authHeaders(),body:JSON.stringify({note:reason}),
    });
    var a=items.find(function(x){return x.id===id;});
    if(a){a.status='rejected';a.reviewNote=reason;}
    return res;
  },
};

function fromApiItem(d){
  return{
    id:d.id,
    author:d.authorName||d.author||'—',
    avatar:d.avatar||'../assets/droboard-icon.png',
    book:d.bookTitle||d.book||'—',
    chapter:d.chapterLabel||d.chapter||('Ch.'+(d.n||'')),
    words:typeof d.wordsChanged==='number'?d.wordsChanged.toLocaleString():(d.words||'—'),
    editType:d.editType||d.type||'Edit',
    submitted:d.submitted||'—',
    status:d.status||'pending',
    authorNote:d.authorNote||d.note||'',
    reviewNote:d.reviewNote||'',
  };
}

var items=[];

var currentPage=1,PER_PAGE=5,openRowId=null,busyId=null;
var rejectTargetId=null, submitting=false;
var _bound=false;

function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function filtered(){
  var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  var st=document.getElementById('statusFilter').value;
  return items.filter(function(a){
    if(st&&a.status!==st)return false;
    if(q&&a.author.toLowerCase().indexOf(q)===-1&&a.book.toLowerCase().indexOf(q)===-1&&a.id.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
}
function updateStats(){
  var p=0,ap=0,r=0,t=items.length;
  items.forEach(function(a){if(a.status==='pending')p++;else if(a.status==='approved')ap++;else if(a.status==='rejected')r++;});
  document.getElementById('statPending').textContent=p;
  document.getElementById('statApproved').textContent=ap;
  document.getElementById('statRejected').textContent=r;
  document.getElementById('statTotal').textContent=t;
}
function statusPill(s){
  var icons={pending:'fa-clock',approved:'fa-check-circle',rejected:'fa-times-circle'};
  return'<span class="status-pill '+s+'"><i class="fas '+icons[s]+'"></i>'+s.charAt(0).toUpperCase()+s.slice(1)+'</span>';
}

/* Row/detail action buttons — spinner + disabled while busyId matches */
function rowActionsHtml(a){
  if(a.status!=='pending')return'';
  if(busyId===a.id){
    return'<div class="actions-cell"><button class="btn btn-busy" disabled><i class="fas fa-spinner fa-spin"></i></button></div>';
  }
  return'<div class="actions-cell">'+
    '<button class="btn btn-green" title="Approve" onclick="event.stopPropagation();approve(\''+esc(a.id)+'\')"><i class="fas fa-check"></i></button>'+
    '<button class="btn btn-danger" title="Reject" onclick="event.stopPropagation();reject(\''+esc(a.id)+'\')"><i class="fas fa-xmark"></i></button>'+
    '</div>';
}

function render(){
  updateStats();
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>tp)currentPage=tp;
  var start=(currentPage-1)*PER_PAGE,page=list.slice(start,start+PER_PAGE);
  var body=document.getElementById('tableBody');
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-pen-to-square"></i>No chapter edits match your filters.</div>';document.getElementById('pageBtns').innerHTML='';document.getElementById('pageInfo').innerHTML='';return;}
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    return '<div>'+
      '<div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+esc(a.id)+'">'+
        '<div class="expand-ico"><i class="fas fa-chevron-right"></i></div>'+
        '<div class="author-cell col-book"><img src="'+esc(a.avatar)+'" alt=""/><div class="author-info"><span class="author-name">'+esc(a.author)+'</span><span class="author-id">'+esc(a.id)+'</span></div></div>'+
        '<div class="book-cell col-chapters"><span class="book-title">'+esc(a.book)+'</span><span class="book-chapter">'+esc(a.chapter)+' · '+esc(a.editType)+'</span></div>'+
        '<div class="words-badge"><i class="fas fa-font"></i>'+esc(a.words)+'</div>'+
        '<div>'+statusPill(a.status)+'</div>'+
        rowActionsHtml(a)+
      '</div>'+
      '<div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+esc(a.id)+'"></div>'+
    '</div>';
  }).join('');
  if(openRowId&&page.some(function(a){return a.id===openRowId;}))renderDetail(openRowId);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(start+1)+'</b> – <b>'+Math.min(start+PER_PAGE,total)+'</b> of <b>'+total+'</b> requests';
  renderPag(tp);
}

function renderDetail(id){
  var a=items.find(function(x){return x.id===id;});if(!a)return;
  var p=document.getElementById('detail-'+id);if(!p)return;
  var isDone=a.status!=='pending';
  var isBusy=busyId===a.id;
  var bookSlug=String(a.book||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  var chNum=String(a.chapter||'').replace(/[^0-9]/g,'')||'1';
  var chHref='../author/edit-chapter.html?book='+encodeURIComponent(bookSlug)+'&chapter='+encodeURIComponent(chNum)+'&viewer=editor';
  var actionsHtml='';
  if(isBusy){
    actionsHtml='<button class="btn btn-text btn-busy" disabled><i class="fas fa-spinner fa-spin"></i> Processing…</button>';
  }else if(isDone){
    actionsHtml='<a class="btn btn-text btn-ghost" href="'+chHref+'"><i class="fas fa-eye"></i> View Chapter</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }else{
    actionsHtml='<button class="btn btn-text btn-green" onclick="approve(\''+esc(a.id)+'\')"><i class="fas fa-check"></i> Approve Edit</button>'+
      '<button class="btn btn-text btn-danger" onclick="reject(\''+esc(a.id)+'\')"><i class="fas fa-xmark"></i> Reject</button>'+
      '<a class="btn btn-text btn-ghost" href="'+chHref+'"><i class="fas fa-eye"></i> View Chapter</a>'+
      '<a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }
  var reviewHtml='';
  if(a.status==='rejected'&&a.reviewNote){
    reviewHtml='<div class="detail-notes-box" style="border-color:var(--red);background:var(--red-bg)"><div class="lbl" style="color:var(--red)"><i class="fas fa-ban"></i> Rejection Reason</div><p style="color:var(--red)">'+esc(a.reviewNote)+'</p></div>';
  }
  p.innerHTML='<div class="detail-inner">'+
    '<div class="detail-header"><img class="detail-avatar" src="'+esc(a.avatar)+'" alt=""/><div class="detail-title"><h3>'+esc(a.author)+'</h3><p>'+esc(a.id)+' · '+esc(a.editType)+'</p></div>'+statusPill(a.status)+'</div>'+
    '<div class="detail-grid"><div class="detail-card"><label>Book</label><b>'+esc(a.book)+'</b></div><div class="detail-card"><label>Chapter</label><b>'+esc(a.chapter)+'</b></div><div class="detail-card accent"><label>Words Changed</label><b>'+esc(a.words)+'</b></div><div class="detail-card"><label>Submitted</label><b>'+esc(a.submitted)+'</b></div></div>'+
    '<div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Author\'s Note</div><p>'+esc(a.authorNote)+'</p></div>'+
    reviewHtml+
    '<div class="detail-actions">'+actionsHtml+'</div></div>';
}

function renderPag(tp){
  var w=document.getElementById('pageBtns');if(tp<=1){w.innerHTML='';return;}
  var h='<button class="pg-btn"'+(currentPage<=1?' disabled':'')+' onclick="go('+(currentPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
  for(var i=1;i<=tp;i++)h+='<button class="pg-btn'+(i===currentPage?' active':'')+'" onclick="go('+i+')">'+i+'</button>';
  h+='<button class="pg-btn"'+(currentPage>=tp?' disabled':'')+' onclick="go('+(currentPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML=h;
}
function go(p){currentPage=p;render();}

function toast(m,kind){
  var t=document.getElementById('toast');
  if(!t){
    t=document.createElement('div');
    t.id='toast';
    t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:11px 24px;border-radius:12px;font-size:13px;font-weight:700;opacity:0;transition:.3s;pointer-events:none;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.3)';
    document.body.appendChild(t);
    var s=document.createElement('style');
    s.textContent='#toast.show{opacity:1}';
    document.head.appendChild(s);
  }
  t.style.background=kind==='error'?'#dc2626':(kind==='success'?'#16a34a':'#1a1730');
  t.textContent=m;t.classList.add('show');clearTimeout(t._t);
  t._t=setTimeout(function(){t.classList.remove('show');},2600);
}

/* ── Approve: loader on the clicked button until Crud resolves ── */
async function approve(id){
  if(busyId)return;
  var a=items.find(function(x){return x.id===id;});
  if(!a||a.status!=='pending')return;
  busyId=id;
  render(); /* row + detail now show the spinner */
  try{
    await Crud.approve(id);
    busyId=null;
    openRowId=null;
    render();
    toast(a.book+' '+a.chapter+' — edit approved ✓','success');
  }catch(e){
    busyId=null;
    render();
    toast('Approve failed: '+(e.message||'error'),'error');
  }
}

/* ── Reject: reason required (modal) → loader until Crud resolves ── */
function reject(id){
  if(busyId)return;
  var a=items.find(function(x){return x.id===id;});
  if(!a||a.status!=='pending')return;
  rejectTargetId=id;
  document.getElementById('cjBook').textContent=a.book+' · '+a.chapter;
  document.getElementById('cjReason').value='';
  document.getElementById('cjErr').textContent='';
  openOverlay('cjRejectOv');
  setTimeout(function(){document.getElementById('cjReason').focus();},60);
}
async function submitReject(){
  if(!rejectTargetId||submitting)return;
  var reason=document.getElementById('cjReason').value.trim();
  var errEl=document.getElementById('cjErr');
  if(reason.length<5){
    errEl.textContent='A reason is required (at least 5 characters) — the author sees it.';
    return;
  }
  errEl.textContent='';
  submitting=true;
  var btn=document.getElementById('cjSubmit');
  var cancel=document.getElementById('cjCancel');
  var closeX=document.getElementById('cjClose');
  btn.disabled=true;
  if(cancel)cancel.disabled=true;
  if(closeX)closeX.style.pointerEvents='none';
  document.getElementById('cjReason').readOnly=true;
  btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Rejecting…'; /* spinner stays visible until resolve */
  var id=rejectTargetId;
  var a=items.find(function(x){return x.id===id;});
  busyId=id;
  render(); /* row behind also shows the loader */
  try{
    await Crud.reject(id,reason);
    busyId=null;
    rejectTargetId=null;
    openRowId=null;
    closeOverlay('cjRejectOv');
    render();
    toast(a.book+' '+a.chapter+' — edit rejected','success');
  }catch(e){
    busyId=null;
    rejectTargetId=null;
    render();
    closeOverlay('cjRejectOv');
    toast('Reject failed: '+(e.message||'error'),'error');
  }finally{
    submitting=false;
    btn.disabled=false;
    if(cancel)cancel.disabled=false;
    if(closeX)closeX.style.pointerEvents='';
    document.getElementById('cjReason').readOnly=false;
    btn.innerHTML='<i class="fas fa-xmark"></i> Reject Edit';
  }
}

/* ── Reject modal (service-injected — page stays call-and-render) ── */
function ensureModal(){
  if(document.getElementById('cjRejectOv'))return;
  var css=''+
    '.cj-ov{position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}.cj-ov.open{display:flex}'+
    '.cj-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px;animation:cjIn .18s ease}'+
    '@keyframes cjIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}'+
    '.cj-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}'+
    '.cj-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:var(--red-bg);color:var(--red)}'+
    '.cj-title{font-size:15px;font-weight:800}.cj-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px}'+
    '.cj-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}.cj-x:hover{color:var(--red);border-color:var(--red)}'+
    '.cj-label{font-size:11px;font-weight:700;display:block;margin-bottom:5px}.cj-label span{color:var(--red)}'+
    '.cj-field{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;resize:vertical;min-height:90px}.cj-field:focus{border-color:var(--red)}'+
    '.cj-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:10px}'+
    '.cj-err{font-size:11.5px;color:var(--red);font-weight:600;min-height:16px;margin-bottom:8px}'+
    '.cj-actions{display:flex;gap:8px;justify-content:flex-end}'+
    '.cj-btn{font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;transition:.12s}.cj-btn:hover{border-color:var(--accent);color:var(--accent)}.cj-btn.danger{background:var(--red);border-color:transparent;color:#fff}.cj-btn:disabled{opacity:.5;cursor:default}'+
    '.btn-busy{background:var(--input-bg);color:var(--accent);border:1px solid var(--input-border);cursor:default}'+
    '';
  var style=document.createElement('style');
  style.id='cjModalCss';
  style.textContent=css;
  document.head.appendChild(style);

  var wrap=document.createElement('div');
  wrap.innerHTML=''+
    '<div class="cj-ov" id="cjRejectOv">'+
      '<div class="cj-modal">'+
        '<div class="cj-head">'+
          '<div class="cj-ico"><i class="fas fa-xmark"></i></div>'+
          '<div><div class="cj-title">Reject Chapter Edit</div><div class="cj-sub" id="cjBook"></div></div>'+
          '<div class="cj-x" id="cjClose" onclick="closeCjReject()"><i class="fas fa-xmark"></i></div>'+
        '</div>'+
        '<div class="cj-hint">The reason is required — it is sent to the author with the rejection.</div>'+
        '<label class="cj-label">Reason <span>*</span></label>'+
        '<textarea class="cj-field" id="cjReason" placeholder="Explain why this edit cannot be approved…"></textarea>'+
        '<div class="cj-err" id="cjErr"></div>'+
        '<div class="cj-actions">'+
          '<button class="cj-btn" id="cjCancel" onclick="closeCjReject()">Cancel</button>'+
          '<button class="cj-btn danger" id="cjSubmit" onclick="submitCjReject()"><i class="fas fa-xmark"></i> Reject Edit</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  document.getElementById('cjRejectOv').addEventListener('click',function(e){if(e.target===this&&!submitting)closeOverlay('cjRejectOv');});
  document.getElementById('cjReason').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))submitReject();
  });
}
function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
function closeCjReject(){if(submitting)return;closeOverlay('cjRejectOv');rejectTargetId=null;}
function submitCjReject(){submitReject();}

function onRowToggle(e){
  var row=e.target.closest('.item-row');
  if(row&&!e.target.closest('.actions-cell')){
    var id=row.dataset.id;
    openRowId=openRowId===id?null:id;
    render();
  }
}
function bind(){
  if(_bound)return;_bound=true;
  window.go=go;
  window.approve=approve;
  window.reject=reject;
  window.closeCjReject=closeCjReject;
  window.submitCjReject=submitCjReject;
  document.addEventListener('click',onRowToggle);
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!submitting)closeOverlay('cjRejectOv');});
}
function init(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'chapter-review',title:'Chapter Edit Review',subtitle:'Authors request edits — SE reviews to protect exclusive contracts',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
  ensureModal();
  bind();
  Crud.list({}).then(render).catch(function(e){
    toast('Could not load edits: '+(e.message||'error'),'error');
    render();
  });
}
window.ChapterEditReviewService={init:init};
})();
