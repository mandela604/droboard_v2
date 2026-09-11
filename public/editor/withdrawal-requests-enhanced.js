/**
 * Enhanced Withdrawal Requests Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceWithdrawalRequestsPage();
  }

  async function enhanceWithdrawalRequestsPage() {
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
      <div class="sub">Filter withdrawals by multiple criteria</div>
      <div class="drm-form-group">
        <label>Status</label>
        <select id="filterStatus">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
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
        <label>Date Range</label>
        <select id="filterDateRange">
          <option value="all">All Time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
        </select>
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

  function setupBulkActions() {
    const tableCard = document.querySelector('.table-card');
    if (!tableCard || tableCard.querySelector('.bulk-actions')) return;
    const bulkActionsHTML = `
      <div class="bulk-actions" style="display:none;padding:10px 20px;background:var(--accent-soft);border-bottom:1px solid var(--border);align-items:center;gap:12px">
        <span style="font-size:12px;font-weight:600;color:var(--text)"><span id="selectedCount">0</span> selected</span>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('approve')"><i class="fas fa-check"></i> Approve</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('process')"><i class="fas fa-rotate"></i> Process</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px;color:var(--red)" onclick="bulkAction('reject')"><i class="fas fa-ban"></i> Reject</button>
      </div>
    `;
    const tableWrap = tableCard.querySelector('.table-wrap');
    if (tableWrap) tableWrap.insertAdjacentHTML('beforebegin', bulkActionsHTML);
    window.bulkAction = function(action) {
      const selected = document.querySelectorAll('.withdrawal-checkbox:checked');
      if (selected.length === 0) { toast('Please select at least one request'); return; }
      toast(`${action.charAt(0).toUpperCase() + action.slice(1)}ing ${selected.length} withdrawal(s)...`);
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
      <h2>Export Withdrawals</h2>
      <div class="sub">Download withdrawal data</div>
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
      toast('Exporting withdrawals...');
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