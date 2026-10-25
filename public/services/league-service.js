/* ═══════════════════════════════════════════════════════════════
   READER LEAGUE SERVICE — window.ReaderLeague
   Weekly reader competition. Slot 3 on reader profiles (`#Rank`) links
   to leaderboard.html. Demo: seeded roster + localStorage weekly activity
   (so your own actions move your rank live). Live: swap the demo fns for:

     GET  /api/league/board?season=YYYY-Www&scope=weekly|alltime
       → { season, endsAt, entries: [{ handle,name,avatar,points,parts }] }
     POST /api/league/track  { action, n }   (chapter|hour|reaction|comment|debate|win|streak)
     GET  /api/league/me      → { rank, points, gapToNext, badges[] }

   SCORING (activity blend — social readers can beat pure bingers):
     chapter finished 10 · hour read 5 · reaction given 2 · comment/reply 8
     debate vote 4 · debate win 25 · streak day 6
   SEASON: ISO week, Monday–Sunday (same reset rhythm as debate leaderboard).
   PRIZES (weekly): #1 300 coins + Champion frame · #2 150 · #3 75 + badge.
   Monthly crown: most weekly #1s in the calendar month.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var USE_API = false;
  var API_BASE = '/api';
  var ACT_KEY = 'dro_league_activity';
  var META_KEY = 'dro_league_meta';

  var WEIGHTS = { chapter: 10, hour: 5, reaction: 2, comment: 8, reply: 8, debate: 4, win: 25, streak: 6 };
  var ACTION_LABELS = {};
  var ACTION_ICONS = {};
  var ENABLED = true;
  /* Zero-cash prizes (coins cost real money): status + power perks.
     Full CRUD: Marketing → Ad Manager → Reader League. */
  var PRIZES = [
    { place: 1, badge: 'League Champion', icon: 'fa-crown', color: '#f59e0b', perks: ['Champion frame', 'Ad-free week', 'Shoutout spotlight'], adFreeDays: 7 },
    { place: 2, badge: 'League 2nd', icon: 'fa-medal', color: '#a0a0b0', perks: ['Ad-free week'], adFreeDays: 7 },
    { place: 3, badge: 'League 3rd', icon: 'fa-medal', color: '#a07040', perks: [], adFreeDays: 0 },
  ];
  /* Admin overrides (same 'dro_league_override' key MarketingData writes).
     Weights merge by key — custom actions added in admin work with zero
     code changes: track('newAction') scores as soon as a weight exists. */
  (function applyOverrides() {
    try {
      var ov = JSON.parse(localStorage.getItem('dro_league_override') || '{}') || {};
      if (typeof ov.enabled === 'boolean') ENABLED = ov.enabled;
      if (ov.weights) Object.keys(ov.weights).forEach(function (k) { WEIGHTS[k] = +ov.weights[k] || 0; });
      if (ov.actionLabels) ACTION_LABELS = ov.actionLabels;
      if (ov.actionIcons) ACTION_ICONS = ov.actionIcons;
      if (Array.isArray(ov.prizes) && ov.prizes.length) PRIZES = ov.prizes;
    } catch (e) {}
  })();

  /* Demo weekly roster (base activity resets conceptually each season;
     jitter by week so the board feels alive without ever emptying). */
  var ROSTER = [
    { handle: 'Blessing_O', name: 'Blessing_O', avatar: 'https://i.pravatar.cc/100?img=23', act: { chapter: 22, hour: 12, reaction: 40, comment: 14, debate: 6, win: 1, streak: 7 }, alltime: 12480 },
    { handle: 'Nneka_Reads', name: 'Nneka_Reads', avatar: 'https://i.pravatar.cc/100?img=25', act: { chapter: 18, hour: 9, reaction: 30, comment: 10, debate: 8, win: 1, streak: 7 }, alltime: 10210 },
    { handle: 'ChapterChaser', name: 'ChapterChaser', avatar: 'https://i.pravatar.cc/100?img=12', act: { chapter: 25, hour: 8, reaction: 12, comment: 4, debate: 2, win: 0, streak: 5 }, alltime: 8930 },
    { handle: 'Amara_Reads', name: 'Amara_Reads', avatar: 'https://i.pravatar.cc/100?img=45', act: { chapter: 14, hour: 7, reaction: 22, comment: 8, debate: 4, win: 0, streak: 6 }, alltime: 7640 },
    { handle: 'PraiseUnending', name: 'PraiseUnending', avatar: 'https://i.pravatar.cc/100?img=14', act: { chapter: 9, hour: 5, reaction: 14, comment: 5, debate: 2, win: 0, streak: 3 }, alltime: 5210 },
    { handle: 'Fatima_Z', name: 'Fatima_Z', avatar: 'https://i.pravatar.cc/100?img=26', act: { chapter: 8, hour: 4, reaction: 12, comment: 6, debate: 3, win: 0, streak: 4 }, alltime: 4870 },
    { handle: 'Kelvin_B', name: 'Kelvin_B', avatar: 'https://i.pravatar.cc/100?img=60', act: { chapter: 6, hour: 3, reaction: 10, comment: 3, debate: 1, win: 0, streak: 2 }, alltime: 3120 },
    { handle: 'Tunde_Reader', name: 'Tunde_Reader', avatar: 'https://i.pravatar.cc/100?img=52', act: { chapter: 4, hour: 2, reaction: 6, comment: 4, debate: 1, win: 0, streak: 1 }, alltime: 1980 },
  ];
  var ME_BASE = { act: { chapter: 6, hour: 4, reaction: 10, comment: 3, debate: 2, win: 0, streak: 4 }, alltime: 3420 };

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
  function seasonEnd() {
    var now = new Date(), day = (now.getDay() + 6) % 7;
    var end = new Date(now);
    end.setDate(now.getDate() + (6 - day));
    end.setHours(23, 59, 59, 999);
    return end;
  }
  function endsIn() {
    var ms = Math.max(0, seasonEnd() - Date.now());
    var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    if (d > 0) return d + 'd ' + h + 'h left';
    if (h > 0) return h + 'h ' + m + 'm left';
    return m + 'm left';
  }

  function me() {
    var s = {};
    try {
      if (window.AuthSession && typeof window.AuthSession.getSync === 'function') s = window.AuthSession.getSync() || {};
      else if (window.DroboardUser) s = window.DroboardUser;
    } catch (e) {}
    return {
      handle: s.handle || s.username || 'You_Reader',
      name: s.name || 'You',
      avatar: s.avatar || null,
    };
  }

  function scoreOf(act) {
    var t = 0;
    Object.keys(WEIGHTS).forEach(function (k) { t += (+act[k] || 0) * WEIGHTS[k]; });
    return t;
  }
  /* Small deterministic weekly jitter so rivals breathe (±4%). */
  function jitter(handle, season) {
    var h = 0, s = String(handle) + '|' + season;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return 0.96 + (h % 9) / 100;
  }

  function myWeeklyActivity(season) {
    var all = load(ACT_KEY, {});
    return all[season] || { chapter: 0, hour: 0, reaction: 0, comment: 0, reply: 0, debate: 0, win: 0, streak: 0 };
  }

  function board(scope) {
    var season = seasonId();
    var rows = ROSTER.map(function (r) {
      var pts = Math.round(scoreOf(r.act) * jitter(r.handle, season));
      return { handle: r.handle, name: r.name, avatar: r.avatar, points: pts, isMe: false, base: r.act };
    });
    var m = me();
    var mine = {};
    Object.keys(WEIGHTS).forEach(function (k) {
      mine[k] = (ME_BASE.act[k] || 0) + (myWeeklyActivity(season)[k] || 0);
    });
    var myPts = scoreOf(mine);
    rows.push({ handle: m.handle, name: m.name, avatar: m.avatar, points: myPts, isMe: true, base: mine });
    if (scope === 'alltime') {
      rows.forEach(function (r) {
        if (r.isMe) r.points = (ME_BASE.alltime || 0) + alltimeMine();
        else {
          var seed = ROSTER.filter(function (x) { return x.handle === r.handle; })[0];
          r.points = (seed && seed.alltime) || r.points * 20;
        }
      });
    }
    rows.sort(function (a, b) { return b.points - a.points; });
    rows.forEach(function (r, i) {
      r.rank = i + 1;
      r.gap = i === 0 ? 0 : rows[i - 1].points - r.points;
    });
    settleLastSeason(season, rows);
    return { season: season, endsIn: endsIn(), entries: rows, enabled: !!ENABLED };
  }

  function alltimeMine() {
    var meta = load(META_KEY, {});
    return +meta.alltimeMine || 0;
  }

  /* Record my action for this week (and lifetime). Called centrally from
     comment-section (comment/reply/reaction) — readers/services can call
     track('chapter'), track('debate'), track('win'), track('hour', n). */
  function track(action, n) {
    if (!WEIGHTS[action]) return 0;
    n = n == null ? 1 : +n || 0;
    if (n <= 0) return 0;
    var season = seasonId();
    var all = load(ACT_KEY, {});
    var w = all[season] || {};
    w[action] = (+w[action] || 0) + n;
    all[season] = w;
    save(ACT_KEY, all);
    var meta = load(META_KEY, {});
    meta.alltimeMine = (+meta.alltimeMine || 0) + n * WEIGHTS[action];
    meta.lastSeasonSeen = season;
    save(META_KEY, meta);
    if (USE_API) {
      try {
        fetch(API_BASE + '/league/track', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, n: n }),
        }).catch(function () {});
      } catch (e) {}
    }
    return n * WEIGHTS[action];
  }

  /* Week rollover: if I finished top-3 last week, grant prizes once. */
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
          var pz = PRIZES[meRow.rank - 1];
          /* Ad-free perk (zero cash): honored by AdService.getAds. */
          var _days = (pz && +pz.adFreeDays) || 0;
          if (_days > 0) meta.adFreeUntil = Date.now() + _days * 864e5;
          var badges = meta.badges || [];
          badges.unshift({ label: pz.badge + ' · ' + prev.season, icon: pz.icon, color: pz.color, season: prev.season, place: meRow.rank });
          meta.badges = badges.slice(0, 12);
          var wins = meta.wins || {};
          if (meRow.rank === 1) {
            var mk = prev.season.slice(0, 7);
            wins[mk] = wins[mk] || {};
            var mh = me().handle;
            wins[mk][mh] = (wins[mk][mh] || 0) + 1;
            meta.wins = wins;
          }
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

  function myRank() {
    if (!ENABLED) return null;
    var b = board('weekly');
    var mine = null;
    b.entries.forEach(function (e) { if (e.isMe) mine = e; });
    var below = b.entries[mine.rank] || null; // next rank down (rank is 1-based)
    return {
      rank: mine.rank, points: mine.points, season: b.season, endsIn: b.endsIn,
      gapToNext: mine.rank > 1 ? mine.gap : 0,
      leadOverNext: below ? mine.points - below.points : 0,
      total: b.entries.length,
    };
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
  function monthlyLeader() {
    var meta = load(META_KEY, {});
    var mk = seasonId().slice(0, 7);
    var wins = (meta.wins && meta.wins[mk]) || {};
    var best = null, bestN = 0;
    Object.keys(wins).forEach(function (h) { if (wins[h] > bestN) { bestN = wins[h]; best = h; } });
    return best ? { handle: best, wins: bestN, month: mk } : null;
  }

  /* Champion preview (demo/admin): puts the winner badge + gold frame on
     YOUR profile without touching real ranks. Clear anytime. */
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
    pendingToast: pendingToast, monthlyLeader: monthlyLeader,
    adFreeActive: adFreeActive, reigning: reigning,
    previewAsChampion: previewAsChampion, clearPreview: clearPreview,
    isEnabled: function () { return !!ENABLED; },
    actionLabel: function (id) { return ACTION_LABELS[id] || null; },
    actionIcon: function (id) { return ACTION_ICONS[id] || null; },
    seasonId: seasonId, endsIn: endsIn, WEIGHTS: WEIGHTS, PRIZES: PRIZES,
  };
})();
