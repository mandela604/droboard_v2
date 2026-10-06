/**
 * book-workspace-service.js — Data layer + render + bindings for book-workspace.html.
 * TODO backend: GET /api/author/books/:id, GET /api/author/books/:id/chapters?page=
 */
(function () {
  'use strict';
  if (window.BookWorkspaceService && window.BookWorkspaceService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }
  var TITLES = ['The Beginning of Obsession', "The Girl He Shouldn't Want", 'Secrets in the Dark', 'Falling Too Deep', 'The Truth He Hides'];
  function demoChapters() {
    var out = []; for (var i = 0; i < 56; i++) {
      var n = i + 1; var st = n === 56 ? 'draft' : n === 55 ? 'scheduled' : 'published';
      out.push({ num: n, title: TITLES[i % TITLES.length] + ' #' + n, words: 2100 + (i * 37) % 700, status: st, date: 'May ' + (10 + i % 20) + ', 2025', views: st === 'published' ? (45 - i * 0.5).toFixed(1) + 'K' : '–' });
    } return out;
  }

  var BOOK_ID = null;
  var CHAPTERS = [];
  var PAGE_SIZE = 12;
  var currentPage = 1;
  var totalPages = 1;

  function chapterBadge(ch) {
    if (ch.status === 'published') return '<span class="ch-dot published"></span>';
    if (ch.status === 'scheduled') return '<span class="ch-badge scheduled">Scheduled</span>';
    if (ch.status === 'draft') return '<span class="ch-badge draft">Draft</span>';
    if (ch.status === 'pending_review') return '<span class="ch-badge" style="background:rgba(217,119,6,.12);color:#b7690a">Pending Review</span>';
    if (ch.status === 'revision_needed') return '<span class="ch-badge" style="background:rgba(224,56,77,.1);color:#e0384d">Revision Needed</span>';
    return '';
  }

  function renderChapters() {
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageItems = CHAPTERS.slice(start, start + PAGE_SIZE);
    document.getElementById('pgInfo').textContent = 'Showing ' + (start + 1) + '–' + (start + pageItems.length) + ' of ' + CHAPTERS.length + ' chapters';
    document.getElementById('chapterList').innerHTML = pageItems.map(function (ch, i) {
      return '<div class="chapter-card fade" style="animation-delay:' + (i * 0.03) + 's">'
        + '<div class="ch-top"><div class="ch-title-row"><span class="ch-title">' + ch.num + '. ' + ch.title + '</span>' + chapterBadge(ch) + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px"><button class="ch-edit-btn" onclick="editChapter(' + ch.num + ')" title="Edit chapter"><i class="fas fa-pen"></i></button>'
        + '<span class="ch-more"><i class="fas fa-ellipsis"></i></span></div></div>'
        + '<div class="ch-meta-row"><span class="ch-meta">' + ch.words + ' words &middot; ' + ch.date + '</span>'
        + '<span class="ch-views">' + (ch.views !== '–' ? '<i class="far fa-eye"></i> ' + ch.views + ' Reads' : '–') + '</span></div></div>';
    }).join('');
    renderPagination();
  }

  function editChapter(num) {
    window.location.href = 'edit-chapter.html?book=b1&chapter=' + num;
  }

  function renderPagination() {
    if (totalPages <= 1) { document.getElementById('chaptersPagination').innerHTML = ''; return; }
    var pages = [];
    if (totalPages <= 5) { for (var i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push('…');
      for (var j = Math.max(2, currentPage - 1); j <= Math.min(totalPages - 1, currentPage + 1); j++) pages.push(j);
      if (currentPage < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    document.getElementById('chaptersPagination').innerHTML =
      '<div class="pg-btn' + (currentPage === 1 ? ' disabled' : '') + '" onclick="goToPage(' + (currentPage - 1) + ')"><i class="fas fa-chevron-left" style="font-size:10px"></i></div>'
      + pages.map(function (p) { return p === '…' ? '<span class="pg-ellipsis">…</span>' : '<div class="pg-btn' + (p === currentPage ? ' active' : '') + '" onclick="goToPage(' + p + ')">' + p + '</div>'; }).join('')
      + '<div class="pg-btn' + (currentPage === totalPages ? ' disabled' : '') + '" onclick="goToPage(' + (currentPage + 1) + ')"><i class="fas fa-chevron-right" style="font-size:10px"></i></div>';
  }

  function goToPage(p) {
    if (p < 1 || p > totalPages || p === currentPage) return;
    currentPage = p;
    renderChapters();
    document.querySelector('.chapters-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toastLocal(m) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) { window.AuthorDrawer.toast(m); return; }
    var t = document.getElementById('toastEl') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toastEl', className: 'toast' }));
    t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }
  function showBtnLoading(btn, label) { if (!btn) return; btn._html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (label || 'Loading…'); }
  function hideBtnLoading(btn) { if (!btn) return; if (btn._html) btn.innerHTML = btn._html; btn.disabled = false; }

  var selectedAction = 'lock';
  function updateActionBtns() {
    document.querySelectorAll('.lock-action-btn').forEach(function (btn) {
      var isActive = btn.dataset.action === selectedAction;
      btn.classList.toggle('active', isActive);
      btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
      btn.style.background = isActive ? 'rgba(255,0,80,.06)' : 'var(--input-bg)';
    });
  }
  function openBookLockModal() {
    var modal = document.getElementById('bookLockModal');
    if (!modal) return;
    modal.style.display = 'flex';
    selectedAction = 'lock';
    document.getElementById('bookLockReason').value = '';
    updateActionBtns();
  }
  function closeBookLockModal() {
    var modal = document.getElementById('bookLockModal');
    if (modal) modal.style.display = 'none';
  }
  function bindLockModal() {
    var modal = document.getElementById('bookLockModal');
    if (!modal) return;
    var reasonEl = document.getElementById('bookLockReason');
    var submitBtn = document.getElementById('submitBookLockBtn');
    document.querySelectorAll('.lock-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { selectedAction = this.dataset.action; updateActionBtns(); });
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeBookLockModal(); });
    if (submitBtn) submitBtn.addEventListener('click', function () {
      var reason = reasonEl.value.trim();
      if (!reason) { reasonEl.focus(); return; }
      showBtnLoading(submitBtn, 'Submitting…');
      setTimeout(function () { hideBtnLoading(submitBtn); closeBookLockModal(); toastLocal('Request submitted — your SE will review it'); }, 1000);
    });
  }

  async function initWorkspace() {
    try {
      var res = await Promise.all([
        window.BookWorkspaceService.getBook(BOOK_ID),
        window.BookWorkspaceService.getChapters(BOOK_ID, 1, 1000)
      ]);
      var book = res[0]; var chRes = res[1];
      document.querySelector('.bh-title').textContent = book.title;
      document.querySelector('.bh-genre').textContent = book.genre;
      document.querySelector('.bh-cover img').src = book.cover;
      CHAPTERS = (chRes.items || []);
      if (!CHAPTERS.length && chRes.total) CHAPTERS = chRes.items || [];
      totalPages = Math.max(1, Math.ceil(CHAPTERS.length / PAGE_SIZE));
      document.getElementById('bhChapterCount').textContent = CHAPTERS.length;
      document.getElementById('chaptersTitleCount').textContent = CHAPTERS.length;
      renderChapters();
    } catch (e) { document.getElementById('pgInfo').textContent = 'Failed to load chapters'; }
  }

  function init() {
    BOOK_ID = new URLSearchParams(location.search).get('book') || 'b1';
    PAGE_SIZE = (window.BookWorkspaceService && window.BookWorkspaceService.PAGE_SIZE) || 12;
    initWorkspace();
    if (window.AuthorDrawer) { window.AuthorDrawer.render('book-workspace.html'); window.AuthorDrawer.bind(); }
    document.getElementById('newChapterBtn').addEventListener('click', function () {
      location.href = '../Pages/create.html?book=' + encodeURIComponent(BOOK_ID) + '&newChapter=1';
    });
    if (window.DroboardWorkspaceTabs) window.DroboardWorkspaceTabs.configure({ active: 'chapters' });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });
    bindLockModal();
    window.editChapter = editChapter;
    window.goToPage = goToPage;
    window.openBookLockModal = openBookLockModal;
    window.closeBookLockModal = closeBookLockModal;
  }

  var api = window.BookWorkspaceService || {};
  api.PAGE_SIZE = 12;
  api.getBook = api.getBook || async function (bookId) { if (CFG.USE_API) { try { return await callBackend('/books/' + bookId); } catch (e) {} } await delay(); return { id: bookId || 'b1', title: 'Bound By Obsession', genre: 'Romance · Drama', status: 'published', reads: '2.3M', likes: '189K', updated: 'Updated 2 hours ago', cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' }; };
  api.getChapters = api.getChapters || async function (bookId, page, pageSize) {
    if (CFG.USE_API) { try { return await callBackend('/books/' + bookId + '/chapters?page=' + page); } catch (e) {} }
    await delay(); var all = demoChapters(); var ps = pageSize || 12;
    return { total: all.length, items: clone(all.slice((page - 1) * ps, page * ps)) };
  };
  api.init = init;
  window.BookWorkspaceService = api;
  window.editChapter = editChapter;
  window.goToPage = goToPage;
  window.openBookLockModal = openBookLockModal;
  window.closeBookLockModal = closeBookLockModal;
})();
