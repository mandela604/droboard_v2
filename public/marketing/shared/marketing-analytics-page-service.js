/**
 * marketing-analytics-page-service.js — Marketing Analytics page logic (pure call-and-render).
 * Extracted verbatim from marketing-analytics.html inline script.
 * Page now calls MarketingAnalytics.init().
 * Backend-ready: implement fetch endpoints in shared/marketing-data.js and swap reads; no HTML change.
 */
(function(){
'use strict';

const shell = MarketingSidebar.attach('#anRoot', {
  activeItem: 'marketing-analytics',
  title: 'Marketing Analytics',
  subtitle: 'Full performance report',
  user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
  notifCount: 5,
  searchPlaceholder: 'Search analytics…',
});

/* ─────────────────────────────────────────
   COLOR TOKENS — hard hex values matching the CSS custom
   properties in marketing-sidebar.js, since <canvas> can't
   resolve var(--accent) the way the DOM can.
───────────────────────────────────────── */
const COLORS = {
  accent: '#ff0050', green: '#16a34a', blue: '#2f7de1',
  amber: '#d97706', red: '#e0384d', purple: '#5b4bcf',
  faint: '#9694ac', border: '#eceaf5',
};

/* ─────────────────────────────────────────
   PLACEMENTS — same surfaces used on the Campaigns page,
   kept here so placement performance rows have icons/labels.
───────────────────────────────────────── */
const PLACEMENTS = [
  { id:'discover',      label:'Homepage / Discover', icon:'fa-house' },
  { id:'search',        label:'Search Results',      icon:'fa-magnifying-glass' },
  { id:'feed',          label:'Social Feed',         icon:'fa-rss' },
  { id:'profile',       label:'Profile Pages',       icon:'fa-circle-user' },
  { id:'status',        label:'Status / Stories',    icon:'fa-circle-notch' },
  { id:'genre-hub',     label:'Genre Hub',           icon:'fa-layer-group' },
  { id:'end-of-story',  label:'End of Story',        icon:'fa-book-open' },
  { id:'comments',      label:'Inside Comments',     icon:'fa-comment-dots' },
];

/* ─────────────────────────────────────────
   TOP CAMPAIGNS — mirrors the live campaigns on campaigns.html
   so the two pages tell a consistent story.
───────────────────────────────────────── */
const TOP_CAMPAIGNS_BASE = [
  { name:'Twist & Drama Runaway Bride Push', type:'story',    ctr:7.0, reach:520000, conversions:2650 },
  { name:'Summer Romance Push',              type:'story',    ctr:7.2, reach:482000, conversions:1840 },
  { name:'Mafia & Urban Flash Push',         type:'story',    ctr:8.9, reach:198000, conversions:980  },
  { name:'PiggyVest Reader Drive',           type:'business', ctr:3.8, reach:390000, conversions:2100 },
  { name:'Werewolf Week',                    type:'story',    ctr:6.1, reach:315000, conversions:1120 },
];

/* ─────────────────────────────────────────
   Deterministic pseudo-random so re-renders of the same
   range don't jitter the trend line on every redraw.
───────────────────────────────────────── */
function seeded(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

let trendChart = null;
let mixChart = null;

function buildRangeData(days) {
  const rnd = seeded(days * 97 + 13);
  const labels = [];
  const impressions = [];
  const clicks = [];
  const today = new Date();
  let baseImp = days === 7 ? 62000 : days === 30 ? 38000 : 29000;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const wave = Math.sin((days - i) / (days / 3)) * 0.18;
    const noise = (rnd() - 0.5) * 0.22;
    const growth = 1 + ((days - i) / days) * 0.35;
    const imp = Math.max(4000, Math.round(baseImp * growth * (1 + wave + noise)));
    impressions.push(imp);
    clicks.push(Math.round(imp * (0.045 + rnd() * 0.025)));
  }
  return { labels, impressions, clicks };
}

function computeTotals(data) {
  const impressions = data.impressions.reduce((a, b) => a + b, 0);
  const clicks = data.clicks.reduce((a, b) => a + b, 0);
  const ctr = impressions ? (clicks / impressions * 100) : 0;
  const conversions = Math.round(clicks * 0.062);
  const spend = Math.round(clicks * 0.14);
  return { impressions, clicks, ctr, conversions, spend };
}

function fmtNum(n) {
  n = n || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ─────────────────────────────────────────
   Small helper so one section failing to render never takes
   the rest of the page down with it. Every panel below is
   wrapped in this instead of being called bare — that's the
   actual bug fix: previously a single thrown error (e.g. the
   Chart.js CDN not loading) aborted every renderer queued
   after it, leaving their panels stuck on the "Loading…"
   skeleton forever, with no error shown anywhere.
───────────────────────────────────────── */
function safeRun(label, fn) {
  try { fn(); }
  catch (e) {
    console.error('[Marketing Analytics] ' + label + ' failed:', e);
  }
}

function chartJsAvailable() {
  return typeof window.Chart !== 'undefined';
}

/* ─────────────────────────────────────────
   RENDER
───────────────────────────────────────── */
function render(days) {
  const data = buildRangeData(days);
  const totals = computeTotals(data);

  // Each section below is independent — a failure in one (e.g. the
  // Chart.js CDN being unreachable) no longer prevents the others
  // from rendering their real data.
  safeRun('stat cards', () => renderStats(totals, days));
  safeRun('trend chart', () => renderTrendChart(data));
  safeRun('placement performance', () => renderPlacementPerformance(totals));
  safeRun('reader funnel', () => renderFunnel(totals));
  safeRun('campaign mix chart', () => renderMixChart(totals));
  safeRun('top campaigns', () => renderTopCampaigns());
}

function renderStats(totals, days) {
  const stats = [
    { n: fmtNum(totals.impressions), l: 'Impressions', ico: 'fa-eye', clr: COLORS.accent, bg: 'rgba(255,0,80,.1)', delta: '+12.4%', up: true },
    { n: fmtNum(totals.clicks), l: 'Clicks', ico: 'fa-arrow-pointer', clr: COLORS.blue, bg: 'var(--blue-bg)', delta: '+8.1%', up: true },
    { n: totals.ctr.toFixed(1) + '%', l: 'Avg. CTR', ico: 'fa-percent', clr: COLORS.green, bg: 'var(--green-bg)', delta: '+0.6pt', up: true },
    { n: '$' + fmtNum(totals.spend), l: 'Total Spend', ico: 'fa-sack-dollar', clr: COLORS.amber, bg: 'var(--amber-bg)', delta: days === 90 ? '+21.0%' : '+4.2%', up: true },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico" style="background:${s.bg};color:${s.clr}"><i class="fas ${s.ico}"></i></div>
      <div>
        <div class="stat-num">${s.n}</div>
        <div class="stat-lbl">${s.l}</div>
        <div class="stat-delta ${s.up ? 'up' : 'down'}"><i class="fas fa-arrow-trend-${s.up ? 'up' : 'down'}"></i>${s.delta} vs previous period</div>
      </div>
    </div>`).join('');
}

function renderTrendChart(data) {
  const wrap = document.getElementById('trendChartWrap');

  if (!chartJsAvailable()) {
    // Chart.js didn't load (e.g. CDN unreachable) — fall back to a
    // simple readable bar list instead of leaving a blank canvas.
    const max = Math.max(...data.impressions, 1);
    const sampleIdx = [0, Math.floor(data.labels.length * 0.25), Math.floor(data.labels.length * 0.5), Math.floor(data.labels.length * 0.75), data.labels.length - 1]
      .filter((v, i, arr) => arr.indexOf(v) === i);
    wrap.innerHTML = `<div class="chart-fallback">
      <div class="chart-fallback-note"><i class="fas fa-triangle-exclamation"></i> Chart library unavailable — showing raw values instead.</div>
      ${sampleIdx.map(i => `
        <div class="cf-row">
          <div class="cf-lbl">${esc(data.labels[i])}</div>
          <div class="cf-track"><div class="cf-fill" style="width:${Math.round(data.impressions[i] / max * 100)}%;background:${COLORS.accent}"></div></div>
          <div class="cf-val">${fmtNum(data.impressions[i])}</div>
        </div>`).join('')}
    </div>`;
    return;
  }

  // Chart.js is present — make sure the wrap still has its canvas
  // (in case a previous fallback render replaced it).
  if (!document.getElementById('trendChart')) {
    wrap.innerHTML = '<canvas id="trendChart"></canvas>';
  }
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Impressions',
          data: data.impressions,
          borderColor: COLORS.accent,
          backgroundColor: 'rgba(255,0,80,.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2.5,
          yAxisID: 'y',
        },
        {
          label: 'Clicks',
          data: data.clicks,
          borderColor: COLORS.blue,
          backgroundColor: 'rgba(47,125,225,.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2.5,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, font: { size: 11, family: 'Inter', weight: '700' }, color: '#71708a' },
        },
        tooltip: { backgroundColor: '#1a1730', padding: 10, cornerRadius: 8, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9694ac', maxTicksLimit: 8 } },
        y: { position: 'left', grid: { color: '#eceaf5' }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9694ac', callback: v => fmtNum(v) } },
        y1: { position: 'right', grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9694ac', callback: v => fmtNum(v) } },
      },
    },
  });
}

function renderPlacementPerformance(totals) {
  const rnd = seeded(totals.impressions % 100000 + 7);
  const weights = PLACEMENTS.map(() => 0.4 + rnd());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const rows = PLACEMENTS.map((p, i) => {
    const impressions = Math.round(totals.impressions * (weights[i] / weightSum));
    const ctr = 3 + rnd() * 6;
    return Object.assign({}, p, { impressions, ctr });
  }).sort((a, b) => b.impressions - a.impressions);
  const maxImp = rows[0].impressions || 1;

  document.getElementById('placementList').innerHTML = rows.map(r => `
    <div class="ph-row">
      <div class="ph-ico"><i class="fas ${r.icon}"></i></div>
      <div class="ph-info">
        <div class="ph-name">${esc(r.label)}</div>
        <div class="ph-meta">${fmtNum(r.impressions)} impressions</div>
      </div>
      <div class="ph-bar-wrap"><div class="ph-bar-track"><div class="ph-bar-fill" style="width:${Math.round(r.impressions / maxImp * 100)}%"></div></div></div>
      <div class="ph-ctr">${r.ctr.toFixed(1)}%</div>
    </div>`).join('');
}

function renderFunnel(totals) {
  const steps = [
    { l: 'Impressions', v: totals.impressions, clr: COLORS.accent },
    { l: 'Clicks', v: totals.clicks, clr: COLORS.blue },
    { l: 'Conversions', v: totals.conversions, clr: COLORS.green },
  ];
  const max = steps[0].v || 1;
  document.getElementById('funnel').innerHTML = steps.map(s => {
    const pct = Math.max(4, Math.round(s.v / max * 100));
    return `<div class="funnel-step">
      <div class="funnel-lbl">${s.l}</div>
      <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:${pct}%;background:${s.clr}">${fmtNum(s.v)}</div></div>
      <div class="funnel-pct">${pct}%</div>
    </div>`;
  }).join('');
}

function renderMixChart(totals) {
  const storyShare = 0.64;
  const businessShare = 1 - storyShare;
  const storySpend = Math.round(totals.spend * storyShare);
  const businessSpend = Math.round(totals.spend * businessShare);
  const wrap = document.getElementById('mixChartWrap');

  if (!chartJsAvailable()) {
    wrap.innerHTML = `<div class="chart-fallback">
      <div class="chart-fallback-note"><i class="fas fa-triangle-exclamation"></i> Chart library unavailable — showing raw values instead.</div>
      <div class="cf-row"><div class="cf-lbl">Story</div><div class="cf-track"><div class="cf-fill" style="width:${Math.round(storyShare * 100)}%;background:${COLORS.purple}"></div></div><div class="cf-val">$${fmtNum(storySpend)}</div></div>
      <div class="cf-row"><div class="cf-lbl">Business</div><div class="cf-track"><div class="cf-fill" style="width:${Math.round(businessShare * 100)}%;background:${COLORS.blue}"></div></div><div class="cf-val">$${fmtNum(businessSpend)}</div></div>
    </div>`;
    document.getElementById('mixLegend').innerHTML = `
      <div class="legend-dot"><span style="background:${COLORS.purple}"></span>Platform Story · ${Math.round(storyShare * 100)}%</div>
      <div class="legend-dot"><span style="background:${COLORS.blue}"></span>Business · ${Math.round(businessShare * 100)}%</div>`;
    return;
  }

  if (!document.getElementById('mixChart')) {
    wrap.innerHTML = '<canvas id="mixChart"></canvas>';
  }
  const ctx = document.getElementById('mixChart').getContext('2d');
  if (mixChart) mixChart.destroy();
  mixChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Platform Story', 'Business'],
      datasets: [{
        data: [storySpend, businessSpend],
        backgroundColor: [COLORS.purple, COLORS.blue],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1730', padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => ' $' + fmtNum(ctx.raw) },
        },
      },
    },
  });

  document.getElementById('mixLegend').innerHTML = `
    <div class="legend-dot"><span style="background:${COLORS.purple}"></span>Platform Story · ${Math.round(storyShare * 100)}%</div>
    <div class="legend-dot"><span style="background:${COLORS.blue}"></span>Business · ${Math.round(businessShare * 100)}%</div>`;
}

function renderTopCampaigns() {
  const sorted = TOP_CAMPAIGNS_BASE.slice().sort((a, b) => b.ctr - a.ctr);
  document.getElementById('topCampaigns').innerHTML = sorted.map((c, i) => `
    <div class="tc-row">
      <div class="tc-rank">${i + 1}</div>
      <div class="tc-info">
        <div class="tc-name">${esc(c.name)} <span class="type-chip ${c.type}">${c.type === 'story' ? '📖 Story' : '💼 Business'}</span></div>
        <div class="tc-meta">${fmtNum(c.reach)} reach</div>
      </div>
      <div class="tc-stats">
        <div class="tc-stat"><b>${c.ctr}%</b><span>CTR</span></div>
        <div class="tc-stat"><b>${fmtNum(c.conversions)}</b><span>Conv.</span></div>
      </div>
    </div>`).join('');
}

var _rs = document.getElementById('rangeSel'); if (_rs) _rs.addEventListener('change', (e) => render(parseInt(e.target.value, 10)));
var _eb = document.getElementById('exportBtn'); if (_eb) _eb.addEventListener('click', () => toast('📄 Report export started — check your downloads shortly'));

window.MarketingAnalytics={init:function(){ render(30); },render:render};
})();
