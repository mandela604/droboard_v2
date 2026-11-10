/* ═══════════════════════════════════════════════════════════════
   STATUS SERVICE — window.DroboardStatus (live)
   My ephemeral statuses + every writer ring, straight from the API:

     GET    /api/statuses/me                → { statuses: [slide] }
     POST   /api/statuses                   { bg, quote, caption, storyRef? } → slide
     GET    /api/statuses/writers?handles=  → [{ handle, statuses: [slide] }]
     POST   /api/statuses/:id/view          { anonId } → { views }
     GET    /api/statuses/:id/viewers       → { views, named, guests }

   Photo backgrounds upload through POST /api/uploads/image first; the
   composer's gradient presets post as-is (backend allowlist). Seen-state
   stays client-side in StatusStore (per device); the backend owns slides,
   views and likes. No demo data anywhere in this file.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API_BASE = '/api';
  var ANON_KEY = 'dro_status_anon_id';

  /* Stable guest id so a signed-out reader counts once per status, not once
     per open. Survives reloads; scoped to this browser. */
  function anonId() {
    try {
      var v = localStorage.getItem(ANON_KEY);
      if (!v) {
        v = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(ANON_KEY, v);
      }
      return v;
    } catch (e) { return ''; }
  }

  function _store() { return window.StatusStore || null; }
  function _ring(idOrHandle, statuses, meta) {
    var st = _store();
    if (!st || typeof st.register !== 'function') return null;
    try { return st.register(idOrHandle, statuses || [], meta || {}); } catch (e) { return null; }
  }
  function _normName(v) {
    return String(v || '').replace(/^@/, '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  }
  function _hKey(handle) { return 'wr:' + _normName(handle); }
  function _viewed(handle, slide, index) {
    var st = _store();
    if (st && typeof st.isStatusSeen === 'function') {
      try { return st.isStatusSeen(_hKey(handle), slide, index); } catch (e) {}
    }
    return !!slide.viewed;
  }

  function meIdentity() {
    var name = 'You', avatar = '';
    try {
      if (window.AuthSession && typeof window.AuthSession.getSync === 'function') {
        var s = window.AuthSession.getSync() || {};
        if (s.name) name = s.name;
        if (s.avatar) avatar = s.avatar;
      } else if (window.DroboardUser) {
        if (window.DroboardUser.name) name = window.DroboardUser.name;
        if (window.DroboardUser.avatar) avatar = window.DroboardUser.avatar;
      }
    } catch (e) {}
    return { name: name, avatar: avatar };
  }

  /* ── My statuses: the backend is the only source ── */
  var _myCache = [];
  var _myPending = null;

  function _mapMine(s) {
    s = s || {};
    return {
      id: String(s.id || ''), bg: s.bg || '',
      quote: s.quote || '', caption: s.caption || '',
      storyRef: s.storyRef && s.storyRef.id ? s.storyRef : null,
      time: s.time || 'Just now', ts: s.ts || Date.now(),
      likes: s.likes || 0, views: s.views || 0,
      viewed: !!s.viewed, isLive: !!s.isLive, expiresAt: s.expiresAt || null,
    };
  }

  /* Prefetch my active slides. Pages await this before painting the story
     row; 401/403 means a guest (no story of their own), any other failure
     rejects so the page can surface it. */
  function refreshMine() {
    if (_myPending) return _myPending;
    var p = fetch(API_BASE + '/statuses/me', { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) return { statuses: [] };
        if (!r.ok) throw new Error('Statuses API failed: ' + r.status);
        return r.json();
      })
      .then(function (d) {
        _myCache = ((d && d.statuses) || []).map(_mapMine);
        return _myCache;
      });
    _myPending = p;
    p.then(function () { _myPending = null; }, function () { _myPending = null; });
    return p;
  }

  function slides() { return _myCache; }

  function _errFrom(json, status) {
    var code = json && json.error;
    var friendly = {
      bad_bg: 'That background can’t be used — pick a preset or upload a photo.',
      no_file: 'Pick a background first.',
      image_too_large: 'Image is too large (max 2 MB).',
      bad_image_type: 'Only PNG, JPEG, WebP or GIF images are allowed.',
      images_not_configured: 'Image hosting is not configured yet.',
      images_upload_failed: 'Image upload failed — try again.',
      unauthorized: 'Sign in to post a status.',
    };
    var e = new Error(friendly[code] || (code ? String(code).replace(/_/g, ' ') : 'Could not post your status.'));
    e.status = status;
    return e;
  }

  /* data:/blob: preview → real bytes → Cloudflare delivery URL. */
  async function _uploadBg(bg) {
    var blob = await (await fetch(bg)).blob();
    if (blob.size > 2 * 1024 * 1024) {
      var e = new Error('Image is too large (max 2 MB).'); e.status = 400; throw e;
    }
    var fd = new FormData();
    var ext = (blob.type && blob.type.split('/')[1]) || 'png';
    fd.append('file', new File([blob], 'status.' + ext, { type: blob.type || 'image/png' }));
    var res = await fetch(API_BASE + '/uploads/image', { method: 'POST', credentials: 'include', body: fd });
    var json = null; try { json = await res.json(); } catch (e) {}
    if (!res.ok) throw _errFrom(json, res.status);
    return json.url;
  }

  /* Post one status slide straight to my story (not the feed). Resolves with
     the created slide; rejects with a readable Error the composer toasts. */
  async function post(slide) {
    slide = slide || {};
    var bg = String(slide.bg || '').trim();
    if (!bg) { var e0 = new Error('Pick a background first.'); e0.status = 400; throw e0; }
    if (/^(data|blob):/i.test(bg)) bg = await _uploadBg(bg);
    var body = {
      bg: bg,
      quote: String(slide.quote || '').slice(0, 500),
      caption: String(slide.caption || '').slice(0, 500),
    };
    if (slide.storyRef && slide.storyRef.id) {
      body.storyRef = {
        id: String(slide.storyRef.id).slice(0, 120),
        title: String(slide.storyRef.title || '').slice(0, 200),
        author: String(slide.storyRef.author || '').slice(0, 120),
        cover: String(slide.storyRef.cover || '').slice(0, 2800),
      };
    }
    var res = await fetch(API_BASE + '/statuses', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var json = null; try { json = await res.json(); } catch (e) {}
    if (!res.ok) throw _errFrom(json, res.status);
    var item = _mapMine(json);
    _myCache.unshift(item);
    return item;
  }

  /* Viewer marked my slides seen → per-slide flags in the shared store. */
  function markViewed() {
    var changed = false;
    var st = _store();
    _myCache.forEach(function (s, i) {
      if (st && typeof st.markSeen === 'function') {
        try { st.markSeen('you', s, i); } catch (e) {}
      }
      if (s && !s.viewed) { s.viewed = true; changed = true; }
    });
    return changed;
  }

  function _mySlides() {
    var st = _store();
    return _myCache.map(function (s, i) {
      var viewed = !!s.viewed;
      if (st && typeof st.isStatusSeen === 'function') {
        try { viewed = st.isStatusSeen('you', s, i); } catch (e) {}
      }
      return {
        id: s.id, bg: s.bg, quote: s.quote, caption: s.caption,
        storyRef: s.storyRef || null, viewed: viewed,
        views: s.views || 0, likes: s.likes || 0,
        isLive: !!s.isLive, time: s.time,
      };
    });
  }

  /* Story-row entry for me (replaces the static 'you' tile). */
  function myEntry() {
    var me = meIdentity();
    var mine = _mySlides();
    var ring = mine.length ? (_ring('you', mine, { isMine: true }) || 'ring-live') : 'ring-none';
    return {
      id: 'you', name: 'Your Story', you: true, isMine: true,
      avatar: me.avatar || '',
      ring: ring,
      likes: 0, threads: mine.length, views: mine.reduce(function (n, s) { return n + (s.views || 0); }, 0),
      statuses: mine,
    };
  }

  /* Merge my live entry over a stories array (feed/profile rows). */
  function mergeStories(stories) {
    var mine = null;
    try { mine = myEntry(); } catch (e) { return stories; }
    var out = (stories || []).map(function (s) { return (s && s.you) ? mine : s; });
    if (!out.some(function (s) { return s && s.you; })) out.unshift(mine);
    return out;
  }

  /* ── Views ── */
  function recordView(slide, writer) {
    var sid = slide && slide.id ? String(slide.id) : '';
    if (!sid) return Promise.resolve(null);
    if (writer && (writer.isMine || writer.you || String(writer.id) === 'you')) return Promise.resolve(null);
    return fetch(API_BASE + '/statuses/' + encodeURIComponent(sid) + '/view', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: anonId() }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.views != null) slide.views = d.views;
      return d;
    }).catch(function () { return null; });
  }

  /* Owner "Seen by" list: named readers + guest total. Rejects on failure so
     the sheet can show an error instead of a fake zero. */
  function viewers(statusId) {
    var sid = String(statusId || '');
    if (!sid) return Promise.resolve({ views: 0, named: [], guests: 0, lastAt: null });
    return fetch(API_BASE + '/statuses/' + encodeURIComponent(sid) + '/viewers', { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('Viewers API failed: ' + r.status);
        return r.json();
      });
  }

  /* ═══════════════════════════════════════════════════════════════
     WRITER STATUSES — every ring on every surface reads this cache.
     loadWriters(handles) fills it from GET /api/statuses/writers; an
     answer here (empty included) IS the backend's truth, so a handle
     already asked about never invents slides. writerStatuses() stays
     synchronous for renderers: an unknown handle kicks a background
     fetch and the ring repaints when the answer lands.
     ═══════════════════════════════════════════════════════════════ */
  var _writerGroups = {};
  var _writerMeta = {};
  var _liveWriters = {};
  var _pending = {};

  function _liveSlide(handle, s, i) {
    var slide = {
      id: String((s && s.id) || ''), bg: (s && s.bg) || '',
      quote: (s && s.quote) || '', caption: (s && s.caption) || '',
      storyRef: (s && s.storyRef && s.storyRef.id) ? s.storyRef : null,
      time: (s && s.time) || 'Just now', ts: (s && s.ts) || Date.now(),
      likes: (s && s.likes) || 0, liked: !!(s && s.liked),
      isLive: !!(s && s.isLive), expiresAt: (s && s.expiresAt) || null,
      viewed: false,
    };
    slide.viewed = _viewed(handle, slide, i);
    return slide;
  }

  function _fetchBatch(missing) {
    var p = fetch(API_BASE + '/statuses/writers?handles=' + encodeURIComponent(missing.join(',')),
      { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('Writers API failed: ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        var got = {};
        (rows || []).forEach(function (row) {
          if (!row || !row.handle) return;
          var k = _normName(row.handle);
          got[k] = (row.statuses || []).map(function (s, i) { return _liveSlide(k, s, i); });
        });
        missing.forEach(function (k) { _liveWriters[k] = got[k] || []; });
      })
      .catch(function () {
        // Nothing was answered: let a later render retry rather than pinning
        // every writer to "no ring" for the session.
        missing.forEach(function (k) { delete _pending[k]; });
      });
    missing.forEach(function (k) { _pending[k] = p; });
    return p;
  }

  /* Prefetch the rings for a row. Resolves once every handle has an answer;
     render stays synchronous through writerStatuses(), which reads the cache. */
  function loadWriters(handles) {
    var list = [];
    (handles || []).forEach(function (h) {
      var k = _normName(h);
      if (k && k !== 'you' && list.indexOf(k) === -1) list.push(k);
    });
    if (!list.length) return Promise.resolve([]);
    var waits = [];
    var missing = [];
    list.forEach(function (k) {
      if (_liveWriters[k]) return;
      if (_pending[k]) { waits.push(_pending[k]); return; }
      missing.push(k);
    });
    if (missing.length) waits.push(_fetchBatch(missing));
    if (!waits.length) return Promise.resolve(list.map(function (k) { return _liveWriters[k]; }));
    return Promise.all(waits).then(function () {
      return list.map(function (k) { return _liveWriters[k] || []; });
    });
  }

  /* A ring repaint + tap upgrade for surfaces that rendered before the
     lineup arrived (status-ring.js listens for the same event). */
  function _announce() {
    try {
      var st = _store();
      if (st && typeof st.applyAll === 'function') st.applyAll();
    } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('droboard:statuses-ready')); } catch (e) {}
  }

  /* A writer's REAL lineup, or none while the answer is in flight. Never
     invents slides: an invented lineup gives the avatar a ring no viewer
     can play, and "viewed" can never reconcile. */
  function writerStatuses(handle) {
    var key = _normName(handle);
    if (!key || key === 'you') return [];
    if (_liveWriters[key]) {
      // Re-read the client's own seen-state on every render, so a row redrawn
      // after the reader opens a story shows the ring StatusStore actually has.
      _liveWriters[key].forEach(function (s, i) { s.viewed = _viewed(key, s, i); });
      return _liveWriters[key];
    }
    if (!_writerMeta[key]) {
      _writerMeta[key] = { name: String(handle || '').replace(/^@/, '').trim(), handle: key, avatar: '' };
    }
    if (!_pending[key]) {
      loadWriters([key]).then(function () {
        _ring(_hKey(key), _liveWriters[key] || [], {});
        _announce();
      }).catch(function () {});
    }
    return [];
  }

  /* Identity captured when a surface first asked about a handle — lets the
     ring component build a viewer entry for late-arriving lineups. */
  function writerInfo(handle) {
    return _writerMeta[_normName(handle)] || null;
  }

  /* Enrich writer rows with id/statuses/ring; also keeps the group so
     the viewer can page between writers in the same row. */
  function decorateWriters(writers) {
    var list = (writers || []).map(function (w) {
      var handle = String(w.handle || w.id || '').replace(/^@/, '');
      var wid = _hKey(handle);
      var statuses = writerStatuses(handle);
      var ring = _ring(wid, statuses, { isLive: !!w.isLive }) || (statuses.length ? 'ring-has' : 'ring-none');
      return {
        id: wid,
        handle: handle,
        name: w.name || handle,
        avatar: w.avatar || '',
        statuses: statuses,
        ring: ring,
        likes: 0,
        threads: statuses.length,
      };
    });
    list.forEach(function (w) { _writerGroups[w.id] = list; });
    try {
      var st = _store();
      if (st && typeof st.syncLive === 'function') st.syncLive(list.map(function (w) { return w.handle; }));
    } catch (e) {}
    return list;
  }

  /* Profile page: the visited person's current status lineup (same slides
     every surface uses), plus a ready-to-open viewer entry. */
  function profileStatuses(handle) {
    return writerStatuses(handle);
  }
  function profileEntry(handle, name, avatar) {
    var clean = String(handle || '').replace(/^@/, '').trim();
    if (!clean) return null;
    var statuses = writerStatuses(clean);
    if (!statuses.length) return null;
    var wid = _hKey(clean);
    return {
      id: wid, handle: clean, name: name || clean, avatar: avatar || '',
      statuses: statuses, ring: _ring(wid, statuses, {}) || 'ring-has',
      likes: 0, threads: statuses.length,
    };
  }
  function ringOf(handle) {
    var clean = String(handle || '').replace(/^@/, '').trim();
    if (!clean) return null;
    var st = _store();
    if (st && typeof st.ringOf === 'function') {
      try { var r = st.ringOf(_hKey(clean)); if (r) return r; } catch (e) {}
    }
    return _ring(_hKey(clean), writerStatuses(clean), {});
  }

  /* Tag a fetched stories row with store-derived rings (feed/home). Slides
     come from the API roster; this only reconciles per-device seen-state. */
  function registerStories(stories) {
    var liveKeys = [];
    (stories || []).forEach(function (s) {
      if (!s) return;
      if (s.you || s.isYou) {
        if (!s.statuses || !s.statuses.length) { s.ring = 'ring-none'; return; }
        s.ring = _ring('you', s.statuses, { isMine: true }) || s.ring;
        return;
      }
      var key = s.name || s.handle || s.id;
      if (!s.statuses || !s.statuses.length) { s.ring = 'ring-none'; return; }
      s.ring = _ring(key, s.statuses, { isLive: !!s.isLive }) || s.ring;
      s.statuses.forEach(function (st, i) {
        if (st && typeof st.viewed !== 'boolean') st.viewed = _viewed(key, st, i);
      });
      liveKeys.push(key);
    });
    try {
      var st = _store();
      if (st && typeof st.syncLive === 'function') st.syncLive(liveKeys);
    } catch (e) {}
    return stories;
  }

  function openWriterStatus(id) {
    var list = _writerGroups[id];
    if (!list || typeof window.openStatusViewer !== 'function') return false;
    var target = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id && list[i].statuses && list[i].statuses.length) { target = list[i]; break; }
    }
    if (!target) return false;
    window.openStatusViewer(list, id);
    return true;
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-writer-status]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    if (openWriterStatus(el.getAttribute('data-writer-status'))) return;
    var handle = el.getAttribute('data-writer-handle') || '';
    location.href = 'profile.html?u=' + encodeURIComponent(handle);
  });

  window.DroboardStatus = {
    post: post, refreshMine: refreshMine, slides: slides,
    myEntry: myEntry, mergeStories: mergeStories, markViewed: markViewed,
    writerStatuses: writerStatuses, writerInfo: writerInfo,
    decorateWriters: decorateWriters, openWriterStatus: openWriterStatus,
    loadWriters: loadWriters,
    profileStatuses: profileStatuses, profileEntry: profileEntry, ringOf: ringOf,
    registerStories: registerStories,
    recordView: recordView, viewers: viewers, anonId: anonId,
  };
})();