/**
 * marketing-analytics-page-service.js — Marketing Analytics page logic.
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';

const API_BASE = '/api/marketing/analytics';

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
    loadData();
  },
});

function showError(msg) {
  const el = document.getElementById('statCards');
  if(el) el.innerHTML = `<div class="error-state"><i class="fas fa-circle-exclamation"></i> ${msg}</div>`;
  
  const tableEl = document.getElementById('placementBody');
  if(tableEl) tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:40px">${msg}</td></tr>`;
}

function showLoading() {
  const el = document.getElementById('statCards');
  if(el) el.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading data...</div>`;
}

async function callApi(path, opts) {
  try {
    const res = await fetch(API_BASE + path, { credentials:'include', ...opts });
    if(!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch(e) {
    console.error('Marketing analytics API error:', e);
    throw e;
  }
}

async function loadData() {
  showLoading();
  
  try {
    const [summary, placements, campaigns] = await Promise.all([
      callApi(`/summary?days=${_days}`),
      callApi(`/placements?days=${_days}`),
      callApi(`/campaigns?days=${_days}`)
    ]);
    
    renderStats(summary);
    renderPlacementPerformance(placements);
    renderTopCampaigns(campaigns);
    renderCharts(summary);
  } catch(e) {
    showError('Failed to load marketing data: ' + e.message);
  }
}

function renderStats(summary) {
  const el = document.getElementById('statCards');
  if(!el) return;
  
  const stats = [
    { value: fmtNum(summary.impressions || 0), label:'Impressions', icon:'fa-eye', color:'blue' },
    { value: fmtNum(summary.clicks || 0), label:'Clicks', icon:'fa-hand-pointer', color:'green' },
    { value: round1(summary.ctr || 0) + '%', label:'CTR', icon:'fa-bullseye', color:'purple' },
    { value: fmtNum(summary.conversions || 0), label:'Conversions', icon:'fa-arrow-turn-down', color:'amber' },
    { value: '$' + fmtNum(summary.spend || 0), label:'Spend', icon:'fa-sack-dollar', color:'red' },
    { value: '$' + fmtNum(summary.roi || 0), label:'Est. ROI', icon:'fa-chart-line', color:'green' },
  ];
  
  el.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico ${s.color}"><i class="fas ${s.icon}"></i></div>
      <div class="stat-num">${s.value}</div>
      <div class="stat-lbl">${s.label}</div>
    </div>
  `).join('');
}

function renderPlacementPerformance(placements) {
  const el = document.getElementById('placementBody');
  if(!el) return;
  
  if(!placements || !placements.length) {
    el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:40px">No placement data available</td></tr>';
    return;
  }
  
  el.innerHTML = placements.map(p => `
    <tr>
      <td><div class="placement-cell"><i class="fas ${p.icon || 'fa-rectangle-ad'}"></i><span>${p.label || p.id}</span></div></td>
      <td>${fmtNum(p.impressions || 0)}</td>
      <td>${round1(p.ctr || 0)}%</td>
      <td>${fmtNum(p.conversions || 0)}</td>
      <td>${round1(p.viewabilityRate || 0)}%</td>
      <td>${p.live ? '<span class="badge green">Live</span>' : '<span class="badge faint">Paused</span>'}</td>
    </tr>
  `).join('');
}

function renderTopCampaigns(campaigns) {
  const el = document.getElementById('topCampaignsList');
  if(!el) return;
  
  if(!campaigns || !campaigns.length) {
    el.innerHTML = '<div class="empty-state">No campaign data available</div>';
    return;
  }
  
  el.innerHTML = campaigns.slice(0, 5).map(c => `
    <div class="campaign-card">
      <div class="campaign-header">
        <div class="campaign-name">${c.name}</div>
        <div class="campaign-type ${c.type || 'business'}">${c.type || 'Business'}</div>
      </div>
      <div class="campaign-stats">
        <div><span>CTR</span><b>${round1(c.ctr || 0)}%</b></div>
        <div><span>Reach</span><b>${fmtNum(c.reach || 0)}</b></div>
        <div><span>Conversions</span><b>${fmtNum(c.conversions || 0)}</b></div>
      </div>
    </div>
  `).join('');
}

function renderCharts(summary) {
  // Charts would be implemented here with chart.js
  // Since backend should provide time-series data
  console.log('Render charts with summary data:', summary);
}

function fmtNum(n) {
  n = Number(n || 0);
  if(n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

// Initialize
loadData();

})();