/**
 * earnings-service.js — Author-local wrapper (backend-ready) + render + bindings for earnings.html.
 * Delegates to shared AuthorFinance until backend split.
 * TODO backend: GET /api/author/earnings
 */
(function () {
  'use strict';
  if (window.AuthorEarningsService && window.AuthorEarningsService.init) return;

  function getFinance() { return window.AuthorFinance || window.AuthorEarningsService.__fallbackFinance || null; }

  var allBooks = [];
  var bookPage = 1;
  var BOOKS_PER_PAGE = 4;

  function toast(m) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) { window.AuthorDrawer.toast(m); return; }
    var t = document.getElementById('toastEl') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toastEl', className: 'toast' }));
    t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function fmt(n) {
    var f = window.AuthorFinance ? window.AuthorFinance.fmtCurrency : (window.AuthorEarningsService.fmtCurrency || function (x) { return '$' + x; });
    return f(n);
  }

  function renderBookPage() {
    var start = (bookPage - 1) * BOOKS_PER_PAGE;
    var page = allBooks.slice(start, start + BOOKS_PER_PAGE);
    document.getElementById('bookEarnings').innerHTML = page.map(function (b) {
      return '<div class="book-earn-card">'
        + '<div class="book-earn-cover"><img src="' + b.cover + '" alt="' + b.title + '" loading="lazy"/></div>'
        + '<div class="book-earn-info"><div class="book-earn-title">' + b.title + '</div><div class="book-earn-stats">' + b.reads + ' reads · ' + b.chapters + ' chapters</div></div>'
        + '<div class="book-earn-amount">' + fmt(b.earnings) + '</div></div>';
    }).join('');
    var totalPages = Math.ceil(allBooks.length / BOOKS_PER_PAGE);
    if (totalPages <= 1) { document.getElementById('bookPagination').innerHTML = ''; return; }
    var h = '';
    h += '<button class="pg-btn"' + (bookPage <= 1 ? ' disabled' : '') + ' onclick="goBookPage(' + (bookPage - 1) + ')"><i class="fas fa-chevron-left"></i></button>';
    for (var i = 1; i <= totalPages; i++) h += '<button class="pg-btn' + (i === bookPage ? ' active' : '') + '" onclick="goBookPage(' + i + ')">' + i + '</button>';
    h += '<button class="pg-btn"' + (bookPage >= totalPages ? ' disabled' : '') + ' onclick="goBookPage(' + (bookPage + 1) + ')"><i class="fas fa-chevron-right"></i></button>';
    document.getElementById('bookPagination').innerHTML = h;
  }

  function goBookPage(p) { bookPage = p; renderBookPage(); }

  async function render() {
    var earnings = await window.AuthorEarningsService.getEarnings();
    allBooks = earnings.byBook;
    document.getElementById('balanceCard').innerHTML =
      '<div class="balance-label">Available Balance</div>'
      + '<div class="balance-amount">' + fmt(earnings.balance) + '</div>'
      + '<div class="balance-sub">'
      + '<div class="balance-sub-item pending"><div class="balance-sub-label">Pending</div><div class="balance-sub-val">' + fmt(earnings.pending) + '</div></div>'
      + '<div class="balance-sub-item"><div class="balance-sub-label">Lifetime Earnings</div><div class="balance-sub-val">' + fmt(earnings.lifetime) + '</div></div></div>'
      + '<div class="balance-actions">'
      + '<a class="btn btn-white" href="withdrawal-request.html"><i class="fas fa-building-columns"></i> Withdraw</a>'
      + '<a class="btn btn-outline" href="transaction-history.html"><i class="fas fa-receipt"></i> History</a></div>';
    var delta = earnings.lastMonth > 0 ? ((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth * 100).toFixed(1) : 0;
    var isUp = delta >= 0;
    document.getElementById('monthRow').innerHTML =
      '<div class="month-card"><div class="month-label">This Month</div><div class="month-val">' + fmt(earnings.thisMonth) + '</div>'
      + '<div class="month-delta ' + (isUp ? 'up' : 'down') + '"><i class="fas fa-arrow-' + (isUp ? 'up' : 'down') + '"></i> ' + Math.abs(delta) + '% vs last</div></div>'
      + '<div class="month-card"><div class="month-label">Last Month</div><div class="month-val">' + fmt(earnings.lastMonth) + '</div>'
      + '<div class="month-delta" style="color:var(--muted)">Completed</div></div>';
    renderBookPage();
  }

  function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('earnings.html'); window.AuthorDrawer.bind(); }
    window.goBookPage = goBookPage;
    render();
  }

  var api = window.AuthorEarningsService || {};
  api.getEarnings = api.getEarnings || async function () { return window.AuthorFinance ? window.AuthorFinance.getEarnings() : { balance: 0, pending: 0, lifetime: 0, thisMonth: 0, lastMonth: 0, byBook: [] }; };
  api.fmtCurrency = api.fmtCurrency || function (n) { return window.AuthorFinance ? window.AuthorFinance.fmtCurrency(n) : '$' + n; };
  api.init = init;
  api._renderBookPage = renderBookPage;
  window.AuthorEarningsService = api;
  window.goBookPage = goBookPage;
})();
