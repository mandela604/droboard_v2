/**
 * flyer-preview.js — Live flyer preview renderer (Marketing owns the system)
 * Vars can be filled via: typing, file upload (author photo / cover / user photo),
 * searchable story dropdown (autofills title/cover/author/genre/hook/link).
 * CTA always carries the author's inserted link (+ optional Store link).
 * No raw URL pill — only "Available on DroBoard" + CTA.
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

var styleEl=null;
function ensureCSS(){ if(styleEl) return; styleEl=document.createElement('style'); styleEl.textContent=CSS; document.head.appendChild(styleEl); }
function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

var DEMO_STATS = { reads:12800, followers:420, books:7, following:156, likes:3100 };
function pickCta(v, fallback){
  return (v.ctaText||'').trim() || fallback || 'READ NOW →';
}
function ctaEl(v, link, storeUrl, accent){
  var isFollowTpl = /spotlight|follow_me|reader|platform_reader|platform_invite/.test(v._templateId||'') || /spotlight|follow me|reader|invite/i.test(v._templateName||'');
  var fallback = isFollowTpl ? 'Follow Me →' : 'READ NOW →';
  var text = pickCta(v, fallback);
  var isFollow = /follow/i.test(text);
  // CTA href is the link the writer pasted; Store is no longer a separate pill — it's just another link option
  var target = (v.link||link||'').trim() || '#';
  var bg = v.accent || accent || 'var(--accent)';
  if(target && target !== '#') return '<a href="'+esc(target)+'" target="_blank" rel="noopener" class="fp-canvas-cta" style="background:'+esc(bg)+';text-decoration:none">'+esc(text)+'</a>';
  return '<span class="fp-canvas-cta" style="background:'+esc(bg)+'">'+esc(text)+'</span>';
}
function linkRow(link, storeUrl){
  // No Store pill here anymore — per request. Only the DroBoard badge remains.
  return '<div class="fp-canvas-link-row"><span style="font-size:8px;color:rgba(255,255,255,.45)">Available on DroBoard</span></div>';
}
function statsRow(v){
  var s=v.stats || DEMO_STATS;
  var reads=s.reads!=null?s.reads:(s.hoursRead!=null?s.hoursRead:DEMO_STATS.reads);
  var followers=s.followers!=null?s.followers:(s.booksRead!=null?s.booksRead:DEMO_STATS.followers);
  var books=s.books!=null?s.books:(s.streak!=null?s.streak:DEMO_STATS.books);
  return '<div style="display:flex;gap:6px;margin:8px 0 6px"><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+(reads>=1000? (reads/1000|0)+'K' : reads)+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Reads</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+followers+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Followers</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+books+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Books</small></span></div>';
}
function statsRowReader(v){
  var s=v.stats || { hoursRead:48, booksRead:12, streak:7 };
  var h=s.hoursRead!=null?s.hoursRead:(s.reads!=null?s.reads:48);
  var b=s.booksRead!=null?s.booksRead:(s.books!=null?s.books:12);
  var st=s.streak!=null?s.streak:(s.followers!=null?s.followers:7);
  return '<div style="display:flex;gap:6px;margin:8px 0 6px"><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+h+'h</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Hours read</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+b+'</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Books read</small></span><span style="flex:1;text-align:center;padding:6px 4px;border-radius:8px;background:rgba(255,255,255,.08)"><b style="display:block;font-size:13px;color:#fff">'+st+'d</b><small style="font-size:8px;color:rgba(255,255,255,.55)">Streak</small></span></div>';
}

// ── Per-template renderers (each visually distinct) ──
var LAYOUTS = {
  tmpl_main: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||t.accent||'#ff0050';
    return '<div class="fp-canvas sq"><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:46%" alt=""/><div class="fp-canvas-body"><div class="fp-canvas-kicker">'+esc(v.genre||'Featured')+' · DroBoard</div><div class="fp-canvas-title">'+esc(v.title||'Your Story Title')+'</div><div class="fp-canvas-author">By '+esc(v.authorName||'Author Name')+'</div><div class="fp-canvas-hook">"'+esc(v.hook||'One emotional, curiosity-driven hook from the story.')+'"</div>'+ctaEl(v, link, storeUrl, acc)+linkRow(link, storeUrl)+'</div></div>';
  },
  tmpl_wa_status: function(t, v, link, cover, authorPhoto, storeUrl){
    return '<div class="fp-canvas v9"><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:44%" alt=""/><div class="fp-canvas-body" style="background:linear-gradient(180deg,rgba(15,15,34,0) 0%,#0f0f22 8%)"><div class="fp-author-row"><img src="'+esc(authorPhoto)+'" alt=""/><span style="font-size:10.5px;font-weight:700">'+esc(v.authorName||'Author Name')+'</span><span style="margin-left:auto;font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:#25d366;color:#fff;padding:3px 7px;border-radius:20px">WhatsApp</span></div><div style="font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#25d366;margin:6px 0 4px">YOU NEED TO READ THIS STORY.</div><div class="fp-canvas-title">'+esc(v.title||'Your Story Title')+'</div><div class="fp-canvas-hook">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div>'+ctaEl(v, link, storeUrl, v.accent||'#25d366')+linkRow(link, storeUrl)+'</div></div>';
  },
  tmpl_wa_share: function(t, v, link, cover, authorPhoto, storeUrl){
    return '<div class="fp-canvas sq" style="background:#fff;color:#1a1730"><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:50%" alt=""/><div class="fp-canvas-body" style="background:#fff"><div class="fp-canvas-title" style="color:#1a1730">'+esc(v.title||'Your Story Title')+'</div><div style="font-size:9px;color:#8e8e93;margin-bottom:6px">By '+esc(v.authorName||'Author Name')+'</div><div class="fp-canvas-hook" style="color:#434059;border-left-color:#25d366;background:#f4f4fb">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div>'+ctaEl(v, link, storeUrl, v.accent||'#25d366')+'<div style="margin-top:10px;padding-top:10px;border-top:1px solid #eceaf5;display:flex;align-items:center;gap:6px;font-size:8px;color:#9694ac">Available on DroBoard'+(storeUrl?'<a href="'+esc(storeUrl)+'" target="_blank" style="margin-left:auto;background:#25d366;color:#fff;padding:4px 10px;border-radius:8px;text-decoration:none;font-size:9px;font-weight:700"><i class="fas fa-store"></i> Store</a>':'')+'</div></div></div>';
  },
  tmpl_teaser: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#7c3aed';
    return '<div class="fp-canvas sq" style="background:#1a1033;color:#fff"><div style="padding:14px 14px 10px"><div style="font-size:24px;color:'+esc(acc)+';margin-bottom:6px">"</div><div style="font-size:13px;line-height:1.5;font-weight:600;color:#fff;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">"'+esc(v.hook||'One emotional, curiosity-driven hook from the story that makes you need to read the next page.')+'"</div></div><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:36%;border-radius:10px;margin:0 14px;width:calc(100% - 28px)" alt=""/><div class="fp-canvas-body"><div class="fp-canvas-title" style="font-size:14px">'+esc(v.title||'Your Story Title')+'</div><div style="font-size:10px;color:rgba(255,255,255,.6)">'+esc(v.genre||'Romance')+' · DroBoard</div>'+ctaEl(v, link, storeUrl, acc)+linkRow(link, storeUrl)+'</div></div>';
  },
  tmpl_drop: function(t, v, link, cover, authorPhoto, storeUrl){
    return '<div class="fp-canvas sq"><div style="text-align:center;padding:7px 10px;background:linear-gradient(90deg,#f59e0b,#ff0050);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">NEW CHAPTER OUT NOW</div><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:42%" alt=""/><div class="fp-canvas-body"><div class="fp-canvas-title">'+esc(v.title||'Your Story Title')+'</div><div class="fp-canvas-author">By '+esc(v.authorName||'Author Name')+'</div><div class="fp-canvas-hook">"'+esc(v.hook||'What happens next will leave you speechless.')+'"</div>'+ctaEl(v, link, storeUrl, v.accent||'#f59e0b')+linkRow(link, storeUrl)+'</div></div>';
  },
  tmpl_tiktok: function(t, v, link, cover, authorPhoto, storeUrl){
    return '<div class="fp-canvas v9"><div style="padding:10px 14px;background:#000;display:flex;align-items:center;gap:8px"><i class="fab fa-tiktok" style="color:#fff;font-size:14px"></i><span style="font-size:10px;font-weight:800;letter-spacing:.06em">DroBoard</span><span style="margin-left:auto;font-size:8px;background:rgba(255,255,255,.14);padding:3px 7px;border-radius:20px">9:16 COVER</span></div><img class="fp-canvas-img" src="'+esc(cover)+'" style="height:44%" alt=""/><div class="fp-canvas-body"><div class="fp-canvas-title">'+esc(v.title||'Your Story Title')+'</div><div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-bottom:6px">By '+esc(v.authorName||'Author Name')+'</div><div class="fp-canvas-hook" style="background:rgba(255,255,255,.06);border-left-color:#000">"'+esc(v.hook||'One emotional, curiosity-driven hook.')+'"</div>'+ctaEl(v, link, storeUrl, v.accent||'#000')+linkRow(link, storeUrl)+'</div></div>';
  },
  tmpl_spotlight: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#a78bfa';
    var bio=esc(v.bio||v.hook||'Writer of heartfelt stories. Follow me for new chapters every week.');
    var ctaText=(v.ctaText||'Follow Me →').trim()||'Follow Me →';
    var v2=Object.assign({}, v, {ctaText:ctaText});
    return '<div class="fp-canvas sq"><div style="display:flex;gap:12px;padding:14px"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid '+esc(acc)+'" alt=""/><div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+esc(acc)+'">Author Spotlight</div><div style="font-size:15px;font-weight:800;margin:2px 0">'+esc(v.authorName||'Author Name')+'</div><div style="font-size:10px;color:rgba(255,255,255,.65)">'+esc(v.handle||'@username')+' · '+esc(v.genre||'Writer')+'</div>'+statsRow(v)+'</div></div><div style="padding:0 14px 6px"><div style="font-size:11px;line-height:1.5;color:rgba(255,255,255,.82)">'+bio+'</div></div><div class="fp-canvas-body" style="padding-top:6px"><div style="display:flex;justify-content:center">'+ctaEl(v2, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>'+linkRow(link, storeUrl).replace('fp-canvas-link-row','fp-canvas-link-row" style="justify-content:center')+'</div></div>';
  },
  tmpl_follow_me: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#ff0050';
    return '<div class="fp-canvas sq" style="background:linear-gradient(135deg,#1a1033 30%,#0f0f22 100%)"><div style="text-align:center;padding:14px 14px 6px"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:3px solid '+esc(acc)+';margin:0 auto 8px;display:block" alt=""/><div style="font-size:15px;font-weight:800">'+esc(v.authorName||'Author Name')+'</div><div style="font-size:11px;color:'+esc(acc)+';font-weight:700">'+esc(v.handle||'@username')+'</div>'+statsRow(v)+'</div><div class="fp-canvas-body"><div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:8px;text-align:center">'+esc(v.hook||'Follow my stories on DroBoard — new chapters weekly.')+'</div><div style="display:flex;justify-content:center">'+ctaEl(v, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>'+linkRow(link, storeUrl).replace('fp-canvas-link-row','fp-canvas-link-row" style="justify-content:center')+'</div></div>';
  },
  tmpl_platform_invite: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#ff0050';
    var photo=v.userPhoto||authorPhoto||'https://i.pravatar.cc/150?img=12';
    return '<div class="fp-canvas v9" style="background:linear-gradient(180deg,#1a1033 0%,#0f0f22 45%,#1e1235 100%);display:flex;flex-direction:column"><div style="text-align:center;padding:16px 14px 12px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center"><img src="'+esc(photo)+'" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid '+esc(acc)+';margin:0 auto 10px;display:block" alt=""/><div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:'+esc(acc)+'">Invite friends</div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.7);margin:4px 0">'+esc(v.handle||'@username')+'</div><div style="font-size:17px;font-weight:800;line-height:1.25;margin:6px 0;max-width:260px">'+esc(v.platformTag||'Discover stories worth sharing.')+'</div><div style="font-size:11px;color:rgba(255,255,255,.6)">Join <b style="color:#fff">DroBoard</b> — where stories come alive</div></div><div style="padding:12px 14px 14px;text-align:center">'+ctaEl(v, link, storeUrl, acc)+'<div style="margin-top:8px">'+linkRow(link, storeUrl).replace('class="fp-canvas-link-row"','style="display:flex;justify-content:center"')+'</div></div></div>';
  },
  tmpl_platform_reader: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#0ea5e9';
    return '<div class="fp-canvas sq"><div style="text-align:center;padding:14px 14px 6px"><img src="'+esc(v.userPhoto||authorPhoto)+'" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid '+esc(acc)+';margin:0 auto 8px;display:block" alt=""/><div style="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+esc(acc)+'">Reader on DroBoard</div><div style="font-size:14px;font-weight:800;margin:2px 0">'+esc(v.handle||'@reader')+' · '+esc(v.authorName||'Reader')+'</div><div style="font-size:11px;color:rgba(255,255,255,.65);margin-bottom:4px">'+esc(v.bio||v.hook||'Love romance & mystery. Always has a book open.')+'</div>'+statsRowReader(v)+'</div><div class="fp-canvas-body"><div style="display:flex;justify-content:center">'+ctaEl(v, link, storeUrl, acc).replace('align-self:flex-start','align-self:center')+'</div>'+linkRow(link, storeUrl).replace('fp-canvas-link-row','fp-canvas-link-row" style="justify-content:center')+'</div></div>';
  },
  tmpl_platform_promo: function(t, v, link, cover, authorPhoto, storeUrl){
    var acc=v.accent||'#7c3aed';
    return '<div class="fp-canvas sq" style="background:linear-gradient(135deg,#1e1235,#0f0f22)"><img class="fp-canvas-img" src="'+esc(cover||'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=600&fit=crop')+'" style="height:50%" alt=""/><div class="fp-canvas-body"><div class="fp-canvas-kicker" style="color:'+esc(acc)+'">'+esc(v.genre||'Featured')+' · DroBoard</div><div class="fp-canvas-title">'+esc(v.title||'Platform Feature Drop')+'</div><div class="fp-canvas-hook">"'+esc(v.hook||'A new season of stories is here. Dont miss it.')+'"</div>'+ctaEl(v, link, storeUrl, acc)+linkRow(link, storeUrl)+'</div></div>';
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
    return '<div class="fp-canvas v9" style="background:radial-gradient(520px 360px at 50% -8%, '+esc(acc)+' 0%, #1a1033 42%, #0f0f22 75%, #0a0a18 100%);display:flex;flex-direction:column;position:relative;overflow:hidden">'
      + '<div style="position:absolute;inset:0;opacity:.10;background:radial-gradient(600px 220px at 50% 22%, #fff, transparent 60%)"></div>'
      + '<div style="position:relative;text-align:center;padding:14px 12px 10px">'
      + '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.9)"><i class="fas '+icon+'"></i> DroBoard · Platform Event</div>'
      + '<div style="margin:12px auto 0;width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,'+esc(acc)+',#ff0050);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.35);border:3px solid rgba(255,255,255,.14)">'
      + (num!=='' ? '<div style="font-size:44px;font-weight:900;line-height:1;letter-spacing:-.04em">'+esc(num==='0'?'●':num)+'</div><div style="font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.9">'+esc(num==='0'?'LIVE': num==='1'?'DAY LEFT':'DAYS')+'</div>' : '<i class="fas '+icon+'" style="font-size:28px;opacity:.95"></i>')
      + '</div>'
      + '<div style="margin-top:10px;font-size:15px;font-weight:800;letter-spacing:.08em">'+esc(label)+'</div>'
      + '</div>'
      + '<div style="position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 14px 10px;text-align:center">'
      + '<div style="font-size:20px;font-weight:800;line-height:1.2">'+esc(v.title||'Season Drop')+'</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,.65);margin:6px 0 12px;max-width:260px;line-height:1.45">'+esc(v.hook||v.bio||'Something big is coming to DroBoard — don\'t miss it.')+'</div>'
      + ctaEl(v, link, storeUrl, acc)
      + '</div>'
      + '<div style="position:relative;padding:10px 14px 12px">'+linkRow(link, storeUrl)+'</div>'
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
  currentVars = Object.assign({ title:'', authorName:'', handle:'', userPhoto:'', bio:'', hook:'', genre:'', link:'', storeUrl:'', cover:'', authorPhoto:'', variant:'', platformTag:'', ctaText:'', accent:'', stats:null, _templateId: currentTemplate.id, _templateName: currentTemplate.name }, opts.vars||{});
  onSaveCb = opts.onSave || null;
  document.getElementById('fpTitle').textContent = currentTemplate.name;
  buildForm(); renderCanvas(); backdrop.classList.add('open');
}
function storyMatches(q, authorFilter){
  q=(q||'').toLowerCase();
  var libs=[];
  try{ if(global.StoryLibrary) libs=libs.concat(global.StoryLibrary); }catch(e){}
  try{ if(global.LaunchKitData) libs=libs.concat(global.LaunchKitData.map(function(k){ return { id:k.writerId||k.id, title:k.campaignName, cover:k.campaignImage, genre:'campaign', author:k.writerName, link:k.campaignLink }; })); }catch(e){}
  try{ if(global.DemoData && global.DemoData.STORIES) libs=libs.concat(global.DemoData.STORIES.map(function(s){ return { id:s.id, title:s.title, cover:s.cover, genre:s.genre||'', author:s.author||'', hook:s.hook||s.preview||'' }; })); }catch(e){}
  if(!q) return [];
  var pool = authorFilter ? libs.filter(function(s){ return (s.author||'').toLowerCase().indexOf(authorFilter.toLowerCase())!==-1; }) : libs;
  if(!pool.length) pool=libs;
  return pool.filter(function(s){
    return (s.title||'').toLowerCase().indexOf(q)!==-1 || (s.genre||'').toLowerCase().indexOf(q)!==-1 || (s.author||'').toLowerCase().indexOf(q)!==-1;
  }).slice(0,6);
}
function fillFromStory(s){
  if(!s) return;
  currentVars.title = s.title||currentVars.title;
  currentVars.cover = s.cover||s.campaignImage||currentVars.cover;
  currentVars.authorName = s.author||s.writerName||currentVars.authorName;
  currentVars.genre = s.genre||currentVars.genre;
  currentVars.hook = s.hook||s.preview||s.excerpt||currentVars.hook;
  currentVars.link = s.link||s.campaignLink||s.destination||currentVars.link;
  if(s.authorPhoto||s.writerAvatar) currentVars.authorPhoto=s.authorPhoto||s.writerAvatar;
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
      if(key==='platformTag') return '<div class="fp-field"><label>'+esc(meta.label)+'</label><input data-var="'+key+'" value="'+esc(val)+'" placeholder="e.g. Invite friends, earn rewards"/></div>';
      return '<div class="fp-field"><label>'+esc(meta.label)+'</label><input data-var="'+key+'" value="'+esc(val)+'" placeholder="'+esc(meta.label)+'"/></div>';
    }).join('') + (currentTemplate.variants ? '<div class="fp-field"><label>Variant</label><select data-var="variant" style="width:100%;padding:9px 11px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);font-family:inherit;font-size:12.5px;color:var(--text)">'+currentTemplate.variants.map(function(v){ return '<option value="'+esc(v)+'"'+(currentVars.variant===v?' selected':'')+'>'+esc(v)+'</option>'; }).join('')+'</select></div>' : '');
  var searchEl=document.getElementById('fpStorySearch');
  var dd=document.getElementById('fpDropdown');
  searchEl.addEventListener('input', function(){
    var q=this.value.trim(); if(!q){ dd.style.display='none'; return; }
    var hits=storyMatches(q, authorFilter);
    if(!hits.length){ dd.style.display='none'; return; }
    dd.innerHTML=hits.map(function(s){
      return '<div class="fp-opt" data-pick="'+esc(s.id||s.title)+'"><img src="'+esc(s.cover||'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=400&fit=crop')+'" alt=""/><div><div class="t">'+esc(s.title)+'</div><div class="g">'+esc(s.genre||'')+' | '+esc(s.author||'')+'</div></div></div>';
    }).join('');
    dd.style.display='block';
    dd.querySelectorAll('.fp-opt').forEach(function(row){
      row.addEventListener('click', function(){
        var pid=this.getAttribute('data-pick');
        var pool=[]; try{ if(global.StoryLibrary) pool=pool.concat(global.StoryLibrary);}catch(e){}
        try{ if(global.LaunchKitData) pool=pool.concat(global.LaunchKitData);}catch(e){}
        try{ if(global.DemoData && global.DemoData.STORIES) pool=pool.concat(global.DemoData.STORIES);}catch(e){}
        var found=pool.find(function(x){ return (x.id===pid)||(x.title===pid); });
        if(!found) found={ title:row.querySelector('.t').textContent, cover:row.querySelector('img').src, genre:row.querySelector('.g').textContent.split('|')[0].trim(), author:row.querySelector('.g').textContent.split('|')[1]?.trim()||'', link:'' };
        dd.style.display='none'; searchEl.value='';
        fillFromStory(found);
      });
    });
  });
  el.querySelectorAll('[data-var]').forEach(function(inp){
    inp.addEventListener('input', function(){
      currentVars[this.getAttribute('data-var')] = this.value;
      // sync color text next to picker
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
}
function renderCanvas(){
  var mount=document.getElementById('fpCanvasMount'); if(!mount || !currentTemplate) return;
  mount.innerHTML = inlineRender(currentTemplate, currentVars);
}
function close(){ if(backdrop) backdrop.classList.remove('open'); }
function save(){ if(typeof onSaveCb==='function') try{ onSaveCb(currentTemplate, Object.assign({}, currentVars)); }catch(e){} close(); }
function renderInline(containerEl, templateId, vars){
  ensureCSS();
  var list=(global.FlyerTemplates||[]); var t=list.find(function(x){ return x.id===templateId; })||list[0]; if(!t||!containerEl) return;
  containerEl.innerHTML = inlineRender(t, vars||{});
}

global.FlyerPreview = { open:open, close:close, save:save, render:renderInline, inlineRender:inlineRender };
})(window);
