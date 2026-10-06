/* ═══════════════════════════════════════════════════════════════
   CHAT SERVICE
   Chat page orchestration. Self-boots on load (renderContacts + checkUrlParam).
   HTML calls no globals; all wiring via getElementById + addEventListener.
   When going live: set USE_API = false → true, update API_BASE.
   Demo behavior stays (no fetch wired).
   ═══════════════════════════════════════════════════════════════ */
const USE_API=false, API_BASE='/api';
(function(){
'use strict';

/* ── Theme ── */
var THEME_KEY = 'droboardTheme';
function getTheme(){ try{return localStorage.getItem(THEME_KEY)||'light';}catch(e){return 'light';} }
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem(THEME_KEY,t);}catch(e){}
}
setTheme(getTheme());

/* ── Helpers ── */
var myAvatar = 'https://i.pravatar.cc/100?img=32';
var msgId = 200;
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtTime(d){
  var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
}
function fmtShort(d){
  var now = new Date();
  var diff = now - d;
  if(diff < 86400000) return fmtTime(d);
  if(diff < 604800000){ var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return days[d.getDay()]; }
  return (d.getMonth()+1)+'/'+d.getDate();
}
function toast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(function(){ t.classList.remove('show'); }, 2400);
}

/* ═══════════════════════════════════
   CONTACTS DATA (demo)
   ═══════════════════════════════════ */
var CONTACTS = [
  {
    id:'ed_morgan', name:'Reina Morgan', avatar:'https://i.pravatar.cc/100?img=47',
    role:'Senior Editor', online:true,
    preview:'Love this! The direction is really coming together.',
    time: new Date(Date.now() - 1200000),
    unread: 2,
    messages:[
      { id:++msgId, from:'editor', text:"Hi! I'm your assigned editor. Feel free to reach out anytime about your writing, contracts, or anything else.", time:new Date(Date.now()-86400000*2-3600000*9) },
      { id:++msgId, from:'editor', text:"I reviewed your latest chapter — the pacing in the second half is really strong. Great work.", time:new Date(Date.now()-86400000*2-3600000*8) },
      { id:++msgId, from:'author', text:"Thank you so much! I rewrote that part three times, so I'm glad it landed.", time:new Date(Date.now()-86400000*2-3600000*7.5) },
      { id:++msgId, from:'editor', text:"It shows. Quick note — the cliffhanger at the end could be sharper. Want to brainstorm?", time:new Date(Date.now()-86400000*2-3600000*7) },
      { id:++msgId, from:'author', text:"Yes please! I was thinking maybe she finds the letter earlier?", time:new Date(Date.now()-86400000-3600000*9) },
      { id:++msgId, from:'editor', text:"Love that. Or she overhears a conversation — adds more tension. Let me know what you think.", time:new Date(Date.now()-86400000-3600000*8) },
      { id:++msgId, from:'editor', text:"Love this! The direction is really coming together.", time:new Date(Date.now()-1200000) },
    ]
  },
  {
    id:'admin_chief', name:'Jasmine Cole', avatar:'https://i.pravatar.cc/100?img=44',
    role:'Chief Editor', online:false,
    preview:'Your quarterly review is due by Friday.',
    time: new Date(Date.now() - 86400000),
    unread: 0,
    messages:[
      { id:++msgId, from:'editor', text:"Hi! I'm the Chief Editor. Just a heads-up — your quarterly review is due by Friday.", time:new Date(Date.now()-86400000) },
      { id:++msgId, from:'author', text:"Got it, I'll submit it on time. Thanks for the reminder!", time:new Date(Date.now()-86400000+600000) },
    ]
  },
  {
    id:'admin_super', name:'Droboard Support', avatar:'https://i.pravatar.cc/100?img=12',
    role:'Platform Admin', online:true,
    preview:'Your payout has been processed.',
    time: new Date(Date.now() - 86400000*3),
    unread: 0,
    messages:[
      { id:++msgId, from:'editor', text:"Hello! Your payout for last month has been processed. You should see it within 24 hours.", time:new Date(Date.now()-86400000*3) },
      { id:++msgId, from:'author', text:"Great, thank you!", time:new Date(Date.now()-86400000*3+300000) },
    ]
  }
];

var activeContact = null;
var pendingImage = null;
var longPressTimer = null;
var ctxMsgId = null;

/* ═══════════════════════════════════
   LAYER 1: RENDER CONTACTS
   ═══════════════════════════════════ */
function renderContacts(filter){
  var list = document.getElementById('contactList');
  var q = (filter || '').toLowerCase();
  var items = CONTACTS;
  if(q) items = items.filter(function(c){
    return c.name.toLowerCase().indexOf(q)!==-1 || c.role.toLowerCase().indexOf(q)!==-1;
  });
  if(!items.length){
    list.innerHTML = '<div class="contact-empty"><i class="fas fa-comments"></i><p>No conversations found.</p></div>';
    return;
  }
  list.innerHTML = items.map(function(c){
    var lastMsg = c.messages.length ? c.messages[c.messages.length-1] : null;
    var preview = lastMsg ? (lastMsg.from==='author'?'You: ':'') + (lastMsg.text||'[Image]') : '';
    if(preview.length > 50) preview = preview.substring(0,50) + '…';
    var timeStr = lastMsg ? fmtShort(lastMsg.time) : '';
    return '<div class="contact-item" data-cid="'+c.id+'">'
      + '<div class="contact-av-wrap">'
      +   '<img class="contact-av" src="'+c.avatar+'" alt=""/>'
      +   '<div class="contact-online'+(c.online?'':' offline')+'"></div>'
      + '</div>'
      + '<div class="contact-body">'
      +   '<div class="contact-top">'
      +     '<span class="contact-name">'+esc(c.name)+'</span>'
      +     '<span class="contact-time">'+timeStr+'</span>'
      +   '</div>'
      +   '<div class="contact-bottom">'
      +     '<span class="contact-role">'+esc(c.role)+'</span>'
      +     '<span class="contact-preview"> · '+esc(preview)+'</span>'
      +     (c.unread?'<span class="contact-badge">'+c.unread+'</span>':'')
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  list.querySelectorAll('.contact-item').forEach(function(el){
    el.addEventListener('click', function(){
      var cid = el.getAttribute('data-cid');
      var contact = CONTACTS.find(function(c){return c.id===cid;});
      if(contact) openChat(contact);
    });
  });
}

document.getElementById('contactSearchInput').addEventListener('input', function(){
  renderContacts(this.value);
});

/* ═══════════════════════════════════
   LAYER 2: OPEN / CLOSE CHAT
   ═══════════════════════════════════ */
function openChat(contact){
  activeContact = contact;
  contact.unread = 0;

  document.getElementById('edAv').src = contact.avatar;
  document.getElementById('edName').innerHTML = esc(contact.name) + ' <i class="fas fa-circle-check"></i>';
  var dot = document.querySelector('#edStatus .dot');
  dot.className = 'dot' + (contact.online ? '' : ' offline');
  document.getElementById('edStatusText').textContent = contact.online ? 'Online' : 'Offline';

  renderMessages();

  document.getElementById('layer1').classList.add('pushed');
  document.getElementById('layer2').classList.add('open');

  renderContacts(document.getElementById('contactSearchInput').value);
}

function closeChat(){
  activeContact = null;
  document.getElementById('layer1').classList.remove('pushed');
  document.getElementById('layer2').classList.remove('open');
  renderContacts(document.getElementById('contactSearchInput').value);
}

document.getElementById('backBtn').addEventListener('click', closeChat);

/* ═══════════════════════════════════
   LAYER 2: RENDER MESSAGES
   ═══════════════════════════════════ */
function renderMessages(){
  var wrap = document.getElementById('messagesWrap');
  if(!activeContact) return;
  var msgs = activeContact.messages;
  if(!msgs.length){
    wrap.innerHTML = '<div class="empty-chat"><i class="fas fa-comments"></i><p>No messages yet. Say hello!</p></div>';
    return;
  }
  var html = '';
  var lastDate = '';
  msgs.forEach(function(m){
    var dateStr = m.time.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    if(dateStr !== lastDate){
      html += '<div class="date-divider">'+dateStr+'</div>';
      lastDate = dateStr;
    }
    var isOut = m.from === 'author';
    var av = isOut ? myAvatar : activeContact.avatar;
    var bub = '';
    if(m.image) bub += '<img class="msg-img" src="'+m.image+'" alt=""/>';
    if(m.text) bub += '<span>'+esc(m.text)+'</span>';
    html += '<div class="msg-row '+(isOut?'out':'in')+'" data-mid="'+m.id+'">'
      + '<img class="msg-av" src="'+av+'" alt=""/>'
      + '<div class="msg-content"><div class="msg-bub">'+bub+'</div>'
      + '<span class="msg-time">'+fmtTime(m.time)+'</span>'
      + (m.edited ? '<span class="msg-edited">edited</span>' : '')
      + '</div></div>';
  });
  wrap.innerHTML = html;
  bindLongPress();
  wrap.scrollTop = wrap.scrollHeight;
}

/* ── Long press ── */
function bindLongPress(){
  var rows = document.querySelectorAll('#messagesWrap .msg-row');
  rows.forEach(function(row){
    function start(e){
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(function(){ openCtx(row); }, 600);
    }
    function cancel(){ clearTimeout(longPressTimer); }
    row.addEventListener('touchstart', start, {passive:true});
    row.addEventListener('touchend', cancel);
    row.addEventListener('touchmove', cancel);
    row.addEventListener('mousedown', start);
    row.addEventListener('mouseup', cancel);
    row.addEventListener('mouseleave', cancel);
  });
}

function openCtx(row){
  var mid = parseInt(row.getAttribute('data-mid'), 10);
  var msg = null;
  if(!activeContact) return;
  for(var i=0;i<activeContact.messages.length;i++){ if(activeContact.messages[i].id===mid){ msg=activeContact.messages[i]; break; } }
  if(!msg) return;
  ctxMsgId = mid;

  var preview = msg.image ? '[Image] ' : '';
  preview += msg.text || '';
  if(preview.length > 80) preview = preview.substring(0,80) + '\u2026';
  document.getElementById('ctxPreview').textContent = preview;
  document.getElementById('ctxEdit').style.display = msg.from === 'author' ? 'flex' : 'none';
  document.getElementById('ctxDelete').style.display = 'flex';
  document.getElementById('ctxOverlay').classList.add('open');
  if(navigator.vibrate) navigator.vibrate(30);
}

function closeCtx(){
  document.getElementById('ctxOverlay').classList.remove('open');
  ctxMsgId = null;
}

document.getElementById('ctxOverlay').addEventListener('click', function(e){
  if(e.target === this) closeCtx();
});

document.getElementById('ctxEdit').addEventListener('click', function(e){
  e.stopPropagation();
  var mid = ctxMsgId;
  closeCtx();
  if(mid !== null) startEdit(mid);
});

document.getElementById('ctxDelete').addEventListener('click', function(e){
  e.stopPropagation();
  var mid = ctxMsgId;
  closeCtx();
  if(mid !== null) doDelete(mid);
});

function startEdit(mid){
  var row = document.querySelector('.msg-row[data-mid="'+mid+'"]');
  if(!row || !activeContact) return;
  var msg = null;
  for(var i=0;i<activeContact.messages.length;i++){ if(activeContact.messages[i].id===mid){ msg=activeContact.messages[i]; break; } }
  if(!msg || msg.from !== 'author') return;

  row.classList.add('editing');
  var bub = row.querySelector('.msg-bub');
  var originalText = msg.text || '';

  bub.innerHTML = '<div class="edit-banner"><i class="fas fa-pen"></i> Editing message</div>'
    + '<textarea class="edit-input" rows="1">'+esc(originalText)+'</textarea>';

  var ta = bub.querySelector('.edit-input');
  ta.focus();
  ta.style.height = ta.scrollHeight + 'px';
  var saved = false;

  function save(){
    if(saved) return;
    saved = true;
    var val = ta.value.trim();
    if(!val){ doDelete(mid); return; }
    for(var i=0;i<activeContact.messages.length;i++){
      if(activeContact.messages[i].id===mid){ activeContact.messages[i].text = val; activeContact.messages[i].edited = true; break; }
    }
    renderMessages();
    toast('Message edited');
  }

  ta.addEventListener('keydown', function(e){
    if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); save(); }
    if(e.key==='Escape'){ saved = true; renderMessages(); }
  });
  ta.addEventListener('blur', function(){ setTimeout(save, 100); });
}

function doDelete(mid){
  if(!activeContact) return;
  for(var i=0;i<activeContact.messages.length;i++){
    if(activeContact.messages[i].id===mid){ activeContact.messages.splice(i,1); break; }
  }
  renderMessages();
  toast('Message deleted');
}

/* ── Image ── */
document.getElementById('attachBtn').addEventListener('click', function(){
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', function(e){
  var file = e.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    pendingImage = ev.target.result;
    document.getElementById('imgPreviewThumb').src = pendingImage;
    document.getElementById('imgPreviewBar').classList.add('show');
    sendBtn.disabled = false;
  };
  reader.readAsDataURL(file);
  this.value = '';
});
document.getElementById('imgRemoveBtn').addEventListener('click', function(){
  pendingImage = null;
  document.getElementById('imgPreviewBar').classList.remove('show');
  if(!input.value.trim()) sendBtn.disabled = true;
});

/* ── Compose ── */
var input = document.getElementById('composeInput');
var sendBtn = document.getElementById('sendBtn');

input.addEventListener('input', function(){
  sendBtn.disabled = !input.value.trim() && !pendingImage;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight,120)+'px';
});

function sendMessage(){
  if(!activeContact) return;
  var text = input.value.trim();
  if(!text && !pendingImage) return;
  var msg = { id:++msgId, from:'author', time: new Date() };
  if(pendingImage){ msg.image = pendingImage; if(text) msg.text = text; }
  else { msg.text = text; }
  activeContact.messages.push(msg);
  activeContact.preview = text || '[Image]';
  activeContact.time = new Date();
  input.value = ''; input.style.height = 'auto'; sendBtn.disabled = true;
  pendingImage = null;
  document.getElementById('imgPreviewBar').classList.remove('show');
  renderMessages();

  setTimeout(function(){
    var tRow = document.createElement('div');
    tRow.className = 'msg-row in'; tRow.id = 'typingRow';
    tRow.innerHTML = '<img class="msg-av" src="'+activeContact.avatar+'" alt=""/>'
      + '<div class="msg-content"><div class="msg-bub"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>';
    document.getElementById('messagesWrap').appendChild(tRow);
    document.getElementById('messagesWrap').scrollTop = document.getElementById('messagesWrap').scrollHeight;
    setTimeout(function(){
      var el = document.getElementById('typingRow');
      if(el) el.remove();
      var replies = [
        "Thanks for the update! I'll take a look.",
        "Great work — keep it up!",
        "Let me check on that and get back to you.",
        "Noted. I'll review this today.",
        "That sounds good. Let's discuss more tomorrow.",
        "Love this! The direction is really coming together.",
        "I'll send over my notes by end of day.",
      ];
      activeContact.messages.push({ id:++msgId, from:'editor', text: replies[Math.floor(Math.random()*replies.length)], time: new Date() });
      renderMessages();
    }, 1200 + Math.random()*800);
  }, 600);
}

sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', function(e){
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
});

/* ── URL param: open specific contact directly ── */
function checkUrlParam(){
  var params = new URLSearchParams(window.location.search);
  var cid = params.get('contact');
  if(cid){
    var contact = CONTACTS.find(function(c){return c.id===cid;});
    if(contact) openChat(contact);
  }
}

/* ── Boot ── */
renderContacts();
checkUrlParam();

})();
