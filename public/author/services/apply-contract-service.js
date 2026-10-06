/** apply-contract-service.js — owns data + render + bindings for apply-contract.html. TODO: GET/POST /api/author/contracts */
(function () { 'use strict';
  if (window.ApplyContractService && window.ApplyContractService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  var BOOKS = [
    { id: 'b1', title: 'The Midnight Protocol', genre: 'Romance', cover: 'https://picsum.photos/seed/book1/100/140', chapters: 24, status: 'none' },
    { id: 'b2', title: 'Echoes of Yesterday', genre: 'Drama', cover: 'https://picsum.photos/seed/book2/100/140', chapters: 18, status: 'contracted' },
    { id: 'b3', title: 'Crimson Horizons', genre: 'Thriller', cover: 'https://picsum.photos/seed/book3/100/140', chapters: 32, status: 'applied' },
    { id: 'b4', title: 'Starlight Crossing', genre: 'Sci-Fi', cover: 'https://picsum.photos/seed/book4/100/140', chapters: 28, status: 'review' }
  ];

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  function getTag(status) {
    if (status === 'contracted') return '<span class="status-tag tag-contracted"><i class="fas fa-check-circle"></i> Contracted</span>';
    if (status === 'applied') return '<span class="status-tag tag-pending"><i class="fas fa-clock"></i> Pending</span>';
    if (status === 'review') return '<span class="status-tag tag-pending"><i class="fas fa-file-signature"></i> Ready to Sign</span>';
    return '<span class="status-tag tag-none">No Contract</span>';
  }

  function getAccordionContent(status, b) {
    if (status === 'applied') {
      return '<div class="status-detail applied"><i class="fas fa-clock"></i> Application submitted — awaiting review from your editor.</div>';
    }
    if (status === 'contracted') {
      return '<div class="status-detail contracted"><i class="fas fa-check-circle"></i> Contract active since Jan 15, 2026.</div>';
    }
    if (status === 'review') {
      return '<button class="apply-btn sign" data-action="sign" data-bid="' + b.id + '"><i class="fas fa-file-signature"></i> Review & Sign Contract</button>';
    }
    return '<button class="apply-btn" data-action="apply" data-bid="' + b.id + '"><i class="fas fa-file-signature"></i> Apply for Contract</button>';
  }

  function renderList() {
    var list = document.getElementById('bookList');
    if (!list) return;
    list.innerHTML = BOOKS.map(function (b) {
      return '<div class="book-row" data-bid="' + b.id + '">'
        + '<div class="book-header">'
        + '<img class="book-cover" src="' + b.cover + '" alt=""/>'
        + '<div class="book-info"><div class="book-title">' + b.title + '</div>'
        + '<div class="book-meta">' + b.genre + ' · ' + b.chapters + ' chapters</div></div>'
        + getTag(b.status)
        + '<i class="fas fa-chevron-down book-chevron"></i></div>'
        + '<div class="book-accordion"><div class="accordion-inner">'
        + getAccordionContent(b.status, b)
        + '</div></div></div>';
    }).join('');

    list.querySelectorAll('.book-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var row = h.parentElement;
        var wasOpen = row.classList.contains('open');
        list.querySelectorAll('.book-row').forEach(function (r) { r.classList.remove('open'); });
        if (!wasOpen) row.classList.add('open');
      });
    });

    list.querySelectorAll('[data-action="apply"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var bid = btn.getAttribute('data-bid');
        var book = BOOKS.find(function (x) { return x.id === bid; });
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
        setTimeout(function () {
          book.status = 'applied';
          renderList();
          toast(book.title + ' — application submitted!');
        }, 1200);
      });
    });

    list.querySelectorAll('[data-action="sign"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var bid = btn.getAttribute('data-bid');
        openContractModal(bid);
      });
    });
  }

  function openContractModal(bid) {
    var book = BOOKS.find(function (x) { return x.id === bid; });
    if (!book) return;
    document.getElementById('contractBook').innerHTML =
      '<img src="' + book.cover + '" alt=""/>'
      + '<div><div class="contract-book-title">' + book.title + '</div>'
      + '<div class="contract-book-meta">' + book.genre + ' · ' + book.chapters + ' chapters</div></div>';
    document.getElementById('contractModal').classList.add('open');
    document.getElementById('contractModal')._bid = bid;
  }

  function handleReject() {
    var btn = document.getElementById('rejectBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting…';
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    setTimeout(function () {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-xmark"></i> Reject';
      book.status = 'none';
      renderList();
      toast(book.title + ' — contract rejected.');
    }, 1200);
  }

  function handleAccept() {
    var btn = document.getElementById('acceptBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing…';
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    setTimeout(function () {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-check"></i> Accept';
      book.status = 'contracted';
      renderList();
      toast(book.title + ' — contract signed!');
    }, 1200);
  }

  function init() {
    renderList();
    document.getElementById('modalClose').onclick = function () {
      document.getElementById('contractModal').classList.remove('open');
    };
    document.getElementById('contractModal').onclick = function (e) {
      if (e.target === this) this.classList.remove('open');
    };
    document.getElementById('backBtn').addEventListener('click', function () {
      if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html';
    });
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-contract.html'); window.AuthorDrawer.bind(); }
    window.handleReject = handleReject;
    window.handleAccept = handleAccept;
  }

  var api = window.ApplyContractService || {};
  api.list = api.list || async function () { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; };
  api.submit = api.submit || async function (d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true, id: 'CT-' + Date.now() }; };
  api.init = init;
  api._BOOKS = BOOKS;
  api._renderList = renderList;
  api._toast = toast;
  window.ApplyContractService = api;
  window.handleReject = handleReject;
  window.handleAccept = handleAccept;
})();
