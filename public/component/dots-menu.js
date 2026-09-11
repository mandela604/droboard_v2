/**
 * component/dots-menu.js — Droboard Post Dots Menu
 * ─────────────────────────────────────────────────
 * Self-contained, same pattern as share-modal.js / save-modal.js: injects
 * its own CSS + DOM on load, exposes a small global API. Not owned by
 * post-card.js — post-card only fires `hooks.onDots(post, anchorEl)`;
 * wiring that to this component is the host page's job:
 *
 *   <script src="component/dots-menu.js"></script>
 *   ...
 *   DroboardDotsMenu.configure({
 *     onEdit:      (post) => { ...open composer prefilled... },
 *     onDelete:    (post) => { ...remove from FEED_POSTS, re-render... },
 *     onReport:    (post) => toast('🚩 Reported. Thanks for flagging.'),
 *     onLess:      (post) => toast('Got it — showing less of this.'),
 *     onFollow:    (post) => toast('Following @' + post.name),
 *     onMute:      (post) => toast('Muted @' + post.name),
 *     onCopyLink:  (post) => { navigator.clipboard.writeText(...); toast('🔗 Link copied'); },
 *   });
 *
 *   DroboardPostCard.attach(feedList, {
 *     onDots: (post, anchorEl) => DroboardDotsMenu.open(post, anchorEl),
 *     ...
 *   });
 *
 * `post.mine` decides which item set renders (Edit/Delete vs
 * Follow/Mute/Not-interested/Report). Copy-link is always shown.
 * Positioning is a viewport-clamped dropdown anchored under/aligned to
 * whichever element triggered it (the dots button), not centered over
 * the whole card.
 */
(function () {
  'use strict';

  if (window.__droboardDotsMenu) return;
  window.__droboardDotsMenu = true;

  const CSS = `
    .ddm-overlay{position:fixed;inset:0;z-index:850;display:none}
    .ddm-overlay.on{display:block}
    .ddm-menu{position:fixed;z-index:860;background:var(--l3,#13141a);border:1px solid var(--bd,rgba(255,255,255,.07));border-radius:14px;padding:6px;min-width:210px;box-shadow:0 12px 40px rgba(0,0,0,.35);opacity:0;transform:translateY(-4px) scale(.97);pointer-events:none;transition:opacity .15s ease,transform .15s ease}
    .ddm-menu.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
    .ddm-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;color:var(--tx-body,#c0c0c0);cursor:pointer;font-family:inherit;background:none;border:none;width:100%;text-align:left}
    .ddm-item:hover{background:rgba(127,127,127,.1);color:var(--tx-high,#e0e0e0)}
    .ddm-item i{width:16px;text-align:center;font-size:13px;flex-shrink:0}
    .ddm-item.danger{color:#f87171}
    .ddm-item.danger:hover{background:rgba(248,113,113,.1);color:#f87171}
    .ddm-sep{height:1px;background:var(--bd,rgba(255,255,255,.07));margin:5px 8px}

    [data-theme="light"] .ddm-menu{background:#ffffff;border-color:rgba(0,0,0,.08);box-shadow:0 12px 40px rgba(0,0,0,.16)}
    [data-theme="light"] .ddm-item{color:#3a3a3a}
    [data-theme="light"] .ddm-item:hover{background:rgba(0,0,0,.05);color:#161616}
    [data-theme="light"] .ddm-item.danger{color:#dc2626}
    [data-theme="light"] .ddm-item.danger:hover{background:rgba(220,38,38,.08)}
    [data-theme="light"] .ddm-sep{background:rgba(0,0,0,.07)}
  `;

  let _hooks = {};
  let _menuEl = null;
  let _overlayEl = null;
  let _openPost = null;

  function _ensureDom() {
    if (_menuEl) return;
    const style = document.createElement('style');
    style.id = 'ddm-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    _overlayEl = document.createElement('div');
    _overlayEl.className = 'ddm-overlay';
    _overlayEl.addEventListener('click', close);
    document.body.appendChild(_overlayEl);

    _menuEl = document.createElement('div');
    _menuEl.className = 'ddm-menu';
    document.body.appendChild(_menuEl);

    _menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.ddm-item');
      if (!item || !_openPost) return;
      const action = item.dataset.action;
      const post = _openPost;
      close();
      const fn = _hooks['on' + action];
      if (typeof fn === 'function') fn(post);
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  function _itemsFor(post) {
    const items = [];
    if (post.mine) {
      items.push({ action: 'Edit', icon: 'fa-pen', label: 'Edit post' });
      items.push({ action: 'Delete', icon: 'fa-trash', label: 'Delete post', danger: true });
    } else {
      items.push({ action: 'Follow', icon: 'fa-user-plus', label: 'Follow @' + (post.name || 'user') });
      items.push({ action: 'Mute', icon: 'fa-volume-xmark', label: 'Mute @' + (post.name || 'user') });
      items.push({ action: 'Less', icon: 'fa-eye-slash', label: 'See less of this' });
      items.push({ action: 'Report', icon: 'fa-flag', label: 'Report post', danger: true });
    }
    items.push({ sep: true });
    items.push({ action: 'CopyLink', icon: 'fa-link', label: 'Copy link' });
    return items;
  }

  function _renderItems(post) {
    return _itemsFor(post).map(it => it.sep
      ? `<div class="ddm-sep"></div>`
      : `<button class="ddm-item${it.danger ? ' danger' : ''}" data-action="${it.action}"><i class="fas ${it.icon}"></i>${it.label}</button>`
    ).join('');
  }

  function open(post, anchorEl) {
    _ensureDom();
    _openPost = post;
    _menuEl.innerHTML = _renderItems(post);
    _menuEl.classList.add('open');
    _overlayEl.classList.add('on');

    // Position as a viewport-clamped dropdown anchored to the trigger
    // element (the dots button), not centered over the whole card.
    requestAnimationFrame(() => {
      const mw = _menuEl.offsetWidth || 210;
      const mh = _menuEl.offsetHeight || 160;
      let top, left;
      if (anchorEl && anchorEl.getBoundingClientRect) {
        const r = anchorEl.getBoundingClientRect();
        top = r.bottom + 6;
        left = r.right - mw;
        if (top + mh > window.innerHeight - 8) top = r.top - mh - 6;
      } else {
        top = (window.innerHeight - mh) / 2;
        left = (window.innerWidth - mw) / 2;
      }
      left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
      _menuEl.style.top = top + 'px';
      _menuEl.style.left = left + 'px';
    });
  }

  function close() {
    if (_menuEl) _menuEl.classList.remove('open');
    if (_overlayEl) _overlayEl.classList.remove('on');
    _openPost = null;
  }

  function configure(hooks) {
    _hooks = Object.assign({}, _hooks, hooks || {});
  }

  window.DroboardDotsMenu = { configure, open, close };

})();