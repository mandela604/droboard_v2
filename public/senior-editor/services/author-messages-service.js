/**
 * author-messages-service.js — Author Messages page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[AuthorMessagesService] backend unavailable, using demo data', e);
    return null;
  }
}

/* Live inbox replaces the demo list once the request succeeds. Threads are
   fetched lazily per conversation and cached on the row. */
var LIVE = false;

async function uploadImage(file) {
  try {
    var fd = new FormData();
    fd.append('file', file);
    var res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) return '';
    var j = await res.json();
    return j.url || '';
  } catch (e) { return ''; }
}

function mapConversation(c) {
  return {
    id: String(c.id),
    name: c.name || 'Unknown',
    avatar: c.avatar || '../assets/droboard-icon.png',
    role: c.role || 'Author',
    unread: Number(c.unread) || 0,
    flagged: !!c.flagged,
    status: c.status || 'open',
    time: c.time || '',
    preview: c.preview || '',
    messages: [],
    loaded: false,
  };
}
function mapMessage(m) {
  return {
    mid: String(m.mid),
    from: m.from === 'admin' ? 'admin' : 'author',
    text: m.text || '',
    file: m.file || null,
    time: m.time || '',
  };
}

async function loadConversations() {
  var d = await callBackend('/author-messages?limit=50');
  if (d && Array.isArray(d.items)) {
    LIVE = true;
    CONVERSATIONS = d.items.map(mapConversation);
  }
}

async function loadThread(conv) {
  if (!LIVE || !conv || conv.loaded) return;
  var d = await callBackend('/author-messages/' + encodeURIComponent(conv.id) + '/messages');
  if (d && Array.isArray(d.items)) {
    conv.messages = d.items.map(mapMessage);
    conv.loaded = true;
    conv.unread = 0;
  }
}

/* All CRUD writes go through these helpers: try the API first, fall back to
   the in-memory demo list when USE_API=false or the endpoint is down. */
async function writeConv(id, patch, demoFn) {
  if (LIVE) {
    try {
      return await callBackend('/author-messages/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    } catch (e) {
      toast('Could not save — try again');
      return { ok: false };
    }
  }
  var conv = convById(id);
  if (conv && demoFn) demoFn(conv);
  return { ok: true, demo: true };
}
async function persistMessage(conv, msg) {
  var r = null;
  if (LIVE) {
    var payload = { text: msg.text || '' };
    if (msg.file && msg.file.url) payload.image = msg.file.url;
    try {
      r = await callBackend('/author-messages/' + encodeURIComponent(conv.id) + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      toast('Could not send — try again');
      return { ok: false };
    }
  }
  if (r && r.id) msg.mid = String(r.id);
  conv.messages.push(msg);
  conv.time = 'Just now';
  conv.preview = (msg.text || (msg.file ? 'Image' : '')).slice(0, 140);
  return r || { ok: true, demo: true };
}

var PERSPECTIVE='admin';
var AVATAR_ME='https://i.pravatar.cc/100?img=5';

var CONVERSATIONS=[
  {id:1,name:'Sofia Lindqvist',avatar:'https://i.pravatar.cc/100?img=32',role:'Verified Author',unread:2,flagged:false,time:'10m ago',messages:[
    {mid:1,from:'author',text:"Hi, I wanted to check in about my contract — it's set to expire next month.",time:'2 days ago'},
    {mid:2,from:'admin',text:'Hi Sofia! Thanks for reaching out. Let me check with the contracts team and get back to you.',time:'2 days ago'},
    {mid:3,from:'author',text:'Great, thank you! Also wondering if there\u2019s flexibility on the royalty percentage for the renewal.',time:'1 day ago',replyTo:2},
    {mid:4,from:'author',text:'Can we discuss extending my contract renewal deadline?',time:'10m ago'}
  ]},
  {id:2,name:'Marcus Chen',avatar:'https://i.pravatar.cc/100?img=12',role:'Verified Author',unread:0,flagged:false,time:'1h ago',messages:[
    {mid:5,from:'author',text:'Just submitted the revised chapter 12 — fixed the pacing issue you flagged.',time:'3h ago'},
    {mid:6,from:'admin',text:'Reviewed it, looks great. Approved and scheduled for publishing.',time:'2h ago',file:{name:'chapter-12-revised.pdf',size:'2.4 MB'}},
    {mid:7,from:'author',text:'Thanks for approving my chapter revision!',time:'1h ago',replyTo:6}
  ]},
  {id:3,name:'Amara Okafor',avatar:'https://i.pravatar.cc/100?img=45',role:'Verified Author',unread:1,flagged:true,time:'3h ago',messages:[
    {mid:8,from:'author',text:'My earnings dashboard is showing the wrong total again.',time:'1 day ago'},
    {mid:9,from:'admin',text:'Sorry about that, Amara. Escalating to the finance team right now.',time:'22h ago'},
    {mid:10,from:'author',text:'This is the third time. I need this resolved this week.',time:'3h ago',replyTo:9}
  ]},
  {id:4,name:'Daniel Reyes',avatar:'https://i.pravatar.cc/100?img=15',role:'Active Author',unread:0,flagged:false,time:'5h ago',messages:[
    {mid:11,from:'admin',text:'Your latest chapter "The Fall" has been approved. Congrats!',time:'1d ago'},
    {mid:12,from:'author',text:'Thank you! When will the next payout cycle be?',time:'5h ago',replyTo:11}
  ]},
  {id:5,name:'Luna Skye',avatar:'https://i.pravatar.cc/100?img=44',role:'Verified Author',unread:3,flagged:false,time:'20m ago',messages:[
    {mid:13,from:'author',text:'Hi, I need help with my book cover — can we discuss a redesign?',time:'1d ago'},
    {mid:14,from:'admin',text:'Sure! I can connect you with our design team. What style are you thinking?',time:'20h ago'},
    {mid:15,from:'author',text:'Something dark and moody, maybe a silhouette against a city skyline.',time:'6h ago',replyTo:14},
    {mid:16,from:'author',text:'Also, can we talk about the marketing plan for the new release?',time:'20m ago',file:{name:'cover-concept.png',size:'1.8 MB'}}
  ]},
  {id:6,name:'Elena Vasquez',avatar:'https://i.pravatar.cc/100?img=47',role:'Verified Author',unread:0,flagged:false,time:'2h ago',messages:[
    {mid:17,from:'author',text:'My book "Wolf King\'s Vow" just hit 10,000 reads!',time:'3d ago'},
    {mid:18,from:'admin',text:'Congratulations! You\u2019ve earned a $200 milestone bonus.',time:'2d ago',file:{name:'milestone-certificate.pdf',size:'340 KB'}},
    {mid:19,from:'author',text:'That\u2019s amazing, thank you so much!',time:'2h ago',replyTo:18}
  ]},
  {id:7,name:'Ada_Writes',avatar:'https://i.pravatar.cc/100?img=28',role:'Active Author',unread:0,flagged:false,time:'1d ago',messages:[
    {mid:20,from:'admin',text:'Your completion application was rejected. Needs 2-3 more chapters.',time:'5d ago'},
    {mid:21,from:'author',text:'Got it, I\u2019ll add more chapters and resubmit.',time:'1d ago',replyTo:20}
  ]},
  {id:8,name:'Dami_Cole',avatar:'https://i.pravatar.cc/100?img=51',role:'Verified Author',unread:2,flagged:false,time:'45m ago',messages:[
    {mid:22,from:'author',text:'Hey, I just saw my earnings dropped significantly this month.',time:'2d ago'},
    {mid:23,from:'admin',text:'Let me check the analytics. I\u2019ll get back to you within 24 hours.',time:'2d ago'},
    {mid:24,from:'author',text:'It\u2019s been 2 days now. Can you please update me?',time:'45m ago',replyTo:23}
  ]}
];

var currentView='all',activeConvId=CONVERSATIONS[0].id;
var replyTarget=null,pendingFile=null;

function filteredConversations(){
  var q=(document.getElementById('convSearch').value||'').trim().toLowerCase();
  var list=CONVERSATIONS;
  if(currentView==='unread')list=list.filter(function(c){return c.unread>0});
  else if(currentView==='flagged')list=list.filter(function(c){return c.flagged});
  if(q)list=list.filter(function(c){return c.name.toLowerCase().indexOf(q)!==-1});
  return list;
}

function convById(id) {
  var key = String(id);
  return CONVERSATIONS.find(function (c) { return String(c.id) === key; });
}
function isActive(c) { return String(c.id) === String(activeConvId); }

function renderStats(){
  var total=CONVERSATIONS.length,unread=0,flagged=0;
  CONVERSATIONS.forEach(function(c){unread+=c.unread;if(c.flagged)flagged++});
  document.getElementById('countAll').textContent=total;
  document.getElementById('countUnread').textContent=unread;
  document.getElementById('countFlagged').textContent=flagged;
  document.getElementById('statTotal').textContent=total;
  document.getElementById('statUnread').textContent=unread;
  document.getElementById('statFlagged').textContent=flagged;
}

function renderConvList(){
  var list=filteredConversations();
  var wrap=document.getElementById('convList');
  if(!wrap)return;
  if(!list.length){wrap.innerHTML='<div style="padding:40px 16px;text-align:center;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:24px;color:var(--text-faint);display:block;margin-bottom:8px"></i>No conversations here.</div>';return;}
  wrap.innerHTML=list.map(function(c){
    var lastMsg=c.messages[c.messages.length-1];
    var preview=lastMsg
      ? ((lastMsg.from===PERSPECTIVE?'You: ':(lastMsg.file?'📎 File: '+lastMsg.file.name:''))+((lastMsg.text||'').substring(0,60)))
      : (c.preview||'');
    return '<div class="conv-item'+(c.unread>0?' unread':'')+(isActive(c)?' active':'')+(c.status==='closed'?' is-closed':'')+'" data-id="'+c.id+'"><img class="conv-avatar" src="'+c.avatar+'" alt=""/><div class="conv-body"><div class="conv-top-row"><div class="conv-name">'+c.name+(c.flagged?'<i class="fas fa-flag"></i>':'')+(c.status==='closed'?'<span class="closed-chip">Closed</span>':'')+'</div><div class="conv-time">'+c.time+'</div></div><div class="conv-preview">'+preview+'</div></div>'+(c.unread>0?'<span class="unread-badge">'+c.unread+'</span>':'')+'</div>';
  }).join('');
  wrap.querySelectorAll('.conv-item').forEach(function(el){
    el.addEventListener('click',function(){
      activeConvId=el.dataset.id;
      var conv=convById(activeConvId);
      if(conv)conv.unread=0;
      replyTarget=null;pendingFile=null;
      renderConvList();renderThread();bindLongPress();
      document.getElementById('inboxCard').classList.add('thread-open');
      loadThread(conv).then(function(){ renderConvList();renderThread();bindLongPress();renderStats(); });
    });
  });
}

function renderThread(){
  var pane=document.getElementById('threadPane');
  if(!pane)return;
  var conv=convById(activeConvId);
  if(!conv){pane.innerHTML='<div class="inbox-empty"><i class="fas fa-comments"></i>Select a conversation</div>';return;}

  var messagesHtml=conv.messages.map(function(m){
    var isOut=m.from===PERSPECTIVE;
    var bodyHtml='';
    if(m.replyTo){
      var ref=conv.messages.find(function(r){return String(r.mid)===String(m.replyTo)});
      if(ref){
        var rName=ref.from===PERSPECTIVE?'You':conv.name;
        var rText=(ref.text||'').substring(0,80)+((ref.text||'').length>80?'…':'');
        bodyHtml+='<div class="reply-ref"><span class="rr-name">'+rName+'</span><span class="rr-text">'+rText+'</span></div>';
      }
    }
    var isImg = m.file && m.file.isImage && m.file.url;
    if(isImg)bodyHtml+='<div class="msg-bubble"><img class="msg-img" src="'+m.file.url+'" alt=""/>'+(m.text?m.text:'')+'</div>';
    else{
      if(m.text)bodyHtml+='<div class="msg-bubble">'+m.text+'</div>';
      if(m.file){
        var icon=m.file.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)?'fa-file-image':m.file.name.match(/\.pdf$/i)?'fa-file-pdf':m.file.name.match(/\.(doc|docx)$/i)?'fa-file-word':'fa-file';
        bodyHtml+='<div class="msg-file"><i class="fas '+icon+'"></i> '+m.file.name+' <span style="opacity:.6;font-weight:400">('+m.file.size+')</span></div>';
      }
    }
    bodyHtml+='<span class="msg-time">'+m.time+'</span>'+(m.edited?'<span class="msg-edited">edited</span>':'');
    return '<div class="msg-row '+(isOut?'out':'in')+'" data-mid="'+m.mid+'"><img src="'+(isOut?AVATAR_ME:conv.avatar)+'" alt=""/><div>'+bodyHtml+'</div></div>';
  }).join('');

  var isClosed=conv.status==='closed';
  pane.innerHTML='<div class="thread-head"><button class="thread-back" id="threadBackBtn"><i class="fas fa-arrow-left"></i></button><img src="'+conv.avatar+'" alt=""/><div><div class="thread-head-name">'+conv.name+(conv.flagged?'<i class="fas fa-flag" style="color:var(--red);font-size:10px"></i>':'')+(isClosed?'<span class="closed-chip">Closed</span>':'')+'</div><div class="thread-head-sub">'+conv.role+'</div></div><div class="thread-head-right"><div class="thread-menu-wrap"><button class="th-act-btn" id="threadMenuBtn" title="More options"><i class="fas fa-ellipsis-v"></i></button><div class="thread-menu" id="threadMenu"><button class="thread-menu-item" id="tmFlag"><i class="fas fa-flag"></i> <span>'+(conv.flagged?'Remove flag':'Flag conversation')+'</span></button><button class="thread-menu-item'+(isClosed?'':' is-close')+'" id="tmClose"><i class="fas fa-'+(isClosed?'rotate-right':'lock')+'"></i> <span>'+(isClosed?'Restart conversation':'Close conversation')+'</span></button></div></div></div></div>'+(isClosed?'<div class="closed-banner"><span><i class="fas fa-lock" style="margin-right:6px"></i>This conversation is closed.</span><button id="tmRestartBanner">Restart conversation</button></div>':'')+'<div class="thread-body" id="threadBody">'+messagesHtml+'</div><div class="compose-row"><div class="compose-inputs"><div class="reply-preview" id="replyPreview"><button class="rp-close" id="replyClose"><i class="fas fa-times"></i></button><div class="rp-name" id="rpName"></div><div class="rp-text" id="rpText"></div></div><div class="compose-bar"><input id="composeInput" placeholder="'+(isClosed?'Conversation closed \u2014 restart to reply':'Type a reply to '+conv.name+'...')+'"'+(isClosed?' disabled':'')+'/><button class="compose-icon-btn" id="attachBtn" title="Attach file"'+(isClosed?' disabled':'')+'><i class="fas fa-paperclip"></i></button><input type="file" id="fileInput" style="display:none" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.txt,.csv,.xlsx"/></div><div id="fileBadge"></div></div><button class="send-btn" id="sendBtn"'+(isClosed?' disabled':'')+'><i class="fas fa-paper-plane"></i></button></div>';

  var body=document.getElementById('threadBody');
  body.scrollTop=body.scrollHeight;

  document.getElementById('threadBackBtn').addEventListener('click',function(){
    document.getElementById('inboxCard').classList.remove('thread-open');
  });

  var input=document.getElementById('composeInput');
  var send=async function(){
    var text=input.value.trim();
    if(!text&&!pendingFile)return;
    var msg={mid:String(Date.now()),from:PERSPECTIVE,time:'Just now'};
    if(text)msg.text=text;
    if(pendingFile){
      if(LIVE){
        if(!pendingFile.isImage){ toast('Only image attachments can be sent right now'); return; }
        var btn=document.getElementById('sendBtn');
        btn.disabled=true;
        var url=await uploadImage(pendingFile.raw||pendingFile);
        btn.disabled=false;
        if(!url){ toast('Image upload failed — try again'); return; }
        msg.image=url;
        msg.file={name:pendingFile.name,size:pendingFile.size,url:url,isImage:true};
      }else{
        msg.file=pendingFile;
      }
      pendingFile=null;
    }
    if(replyTarget){msg.replyTo=replyTarget.mid;replyTarget=null;}
    persistMessage(conv,msg).then(function(r){
      if (r && r.ok === false) return;
      input.value='';
      renderThread();bindLongPress();renderConvList();renderStats();
      toast('Message sent');
    });
  };
  document.getElementById('sendBtn').addEventListener('click',send);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});

  document.getElementById('attachBtn').addEventListener('click',function(){document.getElementById('fileInput').click();});
  document.getElementById('fileInput').addEventListener('change',function(){
    var f=this.files[0];if(!f)return;
    var size=f.size>1048576?(f.size/1048576).toFixed(1)+' MB':(f.size/1024).toFixed(0)+' KB';
    var isImage=/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name)||(f.type&&f.type.indexOf('image/')===0);
    var badgeEl=document.getElementById('fileBadge');
    function bindRemove(){document.getElementById('fileRemove').addEventListener('click',function(){pendingFile=null;badgeEl.innerHTML='';});}
    if(isImage){
      var reader=new FileReader();
      reader.onload=function(ev){
        pendingFile={name:f.name,size:size,url:ev.target.result,isImage:true,raw:f};
        badgeEl.innerHTML='<div class="img-preview-bar show"><img src="'+ev.target.result+'" alt=""/><div class="img-preview-info"><b>'+f.name+'</b>Ready to send ('+size+')</div><button class="img-remove" id="fileRemove"><i class="fas fa-times"></i></button></div>';
        bindRemove();
      };
      reader.readAsDataURL(f);
    }else{
      pendingFile={name:f.name,size:size,isImage:false,raw:f};
      badgeEl.innerHTML='<div class="file-badge"><i class="fas fa-file"></i><span class="file-name">'+f.name+'</span><span style="opacity:.6">('+size+')</span><button class="file-remove" id="fileRemove"><i class="fas fa-times"></i></button></div>';
      bindRemove();
    }
    this.value='';
  });

  if(replyTarget){
    document.getElementById('replyPreview').classList.add('show');
    document.getElementById('rpName').textContent=replyTarget.from===PERSPECTIVE?'You':conv.name;
    document.getElementById('rpText').textContent=(replyTarget.text||'').substring(0,80);
  }
  document.getElementById('replyClose').addEventListener('click',function(){replyTarget=null;document.getElementById('replyPreview').classList.remove('show');});

  var menuBtn=document.getElementById('threadMenuBtn'),menu=document.getElementById('threadMenu');
  menuBtn.addEventListener('click',function(e){e.stopPropagation();menu.classList.toggle('open');});
  document.getElementById('tmFlag').addEventListener('click',function(e){e.stopPropagation();menu.classList.remove('open');toggleFlag(conv.id);});
  document.getElementById('tmClose').addEventListener('click',function(e){e.stopPropagation();menu.classList.remove('open');setConvStatus(conv.id,conv.status==='closed'?'open':'closed');});
  var bannerBtn=document.getElementById('tmRestartBanner');
  if(bannerBtn)bannerBtn.addEventListener('click',function(){setConvStatus(conv.id,'open');});

  bindLongPress();
}

function toggleFlag(id){
  var conv=convById(id);if(!conv)return;
  var next=!conv.flagged;
  writeConv(id,{flagged:next},function(c){c.flagged=next;}).then(function(){
    toast(next?'Conversation flagged':'Flag removed');
    renderConvList();renderThread();
  });
}

function setConvStatus(id,status){
  writeConv(id,{status:status},function(c){c.status=status;}).then(function(){
    toast(status==='closed'?'Conversation closed':'Conversation restarted');
    renderConvList();renderThread();
  });
}

var longPressTimer=null,ctxMsgId=null,ctxConvId=null;

function bindLongPress(){
  document.querySelectorAll('#threadBody .msg-row').forEach(function(row){
    function start(){clearTimeout(longPressTimer);longPressTimer=setTimeout(function(){openCtx(row);},500);}
    function cancel(){clearTimeout(longPressTimer);}
    row.addEventListener('touchstart',start,{passive:true});
    row.addEventListener('touchend',cancel);row.addEventListener('touchmove',cancel);
    row.addEventListener('mousedown',start);row.addEventListener('mouseup',cancel);row.addEventListener('mouseleave',cancel);
  });
}

function openCtx(row){
  var mid=row.getAttribute('data-mid');
  var conv=convById(activeConvId);if(!conv)return;
  var msg=conv.messages.find(function(m){return String(m.mid)===String(mid)});if(!msg)return;
  ctxMsgId=mid;ctxConvId=activeConvId;
  var preview=msg.text||'';if(msg.file)preview='📎 '+msg.file.name;
  if(preview.length>80)preview=preview.substring(0,80)+'…';
  document.getElementById('ctxPreview').textContent=preview;
  document.getElementById('ctxEdit').style.display=msg.from===PERSPECTIVE?'flex':'none';
  document.getElementById('ctxDelete').style.display='flex';
  document.getElementById('ctxReply').style.display='flex';
  document.getElementById('ctxOverlay').classList.add('open');
}

function closeCtx(){document.getElementById('ctxOverlay').classList.remove('open');ctxMsgId=null;ctxConvId=null;}

function startEdit(mid,cid){
  var conv=convById(cid);if(!conv)return;
  var msg=conv.messages.find(function(m){return String(m.mid)===String(mid)});if(!msg||msg.from!==PERSPECTIVE)return;
  var row=document.querySelector('#threadBody .msg-row[data-mid="'+mid+'"]');if(!row)return;
  row.classList.add('editing');var bub=row.querySelector('.msg-bubble');if(!bub)return;
  var originalText=msg.text||'';var saved=false;
  bub.innerHTML='<div class="edit-banner"><i class="fas fa-pen"></i> Editing</div><textarea class="edit-input" rows="1">'+originalText.replace(/</g,'&lt;')+'</textarea>';
  var ta=bub.querySelector('.edit-input');ta.focus();ta.style.height=ta.scrollHeight+'px';
  function save(){if(saved)return;saved=true;var val=ta.value.trim();if(!val){doDelete(mid,cid);return;}writeConv(cid,{editMessage:{mid:mid,text:val}},function(c){var m=c.messages.find(function(x){return x.mid===mid});if(m){m.text=val;m.edited=true;}}).then(function(){renderThread();bindLongPress();toast('Message edited');});}
  ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();save();}if(e.key==='Escape'){saved=true;renderThread();bindLongPress();}});
  ta.addEventListener('blur',function(){setTimeout(save,100);});
}

function doDelete(mid,cid){
  writeConv(cid,{deleteMessage:mid},function(c){
    var idx=c.messages.findIndex(function(m){return String(m.mid)===String(mid)});if(idx===-1)return;
    c.messages.splice(idx,1);
  }).then(function(){renderThread();bindLongPress();renderConvList();toast('Message deleted');});
}

function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}

var _bound=false;
function bindEvents(){
  if(_bound)return;_bound=true;
  document.getElementById('ctxOverlay').addEventListener('click',function(e){if(e.target===this)closeCtx();});
  document.getElementById('ctxReply').addEventListener('click',function(e){
    e.stopPropagation();var mid=ctxMsgId,cid=ctxConvId;closeCtx();
    if(mid===null)return;
    var conv=convById(cid);if(!conv)return;
    var msg=conv.messages.find(function(m){return String(m.mid)===String(mid)});if(!msg)return;
    replyTarget=msg;
    var rp=document.getElementById('replyPreview');
    if(rp){rp.classList.add('show');document.getElementById('rpName').textContent=msg.from===PERSPECTIVE?'You':conv.name;document.getElementById('rpText').textContent=(msg.text||'').substring(0,80);}
    var inp=document.getElementById('composeInput');if(inp)inp.focus();
  });
  document.getElementById('ctxEdit').addEventListener('click',function(e){e.stopPropagation();var mid=ctxMsgId,cid=ctxConvId;closeCtx();if(mid!==null)startEdit(mid,cid);});
  document.getElementById('ctxDelete').addEventListener('click',function(e){e.stopPropagation();var mid=ctxMsgId,cid=ctxConvId;closeCtx();if(mid!==null)doDelete(mid,cid);});
  document.querySelectorAll('.top-tab').forEach(function(tab){tab.addEventListener('click',function(){document.querySelectorAll('.top-tab').forEach(function(t){t.classList.remove('active')});tab.classList.add('active');currentView=tab.dataset.view;renderConvList();});});
  document.getElementById('markAllBtn').addEventListener('click',function(){
    callBackend('/author-messages/read-all',{method:'POST'}).then(function(){
      CONVERSATIONS.forEach(function(c){c.unread=0});
      renderStats();renderConvList();toast('All messages marked as read');
    });
  });
  document.getElementById('convSearch').addEventListener('input',function(){renderConvList();});
}

function init(){
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'author-messages',title:'Author Messages',subtitle:'Manage conversations with authors on your platform',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4,searchPlaceholder:'Search conversations...',mobileSearchTarget:'#convSearch',onSearch:function(v){document.getElementById('convSearch').value=v;renderConvList();}});
  // Dismiss the thread kebab menu on any outside click:
  document.addEventListener('click',function(){var m=document.getElementById('threadMenu');if(m)m.classList.remove('open');});
  bindEvents();
  loadConversations().then(function(){
    // Deep link from Authors page (?u=Author Name) — open that conversation if it exists:
    try{
      var u=(new URLSearchParams(window.location.search)).get('u');
      if(u){
        var hit=CONVERSATIONS.find(function(c){return c.name.toLowerCase()===u.trim().toLowerCase();});
        if(hit)activeConvId=hit.id;
      }
    }catch(e){}
    if(!convById(activeConvId)) activeConvId=CONVERSATIONS.length?CONVERSATIONS[0].id:null;
    renderConvList();renderStats();renderThread();bindLongPress();
    var conv=convById(activeConvId);
    if(conv)loadThread(conv).then(function(){renderConvList();renderStats();renderThread();bindLongPress();});
  });
}

window.AuthorMessagesService={init:init};

})();
