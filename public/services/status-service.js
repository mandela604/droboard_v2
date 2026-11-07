/* ═══════════════════════════════════════════════════════════════
   STATUS SERVICE — window.DroboardStatus
   My ephemeral statuses (story row → status viewer). Demo: my slides
   persist in localStorage 'dro_my_statuses_v1' (24h expiry), merged over
   the feed's seed stories at render time. Live: swap to API:

     GET  /api/statuses/me   → { statuses: [{bg,quote,caption,time}] }
     POST /api/statuses       { bg, quote, caption } → slide
     (feed/profile read the merged row; viewer reads slide list)

   Slide shape matches status-viewer.js: { bg, quote, caption, time }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var USE_API = false;
  var API_BASE = '/api';
  var MY_KEY = 'dro_my_statuses_v1';
  var ANON_KEY = 'dro_status_anon_id';
  var VIEWS_KEY = 'dro_status_views_v1';
  var DAY = 864e5;

  function _hash(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  /* A slide is "live" when its id came from the backend: ids are stored uuidv7
     (8-4-4-4-12 hex), with the legacy 24-char ObjectId string as a fallback.
     Demo ids ('my_…', 'fd:handle.0', 'usr:handle.0') match neither, so this is
     the only reliable way to tell a real status from a seeded one. */
  function _isLiveStatusId(id) {
    var s = String(id || '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
      /^[a-f0-9]{24}$/i.test(s);
  }

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
  function viewerId() {
    try {
      var u = (window.AuthSession && typeof AuthSession.getStoredUser === 'function')
        ? AuthSession.getStoredUser() : null;
      if (u && (u.id || u.uid)) return String(u.id || u.uid);
    } catch (e) {}
    try {
      if (window.DroboardUser && (window.DroboardUser.id || window.DroboardUser.uid)) {
        return String(window.DroboardUser.id || window.DroboardUser.uid);
      }
    } catch (e) {}
    return anonId();
  }

  /* ── Demo view log: who (per guest/device) opened which slide ── */
  function _viewLog() {
    try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function _saveViewLog(log) {
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(log)); } catch (e) {}
  }

  /* Deterministic demo audience for a slide, so the owner's "Seen by" sheet
     has something believable to render before the backend is switched on. */
  var DEMO_VIEWERS = [
    { name: 'Amara Cole', handle: 'amara_cole', img: 5 },
    { name: 'Tunde Bello', handle: 'tunde_writes', img: 12 },
    { name: 'Lia Moreno', handle: 'lia_reads', img: 32 },
    { name: 'Kofi Mensah', handle: 'kofi_m', img: 15 },
    { name: 'Sana Iqbal', handle: 'sana_iqbal', img: 45 },
    { name: 'Noah Reyes', handle: 'noah_reyes', img: 11 },
    { name: 'Esi Danquah', handle: 'esi_d', img: 25 },
    { name: 'Ravi Sharma', handle: 'ravi_s', img: 33 },
    { name: 'Mina Park', handle: 'mina_park', img: 47 },
    { name: 'Jonas Weber', handle: 'jonas_w', img: 52 },
    { name: 'Faith Okoro', handle: 'faith_o', img: 26 },
    { name: 'Deni Yusuf', handle: 'deni_y', img: 41 },
  ];
  function _demoRoster(statusId) {
    var h = _hash(statusId);
    var n = 2 + (h % 8);
    var out = [];
    for (var i = 0; i < n; i++) {
      var p = DEMO_VIEWERS[(h + i * 5) % DEMO_VIEWERS.length];
      var mins = 3 + ((h >> (i + 1)) % 240) + i * 11;
      out.push({
        id: 'demo_' + String(statusId) + '_' + i,
        name: p.name, handle: p.handle,
        avatar: 'https://i.pravatar.cc/80?img=' + p.img,
        at: new Date(Date.now() - mins * 60000).toISOString(),
      });
    }
    return out;
  }

  /* Total views for a demo slide: seeded audience + real local opens. */
  function _viewsOf(slide) {
    if (!slide) return 0;
    var log = _viewLog()[String(slide.id)] || [];
    return _demoRoster(slide.id).length + log.length;
  }

  /* Record one view. Live: POST /view (works signed in AND signed out via
     anonId). Demo: append to the local log. Never counts the owner's own
     preview. Resolves { views } where the backend exposes it. */
  function recordView(slide, writer) {
    var sid = slide && slide.id ? String(slide.id) : '';
    if (!sid) return Promise.resolve(null);
    if (writer && (writer.isMine || writer.you || String(writer.id) === 'you')) return Promise.resolve(null);

    if (USE_API && _isLiveStatusId(sid)) {
      return fetch(API_BASE + '/statuses/' + encodeURIComponent(sid) + '/view', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: anonId() }),
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.views != null) slide.views = d.views;
        return d;
      }).catch(function () { return null; });
    }
    if (_isLiveStatusId(sid)) return Promise.resolve(null);

    var log = _viewLog();
    var list = log[sid] || [];
    var vid = viewerId();
    if (!list.some(function (v) { return v.vid === vid; })) {
      list.push({ vid: vid, at: new Date().toISOString() });
      log[sid] = list.slice(-500);
      _saveViewLog(log);
    }
    slide.views = _viewsOf(slide);
    return Promise.resolve({ views: slide.views });
  }

  /* Owner "Seen by" list. Live: GET /:id/viewers (named readers + guest
     total). Demo: seeded roster + local guest opens. */
  function viewers(statusId) {
    var sid = String(statusId || '');
    var empty = { views: 0, named: [], guests: 0, lastAt: null };
    if (!sid) return Promise.resolve(empty);

    if (USE_API && _isLiveStatusId(sid)) {
      return fetch(API_BASE + '/statuses/' + encodeURIComponent(sid) + '/viewers', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d || empty; })
        .catch(function () { return empty; });
    }

    var named = _demoRoster(sid);
    var guests = 0;
    (_viewLog()[sid] || []).forEach(function (v) {
      if (String(v.vid || '').indexOf('anon_') === 0) guests += 1;
      else named.push({ id: v.vid, name: 'Reader', handle: '', avatar: '', at: v.at });
    });
    named.sort(function (a, b) { return new Date(b.at || 0) - new Date(a.at || 0); });
    return Promise.resolve({
      id: sid,
      views: named.length + guests,
      named: named,
      guests: guests,
      lastAt: (named[0] && named[0].at) || null,
    });
  }

  function loadMine() {
    try {
      var list = JSON.parse(localStorage.getItem(MY_KEY) || '[]') || [];
      var now = Date.now();
      list = list.filter(function (s) { return s && (!s.ts || now - s.ts < DAY); });
      var changed = false;
      list.forEach(function (s, i) {
        if (!s.id) { s.id = 'my_' + (s.ts || now) + '_' + i; changed = true; }
        if (s.views == null) { s.views = 0; changed = true; }
      });
      if (changed) saveMine(list);
      return list;
    } catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(MY_KEY, JSON.stringify((list || []).slice(0, 20))); }
    catch (e) {}
  }
  function _store() { return window.StatusStore || null; }
  function _ring(idOrHandle, statuses, meta) {
    var st = _store();
    if (!st || typeof st.register !== 'function') return null;
    try { return st.register(idOrHandle, statuses || [], meta || {}); } catch (e) { return null; }
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
      if (!avatar && window.FeedData && window.FeedData.YOU_AV) avatar = window.FeedData.YOU_AV;
    } catch (e) {}
    return { name: name, avatar: avatar };
  }

  /* Post one status slide straight to my story (not the feed). */
  function post(slide) {
    slide = slide || {};
    var now = Date.now();
    var item = {
      id: 'my_' + now + '_' + Math.floor(Math.random() * 1e4),
      bg: slide.bg || ('https://picsum.photos/seed/drostatus' + now + '/500/900'),
      quote: slide.quote || '',
      caption: slide.caption || '',
      storyRef: slide.storyRef || null,
      time: 'Just now',
      ts: now,
      views: 0,
    };
    if (USE_API) {
      fetch(API_BASE + '/statuses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg: item.bg, quote: item.quote, caption: item.caption, storyId: item.storyRef && item.storyRef.id }),
      }).catch(function () {});
    }
    var list = loadMine();
    list.unshift(item);
    saveMine(list);
    return item;
  }

  function slides() { return loadMine(); }

  /* Viewer marked slides seen → persist the per-slide flags for my story. */
  function markViewed() {
    var list = loadMine();
    var changed = false;
    var st = _store();
    list.forEach(function (s, i) {
      if (st && typeof st.markSeen === 'function') {
        try { st.markSeen('you', s, i); } catch (e) {}
      }
      if (s && !s.viewed) { s.viewed = true; changed = true; }
    });
    if (changed) saveMine(list);
    return changed;
  }

  function _mySlides() {
    var st = _store();
    return loadMine().map(function (s, i) {
      var viewed = !!s.viewed;
      if (st && typeof st.isStatusSeen === 'function') {
        try { viewed = st.isStatusSeen('you', s, i); } catch (e) {}
      }
      return {
        id: s.id, bg: s.bg, quote: s.quote, caption: s.caption,
        storyRef: s.storyRef || null, viewed: viewed,
        views: Math.max(s.views || 0, _viewsOf(s)),
        time: s.time,
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
      avatar: me.avatar || 'https://i.pravatar.cc/100?img=51',
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

  /* ═══════════════════════════════════════════════════════════════
     WRITER STATUSES — Top Writers rows (Discover "More Stories" and
     the browse overlay). Writer identities/avatars come from
     people-service.js; only status seeds live HERE. Components call
     decorateWriters() with the people list and render the rings.

     Live swap: loadWriters(handles) fills the cache below from
       GET /api/statuses/writers?handles=a,b,c
       → [{ handle, statuses:[{ bg, quote, caption, time }] }]
     and writerStatuses() reads it, so decorateWriters() stays synchronous.
     Viewed state persists through status-viewer.js's StatusStore
     (shared key), so nothing else changes.
     ═══════════════════════════════════════════════════════════════ */
  var _writerGroups = {};
  function _hKey(handle) { return 'wr:' + String(handle || '').toLowerCase(); }
  function _viewed(handle, slide, index) {
    var st = _store();
    if (st && typeof st.isStatusSeen === 'function') {
      try { return st.isStatusSeen(_hKey(handle), slide, index); } catch (e) {}
    }
    return !!slide.viewed;
  }
  function _normName(v) {
    return String(v || '').replace(/^@/, '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  }

  /* Live lineups, keyed by lowercase handle, filled from
     GET /api/statuses/writers?handles=. An entry here IS the backend's answer —
     including the empty one, which means "no story, no ring" — so a handle we
     have already asked about must never fall back to a demo seed. Viewed state
     is NOT stored here: it stays client-side in StatusStore. */
  var _liveWriters = {};
  var _pending = {};

  function _liveSlide(handle, s, i) {
    var slide = {
      id: String((s && s.id) || ''), bg: (s && s.bg) || '',
      quote: (s && s.quote) || '', caption: (s && s.caption) || '',
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
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var got = {};
        (rows || []).forEach(function (row) {
          if (!row || !row.handle) return;
          var k = String(row.handle).toLowerCase();
          got[k] = (row.statuses || []).map(function (s, i) { return _liveSlide(k, s, i); });
        });
        missing.forEach(function (k) { _liveWriters[k] = got[k] || []; });
      })
      .catch(function () {
        // Nothing was answered: let a later row retry rather than pinning
        // every writer to "no ring" for the session.
        missing.forEach(function (k) { delete _pending[k]; });
      });
    missing.forEach(function (k) { _pending[k] = p; });
    return p;
  }

  /* Prefetch the rings for a Top Writers / browse row. Resolves once every
     handle in the list has an answer; render stays synchronous through
     writerStatuses(), which reads this cache. */
  function loadWriters(handles) {
    if (!USE_API) return Promise.resolve([]);
    var list = [];
    (handles || []).forEach(function (h) {
      var k = String(h || '').replace(/^@/, '').trim().toLowerCase();
      if (k && list.indexOf(k) === -1) list.push(k);
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
  /* Feed-row authors whose lineups only live in feed-data.js. Mirrored here
     so profile/search/discover show the SAME slides (and ids) as the feed. */
  var FEED_AUTHOR_SLIDES = {
    luna_grey: [
      { bg: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=900&fit=crop', quote: '"Chapter 21 is finally live — the truth comes out tonight."', caption: 'His Sweet Revenge · New chapter', time: '2h ago' },
      { bg: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', quote: '"I did not expect this ending. Neither will you."', caption: 'Behind the scenes', time: '1h ago' },
    ],
    alex_pierce: [
      { bg: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', quote: '"Family secrets never stay buried."', caption: 'New story teaser', time: '4h ago' },
    ],
    mia_clark: [
      { bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy story', time: '6h ago' },
    ],
    sofia: [
      { bg: 'https://i.postimg.cc/WF1j4Pnh/6.jpg', quote: '"Team Alex or Team Jaxon?"', caption: 'Poll live now', time: '5h ago' },
    ],
    jaxon: [
      { bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' },
    ],
    /* Discussion-thread regulars — declared here so a thread avatar's ring and
       the slides the viewer plays are the same lineup on every surface. */
    questgiver: [
      { bg: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=500&h=900&fit=crop', quote: '"Writing at 2am has a different energy."', caption: 'Late-night drafting', time: '3h ago' },
    ],
    runereader: [
      { bg: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=500&h=900&fit=crop', quote: '"Map point still stands — book 2 is the map book."', caption: 'Theory thread', time: '5h ago' },
    ],
    mapnerd: [
      { bg: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&h=900&fit=crop', quote: '"Geography should matter more often in this genre."', caption: 'Drafting a post', time: '2h ago' },
    ],
    bladetheory: [
      { bg: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=500&h=900&fit=crop', quote: '"The mentor line early on is the whole engine."', caption: 'Rewatching chapter 1', time: '4h ago' },
    ],
  };

  function _mapSlides(key, prefix, list) {
    return list.map(function (t, j) {
      var slide = {
        id: prefix + '.' + j,
        bg: t.bg, quote: t.quote, caption: t.caption,
        time: t.time || '2h ago', viewed: false,
      };
      slide.viewed = _viewed(key, slide, j);
      return slide;
    });
  }

  /* Canonical demo lineup per author — one source for feed/home/profile/
     search, so seen state reconciles everywhere. */
  function _demoStatuses(handle) {
    var key = _normName(handle);
    var list = (window.DemoData && window.DemoData.STATUSES) || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s || s.isYou || !s.statuses || !s.statuses.length) continue;
      if (_normName(s.name) !== key) continue;
      return _mapSlides(key, s.id || key, s.statuses);
    }
    if (FEED_AUTHOR_SLIDES[key]) return _mapSlides(key, 'fd:' + key, FEED_AUTHOR_SLIDES[key]);
    var users = (window.DemoData && window.DemoData.USERS) || {};
    var profile = null;
    Object.keys(users).some(function (k) {
      if (_normName(k) !== key) return false;
      profile = users[k];
      return true;
    });
    if (profile && profile.statuses && profile.statuses.length) {
      return _mapSlides(key, 'usr:' + key, profile.statuses);
    }
    return null;
  }

  /* A writer's REAL lineup, or none. Never invent slides: a made-up lineup
     gives the avatar a ring that the viewer's lineup (or another surface's
     seed) doesn't match, and "viewed" can never reconcile. Surfaces render
     no border at all when this returns empty. */
  function writerStatuses(handle) {
    var key = String(handle || '').replace(/^@/, '').toLowerCase();
    // Already answered by the backend: use its slides, empty included — an
    // invented lineup would give the avatar a ring no viewer can play.
    if (_liveWriters[key]) {
      // The payload's `viewed` is whoever asked. Re-read the client's own
      // seen-state on every render, so a row redrawn after the reader opens
      // a story shows the ring the StatusStore actually has.
      _liveWriters[key].forEach(function (s, i) { s.viewed = _viewed(key, s, i); });
      return _liveWriters[key];
    }
    var canonical = _demoStatuses(key);
    return canonical || [];
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

  /* Tag a fetched stories row with store-derived rings (feed/home).
     Known authors get the canonical lineup so every surface shares ids. */
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
      // Never replace real API slides with demo lineups.
      var liveIds = (s.statuses || []).some(function (st) {
        return st && _isLiveStatusId(st.id);
      });
      var canon = liveIds ? null : _demoStatuses(key);
      if (canon && canon.length) s.statuses = canon;
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
    post: post, slides: slides, myEntry: myEntry, mergeStories: mergeStories, markViewed: markViewed,
    writerStatuses: writerStatuses, decorateWriters: decorateWriters, openWriterStatus: openWriterStatus,
    loadWriters: loadWriters,
    profileStatuses: profileStatuses, profileEntry: profileEntry, ringOf: ringOf,
    registerStories: registerStories,
    // Views: shared adapter for the viewer + any page (live vs demo is USE_API)
    recordView: recordView, viewers: viewers, viewerId: viewerId, anonId: anonId, viewsOf: _viewsOf,
  };
})();
