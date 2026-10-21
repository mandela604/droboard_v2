/* senior-editors-service.js — migrated from senior-editors.html inline script (byte-identical logic).
   Backend-ready header: set USE_API=true and implement endpoints under API_BASE to go live; demo paths keep working. */
(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief';   // backend mounts the chief routers here
async function callBackend(path, opts){
  if(!USE_API) return null;
  try{
    const res = await fetch(API_BASE + path, opts);
    if(!res.ok) throw new Error('Backend error: ' + res.status);
    return await res.json();
  }catch(e){ return null; }
}
// Unlike callBackend, this THROWS on failure — used for writes that must not
// silently appear to succeed.
async function apiFetch(path, opts){
  if(!USE_API) return { demo: true };
  const res = await fetch(API_BASE + path, opts);
  if(!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}
function authHeaders(){
  var t = null;
  try{ t = localStorage.getItem('dro_access_token'); }catch(e){}
  return Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {});
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}

/* EditorAssignment.authorIds is the ownership record on the backend. */
const Crud = {
  listAssignments: function(){ return apiFetch('/assignments'); },
  saveAssignment: function(editorId, authorIds){
    return apiFetch('/senior-editors/' + encodeURIComponent(editorId) + '/assignments', {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify({ authorIds: authorIds }),
    });
  },
  // Option B queue: writers in no assignment.
  listUnassigned: function(waiting){ return apiFetch('/unassigned-authors' + (waiting ? '?waiting=1' : '')); },
  listAuthors: function(){ return apiFetch('/authors?limit=100'); },
  // Invite wizard step 1 — live search of registered accounts.
  searchUsers: function(q){ return apiFetch('/users/search?q=' + encodeURIComponent(q) + '&limit=8'); },
};

let _initDone = false;

var ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',accent:'var(--accent)'};
var BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',accent:'rgba(255,0,80,.1)'};
var PAGE=6,ALL=[],filtered=[],curPage=1,authorPool=[],assignments={};
var _gridBound=false;

// Assign sheet pool: real writers from the backend when live, else the demo pool.
function loadAuthorPool(){
  return Crud.listAuthors().then(function(remote){
    if(remote && remote.items && remote.items.length){
      return remote.items.map(function(u){
        return { id:u.id, handle:u.username || u.name, name:u.fullName || u.name, avatar:u.avatar,
                 genres:u.genres || [], reads:(u.followers || 0) + '', verified:false, books:u.books || 0 };
      });
    }
    return ChiefEditorData.getAuthorPool();
  }).catch(function(){ return ChiefEditorData.getAuthorPool(); });
}

function loadData(){
  ChiefEditorData.getSeniorEditors().then(function(d){
    ALL=d;return loadAuthorPool();
  }).then(function(d){
    authorPool=d;return reloadAssignments();
  }).then(function(){
    renderStats();applyFilters();bindToolbar();renderQueue();
  }).catch(function(e){
    console.error(e);
    document.getElementById('edGrid').innerHTML='<div class="empty-msg">Failed to load.</div>';
  });
}

// Always re-read assignments before opening the sheet / saving — a writer can
// sign up with an editor's invite code while this page sits open, and a stale
// save would silently drop them.
function reloadAssignments(){
  return Crud.listAssignments().then(function(rows){
    if(rows && rows.length !== undefined && !rows.demo){
      assignments = mapAssignments(rows);
      return assignments;
    }
    return ChiefEditorData.getAssignments().then(function(a){ assignments = a; return assignments; });
  }).catch(function(){
    return ChiefEditorData.getAssignments().then(function(a){ assignments = a; return assignments; });
  });
}

function openAssignSheet(editorId, ed){
  reloadAssignments().then(function(){
    AssignAuthorsSheet.open({
      editorId: editorId, editorName: ed.name, editorAvatar: ed.avatar,
      authorPool: authorPool, assignedIds: (assignments[editorId] || []).slice(),
      onSave: function(id, ids){ persistAssignment(id, ids, ed); }
    });
    renderGrid();
  });
}

// Backend rows are {editorId, authorIds} — the demo map is {editorId: [ids]}.
function mapAssignments(rows){
  var m = {};
  rows.forEach(function(r){ m[String(r.editorId)] = (r.authorIds || []).slice(); });
  return m;
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
        openAssignSheet(eid, ed2);
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

/* ═══ Option B — "Needs an editor" queue ═══════════════════════════════════
   Writers holding the writer role who are in NO EditorAssignment. Their first
   submission parks here until the chief picks who takes them. */
var _queueStyleDone = false;
function ensureQueuePanel(){
  if(document.getElementById('unassignedPanel')) return;
  if(!_queueStyleDone){
    _queueStyleDone = true;
    var st = document.createElement('style');
    st.textContent =
      '.un-row{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border,#eceaf5);border-radius:12px;margin-bottom:8px;background:var(--card,#fff);flex-wrap:wrap}' +
      '.un-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0}' +
      '.un-info{flex:1;min-width:140px}' +
      '.un-name{font-size:13px;font-weight:700}' +
      '.un-meta{font-size:10.5px;color:var(--text-faint,#9694ac);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.un-pager{display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 0 2px}' +
      '.un-page-lbl{font-size:11px;font-weight:700;color:var(--text-faint,#9694ac);white-space:nowrap}' +
      '.ep-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;border:1px solid transparent;transition:.15s}' +
      '.ep-row:hover{background:var(--table-head,#f8f9fb);border-color:var(--border,#e2e4e9)}' +
      '.ep-row img{width:36px;height:36px;border-radius:50%;object-fit:cover}' +
      '.ep-name{font-size:13px;font-weight:700}' +
      '.ep-meta{font-size:10.5px;color:var(--text-muted,#6b7280)}' +
      '.ep-count{margin-left:auto;font-size:11px;font-weight:700;color:var(--text-muted,#6b7280);white-space:nowrap}' +
      /* ── Assign wizard (cwiz-* pattern from senior-editor/review-queue.html) ── */
      '.epw-box{max-height:calc(100vh - 48px);display:flex;flex-direction:column;margin:auto}' +
      '.epw-body{flex:1;overflow-y:auto}' +
      '.epw-steps{display:flex;gap:4px;padding:14px 22px 0}' +
      '.epw-step{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 0;border-radius:8px;font-size:11px;font-weight:700;color:var(--text-faint,#9694ac);background:var(--hover,#f6f7fb);transition:.15s;cursor:default}' +
      '.epw-step.on{background:var(--accent);color:#fff}' +
      '.epw-step.done{background:var(--green-bg,#e9f9ef);color:var(--green,#2f9e5f);cursor:pointer}' +
      '.epw-num{width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}' +
      '.epw-step.on .epw-num{background:rgba(255,255,255,.25)}' +
      '.epw-panel{display:none}.epw-panel.on{display:block}' +
      '.epw-search-wrap{display:flex;align-items:center;gap:8px;background:var(--input-bg,#f6f7fb);border:1px solid var(--input-border,#e2e4e9);border-radius:10px;padding:8px 12px;margin-bottom:10px}' +
      '.epw-search-wrap i{color:var(--text-faint,#9694ac);font-size:12px}' +
      '.epw-search-wrap input{flex:1;border:none;background:none;outline:none;font-size:12.5px;font-family:inherit;color:var(--text,#26233a);min-width:0}' +
      '.epw-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;border:1.5px solid transparent;transition:.15s}' +
      '.epw-row:hover{background:var(--table-head,#f8f9fb);border-color:var(--border,#e2e4e9)}' +
      '.epw-row.on{background:rgba(255,0,80,.06);border-color:var(--accent)}' +
      '.epw-row img{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0}' +
      '.epw-row-info{flex:1;min-width:0}' +
      '.epw-check{margin-left:10px;font-size:15px;color:var(--border,#d6d8e0);flex-shrink:0}' +
      '.epw-row.on .epw-check{color:var(--accent)}' +
      '.epw-pair{display:flex;flex-direction:column;gap:6px}' +
      '.epw-card{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border,#eceaf5);border-radius:12px;background:var(--card,#fff)}' +
      '.epw-card img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0}' +
      '.epw-card-name{font-size:13px;font-weight:700}' +
      '.epw-card-meta{font-size:10.5px;color:var(--text-muted,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.epw-tag{margin-left:auto;font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;background:var(--table-head,#faf9ff);color:var(--text-muted,#71708a);white-space:nowrap;flex-shrink:0}' +
      '.epw-tag.writer{background:var(--red-bg,#fff0f0);color:var(--red,#e53e3e)}' +
      '.epw-arrow{display:flex;justify-content:center;color:var(--text-faint,#9694ac);font-size:12px}' +
      '.epw-note{margin-top:12px;font-size:11.5px;color:var(--text-faint,#9694ac);line-height:1.65;text-align:center;padding:0 6px}' +
      /* invite-wizard review summary (same tokens as review-queue cwiz-summary) */
      '.inv-summary{background:var(--hover,#f6f7fb);border:1px solid var(--border,#eceaf5);border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.7}' +
      '.inv-summary .cs-row{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--border,#eceaf5)}' +
      '.inv-summary .cs-row:last-child{border-bottom:none}' +
      '.inv-summary .cs-label{color:var(--text-muted,#6b7280);font-weight:600}' +
      '.inv-summary .cs-val{font-weight:700;color:var(--text,#26233a);text-align:right}';
    document.head.appendChild(st);
  }
  var panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'unassignedPanel';
  panel.innerHTML =
    '<div class="panel-head">' +
      '<h2><i class="fas fa-user-clock" style="color:var(--red)"></i> Needs an editor <span class="count-chip" id="unassignedCount">0</span></h2>' +
      '<button class="mini-btn" id="unassignedRefresh"><i class="fas fa-rotate"></i> Refresh</button>' +
    '</div>' +
    '<div class="panel-sub">Readers who submitted a book — nobody invited them, so no senior editor owns their submission. Assign one to review it; they become writers once that book is approved.</div>' +
    '<div id="unassignedList"></div>';
  var anchor = document.getElementById('statCards');
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  document.getElementById('unassignedRefresh').addEventListener('click', function(){ renderQueue(); toast('Queue refreshed','fa-rotate'); });
  panel.addEventListener('click', function(e){
    var pg = e.target.closest('[data-queue-page]');
    if(pg){
      if(pg.disabled) return;
      _queuePage += pg.getAttribute('data-queue-page') === 'next' ? 1 : -1;
      renderQueue();
      return;
    }
    var btn = e.target.closest('[data-pick-uid]');
    if(!btn) return;
    var row = btn.closest('.un-row');
    var nameEl = row && row.querySelector('.un-name');
    openEditorPicker(btn.getAttribute('data-pick-uid'), nameEl ? nameEl.textContent : '');
  });
}

function getUnassigned(){
  // waiting=1 → only writers with pending submissions. A reader without an
  // editor code never appears here; they only enter this queue once they
  // actually submit a book (editor-code signups are auto-assigned instead).
  return Crud.listUnassigned('1').then(function(remote){
    if(remote && remote.items) return remote;      // live backend shape
    return ChiefEditorData.getUnassignedAuthors({ waiting: '1' }); // demo fallback
  }).catch(function(){ return ChiefEditorData.getUnassignedAuthors({ waiting: '1' }); });
}

var _queueItems = []; // last fetched queue rows — full author objects for the wizard
var _queuePage = 1;
var QUEUE_PER_PAGE = 3;

function renderQueue(){
  ensureQueuePanel();
  var countEl = document.getElementById('unassignedCount');
  var box = document.getElementById('unassignedList');
  box.innerHTML = '<div class="empty-msg" style="text-align:center;padding:18px"><i class="fas fa-spinner fa-spin"></i></div>';
  return getUnassigned().then(function(data){
    var items = (data && data.items) || [];
    _queueItems = items;
    if(countEl) countEl.textContent = items.length;
    if(!items.length){
      box.innerHTML = '<div class="empty-msg" style="text-align:center;padding:24px 10px;color:var(--text-faint,#9694ac);font-size:12.5px">' +
        '<i class="fas fa-circle-check" style="font-size:20px;display:block;margin-bottom:8px;opacity:.4"></i>No books waiting — every submitted book has an editor to review it.</div>';
      return items;
    }
    var pages = Math.max(1, Math.ceil(items.length / QUEUE_PER_PAGE));
    if(_queuePage > pages) _queuePage = pages;
    if(_queuePage < 1) _queuePage = 1;
    var start = (_queuePage - 1) * QUEUE_PER_PAGE;
    var pageItems = items.slice(start, start + QUEUE_PER_PAGE);
    var rowsHtml = pageItems.map(function(a){
      var n = a.pendingSubmissions || 0;
      var badge = n > 0
        ? '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;background:var(--red-bg,#fff0f0);color:var(--red,#e53e3e);white-space:nowrap">' + n + ' submission' + (n===1?'':'s') + ' waiting</span>'
        : '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;background:var(--table-head,#faf9ff);color:var(--text-muted,#71708a);white-space:nowrap">No submissions yet</span>';
      return '<div class="un-row">' +
        '<img class="un-avatar" src="' + esc(a.avatar || '') + '" alt=""/>' +
        '<div class="un-info"><div class="un-name">' + esc(a.name || '') + '</div>' +
        '<div class="un-meta">' + esc(a.email || '') + (a.genres && a.genres.length ? ' · ' + esc(a.genres.slice(0,2).join(', ')) : '') + '</div></div>' +
        badge +
        '<button class="mini-btn primary" data-pick-uid="' + esc(a.id) + '"><i class="fas fa-user-plus"></i> Assign</button>' +
      '</div>';
    }).join('');
    var pager = pages > 1
      ? '<div class="un-pager">' +
          '<button class="mini-btn" data-queue-page="prev"' + (_queuePage <= 1 ? ' disabled' : '') + '><i class="fas fa-arrow-left"></i> Prev</button>' +
          '<span class="un-page-lbl">Page ' + _queuePage + ' of ' + pages + '</span>' +
          '<button class="mini-btn" data-queue-page="next"' + (_queuePage >= pages ? ' disabled' : '') + '>Next <i class="fas fa-arrow-right"></i></button>' +
        '</div>'
      : '';
    box.innerHTML = rowsHtml + pager;
    return items;
  });
}

/* ── Assign wizard — 3 steps: Select editor → Review → Confirm.
   Follows the cwiz-* modal-wizard pattern from senior-editor/review-queue.html.
   The box is a flex column with max-height calc so it always keeps top/bottom
   breathing room (overlay padding 20px + auto margins); only the body scrolls. */
var _pendingAuthor = null;
var _epwSel = null;
var _epwStep = 1;

function epwActiveEditors(){ return ALL.filter(function(e){ return e.status !== 'pending'; }); }

function openEditorPicker(authorId, authorName){
  // Prefer the full queue row (avatar/email/pending count) over just id+name.
  var full = null;
  for(var i=0;i<_queueItems.length;i++){ if(_queueItems[i].id===authorId){ full=_queueItems[i]; break; } }
  _pendingAuthor = full || { id: authorId, name: authorName };
  if(!_pendingAuthor.name) _pendingAuthor.name = authorName || '';
  _epwSel = null;

  var modal = document.getElementById('editorPickerModal');
  if(!modal){ ensurePickerModal(); modal = document.getElementById('editorPickerModal'); }
  document.getElementById('editorPickerTitle').textContent = 'Assign ' + (_pendingAuthor.name || 'writer');

  var list = document.getElementById('epwList');
  var search = document.getElementById('epwSearch');
  if(search) search.value = '';
  var editors = epwActiveEditors();
  if(!editors.length){
    document.getElementById('epwSearchWrap').style.display = 'none';
    list.innerHTML = '<div class="empty-msg" style="text-align:center;padding:26px 12px;color:var(--text-faint,#9694ac);font-size:12.5px">No senior editors yet — invite one first.</div>';
  } else {
    document.getElementById('epwSearchWrap').style.display = '';
    list.innerHTML = editors.map(function(e){
      var n = (assignments[e.id] || []).length;
      return '<div class="epw-row" data-epw-eid="' + esc(e.id) + '">' +
        '<img src="' + esc(e.avatar || '') + '" alt=""/>' +
        '<div class="epw-row-info"><div class="ep-name">' + esc(e.name) + '</div><div class="ep-meta">' + esc(e.email || '') + '</div></div>' +
        '<span class="ep-count">' + n + ' assigned</span>' +
        '<i class="fas fa-circle epw-check"></i></div>';
    }).join('');
  }
  epwGoto(1);
  modal.classList.add('show');
}

function epwGoto(step){
  if(step < 1) step = 1;
  if(step > 3) step = 3;
  _epwStep = step;
  var modal = document.getElementById('editorPickerModal');
  modal.querySelectorAll('.epw-panel').forEach(function(p){ p.classList.remove('on'); });
  var panel = document.getElementById('epwP' + step);
  if(panel) panel.classList.add('on');
  modal.querySelectorAll('.epw-step').forEach(function(s){
    var sn = parseInt(s.getAttribute('data-step'), 10);
    s.classList.toggle('on', sn === step);
    s.classList.toggle('done', sn < step);
  });
  document.getElementById('epwBack').style.display = step > 1 ? '' : 'none';
  document.getElementById('epwNext').style.display = step < 3 ? '' : 'none';
  document.getElementById('epwAssign').style.display = step === 3 ? '' : 'none';
  document.getElementById('epwNext').disabled = !_epwSel;
  if(step === 2 || step === 3) epwRenderReview();
}

function epwRenderReview(){
  var ed = _epwSel ? ALL.find(function(x){ return x.id === _epwSel; }) : null;
  var a = _pendingAuthor || {};
  var cur = ed ? (assignments[ed.id] || []).length : 0;
  var writerHtml =
    '<div class="epw-card">' +
      '<img src="' + esc(a.avatar || '') + '" alt=""/>' +
      '<div style="flex:1;min-width:0"><div class="epw-card-name">' + esc(a.name || 'Writer') + '</div>' +
      '<div class="epw-card-meta">' + esc(a.email || '') + '</div></div>' +
      '<span class="epw-tag writer">' + (a.pendingSubmissions || 0) + ' waiting</span>' +
    '</div>';
  var arrow = '<div class="epw-arrow"><i class="fas fa-arrow-down"></i></div>';
  var editorHtml =
    '<div class="epw-card">' +
      '<img src="' + esc(ed ? ed.avatar : '') + '" alt=""/>' +
      '<div style="flex:1;min-width:0"><div class="epw-card-name">' + esc(ed ? ed.name : '—') + '</div>' +
      '<div class="epw-card-meta">' + esc(ed ? (ed.email || '') : '') + '</div></div>' +
      '<span class="epw-tag">' + cur + ' → ' + (cur + 1) + ' assigned</span>' +
    '</div>';
  var html = writerHtml + arrow + editorHtml;
  document.getElementById('epwPair').innerHTML = html;
  document.getElementById('epwConfirmBox').innerHTML = html +
    '<div class="epw-note">' + esc(a.name || 'This reader') + '&rsquo;s book will move into ' +
    esc(ed ? ed.name : 'this editor') + '&rsquo;s review queue. They become a writer once it is approved.</div>';
}

function ensurePickerModal(){
  var m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'editorPickerModal';
  m.innerHTML =
    '<div class="modal-box epw-box">' +
      '<div class="modal-head">' +
        '<h3><i class="fas fa-user-plus" style="color:var(--accent)"></i> <span id="editorPickerTitle">Assign writer</span></h3>' +
        '<button class="modal-close" id="editorPickerClose"><i class="fas fa-xmark"></i></button>' +
      '</div>' +
      '<div class="epw-steps">' +
        '<div class="epw-step on" data-step="1"><span class="epw-num">1</span> Select editor</div>' +
        '<div class="epw-step" data-step="2"><span class="epw-num">2</span> Review</div>' +
        '<div class="epw-step" data-step="3"><span class="epw-num">3</span> Confirm</div>' +
      '</div>' +
      '<div class="modal-body epw-body">' +
        '<div class="epw-panel on" id="epwP1">' +
          '<div class="epw-search-wrap" id="epwSearchWrap"><i class="fas fa-magnifying-glass"></i><input id="epwSearch" type="text" placeholder="Search editors by name or email…"/></div>' +
          '<div id="epwList"></div>' +
        '</div>' +
        '<div class="epw-panel" id="epwP2"><div class="epw-pair" id="epwPair"></div></div>' +
        '<div class="epw-panel" id="epwP3"><div class="epw-pair" id="epwConfirmBox"></div></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="mini-btn" id="epwBack"><i class="fas fa-arrow-left"></i> Back</button>' +
        '<button class="mini-btn primary" id="epwNext" disabled>Next <i class="fas fa-arrow-right"></i></button>' +
        '<button class="mini-btn primary" id="epwAssign" style="display:none"><i class="fas fa-user-check"></i> Assign now</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(m);
  document.getElementById('editorPickerClose').addEventListener('click', function(){ m.classList.remove('show'); });
  m.addEventListener('click', function(e){ if(e.target === m) m.classList.remove('show'); });

  // Select an editor row (step 1)
  m.addEventListener('click', function(e){
    var row = e.target.closest('[data-epw-eid]');
    if(!row) return;
    _epwSel = row.getAttribute('data-epw-eid');
    m.querySelectorAll('.epw-row').forEach(function(r){ r.classList.toggle('on', r === row); });
    document.getElementById('epwNext').disabled = false;
  });

  // Step-pill click jumps back to a completed step
  m.querySelectorAll('.epw-step').forEach(function(s){
    s.addEventListener('click', function(){
      var sn = parseInt(s.getAttribute('data-step'), 10);
      if(sn < _epwStep) epwGoto(sn);
    });
  });

  // Search filter (step 1)
  document.getElementById('epwSearch').addEventListener('input', function(){
    var q = this.value.toLowerCase();
    m.querySelectorAll('.epw-row').forEach(function(r){
      r.style.display = r.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
    });
  });

  document.getElementById('epwBack').addEventListener('click', function(){ epwGoto(_epwStep - 1); });
  document.getElementById('epwNext').addEventListener('click', function(){ if(_epwSel && _epwStep < 3) epwGoto(_epwStep + 1); });
  document.getElementById('epwAssign').addEventListener('click', function(){
    if(!_epwSel || !_pendingAuthor) return;
    var ed = ALL.find(function(x){ return x.id === _epwSel; });
    if(!ed) return;
    m.classList.remove('show');
    assignToEditor(ed, _pendingAuthor.id);
  });
}

/* Add this writer to the editor's assignment. Backend replaces authorIds, so we
   send the full merged list (never clobber existing authors). */
function assignToEditor(ed, authorId){
  var current = (assignments[ed.id] || []).slice();
  if(current.indexOf(authorId) !== -1){
    toast(ed.name + ' already has this writer','fa-circle-info');
    return;
  }
  persistAssignment(ed.id, current.concat([authorId]), ed);
}

function persistAssignment(editorId, ids, ed){
  assignments[editorId] = ids;
  var label = (ed && ed.name) ? ed.name : 'editor';
  return Crud.saveAssignment(editorId, ids).then(function(res){
    // Demo path: write through to the demo store so the unassigned queue
    // recomputes correctly on the next render (mirrors the backend's
    // EditorAssignment upsert).
    if(res && res.demo && window.ChiefEditorData && ChiefEditorData.saveAssignments){
      var patch = {}; patch[editorId] = ids;
      ChiefEditorData.saveAssignments(patch);
    }
    toast('Authors updated for ' + label);
    renderGrid();
    return renderQueue().then(function(){ return true; });
  }).catch(function(err){
    console.error('assignment save failed', err);
    // roll the optimistic local write back
    delete assignments[editorId];
    toast('Could not reach the server — assignment not saved','fa-triangle-exclamation');
    renderGrid();
    return renderQueue().then(function(){ return false; });
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

/* Quota Modal (3-step wizard: Target → Payment → Review) */
var quotaEd=null;
function openQuotaModal(ed){
  quotaEd=ed;
  document.getElementById('quotaEditorInfo').innerHTML='<img src="'+ed.avatar+'" alt=""/><div><div class="qei-name">'+ed.name+'</div><div class="qei-email">'+ed.email+'</div></div>';
  document.getElementById('quotaTarget').value=ed.target;
  document.getElementById('quotaInvited').value=ed.invited;
  document.getElementById('quotaRemaining').value=Math.max(0,ed.target-ed.invited);
  document.getElementById('quotaDeadline').value=ed.deadline||'';
  document.getElementById('quotaPay').value=ed.monthlyPay;
  document.getElementById('quotaPayType').value=ed.paymentType||'fixed';
  document.getElementById('quotaRevenueShare').value=ed.revenueShare||'';
  document.getElementById('quotaStatus').value=ed.status;
  document.getElementById('quotaNote').value='';
  toggleQuotaPayFields();
  qtGoto(1);
  document.getElementById('quotaModal').classList.add('show');
}
function toggleQuotaPayFields(){
  var t=document.getElementById('quotaPayType').value;
  document.getElementById('quotaFixedRow').style.display=t==='fixed'?'':'none';
  document.getElementById('quotaRevenueRow').style.display=t==='revenue-share'?'':'none';
}

var _qtStep = 1;

function qtGoto(step){
  if(step < 1) step = 1;
  if(step > 3) step = 3;
  _qtStep = step;
  var modal = document.getElementById('quotaModal');
  modal.querySelectorAll('.epw-panel').forEach(function(p){ p.classList.remove('on'); });
  var panel = document.getElementById('quotaP' + step);
  if(panel) panel.classList.add('on');
  modal.querySelectorAll('#quotaSteps .epw-step').forEach(function(s){
    var sn = parseInt(s.getAttribute('data-step'), 10);
    s.classList.toggle('on', sn === step);
    s.classList.toggle('done', sn < step);
  });
  document.getElementById('qtBack').style.display = step > 1 ? '' : 'none';
  document.getElementById('qtNext').style.display = step < 3 ? '' : 'none';
  document.getElementById('quotaSaveBtn').style.display = step === 3 ? '' : 'none';
  if(step === 3) qtRenderSummary();
}

function qtRenderSummary(){
  var statusLbl = { 'on-track': 'On Track', 'behind': 'Behind', 'ahead': 'Ahead' };
  var target = document.getElementById('quotaTarget').value || '0';
  var invited = document.getElementById('quotaInvited').value || '0';
  var remaining = document.getElementById('quotaRemaining').value || '0';
  var pt = document.getElementById('quotaPayType').value;
  var pay;
  if(pt === 'fixed'){
    pay = document.getElementById('quotaPay').value.trim() || '—';
  } else {
    var rs = document.getElementById('quotaRevenueShare').value.trim();
    pay = rs ? rs + ' revenue share' : '—';
  }
  var deadline = document.getElementById('quotaDeadline').value;
  if(deadline){
    var dd = new Date(deadline + 'T00:00:00');
    deadline = isNaN(dd) ? deadline : dd.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  }
  var status = document.getElementById('quotaStatus').value;
  document.getElementById('quotaSummary').innerHTML =
    '<div class="cs-row"><span class="cs-label">Editor</span><span class="cs-val">' + esc(quotaEd ? quotaEd.name : '—') + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Monthly target</span><span class="cs-val">' + esc(target) + ' invites</span></div>' +
    '<div class="cs-row"><span class="cs-label">Invited so far</span><span class="cs-val">' + esc(invited) + ' of ' + esc(target) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Remaining</span><span class="cs-val">' + esc(remaining) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Deadline</span><span class="cs-val">' + esc(deadline || '—') + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Payment</span><span class="cs-val">' + (pt === 'fixed' ? 'Fixed monthly' : 'Revenue share') + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Pay</span><span class="cs-val">' + esc(pay) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Status</span><span class="cs-val">' + (statusLbl[status] || status) + '</span></div>';
}

/* Invite Modal (3-step wizard: Find account → Terms → Review).
   Step 1 live-searches REGISTERED platform accounts — you can only grant a
   role to someone who already has a Droboard account. Selecting a result
   locks name+email from that account (hidden inputs feed the send handler).
   Edit mode: search disabled, the invitee is shown as a locked card. */
var editingInviteId = null;
var _invUser = null;
var _invStep = 1;
var _invSearchTimer = null;

function openInviteModal(editId){
  var ed = editId ? ALL.find(function(x){ return x.id === editId; }) : null;
  editingInviteId = ed ? ed.id : null;
  _invUser = ed ? { id: ed.id, name: ed.name, email: ed.email, avatar: ed.avatar || '', username: '', role: 'reader', locked: true } : null;
  document.getElementById('invName').value = ed ? ed.name : '';
  document.getElementById('invEmail').value = ed ? ed.email : '';
  document.getElementById('invTarget').value = ed ? (ed.target || 50) : '50';
  var pt = ed ? (ed.paymentType || 'fixed') : 'fixed';
  document.getElementById('invPayType').value = pt;
  document.getElementById('invPay').value = (ed && pt === 'fixed') ? (ed.monthlyPay || '') : '';
  document.getElementById('invRevenueShare').value = (ed && pt === 'revenue-share') ? (ed.revenueShare || '') : '';
  document.getElementById('invDeadline').value = ed ? (ed.deadline || defaultDeadline()) : defaultDeadline();
  document.getElementById('invNote').value = '';
  toggleInvPayFields();

  var search = document.getElementById('invUserSearch');
  search.value = '';
  search.disabled = !!ed;
  search.placeholder = ed ? 'Invitee locked — editing existing invite' : 'Search by name, email or username... (min 2 chars)';
  document.getElementById('invUserResults').innerHTML = '';
  invRenderPicked();
  document.querySelector('#inviteModal .modal-head h3').innerHTML = ed
    ? '<i class="fas fa-pen" style="color:var(--accent)"></i> Edit Senior Editor'
    : '<i class="fas fa-user-plus" style="color:var(--accent)"></i> Invite Senior Editor';
  document.getElementById('inviteSendBtn').innerHTML = ed
    ? '<i class="fas fa-check"></i> Save Changes'
    : '<i class="fas fa-paper-plane"></i> Send Invite';
  invGoto(1);
  document.getElementById('inviteModal').classList.add('show');
}

function defaultDeadline(){
  var now = new Date(), next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().split('T')[0];
}

function toggleInvPayFields(){
  var t = document.getElementById('invPayType').value;
  document.getElementById('invFixedRow').style.display = t === 'fixed' ? '' : 'none';
  document.getElementById('invRevenueRow').style.display = t === 'revenue-share' ? '' : 'none';
}

/* ── Step 1: live user search ── */

function invSearchUsers(q){
  if(!q || q.length < 2){
    document.getElementById('invUserResults').innerHTML = '';
    return;
  }
  Crud.searchUsers(q).then(function(remote){
    // Live backend shape: { items:[...] }. Demo mode: apiFetch resolves
    // { demo:true } with no items — fall through to the demo store.
    if(remote && remote.items) { invRenderResults(remote.items, q); return; }
    if(window.ChiefEditorData && ChiefEditorData.searchPlatformUsers){
      return ChiefEditorData.searchPlatformUsers(q).then(function(demo){
        invRenderResults((demo && demo.items) || [], q);
      });
    }
    invRenderResults([], q);
  }).catch(function(){
    if(!window.ChiefEditorData || !ChiefEditorData.searchPlatformUsers){ invRenderResults([], q); return; }
    ChiefEditorData.searchPlatformUsers(q).then(function(demo){
      invRenderResults((demo && demo.items) || [], q);
    });
  });
}

function invRenderResults(items, q){
  var box = document.getElementById('invUserResults');
  if(!items.length){
    box.innerHTML = '<div class="empty-msg" style="text-align:center;padding:20px 10px;color:var(--text-faint,#9694ac);font-size:12px">' +
      'No registered account matches “' + esc(q) + '”. They need to create a Droboard account before they can be invited.</div>';
    return;
  }
  box.innerHTML = items.map(function(u){
    return '<div class="epw-row inv-user-row" data-inv-uid="' + esc(u.id) + '">' +
      '<img src="' + esc(u.avatar || '') + '" alt=""/>' +
      '<div class="epw-row-info"><div class="ep-name">' + esc(u.name || '') + '</div>' +
      '<div class="ep-meta">' + esc(u.email || '') + (u.username ? ' · @' + esc(u.username) : '') + '</div></div>' +
      '<span class="epw-tag ' + (u.role === 'writer' ? 'writer' : '') + '">' + (u.role === 'writer' ? 'Writer' : 'Reader') + '</span>' +
      '<i class="fas fa-circle epw-check"></i></div>';
  }).join('');
}

function invSelectUser(uid, rowEl){
  // Pull from the last result set rendered (keeps name/email/avatar exact).
  var picked = null;
  var rows = document.querySelectorAll('#invUserResults .inv-user-row');
  for(var i = 0; i < rows.length; i++){
    if(rows[i].getAttribute('data-inv-uid') === uid){
      rows[i].classList.add('on');
      var nameEl = rows[i].querySelector('.ep-name');
      var metaEl = rows[i].querySelector('.ep-meta');
      var imgEl = rows[i].querySelector('img');
      var tagEl = rows[i].querySelector('.epw-tag');
      picked = {
        id: uid,
        name: nameEl ? nameEl.textContent : '',
        email: metaEl ? (metaEl.textContent.split(' · ')[0]) : '',
        avatar: imgEl ? imgEl.getAttribute('src') : '',
        role: tagEl && tagEl.classList.contains('writer') ? 'writer' : 'reader',
      };
      break;
    }
  }
  if(!picked) return;
  _invUser = picked;
  document.getElementById('invName').value = picked.name;
  document.getElementById('invEmail').value = picked.email;
  invRenderPicked();
  document.getElementById('invUserResults').innerHTML = '';
  document.getElementById('invUserSearch').value = '';
}

function invRenderPicked(){
  var box = document.getElementById('invUserPicked');
  if(!_invUser){
    box.innerHTML = '';
    if(document.getElementById('invNext')) document.getElementById('invNext').disabled = true;
    return;
  }
  box.innerHTML = '<div class="epw-card" style="margin-top:4px">' +
    '<img src="' + esc(_invUser.avatar || '') + '" alt=""/>' +
    '<div style="min-width:0">' +
      '<div class="epw-card-name">' + esc(_invUser.name) + (_invUser.locked ? '' : '') + '</div>' +
      '<div class="epw-card-meta">' + esc(_invUser.email) + '</div>' +
    '</div>' +
    '<span class="epw-tag ' + (_invUser.role === 'writer' ? 'writer' : '') + '">' +
      (_invUser.locked ? 'Invited' : (_invUser.role === 'writer' ? 'Writer' : 'Reader')) + '</span>' +
    (_invUser.locked ? '' : '<i class="fas fa-circle-check" style="color:var(--accent);margin-left:10px;font-size:15px;flex-shrink:0"></i>') +
  '</div>';
  document.getElementById('invNext').disabled = false;
}

/* ── Wizard navigation + review ── */

function invGoto(step){
  if(step < 1) step = 1;
  if(step > 3) step = 3;
  _invStep = step;
  var modal = document.getElementById('inviteModal');
  modal.querySelectorAll('.epw-panel').forEach(function(p){ p.classList.remove('on'); });
  var panel = document.getElementById('invP' + step);
  if(panel) panel.classList.add('on');
  modal.querySelectorAll('#invSteps .epw-step').forEach(function(s){
    var sn = parseInt(s.getAttribute('data-step'), 10);
    s.classList.toggle('on', sn === step);
    s.classList.toggle('done', sn < step);
  });
  document.getElementById('invBack').style.display = step > 1 ? '' : 'none';
  document.getElementById('invNext').style.display = step < 3 ? '' : 'none';
  document.getElementById('inviteSendBtn').style.display = step === 3 ? '' : 'none';
  document.getElementById('invNext').disabled = !_invUser;
  if(step === 3) invRenderSummary();
  if(step === 1 && !_invUser) document.getElementById('invUserSearch').focus();
}

function invRenderSummary(){
  var target = document.getElementById('invTarget').value || '50';
  var pt = document.getElementById('invPayType').value;
  var pay;
  if(pt === 'fixed'){
    pay = document.getElementById('invPay').value.trim() || '—';
  } else {
    var rs = document.getElementById('invRevenueShare').value.trim();
    pay = rs ? rs + ' revenue share' : '—';
  }
  var deadline = document.getElementById('invDeadline').value;
  if(deadline){
    var dd = new Date(deadline + 'T00:00:00');
    deadline = isNaN(dd) ? deadline : dd.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  var u = _invUser || { name: '—', email: '—' };
  document.getElementById('invSummary').innerHTML =
    '<div class="cs-row"><span class="cs-label">Account</span><span class="cs-val">' + esc(u.name) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Email</span><span class="cs-val">' + esc(u.email) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Quota target</span><span class="cs-val">' + esc(target) + ' invites/mo</span></div>' +
    '<div class="cs-row"><span class="cs-label">Payment</span><span class="cs-val">' + (pt === 'fixed' ? 'Fixed monthly' : 'Revenue share') + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Pay</span><span class="cs-val">' + esc(pay) + '</span></div>' +
    '<div class="cs-row"><span class="cs-label">Deadline</span><span class="cs-val">' + esc(deadline || '—') + '</span></div>';
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
  // Quota wizard nav: Next from Target requires a valid target; pills jump back.
  document.getElementById('qtNext').addEventListener('click',function(){
    if(_qtStep === 1){
      var t = parseInt(document.getElementById('quotaTarget').value) || 0;
      if(t < 1){ toast('Monthly invite target must be at least 1','fa-triangle-exclamation'); return; }
    }
    qtGoto(_qtStep + 1);
  });
  document.getElementById('qtBack').addEventListener('click',function(){ qtGoto(_qtStep - 1); });
  document.getElementById('quotaSteps').addEventListener('click',function(e){
    var s = e.target.closest('.epw-step');
    if(!s) return;
    var sn = parseInt(s.getAttribute('data-step'), 10);
    if(sn < _qtStep) qtGoto(sn);
  });
  document.getElementById('quotaSaveBtn').addEventListener('click',function(){
    if(!quotaEd) return;
    var t = parseInt(document.getElementById('quotaTarget').value) || 0;
    if(t < 1){ qtGoto(1); toast('Monthly invite target must be at least 1','fa-triangle-exclamation'); return; }
    quotaEd.target=t;
    quotaEd.status=document.getElementById('quotaStatus').value;
    quotaEd.paymentType=document.getElementById('quotaPayType').value;
    var deadline=document.getElementById('quotaDeadline').value;
    if(deadline) quotaEd.deadline=deadline;
    var note=document.getElementById('quotaNote').value.trim();
    if(note) quotaEd.quotaNote=note;
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

  // ── Invite wizard: live user search (debounced) + step nav ──
  document.getElementById('invUserSearch').addEventListener('input',function(){
    var q=this.value.trim();
    if(_invSearchTimer) clearTimeout(_invSearchTimer);
    _invSearchTimer=setTimeout(function(){ invSearchUsers(q); },250);
  });
  document.getElementById('invUserResults').addEventListener('click',function(e){
    var row=e.target.closest('.inv-user-row');
    if(!row) return;
    invSelectUser(row.getAttribute('data-inv-uid'),row);
  });
  document.getElementById('invBack').addEventListener('click',function(){ if(_invStep>1) invGoto(_invStep-1); });
  document.getElementById('invNext').addEventListener('click',function(){
    if(_invStep===1&&!_invUser){ toast('Search and select a registered account first','fa-circle-info'); return; }
    if(_invStep===2){
      var t=parseInt(document.getElementById('invTarget').value)||0;
      if(t<1){ toast('Monthly invite target must be at least 1','fa-triangle-exclamation'); return; }
    }
    invGoto(_invStep+1);
  });

  document.getElementById('inviteSendBtn').addEventListener('click',function(){
    var name=document.getElementById('invName').value.trim();
    var email=document.getElementById('invEmail').value.trim();
    if(!name||!email){ toast('Pick a registered account first','fa-circle-info'); invGoto(1); return; }
    var target=parseInt(document.getElementById('invTarget').value)||50;
    var deadline=document.getElementById('invDeadline').value;
    var note=document.getElementById('invNote').value.trim();
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
