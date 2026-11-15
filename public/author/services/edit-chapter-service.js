/**
 * edit-chapter-service.js — data + bindings for edit-chapter.html.
 *
 * GET  /api/author/books/:id/chapters/:num  → chapter (flat object)
 * PUT  /api/author/books/:id/chapters/:num  → chapter, or a ChapterEdit
 *       proposal when the chapter is already live. The UI reports the two
 *       outcomes differently instead of pretending a proposal was applied.
 */
(function () {
  'use strict';
  if (window.EditChapterService && window.EditChapterService.init) return;
  var Svc = window.EditChapterService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 10000 };

  var BOOK_ID = null;
  var CHAPTER = null;
  var BOOK = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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

  Svc.get = async function (bookId, num) {
    return await call('/books/' + encodeURIComponent(bookId) + '/chapters/' + encodeURIComponent(num));
  };
  Svc.save = async function (bookId, num, payload) {
    return await call('/books/' + encodeURIComponent(bookId) + '/chapters/' + encodeURIComponent(num), { method: 'PUT', body: payload });
  };
  Svc.getBook = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId)); };
  Svc.listBooks = async function () { return await call('/books'); };

  async function resolveBookId() {
    var q = new URLSearchParams(location.search).get('book');
    if (q && q !== 'b1') return q;
    var list = await Svc.listBooks();
    if (list && list.length) return list[0].id;
    var e = new Error('No books yet'); e.status = 404; throw e;
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function statusLabel(s) {
    if (s === 'pending_review') return '<i class="fas fa-clock"></i> Pending Review — waiting for editor';
    if (s === 'revision_needed') return '<i class="fas fa-exclamation-circle"></i> Revision Needed — editor requested changes';
    if (s === 'draft') return '<i class="fas fa-pen"></i> Draft — not visible to readers yet';
    if (s === 'live' || s === 'published') return '<i class="fas fa-check-circle"></i> Live — published and visible to readers';
    if (s === 'scheduled') return '<i class="fas fa-calendar"></i> Scheduled — publishes on its scheduled date';
    return '<i class="fas fa-circle-info"></i> ' + esc(s || 'Draft');
  }

  function fmt(cmd, val) { document.execCommand(cmd, false, val || null); document.getElementById('editor').focus(); }
  function insertBreak() { document.execCommand('insertHTML', false, '<p style="text-align:center;color:var(--tx-faint)">— — —</p>'); }

  function updateWordCount() {
    var text = document.getElementById('editor').innerText || '';
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('wordCount').textContent = words + ' word' + (words !== 1 ? 's' : '');
  }

  function currentStatus() { return (CHAPTER && CHAPTER.status) || 'draft'; }

  function isProposal(res) {
    return !!(res && res.proposed && (res.chapterId || res.chapterN));
  }

  async function save(kind) {
    var title = document.getElementById('chTitle').value.trim();
    var content = document.getElementById('editor').innerHTML;
    if (!title) { toast('Give the chapter a title first'); return; }
    var payload = { title: title, content: content };
    if (kind === 'review') payload.status = 'pending_review';
    var btn = kind === 'review' ? document.getElementById('submitReviewBtn') : document.getElementById('saveBtn');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (kind === 'review' ? 'Submitting…' : 'Saving…');
    try {
      var res = await Svc.save(BOOK_ID, CHAPTER.n, payload);
      if (isProposal(res)) {
        toast('Submitted for editor approval — live chapters change only after review.');
        showProposalNote();
      } else {
        CHAPTER = res || CHAPTER;
        renderBanner();
        toast(kind === 'review' ? 'Chapter submitted for review!' : 'Chapter saved!');
        if (kind === 'save' && !(res && res.status === 'live')) document.getElementById('reviewPrompt').classList.add('show');
      }
    } catch (e) {
      toast((kind === 'review' ? 'Could not submit: ' : 'Could not save: ') + (e.message || 'unknown error'));
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function showProposalNote() {
    var banner = document.getElementById('statusBanner');
    if (!banner) return;
    banner.className = 'status-banner pendingreview';
    banner.innerHTML = '<i class="fas fa-clock"></i> Edit proposal pending — your editor must approve changes to a live chapter.';
  }

  function renderBanner() {
    var banner = document.getElementById('statusBanner');
    var s = currentStatus();
    banner.className = 'status-banner ' + String(s).replace(/_/g, '');
    banner.innerHTML = statusLabel(s);
  }

  function renderChapter() {
    document.getElementById('pageTitle').textContent = 'Ch. ' + CHAPTER.n + ' — ' + (CHAPTER.title || 'Untitled');
    document.getElementById('chTitle').value = CHAPTER.title || '';
    document.getElementById('editor').innerHTML = CHAPTER.content || '';
    var cover = (BOOK && BOOK.cover) || '../assets/droboard-icon.png';
    document.getElementById('chapterInfo').innerHTML =
      '<img class="chapter-cover" src="' + esc(cover) + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
      + '<div><div class="chapter-info-title">' + esc((BOOK && BOOK.title) || 'Untitled') + '</div>'
      + '<div class="chapter-info-meta">' + esc((BOOK && BOOK.genre) || '') + '</div>'
      + '<div class="chapter-info-ch">Chapter ' + esc(CHAPTER.n) + '</div></div>';
    renderBanner();
    updateWordCount();
  }

  function applyViewerMode() {
    var act = document.querySelector('.actions');
    if (act) act.style.display = 'none';
    var ed = document.getElementById('editor');
    ed.setAttribute('contenteditable', 'false');
    ed.style.caretColor = 'transparent';
    Array.prototype.forEach.call(document.querySelectorAll('.editor-toolbar button'), function (b) {
      b.disabled = true; b.style.opacity = '.45'; b.style.cursor = 'default';
    });
    var ct = document.getElementById('chTitle');
    if (ct) { ct.readOnly = true; ct.style.background = 'var(--l2,#f5f5f8)'; }
  }

  async function load() {
    var results = await Promise.all([Svc.getBook(BOOK_ID), Svc.get(BOOK_ID, CHAPTER_NUM())]);
    BOOK = results[0];
    CHAPTER = results[1];
    if (!CHAPTER || typeof CHAPTER !== 'object') throw new Error('Chapter not found');
    renderChapter();
  }

  var NUM = null;
  function CHAPTER_NUM() { return NUM; }

  async function init() {
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('edit-chapter.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    var params = new URLSearchParams(location.search);
    var isViewer = (params.get('viewer') || '') === 'editor';
    var chapterParam = params.get('chapter') || '1';

    document.getElementById('backBtn').addEventListener('click', function () {
      if (window.history.length > 1) window.history.back(); else window.location.href = 'book-workspace.html';
    });
    document.getElementById('saveBtn').addEventListener('click', function () { save('save'); });
    document.getElementById('submitReviewBtn').addEventListener('click', function () { save('review'); });
    document.getElementById('applyReviewBtn').addEventListener('click', function () { save('review'); });
    document.getElementById('editor').addEventListener('input', updateWordCount);

    if (chapterParam === 'new') {
      location.replace('../Pages/create.html?book=' + encodeURIComponent(params.get('book') || '') + '&newChapter=1');
      return;
    }
    NUM = parseInt(chapterParam, 10) || 1;

    try {
      BOOK_ID = await resolveBookId();
      await load();
      if (isViewer) applyViewerMode();
    } catch (e) {
      document.getElementById('pageTitle').textContent = 'Could not load chapter';
      document.getElementById('chapterInfo').innerHTML = '';
      document.getElementById('statusBanner').innerHTML = '';
      document.getElementById('editor').innerHTML = '<div style="color:var(--red);padding:20px"><i class="fas fa-exclamation-triangle"></i>'
        + '<p>Failed to load this chapter.</p><p style="font-size:12px;margin-top:8px">' + esc(e.message || 'Please try again') + '</p>'
        + '<button type="button" id="retryChapter" style="margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--red);background:#fff;color:var(--red);font-weight:700;cursor:pointer">Retry</button></div>';
      var btn = document.getElementById('retryChapter');
      if (btn) btn.addEventListener('click', function () { location.reload(); });
    }
  }

  Svc.init = init;
  window.EditChapterService = Svc;
  window.fmt = fmt;
  window.insertBreak = insertBreak;
})();
