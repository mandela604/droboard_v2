/**
 * component/notification-item.js — Droboard notification row / milestone / digest / achievement
 * ─────────────────────────────────────────────────────────────────
 * Single component for every notification surface (reader page, author workspace,
 * bell dropdown, staff inbox). Fix here, propagates everywhere.
 *
 *   <script src="../component/notification-item.js"></script>
 *
 *   mount.innerHTML = items.map(n => DroboardNotif.render(n)).join('');
 *   DroboardNotif.bind(mount, { onOpen: n => {}, onAction: (n, act) => {} });
 *
 * Item shape (see services/notification-store.js):
 *   { id, type, kind: 'row'|'milestone'|'digest'|'achievement', unread, time,
 *     title, desc, avatar, icon:{name,bg,color}, cover, thumb,
 *     metrics: [{label,value}], chips: ['+12% vs last'], link: {label,href} }
 */
(function () {
  'use strict';
  if (window.DroboardNotif) return;

  const CSS = `
    .dn-card{display:flex;gap:11px;padding:12px;border-radius:14px;background:var(--card,#fff);
      border:1px solid var(--border,#ececee);position:relative;cursor:pointer;font-family:'Inter',-apple-system,sans-serif;
      color:var(--text,#1a1a1a);margin-bottom:8px}
    .dn-card.unread:before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--pink,#ff2d55)}
    .dn-avatar-wrap{position:relative;flex-shrink:0;width:42px;height:42px}
    .dn-avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;background:#eee}
    .dn-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    .dn-avatar.icon{display:flex;align-items:center;justify-content:center;font-size:15px}
    .dn-badge{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;border:2px solid var(--card,#fff)}
    .dn-badge.heart{background:#ff2d55}.dn-badge.book{background:#7c5cff}.dn-badge.comment{background:#1d9bf0}
    .dn-badge.mention{background:#1d9bf0}.dn-badge.coin{background:#22c55e}.dn-badge.follow{background:#7c5cff}
    .dn-badge.trophy{background:#f59e0b}.dn-badge.check{background:#22c55e}.dn-badge.gift{background:#ff2d55}
    .dn-badge.alert{background:#ef4444}.dn-badge.payout{background:#22c55e}.dn-badge.chart{background:#f59e0b}
    .dn-body{flex:1;min-width:0}
    .dn-title{font-size:13px;font-weight:650;line-height:1.35}
    .dn-title b{font-weight:800}
    .dn-actor{color:var(--pink,#ff2d55)!important;font-weight:800;cursor:pointer;text-decoration:none}
    .dn-actor:active{opacity:.7}
    .dn-desc .dn-actor{font-size:inherit}
    .dn-desc{font-size:11.5px;color:var(--muted,#8e8e93);line-height:1.4;margin-top:3px}
    .dn-time{font-size:10.5px;color:var(--muted,#8e8e93);margin-top:5px;font-weight:600}
    .dn-link{display:inline-flex;align-items:center;gap:6px;margin-top:7px;font-size:11.5px;font-weight:700;
      color:var(--pink,#ff2d55);background:var(--pink-soft,rgba(255,45,85,.08));padding:5px 10px;border-radius:9px}
    .dn-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
    .dn-chip{font-size:10px;font-weight:750;padding:3px 8px;border-radius:20px;background:var(--bg,#f4f4f6);color:var(--muted,#6a6a72)}
    .dn-chip.up{background:var(--success-soft,#e9fbf0);color:#158a48}
    .dn-chip.down{background:var(--danger-soft,#fdeaea);color:#c92a2a}
    .dn-right{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:6px;flex-shrink:0}
    .dn-dot{width:8px;height:8px;border-radius:50%;background:var(--pink,#ff2d55)}
    .dn-thumb{width:42px;height:54px;border-radius:7px;overflow:hidden;background:#eee}
    .dn-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .dn-more{background:none;border:none;color:var(--muted,#8e8e93);cursor:pointer;font-size:13px;padding:2px 4px;line-height:1}
    .dn-menu{position:absolute;right:10px;top:44px;background:var(--card,#fff);border:1px solid var(--border,#ececee);
      border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.14);padding:5px;display:none;z-index:30;min-width:168px}
    .dn-menu.open{display:block}
    .dn-menu button{display:flex;align-items:center;gap:9px;width:100%;background:none;border:none;padding:8px 10px;
      border-radius:8px;font:inherit;font-size:12px;font-weight:600;color:var(--text,#1a1a1a);cursor:pointer;text-align:left}
    .dn-menu button:hover{background:var(--bg,#f4f4f6)}
    .dn-menu button.danger{color:#c92a2a}
    .dn-menu button i{width:14px;font-size:11px;color:var(--muted,#8e8e93)}
    .dn-menu button.danger i{color:#c92a2a}

    /* milestone — trending / top-10 / editor pick / league finish */
    .dn-card.dn-milestone{padding:0;overflow:hidden;border:none;background:var(--card,#fff);
      box-shadow:0 1px 4px rgba(0,0,0,.05)}
    .dn-milestone-inner{padding:14px;display:flex;gap:12px;align-items:flex-start}
    .dn-ms-medal{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
      font-size:19px;flex-shrink:0;background:linear-gradient(140deg,#fff0c2,#ffd27a);color:#9a6508}
    .dn-ms-medal.rank{background:linear-gradient(140deg,#ffe3ec,#ffb3c8);color:#c2185b}
    .dn-ms-medal.pick{background:linear-gradient(140deg,#e7ddff,#c7b3ff);color:#4c2ea8}
    .dn-ms-medal.money{background:linear-gradient(140deg,#d6f5e2,#a5e6bf);color:#116b38}
    .dn-ms-cover{width:44px;height:60px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#eee}
    .dn-ms-cover img{width:100%;height:100%;object-fit:cover;display:block}
    .dn-ms-rank{font-size:19px;font-weight:900;letter-spacing:-.02em;line-height:1;color:var(--text,#1a1a1a)}
    .dn-ms-rank span{font-size:11px;font-weight:750;color:var(--muted,#8e8e93);margin-left:4px}
    .dn-ms-strip{display:flex;gap:0;background:var(--bg,#f7f7f9);border-top:1px solid var(--border,#ececee)}
    .dn-ms-stat{flex:1;padding:9px 6px;text-align:center;border-right:1px solid var(--border,#ececee)}
    .dn-ms-stat:last-child{border-right:none}
    .dn-ms-stat b{display:block;font-size:13px;font-weight:850;line-height:1.2}
    .dn-ms-stat span{font-size:9.5px;font-weight:650;color:var(--muted,#8e8e93);text-transform:uppercase;letter-spacing:.04em}
    .dn-ms-dot{position:absolute;right:12px;top:12px;width:8px;height:8px;border-radius:50%;background:var(--pink,#ff2d55);z-index:2}

    /* digest — 24h post summary / weekly rollup */
    .dn-card.dn-digest{flex-direction:column;gap:10px}
    .dn-digest-head{display:flex;gap:11px;align-items:center}
    .dn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:8px}
    .dn-cell{background:var(--bg,#f7f7f9);border-radius:10px;padding:9px 8px;text-align:center}
    .dn-cell b{display:block;font-size:14px;font-weight:850;line-height:1.2}
    .dn-cell span{font-size:9.5px;font-weight:650;color:var(--muted,#8e8e93);text-transform:uppercase;letter-spacing:.03em}
    .dn-cell em{display:block;font-style:normal;font-size:9.5px;font-weight:750;margin-top:2px}
    .dn-cell em.up{color:#158a48}.dn-cell em.down{color:#c92a2a}

    /* achievement */
    .dn-card.dn-ach{align-items:center}
    .dn-medal{width:46px;height:46px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
      font-size:18px;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f2b53c);color:#8a5a08;
      box-shadow:0 3px 10px rgba(242,181,60,.35)}
    .dn-medal.locked{background:var(--bg,#f1f1f4);color:var(--muted,#adb0b8);box-shadow:none}
    .dn-medal.silver{background:radial-gradient(circle at 35% 30%,#f2f4f7,#c3c9d2);color:#5b6470;box-shadow:0 3px 10px rgba(140,150,165,.3)}
    .dn-tier{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#9a6508}

    .dn-label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#8e8e93);margin:16px 2px 8px}

    [data-theme="dark"] .dn-card{background:var(--l2,#131418);border-color:var(--bd,rgba(255,255,255,.07));color:var(--tx-high,#e8e8ea)}
    [data-theme="dark"] .dn-card.dn-milestone{background:var(--l2,#131418);box-shadow:none;border:1px solid var(--bd,rgba(255,255,255,.07))}
    [data-theme="dark"] .dn-title,[data-theme="dark"] .dn-ms-rank{color:var(--tx-high,#e8e8ea)}
    [data-theme="dark"] .dn-desc,[data-theme="dark"] .dn-time,[data-theme="dark"] .dn-more,
    [data-theme="dark"] .dn-ms-rank span,[data-theme="dark"] .dn-cell span,[data-theme="dark"] .dn-menu button i{color:var(--tx-muted,#8a8a93)}
    [data-theme="dark"] .dn-chip,[data-theme="dark"] .dn-cell,[data-theme="dark"] .dn-ms-strip{background:var(--l3,#1b1d22)}
    [data-theme="dark"] .dn-menu{background:var(--l2,#131418);border-color:var(--bd,rgba(255,255,255,.09))}
    [data-theme="dark"] .dn-menu button{color:var(--tx-high,#e8e8ea)}
    [data-theme="dark"] .dn-menu button:hover{background:var(--l3,#1b1d22)}
    [data-theme="dark"] .dn-avatar,.dn-thumb,.dn-ms-cover{background:var(--l3,#1b1d22)}
  `;

  const BADGE_ICON = {
    heart: 'fa-heart', book: 'fa-book', comment: 'fa-comment', mention: 'fa-at', coin: 'fa-arrow-up',
    follow: 'fa-user-plus', trophy: 'fa-star', check: 'fa-check', gift: 'fa-gift', alert: 'fa-shield-halved',
    payout: 'fa-building-columns', chart: 'fa-chart-line', award: 'fa-award',
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* allow bold + actor tokens only. {@handle|Name} renders a username as a
     bold, platform-red, profile-linked actor — Facebook style. */
  function _rich(s) {
    return _esc(s)
      .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')
      .replace(/\{@([^}|]+)\|([^}]+)\}/g, function (_m, handle, label) {
        return '<b class="dn-actor" data-dn-user="' + _esc(handle) + '">' + _esc(label) + '</b>';
      });
  }
  function _ensureStyle() {
    if (document.getElementById('dn-style')) return;
    const st = document.createElement('style');
    st.id = 'dn-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function _avatar(n) {
    if (n.avatar) {
      return '<div class="dn-avatar-wrap"><div class="dn-avatar"><img src="' + _esc(n.avatar) + '" alt="" loading="lazy"/></div>' + _badge(n) + '</div>';
    }
    const ic = n.icon || {};
    return '<div class="dn-avatar-wrap"><div class="dn-avatar icon" style="background:' + _esc(ic.bg || 'var(--pink-soft,rgba(255,45,85,.1))') +
      ';color:' + _esc(ic.color || 'var(--pink,#ff2d55)') + '"><i class="fas ' + _esc(ic.name || 'fa-bell') + '"></i></div>' + _badge(n) + '</div>';
  }
  function _badge(n) {
    if (!n.badge) return '';
    return '<div class="dn-badge ' + _esc(n.badge) + '"><i class="fas ' + _esc(BADGE_ICON[n.badge] || 'fa-bell') + '"></i></div>';
  }
  function _chips(n) {
    if (!n.chips || !n.chips.length) return '';
    return '<div class="dn-chips">' + n.chips.map(function (c) {
      const cls = /^\+|up|▲/.test(c) ? ' up' : /^-|▼/.test(c) ? ' down' : '';
      return '<span class="dn-chip' + cls + '">' + _esc(c) + '</span>';
    }).join('') + '</div>';
  }
  function _link(n) {
    if (!n.link || !n.link.label) return '';
    return '<span class="dn-link" data-dn-link="1"><i class="fas fa-arrow-right"></i> ' + _esc(n.link.label) + '</span>';
  }
  function _menu(n) {
    return '<div class="dn-menu" data-dn-menu="' + _esc(n.id) + '">'
      + (n.unread
        ? '<button data-act="read"><i class="fas fa-check"></i> Mark as read</button>'
        : '<button data-act="unread"><i class="fas fa-circle"></i> Mark as unread</button>')
      + '<button data-act="mute"><i class="fas fa-bell-slash"></i> Mute ' + _esc(n.typeLabel || n.type) + '</button>'
      + '<button class="danger" data-act="delete"><i class="fas fa-trash"></i> Delete</button></div>';
  }
  function _metrics(n) {
    if (!n.metrics || !n.metrics.length) return '';
    return '<div class="dn-grid">' + n.metrics.map(function (m) {
      return '<div class="dn-cell"><b>' + _esc(m.value) + '</b><span>' + _esc(m.label) + '</span>'
        + (m.delta ? '<em class="' + (String(m.delta).charAt(0) === '-' ? 'down' : 'up') + '">' + _esc(m.delta) + '</em>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function _row(n) {
    return '<div class="dn-card dn-row' + (n.unread ? ' unread' : '') + '" data-dn-id="' + _esc(n.id) + '">'
      + _avatar(n)
      + '<div class="dn-body"><div class="dn-title">' + _rich(n.title) + '</div>'
      + (n.desc ? '<div class="dn-desc">' + _rich(n.desc) + '</div>' : '')
      + _chips(n) + _link(n)
      + '<div class="dn-time">' + _esc(n.time) + '</div></div>'
      + '<div class="dn-right">' + (n.unread ? '<div class="dn-dot"></div>' : '<div></div>')
      + (n.thumb ? '<div class="dn-thumb"><img src="' + _esc(n.thumb) + '" alt="" loading="lazy"/></div>' : '')
      + '<button class="dn-more" data-dn-openmenu="' + _esc(n.id) + '" aria-label="More"><i class="fas fa-ellipsis"></i></button></div>'
      + _menu(n) + '</div>';
  }

  function _milestone(n) {
    const stats = (n.metrics || []).slice(0, 3);
    return '<div class="dn-card dn-milestone' + (n.unread ? ' unread' : '') + '" data-dn-id="' + _esc(n.id) + '">'
      + (n.unread ? '<span class="dn-ms-dot"></span>' : '')
      + '<div class="dn-milestone-inner">'
      + (n.cover ? '<div class="dn-ms-cover"><img src="' + _esc(n.cover) + '" alt="" loading="lazy"/></div>'
        : '<div class="dn-ms-medal ' + _esc(n.medal || '') + '"><i class="fas ' + _esc(n.iconName || 'fa-trophy') + '"></i></div>')
      + '<div class="dn-body">'
      + (n.rank ? '<div class="dn-ms-rank">#' + _esc(n.rank) + '<span>' + _esc(n.rankNote || '') + '</span></div>'
        : '<div class="dn-title">' + _rich(n.title) + '</div>')
      + (n.desc ? '<div class="dn-desc">' + _rich(n.desc) + '</div>' : '')
      + _chips(n) + _link(n)
      + '<div class="dn-time">' + _esc(n.time) + '</div></div>'
      + '<button class="dn-more" data-dn-openmenu="' + _esc(n.id) + '" aria-label="More"><i class="fas fa-ellipsis"></i></button>'
      + _menu(n) + '</div>'
      + (stats.length ? '<div class="dn-ms-strip">' + stats.map(function (m) {
        return '<div class="dn-ms-stat"><b>' + _esc(m.value) + '</b><span>' + _esc(m.label) + '</span></div>';
      }).join('') + '</div>' : '')
      + '</div>';
  }

  function _digest(n) {
    return '<div class="dn-card dn-digest' + (n.unread ? ' unread' : '') + '" data-dn-id="' + _esc(n.id) + '">'
      + '<div class="dn-digest-head">' + _avatar(n)
      + '<div class="dn-body" style="flex:1"><div class="dn-title">' + _rich(n.title) + '</div>'
      + (n.desc ? '<div class="dn-desc">' + _rich(n.desc) + '</div>' : '')
      + '<div class="dn-time">' + _esc(n.time) + '</div></div>'
      + (n.unread ? '<div class="dn-dot"></div>' : '')
      + '<button class="dn-more" data-dn-openmenu="' + _esc(n.id) + '" aria-label="More"><i class="fas fa-ellipsis"></i></button>'
      + _menu(n) + '</div>'
      + _metrics(n) + _chips(n) + _link(n) + '</div>';
  }

  /* Award colors come from the Super Admin catalog (named or hex). */
  const AWARD_HEX = { gold: '#d4a017', red: '#e0384d', blue: '#2f7de1', purple: '#5b4bcf',
    green: '#16a34a', pink: '#ff0050', orange: '#d97706' };
  function _awardHex(n) {
    return AWARD_HEX[n.color] || (/^#[0-9a-f]{6}$/i.test(n.color || '') ? n.color : '');
  }
  function _medal(n) {
    const hex = _awardHex(n);
    if (!hex) return '<div class="dn-medal ' + _esc(n.tierClass || '') + '"><i class="fas ' + _esc(n.iconName || 'fa-trophy') + '"></i></div>';
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return '<div class="dn-medal" style="background:radial-gradient(circle at 35% 30%,' + hex + '33,rgba(' + r + ',' + g + ',' + b + ',.5));color:' + hex + ';box-shadow:0 3px 10px rgba(' + r + ',' + g + ',' + b + ',.26)"><i class="fas ' + _esc(n.iconName || 'fa-award') + '"></i></div>';
  }

  function _achievement(n) {
    const hex = _awardHex(n);
    return '<div class="dn-card dn-ach' + (n.unread ? ' unread' : '') + '" data-dn-id="' + _esc(n.id) + '">'
      + _medal(n)
      + '<div class="dn-body"><div class="dn-tier"' + (hex ? ' style="color:' + hex + '"' : '') + '>' + _esc(n.tier || 'Achievement unlocked') + '</div>'
      + '<div class="dn-title">' + _rich(n.title) + '</div>'
      + (n.desc ? '<div class="dn-desc">' + _rich(n.desc) + '</div>' : '')
      + _chips(n) + '<div class="dn-time">' + _esc(n.time) + '</div></div>'
      + '<div class="dn-right">' + (n.unread ? '<div class="dn-dot"></div>' : '')
      + '<button class="dn-more" data-dn-openmenu="' + _esc(n.id) + '" aria-label="More"><i class="fas fa-ellipsis"></i></button></div>'
      + _menu(n) + '</div>';
  }

  function render(n) {
    _ensureStyle();
    if (!n) return '';
    if (n.kind === 'milestone') return _milestone(n);
    if (n.kind === 'digest') return _digest(n);
    if (n.kind === 'achievement') return _achievement(n);
    return _row(n);
  }

  function renderGroups(groups) {
    _ensureStyle();
    return (groups || []).map(function (g) {
      if (!g.items || !g.items.length) return '';
      return '<div class="dn-label">' + _esc(g.label) + '</div>' + g.items.map(render).join('');
    }).join('');
  }

  function closeMenus(root) {
    (root || document).querySelectorAll('.dn-menu.open').forEach(function (m) { m.classList.remove('open'); });
  }

  /**
   * @param {Element|string} mount
   * @param {Array} items flat list (order preserved) or groups via renderGroups
   * @param {{onOpen?:Function, onAction?:Function, findById?:Function}} hooks
   */
  function bind(mount, hooks) {
    const el = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!el) return;
    const h = hooks || {};
    const find = h.findById || function (id) { return null; };

    el.querySelectorAll('.dn-more').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const menu = el.querySelector('.dn-menu[data-dn-menu="' + btn.getAttribute('data-dn-openmenu') + '"]');
        const wasOpen = menu && menu.classList.contains('open');
        closeMenus(el);
        if (menu && !wasOpen) menu.classList.add('open');
      });
    });
    el.querySelectorAll('.dn-menu button').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        const menu = item.closest('.dn-menu');
        if (h.onAction && menu) h.onAction(find(menu.getAttribute('data-dn-menu')), item.getAttribute('data-act'));
      });
    });
    el.querySelectorAll('.dn-actor').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        const handle = a.getAttribute('data-dn-user');
        if (h.onActor) { h.onActor(handle); return; }
        location.href = (h.profileBase || 'profile.html') + '?u=' + encodeURIComponent(handle);
      });
    });
    el.querySelectorAll('.dn-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.dn-more') || e.target.closest('.dn-menu')) return;
        if (h.onOpen) h.onOpen(find(card.getAttribute('data-dn-id')), e);
      });
    });
    if (!_docBound) {
      _docBound = true;
      document.addEventListener('click', function () { closeMenus(document); });
    }
  }
  let _docBound = false;

  window.DroboardNotif = { render, renderGroups, bind, closeMenus, _esc };
})();
