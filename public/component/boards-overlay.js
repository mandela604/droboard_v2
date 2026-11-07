/**
 * boards-overlay.js — Droboard Boards Explorer Overlay (full page)
 * ─────────────────────────────────────────────────────────────────
 * Self-contained component for "View all boards" from My Circles.
 * Shows Joined hubs + Explore more hubs.
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
    .bbo-back{width:36px;height:36px;border-radius:50%;border:1px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);color:var(--tx,#1a1a2e);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
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
    [data-theme="dark"] .bbo-root{background:#000}
    [data-theme="dark"] .bbo-head{background:#000;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .bbo-back{background:#1a1b22;border-color:rgba(255,255,255,.1);color:#f5f5f7}
    [data-theme="dark"] .bbo-card{background:#0e0f13;border-color:rgba(255,255,255,.08)}
    [data-theme="dark"] .bbo-card-icon{background:#1a1b22}
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
      joined.forEach(g=>{
        html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" class="bbo-card"><div class="bbo-card-icon"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div class="bbo-card-body"><div class="bbo-card-title">${esc(g.name)}</div><div class="bbo-card-sub">${esc(g.members||'1.2K')} members</div></div><i class="fas fa-chevron-right" style="font-size:11px;color:var(--tx-muted,#6b7280)"></i></a>`;
      });
    } else {
      html += `<div style="font-size:12px;color:var(--tx-muted,#6b7280);padding:8px 0">No boards joined yet</div>`;
    }
    html += `<div class="bbo-section-label" style="margin-top:16px">Explore more boards</div>`;
    if(rest.length){
      rest.slice(0,12).forEach(g=>{
        html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" class="bbo-card"><div class="bbo-card-icon" style="color:var(--tx-muted,#6b7280)"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div class="bbo-card-body"><div class="bbo-card-title">${esc(g.name)}</div><div class="bbo-card-sub">${esc(g.tagline||'')}</div></div><span style="font-size:11px;font-weight:700;color:var(--acc,#ff0050)">Join</span></a>`;
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
