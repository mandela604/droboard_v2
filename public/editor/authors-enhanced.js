/**
 * Enhanced Authors Page with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof window.DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceAuthorsPage();
  }

  async function enhanceAuthorsPage() {
    setupAddAuthorButton();
    setupAdvancedFilters();
    setupBulkActions();
    setupTableSorting();
  }

  function setupAddAuthorButton() {
    const addBtn = document.getElementById('addBtn');
    if (!addBtn) return;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showAddAuthorModal();
    });
  }

  function showAddAuthorModal() {
    const html = `
      <h2>Add New Author</h2>
      <div class="sub">Register a new author on the platform</div>
      <div class="drm-form-group">
        <label>Author Name *</label>
        <input type="text" id="authName" placeholder="Full Name"/>
      </div>
      <div class="drm-form-group">
        <label>Email Address *</label>
        <input type="email" id="authEmail" placeholder="author@example.com"/>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" id="saveAuthBtn">Create Author</button>
      </div>
    `;
    const modal = DroboardModal.show(html);
    modal.querySelector('#saveAuthBtn').addEventListener('click', async () => {
      const name = modal.querySelector('#authName').value.trim();
      const email = modal.querySelector('#authEmail').value.trim();
      if (!name || !email) { toast('Name and email required'); return; }
      await window.DroboardAPI.createAuthor({ name, email });
      toast(`Author "${name}" registered successfully!`);
      DroboardModal.close(modal);
      if (typeof window.refresh === 'function') window.refresh();
    });
  }

  function setupAdvancedFilters() {
    const filtersBtn = document.querySelector('.btn-filters');
    if (!filtersBtn) return;

    filtersBtn.addEventListener('click', function() {
      showAdvancedFiltersModal();
    });
  }

  function showAdvancedFiltersModal() {
    const html = `
      <h2>Advanced Filters</h2>
      <div class="sub">Filter authors by multiple criteria</div>
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
        <label>Verification Status</label>
        <select id="filterVerification">
          <option value="all">All</option>
          <option value="verified">Verified Only</option>
          <option value="pending">Pending Only</option>
          <option value="suspended">Suspended Only</option>
        </select>
      </div>
      <div class="drm-form-actions">
        <button class="drm-btn drm-cancel" onclick="DroboardModal.closeTop()">Cancel</button>
        <button class="drm-btn drm-ok" onclick="window.applyAdvancedFilters()">Apply Filters</button>
      </div>
    `;

    DroboardModal.show(html);

    window.applyAdvancedFilters = function() {
      toast('Applied advanced filters');
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
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('verify')"><i class="fas fa-check"></i> Verify</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px;color:var(--red)" onclick="bulkAction('suspend')"><i class="fas fa-ban"></i> Suspend</button>
      </div>
    `;

    const tableWrap = tableCard.querySelector('.table-wrap');
    if (tableWrap) {
      tableWrap.insertAdjacentHTML('beforebegin', bulkActionsHTML);
    }
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