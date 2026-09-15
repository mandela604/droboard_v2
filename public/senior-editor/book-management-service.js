/**
 * book-management-service.js — Book Management page logic
 * Reads data from window.EditorDemo.BOOKS (or DroboardAPI fallback).
 */
(function () {
  'use strict';

  var D = window.EditorDemo || {};
  var books = (D.BOOKS || []).slice();
  var activeTab = 'all';
  var currentPage = 1;
  var PER_PAGE = 8;

  /* ── Init ── */
  function init() {
    if (!document.getElementById('tableBody')) return;
    bindEvents();
    refresh();
  }

  function getBooks() {
    return books;
  }

  /* ── Status helpers ── */
  function statusClass(s) {
    return { Published:'published', Draft:'draft', 'Under Review':'review', Flagged:'flagged' }[s] || 'draft';
  }
  function statusPillHtml(s) {
    return '<span class="status-pill ' + statusClass(s) + '"><span class="dot"></span>' + s + '</span>';
  }

  /* ── Refresh (filter + render) ── */
  function refresh() {
    var q = (document.getElementById('tableSearch').value || '').trim().toLowerCase();
    var cat = document.getElementById('fCategory').value;
    var genre = document.getElementById('fGenre').value;
    var stat = document.getElementById('fStatus').value;

    var filtered = books.filter(function (b) {
      if (activeTab !== 'all' && b.status !== activeTab) return false;
      if (cat !== 'All Categories' && b.cat !== cat) return false;
      if (genre !== 'All Genres' && b.genre !== genre) return false;
      if (stat !== 'All Status' && b.status !== stat) return false;
      if (q && b.title.toLowerCase().indexOf(q) === -1 && b.author.toLowerCase().indexOf(q) === -1 && b.id.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    renderTable(filtered);
    renderStats();
    renderTabs();
  }

  /* ── Render table ── */
  function renderTable(list) {
    var body = document.getElementById('tableBody');
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PER_PAGE;
    var page = list.slice(start, start + PER_PAGE);

    if (!page.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="7"><i class="fas fa-inbox"></i> No books match this filter.</td></tr>';
    } else {
      body.innerHTML = page.map(function (b) {
        return '<tr>' +
          '<td data-label="Book Details"><div class="book-cell"><div class="book-cover"><img src="' + b.img + '" alt=""/></div><div><div class="book-title">' + b.title + '</div><div class="book-id">ID: ' + b.id + '</div></div></div></td>' +
          '<td data-label="Author"><div class="author-cell"><img src="' + b.avatar + '" alt=""/><span class="author-name">' + b.author + '</span></div></td>' +
          '<td data-label="Category / Genre"><div class="cat-main">' + b.cat + '</div><div class="cat-sub">' + b.genre + '</div></td>' +
          '<td data-label="Status">' + statusPillHtml(b.status) + '</td>' +
          '<td data-label="Views" class="' + (b.views === '\u2014' ? 'muted-cell' : 'views-cell') + '">' + b.views + '</td>' +
          '<td data-label="Added On" class="muted-cell">' + b.added + '</td>' +
          '<td data-label="Actions"><div class="actions-cell">' +
            '<button class="act-btn" title="View" onclick="BookManagement.viewBook(\'' + b.id + '\')"><i class="fas fa-eye"></i></button>' +
            '<button class="act-btn" title="Edit" onclick="BookManagement.editBook(\'' + b.id + '\')"><i class="fas fa-pen"></i></button>' +
            '<button class="act-btn" title="Delete" onclick="BookManagement.deleteBook(\'' + b.id + '\')"><i class="fas fa-trash"></i></button>' +
          '</div></td></tr>';
      }).join('');
    }

    var pageInfo = document.getElementById('pageInfo');
    pageInfo.innerHTML = total
      ? 'Showing <b>' + (start + 1) + '</b> to <b>' + Math.min(start + PER_PAGE, total) + '</b> of <b>' + total.toLocaleString() + '</b> books'
      : 'No books found';
    renderPagination(totalPages);
  }

  /* ── Pagination ── */
  function renderPagination(tp) {
    var w = document.getElementById('pageBtns');
    if (tp <= 1) { w.innerHTML = ''; return; }
    var h = '<button class="pg-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' onclick="BookManagement.goPage(' + (currentPage - 1) + ')"><i class="fas fa-chevron-left"></i></button>';
    var sP = Math.max(1, currentPage - 2);
    var eP = Math.min(tp, currentPage + 2);
    if (sP > 1) h += '<button class="pg-btn" onclick="BookManagement.goPage(1)">1</button>' + (sP > 2 ? '<span class="pg-dots">\u2026</span>' : '');
    for (var i = sP; i <= eP; i++) {
      h += '<button class="pg-btn' + (i === currentPage ? ' active' : '') + '" onclick="BookManagement.goPage(' + i + ')">' + i + '</button>';
    }
    if (eP < tp) h += (eP < tp - 1 ? '<span class="pg-dots">\u2026</span>' : '') + '<button class="pg-btn" onclick="BookManagement.goPage(' + tp + ')">' + tp + '</button>';
    h += '<button class="pg-btn"' + (currentPage >= tp ? ' disabled' : '') + ' onclick="BookManagement.goPage(' + (currentPage + 1) + ')"><i class="fas fa-chevron-right"></i></button>';
    w.innerHTML = h;
  }

  function goPage(p) {
    currentPage = p;
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Stats ── */
  function renderStats() {
    var t = books.length;
    var p = books.filter(function (x) { return x.status === 'Published'; }).length;
    var d = books.filter(function (x) { return x.status === 'Draft'; }).length;
    var f = books.filter(function (x) { return x.status === 'Flagged'; }).length;
    var r = books.filter(function (x) { return x.status === 'Under Review'; }).length;
    document.getElementById('statsGrid').innerHTML =
      '<div class="stat-card"><div class="stat-top"><div class="stat-ico purple"><i class="fas fa-book"></i></div></div><div class="stat-num">' + t + '</div><div class="stat-lbl">Total Books</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div class="stat-ico green"><i class="fas fa-circle-check"></i></div></div><div class="stat-num">' + p + '</div><div class="stat-lbl">Published</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div class="stat-ico amber"><i class="fas fa-clock"></i></div></div><div class="stat-num">' + d + '</div><div class="stat-lbl">Drafts</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div class="stat-ico red"><i class="fas fa-flag"></i></div></div><div class="stat-num">' + f + '</div><div class="stat-lbl">Flagged</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div class="stat-ico blue"><i class="fas fa-hourglass-half"></i></div></div><div class="stat-num">' + r + '</div><div class="stat-lbl">Under Review</div></div>';
  }

  /* ── Tabs ── */
  function renderTabs() {
    var counts = { all: books.length };
    ['Published', 'Draft', 'Under Review', 'Flagged'].forEach(function (s) {
      counts[s] = books.filter(function (b) { return b.status === s; }).length;
    });
    document.getElementById('countAll').textContent = counts.all;
    document.querySelectorAll('.tab-item').forEach(function (t) {
      var k = t.dataset.tab;
      var c = t.querySelector('.tab-count');
      if (c && counts[k] !== undefined) c.textContent = counts[k];
    });
  }

  /* ── View book — link to workspace ── */
  function viewBook(id) {
    window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id);
  }

  /* ── Edit book — link to workspace ── */
  function editBook(id) {
    window.location.href = '../author/book-workspace.html?book=' + encodeURIComponent(id) + '&mode=edit';
  }

  /* ── Delete book — popup for reason, send to admin ── */
  function deleteBook(id) {
    var b = books.find(function (x) { return x.id === id; });
    if (!b) return;

    var modal = document.getElementById('deleteModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'deleteModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
      modal.innerHTML =
        '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px;width:90%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.4)">' +
          '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Delete Book</div>' +
          '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">You are about to delete <strong id="delBookTitle"></strong>. Please provide a reason:</div>' +
          '<textarea id="delReason" rows="3" placeholder="Reason for deletion..." style="width:100%;padding:10px 12px;border:1px solid var(--input-border);border-radius:10px;background:var(--input-bg);color:var(--text);font-size:13px;font-family:inherit;resize:vertical;outline:none"></textarea>' +
          '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">' +
            '<button onclick="BookManagement.closeDeleteModal()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>' +
            '<button onclick="BookManagement.confirmDelete()" style="padding:9px 18px;border-radius:10px;border:none;background:var(--red);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit">Send to Admin</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    document.getElementById('delBookTitle').textContent = b.title;
    document.getElementById('delReason').value = '';
    modal.style.display = 'flex';
    modal._bookId = id;
    modal._bookTitle = b.title;
  }

  function closeDeleteModal() {
    var modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
  }

  function confirmDelete() {
    var modal = document.getElementById('deleteModal');
    var reason = document.getElementById('delReason').value.trim();
    if (!reason) {
      toast('Please provide a reason for deletion');
      return;
    }
    var id = modal._bookId;
    var title = modal._bookTitle;

    // Remove from local array
    books = books.filter(function (b) { return b.id !== id; });

    // Store deletion request for admin confirmation
    var requests = JSON.parse(localStorage.getItem('BOOK_DELETE_REQUESTS') || '[]');
    requests.push({
      id: id,
      title: title,
      reason: reason,
      requestedBy: 'Reina Morgan',
      date: new Date().toISOString(),
      status: 'pending'
    });
    localStorage.setItem('BOOK_DELETE_REQUESTS', JSON.stringify(requests));

    closeDeleteModal();
    toast('Delete request sent to admin for confirmation');
    refresh();
  }

  /* ── Bind events ── */
  function bindEvents() {
    document.querySelectorAll('.tab-item').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.tab-item').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        currentPage = 1;
        refresh();
      });
    });

    ['tableSearch', 'fCategory', 'fGenre', 'fStatus'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(id === 'tableSearch' ? 'input' : 'change', function () {
        currentPage = 1;
        refresh();
      });
    });
  }

  /* ── Toast helper ── */
  function toast(m) {
    var d = 2200;
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, d);
  }

  /* ── Public API ── */
  window.BookManagement = {
    init: init,
    refresh: refresh,
    goPage: goPage,
    viewBook: viewBook,
    editBook: editBook,
    deleteBook: deleteBook,
    closeDeleteModal: closeDeleteModal,
    confirmDelete: confirmDelete,
  };

  /* Auto-init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();