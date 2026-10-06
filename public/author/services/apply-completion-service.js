/** apply-completion-service.js — owns data + render + bindings for apply-completion.html. TODO: POST /api/author/completion */
(function () { 'use strict';
  if (window.ApplyCompletionService && window.ApplyCompletionService.submit && window.ApplyCompletionService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  var BOOKS = [
    { id: 'b1', title: 'The Midnight Protocol', genre: 'Romance', cover: 'https://picsum.photos/seed/book1/100/140', chapters: 24, planned: 24 },
    { id: 'b2', title: 'Echoes of Yesterday', genre: 'Drama', cover: 'https://picsum.photos/seed/book2/100/140', chapters: 18, planned: 20 },
    { id: 'b3', title: 'Crimson Horizons', genre: 'Thriller', cover: 'https://picsum.photos/seed/book3/100/140', chapters: 32, planned: 32 }
  ];
  var selectedBook = null;

  function validate() { document.getElementById('submitBtn').disabled = !(selectedBook && document.getElementById('termsCheck').checked); }

  function renderPicker() {
    var picker = document.getElementById('bookPicker');
    if (!picker) return;
    picker.innerHTML = BOOKS.map(function (b) {
      return '<div class="book-option" data-bid="' + b.id + '"><img src="' + b.cover + '" alt=""/><div class="book-option-info"><div class="book-option-title">' + b.title + '</div><div class="book-option-meta">' + b.genre + ' · ' + b.chapters + '/' + b.planned + ' chapters</div></div><div class="book-option-check"><i class="fas fa-check"></i></div></div>';
    }).join('');
    picker.querySelectorAll('.book-option').forEach(function (el) {
      el.addEventListener('click', function () {
        picker.querySelectorAll('.book-option').forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        selectedBook = el.getAttribute('data-bid');
        var book = BOOKS.find(function (b) { return b.id === selectedBook; });
        if (book) {
          document.getElementById('progressSection').style.display = 'block';
          document.getElementById('chCount').textContent = book.chapters + '/' + book.planned;
          document.getElementById('chFill').style.width = Math.round(book.chapters / book.planned * 100) + '%';
        }
        validate();
      });
    });
  }

  function bind() {
    document.getElementById('termsCheck').addEventListener('change', validate);
    document.getElementById('submitBtn').addEventListener('click', function () {
      this.disabled = true; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
      setTimeout(function () { document.getElementById('formView').style.display = 'none'; document.getElementById('successView').classList.add('show'); }, 1200);
    });
    document.getElementById('doneBtn').addEventListener('click', function () { window.location.href = 'author-center.html'; });
    document.getElementById('backBtn').addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html'; });
  }

  function init() {
    renderPicker();
    bind();
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-completion.html'); window.AuthorDrawer.bind(); }
  }

  var api = window.ApplyCompletionService || {};
  api.submit = api.submit || async function (d) { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/completion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (r.ok) return await r.json(); } catch (e) {} } await delay(250); return { ok: true }; };
  api.init = init;
  api._BOOKS = BOOKS;
  window.ApplyCompletionService = api;
})();
