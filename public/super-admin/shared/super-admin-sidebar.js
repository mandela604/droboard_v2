/**
 * super-admin-sidebar.js — Droboard Super Admin Reusable App Shell
 * ─────────────────────────────────────────────────────────────────────
 * Same pattern as chief-editor-sidebar.js / senior-editor-sidebar.js /
 * marketing-sidebar.js — drop this script in, then call attach() on the
 * element already holding your page's content.
 *
 * The Super Admin sees EVERYTHING on the platform — people & access,
 * content, growth & finance, and platform ops — so this nav is grouped
 * into labeled sections to keep a long list scannable.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────
 *   <script src="shared/super-admin-sidebar.js"></script>
 *   <script>
 *     const shell = SuperAdminSidebar.attach('#dashRoot', {
 *       activeItem: 'dashboard',
 *       title: 'Dashboard',
 *       subtitle: 'Full platform overview',
 *       user: { name:'Tobi Adenuga', role:'Super Admin', avatar:'...' },
 *       notifCount: 9,
 *     });
 *
 * ── NAV ITEMS (grouped) ──────────────────────────────────────────────────
 *   Overview
 *     Dashboard              → dashboard.html
 *   People & Access
 *     Users                  → users.html
 *     Roles                  → roles.html
 *     Editorial Team         → editorial-team.html
 *   Content
 *     Authors & Content       → authors-content.html
 *     All Books                → all-books.html
 *     All Posts                → all-posts.html
 *   Growth & Finance
 *     Marketing & Growth      → marketing-growth.html
 *     Financials & Payouts    → financials.html
 *   Platform
 *     Reports & Moderation    → reports-moderation.html
 *     Platform Analytics      → platform-analytics.html
 *     Settings                 → settings.html
 */
(function () {
  'use strict';

  if (window.__superAdminSidebar) return;
  window.__superAdminSidebar = true;

  const THEME_KEY = 'droboardTheme';

  const MENU_ITEMS = [
    { key: 'dashboard',            label: 'Dashboard',              icon: 'fa-house',              href: 'dashboard.html',           section: 'Overview' },

    { key: 'users',                 label: 'Users',                   icon: 'fa-users',                href: 'users.html',                section: 'People & Access' },
    { key: 'roles',                 label: 'Roles',                   icon: 'fa-user-shield',          href: 'roles.html',                section: 'People & Access' },
    { key: 'editorial-team',       label: 'Editorial Team',         icon: 'fa-user-tie',            href: 'editorial-team.html',      section: 'People & Access' },

    { key: 'authors-content',      label: 'Authors & Content',      icon: 'fa-book',                href: 'authors-content.html',     section: 'Content' },
    { key: 'all-books',             label: 'All Books',               icon: 'fa-book-open',            href: 'all-books.html',            section: 'Content' },
    { key: 'all-posts',             label: 'All Posts',               icon: 'fa-rss',                  href: 'all-posts.html',            section: 'Content' },

    { key: 'marketing-growth',     label: 'Marketing & Growth',     icon: 'fa-bullseye',             href: 'marketing-growth.html',    section: 'Growth & Finance' },
    { key: 'financials',           label: 'Financials & Payouts',   icon: 'fa-sack-dollar',          href: 'financials.html',          section: 'Growth & Finance' },

    { key: 'reports-moderation',   label: 'Reports & Moderation',   icon: 'fa-shield-halved',        href: 'reports-moderation.html',  section: 'Platform' },
    { key: 'platform-analytics',   label: 'Platform Analytics',     icon: 'fa-chart-line',           href: 'platform-analytics.html',  section: 'Platform' },
    { key: 'settings',             label: 'Settings',               icon: 'fa-gear',                 href: 'settings.html',            section: 'Platform' },
  ];

  const CSS = `
  :root{
    --sa-sidebar-bg:#0f0f22; --sa-sidebar-bg-2:#161631; --sa-sidebar-text:#8d86ac;
    --sa-sidebar-text-active:#ffffff; --sa-sidebar-border:rgba(255,255,255,.06);
    --accent:#ff0050; --accent-2:#000000; --accent-soft:rgba(255,0,80,.14);
    --gold:#d4a017; --gold-bg:rgba(212,160,23,.12);
    --green:#16a34a; --green-bg:#e2f8ea; --blue:#2f7de1; --blue-bg:#e3ecfd;
    --amber:#d97706; --amber-bg:#fef3d8; --red:#e0384d; --red-bg:#fde3e3;
    --purple:#5b4bcf; --purple-bg:#ece9fb;
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
  .sa-root, .sa-root *{box-sizing:border-box}
  .sa-root{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text)}
  .sa-root a{text-decoration:none;color:inherit}
  .sa-root button{font-family:inherit;cursor:pointer}
  .sa-shell{display:flex;min-height:100vh}
  .sa-sidebar{width:270px;flex-shrink:0;background:var(--sa-sidebar-bg);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;border-right:1px solid var(--sa-sidebar-border);z-index:300}
  .sa-sb-logo{display:flex;align-items:center;gap:11px;padding:20px 18px 14px}
  .sa-sb-logo-ico{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--gold),#8a6a10);display:flex;align-items:center;justify-content:center;color:#0f0f22;font-size:16px;flex-shrink:0}
  .sa-sb-logo-txt{line-height:1.25}
  .sa-sb-logo-txt b{display:block;font-size:12.5px;font-weight:800;color:#fff;letter-spacing:.04em}
  .sa-sb-logo-txt b:last-child{color:var(--gold)}
  .sa-sb-close{display:none}
  .sa-role-badge{display:flex;align-items:center;gap:8px;margin:0 12px 14px;padding:9px 12px;background:var(--sa-sidebar-bg-2);border:1px solid var(--sa-sidebar-border);border-radius:12px}
  .sa-role-badge i{color:var(--gold);font-size:13px;width:22px;text-align:center}
  .sa-role-badge span{font-size:11px;font-weight:700;color:#cfc9e8;letter-spacing:.03em}
  .sa-sb-nav{flex:1;overflow-y:auto;padding:4px 12px 12px}
  .sa-sb-section-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;color:#5f5885;text-transform:uppercase;padding:16px 10px 6px}
  .sa-sb-section-lbl:first-child{padding-top:6px}
  .sa-sidebar .sa-sb-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--sa-sidebar-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:.15s;cursor:pointer;position:relative}
  .sa-sidebar .sa-sb-item i.sa-item-ico{width:16px;text-align:center;font-size:14px;flex-shrink:0}
  .sa-sidebar .sa-sb-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .sa-sidebar .sa-sb-item.active{background:linear-gradient(135deg,var(--accent),#a3003a);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(255,0,80,.35)}
  .sa-sb-footer{margin:10px 12px 16px;padding:16px 14px;border-radius:14px;background:var(--sa-sidebar-bg-2);border:1px solid var(--sa-sidebar-border)}
  .sa-sb-footer i{color:var(--gold);font-size:16px;margin-bottom:8px;display:block}
  .sa-sb-footer b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px}
  .sa-sb-footer p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px}
  .sa-sb-footer button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:9px;font-size:12px;font-weight:700}
  .sa-sb-overlay{display:none;position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:290}
  .sa-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .sa-topbar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:18px;padding:14px 26px}
  .sa-hamburger{display:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .sa-tb-title h1{font-size:18px;font-weight:800;margin:0}
  .sa-tb-title p{font-size:12px;color:var(--text-muted);margin-top:1px}
  .sa-tb-spacer{flex:1}
  .sa-tb-search{display:flex;align-items:center;gap:9px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:11px;padding:9px 14px;width:280px;flex-shrink:0}
  .sa-tb-search input{border:none;background:none;outline:none;color:var(--text);font-size:13px;flex:1;font-family:inherit}
  .sa-tb-search input::placeholder{color:var(--text-faint)}
  .sa-tb-search i{color:var(--text-faint);font-size:13px}
  .sa-tb-icon-btn{position:relative;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:15px;flex-shrink:0;transition:.15s}
  .sa-tb-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
  .sa-tb-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--red);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}
  .sa-theme-toggle{width:52px;height:30px;border-radius:20px;background:var(--input-bg);border:1px solid var(--input-border);position:relative;flex-shrink:0;cursor:pointer}
  .sa-theme-toggle .sa-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--gold),#8a6a10);color:#0f0f22;display:flex;align-items:center;justify-content:center;font-size:11px;transition:transform .25s cubic-bezier(.4,0,.2,1)}
  html[data-theme="dark"] .sa-theme-toggle .sa-knob{transform:translateX(22px)}
  .sa-tb-profile{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:30px;border:1px solid var(--input-border);flex-shrink:0;cursor:pointer}
  .sa-tb-profile img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .sa-tb-profile-txt{line-height:1.2}
  .sa-tb-profile-txt b{font-size:12.5px;display:block}
  .sa-tb-profile-txt span{font-size:10.5px;color:var(--text-muted)}
  .sa-tb-profile i{color:var(--text-faint);font-size:11px;margin-left:2px}
  .sa-mobile-search-btn{display:none;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-shrink:0}
  .sa-content{padding:22px 26px 60px}
  .sa-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#1a1730;color:#fff;padding:10px 18px;border-radius:24px;font-size:12.5px;font-weight:600;z-index:2000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .sa-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @media (max-width:1024px){
    .sa-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 40px rgba(0,0,0,.4)}
    .sa-sidebar.open{transform:translateX(0)}
    .sa-sb-overlay.show{display:block}
    .sa-hamburger{display:flex}
    .sa-sb-close{display:flex;margin-left:auto;width:30px;height:30px;border-radius:8px;background:var(--sa-sidebar-bg-2);color:#cfc9e8;align-items:center;justify-content:center;border:none;font-size:13px}
    .sa-tb-search{display:none}
    .sa-mobile-search-btn{display:flex}
    .sa-tb-title p{display:none}
  }
  @media (max-width:860px){
    .sa-content{padding:16px}
    .sa-topbar{padding:12px 16px}
    .sa-tb-profile-txt{display:none}
    .sa-tb-profile i{display:none}
  }
  .sa-root button:focus-visible, .sa-root input:focus-visible, .sa-root a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  `;

  function _esc(s) { return (s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('sa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sa-toast';
      el.className = 'sa-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }
  if (typeof window.toast !== 'function') window.toast = _toast;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'sa-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[SuperAdminSidebar] Target not found:', target); return null; }

    const instId = 'sa' + (++_instanceCounter);
    const menuItems = options.navItems || MENU_ITEMS;
    const activeItem = options.activeItem || 'dashboard';
    const user = Object.assign({ name: 'User', role: 'Super Admin', avatar: null }, options.user || {});
    const notifCount = options.notifCount != null ? options.notifCount : 0;
    const existingContent = container.innerHTML;

    function navHtml() {
      let lastSection = null;
      return menuItems.map(item => {
        const section = item.section || '';
        let sectionHtml = '';
        if (section !== lastSection) {
          sectionHtml = `<div class="sa-sb-section-lbl">${_esc(section)}</div>`;
          lastSection = section;
        }
        const isActive = item.key === activeItem;
        return `${sectionHtml}<a class="sa-sb-item${isActive ? ' active' : ''}"
                      href="${_esc(item.href)}"
                      data-item-key="${_esc(item.key)}">
              <i class="fas ${item.icon} sa-item-ico"></i>${_esc(item.label)}
            </a>`;
      }).join('');
    }

    container.classList.add('sa-root');
    container.innerHTML = `
      <div class="sa-shell">
        <div class="sa-sb-overlay" id="${instId}-overlay"></div>
        <aside class="sa-sidebar" id="${instId}-sidebar">
          <div class="sa-sb-logo">
            <div class="sa-sb-logo-ico"><i class="fas fa-crown"></i></div>
            <div class="sa-sb-logo-txt"><b>DROBOARD</b><b>SUPER ADMIN</b></div>
            <button class="sa-sb-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="sa-role-badge">
            <i class="fas fa-eye"></i>
            <span>Full Platform Visibility</span>
          </div>
          <nav class="sa-sb-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="sa-sb-footer">
            <i class="fas fa-headset"></i>
            <b>Engineering Support</b>
            <p>Escalate a platform issue directly to engineering.</p>
            <button id="${instId}-support">Contact Engineering</button>
          </div>
        </aside>
        <div class="sa-main">
          <div class="sa-topbar">
            <button class="sa-hamburger" id="${instId}-hamburger"><i class="fas fa-bars"></i></button>
            <div class="sa-tb-title">
              <h1 id="${instId}-title">${_esc(options.title || '')}</h1>
              <p id="${instId}-subtitle">${_esc(options.subtitle || '')}</p>
            </div>
            <div class="sa-tb-spacer"></div>
            ${options.hideSearch ? '' : `
            <div class="sa-tb-search">
              <i class="fas fa-magnifying-glass"></i>
              <input id="${instId}-search" placeholder="${_esc(options.searchPlaceholder || 'Search everything...')}"/>
            </div>
            <button class="sa-mobile-search-btn" id="${instId}-mobile-search"><i class="fas fa-magnifying-glass"></i></button>`}
            <button class="sa-theme-toggle" id="${instId}-theme" title="Toggle dark / light mode">
              <div class="sa-knob" id="${instId}-theme-icon"><i class="fas fa-sun"></i></div>
            </button>
            <a class="sa-tb-icon-btn" id="${instId}-bell" href="#" style="display:flex;align-items:center;justify-content:center;text-decoration:none">
              <i class="fas fa-bell"></i>
              ${notifCount > 0 ? `<span class="sa-tb-badge">${notifCount}</span>` : ''}
            </a>
            <div class="sa-tb-profile" id="${instId}-profile">
              ${user.avatar ? `<img src="${_esc(user.avatar)}" alt="${_esc(user.name)}"/>` : ''}
              <div class="sa-tb-profile-txt"><b>${_esc(user.name)}</b><span>${_esc(user.role)}</span></div>
              <i class="fas fa-chevron-down"></i>
            </div>
          </div>
          <div class="sa-content" id="${instId}-content"></div>
        </div>
      </div>`;

    const contentEl = document.getElementById(instId + '-content');
    contentEl.innerHTML = existingContent;
    const sidebarEl = document.getElementById(instId + '-sidebar');
    const overlayEl = document.getElementById(instId + '-overlay');

    function openSidebar() { sidebarEl.classList.add('open'); overlayEl.classList.add('show'); }
    function closeSidebar() { sidebarEl.classList.remove('open'); overlayEl.classList.remove('show'); }
    document.getElementById(instId + '-hamburger').addEventListener('click', openSidebar);
    document.getElementById(instId + '-close').addEventListener('click', closeSidebar);
    overlayEl.addEventListener('click', closeSidebar);
    document.getElementById(instId + '-nav').querySelectorAll('.sa-sb-item').forEach(item => {
      item.addEventListener('click', () => closeSidebar());
    });

    const themeKnob = document.getElementById(instId + '-theme-icon');
    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      themeKnob.innerHTML = t === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    }
    let savedTheme = 'light';
    try { savedTheme = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(savedTheme);
    document.getElementById(instId + '-theme').addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    });

    const searchEl = document.getElementById(instId + '-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        if (typeof options.onSearch === 'function') options.onSearch(searchEl.value);
      });
    }
    const mobileSearchBtn = document.getElementById(instId + '-mobile-search');
    if (mobileSearchBtn) {
      mobileSearchBtn.addEventListener('click', () => {
        const t = options.mobileSearchTarget ? document.querySelector(options.mobileSearchTarget) : searchEl;
        if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus(); }
      });
    }

    document.getElementById(instId + '-bell').addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof options.onBellClick === 'function') options.onBellClick();
      else _toast(`${notifCount} new notification${notifCount === 1 ? '' : 's'}`);
    });
    document.getElementById(instId + '-profile').addEventListener('click', () => {
      if (typeof options.onProfileClick === 'function') options.onProfileClick();
      else _toast('👤 Account menu');
    });
    document.getElementById(instId + '-support').addEventListener('click', () => {
      if (typeof options.onSupportClick === 'function') options.onSupportClick();
      else _toast('Opening engineering support…');
    });

    return {
      setTitle(title, subtitle) {
        document.getElementById(instId + '-title').textContent = title || '';
        if (subtitle !== undefined) document.getElementById(instId + '-subtitle').textContent = subtitle || '';
      },
      getContentEl() { return contentEl; },
      destroy() {
        container.classList.remove('sa-root');
        container.innerHTML = existingContent;
      },
    };
  }

  window.SuperAdminSidebar = { attach, MENU_ITEMS };
})();