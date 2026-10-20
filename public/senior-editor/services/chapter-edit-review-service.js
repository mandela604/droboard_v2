/**
 * chapter-edit-review-service.js — Chapter Edit Review page logic (pure call-and-render)
 * Backend-ready: set USE_API=true; endpoints in senior.routes.js:
 *   GET  /api/senior-editor/chapter-edits           list
 *   GET  /api/senior-editor/chapter-edits/:id       read one
 *   POST /api/senior-editor/chapter-edits/:id/approve
 *   POST /api/senior-editor/chapter-edits/:id/reject   { note }
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
    var remote=await callBackend('/chapter-edits'+(qs.length?'?'+qs.join('&'):''));
    if(remote&&remote.items)items=remote.items.map(fromApiItem);
    return items;
  },
  get:async function(id){
    var remote=await callBackend('/chapter-edits/'+encodeURIComponent(id));
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
      return callBackend('/chapter-edits/'+encodeURIComponent(id)+'/approve',{method:'POST',headers:authHeaders()});
    }
    await sleep(700); /* demo: loader visible until "resolve" */
    var a=items.find(function(x){return x.id===id;});
    if(a)a.status='approved';
    return a;
  },
  reject:async function(id,reason){
    if(USE_API){
      return callBackend('/chapter-edits/'+encodeURIComponent(id)+'/reject',{
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
    chapter:d.chapterLabel||d.chapter||('Ch.'+(d.n||'')),
    words:typeof d.wordsChanged==='number'?d.wordsChanged.toLocaleString():(d.words||'—'),
    editType:d.editType||d.type||'Edit',
    submitted:d.submitted||'—',
    status:d.status||'pending',
    authorNote:d.authorNote||d.note||'',
    reviewNote:d.reviewNote||'',
  };
}

var items=[
  {id:'CHP-001',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',chapter:'Ch.24',words:'1,200',editType:'Rewrite',submitted:'2h ago',status:'pending',authorNote:'Hi! I rewrote the ending of Ch.24 — the old dialogue felt flat and the twist was too predictable. The new version hits much harder, please let me know what you think!'},
  {id:'CHP-002',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',chapter:'Ch.11',words:'800',editType:'Minor Edit',submitted:'4h ago',status:'pending',authorNote:'Just cleaned up the fight scene in Ch.11 — fixed my grammar and tightened the pacing. No story changes at all!'},
  {id:'CHP-003',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',chapter:'Ch.6',words:'2,100',editType:'Major Rewrite',submitted:'6h ago',status:'pending',authorNote:'I restructured the whole of Ch.6 — it dragged in the middle and I know readers felt it too. The new flow reads much faster.'},
  {id:'CHP-004',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',chapter:'Ch.28',words:'450',editType:'Grammar Fix',submitted:'1d ago',status:'approved',authorNote:'Only grammar fixes in Ch.28 from my side, no story changes whatsoever!'},
  {id:'CHP-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',chapter:'Ch.3',words:'1,800',editType:'Rewrite',submitted:'2d ago',status:'rejected',reviewNote:'The rewrite changes plot beats that are locked under the exclusive contract — please resubmit only dialogue and grammar fixes.',authorNote:'Reworked the ending of Ch.3 — the original felt rushed and I want this arc to land properly for my readers.'},
  {id:'CHP-006',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',chapter:'Ch.15',words:'950',editType:'Minor Edit',submitted:'3d ago',status:'approved',authorNote:'Polished the pacing and dialogue in Ch.15. Small changes but they make a big difference!'},
  {id:'CHP-007',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',chapter:'Ch.5',words:'600',editType:'Grammar Fix',submitted:'4d ago',status:'pending',authorNote:'Just grammar and punctuation fixes in Ch.5, nothing else touched.'},
  {id:'CHP-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',chapter:'Ch.20',words:'1,400',editType:'Rewrite',submitted:'5d ago',status:'rejected',reviewNote:'Backstory expansion exceeds the approved edit scope for contracted books — resend as a minor edit.',authorNote:'Expanded Ch.20 with more backstory — my readers asked for it and I agree the chapter needed more weight.'},
  {id:'CHP-009',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',chapter:'Ch.18',words:'720',editType:'Minor Edit',submitted:'6d ago',status:'approved',authorNote:'Small dialogue touch-ups in Ch.18, nothing structural changed.'},
  {id:'CHP-010',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',chapter:'Ch.12',words:'1,100',editType:'Rewrite',submitted:'1w ago',status:'pending',authorNote:'I want to redo the love confession scene in Ch.12 — it deserves a much bigger moment!'},
  {id:'CHP-011',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',chapter:'Ch.35',words:'900',editType:'Minor Edit',submitted:'1w ago',status:'approved',authorNote:'Tightened the climax pacing in Ch.35 — it reads so much better now.'},
  {id:'CHP-012',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',chapter:'Ch.10',words:'2,400',editType:'Major Rewrite',submitted:'1w ago',status:'pending',authorNote:'Full restructure of Ch.10 — I moved the villain reveal earlier for more tension. Hope you love it!'},
  {id:'CHP-013',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',chapter:'Ch.8',words:'350',editType:'Grammar Fix',submitted:'2w ago',status:'approved',authorNote:'Typo and grammar corrections in Ch.8, all mine to fix!'},
  {id:'CHP-014',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',chapter:'Ch.7',words:'1,600',editType:'Rewrite',submitted:'2w ago',status:'rejected',reviewNote:'Character voices drift from the established bible — revise using the approved style guide and resubmit.',authorNote:'Rewrote Ch.7 to stay true to my characters — the old draft felt off for them and I had to fix it.'},
  {id:'CHP-015',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',chapter:'Ch.22',words:'880',editType:'Minor Edit',submitted:'2w ago',status:'approved',authorNote:'Dialogue improvements in Ch.22 — my characters finally sound like themselves!'},
  {id:'CHP-016',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',chapter:'Ch.14',words:'1,300',editType:'Rewrite',submitted:'3w ago',status:'pending',authorNote:'Added the plot twist in Ch.14 that my readers have been guessing at — so excited for this one!'},
  {id:'CHP-017',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'The Inheritance',chapter:'Ch.16',words:'550',editType:'Grammar Fix',submitted:'3w ago',status:'approved',authorNote:'Grammar and formatting fixes in Ch.16, all cleaned up.'},
  {id:'CHP-018',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'Blood Ties',chapter:'Ch.28',words:'1,900',editType:'Major Rewrite',submitted:'3w ago',status:'rejected',reviewNote:'Council-scene expansion collides with the finale NDA chapter — hold until publication, then resubmit.',authorNote:'Expanded Ch.28 with the council scene — it sets up my finale properly and my readers need this context.'},
];

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
  var chHref='../author/edit-chapter.html?book='+encodeURIComponent(bookSlug)+'&chapter='+encodeURIComponent(chNum);
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
