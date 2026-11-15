/**
 * book-overview-service.js — Data layer + render + bindings for book-overview.html.
 * TODO backend: GET /api/author/books/:id/overview
 */
(function () {
  'use strict';
  if (window.BookOverviewService && window.BookOverviewService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  async function callBackend(path) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, { signal: c.signal, credentials: 'include' }); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  var STATS = [];

  var QUICK_ACTIONS = [
    { label: 'New Chapter', icon: 'fa-plus', bg: 'var(--primary-soft)', color: 'var(--primary)', href: 'book-workspace.html' },
    { label: 'Plotting', icon: 'fa-diagram-project', bg: 'var(--purple-soft)', color: 'var(--purple)', href: 'plotting.html' },
    { label: 'Characters', icon: 'fa-user-group', bg: 'var(--blue-soft)', color: 'var(--blue)', href: 'characters.html' },
    { label: 'Schedule', icon: 'fa-calendar-days', bg: 'var(--warning-soft)', color: 'var(--warning)', href: '#' }
  ];

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

  function renderStats() {
    if (!STATS || STATS.length === 0) {
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load statistics</div>';
      return;
    }
    document.getElementById('statGrid').innerHTML = STATS.map(function (s) {
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
      return '<div class="qa-item" onclick="location.href=\'' + q.href + '\'"><div class="qa-icon" style="background:' + q.bg + ';color:' + q.color + '"><i class="fas ' + q.icon + '"></i></div><div class="qa-label">' + q.label + '</div></div>';
    }).join('');
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  // Header + performance cards come from the book itself, never from markup
  // placeholder numbers: the same page serves every author's every book.
  async function hydrate(bookId) {
    if (!bookId) {
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> No book selected</div>';
      return;
    }
    try {
      var res = await Promise.all([api.getBook(bookId), api.getOverview(bookId)]);
      var book = res[0] || {};
      var data = res[1] || {};

      if (book.title) {
        document.querySelector('.bh-title').textContent = book.title;
        document.querySelector('.bh-genre').textContent = book.genre || '';
        var coverImg = document.querySelector('.bh-cover img');
        coverImg.src = book.cover || '../assets/droboard-icon.png';
        coverImg.alt = book.title;
        var labels = { published: 'Published', ongoing: 'Ongoing', draft: 'Draft',
          under_review: 'Under Review', completed: 'Completed', paused: 'Paused', flagged: 'Flagged' };
        var badge = document.querySelector('.bh-info .status-badge');
        if (badge) {
          badge.textContent = labels[book.status] || book.status || 'Draft';
          badge.className = 'status-badge ' + (book.status === 'under_review' ? 'ongoing' : (book.status || 'draft'));
        }
        document.getElementById('bhReads').textContent = compact(book.reads);
        document.getElementById('bhLikes').textContent = compact(book.likes);
        document.getElementById('bhChapters').textContent = book.chapterCount || 0;
        var when = book.updatedAt || book.createdAt;
        document.getElementById('bhUpdated').textContent = when ? 'Updated ' + fmtDate(when) : '';
      }

      var st = data.stats || {};
      STATS.length = 0;
      STATS.push(
        { label: 'Reads', num: compact(st.reads), growth: null, icon: 'fa-eye', bg: 'var(--primary-soft)', color: 'var(--primary)' },
        { label: 'Likes', num: compact(st.likes), growth: null, icon: 'fa-heart', bg: 'var(--red-soft, rgba(224,56,77,.1))', color: 'var(--red, #e0384d)' },
        { label: 'Chapters', num: compact(st.chapters), growth: null, icon: 'fa-list-ul', bg: 'var(--blue-soft)', color: 'var(--blue)' }
      );
      renderStats();
    } catch (e) {
      console.error('Failed to load overview:', e);
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load book statistics. Please refresh the page.</div>';
    }
  }

  function init() {
    renderQA();
    var params = new URLSearchParams(location.search);
    hydrate(params.get('book') || '');
    
    if (window.AuthorDrawer) { window.AuthorDrawer.render('book-overview.html'); window.AuthorDrawer.bind(); }
    else {
      document.getElementById('menuBtn').addEventListener('click', openDrawer);
      document.getElementById('drawerClose').addEventListener('click', closeDrawer);
      document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    }
    if (window.DroboardWorkspaceTabs) window.DroboardWorkspaceTabs.configure({ active: 'overview' });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });
  }

  var api = window.BookOverviewService || {};
  api.getBook = api.getBook || async function (bookId) {
    return await callBackend('/books/' + encodeURIComponent(bookId));
  };
  api.getOverview = api.getOverview || async function (bookId) {
    return await callBackend('/books/' + encodeURIComponent(bookId) + '/overview');
  };
  api.init = init;
  window.BookOverviewService = api;
})();
