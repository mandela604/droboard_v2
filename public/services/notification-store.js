/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION STORE — window.DroboardNotifStore
   ───────────────────────────────────────────────────────────────
   The single source of truth for every notification surface: the
   notifications page (reader + author views), the bell badge, and local
   push dispatch. Nothing else generates or persists notifications.

   Contract for the rest of the app:
     DroboardNotifStore.emit({ type:'trending_enter', ...payload })
       → deduped by payload.key, cooldown-checked, channel-gated,
         persisted, badge bumped, push dispatched if allowed.
     DroboardNotifStore.list({ role, cat }) / unread() / markRead(id) …

   Live backend: set USE_API = true →
     GET  /api/notifications?role=&cursor=
     POST /api/notifications       (emit)
     PATCH /api/notifications/:id  (read / delete)
     PUT   /api/notifications/settings
     A server cron owns the same `key` + cooldown rules so emit() is
     idempotent — safe to call from both client and worker.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardNotifStore) return;

  const USE_API = false;
  const API_BASE = '/api';
  const LOG_KEY = 'dro_notif_log';
  const SETTINGS_KEY = 'dro_notif_settings';
  const MAX_ITEMS = 150;

  /* ── categories ───────────────────────────────────────────── */
  const CATS = {
    highlights: { label: 'Highlights', icon: 'fa-trophy', bg: '#fff4e0', color: '#b7690a' },
    achievements: { label: 'Achievements', icon: 'fa-award', bg: '#fdeee0', color: '#9a6508' },
    stats: { label: 'Your stats', icon: 'fa-chart-line', bg: '#e7f0fe', color: '#1d5fd6' },
    activity: { label: 'Activity', icon: 'fa-heart', bg: '#ffe9ef', color: '#ff2d55' },
    stories: { label: 'Stories', icon: 'fa-book-open', bg: '#efe9ff', color: '#7c5cff' },
    revenue: { label: 'Revenue', icon: 'fa-dollar-sign', bg: '#e9fbf0', color: '#158a48' },
    system: { label: 'System', icon: 'fa-shield-halved', bg: '#f1f1f4', color: '#5c5c66' },
  };

  /* ── type catalog: who it is for, how loud it is ──────────────
     audience: reader | author | both  (both = writers read too)
     push: true means push-eligible; store still honours settings,
     mute list and quiet hours. cooldownHours: dedupe window for the
     same logical event when no explicit key is supplied.           */
  const TYPES = {
    /* milestones */
    trending_enter: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true, cooldownHours: 24 },
    top_ten: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true, cooldownHours: 24 },
    editor_pick: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true, cooldownHours: 72 },
    featured: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true, cooldownHours: 72 },
    league_finish: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true, cooldownHours: 120 },
    reading_streak: { cat: 'highlights', kind: 'milestone', audience: 'both', push: false, cooldownHours: 120 },

    /* achievements */
    achievement: { cat: 'achievements', kind: 'achievement', audience: 'both', push: true, cooldownHours: 0 },

    /* stats — the 24h rule applies to a status post: when one of your
       statuses closes its first 24 hours, the poster gets its summary */
    status_24h: { cat: 'stats', kind: 'digest', audience: 'both', push: false, cooldownHours: 0 },
    weekly_stats: { cat: 'stats', kind: 'digest', audience: 'author', push: false, cooldownHours: 120 },
    weekly_earnings: { cat: 'stats', kind: 'digest', audience: 'author', push: false, cooldownHours: 120 },
    reader_weekly: { cat: 'stats', kind: 'digest', audience: 'both', push: false, cooldownHours: 120 },

    /* engagement */
    new_chapter: { cat: 'stories', kind: 'row', audience: 'reader', push: true, cooldownHours: 0 },
    chapter_live: { cat: 'stories', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    schedule_failed: { cat: 'stories', kind: 'row', audience: 'author', push: true, cooldownHours: 12 },
    like: { cat: 'activity', kind: 'row', audience: 'both', push: false, cooldownHours: 6 },
    comment: { cat: 'activity', kind: 'row', audience: 'both', push: false, cooldownHours: 1 },
    reply: { cat: 'activity', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },
    mention: { cat: 'activity', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },
    follow: { cat: 'activity', kind: 'row', audience: 'both', push: false, cooldownHours: 6 },
    share: { cat: 'activity', kind: 'row', audience: 'both', push: false, cooldownHours: 24 },
    save: { cat: 'activity', kind: 'row', audience: 'author', push: false, cooldownHours: 24 },
    repost: { cat: 'activity', kind: 'row', audience: 'both', push: false, cooldownHours: 0 },

    /* debates, polls and predictions — all "closed the loop" results */
    debate_reply: { cat: 'activity', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },
    debate_verdict: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true, cooldownHours: 24 },
    poll_closed: { cat: 'stats', kind: 'digest', audience: 'both', push: false, cooldownHours: 0 },
    prediction_settled: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true, cooldownHours: 24 },

    /* revenue */
    tip: { cat: 'revenue', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    payout: { cat: 'revenue', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    coins: { cat: 'revenue', kind: 'row', audience: 'reader', push: false, cooldownHours: 24 },

    /* workflow + system */
    review_result: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    book_change_result: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    contract_update: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    verification: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    security: { cat: 'system', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },
    announcement: { cat: 'system', kind: 'row', audience: 'both', push: false, cooldownHours: 48 },
  };

  /* ── achievements: name, tier ladder, evaluator over author stats ──
     stats = { reads, likes, saves, shares, chapters, followers, streakDays,
               editorPicks, trendingBest, coinsTipped, season }            */
  const ACHIEVEMENTS = [
    { id: 'reads_100k', name: '100K Reads Club', icon: 'fa-book-reader', desc: 'Your stories crossed 100,000 reads.', tier: 'Bronze', when: s => s.reads >= 1e5 },
    { id: 'reads_1m', name: 'Million Reads', icon: 'fa-crown', desc: 'One million reads across your catalogue.', tier: 'Gold', when: s => s.reads >= 1e6 },
    { id: 'likes_50k', name: '50K Likes', icon: 'fa-heart', desc: 'Readers liked your work 50,000 times.', tier: 'Bronze', when: s => s.likes >= 5e4 },
    { id: 'saves_10k', name: '10K Libraries', icon: 'fa-bookmark', desc: 'Ten thousand readers saved you to their library.', tier: 'Silver', when: s => s.saves >= 1e4 },
    { id: 'shares_5k', name: 'Spread the Word', icon: 'fa-share-nodes', desc: 'Your story was shared 5,000 times.', tier: 'Silver', when: s => s.shares >= 5e3 },
    { id: 'chapters_50', name: '50 Chapters Published', icon: 'fa-feather-pointed', desc: 'Fifty chapters out of the door. Keep going.', tier: 'Bronze', when: s => s.chapters >= 50 },
    { id: 'chapters_100', name: 'Century Writer', icon: 'fa-pen-nib', desc: 'One hundred published chapters.', tier: 'Gold', when: s => s.chapters >= 100 },
    { id: 'followers_1k', name: '1K Followers', icon: 'fa-users', desc: 'A thousand readers follow your pen name.', tier: 'Silver', when: s => s.followers >= 1e3 },
    { id: 'streak_30', name: '30-Day Writing Streak', icon: 'fa-fire', desc: 'Thirty days without missing a drop.', tier: 'Gold', when: s => s.streakDays >= 30 },
    { id: 'editor_pick', name: "Editor's Pick", icon: 'fa-star', desc: 'An editor put your story on the shelf.', tier: 'Purple', when: s => s.editorPicks >= 1 },
    { id: 'top_ten', name: 'Top Ten Story', icon: 'fa-trophy', desc: 'You cracked the trending top ten.', tier: 'Gold', when: s => s.trendingBest > 0 && s.trendingBest <= 10 },
    { id: 'tipped_1k', name: '1K Coins Tipped', icon: 'fa-coins', desc: 'Readers tipped you a thousand coins.', tier: 'Silver', when: s => s.coinsTipped >= 1e3 },
    /* reader-side */
    { id: 'read_100', name: '100 Chapters This Week', icon: 'fa-book-open', desc: 'You powered through a hundred chapters.', tier: 'Bronze', when: s => s.weekChapters >= 100, audience: 'reader' },
    { id: 'league_top10', name: 'League Top 10', icon: 'fa-medal', desc: 'You finished the week inside the top ten.', tier: 'Silver', when: s => s.leagueRank > 0 && s.leagueRank <= 10, audience: 'reader' },
  ];

  /* ── persistence ─────────────────────────────────────────── */
  function _load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (e) { return fallback; }
  }
  function _save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function _log() { return _load(LOG_KEY, { items: [], lastTypeAt: {} }); }
  function _writeLog(l) {
    l.items = l.items.slice(0, MAX_ITEMS);
    _save(LOG_KEY, l);
  }

  /* legacy settings were booleans per category — migrate to a channel matrix */
  const DEFAULT_SETTINGS = {
    highlights: { inapp: true, push: true, email: false },
    achievements: { inapp: true, push: true, email: false },
    stats: { inapp: true, push: false, email: true },
    activity: { inapp: true, push: false, email: false },
    stories: { inapp: true, push: true, email: false },
    community: { inapp: true, push: false, email: false },
    revenue: { inapp: true, push: true, email: false },
    system: { inapp: true, push: true, email: true },
    all: true,
    quiet: false, quietStart: '23:00', quietEnd: '07:00',
    digest: true,
    mutedTypes: [],
  };
  function _migrate(raw) {
    const out = Object.assign({}, DEFAULT_SETTINGS);
    Object.keys(raw || {}).forEach(function (k) {
      const v = raw[k];
      if (k === 'mutedTypes' || k === 'all' || k === 'quiet' || k === 'digest' || k === 'quietStart' || k === 'quietEnd') out[k] = v;
      else if (k === 'email') out.system = Object.assign({}, out.system, { email: !!v });
      else if (v && typeof v === 'boolean') out[k] = { inapp: v, push: v, email: v };
      else if (v && typeof v === 'object') out[k] = Object.assign({}, DEFAULT_SETTINGS[k] || {}, v);
    });
    out.mutedTypes = Array.isArray(out.mutedTypes) ? out.mutedTypes : [];
    return out;
  }
  function settings() { return _migrate(_load(SETTINGS_KEY, {})); }
  function saveSettings(patch) {
    const next = _migrate(Object.assign(_load(SETTINGS_KEY, {}), patch || {}));
    _save(SETTINGS_KEY, next);
    return next;
  }
  function setChannel(cat, channel, on) {
    const raw = _load(SETTINGS_KEY, {});
    const cur = _migrate(raw);
    cur[cat] = cur[cat] || { inapp: true, push: false, email: false };
    cur[cat][channel] = !!on;
    _save(SETTINGS_KEY, cur);
    return cur;
  }
  function muteType(type, on) {
    const cur = settings();
    const set = new Set(cur.mutedTypes || []);
    if (on) set.add(type); else set.delete(type);
    cur.mutedTypes = Array.from(set);
    _save(SETTINGS_KEY, cur);
    return cur.mutedTypes;
  }

  /* ── quiet hours ─────────────────────────────────────────── */
  function _toMin(t) { const p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function inQuietHours(now) {
    const s = settings();
    if (!s.quiet) return false;
    const d = new Date(now || Date.now());
    const cur = d.getHours() * 60 + d.getMinutes();
    const a = _toMin(s.quietStart), b = _toMin(s.quietEnd);
    return a <= b ? (cur >= a && cur <= b) : (cur >= a || cur <= b);
  }

  /* ── time labels + day grouping ──────────────────────────── */
  function _dayStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function timeLabel(at) {
    const diff = Date.now() - at;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24 && _dayStart(at) === _dayStart(Date.now())) return h + 'h ago';
    const d = Math.round((_dayStart(Date.now()) - _dayStart(at)) / 86400000);
    const clock = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d === 1) return 'Yesterday, ' + clock;
    if (d < 7) return d + 'd ago';
    return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  function groupByDay(items) {
    const today = _dayStart(Date.now());
    const buckets = { Today: [], Yesterday: [], 'This week': [], Earlier: [] };
    items.forEach(function (i) {
      const d = Math.round((today - _dayStart(i.at)) / 86400000);
      const label = d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier';
      buckets[label].push(i);
    });
    return Object.keys(buckets).filter(k => buckets[k].length).map(k => ({ label: k, items: buckets[k] }));
  }

  /* ── emit ─────────────────────────────────────────────────── */
  function _fmt(n) {
    if (n == null) return '—';
    if (window.DroboardFormat && DroboardFormat.compact) return DroboardFormat.compact(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function _delta(cur, prev) {
    if (!prev) return null;
    const pct = Math.round((cur - prev) / prev * 100);
    return (pct >= 0 ? '+' : '') + pct + '% vs prev';
  }

  /**
   * @param {object} ev  { type, key?, title?, desc?, at?, ...payload }
   * @returns {object|null} the stored item, or null when suppressed
   */
  function emit(ev) {
    if (!ev || !ev.type) return null;
    const meta = TYPES[ev.type];
    if (!meta) return null;
    const log = _log();
    const now = ev.at || Date.now();
    let key = ev.key || (ev.type + ':' + (_keyParts(ev).join('|') || now));

    /* Counted engagement (reposts, votes) is one row per object, not one
       row per action: while the user has not seen it, the same row is
       updated in place. Once seen, the next batch starts a fresh row. */
    if (ev.upsert) {
      const base = key;
      const open = log.items.find(i => i.unread && (i.key === base || i.key.indexOf(base + '#') === 0));
      if (open) {
        Object.assign(open, ev.update || {}, { at: now, time: timeLabel(now) });
        open.count = ev.count != null ? ev.count : (open.count || 0) + 1;
        _writeLog(log);
        _announce(open);
        return open;
      }
      const seen = log.items.filter(i => i.key === base || i.key.indexOf(base + '#') === 0).length;
      if (seen) key = base + '#' + seen;
    } else if (log.items.some(i => i.key === key)) return null;
    if (meta.cooldownHours) {
      const last = (log.lastTypeAt || {})[ev.type];
      if (last && now - last < meta.cooldownHours * 3600000) return null;
    }
    const s = settings();
    const muted = (s.mutedTypes || []).indexOf(ev.type) !== -1;
    const chan = s[meta.cat] || {};
    if (muted || !s.all || chan.inapp === false) return null;

    const item = Object.assign({
      id: ev.id || ('n' + now.toString(36) + Math.random().toString(36).slice(2, 6)),
      key: key,
      type: ev.type,
      cat: meta.cat,
      kind: ev.kind || meta.kind,
      audience: ev.audience || meta.audience,
      at: now,
      unread: true,
      pushEligible: !!meta.push,
    }, _defaultsFor(meta.cat, ev), ev, ev.update || {});
    delete item.update; delete item.upsert;
    item.key = key; /* ev.key may carry the un-batched base */
    item.time = item.time || timeLabel(item.at);

    log.items.unshift(item);
    log.lastTypeAt = log.lastTypeAt || {};
    log.lastTypeAt[ev.type] = now;
    _writeLog(log);
    _announce(item);
    if (!muted && meta.push && chan.push !== false && !inQuietHours(now)) _dispatchLocal(item);
    return item;
  }

  function _keyParts(ev) {
    return ['story', 'book', 'post', 'chapter', 'season', 'rank', 'amount']
      .filter(k => ev[k] != null).map(k => String(ev[k]).slice(0, 40));
  }
  function _defaultsFor(cat, ev) {
    const c = CATS[cat] || CATS.system;
    if (ev.title) return {};
    return { icon: { name: c.icon, bg: c.bg, color: c.color } };
  }

  let _seq = 0;
  function _bump() {
    try { window.dispatchEvent(new CustomEvent('dro:notification-count', { detail: { count: unread() } })); } catch (e) {}
  }
  function _announce(item) {
    try { window.dispatchEvent(new CustomEvent('dro:notification', { detail: item })); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('dro:notification-count', { detail: { count: unread() } })); } catch (e) {}
    _seq++;
  }

  /* ── local dispatch (browser Notification API) ─────────────
     Real device/web push belongs on the server: it needs a service
     worker + subscription endpoint + FCM/APNs. Until then this is the
     in-browser channel, and Capacitor LocalNotifications replaces it
     in the native shell with the same payload.                    */
  function _dispatchLocal(item) {
    if (USE_API) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') requestPermission();
    if (Notification.permission !== 'granted') return;
    const body = String(item.desc || item.title || '').replace(/<[^>]*>/g, '').slice(0, 180);
    try {
      const n = new Notification(String(item.title || 'Droboard').replace(/<[^>]*>/g, ''), {
        body: body, tag: 'dro-' + item.type, icon: item.thumb || item.cover || undefined, silent: false,
      });
      n.onclick = function () { window.focus(); location.href = 'notifications.html?open=' + encodeURIComponent(item.id); };
    } catch (e) {}
  }
  function requestPermission() {
    if (!('Notification' in window) || Notification.permission === 'granted') return Promise.resolve(Notification ? Notification.permission : 'unsupported');
    return Notification.requestPermission();
  }

  /* ── read / delete / list ────────────────────────────────── */
  function _patch(id, fn) {
    const log = _log();
    const it = log.items.find(i => String(i.id) === String(id));
    if (!it) return null;
    fn(it);
    _writeLog(log);
    _bump();
    return it;
  }
  function markRead(id) { return _patch(id, i => { i.unread = false; i.time = timeLabel(i.at); }); }
  function markUnread(id) { return _patch(id, i => { i.unread = true; }); }
  function remove(id) {
    const log = _log();
    log.items = log.items.filter(i => String(i.id) !== String(id));
    _writeLog(log);
    _bump();
  }
  function markAllRead() { const log = _log(); log.items.forEach(i => { i.unread = false; }); _writeLog(log); _bump(); }

  function all() { return _log().items.slice().sort((a, b) => b.at - a.at); }

  /**
   * @param {{role?:'all'|'reader'|'author', cat?:string, unreadOnly?:boolean}} opts
   */
  function list(opts) {
    const o = opts || {};
    return all().filter(function (i) {
      if (o.unreadOnly && !i.unread) return false;
      if (o.cat && o.cat !== 'all' && i.cat !== o.cat) return false;
      if (o.role && o.role !== 'all' && o.role !== 'both') {
        if (i.audience !== 'both' && i.audience !== o.role) return false;
      }
      return true;
    });
  }
  function unread() { return all().reduce((n, i) => n + (i.unread ? 1 : 0), 0); }
  function unreadByCat() {
    const out = {};
    Object.keys(CATS).forEach(k => { out[k] = 0; });
    out.all = 0;
    all().forEach(function (i) { if (i.unread) { out.all++; if (out[i.cat] !== undefined) out[i.cat]++; } });
    return out;
  }
  function get(id) { return all().find(i => String(i.id) === String(id)) || null; }
  function clearAll() { _save(LOG_KEY, { items: [], lastTypeAt: {} }); }

  /* ── role detection (one inbox, two views) ───────────────── */
  function account() {
    let u = {};
    try { u = JSON.parse(localStorage.getItem('aurum_user') || localStorage.getItem('droboard_user') || '{}') || {}; } catch (e) {}
    const role = String(u.role || '').toLowerCase();
    const isWriter = role === 'author' || role === 'writer' || u.isWriter === true
      || /luna|author|writer/i.test(String(u.handle || u.name || ''));
    const isReader = role === 'reader' || u.isReader === true || !isWriter;
    return { isWriter, isReader, both: isWriter && isReader, handle: u.handle || 'You_Reader' };
  }

  /* ═══════════════════════════════════════════════════════════
     DEMO GENERATOR — turns live platform state into events.
     Replace with the server cron; keys are stable so re-running is a
     no-op and backfilling history cannot duplicate notifications.
     ═══════════════════════════════════════════════════════════ */

  /* stats read from the same services the pages use, so a notification
     can never disagree with the dashboard */
  function myBooks() {
    const A = window.AuthorCenterService;
    if (A && A._BOOKS && A._BOOKS.length) return A._BOOKS;
    const D = window.DemoData || {};
    return (D.AUTHOR_EARNINGS && D.AUTHOR_EARNINGS.byBook) || [];
  }
  function authorStats() {
    const books = myBooks();
    const D = window.DemoData || {};
    const earn = (D.AUTHOR_EARNINGS || {});
    const sum = function (k) {
      return books.reduce(function (n, b) {
        const v = b[k];
        if (typeof v === 'number') return n + v;
        const m = String(v || '').match(/[\d.]+/);
        const base = m ? parseFloat(m[0]) : 0;
        return n + base * (/M/i.test(v) ? 1e6 : /K|k/i.test(v) ? 1e3 : 1);
      }, 0);
    };
    return {
      books: books.length,
      chapters: books.reduce((n, b) => n + (b.chapters || 0), 0),
      reads: sum('reads'),
      likes: sum('likes'),
      saves: Math.round(sum('likes') * 0.34),
      shares: Math.round(sum('reads') * 0.02),
      followers: books.length ? 1284 : 0,
      streakDays: 12,
      editorPicks: 1,
      trendingBest: 7,
      coinsTipped: 1200,
      earnings: earn.lifetime || 0,
    };
  }
  function readerStats() {
    let rk = null, badges = [];
    try { if (window.ReaderLeague) { rk = ReaderLeague.myRank(); badges = ReaderLeague.myBadges() || []; } } catch (e) {}
    return {
      leagueRank: rk ? rk.rank : 0,
      leaguePoints: rk ? rk.points : 0,
      leagueTotal: rk ? rk.total : 0,
      gapToNext: rk ? rk.gapToNext : 0,
      season: rk ? rk.season : '',
      badges: badges,
      weekChapters: 86,
      weekMinutes: 912,
      streakDays: 5,
    };
  }

  const HOUR = 3600000, DAY = 86400000;

  function seedAuthor(since) {
    const st = authorStats();
    const books = myBooks();
    const hero = books[0] || { title: 'Bound By Obsession', cover: '' };

    /* newest three only — a wall of trophies reads as noise; the full
       badge case lives on the profile */
    ACHIEVEMENTS.filter(a => (a.audience || 'author') === 'author').filter(function (a) { return a.when(st); })
      .slice(-3).forEach(function (a, i) {
      emit({ type: 'achievement', key: 'ach:' + a.id, title: a.name, desc: a.desc, tier: a.tier,
        iconName: a.icon, at: since + i * 4 * HOUR });
    });

    /* milestones */
    emit({ type: 'trending_enter', key: 'trend:' + hero.title + ':7', rank: 7, rankNote: 'Trending · Romance',
      cover: hero.cover, title: 'Your story entered Trending', desc: hero.title + ' climbed to #7 on the Romance trending board.',
      metrics: [{ label: 'Rank', value: '#7' }, { label: '24h reads', value: _fmt(48200) }, { label: 'Up from', value: '#22' }],
      chips: ['+15 ranks this week'], link: { label: 'See trending board' }, at: since + HOUR });

    emit({ type: 'editor_pick', key: 'pick:' + hero.title + ':' + new Date().toISOString().slice(0, 10), medal: 'pick',
      title: "Editor's Pick this week", desc: 'A senior editor featured ' + hero.title + ' on the Romance shelf.',
      chips: ['Featured placement', 'Runs 7 days'], link: { label: 'Open shelf' }, at: since + 5 * HOUR });

    emit({ type: 'top_ten', key: 'top10:' + hero.title, rank: 7, rankNote: 'Top 10 · All genres',
      title: 'Top ten finish', desc: hero.title + ' is inside the platform-wide top ten for the first time.',
      metrics: [{ label: 'Reads', value: _fmt(st.reads) }, { label: 'Likes', value: _fmt(st.likes) }, { label: 'Saves', value: _fmt(st.saves) }],
      at: since + 22 * HOUR });

    emit({ type: 'weekly_stats', key: 'wstats:' + _weekKey(), title: 'Your week in numbers',
      desc: 'Mon–Sun across all your stories.',
      metrics: [
        { label: 'Reads', value: _fmt(96400), delta: '+11% vs prev' },
        { label: 'Likes', value: _fmt(11200), delta: '+8% vs prev' },
        { label: 'Saves', value: _fmt(4180), delta: '+19% vs prev' },
        { label: 'Shares', value: _fmt(2040), delta: '+26% vs prev' },
        { label: 'New followers', value: '+312' },
      ], link: { label: 'Full breakdown' }, at: since + 30 * HOUR });

    emit({ type: 'weekly_earnings', key: 'wearn:' + _weekKey(), medal: 'money', title: 'Weekly earnings',
      desc: 'Ad share, unlocks and tips for this week.',
      metrics: [{ label: 'This week', value: '$1,840' }, { label: 'Pending', value: '$1,250' }, { label: 'Top book', value: '46%' }],
      link: { label: 'Go to earnings' }, at: since + 31 * HOUR });

    emit({ type: 'share', key: 'share:' + _weekKey() + ':story', badge: 'chart',
      icon: { name: 'fa-share-nodes', bg: '#e7f0fe', color: '#1d5fd6' },
      title: '<b>2,040 shares</b> of your story this week',
      desc: 'Shares are the biggest driver of new reads on ' + hero.title + '.',
      link: { label: 'See shares', href: '../author/book-overview.html' }, at: since + 9 * HOUR });
    emit({ type: 'save', key: 'save:' + _weekKey(), badge: 'chart',
      icon: { name: 'fa-bookmark', bg: '#efe9ff', color: '#7c5cff' },
      title: '<b>4,180 readers</b> saved your story this week',
      desc: 'Saves turn into returning readers — 62% came back within 3 days.',
      link: { label: 'See saves', href: '../author/book-overview.html' }, at: since + 12 * HOUR });

    emit({ type: 'chapter_live', key: 'live:ch57', title: 'Chapter 57 is live',
      desc: 'Scheduled drop published on time.', link: { label: 'Read it' }, at: since + 34 * HOUR });
    emit({ type: 'review_result', key: 'review:ch56', title: 'Chapter 56 passed review',
      desc: 'No revision requested. It is cleared for publication.', at: since + 38 * HOUR });
    emit({ type: 'contract_update', key: 'contract:applied', title: 'Contract application received',
      desc: 'Our editors are reviewing your submission. Expect a decision within 5 working days.', at: since + 40 * HOUR });
    emit({ type: 'payout', key: 'payout:' + _weekKey(), title: 'Withdrawal processed',
      desc: '$1,200 sent to your bank account ending ••4821.', link: { label: 'Transaction history' }, at: since + 44 * HOUR });
  }

  function seedReader(since) {
    const rs = readerStats();
    ACHIEVEMENTS.filter(a => a.audience === 'reader').forEach(function (a, i) {
      if (!a.when(rs)) return;
      emit({ type: 'achievement', key: 'ach:' + a.id, title: a.name, desc: a.desc, tier: a.tier,
        iconName: a.icon, audience: 'reader', at: since + (i + 2) * HOUR });
    });

    if (rs.leagueRank) {
      emit({ type: 'league_finish', key: 'league:' + rs.season, rank: rs.leagueRank,
        rankNote: 'of ' + rs.leagueTotal + ' readers', medal: 'rank', title: 'You finished the week at #' + rs.leagueRank,
        desc: rs.gapToNext ? 'You were ' + rs.gapToNext + ' points from the rank above.' : 'You are the top reader this season.',
        metrics: [{ label: 'Points', value: _fmt(rs.leaguePoints) }, { label: 'Chapters', value: _fmt(rs.weekChapters) },
          { label: 'Read time', value: Math.round(rs.weekMinutes / 60) + 'h' }],
        chips: rs.badges.length ? [rs.badges[0].label] : [], link: { label: 'Open leaderboard' }, at: since + 3 * HOUR });
    }

    emit({ type: 'reader_weekly', key: 'rweekly:' + _weekKey(), audience: 'both', title: 'Your reading week',
      desc: 'Eight-day summary of what you read.',
      metrics: [{ label: 'Chapters', value: _fmt(rs.weekChapters) }, { label: 'Time', value: Math.round(rs.weekMinutes / 60) + 'h' },
        { label: 'Stories', value: '9' }, { label: 'Streak', value: rs.streakDays + 'd' }], at: since + 33 * HOUR });

    const D = window.DemoData || {};
    (D.CHAPTER_DROPS || []).slice(0, 2).forEach(function (cd, i) {
      emit({ type: 'new_chapter', key: 'drop:' + cd.id, audience: 'reader',
        avatar: cd.cover, badge: 'book', title: '{@' + cd.author + '|' + cd.author + '} released a new chapter',
        desc: cd.title, link: { label: 'Read now', href: 'full-reader.html?story=' + encodeURIComponent(cd.id) },
        thumb: cd.cover, at: since + (i + 4) * HOUR });
    });

    /* engagement — every one of these carries a link to the exact thing
       that happened: the post, the comment thread, or the chapter       */
    emit({ type: 'like', key: 'like:review:' + _weekKey(), audience: 'reader', avatar: 'https://i.pravatar.cc/100?img=12',
      badge: 'heart', title: '{@John_04|John} and <b>12 others</b> liked your review',
      desc: "On The Billionaire's Regret — they liked your review.",
      link: { label: 'View review', href: 'comments.html?id=rev-184' }, at: since + 6 * HOUR });
    emit({ type: 'like', key: 'like:chapter:56:' + _weekKey(), audience: 'author', avatar: 'https://i.pravatar.cc/100?img=15',
      badge: 'heart', title: '<b>2,140 readers</b> reacted to Chapter 56',
      desc: 'Hearts, fire and tears on your newest chapter.',
      link: { label: 'See reactions', href: 'full-reader.html?ch=56' }, at: since + 7 * HOUR });
    emit({ type: 'comment', key: 'comment:post:' + _weekKey(), audience: 'both', avatar: 'https://i.pravatar.cc/100?img=22',
      badge: 'comment', title: '{@Chidi_B|Chidi_B} commented on your post',
      desc: '"This twist had me — who else saw it coming?"',
      link: { label: 'View post', href: 'debate.html?id=post-77' }, at: since + 7.5 * HOUR });
    emit({ type: 'reply', key: 'reply:c-991', audience: 'both', avatar: 'https://i.pravatar.cc/100?img=33', badge: 'comment',
      title: '{@Liam_07|Liam_07} replied to your comment', desc: '"I totally agree with your point about Jason..."',
      link: { label: 'View thread', href: 'comments.html?id=c-991' }, at: since + 8 * HOUR });
    emit({ type: 'mention', key: 'mention:c-1042', audience: 'both', avatar: 'https://i.pravatar.cc/100?img=47', badge: 'mention',
      title: '{@Sarah_K|Sarah_K} mentioned you in a comment', desc: '"you have to read this chapter — it\'s wild"',
      link: { label: 'See mention', href: 'comments.html?id=c-1042' }, at: since + 8.5 * HOUR });
    emit({ type: 'share', key: 'share:post:' + _weekKey(), audience: 'both', badge: 'chart',
      icon: { name: 'fa-share-nodes', bg: '#e7f0fe', color: '#1d5fd6' },
      title: '<b>312 people</b> shared your post this week', desc: 'Shares drove 1,940 new reads to your story.',
      link: { label: 'View post', href: 'debate.html?id=post-77' }, at: since + 9 * HOUR });
    emit({ type: 'follow', key: 'follow:' + _weekKey(), audience: 'both', avatar: 'https://i.pravatar.cc/100?img=32', badge: 'follow',
      title: '{@Ada_Writes|Ada_Writes} and <b>3 others</b> started following you', desc: 'You have 4 new followers this week.',
      link: { label: 'See followers', href: 'profile.html' }, at: since + 10 * HOUR });
    emit({ type: 'coins', key: 'coins:' + _weekKey(), audience: 'reader', badge: 'coin', icon: { name: 'fa-coins', bg: '#e9fbf0', color: '#158a48' },
      title: 'You earned 120 Coins', desc: 'Daily read bonus + league rewards landed in your wallet.',
      link: { label: 'Open wallet', href: 'wallet.html' }, at: since + 11 * HOUR });
    /* reposts + debates + polls + predictions */
    emit({ type: 'repost', key: 'repost:post-77', upsert: true, count: 38, audience: 'both', badge: 'chart',
      icon: { name: 'fa-retweet', bg: '#e7f0fe', color: '#1d5fd6' },
      title: '<b>38 reposts</b> of your post',
      desc: '"Should villains get redemption?" is spreading across readers\' feeds.',
      link: { label: 'View post', href: 'debate.html?id=p9' }, at: since + 13 * HOUR });
    emit({ type: 'debate_reply', key: 'dr:p9:Zara_M', audience: 'both', avatar: 'https://i.pravatar.cc/100?img=41', badge: 'comment',
      title: '{@Zara_M|Zara_M} argued against your side',
      desc: '"Redemption cheapens the stakes…" on your debate Should villains get redemption?',
      link: { label: 'Answer them', href: 'debate.html?id=p9' }, at: since + 14 * HOUR });
    emit({ type: 'debate_verdict', key: 'dv:p9', audience: 'both', medal: 'rank',
      title: 'You won your debate', desc: 'Should villains get redemption? 62% landed on your side.',
      metrics: [{ label: 'Your side', value: '62%' }, { label: 'Votes', value: '428' }, { label: 'Args', value: '37' }],
      chips: ['+1 debate badge'], link: { label: 'Open debate', href: 'debate.html?id=p9' }, at: since + 20 * HOUR });
    emit({ type: 'poll_closed', key: 'poll:p3', audience: 'both', title: 'Your poll got 1,204 votes',
      desc: 'Which ending did readers want? It closed an hour ago.',
      metrics: [{ label: 'Votes', value: '1,204' }, { label: 'Tragic', value: '68%' }, { label: 'Hopeful', value: '22%' }, { label: 'Other', value: '10%' }],
      link: { label: 'See results', href: 'debate.html?id=poll-3' }, at: since + 24 * HOUR });
    emit({ type: 'prediction_settled', key: 'pred:p1', audience: 'both', medal: 'rank',
      title: 'Your prediction came true', desc: 'You called the Chapter 57 twist three weeks early.',
      metrics: [{ label: 'Predictors', value: '12' }, { label: 'Your rank', value: '#1' }, { label: 'Won', value: '250c' }],
      chips: ['Settled'], link: { label: 'Open prediction', href: 'debate.html?id=pred-1' }, at: since + 28 * HOUR });
    emit({ type: 'security', key: 'sec:1', badge: 'alert', icon: { name: 'fa-shield-halved', bg: '#fdeaea', color: '#c92a2a' },
      title: 'New sign-in from a new device', desc: 'Windows · Lagos, NG. If this was not you, secure your account.',
      link: { label: 'Account security' }, at: since + 46 * HOUR });
  }

  function _weekKey() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return mon.toISOString().slice(0, 10);
  }

  /* ── the 24-hour rule ──────────────────────────────────────
     Statuses only. When one of your statuses closes its first 24 hours,
     its poster gets one digest of that status. Chapters and other posts
     never fire this — they roll into weekly_stats instead.            */
  function myStatusSlides() {
    try {
      if (window.DroboardStatus && window.DroboardStatus.myEntry) {
        const e = window.DroboardStatus.myEntry();
        if (e && e.statuses && e.statuses.length) return e.statuses;
      }
    } catch (e) {}
    const me = ((window.DemoData || {}).STATUSES || []).find(function (s) { return s.isYou || s.id === 'you'; });
    return (me && me.statuses) || [];
  }
  function seedStatusDigests(since) {
    const slides = myStatusSlides();
    if (!slides.length) return;
    const fallback = [
      { views: 1240, likes: 148, replies: 23, shares: 19 },
      { views: 860, likes: 92, replies: 11, shares: 7 },
    ];
    slides.slice(0, 2).forEach(function (s, i) {
      const cur = {
        views: s.views || fallback[i].views,
        likes: s.likes || fallback[i].likes,
        replies: s.threads || s.replies || fallback[i].replies,
        shares: s.shares || fallback[i].shares,
      };
      const prev = slides[i + 1] ? { views: slides[i + 1].views || fallback[1 - i].views, likes: slides[i + 1].likes || fallback[1 - i].likes } : null;
      const label = s.caption || (s.quote ? String(s.quote).replace(/^"|"$/g, '').slice(0, 48) : 'Your status');
      emit({
        type: 'status_24h', key: 'status24h:' + (s.id || (s.bg || i)), audience: 'both',
        title: '<b>' + _fmt(cur.views) + ' people</b> viewed your status',
        desc: '"' + label + '" expired after 24 hours. Here is who saw it and how they reacted.',
        thumb: s.bg,
        metrics: [
          { label: 'Views', value: _fmt(cur.views), delta: prev ? _delta(cur.views, prev.views) : null },
          { label: 'Likes', value: _fmt(cur.likes), delta: prev ? _delta(cur.likes, prev.likes) : null },
          { label: 'Replies', value: _fmt(cur.replies) },
          { label: 'Shares', value: _fmt(cur.shares) },
        ],
        link: { label: 'See who viewed', href: 'feed.html?status=viewers' },
        at: since + (i ? 27 : 2) * HOUR,
      });
    });
  }

  /* Seed once per week; a returning user only gets genuinely new events.
     Both views are populated because one account can read and publish. */
  const SEED_VERSION = 'v4';
  function seed() {
    if (USE_API) return;
    const marker = 'dro_notif_seeded';
    const stamp = _load(marker, '');
    const want = SEED_VERSION + ':' + _weekKey();
    if (stamp === want && _log().items.length) return;
    /* copy or schema changed since the last seed → rebuild the demo log;
       a plain week rollover only appends the new week's events */
    if (String(stamp).indexOf(SEED_VERSION) !== 0) _save(LOG_KEY, { items: [], lastTypeAt: {} });
    _save(marker, want);
    const since = Date.now() - 2 * DAY;
    seedAuthor(since);
    seedReader(since);
    seedStatusDigests(since);
  }

  window.DroboardNotifStore = {    CATS, TYPES, ACHIEVEMENTS,
    settings, saveSettings, setChannel, muteType, inQuietHours, requestPermission,
    emit, all, list, get, unread, unreadByCat, markRead, markUnread, markAllRead, remove, clearAll,
    groupByDay, timeLabel, account, authorStats, readerStats, seed,
    fmt: _fmt,
  };

  /* ergonomic call site anywhere in the app: window.droNotify({type:'payout', …})
     Silently no-ops on pages that don't load this store. */
  window.droNotify = function (ev) {
    try { return emit(ev); } catch (e) { return null; }
  };
})();
