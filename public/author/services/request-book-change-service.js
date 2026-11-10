/** request-book-change-service.js — Data + UI for request-book-change.html.
 * Uses GET /api/author/books, POST /api/author/books/:id/change-requests.
 */
(function () {
  'use strict';
  if (window.BookChangeService && window.BookChangeService.init) return;
  var Svc = window.BookChangeService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API */
  Svc.listBooks = Svc.listBooks || async function () {
    var r = await fetch(CFG.API_BASE + '/books', { credentials: 'include' });
    if (!r.ok) throw new Error('Books API failed: ' + r.status);
    return await r.json();
  };
  Svc.submit = Svc.submit || async function (bookId, payload) {
    var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/change-requests', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('Submit failed: ' + r.status);
    return await r.json();
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var BOOKS = [];

  var CHANGES = [
    { icon: 'fa-pen', label: 'Change Title' },
    { icon: 'fa-image', label: 'Change Cover' },
    { icon: 'fa-align-left', label: 'Change Synopsis' },
    { icon: 'fa-layer-group', label: 'Reorder Chapters' },
    { icon: 'fa-tag', label: 'Change Genre/Tags' }
  ];

  var FIELDS = {
    'Change Title': { key: 'title', label: 'Title', type: 'text' },
    'Change Synopsis': { key: 'synopsis', label: 'Synopsis', type: 'textarea' },
    'Change Genre/Tags': { key: 'genre', label: 'Genre / Tags', type: 'text' }
  };

  function currentValue(book, key) {
    if (key === 'title') return book.title || '';
    if (key === 'synopsis') return book.desc || '';
    if (key === 'genre') return book.genre || '';
    return '';
  }

  function renderBooks(books) {
    var el = document.getElementById('bookList');
    el.innerHTML = '';
    if (!Array.isArray(books) || books.length === 0) {
      el.innerHTML = '<div class="empty">No books available.</div>';
      return;
    }
    el.innerHTML = books.map(function(book) {
      return '<div class="book-row" data-bid="' + book.id + '">'
        + '<div class="book-header">'
        + '<div class="book-cover" style="background-image:url(\'' + (book.cover || '') + '\')"></div>'
        + '<div class="book-info"><div class="book-title">' + book.title + '</div>'
        + '<div class="book-meta">' + (book.genre || '') + ' · ' + (book.status || '') + '</div></div>'
        + '<div class="book-action"><i class="fas fa-chevron-right"></i></div>'
        + '</div></div>';
    }).join('');
  }

  function init() {
    // Load books from API
    Svc.listBooks()
      .then(function(books) {
        if (!Array.isArray(books) || books.length === 0) {
          document.getElementById('bookList').innerHTML = '<div class="empty">No books available.</div>';
          return;
        }
        BOOKS.length = 0;
        books.forEach(function(b) { BOOKS.push(b); });
        renderBooks(BOOKS);
      })
      .catch(function(e) {
        document.getElementById('bookList').innerHTML = '<div class="empty">Failed to load books. Please try again.</div>';
      });
  }

  window.BookChangeService = Svc;
  window.BookChangeService.init = init;
})();
