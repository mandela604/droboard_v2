/**
 * traffic-page-service.js — App-wide Traffic & Activity controller (Marketing).
 * Live API only, no demo fallbacks.
 */
(function () {
  'use strict';

  const API_BASE = '/api/analytics/traffic';

  let pageQuery = '';

  MarketingSidebar.attach('#trafficRoot', {
    activeItem: 'traffic',
    title: 'Traffic & Activity',
    subtitle: 'App-wide visits, live users & busiest periods',
    user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
    notifCount: 5,
    searchPlaceholder: 'Search pages…',
    onSearch: function (v) { pageQuery = (v || '').trim().toLowerCase(); loadData(); },
  });

  function showError(msg) {
    const el = document.getElementById('statCards');
    if(el) el.innerHTML = `<div class="error-state"><i class="fas fa-circle-exclamation"></i> ${msg}</div>`;
    
    const chartEl = document.getElementById('hourlyChart');
    if(chartEl) chartEl.innerHTML = `<div style="text-align:center;color:var(--red);padding:40px">${msg}</div>`;
    
    const tableEl = document.getElementById('pagesTableBody');
    if(tableEl) tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:40px">${msg}</td></tr>`;
  }

  function showLoading() {
    const el = document.getElementById('statCards');
    if(el) el.innerHTML = `<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading traffic data...</div>`;
  }

  async function callApi(path, opts) {
    try {
      const res = await fetch(API_BASE + path, { credentials:'include', ...opts });
      if(!res.ok) throw new Error(`API error ${res.status}`);
      return await res.json();
    } catch(e) {
      console.error('Traffic API error:', e);
      throw e;
    }
  }

  async function loadData() {
    showLoading();
    
    try {
      const data = await callApi('?range=24h');
      renderStats(data);
      renderHourlyChart(data.hourly || []);
      renderDailyChart(data.daily || []);
      renderPages(data.pages || []);
      renderOnline(data.online || {});
    } catch(e) {
      showError('Failed to load traffic data: ' + e.message);
    }
  }

  function renderStats(data) {
    const el = document.getElementById('statCards');
    if(!el) return;
    
    const stats = [
      { value: fmtNum(data.visitsToday || 0), label:'Visits Today', icon:'fa-eye', color:'blue' },
      { value: fmtNum(data.uniquesToday || 0), label:'Unique Visitors', icon:'fa-user-group', color:'green' },
      { value: (data.avgSessionMin || 0).toFixed(1), label:'Avg Session (min)', icon:'fa-clock', color:'purple' },
      { value: fmtNum(data.online?.total || 0), label:'Live Users Now', icon:'fa-signal', color:'amber' },
      { value: fmtNum(data.pageViews || 0), label:'Page Views Today', icon:'fa-file', color:'red' },
      { value: (data.bounceRate || 0).toFixed(1) + '%', label:'Bounce Rate', icon:'fa-right-from-bracket', color:'pink' },
    ];
    
    el.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-ico ${s.color}"><i class="fas ${s.icon}"></i></div>
        <div class="stat-num">${s.value}</div>
        <div class="stat-lbl">${s.label}</div>
      </div>
    `).join('');
  }

  function renderHourlyChart(hourlyData) {
    const el = document.getElementById('hourlyChart');
    if(!el) return;
    
    if(!hourlyData || !hourlyData.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:40px">No hourly data available</div>';
      return;
    }
    
    const max = Math.max(...hourlyData.map(h => h.sessions || 0));
    const peakIdx = hourlyData.findIndex(h => h.sessions === max);
    
    el.innerHTML = hourlyData.map((h, i) => {
      const hour = h.hour || i;
      const sessions = h.sessions || 0;
      const percent = max > 0 ? Math.round((sessions / max) * 100) : 0;
      const isPeak = i === peakIdx;
      
      return `
        <div class="hour-cell" style="height:${percent}%" title="${fmtHour(hour)}: ${fmtNum(sessions)} sessions">
          <div class="hour-bar ${isPeak ? 'peak' : ''}"></div>
          <div class="hour-label">${fmtHour(hour)}</div>
        </div>
      `;
    }).join('');
  }

  function renderDailyChart(dailyData) {
    const el = document.getElementById('dailyChart');
    if(!el) return;
    
    if(!dailyData || !dailyData.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:40px">No daily data available</div>';
      return;
    }
    
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    el.innerHTML = days.map((day, i) => {
      const data = dailyData[i] || { day, visits: 0 };
      const visits = data.visits || 0;
      const max = Math.max(...dailyData.map(d => d.visits || 0));
      const percent = max > 0 ? Math.round((visits / max) * 100) : 0;
      
      return `
        <div class="day-cell">
          <div class="day-bar" style="height:${percent}%"></div>
          <div class="day-label">${day}</div>
          <div class="day-value">${fmtNum(visits)}</div>
        </div>
      `;
    }).join('');
  }

  function renderPages(pagesData) {
    const el = document.getElementById('pagesTableBody');
    if(!el) return;
    
    if(!pagesData || !pagesData.length) {
      el.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:40px">No page data available</td></tr>';
      return;
    }
    
    const filtered = pageQuery 
      ? pagesData.filter(p => 
          (p.page || '').toLowerCase().includes(pageQuery) ||
          (p.path || '').toLowerCase().includes(pageQuery)
        )
      : pagesData;
    
    el.innerHTML = filtered.map(p => `
      <tr>
        <td><div class="page-cell"><i class="fas ${p.icon || 'fa-file'}"></i><span>${p.page || 'Unknown'}</span></div></td>
        <td>${fmtNum(p.visits || 0)}</td>
        <td>${fmtNum(p.uniques || 0)}</td>
        <td>${(p.avgMin || 0).toFixed(1)}</td>
        <td>${(p.bounce || 0)}%</td>
        <td><span class="badge ${p.live ? 'green' : 'faint'}">${p.live ? 'Active' : 'Archive'}</span></td>
      </tr>
    `).join('');
  }

  function renderOnline(onlineData) {
    const el = document.getElementById('onlineNow');
    if(!el) return;
    
    el.innerHTML = `
      <div class="online-card">
        <div class="online-header">
          <i class="fas fa-users"></i>
          <span>Live Users</span>
        </div>
        <div class="online-count">${fmtNum(onlineData.total || 0)}</div>
        <div class="online-breakdown">
          <div><span class="dot blue"></span> Readers ${onlineData.readers || 0}</div>
          <div><span class="dot green"></span> Browsers ${onlineData.browsers || 0}</div>
          <div><span class="dot purple"></span> Posters ${onlineData.posters || 0}</div>
          <div><span class="dot amber"></span> Guests ${onlineData.guests || 0}</div>
        </div>
      </div>
    `;
  }

  function fmtHour(h) {
    h = Number(h) || 0;
    h = ((h % 24) + 24) % 24;
    return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm');
  }

  function fmtNum(n) {
    n = Number(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  // Initialize
  loadData();

})();