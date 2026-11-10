/** request-chapter-review-service.js — Data + UI for request-chapter-review.html. Uses /api/author/chapter-reviews. */
(function () {
  'use strict';
  if (window.ChapterReviewService && window.ChapterReviewService.init) return;
  var Svc = window.ChapterReviewService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API */
  Svc.listBooks = Svc.listBooks || async function () {
    var r = await fetch(CFG.API_BASE + '/books', { credentials: 'include' });
    if (!r.ok) throw new Error('Books API failed: ' + r.status);
    return await r.json();
  };
  Svc.submit = Svc.submit || async function (d) {
    var r = await fetch(CFG.API_BASE + '/chapter-reviews', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    if (!r.ok) throw new Error('Submit failed: ' + r.status);
    return await r.json();
  };

  var openBooks = {};
  var currentBookId = null;
  var currentChNum = null;

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  function renderBooks(books) {
    var el = document.getElementById('bookList');
    el.innerHTML = '';
    if (!Array.isArray(books) || books.length === 0) {
      el.innerHTML = '<div class="empty">No books available.</div>';
      return;
    }
    var hasAny = false;
    el.innerHTML = books.map(function(book){
      if (!book.chapters || !book.chapters.length) return '';
      hasAny = true;
      var isOpen = openBooks[book.id];
      var chCount = book.chapters.length;
      var totalWords = book.chapters.reduce(function(sum, ch) { return sum + (ch.words || 0); }, 0);
      var needsRev = book.chapters.some(function(ch) { return ch.status === 'revision'; });
      return '<div class="book-section' + (isOpen ? ' open' : '') + '" data-bid="' + book.id + '">'
        + (book.cover ? '<div class="dbc-cover" style="background-image:url(\'' + book.cover + '\')"></div>' : '')
        + '<div class="dbc-body"><div class="dbc-title">' + book.title + '</div>'
        + '<div class="dbc-meta">' + chCount + ' chapter' + (chCount > 1 ? 's' : '') + '</div></div></div>';
    }).join('');
  }

  function renderChapters(chapters, isOpen) {
    document.getElementById('chapterList').innerHTML = chapters.map(function(ch, i) {
      return '<div class="chapter-row' + (i === 0 ? ' first' : '') + '" data-num="' + ch.num + '">'
        + '<div class="ch-num">Ch. ' + ch.num + '</div>'
        + '<div class="ch-title">' + ch.title + '</div>'
        + '<div class="ch-status ' + ch.status + '">' + ch.status + '</div>'
        + '<div class="ch-datetime">' + ch.date + '</div>'
        + '<div class="ch-more"><i class="fas fa-ellipsis"></i></div>'
        + '</div>';
    }).join('');
    document.getElementById('emptyState').classList.toggle('show', chapters.length === 0);
  }

  function bindChapterRows() {
    document.querySelectorAll('.chapter-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var num = this.dataset.num;
        currentChNum = parseInt(num);
        var chapter = currentBook.chapters.find(function(ch) { return ch.num === currentChNum; });
        if (chapter) showChapterModal(chapter);
      });
    });
  }

  function showChapterModal(chapter) {
    var modal = document.getElementById('chapterModal');
    if (!modal) return;
    modal.innerHTML = '<div class="cm-header"><h3>' + chapter.title + '</h3><button class="cm-close" onclick="closeChapterModal()"><i class="fas fa-times"></i></button></div>'
      + '<div class="cm-content"><div class="cm-author-notes"><h4>Author notes</h4><p>' + (chapter.authorNotes || 'No notes.') + '</p></div>'
      + '<div class="cm-editor-notes"><h4>Editor notes</h4><p>' + (chapter.editorNotes || 'No notes yet.') + '</p></div></div>'
      + '<div class="cm-actions"><button class="btn btn-primary" onclick="requestRevision(' + currentChNum + ')">Request Revision</button><button class="btn" onclick="closeChapterModal()">Close</button></div>';
    modal.classList.add('open');
  }

  function closeChapterModal() {
    var modal = document.getElementById('chapterModal');
    if (modal) modal.classList.remove('open');
  }

  function init() {
    // Load books from API
    Svc.listBooks()
      .then(function(books) {
        if (!Array.isArray(books) || books.length === 0) {
          document.getElementById('bookList').innerHTML = '<div class="empty">No books available.</div>';
          return;
        }
        renderBooks(books);
        // Open first book by default
        openBooks[books[0].id] = true;
        currentBookId = books[0].id;
        renderChapters(books[0].chapters || [], true);
        bindChapterRows();
      })
      .catch(function(e) {
        document.getElementById('bookList').innerHTML = '<div class="empty">Failed to load books. Please try again.</div>';
      });
  }

  window.ChapterReviewService = Svc;
  window.ChapterReviewService.init = init;
})();
