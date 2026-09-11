/**
 * chief-editor-sidebar.js — Droboard Chief Editor Reusable App Shell
 * Updated: added 'All Books' menu item
 */
(function () {
  'use strict';

  if (window.__chiefEditorSidebar) return;
  window.__chiefEditorSidebar = true;

  const DEFAULT_NAV = [
    { key: 'dashboard',           label: 'Dashboard',            href: 'dashboard.html',           icon: 'fa-house' },
    { key: 'senior-editors',      label: 'Senior Editors',       href: 'senior-editors.html',       icon: 'fa-users' },
    { key: 'contracts-payments',  label: 'Contracts & Payments', href: 'contracts-payments.html',   icon: 'fa-file-signature' },
    { key: 'reports-actions',     label: 'Reports & Actions',    href: 'reports-actions.html',      icon: 'fa-scale-balanced' },
    { key: 'all-books',           label: 'All Books',            href: 'all-books.html',            icon: 'fa-book-open' },   // NEW
    { key: 'settings',            label: 'Settings',             href: 'settings.html',             icon: 'fa-gear' },
  ];

  const CSS = `
    :root{
      --accent:#ff0050; --accent-2:#000000; --accent-bg:rgba(255,0,80,.09);
      --sidebar-bg:#14142b; --sidebar-bg-2:#1a1a38; --sidebar-text:#8d86ac;
      --sidebar-border:rgba(255,255,255,.06);
      --bg:#f5f6f9; --card:#ffffff; --border:#eef0f5;
      --radius:14px; --shadow:0 2px 10px rgba(15,23,42,.05);
      --text:#14151b; --text-muted:#5b6472; --text-faint:#98a0ad;
      --input-bg:#f7f8fa; --input-border:#e5e8ee; --hover:#fafbfc; --table-head:#f3f4f7;
      --red:#e0293e; --red-bg:#fdeaec;
      --green:#1c9d5b; --green-bg:#e6f8ef;
      --blue:#2563eb; --blue-bg:#eaf1fe;
      --purple:#7c3aed; --purple-bg:#f2ebfd;
      --amber:#c98a12; --amber-bg:#fdf3e0;
    }
    body{background:var(--bg);}
    .ces-app{display:flex;min-height:100vh;width:100%;color:var(--text);font-family:'Inter',system-ui,sans-serif;}
    .ces-app *, .ces-app *::before, .ces-app *::after{box-sizing:border-box;}
    .ces-overlay{display:none;position:fixed;inset:0;background:rgba(10,10,15,.5);z-index:35;}
    .ces-overlay.show{display:block;}
    .ces-sidebar{width:250px;flex-shrink:0;background:var(--sidebar-bg);
      display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:40;}
    .ces-logo{padding:22px 20px 6px;}
    .ces-logo span{font-size:10.5px;font-weight:800;letter-spacing:.09em;color:#6f6a91;text-transform:uppercase;}
    .ces-nav{flex:1;overflow-y:auto;padding:14px 14px;}
    .ces-nav .ces-item{display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:12px;
      font-size:14px;font-weight:600;color:var(--sidebar-text);text-decoration:none;margin-bottom:6px;}
    .ces-nav .ces-item i{width:18px;text-align:center;font-size:15px;flex-shrink:0;opacity:.9;}
    .ces-nav .ces-item:hover{background:rgba(255,255,255,.05);color:#fff;}
    .ces-nav .ces-item.active{background:var(--accent);color:#fff;
      box-shadow:0 6px 18px -4px rgba(255,0,80,.55);}
    .ces-bottom{margin:10px 14px 18px;padding:16px 15px;border-radius:14px;
      background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border);}
    .ces-bottom i.ces-support-ico{color:var(--accent);font-size:16px;margin-bottom:8px;display:block;}
    .ces-bottom b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px;}
    .ces-bottom p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px;}
    .ces-bottom button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;
      border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
    .ces-content-col{flex:1;min-width:0;display:flex;flex-direction:column;}
    .ces-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 28px;
      background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:30;}
    .ces-topbar-left{display:flex;align-items:center;gap:14px;min-width:0;}
    .ces-hamburger{display:none;background:none;border:none;font-size:18px;color:var(--text);cursor:pointer;padding:4px;}
    .ces-page-title{font-size:16px;font-weight:800;line-height:1.2;color:var(--text);}
    .ces-page-sub{font-size:11.5px;color:var(--text-faint);margin-top:2px;}
    .ces-topbar-right{display:flex;align-items:center;gap:14px;flex-shrink:0;}
    .ces-search{display:flex;align-items:center;gap:8px;background:var(--input-bg);border:1px solid var(--input-border);
      border-radius:10px;padding:8px 12px;width:230px;}
    .ces-search input{border:none;background:none;outline:none;font-size:12.5px;font-family:inherit;color:var(--text);width:100%;}
    .ces-search i{color:var(--text-faint);font-size:12px;}
    .ces-notif-btn{position:relative;width:36px;height:36px;border-radius:10px;border:1px solid var(--border);
      background:var(--card);display:flex;align-items:center;justify-content:center;cursor:pointer;
      color:var(--text-muted);font-size:14px;flex-shrink:0;}
    .ces-notif-btn:hover{border-color:var(--accent);color:var(--accent);}
    .ces-notif-badge{position:absolute;top:-5px;right:-5px;background:var(--red);color:#fff;font-size:9px;
      font-weight:800;padding:1px 5px;border-radius:20px;min-width:16px;text-align:center;line-height:1.4;}
    .ces-main{flex:1;padding:22px 28px 40px;overflow-x:hidden;}
    @media (max-width:900px){
      .ces-sidebar{position:fixed;left:-270px;top:0;height:100vh;transition:left .2s ease;}
      .ces-sidebar.open{left:0;box-shadow:10px 0 30px rgba(0,0,0,.35);}
      .ces-hamburger{display:inline-flex;align-items:center;justify-content:center;}
      .ces-search{display:none;}
      .ces-topbar{padding:14px 16px;}
      .ces-main{padding:16px 16px 32px;}
    }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'ces-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _autoDetectKey(nav) {
    const file = (location.pathname.split('/').pop()) || 'dashboard.html';
    const found = nav.find(item => item.href === file);
    return found ? found.key : (nav[0] ? nav[0].key : null);
  }

  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[ChiefEditorSidebar] Target not found:', target); return null; }

    const instId = 'ces' + (++_instanceCounter);
    const nav = options.navItems || DEFAULT_NAV;
    let activeItem = options.activeItem || _autoDetectKey(nav);
    let notifCount = options.notifCount || 0;
    const title = options.title || '';
    const subtitle = options.subtitle || '';
    const searchPlaceholder = options.searchPlaceholder || 'Search…';

    const pageContent = container.innerHTML;

    function navHtml() {
      return nav.map(item => `
        <a class="ces-item${item.key === activeItem ? ' active' : ''}" href="${_esc(item.href)}" data-ces-key="${_esc(item.key)}">
          <i class="fas ${item.icon || ''}"></i><span>${_esc(item.label)}</span>
        </a>`).join('');
    }

    function notifHtml() {
      return `<i class="fas fa-bell"></i>${notifCount > 0 ? `<span class="ces-notif-badge">${notifCount}</span>` : ''}`;
    }

    function render() {
      container.innerHTML = `
        <div class="ces-app" id="${instId}">
          <div class="ces-overlay" id="${instId}-overlay"></div>
          <aside class="ces-sidebar" id="${instId}-sidebar">
            <div class="ces-logo"><span>Chief Editor</span></div>
            <nav class="ces-nav" id="${instId}-nav">${navHtml()}</nav>
            <div class="ces-bottom">
              <i class="fas fa-headset ces-support-ico"></i>
              <b>Quick Support</b>
              <p>Need help? Contact the engineering team.</p>
              <button id="${instId}-support">Contact Engineer</button>
            </div>
          </aside>
          <div class="ces-content-col">
            <header class="ces-topbar">
              <div class="ces-topbar-left">
                <button class="ces-hamburger" id="${instId}-hamburger" aria-label="Toggle menu"><i class="fas fa-bars"></i></button>
                <div>
                  <div class="ces-page-title">${_esc(title)}</div>
                  ${subtitle ? `<div class="ces-page-sub">${_esc(subtitle)}</div>` : ''}
                </div>
              </div>
              <div class="ces-topbar-right">
                <div class="ces-search"><i class="fas fa-search"></i><input type="text" placeholder="${_esc(searchPlaceholder)}" id="${instId}-search"/></div>
                <button class="ces-notif-btn" id="${instId}-notif">${notifHtml()}</button>
              </div>
            </header>
            <main class="ces-main" id="${instId}-main">${pageContent}</main>
          </div>
        </div>`;
      bindEvents();
    }

    function bindEvents() {
      const supportBtn = document.getElementById(instId + '-support');
      if (supportBtn) {
        supportBtn.addEventListener('click', () => {
          if (typeof options.onSupportClick === 'function') options.onSupportClick();
          else if (typeof window.toast === 'function') window.toast('Opening support chat…');
        });
      }
      const hamburger = document.getElementById(instId + '-hamburger');
      const sidebar = document.getElementById(instId + '-sidebar');
      const overlay = document.getElementById(instId + '-overlay');
      function closeMobile() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
      function openMobile() { sidebar.classList.add('open'); overlay.classList.add('show'); }
      hamburger && hamburger.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeMobile() : openMobile();
      });
      overlay && overlay.addEventListener('click', closeMobile);
    }

    render();

    return {
      setActive(key) {
        activeItem = key;
        const navEl = document.getElementById(instId + '-nav');
        navEl && navEl.querySelectorAll('.ces-item').forEach(a => a.classList.toggle('active', a.dataset.cesKey === key));
      },
      setNotifCount(n) {
        notifCount = n;
        const btn = document.getElementById(instId + '-notif');
        if (btn) btn.innerHTML = notifHtml();
      },
      getActive() { return activeItem; },
      destroy() { container.innerHTML = pageContent; },
    };
  }

  window.ChiefEditorSidebar = { attach, DEFAULT_NAV };
})();