/**
 * author-verification-service.js — Data layer for Author Verification page
 * Reads from window.EditorDemo.AUTHOR_VERIFICATION / window.EditorDemo.RECENT_REVIEWS
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__authorVerificationService) return;
window.__authorVerificationService = true;

/* Demo-data self-load: page HTML no longer includes ../data/editor-demo-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.EditorDemo === 'undefined' && typeof document !== 'undefined' && document.readyState === 'loading'){
  document.write('<script src="../data/editor-demo-data.js"><\/script>');
}

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

/* Backend rows already carry name/email/doc/reviewer; marking them live stops
   hydrate() from filling a demo author's KYC or a demo owning editor on top. */
function liveRows(rows){
  return (rows || []).map(function(r){
    r.live = true;
    if(!r.avatar) r.avatar = '../assets/droboard-icon.png';
    return r;
  });
}

/* ── What each author actually uploaded with the request ──
   The core matches backend kycSchema (type/dob/age/nin/altId/guardian/idPhotos);
   selfie, phone, address, country and expiry are the extra rows the verification
   form will collect — KycPanel simply omits them when a record has none.
   Backend today: the AuthorVerification record only carries docType + one docUrl,
   so this whole panel is the target shape, not live data. */
var KYC={
  'Daniel Reyes':{type:'self',dob:'1994-07-12',age:32,nin:'12345678901',phone:'+234 803 114 5520',address:'14 Bode Thomas St, Surulere, Lagos',country:'Nigeria',expiry:'2030-04-01',idPhotos:{front:'nin-slip-front.jpg',back:'nin-slip-back.jpg'},selfie:'https://i.pravatar.cc/300?img=51'},
  'Julien Moreau':{type:'self',dob:'1990-02-09',age:36,nin:'',altId:{type:'Passport',no:'FR-92R44117'},phone:'+33 6 44 21 09 87',address:'8 Rue Oberkampf, 75011 Paris, France',country:'France',expiry:'2029-11-01',idPhotos:{front:'passport-front.jpg',back:'passport-back.jpg'},selfie:'https://i.pravatar.cc/300?img=15'},
  'Kenji Watanabe':{type:'pending',dob:'2006-05-21',age:20,nin:'',altId:{type:"Driver's License",no:'LN-4471-KT'},phone:'+81 90 5521 7788',address:'2-14 Shibuya, Tokyo, Japan',country:'Japan',idPhotos:{front:'license-front.jpg',back:'license-back.jpg'}},
  'Nadia Petrov':{type:'guardian',dob:'2009-01-14',age:17,nin:'',guardian:{name:'Elena Petrova',relationship:'Parent',idNo:'9876543210'},phone:'+7 916 440 2210',address:'Tverskaya 12, Moscow, Russia',country:'Russia',idPhotos:{front:'guardian-id-front.jpg',back:'guardian-id-back.jpg'},selfie:'https://i.pravatar.cc/300?img=24'},
  'Owen Fitzgerald':{type:'self',dob:'1987-10-30',age:38,nin:'23456789012',phone:'+353 87 663 4402',address:'42 Marlborough St, Dublin 1, Ireland',country:'Ireland',expiry:'2031-06-01',idPhotos:{front:'nin-slip-front.jpg'}},
  'Sofia Lindqvist':{type:'self',dob:'1995-06-03',age:31,nin:'',altId:{type:'Passport',no:'SE-5520991'},phone:'+46 70 210 8845',address:'Storgatan 19, Malmö, Sweden',country:'Sweden',expiry:'2028-02-01',idPhotos:{front:'passport-front.jpg',back:'passport-back.jpg'},selfie:'https://i.pravatar.cc/300?img=32'},
  'Amara Okafor':{type:'self',dob:'1993-12-18',age:32,nin:'34567890123',phone:'+234 811 205 4471',address:'9 Adeola Odeku St, Victoria Island, Lagos',country:'Nigeria',expiry:'2029-09-01',idPhotos:{front:'nin-slip-front.jpg',back:'nin-slip-back.jpg'},selfie:'https://i.pravatar.cc/300?img=45'},
  'Isabella Rossi':{type:'self',dob:'1991-04-25',age:35,nin:'',altId:{type:"Driver's License",no:'IT-DR-778120'},phone:'+39 340 118 9022',address:'Via del Corso 44, Rome, Italy',country:'Italy',expiry:'2027-05-01',idPhotos:{front:'license-front.jpg',back:'license-back.jpg'},selfie:'https://i.pravatar.cc/300?img=38'},
  'Layla Haddad':{type:'pending',dob:'1998-08-07',age:28,nin:'',altId:{type:'Passport',no:'LB-204418'},phone:'+961 3 774 120',address:'Hamra Street, Beirut, Lebanon',country:'Lebanon',idPhotos:{front:'passport-front.jpg',back:'passport-back.jpg'},selfie:'https://i.pravatar.cc/300?img=48'},
  'Priya Nair':{type:'self',dob:'1996-01-11',age:30,nin:'45678901234',phone:'+91 98450 22117',address:'4 Marine Drive Road, Kochi, Kerala, India',country:'India',expiry:'2032-01-01',idPhotos:{front:'nin-slip-front.jpg',back:'nin-slip-back.jpg'},selfie:'https://i.pravatar.cc/300?img=27'},
  'Tobias Bergman':{type:'self',dob:'1989-09-27',age:36,nin:'56789012345',phone:'+46 76 330 1188',address:'Kungsportsavenyen 3, Göteborg, Sweden',country:'Sweden',idPhotos:{}},
  'Grace Wallace':{type:'self',dob:'1992-03-05',age:34,nin:'',altId:{type:'Passport',no:'GB-8841203'},phone:'+44 7700 900412',address:'27 Deansgate, Manchester, UK',country:'United Kingdom',expiry:'2024-12-01',idPhotos:{front:'passport-front.jpg',back:'passport-back.jpg'},selfie:'https://i.pravatar.cc/300?img=44'},
};
/* Why the author says they are applying — the free text under the upload form. */
var STATEMENT={
  'Daniel Reyes':'I publish under my own name and want payouts to go to my bank account. Uploaded my NIN slip front and back plus a selfie holding it.',
  'Julien Moreau':'I am not a Nigerian resident, so I submitted my passport instead. Happy to add proof of address if that is needed.',
  'Kenji Watanabe':'My national ID is still being issued. I attached my driver’s licence so we can start sooner — tell me if you need anything else.',
  'Nadia Petrov':'I am 17 and my mother co-signed. Her ID and the consent form are both attached.',
  'Owen Fitzgerald':'Front photo is clear but I could not photograph the back of the slip — the laminate peels and reflects. Will re-upload on request.',
  'Sofia Lindqvist':'Passport is my only current ID. I write two series here and want to switch to the verified payout tier.',
  'Amara Okafor':'Same name as on my bank account, so transfers should match. Everything is in the upload.',
  'Isabella Rossi':'Licence photo is old but the number is current. Let me know if you need a newer picture.',
  'Layla Haddad':'I applied months ago and my NIN enrolment is still pending. Uploading the receipt and my passport meanwhile.',
  'Priya Nair':'Just finished my first serialized book and want to be eligible for the advance programme.',
  'Tobias Bergman':'I uploaded a screenshot of my ID instead of a photo, I was not sure about the format.',
  'Grace Wallace':'Here is my passport — it expired recently but the details still match my account.',
};

window.AuthorVerificationService = {

  async getRequests(){
    try { return liveRows(await timeoutFetch(API_BASE + '/requests')); }
    catch(e){ await delay(); return getDemo().requests; }
  },

  async getRecentReviews(){
    try { return liveRows(await timeoutFetch(API_BASE + '/recent-reviews')); }
    catch(e){ await delay(); return getDemo().recentReviews; }
  },

  async approveRequest(idx, requests){
    var r = requests[idx];
    if(r && r.live){
      // Live rows must surface a 403/409 — the optimistic UI has to roll back
      // rather than claim another editor's writer was approved.
      await timeoutFetch(API_BASE + '/requests/' + encodeURIComponent(r.id) + '/approve', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    } else { await delay(100); }
    if(r){
      r.status = 'approved';
      // The reviewer column is the author's own senior editor, so a decision
      // is recorded separately instead of replacing who owns the relationship.
      r.decision = { by: ACTING_EDITOR, at: 'Just now', action: 'approved', reason: '' };
    }
    return r;
  },

  async rejectRequest(idx, requests, reason){
    var r = requests[idx];
    if(r && r.live){
      await timeoutFetch(API_BASE + '/requests/' + encodeURIComponent(r.id) + '/reject', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reason:reason||''})});
    } else { await delay(100); }
    if(r){
      r.status = 'rejected';
      r.decision = { by: ACTING_EDITOR, at: 'Just now', action: 'rejected', reason: reason||'' };
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
var currentView='all', openId=null, rejectOpenId=null;
var _pageInited=false;

/* A request only reaches this table because the author is under the editor
   reading it, so the reviewer on every row is the owner of this dashboard —
   the same person for all of them, with no "via invite" or "assigned" note.
   In production this comes from the logged-in session; the backend already
   scopes the list to the caller (User.editorInviteCode → the inviter). */
var ME={name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'};
var ACTING_EDITOR=ME.name;

/* Rows come from the API without a stable id or the uploaded documents, so the
   table can key the expanded panel on the person, not on an array position that
   moves the moment a filter is applied. */
function hydrate(list){
  (list||[]).forEach(function(r,i){
    if(!r.id) r.id='AVR-'+String(i+1).padStart(3,'0');
    r.reviewer=ME;
    if(r.live){
      if(!r.doc) r.doc='No documents';
      if(!r.docIcon) r.docIcon='fa-id-card';
      if(!r.submitted) r.submitted='—';
      return;
    }
    if(!r.kyc) r.kyc=KYC[r.name]||null;
    if(!r.statement) r.statement=STATEMENT[r.name]||'';
  });
  return list;
}

function attachShell(){
  SeniorEditorSidebar.attach('#dashboardRoot',{
    activeItem:'author-verification',title:'Author Verification',subtitle:'Review and approve author identity submissions',
    user:{name:ME.name,role:ME.role,avatar:ME.avatar},notifCount:8,
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
  if(!r||!r.name) return '<div class="reviewer-cell"><span>\u2014</span></div>';
  return'<div class="reviewer-cell"><img src="'+(r.avatar||'../assets/droboard-icon.png')+'" alt=""/><span>'+r.name+'</span></div>';
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
  var eye='<button class="act-btn" title="See what they submitted" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-eye"></i></button>';
  if(r.status==='pending'){
    return'<div class="actions-cell">'+
      '<button class="act-btn approve" title="Approve" data-action="approve" data-idx="'+idx+'"><i class="fas fa-check"></i></button>'+
      '<button class="act-btn reject" title="Reject \u2014 write a reason" data-action="reject-open" data-idx="'+idx+'"><i class="fas fa-xmark"></i></button>'+
      eye+
    '</div>';
  }
  return'<div class="actions-cell">'+eye+
    '<button class="act-btn" title="More" data-action="more" data-idx="'+idx+'"><i class="fas fa-ellipsis"></i></button>'+
  '</div>';
}

function renderTable(list){
  var body=document.getElementById('tableBody');
  if(!list.length){body.innerHTML='<tr class="empty-row"><td colspan="6"><i class="fas fa-folder-open"></i>No verification requests match this search.</td></tr>';return;}
  body.innerHTML=list.slice(0,8).map(function(r){
    var idx=REQUESTS.indexOf(r), isOpen=openId===r.id;
    return'<tr class="req-row'+(isOpen?' is-open':'')+'" data-idx="'+idx+'">'+
      '<td data-label="Author"><div class="auth-cell">'+
        '<button type="button" class="row-chev" data-action="toggle" data-idx="'+idx+'" aria-label="'+(isOpen?'Hide submission':'Show submission')+'" aria-expanded="'+isOpen+'"><i class="fas fa-chevron-right"></i></button>'+
        '<img class="auth-avatar" src="'+r.avatar+'" alt=""/><div><div class="auth-name">'+r.name+'</div><div class="auth-email">'+r.email+'</div></div>'+
      '</div></td>'+
      '<td data-label="Document"><div class="doc-cell"><i class="fas '+r.docIcon+'"></i>'+r.doc+'</div></td>'+
      '<td data-label="Submitted" class="plain-cell">'+r.submitted+'</td>'+
      '<td data-label="Reviewer">'+reviewerCellHtml(r.reviewer)+'</td>'+
      '<td data-label="Status">'+statusPillHtml(r.status)+'</td>'+
      '<td data-label="Actions">'+actionsCellHtml(r, idx)+'</td>'+
    '</tr>'+
    (isOpen?'<tr class="detail-row"><td colspan="6">'+detailHTML(r, idx)+'</td></tr>':'');
  }).join('');
}

/* ── Expanded row: everything the author actually submitted ── */
function checksOf(r){
  var k=r.kyc;
  if(!k) return [{s:'bad',t:'No documents uploaded',d:'This request arrived with an empty submission — there is nothing to verify yet.'}];
  var ph=k.idPhotos||{}, out=[];
  out.push({s:'ok',t:'Name matches account',d:r.name+' \u00b7 '+r.email});
  var okAge=(k.type==='guardian')||k.age>=18;
  out.push({s:okAge?'ok':'warn',t:'Age requirement',d:k.age+' years old \u00b7 '+(k.type==='guardian'?'guardian co-sign attached':k.age>=18?'18 or older':'under 18 with no guardian form')});
  out.push({s:(ph.front&&ph.back)?'ok':'bad',t:'ID front + back',d:(ph.front&&ph.back)?'Both pages uploaded':(ph.front?'Back page missing':'Both pages missing')});
  out.push({s:k.selfie?'ok':'warn',t:'Selfie holding the ID',d:k.selfie?'Uploaded':'Not provided'});
  if(k.expiry){
    var dead=new Date(k.expiry).getTime()<Date.now();
    out.push({s:dead?'bad':'ok',t:'Document validity',d:'Expires '+KycPanel.date(k.expiry)+(dead?' \u2014 expired':'')});
  }
  if(k.type==='pending') out.push({s:'warn',t:'NIN verification',d:'Alternate ID accepted for now; NIN still pending.'});
  return out;
}
/* Why a submission gets bounced. The reason is mandatory — a bare "rejected"
   tells the author nothing, and it is what they see in Author Center. */
var REJECT_PRESETS=[
  {label:'Unreadable ID',text:'The ID photos are unreadable \u2014 please re-upload a front and back shot in daylight, with all four corners visible.'},
  {label:'Expired document',text:'The document has expired. Upload one that is still valid.'},
  {label:'Name mismatch',text:'The name on the document does not match your account name. Correct the profile or upload the matching ID.'},
  {label:'No selfie',text:'We need a selfie holding the ID next to your face, plus the front and back of the document.'},
  {label:'Guardian form',text:'You are under 18, so we need a guardian consent form and the guardian\u2019s own ID before this can be approved.'}
];
function rejectBoxHTML(r, idx){
  var draft=r.rejectDraft!==undefined?r.rejectDraft:REJECT_PRESETS[0].text;
  var h='<div class="rej-box">';
  h+='<div class="rej-lbl"><i class="fas fa-envelope-open-text"></i> Reason in the email to '+r.name+' &mdash; '+r.email+'</div>';
  h+='<textarea class="rej-text" id="rejText-'+r.id+'" rows="3" placeholder="Say exactly what is missing or wrong\u2026">'+KycPanel.esc(draft)+'</textarea>';
  h+='<div class="rej-chips">'+REJECT_PRESETS.map(function(p,i){
    return '<button type="button" class="rej-chip" data-reason="'+i+'">'+(i+1)+'. '+p.label+'</button>';
  }).join('')+'</div>';
  h+='<div class="rej-actions">'
    +'<button class="sub-btn no" data-action="reject-email" data-idx="'+idx+'"><i class="fas fa-envelope-circle-check"></i> Send rejection by email</button>'
    +'<button class="sub-btn close" data-action="reject-cancel" data-idx="'+idx+'">Cancel</button>'
    +'</div></div>';
  return h;
}
function detailHTML(r, idx){
  var h='<div class="sub-inner">';
  h+='<div class="sub-head"><img class="sub-avatar" src="'+r.avatar+'" alt=""/>'
    +'<div class="sub-head-t"><h3>'+r.name+'</h3><p>'+r.id+' \u00b7 '+r.email+' \u00b7 '+r.doc+'</p></div>'+statusPillHtml(r.status)+'</div>';
  h+='<div class="sub-grid">'
    +'<div class="sub-card"><label>Document type</label><b>'+r.doc+'</b></div>'
    +'<div class="sub-card"><label>Submitted</label><b>'+r.submitted+'</b></div>'
    +'<div class="sub-card"><label>Senior editor</label><b>'+ME.name+'</b></div>'
    +'<div class="sub-card"><label>Request ID</label><b>'+r.id+'</b></div>'
    +'</div>';
  h+=KycPanel.html({id:r.id, author:r.name, bookTitle:r.doc, kyc:r.kyc});
  h+='<div class="sub-block"><div class="sub-lbl"><i class="fas fa-list-check"></i> Submission checks</div><div class="sub-checks">'
    +checksOf(r).map(function(c){
      var ic=c.s==='ok'?'fa-circle-check':c.s==='warn'?'fa-triangle-exclamation':'fa-circle-xmark';
      return'<div class="sub-check '+c.s+'"><i class="fas '+ic+'"></i><div><b>'+c.t+'</b><span>'+c.d+'</span></div></div>';
    }).join('')+'</div></div>';
  if(r.statement){
    h+='<div class="sub-block"><div class="sub-lbl"><i class="fas fa-note-sticky"></i> Author\u2019s statement</div><p class="sub-note">'+r.statement+'</p></div>';
  }
  if(r.decision){
    h+='<div class="sub-block"><div class="sub-lbl"><i class="fas fa-gavel"></i> Decision</div>'
      +'<p class="sub-note">'+(r.decision.reason?KycPanel.esc(r.decision.reason):'Identity approved \u2014 verified badge granted.')+'</p>'
      +'<p class="sub-by">'+r.decision.by+' \u00b7 '+r.decision.at+'</p></div>';
  }
  if(r.status==='pending'){
    if(rejectOpenId===r.id) h+=rejectBoxHTML(r, idx);
    h+='<div class="sub-actions">'
      +'<button class="sub-btn ok" data-action="approve" data-idx="'+idx+'"><i class="fas fa-check"></i> Approve</button>'
      +'<button class="sub-btn no" data-action="reject-open" data-idx="'+idx+'"><i class="fas fa-xmark"></i> Reject</button>'
      +'<button class="sub-btn close" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-chevron-up"></i> Close</button>'
      +'</div>';
  }else{
    h+='<div class="sub-actions"><button class="sub-btn close" data-action="toggle" data-idx="'+idx+'"><i class="fas fa-chevron-up"></i> Close</button></div>';
  }
  return h+'</div>';
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
  var prevStatus=r.status, prevDecision=r.decision;
  r.status='approved';
  r.decision={by:ACTING_EDITOR,at:'Just now',action:'approved',reason:''};
  rejectOpenId=null;
  refresh();
  try{
    await window.AuthorVerificationService.approveRequest(idx,REQUESTS);
    RECENT_REVIEWS.unshift({name:r.name,avatar:r.avatar,meta:'Approved · Just now',status:'approved'});
    if(RECENT_REVIEWS.length>6)RECENT_REVIEWS.pop();
    toast('Approved '+r.name);
    renderRecentReviews();
  }catch(e){
    r.status=prevStatus; r.decision=prevDecision; refresh();
    var code=e&&e.message;
    toast((code==='403'||code==='404')?'That writer is not in your queue':code==='409'?'Already decided by another editor':'Could not approve \u2014 try again');
  }
}

/* Rejection always carries a reason — never a bare "no". */
async function rejectRequestUI(idx, reason){
  var r=REQUESTS[idx]; if(!r)return;
  var prevStatus=r.status, prevDecision=r.decision;
  r.status='rejected';
  r.decision={by:ACTING_EDITOR,at:'Just now',action:'rejected',reason:reason};
  rejectOpenId=null;
  refresh();
  try{
    await window.AuthorVerificationService.rejectRequest(idx,REQUESTS,reason);
    RECENT_REVIEWS.unshift({name:r.name,avatar:r.avatar,meta:'Rejected · Just now',status:'rejected'});
    if(RECENT_REVIEWS.length>6)RECENT_REVIEWS.pop();
    toast('Rejection recorded for '+r.name);
    renderRecentReviews();
  }catch(e){
    r.status=prevStatus; r.decision=prevDecision; refresh();
    var rcode=e&&e.message;
    toast(rcode==='400'?'The reason is too short to send':(rcode==='404'||rcode==='403')?'That writer is not in your queue':rcode==='409'?'Already decided by another editor':'Could not reject \u2014 try again');
  }
}

/* ═══ ROW EXPANSION ═══ */
function toggleRow(idx){
  var r=REQUESTS[idx]; if(!r)return;
  openId = (openId===r.id) ? null : r.id;
  if(openId!==r.id) rejectOpenId=null;
  refresh();
  if(!openId) return;
  var el=document.querySelector('.detail-row');
  if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* Rejecting from the row (or the panel) always lands on the open row with the
   reason box showing, so nobody can bounce a submission without writing why. */
function openRejectBox(idx){
  var r=REQUESTS[idx]; if(!r)return;
  openId=r.id;
  rejectOpenId=r.id;
  refresh();
  var box=document.querySelector('.rej-text');
  if(box){ box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  else if(r.status!=='pending') toast(r.name+' is already '+r.status);
}
function draftText(r){
  var box=document.getElementById('rejText-'+r.id);
  return box ? box.value.trim() : (r.rejectDraft||'').trim();
}
/* ── Rejection email ──
   A bare mailto: link does nothing when the machine has no registered mail
   handler (which is the case inside this app's webview), so the draft is shown
   here in full — recipient, subject and body already filled — and the jump to
   Gmail or the desktop mail app is just one of the buttons under it. If the
   jump gets blocked, the text is still on screen and copyable. */
function mailDraft(r, why){
  var who=(r.reviewer&&r.reviewer.name)||ME.name;
  var body=[
    'Hello '+r.name+',',
    '',
    why,
    '',
    'Your verification request '+r.id+' ('+r.doc+', submitted '+r.submitted+') is now marked rejected, so your profile will not carry the verified badge until you re-submit.',
    'Upload the correct document again from Author Center \u2192 Verification and it comes back to me.',
    '',
    '\u2014 '+who+', Senior Editor, Droboard'
  ].join('\n');
  return {
    to:r.email,
    subject:'Action needed on your Droboard identity verification ('+r.id+')',
    body:body
  };
}
var _mail=null;

function gmailHref(d){
  return 'https://mail.google.com/mail/?view=cm&fs=1'
    +'&to='+encodeURIComponent(d.to)
    +'&su='+encodeURIComponent(d.subject)
    +'&body='+encodeURIComponent(d.body);
}
function mailtoHref(d){
  /* The address keeps its literal @ — some mail handlers refuse %40 in a
     mailto: address, even though it is fine inside a query string. */
  var addr=String(d.to).replace(/[?#\s\u2028\u2029]/g,'');
  return 'mailto:'+addr
    +'?subject='+encodeURIComponent(d.subject)
    +'&body='+encodeURIComponent(d.body);
}
/* Returns the new window, or null when the pop-up was blocked. */
function jumpTo(d, how){
  try{
    if(how==='gmail'){
      var w=window.open(gmailHref(d),'_blank');
      if(w) return w;
    }
    if(how==='app'){
      var a=document.createElement('a');
      a.href=mailtoHref(d);
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return a;
    }
  }catch(e){}
  return null;
}
function copyDraft(d){
  var text='To: '+d.to+'\nSubject: '+d.subject+'\n\n'+d.body;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(
      function(){ toast('Draft copied \u2014 paste it into your mail app'); },
      function(){ selectInModal(); toast('Copy blocked \u2014 the text is selected, press Ctrl+C'); }
    );
    return;
  }
  try{ selectInModal(); document.execCommand('copy'); toast('Draft copied'); }
  catch(e){ toast('Copy failed \u2014 select the text manually'); }
}
function selectInModal(){
  var ta=document.getElementById('mailBody');
  if(!ta)return;
  ta.focus(); ta.setSelectionRange(0,ta.value.length);
}

function ensureMailModal(){
  if(document.getElementById('mailModal'))return;
  var mask=document.createElement('div');
  mask.className='mail-mask'; mask.id='mailMask';
  var box=document.createElement('div');
  box.className='mail-modal'; box.id='mailModal';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-label','Rejection email draft');
  box.innerHTML=
     '<div class="mail-head"><i class="fas fa-envelope-open-text"></i><div><b>Rejection email</b><span id="mailWho"></span></div>'
    +'<button type="button" class="mail-x" data-mail="close" aria-label="Close"><i class="fas fa-xmark"></i></button></div>'
    +'<div class="mail-fields">'
    +'<label>To<input type="text" id="mailTo" readonly/></label>'
    +'<label>Subject<input type="text" id="mailSub" readonly/></label>'
    +'</div>'
    +'<textarea id="mailBody" spellcheck="false"></textarea>'
    +'<div class="mail-foot">'
    +'<button type="button" class="sub-btn ok" data-mail="gmail"><i class="fab fa-google"></i> Open in Gmail</button>'
    +'<button type="button" class="sub-btn ghost" data-mail="app"><i class="fas fa-envelope"></i> Open mail app</button>'
    +'<button type="button" class="sub-btn ghost" data-mail="copy"><i class="fas fa-copy"></i> Copy draft</button>'
    +'<span class="mail-hint">Nothing is sent automatically \u2014 you press Send.</span>'
    +'</div>';
  document.body.appendChild(mask);
  document.body.appendChild(box);
  mask.addEventListener('click',closeMail);
  box.addEventListener('click',function(e){
    var b=e.target.closest('[data-mail]'); if(!b)return;
    e.stopPropagation();
    var k=b.dataset.mail;
    if(!_mail)return;
    if(k==='close'){ closeMail(); return; }
    if(k==='copy'){ copyDraft(_mail.draft); markSent(); return; }
    if(!jumpTo(_mail.draft,k)){ toast('Your browser blocked the jump \u2014 use Copy draft instead'); return; }
    markSent();
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape')closeMail(); });
}
/* The draft window is the whole story: opening it changes nothing. The row only
   flips to rejected once the editor has actually taken the email — Gmail, the
   mail app or a copy they paste themselves. Closing it leaves the request
   pending with the reason still written, so a change of mind costs nothing. */
function markSent(){
  var m=_mail; if(!m||m.sent)return;
  m.sent=true;
  rejectRequestUI(m.idx,m.why);
  closeMail();
}
function showMail(r, why, idx){
  ensureMailModal();
  _mail={ draft:mailDraft(r,why), r:r, why:why, idx:idx, sent:false };
  var d=_mail.draft;
  document.getElementById('mailWho').textContent=r.name+' \u00b7 '+r.id+' \u00b7 still pending until you send this';
  document.getElementById('mailTo').value=d.to;
  document.getElementById('mailSub').value=d.subject;
  document.getElementById('mailBody').value=d.body;
  document.getElementById('mailMask').classList.add('show');
  document.getElementById('mailModal').classList.add('show');
  document.getElementById('mailModal').scrollTop=0;
}
function closeMail(){
  var m=document.getElementById('mailModal'), k=document.getElementById('mailMask');
  if(m)m.classList.remove('show');
  if(k)k.classList.remove('show');
}

/* ── Toast ── */
function toast(m){var t=document.getElementById('toastEl');if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:9000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px)';document.body.appendChild(t);}
t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0';},2500);}

function bindEvents(){
  document.getElementById('tableBody').addEventListener('click',function(e){
    var chip=e.target.closest('[data-reason]');
    if(chip){
      var box=chip.closest('.rej-box').querySelector('.rej-text');
      box.value=REJECT_PRESETS[parseInt(chip.dataset.reason,10)].text;
      box.focus();
      return;
    }
    var btn=e.target.closest('[data-action]');
    if(btn){
      var action=btn.dataset.action, idx=parseInt(btn.dataset.idx,10);
      var r=REQUESTS[idx]; if(!r)return;
      if(action==='approve')approveRequestUI(idx);
      else if(action==='reject-open')openRejectBox(idx);
      else if(action==='reject-cancel'){ rejectOpenId=null; refresh(); }
      else if(action==='reject-email'){
        var why=draftText(r);
        if(!why){ toast('Write the reason first \u2014 the author needs to know what to fix'); return; }
        e.stopPropagation();
        r.rejectDraft=why;
        /* Nothing else happens on this click: no tab, no status change, no
           toast. The draft window is the only thing that appears. */
        showMail(r,why,idx);
        return;
      }
      else if(action==='toggle')toggleRow(idx);
      else if(action==='more')toast('More actions for '+r.name);
      return;
    }
    /* Anything inside the open panel — ID thumbnails, the reason box, text
       selection — belongs to the submission, not to the row toggle. */
    if(e.target.closest('.detail-row'))return;
    var row=e.target.closest('.req-row');
    if(row)toggleRow(parseInt(row.dataset.idx,10));
  });

  /* Keystrokes must not trigger a re-render (it would drop the caret), but the
     draft is kept on the row so a search or tab switch does not eat it. */
  document.getElementById('tableBody').addEventListener('input',function(e){
    if(!e.target.classList.contains('rej-text'))return;
    var row=e.target.closest('.detail-row'), tr=row&&row.previousElementSibling;
    var idx=tr?parseInt(tr.dataset.idx,10):-1;
    if(REQUESTS[idx]) REQUESTS[idx].rejectDraft=e.target.value;
  });

  document.querySelectorAll('.top-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      document.querySelectorAll('.top-tab').forEach(function(t){t.classList.remove('active')});
      tab.classList.add('active');
      currentView=tab.dataset.view;
      openId=null; rejectOpenId=null;
      document.getElementById('tableTitle').textContent=
        currentView==='all'?'All Verification Requests':
        currentView==='pending'?'Pending Review':
        currentView==='approved'?'Approved Authors':'Rejected Requests';
      document.getElementById('tableSearch').value='';
      refresh();
    });
  });

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
  window.refresh = refresh;
  bindEvents();
  var data=await window.AuthorVerificationService.getRequests();
  REQUESTS=hydrate(data);
  var recent=await window.AuthorVerificationService.getRecentReviews();
  RECENT_REVIEWS=recent;
  renderPagination();
  renderRecentReviews();
  refresh();
}
})();
