/**
 * book-management-service.js — Book Management page logic
 * Live API only, no demo fallbacks.
 */
(function () {
  'use strict';

  const API_BASE = '/api/senior-editor/books';
  let books = [];
  let activeTab = 'all';
  let currentPage = 1;
  const PER_PAGE = 8;
  let genres = [];

  function showError(msg) {
    const el = document.getElementById('tableBody');
    if(el) el.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ${msg}</td></tr>`;
    
    const statsEl = document.getElementById('statCards');
    if(statsEl) statsEl.innerHTML = `<div class="error-state">${msg}</div>`;
  }

  function showLoading() {
    const el = document.getElementById('tableBody');
    if(el) el.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading books...</td></tr>`;
  }

  async function callApi(path, opts) {
    try {
      const res = await fetch(API_BASE + path, { credentials:'include', ...opts });
      if(!res.ok) throw new Error(`API error ${res.status}`);
      return await res.json();
    } catch(e) {
      console.error('Book management API error:', e);
      throw e;
    }
  }

  async function loadBooks() {
    showLoading();
    try {
      const data = await callApi(`?page=${currentPage}&limit=${PER_PAGE}`);
      books = data.items || [];
      const total = data.total || 0;
      renderTable(books);
      renderPagination(total);
      return books;
    } catch(e) {
      showError('Failed to load books: ' + e.message);
      return [];
    }
  }

  async function loadGenres() {
    try {
      const data = await callApi('/genres');
      genres = data || [];
      populateGenreFilter();
      return genres;
    } catch(e) {
      console.error('Failed to load genres:', e);
      return [];
    }
  }

  function renderStats() {
    const el = document.getElementById('statCards');
    if(!el) return;
    
    const published = books.filter(b => b.status === 'published').length;
    const draft = books.filter(b => b.status === 'draft').length;
    const review = books.filter(b => b.status === 'review').length;
    const flagged = books.filter(b => b.status === 'flagged').length;
    const totalRevenue = books.reduce((sum, b) => sum + (b.revenue || 0), 0);
    
    const stats = [
      { value: books.length, label:'Total Books', icon:'fa-book-open', color:'blue' },
      { value: published, label:'Published', icon:'fa-circle-check', color:'green' },
      { value: draft, label:'Drafts', icon:'fa-file-lines', color:'amber' },
      { value: review, label:'Under Review', icon:'fa-eye', color:'purple' },
      { value: flagged, label:'Flagged', icon:'fa-flag', color:'red' },
      { value: '$' + fmtNum(totalRevenue), label:'Total Revenue', icon:'fa-sack-dollar', color:'pink' },
    ];
    
    el.innerHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-ico ${s.color}"><i class="fas ${s.icon}"></i></div>
        <div class="stat-num">${fmtNum(s.value)}</div>
        <div class="stat-lbl">${s.label}</div>
      </div>
    `).join('');
  }

  function populateGenreFilter() {
    const el = document.getElementById('fCategory');
    if(!el) return;
    
    const uniqueGenres = [...new Set(books.map(b => b.genre).filter(Boolean))];
    el.innerHTML = '<option value="">All Genres</option>' + 
      uniqueGenres.map(g => `<option value="${g}">${g}</option>`).join('');
  }

  function renderTable(booksToShow) {
    const el = document.getElementById('tableBody');
    if(!el) return;
    
    if(!booksToShow || !booksToShow.length) {
      el.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:40px">No books found</td></tr>`;
      return;
    }
    
    el.innerHTML = booksToShow.map(b => `
      <tr>
        <td><div class="book-cell"><img class="book-thumb" src="${b.cover || ''}" alt=""/><div><div class="book-title">${b.title || ''}</div><div class="book-author">by ${b.author || ''}</div></div></div></td>
        <td><span class="genre-chip" style="background:${b.bg || '#e3ecfd'};color:${b.color || '#2f7de1'}">${b.genre || ''}</span></td>
        <td>${statusPillHtml(b.status || 'draft')}</td>
        <td>${fmtNum(b.reads || 0)}</td>
        <td>${fmtNum(b.likes || 0)}</td>
        <td>${fmtNum(b.comments || 0)}</td>
        <td><div class="action-buttons">
          <button class="action-btn view" title="View"><i class="fas fa-eye"></i></button>
          <button class="action-btn edit" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>
    `).join('');
    
    renderStats();
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
        
        loadBooks();
      });
    });
  }

  function statusPillHtml(s) {
    const cls = s.toLowerCase().replace(/ /g, '-');
    return `<span class="status-pill ${cls}"><span class="dot"></span>${s}</span>`;
  }

  function fmtNum(n) {
    n = Number(n || 0);
    if(n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return String(n);
  }

  async function init() {
    try {
      await Promise.all([loadBooks(), loadGenres()]);
    } catch(e) {
      console.error('Failed to initialize book management:', e);
    }
  }

  // Initialize when DOM is ready
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();