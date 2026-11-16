/**
 * book-overview-service.js — data + render for book-overview.html.
 *
 * Resolves the book from ?book= or the author's first book, then reads
 * /api/author/books/:id and /books/:id/overview. Nothing on this page is
 * placeholder content: the synopsis, tags and progress all come from the book
 * row, and a failure renders an error with a retry.
 */
(function () {
  'use strict';
  if (window.BookOverviewService && window.BookOverviewService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 8000 };

  var BOOK_ID = null;
  var STATS = [];

  var QUICK_ACTIONS = [
    { label: 'New Chapter', icon: 'fa-plus', bg: 'var(--primary-soft)', color: 'var(--primary)', href: 'book-workspace.html' },
    { label: 'Plotting', icon: 'fa-diagram-project', bg: 'var(--purple-soft)', color: 'var(--purple)', href: 'plotting.html' },
    { label: 'Characters', icon: 'fa-user-group', bg: 'var(--blue-soft)', color: 'var(--blue)', href: 'characters.html' },
    { label: 'Schedule', icon: 'fa-calendar-days', bg: 'var(--warning-soft)', color: 'var(--warning)', href: 'book-workspace.html' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 1240 -> 1.2K. Real counts only; never a stand-in.
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function fmtDate(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function callBackend(path) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.TIMEOUT_MS);
    var res;
    try {
      res = await fetch(CFG.API_BASE + path, { signal: controller.signal, credentials: 'include' });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? 'Request timed out' : 'Network error');
    }
    clearTimeout(timer);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
      var err = new Error(String(msg).replace(/_/g, ' '));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  var api = window.BookOverviewService || {};
  api.getBook = async function (bookId) { return await callBackend('/books/' + encodeURIComponent(bookId)); };
  api.getOverview = async function (bookId) { return await callBackend('/books/' + encodeURIComponent(bookId) + '/overview'); };
  api.getBooks = async function () { return await callBackend('/books'); };

  function renderStats() {
    var grid = document.getElementById('statGrid');
    if (!STATS.length) {
      grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No statistics yet for this book.</div>';
      return;
    }
    grid.innerHTML = STATS.map(function (s) {
      var growth = s.growth == null
        ? '<span class="dim">all time</span>'
        : '<i class="fas fa-arrow-' + (s.growth < 0 ? 'down' : 'up') + '"></i> ' + s.growth + '% <span class="dim">vs last 30d</span>';
      return '<div class="stat-card fade"><div class="stat-icon" style="background:' + s.bg + ';color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>'
        + '<div class="stat-label">' + s.label + '</div><div class="stat-num">' + s.num + '</div>'
        + '<div class="stat-growth">' + growth + '</div></div>';
    }).join('');
  }

  function renderQA() {
    document.getElementById('qaGrid').innerHTML = QUICK_ACTIONS.map(function (q) {
      var href = q.href + '?book=' + encodeURIComponent(BOOK_ID || '');
      return '<div class="qa-item" onclick="location.href=\'' + href + '\'"><div class="qa-icon" style="background:' + q.bg + ';color:' + q.color + '"><i class="fas ' + q.icon + '"></i></div><div class="qa-label">' + q.label + '</div></div>';
    }).join('');
  }

  function renderHeader(book) {
    document.querySelector('.bh-title').textContent = book.title || 'Untitled';
    document.querySelector('.bh-genre').textContent = [book.genre, book.category].filter(Boolean).join(' · ');
    var coverImg = document.querySelector('.bh-cover img');
    coverImg.src = book.cover || '../assets/droboard-icon.png';
    coverImg.alt = book.title || 'Book cover';
    coverImg.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
    var labels = {
      published: 'Published', ongoing: 'Ongoing', draft: 'Draft',
      under_review: 'Under Review', completed: 'Completed', paused: 'Paused', flagged: 'Flagged'
    };
    var badge = document.querySelector('.bh-info .status-badge');
    if (badge) {
      badge.textContent = labels[book.status] || book.status || 'Draft';
      badge.className = 'status-badge ' + (book.status === 'under_review' ? 'ongoing' : (book.status || 'draft'));
    }
    document.getElementById('bhReads').textContent = compact(book.reads);
    document.getElementById('bhLikes').textContent = compact(book.likes);
    document.getElementById('bhChapters').textContent = Number(book.chapterCount) || 0;
    var when = book.updatedAt || book.createdAt;
    document.getElementById('bhUpdated').textContent = when ? 'Updated ' + fmtDate(when) : '';
    document.title = (book.title || 'Book') + ' · Overview · Droboard';
  }

  function renderSynopsis(book) {
    var text = document.getElementById('synopsisText');
    var tags = document.getElementById('synopsisTags');
    var synopsis = String(book.synopsis || '').trim();
    if (synopsis) {
      text.textContent = synopsis;
      text.classList.remove('dim');
    } else {
      text.textContent = 'No synopsis yet. Add one from the book settings so readers know what the story is about.';
      text.classList.add('dim');
    }
    var list = (Array.isArray(book.tags) ? book.tags : []).filter(Boolean);
    if (!list.length && book.genre) list = [book.genre];
    tags.innerHTML = list.map(function (t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }).join('');
  }

  function renderProgress(book, stats) {
    var written = Number(stats.chapters) || 0;
    var total = Number(book.chapterCount) || written;
    var pct = total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
    document.getElementById('progPct').textContent = written + ' / ' + total;
    document.getElementById('progFill').style.width = pct + '%';
    var when = book.updatedAt || book.createdAt;
    document.getElementById('progMeta').textContent = when ? 'Last updated ' + fmtDate(when) : '';
  }

  function showLoadError(e) {
    var grid = document.getElementById('statGrid');
    grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red, #e0384d)"><i class="fas fa-exclamation-triangle"></i> '
      + esc((e && e.message) || 'Could not load this book.')
      + '<div><button type="button" id="retryOverview" style="margin-top:10px;padding:7px 16px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;font-weight:700;cursor:pointer">Retry</button></div></div>';
    var btn = document.getElementById('retryOverview');
    if (btn) btn.addEventListener('click', function () { load(); });
    document.getElementById('synopsisText').textContent = 'Could not load the synopsis.';
    document.getElementById('synopsisText').classList.add('dim');
    document.getElementById('synopsisTags').innerHTML = '';
    document.getElementById('progPct').textContent = '—';
    document.getElementById('progFill').style.width = '0%';
    document.getElementById('progMeta').textContent = '';
  }

  async function load() {
    var results = await Promise.all([api.getBook(BOOK_ID), api.getOverview(BOOK_ID)]);
    var book = results[0] || {};
    var data = results[1] || {};
    renderHeader(book);
    renderSynopsis(book);
    var st = data.stats || {};
    renderProgress(book, st);
    STATS = [
      { label: 'Reads', num: compact(st.reads), growth: null, icon: 'fa-eye', bg: 'var(--primary-soft)', color: 'var(--primary)' },
      { label: 'Likes', num: compact(st.likes), growth: null, icon: 'fa-heart', bg: 'var(--red-soft, rgba(224,56,77,.1))', color: 'var(--red, #e0384d)' },
      { label: 'Chapters', num: compact(st.chapters), growth: null, icon: 'fa-list-ul', bg: 'var(--blue-soft)', color: 'var(--blue)' }
    ];
    renderStats();
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  async function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('book-overview.html'); window.AuthorDrawer.bind(); }
    else {
      document.getElementById('menuBtn').addEventListener('click', openDrawer);
      document.getElementById('drawerClose').addEventListener('click', closeDrawer);
      document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    }
    if (window.DroboardWorkspaceTabs) window.DroboardWorkspaceTabs.configure({ active: 'overview' });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });

    var q = new URLSearchParams(location.search).get('book');
    try {
      BOOK_ID = (q && q !== 'b1') ? q : null;
      if (!BOOK_ID) {
        var list = await api.getBooks();
        if (!Array.isArray(list) || !list.length) throw new Error('Your account has no books yet.');
        BOOK_ID = list[0].id;
      }
      renderQA();
      await load();
      if (window.AuthorFinance) window.AuthorFinance.clearPageError();
    } catch (e) {
      renderQA();
      showLoadError(e);
    }
  }

  api.init = init;
  window.BookOverviewService = api;
})();
