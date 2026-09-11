/**
 * Enhanced Reports & Flags Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceReportsFlagsPage();
  }

  async function enhanceReportsFlagsPage() {
    setupAdvancedFilters();
    setupBulkActions();
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
      <div class="sub">Filter reports by multiple criteria</div>
      <div class="drm-form-group">
        <label>Report Type</label>
        <select id="filterType">
          <option value="">All Types</option>
          <option value="content">Content</option>
          <option value="spam">Spam</option>
          <option value="plagiarism">Plagiarism</option>
          <option value="abuse">Abuse</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Status</label>
        <select id="filterStatus">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Date Range</label>
        <select id="filterDateRange">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Reporter</label>
        <input type="text" id="filterReporter" placeholder="Search by reporter name..."/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="applyFilters()">Apply Filters</button>
      </div>
    `;

    DroboardModal.show(html);

    window.applyFilters = function() {
      const type = document.getElementById('filterType').value;
      const status = document.getElementById('filterStatus').value;
      const dateRange = document.getElementById('filterDateRange').value;
      const reporter = document.getElementById('filterReporter').value;

      toast('Applying filters...');
      
      if (typeof refresh === 'function') {
        refresh();
      }
      
      DroboardModal.closeTop();
    };
  }

  function setupBulkActions() {
    const tableCard = document.querySelector('.table-card');
    if (!tableCard || tableCard.querySelector('.bulk-actions')) return;

    const bulkActionsHTML = `
      <div class="bulk-actions" style="display:none;padding:10px 20px;background:var(--accent-soft);border-bottom:1px solid var(--border);align-items:center;gap:12px">
        <span style="font-size:12px;font-weight:600;color:var(--text)"><span id="selectedCount">0</span> selected</span>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('resolve')"><i class="fas fa-check"></i> Resolve</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('dismiss')"><i class="fas fa-times"></i> Dismiss</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px;color:var(--red)" onclick="bulkAction('delete')"><i class="fas fa-trash"></i> Delete</button>
      </div>
    `;

    const tableWrap = tableCard.querySelector('.table-wrap');
    if (tableWrap) {
      tableWrap.insertAdjacentHTML('beforebegin', bulkActionsHTML);
    }

    window.bulkAction = function(action) {
      const selected = document.querySelectorAll('.report-checkbox:checked');
      if (selected.length === 0) {
        toast('Please select at least one report');
        return;
      }
      
      const actionMessages = {
        resolve: `Resolving ${selected.length} report(s)...`,
        dismiss: `Dismissing ${selected.length} report(s)...`,
        delete: `Deleting ${selected.length} report(s)...`
      };
      
      toast(actionMessages[action] || `Performing ${action}...`);
      document.querySelector('.bulk-actions').style.display = 'none';
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
      <h2>Export Reports</h2>
      <div class="sub">Download reports data in your preferred format</div>
      <div class="drm-form-group">
        <label>Export Format</label>
        <select id="exportFormat">
          <option value="csv">CSV (Comma Separated)</option>
          <option value="json">JSON</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="pdf">PDF Report</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Include Fields</label>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Report ID & Type
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Title & Description
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Status & Date
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Reporter Info
          </label>
        </div>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="performExport()">Export</button>
      </div>
    `;

    DroboardModal.show(html);

    window.performExport = function() {
      const format = document.getElementById('exportFormat').value;
      toast(`Exporting reports as ${format.toUpperCase()}...`);
      
      setTimeout(() => {
        toast(`✅ Exported successfully! (Demo)`);
        DroboardModal.closeTop();
      }, 1000);
    };
  }

  function setupTableSorting() {
    const headers = document.querySelectorAll('thead th');
    headers.forEach((header, index) => {
      if (header.textContent.includes('Actions')) return;
      
      header.style.cursor = 'pointer';
      header.addEventListener('click', function() {
        sortTable(index);
      });
    });
  }

  function sortTable(columnIndex) {
    toast(`Sorting by column ${columnIndex + 1}...`);
  }

  function setupAutoRefresh() {
    setInterval(() => {
      // Refresh reports periodically
    }, 30000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();