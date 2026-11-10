/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION STORE — window.DroboardNotifStore
   ───────────────────────────────────────────────────────────────
   The single source of truth for every notification surface: the
   notifications page (reader + author views), the bell badge, and local
   push dispatch.

   The SERVER owns the rows. This file is a cache + renderer:
     GET    /api/notifications?limit=&page=
     GET    /api/notifications/unread-count
     GET    /api/notifications/settings
     PUT    /api/notifications/settings
     POST   /api/notifications            (raise a row about yourself)
     POST   /api/notifications/read-all
     PATCH  /api/notifications/:id        {read} | {deleted}

   Contract for the rest of the app:
     DroboardNotifStore.emit({ type:'trending_enter', ...payload })
       → gated by the channel matrix + mute list, posted to the server,
         the returned row is cached, the badge bumped and a local push
         dispatched when allowed.
     DroboardNotifStore.list({ role, cat }) / unread() / markRead(id) …

   Rows about OTHER people (like, comment, reply, mention, follow,
   direct_message) are raised by the server when the other party acts —
   a client can never author them. The client may only raise rows about
   its own account, which is why SELF_TYPES is whitelisted here too.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardNotifStore) return;

  const API_BASE = '/api/notifications';
  const MAX_ITEMS = 150;

  /* ── categories ───────────────────────────────────────────── */
  const CATS = {
    highlights: { label: 'Highlights', icon: 'fa-trophy', bg: '#fff4e0', color: '#b7690a' },
    achievements: { label: 'Achievements', icon: 'fa-award', bg: '#fdeee0', color: '#9a6508' },
    stats: { label: 'Your stats', icon: 'fa-chart-line', bg: '#e7f0fe', color: '#1d5fd6' },
    activity: { label: 'Activity', icon: 'fa-heart', bg: '#ffe9ef', color: '#ff2d55' },
    messages: { label: 'Messages', icon: 'fa-comment-dots', bg: '#e8f1ff', color: '#2563eb' },
    stories: { label: 'Stories', icon: 'fa-book-open', bg: '#efe9ff', color: '#7c5cff' },
    revenue: { label: 'Revenue', icon: 'fa-dollar-sign', bg: '#e9fbf0', color: '#158a48' },
    system: { label: 'System', icon: 'fa-shield-halved', bg: '#f1f1f4', color: '#5c5c66' },
  };

  /* ── type catalog: who it is for, how loud it is ──────────────
     audience: reader | author | both  (both = writers read too)
     push: true means push-eligible; the store still honours settings,
     mute list and quiet hours. cooldownHours is the dedupe window for
     the same logical event when no explicit key is supplied.          */
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

    /* 1:1 chat — coalesced per conversation, so a thread is one unread row
       whose count climbs. Never one notification per message. */
    direct_message: { cat: 'messages', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },

    /* revenue */
    tip: { cat: 'revenue', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    payout: { cat: 'revenue', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    coins: { cat: 'revenue', kind: 'row', audience: 'reader', push: false, cooldownHours: 24 },

    /* workflow + system */
    review_result: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    book_change_result: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    contract_update: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    completion_result: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    book_flagged: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    verification: { cat: 'system', kind: 'row', audience: 'author', push: true, cooldownHours: 0 },
    security: { cat: 'system', kind: 'row', audience: 'both', push: true, cooldownHours: 0 },
    announcement: { cat: 'system', kind: 'row', audience: 'both', push: false, cooldownHours: 48 },
  };

  /* Types a client may raise about ITSELF. Activity rows (like, comment,
     reply, mention, follow, direct_message) are owned by the server. */
  const SELF_TYPES = new Set([
    'debate_verdict', 'poll_closed', 'prediction_settled', 'status_24h', 'reading_streak',
    'league_finish', 'reader_weekly', 'weekly_stats', 'weekly_earnings',
    'trending_enter', 'top_ten', 'editor_pick', 'featured',
    'new_chapter', 'chapter_live', 'schedule_failed',
    'payout', 'tip', 'coins', 'save', 'share', 'repost',
    'achievement', 'security', 'announcement',
    'contract_update', 'book_change_result', 'review_result', 'verification',
  ]);

  const TYPE_LABELS = {
    trending_enter: 'Trending', top_ten: 'Top ten', editor_pick: "Editor's pick",
    featured: 'Featured', league_finish: 'League finish', reading_streak: 'Reading streak',
    achievement: 'Achievement', status_24h: '24h report', weekly_stats: 'Weekly stats',
    weekly_earnings: 'Weekly earnings', reader_weekly: 'Reading week',
    new_chapter: 'New chapter', chapter_live: 'Chapter live', schedule_failed: 'Schedule failed',
    like: 'Likes', comment: 'Comments', reply: 'Replies', mention: 'Mentions',
    follow: 'Follows', share: 'Shares', save: 'Saves', repost: 'Reposts',
    debate_reply: 'Debate replies', debate_verdict: 'Debate verdicts', poll_closed: 'Closed polls',
    prediction_settled: 'Settled predictions', direct_message: 'Messages',
    tip: 'Tips', payout: 'Payouts', coins: 'Coins',
    review_result: 'Review results', book_change_result: 'Book change results',
    contract_update: 'Contract updates', completion_result: 'Completion results',
    book_flagged: 'Flagged books',
    verification: 'Verification',
    security: 'Security', announcement: 'Announcements',
  };

  /* ── cache ─────────────────────────────────────────────────── */
  let _items = [];
  let _settings = null;
  let _hydrated = null;

  /* ── settings (mirror of User.settings.notificationChannels) ── */
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
  function settings() { return _settings || _migrate(null); }
  function saveSettings(patch) {
    const next = _migrate(Object.assign({}, settings(), patch || {}));
    _settings = next;
    return _request('PUT', '/settings', next).then(function () { return next; });
  }
  function setChannel(cat, channel, on) {
    const cur = settings();
    cur[cat] = cur[cat] || { inapp: true, push: false, email: false };
    cur[cat][channel] = !!on;
    return saveSettings(cur);
  }
  function muteType(type, on) {
    /* Notification settings are per-account — guests get the login wall. */
    if (window.RequireAuth && !RequireAuth.ensure('change notification settings')) return null;
    const cur = settings();
    const set = new Set(cur.mutedTypes || []);
    if (on) set.add(type); else set.delete(type);
    cur.mutedTypes = Array.from(set);
    saveSettings(cur);
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

  /* ── api ──────────────────────────────────────────────────── */
  function _err(json, status) {
    const e = new Error((json && (json.message || json.error)) || ('notifications_request_failed_' + status));
    e.status = status;
    e.payload = json;
    return e;
  }
  function _request(method, path, body) {
    const opt = { method: method, credentials: 'include', headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    return fetch(API_BASE + path, opt).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; }).then(function (json) {
        if (!res.ok) throw _err(json, res.status);
        return json;
      });
    });
  }

  /* Rows come from the server already shaped for the renderer; the client
     only adds what the renderer needs and the server cannot know: the
     human time label and the type label. */
  function _map(row) {
    if (!row) return null;
    const meta = TYPES[row.type] || {};
    const out = Object.assign({}, row);
    out.at = typeof row.at === 'number' ? row.at : (row.createdAt ? new Date(row.createdAt).getTime() : Date.now());
    out.time = row.time || timeLabel(out.at);
    out.typeLabel = row.typeLabel || TYPE_LABELS[row.type] || row.type;
    out.cat = row.cat || meta.cat || 'system';
    out.kind = row.kind || meta.kind || 'row';
    out.audience = row.audience || meta.audience || 'both';
    out.unread = !!row.unread;
    if (row.link && typeof row.link === 'string') out.link = { href: row.link, label: row.linkLabel || '' };
    else if (row.link) out.link = { href: row.link.href || '', label: row.link.label || row.linkLabel || '' };
    else out.link = null;
    if (!out.icon && !out.avatar) {
      const c = CATS[out.cat] || CATS.system;
      out.icon = { name: c.icon, bg: c.bg, color: c.color };
    }
    return out;
  }

  function _sort(items) {
    return items.slice().sort(function (a, b) { return b.at - a.at; });
  }
  function _cache(items) {
    _items = _sort(items).slice(0, MAX_ITEMS);
    return _items;
  }
  function _upsert(item) {
    const next = _items.filter(i => String(i.id) !== String(item.id));
    next.push(item);
    _items = _sort(next).slice(0, MAX_ITEMS);
    return item;
  }

  /* ── hydration ────────────────────────────────────────────── */
  async function _fetchPage(page) {
    const q = '/?limit=50&page=' + page;
    const data = await _request('GET', q);
    return { items: (data && data.items) || [], total: (data && data.total) || 0 };
  }
  /**
   * Pull the inbox from the server. Guests (401) get an empty inbox —
   * every other failure surfaces as a real error.
   */
  async function hydrate() {
    if (_hydrated) return _hydrated;
    _hydrated = (async function () {
      let page = null;
      try {
        page = await _fetchPage(1);
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          _cache([]);
          _settings = _migrate(null);
          _bump();
          return _items;
        }
        throw e;
      }
      let rows = page.items.slice();
      const pages = Math.min(3, Math.ceil((page.total || rows.length) / 50));
      for (let p = 2; p <= pages; p++) {
        const more = await _fetchPage(p);
        rows = rows.concat(more.items);
        if (!more.items.length) break;
      }
      _cache(rows.map(_map).filter(Boolean));
      try {
        const s = await _request('GET', '/settings');
        _settings = _migrate(s && s.settings);
      } catch (e) {
        if (e.status !== 401 && e.status !== 403) throw e;
        _settings = _migrate(null);
      }
      _bump();
      return _items;
    })();
    try { await _hydrated; } catch (e) { _hydrated = null; throw e; }
    return _items;
  }
  function hydrateAgain() { _hydrated = null; return hydrate(); }

  /* ── announcements ────────────────────────────────────────── */
  function _bump() {
    try { window.dispatchEvent(new CustomEvent('dro:notification-count', { detail: { count: unread() } })); } catch (e) {}
  }
  function _announce(item) {
    try { window.dispatchEvent(new CustomEvent('dro:notification', { detail: item })); } catch (e) {}
    _bump();
  }

  /* ── local dispatch (browser Notification API) ─────────────
     Real device/web push belongs on the server: it needs a service
     worker + subscription endpoint + FCM/APNs. Until then this is the
     in-browser channel, and Capacitor LocalNotifications replaces it
     in the native shell with the same payload.                    */
  function dispatchLocal(item) {
    if (!window.Notification) return;
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
    if (!window.Notification) return Promise.resolve('unsupported');
    if (Notification.permission === 'granted') return Promise.resolve(Notification.permission);
    return Notification.requestPermission();
  }

  /* ── emit ─────────────────────────────────────────────────── */
  function _fmt(n) {
    if (n == null) return '—';
    if (window.DroboardFormat && DroboardFormat.compact) return DroboardFormat.compact(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }
  function _keyParts(ev) {
    return ['story', 'book', 'post', 'chapter', 'season', 'rank', 'amount']
      .filter(k => ev[k] != null).map(k => String(ev[k]).slice(0, 40));
  }
  function _cooldownOpen(type) {
    const meta = TYPES[type] || {};
    if (!meta.cooldownHours) return false;
    const since = Date.now() - meta.cooldownHours * 3600000;
    return _items.some(i => i.type === type && i.at >= since);
  }

  /**
   * Raise a row about the signed-in user's own account.
   * @param {object} ev { type, key?, title?, desc?, link?, metrics?, chips?, … }
   * @returns {Promise<object|null>} the stored row, or null when suppressed
   */
  function emit(ev) {
    if (!ev || !ev.type) return Promise.resolve(null);
    const meta = TYPES[ev.type];
    if (!meta) return Promise.resolve(null);
    if (!SELF_TYPES.has(ev.type)) return Promise.resolve(null);

    const key = ev.key || (ev.type + ':' + (_keyParts(ev).join('|') || Date.now()));
    const existing = _items.find(i => i.key === key);
    if (existing) return Promise.resolve(existing);
    if (_cooldownOpen(ev.type)) return Promise.resolve(null);

    const s = settings();
    const muted = (s.mutedTypes || []).indexOf(ev.type) !== -1;
    const chan = s[meta.cat] || {};
    if (muted || !s.all || chan.inapp === false) return Promise.resolve(null);

    const body = {
      type: ev.type,
      title: String(ev.title || '').slice(0, 300),
      desc: String(ev.desc || '').slice(0, 600),
      key: String(key).slice(0, 160),
      audience: ev.audience || meta.audience,
    };
    if (ev.metrics) body.metrics = ev.metrics;
    if (ev.chips) body.chips = ev.chips;
    if (ev.badge) body.badge = ev.badge;
    if (ev.medal) body.medal = ev.medal;
    if (ev.cover) body.cover = ev.cover;
    if (ev.avatar) body.avatar = ev.avatar;
    if (ev.thumb) body.thumb = ev.thumb;
    if (ev.rank != null) body.rank = ev.rank;
    if (ev.rankNote) body.rankNote = ev.rankNote;
    if (ev.iconName) body.iconName = ev.iconName;
    if (ev.tier) body.tier = ev.tier;
    if (ev.tierClass) body.tierClass = ev.tierClass;
    if (ev.color) body.color = ev.color;
    if (ev.count != null) body.count = ev.count;
    if (ev.icon) body.icon = ev.icon;
    if (typeof ev.link === 'string') { body.link = ev.link; if (ev.linkLabel) body.linkLabel = ev.linkLabel; }
    else if (ev.link) {
      body.link = ev.link.href || '';
      if (ev.link.label) body.linkLabel = ev.link.label;
    } else if (ev.linkLabel) body.linkLabel = ev.linkLabel;

    return _request('POST', '/', body).then(function (row) {
      const item = _map(row) || _map(Object.assign({}, body, { at: Date.now(), unread: true }));
      if (!item) return null;
      _upsert(item);
      _announce(item);
      if (!muted && meta.push && chan.push !== false && !inQuietHours()) dispatchLocal(item);
      return item;
    }).catch(function (err) {
      try { window.dispatchEvent(new CustomEvent('dro:notification-error', { detail: err })); } catch (e) {}
      return null;
    });
  }

  /* ── read / delete / list ────────────────────────────────── */
  /* The cache flips immediately so the page can re-render, but the badge
     event waits for the server to confirm — the bell number is the API's. */
  function _patch(id, body) {
    const item = _items.find(i => String(i.id) === String(id)) || null;
    if (body.deleted) {
      _items = _items.filter(i => String(i.id) !== String(id));
      return _request('PATCH', '/' + encodeURIComponent(id), { deleted: true })
        .then(function () { _bump(); return null; });
    }
    if (item) item.unread = !body.read;
    return _request('PATCH', '/' + encodeURIComponent(id), { read: !!body.read })
      .then(function () { _bump(); return item; });
  }
  function markRead(id) { return _patch(id, { read: true }); }
  function markUnread(id) { return _patch(id, { read: false }); }
  function remove(id) { return _patch(id, { deleted: true }); }
  function markAllRead() {
    _items.forEach(i => { i.unread = false; });
    return _request('POST', '/read-all', {}).then(function () { _bump(); return _items; });
  }
  /* There is no server-side "wipe" endpoint: the rows are deleted one by one
     so the account ends up exactly as empty as the reset promises. */
  function clearAll() {
    const ids = _items.map(i => i.id);
    _items = [];
    return Promise.all(ids.map(function (id) {
      return _request('PATCH', '/' + encodeURIComponent(id), { deleted: true }).catch(function () { return null; });
    })).then(function () { _bump(); return _items; });
  }

  function all() { return _sort(_items); }

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

  /* ── role detection (one inbox, two views) ───────────────── */
  function account() {
    let u = null;
    try {
      if (window.AuthSession && AuthSession.getStoredUser) u = AuthSession.getStoredUser();
      else u = JSON.parse(localStorage.getItem('droboard_user') || '{}') || {};
    } catch (e) { u = {}; }
    u = u || {};
    const role = String(u.role || '').toLowerCase();
    const roles = (Array.isArray(u.roles) ? u.roles : []).map(function (r) { return String(r).toLowerCase(); });
    const isWriter = role === 'author' || role === 'writer' || u.isWriter === true
      || roles.indexOf('author') > -1 || roles.indexOf('writer') > -1;
    const isReader = role === 'reader' || u.isReader === true || roles.indexOf('reader') > -1 || !isWriter;
    return { isWriter, isReader, both: isWriter && isReader, handle: u.handle || u.username || null };
  }

  window.DroboardNotifStore = {
    CATS, TYPES,
    settings, saveSettings, setChannel, muteType, inQuietHours, requestPermission,
    emit, hydrate, hydrateAgain,
    all, list, get, unread, unreadByCat, markRead, markUnread, markAllRead, remove, clearAll,
    groupByDay, timeLabel, account,
    fmt: _fmt,
    dispatchLocal,
  };

  /* ergonomic call site anywhere in the app: window.droNotify({type:'payout', …})
     Silently no-ops on pages that don't load this store. */
  window.droNotify = function (ev) {
    try { return emit(ev); } catch (e) { return Promise.resolve(null); }
  };
})();
