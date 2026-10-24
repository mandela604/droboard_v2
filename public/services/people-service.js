/* ═══════════════════════════════════════════════════════════════
   PEOPLE SERVICE — window.DroboardPeople
   Canonical writer/people directory for Top Writers rows (Discover
   "More Stories" and the browse overlay), and the future source for
   People to Follow.

   Live swap: replace writersFor() with
     GET /api/writers?category=<key>&limit=10
     → [{ name, handle, avatar }]
   Statuses are layered on separately by status-service.js
   (DroboardStatus.decorateWriters), so a writer identity exists even
   when they have no status.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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

  function _hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  /* Ten writers for the tapped category/genre, deterministically rotated
     per key so each view-all or genre pill shows a different lineup. */
  function writersFor(key, limit) {
    key = String(key || 'all').toLowerCase();
    limit = Math.max(1, Math.min(limit || 10, WRITER_POOL.length));
    var idx = CATEGORY_ORDER.indexOf(key);
    var start = idx >= 0 ? (idx * 3) % WRITER_POOL.length : _hash(key) % WRITER_POOL.length;
    var out = [];
    for (var i = 0; i < limit; i++) out.push(WRITER_POOL[(start + i) % WRITER_POOL.length]);
    return out;
  }

  /* Resolve a writer's real avatar from a handle or display name.
     Used by bylines (Discover hero, spotlight ads) so they never render
     a bare initial when the person is in the directory. */
  function avatarFor(nameOrHandle) {
    var key = String(nameOrHandle || '').replace(/^@/, '').replace(/^by\s+/i, '').trim().toLowerCase();
    if (!key) return '';
    var users = (window.DemoData && window.DemoData.USERS) || {};
    var handles = Object.keys(users);
    for (var i = 0; i < handles.length; i++) {
      var u = users[handles[i]] || {};
      if (String(u.handle || handles[i]).toLowerCase() === key || String(u.name || '').toLowerCase() === key) {
        return u.avatar || '';
      }
    }
    for (var j = 0; j < WRITER_POOL.length; j++) {
      var w = WRITER_POOL[j];
      if (String(w.handle).toLowerCase() === key || String(w.name).toLowerCase() === key) return w.avatar || '';
    }
    return '';
  }

  window.DroboardPeople = { writersFor: writersFor, avatarFor: avatarFor };
})();
