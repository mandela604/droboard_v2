/**
 * vip-registration-review-service.js — VIP Registration Review page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[VipRegistrationReviewService] backend unavailable, using demo data', e);
    return null;
  }
}

var items=[
  {id:'VIP-001',author:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=45',book:'The CEO\'s Hidden Son',action:'lock',reason:'Protect exclusive content from piracy',submitted:'2h ago',status:'pending',notes:'Author wants to make the entire book VIP-only.'},
  {id:'VIP-002',author:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',book:'Wolf King\'s Vow',action:'lock',reason:'Monetize premium content',submitted:'5h ago',status:'pending',notes:'Requesting full book lock for VIP readers.'},
  {id:'VIP-003',author:'Lyra Night',avatar:'https://i.pravatar.cc/100?img=25',book:'His Hidden Luna',action:'unlock',reason:'Book is complete, want wider readership',submitted:'1d ago',status:'approved',notes:'Approved. Book unlocked for all readers.'},
  {id:'VIP-004',author:'Marcus Webb Jr.',avatar:'https://i.pravatar.cc/100?img=12',book:'Betrayed by the Mafia Prince',action:'lock',reason:'Revenue generation',submitted:'2d ago',status:'approved',notes:'Done. Book is now VIP-only.'},
  {id:'VIP-005',author:'Wren Okonkwo',avatar:'https://i.pravatar.cc/100?img=15',book:'Revenge at the Ivy League',action:'lock',reason:'Protect content',submitted:'3d ago',status:'rejected',notes:'Does not meet criteria yet. Must have 10K+ reads.'},
  {id:'VIP-006',author:'Ifeanyi_Story',avatar:'https://i.pravatar.cc/100?img=8',book:'Runaway Bride in Socked Feet',action:'unlock',reason:'Want more visibility for new readers',submitted:'4d ago',status:'pending',notes:'Awaiting review.'},
];
var currentPage=1,PER_PAGE=6,openRowId=null;
function filtered(){var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();var st=document.getElementById('statusFilter').value;return items.filter(function(a){if(st&&a.status!==st)return false;if(q&&a.author.toLowerCase().indexOf(q)===-1&&a.book.toLowerCase().indexOf(q)===-1)return false;return true;});}
function pill(s){return'<span class="status-pill '+s+'">'+s.charAt(0).toUpperCase()+s.slice(1)+'</span>';}
function render(){
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>tp)currentPage=tp;
  var start=(currentPage-1)*PER_PAGE,page=list.slice(start,start+PER_PAGE);
  var body=document.getElementById('tableBody');
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-inbox" style="font-size:20px;margin-bottom:8px;display:block"></i>No applications found.</div>';return;}
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    var actionChip=a.action==='lock'?'<span style="display:inline-flex;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--red-bg);color:var(--red)"><i class="fas fa-lock" style="margin-right:4px"></i>Lock</span>':'<span style="display:inline-flex;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--green-bg);color:var(--green)"><i class="fas fa-lock-open" style="margin-right:4px"></i>Unlock</span>';
    return '<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+a.id+'"><i class="fas fa-chevron-right expand-ico"></i><div class="author-cell col-author"><img src="'+a.avatar+'"/><span class="author-name">'+a.author+'</span></div><div class="col-txt col-genre">'+a.book+'</div><div>'+actionChip+'</div><div class="col-meta">'+a.reason+'</div><div>'+pill(a.status)+'</div><div class="actions-cell"><button class="mini-btn green" onclick="event.stopPropagation();approve(\''+a.id+'\')"><i class="fas fa-check"></i></button><button class="mini-btn danger" onclick="event.stopPropagation();reject(\''+a.id+'\')"><i class="fas fa-xmark"></i></button></div></div><div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+a.id+'"></div></div>';
  }).join('');
  if(openRowId&&page.some(function(a){return a.id===openRowId;}))renderDetail(openRowId);
}
function renderDetail(id){
  var a=items.find(function(x){return x.id===id;});if(!a)return;
  var p=document.getElementById('detail-'+id);if(!p)return;
  p.innerHTML='<div class="detail-inner"><div class="detail-grid"><div class="detail-item"><span>ID</span><b>'+a.id+'</b></div><div class="detail-item"><span>Author</span><b>'+a.author+'</b></div><div class="detail-item"><span>Book</span><b>'+a.book+'</b></div><div class="detail-item"><span>Action</span><b>'+(a.action==='lock'?'<i class="fas fa-lock" style="color:var(--red)"></i> Lock Book':'<i class="fas fa-lock-open" style="color:var(--green)"></i> Unlock Book')+'</b></div><div class="detail-item"><span>Status</span><b>'+pill(a.status)+'</b></div><div class="detail-item"><span>Reason</span><b>'+a.reason+'</b></div><div class="detail-item"><span>Submitted</span><b>'+a.submitted+'</b></div></div><div class="detail-notes"><i class="fas fa-note-sticky" style="color:var(--accent);margin-right:4px"></i>'+a.notes+'</div><div class="detail-foot"><button class="mini-btn green" onclick="approve(\''+a.id+'\')"><i class="fas fa-check"></i> Approve</button><button class="mini-btn danger" onclick="reject(\''+a.id+'\')"><i class="fas fa-xmark"></i> Reject</button></div></div>';
}
function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2200);}
window.approve=function(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='approved';openRowId=null;render();toast(a.author+' — Book '+(a.action==='lock'?'locked':'unlocked')+' successfully');}};
window.reject=function(id){var a=items.find(function(x){return x.id===id;});if(a){a.status='rejected';openRowId=null;render();toast(a.author+' — Request rejected');}};

var _bound=false;
function bindEvents(){
  if(_bound)return;_bound=true;
  document.addEventListener('click',function(e){var row=e.target.closest('.item-row');if(row&&!e.target.closest('.actions-cell')){openRowId=openRowId===row.dataset.id?null:row.dataset.id;render();}});
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
}

function attachShell(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'vip-review',title:'Book Lock Review',subtitle:'Authors request to lock or unlock their entire book',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search…'});
}

function init(){
  attachShell();
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/vip-registrations').then(function (data) { if (data && data.items) { render(); } });
  callBackend('/vip-registrations');
  bindEvents();
  render();
}

window.VipRegistrationReviewService={init:init};

})();
