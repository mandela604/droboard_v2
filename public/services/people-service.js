/* ═══════════════════════════════════════════════════════════════
   PEOPLE SERVICE — window.DroboardPeople
   Canonical writer/people directory for Top Writers rows (Discover
   "More Stories" and the browse overlay), and the future source for
   People to Follow.

   The ranking is the backend's: GET /api/feed/discover → topWriters[]
   carries { id, handle, name, avatar, books, reads } ordered by total
   reads across the writer's live books, followers as tiebreaker.
   Whoever has the payload (discover-service.js) hands it to
   setLiveWriters(), so every surface — Discover AND the browse overlay —
   reads the same ranked directory from one cache instead of each keeping
   its own list.

   Statuses are layered on separately by status-service.js
   (DroboardStatus.decorateWriters), so a writer identity exists even
   when they have no status.

   WRITER_POOL below is demo seed only: it renders when no live directory
   has arrived yet (USE_API off, or the request failed). Nothing invented
   here ever wears a real author's handle.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // This module's own live gate — same pattern as discover-service.js.
  const USE_API = false;
  const API_BASE = '/api';

  var WRITER_POOL = [
    { name: 'Ifeanyi Story', handle: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53' },
    { name: 'Ada Writes', handle: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32' },
    { name: 'Luna Grey', handle: 'Luna_Grey', avatar: 'https://i.pravatar.cc/100?img=25' },
    { name: 'Zara M', handle: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=16' },
    { name: 'Chiamaka N', handle: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47' },
    { name: 'Kemi A', handle: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28' },
    { name: 'Efe O', handle: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=12' },
    { name: 'Tobi Adeyemi', handle: 'Tobi_Adeyemi', avatar: 'https://i.pravatar.cc/100?img=11' },
    { name: 'Amara Obi', handle: 'Amara_Obi', avatar: 'https://i.pravatar.cc/100?img=44' },
    { name: 'Bisi Lawal', handle: 'Bisi_Lawal', avatar: 'https://i.pravatar.cc/100?img=45' },
    { name: 'Damola K', handle: 'Damola_K', avatar: 'https://i.pravatar.cc/100?img=15' },
    { name: 'Nneka Eze', handle: 'Nneka_Eze', avatar: 'https://i.pravatar.cc/100?img=9' },
    { name: 'Sade Bello', handle: 'Sade_Bello', avatar: 'https://i.pravatar.cc/100?img=27' },
    { name: 'Uche Nnamdi', handle: 'Uche_Nnamdi', avatar: 'https://i.pravatar.cc/100?img=60' },
    { name: 'Yemi Ojo', handle: 'Yemi_Ojo', avatar: 'https://i.pravatar.cc/100?img=33' },
    { name: 'Farida Musa', handle: 'Farida_Musa', avatar: 'https://i.pravatar.cc/100?img=24' },
    { name: 'Tega Okoro', handle: 'Tega_Okoro', avatar: 'https://i.pravatar.cc/100?img=68' },
    { name: 'Ify Nwosu', handle: 'Ify_Nwosu', avatar: 'https://i.pravatar.cc/100?img=49' },
    { name: 'Nkem Duru', handle: 'Nkem_Duru', avatar: 'https://i.pravatar.cc/100?img=31' },
    { name: 'Bode Ilo', handle: 'Bode_Ilo', avatar: 'https://i.pravatar.cc/100?img=14' },
  ];

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
     real ranking. Fire-and-forget — a writers row must never block on it. */
  var _requested = false;
  function fetchLiveWriters() {
    if (!USE_API || _requested || _live.length) return;
    _requested = true;
    fetch(API_BASE + '/feed/discover', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.topWriters) setLiveWriters(d.topWriters); })
      .catch(function () { _requested = false; });
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
    if (!_live.length) fetchLiveWriters();
    var pool = _live.length ? _live : WRITER_POOL;
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
    var users = (window.DemoData && window.DemoData.USERS) || {};
    var handles = Object.keys(users);
    for (var j = 0; j < handles.length; j++) {
      var u = users[handles[j]] || {};
      if (String(u.handle || handles[j]).toLowerCase() === key || String(u.name || '').toLowerCase() === key) {
        return u.avatar || '';
      }
    }
    for (var k = 0; k < WRITER_POOL.length; k++) {
      var d = WRITER_POOL[k];
      if (String(d.handle).toLowerCase() === key || String(d.name).toLowerCase() === key) return d.avatar || '';
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
