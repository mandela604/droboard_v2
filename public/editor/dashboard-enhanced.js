/**
 * Enhanced Editor Dashboard with Full Interactivity
 * Adds demo data, filters, charts, and interactive elements
 */

(function() {
  'use strict';

  // Wait for DOM and DroboardShell to be ready
  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceDashboard();
  }

  async function enhanceDashboard() {
    // Update stat cards with dynamic values
    updateStatCards();
    
    // Render activity list with demo data
    renderActivities();
    
    // Render pending reviews
    renderPendingReviews();
    
    // Make date range picker functional
    setupDateRangePicker();
    
    // Add chart to dashboard
    renderEarningsChart();
    
    // Setup refresh on filter changes
    setupAutoRefresh();
  }

  // Demo data generators
  function generateDemoStats() {
    const stats = {
      pendingReviews: Math.floor(Math.random() * 20) + 5,
      signedThisMonth: Math.floor(Math.random() * 30) + 10,
      activeContracts: Math.floor(Math.random() * 50) + 20,
      activeAuthors: Math.floor(Math.random() * 100) + 50,
      reviewsThisMonth: Math.floor(Math.random() * 500) + 100,
      signRate: Math.floor(Math.random() * 30) + 60 + '%',
      signedStories: Math.floor(Math.random() * 100) + 20,
      totalBooks: Math.floor(Math.random() * 5000) + 1000,
      publishedBooks: Math.floor(Math.random() * 3000) + 500,
      draftBooks: Math.floor(Math.random() * 200) + 50,
      flaggedBooks: Math.floor(Math.random() * 50) + 10,
      totalViews: (Math.random() * 10 + 5).toFixed(1) + 'M'
    };
    return stats;
  }

  function updateStatCards() {
    const stats = generateDemoStats();
    
    // Update welcome banner stats
    const welcomeStats = {
      reviews: stats.reviewsThisMonth,
      signRate: stats.signRate,
      signed: stats.signedStories
    };
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
      statCards[0].querySelector('.stat-value').textContent = stats.pendingReviews;
      statCards[1].querySelector('.stat-value').textContent = stats.signedThisMonth;
      statCards[2].querySelector('.stat-value').textContent = stats.activeContracts;
      statCards[3].querySelector('.stat-value').textContent = stats.activeAuthors;
    }
  }

  function renderActivities() {
    const activities = [
      { icon: 'accent', emoji: '📝', text: '<strong>Ifeanyi_Story</strong> signed a contract for <span class="highlight">Runaway Bride</span>', time: '2h ago', unread: true },
      { icon: 'green', emoji: '✅', text: '<strong>Chiamaka_N</strong> story approved — <span class="highlight">Grandmother\'s Will</span>', time: '4h ago', unread: true },
      { icon: 'yellow', emoji: '💰', text: 'Revenue share of <strong>₦4,200</strong> credited from Ada_Writes reads', time: '5h ago', unread: true },
      { icon: 'blue', emoji: '📚', text: '<strong>Dami_Cole</strong> submitted new story: <span class="highlight">"She Rejected Me 3 Times"</span>', time: '7h ago', unread: false },
      { icon: 'accent', emoji: '📧', text: '<strong>Kemi_A</strong> opened contract email for <span class="highlight">"He Deleted Our Photos"</span>', time: '1d ago', unread: false },
      { icon: 'green', emoji: '🛡️', text: 'Admin <strong>co-signed</strong> premium contract for <span class="highlight">Chiamaka_N</span>', time: '1d ago', unread: false },
    ];

    const list = document.getElementById('activityList');
    if (!list) return;

    list.innerHTML = activities.map(a => `
      <div class="activity-row" onclick="toast('Opening activity…')">
        <div class="activity-icon ${a.icon}">${a.emoji}</div>
        <div class="activity-content">
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${a.time}</div>
        </div>
        ${a.unread ? '<div class="activity-dot"></div>' : ''}
      </div>
    `).join('');
  }

  function renderPendingReviews() {
    const pending = [
      { title: "The Ruthless CEO", writer: "Ava Winters", time: "2h ago", reads: "12.4k", status: "pending", cover: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
      { title: "Bound by the Alpha", writer: "Luna Skye", time: "4h ago", reads: "8.1k", status: "reviewing", cover: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
      { title: "His Hidden Luna", writer: "Lyra Night", time: "3h ago", reads: "45k", status: "pending", cover: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
      { title: "Reborn to Revenge", writer: "Mia Carter", time: "6h ago", reads: "4.2k", status: "reviewing", cover: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
      { title: "Claimed by the Mafia", writer: "Bella King", time: "1d ago", reads: "7.2k", status: "pending", cover: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
      { title: "The Vampire's Obsession", writer: "Ethan Vale", time: "1d ago", reads: "1.2k", status: "pending", cover: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)" },
      { title: "Broken Vows", writer: "Sophie Lane", time: "1d ago", reads: "2.5k", status: "reviewing", cover: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)" },
      { title: "Prince's Secret Wife", writer: "Isabella Rose", time: "2d ago", reads: "9.8k", status: "pending", cover: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)" },
    ];

    const list = document.getElementById('pendingList');
    if (!list) return;

    const statusLabels = { pending: 'Pending', reviewing: 'In Review', approved: 'Approved' };
    document.getElementById('pendingCount').textContent = pending.length;

    list.innerHTML = pending.slice(0, 6).map(r => `
      <div class="pending-row" onclick="location.href='book-review-center.html'">
        <div class="pending-cover" style="background:${r.cover}"><i class="fas fa-book" style="color:rgba(255,255,255,.7);font-size:14px"></i></div>
        <div class="pending-info">
          <div class="pending-title">${r.title}</div>
          <div class="pending-meta">
            <span>@${r.writer}</span>
            <span>·</span>
            <span>${r.time}</span>
            <span>·</span>
            <span>${r.reads} reads</span>
          </div>
        </div>
        <div class="pending-right">
          <span class="pending-status ${r.status}">${statusLabels[r.status]}</span>
        </div>
      </div>
    `).join('');
  }

  function setupDateRangePicker() {
    const dateBtn = document.querySelector('.date-btn');
    if (!dateBtn) return;

    dateBtn.addEventListener('click', function() {
      showDateRangeModal();
    });
  }

  function showDateRangeModal() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const html = `
      <h2>Select Date Range</h2>
      <div class="sub">Filter dashboard data by date range</div>
      <div class="drm-form-group">
        <label>Start Date</label>
        <input type="date" id="dateStart" value="${lastMonth.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-group">
        <label>End Date</label>
        <input type="date" id="dateEnd" value="${today.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-group">
        <label>Quick Select</label>
        <select id="quickRange" onchange="applyQuickRange(this.value)">
          <option value="">Custom Range</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month" selected>This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="applyDateRange()">Apply Filter</button>
      </div>
    `;

    DroboardModal.show(html);

    // Make quick range functional
    window.applyQuickRange = function(value) {
      const start = document.getElementById('dateStart');
      const end = document.getElementById('dateEnd');
      const today = new Date();
      
      switch(value) {
        case 'today':
          start.value = end.value = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
          start.value = weekStart.toISOString().split('T')[0];
          end.value = today.toISOString().split('T')[0];
          break;
        case 'month':
          start.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
          end.value = today.toISOString().split('T')[0];
          break;
        case 'quarter':
          const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
          start.value = quarterStart.toISOString().split('T')[0];
          end.value = today.toISOString().split('T')[0];
          break;
        case 'year':
          start.value = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
          end.value = today.toISOString().split('T')[0];
          break;
      }
    };

    window.applyDateRange = function() {
      const start = document.getElementById('dateStart').value;
      const end = document.getElementById('dateEnd').value;
      if (start && end) {
        toast(`Filtering data from ${start} to ${end}`);
        // Here you would typically make an API call with these dates
        refreshDashboardWithDates(start, end);
      }
      DroboardModal.closeTop();
    };
  }

  function refreshDashboardWithDates(start, end) {
    // Simulate data refresh with new date range
    updateStatCards();
    renderActivities();
    renderPendingReviews();
    toast('Dashboard updated with selected date range');
  }

  function renderEarningsChart() {
    // Find or create chart container
    let chartContainer = document.getElementById('earningsChart');
    if (!chartContainer) {
      // Create a chart panel below the welcome banner
      const welcomeBanner = document.querySelector('.welcome-banner');
      if (welcomeBanner) {
        const chartHTML = `
          <div class="panel" style="margin-bottom:22px">
            <div class="panel-hdr">
              <div class="panel-title"><i class="fas fa-chart-line" style="color:var(--accent);font-size:12px"></i> Earnings Trend</div>
              <div class="panel-link" onclick="toast('Opening detailed analytics…')">View Details <i class="fas fa-arrow-right" style="font-size:9px"></i></div>
            </div>
            <div class="bar-chart" id="earningsChart" style="height:200px;padding:20px"></div>
          </div>
        `;
        welcomeBanner.insertAdjacentHTML('afterend', chartHTML);
      }
    }

    chartContainer = document.getElementById('earningsChart');
    if (!chartContainer) return;

    // Generate demo earnings data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const earnings = months.map(() => Math.floor(Math.random() * 50000) + 20000);
    const max = Math.max(...earnings);

    chartContainer.innerHTML = earnings.map((val, i) => {
      const height = (val / max) * 160;
      return `
        <div class="bar" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted)">$${(val/1000).toFixed(1)}k</div>
          <div class="bar-fill" style="width:100%;background:linear-gradient(180deg, var(--accent) 0%, var(--accent-2) 100%);border-radius:6px 6px 0 0;height:${height}px;min-height:6px;transition:.3s"></div>
          <div class="bar-lbl" style="font-size:10px;font-weight:700;color:var(--text-faint);margin-top:6px">${months[i]}</div>
        </div>
      `;
    }).join('');
  }

  function setupAutoRefresh() {
    // Auto-refresh dashboard data every 30 seconds
    setInterval(() => {
      updateStatCards();
    }, 30000);

    // Add refresh button functionality
    const refreshBtn = document.querySelector('[onclick*="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        updateStatCards();
        renderActivities();
        renderPendingReviews();
        toast('Dashboard refreshed');
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();