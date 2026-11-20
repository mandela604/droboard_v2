/**
 * traffic-page-service.js — App-wide Traffic & Activity (Marketing).
 * Live API only. Reads /api/track/platform (real pageviews, readers, DAU) and
 * never invents an "online now" number the backend does not provide.
 */
(function () {
  'use strict';

  let pageQuery = '';
  let days = 30;

  MarketingSidebar.attach('#trafficRoot', {
    activeItem: 'traffic',
    title: 'Traffic & Activity',
    subtitle: 'App-wide visits, live users & busiest periods',
    searchPlaceholder: 'Search pages…',
    onSearch: function (v) { pageQuery = (v || '').trim().toLowerCase(); renderPages(); },
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  function showError(msg) {
    const el = document.getElementById('statCards');
    if (el) el.innerHTML = '<div class="error-state"><i class="fas fa-circle-exclamation"></i> ' + esc(msg) + '</div>';
  }
  async function api(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error('API error ' + res.status);
    return await res.json();
  }

  let PLATFORM = null;

  async function loadData() {
    const el = document.getElementById('statCards');
    if (el) el.innerHTML = '<div class="skeleton"><i class="fas fa-spinner fa-spin"></i> Loading traffic data…</div>';
    try {
      PLATFORM = await api('/api/track/platform');
      renderStats();
      renderTrend();
      renderPages();
      renderActive();
      renderHours();
      renderHeatmap();
    } catch (e) {
      console.error('Traffic API error:', e);
      showError('Failed to load traffic data: ' + e.message);
    }
  }

  function renderStats() {
    const el = document.getElementById('statCards');
    if (!el) return;
    const pv = PLATFORM.pageviews || {};
    const dau = (PLATFORM.activeUsers && PLATFORM.activeUsers.dau) || [];
    const last = dau.length ? dau[dau.length - 1].users : 0;
    const ret = PLATFORM.returningReaderRate || {};
    const stats = [
      { v: fmt(pv.total || 0), l: 'Page views (' + days + 'd)', i: 'fa-eye', c: 'blue' },
      { v: fmt(ret.totalReaders || 0), l: 'Unique readers', i: 'fa-user-group', c: 'green' },
      { v: (ret.pct || 0) + '%', l: 'Returning readers', i: 'fa-rotate', c: 'purple' },
      { v: fmt(last), l: 'Active users (DAU)', i: 'fa-signal', c: 'amber' },
    ];
    el.innerHTML = stats.map(s =>
      '<div class="stat-card"><div class="stat-ico ' + s.c + '"><i class="fas ' + s.i + '"></i></div>' +
      '<div class="stat-num">' + s.v + '</div><div class="stat-lbl">' + s.l + '</div></div>').join('');
  }

  function renderTrend() {
    const canvas = document.getElementById('trendChart');
    const dau = (PLATFORM.activeUsers && PLATFORM.activeUsers.dau) || [];
    const peak = document.getElementById('peakPill');
    if (peak) {
      const top = dau.reduce((a, b) => (b.users > (a.users || 0) ? b : a), { users: 0, day: '' });
      peak.innerHTML = '<i class="fas fa-bolt"></i> Peak: ' + fmt(top.users) + ' · ' + esc(top.day || '—');
    }
    if (!canvas) return;
    if (!window.Chart || !dau.length) {
      canvas.parentElement.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:30px">' +
        (dau.length ? 'Chart library unavailable — ' + dau.length + ' days of live data received.' : 'No traffic data available') + '</div>';
      return;
    }
    new Chart(canvas, {
      type: 'line',
      data: { labels: dau.map(d => d.day), datasets: [{ label: 'Active users', data: dau.map(d => d.users), borderColor: '#ff2d55', fill: false, tension: .3 }] },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  function renderPages() {
    const el = document.getElementById('pageList');
    if (!el) return;
    const by = (PLATFORM.pageviews && PLATFORM.pageviews.bySurface) || {};
    const rows = Object.keys(by).map(k => ({ page: k, visits: by[k] || 0 }))
      .filter(p => !pageQuery || p.page.toLowerCase().indexOf(pageQuery) !== -1)
      .sort((a, b) => b.visits - a.visits);
    if (!rows.length) { el.innerHTML = '<div class="empty">No page data available</div>'; return; }
    const max = rows[0].visits || 1;
    el.innerHTML = rows.map(p =>
      '<div class="pv-row"><div class="pv-name">' + esc(p.page) + '</div>' +
      '<div class="pv-bar-track"><div class="pv-bar-fill" style="width:' + Math.round((p.visits / max) * 100) + '%"></div></div>' +
      '<div class="pv-num">' + fmt(p.visits) + '</div><div></div><div></div></div>').join('');
  }

  function renderActive() {
    const num = document.getElementById('onlineNow');
    const brk = document.getElementById('onlineBreak');
    const dau = (PLATFORM.activeUsers && PLATFORM.activeUsers.dau) || [];
    const last = dau.length ? dau[dau.length - 1] : { users: 0, day: '' };
    if (num) num.textContent = fmt(last.users);
    const label = document.querySelector('.online-lbl');
    if (label) label.innerHTML = '<span class="live-dot"></span> Active users on ' + esc(last.day || 'latest day');
    if (brk) {
      brk.innerHTML = '<div>Readers today: ' + fmt(last.users) + '</div>' +
        '<div>Unique readers (' + days + 'd): ' + fmt((PLATFORM.returningReaderRate || {}).totalReaders || 0) + '</div>' +
        '<div>Countries: ' + fmt(((PLATFORM.countries || []).length)) + '</div>';
    }
  }

  function renderHours() {
    const wrap = document.getElementById('hourWrap');
    if (wrap) wrap.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:30px">' +
      'Hourly activity is not available from the live analytics API.</div>';
  }

  function renderHeatmap() {
    const el = document.getElementById('heatmap');
    if (!el) return;
    const dau = (PLATFORM.activeUsers && PLATFORM.activeUsers.dau) || [];
    if (!dau.length) { el.innerHTML = '<div class="empty">No activity data available</div>'; return; }
    const max = Math.max.apply(null, dau.map(d => Number(d.users) || 0)) || 1;
    el.innerHTML = '<div class="heat-grid">' + dau.map(d => {
      const v = Number(d.users) || 0;
      const a = 0.12 + (v / max) * 0.8;
      return '<div class="heat-cell" title="' + esc(d.day) + ': ' + v + ' users" style="background:rgba(255,45,85,' + a.toFixed(2) + ')"></div>';
    }).join('') + '</div>';
  }

  loadData();
})();
