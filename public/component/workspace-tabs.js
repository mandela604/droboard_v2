/**
 * workspace-tabs.js — Droboard Reusable Book Workspace Tabs
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="component/workspace-tabs.js"></script> on any
 * book-workspace page (after Font Awesome). The sticky tab bar builds
 * and injects itself automatically. No per-page markup required.
 *
 * If a page still has the old static tabs markup
 * (<div class="tabs-wrap">…</div> or <div class="tabs" id="tabsRow">…</div>),
 * this script removes it so you don’t get double bars.
 *
 * ── TABS & TARGET PAGES ────────────────────────────────────────────
 *   Overview   → book-overview.html     (fa-file-lines)
 *   Chapters   → book-workspace.html    (fa-book-open)
 *   Plotting   → plotting.html          (fa-diagram-project)
 *   Characters → characters.html        (fa-user-group)
 *   Analytics  → book-analytics.html    (fa-chart-line)
 *   Revenue    → book-revenue.html      (fa-sack-dollar)
 *   Contract   → contract.html          (fa-file-signature)
 *   More       → book-more.html         (fa-ellipsis)
 *
 * Active tab is auto-detected from the current filename. Override:
 *
 *   DroboardWorkspaceTabs.configure({ active: 'plotting' });
 *
 * ── THEMING ────────────────────────────────────────────────────────
 * Shares the same localStorage key as bottom-nav / search-overlay
 * ('dro_search_theme_v1'). Light is default.
 *
 *   DroboardWorkspaceTabs.setTheme('dark');
 *   DroboardWorkspaceTabs.setLocalTheme('dark');  // this page only
 *
 * ── STYLING ────────────────────────────────────────────────────────
 * Every class is prefixed `wt-` so it never collides with host CSS.
 */

(function () {
  'use strict';

  if (window.__droboardWorkspaceTabs) return;
  window.__droboardWorkspaceTabs = true;

  const CSS = `
    .wt-root{
      --wt-bg:#FFFFFF;
      --wt-border:#E8E8EC;
      --wt-active:#FF0050;
      --wt-inactive:#71717A;
      --wt-surface:#FFFFFF;

      position:sticky;top:65px;z-index:80;
      background:var(--wt-bg);border-bottom:1px solid var(--wt-border);
      font-family:'DM Sans','Inter',system-ui,sans-serif;
      transition:background .2s ease,border-color .2s ease;
    }
    .wt-root[data-wt-theme="dark"]{
      --wt-bg:#0a0a0c;
      --wt-border:rgba(255,255,255,.08);
      --wt-active:#ff0050;
      --wt-inactive:#71717a;
      --wt-surface:#0a0a0c;
    }
    .wt-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .wt-scroll{
      display:flex;gap:6px;overflow-x:auto;padding:0 12px;
      scrollbar-width:none;-webkit-overflow-scrolling:touch;
    }
    .wt-scroll::-webkit-scrollbar{display:none}
    .wt-item{
      flex-shrink:0;display:flex;align-items:center;gap:6px;
      padding:12px 12px 11px;font-size:12.5px;font-weight:700;
      color:var(--wt-inactive);border-bottom:2.5px solid transparent;
      white-space:nowrap;cursor:pointer;text-decoration:none;
      transition:color .15s ease,border-color .15s ease;
    }
    .wt-item i{font-size:12px}
    .wt-item.active{color:var(--wt-active);border-bottom-color:var(--wt-active)}
    .wt-item:active{opacity:.75}

    @media (min-width:600px){
      .wt-root{max-width:560px;margin:0 auto}
      .wt-scroll{max-width:560px;margin:0 auto}
    }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'wt-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  const THEME_KEY = 'dro_search_theme_v1';
  function _loadTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function _saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }

  let _theme = _loadTheme();
  let _localOverride = null;

  function _applyTheme(t) {
    _theme = t === 'dark' ? 'dark' : 'light';
    if (_root) _root.setAttribute('data-wt-theme', _theme);
  }

  function setTheme(t) {
    _localOverride = null;
    _saveTheme(t === 'dark' ? 'dark' : 'light');
    _applyTheme(t);
  }
  function getTheme() { return _theme; }
  function toggleTheme() { setTheme(_theme === 'dark' ? 'light' : 'dark'); }
  function setLocalTheme(t) {
    _localOverride = t === 'dark' ? 'dark' : 'light';
    _applyTheme(_localOverride);
  }

  window.addEventListener('storage', e => {
    if (e.key === THEME_KEY && !_localOverride) _applyTheme(_loadTheme());
  });
  window.addEventListener('focus', () => {
    if (!_localOverride) _applyTheme(_loadTheme());
  });

  /* ── Tab config ── */
  const TABS = [
    { key: 'overview',   label: 'Overview',   href: 'book-overview.html',   icon: 'fa-file-lines' },
    { key: 'chapters',   label: 'Chapters',   href: 'book-workspace.html',  icon: 'fa-book-open' },
    { key: 'plotting',   label: 'Plotting',   href: 'plotting.html',        icon: 'fa-diagram-project' },
    { key: 'characters', label: 'Characters', href: 'characters.html',      icon: 'fa-user-group' },
    { key: 'analytics',  label: 'Analytics',  href: 'book-analytics.html',  icon: 'fa-chart-line' },
    { key: 'revenue',    label: 'Revenue',    href: 'book-revenue.html',    icon: 'fa-sack-dollar' },
    { key: 'contract',   label: 'Contract',   href: 'contract.html',        icon: 'fa-file-signature' },
    { key: 'more',       label: 'More',       href: 'book-more.html',       icon: 'fa-ellipsis' },
  ];

  let _forcedActive = null;
  let _root = null;

  function _detectActive() {
    if (_forcedActive) return _forcedActive;
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    const match = TABS.find(t => t.href.toLowerCase() === path);
    return match ? match.key : 'chapters';
  }

  function configure(options) {
    options = options || {};
    if (options.active) { _forcedActive = options.active; _renderActive(); }
    if (options.localTheme) setLocalTheme(options.localTheme);
    else if (options.theme) setTheme(options.theme);
  }

  function _removeExistingTabs() {
    document.querySelectorAll('.tabs-wrap, #tabsRow').forEach(el => {
      if (el !== _root && !el.closest('.wt-root')) el.remove();
    });
  }

  function _renderActive() {
    if (!_root) return;
    const active = _detectActive();
    _root.querySelectorAll('.wt-item').forEach(el => {
      el.classList.toggle('active', el.dataset.wtKey === active);
    });
  }

  function build() {
    if (_root) return;
    _injectStyles();
    _removeExistingTabs();

    _root = document.createElement('div');
    _root.className = 'wt-root';
    _root.setAttribute('data-wt-theme', _theme);
    _root.innerHTML = `
      <div class="wt-scroll">
        ${TABS.map(t => `
          <a class="wt-item" data-wt-key="${t.key}" href="${t.href}">
            <i class="fas ${t.icon}"></i>${t.label}
          </a>`).join('')}
      </div>`;
    document.body.appendChild(_root);

    // Prefer inserting after .book-head if present, else after .topbar
    const bookHead = document.querySelector('.book-head');
    const topbar = document.querySelector('.topbar');
    if (bookHead && bookHead.parentNode) {
      bookHead.parentNode.insertBefore(_root, bookHead.nextSibling);
    } else if (topbar && topbar.parentNode) {
      topbar.parentNode.insertBefore(_root, topbar.nextSibling);
    }

    _renderActive();
  }

  window.DroboardWorkspaceTabs = {
    configure, setTheme, getTheme, toggleTheme, setLocalTheme
  };

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);

})();

/*─── USAGE ──────────────────────────────────────────────────────────────

  1) Add after Font Awesome on every book-workspace page:

     <script src="component/workspace-tabs.js"></script>

  2) Remove the old static tabs markup:

     <div class="tabs-wrap">
       <div class="tabs" id="tabsRow"></div>
     </div>

     (Optional during migration — the script strips .tabs-wrap / #tabsRow.)

  3) Active tab is detected from the filename. Force it if needed:

     DroboardWorkspaceTabs.configure({ active: 'plotting' });

  4) Theme stays in sync with bottom-nav / search-overlay automatically.

─────────────────────────────────────────────────────────────────────────*/