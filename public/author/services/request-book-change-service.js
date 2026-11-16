/**
 * request-book-change-service.js — book change requests for real books.
 *
 * GET  /api/author/books                         → story rows
 * GET  /api/author/books/:id/chapters            → reorder list
 * GET  /api/genres?limit=50                      → genre picker
 * POST /api/author/books/:id/change-requests     → { changes, details, order?, proposed }
 *
 * The submitted values go into the BookEdit proposal the editor reviews, so a
 * title/cover/synopsis/genre change is applied only after approval. Every
 * failure is surfaced; nothing is faked locally.
 */
(function () {
  'use strict';
  if (window.BookChangeService && window.BookChangeService.init) return;
  var Svc = window.BookChangeService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 12000 };

  var BOOKS = [];
  var SELECTED = {};        // bookId -> { label: true }
  var CHAPTERS = {};        // bookId -> [chapter]
  var OPEN = {};            // bookId -> bool
  var ACTIVE = null;        // { book }
  var NEW_COVER = '';
  var ORDER = [];           // chapter ids in the dragged order
  var GENRES = null;

  var CHANGES = [
    { icon: 'fa-pen', label: 'Change Title', key: 'title' },
    { icon: 'fa-image', label: 'Change Cover', key: 'cover' },
    { icon: 'fa-align-left', label: 'Change Synopsis', key: 'synopsis' },
    { icon: 'fa-layer-group', label: 'Reorder Chapters', key: 'order' },
    { icon: 'fa-tag', label: 'Change Genre', key: 'genre' }
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
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  async function call(path, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.TIMEOUT_MS);
    var init = Object.assign({ credentials: 'include', signal: controller.signal }, opts);
    if (init.body && typeof init.body !== 'string' && !(init.body instanceof FormData)) {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    var res;
    try { res = await fetch(path.charAt(0) === '/' && path.indexOf('/api/') === 0 ? path : CFG.API_BASE + path, init); }
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
  Svc.listGenres = async function () {
    if (!GENRES) {
      GENRES = call('/api/genres?limit=50').then(function (r) { return (r && r.items) || []; })
        .catch(function () { GENRES = null; return []; });
    }
    return await GENRES;
  };
  Svc.submit = async function (bookId, payload) {
    return await call('/books/' + encodeURIComponent(bookId) + '/change-requests', { method: 'POST', body: payload });
  };

  function selectedList(bookId) {
    return CHANGES.filter(function (c) { return SELECTED[bookId] && SELECTED[bookId][c.label]; });
  }

  function optionsHtml(bookId) {
    return CHANGES.map(function (c) {
      var on = !!(SELECTED[bookId] && SELECTED[bookId][c.label]);
      return '<div class="change-opt' + (on ? ' selected' : '') + '" data-bid="' + esc(bookId) + '" data-label="' + esc(c.label) + '">'
        + '<i class="fas ' + c.icon + '"></i><span>' + esc(c.label) + '</span>'
        + '<span class="change-check"><i class="fas fa-check"></i></span></div>';
    }).join('');
  }

  function storyHtml(book) {
    var open = !!OPEN[book.id];
    var count = selectedList(book.id).length;
    var card = window.DroboardBookCard
      ? window.DroboardBookCard.render({
          id: book.id, title: book.title || 'Untitled',
          cover: book.cover || '../assets/droboard-icon.png',
          genre: book.category || book.genre || '',
          stats: [{ icon: 'fas fa-list-ul', text: (Number(book.chapterCount) || 0) + ' chapters' }],
          status: book.status || 'draft', chevron: 'down', open: open
        })
      : '<div class="dbc-card"><div class="dbc-info"><div class="dbc-title">' + esc(book.title) + '</div></div></div>';
    return '<div class="story-row' + (open ? ' open' : '') + '" data-bid="' + esc(book.id) + '">'
      + card
      + '<div class="story-accordion"><div class="accordion-inner">'
      + '<div class="change-options">' + optionsHtml(book.id) + '</div>'
      + '<button type="button" class="submit-selected' + (count ? ' show' : '') + '" data-bid="' + esc(book.id) + '">'
      + '<i class="fas fa-paper-plane"></i> Continue with ' + count + ' change' + (count === 1 ? '' : 's') + '</button>'
      + '</div></div></div>';
  }

  function renderBooks() {
    var el = document.getElementById('storyList');
    if (!BOOKS.length) {
      el.innerHTML = '<div class="empty" style="padding:40px 16px;text-align:center;color:var(--tx-muted)"><i class="fas fa-book"></i><p>You have no books to change yet.</p></div>';
      return;
    }
    el.innerHTML = BOOKS.map(storyHtml).join('');

    Array.prototype.forEach.call(el.querySelectorAll('.story-row'), function (row) {
      var bookId = row.getAttribute('data-bid');
      var card = row.querySelector('.dbc-card');
      if (card) {
        card.addEventListener('click', function () {
          OPEN[bookId] = !OPEN[bookId];
          row.classList.toggle('open', OPEN[bookId]);
          card.classList.toggle('dbc-open', OPEN[bookId]);
        });
      }
      Array.prototype.forEach.call(row.querySelectorAll('.change-opt'), function (opt) {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          var label = opt.getAttribute('data-label');
          SELECTED[bookId] = SELECTED[bookId] || {};
          if (SELECTED[bookId][label]) delete SELECTED[bookId][label];
          else SELECTED[bookId][label] = true;
          renderBooks();
        });
      });
      var submit = row.querySelector('.submit-selected');
      if (submit) submit.addEventListener('click', function (e) {
        e.stopPropagation();
        var book = BOOKS.filter(function (b) { return String(b.id) === String(bookId); })[0];
        if (book) openModal(book);
      });
    });
  }

  function showLoadError(e) {
    document.getElementById('storyList').innerHTML =
      '<div class="empty" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i>'
      + '<p>Could not load your books.<br/><span style="font-size:11.5px">' + esc((e && e.message) || 'Please try again.') + '</span></p>'
      + '<button type="button" id="retryChanges" style="margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--red);background:#fff;color:var(--red);font-weight:700;cursor:pointer">Retry</button></div>';
    var btn = document.getElementById('retryChanges');
    if (btn) btn.addEventListener('click', function () { load(); });
  }

  async function load() {
    document.getElementById('storyList').innerHTML = '<div class="empty" style="padding:30px;text-align:center;color:var(--tx-muted)">Loading your books…</div>';
    try {
      BOOKS = await Svc.listBooks();
      if (!Array.isArray(BOOKS)) BOOKS = [];
      renderBooks();
    } catch (e) {
      showLoadError(e);
    }
  }

  /* ── modal ── */
  function selectedKeys() {
    var out = {};
    selectedList(ACTIVE.book.id).forEach(function (c) { out[c.key] = true; });
    return out;
  }

  function ensureSelection(bookId) {
    SELECTED[bookId] = SELECTED[bookId] || {};
    return SELECTED[bookId];
  }

  async function openModal(book) {
    ACTIVE = { book: book };
    NEW_COVER = '';
    ORDER = [];
    document.getElementById('modalStory').innerHTML =
      '<img src="' + esc(book.cover || '../assets/droboard-icon.png') + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
      + '<div><div class="modal-story-title">' + esc(book.title || 'Untitled') + '</div>'
      + '<div class="modal-story-meta">' + esc(book.genre || 'No genre') + ' · ' + (Number(book.chapterCount) || 0) + ' chapters</div></div>';
    document.getElementById('requestDetails').value = '';
    document.getElementById('requestModal').classList.add('open');
    await renderModalFields();
  }

  function closeModal() {
    document.getElementById('requestModal').classList.remove('open');
    ACTIVE = null;
    NEW_COVER = '';
    ORDER = [];
  }

  async function renderModalFields() {
    if (!ACTIVE) return;
    var bookId = ACTIVE.book.id;
    var book = ACTIVE.book;
    var keys = selectedKeys();

    document.getElementById('selectedTags').innerHTML = CHANGES.filter(function (c) { return keys[c.key]; }).map(function (c) {
      return '<span class="selected-tag">' + esc(c.label) + '<i class="fas fa-xmark" data-label="' + esc(c.label) + '" title="Remove"></i></span>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('#selectedTags i'), function (x) {
      x.addEventListener('click', function () {
        delete SELECTED[bookId][x.getAttribute('data-label')];
        renderModalFields();
        renderBooks();
      });
    });

    // Cover
    var coverBlock = document.getElementById('modalBodyCover');
    coverBlock.style.display = keys.cover ? 'block' : 'none';
    if (keys.cover) {
      var cur = document.getElementById('coverCurrent');
      cur.src = book.cover || '../assets/droboard-icon.png';
      var nw = document.getElementById('coverPreview');
      var wrap = document.getElementById('coverNewWrap');
      if (NEW_COVER) {
        nw.src = NEW_COVER; nw.style.display = 'block';
        wrap.classList.add('has-img');
      } else {
        nw.removeAttribute('src'); nw.style.display = 'none';
        wrap.classList.remove('has-img');
      }
    }

    // Text comparisons
    var compare = [];
    if (keys.title) {
      compare.push(compareField('Title', book.title || '', '<input class="compare-input" id="newTitle" maxlength="200" placeholder="New title" value="">'));
    }
    if (keys.genre) {
      var genres = await Svc.listGenres();
      var options = genres.map(function (g) {
        return '<option value="' + esc(g.name) + '"' + (g.name === book.genre ? ' selected' : '') + '>' + esc(g.name) + '</option>';
      }).join('');
      compare.push(compareField('Genre', book.genre || 'Not set',
        '<select class="compare-input" id="newGenre">' + (options || '<option value="">No genres available</option>') + '</select>'));
    }
    if (keys.synopsis) {
      compare.push(compareField('Synopsis', book.synopsis || 'No synopsis yet',
        '<textarea class="compare-input" id="newSynopsis" maxlength="5000" placeholder="New synopsis…"></textarea>'));
    }
    document.getElementById('modalBodyCompare').innerHTML = compare.join('');
    document.getElementById('modalBodyCompare').style.display = compare.length ? 'block' : 'none';

    // Reorder
    var reorder = document.getElementById('modalBodyReorder');
    reorder.style.display = keys.order ? 'block' : 'none';
    if (keys.order) {
      try {
        if (!CHAPTERS[bookId]) CHAPTERS[bookId] = await Svc.listChapters(bookId);
        ORDER = CHAPTERS[bookId].map(function (c) { return c.id; });
        renderOrder();
      } catch (e) {
        document.getElementById('reorderList').innerHTML = '<div style="font-size:12px;color:var(--red)">Could not load chapters: ' + esc(e.message || '') + '</div>';
      }
    }
  }

  function compareField(label, current, inputHtml) {
    return '<div class="compare-field"><div class="compare-label">' + esc(label) + '</div>'
      + '<div class="compare-pair"><div class="compare-cell"><label>Current</label>'
      + '<div class="compare-current">' + (current ? esc(current) : '<span class="dim">Not set</span>') + '</div></div>'
      + '<div class="compare-arrow"><i class="fas fa-arrow-right"></i></div>'
      + '<div class="compare-cell"><label>New</label>' + inputHtml + '</div></div></div>';
  }

  function renderOrder() {
    var list = CHAPTERS[ACTIVE.book.id] || [];
    var byId = {};
    list.forEach(function (c) { byId[String(c.id)] = c; });
    document.getElementById('reorderList').innerHTML = ORDER.map(function (id) {
      var c = byId[String(id)] || {};
      return '<div class="reorder-item" draggable="true" data-id="' + esc(id) + '">'
        + '<i class="fas fa-grip-vertical reorder-handle"></i>'
        + '<span class="reorder-name">' + esc((c.n != null ? c.n + '. ' : '') + (c.title || 'Untitled')) + '</span>'
        + '<span class="reorder-chapters">' + (Number(c.words) || 0) + ' words</span></div>';
    }).join('');
    bindDrag();
  }

  function bindDrag() {
    var list = document.getElementById('reorderList');
    var dragId = null;
    Array.prototype.forEach.call(list.querySelectorAll('.reorder-item'), function (item) {
      item.addEventListener('dragstart', function () {
        dragId = item.getAttribute('data-id');
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', function () { item.classList.remove('dragging'); });
      item.addEventListener('dragover', function (e) { e.preventDefault(); });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        var targetId = item.getAttribute('data-id');
        if (!dragId || dragId === targetId) return;
        var from = ORDER.indexOf(dragId), to = ORDER.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ORDER.splice(from, 1);
        ORDER.splice(to, 0, dragId);
        renderOrder();
      });
    });
  }

  async function uploadCover(file) {
    if (!file) return;
    var fd = new FormData();
    fd.append('file', file);
    try {
      var res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body: fd });
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((body && (body.message || body.error)) || ('Upload failed (' + res.status + ')'));
      NEW_COVER = body.url;
      await renderModalFields();
    } catch (e) {
      toast('Cover upload failed: ' + (e.message || 'unknown error'));
    }
  }

  async function submitRequest() {
    if (!ACTIVE) return;
    var book = ACTIVE.book;
    var keys = selectedKeys();
    var proposed = {};
    var labels = CHANGES.filter(function (c) { return keys[c.key]; }).map(function (c) { return c.label; });
    var missing = [];

    if (keys.title) {
      var t = (document.getElementById('newTitle') || {}).value || '';
      t = t.trim();
      if (t && t !== book.title) proposed.title = t;
      else missing.push('title');
    }
    if (keys.genre) {
      var g = (document.getElementById('newGenre') || {}).value || '';
      if (g && g !== book.genre) proposed.genre = g;
      else missing.push('genre');
    }
    if (keys.synopsis) {
      var s = (document.getElementById('newSynopsis') || {}).value || '';
      s = s.trim();
      if (s && s !== (book.synopsis || '')) proposed.synopsis = s;
      else missing.push('synopsis');
    }
    if (keys.cover) {
      if (NEW_COVER) proposed.cover = NEW_COVER;
      else missing.push('a new cover');
    }
    if (keys.order) {
      var original = (CHAPTERS[book.id] || []).map(function (c) { return String(c.id); });
      if (ORDER.join(',') === original.join(',')) missing.push('a new chapter order');
    }

    if (!Object.keys(proposed).length && !(keys.order && ORDER.length)) {
      toast('Fill in at least one change before sending');
      return;
    }
    if (missing.length) toast('Still needed: ' + missing.join(', '));

    var btn = document.querySelector('#requestModal .modal-btn.send');
    var old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
    try {
      var payload = { changes: labels, details: document.getElementById('requestDetails').value.trim() };
      if (Object.keys(proposed).length) payload.proposed = proposed;
      if (keys.order && ORDER.length) payload.order = ORDER.slice();
      await Svc.submit(book.id, payload);
      SELECTED[book.id] = {};
      closeModal();
      renderBooks();
      toast('Change request sent to your editor');
    } catch (e) {
      toast('Could not send: ' + (e.message || 'unknown error'));
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  function init() {
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('request-book-change.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    var close = document.getElementById('modalClose');
    if (close) close.addEventListener('click', closeModal);
    var cancel = document.getElementById('modalCancel');
    if (cancel) cancel.addEventListener('click', closeModal);
    var modal = document.getElementById('requestModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    var send = document.querySelector('#requestModal .modal-btn.send');
    if (send) send.addEventListener('click', submitRequest);
    var coverBtn = document.getElementById('coverUploadBtn');
    var coverInput = document.getElementById('coverFileInput');
    if (coverBtn && coverInput) {
      coverBtn.addEventListener('click', function () { coverInput.click(); });
      coverInput.addEventListener('change', function () {
        uploadCover(this.files && this.files[0]);
        this.value = '';
      });
    }
    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { if (history.length > 1) history.back(); else location.href = 'author-center.html'; });
    window.closeModal = closeModal;
    window.submitRequest = submitRequest;
    load();
  }

  Svc.init = init;
  window.BookChangeService = Svc;
})();
