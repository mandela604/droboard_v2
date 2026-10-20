/**
 * book-series-review-service.js — Book Series Review page logic (pure call-and-render)
 * Backend-ready: set USE_API=true; endpoints in senior.routes.js:
 *   GET  /api/senior-editor/book-edits           list
 *   GET  /api/senior-editor/book-edits/:id       read one
 *   POST /api/senior-editor/book-edits/:id/approve
 *   POST /api/senior-editor/book-edits/:id/reject   { note }
 */
(function(){
'use strict';
var USE_API=false;
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
  var res=await fetch(API_BASE+path,options);
  if(!res.ok){
    var body=await res.json().catch(function(){return {};});
    var err=new Error(body.error||('HTTP '+res.status));
    err.status=res.status;
    throw err;
  }
  return res.json();
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

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
    var remote=await callBackend('/book-edits'+(qs.length?'?'+qs.join('&'):''));
    if(remote&&remote.items)items=remote.items.map(fromApiItem);
    return items;
  },
  get:async function(id){
    var remote=await callBackend('/book-edits/'+encodeURIComponent(id));
    if(remote&&remote.id){
      var mapped=fromApiItem(remote);
      var i=items.findIndex(function(x){return x.id===id;});
      if(i>-1)items[i]=mapped;
      return mapped;
    }
    return items.find(function(x){return x.id===id;})||null;
  },
  approve:async function(id){
    if(USE_API){
      return callBackend('/book-edits/'+encodeURIComponent(id)+'/approve',{method:'POST',headers:authHeaders()});
    }
    await sleep(700); /* demo: loader visible until "resolve" */
    var a=items.find(function(x){return x.id===id;});
    if(a)a.status='approved';
    return a;
  },
  reject:async function(id,reason){
    if(USE_API){
      return callBackend('/book-edits/'+encodeURIComponent(id)+'/reject',{
        method:'POST',headers:authHeaders(),body:JSON.stringify({note:reason}),
      });
    }
    await sleep(700); /* demo: loader visible until "resolve" */
    var a=items.find(function(x){return x.id===id;});
    if(a){a.status='rejected';a.reviewNote=reason;}
    return a;
  },
};

function fromApiItem(d){
  return{
    id:d.id,
    author:d.authorName||d.author||'—',
    avatar:d.avatar||'https://i.pravatar.cc/100?img=0',
    book:d.bookTitle||d.book||'—',
    editType:d.editType||d.type||'Edit',
    submitted:d.submitted||'—',
    status:d.status||'pending',
    changeFrom:d.changeFrom||d.from||'',
    changeTo:d.changeTo||d.to||'',
    changes:d.changes||null,
    notes:d.notes||d.authorNote||'',
    reviewNote:d.reviewNote||'',
  };
}

var items=[
  {id:'BSR-001',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',editType:'Title Change',submitted:'12h ago',status:'approved',changeFrom:'The Duke\'s Hidden Past',changeTo:'The Duke\'s Secret',notes:'Title changed for better clarity. Approved.'},
  {id:'BSR-002',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',editType:'Cover Update',submitted:'1d ago',status:'pending',changeFrom:'https://placehold.co/120x160/1a1a2e/ffffff?text=Old',changeTo:'https://placehold.co/120x160/ff0050/ffffff?text=New',notes:'Author uploaded new cover art. Needs review for quality and guidelines compliance.'},
  {id:'BSR-003',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',editType:'Description Edit',submitted:'2d ago',status:'pending',changeFrom:'A wolf shifter finds his fated mate in a human village.',changeTo:'When alpha warrior Kael discovers his fated mate is the one woman his pack has sworn to destroy, he must choose between duty and destiny.',notes:'Updated synopsis. Needs review for spoilers and accuracy.'},
  {id:'BSR-004',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',editType:'Genre Change',submitted:'3d ago',status:'rejected',reviewNote:'Cannot change genre after publication without platform approval.',changeFrom:'Mafia Romance',changeTo:'Romantic Suspense',notes:'Cannot change genre after publication without platform approval. Rejected.'},
  {id:'BSR-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',editType:'Series Name',submitted:'4d ago',status:'approved',changeFrom:'Standalone',changeTo:'Ivy League Revenge Series',notes:'Added to series. Approved.'},
  {id:'BSR-006',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',editType:'Title Change',submitted:'5d ago',status:'pending',changeFrom:'She Rejected Me 3 Times',changeTo:'Three Times Rejected: A Love Story',notes:'Proposed new title under review.'},
  {id:'BSR-007',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',editType:'Cover Update',submitted:'6d ago',status:'approved',changeFrom:'https://placehold.co/120x160/2d1b69/ffffff?text=Old',changeTo:'https://placehold.co/120x160/e0384d/ffffff?text=New',notes:'New cover matches brand guidelines. Approved.'},
  {id:'BSR-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',editType:'Description Edit',submitted:'1w ago',status:'rejected',reviewNote:'Description contains major spoilers — resubmit without plot reveals.',changeFrom:'A family drama about inheritance and secrets.',changeTo:'When Amara\'s grandmother dies, she leaves behind a will that will tear the family apart and reveal secrets buried for decades.',notes:'Description contains major spoilers. Rejected with feedback.'},
  {id:'BSR-009',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',editType:'Title Change',submitted:'1w ago',status:'approved',changeFrom:'Bodyguard Romance',changeTo:'The Billionaire\'s Guard',notes:'Better title. More specific. Approved.'},
  {id:'BSR-010',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',editType:'Genre Change',submitted:'1w ago',status:'pending',changeFrom:'Paranormal Romance',changeTo:'Paranormal Romance · Urban Fantasy',notes:'Adding Urban Fantasy subgenre. Needs review.'},
  {id:'BSR-011',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',editType:'Series Name',submitted:'2w ago',status:'approved',changeFrom:'Standalone',changeTo:'Billionaire Hearts Series',notes:'Added to series. Approved.'},
  {id:'BSR-012',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',editType:'Cover Update',submitted:'2w ago',status:'pending',changeFrom:'https://placehold.co/120x160/0d0b1a/ffffff?text=Old',changeTo:'https://placehold.co/120x160/16a34a/ffffff?text=New',notes:'New cover with improved typography. Under review.'},
  {id:'BSR-013',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',editType:'Description Edit',submitted:'3w ago',status:'approved',changeFrom:'A princess falls for her guard.',changeTo:'Princess Elara has one rule: never fall for the guard. But when assassin shadows close in, the man sworn to protect her heart becomes the greatest danger of all.',notes:'Compelling description. Approved.'},
  {id:'BSR-014',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',editType:'Title Change',submitted:'3w ago',status:'rejected',reviewNote:'Original title is stronger and already ranking — keep it.',changeFrom:'Campus Queen',changeTo:'Queen of Campus',notes:'Original title is stronger. Rejected.'},
  {id:'BSR-015',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',editType:'Title + Cover',submitted:'3d ago',status:'pending',changes:[{type:'Title',from:'Lagos Love Story',to:'Lagos Nights: A Love Story'},{type:'Cover',from:'https://placehold.co/120x160/1a1a2e/ffffff?text=Old',to:'https://placehold.co/120x160/ff6b35/ffffff?text=New'}],notes:'Author wants to rebrand the book with a new title and cover for the series launch.'},
  {id:'BSR-016',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',editType:'Title + Cover + Description',submitted:'4d ago',status:'pending',changes:[{type:'Title',from:'The Teacher\'s Secret',to:'Behind Closed Doors: A Teacher\'s Story'},{type:'Cover',from:'https://placehold.co/120x160/2d1b69/ffffff?text=Old',to:'https://placehold.co/120x160/dc2626/ffffff?text=New'},{type:'Description',from:'A teacher hides a dangerous secret.',to:'When Elizabeth discovers her student\'s dark home life, she must choose between her career and doing what\'s right — even if it means losing everything.'}],notes:'Full rebrand request. Title, cover, and description all changed to match the new direction of the story.'},
];

var currentPage=1,PER_PAGE=5,openRowId=null,busyId=null;
var rejectTargetId=null,submitting=false;
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
function editIcon(t){
  if(t.indexOf('Cover')!==-1)return'fa-image';
  if(t.indexOf('Title')!==-1)return'fa-pen';
  if(t.indexOf('Description')!==-1)return'fa-align-left';
  if(t.indexOf('Genre')!==-1)return'fa-tags';
  if(t.indexOf('Series')!==-1)return'fa-layer-group';
  return'fa-pen';
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
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-book-open"></i>No book edits match your filters.</div>';document.getElementById('pageBtns').innerHTML='';document.getElementById('pageInfo').innerHTML='';return;}
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    return '<div>'+
      '<div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+esc(a.id)+'">'+
        '<div class="expand-ico"><i class="fas fa-chevron-right"></i></div>'+
        '<div class="author-cell col-book"><img src="'+esc(a.avatar)+'" alt=""/><div class="author-info"><span class="author-name">'+esc(a.author)+'</span><span class="author-id">'+esc(a.id)+'</span></div></div>'+
        '<div class="book-cell col-edit"><span class="book-title">'+esc(a.book)+'</span><span class="book-edit">'+esc(a.editType)+'</span></div>'+
        '<div class="edit-badge"><i class="fas '+editIcon(a.editType)+'"></i>'+esc(a.editType)+'</div>'+
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
  var wsHref='../author/book-workspace.html?book='+encodeURIComponent(bookSlug);
  var changeHtml='';
  if(a.changes){
    var rows=a.changes.map(function(c){
      if(c.type==='Cover'){
        return'<div class="change-box" style="margin-bottom:10px"><div class="lbl"><i class="fas fa-image"></i> '+esc(c.type)+'</div><div class="change-row"><div class="change-from"><label>Current</label><img class="change-img" src="'+esc(c.from)+'" alt="Old"/></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>New</label><img class="change-img" src="'+esc(c.to)+'" alt="New"/></div></div></div>';
      }
      return'<div class="change-box" style="margin-bottom:10px"><div class="lbl"><i class="fas fa-pen"></i> '+esc(c.type)+'</div><div class="change-row"><div class="change-from"><label>From</label><b>'+esc(c.from)+'</b></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>To</label><b>'+esc(c.to)+'</b></div></div></div>';
    });
    changeHtml=rows.join('');
  }else if(a.editType==='Cover Update'){
    changeHtml='<div class="change-box"><div class="lbl"><i class="fas fa-image"></i> Cover Change</div><div class="change-row"><div class="change-from"><label>Current Cover</label><img class="change-img" src="'+esc(a.changeFrom)+'" alt="Old cover"/></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>New Cover</label><img class="change-img" src="'+esc(a.changeTo)+'" alt="New cover"/></div></div></div>';
  }else{
    changeHtml='<div class="change-box"><div class="lbl"><i class="fas fa-pen"></i> Content Change</div><div class="change-row"><div class="change-from"><label>From</label><b>'+esc(a.changeFrom)+'</b></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>To</label><b>'+esc(a.changeTo)+'</b></div></div></div>';
  }
  var reviewHtml='';
  if(a.status==='rejected'&&a.reviewNote){
    reviewHtml='<div class="detail-notes-box" style="border-color:var(--red);background:var(--red-bg)"><div class="lbl" style="color:var(--red)"><i class="fas fa-ban"></i> Rejection Reason</div><p style="color:var(--red)">'+esc(a.reviewNote)+'</p></div>';
  }
  var actionsHtml='';
  if(isBusy){
    actionsHtml='<button class="btn btn-text btn-busy" disabled><i class="fas fa-spinner fa-spin"></i> Processing…</button>';
  }else if(isDone){
    actionsHtml='<a class="btn btn-text btn-ghost" href="'+wsHref+'"><i class="fas fa-eye"></i> View Book</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }else{
    actionsHtml='<button class="btn btn-text btn-green" onclick="approve(\''+esc(a.id)+'\')"><i class="fas fa-check"></i> Approve</button>'+
      '<button class="btn btn-text btn-danger" onclick="reject(\''+esc(a.id)+'\')"><i class="fas fa-xmark"></i> Reject</button>'+
      '<a class="btn btn-text btn-ghost" href="'+wsHref+'"><i class="fas fa-eye"></i> View Book</a>'+
      '<a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }
  p.innerHTML='<div class="detail-inner">'+
    '<div class="detail-header"><img class="detail-avatar" src="'+esc(a.avatar)+'" alt=""/><div class="detail-title"><h3>'+esc(a.author)+'</h3><p>'+esc(a.id)+' · '+esc(a.editType)+'</p></div>'+statusPill(a.status)+'</div>'+
    changeHtml+
    '<div class="detail-grid"><div class="detail-card"><label>Book</label><b>'+esc(a.book)+'</b></div><div class="detail-card"><label>Edit Type</label><b>'+esc(a.editType)+'</b></div><div class="detail-card"><label>Submitted</label><b>'+esc(a.submitted)+'</b></div><div class="detail-card"><label>Status</label><b>'+statusPill(a.status)+'</b></div></div>'+
    '<div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Review Notes</div><p>'+esc(a.notes)+'</p></div>'+
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
  if(busyId||submitting)return;
  var a=items.find(function(x){return x.id===id;});
  if(!a||a.status!=='pending')return;
  busyId=id;
  render(); /* row + detail now show the spinner */
  try{
    await Crud.approve(id);
    busyId=null;
    openRowId=null;
    render();
    toast(a.book+' — edit approved ✓','success');
  }catch(e){
    busyId=null;
    render();
    toast('Approve failed: '+(e.message||'error'),'error');
  }
}

/* ── Reject: reason required (modal) → loader until Crud resolves ── */
function reject(id){
  if(busyId||submitting)return;
  var a=items.find(function(x){return x.id===id;});
  if(!a||a.status!=='pending')return;
  rejectTargetId=id;
  document.getElementById('bsrBook').textContent=a.book+' · '+a.editType;
  document.getElementById('bsrReason').value='';
  document.getElementById('bsrErr').textContent='';
  openOverlay('bsrRejectOv');
  setTimeout(function(){document.getElementById('bsrReason').focus();},60);
}
async function submitReject(){
  if(!rejectTargetId||submitting)return;
  var reason=document.getElementById('bsrReason').value.trim();
  var errEl=document.getElementById('bsrErr');
  if(reason.length<5){
    errEl.textContent='A reason is required (at least 5 characters) — the author sees it.';
    return;
  }
  errEl.textContent='';
  submitting=true;
  var btn=document.getElementById('bsrSubmit');
  var cancel=document.getElementById('bsrCancel');
  var closeX=document.getElementById('bsrClose');
  btn.disabled=true;
  if(cancel)cancel.disabled=true;
  if(closeX)closeX.style.pointerEvents='none';
  document.getElementById('bsrReason').readOnly=true;
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
    closeOverlay('bsrRejectOv');
    render();
    toast(a.book+' — edit rejected','success');
  }catch(e){
    busyId=null;
    rejectTargetId=null;
    render();
    closeOverlay('bsrRejectOv');
    toast('Reject failed: '+(e.message||'error'),'error');
  }finally{
    submitting=false;
    btn.disabled=false;
    if(cancel)cancel.disabled=false;
    if(closeX)closeX.style.pointerEvents='';
    document.getElementById('bsrReason').readOnly=false;
    btn.innerHTML='<i class="fas fa-xmark"></i> Reject Edit';
  }
}

/* ── Reject modal (service-injected — page stays call-and-render) ── */
function ensureModal(){
  if(document.getElementById('bsrRejectOv'))return;
  var css=''+
    '.bsr-ov{position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}.bsr-ov.open{display:flex}'+
    '.bsr-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px;animation:bsrIn .18s ease}'+
    '@keyframes bsrIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}'+
    '.bsr-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}'+
    '.bsr-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:var(--red-bg);color:var(--red)}'+
    '.bsr-title{font-size:15px;font-weight:800}.bsr-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px}'+
    '.bsr-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}.bsr-x:hover{color:var(--red);border-color:var(--red)}'+
    '.bsr-label{font-size:11px;font-weight:700;display:block;margin-bottom:5px}.bsr-label span{color:var(--red)}'+
    '.bsr-field{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;resize:vertical;min-height:90px}.bsr-field:focus{border-color:var(--red)}'+
    '.bsr-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:10px}'+
    '.bsr-err{font-size:11.5px;color:var(--red);font-weight:600;min-height:16px;margin-bottom:8px}'+
    '.bsr-actions{display:flex;gap:8px;justify-content:flex-end}'+
    '.bsr-btn{font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;transition:.12s}.bsr-btn:hover{border-color:var(--accent);color:var(--accent)}.bsr-btn.danger{background:var(--red);border-color:transparent;color:#fff}.bsr-btn:disabled{opacity:.5;cursor:default}'+
    '.btn-busy{background:var(--input-bg);color:var(--accent);border:1px solid var(--input-border);cursor:default}'+
    '';
  var style=document.createElement('style');
  style.id='bsrModalCss';
  style.textContent=css;
  document.head.appendChild(style);

  var wrap=document.createElement('div');
  wrap.innerHTML=''+
    '<div class="bsr-ov" id="bsrRejectOv">'+
      '<div class="bsr-modal">'+
        '<div class="bsr-head">'+
          '<div class="bsr-ico"><i class="fas fa-xmark"></i></div>'+
          '<div><div class="bsr-title">Reject Book Edit</div><div class="bsr-sub" id="bsrBook"></div></div>'+
          '<div class="bsr-x" id="bsrClose" onclick="closeBsrReject()"><i class="fas fa-xmark"></i></div>'+
        '</div>'+
        '<div class="bsr-hint">The reason is required — it is sent to the author with the rejection.</div>'+
        '<label class="bsr-label">Reason <span>*</span></label>'+
        '<textarea class="bsr-field" id="bsrReason" placeholder="Explain why this book edit cannot be approved…"></textarea>'+
        '<div class="bsr-err" id="bsrErr"></div>'+
        '<div class="bsr-actions">'+
          '<button class="bsr-btn" id="bsrCancel" onclick="closeBsrReject()">Cancel</button>'+
          '<button class="bsr-btn danger" id="bsrSubmit" onclick="submitBsrReject()"><i class="fas fa-xmark"></i> Reject Edit</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  document.getElementById('bsrRejectOv').addEventListener('click',function(e){if(e.target===this&&!submitting)closeOverlay('bsrRejectOv');});
  document.getElementById('bsrReason').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))submitReject();
  });
}
function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id){document.getElementById(id).classList.remove('open');}
function closeBsrReject(){if(submitting)return;closeOverlay('bsrRejectOv');rejectTargetId=null;}
function submitBsrReject(){submitReject();}

function onRowToggle(e){
  var row=e.target.closest('.item-row');
  if(row&&!e.target.closest('.actions-cell')){
    var id=row.dataset.id;
    openRowId=openRowId===id?null:id;
    render();
  }
}
function onExpandToggle(e){
  var box=e.target.closest('.change-from,.change-to');
  if(box&&!e.target.closest('img')){box.classList.toggle('expanded');}
}
function bind(){
  if(_bound)return;_bound=true;
  window.go=go;
  window.approve=approve;
  window.reject=reject;
  window.closeBsrReject=closeBsrReject;
  window.submitBsrReject=submitBsrReject;
  document.addEventListener('click',onRowToggle);
  document.addEventListener('click',onExpandToggle);
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!submitting)closeOverlay('bsrRejectOv');});
}
function init(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'book-series-review',title:'Book Series Review',subtitle:'Authors request edits to book details',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
  ensureModal();
  bind();
  Crud.list({}).then(render).catch(function(e){
    toast('Could not load edits: '+(e.message||'error'),'error');
    render();
  });
}
window.BookSeriesReviewService={init:init};
})();
