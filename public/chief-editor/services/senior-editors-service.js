/* senior-editors-service.js — migrated from senior-editors.html inline script (byte-identical logic).
   Backend-ready header: set USE_API=true and implement endpoints under API_BASE to go live; demo paths keep working. */
(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  try{
    const res = await fetch(API_BASE + path, opts);
    if(!res.ok) throw new Error('Backend error: ' + res.status);
    return await res.json();
  }catch(e){ return null; }
}

let _initDone = false;

var ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',accent:'var(--accent)'};
var BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',accent:'rgba(255,0,80,.1)'};
var PAGE=6,ALL=[],filtered=[],curPage=1,authorPool=[],assignments={};
var _gridBound=false;

function loadData(){
  ChiefEditorData.getSeniorEditors().then(function(d){
    ALL=d;return ChiefEditorData.getAuthorPool();
  }).then(function(d){
    authorPool=d;return ChiefEditorData.getAssignments();
  }).then(function(d){
    assignments=d;renderStats();applyFilters();bindToolbar();
  }).catch(function(e){
    console.error(e);
    document.getElementById('edGrid').innerHTML='<div class="empty-msg">Failed to load.</div>';
  });
}

function renderStats(){
  var behind=ALL.filter(function(e){return e.status==='behind'}).length;
  var pending=ALL.filter(function(e){return e.status==='pending'}).length;
  var totalA=ALL.reduce(function(s,e){return s+e.authorsManaged},0);
  var h='';
  h+=statCard(ALL.length,'Senior Editors','fa-people-group','accent');
  h+=statCard(ALL.length-behind-pending,'On Track or Ahead','fa-circle-check','blue');
  h+=statCard(behind,'Behind Quota','fa-triangle-exclamation','red');
  h+=statCard(pending,'Pending Invites','fa-clock','amber');
  document.getElementById('statCards').innerHTML=h;
}
function statCard(n,l,ico,cls){
  return '<div class="stat-card"><div class="stat-ico" style="background:'+BG[cls]+';color:'+ICO[cls]+'"><i class="fas '+ico+'"></i></div><div><div class="stat-num">'+n+'</div><div class="stat-lbl">'+l+'</div></div></div>';
}

function applyFilters(){
  var q=document.getElementById('searchInput').value.trim().toLowerCase();
  var sv=document.getElementById('statusFilter').value;
  var so=document.getElementById('sortSelect').value;
  filtered=ALL.filter(function(e){
    if(q && e.name.toLowerCase().indexOf(q)===-1 && e.email.toLowerCase().indexOf(q)===-1) return false;
    if(sv!=='all' && e.status!==sv) return false;
    return true;
  });
  filtered.sort(function(a,b){
    if(so==='name') return a.name.localeCompare(b.name);
    if(so==='authors-desc') return b.authorsManaged-a.authorsManaged;
    if(so==='quota-asc') return (a.invited/a.target)-(b.invited/b.target);
    if(so==='pay-desc') return parseFloat(b.monthlyPay.replace(/[^0-9.]/g,''))-parseFloat(a.monthlyPay.replace(/[^0-9.]/g,''));
    return 0;
  });
  curPage=1;renderGrid();
}

function renderGrid(){
  document.getElementById('resultCount').textContent=filtered.length;
  var box=document.getElementById('edGrid');
  if(!filtered.length){
    box.innerHTML='<div class="empty-msg"><i class="fas fa-user-slash" style="font-size:20px;margin-bottom:8px;display:block"></i>No senior editors match your filters.</div>';
    document.getElementById('pagination').innerHTML='';return;
  }
  var tp=Math.max(1,Math.ceil(filtered.length/PAGE));
  if(curPage>tp) curPage=tp;
  var start=(curPage-1)*PAGE;
  var items=filtered.slice(start,start+PAGE);
  var html='';
  for(var i=0;i<items.length;i++){
    html+= items[i].status==='pending' ? pendingCard(items[i]) : activeCard(items[i]);
  }
  box.innerHTML=html;
  renderPagination(tp);
  if(!_gridBound){_gridBound=true;bindGridEvents();}
}

function pendingCard(e){
  var h='<div class="ed-card" data-card-id="'+e.id+'"><div class="ed-top">';
  h+='<img class="ed-avatar" src="'+e.avatar+'" alt=""/>';
  h+='<div class="ed-name-wrap"><div class="ed-name">'+e.name+'</div>';
  h+='<div class="ed-email">'+e.email+'</div></div>';
  h+='<div class="ed-top-right"><span class="ed-status pending">Pending</span>';
  h+=dotsMenu(e.id,[
    {act:'resend-invite',icon:'fa-paper-plane',label:'Resend Invite'},
    {act:'copy-link',icon:'fa-link',label:'Copy Invite Link'},
    {act:'cancel-invite',icon:'fa-xmark',label:'Cancel Invite',danger:true}
  ]);
  h+='</div></div>';
  h+='<div class="ed-meta-row">';
  h+=metaItem('Quota Target',e.target+'/mo');
  h+=metaItem('Payment',e.paymentType==='revenue-share'?(e.revenueShare||'—')+' rev-share':e.monthlyPay);
  h+='<div class="ed-meta-item"><span>Type</span><b><span class="pay-badge '+(e.paymentType||'fixed')+'">'+(e.paymentType==='revenue-share'?'Revenue Share':'Fixed Pay')+'</span></b></div>';
  h+=metaItem('Invited',e.invitedAt.split('T')[0]);
  h+='</div>';
  h+='<div class="ed-quota-label"><span>Invite pending — awaiting acceptance</span><span></span></div>';
  h+='<div class="ed-quota-track"><div class="ed-quota-fill" style="width:0%;background:var(--amber)"></div></div>';
  h+='<div class="ed-actions">';
  h+='<button class="mini-btn" data-eaction="resend-invite" data-id="'+e.id+'"><i class="fas fa-paper-plane"></i> Resend</button>';
  h+='<button class="mini-btn ghost" data-eaction="copy-link" data-id="'+e.id+'"><i class="fas fa-link"></i> Copy Link</button>';
  h+='<button class="mini-btn danger" data-eaction="cancel-invite" data-id="'+e.id+'"><i class="fas fa-xmark"></i> Cancel</button>';
  h+='</div></div>';
  return h;
}

function activeCard(e){
  var pct=Math.min(100,Math.round(e.invited/e.target*100));
  var sl=e.status==='behind'?'Behind':e.status==='ahead'?'Ahead':'On track';
  var ac=(assignments[e.id]||[]).length;
  var h='<div class="ed-card" data-card-id="'+e.id+'"><div class="ed-top">';
  h+='<img class="ed-avatar" src="'+e.avatar+'" alt=""/>';
  h+='<div class="ed-name-wrap"><div class="ed-name">'+e.name;
  if(e.openReports>0) h+=' <span class="report-dot" title="'+e.openReports+' open report(s)"></span>';
  h+='</div><div class="ed-email">'+e.email+'</div></div>';
  h+='<div class="ed-top-right"><span class="ed-status '+e.status+'">'+sl+'</span>';
  h+=dotsMenu(e.id,[
    {act:'assign',icon:'fa-user-plus',label:'Assign Authors',badge:ac}
  ]);
  h+='</div></div>';
  h+='<div class="ed-meta-row">';
  h+=metaItem('Authors',e.authorsManaged);
  h+=metaItem('Assigned',ac);
  h+=metaItem('Joined',e.joined);
  h+='<div class="ed-meta-item"><span>Payment</span><b><span class="pay-badge '+(e.paymentType||'fixed')+'">'+(e.paymentType==='revenue-share'?'Revenue Share':'Fixed Pay')+'</span></b></div>';
  h+=metaItem('Pay',e.paymentType==='revenue-share'?(e.revenueShare||'—')+' rev-share':e.monthlyPay);
  h+=metaItem('YTD Paid',e.ytdPaid);
  h+='</div>';
  h+='<div><div class="ed-quota-label"><span>Invite quota \u2014 '+e.invited+'/'+e.target+'</span>';
  h+='<span>Due '+e.deadline+'</span></div>';
  h+='<div class="ed-quota-track"><div class="ed-quota-fill '+e.status+'" style="width:'+pct+'%"></div></div></div>';
  h+='<div class="ed-actions">';
  h+='<button class="mini-btn ghost" data-action="view" data-id="'+e.id+'"><i class="fas fa-eye"></i> View Profile</button>';
  h+='<button class="mini-btn" data-action="message" data-id="'+e.id+'"><i class="fas fa-comment-dots"></i> Message</button>';
  if(e.status==='behind'){
    h+='<button class="mini-btn danger" data-action="quota" data-id="'+e.id+'"><i class="fas fa-triangle-exclamation"></i> Take Action</button>';
  }else{
    h+='<button class="mini-btn" data-action="quota" data-id="'+e.id+'"><i class="fas fa-bullseye"></i> Manage Quota</button>';
  }
  h+='</div></div>';
  return h;
}

function metaItem(label,val){
  return '<div class="ed-meta-item"><span>'+label+'</span><b>'+val+'</b></div>';
}

function dotsMenu(id,items){
  var h='<div class="ed-dots-wrap">';
  h+='<button class="ed-dots-btn" data-eid="'+id+'" title="More actions"><i class="fas fa-ellipsis-vertical"></i></button>';
  h+='<div class="ed-dots-menu" data-menu="'+id+'">';
  for(var i=0;i<items.length;i++){
    var it=items[i];
    var cls=it.danger?' style="color:var(--red)"':'';
    var badge=it.badge?'<span class="ed-dots-badge">'+it.badge+'</span>':'';
    h+='<button class="ed-dots-item" data-eaction="'+it.act+'" data-eid="'+id+'"'+cls+'>';
    h+='<i class="fas '+it.icon+'"></i> '+it.label+badge+'</button>';
  }
  h+='</div></div>';
  return h;
}

function renderPagination(tp){
  var box=document.getElementById('pagination');
  if(tp<=1){
    box.innerHTML='<div class="pg-info">Showing all '+filtered.length+' editor'+(filtered.length===1?'':'s')+'</div>';
    return;
  }
  var start=(curPage-1)*PAGE+1;
  var end=Math.min(filtered.length,curPage*PAGE);
  var pb='';
  for(var p=1;p<=tp;p++){
    pb+='<button class="pg-btn'+(p===curPage?' active':'')+'" data-page="'+p+'">'+p+'</button>';
  }
  box.innerHTML='<div class="pg-info">Showing '+start+'\u2013'+end+' of '+filtered.length+' editors</div>'
    +'<div class="pg-controls">'
    +'<button class="pg-btn" id="pgPrev"'+(curPage===1?' disabled':'')+'><i class="fas fa-chevron-left"></i></button>'
    +pb
    +'<button class="pg-btn" id="pgNext"'+(curPage===tp?' disabled':'')+'><i class="fas fa-chevron-right"></i></button>'
    +'</div>';
  document.getElementById('pgPrev').addEventListener('click',function(){curPage--;renderGrid()});
  document.getElementById('pgNext').addEventListener('click',function(){curPage++;renderGrid()});
  box.querySelectorAll('[data-page]').forEach(function(b){
    b.addEventListener('click',function(){curPage=parseInt(b.dataset.page,10);renderGrid()});
  });
}

function bindToolbar(){
  var sd;
  document.getElementById('searchInput').addEventListener('input',function(){clearTimeout(sd);sd=setTimeout(applyFilters,180)});
  document.getElementById('statusFilter').addEventListener('change',applyFilters);
  document.getElementById('sortSelect').addEventListener('change',applyFilters);
  document.getElementById('inviteBtn').addEventListener('click',function(){openInviteModal();});
}

function bindGridEvents(){
  document.getElementById('edGrid').addEventListener('click',function(ev){
    var btn=ev.target.closest('.ed-dots-btn');
    if(btn){
      ev.stopPropagation();
      var id=btn.dataset.eid;
      document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){if(m.dataset.menu!==id)m.classList.remove('open')});
      var menu=document.querySelector('.ed-dots-menu[data-menu="'+id+'"]');
      if(menu) menu.classList.toggle('open');
      return;
    }
    var action=ev.target.closest('[data-action]');
    if(action){
      var ed=ALL.find(function(x){return x.id===action.dataset.id});
      if(!ed) return;
      if(action.dataset.action==='view') window.location.href='../Pages/profile.html?id='+encodeURIComponent(ed.id);
      else if(action.dataset.action==='message') window.location.href='mailto:'+ed.email;
      else if(action.dataset.action==='quota') openQuotaModal(ed);
      return;
    }
    var eaction=ev.target.closest('[data-eaction]');
    if(eaction){
      var eid=eaction.dataset.eid;
      var ed2=ALL.find(function(x){return x.id===eid});
      document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){m.classList.remove('open')});
      if(!ed2) return;
      var act=eaction.dataset.eaction;
      if(act==='assign'){
        AssignAuthorsSheet.open({editorId:eid,editorName:ed2.name,editorAvatar:ed2.avatar,
          authorPool:authorPool,assignedIds:assignments[eid]||[],
          onSave:function(id,ids){assignments[id]=ids;renderGrid();toast('Authors updated for '+ed2.name)}
        });
      } else if(act==='resend-invite'){
        toast('Invite resent to '+ed2.name,'fa-paper-plane');
      } else if(act==='copy-link'){
        var link=window.location.origin+'/public/senior-editor/accept-invite.html?token='+ed2.inviteToken;
        if(navigator.clipboard){navigator.clipboard.writeText(link);toast('Invite link copied!','fa-link');}
        else{prompt('Copy this invite link:',link);}
      } else if(act==='cancel-invite'){
        ChiefEditorData.cancelInvite(ed2.id).then(function(){
          ALL=ALL.filter(function(x){return x.id!==ed2.id});
          toast('Invite cancelled for '+ed2.name,'fa-xmark');
          renderStats();applyFilters();
        });
      }
      return;
    }
    var card=ev.target.closest('.ed-card[data-card-id]');
    if(card){
      openInviteModal(card.dataset.cardId);
      return;
    }
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest('.ed-dots-wrap')&&!e.target.closest('.modal-overlay'))
      document.querySelectorAll('.ed-dots-menu.open').forEach(function(m){m.classList.remove('open')});
  });
}

function toast(msg,icon){
  var t=document.getElementById('toastHost');
  if(!t){t=document.createElement('div');t.id='toastHost';t.style.cssText='position:fixed;bottom:22px;right:22px;z-index:300;display:flex;flex-direction:column;gap:8px';document.body.appendChild(t);}
  var el=document.createElement('div');
  el.style.cssText='background:#14142b;color:#fff;font-size:12.5px;font-weight:600;padding:12px 16px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.25);display:flex;align-items:center;gap:9px;animation:toastIn .2s ease';
  el.innerHTML='<i class="fas '+(icon||'fa-circle-check')+'" style="color:var(--accent)"></i><span>'+msg+'</span>';
  t.appendChild(el);
  setTimeout(function(){el.style.opacity='0';el.style.transition='.25s';setTimeout(function(){el.remove();},250);},2600);
}

/* Quota Modal */
var quotaEd=null;
function openQuotaModal(ed){
  quotaEd=ed;
  document.getElementById('quotaEditorInfo').innerHTML='<img src="'+ed.avatar+'" alt=""/><div><div class="qei-name">'+ed.name+'</div><div class="qei-email">'+ed.email+'</div></div>';
  document.getElementById('quotaTarget').value=ed.target;
  document.getElementById('quotaInvited').value=ed.invited;
  document.getElementById('quotaRemaining').value=Math.max(0,ed.target-ed.invited);
  document.getElementById('quotaPay').value=ed.monthlyPay;
  document.getElementById('quotaPayType').value=ed.paymentType||'fixed';
  document.getElementById('quotaRevenueShare').value=ed.revenueShare||'';
  document.getElementById('quotaStatus').value=ed.status;
  document.getElementById('quotaNote').value='';
  toggleQuotaPayFields();
  document.getElementById('quotaModal').classList.add('show');
}
function toggleQuotaPayFields(){
  var t=document.getElementById('quotaPayType').value;
  document.getElementById('quotaFixedRow').style.display=t==='fixed'?'':'none';
  document.getElementById('quotaRevenueRow').style.display=t==='revenue-share'?'':'none';
}

/* Invite Modal (new invite + edit existing) */
var editingInviteId=null;
function openInviteModal(editId){
  var ed=editId?ALL.find(function(x){return x.id===editId;}):null;
  editingInviteId=ed?ed.id:null;
  document.getElementById('invName').value=ed?ed.name:'';
  document.getElementById('invEmail').value=ed?ed.email:'';
  document.getElementById('invTarget').value=ed?(ed.target||50):'50';
  var pt=ed?(ed.paymentType||'fixed'):'fixed';
  document.getElementById('invPayType').value=pt;
  document.getElementById('invPay').value=(ed&&pt==='fixed')?(ed.monthlyPay||''):'';
  document.getElementById('invRevenueShare').value=(ed&&pt==='revenue-share')?(ed.revenueShare||''):'';
  document.getElementById('invDeadline').value=ed?(ed.deadline||defaultDeadline()):defaultDeadline();
  document.getElementById('invNote').value='';
  document.getElementById('invNameErr').style.display='none';
  document.getElementById('invEmailErr').style.display='none';
  toggleInvPayFields();
  document.querySelector('#inviteModal .modal-head h3').innerHTML=ed?'<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Senior Editor':'<i class="fas fa-user-plus" style="color:var(--accent)"></i> Invite Senior Editor';
  document.getElementById('inviteSendBtn').innerHTML=ed?'<i class="fas fa-check"></i> Save Changes':'<i class="fas fa-paper-plane"></i> Send Invite';
  document.getElementById('inviteModal').classList.add('show');
}
function defaultDeadline(){
  var now=new Date(),next=new Date(now.getFullYear(),now.getMonth()+1,1);
  return next.toISOString().split('T')[0];
}
function toggleInvPayFields(){
  var t=document.getElementById('invPayType').value;
  document.getElementById('invFixedRow').style.display=t==='fixed'?'':'none';
  document.getElementById('invRevenueRow').style.display=t==='revenue-share'?'':'none';
}

/* ═══ INIT — runs everything the inline script did on load ═══ */
function init(){
  if(_initDone) return;
  _initDone = true;

  ChiefEditorSidebar.attach('#dashRoot',{
    activeItem:'senior-editors',title:'Senior Editors',subtitle:'Manage editors, monitor quotas, and review performance',
    user:{name:'Adaeze Bello',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=9'},notifCount:6,
    searchPlaceholder:'Search anything...'
  });

  document.getElementById('quotaPayType').addEventListener('change',toggleQuotaPayFields);
  document.getElementById('quotaModalClose').addEventListener('click',function(){document.getElementById('quotaModal').classList.remove('show');quotaEd=null});
  document.getElementById('quotaCancelBtn').addEventListener('click',function(){document.getElementById('quotaModal').classList.remove('show');quotaEd=null});
  document.getElementById('quotaModal').addEventListener('click',function(e){if(e.target.id==='quotaModal'){document.getElementById('quotaModal').classList.remove('show');quotaEd=null;}});
  document.getElementById('quotaTarget').addEventListener('input',function(){if(quotaEd){var t=parseInt(this.value)||0;document.getElementById('quotaRemaining').value=Math.max(0,t-quotaEd.invited);}});
  document.getElementById('quotaSaveBtn').addEventListener('click',function(){
    if(!quotaEd) return;
    quotaEd.target=parseInt(document.getElementById('quotaTarget').value)||0;
    quotaEd.status=document.getElementById('quotaStatus').value;
    quotaEd.paymentType=document.getElementById('quotaPayType').value;
    if(quotaEd.paymentType==='fixed'){
      var p=document.getElementById('quotaPay').value.trim();
      if(p) quotaEd.monthlyPay=p;
    } else {
      var rs=document.getElementById('quotaRevenueShare').value.trim();
      if(rs) quotaEd.revenueShare=rs;
      quotaEd.monthlyPay=rs?rs+' share':'—';
    }
    document.getElementById('quotaModal').classList.remove('show');
    toast('Quota updated for '+quotaEd.name,'fa-bullseye');
    quotaEd=null;renderStats();applyFilters();
  });

  document.getElementById('invPayType').addEventListener('change',toggleInvPayFields);
  document.getElementById('inviteModalClose').addEventListener('click',function(){document.getElementById('inviteModal').classList.remove('show')});
  document.getElementById('inviteCancelBtn').addEventListener('click',function(){document.getElementById('inviteModal').classList.remove('show')});
  document.getElementById('inviteModal').addEventListener('click',function(e){if(e.target.id==='inviteModal') document.getElementById('inviteModal').classList.remove('show')});
  document.getElementById('inviteSendBtn').addEventListener('click',function(){
    var name=document.getElementById('invName').value.trim();
    var email=document.getElementById('invEmail').value.trim();
    var target=parseInt(document.getElementById('invTarget').value)||50;
    var pay=document.getElementById('invPay').value.trim()||'$0';
    var deadline=document.getElementById('invDeadline').value;
    var note=document.getElementById('invNote').value.trim();
    var valid=true;
    if(!name){document.getElementById('invNameErr').style.display='block';valid=false;}else{document.getElementById('invNameErr').style.display='none';}
    if(!email||!/[^\s@]+@[^\s@]+\.[^\s@]+/.test(email)){document.getElementById('invEmailErr').style.display='block';valid=false;}else{document.getElementById('invEmailErr').style.display='none';}
    if(!valid) return;
    var pt=document.getElementById('invPayType').value;
    var payVal='$0';
    var revShare='';
    if(pt==='fixed'){
      payVal=document.getElementById('invPay').value.trim()||'$0';
    } else {
      revShare=document.getElementById('invRevenueShare').value.trim()||'';
      payVal=revShare?revShare+' share':'—';
    }
    if(editingInviteId){
      var ex=ALL.find(function(x){return x.id===editingInviteId;});
      if(ex){
        ex.name=name; ex.email=email; ex.target=target;
        ex.paymentType=pt; ex.monthlyPay=payVal; ex.revenueShare=revShare;
        if(deadline) ex.deadline=deadline;
        toast('Senior editor updated','fa-circle-check');
      }
      editingInviteId=null;
      document.getElementById('inviteModal').classList.remove('show');
      renderStats();applyFilters();
      return;
    }
    ChiefEditorData.addPendingEditor({name:name,email:email,target:target,pay:payVal,paymentType:pt,revenueShare:revShare,deadline:deadline,note:note}).then(function(editor){
      ALL.push(editor);
      document.getElementById('inviteModal').classList.remove('show');
      var link=window.location.origin+'/public/senior-editor/accept-invite.html?token='+editor.inviteToken;
      toast('Invite sent to '+name+'!','fa-paper-plane');
      if(navigator.clipboard) navigator.clipboard.writeText(link);
      renderStats();applyFilters();
    });
  });

  loadData();
}

window.SeniorEditorsService = { init: init };
// No onclick= handlers found in markup; preserve former global for compatibility.
try{ window.toast = toast; }catch(e){}

})();
