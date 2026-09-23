/**
 * dashboard-shell.js — Droboard Reusable Admin Shell (sidebar + topbar)
 * ─────────────────────────────────────────────────────────────────────
 * Drop one <script src="shared/dashboard-shell.js"></script> near the top of
 * <body> (or in <head>, doesn't matter — it does nothing until you call
 * attach()). No load-order dependency on any other Droboard module.
 *
 * WHAT IT DOES
 * ────────────
 * Wraps whatever HTML is already inside your target container with the
 * full admin chrome — sidebar nav, mobile off-canvas behaviour, topbar
 * (title, search, theme toggle, bell -> notification-center.html, profile),
 * and the shared design tokens (--accent, --card, --border, etc. + light/dark
 * theme). Your existing markup is preserved and moved into the content slot
 * untouched — this module only wraps it, it never rewrites it.
 */

(function () {
  'use strict';

  if (window.__droboardDashboardShell) return;
  window.__droboardDashboardShell = true;

  const THEME_KEY = 'droboardTheme';

  // ── Default nav ──────────────────────────────────────────
  const DEFAULT_NAV = [
    { section: null, items: [
      { label: 'Dashboard', icon: 'fa-house', href: 'dashboard.html' },
    ] },
    { section: 'Content Management', items: [
      { label: 'Book Management', icon: 'fa-book', href: 'book-management.html' },
      { label: 'Categories & Genres', icon: 'fa-tags', href: 'categories-genres.html' },
      { label: 'Reports & Flags', icon: 'fa-flag', href: 'reports-flags.html' },
    ] },
    { section: 'Author Management', items: [
      { label: 'Authors', icon: 'fa-users', href: 'authors.html' },
      { label: 'Author Messages', icon: 'fa-comment-dots', href: 'author-messages.html' },
      { label: 'Author Verification', icon: 'fa-user-check', href: 'author-verification.html' },
    ] },
    { section: 'Financial Management', items: [
      { label: 'Withdrawal Requests', icon: 'fa-money-bill-wave', href: 'withdrawal-requests.html' },
      { label: 'Payments', icon: 'fa-credit-card', href: 'payments.html' },
      { label: 'Earnings Overview', icon: 'fa-chart-line', href: 'earnings-overview.html' },
      { label: 'Transaction History', icon: 'fa-clock-rotate-left', href: 'transaction-history.html' },
    ] },
    { section: 'Promotions & Marketing', items: [
      { label: 'Promotions', icon: 'fa-bullhorn', href: 'promotions.html' },
      { label: 'Featured & Banners', icon: 'fa-images', href: 'featured-banners.html' },
      { label: 'Announcements', icon: 'fa-volume-high', href: 'announcements.html' },
    ] },
    { section: 'Platform & Settings', items: [
      { label: 'Activity Logs', icon: 'fa-list-check', href: 'activity-logs.html' },
    ] },
  ];

  // ── CSS ──────────────────────────────────────────────────
  const CSS = `
  :root{
    --sidebar-bg:#14142b; --sidebar-bg-2:#1a1a38; --sidebar-text:#8d86ac;
    --sidebar-text-active:#ffffff; --sidebar-border:rgba(255,255,255,.06);
    --accent:#ff0050; --accent-2:#000000; --accent-soft:rgba(255,0,80,.14);
    --green:#16a34a; --green-bg:#e2f8ea; --blue:#2f7de1; --blue-bg:#e3ecfd;
    --amber:#d97706; --amber-bg:#fef3d8; --red:#e0384d; --red-bg:#fde3e3;
    --radius:14px; --shadow:0 1px 2px rgba(20,10,50,.04), 0 8px 24px -12px rgba(20,10,50,.08);
  }
  html[data-theme="light"]{
    --bg:#f4f4fb; --card:#ffffff; --text:#1a1730; --text-muted:#71708a; --text-faint:#9694ac;
    --border:#eceaf5; --input-bg:#ffffff; --input-border:#e4e2f1; --hover:#f7f6fd; --table-head:#faf9ff;
  }
  html[data-theme="dark"]{
    --bg:#0d0b1a; --card:#161329; --text:#f1f0f8; --text-muted:#a29fbf; --text-faint:#716e93;
    --border:#2a2648; --input-bg:#1d1a35; --input-border:#332e56; --hover:#1e1a38; --table-head:#191531;
  }
  .dsh-root, .dsh-root *{box-sizing:border-box}
  .dsh-root{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text)}
  .dsh-root a{text-decoration:none;color:inherit}
  .dsh-root button{font-family:inherit;cursor:pointer}
  .dsh-shell{display:flex;min-height:100vh}
  .dsh-sidebar{width:264px;flex-shrink:0;background:var(--sidebar-bg);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;border-right:1px solid var(--sidebar-border);z-index:300}
  .dsh-sb-logo{display:flex;align-items:center;gap:11px;padding:22px 20px 18px}
  .dsh-sb-logo-ico{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}
  .dsh-sb-logo-txt{line-height:1.25}
  .dsh-sb-logo-txt b{display:block;font-size:12.5px;font-weight:800;color:#fff;letter-spacing:.04em}
  .dsh-sb-nav{flex:1;overflow-y:auto;padding:4px 12px 12px}
  .dsh-sb-section-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;color:#5f5885;text-transform:uppercase;padding:16px 10px 6px}
  .dsh-sidebar .dsh-sb-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--sidebar-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:.15s;cursor:pointer}
  .dsh-sidebar .dsh-sb-item i{width:16px;text-align:center;font-size:14px;flex-shrink:0}
  .dsh-sidebar .dsh-sb-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .dsh-sidebar .dsh-sb-item.active{background:var(--accent);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(255,0,80,.35)}
  .dsh-sb-support{margin:10px 12px 16px;padding:16px 14px;border-radius:14px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border)}
  .dsh-sb-support i{color:var(--accent);font-size:16px;margin-bottom:8px;display:block}
  .dsh-sb-support b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px}
  .dsh-sb-support p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px}
  .dsh-sb-support button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:9px;font-size:12px;font-weight:700}
  .dsh-sb-close{display:none}
  .dsh-sb-overlay{display:none;position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:290}
  .dsh-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .dsh-topbar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:18px;padding:14px 26px}
  .dsh-hamburger{display:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .dsh-tb-title h1{font-size:18px;font-weight:800;margin:0}
  .dsh-tb-title p{font-size:12px;color:var(--text-muted);margin-top:1px}
  .dsh-tb-spacer{flex:1}
  .dsh-tb-search{display:flex;align-items:center;gap:9px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:11px;padding:9px 14px;width:300px;flex-shrink:0}
  .dsh-tb-search input{border:none;background:none;outline:none;color:var(--text);font-size:13px;flex:1;font-family:inherit}
  .dsh-tb-search input::placeholder{color:var(--text-faint)}
  .dsh-tb-search i{color:var(--text-faint);font-size:13px}
  .dsh-tb-icon-btn{position:relative;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:15px;flex-shrink:0;transition:.15s}
  .dsh-tb-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
  .dsh-tb-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--red);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}
  .dsh-theme-toggle{width:52px;height:30px;border-radius:20px;background:var(--input-bg);border:1px solid var(--input-border);position:relative;flex-shrink:0}
  .dsh-theme-toggle .dsh-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;transition:transform .25s cubic-bezier(.4,0,.2,1)}
  html[data-theme="dark"] .dsh-theme-toggle .dsh-knob{transform:translateX(22px)}
  .dsh-tb-profile{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:30px;border:1px solid var(--input-border);flex-shrink:0;cursor:pointer}
  .dsh-tb-profile img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .dsh-tb-profile-txt{line-height:1.2}
  .dsh-tb-profile-txt b{font-size:12.5px;display:block}
  .dsh-tb-profile-txt span{font-size:10.5px;color:var(--text-muted)}
  .dsh-tb-profile i{color:var(--text-faint);font-size:11px;margin-left:2px}
  .dsh-mobile-search-btn{display:none;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-shrink:0}
  .dsh-content{padding:22px 26px 60px}
  .dsh-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#1a1730;color:#fff;padding:10px 18px;border-radius:24px;font-size:12.5px;font-weight:600;z-index:2000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .dsh-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @media (max-width:1024px){
    .dsh-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 40px rgba(0,0,0,.4)}
    .dsh-sidebar.open{transform:translateX(0)}
    .dsh-sb-overlay.show{display:block}
    .dsh-hamburger{display:flex}
    .dsh-sb-close{display:flex;margin-left:auto;width:30px;height:30px;border-radius:8px;background:var(--sidebar-bg-2);color:#cfc9e8;align-items:center;justify-content:center;border:none;font-size:13px}
    .dsh-tb-search{display:none}
    .dsh-mobile-search-btn{display:flex}
    .dsh-tb-title p{display:none}
  }
  @media (max-width:860px){
    .dsh-content{padding:16px}
    .dsh-topbar{padding:12px 16px}
    .dsh-tb-profile-txt{display:none}
    .dsh-tb-profile i{display:none}
  }
  .dsh-root button:focus-visible, .dsh-root input:focus-visible, .dsh-root a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  `;

  // ── Utils ────────────────────────────────────────────────
  function _esc(s) { return (s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('dsh-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dsh-toast';
      el.className = 'dsh-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
  if (typeof window.toast !== 'function') window.toast = _toast;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'dsh-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _currentFile() {
    const path = location.pathname.split('/').pop();
    return path || 'index.html';
  }

  // ── Instance factory ─────────────────────────────────────
  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[DroboardShell] Target not found:', target); return null; }

    const instId = 'dsh' + (++_instanceCounter);
    const nav = options.navItems || DEFAULT_NAV;
    let activeFile = options.activeFile || _currentFile();
    const user = Object.assign({ name: 'User', role: '', avatar: null }, options.user || {});
    const notifCount = options.notifCount != null ? options.notifCount : 0;
    const existingContent = container.innerHTML;

    function navHtml() {
      return nav.map(group => `
        ${group.section ? `<div class="dsh-sb-section-lbl">${_esc(group.section)}</div>` : ''}
        ${group.items.map(item => `
          <a class="dsh-sb-item${item.href === activeFile ? ' active' : ''}" href="${_esc(item.href)}" data-dsh-file="${_esc(item.href)}">
            <i class="fas ${item.icon}"></i>${_esc(item.label)}
          </a>`).join('')}
      `).join('');
    }

    container.classList.add('dsh-root');
    container.innerHTML = `
      <div class="dsh-shell">
        <div class="dsh-sb-overlay" id="${instId}-overlay"></div>
        <aside class="dsh-sidebar" id="${instId}-sidebar">
          <div class="dsh-sb-logo">
            <div class="dsh-sb-logo-ico"><i class="fas fa-book-open"></i></div>
            <div class="dsh-sb-logo-txt"><b>DROBOARD</b><b>DASHBOARD</b></div>
            <button class="dsh-sb-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <nav class="dsh-sb-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="dsh-sb-support">
            <i class="fas fa-headset"></i>
            <b>Quick Support</b>
            <p>Need help? Contact the engineering team.</p>
            <button id="${instId}-support">Contact Engineer</button>
          </div>
        </aside>
        <div class="dsh-main">
          <div class="dsh-topbar">
            <button class="dsh-hamburger" id="${instId}-hamburger"><i class="fas fa-bars"></i></button>
            <div class="dsh-tb-title">
              <h1 id="${instId}-title">${_esc(options.title || '')}</h1>
              <p id="${instId}-subtitle">${_esc(options.subtitle || '')}</p>
            </div>
            <div class="dsh-tb-spacer"></div>
            ${options.hideSearch ? '' : `
            <div class="dsh-tb-search">
              <i class="fas fa-magnifying-glass"></i>
              <input id="${instId}-search" placeholder="${_esc(options.searchPlaceholder || 'Search...')}"/>
            </div>
            <button class="dsh-mobile-search-btn" id="${instId}-mobile-search"><i class="fas fa-magnifying-glass"></i></button>`}
            <button class="dsh-theme-toggle" id="${instId}-theme" title="Toggle dark / light mode" aria-label="Toggle theme">
              <div class="dsh-knob"><i class="fas fa-sun" id="${instId}-theme-icon"></i></div>
            </button>
            <a class="dsh-tb-icon-btn" id="${instId}-bell" href="notification-center.html" style="display:flex;align-items:center;justify-content:center;text-decoration:none">
              <i class="fas fa-bell"></i>
              ${notifCount > 0 ? `<span class="dsh-tb-badge">${notifCount}</span>` : ''}
            </a>
            <div class="dsh-tb-profile" id="${instId}-profile">
              ${user.avatar ? `<img src="${_esc(user.avatar)}" alt="${_esc(user.name)}"/>` : ''}
              <div class="dsh-tb-profile-txt"><b>${_esc(user.name)}</b><span>${_esc(user.role)}</span></div>
              <i class="fas fa-chevron-down"></i>
            </div>
          </div>
          <div class="dsh-content" id="${instId}-content"></div>
        </div>
      </div>`;

    const contentEl = document.getElementById(instId + '-content');
    contentEl.innerHTML = existingContent;

    const sidebarEl = document.getElementById(instId + '-sidebar');
    const overlayEl = document.getElementById(instId + '-overlay');
    const navEl = document.getElementById(instId + '-nav');

    function openSidebar() { sidebarEl.classList.add('open'); overlayEl.classList.add('show'); }
    function closeSidebar() { sidebarEl.classList.remove('open'); overlayEl.classList.remove('show'); }
    document.getElementById(instId + '-hamburger').addEventListener('click', openSidebar);
    document.getElementById(instId + '-close').addEventListener('click', closeSidebar);
    overlayEl.addEventListener('click', closeSidebar);
    navEl.querySelectorAll('.dsh-sb-item').forEach(item => item.addEventListener('click', closeSidebar));

    // ── Theme
    const themeIconEl = document.getElementById(instId + '-theme-icon');
    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      themeIconEl.className = t === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
      try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    }
    let savedTheme = 'light';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(savedTheme);
    document.getElementById(instId + '-theme').addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    });

    // ── Search
    const searchEl = document.getElementById(instId + '-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        if (typeof options.onSearch === 'function') options.onSearch(searchEl.value);
      });
    }
    const mobileSearchBtn = document.getElementById(instId + '-mobile-search');
    if (mobileSearchBtn) {
      mobileSearchBtn.addEventListener('click', () => {
        const target = options.mobileSearchTarget ? document.querySelector(options.mobileSearchTarget) : searchEl;
        if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.focus(); }
      });
    }

    // ── Profile / support
    document.getElementById(instId + '-profile').addEventListener('click', () => {
      if (typeof options.onProfileClick === 'function') options.onProfileClick();
      else _toast('Account menu');
    });
    document.getElementById(instId + '-support').addEventListener('click', () => {
      if (typeof options.onSupportClick === 'function') options.onSupportClick();
      else _toast('Opening support chat…');
    });

    return {
      setTitle(title, subtitle) {
        document.getElementById(instId + '-title').textContent = title || '';
        if (subtitle !== undefined) document.getElementById(instId + '-subtitle').textContent = subtitle || '';
      },
      setActive(file) {
        activeFile = file;
        navEl.querySelectorAll('.dsh-sb-item').forEach(a => a.classList.toggle('active', a.dataset.dshFile === file));
      },
      setTheme: applyTheme,
      openSidebar,
      closeSidebar,
      getContentEl() { return contentEl; },
      destroy() {
        container.classList.remove('dsh-root');
        container.innerHTML = existingContent;
      },
    };
  }

  window.DroboardShell = { attach, DEFAULT_NAV };

})();
