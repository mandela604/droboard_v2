/**
 * boards-overlay.js — Droboard Boards Explorer Overlay (full page)
 * ─────────────────────────────────────────────────────────────────
 * Self-contained component for "View all boards" from My Circles.
 * Shows Joined hubs + Explore more hubs, with ad slots every 6 boards.
 * Full page overlay (covers feed), not a side drawer.
 *
 * Usage:
 *   <script src="component/boards-overlay.js"></script>
 *   BoardsOverlay.open({ joined: [...], rest: [...], all: [...] });
 *   BoardsOverlay.close();
 */
(function(){
  'use strict';
  if(window.__boardsOverlay) return;
  window.__boardsOverlay = true;

  const CSS = `
    .bbo-root{position:fixed;inset:0;z-index:4000;background:var(--bg,#fff);display:none;flex-direction:column;}
    .bbo-root.open{display:flex}
    .bbo-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border,#f1f1f1);background:var(--bg,#fff);flex-shrink:0}
    .bbo-back{width:36px;height:36px;border-radius:50%;border:1px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
    .bbo-back:active{transform:scale(.92)}
    .bbo-title{font-size:16px;font-weight:800;color:var(--tx,#1a1a2e);flex:1}
    .bbo-head .bbo-back:last-child{margin-left:auto}
    .bbo-scroll{flex:1;overflow-y:auto;padding:16px;max-width:420px;width:100%;margin:0 auto;box-sizing:border-box}
    .bbo-section-label{font-size:11px;font-weight:800;color:var(--tx-muted,#6b7280);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
    .bbo-card{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border,#f1f1f1);border-radius:10px;margin-bottom:8px;background:var(--l1,#fff);text-decoration:none;color:inherit}
    .bbo-card:active{transform:scale(.98)}
    .bbo-card-icon{width:36px;height:36px;border-radius:8px;background:var(--l1,#f8f9fa);display:flex;align-items:center;justify-content:center;color:var(--acc,#ff0050);flex-shrink:0;font-size:14px}
    .bbo-card-body{flex:1;min-width:0}
    .bbo-card-title{font-size:13px;font-weight:700;color:var(--tx,#1a1a2e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bbo-card-sub{font-size:11px;color:var(--tx-muted,#6b7280);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bbo-ad{border:1px solid var(--border,#f1f1f1);border-radius:12px;padding:12px;margin-bottom:8px;background:linear-gradient(135deg,rgba(255,0,80,.06),rgba(167,139,250,.04));display:flex;gap:10px;align-items:center}
    .bbo-ad-icon{width:48px;height:48px;border-radius:8px;background:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0}
    .bbo-ad-body{flex:1;min-width:0}
    .bbo-ad-tag{font-size:9px;font-weight:800;color:var(--acc,#ff0050);text-transform:uppercase}
    .bbo-ad-title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bbo-ad-sub{font-size:11px;color:var(--tx-muted,#6b7280)}
    .bbo-ad-cta{background:var(--acc,#ff0050);color:#fff;border:none;padding:7px 12px;border-radius:8px;font-size:11px;font-weight:700;flex-shrink:0;cursor:pointer}
    [data-theme="dark"] .bbo-root{background:#000}
    [data-theme="dark"] .bbo-head{background:#000;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .bbo-card{background:#0e0f13;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .bbo-card-icon{background:#1a1b22}
    [data-theme="dark"] .bbo-ad{background:linear-gradient(135deg,rgba(255,0,80,.08),rgba(167,139,250,.06));border-color:rgba(255,255,255,.08)}
  `;

  let _built=false, _root=null;

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function ensureDom(){
    if(_built) return;
    _built=true;
    const style=document.createElement('style');
    style.id='bbo-style';
    style.textContent=CSS;
    document.head.appendChild(style);
    const wrap=document.createElement('div');
    wrap.innerHTML=`
      <div class="bbo-root" id="bboRoot">
        <div class="bbo-head">
          <button class="bbo-back" id="bboBack" aria-label="Back"><i class="fas fa-arrow-left"></i></button>
          <div class="bbo-title" style="flex:1">My Boards</div>
          <button class="bbo-back" id="bboSearch" data-search-trigger aria-label="Search"><i class="fas fa-magnifying-glass"></i></button>
          <a href="store.html" class="bbo-back" id="bboStore" aria-label="Store" style="text-decoration:none;background:var(--acc-light,rgba(255,0,80,.08));color:var(--acc,#ff0050);border-color:rgba(255,0,80,.15)"><svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg></a>
        </div>
        <div class="bbo-scroll" id="bboScroll"></div>
      </div>
    `.trim();
    while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
    _root=document.getElementById('bboRoot');
    document.getElementById('bboBack').addEventListener('click', close);
    _root.addEventListener('click', e=>{ if(e.target===_root) close(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && _root.classList.contains('open')) close(); });
  }

  function storyAdHtml(){
    // try ad component + service first, fallback to simple
    try{
      if(window.DroboardAdCard && window.AdService){
        // attempt to get a book ad from AdService pools (sync fallback)
        // AdService.getAds is async, so use a static book ad shape that matches ad-card's listBook
        const bookAd = { id:'story-ad-boards', title:'Crowned in Sin', author:'@Nkemdilim_R', genre:'mafia', rating:'4.9', chapters:32, cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', cta:'Read Now' };
        if(typeof DroboardAdCard.renderListBook === 'function'){
          return `<div style="margin-bottom:8px">${DroboardAdCard.renderListBook(bookAd)}</div>`;
        }
      }
    }catch(e){}
    return `<div class="bbo-ad" style="background:rgba(240,168,0,.08);border-color:rgba(240,168,0,.2)">
      <div class="bbo-ad-icon" style="background:#f59e0b"><i class="fas fa-book-open"></i></div>
      <div class="bbo-ad-body">
        <div class="bbo-ad-tag" style="color:#f59e0b">Story Ad</div>
        <div class="bbo-ad-title">Crowned in Sin</div>
        <div class="bbo-ad-sub">Mafia romance — trending now</div>
      </div>
      <button class="bbo-ad-cta" style="background:#f59e0b" onclick="location.href='bridge.html?id=s1'">Read</button>
    </div>`;
  }
  function platformAdHtml(i){
    try{
      if(window.DroboardAdCard){
        // platform ad via ad-card if available
        const platAd = { id:'plat-boards-'+i, title:'DroBoard Premium — Read Ad-Free', sponsor:'DroBoard', cta:'Upgrade Now', img:'https://picsum.photos/seed/dropremium/800/200' };
        if(typeof DroboardAdCard.renderPlatform === 'function'){
          return `<div style="margin-bottom:8px">${DroboardAdCard.renderPlatform(platAd)}</div>`;
        }
        if(typeof DroboardAdCard.renderNative === 'function'){
          return `<div style="margin-bottom:8px">${DroboardAdCard.renderNative({id:'native-boards-'+i, title:'DroBoard Premium', sponsor:'DroBoard', body:'Unlock every chapter', cta:'Go Premium'})}</div>`;
        }
      }
    }catch(e){}
    return `<div class="bbo-ad">
      <div class="bbo-ad-icon"><i class="fas fa-bullhorn"></i></div>
      <div class="bbo-ad-body">
        <div class="bbo-ad-tag">Sponsored</div>
        <div class="bbo-ad-title">Discover Premium Boards</div>
        <div class="bbo-ad-sub">Unlock exclusive hubs & features</div>
      </div>
      <button class="bbo-ad-cta" onclick="location.href='store.html'">View</button>
    </div>`;
  }

  function open(data){
    ensureDom();
    // apply theme from settings
    try{ const t=localStorage.getItem('droboardTheme')||'light'; document.documentElement.setAttribute('data-theme', t); }catch(e){}
    data = data || {};
    const joined = data.joined || [];
    const rest = data.rest || [];
    const scrollEl=document.getElementById('bboScroll');
    let html='';
    html += `<div class="bbo-section-label">Joined boards</div>`;
    if(joined.length){
      let count=0;
      joined.forEach(g=>{
        html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" class="bbo-card"><div class="bbo-card-icon"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div class="bbo-card-body"><div class="bbo-card-title">${esc(g.name)}</div><div class="bbo-card-sub">${esc(g.members||'1.2K')} members</div></div><i class="fas fa-chevron-right" style="font-size:11px;color:var(--tx-muted,#6b7280)"></i></a>`;
        count++; if(count%6===0) html+=platformAdHtml(count);
      });
    } else {
      html += `<div style="font-size:12px;color:var(--tx-muted,#6b7280);padding:8px 0">No boards joined yet</div>`;
    }
    // story ad before explore (as requested)
    html += storyAdHtml();
    html += `<div class="bbo-section-label" style="margin-top:16px">Explore more boards</div>`;
    if(rest.length){
      let count2=joined.length;
      rest.slice(0,12).forEach(g=>{
        html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" class="bbo-card"><div class="bbo-card-icon" style="color:var(--tx-muted,#6b7280)"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div class="bbo-card-body"><div class="bbo-card-title">${esc(g.name)}</div><div class="bbo-card-sub">${esc(g.tagline||'')}</div></div><span style="font-size:11px;font-weight:700;color:var(--acc,#ff0050)">Join</span></a>`;
        count2++; if(count2%6===0) html+=platformAdHtml(count2);
      });
    } else {
      html += `<div style="font-size:12px;color:var(--tx-muted,#6b7280);padding:8px 0">No more boards</div>`;
    }
    scrollEl.innerHTML=html;
    _root.classList.add('open');
    document.body.style.overflow='hidden';
  }

  function close(){
    if(_root) _root.classList.remove('open');
    document.body.style.overflow='';
  }

  window.BoardsOverlay = { open, close };
})();
