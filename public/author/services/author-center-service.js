/**
 * author-center-service.js — Data layer + render + bindings for author-center.html (Dashboard).
 * Uses /api/author/dashboard and /api/author/books.
 */
(function () {
  'use strict';
  if (window.AuthorCenterService && window.AuthorCenterService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 3000 };

  async function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal, credentials: 'include' }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  var STATS = [];
  var BOOKS = [];


  function renderStats() {
    if (STATS.length === 0) {
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Unable to load statistics</div>';
      return;
    }
    document.getElementById('statGrid').innerHTML = STATS.map(function (s) {
      var growth;
      if (s.growth != null) {
        growth = '<i class="fas fa-arrow-' + (s.growth < 0 ? 'down' : 'up') + '"></i> ' + s.growth + '% <span class="dim">vs last 30d</span>';
      } else if (s.note) {
        growth = '<span class="dim">' + s.note + '</span>';
      } else {
        growth = '';
      }
      return '<div class="stat-card"' + (s.href ? ' onclick="location.href=\'' + s.href + '\'" style="cursor:pointer"' : '') + '>'
        + '<div class="stat-icon" style="background:' + s.bg + ';color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>'
        + '<div class="stat-label">' + s.label + '</div>'
        + '<div class="stat-num">' + s.num + '</div>'
        + '<div class="stat-growth">' + growth + '</div>'
        + '</div>';
    }).join('');
  }

  function renderBooks() {
    if (!window.DroboardBookCard) { document.getElementById('bookList').innerHTML = ''; return; }
    // Flag in place, never clone: onCreated writes back onto these same
    // objects, and a copy here would silently drop the new engagement.
    BOOKS.forEach(function (b) { b.onEngage = true; });
    DroboardBookCard.renderList('#bookList', BOOKS, {
      onOpen: function (b) { location.href = 'book-workspace.html?book=' + b.id; },
      showNew: true
    });
  }

  async function createEngagement(bookId, payload) {
    var res = await fetch(CFG.API_BASE + '/books/' + encodeURIComponent(bookId) + '/engagement', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Could not save (' + res.status + ')');
    return await res.json();
  }

  function onCreated(book, item) {
    book.engagements = (book.engagements || []).concat([item]);
    if (window.AuthorDrawer) window.AuthorDrawer.toast('Live on ' + book.title + '.');
  }

  function wireEngagementCreator() {
    if (!window.DroboardBookCard || !window.DroboardBookCard.configure) return;
    window.DroboardBookCard.configure({
      onEngage: function (book, anchorEl, kind) {
        if (!window.DroboardEngagementCreator) return;
        window.DroboardEngagementCreator.open({
          bookId: book.id,
          bookTitle: book.title,
          kind: kind, // picker chose Poll / Prediction / Debate
          submit: function (payload) { return createEngagement(book.id, payload); },
          onCreated: function (item) { onCreated(book, item); },
        });
      }
    });
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  async function hydrate() {
    try {
      // Get current user from session. A cookie-only login has no stored user
      // row yet, so restore it from /api/users/me before painting the greeting.
      var userSession = window.AuthSession && window.AuthSession.getSync ? window.AuthSession.getSync() : {};
      if (!userSession.name && window.AuthSession && window.AuthSession.ensureAccount) {
        try { await window.AuthSession.ensureAccount(); userSession = window.AuthSession.getSync(); } catch (e) {}
      }
      var currentUser = userSession.name || userSession.handle || '';

      // Update welcome message with the real signed-in name
      var welcomeEl = document.querySelector('.welcome-greet');
      if (welcomeEl) {
        welcomeEl.textContent = currentUser ? ('Welcome back, ' + currentUser + ' 👋') : 'Welcome back 👋';
      }

      // Topbar avatar = the signed-in user's own image, never a demo face.
      var avatarImg = document.getElementById('userAvatarImg');
      if (avatarImg) {
        avatarImg.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
        avatarImg.src = userSession.avatar || '../assets/droboard-icon.png';
        avatarImg.alt = currentUser + ' avatar';
      }

      // Fetch stats from API. The author dashboard returns
      // { stats: {books, contracts, reads, followers, earnings, completionRate,
      // pendingReviews}, growth: {reads, followers, earnings, completionRate} }.
      // An array is still accepted for older deployments.
      var statsRes = await api.getStats() || {};
      STATS.length = 0;
      if (Array.isArray(statsRes)) {
        statsRes.forEach(function (s) {
          STATS.push({
            label: s.label || s.name || 'Unknown',
            num: String(s.value != null ? s.value : (s.num != null ? s.num : 0)),
            growth: s.growth == null ? null : s.growth,
            icon: s.icon || 'fa-chart-simple',
            bg: s.bg || 'rgba(200,200,200,.08)',
            color: s.color || '#666',
            href: s.href || ''
          });
        });
      } else if (statsRes.stats) {
        var s = statsRes.stats || {};
        var g = statsRes.growth || {};
        STATS.push(
          { label: 'Books', num: fmtNum(s.books), growth: g.books, note: 'all time', icon: 'fa-book-open', bg: 'rgba(99,102,241,.12)', color: '#6366f1' },
          { label: 'Reads', num: fmtNum(s.reads), growth: g.reads, icon: 'fa-eye', bg: 'rgba(16,185,129,.12)', color: '#10b981' },
          { label: 'Followers', num: fmtNum(s.followers), growth: g.followers, icon: 'fa-users', bg: 'rgba(59,130,246,.12)', color: '#3b82f6' },
          { label: 'Earnings', num: fmtNum(s.earnings), growth: g.earnings, icon: 'fa-sack-dollar', bg: 'rgba(245,158,11,.12)', color: '#f59e0b', href: 'earnings.html' },
          { label: 'Contracts', num: fmtNum(s.contracts), growth: g.contracts, note: 'all time', icon: 'fa-file-signature', bg: 'rgba(168,85,247,.12)', color: '#a855f7', href: 'apply-contract.html' },
          { label: 'Completion rate', num: fmtNum(s.completionRate) + '%', growth: g.completionRate, note: 'published ÷ total', icon: 'fa-circle-check', bg: 'rgba(20,184,166,.12)', color: '#14b8a6' }
        );
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load statistics. Please refresh the page.</div>';
    }

    try {
      // Fetch books from API
      var live = await api.getBooks();
      BOOKS.length = 0;
      if (!Array.isArray(live) || live.length === 0) {
        document.getElementById('bookList').innerHTML = '<div class="empty">No books found. Create your first book to get started.</div>';
        return;
      }
      live.forEach(function (b) {
        var rejected = b.status === 'draft' && b.reviewFeedback;
        BOOKS.push({
          id: b.id, title: b.title || 'Untitled',
          genre: b.genre || '', cover: b.cover || '',
          reads: fmtNum(b.reads), likes: fmtNum(b.likes),
          chapters: b.chapterCount || 0,
          status: rejected ? 'rejected' : (b.status || 'draft'),
          statusLabel: rejected ? 'Needs Changes' : undefined,
          statusClass: rejected ? 'rejected' : (b.status || 'draft')
        });
      });
      renderBooks();
    } catch (e) {
      console.error('Failed to load books:', e);
      document.getElementById('bookList').innerHTML = '<div class="empty" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load books. Please refresh the page.</div>';
    }
  }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  var api = {
    getStats: async function () { return await callBackend('/dashboard'); },
    getBooks: async function () { return await callBackend('/books'); },
    init: init,
    _STATS: STATS,
    _BOOKS: BOOKS
  };

  function init() {
    wireEngagementCreator();
    renderBooks();
    hydrate().then(function() {
      renderStats();
    }).catch(function(e) {
      console.error('Hydration failed:', e);
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load data. Please refresh the page.</div>';
    });
    if (window.AuthorDrawer) { window.AuthorDrawer.render('author-center.html'); window.AuthorDrawer.bind(); }
    else {
      document.getElementById('menuBtn').addEventListener('click', openDrawer);
      document.getElementById('drawerClose').addEventListener('click', closeDrawer);
      document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    }
    var nb = document.getElementById('newBookBtn');
    if (nb) nb.addEventListener('click', function () { /* hook up to your "create book" flow */ });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });
  }

  window.AuthorCenterService = api;
})();
