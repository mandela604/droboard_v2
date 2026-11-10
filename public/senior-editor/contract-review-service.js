/**
 * contract-review-service.js — Contract Review page logic
 * Live API only, no demo fallbacks.
 */
(function () {
  'use strict';

  const API_BASE = '/api/senior-editor/contract-applications';
  let contracts = [];
  let contractTemplates = [];
  let currentPage = 1;
  const PER_PAGE = 8;
  let activeStatus = 'all';
  let openContractId = null;

  function showError(msg) {
    const el = document.getElementById('contractTableBody');
    if(el) el.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ${msg}</td></tr>`;
  }

  function showLoading() {
    const el = document.getElementById('contractTableBody');
    if(el) el.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading contracts...</td></tr>`;
  }

  async function callApi(path, opts) {
    try {
      const res = await fetch(API_BASE + path, { credentials:'include', ...opts });
      if(!res.ok) throw new Error(`API error ${res.status}`);
      return await res.json();
    } catch(e) {
      console.error('Contract review API error:', e);
      throw e;
    }
  }

  async function loadContracts() {
    showLoading();
    try {
      const data = await callApi(`?page=${currentPage}&limit=${PER_PAGE}&status=${activeStatus}`);
      contracts = data.items || [];
      renderTable(contracts);
      renderPagination(data.total || 0);
      renderStats();
      return contracts;
    } catch(e) {
      showError('Failed to load contracts: ' + e.message);
      return [];
    }
  }

  async function loadContractTemplates() {
    try {
      const templates = await callApi('/templates');
      contractTemplates = templates || [];
      populateContractTypeFilter();
      return contractTemplates;
    } catch(e) {
      console.error('Failed to load contract templates:', e);
      return [];
    }
  }

  function renderStats() {
    const el = document.getElementById('statCards');
    if(!el) return;
    
    const pending = contracts.filter(c => c.status === 'pending').length;
    const approved = contracts.filter(c => c.status === 'approved').length;
    const signed = contracts.filter(c => c.status === 'signed').length;
    const rejected = contracts.filter(c => c.status === 'rejected').length;
    const total = contracts.length;
    
    const stats = [
      { value: total, label:'Total Contracts', icon:'fa-file-contract', color:'blue' },
      { value: pending, label:'Pending', icon:'fa-clock', color:'amber' },
      { value: approved, label:'Approved', icon:'fa-check-circle', color:'green' },
      { value: signed, label:'Signed', icon:'fa-signature', color:'purple' },
      { value: rejected, label:'Rejected', icon:'fa-ban', color:'red' },
      { value: contractTemplates.length, label:'Templates', icon:'fa-layer-group', color:'pink' },
    ];
    
    el.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-ico ${s.color}"><i class="fas ${s.icon}"></i></div>
        <div class="stat-num">${fmtNum(s.value)}</div>
        <div class="stat-lbl">${s.label}</div>
      </div>
    `).join('');
  }

  function populateContractTypeFilter() {
    const el = document.getElementById('contractTypeFilter');
    if(!el) return;
    
    el.innerHTML = '<option value="">All Types</option>' + 
      contractTemplates.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
  }

  function renderTable(contractsToShow) {
    const el = document.getElementById('contractTableBody');
    if(!el) return;
    
    if(!contractsToShow || !contractsToShow.length) {
      el.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-faint);padding:40px">No contracts found</td></tr>`;
      return;
    }
    
    el.innerHTML = contractsToShow.map(c => `
      <tr>
        <td><div class="contract-cell"><img class="author-avatar" src="${c.avatar || '../assets/droboard-icon.png'}" alt=""/><div><div class="author-name">${c.author || ''}</div><div class="book-title">${c.bookTitle || ''}</div></div></div></td>
        <td><span class="genre-chip">${c.bookGenre || ''}</span></td>
        <td>${c.chapters || 0}</td>
        <td>${c.ct || '—'}</td>
        <td>${c.term || '—'}</td>
        <td>${c.rev || '—'}</td>
        <td>${statusPillHtml(c.status || 'pending')}</td>
        <td><div class="action-buttons">
          <button class="action-btn view" title="View" data-id="${c.id}"><i class="fas fa-eye"></i></button>
          <button class="action-btn edit" title="Review" data-id="${c.id}"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" title="Delete" data-id="${c.id}"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>
    `).join('');
    
    // Add event listeners for action buttons
    el.querySelectorAll('.action-btn.view').forEach(btn => {
      btn.addEventListener('click', () => viewContract(btn.dataset.id));
    });
    el.querySelectorAll('.action-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => reviewContract(btn.dataset.id));
    });
    el.querySelectorAll('.action-btn.delete').forEach(btn => {
      btn.addEventListener('click', () => deleteContract(btn.dataset.id));
    });
  }

  function renderPagination(total) {
    const el = document.getElementById('pagination');
    if(!el) return;
    
    const totalPages = Math.ceil(total / PER_PAGE);
    if(totalPages <= 1) {
      el.innerHTML = '';
      return;
    }
    
    let html = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="prev"><i class="fas fa-chevron-left"></i></button>`;
    
    for(let i = 1; i <= Math.min(totalPages, 5); i++) {
      html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="next"><i class="fas fa-chevron-right"></i></button>`;
    
    el.innerHTML = html;
    
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if(page === 'prev' && currentPage > 1) currentPage--;
        else if(page === 'next' && currentPage < totalPages) currentPage++;
        else if(page) currentPage = parseInt(page);
        
        loadContracts();
      });
    });
  }

  async function viewContract(id) {
    try {
      const contract = await callApi(`/${id}`);
      openContractModal(contract);
    } catch(e) {
      alert('Failed to load contract details: ' + e.message);
    }
  }

  async function reviewContract(id) {
    try {
      const contract = await callApi(`/${id}`);
      openReviewModal(contract);
    } catch(e) {
      alert('Failed to load contract for review: ' + e.message);
    }
  }

  async function deleteContract(id) {
    if(!confirm('Are you sure you want to delete this contract?')) return;
    
    try {
      await callApi(`/${id}`, { method: 'DELETE' });
      loadContracts(); // Reload
    } catch(e) {
      alert('Failed to delete contract: ' + e.message);
    }
  }

  async function approveContract(id, notes) {
    try {
      await callApi(`/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      loadContracts(); // Reload
      return true;
    } catch(e) {
      throw new Error('Failed to approve contract: ' + e.message);
    }
  }

  async function rejectContract(id, reason) {
    try {
      await callApi(`/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      loadContracts(); // Reload
      return true;
    } catch(e) {
      throw new Error('Failed to reject contract: ' + e.message);
    }
  }

  async function requestChanges(id, message) {
    try {
      await callApi(`/${id}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      loadContracts(); // Reload
      return true;
    } catch(e) {
      throw new Error('Failed to request changes: ' + e.message);
    }
  }

  function statusPillHtml(s) {
    const cls = s.toLowerCase();
    return `<span class="status-pill ${cls}"><span class="dot"></span>${s}</span>`;
  }

  function fmtNum(n) {
    return String(n || 0);
  }

  function openContractModal(contract) {
    // Modal implementation would go here
    console.log('View contract:', contract);
    alert(`Viewing contract ${contract.id} - ${contract.author}`);
  }

  function openReviewModal(contract) {
    // Modal implementation would go here
    console.log('Review contract:', contract);
    alert(`Reviewing contract ${contract.id} - ${contract.author}`);
  }

  async function init() {
    try {
      await Promise.all([loadContracts(), loadContractTemplates()]);
      
      // Add event listeners for filters
      const statusFilter = document.getElementById('statusFilter');
      const typeFilter = document.getElementById('contractTypeFilter');
      const searchInput = document.getElementById('tableSearch');
      
      if(statusFilter) {
        statusFilter.addEventListener('change', (e) => {
          activeStatus = e.target.value;
          loadContracts();
        });
      }
      
      if(typeFilter) {
        typeFilter.addEventListener('change', loadContracts);
      }
      
      if(searchInput) {
        searchInput.addEventListener('input', (e) => {
          // Debounce search would go here
          console.log('Search:', e.target.value);
        });
      }
    } catch(e) {
      console.error('Failed to initialize contract review:', e);
    }
  }

  // Initialize when DOM is ready
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose public API
  window.ContractReviewService = {
    loadContracts,
    approveContract,
    rejectContract,
    requestChanges,
    deleteContract,
    viewContract,
    reviewContract
  };

})();