/**
 * request-chapter-review-service.js — chapter review requests for real books.
 *
 * GET  /api/author/books                    → book list
 * GET  /api/author/books/:id/chapters       → chapters (n, title, words, status)
 * POST /api/author/chapter-reviews          → { bookId, chapterId, chapterNum, … }
 *
 * Everything comes from the API; a failure shows an error with a retry and a
 * submit is only confirmed after the backend accepts it.
 */
(function () {
  'use strict';
  if (window.ChapterReviewService && window.ChapterReviewService.init) return;
  var Svc = window.ChapterReviewService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 12000 };

  var BOOKS = [];
  var CHAPTERS = {};   // bookId -> [chapter]
  var OPEN = {};       // bookId -> bool
  var SENT = {};       // bookId:chapterNum -> true
  var ACTIVE = null;   // { book, chapter }

  var EDIT_TYPES = [
    { value: 'Minor_Edit', label: 'Minor edit — typos, small fixes' },
    { value: 'Grammar_Fix', label: 'Grammar & proofreading' },
    { value: 'Rewrite', label: 'Rewrite — restructure passages' },
    { value: 'Major_Rewrite', label: 'Major rewrite — rework the chapter' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) { window.AuthorDrawer.toast(msg); return; }
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fmtDate(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function wordsLabel(n) {
    n = Number(n) || 0;
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k words' : n + ' words';
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
      var err = new Error(String(msg).replace(/_/g, ' '));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  Svc.listBooks = async function () { return await call('/books'); };
  Svc.listChapters = async function (bookId) {
    var res = await call('/books/' + encodeURIComponent(bookId) + '/chapters?page=1&limit=100');
    return (res && res.items) || [];
  };
  Svc.submit = async function (payload) {
    return await call('/chapter-reviews', { method: 'POST', body: payload });
  };

  function statusInfo(status) {
    if (status === 'live' || status === 'published') return { cls: 'live', label: 'Live' };
    if (status === 'scheduled') return { cls: 'pending', label: 'Scheduled' };
    if (status === 'pending_review') return { cls: 'pending', label: 'Pending' };
    if (status === 'revision_needed') return { cls: 'revision', label: 'Revision' };
    return { cls: 'draft', label: 'Draft' };
  }

  function chaptersHtml(bookId) {
    var list = CHAPTERS[bookId] || [];
    if (!list.length) {
      return '<div class="empty" style="padding:18px 10px"><p>No chapters in this book yet.</p></div>';
    }
    return list.map(function (ch) {
      var st = statusInfo(ch.status);
      var sent = SENT[bookId + ':' + ch.n];
      return '<div class="chapter-item" data-bid="' + esc(bookId) + '" data-num="' + esc(ch.n) + '" style="cursor:pointer">'
        + '<div class="ch-num">' + esc(ch.n) + '</div>'
        + '<div class="ch-info"><div class="ch-name">' + esc(ch.title || 'Untitled') + '</div>'
        + '<div class="ch-meta">' + esc(wordsLabel(ch.words)) + ' · ' + esc(fmtDate(ch.createdAt || ch.updatedAt)) + '</div></div>'
        + (sent ? '<i class="fas fa-circle-check" style="color:var(--green);font-size:14px;margin-right:2px" title="Review requested"></i>' : '')
        + '<span class="ch-status ' + st.cls + '">' + st.label + '</span>'
        + '</div>';
    }).join('');
  }

  function renderBooks() {
    var el = document.getElementById('bookList');
    if (!BOOKS.length) {
      el.innerHTML = '<div class="empty"><i class="fas fa-book"></i><p>You have no books to request a review for yet.</p></div>';
      return;
    }
    el.innerHTML = BOOKS.map(function (book) {
      var open = !!OPEN[book.id];
      var list = CHAPTERS[book.id] || [];
      var card = window.DroboardBookCard
        ? window.DroboardBookCard.render({
            id: book.id, title: book.title || 'Untitled',
            cover: book.cover || '../assets/droboard-icon.png',
            genre: book.category || book.genre || '',
            stats: [{ icon: 'fas fa-list-ul', text: list.length + ' chapter' + (list.length === 1 ? '' : 's') },
                    { icon: 'fas fa-pen-nib', text: book.status || 'draft' }],
            status: book.status || 'draft', chevron: 'down', open: open
          })
        : '<div class="dbc-card"><div class="dbc-info"><div class="dbc-title">' + esc(book.title) + '</div></div></div>';
      return '<div class="book-section' + (open ? ' open' : '') + '" data-bid="' + esc(book.id) + '">'
        + card
        + '<div class="chapter-list" style="' + (open ? '' : 'display:none') + '">' + chaptersHtml(book.id) + '</div>'
        + '</div>';
    }).join('');

    Array.prototype.forEach.call(el.querySelectorAll('.book-section'), function (section) {
      var cardEl = section.querySelector('.dbc-card');
      var listEl = section.querySelector('.chapter-list');
      if (cardEl) {
        cardEl.addEventListener('click', function () {
          var id = section.getAttribute('data-bid');
          OPEN[id] = !OPEN[id];
          section.classList.toggle('open', OPEN[id]);
          cardEl.classList.toggle('dbc-open', OPEN[id]);
          if (listEl) listEl.style.display = OPEN[id] ? '' : 'none';
        });
      }
      if (!listEl) return;
      Array.prototype.forEach.call(listEl.querySelectorAll('.chapter-item'), function (row) {
        row.addEventListener('click', function () {
          var book = BOOKS.filter(function (b) { return String(b.id) === String(row.getAttribute('data-bid')); })[0];
          var chapter = (CHAPTERS[row.getAttribute('data-bid')] || []).filter(function (c) { return String(c.n) === String(row.getAttribute('data-num')); })[0];
          if (book && chapter) openModal(book, chapter);
        });
      });
    });
  }

  function showLoadError(e) {
    document.getElementById('bookList').innerHTML =
      '<div class="empty" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i>'
      + '<p>Could not load your books.<br/><span style="font-size:11.5px">' + esc((e && e.message) || 'Please try again.') + '</span></p>'
      + '<button type="button" id="retryReviews" style="margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--red);background:#fff;color:var(--red);font-weight:700;cursor:pointer">Retry</button></div>';
    var btn = document.getElementById('retryReviews');
    if (btn) btn.addEventListener('click', function () { load(); });
  }

  async function load() {
    document.getElementById('bookList').innerHTML = '<div class="empty"><p>Loading your books…</p></div>';
    try {
      BOOKS = await Svc.listBooks();
      if (!Array.isArray(BOOKS)) BOOKS = [];
      var lists = await Promise.all(BOOKS.map(function (b) {
        return Svc.listChapters(b.id).catch(function (e) { return { __error: e }; });
      }));
      BOOKS.forEach(function (b, i) {
        var res = lists[i];
        if (res && res.__error) { CHAPTERS[b.id] = []; return; }
        CHAPTERS[b.id] = res || [];
      });
      if (BOOKS.length) OPEN[BOOKS[0].id] = true;
      renderBooks();
    } catch (e) {
      showLoadError(e);
    }
  }

  /* ── modal ── */
  function openModal(book, chapter) {
    ACTIVE = { book: book, chapter: chapter };
    var st = statusInfo(chapter.status);
    var body = document.getElementById('detailBody');
    var footer = document.getElementById('detailFooter');
    body.innerHTML =
      '<div class="detail-chapter">' + esc(chapter.title || 'Untitled') + '</div>'
      + '<div class="detail-book">' + esc(book.title || 'Untitled') + '</div>'
      + '<div class="detail-meta">Chapter ' + esc(chapter.n) + ' · ' + esc(wordsLabel(chapter.words))
      + (chapter.createdAt || chapter.updatedAt ? ' · ' + esc(fmtDate(chapter.createdAt || chapter.updatedAt)) : '') + '</div>'
      + '<span class="detail-status ' + st.cls + '">' + st.label + '</span>'
      + '<div class="note-section"><div class="note-label"><i class="fas fa-circle-info"></i>What happens next</div>'
      + '<div class="note-box">Your request is sent to your editor with this chapter\'s details. They will review it and reply with feedback or an edit proposal. The live chapter is not changed by this request.</div></div>'
      + '<div class="note-section"><div class="note-label"><i class="fas fa-wand-magic-sparkles"></i>Type of review</div>'
      + '<select class="field-select" id="reviewType">'
      + EDIT_TYPES.map(function (t) { return '<option value="' + esc(t.value) + '">' + esc(t.label) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="note-section"><div class="note-label"><i class="fas fa-pen"></i>Note for the editor</div>'
      + '<textarea class="field-textarea" id="reviewNote" maxlength="2000" placeholder="What should the editor focus on? (optional)"></textarea></div>';
    footer.innerHTML =
      '<button class="modal-btn close-modal" id="detailCancel" type="button">Close</button>'
      + '<button class="modal-btn edit" id="detailSend" type="button"><i class="fas fa-paper-plane"></i> Send request</button>';
    document.getElementById('detailCancel').addEventListener('click', closeModal);
    document.getElementById('detailSend').addEventListener('click', sendRequest);
    document.getElementById('detailModal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('detailModal').classList.remove('open');
    ACTIVE = null;
  }

  async function sendRequest() {
    if (!ACTIVE) return;
    var btn = document.getElementById('detailSend');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
    try {
      await Svc.submit({
        bookId: ACTIVE.book.id,
        chapterId: ACTIVE.chapter.id || '',
        chapterNum: Number(ACTIVE.chapter.n) || 0,
        title: ACTIVE.chapter.title || '',
        words: Number(ACTIVE.chapter.words) || 0,
        editType: document.getElementById('reviewType').value,
        authorNote: document.getElementById('reviewNote').value.trim()
      });
      SENT[ACTIVE.book.id + ':' + ACTIVE.chapter.n] = true;
      closeModal();
      renderBooks();
      toast('Review request sent to your editor');
    } catch (e) {
      toast('Could not send: ' + (e.message || 'unknown error'));
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function init() {
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('request-chapter-review.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    var detailClose = document.getElementById('detailClose');
    if (detailClose) detailClose.addEventListener('click', closeModal);
    var modal = document.getElementById('detailModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { if (history.length > 1) history.back(); else location.href = 'author-center.html'; });
    load();
  }

  Svc.init = init;
  window.ChapterReviewService = Svc;
})();
