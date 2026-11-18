/**
 * author-center-service.js — Data layer + render + bindings for author-center.html (Dashboard).
 * Uses /api/author/dashboard and /api/author/books.
 */
(function () {
  'use strict';
  if (window.AuthorCenterService && window.AuthorCenterService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 3000 };

  async function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 180); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function callBackend(path, opts) {
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, CFG.TIMEOUT_MS);
    try { var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal, credentials: 'include' }, opts || {})); clearTimeout(t); if (!res.ok) throw new Error(res.status); return await res.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }

  var STATS = [];
  var BOOKS = [];


  function renderStats() {
    if (STATS.length === 0) {
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Unable to load statistics</div>';
      return;
    }
    document.getElementById('statGrid').innerHTML = STATS.map(function (s) {
      var growth;
      if (s.growth != null) {
        growth = '<i class="fas fa-arrow-' + (s.growth < 0 ? 'down' : 'up') + '"></i> ' + s.growth + '% <span class="dim">vs last 30d</span>';
      } else if (s.note) {
        growth = '<span class="dim">' + s.note + '</span>';
      } else {
        growth = '';
      }
      return '<div class="stat-card"' + (s.href ? ' onclick="location.href=\'' + s.href + '\'" style="cursor:pointer"' : '') + '>'
        + '<div class="stat-icon" style="background:' + s.bg + ';color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>'
        + '<div class="stat-label">' + s.label + '</div>'
        + '<div class="stat-num">' + s.num + '</div>'
        + '<div class="stat-growth">' + growth + '</div>'
        + '</div>';
    }).join('');
  }

  function renderBooks() {
    if (!window.DroboardBookCard) { document.getElementById('bookList').innerHTML = ''; return; }
    // Flag in place, never clone: onCreated writes back onto these same
    // objects, and a copy here would silently drop the new engagement.
    BOOKS.forEach(function (b) { b.onEngage = true; });
    DroboardBookCard.renderList('#bookList', BOOKS, {
      onOpen: function (b) { location.href = 'book-workspace.html?book=' + b.id; },
      showNew: true
    });
  }

  async function createEngagement(bookId, payload) {
    var res = await fetch(CFG.API_BASE + '/books/' + encodeURIComponent(bookId) + '/engagement', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Could not save (' + res.status + ')');
    return await res.json();
  }

  async function updateEngagement(bookId, kind, itemId, payload) {
    var res = await fetch(CFG.API_BASE + '/books/' + encodeURIComponent(bookId) + '/engagement/'
      + encodeURIComponent(kind) + '/' + encodeURIComponent(itemId), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Could not save (' + res.status + ')');
    return await res.json();
  }
  function existingFor(book, kind) {
    var eg = book.engagements || {};
    var list = kind === 'poll' ? (eg.polls || [])
      : kind === 'prediction' ? (eg.predictions || []) : (eg.debates || []);
    return list[0] || null;
  }

  function onCreated(book, item) {
    if (window.AuthorDrawer) window.AuthorDrawer.toast('Live on ' + book.title + '.');
    // Re-read from the server so the new item (and its real id + totals)
    // shows up in the engagement list straight away.
    refreshBooks();
  }

  function wireEngagementCreator() {
    if (!window.DroboardBookCard || !window.DroboardBookCard.configure) return;
    window.DroboardBookCard.configure({
      onEngage: function (book, anchorEl, kind) {
        if (!window.DroboardEngagementCreator) return;
        const existing = existingFor(book, kind);
        window.DroboardEngagementCreator.open({
          bookId: book.id,
          bookTitle: book.title,
          kind: kind, // picker chose Poll / Prediction / Debate
          existing: existing,
          submit: function (payload) { return createEngagement(book.id, payload); },
          onUpdate: function (payload) { return updateEngagement(book.id, kind, existing.id, payload); },
          onCreated: function (item) { onCreated(book, item); },
        });
      }
    });
  }

  function openDrawer() { document.getElementById('drawer').classList.add('open'); document.getElementById('drawerOverlay').classList.add('open'); }
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('open'); }

  async function hydrate() {
    try {
      // Get current user from session. A cookie-only login has no stored user
      // row yet, so restore it from /api/users/me before painting the greeting.
      var userSession = window.AuthSession && window.AuthSession.getSync ? window.AuthSession.getSync() : {};
      if (!userSession.name && window.AuthSession && window.AuthSession.ensureAccount) {
        try { await window.AuthSession.ensureAccount(); userSession = window.AuthSession.getSync(); } catch (e) {}
      }
      var currentUser = userSession.name || userSession.handle || '';

      // Update welcome message with the real signed-in name
      var welcomeEl = document.querySelector('.welcome-greet');
      if (welcomeEl) {
        welcomeEl.textContent = currentUser ? ('Welcome back, ' + currentUser + ' 👋') : 'Welcome back 👋';
      }

      // Topbar avatar = the signed-in user's own image, never a demo face.
      var avatarImg = document.getElementById('userAvatarImg');
      if (avatarImg) {
        avatarImg.onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
        avatarImg.src = userSession.avatar || '../assets/droboard-icon.png';
        avatarImg.alt = currentUser + ' avatar';
      }

      // Fetch stats from API. The author dashboard returns
      // { stats: {books, contracts, reads, followers, earnings, completionRate,
      // pendingReviews}, growth: {reads, followers, earnings, completionRate} }.
      // An array is still accepted for older deployments.
      var statsRes = await api.getStats() || {};
      STATS.length = 0;
      if (Array.isArray(statsRes)) {
        statsRes.forEach(function (s) {
          STATS.push({
            label: s.label || s.name || 'Unknown',
            num: String(s.value != null ? s.value : (s.num != null ? s.num : 0)),
            growth: s.growth == null ? null : s.growth,
            icon: s.icon || 'fa-chart-simple',
            bg: s.bg || 'rgba(200,200,200,.08)',
            color: s.color || '#666',
            href: s.href || ''
          });
        });
      } else if (statsRes.stats) {
        var s = statsRes.stats || {};
        var g = statsRes.growth || {};
        STATS.push(
          { label: 'Books', num: fmtNum(s.books), growth: g.books, note: 'all time', icon: 'fa-book-open', bg: 'rgba(99,102,241,.12)', color: '#6366f1' },
          { label: 'Reads', num: fmtNum(s.reads), growth: g.reads, icon: 'fa-eye', bg: 'rgba(16,185,129,.12)', color: '#10b981' },
          { label: 'Followers', num: fmtNum(s.followers), growth: g.followers, icon: 'fa-users', bg: 'rgba(59,130,246,.12)', color: '#3b82f6' },
          { label: 'Earnings', num: fmtNum(s.earnings), growth: g.earnings, icon: 'fa-sack-dollar', bg: 'rgba(245,158,11,.12)', color: '#f59e0b', href: 'earnings.html' },
          { label: 'Contracts', num: fmtNum(s.contracts), growth: g.contracts, note: 'all time', icon: 'fa-file-signature', bg: 'rgba(168,85,247,.12)', color: '#a855f7', href: 'apply-contract.html' },
          { label: 'Completion rate', num: fmtNum(s.completionRate) + '%', growth: g.completionRate, note: 'published ÷ total', icon: 'fa-circle-check', bg: 'rgba(20,184,166,.12)', color: '#14b8a6' }
        );
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load statistics. Please refresh the page.</div>';
    }

    try {
      // Fetch books from API
      var live = await api.getBooks();
      BOOKS.length = 0;
      if (!Array.isArray(live) || live.length === 0) {
        document.getElementById('bookList').innerHTML = '<div class="empty">No books found. Create your first book to get started.</div>';
        return;
      }
      live.forEach(function (b) {
        var rejected = b.status === 'draft' && b.reviewFeedback;
        BOOKS.push({
          id: b.id, title: b.title || 'Untitled',
          genre: b.genre || '', cover: b.cover || '',
          reads: fmtNum(b.reads), likes: fmtNum(b.likes),
          chapters: b.chapterCount || 0,
          status: rejected ? 'rejected' : (b.status || 'draft'),
          statusLabel: rejected ? 'Needs Changes' : undefined,
          statusClass: rejected ? 'rejected' : (b.status || 'draft'),
          // Book-level engagement (the layer the author creates here). The
          // chapter layer lives with each chapter in the reader.
          engagements: {
            polls: b.polls || [],
            predictions: b.predictions || [],
            debates: b.debates || []
          }
        });
      });
      renderBooks();
      renderEngagements();
    } catch (e) {
      console.error('Failed to load books:', e);
      document.getElementById('bookList').innerHTML = '<div class="empty" style="color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load books. Please refresh the page.</div>';
    }
  }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  /* ── STORY ENGAGEMENT (book level) ──────────────────────────────────
     The author's own polls / predictions / debates, with the live totals
     readers see on the story page. Edit keeps the item id (so the votes
     already cast stay attached); Delete removes it. */
  var ENG_EDIT = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function engLabel(kind) { return kind === 'poll' ? 'Poll' : kind === 'prediction' ? 'Prediction' : 'Debate'; }
  function engIcon(kind) { return kind === 'poll' ? '📊' : kind === 'prediction' ? '🔮' : '⚔️'; }
  function engTotal(item, kind) {
    if (kind === 'debate') return (item.forV || 0) + (item.agV || 0);
    return (item.opts || []).reduce(function (a, o) { return a + (o.v || 0); }, 0);
  }
  function engRows() {
    var out = [];
    BOOKS.forEach(function (b) {
      var e = b.engagements || {};
      [['poll', e.polls || []], ['prediction', e.predictions || []], ['debate', e.debates || []]]
        .forEach(function (pair) {
          pair[1].forEach(function (item) { out.push({ book: b, kind: pair[0], item: item }); });
        });
    });
    return out;
  }
  function engEditForm(r) {
    var actions = '<div class="eng-edit-actions"><button class="eng-btn primary" data-eng-save="1">Save</button>' +
      '<button class="eng-btn" data-eng-cancel="1">Cancel</button></div>';
    if (r.kind === 'debate') {
      return '<div class="eng-edit">' +
        '<input class="eng-input" id="engMotion" value="' + esc(r.item.motion || '') + '" placeholder="The motion"/>' +
        '<input class="eng-input" id="engFor" value="' + esc(r.item.forText || 'For') + '" placeholder="Label for the FOR side"/>' +
        '<input class="eng-input" id="engAgainst" value="' + esc(r.item.againstText || 'Against') + '" placeholder="Label for the AGAINST side"/>' +
        actions + '</div>';
    }
    var opts = (r.item.opts || []).map(function (o, i) {
      return '<input class="eng-input" data-eng-opt="' + i + '" value="' + esc(o.t || '') + '" placeholder="Option ' + (i + 1) + '"/>';
    }).join('');
    return '<div class="eng-edit">' +
      '<input class="eng-input" id="engQuestion" value="' + esc(r.item.q || '') + '" placeholder="Question"/>' +
      opts + actions + '</div>';
  }
  function renderEngagements() {
    var wrap = document.getElementById('engagementList');
    if (!wrap) return;
    var rows = engRows();
    if (!rows.length) {
      wrap.innerHTML = '<div class="eng-empty">No story engagement yet. Use the ⋯ menu on a book to add a Poll, Prediction or Debate — readers see it on the story page.</div>';
      return;
    }
    wrap.innerHTML = rows.map(function (r, i) {
      var editing = !!(ENG_EDIT && ENG_EDIT.bookId === r.book.id && ENG_EDIT.kind === r.kind && ENG_EDIT.itemId === String(r.item.id));
      var detail = r.kind === 'debate'
        ? (r.item.forV || 0) + ' for · ' + (r.item.agV || 0) + ' against'
        : (r.item.opts || []).map(function (o) { return o.t + ' (' + (o.v || 0) + ')'; }).join(' · ');
      var head = '<div class="eng-row-head">' +
        '<span class="eng-ico">' + engIcon(r.kind) + '</span>' +
        '<span class="eng-kind">' + engLabel(r.kind) + '</span>' +
        '<span class="eng-q">' + esc(r.kind === 'debate' ? (r.item.motion || '') : (r.item.q || '')) + '</span>' +
        '<span class="eng-total">' + engTotal(r.item, r.kind) + ' votes</span>' +
        '</div>' +
        '<div class="eng-meta">' + esc(r.book.title) + ' · ' + esc(detail) + '</div>';
      var actions = editing ? '' :
        '<div class="eng-actions">' +
        '<button class="eng-btn" data-eng-edit="' + i + '">Edit</button>' +
        '<button class="eng-btn danger" data-eng-del="' + i + '">Delete</button>' +
        '</div>';
      return '<div class="eng-item">' + head + actions + (editing ? engEditForm(r) : '') + '</div>';
    }).join('');
    bindEngagementActions();
  }
  function bindEngagementActions() {
    var wrap = document.getElementById('engagementList');
    if (!wrap) return;
    wrap.querySelectorAll('[data-eng-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = engRows()[parseInt(btn.getAttribute('data-eng-edit'), 10)];
        if (!r) return;
        ENG_EDIT = { bookId: r.book.id, kind: r.kind, itemId: String(r.item.id) };
        renderEngagements();
      });
    });
    wrap.querySelectorAll('[data-eng-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = engRows()[parseInt(btn.getAttribute('data-eng-del'), 10)];
        if (!r) return;
        var label = r.kind === 'debate' ? (r.item.motion || '') : (r.item.q || '');
        if (!window.confirm('Delete this ' + engLabel(r.kind).toLowerCase() + '?\n\n"' + label + '"\n\nReaders will stop seeing it, and its votes go with it.')) return;
        deleteEngagement(r);
      });
    });
    wrap.querySelectorAll('[data-eng-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () { ENG_EDIT = null; renderEngagements(); });
    });
    wrap.querySelectorAll('[data-eng-save]').forEach(function (btn) {
      btn.addEventListener('click', function () { saveEngagement(); });
    });
  }
  function engItemUrl(bookId, kind, itemId) {
    return CFG.API_BASE + '/books/' + encodeURIComponent(bookId) + '/engagement/' + kind + '/' + encodeURIComponent(itemId);
  }
  async function deleteEngagement(r) {
    try {
      var res = await fetch(engItemUrl(r.book.id, r.kind, r.item.id), {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error('status ' + res.status);
      ENG_EDIT = null;
      await refreshBooks();
      toast('Deleted');
    } catch (e) {
      toast('Could not delete — try again');
    }
  }
  async function saveEngagement() {
    if (!ENG_EDIT) return;
    var rows = engRows();
    var r = rows.find(function (x) {
      return x.book.id === ENG_EDIT.bookId && x.kind === ENG_EDIT.kind && String(x.item.id) === ENG_EDIT.itemId;
    });
    if (!r) { ENG_EDIT = null; renderEngagements(); return; }
    var body = {};
    if (r.kind === 'debate') {
      var motion = (document.getElementById('engMotion') || {}).value;
      var forText = (document.getElementById('engFor') || {}).value;
      var againstText = (document.getElementById('engAgainst') || {}).value;
      if (!motion || !motion.trim()) { toast('The motion cannot be empty'); return; }
      body.motion = motion.trim();
      body.forText = (forText || '').trim() || 'For';
      body.againstText = (againstText || '').trim() || 'Against';
    } else {
      var q = (document.getElementById('engQuestion') || {}).value;
      if (!q || !q.trim()) { toast('The question cannot be empty'); return; }
      body.question = q.trim();
      var opts = Array.prototype.slice.call(document.querySelectorAll('[data-eng-opt]')).map(function (i) { return (i.value || '').trim(); });
      if (opts.some(function (t) { return !t; })) { toast('Every option needs a label'); return; }
      body.opts = opts;
    }
    try {
      var res = await fetch(engItemUrl(r.book.id, r.kind, r.item.id), {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('status ' + res.status);
      ENG_EDIT = null;
      await refreshBooks();
      toast('Saved');
    } catch (e) {
      toast('Could not save — try again');
    }
  }
  // Re-read the author's books so the engagement list shows the server truth.
  async function refreshBooks() {
    try {
      var live = await api.getBooks();
      BOOKS.length = 0;
      (live || []).forEach(function (b) {
        BOOKS.push({
          id: b.id, title: b.title || 'Untitled',
          genre: b.genre || '', cover: b.cover || '',
          reads: fmtNum(b.reads), likes: fmtNum(b.likes),
          chapters: b.chapterCount || 0,
          status: b.status || 'draft',
          statusClass: b.status || 'draft',
          engagements: {
            polls: b.polls || [], predictions: b.predictions || [], debates: b.debates || []
          }
        });
      });
      renderBooks();
      renderEngagements();
    } catch (e) { /* keep the current paint */ }
  }
  function toast(msg) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) { window.AuthorDrawer.toast(msg); return; }
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    var t = document.getElementById('toast');
    if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2200); }
  }

  var api = {
    getStats: async function () { return await callBackend('/dashboard'); },
    getBooks: async function () { return await callBackend('/books'); },
    init: init,
    _STATS: STATS,
    _BOOKS: BOOKS
  };

  function init() {
    wireEngagementCreator();
    renderBooks();
    renderEngagements();
    hydrate().then(function() {
      renderStats();
    }).catch(function(e) {
      console.error('Hydration failed:', e);
      document.getElementById('statGrid').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i> Failed to load data. Please refresh the page.</div>';
    });
    if (window.AuthorDrawer) { window.AuthorDrawer.render('author-center.html'); window.AuthorDrawer.bind(); }
    else {
      document.getElementById('menuBtn').addEventListener('click', openDrawer);
      document.getElementById('drawerClose').addEventListener('click', closeDrawer);
      document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    }
    var nb = document.getElementById('newBookBtn');
    if (nb) nb.addEventListener('click', function () { /* hook up to your "create book" flow */ });
    if (window.DroboardNav) window.DroboardNav.configure({ active: 'profile' });
  }

  window.AuthorCenterService = api;
})();
