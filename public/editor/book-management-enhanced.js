/**
 * Enhanced Book Management with Full Interactivity
 */

(function() {
  'use strict';

  function init() {
    if (!document.getElementById('dashboardRoot')) return;
    if (typeof DroboardShell === 'undefined') {
      setTimeout(init, 50);
      return;
    }
    enhanceBookManagement();
  }

  async function enhanceBookManagement() {
    // Add date range picker functionality
    setupDateRangePicker();
    
    // Add category filter functionality
    setupCategoryFilters();
    
    // Add bulk actions
    setupBulkActions();
    
    // Add export functionality
    setupExport();
    
    // Add sorting to table headers
    setupTableSorting();
    
    // Auto-refresh stats
    setupAutoRefresh();
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
      <h2>Filter by Date Range</h2>
      <div class="sub">Select the date range for books</div>
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
        toast(`Filtering books from ${start} to ${end}`);
        // Update the date button text
        const dateBtn = document.querySelector('.date-btn');
        if (dateBtn) {
          const startFormatted = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endFormatted = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          dateBtn.innerHTML = `<i class="fas fa-calendar"></i> ${startFormatted} – ${endFormatted}`;
        }
        // Trigger refresh with date filter
        if (typeof refresh === 'function') {
          refresh();
        }
      }
      DroboardModal.closeTop();
    };
  }

  function setupCategoryFilters() {
    // Make category and genre filters more interactive
    const categorySelect = document.getElementById('fCategory');
    const genreSelect = document.getElementById('fGenre');
    
    if (categorySelect) {
      categorySelect.addEventListener('change', function() {
        toast(`Category filter: ${this.value}`);
        updateGenreOptions(this.value);
      });
    }
  }

  function updateGenreOptions(category) {
    const genreSelect = document.getElementById('fGenre');
    if (!genreSelect) return;

    const genreMap = {
      'All Categories': ['All Genres', 'Billionaire Romance', 'Werewolf Romance', 'Mafia Romance', 'Vampire Romance', 'Second Chance', 'Royal Romance', 'Revenge', 'Betrayal', 'Family Drama', 'Twist'],
      'Romance': ['All Genres', 'Billionaire Romance', 'Werewolf Romance', 'Mafia Romance', 'Vampire Romance', 'Second Chance', 'Royal Romance'],
      'Urban': ['All Genres', 'Revenge', 'Betrayal', 'Family Drama', 'Twist'],
      'Fantasy': ['All Genres', 'Vampire Romance', 'Magic', 'Kingdom', 'Mythical'],
      'Campus': ['All Genres', 'Campus Romance', 'Young Adult', 'Coming of Age'],
      'Revenge': ['All Genres', 'Family Drama', 'Betrayal', 'Revenge'],
      'Elegy': ['All Genres', 'Romance', 'Drama', 'Emotional']
    };

    const genres = genreMap[category] || genreMap['All Categories'];
    genreSelect.innerHTML = genres.map(g => `<option>${g}</option>`).join('');
  }

  function setupBulkActions() {
    // Add checkboxes to table for bulk actions
    const tableCard = document.querySelector('.table-card');
    if (!tableCard || tableCard.querySelector('.bulk-actions')) return;

    const bulkActionsHTML = `
      <div class="bulk-actions" style="display:none;padding:10px 20px;background:var(--accent-soft);border-bottom:1px solid var(--border);align-items:center;gap:12px">
        <span style="font-size:12px;font-weight:600;color:var(--text)"><span id="selectedCount">0</span> selected</span>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('publish')"><i class="fas fa-check"></i> Publish</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px" onclick="bulkAction('archive')"><i class="fas fa-archive"></i> Archive</button>
        <button class="btn-filters" style="padding:6px 12px;font-size:11px;color:var(--red)" onclick="bulkAction('delete')"><i class="fas fa-trash"></i> Delete</button>
      </div>
    `;

    const tableWrap = tableCard.querySelector('.table-wrap');
    if (tableWrap) {
      tableWrap.insertAdjacentHTML('beforebegin', bulkActionsHTML);
    }

    // Add checkbox selection logic
    window.bulkAction = function(action) {
      const selected = document.querySelectorAll('.book-checkbox:checked');
      if (selected.length === 0) {
        toast('Please select at least one book');
        return;
      }
      
      const actionMessages = {
        publish: `Publishing ${selected.length} book(s)...`,
        archive: `Archiving ${selected.length} book(s)...`,
        delete: `Deleting ${selected.length} book(s)...`
      };
      
      toast(actionMessages[action] || `Performing ${action}...`);
      
      // Hide bulk actions after action
      document.querySelector('.bulk-actions').style.display = 'none';
    };
  }

  function setupExport() {
    // Make export button functional
    const exportBtn = document.querySelector('.btn-add');
    if (exportBtn && exportBtn.textContent.includes('Export')) {
      exportBtn.addEventListener('click', function() {
        showExportModal();
      });
    }
  }

  function showExportModal() {
    const html = `
      <h2>Export Books</h2>
      <div class="sub">Download book data in your preferred format</div>
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
            <input type="checkbox" checked> Title & Author
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Category & Genre
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Status & Views
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
            <input type="checkbox" checked> Dates & Metadata
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
      toast(`Exporting books as ${format.toUpperCase()}...`);
      
      // Simulate export
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
    // In a real implementation, this would sort the table data
    // For demo, we just show a toast
  }

  function setupAutoRefresh() {
    // Refresh stats periodically
    setInterval(() => {
      if (typeof renderStats === 'function') {
        renderStats();
      }
    }, 30000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();