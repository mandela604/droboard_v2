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
      return '<div class="stat-card"' + (s.href ? ' onclick="location.href=\'' + s.href + '\'" style="cursor:pointer"' : '') + '>'
        + '<div class="stat-icon" style="background:' + s.bg + ';color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>'
        + '<div class="stat-label">' + s.label + '</div>'
        + '<div class="stat-num">' + s.num + '</div>'
        + '<div class="stat-growth"><i class="fas fa-arrow-up"></i> ' + s.growth + ' <span class="dim">vs last 30d</span></div>'
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
      // Get current user from session
      var userSession = window.AuthSession && window.AuthSession.getSync ? window.AuthSession.getSync() : {};
      var currentUser = userSession.fullName || userSession.name || 'Welcome';
      
      // Update welcome message with real user name
      var welcomeEl = document.querySelector('h2[id*="welcome"]') || document.querySelector('[data-role="welcome"]');
      if (welcomeEl) {
        welcomeEl.textContent = 'Welcome back, ' + currentUser + ' 👋';
      }
      
      // Fetch stats from API
      var statsRes = await api.getStats();
      console.log('Stats response:', statsRes);
      
      // Handle different response formats
      var statsArray = Array.isArray(statsRes) ? statsRes : (statsRes && statsRes.stats) ? statsRes.stats : [];
      
      if (statsArray && statsArray.length > 0) {
        STATS.length = 0;
        statsArray.forEach(function (s) {
          STATS.push({
            label: s.label || s.name || 'Unknown',
            num: s.value || s.num || '0',
            growth: s.growth || '0%',
            icon: s.icon || 'fa-chart-simple',
            bg: s.bg || 'rgba(200,200,200,.08)',
            color: s.color || '#666',
            href: s.href || ''
          });
        });
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
