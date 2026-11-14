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

  function renderStats() {
    if (!STATS || STATS.length === 0) {
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load statistics</div>';
      return;
    }
    document.getElementById('statGrid').innerHTML = STATS.map(function (s) {
      return '<div class="stat-card fade"><div class="stat-icon" style="background:' + s.bg + ';color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>'
        + '<div class="stat-label">' + s.label + '</div><div class="stat-num">' + s.num + '</div>'
        + '<div class="stat-growth"><i class="fas fa-arrow-up"></i> ' + s.growth + ' <span class="dim">vs last 30d</span></div></div>';
    }).join('');
  }

  function renderQA() {
    document.getElementById('qaGrid').innerHTML = QUICK_ACTIONS.map(function (q) {
      return '<div class="qa-item" onclick="location.href=\'' + q.href + '\'"><div class="qa-icon" style="background:' + q.bg + ';color:' + q.color + '"><i class="fas ' + q.icon + '"></i></div><div class="qa-label">' + q.label + '</div></div>';
    }).join('');
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  function init() {
    renderQA();
    var params = new URLSearchParams(location.search);
    var bookId = params.get('book') || '';
    
    // Fetch overview stats from API
    api.getOverview(bookId)
      .then(function(data) {
        if (data && data.stats && Array.isArray(data.stats)) {
          STATS.length = 0;
          data.stats.forEach(function(s) {
            STATS.push({
              label: s.label || s.name || 'Unknown',
              num: s.value || '0',
              growth: s.growth || '0%',
              icon: s.icon || 'fa-chart-simple',
              bg: s.bg || 'rgba(200,200,200,.08)',
              color: s.color || '#666'
            });
          });
        }
        renderStats();
      })
      .catch(function(e) {
        console.error('Failed to load overview:', e);
        document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load book statistics. Please refresh the page.</div>';
      });
    
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
  api.getOverview = api.getOverview || async function (bookId) {
    return await callBackend('/books/' + (bookId || '') + '/overview');
  };
  api.init = init;
  window.BookOverviewService = api;
})();
