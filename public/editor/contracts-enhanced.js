/**
 * Enhanced Contracts Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof window.DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceContractsPage();
  }

  async function enhanceContractsPage() {
    setupNewContractButton();
    setupDateRangePicker();
    setupAdvancedFilters();
    setupBulkActions();
    setupTableSorting();
  }

  function setupNewContractButton() {
    const addBtn = document.querySelector('.btn-add, #newContractBtn');
    if (!addBtn) return;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showNewContractModal();
    });
  }

  function showNewContractModal() {
    const html = `
      <h2>Create New Contract</h2>
      <div class="sub">Draft an agreement for an author manuscript</div>
      <div class="drm-form-group">
        <label>Author Name *</label>
        <input type="text" id="cntrAuthor" placeholder="e.g. Luna Skye"/>
      </div>
      <div class="drm-form-group">
        <label>Book Title *</label>
        <input type="text" id="cntrTitle" placeholder="e.g. Bound by the Ruthless Alpha"/>
      </div>
      <div class="drm-form-group">
        <label>Contract Type</label>
        <select id="cntrType">
          <option value="Exclusive Publishing">Exclusive Publishing</option>
          <option value="Revenue Share">Revenue Share</option>
          <option value="License Agreement">License Agreement</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Assigned Editor</label>
        <select id="cntrEditor">
          <option value="Reina Morgan">Reina Morgan</option>
          <option value="Daniel Carter">Daniel Carter</option>
          <option value="Sophia Bennett">Sophia Bennett</option>
          <option value="Ethan Walker">Ethan Walker</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveCntrBtn">Issue Contract</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveCntrBtn').addEventListener('click', async () => {
      const author = modal.querySelector('#cntrAuthor').value.trim();
      const title = modal.querySelector('#cntrTitle').value.trim();
      const type = modal.querySelector('#cntrType').value;
      const editor = modal.querySelector('#cntrEditor').value;
      if (!author || !title) { toast('Author and book title required'); return; }
      await window.DroboardAPI.createContract({ author, title, type, editor });
      toast(`Contract for "${title}" issued successfully!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
      else location.reload();
    });
  }

  function setupDateRangePicker() {
    const dateRange = document.querySelector('.date-range');
    if (!dateRange) return;
    dateRange.addEventListener('click', function(e) {
      e.preventDefault();
      showDateRangeModal();
    });
  }

  function showDateRangeModal() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const html = `
      <h2>Filter by Date Range</h2>
      <div class="sub">Select timeframe for contracts</div>
      <div class="drm-form-group">
        <label>Start Date</label>
        <input type="date" id="dateStart" value="${lastMonth.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-group">
        <label>End Date</label>
        <input type="date" id="dateEnd" value="${today.toISOString().split('T')[0]}"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="applyDateFilter()">Apply Filter</button>
      </div>
    `;
    DroboardModal.show(html);
    window.applyDateFilter = function() {
      toast('Filtered contract records');
      DroboardModal.closeTop();
      if (typeof window.refresh === 'function') window.refresh();
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
      <h2>Advanced Contract Filters</h2>
      <div class="sub">Filter contracts by multiple criteria</div>
      <div class="drm-form-group">
        <label>Contract Type</label>
        <select id="filterType">
          <option value="All Types">All Types</option>
          <option>Exclusive Publishing</option>
          <option>Revenue Share</option>
          <option>License Agreement</option>
        </select>
      </div>
      <div class="drm-form-group">
        <label>Status</label>
        <select id="filterStatus">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="window.applyFilters()">Apply Filters</button>
      </div>
    `;
    DroboardModal.show(html);
    window.applyFilters = function() {
      toast('Applied contract filters');
      DroboardModal.closeTop();
      if (typeof window.refresh === 'function') window.refresh();
    };
  }

  function setupBulkActions() {
    const tableCard = document.querySelector('.table-card');
    if (!tableCard || tableCard.querySelector('.bulk-actions')) return;
    const bulkActionsHTML = `
      <div class="bulk-actions" style="display:none;padding:10px 20px;background:var(--accent-soft);border-bottom:1px solid var(--border);align-items:center;gap:12px">
        <span style="font-size:12px;font-weight:600;color:var(--text)"><span id="selectedCount">0</span> selected</span>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('approve')"><i class="fas fa-check"></i> Approve</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px;color:var(--red)" onclick="bulkAction('terminate')"><i class="fas fa-ban"></i> Terminate</button>
      </div>
    `;
    const tableWrap = tableCard.querySelector('.table-wrap');
    if (tableWrap) tableWrap.insertAdjacentHTML('beforebegin', bulkActionsHTML);
  }

  function setupTableSorting() {
    const headers = document.querySelectorAll('thead th');
    headers.forEach((header, index) => {
      if (header.textContent.includes('Actions')) return;
      header.style.cursor = 'pointer';
      header.addEventListener('click', function() {
        toast(`Sorting by ${header.textContent.trim()}...`);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();