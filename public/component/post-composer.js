/**
 * post-composer.js — Droboard Reusable Post Composer
 * ───────────────────────────────────────────────────
 * Drop one <script src="post-composer.js"></script> in any page.
 * Then call: DroboardPostComposer.open('text') or openPostComposer('ama')
 *
 * Supports: text, image, poll, debate, ama, quote
 * Reusable by feed.html and profile.html
 *
 * USAGE:
 *   <script src="component/post-composer.js"></script>
 *   DroboardPostComposer.attach(null, {
 *     getUser: () => ({ name:'You', avatar:'https://...' }),
 *     onSubmit: (post) => { FEED_POSTS.unshift(post); DroboardPostCard.setPosts(FEED_POSTS); toast('Posted!'); }
 *   });
 *   // or simply:
 *   DroboardPostComposer.open('ama');
 *
 * If no hooks supplied, onSubmit does local toast + pushes to window.FeedData demo.
 */
(function () {
  'use strict';
  if (window.__droboardPostComposer) return;
  window.__droboardPostComposer = true;

  const CSS = `
    .dpc-ov{position:fixed;top:0;left:50%;transform:translate(-50%,100%);width:100%;max-width:420px;height:100dvh;z-index:400;background:var(--bg,#fff);display:flex;flex-direction:column;transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 50px rgba(0,0,0,.25);overflow:hidden;}
    .dpc-ov.open{transform:translate(-50%,0)}
    .dpc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border,#f1f1f1);background:var(--bg,#fff)}
    .dpc-head .cancel{background:none;border:none;font-size:14px;color:var(--tx-muted,#6b7280);cursor:pointer;font-family:inherit}
    .dpc-head .title{font-size:15px;font-weight:700;color:var(--tx,#1a1a2e)}
    .dpc-head .post-btn{background:var(--acc,#ff0050);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;opacity:.45;pointer-events:none}
    .dpc-head .post-btn.on{opacity:1;pointer-events:auto}
    .dpc-head .post-btn:active{transform:scale(.96)}
    .dpc-types{display:flex;gap:8px;padding:12px 16px;overflow-x:auto;border-bottom:1px solid var(--border,#f1f1f1);background:var(--bg,#fff);scrollbar-width:none}
    .dpc-types::-webkit-scrollbar{display:none}
    .dpc-type{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid var(--border,#f1f1f1);background:none;color:var(--tx-muted,#6b7280);cursor:pointer;white-space:nowrap}
    .dpc-type.active{border-color:var(--acc,#ff0050);color:var(--acc,#ff0050);background:var(--acc-light,rgba(255,0,80,.08))}
    .dpc-body{flex:1;overflow-y:auto;padding:16px;background:var(--bg,#fff)}
    .dpc-field{margin-bottom:14px}
    .dpc-label{font-size:11px;font-weight:700;color:var(--tx-muted,#6b7280);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;display:block}
    .dpc-input{width:100%;border:1.5px solid var(--border,#f1f1f1);border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;background:var(--l1,#f8f9fa);color:var(--tx,#1a1a2e);outline:none}
    .dpc-input:focus{border-color:var(--acc,#ff0050);background:var(--bg,#fff)}
    .dpc-textarea{width:100%;min-height:100px;border:1.5px solid var(--border,#f1f1f1);border-radius:10px;padding:12px;font-size:15px;font-family:inherit;resize:none;background:var(--l1,#f8f9fa);color:var(--tx,#1a1a2e);outline:none}
    .dpc-textarea:focus{border-color:var(--acc,#ff0050);background:var(--bg,#fff)}
    .dpc-textarea.large{min-height:140px}
    .dpc-hint{font-size:11px;color:var(--tx-muted,#6b7280);margin-top:4px}
    .dpc-poll-opt{display:flex;gap:8px;margin-bottom:8px}
    .dpc-poll-opt input{flex:1}
    .dpc-poll-opt button{width:32px;height:38px;border-radius:8px;border:1px solid var(--border,#f1f1f1);background:none;color:var(--tx-muted,#6b7280);cursor:pointer}
    .dpc-add-opt{font-size:12px;font-weight:600;color:var(--acc,#ff0050);background:none;border:none;cursor:pointer;padding:4px 0}
    .dpc-add-opt:disabled{opacity:.4;pointer-events:none}
    .dpc-image-preview{width:100%;max-height:220px;border-radius:10px;overflow:hidden;margin-top:8px;background:var(--l1,#f8f9fa);display:none;position:relative}
    .dpc-image-preview.has{display:block}
    .dpc-image-preview img{width:100%;max-height:220px;object-fit:cover;display:block}
    .dpc-image-x{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .dpc-debate-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .dpc-qbg-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .dpc-qbg{width:44px;height:44px;border-radius:10px;border:2px solid transparent;cursor:pointer;flex-shrink:0;position:relative}
    .dpc-qbg.on{border-color:var(--acc,#ff0050);box-shadow:0 0 0 2px var(--acc-light,rgba(255,0,80,.15))}
    .dpc-qbg:active{transform:scale(.96)}
    .dpc-qbg-check{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#fff;font-size:14px;background:rgba(0,0,0,.2);border-radius:8px}
    .dpc-qbg.on .dpc-qbg-check{display:flex}
    .dpc-toast{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:2000;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;max-width:90%;text-align:center}
    .dpc-toast.show{opacity:1}
    .dpc-story-hits{display:flex;flex-direction:column;gap:6px;margin-top:8px}
    .dpc-story-hit{display:flex;gap:10px;align-items:center;border:1px solid var(--border,#f1f1f1);border-radius:10px;padding:8px;cursor:pointer;text-align:left;width:100%;font-family:inherit;background:var(--bg,#fff);color:var(--tx,#1a1a2e)}
    .dpc-story-hit img{width:34px;height:46px;border-radius:6px;object-fit:cover;flex-shrink:0}
    .dpc-story-hit-t{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dpc-story-hit-a{font-size:10.5px;color:var(--tx-muted,#666);margin-top:1px}
    .dpc-story-picked{display:flex;gap:10px;align-items:center;border:1.5px solid var(--acc,#ff0050);border-radius:10px;padding:8px;margin-top:8px;background:var(--acc-light,rgba(255,0,80,.04))}
    .dpc-story-picked img{width:34px;height:46px;border-radius:6px;object-fit:cover;flex-shrink:0}
    .dpc-story-picked-t{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dpc-story-picked-a{font-size:10.5px;color:var(--tx-muted,#666);margin-top:1px}
    .dpc-story-picked-x{margin-left:auto;background:none;border:none;color:var(--tx-muted,#666);cursor:pointer;font-size:14px;padding:4px}
    .dpc-story-picked.dpc-story-blocked{border-color:#f59e0b;background:rgba(245,158,11,.06)}
    .dpc-story-blocked-msg{font-size:10.5px;color:#b45309;font-weight:600;margin-top:3px;line-height:1.3}
    [data-theme="dark"] .dpc-story-hit{background:#0e0f13;border-color:rgba(255,255,255,.08);color:#e0e0e0}
    [data-theme="dark"] .dpc-ov{background:#000}
    [data-theme="dark"] .dpc-head{background:#000;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dpc-types{background:#000;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .dpc-input,[data-theme="dark"] .dpc-textarea{background:#0e0f13;border-color:rgba(255,255,255,.08);color:#e0e0e0}
    [data-theme="dark"] .dpc-input:focus,[data-theme="dark"] .dpc-textarea:focus{background:#000;border-color:rgba(255,0,80,.4)}
  `;

  const HTML = `
    <div class="dpc-ov" id="dpcOv">
      <div class="dpc-head">
        <button class="cancel" id="dpcCancel">Cancel</button>
        <div class="title" id="dpcTitle">New post</div>
        <button class="post-btn" id="dpcPost">Post</button>
      </div>
      <div class="dpc-types" id="dpcTypes"></div>
      <div class="dpc-body" id="dpcBody"></div>
    </div>
    <div class="dpc-toast" id="dpcToast"></div>
  `;

  const TYPES = [
    { id:'text', label:'Text', icon:'fa-pen' },
    { id:'status', label:'Status', icon:'fa-circle-dot' },
    { id:'poll', label:'Poll', icon:'fa-chart-bar' },
    { id:'debate', label:'Debate', icon:'fa-fire' },
    { id:'ama', label:'AMA', icon:'fa-microphone' },
    { id:'quote', label:'Quote', icon:'fa-quote-right' },
    { id:'recommendation', label:'Recommend', icon:'fa-bookmark' },
    { id:'chapter-drop', label:'Chapter', icon:'fa-book-open' },
  ];

  let _hooks = {};
  let _currentType = 'text';
  let _editingPost = null;
  let _built = false;
  let _pickedStory = null;
  let _pickedChapter = null;
  let _pickedStatusStory = null;
  let _draftKey = '';

  function val(id){ const el=document.getElementById(id); return el ? el.value : ''; }
  function storyPool(){
    const out = [];
    const seen = new Set();
    const push = (s) => {
      if(!s) return;
      const key = String(s.id || s.title || '').toLowerCase();
      if(!key || seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };
    ((_hooks.stories || []).forEach(push));
    try { ((window.DemoData && DemoData.STORIES) || []).forEach(push); } catch(e){}
    try {
      const seed = window.GenreDemoSeed;
      if(seed && seed.DEMO_STORIES){
        Object.keys(seed.DEMO_STORIES).forEach(gid => { (seed.DEMO_STORIES[gid] || []).forEach(push); });
      }
    } catch(e){}
    return out;
  }
  function saveDraft(){
    if(!_draftKey) return;
    try{
      const d = { type:_currentType };
      if(_currentType==='text'){
        d.text=val('dpcText'); d.heading=val('dpcHeading'); d.imageUrl=val('dpcImageUrl');
      } else if(_currentType==='status'){
        d.text=val('dpcStatusText'); d.caption=val('dpcStatusCaption'); d.bg=_statusBg;
        if(_pickedStatusStory) d.story=_pickedStatusStory;
      } else if(_currentType==='recommendation'){
        d.text=val('dpcRecText'); d.storyTitle=val('dpcRecStory');
        if(_pickedStory) d.story=_pickedStory;
      } else if(_currentType==='chapter-drop'){
        d.text=val('dpcChText'); d.storyTitle=val('dpcChStory');
        if(_pickedChapter) d.story=_pickedChapter;
      } else if(_currentType==='poll'){
        d.text=val('dpcPollQ'); d.imageUrl=val('dpcPollImageUrl');
        try { d.opts=[...document.querySelectorAll('#dpcPollOpts input')].map(i=>i.value); } catch(e){ d.opts=[]; }
      } else if(_currentType==='debate'){
        d.text=val('dpcDebateQ'); d.prompt=val('dpcDebatePrompt'); d.forT=val('dpcFor'); d.against=val('dpcAgainst');
      } else if(_currentType==='ama'){
        d.text=val('dpcAmaTitle'); d.meta=val('dpcAmaMeta'); d.viewers=val('dpcAmaViewers');
      } else if(_currentType==='quote'){
        d.text=val('dpcQuote'); d.caption=val('dpcCaption'); d.bg=_quoteBg;
      }
      const hasAny = (d.text||'').trim() || (d.heading||'').trim() || (d.imageUrl||'').trim()
        || (d.prompt||'').trim() || (d.forT||'').trim() || (d.against||'').trim()
        || (d.meta||'').trim() || (d.caption||'').trim() || d.story
        || ((d.opts||[]).some(o => (o||'').trim()));
      if(hasAny) localStorage.setItem(_draftKey, JSON.stringify(d));
      else localStorage.removeItem(_draftKey);
    }catch(e){}
  }
  function restoreDraft(){
    if(!_draftKey) return false;
    try{
      const raw = localStorage.getItem(_draftKey);
      if(!raw) return false;
      const d = JSON.parse(raw);
      if(d.type) _currentType = d.type;
      if(d.type === 'status' && d.bg) _statusBg = d.bg;
      if(d.type === 'status' && d.story){ _pickedStatusStory = d.story; }
      if(d.type === 'chapter-drop'){ if(d.story) _pickedChapter = d.story; }
      else if(d.story) _pickedStory = d.story;
      return true;
    }catch(e){ return false; }
  }
  function clearDraft(){
    if(!_draftKey) return;
    try{ localStorage.removeItem(_draftKey); }catch(e){}
  }
  function setVal(id, v){ const el=document.getElementById(id); if(el && v != null) el.value=v; }
  function applyDraft(){
    if(!_draftKey) return;
    try{
      const raw = localStorage.getItem(_draftKey);
      if(!raw) return;
      const d = JSON.parse(raw);
      if(_currentType==='text'){
        if(d.text) setVal('dpcText', d.text);
        if(d.heading) setVal('dpcHeading', d.heading);
        if(d.imageUrl){ setVal('dpcImageUrl', d.imageUrl); const pi=document.getElementById('dpcImgPrevImg'); const pv=document.getElementById('dpcImgPrev'); if(pi && pv && d.imageUrl){ pi.src=d.imageUrl; pv.classList.add('has'); } }
        const t=document.getElementById('dpcText'); const c=document.getElementById('dpcCount'); if(c && t) c.textContent=(t.value||'').length;
      } else if(_currentType==='status'){
        if(d.text) setVal('dpcStatusText', d.text);
        if(d.caption) setVal('dpcStatusCaption', d.caption);
        if(_pickedStatusStory){ setVal('dpcStatusStory', _pickedStatusStory.title); renderPickedStatusStory(); }
        const _spv=document.getElementById('dpcStatusPreview');
        const _spt=document.getElementById('dpcStatusPreviewText');
        const _spc=document.getElementById('dpcStatusPreviewCap');
        if(_spv) _spv.style.background=(STATUS_BGS.find(b=>b.id===_statusBg)||STATUS_BGS[0]).bg;
        if(_spt) _spt.innerHTML=d.text ? '&ldquo;'+esc(d.text)+'&rdquo;' : '&ldquo;Your words here&rdquo;';
        if(_spc) _spc.textContent=d.caption||'';
      } else if(_currentType==='recommendation'){
        if(d.text) setVal('dpcRecText', d.text);
        if(d.story){ _pickedStory=d.story; renderPickedStory(); if(d.storyTitle) setVal('dpcRecStory', d.storyTitle); }
        else if(d.storyTitle) setVal('dpcRecStory', d.storyTitle);
      } else if(_currentType==='chapter-drop'){
        if(d.text) setVal('dpcChText', d.text);
        if(d.story){ _pickedChapter=d.story; renderPickedChapter(); if(d.storyTitle) setVal('dpcChStory', d.storyTitle); }
        else if(d.storyTitle) setVal('dpcChStory', d.storyTitle);
      } else if(_currentType==='poll'){
        if(d.text) setVal('dpcPollQ', d.text);
        if(d.imageUrl){ setVal('dpcPollImageUrl', d.imageUrl); const pi=document.getElementById('dpcPollImgPrevImg'); const pv=document.getElementById('dpcPollImgPrev'); if(pi && pv){ pi.src=d.imageUrl; pv.classList.add('has'); } }
        if(Array.isArray(d.opts) && d.opts.length){
          const wrap=document.getElementById('dpcPollOpts');
          if(wrap){ [...wrap.querySelectorAll('input')].forEach((inp,i)=>{ if(d.opts[i] != null) inp.value=d.opts[i]; }); }
        }
      } else if(_currentType==='debate'){
        if(d.text) setVal('dpcDebateQ', d.text);
        if(d.prompt) setVal('dpcDebatePrompt', d.prompt);
        if(d.forT) setVal('dpcFor', d.forT);
        if(d.against) setVal('dpcAgainst', d.against);
      } else if(_currentType==='ama'){
        if(d.text) setVal('dpcAmaTitle', d.text);
        if(d.meta) setVal('dpcAmaMeta', d.meta);
        if(d.viewers) setVal('dpcAmaViewers', d.viewers);
      } else if(_currentType==='quote'){
        if(d.text) setVal('dpcQuote', d.text);
        if(d.caption) setVal('dpcCaption', d.caption);
        if(d.bg){ _quoteBg = d.bg; try { document.querySelectorAll('.dpc-qbg').forEach(x=>x.classList.toggle('on', x.dataset.bg===_quoteBg)); } catch(e){} }
      }
      validate();
      try { if(typeof updateQuotePreview==='function') updateQuotePreview(); } catch(e){}
    }catch(e){}
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function toast(msg){
    if(typeof window.toast === 'function'){ window.toast(msg); return; }
    const t=document.getElementById('dpcToast'); if(!t) return;
    t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200);
  }

  function inject(){
    if(_built) return; _built=true;
    const style=document.createElement('style'); style.id='dpc-style'; style.textContent=CSS; document.head.appendChild(style);
    const wrap=document.createElement('div'); wrap.innerHTML=HTML.trim(); while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
    bindStatic();
    renderTypes();
    renderBody();
  }

  function renderTypes(){
    const el=document.getElementById('dpcTypes');
    if(!el) return;
    el.innerHTML = TYPES.map(t=> `<button class="dpc-type ${t.id===_currentType?'active':''}" data-ct="${t.id}"><i class="fas ${t.icon}"></i> ${t.label}</button>`).join('');
    el.querySelectorAll('.dpc-type').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        _currentType = btn.dataset.ct;
        renderTypes(); renderBody(); validate();
      });
    });
  }

  const QUOTE_BGS = [
    { id:'pink', bg:'linear-gradient(135deg,rgba(255,0,80,.08),rgba(167,139,250,.06))', label:'Pink' },
    { id:'purple', bg:'linear-gradient(135deg,rgba(167,139,250,.12),rgba(124,58,237,.08))', label:'Purple' },
    { id:'blue', bg:'linear-gradient(135deg,rgba(56,189,248,.12),rgba(59,130,246,.06))', label:'Blue' },
    { id:'orange', bg:'linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,146,60,.08))', label:'Orange' },
    { id:'green', bg:'linear-gradient(135deg,rgba(52,211,153,.12),rgba(16,185,129,.08))', label:'Green' },
    { id:'dark', bg:'linear-gradient(135deg,#1a1a2e,#16213e)', label:'Dark' },
  ];
  let _quoteBg = 'pink';
  let _statusBg = 'black';
  let _refreshStatusPreview = null;

  /* Status backgrounds: offline-safe gradients, heavy on blacks/browns.
     Uploaded photo overrides whichever is picked. */
  const STATUS_BGS = [
    { id:'black', bg:'linear-gradient(135deg,#000000,#1c1c1e)', label:'Black' },
    { id:'charcoal', bg:'linear-gradient(135deg,#2b2b2f,#101013)', label:'Charcoal' },
    { id:'warmblack', bg:'linear-gradient(135deg,#1c1917,#0c0a09)', label:'Warm black' },
    { id:'coffee', bg:'linear-gradient(135deg,#4b2e2b,#241414)', label:'Coffee' },
    { id:'chocolate', bg:'linear-gradient(135deg,#5b3a29,#241407)', label:'Chocolate' },
    { id:'cocoa', bg:'linear-gradient(135deg,#3e2723,#160d0b)', label:'Cocoa' },
    { id:'sand', bg:'linear-gradient(135deg,#b08968,#6b4a2f)', label:'Sand' },
    { id:'maroon', bg:'linear-gradient(135deg,#4c0519,#1c0208)', label:'Maroon' },
    { id:'wine', bg:'linear-gradient(135deg,#701a2e,#2b0a13)', label:'Wine' },
    { id:'crimson', bg:'linear-gradient(135deg,#7f1d1d,#220909)', label:'Crimson' },
    { id:'navy', bg:'linear-gradient(135deg,#172554,#0a0f1e)', label:'Navy' },
    { id:'forest', bg:'linear-gradient(135deg,#14532d,#071a0e)', label:'Forest' },
    { id:'plum', bg:'linear-gradient(135deg,#3b0764,#150427)', label:'Plum' },
    { id:'slate', bg:'linear-gradient(135deg,#334155,#0b1220)', label:'Slate' },
  ];

  function renderBody(){
    const el=document.getElementById('dpcBody');
    if(!el) return;
    if(_editingPost && _editingPost.type==='quote' && _editingPost.quoteBg) _quoteBg = _editingPost.quoteBg;
    let h='';
    if(_currentType==='text'){
      h = `
        <div class="dpc-field"><label class="dpc-label">What's on your mind?</label><textarea id="dpcText" class="dpc-textarea large" placeholder="Share your thoughts…"></textarea><div class="dpc-hint"><span id="dpcCount">0</span>/500</div></div>
        <div class="dpc-field"><label class="dpc-label">Heading (optional)</label><input id="dpcHeading" class="dpc-input" placeholder="Add a heading"/></div>
        <div class="dpc-field"><label class="dpc-label">Add image (optional)</label><input type="file" id="dpcImageFile" accept="image/*" class="dpc-input"/><div class="dpc-hint">or paste image URL below</div><input id="dpcImageUrl" class="dpc-input" style="margin-top:8px" placeholder="https://..."/><div id="dpcImgPrev" class="dpc-image-preview"><img id="dpcImgPrevImg" src="" data-noguard/></div></div>
      `;
    } else if(_currentType==='poll'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Poll question</label><textarea id="dpcPollQ" class="dpc-textarea" placeholder="Ask a question…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Options (2-4)</label><div id="dpcPollOpts"></div><button class="dpc-add-opt" id="dpcAddOpt">+ Add option</button></div>
        <div class="dpc-field"><label class="dpc-label">Add image to poll (optional)</label><input type="file" id="dpcPollImageFile" accept="image/*" class="dpc-input"/><div class="dpc-hint">or paste image URL</div><input id="dpcPollImageUrl" class="dpc-input" style="margin-top:8px" placeholder="https://..."/><div id="dpcPollImgPrev" class="dpc-image-preview"><img id="dpcPollImgPrevImg" src="" data-noguard/></div></div>
      `;
    } else if(_currentType==='debate'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Debate question</label><textarea id="dpcDebateQ" class="dpc-textarea" placeholder="Should villains get redemption?"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Context (optional)</label><input id="dpcDebatePrompt" class="dpc-input" placeholder="Share your thoughts…"/></div>
        <div class="dpc-debate-row">
          <div class="dpc-field"><label class="dpc-label">For</label><input id="dpcFor" class="dpc-input" maxlength="60" placeholder="Yes, everyone deserves…"/></div>
          <div class="dpc-field"><label class="dpc-label">Against</label><input id="dpcAgainst" class="dpc-input" maxlength="60" placeholder="No, some actions…"/></div>
        </div>
      `;
    } else if(_currentType==='ama'){
      h = `
        <div class="dpc-field"><label class="dpc-label">AMA title</label><input id="dpcAmaTitle" class="dpc-input" placeholder="Ask Ada_Writes Anything 🎙"/></div>
        <div class="dpc-field"><label class="dpc-label">Description</label><textarea id="dpcAmaMeta" class="dpc-textarea" placeholder="Writing process · Where Season 3 is going…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Viewers (optional)</label><input id="dpcAmaViewers" type="number" class="dpc-input" placeholder="e.g. 342"/></div>
      `;
    } else if(_currentType==='quote'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Quote</label><textarea id="dpcQuote" class="dpc-textarea large" placeholder="He wasn't her plan. He was the thing that happened…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Caption / Source</label><input id="dpcCaption" class="dpc-input" placeholder="— Chapter 8, The Billionaire Never Forgets"/></div>
        <div class="dpc-field"><label class="dpc-label">Quote background</label><div class="dpc-qbg-grid" id="dpcQbgGrid">${QUOTE_BGS.map(b=> `<div class="dpc-qbg ${b.id===_quoteBg?'on':''}" data-bg="${b.id}" style="background:${b.bg}" title="${b.label}"><div class="dpc-qbg-check"><i class="fas fa-check"></i></div></div>`).join('')}</div></div>
        <div class="dpc-field"><label class="dpc-label">Preview</label><div id="dpcQuotePreview" class="pcc-quote" style="background:${(QUOTE_BGS.find(b=>b.id===_quoteBg)||QUOTE_BGS[0]).bg}"><div class="pcc-quote-mark">&ldquo;</div><div class="pcc-quote-text" id="dpcQuotePreviewText">&ldquo;Your quote will appear here&rdquo;</div><div class="pcc-quote-caption" id="dpcQuotePreviewCaption">— Source</div></div></div>
      `;
    } else if(_currentType==='recommendation'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Your recommendation</label><textarea id="dpcRecText" class="dpc-textarea large" placeholder="Why should others read this story?"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Story *</label><input id="dpcRecStory" class="dpc-input" placeholder="Search story title or author…"/><div class="dpc-story-hits" id="dpcRecStoryHits"></div><div id="dpcRecStoryPicked"></div></div>
      `;
    } else if(_currentType==='chapter-drop'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Announcement (optional)</label><textarea id="dpcChText" class="dpc-textarea" placeholder="Chapter 12 just dropped — no spoilers, but that ending…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Story *</label><input id="dpcChStory" class="dpc-input" placeholder="Search story title or author…"/><div class="dpc-story-hits" id="dpcChStoryHits"></div><div id="dpcChStoryPicked"></div></div>
      `;
    } else if(_currentType==='status'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Say it (big quote on your status)</label><textarea id="dpcStatusText" class="dpc-textarea large" placeholder="Chapter 21 is finally live…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Caption (small line under it, optional)</label><input id="dpcStatusCaption" class="dpc-input" placeholder="His Sweet Revenge · New chapter"/></div>
        <div class="dpc-field"><label class="dpc-label">Background (no photo needed)</label><div class="dpc-qbg-grid" id="dpcStatusBgGrid">${STATUS_BGS.map(b=> `<div class="dpc-qbg ${b.id===_statusBg?'on':''}" data-sbg="${b.id}" style="background:${b.bg}" title="${b.label}"><div class="dpc-qbg-check"><i class="fas fa-check"></i></div></div>`).join('')}</div></div>
        <div class="dpc-field"><label class="dpc-label">Link a story (optional — tappable in your story)</label><input id="dpcStatusStory" class="dpc-input" placeholder="Search your stories…"/><div class="dpc-story-hits" id="dpcStatusStoryHits"></div><div id="dpcStatusStoryPicked"></div></div>
        <div class="dpc-field"><label class="dpc-label">Preview</label><div id="dpcStatusPreview" style="border-radius:12px;padding:26px 16px;text-align:center;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:${(STATUS_BGS.find(b=>b.id===_statusBg)||STATUS_BGS[0]).bg}"><div id="dpcStatusPreviewText" style="font-size:19px;font-weight:800;color:#fff;line-height:1.4;text-shadow:0 2px 12px rgba(0,0,0,.5)">&ldquo;Your words here&rdquo;</div><div id="dpcStatusPreviewCap" style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75)"></div></div></div>
        <div class="dpc-field"><label class="dpc-label">Photo (optional — overrides background)</label><input type="file" id="dpcStatusImageFile" accept="image/*" class="dpc-input"/><div id="dpcStatusImgPrev" class="dpc-image-preview"><img id="dpcStatusImgPrevImg" src="" data-noguard/><button type="button" class="dpc-image-x" id="dpcStatusImgClear" title="Remove photo">✕</button></div></div>
        <div class="dpc-hint">🟢 Goes straight to your story row — never the feed. Expires in 24h.</div>
      `;
    }
    el.innerHTML = h;
    bindBodyEvents();
    // prefill if editing
    if(_editingPost){
      if(_currentType==='text'){
        if(_editingPost.text) document.getElementById('dpcText').value = _editingPost.text;
        if(_editingPost.heading) document.getElementById('dpcHeading').value = _editingPost.heading;
        if(_editingPost.image){
          const pi=document.getElementById('dpcImgPrevImg'); const pv=document.getElementById('dpcImgPrev');
          if(pi && pv){ pi.src=_editingPost.image; pv.classList.add('has'); }
          const url=document.getElementById('dpcImageUrl'); if(url && _editingPost.image && !_editingPost.image.startsWith('data:')) url.value=_editingPost.image;
        }
        const cnt=document.getElementById('dpcCount'); const txt=document.getElementById('dpcText');
        if(cnt && txt) cnt.textContent=txt.value.length;
      } else if(_currentType==='poll' && _editingPost.poll){
        document.getElementById('dpcPollQ').value = _editingPost.poll.question||'';
        const wrap=document.getElementById('dpcPollOpts'); if(wrap){ wrap.innerHTML=''; (_editingPost.poll.opts||[]).forEach(o=>{ const row=document.createElement('div'); row.className='dpc-poll-opt'; row.innerHTML=`<input class="dpc-input" value="${esc(o.label)}"/><button type="button"><i class="fas fa-xmark"></i></button>`; const inp=row.querySelector('input'); const btn=row.querySelector('button'); inp.addEventListener('input', validate); btn.addEventListener('click', ()=>{ if(wrap.children.length>2){ row.remove(); validate(); } else { inp.value=''; validate(); } }); wrap.appendChild(row); }); if((_editingPost.poll.opts||[]).length<2){ for(let k=(_editingPost.poll.opts||[]).length;k<2;k++){ const row=document.createElement('div'); row.className='dpc-poll-opt'; row.innerHTML=`<input class="dpc-input" placeholder="Option ${wrap.children.length+1}"/><button type="button"><i class="fas fa-xmark"></i></button>`; const inp=row.querySelector('input'); const btn=row.querySelector('button'); inp.addEventListener('input', validate); btn.addEventListener('click', ()=>{ if(wrap.children.length>2){ row.remove(); validate(); } }); wrap.appendChild(row); } } }
        if(_editingPost.image){
          const pp=document.getElementById('dpcPollImgPrevImg'); const pv2=document.getElementById('dpcPollImgPrev');
          if(pp && pv2){ pp.src=_editingPost.image; pv2.classList.add('has'); }
          const u2=document.getElementById('dpcPollImageUrl'); if(u2 && _editingPost.image && !_editingPost.image.startsWith('data:')) u2.value=_editingPost.image;
        }
      } else if(_currentType==='debate' && _editingPost.debateData){
        document.getElementById('dpcDebateQ').value = _editingPost.debateData.question||'';
        document.getElementById('dpcDebatePrompt').value = _editingPost.debateData.prompt||'';
        document.getElementById('dpcFor').value = _editingPost.debateData.forText||'';
        document.getElementById('dpcAgainst').value = _editingPost.debateData.againstText||'';
      } else if(_currentType==='ama' && _editingPost.amaData){
        document.getElementById('dpcAmaTitle').value = _editingPost.amaData.title||'';
        document.getElementById('dpcAmaMeta').value = _editingPost.amaData.meta||'';
        document.getElementById('dpcAmaViewers').value = _editingPost.amaData.viewers||'';
      } else if(_currentType==='quote'){
        document.getElementById('dpcQuote').value = _editingPost.quote||'';
        document.getElementById('dpcCaption').value = _editingPost.caption||'';
        if(typeof updateQuotePreview==='function') updateQuotePreview();
      } else if(_currentType==='recommendation'){
        document.getElementById('dpcRecText').value = _editingPost.note||'';
        if(_editingPost.storyRef){
          _pickedStory = { id:_editingPost.storyRef.id, title:_editingPost.storyRef.title, author:_editingPost.storyRef.author||'', cover:_editingPost.storyRef.cover||'', cat:_editingPost.storyRef.cat||'' };
          document.getElementById('dpcRecStory').value = _editingPost.storyRef.title||'';
          renderPickedStory();
        }
      } else if(_currentType==='chapter-drop'){
        document.getElementById('dpcChText').value = _editingPost.text||'';
        if(_editingPost.chapterRef){
          _pickedChapter = { id:_editingPost.chapterRef.id, title:_editingPost.chapterRef.title, author:_editingPost.chapterRef.author||'', cover:_editingPost.chapterRef.cover||'', cat:_editingPost.chapterRef.cat||'' };
          document.getElementById('dpcChStory').value = _editingPost.chapterRef.title||'';
          renderPickedChapter();
        }
      }
    }
    validate();
  }

  function bindBodyEvents(){
    const text=document.getElementById('dpcText');
    if(text) text.addEventListener('input', ()=>{ validate(); saveDraft(); });
    const count=document.getElementById('dpcCount');
    if(text && count) text.addEventListener('input', ()=>{ count.textContent = text.value.length; });
    // status background picker (always defined — no network needed)
    const stGrid=document.getElementById('dpcStatusBgGrid');    const updateStatusPreview=()=>{
      const pv=document.getElementById('dpcStatusPreview');
      const tx=document.getElementById('dpcStatusText');
      const cp=document.getElementById('dpcStatusCaption');
      const ptx=document.getElementById('dpcStatusPreviewText');
      const pcp=document.getElementById('dpcStatusPreviewCap');
      const simg=document.getElementById('dpcStatusImgPrevImg');
      const sprev=document.getElementById('dpcStatusImgPrev');
      const hasImg = sprev && sprev.classList.contains('has') && simg && simg.src && (simg.src.startsWith('data:') || simg.src.startsWith('blob:'));
      /* Priority: uploaded photo > linked story cover > picked gradient. */
      const cover = (!_pickedStatusStory || hasImg) ? '' : (_pickedStatusStory.cover || '');
      if(pv){
        if(hasImg){ pv.style.background=''; pv.style.backgroundImage=`url("${simg.src}")`; pv.style.backgroundSize='cover'; pv.style.backgroundPosition='center'; }
        else if(cover){ pv.style.background=''; pv.style.backgroundImage=`url("${cover}")`; pv.style.backgroundSize='cover'; pv.style.backgroundPosition='center'; }
        else{ pv.style.backgroundImage=''; pv.style.background=(STATUS_BGS.find(b=>b.id===_statusBg)||STATUS_BGS[0]).bg; }
      }
      if(ptx) ptx.innerHTML = tx && tx.value.trim() ? '&ldquo;'+esc(tx.value.trim())+'&rdquo;' : '&ldquo;Your words here&rdquo;';
      if(pcp) pcp.textContent = cp ? cp.value.trim() : '';
    };
    _refreshStatusPreview = updateStatusPreview;
    if(stGrid) stGrid.querySelectorAll('[data-sbg]').forEach(el=>{
      el.addEventListener('click', ()=>{
        _statusBg=el.dataset.sbg;
        stGrid.querySelectorAll('[data-sbg]').forEach(x=>x.classList.toggle('on', x===el));
        updateStatusPreview();
        validate(); saveDraft();
      });
    });
    // image preview for text
    const file=document.getElementById('dpcImageFile');
    const urlInput=document.getElementById('dpcImageUrl');
    const prev=document.getElementById('dpcImgPrev');
    const prevImg=document.getElementById('dpcImgPrevImg');
    if(file && prev && prevImg){
      file.addEventListener('change', ()=>{
        const f=file.files[0];
        if(!f) return;
        const reader=new FileReader();
        reader.onload=e=>{ prevImg.src=e.target.result; prev.classList.add('has'); validate(); };
        reader.readAsDataURL(f);
      });
    }
    if(urlInput && prev && prevImg){
      urlInput.addEventListener('input', ()=>{
        const v=urlInput.value.trim();
        if(v){ prevImg.src=v; prev.classList.add('has'); } else { prev.classList.remove('has'); }
        validate();
      });
      urlInput.addEventListener('error', ()=> prev.classList.remove('has'));
    }
    // status text + caption + image preview (straight-to-story type, upload only)
    const stText=document.getElementById('dpcStatusText');
    if(stText){ stText.addEventListener('input', ()=>{ validate(); saveDraft(); if(typeof updateStatusPreview==='function') updateStatusPreview(); }); }
    const stCap=document.getElementById('dpcStatusCaption');
    if(stCap){ stCap.addEventListener('input', ()=>{ validate(); saveDraft(); if(typeof updateStatusPreview==='function') updateStatusPreview(); }); }
    const stFile=document.getElementById('dpcStatusImageFile');
    const stPrev=document.getElementById('dpcStatusImgPrev');
    const stPrevImg=document.getElementById('dpcStatusImgPrevImg');
    if(stFile && stPrev && stPrevImg){
      stFile.addEventListener('change', ()=>{
        const f=stFile.files[0];
        if(!f) return;
        const reader=new FileReader();
        reader.onload=e=>{ stPrevImg.src=e.target.result; stPrev.classList.add('has'); updateStatusPreview(); validate(); };
        reader.readAsDataURL(f);
      });
    }
    const stClear=document.getElementById('dpcStatusImgClear');
    if(stClear) stClear.addEventListener('click', ()=>{
      stFile.value='';
      stPrevImg.removeAttribute('src');
      stPrev.classList.remove('has');
      updateStatusPreview();
      validate();
    });
    // status story search (optional link — tappable chip in viewer)
    const stStory=document.getElementById('dpcStatusStory');
    const stHits=document.getElementById('dpcStatusStoryHits');
    function paintStatusHits(){
      if(!stStory || !stHits) return;
      const q = (stStory.value||'').trim().toLowerCase();
      const pool = storyPool();
      const hits = (!q ? pool.slice(0,6) : pool.filter(s => ((s.title||'').toLowerCase().indexOf(q)!==-1) || ((s.author||'').toLowerCase().indexOf(q)!==-1)).slice(0,6));
      stHits.innerHTML = hits.length ? hits.map((s,i)=>
        '<button type="button" class="dpc-story-hit" data-sithit="'+i+'">'+
        (s.cover?'<img src="'+esc(s.cover)+'" loading="lazy" alt=""/>':'')+
        '<div style="flex:1;min-width:0"><div class="dpc-story-hit-t">'+esc(s.title)+'</div><div class="dpc-story-hit-a">'+esc(s.author||'')+'</div></div></button>'
      ).join('') : '<div style="font-size:11.5px;color:var(--tx-muted,#666);padding:6px 2px">No stories match.</div>';
      stHits._hits = hits;
      stHits.querySelectorAll('[data-sithit]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var s = (stHits._hits||[])[+btn.dataset.sithit];
          if(!s) return;
          _pickedStatusStory = { id: s.id, title: s.title, author: s.author||'', cover: s.cover||'', cat: s.cat||s.genre||'' };
          stStory.value = s.title;
          stHits.innerHTML = '';
          renderPickedStatusStory();
          if(typeof _refreshStatusPreview === 'function') _refreshStatusPreview();
          saveDraft();
          validate();
        });
      });
    }
    if(stStory && stHits){
      stStory.addEventListener('input', function(){ paintStatusHits(); saveDraft(); });
      stStory.addEventListener('focus', function(){ paintStatusHits(); });
      stStory.addEventListener('click', function(){ if(!stHits.innerHTML) paintStatusHits(); });
    }
    // image preview for poll
    const pollFile=document.getElementById('dpcPollImageFile');
    const pollUrl=document.getElementById('dpcPollImageUrl');
    const pollPrev=document.getElementById('dpcPollImgPrev');
    const pollPrevImg=document.getElementById('dpcPollImgPrevImg');
    if(pollFile && pollPrev && pollPrevImg){
      pollFile.addEventListener('change', ()=>{
        const f=pollFile.files[0]; if(!f) return;
        const r=new FileReader(); r.onload=e=>{ pollPrevImg.src=e.target.result; pollPrev.classList.add('has'); validate(); }; r.readAsDataURL(f);
      });
    }
    if(pollUrl && pollPrev && pollPrevImg){
      pollUrl.addEventListener('input', ()=>{
        const v=pollUrl.value.trim();
        if(v){ pollPrevImg.src=v; pollPrev.classList.add('has'); } else { pollPrev.classList.remove('has'); }
        validate();
      });
    }
    // poll opts
    if(document.getElementById('dpcPollOpts')){
      const wrap=document.getElementById('dpcPollOpts');
      function addOpt(val){
        const row=document.createElement('div'); row.className='dpc-poll-opt';
        row.innerHTML=`<input class="dpc-input" placeholder="Option ${wrap.children.length+1}" value="${esc(val||'')}"/><button type="button"><i class="fas fa-xmark"></i></button>`;
        const inp=row.querySelector('input'); const btn=row.querySelector('button');
        inp.addEventListener('input', validate);
        btn.addEventListener('click', ()=>{ if(wrap.children.length>2){ row.remove(); validate(); } else { inp.value=''; validate(); } });
        wrap.appendChild(row);
      }
      addOpt(''); addOpt('');
      document.getElementById('dpcAddOpt').addEventListener('click', ()=>{
        if(wrap.children.length>=4){ toast('Max 4 options'); return; }
        addOpt(''); validate();
      });
      const q=document.getElementById('dpcPollQ');
      if(q) q.addEventListener('input', validate);
    }
    // debate
    ['dpcDebateQ','dpcFor','dpcAgainst','dpcDebatePrompt'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.addEventListener('input', validate);
    });
    // For/Against: hard 60-char cap (backend enforces later) + toast hint on attempt
    const SIDE_MAX = 60;
    ['dpcFor','dpcAgainst'].forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      el.addEventListener('keydown', e=>{
        if(e.key === 'Enter') return;
        const typing = (e.key.length === 1) && !e.ctrlKey && !e.metaKey && !e.altKey;
        if(!typing) return;
        const selLen = el.selectionEnd - el.selectionStart;
        if((el.value.length - selLen + 1) > SIDE_MAX){ e.preventDefault(); toast('Max ' + SIDE_MAX + ' characters'); }
      });
      el.addEventListener('paste', e=>{
        const pasted = (e.clipboardData && e.clipboardData.getData('')) || '';
        const selLen = el.selectionEnd - el.selectionStart;
        if((el.value.length - selLen + pasted.length) > SIDE_MAX){
          e.preventDefault(); toast('Max ' + SIDE_MAX + ' characters');
        }
      });
    });
    // ama
    ['dpcAmaTitle','dpcAmaMeta'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', validate); });
    // quote
    function updateQuotePreview(){
      const q=document.getElementById('dpcQuote');
      const c=document.getElementById('dpcCaption');
      const pt=document.getElementById('dpcQuotePreviewText');
      const pc=document.getElementById('dpcQuotePreviewCaption');
      const pv=document.getElementById('dpcQuotePreview');
      const mark=pv ? pv.querySelector('.pcc-quote-mark') : null;
      if(pt){
        const raw = q && q.value.trim() ? q.value.trim() : 'Your quote will appear here';
        const escText = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        pt.innerHTML = `&ldquo;${escText}&rdquo;`;
        pt.style.whiteSpace='pre-wrap';
      }
      if(pc) pc.textContent = c && c.value.trim() ? c.value.trim() : '— Source';
      if(pv){
        const bg=QUOTE_BGS.find(b=>b.id===_quoteBg);
        if(bg) pv.style.background=bg.bg;
        const isDark = _quoteBg === 'dark';
        if(pt) pt.style.color = isDark ? '#ffffff' : '';
        if(pc) pc.style.color = isDark ? 'rgba(255,255,255,.7)' : '';
        if(mark) mark.style.color = isDark ? 'rgba(255,255,255,.35)' : '';
        pv.style.color = isDark ? '#fff' : '';
      }
    }
    ['dpcQuote','dpcCaption'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', ()=>{ validate(); updateQuotePreview(); }); });
    const qbgGrid=document.getElementById('dpcQbgGrid');
    if(qbgGrid){
      qbgGrid.querySelectorAll('.dpc-qbg').forEach(el=>{
        el.addEventListener('click', ()=>{
          qbgGrid.querySelectorAll('.dpc-qbg').forEach(x=>x.classList.remove('on'));
          el.classList.add('on'); _quoteBg=el.dataset.bg; validate(); updateQuotePreview();
        });
      });
    }
    // recommendation story picker — tap or type to see stories
    const recStory = document.getElementById('dpcRecStory');
    const recHits = document.getElementById('dpcRecStoryHits');
    const recText = document.getElementById('dpcRecText');
    if(recText) recText.addEventListener('input', ()=>{ validate(); saveDraft(); });
    function paintRecHits(){
      if(!recStory || !recHits) return;
      const q = (recStory.value||'').trim().toLowerCase();
      const pool = storyPool();
      const hits = (!q ? pool.slice(0,6) : pool.filter(s => ((s.title||'').toLowerCase().indexOf(q)!==-1) || ((s.author||'').toLowerCase().indexOf(q)!==-1)).slice(0,6));
      recHits.innerHTML = hits.length ? hits.map((s,i)=>
        '<button type="button" class="dpc-story-hit" data-rhit="'+i+'">'+
        (s.cover?'<img src="'+esc(s.cover)+'" loading="lazy" alt=""/>':'')+
        '<div style="flex:1;min-width:0"><div class="dpc-story-hit-t">'+esc(s.title)+'</div><div class="dpc-story-hit-a">'+esc(s.author||'')+'</div></div></button>'
      ).join('') : '<div style="font-size:11.5px;color:var(--tx-muted,#666);padding:6px 2px">No stories match.</div>';
      recHits._hits = hits;
      recHits.querySelectorAll('[data-rhit]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var s = (recHits._hits||[])[+btn.dataset.rhit];
          if(!s) return;
          var allowed = true;
          if(window.ReadingHistory && typeof ReadingHistory.meetsBar === 'function'){
            allowed = ReadingHistory.meetsBar(s.id);
          }
          _pickedStory = { id: s.id, title: s.title, author: s.author||'', cover: s.cover||'', cat: s.cat||s.genre||'', blocked: !allowed };
          recStory.value = s.title;
          recHits.innerHTML = '';
          renderPickedStory();
          saveDraft();
          if(!allowed){
            var msg = '📖 Read at least up to 3 chapters of a story to recommend the story';
            if(s.title) msg += ' — keep reading "' + s.title + '"';
            toast(msg);
          }
          validate();
        });
      });
    }
    if(recStory && recHits){
      recStory.addEventListener('input', function(){ paintRecHits(); saveDraft(); });
      recStory.addEventListener('focus', function(){ paintRecHits(); });
      recStory.addEventListener('click', function(){ if(!recHits.innerHTML) paintRecHits(); });
    }
    // chapter-drop story picker — tap or type to see stories (no reading gate)
    const chStory = document.getElementById('dpcChStory');
    const chHits = document.getElementById('dpcChStoryHits');
    const chText = document.getElementById('dpcChText');
    if(chText) chText.addEventListener('input', ()=>{ validate(); saveDraft(); });
    function paintChHits(){
      if(!chStory || !chHits) return;
      const q = (chStory.value||'').trim().toLowerCase();
      const pool = storyPool();
      const hits = (!q ? pool.slice(0,6) : pool.filter(s => ((s.title||'').toLowerCase().indexOf(q)!==-1) || ((s.author||'').toLowerCase().indexOf(q)!==-1)).slice(0,6));
      chHits.innerHTML = hits.length ? hits.map((s,i)=>
        '<button type="button" class="dpc-story-hit" data-chit="'+i+'">'+
        (s.cover?'<img src="'+esc(s.cover)+'" loading="lazy" alt=""/>':'')+
        '<div style="flex:1;min-width:0"><div class="dpc-story-hit-t">'+esc(s.title)+'</div><div class="dpc-story-hit-a">'+esc(s.author||'')+'</div></div></button>'
      ).join('') : '<div style="font-size:11.5px;color:var(--tx-muted,#666);padding:6px 2px">No stories match.</div>';
      chHits._hits = hits;
      chHits.querySelectorAll('[data-chit]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var s = (chHits._hits||[])[+btn.dataset.chit];
          if(!s) return;
          _pickedChapter = { id: s.id, title: s.title, author: s.author||'', cover: s.cover||'', cat: s.cat||s.genre||'' };
          chStory.value = s.title;
          chHits.innerHTML = '';
          renderPickedChapter();
          saveDraft();
          validate();
        });
      });
    }
    if(chStory && chHits){
      chStory.addEventListener('input', function(){ paintChHits(); saveDraft(); });
      chStory.addEventListener('focus', function(){ paintChHits(); });
      chStory.addEventListener('click', function(){ if(!chHits.innerHTML) paintChHits(); });
    }
    // persist every other field too, so leaving mid-post never loses text
    ['dpcHeading','dpcImageUrl','dpcPollQ','dpcPollImageUrl','dpcDebateQ','dpcDebatePrompt','dpcFor','dpcAgainst','dpcAmaTitle','dpcAmaMeta','dpcAmaViewers','dpcQuote','dpcCaption','dpcChText'].forEach(function(id){
      const el=document.getElementById(id); if(el) el.addEventListener('input', function(){ validate(); saveDraft(); });
    });
    try {
      document.querySelectorAll('#dpcPollOpts input').forEach(function(inp){ inp.addEventListener('input', function(){ saveDraft(); }); });
    } catch(e){}
    // init preview
    updateQuotePreview();
    const head=document.getElementById('dpcHeading');
    if(head) head.addEventListener('input', validate);
  }

  function renderPickedStory(){
    const box = document.getElementById('dpcRecStoryPicked');
    if(!box) return;
    if(!_pickedStory){ box.innerHTML=''; return; }
    var blocked = !!_pickedStory.blocked;
    box.innerHTML = '<div class="dpc-story-picked'+(blocked?' dpc-story-blocked':'')+'">'+
      (_pickedStory.cover?'<img src="'+esc(_pickedStory.cover)+'" alt=""/>':'')+
      '<div style="flex:1;min-width:0"><div class="dpc-story-picked-t">'+esc(_pickedStory.title)+'</div><div class="dpc-story-picked-a">'+esc(_pickedStory.author||'')+'</div>'+
      (blocked?'<div class="dpc-story-blocked-msg">📖 Read at least 3 chapters + 12 min on this story to recommend it</div>':'')+
      '</div>'+
      '<button class="dpc-story-picked-x" type="button" title="Remove"><i class="fas fa-xmark"></i></button></div>';
    box.querySelector('.dpc-story-picked-x').addEventListener('click', function(){
      _pickedStory = null;
      const inp = document.getElementById('dpcRecStory');
      if(inp) inp.value = '';
      renderPickedStory();
      validate();
    });
  }

  function renderPickedChapter(){
    const box = document.getElementById('dpcChStoryPicked');
    if(!box) return;
    if(!_pickedChapter){ box.innerHTML=''; return; }
    box.innerHTML = '<div class="dpc-story-picked">'+
      (_pickedChapter.cover?'<img src="'+esc(_pickedChapter.cover)+'" alt=""/>':'')+
      '<div style="flex:1;min-width:0"><div class="dpc-story-picked-t">'+esc(_pickedChapter.title)+'</div><div class="dpc-story-picked-a">'+esc(_pickedChapter.author||'')+'</div></div>'+
      '<button class="dpc-story-picked-x" type="button" title="Remove"><i class="fas fa-xmark"></i></button></div>';
    box.querySelector('.dpc-story-picked-x').addEventListener('click', function(){
      _pickedChapter = null;
      const inp = document.getElementById('dpcChStory');
      if(inp) inp.value = '';
      renderPickedChapter();
      validate();
    });
  }

  function renderPickedStatusStory(){
    const box = document.getElementById('dpcStatusStoryPicked');
    if(!box) return;
    if(!_pickedStatusStory){ box.innerHTML=''; return; }
    box.innerHTML = '<div class="dpc-story-picked">'+
      (_pickedStatusStory.cover?'<img src="'+esc(_pickedStatusStory.cover)+'" alt=""/>':'')+
      '<div style="flex:1;min-width:0"><div class="dpc-story-picked-t">'+esc(_pickedStatusStory.title)+'</div><div class="dpc-story-picked-a">'+esc(_pickedStatusStory.author||'')+'</div></div>'+
      '<button class="dpc-story-picked-x" type="button" title="Remove"><i class="fas fa-xmark"></i></button></div>';
    box.querySelector('.dpc-story-picked-x').addEventListener('click', function(){
      _pickedStatusStory = null;
      const inp = document.getElementById('dpcStatusStory');
      if(inp) inp.value = '';
      renderPickedStatusStory();
      saveDraft();
      validate();
      if(typeof _refreshStatusPreview === 'function') _refreshStatusPreview();
    });
  }

  function validate(){
    const btn=document.getElementById('dpcPost');
    if(!btn) return;
    let ok=false;
    if(_currentType==='text'){
      const t=document.getElementById('dpcText');
      const hasText = t && t.value.trim().length>=2;
      const hasFile = document.getElementById('dpcImageFile') && document.getElementById('dpcImageFile').files.length>0;
      const hasUrl = document.getElementById('dpcImageUrl') && document.getElementById('dpcImageUrl').value.trim().length>5;
      ok = hasText || hasFile || hasUrl;
    } else if(_currentType==='poll'){
      const q=document.getElementById('dpcPollQ');
      const opts=[...document.querySelectorAll('#dpcPollOpts input')].map(i=>i.value.trim()).filter(Boolean);
      ok = q && q.value.trim().length>=5 && opts.length>=2;
    } else if(_currentType==='debate'){
      const q=document.getElementById('dpcDebateQ');
      const f=document.getElementById('dpcFor');
      const a=document.getElementById('dpcAgainst');
      ok = q && q.value.trim().length>=5 && f && f.value.trim() && a && a.value.trim();
    } else if(_currentType==='ama'){
      const t=document.getElementById('dpcAmaTitle');
      ok = t && t.value.trim().length>=4;
    } else if(_currentType==='quote'){
      const q=document.getElementById('dpcQuote');
      ok = q && q.value.trim().length>=6;
    } else if(_currentType==='recommendation'){
      const t=document.getElementById('dpcRecText');
      ok = t && t.value.trim().length>=4 && !!_pickedStory && !_pickedStory.blocked;
    } else if(_currentType==='chapter-drop'){
      ok = !!_pickedChapter;
    } else if(_currentType==='status'){
      const t=document.getElementById('dpcStatusText');
      const hasText = t && t.value.trim().length>=2;
      const hasFile = document.getElementById('dpcStatusImageFile') && document.getElementById('dpcStatusImageFile').files.length>0;
      ok = hasText || hasFile;
    }
    btn.classList.toggle('on', ok);
  }

  function buildPost(){
    const av = (_hooks.getUser && _hooks.getUser().avatar) || (window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5';
    const name = (_hooks.getUser && _hooks.getUser().name) || 'You';
    const isEdit = !!_editingPost;
    const base = isEdit ? {..._editingPost, name: _editingPost.name||name, avatar: _editingPost.avatar||av, time: _editingPost.time||'Just now' } : { id:'p_'+Date.now(), name, avatar:av, time:'Just now', likes:0, liked:false, comments:0, saved:false, mine:true };
    if(_currentType==='text'){
      const text=document.getElementById('dpcText').value.trim();
      const heading=document.getElementById('dpcHeading').value.trim();
      let image='';
      const prevImg=document.getElementById('dpcImgPrevImg');
      const prevWrap=document.getElementById('dpcImgPrev');
      const urlInput=document.getElementById('dpcImageUrl');
      const file=document.getElementById('dpcImageFile');
      const prevHas = prevWrap && prevWrap.classList.contains('has');
      if(prevHas && prevImg && prevImg.src && prevImg.src.startsWith('data:')) image=prevImg.src;
      else if(urlInput && urlInput.value.trim()) image=urlInput.value.trim();
      else if(file && file.files[0]) image=URL.createObjectURL(file.files[0]);
      const post={...base, type:'post', text, heading: heading||undefined };
      if(image) post.image=image;
      return post;
    }
    if(_currentType==='poll'){
      const q=document.getElementById('dpcPollQ').value.trim();
      const opts=[...document.querySelectorAll('#dpcPollOpts input')].map(i=>i.value.trim()).filter(Boolean).map(label=>({label, v:0}));
      let image='';
      const pollPrevImg=document.getElementById('dpcPollImgPrevImg');
      const pollPrevWrap=document.getElementById('dpcPollImgPrev');
      const pollUrl=document.getElementById('dpcPollImageUrl');
      const pollFile=document.getElementById('dpcPollImageFile');
      const pollPrevHas = pollPrevWrap && pollPrevWrap.classList.contains('has');
      if(pollPrevHas && pollPrevImg && pollPrevImg.src && pollPrevImg.src.startsWith('data:')) image=pollPrevImg.src;
      else if(pollUrl && pollUrl.value.trim()) image=pollUrl.value.trim();
      else if(pollFile && pollFile.files[0]) image=URL.createObjectURL(pollFile.files[0]);
      const post={...base, type:'poll', poll:{ question:q, opts, total:0, voted:-1 }};
      if(image) post.image=image;
      return post;
    }
    if(_currentType==='debate'){
      const q=document.getElementById('dpcDebateQ').value.trim();
      const prompt=document.getElementById('dpcDebatePrompt').value.trim();
      const f=document.getElementById('dpcFor').value.trim();
      const a=document.getElementById('dpcAgainst').value.trim();
      return {...base, type:'debate', debateData:{ question:q, prompt, forText:f, againstText:a, forV:0, agV:0, userVote:null }};
    }
    if(_currentType==='ama'){
      const title=document.getElementById('dpcAmaTitle').value.trim();
      const meta=document.getElementById('dpcAmaMeta').value.trim();
      const viewers=parseInt(document.getElementById('dpcAmaViewers').value,10)||Math.floor(Math.random()*200+20);
      return {...base, type:'ama', amaData:{ isLive:true, viewers, title, meta: meta||'Ask me anything' }};
    }
    if(_currentType==='quote'){
      const quote=document.getElementById('dpcQuote').value.trim();
      const caption=document.getElementById('dpcCaption').value.trim();
      const bg=QUOTE_BGS.find(b=>b.id===_quoteBg) || QUOTE_BGS[0];
      return {...base, type:'quote', quote, caption, quoteBg: _quoteBg, quoteBgCss: bg.bg };
    }
    if(_currentType==='recommendation'){
      if(!_pickedStory){ toast('Pick a story to recommend'); return null; }
      if(_pickedStory.blocked){
        let msg='📖 Read at least up to 3 chapters of a story to recommend the story';
        if(_pickedStory.title) msg+=' — keep reading "'+_pickedStory.title+'"';
        toast(msg);
        return null;
      }
      if(window.ReadingHistory && typeof ReadingHistory.guardRecommend==='function'){
        if(!ReadingHistory.guardRecommend(_pickedStory.id, _pickedStory.title)) return null;
      }
      const recText=document.getElementById('dpcRecText').value.trim();
      if(recText.length<4){ toast('Tell us why you recommend it'); return null; }
      return {...base, type:'recommendation', note: recText, storyRef:{ id:_pickedStory.id, title:_pickedStory.title, author:_pickedStory.author, cover:_pickedStory.cover, cat:_pickedStory.cat||'Recommended read' }};
    }
    if(_currentType==='chapter-drop'){
      if(!_pickedChapter){ toast('Pick the story for this chapter drop'); return null; }
      const chText=document.getElementById('dpcChText').value.trim();
      return {...base, type:'chapter-drop', text: chText, chapterRef:{ id:_pickedChapter.id, title:_pickedChapter.title, author:_pickedChapter.author, cover:_pickedChapter.cover, ch:'New chapter', cat:_pickedChapter.cat||'' }};
    }
    if(_currentType==='status'){
      const text=document.getElementById('dpcStatusText').value.trim();
      const caption=document.getElementById('dpcStatusCaption').value.trim();
      let image='';
      const sPrevImg=document.getElementById('dpcStatusImgPrevImg');
      const sPrevWrap=document.getElementById('dpcStatusImgPrev');
      const sFile=document.getElementById('dpcStatusImageFile');
      const sPrevHas = sPrevWrap && sPrevWrap.classList.contains('has');
      if(sPrevHas && sPrevImg && sPrevImg.src && sPrevImg.src.startsWith('data:')) image=sPrevImg.src;
      else if(sFile && sFile.files[0]) image=URL.createObjectURL(sFile.files[0]);
      /* No upload → linked story cover → picked gradient (always defined). */
      if(!image && _pickedStatusStory && _pickedStatusStory.cover) image=_pickedStatusStory.cover;
      if(!image) image=(STATUS_BGS.find(b=>b.id===_statusBg) || STATUS_BGS[0]).bg;
      const out = {...base, type:'status', statusSlide:{ bg:image, quote: text ? '"'+text+'"' : '', caption: caption||'' }};
      if(_pickedStatusStory) out.statusSlide.storyRef = { id:_pickedStatusStory.id, title:_pickedStatusStory.title, author:_pickedStatusStory.author||'', cover:_pickedStatusStory.cover||'' };
      return out;
    }
    return null;
  }

  function bindStatic(){
    document.getElementById('dpcCancel').addEventListener('click', close);
    document.getElementById('dpcPost').addEventListener('click', submit);
    document.getElementById('dpcOv').addEventListener('click', e=>{ if(e.target.id==='dpcOv') close(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.getElementById('dpcOv').classList.contains('open')) close(); });
  }

  function submit(){
    const post=buildPost();
    if(!post){ toast('Fill required fields'); return; }
    const isEdit = !!_editingPost;
    clearDraft();
    /* Status type bypasses the feed — straight to the story row. */
    if(post.type==='status' && !isEdit){
      if(typeof _hooks.onStatusSlide === 'function'){
        _hooks.onStatusSlide(post.statusSlide);
      } else if(window.DroboardStatus){
        try { window.DroboardStatus.post(post.statusSlide); } catch (e) {}
        toast('🟢 Status posted to your story!');
      } else {
        toast('Status service missing');
      }
      close();
      return;
    }
    if(typeof _hooks.onSubmit === 'function'){
      _hooks.onSubmit(post, isEdit);
    } else {
      if(window.FeedData && window.DroboardPostCard && document.getElementById('feedList')){
        if(window.FeedPage && window.FeedPage._pushPost) window.FeedPage._pushPost(post, isEdit);
        else toast(isEdit ? '✅ Post updated!' : 'Posted! (demo)');
      } else {
        toast(isEdit ? '✅ Post updated (demo)' : '✅ Post created (demo)');
      }
    }
    close();
  }

  function open(typeOrOpts){
    inject();
    try{ const t=localStorage.getItem('droboardTheme')||'light'; document.documentElement.setAttribute('data-theme', t); }catch(e){}
    let type = typeOrOpts;
    if(typeOrOpts && typeof typeOrOpts === 'object'){
      if(typeOrOpts.editPost){
        _editingPost = typeOrOpts.editPost;
        _draftKey = '';
        _pickedStory = null; _pickedChapter = null; _pickedStatusStory = null;
        const pt = _editingPost.type;
        if(pt==='post' || pt==='text') _currentType='text';
        else if(pt==='poll') _currentType='poll';
        else if(pt==='debate') _currentType='debate';
        else if(pt==='ama') _currentType='ama';
        else if(pt==='quote') _currentType='quote';
        else if(TYPES.some(t=>t.id===pt)) _currentType=pt;
        else _currentType='text';
        if(typeOrOpts.onSubmit) _hooks.onSubmit = typeOrOpts.onSubmit;
        if(typeOrOpts.author) _hooks.getUser = () => typeOrOpts.author;
      } else {
        _editingPost=null;
        _pickedStory = null; _pickedChapter = null; _pickedStatusStory = null;
        _draftKey = typeOrOpts.draftKey || _draftKey || '';
        const alias = (t) => (t === 'post' ? 'text' : t);
        if(typeOrOpts.defaultType && TYPES.some(t=>t.id===alias(typeOrOpts.defaultType))) _currentType = alias(typeOrOpts.defaultType);
        else if(typeOrOpts.type && TYPES.some(t=>t.id===alias(typeOrOpts.type))) _currentType = alias(typeOrOpts.type);
        else if(_draftKey && !typeOrOpts.defaultType && !typeOrOpts.type) { /* keep restored type below */ }
        if(typeOrOpts.author) _hooks.getUser = () => typeOrOpts.author;
        if(typeOrOpts.onSubmit) _hooks.onSubmit = typeOrOpts.onSubmit;
        if(typeOrOpts.stories) _hooks.stories = typeOrOpts.stories;
        if(_draftKey && !typeOrOpts.defaultType && !typeOrOpts.type) restoreDraft();
      }
      type = _currentType;
    } else if(type && TYPES.some(t=>t.id===type)){
      _editingPost=null;
      _pickedStory = null; _pickedChapter = null; _pickedStatusStory = null;
      _currentType=type;
    } else if(typeof typeOrOpts === 'string' && TYPES.some(t=>t.id===typeOrOpts)){
      _editingPost=null;
      _pickedStory = null; _pickedChapter = null; _pickedStatusStory = null;
      _currentType=typeOrOpts;
    }
    renderTypes(); renderBody();
    if(!_editingPost) applyDraft();
    document.getElementById('dpcOv').classList.add('open');
    document.body.style.overflow='hidden';
    const isEdit = !!_editingPost;
    const titleMap={text: isEdit?'Edit post':'New post', status: 'New status', poll: isEdit?'Edit poll':'New poll', debate: isEdit?'Edit debate':'New debate', ama: isEdit?'Edit AMA':'New AMA', quote: isEdit?'Edit quote':'New quote', recommendation: isEdit?'Edit recommendation':'New recommendation', 'chapter-drop': isEdit?'Edit chapter drop':'New chapter drop'};
    document.getElementById('dpcTitle').textContent=titleMap[_currentType]|| (isEdit?'Edit post':'New post');
    document.getElementById('dpcPost').textContent = isEdit ? 'Save' : 'Post';
  }
  function close(){
    if(!_editingPost && _draftKey) saveDraft();
    const ov=document.getElementById('dpcOv');
    if(ov) ov.classList.remove('open');
    document.body.style.overflow='';
    _editingPost=null;
  }
  function edit(post, hooks){
    if(hooks) _hooks = Object.assign({}, _hooks, hooks);
    open({editPost: post});
  }
  function attach(root, hooks){
    _hooks = hooks||{};
    if(_hooks.draftKey) _draftKey = _hooks.draftKey;
    inject();
  }

  window.DroboardPostComposer = { attach, open, close, TYPES };
  window.openPostComposer = open;
  window.closePostComposer = close;
})();
