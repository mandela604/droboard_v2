/**
 * chapter-edit-review-service.js — Chapter Edit Review page logic (pure call-and-render)
 * Backend-ready: set USE_API=true and wire endpoints to swap demo data for live API.
 * Currently runs on local demo data; callBackend is reserved for future backend swap.
 */
(function(){
'use strict';
const USE_API=false;
const API_BASE='/api/senior-editor';
async function callBackend(path, options){
  var res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('Backend error: ' + res.status);
  return res.json();
}

var items=[
  {id:'CHP-001',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',chapter:'Ch.24',words:'1,200',editType:'Rewrite',submitted:'2h ago',status:'pending',authorNote:'Hi! I rewrote the ending of Ch.24 — the old dialogue felt flat and the twist was too predictable. The new version hits much harder, please let me know what you think!'},
  {id:'CHP-002',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',chapter:'Ch.11',words:'800',editType:'Minor Edit',submitted:'4h ago',status:'pending',authorNote:'Just cleaned up the fight scene in Ch.11 — fixed my grammar and tightened the pacing. No story changes at all!'},
  {id:'CHP-003',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',chapter:'Ch.6',words:'2,100',editType:'Major Rewrite',submitted:'6h ago',status:'pending',authorNote:'I restructured the whole of Ch.6 — it dragged in the middle and I know readers felt it too. The new flow reads much faster.'},
  {id:'CHP-004',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',chapter:'Ch.28',words:'450',editType:'Grammar Fix',submitted:'1d ago',status:'approved',authorNote:'Only grammar fixes in Ch.28 from my side, no story changes whatsoever!'},
  {id:'CHP-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',chapter:'Ch.3',words:'1,800',editType:'Rewrite',submitted:'2d ago',status:'rejected',authorNote:'Reworked the ending of Ch.3 — the original felt rushed and I want this arc to land properly for my readers.'},
  {id:'CHP-006',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',chapter:'Ch.15',words:'950',editType:'Minor Edit',submitted:'3d ago',status:'approved',authorNote:'Polished the pacing and dialogue in Ch.15. Small changes but they make a big difference!'},
  {id:'CHP-007',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',chapter:'Ch.5',words:'600',editType:'Grammar Fix',submitted:'4d ago',status:'pending',authorNote:'Just grammar and punctuation fixes in Ch.5, nothing else touched.'},
  {id:'CHP-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',chapter:'Ch.20',words:'1,400',editType:'Rewrite',submitted:'5d ago',status:'rejected',authorNote:'Expanded Ch.20 with more backstory — my readers asked for it and I agree the chapter needed more weight.'},
  {id:'CHP-009',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',chapter:'Ch.18',words:'720',editType:'Minor Edit',submitted:'6d ago',status:'approved',authorNote:'Small dialogue touch-ups in Ch.18, nothing structural changed.'},
  {id:'CHP-010',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',chapter:'Ch.12',words:'1,100',editType:'Rewrite',submitted:'1w ago',status:'pending',authorNote:'I want to redo the love confession scene in Ch.12 — it deserves a much bigger moment!'},
  {id:'CHP-011',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',chapter:'Ch.35',words:'900',editType:'Minor Edit',submitted:'1w ago',status:'approved',authorNote:'Tightened the climax pacing in Ch.35 — it reads so much better now.'},
  {id:'CHP-012',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',chapter:'Ch.10',words:'2,400',editType:'Major Rewrite',submitted:'1w ago',status:'pending',authorNote:'Full restructure of Ch.10 — I moved the villain reveal earlier for more tension. Hope you love it!'},
  {id:'CHP-013',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',chapter:'Ch.8',words:'350',editType:'Grammar Fix',submitted:'2w ago',status:'approved',authorNote:'Typo and grammar corrections in Ch.8, all mine to fix!'},
  {id:'CHP-014',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',chapter:'Ch.7',words:'1,600',editType:'Rewrite',submitted:'2w ago',status:'rejected',authorNote:'Rewrote Ch.7 to stay true to my characters — the old draft felt off for them and I had to fix it.'},
  {id:'CHP-015',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',chapter:'Ch.22',words:'880',editType:'Minor Edit',submitted:'2w ago',status:'approved',authorNote:'Dialogue improvements in Ch.22 — my characters finally sound like themselves!'},
  {id:'CHP-016',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',chapter:'Ch.14',words:'1,300',editType:'Rewrite',submitted:'3w ago',status:'pending',authorNote:'Added the plot twist in Ch.14 that my readers have been guessing at — so excited for this one!'},
  {id:'CHP-017',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'The Inheritance',chapter:'Ch.16',words:'550',editType:'Grammar Fix',submitted:'3w ago',status:'approved',authorNote:'Grammar and formatting fixes in Ch.16, all cleaned up.'},
  {id:'CHP-018',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'Blood Ties',chapter:'Ch.28',words:'1,900',editType:'Major Rewrite',submitted:'3w ago',status:'rejected',authorNote:'Expanded Ch.28 with the council scene — it sets up my finale properly and my readers need this context.'},
];
var currentPage=1,PER_PAGE=5,openRowId=null;
var _bound=false;
function filtered(){
  var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  var st=document.getElementById('statusFilter').value;
  return items.filter(function(a){if(st&&a.status!==st)return false;if(q&&a.author.toLowerCase().indexOf(q)===-1&&a.book.toLowerCase().indexOf(q)===-1&&a.id.toLowerCase().indexOf(q)===-1)return false;return true;});
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
function render(){
  updateStats();
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>tp)currentPage=tp;
  var start=(currentPage-1)*PER_PAGE,page=list.slice(start,start+PER_PAGE);
  var body=document.getElementById('tableBody');
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-pen-to-square"></i>No chapter edits match your filters.</div>';document.getElementById('pageBtns').innerHTML='';document.getElementById('pageInfo').innerHTML='';return;}
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    var isDone=a.status!=='pending';
    return '<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+a.id+'"><div class="expand-ico"><i class="fas fa-chevron-right"></i></div><div class="author-cell col-book"><img src="'+a.avatar+'" alt=""/><div class="author-info"><span class="author-name">'+a.author+'</span><span class="author-id">'+a.id+'</span></div></div><div class="book-cell col-chapters"><span class="book-title">'+a.book+'</span><span class="book-chapter">'+a.chapter+' · '+a.editType+'</span></div><div class="words-badge"><i class="fas fa-font"></i>'+a.words+'</div><div>'+statusPill(a.status)+'</div><div class="actions-cell'+(isDone?' is-done':'')+'"><button class="btn btn-green" title="Approve" onclick="event.stopPropagation();approve(\''+a.id+'\')"><i class="fas fa-check"></i></button><button class="btn btn-danger" title="Reject" onclick="event.stopPropagation();reject(\''+a.id+'\')"><i class="fas fa-xmark"></i></button></div></div><div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+a.id+'"></div></div>';
  }).join('');
  if(openRowId&&page.some(function(a){return a.id===openRowId;}))renderDetail(openRowId);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(start+1)+'</b> – <b>'+Math.min(start+PER_PAGE,total)+'</b> of <b>'+total+'</b> requests';
  renderPag(tp);
}
function renderDetail(id){
  var a=items.find(function(x){return x.id===id;});if(!a)return;
  var p=document.getElementById('detail-'+id);if(!p)return;
  var isDone=a.status!=='pending';
  var bookSlug=String(a.book||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  var chNum=String(a.chapter||'').replace(/[^0-9]/g,'')||'1';
  var chHref='../author/edit-chapter.html?book='+encodeURIComponent(bookSlug)+'&chapter='+encodeURIComponent(chNum);
  var actionsHtml='';
  if(isDone){
    actionsHtml='<a class="btn btn-text btn-ghost" href="'+chHref+'"><i class="fas fa-eye"></i> View Chapter</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }else{
    actionsHtml='<button class="btn btn-text btn-green" onclick="approve(\''+a.id+'\')"><i class="fas fa-check"></i> Approve Edit</button><button class="btn btn-text btn-danger" onclick="reject(\''+a.id+'\')"><i class="fas fa-xmark"></i> Reject</button><a class="btn btn-text btn-ghost" href="'+chHref+'"><i class="fas fa-eye"></i> View Chapter</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }
  p.innerHTML='<div class="detail-inner"><div class="detail-header"><img class="detail-avatar" src="'+a.avatar+'" alt=""/><div class="detail-title"><h3>'+a.author+'</h3><p>'+a.id+' · '+a.editType+'</p></div>'+statusPill(a.status)+'</div><div class="detail-grid"><div class="detail-card"><label>Book</label><b>'+a.book+'</b></div><div class="detail-card"><label>Chapter</label><b>'+a.chapter+'</b></div><div class="detail-card accent"><label>Words Changed</label><b>'+a.words+'</b></div><div class="detail-card"><label>Submitted</label><b>'+a.submitted+'</b></div></div><div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Author\'s Note</div><p>'+a.authorNote+'</p></div><div class="detail-actions">'+actionsHtml+'</div></div>';
}
function renderPag(tp){
  var w=document.getElementById('pageBtns');if(tp<=1){w.innerHTML='';return;}
  var h='<button class="pg-btn"'+(currentPage<=1?' disabled':'')+' onclick="go('+(currentPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
  for(var i=1;i<=tp;i++)h+='<button class="pg-btn'+(i===currentPage?' active':'')+'" onclick="go('+i+')">'+i+'</button>';
  h+='<button class="pg-btn"'+(currentPage>=tp?' disabled':'')+' onclick="go('+(currentPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML=h;
}
function go(p){currentPage=p;render();}
function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}
function approve(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='approved';openRowId=null;render();toast(a.book+' '+a.chapter+' — edit approved');}}
function reject(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='rejected';openRowId=null;render();toast(a.book+' '+a.chapter+' — edit rejected');}}
function onRowToggle(e){var row=e.target.closest('.item-row');if(row&&!e.target.closest('.actions-cell')){var id=row.dataset.id;openRowId=openRowId===id?null:id;render();}}
function bind(){
  if(_bound)return;_bound=true;
  window.go=go;
  window.approve=approve;
  window.reject=reject;
  document.addEventListener('click',onRowToggle);
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
}
function init(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'chapter-review',title:'Chapter Edit Review',subtitle:'Authors request edits — SE reviews to protect exclusive contracts',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
  bind();
  render();
}
window.ChapterEditReviewService={init:init};
})();
