/** request-book-change-service.js — Data + UI for request-book-change.html.
 * Restored story-page design, re-skinned to books: expandable book rows,
 * change-option picker, reorder-chapters drag modal, request modal.
 * Live: GET /api/author/books, POST /api/author/books/:id/change-requests
 * (persists a pending BookEdit proposal). Demo drives the UI until flipped.
 */
(function () {
  'use strict';
  if (window.BookChangeService && window.BookChangeService.init) return;
  var Svc = window.BookChangeService || {};
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  /* Backend-ready API (preserved) */
  Svc.listBooks = Svc.listBooks || async function () {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books'); if (r.ok) return await r.json(); } catch (e) {} }
    await delay(); return BOOKS.map(clone);
  };
  Svc.submit = Svc.submit || async function (bookId, payload) {
    if (CFG.USE_API) {
      try {
        var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/change-requests', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    await delay(250); return { ok: true, id: 'be' + Date.now().toString(36) };
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── Demo data ── */
  var BOOKS = [
    { id: 'b1', title: 'The Midnight Protocol', genre: 'Romance', status: 'ongoing', cover: 'https://picsum.photos/seed/book1/100/140', chapters: 5, desc: 'A sweeping romance of love, betrayal, and redemption.', chapterList: [{ id: 'b1c1', name: 'Ch 1 — The Letter' }, { id: 'b1c2', name: 'Ch 2 — First Meeting' }, { id: 'b1c3', name: 'Ch 3 — The Agreement' }, { id: 'b1c4', name: 'Ch 4 — Late Night Call' }, { id: 'b1c5', name: 'Ch 5 — Confession' }] },
    { id: 'b2', title: 'Echoes of Yesterday', genre: 'Drama', status: 'published', cover: 'https://picsum.photos/seed/book2/100/140', chapters: 3, desc: 'Short stories exploring memory, loss, and the echoes we leave behind.', chapterList: [{ id: 'b2c1', name: 'Ch 1 — Return' }, { id: 'b2c2', name: 'Ch 2 — Old Friends' }, { id: 'b2c3', name: 'Ch 3 — The Truth' }] },
  ];

  var CHANGES = [
    { icon: 'fa-pen', label: 'Change Title' },
    { icon: 'fa-image', label: 'Change Cover' },
    { icon: 'fa-align-left', label: 'Change Synopsis' },
    { icon: 'fa-layer-group', label: 'Reorder Chapters' },
    { icon: 'fa-tag', label: 'Change Genre/Tags' }
  ];

  /* Current → new comparison per change type (cover has its own UI). */
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

  function renderCompare(book, changes) {
    var wrap = document.getElementById('modalBodyCompare');
    var defs = changes.map(function (c) { return FIELDS[c]; }).filter(Boolean);
    if (!book || !defs.length) { wrap.innerHTML = ''; wrap.style.display = 'none'; return false; }
    wrap.innerHTML = defs.map(function (d) {
      var cur = currentValue(book, d.key);
      var ph = 'New ' + d.label.toLowerCase() + '…';
      var input = d.type === 'textarea'
        ? '<textarea class="compare-input" data-field="' + d.key + '" placeholder="' + ph + '"></textarea>'
        : '<input class="compare-input" data-field="' + d.key + '" placeholder="' + ph + '"/>';
      return '<div class="compare-field">'
        + '<div class="compare-label">' + d.label + '</div>'
        + '<div class="compare-pair">'
        + '<div class="compare-cell"><label>Current</label><div class="compare-current">' + (cur ? esc(cur) : '<span class="dim">Not set</span>') + '</div></div>'
        + '<div class="compare-arrow"><i class="fas fa-arrow-right"></i></div>'
        + '<div class="compare-cell"><label>Change to</label>' + input + '</div>'
        + '</div></div>';
    }).join('');
    wrap.style.display = '';
    return true;
  }

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function renderList() {
    document.getElementById('storyList').innerHTML = BOOKS.map(function (s) {
      return '<div class="story-row" data-sid="' + s.id + '">'
        + DroboardBookCard.render({
          id: s.id, cover: s.cover, title: s.title, genre: s.genre,
          stats: [{ icon: 'fas fa-list-ul', text: s.chapters + ' chapters' }],
          desc: s.desc, status: s.status || 'ongoing', chevron: 'down'
        })
        + '<div class="story-accordion"><div class="accordion-inner">'
        + '<div class="change-options">'
        + CHANGES.map(function (c) {
          return '<div class="change-opt" data-sid="' + s.id + '" data-change="' + c.label + '">'
            + '<i class="fas ' + c.icon + '"></i>' + c.label
            + '<div class="change-check"><i class="fas fa-check"></i></div></div>';
        }).join('')
        + '</div>'
        + '<button class="submit-selected" data-sid="' + s.id + '"><i class="fas fa-paper-plane"></i> Submit Selected (<span class="sel-count">0</span>)</button>'
        + '</div></div></div>';
    }).join('');

    document.querySelectorAll('.story-row .dbc-card').forEach(function (h) {
      h.addEventListener('click', function (e) {
        if (e.target.closest('.change-opt') || e.target.closest('.submit-selected')) return;
        var row = h.parentElement;
        var wasOpen = row.classList.contains('open');
        document.querySelectorAll('.story-row').forEach(function (r) {
          r.classList.remove('open');
          var c = r.querySelector('.dbc-card');
          if (c) c.classList.remove('dbc-open');
        });
        if (!wasOpen) { row.classList.add('open'); h.classList.add('dbc-open'); }
      });
    });

    document.querySelectorAll('.change-opt').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        opt.classList.toggle('selected');
        var sid = opt.getAttribute('data-sid');
        if (opt.getAttribute('data-change') === 'Reorder Chapters' && opt.classList.contains('selected')) {
          opt.classList.remove('selected');
          updateSubmitBtn(sid);
          openReorderModal(sid);
          return;
        }
        updateSubmitBtn(sid);
      });
    });

    document.querySelectorAll('.submit-selected').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sid = btn.getAttribute('data-sid');
        var selected = document.querySelectorAll('.change-opt.selected[data-sid="' + sid + '"]');
        var changes = [];
        selected.forEach(function (s) { changes.push(s.getAttribute('data-change')); });
        if (changes.length) openModal(sid, changes);
      });
    });
  }

  function updateSubmitBtn(sid) {
    var count = document.querySelectorAll('.change-opt.selected[data-sid="' + sid + '"]').length;
    var btn = document.querySelector('.submit-selected[data-sid="' + sid + '"]');
    var counter = btn.querySelector('.sel-count');
    counter.textContent = count;
    if (count > 0) btn.classList.add('show');
    else btn.classList.remove('show');
  }

  function resetCoverUI(book) {
    var cur = document.getElementById('coverCurrent');
    if (cur) cur.src = (book && book.cover) || '';
    var wrap = document.getElementById('coverCurrentWrap');
    if (wrap) wrap.classList.toggle('has-img', !!(book && book.cover));
    var prev = document.getElementById('coverPreview');
    if (prev) prev.src = '';
    var newWrap = document.getElementById('coverNewWrap');
    if (newWrap) { newWrap.classList.add('empty'); newWrap.classList.remove('has-img'); }
    var input = document.getElementById('coverFileInput');
    if (input) input.value = '';
    var upLabel = document.querySelector('#coverUploadBtn span');
    if (upLabel) upLabel.textContent = 'Upload new cover';
    var m = document.getElementById('requestModal');
    if (m) m._coverData = null;
  }

  function openModal(sid, changes) {
    var book = BOOKS.find(function (s) { return s.id === sid; });
    if (!book) return;
    var title = changes.length === 1 ? changes[0] : 'Change Request';
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalStory').innerHTML =
      '<img src="' + esc(book.cover) + '" alt=""/>'
      + '<div><div class="modal-story-title">' + esc(book.title) + '</div>'
      + '<div class="modal-story-meta">' + esc(book.genre || '') + ' · ' + book.chapters + ' chapters</div></div>';
    document.getElementById('selectedTags').innerHTML = changes.map(function (c) {
      return '<span class="selected-tag">' + esc(c) + '</span>';
    }).join('');
    document.getElementById('requestDetails').value = '';
    var hasCover = changes.indexOf('Change Cover') !== -1;
    document.getElementById('modalBodyCover').style.display = hasCover ? '' : 'none';
    if (hasCover) resetCoverUI(book);
    var hasFields = renderCompare(book, changes);
    document.getElementById('requestDetails').placeholder = hasCover
      ? 'Additional notes about the new cover (optional)…'
      : (hasFields ? 'Additional notes (optional)…' : 'Describe the changes you need…');
    document.getElementById('modalBodyTextarea').style.display = '';
    document.getElementById('modalBodyReorder').style.display = 'none';
    document.getElementById('requestModal').classList.add('open');
    document.getElementById('requestModal')._sid = sid;
    document.getElementById('requestModal')._changes = changes;
    document.getElementById('requestModal')._order = null;
    document.getElementById('requestModal')._coverData = null;
  }

  function openReorderModal(sid) {
    var book = BOOKS.find(function (s) { return s.id === sid; });
    if (!book) return;
    document.getElementById('modalTitle').textContent = 'Reorder Chapters';
    document.getElementById('modalStory').innerHTML =
      '<img src="' + esc(book.cover) + '" alt=""/>'
      + '<div><div class="modal-story-title">' + esc(book.title) + '</div>'
      + '<div class="modal-story-meta">' + esc(book.genre || '') + ' · ' + book.chapters + ' chapters</div></div>';
    document.getElementById('selectedTags').innerHTML = '<span class="selected-tag">Reorder Chapters</span>';
    document.getElementById('modalBodyTextarea').style.display = 'none';
    document.getElementById('modalBodyCover').style.display = 'none';
    renderCompare(null, []);
    document.getElementById('modalBodyReorder').style.display = '';
    resetCoverUI(book);
    var list = document.getElementById('reorderList');
    list.innerHTML = book.chapterList.map(function (c, i) {
      return '<div class="reorder-item" data-cid="' + c.id + '">'
        + '<i class="fas fa-grip-vertical reorder-handle"></i>'
        + '<span class="reorder-name">' + esc(c.name) + '</span></div>';
    }).join('');
    document.getElementById('requestModal').classList.add('open');
    document.getElementById('requestModal')._sid = sid;
    document.getElementById('requestModal')._changes = ['Reorder Chapters'];
    document.getElementById('requestModal')._order = null;
    initDrag(list);
  }

  function initDrag(list) {
    var dragEl = null;
    list.querySelectorAll('.reorder-item').forEach(function (item) {
      item.querySelector('.reorder-handle').addEventListener('mousedown', function () { dragEl = item; item.classList.add('dragging'); });
      item.addEventListener('mouseover', function () {
        if (!dragEl || dragEl === item) return;
        var items = Array.from(list.children);
        var fromIdx = items.indexOf(dragEl);
        var toIdx = items.indexOf(item);
        if (fromIdx < toIdx) { list.insertBefore(dragEl, item.nextSibling); }
        else { list.insertBefore(dragEl, item); }
      });
    });
    document.addEventListener('mouseup', function () { if (dragEl) { dragEl.classList.remove('dragging'); dragEl = null; } });
  }

  function closeModal() {
    document.getElementById('requestModal').classList.remove('open');
  }

  async function submitRequest() {
    var modal = document.getElementById('requestModal');
    var sid = modal._sid;
    var changes = modal._changes || [];
    var book = BOOKS.find(function (s) { return s.id === sid; });
    var payload = { changes: changes };
    if (modal._changes && modal._changes[0] === 'Reorder Chapters' && document.getElementById('modalBodyReorder').style.display !== 'none') {
      var order = [];
      document.querySelectorAll('#reorderList .reorder-item').forEach(function (el) { order.push(el.getAttribute('data-cid')); });
      payload.order = order;
    } else {
      var details = document.getElementById('requestDetails').value.trim();
      var wantsCover = changes.indexOf('Change Cover') !== -1;
      var coverData = wantsCover ? (modal._coverData || null) : null;
      var fields = {};
      var empties = [];
      document.querySelectorAll('#modalBodyCompare [data-field]').forEach(function (inp) {
        var v = inp.value.trim();
        inp.style.borderColor = '';
        if (v) fields[inp.getAttribute('data-field')] = v;
        else empties.push(inp);
      });
      document.getElementById('requestDetails').style.borderColor = '';
      var fieldKeys = Object.keys(fields);
      if (!details && !coverData && !fieldKeys.length) {
        (empties[0] || document.getElementById('requestDetails')).style.borderColor = 'var(--red)';
        return;
      }
      if (details) payload.details = details;
      if (fieldKeys.length) payload.fields = fields;
      if (coverData) payload.coverImage = coverData; /* demo: base64 data URL — backend decodes or swap to multipart upload */
    }
    var btn = document.querySelector('.modal-btn.send');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    try {
      await Svc.submit(sid, payload);
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit';
      document.querySelectorAll('.change-opt.selected[data-sid="' + sid + '"]').forEach(function (o) { o.classList.remove('selected'); });
      updateSubmitBtn(sid);
      toast((book ? book.title : 'Book') + ' — ' + changes.length + ' change' + (changes.length > 1 ? 's' : '') + ' submitted!');
      if (window.droNotify) window.droNotify({
        type: 'book_change_result', key: 'bc:' + sid + ':' + changes.slice().sort().join('|'),
        title: changes.length + ' change request' + (changes.length > 1 ? 's' : '') + ' sent',
        desc: (book ? book.title : 'This book') + ' — editors will review ' + changes.join(', ').toLowerCase() + '.',
        link: { label: 'Track requests' },
      });
    } catch (e) {
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit';
      toast('Could not submit request');
    }
  }

  function init() {
    if (window.AuthorDrawer) { try { window.AuthorDrawer.setTheme(window.AuthorDrawer.getTheme()); } catch (e) {} }
    Svc.listBooks().then(function (books) {
      if (Array.isArray(books) && books.length) {
        BOOKS = books.map(function (b) {
          return {
            id: b.id, title: b.title, genre: b.genre, cover: b.cover, status: b.status,
            chapters: b.chapterCount || (b.chapters && b.chapters.length) || 0,
            desc: b.synopsis || '',
            chapterList: (b.chapters || []).map(function (c, i) { return { id: c.id || ('c' + i), name: 'Ch ' + (c.n || (i + 1)) + ' — ' + (c.title || '') }; }),
          };
        });
      }
      renderList();
    }).catch(function () { renderList(); });
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('requestModal').onclick = function (e) { if (e.target === this) closeModal(); };
    var coverInput = document.getElementById('coverFileInput');
    if (coverInput) coverInput.addEventListener('change', function () {
      var f = coverInput.files && coverInput.files[0];
      if (!f) return;
      var okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (okTypes.indexOf(f.type) === -1) { toast('Only JPG, PNG, WebP or GIF images are allowed'); coverInput.value = ''; return; }
      var MAX = 8 * 1024 * 1024;
      if (f.size > MAX) { toast('Image is too large — max 8MB'); coverInput.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () {
        var m = document.getElementById('requestModal');
        m._coverData = reader.result;
        var prev = document.getElementById('coverPreview');
        prev.src = reader.result;
        var wrap = document.getElementById('coverNewWrap');
        wrap.classList.remove('empty');
        wrap.classList.add('has-img');
        var cur = document.getElementById('coverCurrentWrap');
        if (cur) cur.classList.add('has-img');
        var label = document.querySelector('#coverUploadBtn span');
        if (label) label.textContent = f.name + ' · ' + (f.size / 1024 / 1024).toFixed(1) + 'MB — tap to replace';
      };
      reader.readAsDataURL(f);
    });
    document.getElementById('backBtn').addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html'; });
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('request-book-change.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
  }

  Svc.init = init;
  Svc.renderList = renderList;
  window.BookChangeService = Svc;
  /* onclick refs in markup */
  window.closeModal = closeModal;
  window.submitRequest = submitRequest;
})();
