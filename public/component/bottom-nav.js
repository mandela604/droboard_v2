/**
 * bottom-nav.js — Droboard Reusable Bottom Nav Component
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="component/bottom-nav.js"></script> on any page
 * (after Font Awesome, same as every other Droboard page already
 * loads). That's it — the nav bar builds and appends itself to <body>
 * automatically. No per-page markup required.
 *
 * If a page still has the old static bottom nav markup
 * (<div class="bottom-nav">…</div> or <nav class="bottom-nav">…</nav>),
 * this script removes it automatically so you don't get two nav bars —
 * you can leave the old markup in place during migration and just
 * delete it later at your leisure.
 *
 * ── TABS ───────────────────────────────────────────────────────────
 *   Home      → index.html      (fa-house)
 *   Discover  → discover.html   (fa-compass)
 *   Library   → library.html    (fa-book)      ← replaces "Search"
 *   Feed      → feed.html       (fa-rss)
 *   Profile   → profile.html    (fa-circle-user)
 *
 * The active tab is auto-detected from the current page URL — no
 * config needed on a normal page. Override it if you ever need to
 * (e.g. a page not in the list):
 *
 *   DroboardNav.configure({ active: 'library' });
 *
 * ── THEMING ────────────────────────────────────────────────────────
 * Reads its theme from the SAME localStorage key search-overlay.js
 * uses ('dro_search_theme_v1'), so the nav bar and the search overlay
 * are always in sync — toggle the theme from either one and both
 * update (this component also listens for the 'storage' event so it
 * updates live if changed in another tab, and re-checks on focus so
 * it stays in sync within the same tab too).
 *
 * Light is the default, same as search-overlay.js, unless a theme was
 * already saved. Light tokens are lifted from feed.html's palette
 * (pink/purple/ink/white/gray). Dark tokens are lifted from index.html's
 * existing dark nav palette (acc pink-red on black).
 *
 *   DroboardNav.setTheme('dark');
 *   DroboardNav.getTheme();     // 'light' | 'dark'
 *   DroboardNav.toggleTheme();
 *
 * ── PAGE-LOCAL THEME OVERRIDE ──────────────────────────────────────
 * Some pages want a different DEFAULT look for their nav bar only,
 * without changing the shared preference every other page reads (and
 * without permanently overwriting a person's explicit light/dark
 * choice just because they visited one page). Use `localTheme` for
 * that — it changes what's displayed on THIS page only. It never
 * touches localStorage, so no other page is affected, and it isn't
 * clobbered by theme changes made in another tab/page while this one
 * is open:
 *
 *   DroboardNav.configure({ active: 'home', localTheme: 'dark' });
 *   // or:
 *   DroboardNav.setLocalTheme('dark');
 *
 * Calling `setTheme(...)` (the shared, persisted version) or letting
 * the person use a real theme toggle on this page clears the local
 * override and goes back to normal shared-preference behavior.
 *
 * ── STYLING ────────────────────────────────────────────────────────
 * Every class is prefixed `bn-` (Bottom Nav) so it can never collide
 * with a host page's own CSS.
 */

(function () {
  'use strict';

  if (window.__droboardBottomNav) return;
  window.__droboardBottomNav = true;

  // ══════════════════════════════════════════════════════════════════
  // CSS — bn- prefixed, self-contained, injected once.
  // Light tokens (default) come from feed.html's :root palette.
  // Dark tokens come from index.html's existing dark bottom-nav look.
  // ══════════════════════════════════════════════════════════════════
  const CSS = `
    .bn-root{
      /* ---- Light theme tokens (default) — from feed.html :root ---- */
      --bn-bg:rgba(255,255,255,.98);
      --bn-border:#EDEDF2;
      --bn-active:#E91E63;
      --bn-inactive:#9793a8;
      --bn-shadow:rgba(0,0,0,.06);

      position:fixed;bottom:0;left:50%;transform:translateX(-50%);
      width:100%;max-width:420px;z-index:100;
      background:var(--bn-bg);backdrop-filter:blur(16px);
      border-top:1px solid var(--bn-border);
      display:flex;justify-content:space-around;
      padding:9px 0 calc(env(safe-area-inset-bottom,0px) + 10px);
      box-shadow:0 -2px 14px var(--bn-shadow);
      font-family:'DM Sans','Inter',system-ui,sans-serif;
      transition:background .2s ease,border-color .2s ease;
    }
    .bn-root[data-bn-theme="dark"]{
      /* ---- Dark theme tokens — from index.html's dark nav ---- */
      --bn-bg:rgba(0,0,0,.97);
      --bn-border:rgba(255,255,255,.08);
      --bn-active:#ff0050;
      --bn-inactive:#666;
      --bn-shadow:rgba(0,0,0,.5);
    }
    .bn-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .bn-item{
      display:flex;flex-direction:column;align-items:center;gap:3px;
      font-size:10px;font-weight:600;color:var(--bn-inactive);
      text-decoration:none;cursor:pointer;padding:2px 12px;
      transition:color .15s ease;
    }
    .bn-item i{font-size:20px;display:block}
    .bn-item.active{color:var(--bn-active)}
    .bn-item:active{opacity:.7}
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'bn-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  // ══════════════════════════════════════════════════════════════════
  // Theme state — shared key with search-overlay.js so both components
  // always agree. Light is the default on first load, always.
  //
  // `_localOverride` holds a page-scoped theme that, when set, wins
  // over the shared/persisted value for THIS page's render — but is
  // never written to localStorage and never leaks to other pages.
  // ══════════════════════════════════════════════════════════════════
  const THEME_KEY = 'dro_search_theme_v1';
  function _loadTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function _saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }

  let _theme = _loadTheme();
  let _localOverride = null; // null = follow shared theme; 'light'|'dark' = page-local override

  function _applyTheme(t) {
    _theme = t === 'dark' ? 'dark' : 'light';
    if (_root) _root.setAttribute('data-bn-theme', _theme);
  }

  // Shared, persisted theme change — affects every page, clears any
  // page-local override that was in effect here.
  function setTheme(t) { _localOverride = null; _saveTheme(t === 'dark' ? 'dark' : 'light'); _applyTheme(t); }
  function getTheme() { return _theme; }
  function toggleTheme() { setTheme(_theme === 'dark' ? 'light' : 'dark'); }

  // Page-local theme override — affects only this page's nav, never
  // touches localStorage, and isn't overwritten by shared theme
  // changes coming from other tabs/pages while this one is open.
  function setLocalTheme(t) {
    _localOverride = t === 'dark' ? 'dark' : 'light';
    _applyTheme(_localOverride);
  }

  // Stay in sync with the search overlay (or another tab) if the
  // shared theme changes after this nav has already built — unless
  // this page has its own local override in effect.
  window.addEventListener('storage', e => {
    if (e.key === THEME_KEY && !_localOverride) _applyTheme(_loadTheme());
  });
  window.addEventListener('focus', () => {
    if (!_localOverride) _applyTheme(_loadTheme());
  });

  // ══════════════════════════════════════════════════════════════════
  // Nav config
  // ══════════════════════════════════════════════════════════════════
  const NAV_ITEMS = [
    { key: 'home',     label: 'Home',     href: 'index.html',    icon: 'fa-house' },
    { key: 'discover', label: 'Discover', href: 'discover.html', icon: 'fa-compass' },
    { key: 'library',  label: 'Library',  href: 'library.html',  icon: 'fa-book' },
    { key: 'feed',     label: 'Feed',     href: 'feed.html',     icon: 'fa-rss' },
    { key: 'profile',  label: 'Profile',  href: 'profile.html',  icon: 'fa-circle-user' },
  ];

  let _forcedActive = null;

  function _detectActive() {
    if (_forcedActive) return _forcedActive;
    const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const match = NAV_ITEMS.find(it => it.href.toLowerCase() === path);
    return match ? match.key : 'home';
  }

  function configure(options) {
    options = options || {};
    if (options.active) { _forcedActive = options.active; _renderActive(); }
    if (options.localTheme) { setLocalTheme(options.localTheme); }
    else if (options.theme) { setTheme(options.theme); }
  }

  // ══════════════════════════════════════════════════════════════════
  // Build
  // ══════════════════════════════════════════════════════════════════
  let _root = null;

  function _removeExistingNav() {
    document.querySelectorAll('.bottom-nav').forEach(el => {
      if (el !== _root) el.remove();
    });
  }

  function _renderActive() {
    if (!_root) return;
    const active = _detectActive();
    _root.querySelectorAll('.bn-item').forEach(el => {
      el.classList.toggle('active', el.dataset.bnKey === active);
    });
  }

  function build() {
    if (_root) return;
    _injectStyles();
    _removeExistingNav();

    _root = document.createElement('nav');
    _root.className = 'bn-root';
    _root.setAttribute('data-bn-theme', _theme); // reflects any localTheme/theme already applied
    _root.innerHTML = NAV_ITEMS.map(it => `
      <a class="bn-item" data-bn-key="${it.key}" href="${it.href}">
        <i class="fas ${it.icon}"></i>${it.label}
      </a>`).join('');
    document.body.appendChild(_root);

    _renderActive();
  }

  window.DroboardNav = { configure, setTheme, getTheme, toggleTheme, setLocalTheme };

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  1) Add the script once per page (after Font Awesome):

     <script src="component/bottom-nav.js"></script>

  2) Delete the old static markup, e.g.:

     <div class="bottom-nav">
       <a class="bn-item active" href="index.html">...</a>
       ...
     </div>

     (Not urgent — the script removes any element with class
     "bottom-nav" automatically, so it's safe to leave in place while
     you migrate pages one at a time.)

  3) That's it. The active tab is detected from the current filename
     automatically. Library now lives where Search used to be and
     links to library.html.

  4) Theme stays in sync with search-overlay.js automatically (same
     localStorage key). To force a theme (shared, persisted — affects
     every page) or override the active tab:

     DroboardNav.configure({ theme: 'dark', active: 'library' });

  5) To give ONE page its own default nav theme without affecting any
     other page or the shared preference, use `localTheme` instead:

     DroboardNav.configure({ active: 'home', localTheme: 'dark' });

     This page's nav renders dark immediately (even before the shared
     preference has loaded), nothing is written to localStorage, and
     if the person changes the real theme elsewhere while this page is
     open, this page's nav stays on its local override rather than
     flipping back to match.

─────────────────────────────────────────────────────────────────────────*/