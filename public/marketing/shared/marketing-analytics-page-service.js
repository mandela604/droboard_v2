/**
 * marketing-analytics-page-service.js — Marketing Analytics page logic (pure call-and-render).
 * Extracted verbatim from marketing-analytics.html inline script.
 * Page now calls MarketingAnalytics.init().
 * Backend-ready: implement fetch endpoints in shared/marketing-data.js and swap reads; no HTML change.
 */
(function(){
'use strict';

let _days = 30;
let _q = '';

const shell = MarketingSidebar.attach('#anRoot', {
  activeItem: 'marketing-analytics',
  title: 'Marketing Analytics',
  subtitle: 'Full performance report',
  user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
  notifCount: 5,
  searchPlaceholder: 'Search placements & campaigns…',
  onSearch: (v) => {
    _q = (v || '').trim().toLowerCase();
    safeRun('placement performance', () => renderPlacementPerformance(computeTotals(buildRangeData(_days))));
    safeRun('top campaigns', () => renderTopCampaigns());
  },
});

function matches(text) {
  return !_q || String(text == null ? '' : text).toLowerCase().indexOf(_q) !== -1;
}

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

/* ── Backend numbers (GET /api/ads/performance via AdService) ──
   The demo build has USE_API=false, so getPerformance() resolves null and
   every panel keeps its seeded fallback. Flip ad-service.js once and the
   same panels render real reach, completion, CTR and conversions. */
const PAGE_TO_PLACEMENT = {
  discover: 'discover', home: 'discover', search: 'search', feed: 'feed',
  profile: 'profile', status: 'status', genreHub: 'genre-hub',
  fullReader: 'end-of-story', scrollReader: 'end-of-story', story: 'end-of-story',
  comments: 'comments',
};
let _lastData = null, _lastDays = 0;

function perfTotals(t) {
  return {
    impressions: +t.impressions || 0,
    viewables: +t.viewables || 0,
    uniqueViewers: +t.uniqueViewers || 0,
    clicks: +t.clicks || 0,
    ctr: +t.ctr || 0,
    viewabilityRate: +t.viewabilityRate || 0,
    conversions: +t.conversions || 0,
    completes: +t.completes || 0,
    skips: +t.skips || 0,
    spend: +t.value || 0,
  };
}
function perfSeries(perf) {
  if (!perf || !Array.isArray(perf.series) || !perf.series.length) return null;
  return {
    labels: perf.series.map(s => {
      const d = new Date(s.date + 'T00:00:00');
      return isNaN(d) ? s.date : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    impressions: perf.series.map(s => +s.impressions || 0),
    viewables: perf.series.map(s => +s.viewables || 0),
    clicks: perf.series.map(s => +s.clicks || 0),
    conversions: perf.series.map(s => +s.conversions || 0),
  };
}
function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

/* Ad creative label for "top campaigns" (demo inventory lookup; the backend
   only returns ids, so unknown ids stay readable as the raw id). */
function creativeMeta(adId) {
  const pools = (window.DemoData && window.DemoData.AD_POOLS) || {};
  for (const k of Object.keys(pools)) {
    const hit = (pools[k] || []).find(a => a && a.id === adId);
    if (hit) {
      return {
        name: hit.campaign || hit.headline || hit.heading || hit.title || hit.brand || adId,
        type: (k === 'book' || hit.isBook) ? 'story' : 'business',
      };
    }
  }
  return { name: adId, type: 'business' };
}

function realPlacementRows(slots) {
  const agg = {};
  (slots || []).forEach(s => {
    const pid = PAGE_TO_PLACEMENT[s.page] || s.page || 'other';
    const meta = PLACEMENTS.find(p => p.id === pid) || { id: pid, label: pid || 'Other', icon: 'fa-rectangle-ad' };
    const row = agg[pid] || (agg[pid] = Object.assign({}, meta, {
      impressions: 0, viewables: 0, clicks: 0, completes: 0, skips: 0, conversions: 0, live: true,
    }));
    row.impressions += s.impressions || 0;
    row.viewables += s.viewables || 0;
    row.clicks += s.clicks || 0;
    row.completes += s.completes || 0;
    row.skips += s.skips || 0;
    row.conversions += s.conversions || 0;
  });
  return Object.keys(agg).map(k => {
    const r = agg[k];
    r.ctr = r.impressions ? (r.clicks / r.impressions) * 100 : 0;
    r.viewabilityRate = r.impressions ? Math.min(100, (r.viewables / r.impressions) * 100) : 0;
    return r;
  });
}

function realCampaignRows(slots) {
  const agg = {};
  (slots || []).forEach(s => {
    const row = agg[s.adId] || (agg[s.adId] = { adId: s.adId, impressions: 0, clicks: 0, conversions: 0 });
    row.impressions += s.impressions || 0;
    row.clicks += s.clicks || 0;
    row.conversions += s.conversions || 0;
  });
  return Object.keys(agg).map(id => {
    const r = agg[id];
    const meta = creativeMeta(id);
    return {
      name: meta.name, type: meta.type, reach: r.impressions,
      ctr: r.impressions ? round1((r.clicks / r.impressions) * 100) : 0,
      conversions: r.conversions,
    };
  });
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
  return renderAnalytics(days);
}

/* Backend-first: pull real per-slot numbers when available, otherwise the
   deterministic demo dataset keeps every panel populated. */
async function renderAnalytics(days) {
  let perf = null;
  try {
    if (window.AdService && typeof AdService.getPerformance === 'function') {
      perf = await AdService.getPerformance({ days });
    }
  } catch (e) { perf = null; }
  const live = !!(perf && perf.totals && (perf.totals.impressions || perf.totals.clicks || perf.totals.conversions));
  const data = (live && perfSeries(perf)) || buildRangeData(days);
  _lastData = data;
  _lastDays = days;
  const totals = live ? perfTotals(perf.totals) : computeTotals(data);

  // Each section below is independent — a failure in one (e.g. the
  // Chart.js CDN being unreachable) no longer prevents the others
  // from rendering their real data.
  safeRun('stat cards', () => renderStats(totals, days, live));
  safeRun('trend chart', () => renderTrendChart(data));
  safeRun('placement performance', () => renderPlacementPerformance(totals, live ? perf : null));
  safeRun('reader funnel', () => renderFunnel(totals));
  safeRun('campaign mix chart', () => renderMixChart(totals));
  safeRun('top campaigns', () => renderTopCampaigns(live ? perf : null));
  safeRun('ad revenue share', () => renderAdRevenue(days));
}

function fmtUSD(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;
  return (window.DroboardCurrency && DroboardCurrency.usdToMoney) ? DroboardCurrency.usdToMoney(n) : '$' + n.toFixed(2);
}

/* Read-only Ad Revenue Share — story slots split 70/30; payouts are
   managed in super-admin/ad-earnings.html. */
function renderAdRevenue(days) {
  const el = document.getElementById('adRevenuePanel');
  if (!el) return;
  if (!window.AdRevenue || !AdRevenue.getSummary) {
    el.innerHTML = '<div style="padding:14px 2px;color:var(--text-faint);font-size:12px">Ad revenue service unavailable.</div>';
    return;
  }
  AdRevenue.getSummary(days).then((s) => {
    const t = s.totals || {};
    const revenue = Number(t.revenue) || 0;
    const plat = Number(t.platformShare) || 0;
    const auth = Number(t.authorShare) || 0;
    const platPct = revenue ? Math.round((plat / revenue) * 100) : 100;
    const topStories = (s.byStory || []).slice(0, 3);
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div><div style="font-size:10px;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:.04em">Gross</div>
          <div style="font-size:18px;font-weight:800">${fmtUSD(revenue)}</div>
          <div style="font-size:10.5px;color:var(--text-faint)">${fmtNum(t.impressions || 0)} impressions</div></div>
        <div><div style="font-size:10px;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:.04em">Authors payable</div>
          <div style="font-size:18px;font-weight:800;color:var(--accent)">${fmtUSD(t.authorShareUnpaid != null ? t.authorShareUnpaid : auth)}</div>
          <div style="font-size:10.5px;color:var(--text-faint)">of ${fmtUSD(auth)} author share</div></div>
      </div>
      <div style="display:flex;height:10px;border-radius:8px;overflow:hidden;background:var(--border);margin-bottom:4px">
        <div style="width:${platPct}%;background:${COLORS.blue}"></div>
        <div style="width:${100 - platPct}%;background:${COLORS.accent}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-muted);font-weight:600;margin-bottom:10px">
        <span>Platform ${fmtUSD(plat)}</span><span>Author 30% · ${fmtUSD(auth)}</span>
      </div>
      ${topStories.length ? topStories.map(st => `
        <div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--border);font-size:11.5px">
          <span style="font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(st.storyTitle || st.storyId)}</span>
          <span style="color:var(--text-faint);white-space:nowrap">${esc(st.authorName || '')} · ${fmtUSD(st.authorShare)}</span>
        </div>`).join('') : '<div style="font-size:11.5px;color:var(--text-faint)">No story-ad revenue in this range.</div>'}
    `;
  }).catch((e) => {
    console.error('[Marketing Analytics] ad revenue share failed:', e);
    el.innerHTML = '<div style="padding:14px 2px;color:var(--text-faint);font-size:12px">Could not load ad revenue.</div>';
  });
}

function renderStats(totals, days, live) {
  const viewable = live
    ? (+totals.viewabilityRate || 0).toFixed(1) + '% viewable' + (totals.uniqueViewers ? ' · ' + fmtNum(totals.uniqueViewers) + ' unique' : '')
    : null;
  const stats = [
    { n: fmtNum(totals.impressions), l: 'Impressions', ico: 'fa-eye', clr: COLORS.accent, bg: 'rgba(255,0,80,.1)', delta: live ? viewable : '+12.4%', up: true },
    { n: fmtNum(totals.clicks), l: 'Clicks', ico: 'fa-arrow-pointer', clr: COLORS.blue, bg: 'var(--blue-bg)', delta: live ? 'Live backend' : '+8.1%', up: true },
    { n: (+totals.ctr || 0).toFixed(1) + '%', l: 'Avg. CTR', ico: 'fa-percent', clr: COLORS.green, bg: 'var(--green-bg)', delta: live ? 'Live backend' : '+0.6pt', up: true },
    { n: (window.DroboardCurrency && DroboardCurrency.usdToMoney ? DroboardCurrency.usdToMoney(totals.spend) : '$' + fmtNum(totals.spend)), l: live ? 'Attributed Value' : 'Total Spend', ico: 'fa-sack-dollar', clr: COLORS.amber, bg: 'var(--amber-bg)', delta: live ? 'Live backend' : (days === 90 ? '+21.0%' : '+4.2%'), up: true },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico" style="background:${s.bg};color:${s.clr}"><i class="fas ${s.ico}"></i></div>
      <div>
        <div class="stat-num">${s.n}</div>
        <div class="stat-lbl">${s.l}</div>
        <div class="stat-delta ${s.up ? 'up' : 'down'}"><i class="fas fa-${live ? 'circle-check' : 'arrow-trend-' + (s.up ? 'up' : 'down')}"></i>${s.delta}${live ? '' : ' vs previous period'}</div>
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

function renderPlacementPerformance(totals, perf) {
  let rows;
  if (perf && Array.isArray(perf.slots) && perf.slots.length) {
    // Real per-placement rows from the ad event stream.
    rows = realPlacementRows(perf.slots).filter(r => matches(r.label)).sort((a, b) => b.impressions - a.impressions);
    const live = spotlightPlacementRow();
    if (live && live.impressions && matches(live.label)) rows.unshift(live);
    if (!rows.length) {
      document.getElementById('placementList').innerHTML = '<div style="padding:14px 2px;color:var(--text-faint);font-size:12px">No placements match your search.</div>';
      return;
    }
  } else {
    const rnd = seeded(totals.impressions % 100000 + 7);
    const src = PLACEMENTS.filter(p => matches(p.label));
    const live = spotlightPlacementRow();
    const includeLive = !!(live && matches(live.label));
    if (!src.length && !includeLive) {
      document.getElementById('placementList').innerHTML = '<div style="padding:14px 2px;color:var(--text-faint);font-size:12px">No placements match your search.</div>';
      return;
    }
    const weights = src.map(() => 0.4 + rnd());
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
    rows = src.map((p, i) => {
      const impressions = Math.round(totals.impressions * (weights[i] / weightSum));
      const ctr = 3 + rnd() * 6;
      return Object.assign({}, p, { impressions, ctr });
    }).sort((a, b) => b.impressions - a.impressions);
    if (includeLive) rows.unshift(live);
  }
  const maxImp = Math.max.apply(null, rows.map(r => r.impressions).concat(1));

  document.getElementById('placementList').innerHTML = rows.map(r => `
    <div class="ph-row">
      <div class="ph-ico"><i class="fas ${r.icon}"></i></div>
      <div class="ph-info">
        <div class="ph-name">${esc(r.label)}${r.live ? '<span style="font-size:8px;font-weight:800;letter-spacing:.06em;color:var(--green);background:var(--green-bg);border-radius:4px;padding:2px 5px;margin-left:5px;vertical-align:1px">LIVE</span>' : ''}</div>
        <div class="ph-meta">${fmtNum(r.impressions)} impressions${r.live ? ' · ' + fmtNum(r.clicks) + ' clicks' : ''}${r.live && r.viewabilityRate ? ' · ' + r.viewabilityRate.toFixed(1) + '% viewable' : ''}${r.conversions ? ' · ' + fmtNum(r.conversions) + ' conv.' : ''}</div>
      </div>
      <div class="ph-bar-wrap"><div class="ph-bar-track"><div class="ph-bar-fill" style="width:${Math.round(r.impressions / maxImp * 100)}%"></div></div></div>
      <div class="ph-ctr">${(+r.ctr || 0).toFixed(1)}%</div>
    </div>`).join('');
}

/* Live Discover spotlight counters — CTA tap counts as a conversion. */
function spotlightPlacementRow() {
  try {
    if (!window.AdService || typeof AdService.spotlightStats !== 'function') return null;
    const s = AdService.spotlightStats();
    return {
      id: 'spotlight', label: 'Discover Spotlight', icon: 'fa-bolt',
      impressions: +s.impressions || 0, clicks: +s.clicks || 0, ctr: +s.ctr || 0, live: true,
    };
  } catch (e) { return null; }
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

function renderTopCampaigns(perf) {
  const source = (perf && Array.isArray(perf.slots) && perf.slots.length)
    ? realCampaignRows(perf.slots)
    : TOP_CAMPAIGNS_BASE;
  const sorted = source.filter(c => matches(c.name))
    .sort((a, b) => (b.conversions || 0) - (a.conversions || 0) || (b.ctr || 0) - (a.ctr || 0));
  if (!sorted.length) {
    document.getElementById('topCampaigns').innerHTML = '<div style="padding:14px 2px;color:var(--text-faint);font-size:12px">No campaigns match your search.</div>';
    return;
  }
  document.getElementById('topCampaigns').innerHTML = sorted.map((c, i) => `
    <div class="tc-row">
      <div class="tc-rank">${i + 1}</div>
      <div class="tc-info">
        <div class="tc-name">${esc(c.name)} <span class="type-chip ${c.type}">${c.type === 'story' ? '📖 Story' : '💼 Business'}</span></div>
        <div class="tc-meta">${fmtNum(c.reach)} reach</div>
      </div>
      <div class="tc-stats">
        <div class="tc-stat"><b>${(+c.ctr || 0).toFixed(1)}%</b><span>CTR</span></div>
        <div class="tc-stat"><b>${fmtNum(c.conversions)}</b><span>Conv.</span></div>
      </div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   EXPORT — real CSV download of the current range (no third-party lib).
─────────────────────────────────────────────────────────────── */
function exportCsv(days) {
  const data = (_lastData && _lastDays === days) ? _lastData : buildRangeData(days);
  const rows = [['Date', 'Impressions', 'Viewable', 'Clicks', 'CTR', 'Conversions']];
  for (let i = 0; i < data.labels.length; i++) {
    const ctr = data.impressions[i] ? (data.clicks[i] / data.impressions[i] * 100).toFixed(2) + '%' : '0%';
    const conv = (data.conversions && data.conversions[i]) || 0;
    const viewable = (data.viewables && data.viewables[i]) || 0;
    rows.push([data.labels[i], data.impressions[i], viewable, data.clicks[i], ctr, conv]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketing-analytics-' + days + 'd.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error('[Marketing Analytics] CSV export failed:', e);
  }
}

/* ─────────────────────────────────────────
   INIT — all wiring happens here (call-and-render contract).
─────────────────────────────────────────────────────────────── */
window.MarketingAnalytics = {
  init: function () {
    const rs = document.getElementById('rangeSel');
    if (rs) {
      rs.value = String(_days);
      rs.addEventListener('change', (e) => { _days = parseInt(e.target.value, 10) || 30; render(_days); });
    }
    const eb = document.getElementById('exportBtn');
    if (eb) eb.addEventListener('click', () => exportCsv(_days));
    render(_days);
  },
  render: render,
};
})();
