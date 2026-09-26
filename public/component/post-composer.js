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
    .dpc-image-preview{width:100%;max-height:220px;border-radius:10px;overflow:hidden;margin-top:8px;background:var(--l1,#f8f9fa);display:none}
    .dpc-image-preview.has{display:block}
    .dpc-image-preview img{width:100%;max-height:220px;object-fit:cover;display:block}
    .dpc-debate-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .dpc-qbg-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .dpc-qbg{width:44px;height:44px;border-radius:10px;border:2px solid transparent;cursor:pointer;flex-shrink:0;position:relative}
    .dpc-qbg.on{border-color:var(--acc,#ff0050);box-shadow:0 0 0 2px var(--acc-light,rgba(255,0,80,.15))}
    .dpc-qbg:active{transform:scale(.96)}
    .dpc-qbg-check{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#fff;font-size:14px;background:rgba(0,0,0,.2);border-radius:8px}
    .dpc-qbg.on .dpc-qbg-check{display:flex}
    .dpc-toast{position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:500;z-index:2000;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
    .dpc-toast.show{opacity:1}
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
    { id:'poll', label:'Poll', icon:'fa-chart-bar' },
    { id:'debate', label:'Debate', icon:'fa-fire' },
    { id:'ama', label:'AMA', icon:'fa-microphone' },
    { id:'quote', label:'Quote', icon:'fa-quote-right' },
  ];

  let _hooks = {};
  let _currentType = 'text';
  let _editingPost = null;
  let _built = false;

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

  function renderBody(){
    const el=document.getElementById('dpcBody');
    if(!el) return;
    if(_editingPost && _editingPost.type==='quote' && _editingPost.quoteBg) _quoteBg = _editingPost.quoteBg;
    let h='';
    if(_currentType==='text'){
      h = `
        <div class="dpc-field"><label class="dpc-label">What's on your mind?</label><textarea id="dpcText" class="dpc-textarea large" placeholder="Share your thoughts…"></textarea><div class="dpc-hint"><span id="dpcCount">0</span>/500</div></div>
        <div class="dpc-field"><label class="dpc-label">Heading (optional)</label><input id="dpcHeading" class="dpc-input" placeholder="Add a heading"/></div>
        <div class="dpc-field"><label class="dpc-label">Add image (optional)</label><input type="file" id="dpcImageFile" accept="image/*" class="dpc-input"/><div class="dpc-hint">or paste image URL below</div><input id="dpcImageUrl" class="dpc-input" style="margin-top:8px" placeholder="https://..."/><div id="dpcImgPrev" class="dpc-image-preview"><img id="dpcImgPrevImg" src=""/></div></div>
      `;
    } else if(_currentType==='poll'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Poll question</label><textarea id="dpcPollQ" class="dpc-textarea" placeholder="Ask a question…"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Options (2-4)</label><div id="dpcPollOpts"></div><button class="dpc-add-opt" id="dpcAddOpt">+ Add option</button></div>
        <div class="dpc-field"><label class="dpc-label">Add image to poll (optional)</label><input type="file" id="dpcPollImageFile" accept="image/*" class="dpc-input"/><div class="dpc-hint">or paste image URL</div><input id="dpcPollImageUrl" class="dpc-input" style="margin-top:8px" placeholder="https://..."/><div id="dpcPollImgPrev" class="dpc-image-preview"><img id="dpcPollImgPrevImg" src=""/></div></div>
      `;
    } else if(_currentType==='debate'){
      h = `
        <div class="dpc-field"><label class="dpc-label">Debate question</label><textarea id="dpcDebateQ" class="dpc-textarea" placeholder="Should villains get redemption?"></textarea></div>
        <div class="dpc-field"><label class="dpc-label">Context (optional)</label><input id="dpcDebatePrompt" class="dpc-input" placeholder="Share your thoughts…"/></div>
        <div class="dpc-debate-row">
          <div class="dpc-field"><label class="dpc-label">For</label><input id="dpcFor" class="dpc-input" placeholder="Yes, everyone deserves…"/></div>
          <div class="dpc-field"><label class="dpc-label">Against</label><input id="dpcAgainst" class="dpc-input" placeholder="No, some actions…"/></div>
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
      }
    }
    validate();
  }

  function bindBodyEvents(){
    const text=document.getElementById('dpcText');
    if(text) text.addEventListener('input', validate);
    const count=document.getElementById('dpcCount');
    if(text && count) text.addEventListener('input', ()=>{ count.textContent = text.value.length; });
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
    // init preview
    updateQuotePreview();
    const head=document.getElementById('dpcHeading');
    if(head) head.addEventListener('input', validate);
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
      const urlInput=document.getElementById('dpcImageUrl');
      const file=document.getElementById('dpcImageFile');
      if(prevImg && prevImg.src && prevImg.src.startsWith('data:')) image=prevImg.src;
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
      const pollUrl=document.getElementById('dpcPollImageUrl');
      const pollFile=document.getElementById('dpcPollImageFile');
      if(pollPrevImg && pollPrevImg.src && pollPrevImg.src.startsWith('data:')) image=pollPrevImg.src;
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
        if(typeOrOpts.defaultType && TYPES.some(t=>t.id===typeOrOpts.defaultType)) _currentType = typeOrOpts.defaultType;
        else if(typeOrOpts.type && TYPES.some(t=>t.id===typeOrOpts.type)) _currentType = typeOrOpts.type;
        if(typeOrOpts.author) _hooks.getUser = () => typeOrOpts.author;
        if(typeOrOpts.onSubmit) _hooks.onSubmit = typeOrOpts.onSubmit;
        if(typeOrOpts.stories) _hooks.stories = typeOrOpts.stories;
      }
      type = _currentType;
    } else if(type && TYPES.some(t=>t.id===type)){
      _editingPost=null;
      _currentType=type;
    } else if(typeof typeOrOpts === 'string' && TYPES.some(t=>t.id===typeOrOpts)){
      _editingPost=null;
      _currentType=typeOrOpts;
    }
    renderTypes(); renderBody();
    document.getElementById('dpcOv').classList.add('open');
    document.body.style.overflow='hidden';
    const isEdit = !!_editingPost;
    const titleMap={text: isEdit?'Edit post':'New post', poll: isEdit?'Edit poll':'New poll', debate: isEdit?'Edit debate':'New debate', ama: isEdit?'Edit AMA':'New AMA', quote: isEdit?'Edit quote':'New quote'};
    document.getElementById('dpcTitle').textContent=titleMap[_currentType]|| (isEdit?'Edit post':'New post');
    document.getElementById('dpcPost').textContent = isEdit ? 'Save' : 'Post';
  }
  function close(){
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
    inject();
  }

  window.DroboardPostComposer = { attach, open, close, TYPES };
  window.openPostComposer = open;
  window.closePostComposer = close;
})();
