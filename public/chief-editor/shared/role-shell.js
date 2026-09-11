/**
 * role-shell.js — Droboard Reusable, Role-Switchable Admin Shell
 * ─────────────────────────────────────────────────────────────
 * Same visual system as the original dashboard-shell.js (accent #ff0050,
 * Inter font, card design, light/dark theme) but the sidebar nav is driven
 * by a ROLE definition instead of one hard-coded menu. Each role has its
 * own list of sections. Pages that haven't been built yet are marked
 * `implemented: false` — clicking them shows a "coming soon" toast instead
 * of a broken link.
 *
 * A role switcher lives at the top of the sidebar. Clicking a different
 * role PREVIEWS that role's navigation menu instantly (no page load) so
 * the full information architecture can be reviewed today, even though
 * only the Chief Editor dashboard exists so far. If you're previewing a
 * role that isn't your actual logged-in role, a small banner appears
 * above the page content reminding you, with a one-click way back.
 *
 * USAGE
 *   <script src="shared/role-shell.js"></script>
 *   DroboardRoleShell.attach('#dashboardRoot', {
 *     role: 'chief-editor',
 *     activeItem: 'dashboard',
 *     title: 'Chief Editor Dashboard',
 *     subtitle: 'Platform-wide editorial oversight',
 *     user: { name: 'Reina Morgan', role: 'Chief Editor', avatar: '...' },
 *     notifCount: 5,
 *   });
 */

(function () {
  'use strict';

  if (window.__droboardRoleShell) return;
  window.__droboardRoleShell = true;

  const THEME_KEY = 'droboardTheme';

  /* ═══════════════════════════════════════════════════════════
     ROLE DEFINITIONS
     Each role: { key, label, icon, nav: [{ section, items: [...] }] }
     Each item: { key, label, icon, href, implemented }
     ═══════════════════════════════════════════════════════════ */
  const ROLES = [
    {
      key: 'chief-editor', label: 'Chief Editor', icon: 'fa-crown',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'chief-editor-dashboard.html', implemented: true },
        { key: 'editorial-team', label: 'Editorial Team', icon: 'fa-users-gear', href: 'editorial-team.html', implemented: false },
        { key: 'editorial-strategy', label: 'Editorial Strategy', icon: 'fa-compass', href: 'editorial-strategy.html', implemented: false },
        { key: 'platform-content', label: 'Platform Content', icon: 'fa-book-open', href: 'platform-content.html', implemented: false },
        { key: 'editorial-policies', label: 'Editorial Policies', icon: 'fa-scroll', href: 'editorial-policies.html', implemented: false },
        { key: 'author-contracts', label: 'Author Contracts', icon: 'fa-handshake', href: 'author-contracts.html', implemented: false },
        { key: 'editorial-analytics', label: 'Editorial Analytics', icon: 'fa-chart-line', href: 'editorial-analytics.html', implemented: false },
        { key: 'disputes-appeals', label: 'Disputes & Appeals', icon: 'fa-scale-balanced', href: 'disputes-appeals.html', implemented: false },
        { key: 'partnerships', label: 'Partnerships', icon: 'fa-globe', href: 'partnerships.html', implemented: false },
        { key: 'settings', label: 'Settings', icon: 'fa-gear', href: 'chief-editor-settings.html', implemented: false },
      ] }],
    },
    {
      key: 'senior-editor', label: 'Senior Editor', icon: 'fa-pen-nib',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'senior-editor-dashboard.html', implemented: false },
        { key: 'review-queue', label: 'Review Queue', icon: 'fa-inbox', href: 'review-queue.html', implemented: false },
        { key: 'story-management', label: 'Story Management', icon: 'fa-book', href: 'story-management.html', implemented: false },
        { key: 'authors', label: 'Authors', icon: 'fa-user-tie', href: 'se-authors.html', implemented: false },
        { key: 'featured-stories', label: 'Featured Stories', icon: 'fa-star', href: 'featured-stories.html', implemented: false },
        { key: 'editors-picks', label: "Editor's Picks", icon: 'fa-award', href: 'editors-picks.html', implemented: false },
        { key: 'announcements', label: 'Announcements', icon: 'fa-bullhorn', href: 'se-announcements.html', implemented: false },
        { key: 'story-analytics', label: 'Story Analytics', icon: 'fa-chart-line', href: 'story-analytics.html', implemented: false },
        { key: 'reports-compliance', label: 'Reports & Compliance', icon: 'fa-triangle-exclamation', href: 'reports-compliance.html', implemented: false },
        { key: 'communication', label: 'Communication', icon: 'fa-comments', href: 'communication.html', implemented: false },
      ] }],
    },
    {
      key: 'finance', label: 'Finance', icon: 'fa-sack-dollar',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'finance-dashboard.html', implemented: false },
        { key: 'author-payments', label: 'Author Payments', icon: 'fa-money-bill-wave', href: 'author-payments.html', implemented: false },
        { key: 'withdrawals', label: 'Withdrawals', icon: 'fa-money-bill-transfer', href: 'finance-withdrawals.html', implemented: false },
        { key: 'coin-transactions', label: 'Coin Transactions', icon: 'fa-coins', href: 'coin-transactions.html', implemented: false },
        { key: 'bonuses', label: 'Bonuses', icon: 'fa-gift', href: 'bonuses.html', implemented: false },
        { key: 'payment-disputes', label: 'Payment Disputes', icon: 'fa-file-invoice-dollar', href: 'payment-disputes.html', implemented: false },
        { key: 'financial-reports', label: 'Financial Reports', icon: 'fa-chart-pie', href: 'financial-reports.html', implemented: false },
        { key: 'tax-accounting', label: 'Tax & Accounting', icon: 'fa-receipt', href: 'tax-accounting.html', implemented: false },
        { key: 'settings', label: 'Settings', icon: 'fa-gear', href: 'finance-settings.html', implemented: false },
      ] }],
    },
    {
      key: 'marketing', label: 'Marketing & Growth', icon: 'fa-rocket',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'marketing-dashboard.html', implemented: false },
        { key: 'promotions', label: 'Promotions', icon: 'fa-bullhorn', href: 'mkt-promotions.html', implemented: false },
        { key: 'campaigns', label: 'Campaigns', icon: 'fa-bullseye', href: 'campaigns.html', implemented: false },
        { key: 'sponsored-placements', label: 'Sponsored Placements', icon: 'fa-star', href: 'sponsored-placements.html', implemented: false },
        { key: 'events-contests', label: 'Events & Contests', icon: 'fa-gift', href: 'events-contests.html', implemented: false },
        { key: 'homepage-banners', label: 'Homepage Banners', icon: 'fa-images', href: 'homepage-banners.html', implemented: false },
        { key: 'email-campaigns', label: 'Email Campaigns', icon: 'fa-envelope', href: 'email-campaigns.html', implemented: false },
        { key: 'marketing-analytics', label: 'Marketing Analytics', icon: 'fa-chart-line', href: 'marketing-analytics.html', implemented: false },
      ] }],
    },
    {
      key: 'moderator', label: 'Moderator', icon: 'fa-shield-halved',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'moderator-dashboard.html', implemented: false },
        { key: 'user-reports', label: 'User Reports', icon: 'fa-flag', href: 'user-reports.html', implemented: false },
        { key: 'comments', label: 'Comments', icon: 'fa-comments', href: 'mod-comments.html', implemented: false },
        { key: 'posts', label: 'Posts', icon: 'fa-note-sticky', href: 'mod-posts.html', implemented: false },
        { key: 'status', label: 'Status', icon: 'fa-camera', href: 'mod-status.html', implemented: false },
        { key: 'suspensions', label: 'Suspensions', icon: 'fa-ban', href: 'suspensions.html', implemented: false },
        { key: 'policy-violations', label: 'Policy Violations', icon: 'fa-triangle-exclamation', href: 'policy-violations.html', implemented: false },
        { key: 'moderation-logs', label: 'Moderation Logs', icon: 'fa-list-check', href: 'moderation-logs.html', implemented: false },
      ] }],
    },
    {
      key: 'support', label: 'Customer Support', icon: 'fa-headset',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'support-dashboard.html', implemented: false },
        { key: 'support-tickets', label: 'Support Tickets', icon: 'fa-ticket', href: 'support-tickets.html', implemented: false },
        { key: 'users', label: 'Users', icon: 'fa-user', href: 'support-users.html', implemented: false },
        { key: 'authors', label: 'Authors', icon: 'fa-user-tie', href: 'support-authors.html', implemented: false },
        { key: 'billing-issues', label: 'Billing Issues', icon: 'fa-credit-card', href: 'billing-issues.html', implemented: false },
        { key: 'bug-reports', label: 'Bug Reports', icon: 'fa-bug', href: 'bug-reports.html', implemented: false },
        { key: 'announcements', label: 'Announcements', icon: 'fa-bullhorn', href: 'support-announcements.html', implemented: false },
        { key: 'ticket-analytics', label: 'Ticket Analytics', icon: 'fa-chart-line', href: 'ticket-analytics.html', implemented: false },
      ] }],
    },
    {
      key: 'super-admin', label: 'Super Admin', icon: 'fa-user-shield',
      nav: [{ section: null, items: [
        { key: 'dashboard', label: 'Dashboard', icon: 'fa-house', href: 'super-admin-dashboard.html', implemented: false },
        { key: 'user-management', label: 'User Management', icon: 'fa-users', href: 'user-management.html', implemented: false },
        { key: 'roles-permissions', label: 'Roles & Permissions', icon: 'fa-user-shield', href: 'roles-permissions.html', implemented: false },
        { key: 'platform-settings', label: 'Platform Settings', icon: 'fa-gear', href: 'sa-platform-settings.html', implemented: false },
        { key: 'finance-overview', label: 'Finance Overview', icon: 'fa-sack-dollar', href: 'finance-overview.html', implemented: false },
        { key: 'global-analytics', label: 'Global Analytics', icon: 'fa-chart-line', href: 'global-analytics.html', implemented: false },
        { key: 'security', label: 'Security', icon: 'fa-shield-halved', href: 'security.html', implemented: false },
        { key: 'system-logs', label: 'System Logs', icon: 'fa-file-lines', href: 'system-logs.html', implemented: false },
        { key: 'integrations', label: 'Integrations', icon: 'fa-plug', href: 'sa-integrations.html', implemented: false },
        { key: 'feature-flags', label: 'Feature Flags', icon: 'fa-flag', href: 'feature-flags.html', implemented: false },
      ] }],
    },
  ];

  function findRole(key) { return ROLES.find(r => r.key === key) || ROLES[0]; }

  /* ═══════════════════════════════════════════════════════════
     CSS — same design tokens as dashboard-shell.js (accent #ff0050,
     light/dark theme), prefixed rsh- so it never collides with the
     original dashboard-shell.js if both ever load on the same page.
     ═══════════════════════════════════════════════════════════ */
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
  .rsh-root, .rsh-root *{box-sizing:border-box}
  .rsh-root{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text)}
  .rsh-root a{text-decoration:none;color:inherit}
  .rsh-root button{font-family:inherit;cursor:pointer}
  .rsh-shell{display:flex;min-height:100vh}
  .rsh-sidebar{width:270px;flex-shrink:0;background:var(--sidebar-bg);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;border-right:1px solid var(--sidebar-border);z-index:300}
  .rsh-sb-logo{display:flex;align-items:center;gap:11px;padding:20px 18px 14px}
  .rsh-sb-logo-ico{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}
  .rsh-sb-logo-txt{line-height:1.25}
  .rsh-sb-logo-txt b{display:block;font-size:12.5px;font-weight:800;color:#fff;letter-spacing:.04em}
  .rsh-sb-close{display:none}

  /* Role switcher */
  .rsh-role-wrap{position:relative;margin:0 12px 12px}
  .rsh-role-btn{width:100%;display:flex;align-items:center;gap:10px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border);border-radius:12px;padding:10px 12px;cursor:pointer}
  .rsh-role-ico{width:30px;height:30px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
  .rsh-role-info{flex:1;min-width:0;text-align:left}
  .rsh-role-info b{display:block;font-size:12px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rsh-role-info span{font-size:9.5px;color:#8d86ac;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
  .rsh-role-btn i.fa-chevron-down{color:#8d86ac;font-size:11px;transition:transform .15s}
  .rsh-role-btn.open i.fa-chevron-down{transform:rotate(180deg)}
  .rsh-role-menu{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border);border-radius:12px;padding:6px;z-index:50;box-shadow:0 12px 32px rgba(0,0,0,.45);max-height:340px;overflow-y:auto}
  .rsh-role-menu.open{display:block}
  .rsh-role-opt{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer;color:#c9c4e0;font-size:12.5px;font-weight:600}
  .rsh-role-opt:hover{background:rgba(255,255,255,.06);color:#fff}
  .rsh-role-opt.active{background:var(--accent-soft);color:var(--accent)}
  .rsh-role-opt .rsh-role-ico{width:26px;height:26px;font-size:11px;background:rgba(255,255,255,.06);color:inherit}
  .rsh-role-opt.active .rsh-role-ico{background:var(--accent-soft);color:var(--accent)}

  .rsh-sb-nav{flex:1;overflow-y:auto;padding:4px 12px 12px}
  .rsh-sb-section-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;color:#5f5885;text-transform:uppercase;padding:16px 10px 6px}
  .rsh-sidebar .rsh-sb-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;color:var(--sidebar-text);font-size:13px;font-weight:500;margin-bottom:2px;transition:.15s;cursor:pointer;position:relative}
  .rsh-sidebar .rsh-sb-item i.rsh-item-ico{width:16px;text-align:center;font-size:14px;flex-shrink:0}
  .rsh-sidebar .rsh-sb-item:hover{background:rgba(255,255,255,.05);color:#fff}
  .rsh-sidebar .rsh-sb-item.active{background:var(--accent);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(255,0,80,.35)}
  .rsh-sidebar .rsh-sb-item.rsh-soon{opacity:.62}
  .rsh-soon-tag{margin-left:auto;font-size:8.5px;font-weight:800;letter-spacing:.03em;color:#8d86ac;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;flex-shrink:0}
  .rsh-sidebar .rsh-sb-item.active .rsh-soon-tag{background:rgba(255,255,255,.22);color:#fff}

  .rsh-sb-support{margin:10px 12px 16px;padding:16px 14px;border-radius:14px;background:var(--sidebar-bg-2);border:1px solid var(--sidebar-border)}
  .rsh-sb-support i{color:var(--accent);font-size:16px;margin-bottom:8px;display:block}
  .rsh-sb-support b{color:#fff;font-size:12.5px;display:block;margin-bottom:4px}
  .rsh-sb-support p{color:#8d86ac;font-size:11px;line-height:1.5;margin-bottom:12px}
  .rsh-sb-support button{width:100%;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:9px;font-size:12px;font-weight:700}
  .rsh-sb-overlay{display:none;position:fixed;inset:0;background:rgba(10,6,25,.6);z-index:290}

  .rsh-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .rsh-topbar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:18px;padding:14px 26px}
  .rsh-hamburger{display:none;width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
  .rsh-tb-title h1{font-size:18px;font-weight:800;margin:0}
  .rsh-tb-title p{font-size:12px;color:var(--text-muted);margin-top:1px}
  .rsh-tb-spacer{flex:1}
  .rsh-tb-search{display:flex;align-items:center;gap:9px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:11px;padding:9px 14px;width:280px;flex-shrink:0}
  .rsh-tb-search input{border:none;background:none;outline:none;color:var(--text);font-size:13px;flex:1;font-family:inherit}
  .rsh-tb-search input::placeholder{color:var(--text-faint)}
  .rsh-tb-search i{color:var(--text-faint);font-size:13px}
  .rsh-tb-icon-btn{position:relative;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:15px;flex-shrink:0;transition:.15s}
  .rsh-tb-icon-btn:hover{color:var(--accent);border-color:var(--accent)}
  .rsh-tb-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--red);color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}
  .rsh-theme-toggle{width:52px;height:30px;border-radius:20px;background:var(--input-bg);border:1px solid var(--input-border);position:relative;flex-shrink:0}
  .rsh-theme-toggle .rsh-knob{position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;transition:transform .25s cubic-bezier(.4,0,.2,1)}
  html[data-theme="dark"] .rsh-theme-toggle .rsh-knob{transform:translateX(22px)}
  .rsh-tb-profile{display:flex;align-items:center;gap:10px;padding:5px 10px 5px 5px;border-radius:30px;border:1px solid var(--input-border);flex-shrink:0;cursor:pointer}
  .rsh-tb-profile img{width:32px;height:32px;border-radius:50%;object-fit:cover}
  .rsh-tb-profile-txt{line-height:1.2}
  .rsh-tb-profile-txt b{font-size:12.5px;display:block}
  .rsh-tb-profile-txt span{font-size:10.5px;color:var(--text-muted)}
  .rsh-tb-profile i{color:var(--text-faint);font-size:11px;margin-left:2px}
  .rsh-mobile-search-btn{display:none;width:38px;height:38px;border-radius:50%;background:var(--input-bg);border:1px solid var(--input-border);align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-shrink:0}

  .rsh-preview-banner{display:none;align-items:center;gap:10px;background:var(--amber-bg);color:var(--amber);font-size:12.5px;font-weight:700;padding:11px 26px;border-bottom:1px solid rgba(217,119,6,.2)}
  .rsh-preview-banner.show{display:flex}
  .rsh-preview-banner button{margin-left:auto;background:#fff;border:1px solid rgba(217,119,6,.3);color:var(--amber);border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap}

  .rsh-content{padding:22px 26px 60px}
  .rsh-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#1a1730;color:#fff;padding:10px 18px;border-radius:24px;font-size:12.5px;font-weight:600;z-index:2000;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .rsh-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

  @media (max-width:1024px){
    .rsh-sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 40px rgba(0,0,0,.4)}
    .rsh-sidebar.open{transform:translateX(0)}
    .rsh-sb-overlay.show{display:block}
    .rsh-hamburger{display:flex}
    .rsh-sb-close{display:flex;margin-left:auto;width:30px;height:30px;border-radius:8px;background:var(--sidebar-bg-2);color:#cfc9e8;align-items:center;justify-content:center;border:none;font-size:13px}
    .rsh-tb-search{display:none}
    .rsh-mobile-search-btn{display:flex}
    .rsh-tb-title p{display:none}
  }
  @media (max-width:860px){
    .rsh-content{padding:16px}
    .rsh-topbar{padding:12px 16px}
    .rsh-tb-profile-txt{display:none}
    .rsh-tb-profile i{display:none}
    .rsh-preview-banner{padding:10px 16px}
  }
  .rsh-root button:focus-visible, .rsh-root input:focus-visible, .rsh-root a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  `;

  /* ── Utils ──────────────────────────────────────────────── */
  function _esc(s) { return (s || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); }

  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    let el = document.getElementById('rsh-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rsh-toast';
      el.className = 'rsh-toast';
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
    el.id = 'rsh-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ── Instance factory ─────────────────────────────────────── */
  let _instanceCounter = 0;

  function attach(target, options) {
    options = options || {};
    _injectStyles();

    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) { console.warn('[DroboardRoleShell] Target not found:', target); return null; }

    const instId = 'rsh' + (++_instanceCounter);
    const actualRoleKey = options.role || 'chief-editor';
    const activeItem = options.activeItem || 'dashboard';
    const user = Object.assign({ name: 'User', role: '', avatar: null }, options.user || {});
    const notifCount = options.notifCount != null ? options.notifCount : 0;
    const existingContent = container.innerHTML;

    let previewRoleKey = actualRoleKey;

    function navHtml(roleKey) {
      const role = findRole(roleKey);
      return role.nav.map(group => `
        ${group.section ? `<div class="rsh-sb-section-lbl">${_esc(group.section)}</div>` : ''}
        ${group.items.map(item => {
          const isActive = roleKey === actualRoleKey && item.key === activeItem;
          const soon = !item.implemented;
          return `<a class="rsh-sb-item${isActive ? ' active' : ''}${soon ? ' rsh-soon' : ''}"
                     href="${soon ? '#' : _esc(item.href)}"
                     data-item-key="${_esc(item.key)}"
                     data-impl="${item.implemented ? '1' : '0'}"
                     data-label="${_esc(item.label)}">
              <i class="fas ${item.icon} rsh-item-ico"></i>${_esc(item.label)}
              ${soon ? '<span class="rsh-soon-tag">SOON</span>' : ''}
            </a>`;
        }).join('')}
      `).join('');
    }

    function roleMenuHtml() {
      return ROLES.map(r => `
        <div class="rsh-role-opt${r.key === previewRoleKey ? ' active' : ''}" data-role-key="${r.key}">
          <div class="rsh-role-ico"><i class="fas ${r.icon}"></i></div>${_esc(r.label)}
        </div>`).join('');
    }

    container.classList.add('rsh-root');
    container.innerHTML = `
      <div class="rsh-shell">
        <div class="rsh-sb-overlay" id="${instId}-overlay"></div>
        <aside class="rsh-sidebar" id="${instId}-sidebar">
          <div class="rsh-sb-logo">
            <div class="rsh-sb-logo-ico"><i class="fas fa-book-open"></i></div>
            <div class="rsh-sb-logo-txt"><b>DROBOARD</b><b>DASHBOARD</b></div>
            <button class="rsh-sb-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="rsh-role-wrap">
            <button class="rsh-role-btn" id="${instId}-role-btn">
              <div class="rsh-role-ico"><i class="fas ${findRole(previewRoleKey).icon}"></i></div>
              <div class="rsh-role-info"><b id="${instId}-role-label">${_esc(findRole(previewRoleKey).label)}</b><span>Viewing as</span></div>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="rsh-role-menu" id="${instId}-role-menu">${roleMenuHtml()}</div>
          </div>
          <nav class="rsh-sb-nav" id="${instId}-nav">${navHtml(previewRoleKey)}</nav>
          <div class="rsh-sb-support">
            <i class="fas fa-headset"></i>
            <b>Quick Support</b>
            <p>Need help? Contact the engineering team.</p>
            <button id="${instId}-support">Contact Engineer</button>
          </div>
        </aside>
        <div class="rsh-main">
          <div class="rsh-topbar">
            <button class="rsh-hamburger" id="${instId}-hamburger"><i class="fas fa-bars"></i></button>
            <div class="rsh-tb-title">
              <h1 id="${instId}-title">${_esc(options.title || '')}</h1>
              <p id="${instId}-subtitle">${_esc(options.subtitle || '')}</p>
            </div>
            <div class="rsh-tb-spacer"></div>
            ${options.hideSearch ? '' : `
            <div class="rsh-tb-search">
              <i class="fas fa-magnifying-glass"></i>
              <input id="${instId}-search" placeholder="${_esc(options.searchPlaceholder || 'Search...')}"/>
            </div>
            <button class="rsh-mobile-search-btn" id="${instId}-mobile-search"><i class="fas fa-magnifying-glass"></i></button>`}
            <button class="rsh-theme-toggle" id="${instId}-theme" title="Toggle dark / light mode" aria-label="Toggle theme">
              <div class="rsh-knob"><i class="fas fa-sun" id="${instId}-theme-icon"></i></div>
            </button>
            <a class="rsh-tb-icon-btn" id="${instId}-bell" href="#" style="display:flex;align-items:center;justify-content:center;text-decoration:none">
              <i class="fas fa-bell"></i>
              ${notifCount > 0 ? `<span class="rsh-tb-badge">${notifCount}</span>` : ''}
            </a>
            <div class="rsh-tb-profile" id="${instId}-profile">
              ${user.avatar ? `<img src="${_esc(user.avatar)}" alt="${_esc(user.name)}"/>` : ''}
              <div class="rsh-tb-profile-txt"><b>${_esc(user.name)}</b><span>${_esc(user.role)}</span></div>
              <i class="fas fa-chevron-down"></i>
            </div>
          </div>
          <div class="rsh-preview-banner" id="${instId}-preview-banner">
            <i class="fas fa-eye"></i>
            <span id="${instId}-preview-text"></span>
            <button id="${instId}-preview-back">Back to my dashboard</button>
          </div>
          <div class="rsh-content" id="${instId}-content"></div>
        </div>
      </div>`;

    const contentEl = document.getElementById(instId + '-content');
    contentEl.innerHTML = existingContent;

    const sidebarEl = document.getElementById(instId + '-sidebar');
    const overlayEl = document.getElementById(instId + '-overlay');
    const navEl = document.getElementById(instId + '-nav');
    const roleBtnEl = document.getElementById(instId + '-role-btn');
    const roleMenuEl = document.getElementById(instId + '-role-menu');
    const roleLabelEl = document.getElementById(instId + '-role-label');
    const bannerEl = document.getElementById(instId + '-preview-banner');
    const bannerTextEl = document.getElementById(instId + '-preview-text');

    function openSidebar() { sidebarEl.classList.add('open'); overlayEl.classList.add('show'); }
    function closeSidebar() { sidebarEl.classList.remove('open'); overlayEl.classList.remove('show'); }
    document.getElementById(instId + '-hamburger').addEventListener('click', openSidebar);
    document.getElementById(instId + '-close').addEventListener('click', closeSidebar);
    overlayEl.addEventListener('click', closeSidebar);

    function wireNavClicks() {
      navEl.querySelectorAll('.rsh-sb-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const impl = item.dataset.impl === '1';
          const onRoleThatIsActual = previewRoleKey === actualRoleKey;
          if (!impl) {
            e.preventDefault();
            _toast(`${item.dataset.label} is coming soon — this section hasn't been built yet.`);
            return;
          }
          if (!onRoleThatIsActual) {
            // implemented item, but belongs to a role we're only previewing
            e.preventDefault();
            _toast(`Switch to ${findRole(previewRoleKey).label} to open ${item.dataset.label}.`);
            return;
          }
          closeSidebar();
        });
      });
    }
    wireNavClicks();

    function updatePreviewBanner() {
      if (previewRoleKey === actualRoleKey) {
        bannerEl.classList.remove('show');
      } else {
        bannerTextEl.textContent = `Previewing the ${findRole(previewRoleKey).label} navigation — this role's pages haven't been built yet.`;
        bannerEl.classList.add('show');
      }
    }

    function setPreviewRole(roleKey) {
      previewRoleKey = roleKey;
      roleLabelEl.textContent = findRole(roleKey).label;
      roleBtnEl.querySelector('.rsh-role-ico i').className = `fas ${findRole(roleKey).icon}`;
      navEl.innerHTML = navHtml(roleKey);
      wireNavClicks();
      roleMenuEl.innerHTML = roleMenuHtml();
      wireRoleMenuClicks();
      updatePreviewBanner();
      roleMenuEl.classList.remove('open');
      roleBtnEl.classList.remove('open');
    }

    function wireRoleMenuClicks() {
      roleMenuEl.querySelectorAll('.rsh-role-opt').forEach(opt => {
        opt.addEventListener('click', () => setPreviewRole(opt.dataset.roleKey));
      });
    }
    wireRoleMenuClicks();

    roleBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      roleMenuEl.classList.toggle('open');
      roleBtnEl.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      roleMenuEl.classList.remove('open');
      roleBtnEl.classList.remove('open');
    });

    document.getElementById(instId + '-preview-back').addEventListener('click', () => setPreviewRole(actualRoleKey));

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
        const t = options.mobileSearchTarget ? document.querySelector(options.mobileSearchTarget) : searchEl;
        if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus(); }
      });
    }

    // ── Bell / profile / support
    document.getElementById(instId + '-bell').addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof options.onBellClick === 'function') options.onBellClick();
      else _toast(`${notifCount} new notification${notifCount === 1 ? '' : 's'}`);
    });
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
      previewRole: setPreviewRole,
      getContentEl() { return contentEl; },
      destroy() {
        container.classList.remove('rsh-root');
        container.innerHTML = existingContent;
      },
    };
  }

  window.DroboardRoleShell = { attach, ROLES, findRole };

})();