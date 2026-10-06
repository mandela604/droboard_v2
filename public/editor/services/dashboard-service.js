/* dashboard-service.js — Editor Dashboard page logic (backend-ready).
 * Demo mode: USE_API=false keeps all demo paths working.
 * Flip USE_API=true and point API_BASE at the real backend to go live. */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    const res = await fetch(API_BASE + path, options || {});
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     ATTACH THE SHARED SHELL
     ═══════════════════════════════════════════════════════════ */
  function attachShell() {
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'dashboard.html',
      title: 'Editor Dashboard',
      subtitle: 'Manage your publishing platform — authors, contracts, content, and finances.',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      searchPlaceholder: 'Search stories, authors, contracts…',
      onBellClick: () => { location.href = 'notification-center.html'; },
      onSearch: (value) => {
        if (value) toast('Searching: ' + value);
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     LOAD DATA
     ═══════════════════════════════════════════════════════════ */
  async function loadDashboard() {
    try {
      const activities = window.DroboardAPI ? await DroboardAPI.getRecentActivity() : null;
      renderActivities(activities);
    } catch (e) {
      renderActivities();
    }
    renderPlatformOverview();
  }

  function renderActivities(activities) {
    const list = document.getElementById('activityList');
    const defaults = [
      { icon: 'accent', emoji: '\ud83d\udcdd', text: '<strong>Ifeanyi_Story</strong> signed a contract for <span class="highlight">Runaway Bride</span>', time: '2h ago', unread: true },
      { icon: 'green', emoji: '\u2705', text: '<strong>Chiamaka_N</strong> story approved \u2014 <span class="highlight">Grandmother\'s Will</span>', time: '4h ago', unread: true },
      { icon: 'yellow', emoji: '\ud83d\udcb0', text: 'Revenue share of <strong>\u20a64,200</strong> credited from Ada_Writes reads', time: '5h ago', unread: true },
      { icon: 'blue', emoji: '\ud83d\udcda', text: '<strong>Dami_Cole</strong> submitted new story: <span class="highlight">"She Rejected Me 3 Times"</span>', time: '7h ago', unread: false },
      { icon: 'accent', emoji: '\ud83d\udce7', text: '<strong>Kemi_A</strong> opened contract email for <span class="highlight">"He Deleted Our Photos"</span>', time: '1d ago', unread: false },
      { icon: 'green', emoji: '\ud83d\udee1\ufe0f', text: 'Admin <strong>co-signed</strong> premium contract for <span class="highlight">Chiamaka_N</span>', time: '1d ago', unread: false },
    ];
    var data = activities && activities.length ? activities : defaults;
    list.innerHTML = data.map(function(a) {
      return '<div class="activity-row" onclick="toast(\'Opening activity…\')">' +
        '<div class="activity-icon ' + a.icon + '">' + a.emoji + '</div>' +
        '<div class="activity-content">' +
          '<div class="activity-text">' + a.text + '</div>' +
          '<div class="activity-time">' + a.time + '</div>' +
        '</div>' +
        (a.unread ? '<div class="activity-dot"></div>' : '') +
      '</div>';
    }).join('');
  }

  function renderPlatformOverview() {
    var el = document.getElementById('platformOverview');
    var items = [
      { label: 'Published Books', value: '892', pct: 69, color: 'var(--green)' },
      { label: 'Draft Books', value: '47', pct: 4, color: 'var(--amber)' },
      { label: 'Flagged Content', value: '18', pct: 1, color: 'var(--red)' },
      { label: 'Pending Verifications', value: '18', pct: 6, color: 'var(--blue)' },
      { label: 'Active Contracts', value: '24', pct: 19, color: 'var(--accent)' },
    ];
    el.innerHTML = items.map(function(it) {
      return '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:5px">' +
            '<span style="font-size:11.5px;font-weight:700;color:var(--text)">' + it.label + '</span>' +
            '<span style="font-size:11.5px;font-weight:800;color:' + it.color + '">' + it.value + '</span>' +
          '</div>' +
          '<div style="height:6px;background:var(--border);border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + it.pct + '%;background:' + it.color + ';border-radius:4px;transition:width .6s"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function init() {
    attachShell();
    loadDashboard();
  }

  window.DashboardService = { init: init };
})();
