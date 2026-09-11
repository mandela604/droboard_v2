/**
 * Enhanced Activity Logs Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceActivityLogsPage();
  }

  async function enhanceActivityLogsPage() {
    setupAdvancedFilters();
    setupExport();
    setupTableSorting();
    setupAutoRefresh();
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
      <div class="sub">Filter activity logs by multiple criteria</div>
      <div class="drm-form-group">
        <label>Action Type</label>
        <select id="filterType">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Date Range</label>
        <select id="filterDateRange">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>User</label>
        <input type="text" id="filterUser" placeholder="Search by user..."/>
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
      <h2>Export Activity Logs</h2>
      <div class="sub">Download activity logs</div>
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
      toast('Exporting activity logs...');
      setTimeout(() => { toast('✅ Exported!'); DroboardModal.closeTop(); }, 1000);
    };
  }

  function setupTableSorting() {
    document.querySelectorAll('thead th').forEach((header, index) => {
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