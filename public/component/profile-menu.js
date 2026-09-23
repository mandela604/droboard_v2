/**
 * component/profile-menu.js — Droboard Profile Account Drawer
 * ─────────────────────────────────────────────────────────────
 * Left-sliding menu used on profile.html. Self-contained CSS + DOM.
 *
 *   <script src="component/profile-menu.js"></script>
 *
 *   DroboardProfileMenu.configure({
 *     profile: PROFILE,       // full profile object
 *     isOwner: true,
 *     onNewPost: () => openNewPostComposer(),
 *     onNewBook: () => toast('…'),
 *     onTab: (tabId) => switchTab(tabId),  // books|library|collections|following
 *     onBecomeWriter: () => openUpgradeWizard(),
 *     onRefer: () => toast('…'),
 *     onSignOut: async () => { await AuthSession.logout(); location.href = 'index.html'; },
 *   });
 *
 *   DroboardProfileMenu.open();
 *   // After profile changes:
 *   DroboardProfileMenu.setProfile(PROFILE, IS_OWNER);
 *
 * Remove from profile.html: drawer markup, drawer CSS, renderDrawer().
 */
(function () {
  'use strict';
  if (window.__droboardProfileMenu) return;
  window.__droboardProfileMenu = true;

  const CSS = `
    .dpm-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .22s ease}
    .dpm-overlay.open{opacity:1;pointer-events:auto}
    .dpm-drawer{
      position:fixed;top:0;left:0;bottom:0;z-index:501;width:82%;max-width:320px;
      background:var(--l1,#fff);box-shadow:2px 0 30px rgba(0,0,0,.18);
      transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);
      display:flex;flex-direction:column;overflow:hidden;
      font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);
    }
    .dpm-overlay.open .dpm-drawer{transform:translateX(0)}
    .dpm-profile{display:flex;align-items:center;gap:11px;padding:16px 16px 14px;border-bottom:1px solid var(--bd,rgba(0,0,0,.12));flex-shrink:0}
    .dpm-av{width:46px;height:46px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid var(--acc,#ff0050);background:var(--l2,#eee)}
    .dpm-av img{width:100%;height:100%;object-fit:cover;display:block}
    .dpm-name{font-size:13.5px;font-weight:800;color:var(--tx-high,#161616)}
    .dpm-handle{font-size:10.5px;color:var(--tx-muted,#666);margin-top:1px}
    .dpm-badge{font-size:8px;font-weight:800;padding:1px 7px;border-radius:8px;background:rgba(255,0,80,.1);border:1px solid var(--bd-acc,rgba(255,0,80,.25));color:var(--acc,#ff0050);margin-top:3px;display:inline-block}
    .dpm-close{width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.05);border:1px solid var(--bd,rgba(0,0,0,.12));display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;color:var(--tx-muted,#666);flex-shrink:0}
    .dpm-body{flex:1;overflow-y:auto;padding:6px 8px 24px;scrollbar-width:none}
    .dpm-body::-webkit-scrollbar{display:none}
    .dpm-section{margin-bottom:2px}
    .dpm-section-title{font-size:9.5px;font-weight:800;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.1em;padding:14px 12px 6px}
    .dpm-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;font-family:inherit}
    .dpm-item:active{background:rgba(0,0,0,.03)}
    [data-theme="dark"] .dpm-item:active{background:rgba(255,255,255,.04)}
    .dpm-item-icon{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
    .dpm-item-title{font-size:12.5px;font-weight:700;color:var(--tx-high,#161616)}
    .dpm-item-sub{font-size:9.5px;color:var(--tx-muted,#666);margin-top:1px}
    .dpm-item-right{font-size:10px;font-weight:700;color:var(--tx-muted,#666);margin-left:auto}
    .dpm-badge-sm{background:var(--acc,#ff0050);color:#fff;font-size:8px;font-weight:800;min-width:16px;height:16px;border-radius:8px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center}
    .dpm-divider{height:1px;background:var(--bd,rgba(0,0,0,.12));margin:6px 12px}
    .dpm-item.danger .dpm-item-title{color:#dc2626}
    [data-theme="dark"] .dpm-drawer{background:var(--l1,#08090c)}
    [data-theme="dark"] .dpm-close{background:rgba(255,255,255,.06);border-color:var(--bd,rgba(255,255,255,.07))}
  `;

  let _cfg = {
    profile: null,
    isOwner: false,
    onNewPost: null,
    onNewBook: null,
    onTab: null,
    onBecomeWriter: null,
    onRefer: null,
    onSignOut: null,
  };
  let _overlay = null;
  let _drawer = null;
  let _body = null;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _fmtN(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function _ensureDom() {
    if (_overlay) return;
    const style = document.createElement('style');
    style.id = 'dpm-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    _overlay = document.createElement('div');
    _overlay.className = 'dpm-overlay';
    _overlay.innerHTML = `
      <div class="dpm-drawer" role="dialog" aria-modal="true" aria-label="Account menu">
        <div class="dpm-profile">
          <div class="dpm-av"><img data-dpm-av alt=""/></div>
          <div style="flex:1;min-width:0">
            <div class="dpm-name" data-dpm-name></div>
            <div class="dpm-handle" data-dpm-handle></div>
            <div class="dpm-badge" data-dpm-badge></div>
          </div>
          <button type="button" class="dpm-close" data-dpm-close aria-label="Close"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="dpm-body" data-dpm-body></div>
      </div>`;
    document.body.appendChild(_overlay);
    _drawer = _overlay.querySelector('.dpm-drawer');
    _body = _overlay.querySelector('[data-dpm-body]');

    _overlay.addEventListener('click', (e) => {
      if (e.target === _overlay) close();
    });
    _overlay.querySelector('[data-dpm-close]').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _overlay.classList.contains('open')) close();
    });

    _body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-dpm-act]');
      if (!btn) return;
      const act = btn.dataset.dpmAct;
      const tab = btn.dataset.dpmTab;
      close();
      const h = _cfg;
      if (act === 'new-post' && h.onNewPost) h.onNewPost();
      else if (act === 'new-book' && h.onNewBook) h.onNewBook();
      else if (act === 'tab' && h.onTab) h.onTab(tab);
      else if (act === 'become-writer' && h.onBecomeWriter) h.onBecomeWriter();
      else if (act === 'refer' && h.onRefer) h.onRefer();
      else if (act === 'sign-out' && h.onSignOut) h.onSignOut();
      else if (act === 'href') {
        const href = btn.dataset.dpmHref;
        if (href) location.href = href;
      }
    });
  }

  function _item(opts) {
    const {
      act, tab, href, icon, iconBg, iconColor, border, title, sub, badge, rightIcon, danger, titleColor,
    } = opts;
    const actAttr = act === 'href'
      ? `data-dpm-act="href" data-dpm-href="${_esc(href)}"`
      : act === 'tab'
        ? `data-dpm-act="tab" data-dpm-tab="${_esc(tab)}"`
        : `data-dpm-act="${_esc(act)}"`;
    const titleStyle = titleColor ? ` style="color:${_esc(titleColor)}"` : '';
    let right = '';
    if (badge != null) right = `<div class="dpm-item-right"><span class="dpm-badge-sm">${_esc(String(badge))}</span></div>`;
    else if (rightIcon) right = `<div class="dpm-item-right"><i class="fas ${_esc(rightIcon)}" style="font-size:10px"></i></div>`;
    return `
      <button type="button" class="dpm-item${danger ? ' danger' : ''}" ${actAttr}>
        <div class="dpm-item-icon" style="background:${iconBg};border:1px solid ${border}"><i class="fas ${_esc(icon)}" style="color:${iconColor}"></i></div>
        <div style="flex:1;min-width:0"><div class="dpm-item-title"${titleStyle}>${_esc(title)}</div>${sub ? `<div class="dpm-item-sub">${_esc(sub)}</div>` : ''}</div>
        ${right}
      </button>`;
  }

  function _renderBody(p, isOwner) {
    const booksN = (p.books || []).length;
    const libN = (p.library || []).length;
    const collN = (p.collections || []).length;
    const followingN = (p.stats && p.stats.following) || 0;

    let html = `<div class="dpm-section"><div class="dpm-section-title">Create</div>`;
    html += _item({
      act: 'new-post', icon: 'fa-pen',
      iconBg: 'rgba(255,0,80,.08)', border: 'var(--bd-acc,rgba(255,0,80,.25))', iconColor: 'var(--acc,#ff0050)',
      title: 'New Post',
      sub: p.isWriter ? 'Text, photo, chapter or AMA' : 'Quote, reaction or recommendation',
    });
    if (p.isWriter) {
      html += _item({
        act: 'new-book', icon: 'fa-book-open',
        iconBg: 'rgba(52,211,153,.07)', border: 'rgba(52,211,153,.12)', iconColor: 'var(--green,#34d399)',
        title: 'New Book', sub: 'Start a new story',
      });
    }
    html += `</div><div class="dpm-divider"></div><div class="dpm-section"><div class="dpm-section-title">My Content</div>`;

    if (p.isWriter) {
      html += _item({
        act: 'tab', tab: 'books', icon: 'fa-book',
        iconBg: 'rgba(255,0,80,.06)', border: 'var(--bd-acc,rgba(255,0,80,.25))', iconColor: 'var(--acc,#ff0050)',
        title: 'Books', sub: booksN + ' published', badge: booksN,
      });
      if (isOwner) {
        html += _item({
          act: 'href', href: 'author/author-center.html', icon: 'fa-gauge',
          iconBg: 'rgba(167,139,250,.08)', border: 'rgba(167,139,250,.15)', iconColor: 'var(--purple,#a78bfa)',
          title: 'Author Center', sub: 'Dashboard, analytics & revenue',
        });
      }
    } else {
      html += _item({
        act: 'tab', tab: 'library', icon: 'fa-bookmark',
        iconBg: 'rgba(56,189,248,.07)', border: 'rgba(56,189,248,.12)', iconColor: 'var(--blue,#38bdf8)',
        title: 'Library', sub: libN + ' saved stories',
      });
    }

    html += _item({
      act: 'tab', tab: 'collections', icon: 'fa-folder',
      iconBg: 'rgba(52,211,153,.07)', border: 'rgba(52,211,153,.12)', iconColor: 'var(--green,#34d399)',
      title: 'Collections', sub: collN + ' curated lists',
    });
    html += _item({
      act: 'tab', tab: 'following', icon: 'fa-user-group',
      iconBg: 'rgba(0,0,0,.04)', border: 'var(--bd,rgba(0,0,0,.12))', iconColor: 'var(--tx-muted,#666)',
      title: 'Following', sub: followingN + ' accounts',
    });

    if (isOwner && !p.isWriter) {
      html += _item({
        act: 'become-writer', icon: 'fa-feather-pointed',
        iconBg: 'rgba(167,139,250,.07)', border: 'rgba(167,139,250,.12)', iconColor: 'var(--purple,#a78bfa)',
        title: 'Become a Writer', sub: 'Unlock books & author tools',
      });
    }
    html += `</div>`;

    if (isOwner) {
      html += `<div class="dpm-divider"></div><div class="dpm-section"><div class="dpm-section-title">Wallet</div>`;
      html += _item({
        act: 'href', href: 'wallet.html', icon: 'fa-wallet',
        iconBg: 'var(--gold-soft,rgba(240,168,0,.12))', border: 'rgba(240,168,0,.3)', iconColor: 'var(--gold,#f0a800)',
        title: 'Wallet', sub: 'Balance, earnings & payouts', titleColor: 'var(--gold,#f0a800)', rightIcon: 'fa-chevron-right',
      });
      html += `</div>`;
    }

    html += `<div class="dpm-divider"></div><div class="dpm-section"><div class="dpm-section-title">Account</div>`;
    if (isOwner) {
      html += _item({
        act: 'href', href: 'edit-profile.html', icon: 'fa-user-edit',
        iconBg: 'rgba(0,0,0,.04)', border: 'var(--bd,rgba(0,0,0,.12))', iconColor: 'var(--tx-muted,#666)',
        title: 'Edit Profile', sub: 'Name, bio, avatar, genres',
      });
      html += _item({
        act: 'href', href: 'settings.html', icon: 'fa-gear',
        iconBg: 'rgba(0,0,0,.04)', border: 'var(--bd,rgba(0,0,0,.12))', iconColor: 'var(--tx-muted,#666)',
        title: 'Settings', sub: 'Privacy, notifications, payout',
      });
    }
    html += _item({
      act: 'refer', icon: 'fa-share-alt',
      iconBg: 'var(--gold-soft,rgba(240,168,0,.12))', border: 'rgba(240,168,0,.2)', iconColor: 'var(--gold,#f0a800)',
      title: 'Refer a Friend', sub: 'Earn $5 per referral',
    });
    html += _item({
      act: 'sign-out', icon: 'fa-sign-out-alt', danger: true,
      iconBg: 'rgba(248,113,113,.08)', border: 'rgba(248,113,113,.15)', iconColor: '#dc2626',
      title: 'Sign Out',
    });
    html += `</div>`;

    return html;
  }

  function _render() {
    _ensureDom();
    const p = _cfg.profile;
    if (!p) {
      _body.innerHTML = '';
      return;
    }
    const av = _overlay.querySelector('[data-dpm-av]');
    av.src = p.avatar || '';
    _overlay.querySelector('[data-dpm-name]').textContent = p.name || '';
    _overlay.querySelector('[data-dpm-handle]').textContent =
      `@${p.handle || ''} · ${_fmtN(p.stats && p.stats.followers)} followers`;
    _overlay.querySelector('[data-dpm-badge]').textContent =
      p.isWriter ? '✍️ Verified Writer' : '📖 Verified Reader';
    _body.innerHTML = _renderBody(p, !!_cfg.isOwner);
  }

  function configure(opts) {
    _cfg = Object.assign({}, _cfg, opts || {});
    if (opts && opts.profile) _render();
  }

  function setProfile(profile, isOwner) {
    _cfg.profile = profile;
    if (typeof isOwner === 'boolean') _cfg.isOwner = isOwner;
    _render();
  }

  function open() {
    if (!_cfg.profile) return;
    _render();
    requestAnimationFrame(() => _overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!_overlay) return;
    _overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.DroboardProfileMenu = { configure, setProfile, open, close };
})();
