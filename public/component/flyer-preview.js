/**
 * flyer-preview.js — Live flyer preview renderer (Marketing owns the system)
 * Vars can be filled via: typing, file upload (author photo / cover / user photo),
 * searchable story dropdown (autofills title/cover/author/genre/hook/link).
 * CTA always carries the author's inserted link (+ optional Store link).
 * Every template now ships a premium header, polished hero treatment,
 * and a Share + Download bar baked into the design.
 */
(function(global){
'use strict';
if(global.FlyerPreview) return;

var CSS = ''
  + '.fp-backdrop{position:fixed;inset:0;background:rgba(10,6,25,.58);z-index:2100;opacity:0;pointer-events:none;transition:opacity .22s} .fp-backdrop.open{opacity:1;pointer-events:auto}'
  + '.fp-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);z-index:2110;background:var(--card);border-radius:16px;width:min(940px,calc(100vw - 24px));max-height:min(88vh,820px);display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.35);opacity:0;transition:.22s}'
  + '.fp-backdrop.open .fp-modal{transform:translate(-50%,-50%) scale(1);opacity:1}'
  + '.fp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0}'
  + '.fp-head b{font-size:13.5px;font-weight:800}'
  + '.fp-head-actions{display:flex;gap:8px}'
  + '.fp-head-actions button{padding:7px 12px;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text)}'
  + '.fp-head-actions .fp-primary{background:var(--accent);border-color:transparent;color:#fff}'
  + '.fp-body{display:grid;grid-template-columns:1fr 1fr;gap:0;flex:1;min-height:0;overflow:hidden}'
  + '.fp-form{padding:16px;overflow-y:auto;border-right:1px solid var(--border)}'
  + '.fp-preview-wrap{padding:16px;overflow-y:auto;background:#f4f4fb;display:flex;flex-direction:column;align-items:center;gap:10px}'
  + '.fp-preview-label{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}'
  + '.fp-canvas{width:100%;max-width:360px;border-radius:14px;overflow:hidden;background:#0f0f22;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.18);font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}'
  + '.fp-canvas.v9{aspect-ratio:9/16;max-height:560px} .fp-canvas.sq{aspect-ratio:1/1;max-width:380px}'
  + '.fp-canvas-img{width:100%;object-fit:cover;display:block;flex-shrink:0}'
  + '.fp-canvas-body{padding:12px 14px 12px;flex:1;min-height:0;display:flex;flex-direction:column}'
  + '.fp-canvas-kicker{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ff9db8;margin-bottom:4px}'
  + '.fp-canvas-title{font-size:16px;font-weight:800;line-height:1.18;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
  + '.fp-canvas-author{font-size:10.5px;color:rgba(255,255,255,.65);margin-bottom:8px}'
  + '.fp-canvas-hook{font-size:11px;line-height:1.45;color:rgba(255,255,255,.84);background:rgba(255,255,255,.08);border-left:3px solid var(--accent);padding:8px 10px;border-radius:6px;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
  + '.fp-canvas-cta{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;background:var(--accent);color:#fff;font-size:11px;font-weight:800;align-self:flex-start;text-decoration:none}'
  + '.fp-canvas-link-row{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);flex-wrap:wrap}'
  + '.fp-link-pill.store{background:var(--accent);border-color:var(--accent);color:#fff;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid var(--accent);font-size:9px;font-weight:700}'
  + '.fp-author-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}'
  + '.fp-author-row img{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0}'
  + '@media(max-width:700px){.fp-body{grid-template-columns:1fr} .fp-form{border-right:none;border-bottom:1px solid var(--border)} .fp-modal{max-height:92vh}}'
  + '.fp-field{margin-bottom:12px} .fp-field label{display:block;font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}'
  + '.fp-field input:not([type=file]),.fp-field textarea,.fp-field select{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none}'
  + '.fp-field textarea{min-height:56px;resize:vertical;line-height:1.5}'
  + '.fp-field input:focus,.fp-field textarea:focus,.fp-field select:focus{border-color:var(--accent)}'
  + '.fp-file-row{display:flex;gap:8px;align-items:center;margin-top:6px}'
  + '.fp-file-row input[type=file]{flex:1;font-size:11px}'
  + '.fp-file-row .fp-file-btn{font-size:10.5px;font-weight:700;padding:6px 10px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);cursor:pointer;white-space:nowrap}'
  + '.fp-story-search{position:relative}'
  + '.fp-dropdown{position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:180px;overflow-y:auto;display:none;margin-top:4px}'
  + '.fp-opt{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;transition:.1s}'
  + '.fp-opt:hover{background:var(--hover)} .fp-opt img{width:32px;height:44px;border-radius:4px;object-fit:cover;flex-shrink:0} .fp-opt .t{font-size:11.5px;font-weight:700} .fp-opt .g{font-size:9.5px;color:var(--text-faint)}';

// ── Block engine UI: hover outline + × to remove, layout list to reorder ──
var CSS_BLOCK = ''
  + '[data-fp-block]{position:relative}'
  + '[data-fp-block]:hover{outline:1px dashed rgba(255,45,85,.75);outline-offset:-1px}'
  + '.fp-canvas.fp-capturing [data-fp-block]{outline:none}'
  + '.fp-x{position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;background:rgba(10,10,20,.75);color:#fff;border:1px solid rgba(255,255,255,.55);font-size:11px;line-height:1;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:60;opacity:.4;transition:opacity .12s}'
  + '[data-fp-block]:hover > .fp-x,.fp-x:hover{opacity:1}'
  + '.fp-x:hover{background:#ff2d55;border-color:#ff2d55}'
  + '.fp-blk{display:flex;align-items:center;gap:6px;padding:5px 7px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);font-size:11.5px;color:var(--text);cursor:grab;user-select:none;touch-action:none;margin-bottom:4px}'
  + '.fp-blk[data-nested="1"]{cursor:default;background:transparent;border-style:dashed}'
  + '.fp-blk.dragging{opacity:.35}'
  + '[data-fp-block].dragging{opacity:.35}'
  + '.fp-g{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:rgba(10,10,20,.75);color:#fff;border:1px solid rgba(255,255,255,.55);font-size:11px;line-height:1;font-weight:700;cursor:grab;touch-action:none;padding:0;display:flex;align-items:center;justify-content:center;z-index:60;opacity:.4;transition:opacity .12s}'
  + '[data-fp-block]:hover > .fp-g,.fp-g:hover{opacity:1}'
  + '.fp-g:active{cursor:grabbing;background:#ff2d55}'
  + '.fp-blk.off{opacity:.55;background:transparent}'
  + '.fp-blk.off .fp-blk-nm{text-decoration:line-through}'
  + '.fp-blk .fp-grip{color:var(--text-faint);font-size:10px;width:12px;text-align:center;flex-shrink:0}'
  + '.fp-blk-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.fp-blk-t{width:18px;height:18px;border-radius:50%;border:1px solid var(--input-border);background:var(--card);color:var(--text-muted);font-size:12px;line-height:1;cursor:pointer;padding:0;flex-shrink:0}'
  + '.fp-blk-t:hover{background:#ff2d55;color:#fff;border-color:#ff2d55}'
  + '.fp-blk-rs{font-size:10.5px;font-weight:700;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 0;margin-top:4px;font-family:inherit}';

var styleEl=null;
function ensureCSS(){ if(styleEl) return; styleEl=document.createElement('style'); styleEl.textContent=CSS+CSS_BLOCK; document.head.appendChild(styleEl); }
function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

var DEMO_STATS = { reads:12800, followers:420, books:7, following:156, likes:3100 };
function pickCta(v, fallback){
  return (v.ctaText||'').trim() || fallback || 'READ NOW →';
}
function ctaEl(v, link, storeUrl, accent){
  var isFollowTpl = /spotlight|follow_me|reader|platform_reader|platform_invite/.test(v._templateId||'') || /spotlight|follow me|reader|invite/i.test(v._templateName||'');
  var fallback = isFollowTpl ? 'Follow Me →' : 'READ NOW →';
  var text = pickCta(v, fallback);
  var target = (v.link||link||'').trim() || '#';
  var bg = v.accent || accent || 'var(--accent)';
  if(target && target !== '#') return '<a href="'+esc(target)+'" target="_blank" rel="noopener" class="fp-canvas-cta" style="background:'+esc(bg)+';text-decoration:none">'+esc(text)+'</a>';
  return '<span class="fp-canvas-cta" style="background:'+esc(bg)+'">'+esc(text)+'</span>';
}
// Legacy footer (kept for compatibility, no longer used by LAYOUTS)
function linkRow(link, storeUrl){
  return '<div class="fp-canvas-link-row" style="flex-wrap:wrap">'
    + '<span style="font-size:8px;color:rgba(255,255,255,.45)">Available on DroBoard</span>'
    + '<span style="margin-left:auto;display:inline-flex;gap:6px">'
    + '<button onclick="FlyerPreview.share()" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-share-nodes"></i> Share</button>'
    + '<button onclick="FlyerPreview.download()" style="padding:5px 10px;border-radius:8px;border:none;background:#fff;color:#0f0f22;font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-download"></i> Download</button>'
    + '</span></div>';
}

// ── Premium header (logo + tagline), reused across every template ──
function headerBar(accent){
  return '<div style="display:flex;align-items:center;gap:7px;padding:10px 12px 0;position:relative;z-index:2">'
    + '<div style="width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,'+esc(accent)+',#000);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:12px;flex-shrink:0">D</div>'
    + '<div><div style="font-weight:900;font-size:10.5px;letter-spacing:-.02em;color:#fff;line-height:1">DroBoard</div><div style="font-size:6.5px;letter-spacing:.16em;color:rgba(255,255,255,.55);font-weight:700">READ · WRITE · CONNECT</div></div>'
    + '</div>';
}
// ── Premium footer: link chip + QR + Share/Download — on EVERY template ──
function footerBar(v, link, accent, light){
  var handle=(v.handle||'').replace('@','')||(v.authorName||'user').toLowerCase().replace(/\s+/g,'');
  var border = light ? '#eceaf5' : 'rgba(255,255,255,.08)';
  var muted = light ? '#9694ac' : 'rgba(255,255,255,.5)';
  var shareBg = light ? '#f4f4fb' : 'rgba(255,255,255,.08)';
  var shareBorder = light ? '#eceaf5' : 'rgba(255,255,255,.18)';
  var shareColor = light ? '#1a1730' : '#fff';
  var dlBg = light ? esc(accent) : '#fff';
  var dlColor = light ? '#fff' : '#0f0f22';
  return '<div style="position:relative;z-index:2;padding:10px 12px 12px">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
    + '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:5px;font-size:8px;color:'+muted+'"><i class="fas fa-link" style="font-size:8px"></i><span style="font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">droboard.com/'+esc(handle||'story')+'</span></div>'
    + qrBoxHTML(link, 56)
    + '</div>'
    + '<div data-fp-chrome="1" style="display:flex;gap:8px">'
    + '<button onclick="FlyerPreview.share()" style="flex:1;padding:7px 10px;border-radius:8px;border:1px solid '+shareBorder+';background:'+shareBg+';color:'+shareColor+';font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-share-nodes"></i> Share</button>'
    + '<button onclick="FlyerPreview.download()" style="flex:1;padding:7px 10px;border-radius:8px;border:none;background:'+dlBg+';color:'+dlColor+';font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-download"></i> Download</button>'
    + '</div></div>';
}
// ── Real QR codes (encode the flyer link — scannable on every network) ──
var QR_LIB_URL='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
var _qrLoading=null;
function loadQRLib(){
  if(window.QRCode) return Promise.resolve(true);
  if(_qrLoading) return _qrLoading;
  _qrLoading=new Promise(function(res){
    var s=document.createElement('script');
    s.src=QR_LIB_URL; s.async=true;
    s.onload=function(){res(!!window.QRCode)}; s.onerror=function(){res(false)};
    document.head.appendChild(s);
    setTimeout(function(){res(!!window.QRCode)},8000);
  });
  return _qrLoading;
}
function qrBoxHTML(link, size){
  size=size||56;
  return '<div class="fp-qrbox" data-qrbox data-qr-link="'+esc(link||'')+'" style="width:'+size+'px;height:'+size+'px;border-radius:6px;background:#fff;padding:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden"><i class="fas fa-qrcode" style="color:#0f0f22;font-size:14px"></i></div>';
}
async function hydrateQR(scope){
  var boxes=[];
  try{
    var root=scope||document;
    if(root.querySelectorAll) boxes=Array.from(root.querySelectorAll('[data-qrbox]:not([data-qr-done]),[data-lkqr]:not([data-qr-done])'));
  }catch(e){ return false; }
  if(!boxes.length) return true;
  var ok=await loadQRLib();
  if(!ok||!window.QRCode) return false;
  boxes.forEach(function(box){
    var text=box.getAttribute('data-qr-link')||box.getAttribute('data-lkqr')||'';
    if(!text) return;
    var size=parseInt(box.style.width,10)||56;
    try{
      box.innerHTML='';
      new window.QRCode(box,{text:text,width:size-6,height:size-6,correctLevel:window.QRCode.CorrectLevel.M});
      box.setAttribute('data-qr-done','1');
    }catch(e){}
  });
  return true;
}
async function captureBlob(){
  var mount=document.getElementById('fpCanvasMount'); if(!mount) return null;
  var canvasEl=mount.querySelector('.fp-canvas'); if(!canvasEl) return null;
  await hydrateQR(mount);
  await new Promise(function(r){setTimeout(r,600)});
    var hidden=[];
    try{
      canvasEl.classList.add('fp-capturing');
      canvasEl.querySelectorAll('[data-fp-chrome]').forEach(function(el){ hidden.push(el); el.style.display='none'; });
    if(!window.html2canvas){
      try{
        await new Promise(function(res,rej){
          var s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          s.onload=res; s.onerror=rej; document.head.appendChild(s);
        });
      }catch(e){ return null; }
    }
  try{
    var scale = Math.max(3, Math.ceil(window.devicePixelRatio || 1));
    var c=await html2canvas(canvasEl,{backgroundColor:null, scale:scale, useCORS:true, logging:false});
    return await new Promise(function(res){ c.toBlob(function(b){res(b)},'image/png'); });
  }catch(e){ return null; }
  }finally{
    try{ canvasEl.classList.remove('fp-capturing'); }catch(e){}
    hidden.forEach(function(el){ try{ el.style.display=''; }catch(e){} });
  }
}
function toastMini(msg, bad){
  var t=document.createElement('div'); t.textContent=msg;
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:'+(bad?'#b00020':'#0f0f22')+';color:#fff;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:700;z-index:9999';
  document.body.appendChild(t); setTimeout(function(){t.remove();}, bad?2200:1800);
}
async function shareCurrent(){
  var link=((currentVars&&currentVars.link)||'').trim();
  var title=(currentVars&&currentVars.title)|| (currentTemplate&&currentTemplate.name) || 'DroBoard flyer';
  var author=(currentVars&&(currentVars.authorName||''))||'';
  if(!link){ toastMini('Add the story link first — search a story above', true); return; }
  var blob=await captureBlob();
  if(blob){
    try{
      var file=new File([blob],((currentTemplate&&currentTemplate.id)||'flyer')+'.png',{type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:title,text:link});
        return;
      }
    }catch(e){ if(e&&e.name==='AbortError') return; }
  }
  if(navigator.share){ try{ await navigator.share({title:title,text:link}); return; }catch(e){ if(e&&e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(link); }catch(e){}
  toastMini('Link copied — paste to share');
}
async function downloadCurrent(){
  var blob=await captureBlob();
  if(!blob){ toastMini('Download failed — check images are CORS-enabled', true); return; }
  var a=document.createElement('a');
  a.download=((currentTemplate&&currentTemplate.id)||'flyer')+'.png';
  a.href=URL.createObjectURL(blob);
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },4000);
}
// statNum — writer-entered stat (accepts "12,800" / "12K"), else the demo stat.
function statNum(v, key, cur, dflt){
  var raw=v[key];
  if(raw!==undefined&&raw!==null&&String(raw).trim()!==''){
    var s=String(raw).trim().toLowerCase().replace(/,/g,'');
    var mult=/k$/.test(s)?1000:/m$/.test(s)?1000000:1;
    var n=parseFloat(s.replace(/[km]$/,''));
    if(!isNaN(n)) return Math.round(n*mult);
  }
  return cur!=null?cur:dflt;
}
function statsRow(v){
  var s=v.stats || DEMO_STATS;
  var reads=statNum(v,'statsReads', s.reads!=null?s.reads:(s.hoursRead!=null?s.hoursRead:DEMO_STATS.reads));
  var followers=statNum(v,'statsFollowers', s.followers!=null?s.followers:(s.booksRead!=null?s.booksRead:DEMO_STATS.followers));
  var books=statNum(v,'statsBooks', s.books!=null?s.books:(s.streak!=null?s.streak:DEMO_STATS.books));
  return '<div style="display:flex;gap:6px;margin:8px 0 6px"><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+(reads>=1000? (reads/1000|0)+'K' : reads)+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Reads</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+followers+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Followers</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+books+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Books</small></span></div>';
}
function statsRowReader(v){
  var s=v.stats || { hoursRead:48, booksRead:12, streak:7 };
  var h=statNum(v,'hoursRead', s.hoursRead!=null?s.hoursRead:(s.reads!=null?s.reads:48));
  var b=statNum(v,'booksRead', s.booksRead!=null?s.booksRead:(s.books!=null?s.books:12));
  var st=statNum(v,'streak', s.streak!=null?s.streak:(s.followers!=null?s.followers:7));
  return '<div style="display:flex;gap:6px;margin:8px 0 6px"><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+h+'h</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Hours read</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+b+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Books read</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+st+'d</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Streak</small></span></div>';
}

// ── Editable copy: every hardcoded string a writer can change ──
// Seeded into currentVars on open (only when the caller didn't pass one) so the
// form input always matches the canvas. A cleared field drops the element.
var COPY_DEFAULTS = {
  tmpl_main: { headline:'WHAT HAPPENS|NEXT?', chatTime:'8:42', chatName:'Unknown Number', chatText:'I know your secret...', watchText:'Watch the full story on', tagline:'Real Stories.|Real People.|Real Emotions.', scriptText:'' },
  tmpl_teaser: { headline:'WHAT HAPPENS|NEXT?', chatTime:'8:42', chatName:'Unknown Number', chatText:'I know your secret...', watchText:'Watch the full story on', tagline:'Real Stories.|Real People.|Real Emotions.', scriptText:'' },
  tmpl_wa_status: { kicker:'You need to read this' },
  tmpl_drop: { badge:'New Chapter Out Now' },
  tmpl_tiktok: { pill:'9:16 COVER' },
  tmpl_platform_promo: { badge:'Featured' },
  tmpl_spotlight: { statsReads:'12800', statsFollowers:'420', statsBooks:'7' },
  tmpl_follow_me: { statsReads:'12800', statsFollowers:'420', statsBooks:'7' },
  tmpl_platform_reader: { hoursRead:'48', booksRead:'12', streak:'7' },
};
function ensureCopyVars(tmpl){
  if(!tmpl) return;
  tmpl.vars=tmpl.vars||[];
  var defs=COPY_DEFAULTS[tmpl.id];
  if(!defs) return;
  Object.keys(defs).forEach(function(k){ if(tmpl.vars.indexOf(k)===-1) tmpl.vars.unshift(k); });
}
function seedCopyVars(tmpl, vars){
  var defs=COPY_DEFAULTS[(tmpl&&tmpl.id)||'']||{};
  Object.keys(defs).forEach(function(k){ if(vars[k]===undefined) vars[k]=defs[k]; });
  return vars;
}
// copyVal — value a writer set, else the shipped default (never null).
function copyVal(v, key, dflt){ var raw=v[key]; return raw===undefined||raw===null ? dflt : String(raw); }

// ── Block engine ──────────────────────────────────────────────────────────
// Every layout is a list of named [key, html] blocks. A block whose key is in
// v.hidden is skipped at build time; v.order (top-level keys only) decides the
// stacking. Nested blocks (chat card, cover thumb…) are taggable/removable but
// always ride inside their parent block.
function hk(v, key){ return !!(v && v.hidden && v.hidden[key]); }
function mark(key, html){
  html=String(html||'').trim(); if(!html) return '';
  return html.replace(/^<([A-Za-z0-9]+)/, '<$1 data-fp-block="'+key+'"');
}
function B(v, items){
  var hidden=(v&&v.hidden)||{};
  var visible=items.filter(function(it){ return it[1] && !hidden[it[0]]; });
  var order=(v&&v.order)||[];
  if(order.length){
    var pos={}; order.forEach(function(k,i){ if(!(k in pos)) pos[k]=i; });
    var dflt={}; items.forEach(function(it,i){ dflt[it[0]]=i; });
    visible.sort(function(a,b){
      var ia=(a[0] in pos)?pos[a[0]]:1e6+dflt[a[0]];
      var ib=(b[0] in pos)?pos[b[0]]:1e6+dflt[b[0]];
      return ia-ib;
    });
  }
  return visible.map(function(it){ return mark(it[0], it[1]); }).join('');
}
// Block registry — drives the Layout list (label, draggability, nesting).
var BLOCKS = {
  tmpl_main: [
    {key:'brand',label:'Brand header'},{key:'headline',label:'Headline brush'},
    {key:'hook',label:'Hook lines'},{key:'media',label:'Cover + chat row'},
    {key:'chat',label:'Chat card',nested:1,parent:'media'},
    {key:'cover',label:'Cover thumbnail',nested:1,parent:'media'},
    {key:'script',label:'Script title'},{key:'byline',label:'Author + genres'},
    {key:'watch',label:'Watch row'},
    {key:'cta',label:'Read button',nested:1,parent:'watch'},
    {key:'links',label:'Link + QR row'},
    {key:'share',label:'Share / Download bar'},{key:'strip',label:'Bottom strip'},
  ],
  tmpl_teaser: null,
  tmpl_wa_status: [
    {key:'header',label:'Brand header'},{key:'cover',label:'Cover image'},
    {key:'author',label:'Author row'},{key:'kicker',label:'Kicker line'},
    {key:'title',label:'Title'},{key:'hook',label:'Hook / quote'},
    {key:'cta',label:'Button'},{key:'spacer',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
  tmpl_wa_share: [
    {key:'brand',label:'Brand row'},{key:'cover',label:'Cover image'},
    {key:'title',label:'Title'},{key:'byline',label:'Byline'},
    {key:'hook',label:'Hook / quote'},{key:'cta',label:'Button'},
    {key:'spacer',label:'Flexible space'},{key:'footer',label:'Link + QR footer'},
  ],
  tmpl_drop: [
    {key:'header',label:'Brand header'},{key:'badge',label:'Badge'},
    {key:'cover',label:'Cover image'},{key:'title',label:'Title'},
    {key:'byline',label:'Byline'},{key:'hook',label:'Hook / quote'},
    {key:'cta',label:'Button'},{key:'spacer',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
  tmpl_tiktok: [
    {key:'brand',label:'TikTok top bar'},{key:'cover',label:'Cover image'},
    {key:'title',label:'Title'},{key:'byline',label:'Byline'},
    {key:'hook',label:'Hook / quote'},{key:'cta',label:'Button'},
    {key:'spacer',label:'Flexible space'},{key:'footer',label:'Link + QR footer'},
  ],
  tmpl_spotlight: [
    {key:'header',label:'Brand header'},{key:'profile',label:'Author spotlight row'},
    {key:'stats',label:'Stats row'},{key:'bio',label:'Bio / blurb'},
    {key:'cta',label:'Button'},{key:'spacer',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
  tmpl_follow_me: [
    {key:'header',label:'Brand header'},{key:'profile',label:'Avatar + name'},
    {key:'stats',label:'Stats row'},{key:'bio',label:'Blurb'},
    {key:'cta',label:'Button'},{key:'spacer',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
  tmpl_platform_invite: [
    {key:'header',label:'Brand header'},{key:'topSpace',label:'Flexible space'},
    {key:'photo',label:'Avatar'},{key:'label',label:'Invite label'},
    {key:'handle',label:'Handle line'},{key:'message',label:'Invite message'},
    {key:'subtext',label:'Subtext'},{key:'cta',label:'Button'},
    {key:'bottomSpace',label:'Flexible space'},{key:'footer',label:'Link + QR footer'},
  ],
  tmpl_platform_reader: [
    {key:'header',label:'Brand header'},{key:'avatar',label:'Avatar'},
    {key:'label',label:'Reader label'},{key:'name',label:'Name line'},
    {key:'bio',label:'Bio'},{key:'stats',label:'Reader stats'},
    {key:'cta',label:'Button'},{key:'spacer',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
  tmpl_platform_promo: [
    {key:'header',label:'Brand header'},{key:'cover',label:'Cover image'},
    {key:'badge',label:'Featured badge',nested:1,parent:'cover'},
    {key:'kicker',label:'Kicker line'},{key:'title',label:'Title'},
    {key:'hook',label:'Hook / quote'},{key:'cta',label:'Button'},
    {key:'spacer',label:'Flexible space'},{key:'footer',label:'Link + QR footer'},
  ],
  tmpl_platform_countdown: [
    {key:'eventPill',label:'Event pill'},{key:'countCircle',label:'Countdown circle'},
    {key:'countLabel',label:'Countdown label'},{key:'midSpace',label:'Flexible space'},
    {key:'title',label:'Title'},{key:'hook',label:'Hook / blurb'},
    {key:'cta',label:'Button'},{key:'tailSpace',label:'Flexible space'},
    {key:'footer',label:'Link + QR footer'},
  ],
};
BLOCKS.tmpl_teaser = BLOCKS.tmpl_main;
function blockRegistry(id){ return BLOCKS[id] || []; }
function heroPremiumHtml(v, link, cover){
  // headline empty → remove the pink brush. Hook lines empty → hide that line. Same for every other cell.
  var headlineRaw = copyVal(v,'headline','WHAT HAPPENS|NEXT?');
  var headParts=headlineRaw.split('|'); var headA=headParts[0]||''; var headB=headParts[1]||'';
  var showHeadline = headlineRaw.trim()!=='';
  var tagRaw = copyVal(v,'tagline','Real Stories.|Real People.|Real Emotions.');
  var showTagline = tagRaw.trim()!=='';
  var watchLabel = copyVal(v,'watchText','Watch the full story on');
  var scriptRaw = String(v.scriptText||'').trim() ? String(v.scriptText) : (v.title||'The|Last Sunrise');
  var hookLines=(v.hook||'She thought her husband had gone to work...|Then she received a message.').split('|');
  var h1raw=hookLines[0]||''; var h2raw=hookLines[1]||'';
  var showH1=h1raw.trim()!==''; var showH2=h2raw.trim()!=='';
  var h1=esc(h1raw); var h2=esc(h2raw);
  var title=esc(v.title||'The Last Sunrise'); var author=esc(v.authorName||'Tobi Adenuga');
  var genres=(v.genre||'Romance|Drama|Suspense').split('|').map(function(g){return esc(g.trim())});
  var cta=(v.ctaText||'READ NOW →'); var acc=v.accent||'#ff0050';
  var handle=esc(v.handle||'@tobi_adenuga');
  var canvasOpen='<div class="fp-canvas v9" style="position:relative;overflow:hidden;background:radial-gradient(520px 360px at 50% -8%, #1a1033 0%, #0b0b18 42%, #050508 100%);display:flex;flex-direction:column">';
  var brand='<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 12px 0 12px;position:relative;z-index:2"><div style="display:flex;align-items:center;gap:7px"><div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#ff0050,#000);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px">D</div><div><div style="font-weight:900;font-size:11px;letter-spacing:-.02em;color:#fff;line-height:1">DroBoard</div><div style="font-size:7px;letter-spacing:.18em;color:rgba(255,255,255,.6);font-weight:700">READ · WRITE · CONNECT</div></div></div>'+(showTagline?'<div style="text-align:right;font-size:8px;line-height:1.35;color:rgba(255,255,255,.9);font-weight:700;font-style:italic">'+esc(tagRaw).split('|').join('<br/>')+'<span style="display:block;height:2px;margin-top:2px;background:#ff0050;border-radius:2px;transform:rotate(-2deg)"></span></div>':'')+'</div>';
  var headline=showHeadline?'<div style="margin:12px 10px 0;position:relative;z-index:2;display:inline-block;transform:rotate(-1deg)"><div style="background:#ff0050;color:#fff;font-weight:900;font-size:19px;line-height:1;padding:6px 14px 8px;border-radius:8px 0 10px 0;box-shadow:0 4px 14px rgba(255,0,80,.4);clip-path:polygon(2% 0,100% 0,98% 18%,100% 100%,2% 100%,0 82%)">'+esc(headA)+(headB?'<br/><span style="font-size:28px;letter-spacing:.04em">'+esc(headB)+'</span>':'')+'</div></div>':'';
  var hook=showH1||showH2?'<div style="padding:10px 12px 0 14px;position:relative;z-index:2">'+(showH1?'<div style="font-size:12px;line-height:1.45;color:#fff;font-weight:600;max-width:190px">'+h1+'</div>':'')+(showH2?'<div style="font-size:11px;line-height:1.45;color:#ff2d55;font-weight:700;margin-top:4px">'+h2+'</div>':'')+'</div>':'';
  var chatHtml='<div style="flex:1;max-width:66%;position:relative;z-index:2;background:linear-gradient(180deg,#14141e 0%,#0a0a12 100%);border-radius:16px;padding:10px 10px 14px 10px;box-shadow:0 8px 22px rgba(0,0,0,.45)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:10px;color:rgba(255,255,255,.6)">'+esc(copyVal(v,'chatTime','8:42'))+'</span><span style="font-size:9px;color:rgba(255,255,255,.45)"><i class="fas fa-signal"></i> <i class="fas fa-wifi"></i> <i class="fas fa-battery-three-quarters"></i></span></div><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><div style="width:28px;height:28px;border-radius:50%;background:#2a2a3a;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px"><i class="fas fa-user"></i></div><div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:800;color:#fff">'+esc(copyVal(v,'chatName','Unknown Number'))+'</div><div style="font-size:8px;color:rgba(255,255,255,.45)">Today, '+esc(copyVal(v,'chatTime','8:42'))+' PM</div></div></div>'+(copyVal(v,'chatText','I know your secret...')!==''?'<div style="background:rgba(255,255,255,.08);border-radius:12px;padding:8px 10px;font-size:10px;color:#fff;font-style:italic">'+esc(copyVal(v,'chatText','I know your secret...'))+'</div>':'')+'</div>';
  var coverHtml='<div style="width:86px;flex-shrink:0;position:relative;z-index:2;transform:rotate(2deg)"><img src="'+esc(cover||'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop')+'" style="width:86px;height:118px;object-fit:cover;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.45)" alt=""/><div style="position:absolute;inset:auto -6px -6px -6px;height:12px;background:#ff0050;opacity:.9;transform:rotate(-1deg);border-radius:2px"></div><div style="position:absolute;bottom:6px;left:6px;right:6px;text-align:center"><div style="font-family:Playfair Display,serif;font-size:11px;font-weight:800;color:#fff;line-height:1;text-shadow:0 1px 6px rgba(0,0,0,.6)">'+title+'</div><div style="font-size:6px;letter-spacing:.14em;color:rgba(255,255,255,.7);font-weight:700;margin-top:2px">'+esc(handle.replace('@','').toUpperCase()||'TOBI ADENUGA')+'</div></div></div>';
  var mediaKids=(hk(v,'chat')?'':mark('chat',chatHtml))+(hk(v,'cover')?'':mark('cover',coverHtml));
  var media=mediaKids?'<div style="position:relative;flex:1;display:flex;align-items:flex-end;gap:10px;padding:10px 10px 0 10px;min-height:210px">'+mediaKids+'</div>':'';
  var script='<div style="position:relative;z-index:2;padding:12px 12px 0 12px"><div style="font-family:Brush Script MT,cursive;font-size:22px;font-weight:800;color:#fff;transform:rotate(-1deg);text-shadow:0 2px 10px rgba(0,0,0,.5)">'+esc(scriptRaw).split('|').join('<br/>')+'</div></div>';
  var byline='<div style="position:relative;z-index:2;padding:0 12px 8px 12px"><div style="margin-top:6px;display:flex;align-items:center;gap:6px"><i class="fas fa-user" style="color:#ff0050;font-size:10px"></i><span style="font-size:11px;font-weight:700;color:#fff">By '+author+'</span><span style="margin-left:6px;display:inline-flex;gap:5px"><span style="padding:2px 7px;border-radius:10px;background:#ff0050;color:#fff;font-size:8px;font-weight:700">'+esc(genres[0]||'Romance')+'</span>'+(genres[1]?'<span style="padding:2px 7px;border-radius:10px;color:#fff;font-size:8px">'+esc(genres[1])+'</span>':'')+(genres[2]?'<span style="padding:2px 7px;border-radius:10px;color:#fff;font-size:8px">'+esc(genres[2])+'</span>':'')+'</span></div></div>';
  var watchPlay='<a href="'+esc(link||'#')+'" target="_blank" style="flex:1;display:flex;align-items:center;gap:8px;text-decoration:none"><span style="width:36px;height:36px;border-radius:50%;background:#ff0050;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px"><i class="fas fa-play" style="margin-left:2px"></i></span><span>'+(watchLabel.trim()?'<span style="display:block;font-size:10px;color:rgba(255,255,255,.6);font-weight:600">'+esc(watchLabel)+'</span>':'')+'<span style="display:block;font-size:14px;font-weight:800;color:#fff;line-height:1">DroBoard</span></span></a>';
  var watchCta='<a href="'+esc(link||'#')+'" target="_blank" style="padding:8px 14px;border-radius:10px;background:#ff0050;color:#fff;font-size:10px;font-weight:800;text-decoration:none;transform:rotate(-1deg);box-shadow:0 4px 14px rgba(255,0,80,.35)">'+esc(cta||'READ NOW →')+'</a>';
  var watch='<div style="position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:6px 12px 8px 12px">'+watchPlay+(hk(v,'cta')?'':mark('cta',watchCta))+'</div>';
  var links='<div style="position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:6px 12px 8px 12px"><div style="flex:1"><div style="display:flex;align-items:center;gap:4px;font-size:8px;color:rgba(255,255,255,.5)"><i class="fas fa-link" style="font-size:8px"></i> <span style="font-family:monospace">droboard.com/'+esc(handle.replace('@','')||'tobi')+'</span></div></div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;font-style:italic;color:rgba(255,255,255,.7)">Scan to read <i class="fas fa-arrow-right" style="font-size:8px"></i></span>'+qrBoxHTML(link,64)+'</div></div>';
  var share='<div data-fp-chrome="1" style="position:relative;z-index:2;display:flex;gap:8px;padding:0 12px 8px 12px"><button onclick="FlyerPreview.share()" style="flex:1;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-share-nodes"></i> Share</button><button onclick="FlyerPreview.download()" style="flex:1;padding:7px 10px;border-radius:8px;border:none;background:#fff;color:#0f0f22;font-size:9px;font-weight:700;cursor:pointer"><i class="fas fa-download"></i> Download</button></div>';
  var strip='<div style="position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.04)"><span style="display:flex;align-items:center;gap:5px;font-size:7px;color:rgba(255,255,255,.6);font-weight:700"><i class="far fa-book-open"></i> Great Stories</span><span style="display:flex;align-items:center;gap:5px;font-size:7px;color:rgba(255,255,255,.6);font-weight:700"><i class="fas fa-users"></i> Amazing Writers</span><span style="display:flex;align-items:center;gap:5px;font-size:7px;color:rgba(255,255,255,.6);font-weight:700"><i class="far fa-heart"></i> A Growing Community</span><span style="display:flex;align-items:center;gap:5px"><span style="width:18px;height:18px;border-radius:4px;background:#ff0050;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:9px">D</span><span style="font-size:9px;font-weight:900;color:#fff">DroBoard</span></span></div>';
  return canvasOpen + B(v, [['brand',brand],['headline',headline],['hook',hook],['media',media],['script',script],['byline',byline],['watch',watch],['links',links],['share',share],['strip',strip]]) + '</div>';
}

// ── Per-template renderers — every one gets a premium header + hero treatment + Share/Download footer ──
var LAYOUTS = {
  tmpl_main: function(t, v, link, cover, authorPhoto, storeUrl){ return heroPremiumHtml(v, link, cover); },
  tmpl_teaser: function(t, v, link, cover, authorPhoto, storeUrl){ return heroPremiumHtml(v, link, cover); },

  tmpl_wa_status: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#25d366';
    var canvasOpen='<div class="fp-canvas v9" style="background:radial-gradient(480px 320px at 50% -10%, #128c7e 0%, #0f0f22 45%, #0a0a12 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var coverBlock='<div style="position:relative;margin:10px 12px 0;transform:rotate(-1deg)"><img src="'+esc(cover)+'" style="width:100%;height:160px;object-fit:cover;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.45)" alt=""/><span style="position:absolute;top:-6px;left:10px;background:'+esc(acc)+';color:#fff;font-size:8px;font-weight:800;padding:4px 9px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 4px 10px rgba(0,0,0,.3)"><i class="fab fa-whatsapp"></i> Status</span></div>';
    var authorBlock='<div style="padding:14px 14px 0"><div class="fp-author-row"><img src="'+esc(authorPhoto)+'" alt=""/><span style="font-size:10.5px;font-weight:700;color:#fff">'+esc(v.authorName||'Author Name')+'</span></div></div>';
    var kickerBlock=copyVal(v,'kicker','You need to read this').trim()?'<div style="padding:6px 14px 0"><div style="font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+esc(acc)+'">'+esc(copyVal(v,'kicker','You need to read this'))+'</div></div>':'';
    var titleBlock='<div style="padding:0 14px"><div class="fp-canvas-title" style="color:#fff">'+esc(v.title||'Your Story Title')+'</div></div>';
    var hookBlock='<div style="padding:6px 14px 0"><div class="fp-canvas-hook" style="border-left-color:'+esc(acc)+'">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['cover',coverBlock],['author',authorBlock],['kicker',kickerBlock],['title',titleBlock],['hook',hookBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_wa_share: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#25d366';
    var canvasOpen='<div class="fp-canvas sq" style="background:#ffffff;color:#1a1730;display:flex;flex-direction:column">';
    var brandBlock='<div style="display:flex;align-items:center;gap:7px;padding:12px 14px 0"><div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,'+esc(acc)+',#128c7e);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px">D</div><span style="font-weight:900;font-size:10.5px;color:#1a1730">DroBoard</span></div>';
    var coverBlock='<div style="position:relative;margin:10px 14px 0"><img src="'+esc(cover)+'" style="width:100%;height:170px;object-fit:cover;border-radius:12px" alt=""/></div>';
    var titleBlock='<div style="padding:12px 14px 0"><div class="fp-canvas-title" style="color:#1a1730">'+esc(v.title||'Your Story Title')+'</div></div>';
    var bylineBlock='<div style="padding:4px 14px 0"><div style="font-size:9.5px;color:#8e8e93;margin-bottom:6px">By '+esc(v.authorName||'Author Name')+'</div></div>';
    var hookBlock='<div style="padding:4px 14px 0"><div class="fp-canvas-hook" style="color:#434059;border-left-color:'+esc(acc)+';background:#f4f4fb">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['brand',brandBlock],['cover',coverBlock],['title',titleBlock],['byline',bylineBlock],['hook',hookBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc, true)]])
      + '</div>';
  },

  tmpl_drop: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#f59e0b';
    var canvasOpen='<div class="fp-canvas sq" style="background:radial-gradient(480px 320px at 50% -10%, '+esc(acc)+' 0%, #1a1033 45%, #0f0f22 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var badgeBlock=copyVal(v,'badge','New Chapter Out Now').trim()?'<div style="text-align:center;margin:6px 14px 0"><span style="display:inline-block;background:linear-gradient(90deg,'+esc(acc)+',#ff0050);color:#fff;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:5px 12px;border-radius:20px;box-shadow:0 4px 12px rgba(245,158,11,.35)"><i class="fas fa-fire"></i> '+esc(copyVal(v,'badge','New Chapter Out Now'))+'</span></div>':'';
    var coverBlock='<div style="position:relative;margin:10px 14px 0;transform:rotate(1deg)"><img src="'+esc(cover)+'" style="width:100%;height:150px;object-fit:cover;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.4)" alt=""/></div>';
    var titleBlock='<div style="padding:12px 14px 0"><div class="fp-canvas-title">'+esc(v.title||'Your Story Title')+'</div></div>';
    var bylineBlock='<div style="padding:0 14px"><div class="fp-canvas-author">By '+esc(v.authorName||'Author Name')+'</div></div>';
    var hookBlock='<div style="padding:6px 14px 0"><div class="fp-canvas-hook">"'+esc(v.hook||'What happens next will leave you speechless.')+'"</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['badge',badgeBlock],['cover',coverBlock],['title',titleBlock],['byline',bylineBlock],['hook',hookBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_tiktok: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#ff0050';
    var canvasOpen='<div class="fp-canvas v9" style="background:radial-gradient(480px 320px at 50% -10%, #1a1a1a 0%, #0a0a0a 45%, #000 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var brandBlock='<div style="display:flex;align-items:center;gap:8px;padding:10px 12px 0"><i class="fab fa-tiktok" style="color:#fff;font-size:15px"></i><span style="font-size:10px;font-weight:800;letter-spacing:.06em;color:#fff">DroBoard</span>'+(copyVal(v,'pill','9:16 COVER').trim()?'<span style="margin-left:auto;font-size:7px;background:rgba(255,255,255,.14);padding:3px 8px;border-radius:20px;color:#fff">'+esc(copyVal(v,'pill','9:16 COVER'))+'</span>':'<span style="margin-left:auto"></span>')+'</div>';
    var coverBlock='<div style="position:relative;margin:10px 12px 0"><img src="'+esc(cover)+'" style="width:100%;height:180px;object-fit:cover;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.5)" alt=""/></div>';
    var titleBlock='<div style="padding:12px 14px 0"><div class="fp-canvas-title" style="color:#fff">'+esc(v.title||'Your Story Title')+'</div></div>';
    var bylineBlock='<div style="padding:4px 14px 0"><div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-bottom:6px">By '+esc(v.authorName||'Author Name')+'</div></div>';
    var hookBlock='<div style="padding:4px 14px 0"><div class="fp-canvas-hook" style="background:rgba(255,255,255,.06);border-left-color:'+esc(acc)+'">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['brand',brandBlock],['cover',coverBlock],['title',titleBlock],['byline',bylineBlock],['hook',hookBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_spotlight: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#a78bfa';
    var v2=Object.assign({}, v, {ctaText:(v.ctaText||'Follow Me →').trim()||'Follow Me →'});
    var canvasOpen='<div class="fp-canvas sq" style="background:radial-gradient(480px 320px at 50% -10%, '+esc(acc)+' 0%, #1a1033 45%, #0f0f22 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var profileBlock='<div style="display:flex;gap:12px;padding:10px 12px 0;align-items:center"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:64px;height:64px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid '+esc(acc)+';box-shadow:0 6px 16px rgba(0,0,0,.3)" alt=""/><div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+esc(acc)+'"><i class="fas fa-star"></i> Author Spotlight</div><div style="font-size:14px;font-weight:800;color:#fff;margin:2px 0">'+esc(v.authorName||'Author Name')+'</div><div style="font-size:10px;color:rgba(255,255,255,.6)">'+esc(v.handle||'@username')+' · '+esc(v.genre||'Writer')+'</div></div></div>';
    var statsBlock='<div style="padding:0 14px">'+statsRow(v)+'</div>';
    var bioBlock='<div style="padding:6px 14px 0"><div style="font-size:11px;line-height:1.5;color:rgba(255,255,255,.82)">'+esc(v.bio||v.hook||'Writer of heartfelt stories. Follow me for new chapters every week.')+'</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0;display:flex;justify-content:center">'+ctaEl(v2, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['profile',profileBlock],['stats',statsBlock],['bio',bioBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_follow_me: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#ff0050';
    var canvasOpen='<div class="fp-canvas sq" style="background:radial-gradient(480px 320px at 50% -10%, '+esc(acc)+' 0%, #1a1033 45%, #0f0f22 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var profileBlock='<div style="text-align:center;padding:10px 14px 0"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid '+esc(acc)+';margin:0 auto 8px;display:block;box-shadow:0 8px 20px rgba(255,0,80,.35)" alt=""/><div style="font-size:15px;font-weight:800;color:#fff">'+esc(v.authorName||'Author Name')+'</div><div style="font-size:11px;color:'+esc(acc)+';font-weight:700">'+esc(v.handle||'@username')+'</div></div>';
    var statsBlock='<div style="padding:0 14px">'+statsRow(v)+'</div>';
    var bioBlock='<div style="padding:6px 14px 0;text-align:center"><div style="font-size:11px;color:rgba(255,255,255,.7)">'+esc(v.hook||'Follow my stories on DroBoard — new chapters weekly.')+'</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0;display:flex;justify-content:center">'+ctaEl(v, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['profile',profileBlock],['stats',statsBlock],['bio',bioBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_platform_invite: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#ff0050';
    var photo=v.userPhoto||authorPhoto||'https://i.pravatar.cc/150?img=12';
    var canvasOpen='<div class="fp-canvas v9" style="background:radial-gradient(480px 320px at 50% -10%, '+esc(acc)+' 0%, #1a1033 45%, #0f0f22 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var photoBlock='<div style="text-align:center;padding:16px 16px 0"><img src="'+esc(photo)+'" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid '+esc(acc)+';display:block;margin:0 auto;box-shadow:0 8px 22px rgba(255,0,80,.35)" alt=""/></div>';
    var labelBlock='<div style="text-align:center;padding:10px 16px 0"><div style="font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:'+esc(acc)+'"><i class="fas fa-user-plus"></i> Invite Friends</div></div>';
    var handleBlock='<div style="text-align:center;padding:4px 16px 0"><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.7)">'+esc(v.handle||'@username')+'</div></div>';
    var messageBlock='<div style="text-align:center;padding:8px 16px 0"><div style="font-size:18px;font-weight:800;line-height:1.25;margin:0 auto;max-width:260px;color:#fff">'+esc(v.platformTag||'Discover stories worth sharing.')+'</div></div>';
    var subtextBlock='<div style="text-align:center;padding:8px 16px 0"><div style="font-size:11px;color:rgba(255,255,255,.6)">Join <b style="color:#fff">DroBoard</b> — where stories come alive</div></div>';
    var ctaBlock='<div style="text-align:center;padding:10px 16px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['topSpace','<div style="flex:1"></div>'],['photo',photoBlock],['label',labelBlock],['handle',handleBlock],['message',messageBlock],['subtext',subtextBlock],['cta',ctaBlock],['bottomSpace','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_platform_reader: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#0ea5e9';
    var canvasOpen='<div class="fp-canvas sq" style="background:radial-gradient(480px 320px at 50% -10%, '+esc(acc)+' 0%, #1a1033 45%, #0f0f22 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var avatarBlock='<div style="text-align:center;padding:10px 14px 0"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:68px;height:68px;border-radius:50%;object-fit:cover;border:2px solid '+esc(acc)+';display:block;margin:0 auto;box-shadow:0 8px 20px rgba(14,165,233,.3)" alt=""/></div>';
    var labelBlock='<div style="text-align:center;padding:8px 14px 0"><div style="font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+esc(acc)+'"><i class="fas fa-book-reader"></i> Reader on DroBoard</div></div>';
    var nameBlock='<div style="text-align:center;padding:2px 14px 0"><div style="font-size:14px;font-weight:800;color:#fff">'+esc(v.handle||'@reader')+' · '+esc(v.authorName||'Reader')+'</div></div>';
    var bioBlock='<div style="text-align:center;padding:4px 14px 0"><div style="font-size:11px;color:rgba(255,255,255,.65)">'+esc(v.bio||v.hook||'Love romance & mystery. Always has a book open.')+'</div></div>';
    var statsBlock='<div style="padding:0 14px">'+statsRowReader(v)+'</div>';
    var ctaBlock='<div style="padding:8px 14px 0;display:flex;justify-content:center">'+ctaEl(v, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['avatar',avatarBlock],['label',labelBlock],['name',nameBlock],['bio',bioBlock],['stats',statsBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_platform_promo: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#7c3aed';
    var canvasOpen='<div class="fp-canvas sq" style="background:linear-gradient(180deg,#1e1235,#0f0f22);display:flex;flex-direction:column">';
    var badgeHtml=copyVal(v,'badge','Featured').trim()&&!hk(v,'badge')?mark('badge','<span style="position:absolute;top:8px;left:8px;background:'+esc(acc)+';color:#fff;font-size:8px;font-weight:800;padding:4px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:.06em"><i class="fas fa-bullhorn"></i> '+esc(copyVal(v,'badge','Featured'))+'</span>'):'';
    var coverBlock='<div style="position:relative;margin:10px 14px 0"><img src="'+esc(cover||'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=600&fit=crop')+'" style="width:100%;height:160px;object-fit:cover;border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.4)" alt=""/>'+badgeHtml+'</div>';
    var kickerBlock='<div style="padding:12px 14px 0"><div class="fp-canvas-kicker" style="color:'+esc(acc)+'">'+esc(v.genre||'Featured')+' · DroBoard</div></div>';
    var titleBlock='<div style="padding:0 14px"><div class="fp-canvas-title">'+esc(v.title||'Platform Feature Drop')+'</div></div>';
    var hookBlock='<div style="padding:6px 14px 0"><div class="fp-canvas-hook">"'+esc(v.hook||"A new season of stories is here. Don't miss it.")+'"</div></div>';
    var ctaBlock='<div style="padding:10px 14px 0">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen
      + B(v, [['header',headerBar(acc)],['cover',coverBlock],['kicker',kickerBlock],['title',titleBlock],['hook',hookBlock],['cta',ctaBlock],['spacer','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },

  tmpl_platform_countdown: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#f59e0b';
    var badge=v.variant||'Live Now';
    var low=badge.toLowerCase();
    var m=low.match(/([0-9]+)/); var num=m?m[1]:'';
    if(low.indexOf('tomorrow')!==-1) num='1';
    if(low.indexOf('live')!==-1) num='0';
    var label = low.indexOf('live')!==-1 ? 'LIVE NOW' : low.indexOf('tomorrow')!==-1 ? 'TOMORROW' : num ? num+' DAYS TO GO' : badge.toUpperCase();
    var icon = num==='7'||num==='6'?'fa-hourglass-start':num==='5'||num==='4'?'fa-hourglass-half':num==='3'?'fa-hourglass-start':num==='2'?'fa-hourglass-half':low.indexOf('tomorrow')!==-1?'fa-clock':num==='0'?'fa-bolt':'fa-rocket';
    var canvasOpen='<div class="fp-canvas v9" style="background:radial-gradient(520px 360px at 50% -8%, '+esc(acc)+' 0%, #1a1033 42%, #0f0f22 75%, #0a0a18 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">';
    var glow='<div style="position:absolute;inset:0;opacity:.10;background:radial-gradient(600px 220px at 50% 22%, #fff, transparent 60%)"></div>';
    var pillBlock='<div style="position:relative;text-align:center;padding:14px 12px 0"><div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;background:rgba(255,255,255,.1);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.9)"><i class="fas '+icon+'"></i> DroBoard · Platform Event</div></div>';
    var circleBlock='<div style="position:relative;text-align:center;padding:12px 12px 0"><div style="margin:0 auto;width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,'+esc(acc)+',#ff0050);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.35);border:3px solid rgba(255,255,255,.14)">'
      + (num!=='' ? '<div style="font-size:44px;font-weight:900;line-height:1;letter-spacing:-.04em">'+esc(num==='0'?'●':num)+'</div><div style="font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.9">'+esc(num==='0'?'LIVE': num==='1'?'DAY LEFT':'DAYS')+'</div>' : '<i class="fas '+icon+'" style="font-size:28px;opacity:.95"></i>')
      + '</div></div>';
    var labelBlock='<div style="position:relative;text-align:center;padding:10px 12px 0"><div style="font-size:15px;font-weight:800;letter-spacing:.08em">'+esc(label)+'</div></div>';
    var titleBlock='<div style="position:relative;text-align:center;padding:14px 14px 0"><div style="font-size:20px;font-weight:800;line-height:1.2">'+esc(v.title||'Season Drop')+'</div></div>';
    var hookBlock='<div style="position:relative;text-align:center;padding:6px 14px 0"><div style="font-size:11px;color:rgba(255,255,255,.65);margin:0 auto 12px;max-width:260px;line-height:1.45">'+esc(v.hook||v.bio||"Something big is coming to DroBoard — don't miss it.")+'</div></div>';
    var ctaBlock='<div style="position:relative;text-align:center;padding:10px 14px 10px">'+ctaEl(v, link, storeUrl, acc)+'</div>';
    return canvasOpen + glow
      + B(v, [['eventPill',pillBlock],['countCircle',circleBlock],['countLabel',labelBlock],['midSpace','<div style="flex:1"></div>'],['title',titleBlock],['hook',hookBlock],['cta',ctaBlock],['tailSpace','<div style="flex:1"></div>'],['footer',footerBar(v, link, acc)]])
      + '</div>';
  },
};

function inlineRender(template, vars){
  var id=template.id;
  var link=(vars.link||'').trim();
  var storeUrl=(vars.storeUrl||'').trim();
  var cover=vars.cover||'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=600&h=600&fit=crop';
  var authorPhoto=vars.authorPhoto||'https://i.pravatar.cc/100?img=12';
  var fn=LAYOUTS[id];
  if(fn) return fn(template, vars, link, cover, authorPhoto, storeUrl);
  return LAYOUTS.tmpl_main(template, vars, link, cover, authorPhoto, storeUrl);
}

var backdrop=null, modal=null, currentTemplate=null, currentVars=null;
function ensureDOM(){
  if(backdrop) return;
  ensureCSS();
  backdrop=document.createElement('div'); backdrop.className='fp-backdrop';
  modal=document.createElement('div'); modal.className='fp-modal';
  modal.innerHTML=''
    + '<div class="fp-head"><b id="fpTitle">Flyer Preview</b><div class="fp-head-actions"><button onclick="FlyerPreview.close()">Close</button><button class="fp-primary" onclick="FlyerPreview.save()">Save</button></div></div>'
    + '<div class="fp-body"><div class="fp-form" id="fpForm"></div><div class="fp-preview-wrap"><div class="fp-preview-label">Live preview</div><div id="fpCanvasMount"></div></div></div>';
  backdrop.appendChild(modal); document.body.appendChild(backdrop);
  backdrop.addEventListener('click', function(e){ if(e.target===backdrop) FlyerPreview.close(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') FlyerPreview.close(); });
}
var onSaveCb=null;
function open(opts){
  opts=opts||{}; ensureDOM();
  var tid=opts.templateId || (global.FlyerTemplates && global.FlyerTemplates[0] && global.FlyerTemplates[0].id);
  var list=(global.FlyerTemplates||[]);
  currentTemplate = list.find(function(t){ return t.id===tid; }) || list[0];
  if(!currentTemplate) { console.warn('[FlyerPreview] no template found for', tid); return; }
  ensureCopyVars(currentTemplate);
  currentVars = Object.assign({ title:'', authorName:'', handle:'', userPhoto:'', bio:'', hook:'', genre:'', link:'', storeUrl:'', cover:'', authorPhoto:'', variant:'', platformTag:'', ctaText:'', accent:'', stats:null, _templateId: currentTemplate.id, _templateName: currentTemplate.name }, opts.vars||{});
  seedCopyVars(currentTemplate, currentVars);
  // Block layout state — fresh copies so cancelling an edit never leaks into
  // the saved template defaults the caller handed us.
  var sv=(opts.vars&&opts.vars.hidden)||null;
  var so=(opts.vars&&opts.vars.order)||null;
  currentVars.hidden=Object.assign({}, (sv&&typeof sv==='object')?sv:{});
  currentVars.order=(Object.prototype.toString.call(so)==='[object Array]')?so.slice():[];
  if(currentVars.link) currentVars.link=fixDomain(currentVars.link);
  if(currentVars.storeUrl) currentVars.storeUrl=fixDomain(currentVars.storeUrl);
  onSaveCb = opts.onSave || null;
  document.getElementById('fpTitle').textContent = currentTemplate.name;
  buildForm(); renderCanvas(); backdrop.classList.add('open');
}
function storyMatches(q, authorFilter){
  q=(q||'').toLowerCase();
  var libs=[];
  try{ if(global.StoryLibrary) libs=libs.concat(global.StoryLibrary); }catch(e){}
  try{ if(global.LaunchKitData) libs=libs.concat(global.LaunchKitData.map(function(k){ return { id:k.writerId||k.id, title:k.campaignName, cover:k.campaignImage, genre:'campaign', author:k.writerName, link:k.campaignLink }; })); }catch(e){}
  try{ if(global.DemoData && global.DemoData.STORIES) libs=libs.concat(global.DemoData.STORIES.map(function(s){ return { id:s.id, title:s.title, cover:s.cover, genre:s.genre||s.cat||'', author:s.author||'', authorPhoto:s.authorAv||'', hook:s.hook||s.preview||s.desc||'' }; })); }catch(e){}
  if(!q) return [];
  var pool = authorFilter ? libs.filter(function(s){ return (s.author||'').toLowerCase().indexOf(authorFilter.toLowerCase())!==-1; }) : libs;
  if(!pool.length) pool=libs;
  var hits=pool.filter(function(s){
    return (s.title||'').toLowerCase().indexOf(q)!==-1 || (s.genre||'').toLowerCase().indexOf(q)!==-1 || (s.author||'').toLowerCase().indexOf(q)!==-1;
  });
  // own / filtered author's stories first, then title-prefix matches
  var af=(authorFilter||'').toLowerCase();
  hits.sort(function(a,b){
    var ao=((a.author||'').toLowerCase().indexOf(af)!==-1 && af)?0:1;
    var bo=((b.author||'').toLowerCase().indexOf(af)!==-1 && af)?0:1;
    if(ao!==bo) return ao-bo;
    var at=(a.title||'').toLowerCase().indexOf(q)===0?0:1;
    var bt=(b.title||'').toLowerCase().indexOf(q)===0?0:1;
    return at-bt;
  });
  return hits.slice(0,6);
}
function authorPool(){
  var libs=[];
  try{ if(global.StoryLibrary) libs=libs.concat(global.StoryLibrary); }catch(e){}
  try{ if(global.LaunchKitData) libs=libs.concat(global.LaunchKitData.map(function(k){ return { author:k.writerName, photo:k.writerAvatar }; })); }catch(e){}
  try{ if(global.DemoData && global.DemoData.STORIES) libs=libs.concat(global.DemoData.STORIES); }catch(e){}
  var seen={}, out=[];
  libs.forEach(function(s){
    var name=(s.author||s.writerName||'').trim(); if(!name||seen[name.toLowerCase()]) return;
    seen[name.toLowerCase()]=1;
    out.push({ name:name, photo:s.authorPhoto||s.writerAvatar||s.authorAv||'', handle:'@'+name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') });
  });
  return out;
}
function authorMatches(q){
  q=(q||'').toLowerCase(); if(!q) return [];
  return authorPool().filter(function(a){ return a.name.toLowerCase().indexOf(q)!==-1; }).slice(0,6);
}
// ── Remote search — the local pools above are page data; the backend is the
// source of truth (works on every page, no StoryLibrary required).
function remoteQuery(qs){
  if(typeof fetch!=='function') return Promise.resolve(null);
  var base=(global.DROBOARD_API_BASE||'/api')+'/search/index';
  return fetch(base+'?'+qs, { credentials:'include' })
    .then(function(r){ if(!r.ok) throw new Error('http_'+r.status); return r.json(); })
    .catch(function(){ return null; });
}
function remoteStories(q, limit){
  return remoteQuery('type=books&limit='+(limit||8)+'&q='+encodeURIComponent(q)).then(function(j){
    if(!j||!j.books) return [];
    return j.books.map(function(b){
      return { id:b.id, title:b.title||'', cover:b.cover||'', genre:b.genre||'',
               author:b.author||'', authorPhoto:b.authorPhoto||'', hook:b.hook||'' };
    });
  });
}
function remoteAuthors(q){
  return remoteQuery('type=users&limit=6&q='+encodeURIComponent(q)).then(function(j){
    if(!j||!j.users) return [];
    return j.users.map(function(u){
      return { name:u.name||u.fullName||u.username||'', handle:u.handle||(u.username?'@'+u.username:''), photo:u.photo||u.avatar||'' };
    }).filter(function(a){ return a.name; });
  });
}
function mergeHits(local, remote){
  var seen={}, out=[];
  (local||[]).concat(remote||[]).forEach(function(h){
    var kId=String(h.id||'').toLowerCase(), kTitle=String(h.title||h.name||'').trim().toLowerCase();
    if((kId&&seen['i'+kId])||(kTitle&&seen['t'+kTitle])) return;
    if(kId) seen['i'+kId]=1;
    if(kTitle) seen['t'+kTitle]=1;
    out.push(h);
  });
  return out;
}
// Public API — other pages (author launch kit, promo cards) reuse the same
// local-pool-then-backend search without duplicating the fallback logic.
function searchStories(q, authorFilter){
  q=(q||'').trim(); if(!q) return Promise.resolve([]);
  var local=storyMatches(q, authorFilter);
  return remoteStories(q,8).then(function(r){ return mergeHits(local,r).slice(0,8); });
}
function searchAuthors(q){
  q=(q||'').trim(); if(!q) return Promise.resolve([]);
  var local=authorMatches(q);
  return remoteAuthors(q).then(function(r){ return mergeHits(local,r).slice(0,8); });
}
function fillFromAuthor(a){
  if(!a) return;
  currentVars.authorName=a.name||currentVars.authorName;
  if(a.photo) currentVars.authorPhoto=a.photo;
  if(a.handle) currentVars.handle=a.handle;
  buildForm(); renderCanvas();
}
function readerUrlFor(s){
  var id = s.id || s.storyId || '';
  return 'https://droboard.com/full-reader.html?story=' + encodeURIComponent(id || 'story');
}
function fixDomain(u){ return String(u || '').replace(/droboard\.app/gi, 'droboard.com'); }
function fillFromStory(s){
  if(!s) return;
  currentVars.title = s.title||currentVars.title;
  currentVars.cover = s.cover||s.campaignImage||currentVars.cover;
  currentVars.authorName = s.author||s.writerName||currentVars.authorName;
  currentVars.genre = s.genre||currentVars.genre;
  currentVars.hook = s.hook||s.preview||s.excerpt||s.desc||currentVars.hook;
  if(s.campaignLink || s.destination) currentVars.link = fixDomain(s.campaignLink||s.destination);
  else if(s.id || s.storyId) currentVars.link = readerUrlFor(s);
  else if(s.link) currentVars.link = fixDomain(s.link);
  if(s.authorPhoto||s.writerAvatar||s.authorAv) currentVars.authorPhoto=s.authorPhoto||s.writerAvatar||s.authorAv;
  buildForm(); renderCanvas();
}
function buildForm(){
  var el=document.getElementById('fpForm'); if(!el || !currentTemplate) return;
  var fields = currentTemplate.vars || [];
  var varsInfo = global.FlyerTemplateVars || {};
  var authorFilter = currentVars.authorName || '';
  el.innerHTML = ''
    + '<div class="fp-story-search" style="margin-bottom:10px">'
    + '<label style="display:block;font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">Search story (autofills below)</label>'
    + '<input id="fpStorySearch" placeholder="Type title, genre or author…" style="width:100%;padding:9px 11px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);font-size:12.5px;color:var(--text);font-family:inherit;outline:none"/>'
    + '<div class="fp-dropdown" id="fpDropdown"></div>'
    + '</div>'
    + '<div class="fp-story-search" style="margin-bottom:10px">'
    + '<label style="display:block;font-size:10.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">Search author (fills name/photo)</label>'
    + '<input id="fpAuthorSearch" placeholder="Type author name…" style="width:100%;padding:9px 11px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);font-size:12.5px;color:var(--text);font-family:inherit;outline:none"/>'
    + '<div class="fp-dropdown" id="fpAuthorDropdown"></div>'
    + '</div>'
    + '<div class="fp-field">'
    + '<label>Layout — drag to reorder, × to remove</label>'
    + '<div id="fpBlockList"></div>'
    + '<button type="button" class="fp-blk-rs" id="fpBlockReset">Reset layout</button>'
    + '</div>'
    + fields.map(function(key){
      var meta=varsInfo[key]||{label:key, type:'text'};
      var val=currentVars[key]||'';
      if(meta.type==='image'){
        return '<div class="fp-field"><label>'+esc(meta.label)+'</label><input data-var="'+key+'" value="'+esc(val)+'" placeholder="https://… image URL"/>'
          + '<div class="fp-file-row"><input type="file" accept="image/*" data-file-var="'+key+'"/><button type="button" class="fp-file-btn" data-file-var="'+key+'">Upload photo</button></div></div>';
      }
      if(meta.type==='color'){
        return '<div class="fp-field"><label>'+esc(meta.label)+'</label><div style="display:flex;gap:8px;align-items:center"><input type="color" data-var="'+key+'" value="'+esc(val||'#ff0050')+'" style="width:48px;height:36px;padding:2px;border-radius:6px;border:1px solid var(--input-border);cursor:pointer"/><span style="font-size:12px;color:var(--text-muted)">'+esc(val||'#ff0050')+'</span></div></div>';
      }
      if(key==='hook') return '<div class="fp-field"><label>'+esc(meta.label)+'</label><textarea data-var="'+key+'" rows="2" placeholder="One short, emotional, curiosity-driven hook">'+esc(val)+'</textarea></div>';
      if(meta.type==='textarea') return '<div class="fp-field"><label>'+esc(meta.label)+'</label><textarea data-var="'+key+'" rows="3" placeholder="'+esc(meta.label)+'">'+esc(val)+'</textarea></div>';
      if(key==='platformTag') return '<div class="fp-field"><label>'+esc(meta.label)+'</label><input data-var="'+key+'" value="'+esc(val)+'" placeholder="e.g. Invite friends, earn rewards"/></div>';
      return '<div class="fp-field"><label>'+esc(meta.label)+'</label><input data-var="'+key+'" value="'+esc(val)+'" placeholder="'+esc(meta.label)+'"/></div>';
    }).join('') + (currentTemplate.variants ? '<div class="fp-field"><label>Variant</label><select data-var="variant" style="width:100%;padding:9px 11px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);font-family:inherit;font-size:12.5px;color:var(--text)">'+currentTemplate.variants.map(function(v){ return '<option value="'+esc(v)+'"'+(currentVars.variant===v?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+'</select></div>' : '');
  var searchEl=document.getElementById('fpStorySearch');
  var dd=document.getElementById('fpDropdown');
  function paintStoryHits(hits){
    dd._hits=hits||[];
    if(!dd._hits.length){ dd.style.display='none'; return; }
    dd.innerHTML=dd._hits.map(function(s,i){
      return '<div class="fp-opt" data-i="'+i+'"><img src="'+esc(s.cover||'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop')+'" alt=""/><div><div class="t">'+esc(s.title||'')+'</div><div class="g">'+esc(s.genre||'')+' | '+esc(s.author||'')+'</div></div></div>';
    }).join('');
    dd.style.display='block';
    dd.querySelectorAll('.fp-opt').forEach(function(row){
      row.addEventListener('click', function(){
        var hit=dd._hits[parseInt(this.getAttribute('data-i'),10)];
        dd.style.display='none'; searchEl.value='';
        if(hit) fillFromStory(hit);
      });
    });
  }
  var storySeq=0, storyTimer=null;
  searchEl.addEventListener('input', function(){
    var q=this.value.trim();
    if(!q){ dd.style.display='none'; return; }
    paintStoryHits(storyMatches(q, authorFilter));
    var seq=++storySeq;
    clearTimeout(storyTimer);
    storyTimer=setTimeout(function(){
      if(seq!==storySeq || searchEl.value.trim()!==q) return;
      searchStories(q, authorFilter).then(function(hits){
        if(seq!==storySeq || searchEl.value.trim()!==q) return;
        paintStoryHits(hits);
      });
    }, 200);
  });
  var authorSearchEl=document.getElementById('fpAuthorSearch');
  var authorDd=document.getElementById('fpAuthorDropdown');
  if(authorSearchEl && authorDd){
    function paintAuthorHits(hits){
      authorDd._hits=hits||[];
      if(!authorDd._hits.length){ authorDd.style.display='none'; return; }
      authorDd.innerHTML=authorDd._hits.map(function(a,i){
        return '<div class="fp-opt" data-i="'+i+'">'
          + (a.photo?'<img src="'+esc(a.photo)+'" alt=""/>':'<div style="width:32px;height:44px;border-radius:4px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">'+esc((a.name||'?').charAt(0).toUpperCase())+'</div>')
          + '<div><div class="t">'+esc(a.name)+'</div><div class="g">'+esc(a.handle||'')+'</div></div></div>';
      }).join('');
      authorDd.style.display='block';
      authorDd.querySelectorAll('.fp-opt').forEach(function(row){
        row.addEventListener('click', function(){
          var hit=authorDd._hits[parseInt(this.getAttribute('data-i'),10)];
          authorDd.style.display='none'; authorSearchEl.value='';
          fillFromAuthor(hit||{name:''});
        });
      });
    }
    var authorSeq=0, authorTimer=null;
    authorSearchEl.addEventListener('input', function(){
      var q=this.value.trim();
      if(!q){ authorDd.style.display='none'; return; }
      paintAuthorHits(authorMatches(q));
      var seq=++authorSeq;
      clearTimeout(authorTimer);
      authorTimer=setTimeout(function(){
        if(seq!==authorSeq || authorSearchEl.value.trim()!==q) return;
        searchAuthors(q).then(function(hits){
          if(seq!==authorSeq || authorSearchEl.value.trim()!==q) return;
          paintAuthorHits(hits);
        });
      }, 200);
    });
  }
  el.querySelectorAll('[data-var]').forEach(function(inp){
    inp.addEventListener('input', function(){
      currentVars[this.getAttribute('data-var')] = this.value;
      var next=this.nextElementSibling;
      if(next && this.type==='color') next.textContent=this.value;
      renderCanvas();
    });
    if(inp.tagName==='SELECT') inp.addEventListener('change', function(){ currentVars[this.getAttribute('data-var')]=this.value; renderCanvas(); });
  });
  el.querySelectorAll('input[type=file][data-file-var]').forEach(function(fileInput){
    fileInput.addEventListener('change', function(){
      var key=this.getAttribute('data-file-var');
      var file=this.files && this.files[0]; if(!file) return;
      var reader=new FileReader();
      reader.onload=function(e){
        currentVars[key]=e.target.result;
        var urlInput=el.querySelector('input[data-var="'+key+'"]');
        if(urlInput) urlInput.value=e.target.result;
        renderCanvas();
      };
      reader.readAsDataURL(file);
    });
  });
  el.querySelectorAll('.fp-file-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var k=this.getAttribute('data-file-var');
      var fi=el.querySelector('input[type=file][data-file-var="'+k+'"]');
      if(fi) fi.click();
    });
  });
  paintLayoutList();
  var resetBtn=document.getElementById('fpBlockReset');
  if(resetBtn) resetBtn.addEventListener('click', function(){
    currentVars.hidden={}; currentVars.order=[];
    renderCanvas(); paintLayoutList();
  });
}
// ── Layout list: drag top-level rows to rearrange, × to remove / + to restore.
function toggleBlock(key){
  if(!currentVars || !key) return;
  currentVars.hidden=currentVars.hidden||{};
  currentVars.hidden[key]=!currentVars.hidden[key];
  renderCanvas(); paintLayoutList();
}
function paintLayoutList(){
  var wrap=document.getElementById('fpBlockList'); if(!wrap || !currentTemplate) return;
  var reg=blockRegistry(currentTemplate.id);
  if(!reg.length){ wrap.innerHTML='<div style="font-size:11px;color:var(--text-muted)">No movable blocks on this template.</div>'; return; }
  var v=currentVars; v.hidden=v.hidden||{}; v.order=v.order||[];
  var top=reg.filter(function(r){ return !r.nested; });
  var byKey={}; reg.forEach(function(r){ byKey[r.key]=r; });
  var order=v.order.filter(function(k){ return !!byKey[k] && !byKey[k].nested; });
  top.forEach(function(r){ if(order.indexOf(r.key)===-1) order.push(r.key); });
  var rows=[];
  order.forEach(function(k){
    if(!byKey[k]) return;
    rows.push(byKey[k]);
    reg.forEach(function(r){ if(r.nested && r.parent===k) rows.push(r); });
  });
  reg.forEach(function(r){ if(r.nested && rows.indexOf(r)===-1) rows.push(r); });
  wrap.innerHTML=rows.map(function(r){
    var off=!!v.hidden[r.key];
    return '<div class="fp-blk'+(off?' off':'')+'" data-key="'+r.key+'"'+(r.nested?' data-nested="1"':'')+'>'
      + '<i class="fas fa-grip-vertical fp-grip"'+(r.nested?' style="visibility:hidden"':'')+'></i>'
      + '<span class="fp-blk-nm">'+esc(r.label)+'</span>'
      + '<button type="button" class="fp-blk-t" data-key="'+r.key+'" title="'+(off?'Show block':'Remove block')+'">'+(off?'+':'×')+'</button>'
      + '</div>';
  }).join('');
  wrap.querySelectorAll('.fp-blk-t').forEach(function(btn){
    btn.addEventListener('click', function(e){ e.preventDefault(); toggleBlock(this.getAttribute('data-key')); });
  });
  wrap.querySelectorAll('.fp-blk').forEach(function(row){
    row.addEventListener('pointerdown', function(e){
      if(e.pointerType==='mouse' && e.button!==0 && e.button!==undefined) return;
      if(e.target && e.target.closest && e.target.closest('.fp-blk-t')) return;
      beginListDrag(row, wrap, e);
    });
  });
}
// ── Pointer-based drag (mouse + touch) — HTML5 DnD is flaky and dead on touch.
function clientYOf(e){
  if(e.touches && e.touches[0]) return e.touches[0].clientY;
  if(e.changedTouches && e.changedTouches.length) return e.changedTouches[e.changedTouches.length-1].clientY;
  return e.clientY;
}
function commitListOrder(wrap){
  var keys=Array.prototype.map.call(wrap.querySelectorAll('.fp-blk:not([data-nested="1"])'), function(n){ return n.getAttribute('data-key'); });
  if(keys.length){ currentVars.order=keys; renderCanvas(); paintLayoutList(); }
}
function beginListDrag(row, wrap, e){
  var startY=e.clientY, active=false;
  function move(ev){
    var y=clientYOf(ev);
    if(!active){ if(Math.abs(y-startY)<5) return; active=true; row.classList.add('dragging'); }
    if(ev.cancelable) ev.preventDefault();
    var kids=Array.prototype.filter.call(wrap.children, function(n){ return n.classList && n.classList.contains('fp-blk'); });
    for(var i=0;i<kids.length;i++){
      var r=kids[i]; if(r===row) continue;
      var rect=r.getBoundingClientRect();
      if(y>=rect.top && y<=rect.bottom){
        var ref=(y < rect.top+rect.height/2) ? r : r.nextSibling;
        if(ref!==row && ref!==row.nextSibling) wrap.insertBefore(row, ref);
        break;
      }
    }
  }
  function up(){
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    if(active){ row.classList.remove('dragging'); commitListOrder(wrap); }
  }
  document.addEventListener('pointermove', move, {passive:false});
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
// Canvas drag: grip appears on hover (top-level blocks only) — drop a block
// between two others to restack, exactly like the layout list.
function beginCanvasDrag(block, e){
  var canvas=block.parentElement;
  var startY=e.clientY, active=false;
  function topBlocks(){
    return Array.prototype.filter.call(canvas.children, function(n){ return n.getAttribute && n.getAttribute('data-fp-block'); });
  }
  function move(ev){
    var y=clientYOf(ev);
    if(!active){ if(Math.abs(y-startY)<5) return; active=true; block.classList.add('dragging'); }
    if(ev.cancelable) ev.preventDefault();
    var sibs=topBlocks();
    for(var i=0;i<sibs.length;i++){
      var b=sibs[i]; if(b===block) continue;
      var rect=b.getBoundingClientRect();
      if(y>=rect.top && y<=rect.bottom){
        var ref=(y < rect.top+rect.height/2) ? b : b.nextSibling;
        if(ref!==block && ref!==block.nextSibling) canvas.insertBefore(block, ref);
        break;
      }
    }
  }
  function up(){
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    if(!active) return;
    var keys=topBlocks().map(function(b){ return b.getAttribute('data-fp-block'); });
    if(keys.length){ currentVars.order=keys; renderCanvas(); paintLayoutList(); }
  }
  document.addEventListener('pointermove', move, {passive:false});
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
// ── Canvas × buttons — one per block, hidden during Share/Download capture.
function decorateCanvas(){
  var mount=document.getElementById('fpCanvasMount'); if(!mount) return;
  mount.querySelectorAll('[data-fp-block]').forEach(function(el){
    var has=false;
    for(var i=0;i<el.children.length;i++){ if(el.children[i].className==='fp-x'){ has=true; break; } }
    if(has) return;
    var btn=document.createElement('button');
    btn.type='button'; btn.className='fp-x'; btn.setAttribute('data-fp-chrome','1');
    btn.textContent='×'; btn.title='Remove this block';
    btn.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      toggleBlock(el.getAttribute('data-fp-block'));
    });
    el.appendChild(btn);
    // top-level blocks also get a drag grip (nested blocks ride their parent)
    var par=el.parentElement;
    if(par && par.classList && par.classList.contains('fp-canvas')){
      var g=document.createElement('button');
      g.type='button'; g.className='fp-g'; g.setAttribute('data-fp-chrome','1');
      g.textContent='≡'; g.title='Drag to reorder';
      g.addEventListener('pointerdown', function(ev){
        ev.preventDefault(); ev.stopPropagation();
        beginCanvasDrag(el, ev);
      });
      el.appendChild(g);
    }
  });
}
function renderCanvas(){
  var mount=document.getElementById('fpCanvasMount'); if(!mount || !currentTemplate) return;
  mount.innerHTML = inlineRender(currentTemplate, currentVars);
  hydrateQR(mount);
  decorateCanvas();
}
function close(){ if(backdrop) backdrop.classList.remove('open'); }
function save(){ if(typeof onSaveCb==='function') try{ onSaveCb(currentTemplate, Object.assign({}, currentVars)); }catch(e){} close(); }
function renderInline(containerEl, templateId, vars){
  ensureCSS();
  var list=(global.FlyerTemplates||[]); var t=list.find(function(x){ return x.id===templateId; })||list[0]; if(!t||!containerEl) return;
  containerEl.innerHTML = inlineRender(t, vars||{});
  hydrateQR(containerEl);
}

global.FlyerPreview = { open:open, close:close, save:save, share:shareCurrent, download:downloadCurrent, render:renderInline, inlineRender:inlineRender, searchStories:searchStories, searchAuthors:searchAuthors, qr:{ load:loadQRLib, draw:hydrateQR, box:qrBoxHTML } };
})(window);