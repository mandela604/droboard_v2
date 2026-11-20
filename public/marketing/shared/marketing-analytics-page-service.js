/**
 * marketing-analytics-page-service.js — Marketing Analytics page logic.
 * Live API only. Every number comes from the ad-performance, acquisition and
 * campaign endpoints — no demo figures, no fabricated placements.
 */
(function(){
'use strict';

let _days = 30;
let _q = '';

MarketingSidebar.attach('#anRoot', {
  activeItem: 'marketing-analytics',
  title: 'Marketing Analytics',
  subtitle: 'Full performance report',
  searchPlaceholder: 'Search placements & campaigns…',
  onSearch: (v) => { _q = (v || '').trim().toLowerCase(); loadData(); },
});

function showError(msg) {
  const el = document.getElementById('statCards');
  if (el) el.innerHTML = `<div class="error-state"><i class="fas fa-circle-exclamation"></i> ${esc(msg)}</div>`;
  const tableEl = document.getElementById('placementBody');
  if (tableEl) tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:40px">${esc(msg)}</td></tr>`;
}
function showLoading() {
  const el = document.getElementById('statCards');
  if (el) el.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading data...</div>`;
}
async function api(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error('API error ' + res.status);
  return await res.json();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

async function loadData() {
  showLoading();
  try {
    const [perf, acq, campaigns] = await Promise.all([
      api('/api/ads/performance?days=' + _days),
      api('/api/acquisition/summary?days=' + _days),
      api('/api/marketing/campaigns'),
    ]);
    renderStats(perf.totals || {}, acq.totals || {});
    renderPlacements(perf.slots || []);
    renderTopCampaigns(Array.isArray(campaigns) ? campaigns : []);
  } catch (e) {
    console.error('Marketing analytics API error:', e);
    showError('Failed to load marketing data: ' + e.message);
  }
}

function renderStats(ad, spend) {
  const el = document.getElementById('statCards');
  if (!el) return;
  const stats = [
    { value: fmtNum(ad.impressions || 0), label: 'Impressions', icon: 'fa-eye', color: 'blue' },
    { value: fmtNum(ad.clicks || 0), label: 'Clicks', icon: 'fa-hand-pointer', color: 'green' },
    { value: round1(ad.ctr || 0) + '%', label: 'CTR', icon: 'fa-bullseye', color: 'purple' },
    { value: fmtNum(ad.conversions || 0), label: 'Conversions', icon: 'fa-arrow-turn-down', color: 'amber' },
    { value: fmtNum(spend.spend || 0), label: 'Spend', icon: 'fa-sack-dollar', color: 'red' },
    { value: fmtNum(ad.uniqueViewers || 0), label: 'Unique viewers', icon: 'fa-users', color: 'pink' },
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico ${s.color}"><i class="fas ${s.icon}"></i></div>
      <div class="stat-num">${s.value}</div>
      <div class="stat-lbl">${s.label}</div>
    </div>`).join('');
}

function renderPlacements(rows) {
  const el = document.getElementById('placementBody');
  if (!el) return;
  const list = rows.filter(p => !_q || String(p.page || p.slot || p.adId || '').toLowerCase().indexOf(_q) !== -1);
  if (!list.length) {
    el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:40px">No placement data available</td></tr>';
    return;
  }
  el.innerHTML = list.map(p => `
    <tr>
      <td><div class="placement-cell"><i class="fas fa-rectangle-ad"></i><span>${esc(p.page || p.slot || p.adId || 'Placement')}</span></div></td>
      <td>${fmtNum(p.impressions || 0)}</td>
      <td>${round1(p.ctr || 0)}%</td>
      <td>${fmtNum(p.conversions || 0)}</td>
      <td>${round1(p.viewabilityRate || 0)}%</td>
      <td><span class="badge green">Live</span></td>
    </tr>`).join('');
}

function renderTopCampaigns(list) {
  const el = document.getElementById('topCampaignsList');
  if (!el) return;
  const rows = list.filter(c => !_q || String(c.name || '').toLowerCase().indexOf(_q) !== -1);
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No campaign data available</div>';
    return;
  }
  el.innerHTML = rows.slice(0, 5).map(c => `
    <div class="campaign-card">
      <div class="campaign-header">
        <div class="campaign-name">${esc(c.name || 'Untitled')}</div>
        <div class="campaign-type ${esc(c.type || 'business')}">${esc(c.type || 'Business')}</div>
      </div>
      <div class="campaign-stats">
        <div><span>CTR</span><b>${round1(c.ctr || 0)}%</b></div>
        <div><span>Reach</span><b>${fmtNum(c.reach || 0)}</b></div>
        <div><span>Conversions</span><b>${fmtNum(c.conversions || 0)}</b></div>
      </div>
    </div>`).join('');
}

loadData();
})();
