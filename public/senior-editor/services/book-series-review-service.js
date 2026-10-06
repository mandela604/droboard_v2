/**
 * book-series-review-service.js — Book Series Review page logic (pure call-and-render)
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
  {id:'BSR-001',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Duke\'s Secret',editType:'Title Change',submitted:'12h ago',status:'approved',changeFrom:'The Duke\'s Hidden Past',changeTo:'The Duke\'s Secret',notes:'Title changed for better clarity. Approved.'},
  {id:'BSR-002',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',editType:'Cover Update',submitted:'1d ago',status:'pending',changeFrom:'https://placehold.co/120x160/1a1a2e/ffffff?text=Old',changeTo:'https://placehold.co/120x160/ff0050/ffffff?text=New',notes:'Author uploaded new cover art. Needs review for quality and guidelines compliance.'},
  {id:'BSR-003',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',editType:'Description Edit',submitted:'2d ago',status:'pending',changeFrom:'A wolf shifter finds his fated mate in a human village.',changeTo:'When alpha warrior Kael discovers his fated mate is the one woman his pack has sworn to destroy, he must choose between duty and destiny.',notes:'Updated synopsis. Needs review for spoilers and accuracy.'},
  {id:'BSR-004',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',editType:'Genre Change',submitted:'3d ago',status:'rejected',changeFrom:'Mafia Romance',changeTo:'Romantic Suspense',notes:'Cannot change genre after publication without platform approval. Rejected.'},
  {id:'BSR-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',editType:'Series Name',submitted:'4d ago',status:'approved',changeFrom:'Standalone',changeTo:'Ivy League Revenge Series',notes:'Added to series. Approved.'},
  {id:'BSR-006',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'She Rejected Me 3 Times',editType:'Title Change',submitted:'5d ago',status:'pending',changeFrom:'She Rejected Me 3 Times',changeTo:'Three Times Rejected: A Love Story',notes:'Proposed new title under review.'},
  {id:'BSR-007',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'Caught Kissing Her Photograph',editType:'Cover Update',submitted:'6d ago',status:'approved',changeFrom:'https://placehold.co/120x160/2d1b69/ffffff?text=Old',changeTo:'https://placehold.co/120x160/e0384d/ffffff?text=New',notes:'New cover matches brand guidelines. Approved.'},
  {id:'BSR-008',author:'Chiamaka_N',avatar:'https://i.pravatar.cc/100?img=41',book:'My Grandmother\'s Will',editType:'Description Edit',submitted:'1w ago',status:'rejected',changeFrom:'A family drama about inheritance and secrets.',changeTo:'When Amara\'s grandmother dies, she leaves behind a will that will tear the family apart and reveal secrets buried for decades.',notes:'Description contains major spoilers. Rejected with feedback.'},
  {id:'BSR-009',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'The Billionaire\'s Guard',editType:'Title Change',submitted:'1w ago',status:'approved',changeFrom:'Bodyguard Romance',changeTo:'The Billionaire\'s Guard',notes:'Better title. More specific. Approved.'},
  {id:'BSR-010',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Shadow of the Alpha',editType:'Genre Change',submitted:'1w ago',status:'pending',changeFrom:'Paranormal Romance',changeTo:'Paranormal Romance · Urban Fantasy',notes:'Adding Urban Fantasy subgenre. Needs review.'},
  {id:'BSR-011',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'Billionaire\'s Forbidden Love',editType:'Series Name',submitted:'2w ago',status:'approved',changeFrom:'Standalone',changeTo:'Billionaire Hearts Series',notes:'Added to series. Approved.'},
  {id:'BSR-012',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'King of the Underground',editType:'Cover Update',submitted:'2w ago',status:'pending',changeFrom:'https://placehold.co/120x160/0d0b1a/ffffff?text=Old',changeTo:'https://placehold.co/120x160/16a34a/ffffff?text=New',notes:'New cover with improved typography. Under review.'},
  {id:'BSR-013',author:'Isabelle Moreau',avatar:'https://i.pravatar.cc/100?img=25',book:'The Princess Guard',editType:'Description Edit',submitted:'3w ago',status:'approved',changeFrom:'A princess falls for her guard.',changeTo:'Princess Elara has one rule: never fall for the guard. But when assassin shadows close in, the man sworn to protect her heart becomes the greatest danger of all.',notes:'Compelling description. Approved.'},
  {id:'BSR-014',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Campus Queen',editType:'Title Change',submitted:'3w ago',status:'rejected',changeFrom:'Campus Queen',changeTo:'Queen of Campus',notes:'Original title is stronger. Rejected.'},
  {id:'BSR-015',author:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',book:'Lagos Love Story',editType:'Title + Cover',submitted:'3d ago',status:'pending',changes:[{type:'Title',from:'Lagos Love Story',to:'Lagos Nights: A Love Story'},{type:'Cover',from:'https://placehold.co/120x160/1a1a2e/ffffff?text=Old',to:'https://placehold.co/120x160/ff6b35/ffffff?text=New'}],notes:'Author wants to rebrand the book with a new title and cover for the series launch.'},
  {id:'BSR-016',author:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',book:'The Teacher\'s Secret',editType:'Title + Cover + Description',submitted:'4d ago',status:'pending',changes:[{type:'Title',from:'The Teacher\'s Secret',to:'Behind Closed Doors: A Teacher\'s Story'},{type:'Cover',from:'https://placehold.co/120x160/2d1b69/ffffff?text=Old',to:'https://placehold.co/120x160/dc2626/ffffff?text=New'},{type:'Description',from:'A teacher hides a dangerous secret.',to:'When Elizabeth discovers her student\'s dark home life, she must choose between her career and doing what\'s right — even if it means losing everything.'}],notes:'Full rebrand request. Title, cover, and description all changed to match the new direction of the story.'},
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
function editIcon(t){
  if(t.indexOf('Cover')!==-1)return'fa-image';
  if(t.indexOf('Title')!==-1)return'fa-pen';
  if(t.indexOf('Description')!==-1)return'fa-align-left';
  if(t.indexOf('Genre')!==-1)return'fa-tags';
  if(t.indexOf('Series')!==-1)return'fa-layer-group';
  return'fa-pen';
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
    var isDone=a.status!=='pending';
    return '<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+a.id+'"><div class="expand-ico"><i class="fas fa-chevron-right"></i></div><div class="author-cell col-book"><img src="'+a.avatar+'" alt=""/><div class="author-info"><span class="author-name">'+a.author+'</span><span class="author-id">'+a.id+'</span></div></div><div class="book-cell col-edit"><span class="book-title">'+a.book+'</span><span class="book-edit">'+a.editType+'</span></div><div class="edit-badge"><i class="fas '+editIcon(a.editType)+'"></i>'+a.editType+'</div><div>'+statusPill(a.status)+'</div><div class="actions-cell'+(isDone?' is-done':'')+'"><button class="btn btn-green" title="Approve" onclick="event.stopPropagation();approve(\''+a.id+'\')"><i class="fas fa-check"></i></button><button class="btn btn-danger" title="Reject" onclick="event.stopPropagation();reject(\''+a.id+'\')"><i class="fas fa-xmark"></i></button></div></div><div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+a.id+'"></div></div>';
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
  var wsHref='../author/book-workspace.html?book='+encodeURIComponent(bookSlug);
  var changeHtml='';
  if(a.changes){
    var rows=a.changes.map(function(c){
      if(c.type==='Cover'){
        return'<div class="change-box" style="margin-bottom:10px"><div class="lbl"><i class="fas fa-image"></i> '+c.type+'</div><div class="change-row"><div class="change-from"><label>Current</label><img class="change-img" src="'+c.from+'" alt="Old"/></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>New</label><img class="change-img" src="'+c.to+'" alt="New"/></div></div></div>';
      }
      return'<div class="change-box" style="margin-bottom:10px"><div class="lbl"><i class="fas fa-pen"></i> '+c.type+'</div><div class="change-row"><div class="change-from"><label>From</label><b>'+c.from+'</b></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>To</label><b>'+c.to+'</b></div></div></div>';
    });
    changeHtml=rows.join('');
  }else if(a.editType==='Cover Update'){
    changeHtml='<div class="change-box"><div class="lbl"><i class="fas fa-image"></i> Cover Change</div><div class="change-row"><div class="change-from"><label>Current Cover</label><img class="change-img" src="'+a.changeFrom+'" alt="Old cover"/></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>New Cover</label><img class="change-img" src="'+a.changeTo+'" alt="New cover"/></div></div></div>';
  }else{
    changeHtml='<div class="change-box"><div class="lbl"><i class="fas fa-pen"></i> Content Change</div><div class="change-row"><div class="change-from"><label>From</label><b>'+a.changeFrom+'</b></div><div class="change-arrow"><i class="fas fa-arrow-right"></i></div><div class="change-to"><label>To</label><b>'+a.changeTo+'</b></div></div></div>';
  }
  var actionsHtml='';
  if(isDone){
    actionsHtml='<a class="btn btn-text btn-ghost" href="'+wsHref+'"><i class="fas fa-eye"></i> View Book</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }else{
    actionsHtml='<button class="btn btn-text btn-green" onclick="approve(\''+a.id+'\')"><i class="fas fa-check"></i> Approve</button><button class="btn btn-text btn-danger" onclick="reject(\''+a.id+'\')"><i class="fas fa-xmark"></i> Reject</button><a class="btn btn-text btn-ghost" href="'+wsHref+'"><i class="fas fa-eye"></i> View Book</a><a class="btn btn-text btn-ghost" href="author-messages.html"><i class="fas fa-comments"></i> Message Author</a>';
  }
  p.innerHTML='<div class="detail-inner"><div class="detail-header"><img class="detail-avatar" src="'+a.avatar+'" alt=""/><div class="detail-title"><h3>'+a.author+'</h3><p>'+a.id+' · '+a.editType+'</p></div>'+statusPill(a.status)+'</div>'+changeHtml+'<div class="detail-grid"><div class="detail-card"><label>Book</label><b>'+a.book+'</b></div><div class="detail-card"><label>Edit Type</label><b>'+a.editType+'</b></div><div class="detail-card"><label>Submitted</label><b>'+a.submitted+'</b></div><div class="detail-card"><label>Status</label><b>'+statusPill(a.status)+'</b></div></div><div class="detail-notes-box"><div class="lbl"><i class="fas fa-note-sticky"></i> Review Notes</div><p>'+a.notes+'</p></div><div class="detail-actions">'+actionsHtml+'</div></div>';
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
function approve(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='approved';openRowId=null;render();toast(a.book+' — edit approved');}}
function reject(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='rejected';openRowId=null;render();toast(a.book+' — edit rejected');}}
function onRowToggle(e){var row=e.target.closest('.item-row');if(row&&!e.target.closest('.actions-cell')){var id=row.dataset.id;openRowId=openRowId===id?null:id;render();}}
function onExpandToggle(e){var box=e.target.closest('.change-from,.change-to');if(box&&!e.target.closest('img')){box.classList.toggle('expanded');}}
function bind(){
  if(_bound)return;_bound=true;
  window.go=go;
  window.approve=approve;
  window.reject=reject;
  document.addEventListener('click',onRowToggle);
  document.addEventListener('click',onExpandToggle);
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
}
function init(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'book-series-review',title:'Book Series Review',subtitle:'Authors request edits to book details',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
  bind();
  render();
}
window.BookSeriesReviewService={init:init};
})();
