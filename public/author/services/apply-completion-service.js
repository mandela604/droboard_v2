/**
 * apply-completion-service.js — completion application for a real book.
 *
 * GET  /api/author/books       → picker
 * POST /api/author/completion  → { bookId, chapters, genre, authorNote }
 *
 * A failed request keeps the form and shows the error; success is only shown
 * after the API accepts the application.
 */
(function () {
  'use strict';
  if (window.ApplyCompletionService && window.ApplyCompletionService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 10000 };

  var BOOKS = [];
  var selectedBook = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }

  async function call(path, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.TIMEOUT_MS);
    var init = Object.assign({ credentials: 'include', signal: controller.signal }, opts);
    if (init.body && typeof init.body !== 'string') {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    var res;
    try { res = await fetch(CFG.API_BASE + path, init); }
    catch (e) { clearTimeout(timer); throw new Error(e && e.name === 'AbortError' ? 'Request timed out' : 'Network error'); }
    clearTimeout(timer);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
      var err = new Error(String(msg).replace(/_/g, ' ')); err.status = res.status; throw err;
    }
    return body;
  }

  var api = window.ApplyCompletionService || {};
  api.listBooks = async function () { return await call('/books'); };
  api.submit = async function (d) { return await call('/completion', { method: 'POST', body: d }); };

  function validate() {
    document.getElementById('submitBtn').disabled = !(selectedBook && document.getElementById('termsCheck').checked);
  }

  function renderPicker(books) {
    var picker = document.getElementById('bookPicker');
    if (!books || !books.length) {
      picker.innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">You have no books to submit yet.</div>';
      return;
    }
    picker.innerHTML = books.map(function (b) {
      var ch = Number(b.chapterCount) || 0;
      return '<div class="book-option" data-bid="' + esc(b.id) + '">'
        + '<img src="' + esc(b.cover || '../assets/droboard-icon.png') + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
        + '<div class="book-option-info"><div class="book-option-title">' + esc(b.title || 'Untitled') + '</div>'
        + '<div class="book-option-meta">' + esc(b.genre || 'No genre') + ' · ' + ch + ' chapter' + (ch === 1 ? '' : 's') + '</div></div>'
        + '<div class="book-option-check"><i class="fas fa-check"></i></div></div>';
    }).join('');
    Array.prototype.forEach.call(picker.querySelectorAll('.book-option'), function (el) {
      el.addEventListener('click', function () {
        Array.prototype.forEach.call(picker.querySelectorAll('.book-option'), function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        selectedBook = BOOKS.filter(function (b) { return String(b.id) === String(el.getAttribute('data-bid')); })[0] || null;
        if (selectedBook) {
          document.getElementById('progressSection').style.display = 'block';
          document.getElementById('chCount').textContent = (Number(selectedBook.chapterCount) || 0) + ' chapters';
          document.getElementById('chFill').style.width = '100%';
        }
        validate();
      });
    });
  }

  function showLoadError(e) {
    document.getElementById('bookPicker').innerHTML =
      '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">'
      + 'Could not load your books. ' + esc((e && e.message) || 'Please try again.')
      + '<div><button type="button" id="retryBooks" style="margin-top:10px;padding:7px 16px;border-radius:999px;border:1px solid var(--bd);background:var(--l2);color:var(--tx-body);font-weight:700;cursor:pointer">Retry</button></div></div>';
    var btn = document.getElementById('retryBooks');
    if (btn) btn.addEventListener('click', loadBooks);
  }

  async function loadBooks() {
    document.getElementById('bookPicker').innerHTML = '<div class="empty" style="padding:20px;text-align:center;color:var(--tx-muted);font-size:12.5px">Loading your books…</div>';
    try {
      BOOKS = await api.listBooks();
      if (!Array.isArray(BOOKS)) BOOKS = [];
      renderPicker(BOOKS);
    } catch (e) {
      showLoadError(e);
    }
  }

  async function submit() {
    if (!selectedBook) { toast('Select a book first'); return; }
    var notes = document.getElementById('notes').value.trim();
    var btn = document.getElementById('submitBtn');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    try {
      await api.submit({
        bookId: selectedBook.id,
        chapters: Number(selectedBook.chapterCount) || 0,
        genre: selectedBook.genre || '',
        authorNote: notes,
        notes: notes
      });
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').classList.add('show');
    } catch (e) {
      toast('Could not submit: ' + (e.message || 'unknown error'));
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function bind() {
    document.getElementById('termsCheck').addEventListener('change', validate);
    document.getElementById('submitBtn').addEventListener('click', submit);
    document.getElementById('doneBtn').addEventListener('click', function () { window.location.href = 'author-center.html'; });
    document.getElementById('backBtn').addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html'; });
  }

  function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-completion.html'); window.AuthorDrawer.bind(); }
    bind();
    loadBooks();
  }

  api.init = init;
  window.ApplyCompletionService = api;
})();
