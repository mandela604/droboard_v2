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
    try { var res = await fetch(CFG.API_BASE + path, { signal: c.signal }); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  var STATS = [
    { label: 'Total Reads', num: '2.3M', growth: '12.5%', icon: 'fa-eye', bg: 'var(--primary-soft)', color: 'var(--primary)' },
    { label: 'Likes', num: '189K', growth: '8.3%', icon: 'fa-heart', bg: 'var(--purple-soft)', color: 'var(--purple)' },
    { label: 'Earnings', num: '$3,240', growth: '15.2%', icon: 'fa-sack-dollar', bg: 'var(--warning-soft)', color: 'var(--warning)' },
    { label: 'Comments', num: '12.4K', growth: '6.1%', icon: 'fa-comment', bg: 'var(--blue-soft)', color: 'var(--blue)' }
  ];

  var QUICK_ACTIONS = [
    { label: 'New Chapter', icon: 'fa-plus', bg: 'var(--primary-soft)', color: 'var(--primary)', href: 'book-workspace.html' },
    { label: 'Plotting', icon: 'fa-diagram-project', bg: 'var(--purple-soft)', color: 'var(--purple)', href: 'plotting.html' },
    { label: 'Analytics', icon: 'fa-chart-line', bg: 'var(--blue-soft)', color: 'var(--blue)', href: 'book-analytics.html' },
    { label: 'Schedule', icon: 'fa-calendar-days', bg: 'var(--warning-soft)', color: 'var(--warning)', href: '#' }
  ];

  var ACTIVITY = [
    { title: 'Chapter 56 published', sub: '\u201cThe Wedding That Closes the Wound\u201d went live', time: '2h ago', icon: 'fa-book-open', bg: 'var(--success-soft)', color: '#158a48' },
    { title: 'New comments', sub: '48 new reader comments on Chapter 55', time: '5h ago', icon: 'fa-comment', bg: 'var(--blue-soft)', color: 'var(--blue)' },
    { title: 'Earnings update', sub: '+$128.40 from paid chapter unlocks', time: '1d ago', icon: 'fa-sack-dollar', bg: 'var(--warning-soft)', color: 'var(--warning)' },
    { title: 'Milestone reached', sub: '2.3M total reads — badge unlocked', time: '2d ago', icon: 'fa-trophy', bg: 'var(--purple-soft)', color: 'var(--purple)' },
    { title: 'Contract signed', sub: 'Exclusive publishing agreement activated', time: '5d ago', icon: 'fa-file-signature', bg: '#F3E9DE', color: '#9A6A3A' }
  ];

  function renderStats() {
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

  function renderActivity() {
    document.getElementById('activityList').innerHTML = ACTIVITY.map(function (a) {
      return '<div class="activity-item fade"><div class="act-icon" style="background:' + a.bg + ';color:' + a.color + '"><i class="fas ' + a.icon + '"></i></div>'
        + '<div class="act-body"><div class="act-title">' + a.title + '</div><div class="act-sub">' + a.sub + '</div></div>'
        + '<div class="act-time">' + a.time + '</div></div>';
    }).join('');
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  function init() {
    renderStats();
    renderQA();
    renderActivity();
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
    if (CFG.USE_API) { try { return await callBackend('/books/' + (bookId || 'b1') + '/overview'); } catch (e) {} }
    await delay();
    return { stats: { reads: '2.3M', likes: '189K', chapters: 56 }, activity: [{ text: 'Chapter 56 submitted', time: '2h ago' }, { text: 'New follower milestone', time: '1d ago' }], quickActions: ['New Chapter', 'Plotting', 'Characters'] };
  };
  api.init = init;
  window.BookOverviewService = api;
})();
