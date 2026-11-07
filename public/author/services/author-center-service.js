/**
 * author-center-service.js — Data layer + render + bindings for author-center.html (Dashboard).
 * TODO backend: GET /api/author/dashboard, GET /api/author/books
 */
(function () {
  'use strict';
  if (window.AuthorCenterService && window.AuthorCenterService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  // Fallback demo (mirrors current inline STATS/BOOKS until backend live)
  function demoStats() { return { books: 6, reads: '2.3M', earnings: 1240, followers: 18900 }; }
  // Full inline demo list (mirrors BOOKS constant on lines 34-43)
  function demoBooks() {
    return [
      { id: 'b1', title: 'Bound By Obsession', genre: 'Romance · Drama', reads: '2.3M', likes: '189K', chapters: 56, status: 'published', cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' },
      { id: 'b2', title: 'The Way You Stay', genre: 'Romance · Contemporary', reads: '1.8M', likes: '142K', chapters: 38, status: 'ongoing', cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=300&h=400&fit=crop' },
      { id: 'b3', title: 'Yours, Always', genre: 'Romance · Second Chance', reads: '1.6M', likes: '118K', chapters: 42, status: 'published', cover: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&h=400&fit=crop' },
      { id: 'b4', title: 'Until Forever', genre: 'Romance · Young Adult', reads: '980K', likes: '96K', chapters: 27, status: 'draft', cover: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=300&h=400&fit=crop' }
    ];
  }

  var STATS = [
    { label: 'Total Reads', num: '18.7M', growth: '12.5%', icon: 'fa-chart-simple', bg: 'rgba(255,45,85,.08)', color: 'var(--pink)' },
    { label: 'Followers', num: '128K', growth: '8.3%', icon: 'fa-users', bg: 'var(--purple-soft)', color: 'var(--purple)' },
    { label: 'Earnings', num: '$8,642', growth: '15.2%', icon: 'fa-sack-dollar', bg: 'var(--warning-soft)', color: 'var(--warning)', href: 'earnings.html' },
    { label: 'Completion Rate', num: '62%', growth: '6.1%', icon: 'fa-chart-line', bg: 'var(--blue-soft)', color: 'var(--blue)' }
  ];

  var BOOKS = [
    { id: 'b1', title: 'Bound By Obsession', genre: 'Romance · Drama', reads: '2.3M', likes: '189K', chapters: 56, status: 'published',
      cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' },
    { id: 'b2', title: 'The Way You Stay', genre: 'Romance · Contemporary', reads: '1.8M', likes: '142K', chapters: 38, status: 'ongoing',
      cover: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=300&h=400&fit=crop' },
    { id: 'b3', title: 'Yours, Always', genre: 'Romance · Second Chance', reads: '1.6M', likes: '118K', chapters: 42, status: 'published',
      cover: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&h=400&fit=crop' },
    { id: 'b4', title: 'Until Forever', genre: 'Romance · Young Adult', reads: '980K', likes: '96K', chapters: 27, status: 'draft',
      cover: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=300&h=400&fit=crop' }
  ];


  function renderStats() {
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

  // Story-wide engagement: the sheet owns validation and the payload; this
  // service decides where it lands — the backend when live, the demo row when not.
  function createEngagement(bookId, payload) {
    if (!CFG.USE_API) {
      // Demo: no backend write, so the row lives on the in-memory book only.
      return Promise.resolve(Object.assign({ id: 'demo_' + Date.now().toString(36) }, payload));
    }
    return fetch(CFG.API_BASE + '/books/' + encodeURIComponent(bookId) + '/engagement', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data && data.error ? String(data.error) : 'Could not save (' + r.status + ')');
        return data;
      });
    });
  }

  function onCreated(book, item) {
    book.engagements = (book.engagements || []).concat([item]);
    if (!CFG.USE_API) {
      if (window.AuthorDrawer) window.AuthorDrawer.toast('Demo only — not saved to a server.');
      return;
    }
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

  // Live books replace the demo list; a rejected manuscript (draft + editor
  // feedback) reads as "Needs Changes" so the author can act on it.
  async function hydrate() {
    // Demo mode: nothing to load, use inline BOOKS (lines 34-43 above)
    if (!CFG.USE_API) return;
    try {
      var live = await api.getBooks();
      if (!Array.isArray(live)) { BOOKS.length = 0; BOOKS.push(...clone(demoBooks())); renderBooks(); return; }
      BOOKS.length = 0;
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
      // Network error or 500 — fall back to demo list
      BOOKS.length = 0; BOOKS.push(...clone(demoBooks()));
      renderBooks();
    }
  }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function init() {
    renderStats();
    wireEngagementCreator();
    renderBooks();
    hydrate();
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

  var api = window.AuthorCenterService || {};
  api.getStats = api.getStats || async function () { if (CFG.USE_API) { try { return await callBackend('/dashboard'); } catch (e) {} } await delay(); return demoStats(); };
  api.getBooks = api.getBooks || async function () { if (CFG.USE_API) { try { return await callBackend('/books'); } catch (e) {} } await delay(); return clone(demoBooks()); };
  api.init = init;
  api._STATS = STATS;
  api._BOOKS = BOOKS;
  window.AuthorCenterService = api;
})();
