/* ═══════════════════════════════════════════════════════════════
   READER LEAGUE SERVICE — window.ReaderLeague
   Weekly reader competition. Slot 3 on reader profiles (`#Rank`) links
   to leaderboard.html. All ranks, points and config come from the API:

     GET  /api/league/board?scope=weekly|alltime
       → { season, endsIn (hours), entries: [{ userId, handle, name,
             avatar, points, parts }], me: { rank, points } | null,
           enabled, weights, actionLabels, actionIcons, prizes }
     POST /api/league/track  { action, n }
     GET  /api/league/me     → { rank, points, gapToNext, badges[] }

   SCORING (server-owned): chapter finished 10 · hour read 5 · reaction 2
   · comment/reply 8 · debate vote 4 · debate win 25 · streak day 6.
   SEASON: ISO week, Monday–Sunday. PRIZES: Marketing → Ad Manager →
   Reader League (served in the board payload; never hardcoded here).
   board() throws on failure — the calling page renders the error, it
   never falls back to a fake roster.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API_BASE = '/api';
  var META_KEY = 'dro_league_meta';

  /* Defaults shown before the first board read; the board payload replaces
     them with what Marketing actually saved. */
  var WEIGHTS = { chapter: 10, hour: 5, reaction: 2, comment: 8, reply: 8, debate: 4, win: 25, streak: 6 };
  var PRIZES = [
    { place: 1, badge: 'League Champion', icon: 'fa-crown', color: '#f59e0b', perks: ['Champion frame', 'Ad-free week', 'Shoutout spotlight'], adFreeDays: 7 },
    { place: 2, badge: 'League 2nd', icon: 'fa-medal', color: '#a0a0b0', perks: ['Ad-free week'], adFreeDays: 7 },
    { place: 3, badge: 'League 3rd', icon: 'fa-medal', color: '#a07040', perks: [], adFreeDays: 0 },
  ];
  /* Last board payload's config (weights/labels/icons/prizes) — the only
     source after the first successful read. */
  var _cfg = { weights: null, actionLabels: {}, actionIcons: {}, enabled: true };

  function load(key, fb) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  /* ISO week season id: 'YYYY-Www', Monday start. */
  function seasonId(d) {
    d = d ? new Date(d) : new Date();
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - day + 3);
    var first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    var fday = (first.getUTCDay() + 6) % 7;
    first.setUTCDate(first.getUTCDate() - fday + 3);
    var week = 1 + Math.round((t - first) / (7 * 864e5));
    return t.getUTCFullYear() + '-W' + (week < 10 ? '0' + week : week);
  }

  /* The board answers endsIn in whole hours left of the season. */
  function formatEnds(hours) {
    var h = Math.max(0, Number(hours) || 0);
    var d = Math.floor(h / 24);
    var r = h % 24;
    if (d > 0) return d + 'd ' + r + 'h left';
    if (h > 0) return h + 'h left';
    return 'ending soon';
  }

  function me() {
    var s = {};
    try {
      if (window.AuthSession && typeof window.AuthSession.getStoredUser === 'function') s = window.AuthSession.getStoredUser() || {};
      if (!s.handle && window.AuthSession && typeof window.AuthSession.getSync === 'function') s = window.AuthSession.getSync() || {};
    } catch (e) {}
    return {
      id: s.id || s.userId || null,
      handle: s.handle || s.username || '',
      name: s.name || 'You',
      avatar: s.avatar || null,
    };
  }

  /* Live read. Throws on any failure so the page can show a real error. */
  async function board(scope) {
    var url = API_BASE + '/league/board?scope=' + (scope === 'alltime' ? 'alltime' : 'weekly');
    var res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('League API failed: ' + res.status);
    var data = await res.json();
    if (!data || !Array.isArray(data.entries)) throw new Error('League board is malformed');
    // Rank = board position; gap = points to the entry above. The server
    // sorts by points — the client only numbers what the server ordered.
    var m = me();
    data.entries.forEach(function (e, i) {
      e.rank = i + 1;
      e.gap = i > 0 ? Math.max(0, (data.entries[i - 1].points || 0) - (e.points || 0)) : 0;
      e.isMe = (m.id && String(e.userId) === String(m.id)) || (!!m.handle && e.handle === m.handle);
    });
    if (data.me == null) {
      var mine = data.entries.find(function (e) { return e.isMe; });
      data.me = mine ? { rank: mine.rank, points: mine.points } : null;
    }
    data.endsInLabel = formatEnds(data.endsIn);
    _cfg = {
      weights: data.weights || _cfg.weights,
      actionLabels: data.actionLabels || _cfg.actionLabels,
      actionIcons: data.actionIcons || _cfg.actionIcons,
      enabled: data.enabled !== undefined ? !!data.enabled : true,
    };
    if (Array.isArray(data.prizes) && data.prizes.length) PRIZES = data.prizes;
    if (_cfg.weights) WEIGHTS = _cfg.weights;
    if (scope !== 'alltime') settleLastSeason(seasonId(), data.entries);
    return data;
  }

  /* Record my action for this week. Called centrally from comment-section
     (comment/reply/reaction) — readers/services can call track('chapter'),
     track('debate'), track('win'), track('hour', n). Custom actions from
     Marketing must track too, so no client-side whitelist gates this. */
  async function track(action, n) {
    n = n == null ? 1 : +n || 0;
    if (!action || n <= 0) return 0;
    try {
      await fetch(API_BASE + '/league/track', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, n: n }),
      });
    } catch (e) { /* fire-and-forget: a missed tick is not an error dialog */ }
    return n * ((WEIGHTS && WEIGHTS[action]) || 0);
  }

  /* Week rollover bookkeeping: if the last board I saw was a previous
     season, remember who reigned and whether I finished top-3 (toast +
     ad-free week perk). The authoritative badges come from
     GET /api/league/me; this only drives the transition UX. */
  function settleLastSeason(curSeason, curRows) {
    try {
      var meta = load(META_KEY, {});
      if (meta.settledSeason === curSeason) return;
      var prev = meta.lastBoard;
      meta.lastSeasonSeen = curSeason;
      /* Reigning champion (whoever finished #1) — crowned everywhere. */
      if (prev && prev.season && prev.season !== curSeason && prev.entries && prev.entries.length) {
        var champ = prev.entries[0];
        meta.reigning = { handle: champ.handle, season: prev.season };
      }
      if (prev && prev.season && prev.season !== curSeason) {
        var meRow = null;
        prev.entries.forEach(function (e) { if (e.isMe) meRow = e; });
        if (meRow && meRow.rank >= 1 && meRow.rank <= 3) {
          var pz = (PRIZES[meRow.rank - 1]) || { badge: 'League finish', icon: 'fa-medal', color: '#a0a0b0', adFreeDays: 0 };
          /* Ad-free perk (zero cash): honored by AdService.getAds. */
          var _days = (pz && +pz.adFreeDays) || 0;
          if (_days > 0) meta.adFreeUntil = Date.now() + _days * 864e5;
          var badges = meta.badges || [];
          badges.unshift({ label: pz.badge + ' · ' + prev.season, icon: pz.icon, color: pz.color, season: prev.season, place: meRow.rank });
          meta.badges = badges.slice(0, 12);
          meta.pendingToast = meRow.rank === 1
            ? '🏆 League Champion! Frame + ad-free week unlocked'
            : '🏅 League #' + meRow.rank + '! Badge + ad-free week unlocked';
        }
        if (meRow && window.droNotify) window.droNotify({
          type: 'league_finish', key: 'league:' + prev.season, rank: meRow.rank,
          rankNote: 'of ' + prev.entries.length + ' readers', medal: 'rank',
          title: 'You finished the week at #' + meRow.rank,
          desc: 'Season ' + prev.season + ' is settled — your reading earned you this place.',
          link: { label: 'Open leaderboard' },
        });
      }
      meta.lastBoard = { season: curSeason, entries: curRows.map(function (e) { return { handle: e.handle, rank: e.rank, isMe: !!e.isMe }; }) };
      meta.settledSeason = curSeason;
      save(META_KEY, meta);
    } catch (e) {}
  }

  /* Profile-slot read. Never rejects (callers treat "no rank yet" and
     "league unreachable" the same way); the leaderboard page uses board()
     directly, where failures become a visible error state. */
  async function myRank() {
    try {
      var b = await board('weekly');
      var mine = null;
      b.entries.forEach(function (e) { if (e.isMe) mine = e; });
      if (!mine) return null;
      var idx = b.entries.indexOf(mine);
      var below = b.entries[idx + 1] || null;
      return {
        rank: mine.rank, points: mine.points, season: b.season, endsIn: b.endsInLabel,
        gapToNext: mine.rank > 1 ? mine.gap : 0,
        leadOverNext: below ? mine.points - below.points : 0,
        total: b.entries.length,
      };
    } catch (e) { return null; }
  }

  function myBadges() {
    var meta = load(META_KEY, {});
    return meta.badges || [];
  }
  /* Ad-free-week perk check (zero-cash prize, honored by AdService). */
  function adFreeActive() {
    try {
      var meta = load(META_KEY, {});
      return Date.now() < (+meta.adFreeUntil || 0);
    } catch (e) { return false; }
  }
  /* Reigning champion (last week's #1) — crowned on board + profile. */
  function reigning() {
    try {
      var meta = load(META_KEY, {});
      return meta.reigning || null;
    } catch (e) { return null; }
  }
  function pendingToast() {
    var meta = load(META_KEY, {});
    if (!meta.pendingToast) return null;
    var t = meta.pendingToast;
    meta.pendingToast = null;
    save(META_KEY, meta);
    return t;
  }

  /* Champion preview (admin/marketing console): puts the winner badge +
     gold frame on YOUR profile without touching real ranks. Clear anytime. */
  function previewAsChampion() {
    try {
      var meta = load(META_KEY, {});
      var badges = meta.badges || [];
      badges = badges.filter(function (b) { return !b.preview; });
      badges.unshift({ label: 'League Champion · preview', icon: 'fa-crown', color: '#f59e0b', season: seasonId(), place: 1, preview: true });
      meta.badges = badges.slice(0, 12);
      meta.reigning = { handle: me().handle, season: seasonId(), preview: true };
      save(META_KEY, meta);
      return true;
    } catch (e) { return false; }
  }
  function clearPreview() {
    try {
      var meta = load(META_KEY, {});
      meta.badges = (meta.badges || []).filter(function (b) { return !b.preview; });
      if (meta.reigning && meta.reigning.preview) delete meta.reigning;
      save(META_KEY, meta);
      return true;
    } catch (e) { return false; }
  }

  window.ReaderLeague = {
    board: board, myRank: myRank, track: track, myBadges: myBadges,
    pendingToast: pendingToast,
    adFreeActive: adFreeActive, reigning: reigning,
    previewAsChampion: previewAsChampion, clearPreview: clearPreview,
    actionLabel: function (id) { return (_cfg.actionLabels || {})[id] || null; },
    actionIcon: function (id) { return (_cfg.actionIcons || {})[id] || null; },
    isEnabled: function () { return _cfg.enabled !== false; },
    seasonId: seasonId, endsInLabel: formatEnds, WEIGHTS: WEIGHTS, PRIZES: PRIZES,
  };
})();
