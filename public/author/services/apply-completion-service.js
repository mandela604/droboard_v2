/** apply-completion-service.js — owns data + render + bindings for apply-completion.html. Uses /api/author/completion. */
(function () { 'use strict';
  if (window.ApplyCompletionService && window.ApplyCompletionService.submit && window.ApplyCompletionService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  var selectedBook = null;

  function validate() { document.getElementById('submitBtn').disabled = !(selectedBook && document.getElementById('termsCheck').checked); }

  function renderPicker(books) {
    var picker = document.getElementById('bookPicker');
    if (!picker) return;
    if (!books || books.length === 0) {
      picker.innerHTML = '<div class="empty">No books available.</div>';
      return;
    }
    picker.innerHTML = books.map(function (b) {
      return '<div class="book-option" data-bid="' + b.id + '"><img src="' + b.cover + '" alt=""/><div class="book-option-info"><div class="book-option-title">' + b.title + '</div><div class="book-option-meta">' + b.genre + ' · ' + b.chapters + '/' + b.planned + ' chapters</div></div><div class="book-option-check"><i class="fas fa-check"></i></div></div>';
    }).join('');
    picker.querySelectorAll('.book-option').forEach(function (el) {
      el.addEventListener('click', function () {
        picker.querySelectorAll('.book-option').forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        selectedBook = el.getAttribute('data-bid');
        var book = books.find(function (b) { return b.id === selectedBook; });
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
    // Load books from API
    fetch(CFG.API_BASE + '/books', { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('Books API failed: ' + r.status); return r.json(); })
      .then(function (books) {
        if (!Array.isArray(books) || books.length === 0) {
          document.getElementById('bookPicker').innerHTML = '<div class="empty">No books available.</div>';
        } else {
          renderPicker(books);
        }
        bind();
        if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-completion.html'); window.AuthorDrawer.bind(); }
      })
      .catch(function (e) {
        document.getElementById('bookPicker').innerHTML = '<div class="empty">Failed to load books. Please try again.</div>';
      });
  }

  var api = window.ApplyCompletionService || {};
  api.submit = api.submit || async function (d) {
    var r = await fetch(CFG.API_BASE + '/completion', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    });
    if (!r.ok) throw new Error('Submit failed: ' + r.status);
    return await r.json();
  };
  api.init = init;
  window.ApplyCompletionService = api;
})();
