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
  function demoBooks() {
    return [
      { id: 'b1', title: 'Bound By Obsession', genre: 'Romance', status: 'published', chapters: 56, reads: '2.3M', cover: 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=300&h=400&fit=crop' },
      { id: 'b2', title: 'Second Chance', genre: 'Drama', status: 'ongoing', chapters: 24, reads: '480K', cover: 'https://i.pravatar.cc/300?img=12' }
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

  var STATUS_LABEL = { published: 'Published', ongoing: 'Ongoing', draft: 'Draft', scheduled: 'Scheduled', paused: 'Paused', rejected: 'Rejected' };

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
    document.getElementById('bookList').innerHTML = BOOKS.map(function (b) {
      return '<div class="book-card" onclick="location.href=\'book-workspace.html?book=' + b.id + '\'">'
        + '<div class="book-cover"><img src="' + b.cover + '" alt="' + b.title + '" loading="lazy"/></div>'
        + '<div class="book-info">'
        + '<div class="book-title-row"><div class="book-title">' + b.title + '</div><i class="fas fa-chevron-right book-chev"></i></div>'
        + '<div class="book-genre">' + b.genre + '</div>'
        + '<div class="book-stats"><div class="book-stat"><i class="far fa-eye"></i> ' + b.reads + '</div>'
        + '<div class="book-stat"><i class="far fa-heart"></i> ' + b.likes + '</div>'
        + '<div class="book-stat"><i class="fas fa-list-ul"></i> ' + b.chapters + ' ch</div></div>'
        + '<div class="book-foot"><span class="status-badge ' + b.status + '">' + STATUS_LABEL[b.status] + '</span></div>'
        + '</div></div>';
    }).join('');
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  function init() {
    renderStats();
    renderBooks();
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
