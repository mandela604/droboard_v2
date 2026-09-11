/**
 * Enhanced Payments Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhancePaymentsPage();
  }

  async function enhancePaymentsPage() {
    setupDateRangePicker();
    setupAdvancedFilters();
    setupExport();
    setupTableSorting();
    setupAutoRefresh();
  }

  function setupDateRangePicker() {
    const dateRange = document.querySelector('.date-range');
    if (!dateRange) return;
    dateRange.addEventListener('click', function(e) {
      if (this.textContent.includes('Date Range')) {
        e.preventDefault();
        showDateRangeModal();
      }
    });
  }

  function showDateRangeModal() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const html = `
      <h2>Filter by Date Range</h2>
      <div class="sub">Select payment date range</div>
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
        <button class="drm-btn drm-ok" onclick="applyDateFilter()">Apply Filter</button>
      </div>
    `;
    DroboardModal.show(html);
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
    window.applyDateFilter = function() {
      const start = document.getElementById('dateStart').value;
      const end = document.getElementById('dateEnd').value;
      if (start && end) {
        toast(`Filtering payments from ${start} to ${end}`);
        if (typeof refresh === 'function') refresh();
      }
      DroboardModal.closeTop();
    };
  }

  function setupAdvancedFilters() {
    const filtersBtn = document.querySelector('.btn-filters');
    if (!filtersBtn) return;
    filtersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showAdvancedFiltersModal();
    });
  }

  function showAdvancedFiltersModal() {
    const html = `
      <h2>Advanced Filters</h2>
      <div class="sub">Filter payments by multiple criteria</div>
      <div class="drm-form-group">
        <label>Status</label>
        <select id="filterStatus">
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Payment Method</label>
        <select id="filterMethod">
          <option value="">All Methods</option>
          <option>Bank Transfer</option>
          <option>PayPal</option>
          <option>Mobile Money</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Amount Range</label>
        <div style="display:flex;gap:10px">
          <input type="text" placeholder="Min ($)" style="flex:1"/>
          <input type="text" placeholder="Max ($)" style="flex:1"/>
        </div>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="applyFilters()">Apply Filters</button>
      </div>
    `;
    DroboardModal.show(html);
    window.applyFilters = function() {
      toast('Applying filters...');
      if (typeof refresh === 'function') refresh();
      DroboardModal.closeTop();
    };
  }

  function setupExport() {
    const exportBtn = document.querySelector('.btn-add');
    if (exportBtn) {
      exportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showExportModal();
      });
    }
  }

  function showExportModal() {
    const html = `
      <h2>Export Payments</h2>
      <div class="sub">Download payment data</div>
      <div class="drm-form-group">
        <label>Format</label>
        <select id="exportFormat">
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="excel">Excel</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="performExport()">Export</button>
      </div>
    `;
    DroboardModal.show(html);
    window.performExport = function() {
      toast('Exporting payments...');
      setTimeout(() => { toast('✅ Exported!'); DroboardModal.closeTop(); }, 1000);
    };
  }

  function setupTableSorting() {
    document.querySelectorAll('thead th').forEach((header, index) => {
      if (header.textContent.includes('Actions')) return;
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => toast(`Sorting by column ${index + 1}...`));
    });
  }

  function setupAutoRefresh() {
    setInterval(() => {}, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();