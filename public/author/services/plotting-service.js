/**
 * plotting-service.js — data + render for plotting.html.
 *
 * Reads the author's own book (/api/author/books/:id), its saved outline
 * (/books/:id/plot → { acts, roadmap }) and the cast (/books/:id/characters).
 * Nothing is hardcoded: an empty outline renders an empty state, and a failed
 * request renders an error with a retry.
 */
(function () {
  'use strict';
  if (window.PlottingService && window.PlottingService.init) return;
  var Svc = window.PlottingService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 8000 };

  var BOOK_ID = null;
  var BOOK = null;
  var ACTS = [];
  var ROADMAP = [];
  var CHARACTERS = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtRelative(v) {
    var d = new Date(v);
    if (!v || isNaN(d.getTime())) return '';
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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

  Svc.getBook = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId)); };
  Svc.listBooks = async function () { return await call('/books'); };
  Svc.getPlot = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId) + '/plot'); };
  Svc.savePlot = async function (bookId, plot) {
    return await call('/books/' + encodeURIComponent(bookId) + '/plot', { method: 'PUT', body: { acts: plot.acts || [], roadmap: plot.roadmap || [] } });
  };
  Svc.listCharacters = async function (bookId) { return await call('/books/' + encodeURIComponent(bookId) + '/characters'); };

  async function resolveBookId() {
    var q = new URLSearchParams(location.search).get('book');
    if (q && q !== 'b1') return q;
    var list = await Svc.listBooks();
    if (list && list.length) return list[0].id;
    var e = new Error('No books yet'); e.status = 404; throw e;
  }

  function renderHeader() {
    if (!BOOK) return;
    document.title = (BOOK.title || 'Book') + ' · Plotting · Droboard';
    var title = document.querySelector('.bh-title');
    var genre = document.querySelector('.bh-genre');
    var cover = document.querySelector('.bh-cover img');
    var badge = document.querySelector('.bh-info .status-badge');
    if (title) title.textContent = BOOK.title || 'Untitled';
    if (genre) genre.textContent = [BOOK.genre, BOOK.category].filter(Boolean).join(' · ') || 'No genre set';
    if (cover) {
      cover.src = BOOK.cover || '../assets/droboard-icon.png';
      cover.alt = BOOK.title || 'Book cover';
      cover.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
    }
    if (badge) {
      var labels = { published: 'Published', ongoing: 'Ongoing', draft: 'Draft', under_review: 'Under Review', completed: 'Completed', paused: 'Paused', flagged: 'Flagged' };
      badge.textContent = labels[BOOK.status] || BOOK.status || 'Draft';
      badge.className = 'status-badge ' + (BOOK.status === 'under_review' ? 'ongoing' : (BOOK.status || 'draft'));
    }
    var progress = document.querySelector('.progress-label');
    if (progress) {
      var written = Number(BOOK.chapterCount) || 0;
      progress.innerHTML = '<b>' + written + '</b> chapter' + (written === 1 ? '' : 's') + ' written'
        + (ROADMAP.length ? ' &middot; <b>' + ROADMAP.length + '</b> roadmap beat' + (ROADMAP.length === 1 ? '' : 's') : '');
    }
    var track = document.querySelector('.progress-track');
    if (track) track.style.display = 'none';
  }

  function renderActs() {
    var el = document.getElementById('actList');
    if (!ACTS.length) {
      el.innerHTML = '<div class="empty" style="padding:26px 16px;text-align:center;color:var(--text-2);font-size:12.5px;font-weight:600;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-md)"><i class="fas fa-layer-group" style="display:block;font-size:22px;margin-bottom:8px;color:var(--border)"></i>No acts saved for this book yet.</div>';
    } else {
      el.innerHTML = ACTS.map(function (a) {
        var beats = (a.beats || []).map(function (b) { return '<div class="beat"><i class="fas fa-circle"></i><span>' + esc(b) + '</span></div>'; }).join('');
        return '<div class="act-card">'
          + '<div class="act-top"><span class="act-name">' + esc(a.name || 'Untitled act') + '</span>'
          + (a.range ? '<span class="act-range">' + esc(a.range) + '</span>' : '') + '</div>'
          + (a.summary ? '<div class="act-summary">' + esc(a.summary) + '</div>' : '')
          + (beats ? '<div class="beat-list">' + beats + '</div>' : '')
          + '</div>';
      }).join('');
    }
    setNote('actNote', ACTS.length + ' Act' + (ACTS.length === 1 ? '' : 's'));
  }

  function renderRoadmap() {
    var el = document.getElementById('roadmapList');
    if (!ROADMAP.length) {
      el.innerHTML = '<div class="empty" style="padding:22px 16px;text-align:center;color:var(--text-2);font-size:12.5px;font-weight:600">No chapter roadmap saved yet.</div>';
    } else {
      el.innerHTML = ROADMAP.map(function (r) {
        return '<div class="roadmap-row">'
          + '<div class="roadmap-range"><div class="roadmap-range-num">' + esc(r.range || '—') + '</div></div>'
          + '<div class="roadmap-body"><div class="roadmap-title">' + esc(r.title || 'Untitled') + '</div>'
          + (r.desc ? '<div class="roadmap-desc">' + esc(r.desc) + '</div>' : '') + '</div>'
          + '<span class="roadmap-status ' + (r.status === 'written' ? 'written' : 'planned') + '">' + (r.status === 'written' ? 'Written' : 'Planned') + '</span></div>';
      }).join('');
    }
    setNote('roadmapNote', ROADMAP.length + ' beat' + (ROADMAP.length === 1 ? '' : 's'));
  }

  function renderCharacters() {
    var el = document.getElementById('charList');
    var withArc = CHARACTERS.filter(function (c) { return c.arc && String(c.arc).trim(); });
    if (!withArc.length) {
      el.innerHTML = '<div class="empty" style="padding:22px 16px;text-align:center;color:var(--text-2);font-size:12.5px;font-weight:600">No character arcs recorded yet.</div>';
    } else {
      el.innerHTML = withArc.map(function (c) {
        return '<div class="char-card"><div class="char-avatar">' + (c.avatar
          ? '<img src="' + esc(c.avatar) + '" alt="' + esc(c.name) + '" onerror="this.style.display=\'none\'"/>'
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-2)"><i class="fas fa-user"></i></div>')
          + '</div><div class="char-body"><div class="char-name-row"><span class="char-name">' + esc(c.name) + '</span>'
          + '<span class="char-role">' + esc(c.role || '') + '</span></div>'
          + '<div class="char-arc">' + esc(c.arc) + '</div></div></div>';
      }).join('');
    }
  }

  function setNote(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function reload() {
    var results = await Promise.all([Svc.getBook(BOOK_ID), Svc.getPlot(BOOK_ID), Svc.listCharacters(BOOK_ID)]);
    BOOK = results[0];
    var plot = results[1] || {};
    ACTS = Array.isArray(plot.acts) ? plot.acts : [];
    ROADMAP = Array.isArray(plot.roadmap) ? plot.roadmap : [];
    CHARACTERS = Array.isArray(results[2]) ? results[2] : [];
    renderHeader();
    renderActs();
    renderRoadmap();
    renderCharacters();
  }

  function load() {
    reload().then(function () {
      if (window.AuthorFinance) window.AuthorFinance.clearPageError();
    }).catch(function (e) {
      if (window.AuthorFinance) window.AuthorFinance.pageError('Could not load this book\'s outline. ' + (e.message || ''), load);
      else console.error(e);
    });
  }

  async function init() {
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('plotting.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    if (window.AuthorFinance) window.AuthorFinance.mountIdentity();
    if (window.DroboardWorkspaceTabs) DroboardWorkspaceTabs.configure({ active: 'plotting' });
    if (window.DroboardNav) DroboardNav.configure({ active: 'profile' });
    try {
      BOOK_ID = await resolveBookId();
      load();
    } catch (e) {
      if (window.AuthorFinance) window.AuthorFinance.pageError('Could not open a book. ' + (e.message || ''), init);
      else console.error(e);
    }
  }

  Svc.init = init;
  window.PlottingService = Svc;
})();
