/**
 * traffic-page-service.js — App-wide Traffic & Activity controller (Marketing).
 * Tracks: visits per page, users online right now, most active hours,
 * busiest day of week. Demo data only — live swap: USE_API + API_BASE:
 *   GET /api/analytics/traffic?range=24h → { online, pages, hourly, daily, peakHour }
 */
(function () {
  'use strict';

  const USE_API = false, API_BASE = '/api';

  MarketingSidebar.attach('#trafficRoot', {
    activeItem: 'traffic',
    title: 'Traffic & Activity',
    subtitle: 'App-wide visits, live users & busiest periods',
    user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
    notifCount: 5,
    searchPlaceholder: 'Search…',
  });

  /* ── DEMO DATA ────────────────────────────────────────── */
  // Hourly sessions for last 24h (index 0 = 00:00 … 23 = 23:00)
  const HOURLY = [420, 310, 240, 190, 170, 210, 380, 760, 1420, 2180, 2640, 2980, 3410, 3620, 3350, 3120, 3280, 3840, 4620, 5480, 6210, 5740, 3960, 1840];

  /* Fallback only — the panel reads PageAnalyticsOverlay.PAGES when the
     component is loaded (single source of truth with the full inventory). */
  const PAGES = [
    { page: 'Home', path: 'index.html', icon: 'fa-house', visits: 148200, uniques: 61400, avgMin: 7.4, bounce: 24 },
    { page: 'Full Reader', path: 'full-reader.html', icon: 'fa-book-open', visits: 121800, uniques: 54900, avgMin: 18.6, bounce: 16 },
    { page: 'Genre Hub', path: 'genre-hub.html', icon: 'fa-layer-group', visits: 76400, uniques: 39200, avgMin: 6.1, bounce: 29 },
    { page: 'Discover', path: 'discover.html', icon: 'fa-compass', visits: 68100, uniques: 41700, avgMin: 4.8, bounce: 38 },
    { page: 'Discussion', path: 'discussion.html', icon: 'fa-comments', visits: 52600, uniques: 27300, avgMin: 8.9, bounce: 22 },
    { page: 'Profile', path: 'profile.html', icon: 'fa-user', visits: 44900, uniques: 26800, avgMin: 3.6, bounce: 41 },
    { page: 'Library', path: 'library.html', icon: 'fa-library', visits: 38200, uniques: 21500, avgMin: 5.2, bounce: 33 },
    { page: 'Create', path: 'create.html', icon: 'fa-pen-nib', visits: 29700, uniques: 12400, avgMin: 11.3, bounce: 19 },
    { page: 'Browse Overlay', path: 'overlay:browse', icon: 'fa-table-list', visits: 95000, uniques: 46000, avgMin: 5.9, bounce: 27 },
    { page: 'DroBoard Page', path: 'droboard-page.html', icon: 'fa-globe', visits: 18800, uniques: 11900, avgMin: 5.7, bounce: 31 },
  ];

  // Avg sessions by day of week, Mon → Sun
  const DAILY = [
    { day: 'Mon', v: 118000 }, { day: 'Tue', v: 124000 }, { day: 'Wed', v: 131000 },
    { day: 'Thu', v: 127000 }, { day: 'Fri', v: 142000 }, { day: 'Sat', v: 176000 },
    { day: 'Sun', v: 168000 },
  ];

  const ONLINE = { total: 1284, readers: 702, browsers: 341, posters: 158, guests: 83 };

  const AVG_SESSION_MIN = 6.8;
  const VISITS_TODAY = 312400;
  const VISITS_TODAY_DELTA = 8.4; // % vs yesterday

  /* ── HELPERS ──────────────────────────────────────────── */
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function accent() { return cssVar('--accent', '#ff0050'); }
  function textFaint() { return cssVar('--text-faint', '#9694ac'); }
  function border() { return cssVar('--border', '#eceaf5'); }

  const peakHour = HOURLY.indexOf(Math.max.apply(null, HOURLY));

  /* ── STAT CARDS ───────────────────────────────────────── */
  function renderStatCards() {
    const peakLabel = String(peakHour).padStart(2, '0') + ':00–' + String((peakHour + 1) % 24).padStart(2, '0') + ':00';
    const cards = [
      { n: String(ONLINE.total), l: 'Online Now', ico: 'fa-signal', cls: 'green', sub: '<span class="live-dot"></span> live' },
      { n: fmtNum(VISITS_TODAY), l: 'Visits Today', ico: 'fa-eye', cls: 'blue', sub: (VISITS_TODAY_DELTA >= 0 ? '+' : '') + VISITS_TODAY_DELTA + '% vs yesterday' },
      { n: peakLabel, l: 'Peak Hour Today', ico: 'fa-bolt', cls: 'gold', sub: fmtNum(HOURLY[peakHour]) + ' sessions' },
      { n: AVG_SESSION_MIN + 'm', l: 'Avg Session', ico: 'fa-stopwatch', cls: 'purple', sub: 'per visit' },
    ];
    const MAP = { green: ['var(--green-bg)', 'var(--green)'], blue: ['var(--blue-bg)', 'var(--blue)'], gold: ['var(--gold-bg)', 'var(--gold)'], purple: ['var(--purple-bg)', 'var(--purple)'] };
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      const m = MAP[c.cls];
      return '<div class="stat-card"><div class="stat-ico" style="background:' + m[0] + ';color:' + m[1] + '"><i class="fas ' + c.ico + '"></i></div><div><div class="stat-num">' + c.n + '</div><div class="stat-lbl">' + c.l + '</div><div class="stat-sub">' + c.sub + '</div></div></div>';
    }).join('');
    document.getElementById('peakPill').innerHTML = '<i class="fas fa-bolt"></i> Peak: ' + peakLabel;
  }

  /* ── ONLINE NOW (live tick) ───────────────────────────── */
  let onlineVal = ONLINE.total;
  function renderOnline() {
    document.getElementById('onlineNow').textContent = onlineVal.toLocaleString();
    document.getElementById('onlineBreak').innerHTML = [
      { n: ONLINE.readers, l: 'Reading' },
      { n: ONLINE.browsers, l: 'Browsing' },
      { n: ONLINE.posters, l: 'Posting' },
      { n: ONLINE.guests, l: 'Guests' },
    ].map(function (x) {
      return '<div class="ob-item"><b>' + fmtNum(x.n) + '</b><span>' + x.l + '</span></div>';
    }).join('');
  }
  function tickOnline() {
    // demo drift ±0.6% every 3s
    const drift = Math.round((Math.random() - 0.45) * Math.max(6, onlineVal * 0.006));
    onlineVal = Math.max(400, onlineVal + drift);
    const el = document.getElementById('onlineNow');
    if (el) el.textContent = onlineVal.toLocaleString();
  }

  /* ── VISITS BY PAGE ───────────────────────────────────── */
  function topPages() {
    if (window.PageAnalyticsOverlay && PageAnalyticsOverlay.PAGES) {
      return PageAnalyticsOverlay.PAGES.slice()
        .sort(function (a, b) { return b.visits - a.visits; })
        .slice(0, 10);
    }
    return PAGES;
  }
  function renderPages() {
    const list = topPages();
    const max = Math.max.apply(null, list.map(function (p) { return p.visits; }));
    document.getElementById('pageList').innerHTML =
      '<div class="pv-cols"><span>Page</span><span class="num">Visits</span><span class="num">Unique</span><span class="num">Avg Time</span><span class="num">Bounce</span></div>'
      + list.map(function (p) {
        const pct = Math.round((p.visits / max) * 100);
        return '<div class="pv-row">'
          + '<div class="pv-page"><div class="pv-ico"><i class="fas ' + p.icon + '"></i></div>'
          + '<div style="min-width:0;flex:1"><div class="pv-name">' + p.page + '</div>'
          + '<div class="pv-bar-track"><div class="pv-bar-fill" style="width:' + pct + '%"></div></div></div></div>'
          + '<div class="pv-num">' + fmtNum(p.visits) + '</div>'
          + '<div class="pv-num faint">' + fmtNum(p.uniques) + '</div>'
          + '<div class="pv-num faint">' + p.avgMin + 'm</div>'
          + '<div class="pv-num faint">' + p.bounce + '%</div>'
          + '</div>';
      }).join('');
  }

  /* ── CHARTS ───────────────────────────────────────────── */
  let trendChart = null, hourChart = null;

  function renderTrendChart() {
    const wrap = document.getElementById('trendWrap');
    if (!wrap) return;
    // Every 3rd hour keeps the fallback readable
    const rows = [];
    for (let i = 0; i < HOURLY.length; i += 3) rows.push({ l: String(i).padStart(2, '0') + ':00', v: HOURLY[i] });

    function showFallback() {
      const max = Math.max.apply(null, HOURLY);
      wrap.innerHTML = '<div class="chart-fallback">'
        + '<div class="chart-fallback-note"><i class="fas fa-triangle-exclamation"></i> Chart library unavailable — showing raw values instead.</div>'
        + rows.map(function (r) {
            return '<div class="cf-row"><div class="cf-lbl">' + r.l + '</div><div class="cf-track"><div class="cf-fill" style="width:' + Math.round((r.v / max) * 100) + '%"></div></div><div class="cf-val">' + fmtNum(r.v) + '</div></div>';
          }).join('')
        + '</div>';
    }

    // Chart.js CDN unreachable or constructor throwing must never
    // leave this panel blank — fall back to raw values instead.
    if (typeof window.Chart === 'undefined') { showFallback(); return; }

    try {
      // Recreate the canvas in case a previous fallback render replaced it
      let el = document.getElementById('trendChart');
      if (!el) { wrap.innerHTML = '<canvas id="trendChart"></canvas>'; el = document.getElementById('trendChart'); }
      const ctx = el.getContext('2d');
      const labels = HOURLY.map(function (_, i) { return String(i).padStart(2, '0') + ':00'; });
      if (trendChart) trendChart.destroy();
      trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Sessions',
          data: HOURLY,
          borderColor: accent(),
          backgroundColor: 'rgba(255,0,80,.09)',
          fill: true,
          tension: .4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textFaint(), font: { size: 10 }, maxTicksLimit: 8 }, border: { color: border() } },
          y: { grid: { color: border() }, ticks: { color: textFaint(), font: { size: 10 }, callback: function (v) { return fmtNum(v); } }, border: { display: false }, beginAtZero: true },
        },
      },
    });
    } catch (e) {
      console.error('[Traffic] trend chart failed:', e);
      showFallback();
    }
  }

  function renderHourChart() {
    const el = document.getElementById('hourChart');
    if (!el || typeof Chart === 'undefined') return;
    const labels = HOURLY.map(function (_, i) { return i % 3 === 0 ? String(i).padStart(2, '0') : ''; });
    const colors = HOURLY.map(function (_, i) {
      return i === peakHour ? accent() : (i >= 18 && i <= 21 ? 'rgba(255,0,80,.55)' : 'rgba(255,0,80,.25)');
    });
    if (hourChart) hourChart.destroy();
    hourChart = new Chart(el, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ data: HOURLY, backgroundColor: colors, borderRadius: 4, barPercentage: .85 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (it) { return String(it[0].dataIndex).padStart(2, '0') + ':00'; }, label: function (it) { return fmtNum(it.raw) + ' sessions'; } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textFaint(), font: { size: 9 } }, border: { color: border() } },
          y: { grid: { color: border() }, ticks: { color: textFaint(), font: { size: 9 }, callback: function (v) { return fmtNum(v); } }, border: { display: false }, beginAtZero: true },
        },
      },
    });
  }

  /* ── DAY-OF-WEEK HEATMAP ──────────────────────────────── */
  function renderHeatmap() {
    const max = Math.max.apply(null, DAILY.map(function (d) { return d.v; }));
    const min = Math.min.apply(null, DAILY.map(function (d) { return d.v; }));
    const base = [240, 255, 230, 245];
    const cells = DAILY.map(function (d) {
      const t = (d.v - min) / (max - min || 1);
      const alpha = 0.18 + t * 0.75;
      const fg = t > 0.55 ? '#fff' : 'var(--text)';
      return '<div class="heat-cell" title="' + d.day + ': ' + d.v.toLocaleString() + ' sessions" style="background:rgba(255,0,80,' + alpha.toFixed(2) + ');color:' + fg + '">' + fmtNum(d.v) + '</div>';
    }).join('');
    const lbls = DAILY.map(function (d) { return '<div class="heat-lbl">' + d.day + '</div>'; }).join('');
    document.getElementById('heatmap').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:4px">' + lbls + '</div>'
      + '<div class="heat-grid">' + cells + '</div>'
      + '<div class="heat-legend"><span style="background:rgba(255,0,80,.2)"></span> Quiet <span style="background:rgba(255,0,80,.55)"></span> <span style="background:rgba(255,0,80,.9)"></span> Peak</div>';
  }

  /* ── INIT ─────────────────────────────────────────────── */
  function init() {
    renderStatCards();
    renderOnline();
    renderPages();
    renderTrendChart();
    renderHourChart();
    renderHeatmap();
    setInterval(tickOnline, 3000);

    const viewAll = document.getElementById('viewAllPages');
    if (viewAll && window.PageAnalyticsOverlay) {
      viewAll.addEventListener('click', function () { PageAnalyticsOverlay.open(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
