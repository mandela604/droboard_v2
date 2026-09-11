/**
 * finance-sidebar.js — Finance Sidebar Menu Component
 * ──────────────────────────────────────────────────────────────
 * Single sidebar + topbar shell for all Finance pages.
 * Import this ONE file on every page and call:
 *   FinanceSidebar.attach('#root', { ... })
 *
 * Menu Sections:
 *   🏠 Dashboard          💵 Author Payments      🏦 Withdrawals
 *   🪙 Coin Transactions   🎁 Bonuses              ⚖️ Payment Disputes
 *   📊 Financial Reports   🧾 Tax & Accounting
 *
 * USAGE
 *   <script src="shared/finance-sidebar.js"></script>
 *   <div id="root"></div>
 *   <script>
 *     FinanceSidebar.attach('#root', {
 *       activeItem: 'dashboard',
 *       title: 'Dashboard',
 *       subtitle: 'Financial overview',
 *       user: { name: 'Ngozi Falade', role: 'Finance Lead', avatar: '...' },
 *       notifCount: 3,
 *     });
 *   </script>
 */
(function () {
  'use strict';

  if (window.__financeSidebar) return;
  window.__financeSidebar = true;

  const THEME_KEY = 'droboardTheme';

  const MENU_ITEMS = [
    { key: 'dashboard',           label: 'Dashboard',           icon: 'fa-house',            href: 'dashboard.html' },
    { key: 'author-payments',     label: 'Author Payments',     icon: 'fa-money-check-dollar', href: 'author-payments.html' },
    { key: 'withdrawals',         label: 'Withdrawals',         icon: 'fa-building-columns',  href: 'withdrawals.html' },
    { key: 'coin-transactions',   label: 'Coin Transactions',   icon: 'fa-coins',             href: 'coin-transactions.html' },
    { key: 'bonuses',             label: 'Bonuses',             icon: 'fa-gift',              href: 'bonuses.html' },
    { key: 'payment-disputes',    label: 'Payment Disputes',    icon: 'fa-scale-balanced',    href: 'payment-disputes.html' },
    { key: 'financial-reports',   label: 'Financial Reports',   icon: 'fa-chart-pie',         href: 'financial-reports.html' },
    { key: 'tax-accounting',      label: 'Tax & Accounting',    icon: 'fa-file-invoice-dollar', href: 'tax-accounting.html' },
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
  .fin-root, .fin-root *{box-sizing:border-box}
  .fin-root{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text)}
  .fin-root a{text-decoration:none;color:inherit}
  .fin-root button{font-family:inherit;cursor:pointer}
  .fin-shell{display:flex;min-height:100vh}
  .fin-sidebar{width:270px;flex-shrink:0;background:var(--sidebar-bg);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;border-right:1px solid var(--sidebar-border);z-index:300}
  .fin-sb-logo{display:flex;align-items:center;gap:11px;padding:20px 18px 14px}
  .fin-sb-logo-ico{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}
  .fin-sb-logo-txt{line-height:1.25}
  .fin-sb-logo-txt b{display:block;font-size:12.5px;font-weight:800;color:#fff;letter-spacing:.04em}
  .fin-sb-close{display:none}
  .fin-role-badge{display:flex;align-items:center;gap:8px;margin:0 12px 14px;padding:9px 12px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border);border-radius:12px}
  .fin-role-badge i{color:var(--accent);font-size:13px;width:22px;text-align:center}
  .fin-role-badge span{font-size:11px;font-weight:700;color:#cfc9e8;letter-spacing:.03em}
  .fin-sb-nav{flex:1;overflow-y:auto;padding:4px 12px 12px}
  .fin-sb-section-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;color:#5f5885;text-transform:uppercase;padding:16px 10px 6px}
  .fin-sidebar .fin-sb-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--sidebar-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:.15s;cursor:pointer;position:relative}
  .fin-sidebar .fin-sb-item i.fin-item-ico{width:16px;text-align:center;font-size:14px;flex-shrink:0}
  .fin-sidebar .fin-sb-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .fin-sidebar .fin-sb-item.active{background:var(--accent);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(255,0,80,.35)}
  .fin-sb-footer{margin:10px 12px 16px;padding:16px 14px;border-radius:14px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border)}
  .fin-sb-footer i{color:var(--accent);font-size:16px;margin-bottom:8px;display:block}
  .fin-sb-footer b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px}
  .fin-sb-footer p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px}
  .fin-sb-footer button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:9px;font-size:12px;font-weight:700}
  .fin-sb-overlay{display:none;position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:290}
  .fin-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .fin-topbar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:18px;padding:14px 26px}
  .fin-hamburger{display:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .fin-tb-title h1{font-size:18px;font-weight:800;margin:0}
  .fin-tb-title p{font-size:12px;color:var(--text-muted);margin-top:1px}
  .fin-tb-spacer{flex:1}
  .fin-tb-search{display:flex;align-items:center;gap:9px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:11px;padding:9px 14px;width:280px;flex-shrink:0}
  .fin-tb-search input{border:none;background:none;outline:none;color:var(--text);font-size:13px;flex:1;font-family:inherit}
  .fin-tb-search input::placeholder{color:var(--text-faint)}
  .fin-tb-search i{color:var(--text-faint);font-size:13px}
  .fin-tb-icon-btn{position:relative;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:15px;flex-shrink:0;transition:.15s}
  .fin-tb-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
  .fin-tb-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--red);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}
  .fin-theme-toggle{width:52px;height:30px;border-radius:20px;background:var(--input-bg);border:1px solid var(--input-border);position:relative;flex-shrink:0;cursor:pointer}
  .fin-theme-toggle .fin-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;transition:transform .25s cubic-bezier(.4,0,.2,1)}
  html[data-theme="dark"] .fin-theme-toggle .fin-knob{transform:translateX(22px)}
  .fin-tb-profile{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:30px;border:1px solid var(--input-border);flex-shrink:0;cursor:pointer}
  .fin-tb-profile img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .fin-tb-profile-txt{line-height:1.2}
  .fin-tb-profile-txt b{font-size:12.5px;display:block}
  .fin-tb-profile-txt span{font-size:10.5px;color:var(--text-muted)}
  .fin-tb-profile i{color:var(--text-faint);font-size:11px;margin-left:2px}
  .fin-mobile-search-btn{display:none;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-shrink:0}
  .fin-content{padding:22px 26px 60px}
  .fin-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#1a1730;color:#fff;padding:10px 18px;border-radius:24px;font-size:12.5px;font-weight:600;z-index:2000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .fin-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  @media (max-width:1024px){
    .fin-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 40px rgba(0,0,0,.4)}
    .fin-sidebar.open{transform:translateX(0)}
    .fin-sb-overlay.show{display:block}
    .fin-hamburger{display:flex}
    .fin-sb-close{display:flex;margin-left:auto;width:30px;height:30px;border-radius:8px;background:var(--sidebar-bg-2);color:#cfc9e8;align-items:center;justify-content:center;border:none;font-size:13px}
    .fin-tb-search{display:none}
    .fin-mobile-search-btn{display:flex}
    .fin-tb-title p{display:none}
  }
  @media (max-width:860px){
    .fin-content{padding:16px}
    .fin-topbar{padding:12px 16px}
    .fin-tb-profile-txt{display:none}
    .fin-tb-profile i{display:none}
  }
  .fin-root button:focus-visible, .fin-root input:focus-visible, .fin-root a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  `;

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('fin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fin-toast';
      el.className = 'fin-toast';
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
    el.id = 'fin-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[FinanceSidebar] Target not found:', target); return null; }

    const instId = 'fin' + (++_instanceCounter);
    const activeItem = options.activeItem || 'dashboard';
    const user = Object.assign({ name: 'User', role: 'Finance Lead', avatar: null }, options.user || {});
    const notifCount = options.notifCount != null ? options.notifCount : 0;
    const existingContent = container.innerHTML;

    function navHtml() {
      return `<div class="fin-sb-section-lbl">Finance</div>
        ${MENU_ITEMS.map(item => {
          const isActive = item.key === activeItem;
          return `<a class="fin-sb-item${isActive ? ' active' : ''}"
                      href="${_esc(item.href)}"
                      data-item-key="${_esc(item.key)}">
              <i class="fas ${item.icon} fin-item-ico"></i>${_esc(item.label)}
            </a>`;
        }).join('')}`;
    }

    container.classList.add('fin-root');
    container.innerHTML = `
      <div class="fin-shell">
        <div class="fin-sb-overlay" id="${instId}-overlay"></div>
        <aside class="fin-sidebar" id="${instId}-sidebar">
          <div class="fin-sb-logo">
            <div class="fin-sb-logo-ico"><i class="fas fa-sack-dollar"></i></div>
            <div class="fin-sb-logo-txt"><b>DROBOARD</b><b>FINANCE</b></div>
            <button class="fin-sb-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="fin-role-badge">
            <i class="fas fa-coins"></i>
            <span>Finance · Payments & Revenue</span>
          </div>
          <nav class="fin-sb-nav" id="${instId}-nav">${navHtml()}</nav>
          <div class="fin-sb-footer">
            <i class="fas fa-headset"></i>
            <b>Quick Help</b>
            <p>Escalate a payout or tax issue to engineering support.</p>
            <button id="${instId}-support">Contact Support</button>
          </div>
        </aside>
        <div class="fin-main">
          <div class="fin-topbar">
            <button class="fin-hamburger" id="${instId}-hamburger"><i class="fas fa-bars"></i></button>
            <div class="fin-tb-title">
              <h1 id="${instId}-title">${_esc(options.title || '')}</h1>
              <p id="${instId}-subtitle">${_esc(options.subtitle || '')}</p>
            </div>
            <div class="fin-tb-spacer"></div>
            ${options.hideSearch ? '' : `
            <div class="fin-tb-search">
              <i class="fas fa-magnifying-glass"></i>
              <input id="${instId}-search" placeholder="${_esc(options.searchPlaceholder || 'Search...')}"/>
            </div>
            <button class="fin-mobile-search-btn" id="${instId}-mobile-search"><i class="fas fa-magnifying-glass"></i></button>`}
            <button class="fin-theme-toggle" id="${instId}-theme" title="Toggle dark / light mode">
              <div class="fin-knob" id="${instId}-theme-icon"><i class="fas fa-sun"></i></div>
            </button>
            <a class="fin-tb-icon-btn" id="${instId}-bell" href="#" style="display:flex;align-items:center;justify-content:center;text-decoration:none">
              <i class="fas fa-bell"></i>
              ${notifCount > 0 ? `<span class="fin-tb-badge">${notifCount}</span>` : ''}
            </a>
            <div class="fin-tb-profile" id="${instId}-profile">
              ${user.avatar ? `<img src="${_esc(user.avatar)}" alt="${_esc(user.name)}"/>` : ''}
              <div class="fin-tb-profile-txt"><b>${_esc(user.name)}</b><span>${_esc(user.role)}</span></div>
              <i class="fas fa-chevron-down"></i>
            </div>
          </div>
          <div class="fin-content" id="${instId}-content"></div>
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
    document.getElementById(instId + '-nav').querySelectorAll('.fin-sb-item').forEach(item => {
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
        container.classList.remove('fin-root');
        container.innerHTML = existingContent;
      },
    };
  }

  window.FinanceSidebar = { attach, MENU_ITEMS };
})();