/**
 * senior-editor-sidebar.js — Senior Editor Sidebar Menu Component
 * ──────────────────────────────────────────────────────────────
 * Single sidebar + topbar shell for all Senior Editor pages.
 * Import this ONE file on every page and call:
 *   SeniorEditorSidebar.attach('#root', { ... })
 *
 * Menu Sections:
 *   🏠 Dashboard       📥 Review Queue     📚 Story Management
 *   👨‍💼 Authors        ⭐ Featured Stories  🎖️ Editor's Picks
 *   📣 Announcements   📊 Story Analytics   ⚠️ Reports & Compliance
 *   💬 Communication
 *
 * USAGE
 *   <script src="shared/senior-editor-sidebar.js"></script>
 *   <div id="root"></div>
 *   <script>
 *     SeniorEditorSidebar.attach('#root', {
 *       activeItem: 'dashboard',
 *       title: 'Dashboard',
 *       subtitle: 'Your editorial overview',
 *       user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: '...' },
 *       notifCount: 4,
 *     });
 *   </script>
 */
(function () {
  'use strict';

  if (window.__seniorEditorSidebar) return;
  window.__seniorEditorSidebar = true;

  const THEME_KEY = 'droboardTheme';

  const MENU_ITEMS = [
    { key: 'dashboard',           label: 'Dashboard',           icon: 'fa-house',             href: 'dashboard.html' },
    { key: 'review-queue',        label: 'Review Queue',        icon: 'fa-inbox',             href: 'review-queue.html' },
    { key: 'story-management',    label: 'Story Management',     icon: 'fa-book',              href: 'story-management.html' },
    { key: 'authors',             label: 'Authors',              icon: 'fa-user-tie',          href: 'authors.html' },
    { key: 'featured-stories',    label: 'Featured Stories',     icon: 'fa-star',              href: 'featured-stories.html' },
    { key: 'editors-picks',       label: "Editor's Picks",       icon: 'fa-award',             href: 'editors-picks.html' },
    { key: 'announcements',       label: 'Announcements',        icon: 'fa-bullhorn',          href: 'announcements.html' },
    { key: 'story-analytics',     label: 'Story Analytics',      icon: 'fa-chart-line',        href: 'story-analytics.html' },
    { key: 'reports-compliance',  label: 'Reports & Compliance', icon: 'fa-triangle-exclamation', href: 'reports-compliance.html' },
    { key: 'communication',       label: 'Communication',        icon: 'fa-comments',          href: 'communication.html' },
  ];

  const CSS = `
  :root{
    --sidebar-bg:#14142b; --sidebar-bg-2:#1a1a38; --sidebar-text:#8d86ac;
    --sidebar-text-active:#ffffff; --sidebar-border:rgba(255,255,255,.06);
    --accent:#ff0050; --accent-2:#000000; --accent-soft:rgba(255,0,80,.14);
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
  .ses-root, .ses-root *{box-sizing:border-box}
  .ses-root{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text)}
  .ses-root a{text-decoration:none;color:inherit}
  .ses-root button{font-family:inherit;cursor:pointer}
  .ses-shell{display:flex;min-height:100vh}
  .ses-sidebar{width:270px;flex-shrink:0;background:var(--sidebar-bg);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;border-right:1px solid var(--sidebar-border);z-index:300}
  .ses-sb-logo{display:flex;align-items:center;gap:11px;padding:20px 18px 14px}
  .ses-sb-logo-ico{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}
  .ses-sb-logo-txt{line-height:1.25}
  .ses-sb-logo-txt b{display:block;font-size:12.5px;font-weight:800;color:#fff;letter-spacing:.04em}
  .ses-sb-close{display:none}
  .ses-role-badge{display:flex;align-items:center;gap:8px;margin:0 12px 14px;padding:9px 12px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border);border-radius:12px}
  .ses-role-badge i{color:var(--accent);font-size:13px;width:22px;text-align:center}
  .ses-role-badge span{font-size:11px;font-weight:700;color:#cfc9e8;letter-spacing:.03em}
  .ses-sb-nav{flex:1;overflow-y:auto;padding:4px 12px 12px}
  .ses-sb-section-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;color:#5f5885;text-transform:uppercase;padding:16px 10px 6px}
  .ses-sidebar .ses-sb-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--sidebar-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:.15s;cursor:pointer;position:relative}
  .ses-sidebar .ses-sb-item i.ses-item-ico{width:16px;text-align:center;font-size:14px;flex-shrink:0}
  .ses-sidebar .ses-sb-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .ses-sidebar .ses-sb-item.active{background:var(--accent);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(255,0,80,.35)}
  .ses-sb-footer{margin:10px 12px 16px;padding:16px 14px;border-radius:14px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border)}
  .ses-sb-footer i{color:var(--accent);font-size:16px;margin-bottom:8px;display:block}
  .ses-sb-footer b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px}
  .ses-sb-footer p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px}
  .ses-sb-footer button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:9px;font-size:12px;font-weight:700}
  .ses-sb-overlay{display:none;position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:290}
  .ses-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .ses-topbar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:18px;padding:14px 26px}
  .ses-hamburger{display:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .ses-tb-title h1{font-size:18px;font-weight:800;margin:0}
  .ses-tb-title p{font-size:12px;color:var(--text-muted);margin-top:1px}
  .ses-tb-spacer{flex:1}
  .ses-tb-search{display:flex;align-items:center;gap:9px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:11px;padding:9px 14px;width:280px;flex-shrink:0}
  .ses-tb-search input{border:none;background:none;outline:none;color:var(--text);font-size:13px;flex:1;font-family:inherit}
  .ses-tb-search input::placeholder{color:var(--text-faint)}
  .ses-tb-search i{color:var(--text-faint);font-size:13px}
  .ses-tb-icon-btn{position:relative;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:15px;flex-shrink:0;transition:.15s}
  .ses-tb-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
  .ses-tb-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--red);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}
  .ses-theme-toggle{width:52px;height:30px;border-radius:20px;background:var(--input-bg);border:1px solid var(--input-border);position:relative;flex-shrink:0;cursor:pointer}
  .ses-theme-toggle .ses-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;transition:transform .25s cubic-bezier(.4,0,.2,1)}
  html[data-theme="dark"] .ses-theme-toggle .ses-knob{transform:translateX(22px)}
  .ses-tb-profile{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:30px;border:1px solid var(--input-border);flex-shrink:0;cursor:pointer}
  .ses-tb-profile img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .ses-tb-profile-txt{line-height:1.2}
  .ses-tb-profile-txt b{font-size:12.5px;display:block}
  .ses-tb-profile-txt span{font-size:10.5px;color:var(--text-muted)}
  .ses-tb-profile i{color:var(--text-faint);font-size:11px;margin-left:2px}
  .ses-mobile-search-btn{display:none;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-shrink:0}
  .ses-content{padding:22px 26px 60px}
  .ses-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#1a1730;color:#fff;padding:10px 18px;border-radius:24px;font-size:12.5px;font-weight:600;z-index:2000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .ses-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @media (max-width:1024px){
    .ses-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 40px rgba(0,0,0,.4)}
    .ses-sidebar.open{transform:translateX(0)}
    .ses-sb-overlay.show{display:block}
    .ses-hamburger{display:flex}
    .ses-sb-close{display:flex;margin-left:auto;width:30px;height:30px;border-radius:8px;background:var(--sidebar-bg-2);color:#cfc9e8;align-items:center;justify-content:center;border:none;font-size:13px}
    .ses-tb-search{display:none}
    .ses-mobile-search-btn{display:flex}
    .ses-tb-title p{display:none}
  }
  @media (max-width:860px){
    .ses-content{padding:16px}
    .ses-topbar{padding:12px 16px}
    .ses-tb-profile-txt{display:none}
    .ses-tb-profile i{display:none}
  }
  .ses-root button:focus-visible, .ses-root input:focus-visible, .ses-root a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  `;

  function _esc(s) { return (s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('ses-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ses-toast';
      el.className = 'ses-toast';
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
    el.id = 'ses-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[SeniorEditorSidebar] Target not found:', target); return null; }

    const instId = 'ses' + (++_instanceCounter);
    const activeItem = options.activeItem || 'dashboard';
    const user = Object.assign({ name: 'User', role: 'Senior Editor', avatar: null }, options.user || {});
    const notifCount = options.notifCount != null ? options.notifCount : 0;
    const existingContent = container.innerHTML;

    function navHtml() {
      return `<div class="ses-sb-section-lbl">Senior Editor</div>
        ${MENU_ITEMS.map(item => {
          const isActive = item.key === activeItem;
          return `<a class="ses-sb-item${isActive ? ' active' : ''}"
                      href="${_esc(item.href)}"
                      data-item-key="${_esc(item.key)}">
              <i class="fas ${item.icon} ses-item-ico"></i>${_esc(item.label)}
            </a>`;
        }).join('')}`;
    }

    container.classList.add('ses-root');
    container.innerHTML = `
      <div class="ses-shell">
        <div class="ses-sb-overlay" id="${instId}-overlay"></div>
        <aside class="ses-sidebar" id="${instId}-sidebar">
          <div class="ses-sb-logo">
            <div class="ses-sb-logo-ico"><i class="fas fa-book-open"></i></div>
            <div class="ses-sb-logo-txt"><b>DROBOARD</b><b>SENIOR EDITOR</b></div>
            <button class="ses-sb-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="ses-role-badge">
            <i class="fas fa-pen-nib"></i>
            <span>Senior Editor · Content Review</span>
          </div>
          <nav class="ses-sb-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="ses-sb-footer">
            <i class="fas fa-headset"></i>
            <b>Quick Help</b>
            <p>Escalate to Chief Editor or contact support.</p>
            <button id="${instId}-support">Contact Support</button>
          </div>
        </aside>
        <div class="ses-main">
          <div class="ses-topbar">
            <button class="ses-hamburger" id="${instId}-hamburger"><i class="fas fa-bars"></i></button>
            <div class="ses-tb-title">
              <h1 id="${instId}-title">${_esc(options.title || '')}</h1>
              <p id="${instId}-subtitle">${_esc(options.subtitle || '')}</p>
            </div>
            <div class="ses-tb-spacer"></div>
            ${options.hideSearch ? '' : `
            <div class="ses-tb-search">
              <i class="fas fa-magnifying-glass"></i>
              <input id="${instId}-search" placeholder="${_esc(options.searchPlaceholder || 'Search...')}"/>
            </div>
            <button class="ses-mobile-search-btn" id="${instId}-mobile-search"><i class="fas fa-magnifying-glass"></i></button>`}
            <button class="ses-theme-toggle" id="${instId}-theme" title="Toggle dark / light mode">
              <div class="ses-knob" id="${instId}-theme-icon"><i class="fas fa-sun"></i></div>
            </button>
            <a class="ses-tb-icon-btn" id="${instId}-bell" href="#" style="display:flex;align-items:center;justify-content:center;text-decoration:none">
              <i class="fas fa-bell"></i>
              ${notifCount > 0 ? `<span class="ses-tb-badge">${notifCount}</span>` : ''}
            </a>
            <div class="ses-tb-profile" id="${instId}-profile">
              ${user.avatar ? `<img src="${_esc(user.avatar)}" alt="${_esc(user.name)}"/>` : ''}
              <div class="ses-tb-profile-txt"><b>${_esc(user.name)}</b><span>${_esc(user.role)}</span></div>
              <i class="fas fa-chevron-down"></i>
            </div>
          </div>
          <div class="ses-content" id="${instId}-content"></div>
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
    document.getElementById(instId + '-nav').querySelectorAll('.ses-sb-item').forEach(item => {
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
      else _toast('Opening support chat…');
    });

    return {
      setTitle(title, subtitle) {
        document.getElementById(instId + '-title').textContent = title || '';
        if (subtitle !== undefined) document.getElementById(instId + '-subtitle').textContent = subtitle || '';
      },
      getContentEl() { return contentEl; },
      destroy() {
        container.classList.remove('ses-root');
        container.innerHTML = existingContent;
      },
    };
  }

  window.SeniorEditorSidebar = { attach, MENU_ITEMS };
})();