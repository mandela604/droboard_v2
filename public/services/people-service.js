/* ═══════════════════════════════════════════════════════════════
   PEOPLE SERVICE — window.DroboardPeople (live)
   Canonical writer/people directory for Top Writers rows (Discover
   "More Stories" and the browse overlay), and People to Follow.

   The ranking is the backend's: GET /api/feed/discover → topWriters[]
   carries { id, handle, name, avatar, books, reads } ordered by total
   reads across the writer's live books, followers as tiebreaker.
   Whoever has the payload (discover-service.js) hands it to
   setLiveWriters(), so every surface — Discover AND the browse overlay —
   reads the same ranked directory from one cache instead of each keeping
   its own list. A page that never loaded Discover asks the endpoint once
   (fetchLiveWriters); until the answer lands the row is empty, never seeded.

   Statuses are layered on separately by status-service.js
   (DroboardStatus.decorateWriters), so a writer identity exists even
   when they have no status.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  var CATEGORY_ORDER = ['all', 'romance', 'werewolf', 'mafia', 'fantasy', 'billionaire', 'campus', 'completed',
    'trending today', 'top romance', 'new releases', "editor's picks", 'recommended for you',
    'recently updated', 'all stories', 'continue reading'];

  /* Backend-ranked writers, in the order the server sent them. */
  var _live = [];

  function _clean(rows) {
    var out = [], seen = {};
    (rows || []).forEach(function (w) {
      if (!w) return;
      var handle = String(w.handle || w.id || '').replace(/^@/, '').trim();
      if (!handle || seen[handle.toLowerCase()]) return;
      seen[handle.toLowerCase()] = true;
      out.push({
        id: w.id ? String(w.id) : '',
        handle: handle,
        name: w.name || handle.replace(/_/g, ' '),
        avatar: w.avatar || '',
        followers: w.followers || 0,
        books: w.books || 0,
        reads: w.reads || 0,
      });
    });
    return out;
  }

  /* Hand the ranked directory to the app. Called by whoever has the
     /discover payload; the browse overlay then reads it from here. */
  function setLiveWriters(rows) {
    var list = _clean(rows);
    if (list.length) _live = list;
    return list.length;
  }

  function liveWriters() { return _live.slice(); }

  /* A page that never loaded Discover has no directory yet (the browse
     overlay included). topWriters[] only rides on /api/feed/discover, so ask
     that endpoint once and fill the cache; the row on the next render is the
     real ranking. Resolves with the directory (empty on failure, so a later
     render can retry). */
  var _reqPromise = null;
  function fetchLiveWriters() {
    if (_live.length) return Promise.resolve(_live.slice());
    if (_reqPromise) return _reqPromise;
    _reqPromise = fetch(API_BASE + '/feed/discover', { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('Directory API failed: ' + r.status);
        return r.json();
      })
      .then(function (d) {
        setLiveWriters((d && d.topWriters) || []);
        return _live.slice();
      })
      .catch(function () { return []; })
      .then(function (list) { _reqPromise = null; return list; });
    return _reqPromise;
  }

  function _hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  /* Ten writers for the tapped category/genre, deterministically rotated
     per key so each view-all or genre pill shows a different lineup. The
     rotation only reorders real ranked writers — it never re-ranks them
     (reads is the server's answer) and never synthesises a writer. */
  function writersFor(key, limit) {
    key = String(key || 'all').toLowerCase();
    if (!_live.length) { fetchLiveWriters(); return []; }
    var pool = _live;
    limit = Math.max(1, Math.min(limit || 10, pool.length));
    var idx = CATEGORY_ORDER.indexOf(key);
    var start = idx >= 0 ? (idx * 3) % pool.length : _hash(key) % pool.length;
    var out = [];
    for (var i = 0; i < limit; i++) out.push(pool[(start + i) % pool.length]);
    return out;
  }

  /* Resolve a writer's real avatar from a handle or display name.
     Used by bylines (Discover hero, spotlight ads) so they never render
     a bare initial when the person is in the directory. */
  function avatarFor(nameOrHandle) {
    var key = String(nameOrHandle || '').replace(/^@/, '').replace(/^by\s+/i, '').trim().toLowerCase();
    if (!key) return '';
    for (var i = 0; i < _live.length; i++) {
      var w = _live[i];
      if (String(w.handle).toLowerCase() === key || String(w.name).toLowerCase() === key) return w.avatar || '';
    }
    return '';
  }

  window.DroboardPeople = {
    writersFor: writersFor,
    avatarFor: avatarFor,
    setLiveWriters: setLiveWriters,
    liveWriters: liveWriters,
    fetchLiveWriters: fetchLiveWriters,
  };
})();