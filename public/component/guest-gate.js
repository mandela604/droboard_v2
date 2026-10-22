/**
 * component/guest-gate.js — Droboard Guest Gate
 * ─────────────────────────────────────────────────────────────────────
 * Shown when a visitor has NO account (no session). Account-only areas
 * (your own profile, your library) can't show real content for them,
 * so instead of an empty shell we show:
 *
 *   1. A clear "create an account / log in" call to action
 *   2. The perks they get for signing up
 *   3. Story recommendations so they can start reading right away —
 *      rendered with the SAME shared component the book reader uses
 *      (component/more-like-this.js → DiscoverCard cards).
 *
 * Self-contained CSS (gg- prefixed) + DOM. No per-page markup needed.
 *
 *   <script src="component/guest-gate.js"></script>
 *   <script src="component/more-like-this.js"></script>
 *   <script src="component/discover-card.js"></script>
 *
 *   DroboardGuestGate.mount({
 *     anchor: '#profileRoot',     // where to insert (defaults to #profileRoot)
 *     variant: 'profile',         // 'profile' | 'library'
 *     title: 'Join Droboard',
 *     sub: 'Create a free account…',
 *     cta: [{ label: 'Create account', href: 'signup.html', primary: true },
 *           { label: 'Log in', href: 'login.html?next=profile.html' }],
 *   });
 *
 *   DroboardGuestGate.unmount();
 *
 * Browsing other people's profiles (?u=handle) stays public — the gate
 * is only for the signed-out visitor's OWN profile / library.
 */
(function () {
  'use strict';

  if (window.DroboardGuestGate) return;

  /* Colour tokens fall back through both of the app's naming schemes so
     the gate looks right on every page:
       theme.css pages  → --tx-high / --tx-body / --tx-muted / --acc / --bd
       library & others → --ink / --ink-2 / --gray-600 / --pink / --line     */
  const CSS = `
    .gg-root{display:none;padding:8px 14px 20px;animation:ggIn .28s ease}
    .gg-root.gp-on{display:block}
    @keyframes ggIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .gg-hero{text-align:center;padding:26px 12px 18px}
    .gg-icon{width:62px;height:62px;border-radius:19px;margin:0 auto 14px;
      background:linear-gradient(135deg,rgba(255,0,80,.1),rgba(167,139,250,.08));
      border:1px solid var(--bd-acc,rgba(255,0,80,.22));
      display:flex;align-items:center;justify-content:center;
      color:var(--acc,var(--pink,#ff0050));font-size:24px}
    .gg-title{font-size:19px;font-weight:800;color:var(--tx-high,var(--ink,#161616));margin-bottom:7px;letter-spacing:-.2px}
    .gg-sub{font-size:13px;color:var(--tx-muted,var(--gray-600,#666));line-height:1.55;max-width:300px;margin:0 auto 18px}
    .gg-cta{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
    .gg-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
      padding:11px 20px;border-radius:22px;font-size:12.5px;font-weight:800;
      text-decoration:none;cursor:pointer;border:1.5px solid var(--bd,var(--line,rgba(0,0,0,.12)));
      background:rgba(0,0,0,.04);color:var(--tx-body,var(--ink-2,#161616));transition:.16s}
    .gg-btn:active{transform:scale(.96)}
    .gg-btn.gp-primary{background:var(--acc,var(--pink,#ff0050));border-color:var(--acc,var(--pink,#ff0050));color:#fff;
      box-shadow:0 4px 16px rgba(255,0,80,.28)}
    [data-theme="dark"] .gg-btn{background:rgba(255,255,255,.07)}
    [data-theme="dark"] .gg-btn.gp-primary{background:var(--acc,var(--pink,#ff0050))}
    .gg-perks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px;text-align:left}
    .gg-perk{display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:13px;
      background:rgba(0,0,0,.025);border:1px solid var(--bd,var(--line,rgba(0,0,0,.08)));font-size:11.5px;
      font-weight:600;color:var(--tx-body,var(--ink-2,#161616));line-height:1.35}
    [data-theme="dark"] .gg-perk{background:rgba(255,255,255,.04)}
    .gg-perk i{color:var(--acc,var(--pink,#ff0050));font-size:13px;flex-shrink:0}
    .gg-recs-head{display:flex;align-items:center;justify-content:space-between;margin:18px 0 10px}
    .gg-recs-title{font-size:11px;font-weight:800;color:var(--tx-muted,var(--gray-600,#666));
      text-transform:uppercase;letter-spacing:.1em}
    .gg-recs-more{font-size:10px;font-weight:700;color:var(--acc,var(--pink,#ff0050));text-decoration:none;
      background:rgba(255,0,80,.06);border:1px solid var(--bd-acc,rgba(255,0,80,.2));
      padding:4px 10px;border-radius:12px}
  `;

  const PERKS = {
    profile: [
      { icon: 'fa-bookmark', label: 'Save stories to your library' },
      { icon: 'fa-user-group', label: 'Follow writers & readers' },
      { icon: 'fa-chart-line', label: 'Track streaks & reading stats' },
      { icon: 'fa-feather-pointed', label: 'Publish your own books' },
    ],
    library: [
      { icon: 'fa-bookmark', label: 'Save stories you love' },
      { icon: 'fa-clock-rotate-left', label: 'Resume where you stopped' },
      { icon: 'fa-download', label: 'Read offline, anywhere' },
      { icon: 'fa-chart-line', label: 'Track streaks & reading stats' },
    ],
  };

  const DEFAULTS = {
    profile: {
      title: 'Join Droboard',
      sub: 'Create a free account to save stories, follow writers, and build your own shelf.',
      recsTitle: 'Start reading',
    },
    library: {
      title: 'Your library is waiting',
      sub: 'Log in to save stories, keep your reading history, and pick up where you left off.',
      recsTitle: 'Popular right now',
    },
  };

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'gg-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Category names carry an emoji in the demo data ("💔 Betrayal").
     The category is rendered as plain text in the platform red, so the
     emoji is stripped here. */
  function _catName(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .trim();
  }

  /* Recommendation items — shaped for the shared more-like-this component
     (id, img, title, author, badge, cat). */
  function _storyItems() {
    const d = window.DemoData || {};
    const list = d.STORIES || [];
    const badgeMap = { hot: 'hot', new: 'new', updated: 'update', update: 'update' };
    return list.map(s => ({
      id: s.id,
      img: s.cover || s.img || '',
      title: s.title || '',
      author: s.author || '',
      badge: badgeMap[s.gbadge] || badgeMap[String(s.badge || '').toLowerCase()] || '',
      cat: _catName(s.cat || s.genre || ''),
    }));
  }

  function _host(anchor) {
    let el = null;
    if (anchor) {
      el = typeof anchor === 'string' ? document.querySelector(anchor) : anchor;
    }
    if (!el) el = document.getElementById('guestRoot');
    if (!el) {
      el = document.getElementById('profileRoot');
    }
    return el;
  }

  function mount(opts) {
    opts = opts || {};
    _injectStyles();

    const variant = opts.variant === 'library' ? 'library' : 'profile';
    const def = DEFAULTS[variant];
    const perks = opts.perks || PERKS[variant] || [];

    // Where the gate goes: before the anchor (usually #profileRoot) so it
    // takes the place of the account-only content.
    const anchor = _host(opts.anchor);
    if (!anchor) return null;

    let root = document.getElementById('guestRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'guestRoot';
      root.className = 'gg-root';
      if (anchor.parentNode) anchor.parentNode.insertBefore(root, anchor);
      else document.body.appendChild(root);
    }

    const cta = (opts.cta && opts.cta.length) ? opts.cta : [
      { label: 'Create account', href: 'signup.html', primary: true },
      { label: 'Log in', href: 'login.html' },
    ];

    root.innerHTML =
      '<div class="gg-hero">' +
        '<div class="gg-icon"><i class="fas fa-feather-pointed"></i></div>' +
        '<div class="gg-title">' + _esc(opts.title || def.title) + '</div>' +
        '<div class="gg-sub">' + _esc(opts.sub || def.sub) + '</div>' +
        '<div class="gg-cta">' +
          cta.map(c =>
            '<a class="gg-btn' + (c.primary ? ' gp-primary' : '') + '" href="' + _esc(c.href) + '">' +
            (c.icon ? '<i class="fas ' + _esc(c.icon) + '"></i>' : '') +
            _esc(c.label) + '</a>'
          ).join('') +
        '</div>' +
        (perks.length
          ? '<div class="gg-perks">' + perks.map(p =>
              '<div class="gg-perk"><i class="fas ' + _esc(p.icon) + '"></i><span>' + _esc(p.label) + '</span></div>'
            ).join('') + '</div>'
          : '') +
      '</div>' +
      '<div class="gg-recs-head">' +
        '<div class="gg-recs-title">' + _esc(opts.recsTitle || def.recsTitle) + '</div>' +
        '<a class="gg-recs-more" href="discover.html">See all</a>' +
      '</div>' +
      '<div id="guestStoryRecs"></div>';

    // Story recommendations via the shared "More Like This" component
    // (same one the book reader uses).
    try {
      const items = _storyItems();
      if (items.length && window.DroboardMoreLikeThis) {
        DroboardMoreLikeThis.mount('#guestStoryRecs', items.slice(0, 10), {
          title: opts.recsTitle || def.recsTitle,
          icon: '✨',
          limit: 10,
          heading: false,
        });
      }
    } catch (e) {}

    root.classList.add('gp-on');
    root.style.display = 'block';
    return root;
  }

  function unmount() {
    const root = document.getElementById('guestRoot');
    if (root) {
      root.innerHTML = '';
      root.classList.remove('gp-on');
      root.style.display = 'none';
    }
  }

  window.DroboardGuestGate = { mount: mount, unmount: unmount };
})();
