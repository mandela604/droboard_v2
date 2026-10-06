/**
 * author-verification-service.js — Data layer for Author Verification page
 * Reads from window.EditorDemo.AUTHOR_VERIFICATION / window.EditorDemo.RECENT_REVIEWS
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__authorVerificationService) return;
window.__authorVerificationService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/author-verification';
var TIMEOUT_MS = 2500;
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

function getDemo(){
  var D = window.EditorDemo || {};
  return {
    requests: JSON.parse(JSON.stringify(D.REQUESTS || [])),
    recentReviews: JSON.parse(JSON.stringify(D.RECENT_REVIEWS || []))
  };
}

function findIn(arr, idx){
  if(idx < 0 || idx >= arr.length) throw new Error('Not found: index ' + idx);
  return arr[idx];
}

window.AuthorVerificationService = {

  async getRequests(){
    try { return await timeoutFetch(API_BASE + '/requests'); }
    catch(e){ await delay(); return getDemo().requests; }
  },

  async getRecentReviews(){
    try { return await timeoutFetch(API_BASE + '/recent-reviews'); }
    catch(e){ await delay(); return getDemo().recentReviews; }
  },

  async approveRequest(idx, requests){
    try { await timeoutFetch(API_BASE + '/requests/' + idx + '/approve', {method:'POST'}); }
    catch(e){ await delay(100); }
    var r = requests[idx];
    if(r){
      r.status = 'approved';
      r.reviewer = { name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47' };
    }
    return r;
  },

  async rejectRequest(idx, requests){
    try { await timeoutFetch(API_BASE + '/requests/' + idx + '/reject', {method:'POST'}); }
    catch(e){ await delay(100); }
    var r = requests[idx];
    if(r){
      r.status = 'rejected';
      r.reviewer = { name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47' };
    }
    return r;
  },

  async openFullHistory(){
    try { await timeoutFetch(API_BASE + '/history'); }
    catch(e){
      if(typeof window.toast==='function'){ try{ window.toast('Opening full review history…'); }catch(_){} }
    }
  },

  async init(){
    return initPage();
  }
};

/* ═══ PAGE UI LAYER (migrated from inline script; demo paths keep working) ═══ */
var REQUESTS=[], RECENT_REVIEWS=[];
var currentView='all', currentModalIdx=null;
var _pageInited=false;

function attachShell(){
  SeniorEditorSidebar.attach('#dashboardRoot',{
    activeItem:'author-verification',title:'Author Verification',subtitle:'Review and approve author identity submissions',
    user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,
    searchPlaceholder:'Search by author name or email...',mobileSearchTarget:'#tableSearch',
    onSearch:function(v){document.getElementById('tableSearch').value=v;refresh();}
  });
}

function statusPillHtml(s){
  if(s==='approved')return'<span class="status-pill"><span class="dot"></span>Approved</span>';
  if(s==='pending')return'<span class="status-pill pending"><span class="dot"></span>Pending</span>';
  return'<span class="status-pill rejected"><span class="dot"></span>Rejected</span>';
}
function reviewerCellHtml(r){
  if(!r)return'<div class="reviewer-cell unassigned"><span>Unassigned</span></div>';
  return'<div class="reviewer-cell"><img src="'+r.avatar+'" alt=""/><span>'+r.name+'</span></div>';
}
function viewSource(){
  if(currentView==='pending')return REQUESTS.filter(function(r){return r.status==='pending'});
  if(currentView==='approved')return REQUESTS.filter(function(r){return r.status==='approved'});
  if(currentView==='rejected')return REQUESTS.filter(function(r){return r.status==='rejected'});
  return REQUESTS;
}
function currentFiltered(){
  var q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();
  var source=viewSource();
  if(!q)return source;
  return source.filter(function(r){return r.name.toLowerCase().indexOf(q)!==-1||r.email.toLowerCase().indexOf(q)!==-1});
}

function renderStats(){
  var total=REQUESTS.length;
  var pending=REQUESTS.filter(function(r){return r.status==='pending'}).length;
  var approved=REQUESTS.filter(function(r){return r.status==='approved'}).length;
  var rejected=REQUESTS.filter(function(r){return r.status==='rejected'}).length;
  document.getElementById('statsGrid').innerHTML=
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico pink"><i class="fas fa-user-check"></i></div></div><div class="stat-num">'+total+'</div><div class="stat-lbl">Total Requests</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico amber"><i class="fas fa-hourglass-half"></i></div></div><div class="stat-num">'+pending+'</div><div class="stat-lbl">Pending Review</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico green"><i class="fas fa-circle-check"></i></div></div><div class="stat-num">'+approved+'</div><div class="stat-lbl">Approved</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico red"><i class="fas fa-circle-xmark"></i></div></div><div class="stat-num">'+rejected+'</div><div class="stat-lbl">Rejected</div></div>'+
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico blue"><i class="fas fa-clock"></i></div></div><div class="stat-num">1.8d</div><div class="stat-lbl">Avg. Review Time</div></div>';
}

function actionsCellHtml(r, idx){
  if(r.status==='pending'){
    return'<div class="actions-cell">'+
      '<button class="act-btn approve" title="Approve" data-action="approve" data-idx="'+idx+'"><i class="fas fa-check"></i></button>'+
      '<button class="act-btn reject" title="Reject" data-action="reject" data-idx="'+idx+'"><i class="fas fa-xmark"></i></button>'+
      '<button class="act-btn" title="View documents" data-action="view" data-idx="'+idx+'"><i class="fas fa-eye"></i></button>'+
    '</div>';
  }
  return'<div class="actions-cell">'+
    '<button class="act-btn" title="View documents" data-action="view" data-idx="'+idx+'"><i class="fas fa-eye"></i></button>'+
    '<button class="act-btn" title="More" data-action="more" data-idx="'+idx+'"><i class="fas fa-ellipsis"></i></button>'+
  '</div>';
}

function renderTable(list){
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="6"><i class="fas fa-folder-open"></i>No verification requests match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(r){
    var globalIdx=REQUESTS.indexOf(r);
    return'<tr>'+
      '<td data-label="Author"><div class="auth-cell"><img class="auth-avatar" src="'+r.avatar+'" alt=""/><div><div class="auth-name">'+r.name+'</div><div class="auth-email">'+r.email+'</div></div></div></td>'+
      '<td data-label="Document"><div class="doc-cell"><i class="fas '+r.docIcon+'"></i>'+r.doc+'</div></td>'+
      '<td data-label="Submitted" class="plain-cell">'+r.submitted+'</td>'+
      '<td data-label="Reviewer">'+reviewerCellHtml(r.reviewer)+'</td>'+
      '<td data-label="Status">'+statusPillHtml(r.status)+'</td>'+
      '<td data-label="Actions">'+actionsCellHtml(r, globalIdx)+'</td>'+
    '</tr>';
  }).join('');
}

function renderPageInfo(count){
  var total=REQUESTS.length;
  var shown=Math.min(8,count);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(count?1:0)+'</b> to <b>'+shown+'</b> of <b>'+total+'</b> requests';
}

function renderPagination(){
  var wrap=document.getElementById('pageBtns');
  var pages=[1,2,3];
  wrap.innerHTML='<button class="pg-btn" id="pgPrev" disabled><i class="fas fa-chevron-left"></i></button>'+
    pages.map(function(p){return'<button class="pg-btn'+(p===1?' active':'')+'" data-p="'+p+'">'+p+'</button>';}).join('')+
    '<button class="pg-btn" id="pgNext"><i class="fas fa-chevron-right"></i></button>';
  wrap.querySelectorAll('[data-p]').forEach(function(btn){
    btn.addEventListener('click',function(){wrap.querySelectorAll('.pg-btn').forEach(function(b){b.classList.remove('active')});btn.classList.add('active');});
  });
}

function renderRecentReviews(){
  document.getElementById('authorGrid').innerHTML=RECENT_REVIEWS.map(function(a){
    return'<div class="author-card" data-name="'+a.name+'">'+
      '<img src="'+a.avatar+'" alt="'+a.name+'"/>'+
      '<div class="author-card-name">'+a.name+'</div>'+
      '<div class="author-card-meta">'+a.meta+'</div>'+
      statusPillHtml(a.status)+
    '</div>';
  }).join('');
}

function refresh(){
  var list=currentFiltered();
  renderTable(list);
  renderPageInfo(list.length);
  renderStats();
  var pending=REQUESTS.filter(function(r){return r.status==='pending'}).length;
  document.getElementById('pendingCount').textContent=pending;
}

/* ── Approve / Reject (UI layer; persists via data-layer methods above) ── */
async function approveRequestUI(idx){
  var r=REQUESTS[idx]; if(!r)return;
  r.status='approved';
  r.reviewer={name:'Reina Morgan',avatar:'https://i.pravatar.cc/100?img=47'};
  RECENT_REVIEWS.unshift({name:r.name,avatar:r.avatar,meta:'Approved · Just now',status:'approved'});
  if(RECENT_REVIEWS.length>6)RECENT_REVIEWS.pop();
  toast('Approved '+r.name);
  refresh();renderRecentReviews();
  window.AuthorVerificationService.approveRequest(idx,REQUESTS).catch(function(){});
}

async function rejectRequestUI(idx){
  var r=REQUESTS[idx]; if(!r)return;
  r.status='rejected';
  r.reviewer={name:'Reina Morgan',avatar:'https://i.pravatar.cc/100?img=47'};
  RECENT_REVIEWS.unshift({name:r.name,avatar:r.avatar,meta:'Rejected · Just now',status:'rejected'});
  if(RECENT_REVIEWS.length>6)RECENT_REVIEWS.pop();
  toast('Rejected '+r.name);
  refresh();renderRecentReviews();
  window.AuthorVerificationService.rejectRequest(idx,REQUESTS).catch(function(){});
}

/* ═══ DOCUMENT VIEWER MODAL ═══ */
function openDocModal(idx){
  var r=REQUESTS[idx]; if(!r)return;
  currentModalIdx=idx;
  document.getElementById('docModalAvatar').src=r.avatar;
  document.getElementById('docModalName').textContent=r.name;
  document.getElementById('docModalEmail').textContent=r.email;
  document.getElementById('docModalDocType').textContent=r.doc+' — Document Preview';
  document.getElementById('docModalDocName').textContent=r.doc;
  document.getElementById('docModalDate').textContent=r.submitted;
  document.getElementById('docModalStatus').innerHTML=statusPillHtml(r.status);
  document.getElementById('docModalReviewer').textContent=r.reviewer?r.reviewer.name:'Unassigned';
  var actionsEl=document.getElementById('docModalActions');
  if(r.status==='pending'){
    actionsEl.innerHTML='<button class="doc-btn-approve" id="modalApprove"><i class="fas fa-check"></i> Approve</button>'+
      '<button class="doc-btn-reject" id="modalReject"><i class="fas fa-xmark"></i> Reject</button>'+
      '<button class="doc-btn-close" id="modalClose">Close</button>';
    document.getElementById('modalApprove').addEventListener('click',function(){approveRequestUI(idx);closeDocModal();});
    document.getElementById('modalReject').addEventListener('click',function(){rejectRequestUI(idx);closeDocModal();});
    document.getElementById('modalClose').addEventListener('click',closeDocModal);
  }else{
    actionsEl.innerHTML='<button class="doc-btn-close" id="modalClose" style="flex:1">Close</button>';
    document.getElementById('modalClose').addEventListener('click',closeDocModal);
  }
  document.getElementById('docModal').classList.add('show');
}
function closeDocModal(){document.getElementById('docModal').classList.remove('show');currentModalIdx=null;}
function approveFromModal(){ if(currentModalIdx!==null){approveRequestUI(currentModalIdx);closeDocModal();} }
function rejectFromModal(){ if(currentModalIdx!==null){rejectRequestUI(currentModalIdx);closeDocModal();} }

/* ── Toast ── */
function toast(m){var t=document.getElementById('toastEl');if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:9000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)';document.body.appendChild(t);}
t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0';},2500);}

function bindEvents(){
  document.getElementById('tableBody').addEventListener('click',function(e){
    var btn=e.target.closest('[data-action]');
    if(!btn)return;
    var action=btn.dataset.action;
    var idx=parseInt(btn.dataset.idx,10);
    if(action==='approve')approveRequestUI(idx);
    else if(action==='reject')rejectRequestUI(idx);
    else if(action==='view')openDocModal(idx);
    else if(action==='more')toast('More actions for '+REQUESTS[idx].name);
  });

  document.querySelectorAll('.top-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      document.querySelectorAll('.top-tab').forEach(function(t){t.classList.remove('active')});
      tab.classList.add('active');
      currentView=tab.dataset.view;
      document.getElementById('tableTitle').textContent=
        currentView==='all'?'All Verification Requests':
        currentView==='pending'?'Pending Review':
        currentView==='approved'?'Approved Authors':'Rejected Requests';
      document.getElementById('tableSearch').value='';
      refresh();
    });
  });

  document.getElementById('docModal').addEventListener('click',function(e){if(e.target.id==='docModal')closeDocModal();});
  document.getElementById('exportBtn').addEventListener('click',function(){toast('Exporting verification report…');});
  document.getElementById('tableSearch').addEventListener('input',refresh);
}

/* ═══ INIT ═══ */
async function initPage(){
  if(_pageInited) return;
  _pageInited = true;
  attachShell();
  // Expose legacy global handlers used by inline onclick attributes in markup:
  window.toast = toast;
  window.closeDocModal = closeDocModal;
  window.openDocModal = openDocModal;
  window.approveFromModal = approveFromModal;
  window.rejectFromModal = rejectFromModal;
  window.refresh = refresh;
  bindEvents();
  var data=await window.AuthorVerificationService.getRequests();
  REQUESTS=data;
  var recent=await window.AuthorVerificationService.getRecentReviews();
  RECENT_REVIEWS=recent;
  renderPagination();
  renderRecentReviews();
  refresh();
}
})();
