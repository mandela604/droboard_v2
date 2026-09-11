/**
 * component/hamburger-menu.js — Droboard Hamburger / Side Menu
 * ─────────────────────────────────────────────────────────────
 * Self-contained. Injects CSS + DOM. Host page passes what to render:
 *
 *   <script src="component/hamburger-menu.js"></script>
 *
 *   DroboardMenu.configure({
 *     title: 'Feed',
 *     subtitle: 'Filters & options',
 *     user: { name: 'You', handle: 'you', avatar: '...' },  // optional header
 *     sections: [
 *       {
 *         label: 'Sort feed',
 *         items: [
 *           { id: 'latest',   icon: 'fa-clock',           label: 'Latest',     sub: 'Newest first',     active: true },
 *           { id: 'popular',  icon: 'fa-fire',            label: 'Popular',    sub: 'Most engaged' },
 *           { id: 'trending', icon: 'fa-arrow-trend-up',  label: 'Trending',   sub: 'Rising now' },
 *           { id: 'following',icon: 'fa-user-group',      label: 'Following',  sub: 'People you follow' },
 *         ],
 *       },
 *       {
 *         label: 'Quick links',
 *         items: [
 *           { id: 'circles', icon: 'fa-circle-nodes', label: 'My Circles', href: '#' },
 *           { id: 'saved',   icon: 'fa-bookmark',     label: 'Saved',      href: 'library.html' },
 *         ],
 *       },
 *     ],
 *     onSelect: (item) => { ... },   // fired for items without href
 *   });
 *
 *   // Open from a button:
 *   <button onclick="DroboardMenu.open()">☰</button>
 *
 * Theme follows <html data-theme="light|dark"> (same as feed).
 * Panel is capped at 420px and centered like .phone.
 */
(function () {
  'use strict';
  if (window.__droboardMenu) return;
  window.__droboardMenu = true;

  const CSS = `
    .dhm-overlay{
      position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.45);
      backdrop-filter:blur(6px);opacity:0;pointer-events:none;
      transition:opacity .22s ease;
    }
    .dhm-overlay.on{opacity:1;pointer-events:auto}

    .dhm-panel{
      position:fixed;top:0;bottom:0;left:50%;z-index:710;
      width:100%;max-width:420px;transform:translateX(-50%) translateX(-8%);
      background:var(--l1,#08090c);color:var(--tx-body,#c0c0c0);
      font-family:'DM Sans',system-ui,-apple-system,sans-serif;
      box-shadow:8px 0 32px rgba(0,0,0,.28);
      display:flex;flex-direction:column;
      opacity:0;pointer-events:none;
      transition:opacity .22s ease,transform .28s cubic-bezier(.4,0,.2,1);
      padding-top:env(safe-area-inset-top,0px);
      padding-bottom:env(safe-area-inset-bottom,0px);
    }
    .dhm-overlay.on .dhm-panel{
      opacity:1;pointer-events:auto;transform:translateX(-50%) translateX(0);
    }

    /* Slide in from left edge of the phone column */
    .dhm-panel{
      margin-left:0;
      left:50%;
      right:auto;
      max-width:min(320px, 86vw);
      transform:translateX(calc(-50% - 210px + 0px)) translateX(-100%);
    }
    @media (max-width:420px){
      .dhm-panel{ left:0; transform:translateX(-100%); max-width:min(300px, 86vw); }
      .dhm-overlay.on .dhm-panel{ transform:translateX(0); }
    }
    @media (min-width:421px){
      .dhm-panel{
        left:50%;
        margin-left:calc(-1 * min(210px, 50vw));
        transform:translateX(-100%);
      }
      .dhm-overlay.on .dhm-panel{ transform:translateX(0); }
    }

    .dhm-head{
      display:flex;align-items:center;gap:12px;
      padding:14px 14px 12px;border-bottom:1px solid var(--bd,rgba(255,255,255,.07));
      flex-shrink:0;
    }
    .dhm-head-text{flex:1;min-width:0}
    .dhm-title{font-size:15px;font-weight:800;color:var(--tx-high,#e0e0e0);line-height:1.2}
    .dhm-sub{font-size:11px;color:var(--tx-muted,#71717a);margin-top:2px;font-weight:600}
    .dhm-close{
      width:32px;height:32px;border-radius:50%;border:1px solid var(--bd,rgba(255,255,255,.07));
      background:var(--l2,#0e0f13);color:var(--tx-muted,#71717a);cursor:pointer;
      display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;
    }
    .dhm-close:active{transform:scale(.92)}

    .dhm-user{
      display:flex;align-items:center;gap:11px;padding:14px;
      border-bottom:1px solid var(--bd,rgba(255,255,255,.07));flex-shrink:0;
    }
    .dhm-user-av{
      width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;
      border:2px solid rgba(255,0,80,.35);
    }
    .dhm-user-name{font-size:13.5px;font-weight:800;color:var(--tx-high,#e0e0e0)}
    .dhm-user-handle{font-size:11px;color:var(--tx-muted,#71717a);font-weight:600;margin-top:1px}

    .dhm-scroll{flex:1;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
    .dhm-scroll::-webkit-scrollbar{display:none}

    .dhm-section{padding:12px 10px 6px}
    .dhm-section-label{
      font-size:10px;font-weight:800;color:var(--tx-muted,#71717a);
      text-transform:uppercase;letter-spacing:.08em;padding:4px 8px 8px;
    }

    .dhm-item{
      display:flex;align-items:center;gap:11px;width:100%;text-align:left;
      padding:10px 10px;border-radius:12px;border:none;background:none;
      cursor:pointer;font-family:inherit;color:var(--tx-body,#c0c0c0);
      transition:background .15s;
    }
    .dhm-item:hover,.dhm-item:active{background:rgba(127,127,127,.08)}
    .dhm-item.active{
      background:rgba(255,0,80,.08);color:var(--tx-high,#e0e0e0);
    }
    .dhm-item.active .dhm-item-icon{
      background:rgba(255,0,80,.14);border-color:rgba(255,0,80,.25);color:#ff0050;
    }
    .dhm-item-icon{
      width:34px;height:34px;border-radius:10px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:13px;
      background:var(--l2,#0e0f13);border:1px solid var(--bd,rgba(255,255,255,.07));
      color:var(--tx-muted,#71717a);
    }
    .dhm-item-body{flex:1;min-width:0}
    .dhm-item-label{font-size:13px;font-weight:700;color:inherit;line-height:1.2}
    .dhm-item-sub{font-size:10.5px;color:var(--tx-muted,#71717a);font-weight:600;margin-top:2px}
    .dhm-item-right{flex-shrink:0;color:var(--tx-faint,#3f3f46);font-size:11px}
    .dhm-item.active .dhm-item-right{color:#ff0050}

    .dhm-divider{height:1px;background:var(--bd,rgba(255,255,255,.07));margin:8px 14px}

    .dhm-foot{
      flex-shrink:0;padding:10px 14px 14px;
      border-top:1px solid var(--bd,rgba(255,255,255,.07));
      font-size:10px;color:var(--tx-faint,#3f3f46);font-weight:600;text-align:center;
    }

    [data-theme="light"] .dhm-panel{background:#ffffff;color:#3a3a3a;box-shadow:8px 0 32px rgba(0,0,0,.12)}
    [data-theme="light"] .dhm-title,[data-theme="light"] .dhm-user-name{color:#161616}
    [data-theme="light"] .dhm-close{background:#f1f1f1;border-color:rgba(0,0,0,.08);color:#666}
    [data-theme="light"] .dhm-item-icon{background:#f1f1f1;border-color:rgba(0,0,0,.08);color:#666}
    [data-theme="light"] .dhm-item:hover,[data-theme="light"] .dhm-item:active{background:rgba(0,0,0,.04)}
    [data-theme="light"] .dhm-item.active{background:rgba(255,0,80,.07)}
    [data-theme="light"] .dhm-head,
    [data-theme="light"] .dhm-user,
    [data-theme="light"] .dhm-foot,
    [data-theme="light"] .dhm-divider{border-color:rgba(0,0,0,.08)}
  `;

  let _cfg = {
    title: 'Menu',
    subtitle: '',
    user: null,
    sections: [],
    footer: '',
    onSelect: null,
  };
  let _overlay = null;
  let _panel = null;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ensureDom() {
    if (_overlay) return;
    const style = document.createElement('style');
    style.id = 'dhm-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    _overlay = document.createElement('div');
    _overlay.className = 'dhm-overlay';
    _overlay.innerHTML = `<div class="dhm-panel" role="dialog" aria-modal="true" aria-label="Menu"></div>`;
    document.body.appendChild(_overlay);
    _panel = _overlay.querySelector('.dhm-panel');

    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) close();
    });
    _panel.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-dhm-close]');
      if (closeBtn) { close(); return; }

      const itemEl = e.target.closest('[data-dhm-id]');
      if (!itemEl) return;
      const id = itemEl.dataset.dhmId;
      const href = itemEl.dataset.dhmHref;
      const item = _findItem(id);
      if (href) {
        close();
        location.href = href;
        return;
      }
      if (item) {
        _setActive(id);
        close();
        if (typeof _cfg.onSelect === 'function') _cfg.onSelect(item);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _overlay.classList.contains('on')) close();
    });
  }

  function _findItem(id) {
    for (const sec of _cfg.sections || []) {
      for (const it of sec.items || []) {
        if (String(it.id) === String(id)) return it;
      }
    }
    return null;
  }

  function _setActive(id) {
    (_cfg.sections || []).forEach(sec => {
      (sec.items || []).forEach(it => {
        it.active = String(it.id) === String(id);
      });
    });
  }

  function _render() {
    _ensureDom();
    const user = _cfg.user;
    const sections = _cfg.sections || [];

    let html = `
      <div class="dhm-head">
        <div class="dhm-head-text">
          <div class="dhm-title">${_esc(_cfg.title || 'Menu')}</div>
          ${_cfg.subtitle ? `<div class="dhm-sub">${_esc(_cfg.subtitle)}</div>` : ''}
        </div>
        <button type="button" class="dhm-close" data-dhm-close aria-label="Close"><i class="fas fa-xmark"></i></button>
      </div>`;

    if (user && (user.name || user.avatar)) {
      html += `
        <div class="dhm-user">
          ${user.avatar ? `<img class="dhm-user-av" src="${_esc(user.avatar)}" alt=""/>` : ''}
          <div>
            <div class="dhm-user-name">${_esc(user.name || '')}</div>
            ${user.handle ? `<div class="dhm-user-handle">@${_esc(String(user.handle).replace(/^@/, ''))}</div>` : ''}
          </div>
        </div>`;
    }

    html += `<div class="dhm-scroll">`;
    sections.forEach((sec, si) => {
      if (si > 0) html += `<div class="dhm-divider"></div>`;
      html += `<div class="dhm-section">`;
      if (sec.label) html += `<div class="dhm-section-label">${_esc(sec.label)}</div>`;
      (sec.items || []).forEach(it => {
        const active = it.active ? ' active' : '';
        const hrefAttr = it.href ? ` data-dhm-href="${_esc(it.href)}"` : '';
        html += `
          <button type="button" class="dhm-item${active}" data-dhm-id="${_esc(it.id)}"${hrefAttr}>
            <div class="dhm-item-icon"><i class="fas ${ _esc(it.icon || 'fa-circle') }"></i></div>
            <div class="dhm-item-body">
              <div class="dhm-item-label">${_esc(it.label || '')}</div>
              ${it.sub ? `<div class="dhm-item-sub">${_esc(it.sub)}</div>` : ''}
            </div>
            <div class="dhm-item-right">${it.active ? '<i class="fas fa-check"></i>' : (it.href ? '<i class="fas fa-chevron-right"></i>' : '')}</div>
          </button>`;
      });
      html += `</div>`;
    });
    html += `</div>`;

    if (_cfg.footer) {
      html += `<div class="dhm-foot">${_esc(_cfg.footer)}</div>`;
    }

    _panel.innerHTML = html;
  }

  function configure(opts) {
    _cfg = Object.assign({}, _cfg, opts || {});
    if (_overlay) _render();
  }

  function open() {
    _render();
    requestAnimationFrame(() => _overlay.classList.add('on'));
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('on');
    document.body.style.overflow = '';
  }

  function setActive(id) {
    _setActive(id);
    if (_overlay && _overlay.classList.contains('on')) _render();
  }

  window.DroboardMenu = { configure, open, close, setActive };
})();
