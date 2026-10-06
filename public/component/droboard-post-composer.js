/* ═══════════════════════════════════════════════════════════════
   DROBOARD POST COMPOSER + MANAGERS — admin-gated
   Only handle that canManage('post'|'manage_roles') sees composer/roles.
   Full-page overlay like genre-hub composer (centered .phone width).
   Shoutout: search user → popup with stats → select → shows stats card.
   Story Pick: search platform stories → popup → select → shows story card.
   ═══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';

function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function escAttr(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}

function canPost(){ try{ return global.DroboardPageData && DroboardPageData.canCurrentManage('post'); }catch(e){ return false; } }
function canManageRoles(){ try{ return global.DroboardPageData && DroboardPageData.canCurrentManage('manage_roles'); }catch(e){ return false; } }

// ── Data helpers ──
function getWriterPool(){
  // 1) dedicated demo pool so behaviour is testable without depending on global seed order
  try{ if(global.DroboardPageSeed && global.DroboardPageSeed.DROBOARD_COMPOSER_USERS) return global.DroboardPageSeed.DROBOARD_COMPOSER_USERS.slice(); }catch(e){}
  try{ return (typeof WRITER_STATUSES!=='undefined') ? WRITER_STATUSES.filter(function(w){return !w.isYou}) : []; }catch(e){ return []; }
}
function getStoryPool(){
  try{ if(global.DroboardPageSeed && global.DroboardPageSeed.DROBOARD_COMPOSER_STORIES) return global.DroboardPageSeed.DROBOARD_COMPOSER_STORIES.slice(); }catch(e){}
  try{ if(global.DemoData && DemoData.STORIES) return DemoData.STORIES; }catch(e){}
  try{ if(global.STORIES) return global.STORIES; }catch(e){}
  try{
    var c=global.DroboardPageSeed && global.DroboardPageSeed.DROBOARD_COLLECTIONS;
    if(c) return c.map(function(x,i){ return { id:'story'+i, title:x.name, cover:(x.covers&&x.covers[0])||'', author:'Droboard', genre:'', stats:{ reads:0 } }; });
  }catch(e){}
  return [];
}

// ── Overlay composer ──
  let _overlay=null, _cur='announcement', _onPosted=null;
  function getOnPosted(){ return _onPosted || (global.DroboardComposer && global.DroboardComposer._onPosted) || null; }
let _pickedUser=null, _pickedStory=null, _pickedImage='';

const CSS = ''
  + '.drb-ov{position:fixed;top:0;left:50%;transform:translate(-50%,100%);width:100%;max-width:420px;height:100dvh;z-index:600;background:var(--l1,#fff);display:flex;flex-direction:column;transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 50px rgba(0,0,0,.25);overflow:hidden} .drb-ov.open{transform:translate(-50%,0)}'
  + '.drb-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--bd,rgba(0,0,0,.1));background:var(--l1,#fff);flex-shrink:0}'
  + '.drb-head .cancel{background:none;border:none;font-size:14px;color:var(--tx-muted,#666);cursor:pointer;font-family:inherit}'
  + '.drb-head .title{font-size:15px;font-weight:700;color:var(--tx-high,#161616)}'
  + '.drb-head .post-btn{background:var(--acc,#ff0050);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;opacity:.45;pointer-events:none} .drb-head .post-btn.on{opacity:1;pointer-events:auto}'
  + '.drb-types{display:flex;gap:8px;padding:12px 16px;overflow-x:auto;border-bottom:1px solid var(--bd,rgba(0,0,0,.1));background:var(--l1,#fff);scrollbar-width:none} .drb-types::-webkit-scrollbar{display:none}'
  + '.drb-type{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid var(--bd,rgba(0,0,0,.1));background:none;color:var(--tx-muted,#666);cursor:pointer;white-space:nowrap} .drb-type.active{border-color:var(--acc,#ff0050);color:var(--acc,#ff0050);background:rgba(255,0,80,.08)}'
  + '.drb-body{flex:1;overflow-y:auto;padding:16px;background:var(--l1,#fff)}'
  + '.drb-field{margin-bottom:14px} .drb-label{font-size:11px;font-weight:700;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;display:block}'
  + '.drb-input{width:100%;border:1.5px solid var(--bd,rgba(0,0,0,.1));border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;background:var(--l2,#f0f0f0);color:var(--tx-high,#161616);outline:none} .drb-input:focus{border-color:var(--acc,#ff0050);background:var(--l1,#fff)}'
  + '.drb-textarea{width:100%;min-height:100px;border:1.5px solid var(--bd,rgba(0,0,0,.1));border-radius:10px;padding:12px;font-size:15px;font-family:inherit;resize:none;background:var(--l2,#f0f0f0);color:var(--tx-high,#161616);outline:none} .drb-textarea:focus{border-color:var(--acc,#ff0050);background:var(--l1,#fff)}'
  + '.drb-search-wrap{position:relative}'
  + '.drb-dropdown{position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--l1,#fff);border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);max-height:220px;overflow-y:auto;display:none;margin-top:4px}'
  + '.drb-dropdown.open{display:block}'
  + '.drb-user-opt{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer} .drb-user-opt:hover{background:rgba(255,0,80,.04)}'
  + '.drb-user-av{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0}'
  + '.drb-user-info{flex:1;min-width:0} .drb-user-name{font-size:13px;font-weight:700;color:var(--tx-high,#161616)} .drb-user-meta{font-size:10px;color:var(--tx-muted,#666);margin-top:1px}'
  + '.drb-user-stats{font-size:9px;color:var(--tx-muted,#666);display:flex;gap:8px;margin-top:2px} .drb-user-stats b{color:var(--tx-high,#161616)}'
  + '.drb-picked{margin-top:8px;display:flex;align-items:center;gap:10px;background:var(--l2,#f0f0f0);border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:12px;padding:10px 12px}'
  + '.drb-picked-av{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}'
  + '.drb-picked-info{flex:1;min-width:0} .drb-picked-name{font-size:13px;font-weight:800;color:var(--tx-high,#161616)} .drb-picked-tag{font-size:11px;color:var(--tx-muted,#666);margin-top:1px} .drb-picked-stats{font-size:10px;color:var(--tx-muted,#666);display:flex;gap:8px;margin-top:3px}'
  + '.drb-picked-x{width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.06);border:none;color:var(--tx-muted,#666);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}'
  + '.drb-story-opt{display:flex;gap:10px;padding:10px 12px;cursor:pointer} .drb-story-opt:hover{background:rgba(255,0,80,.04)} .drb-story-cover{width:40px;height:56px;border-radius:6px;object-fit:cover;flex-shrink:0;background:var(--l2,#eee)}'
  + '.drb-story-info{flex:1;min-width:0} .drb-story-title{font-size:12px;font-weight:700;color:var(--tx-high,#161616);white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .drb-story-meta{font-size:10px;color:var(--tx-muted,#666);margin-top:1px}'
  + '.drb-story-picked{display:flex;gap:10px;padding:10px 12px;background:var(--l2,#f0f0f0);border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:12px;margin-top:8px} .drb-story-picked img{width:48px;height:64px;border-radius:6px;object-fit:cover;flex-shrink:0}'
  + '.drb-img-preview{position:relative;margin-top:8px;display:none} .drb-img-preview.show{display:block} .drb-img-preview img{width:100%;border-radius:10px;max-height:180px;object-fit:cover;display:block;border:1px solid var(--bd,rgba(0,0,0,.1))}'
  + '.drb-img-x{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center}'
  + '.drb-img-row{display:flex;gap:8px;margin-top:8px} .drb-img-upload{flex:1;padding:9px;border-radius:10px;border:1.5px dashed var(--bd,rgba(0,0,0,.15));background:none;color:var(--tx-muted,#666);font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit}'
  + '[data-theme="dark"] .drb-ov{background:var(--l1,#08090c)} [data-theme="dark"] .drb-head{background:var(--l1,#08090c)} [data-theme="dark"] .drb-input,[data-theme="dark"] .drb-textarea{background:#0e0f13;border-color:rgba(255,255,255,.07);color:#e0e0e0}'
  + '.drb-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#161616;color:#fff;padding:10px 16px;border-radius:12px;font-size:12px;font-weight:600;z-index:700;animation:drbToastIn .25s ease} @keyframes drbToastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';

let _styleInjected=false;
function ensureStyle(){
  if(_styleInjected) return; _styleInjected=true;
  const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s);
}
function ensureOverlay(){
  if(_overlay) return;
  ensureStyle();
  _overlay=document.createElement('div');
  _overlay.className='drb-ov';
  _overlay.innerHTML=''
    + '<div class="drb-head"><button class="cancel" id="drbCancel">Cancel</button><div class="title" id="drbTitle">New post</div><button class="post-btn" id="drbPost">Post</button></div>'
    + '<div class="drb-types" id="drbTypes"></div>'
    + '<div class="drb-body" id="drbBody"></div>';
  document.body.appendChild(_overlay);
  _overlay.querySelector('#drbCancel').addEventListener('click', close);
  _overlay.querySelector('#drbPost').addEventListener('click', doPost);
}

const TYPE_DEFS=[
  {id:'announcement', label:'📢 Announcement'},
  {id:'post', label:'✍️ Post'},
  {id:'debate', label:'⚖️ Debate'},
  {id:'shoutout', label:'⭐ Shoutout'},
  {id:'repost', label:'📚 Story Pick'},
  {id:'forum-poll', label:'📊 Poll'},
  {id:'ama', label:'🎙 AMA'},
];

function renderTypes(){
  const el=_overlay.querySelector('#drbTypes');
  el.innerHTML=TYPE_DEFS.map(function(t){
    return '<button class="drb-type'+(t.id===_cur?' active':'')+'" data-t="'+t.id+'">'+t.label+'</button>';
  }).join('');
  el.querySelectorAll('[data-t]').forEach(function(b){
    b.addEventListener('click', function(){ _cur=b.dataset.t; _pickedImage=''; renderTypes(); renderBody(); });
  });
}

function renderBody(){
  const body=_overlay.querySelector('#drbBody');
  const titleEl=document.getElementById('drbTitle');
  if(titleEl) titleEl.textContent = TYPE_DEFS.find(function(t){return t.id===_cur})?.label || 'New post';
  let html='';
  // common title for some types
  if(_cur==='announcement' || _cur==='post' || _cur==='debate' || _cur==='forum-poll' || _cur==='ama'){
    html+='<div class="drb-field"><label class="drb-label">Title</label><input class="drb-input" id="drbTitleF" placeholder="Title (optional)"/></div>';
  }
  if(_cur==='shoutout'){
    html+='<div class="drb-field"><label class="drb-label">Search writer</label><div class="drb-search-wrap"><input class="drb-input" id="drbUserSearch" placeholder="Type writer name…"/><div class="drb-dropdown" id="drbUserDrop"></div></div><div id="drbUserPicked"></div></div>';
    html+='<div class="drb-field"><label class="drb-label">Shoutout message</label><textarea class="drb-textarea" id="drbText" rows="3" placeholder="Why are you shouting them out?"></textarea></div>';
  } else if(_cur==='repost'){
    html+='<div class="drb-field"><label class="drb-label">Search story</label><div class="drb-search-wrap"><input class="drb-input" id="drbStorySearch" placeholder="Type story title…"/><div class="drb-dropdown" id="drbStoryDrop"></div></div><div id="drbStoryPicked"></div></div>';
    html+='<div class="drb-field"><label class="drb-label">Your note (optional)</label><textarea class="drb-textarea" id="drbText" rows="2" placeholder="Why this pick?"></textarea></div>';
  } else if(_cur==='debate'){
    html+='<div class="drb-field"><label class="drb-label">Debate motion</label><input class="drb-input" id="drbExtra" placeholder=\'"Writers should be allowed to tag spoilers"\'/></div>';
    html+='<div class="drb-field"><label class="drb-label">Body (optional)</label><textarea class="drb-textarea" id="drbText" rows="3" placeholder="Add context…"></textarea></div>';
    html+='<div id="drbDebatePreview" style="margin-top:10px;background:var(--l2,#f0f0f0);border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:12px;padding:12px"></div>';
  } else if(_cur==='forum-poll'){
    html+='<div class="drb-field"><label class="drb-label">Question</label><input class="drb-input" id="drbPollQ" placeholder="What keeps you reading past midnight?"/></div>';
    html+='<div class="drb-field"><label class="drb-label">Options</label><div id="drbPollOpts"><input class="drb-input" data-poll-opt placeholder="Option 1" style="margin-bottom:8px"/><input class="drb-input" data-poll-opt placeholder="Option 2"/></div><button id="drbAddOpt" style="margin-top:8px;font-size:12px;font-weight:700;color:var(--acc,#ff0050);background:none;border:none;cursor:pointer">+ Add option</button></div>';
  } else if(_cur==='ama'){
    html+='<div class="drb-field"><label class="drb-label">Topic</label><textarea class="drb-textarea" id="drbText" rows="3" placeholder="What do you want to ask the team?"></textarea></div>';
  } else {
    html+='<div class="drb-field"><label class="drb-label">Message</label><textarea class="drb-textarea" id="drbText" rows="4" placeholder="Write something…"></textarea></div>';
    html+='<div class="drb-field"><label class="drb-label">Image (optional)</label>'
      +'<div class="drb-img-preview" id="drbImgPreview"><img id="drbImgTag" alt=""/><button class="drb-img-x" id="drbImgClear" aria-label="Remove image"><i class="fas fa-xmark"></i></button></div>'
      +'<input class="drb-input" id="drbImgUrl" placeholder="Paste image URL…" style="margin-bottom:0"/>'
      +'<div class="drb-img-row"><button class="drb-img-upload" id="drbImgUpload"><i class="fas fa-cloud-arrow-up"></i> Upload from phone</button></div>'
      +'<input type="file" id="drbImgFile" accept="image/*" style="display:none"/></div>';
  }
  body.innerHTML=html;
  bindBodyEvents();
  updatePostBtn();
  // live debate preview
  if(_cur==='debate') updateDebatePreview();
  // attach input listeners for post button state + preview
  body.querySelectorAll('input,textarea').forEach(function(i){
    i.addEventListener('input', function(){ updatePostBtn(); if(_cur==='debate') updateDebatePreview(); });
  });
}

function updateDebatePreview(){
  const box=document.getElementById('drbDebatePreview'); if(!box) return;
  const motion=(document.getElementById('drbExtra')?.value.trim()) || '"Writers should be allowed to tag spoilers"';
  const body=document.getElementById('drbText')?.value.trim() || '';
  box.innerHTML='<div style="font-size:10px;font-weight:700;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Preview</div>'
    +'<div style="background:var(--l1,#fff);border:1px solid var(--bd,rgba(0,0,0,.1));border-radius:12px;padding:12px">'
    +'<div style="font-size:13px;font-weight:800;color:var(--tx-high,#161616);line-height:1.4">'+esc(motion)+'</div>'
    +(body?'<div style="font-size:12px;color:var(--tx-muted,#666);margin-top:6px;line-height:1.5">'+esc(body)+'</div>':'')
    +'<div style="display:flex;gap:8px;margin-top:10px">'
    +'<button style="flex:1;padding:9px;border-radius:10px;border:1.5px solid var(--green,#34d399);background:rgba(52,211,153,.08);color:var(--green,#34d399);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px"><i class="fas fa-check"></i> For</button>'
    +'<button style="flex:1;padding:9px;border-radius:10px;border:1.5px solid var(--red,#f04438);background:rgba(248,113,113,.08);color:var(--red,#f04438);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px"><i class="fas fa-xmark"></i> Against</button>'
    +'</div></div>';
}

function updatePostBtn(){
  const btn=document.getElementById('drbPost'); if(!btn) return;
  let ok=false;
  if(_cur==='shoutout') ok=!!_pickedUser;
  else if(_cur==='repost') ok=!!_pickedStory;
  else {
    const titleEl=document.getElementById('drbTitleF');
    const textEl=document.getElementById('drbText');
    const qEl=document.getElementById('drbPollQ');
    ok=(titleEl&&titleEl.value.trim())||(textEl&&textEl.value.trim())||(qEl&&qEl.value.trim())||!!_pickedImage;
  }
  btn.classList.toggle('on', !!ok);
}

function bindBodyEvents(){
  // poll add option
  const addOpt=document.getElementById('drbAddOpt');
  if(addOpt) addOpt.addEventListener('click', function(){
    const wrap=document.getElementById('drbPollOpts');
    const n=wrap.querySelectorAll('[data-poll-opt]').length;
    if(n>=4) return;
    const inp=document.createElement('input');
    inp.className='drb-input'; inp.setAttribute('data-poll-opt','');
    inp.placeholder='Option '+(n+1); inp.style.marginBottom='8px';
    inp.addEventListener('input', updatePostBtn);
    wrap.appendChild(inp);
  });
  // shoutout search
  const uSearch=document.getElementById('drbUserSearch');
  if(uSearch){
    renderUserPicked();
    uSearch.addEventListener('input', function(){
      const q=this.value.trim().toLowerCase();
      const drop=document.getElementById('drbUserDrop');
      if(!q){ drop.classList.remove('open'); return; }
      const pool=getWriterPool();
      const hits=pool.filter(function(w){ return w.name.toLowerCase().indexOf(q)!==-1 || w.id.toLowerCase().indexOf(q)!==-1; }).slice(0,6);
      if(!hits.length){ drop.classList.remove('open'); return; }
      drop.innerHTML=hits.map(function(w){
        const reads=w.stats&&w.stats.reads? (w.stats.reads>=1000? (w.stats.reads/1000|0)+'k' : w.stats.reads) : '—';
        const followers=w.stats&&w.stats.followers || 0;
        const books=(w.books&&w.books.length)||0;
        return '<div class="drb-user-opt" data-wid="'+escAttr(w.id)+'"><img class="drb-user-av" src="'+escAttr(w.avatar||'')+'"/><div class="drb-user-info"><div class="drb-user-name">'+esc(w.name)+'</div><div class="drb-user-meta">@'+esc(w.id)+' · '+(w.isLive?'🔴 Live':'')+'</div><div class="drb-user-stats"><span><b>'+esc(reads)+'</b> reads</span><span><b>'+esc(String(followers))+'</b> followers</span><span><b>'+esc(String(books))+'</b> books</span></div></div></div>';
      }).join('');
      drop.classList.add('open');
      drop.querySelectorAll('[data-wid]').forEach(function(el){
        el.addEventListener('click', function(){
          const w=getWriterPool().find(function(x){return x.id===el.dataset.wid});
          _pickedUser=w||null;
          document.getElementById('drbUserSearch').value='';
          drop.classList.remove('open');
          renderUserPicked(); updatePostBtn();
        });
      });
    });
  }
  // image attach (post + announcement only)
  const imgFile=document.getElementById('drbImgFile');
  const imgUrl=document.getElementById('drbImgUrl');
  const imgPreview=document.getElementById('drbImgPreview');
  const imgTag=document.getElementById('drbImgTag');
  function refreshImgPreview(){
    if(!imgPreview) return;
    if(_pickedImage){ imgPreview.classList.add('show'); if(imgTag && imgTag.src!==_pickedImage) imgTag.src=_pickedImage; }
    else { imgPreview.classList.remove('show'); if(imgTag) imgTag.removeAttribute('src'); }
    updatePostBtn();
  }
  if(imgPreview && imgTag && _pickedImage){ imgPreview.classList.add('show'); imgTag.src=_pickedImage; }
  const imgUploadBtn=document.getElementById('drbImgUpload');
  if(imgUploadBtn && imgFile) imgUploadBtn.addEventListener('click', function(){ imgFile.click(); });
  if(imgFile) imgFile.addEventListener('change', function(){
    const f=imgFile.files && imgFile.files[0]; if(!f) return;
    if(!f.type.startsWith('image/')) return;
    // TODO backend: upload to /api/uploads, store returned URL. Local preview for now.
    const rd=new FileReader();
    rd.onload=function(){ _pickedImage=String(rd.result||''); if(imgUrl) imgUrl.value=''; refreshImgPreview(); };
    rd.readAsDataURL(f);
  });
  if(imgUrl) imgUrl.addEventListener('input', function(){
    const v=imgUrl.value.trim();
    _pickedImage=v;
    refreshImgPreview();
  });
  const imgClear=document.getElementById('drbImgClear');
  if(imgClear) imgClear.addEventListener('click', function(){
    _pickedImage=''; if(imgUrl) imgUrl.value=''; if(imgFile) imgFile.value=''; refreshImgPreview();
  });
  // story search
  const sSearch=document.getElementById('drbStorySearch');
  if(sSearch){
    renderStoryPicked();
    sSearch.addEventListener('input', function(){
      const q=this.value.trim().toLowerCase();
      const drop=document.getElementById('drbStoryDrop');
      if(!q){ drop.classList.remove('open'); return; }
      const pool=getStoryPool();
      const hits=pool.filter(function(s){ return (s.title||'').toLowerCase().indexOf(q)!==-1 || (s.author||s.writer||'').toLowerCase().indexOf(q)!==-1; }).slice(0,6);
      if(!hits.length){ drop.classList.remove('open'); return; }
      drop.innerHTML=hits.map(function(s){
        return '<div class="drb-story-opt" data-sid="'+escAttr(s.id||s.title)+'"><img class="drb-story-cover" src="'+escAttr(s.cover||'')+'"/><div class="drb-story-info"><div class="drb-story-title">'+esc(s.title||'')+'</div><div class="drb-story-meta">'+esc(s.author||s.writer||'')+' · '+(s.genre||'')+'</div></div></div>';
      }).join('');
      drop.classList.add('open');
      drop.querySelectorAll('[data-sid]').forEach(function(el){
        el.addEventListener('click', function(){
          const sid=el.dataset.sid;
          const pool2=getStoryPool();
          const found=pool2.find(function(x){return (x.id||x.title)===sid});
          _pickedStory=found||{ id:sid, title:el.querySelector('.drb-story-title').textContent, cover:el.querySelector('img').src, author:'' };
          document.getElementById('drbStorySearch').value='';
          drop.classList.remove('open');
          renderStoryPicked(); updatePostBtn();
        });
      });
    });
  }
}

function renderUserPicked(){
  const box=document.getElementById('drbUserPicked'); if(!box) return;
  if(!_pickedUser){ box.innerHTML=''; return; }
  const w=_pickedUser;
  const reads=w.stats&&w.stats.reads? (w.stats.reads>=1000? (w.stats.reads/1000|0)+'k' : w.stats.reads) : '—';
  const followers=w.stats&&w.stats.followers||0;
  const books=(w.books&&w.books.length)||0;
  box.innerHTML='<div class="drb-picked"><img class="drb-picked-av" src="'+escAttr(w.avatar||'')+'"/><div class="drb-picked-info"><div class="drb-picked-name">@'+esc(w.name)+'</div><div class="drb-picked-tag">'+esc(w.id)+' · '+(w.isLive?'🔴 Live':'Member')+'</div><div class="drb-picked-stats"><span><b>'+esc(reads)+'</b> reads</span><span><b>'+esc(String(followers))+'</b> followers</span><span><b>'+esc(String(books))+'</b> books</span></div></div><button class="drb-picked-x" id="drbClearUser"><i class="fas fa-xmark"></i></button></div>';
  box.querySelector('#drbClearUser').addEventListener('click', function(){ _pickedUser=null; renderUserPicked(); updatePostBtn(); });
}
function renderStoryPicked(){
  const box=document.getElementById('drbStoryPicked'); if(!box) return;
  if(!_pickedStory){ box.innerHTML=''; return; }
  const s=_pickedStory;
  box.innerHTML='<div class="drb-story-picked"><img src="'+escAttr(s.cover||'')+'" alt=""/><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:var(--tx-high,#161616);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(s.title||'')+'</div><div style="font-size:11px;color:var(--tx-muted,#666);margin-top:2px">'+esc(s.author||s.writer||'')+'</div></div><button class="drb-picked-x" id="drbClearStory"><i class="fas fa-xmark"></i></button></div>';
  box.querySelector('#drbClearStory').addEventListener('click', function(){ _pickedStory=null; renderStoryPicked(); updatePostBtn(); });
}

async function doPost(){
  const btn=document.getElementById('drbPost'); if(btn) { btn.textContent='Posting…'; btn.disabled=true; }
  try{
    let base={ likes:0, comments:0 };
    if(_cur==='announcement' || _cur==='post'){
      const title=document.getElementById('drbTitleF')?.value.trim();
      const text=document.getElementById('drbText')?.value.trim();
      if(!title && !text && !_pickedImage) throw new Error('Add a title, message or image');
      base.type=_cur; base.title=title||undefined; base.text=text||undefined;
      if(_pickedImage) base.image=_pickedImage;
    } else if(_cur==='debate'){
      const title=document.getElementById('drbTitleF')?.value.trim();
      const motion=document.getElementById('drbExtra')?.value.trim();
      const text=document.getElementById('drbText')?.value.trim();
      base.type='debate'; base.title=title||undefined; base.text=text||undefined;
      base.debateData={ motion: motion || '"This platform is better because of its readers."', forV:0, agV:0, userVote:null };
    } else if(_cur==='shoutout'){
      if(!_pickedUser) throw new Error('Search and select a writer');
      const text=document.getElementById('drbText')?.value.trim();
      base.type='shoutout'; base.text=text||undefined;
      base.shoutout={ id:_pickedUser.id, name:_pickedUser.name, avatar:_pickedUser.avatar, tagline: text||'Featured by the Droboard team', stats:_pickedUser.stats, handle:_pickedUser.handle||_pickedUser.id, following:!!_pickedUser.following };
    } else if(_cur==='repost'){
      if(!_pickedStory) throw new Error('Search and select a story');
      const note=document.getElementById('drbText')?.value.trim();
      base.type='repost'; base.note=note||undefined;
      base.storyRef={ cat:_pickedStory.genre||'📚 Pick', title:_pickedStory.title, cover:_pickedStory.cover, writer:_pickedStory.author||_pickedStory.writer||'Droboard' };
    } else if(_cur==='forum-poll'){
      const q=document.getElementById('drbPollQ')?.value.trim();
      const opts=[...document.querySelectorAll('[data-poll-opt]')].map(function(i){return i.value.trim()}).filter(Boolean);
      if(!q) throw new Error('Add a question');
      if(opts.length<2) throw new Error('Add at least 2 options');
      base.type='forum-poll'; base.title=q; base.poll={ q:q, opts:opts.map(function(t){return {t:t, v:0}}), voted:-1, total:0 };
    } else if(_cur==='ama'){
      const t=document.getElementById('drbTitleF')?.value.trim();
      const tx=document.getElementById('drbText')?.value.trim();
      base.type='ama'; base.title=t||undefined; base.text=tx||undefined;
      base.amaData={ title:t||'Droboard Live', meta:tx||'Ask the team anything' };
    }
    const created = await global.DroboardPageData.createPost(base);
    const post = Object.assign({ likes:0, comments:0, liked:false }, created);
    _pickedImage='';
    close();
    const cb=getOnPosted(); if(cb) cb(post);
  }catch(e){
    const t=document.createElement('div'); t.textContent=e.message||String(e); t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#b00020;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;z-index:9999'; document.body.appendChild(t); setTimeout(function(){t.remove()},2000);
  }finally{ if(btn){ btn.textContent='Post'; btn.disabled=false; } }
}

function open(){ ensureOverlay(); _cur='announcement'; _pickedUser=null; _pickedStory=null; _pickedImage=''; renderTypes(); renderBody(); _overlay.classList.add('open'); document.body.style.overflow='hidden'; }
function close(){ if(_overlay) _overlay.classList.remove('open'); document.body.style.overflow=''; }

// managers panel stays inline — reused
function buildManagers(){
  const box=document.createElement('div');
  box.style.cssText='background:var(--l1);border:1px solid var(--bd);border-radius:14px;padding:12px;margin-bottom:14px';
  async function render(){
    const list = global.DroboardPageData ? global.DroboardPageData.getManagers() : [];
    const iCanManage = canManageRoles();
    box.innerHTML=''
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><b style="font-size:12px;font-weight:800;color:var(--tx-high)"><i class="fas fa-shield-halved" style="color:var(--acc)"></i> Page managers</b><span style="font-size:10px;color:var(--tx-muted)">'+list.length+' · admins can edit</span></div>'
      + list.map(function(m){
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bd2)"><span style="flex:1;font-size:12px;font-weight:700;color:var(--tx-high)">@'+esc(m.handle)+'</span><span style="font-size:10px;font-weight:800;padding:3px 8px;border-radius:8px;'+(m.role==='admin'?'background:rgba(255,0,80,.1);color:var(--acc);border:1px solid var(--bd-acc)':'background:rgba(0,0,0,.04);color:var(--tx-muted);border:1px solid var(--bd)')+'">'+esc(m.role)+'</span>'+(iCanManage?'<select data-role-for="'+escAttr(m.handle)+'" style="font-size:11px;padding:5px 8px;border:1px solid var(--bd);border-radius:8px;background:var(--l2);color:var(--tx-high)"><option value="admin"'+(m.role==='admin'?' selected':'')+'>admin</option><option value="editor"'+(m.role==='editor'?' selected':'')+'>editor</option></select><button data-remove="'+escAttr(m.handle)+'" style="padding:5px 8px;border-radius:8px;border:1px solid var(--bd);background:var(--l1);color:var(--tx-muted);font-size:11px"><i class="fas fa-trash"></i></button>':'')+'</div>';
      }).join('')
      + (iCanManage?'<div style="display:flex;gap:8px;margin-top:10px"><input id="mgrHandle" placeholder="@handle" style="flex:1;padding:9px 10px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12px;outline:none"/><select id="mgrRole" style="padding:9px 10px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12px"><option value="editor">editor</option><option value="admin">admin</option></select><button id="mgrAdd" style="padding:9px 14px;border:none;border-radius:10px;background:var(--acc);color:#fff;font-size:12px;font-weight:800">Add</button></div><div style="font-size:10px;color:var(--tx-faint);margin-top:6px">Only admins can add/remove. Editors can post but not manage roles.</div>':'<div style="font-size:11px;color:var(--tx-muted);margin-top:8px">Editors can post. Only admins can edit managers.</div>');
    if(iCanManage){
      box.querySelectorAll('[data-role-for]').forEach(function(sel){
        sel.addEventListener('change', async function(){ await global.DroboardPageData.updateManagerRole(this.dataset.roleFor, this.value); render(); });
      });
      box.querySelectorAll('[data-remove]').forEach(function(btn){
        btn.addEventListener('click', async function(){ await global.DroboardPageData.removeManager(this.dataset.remove); render(); });
      });
      const addBtn=box.querySelector('#mgrAdd');
      if(addBtn) addBtn.addEventListener('click', async function(){
        const h=(box.querySelector('#mgrHandle').value||'').trim().replace(/^@/,'');
        const r=box.querySelector('#mgrRole').value;
        if(!h) return;
        await global.DroboardPageData.addManager(h, r);
        box.querySelector('#mgrHandle').value=''; render();
      });
    }
  }
  render();
  return box;
}

global.DroboardComposer = {
  open:open, close:close,
  mount:function(sel, opts){
    // legacy mount — now just opens overlay if manager, hides otherwise
    const el=typeof sel==='string'? document.querySelector(sel) : sel;
    if(!el || !canPost()) { if(el) el.style.display='none'; return null; }
    // create a trigger button in the mount
    el.style.display='block';
    el.innerHTML='<button id="drbOpenComposer" style="width:100%;padding:12px;border:1px solid var(--bd);border-radius:14px;background:var(--l1);color:var(--tx-muted);font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px"><i class="fas fa-pen" style="color:var(--acc)"></i> New post on @droboard — tap to compose</button>';
    const btn=el.querySelector('#drbOpenComposer');
    _onPosted = opts && opts.onPosted;
    btn.addEventListener('click', function(){ open(); });
    // keep onPosted for later opens
    const origOpen=open;
    global.DroboardComposer._onPosted=_onPosted;
    return el;
  }
};
// keep managers same
global.DroboardManagers = {
  mount:function(sel){
    const el=typeof sel==='string'? document.querySelector(sel) : sel;
    if(!el) return null;
    el.innerHTML='';
    el.appendChild(buildManagers());
    return el;
  }
};
// callers that used old onPosted via mount need the new overlay path
const _origOpen=open;
global.DroboardComposer.open=function(){ _onPosted=global.DroboardComposer._onPosted||_onPosted; _origOpen(); };

})(window);
