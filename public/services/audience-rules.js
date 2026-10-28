/* ═══════════════════════════════════════════════════════════════
   AUDIENCE RULES — window.DroboardAudienceRules
   ───────────────────────────────────────────────────────────────
   Single source of truth for the behavior-segment catalog that ad
   targeting picks from. One copy of the definitions, editable from
   Marketing → Ad Manager → Audience segments.

   The catalog splits in two, and the split is the whole point:

     • the SIGNAL (`reactions`, `saves`, `is_writer`) is engineering's
       call — someone has to compute it server-side, so the editor can
       only choose from SIGNALS below, never invent one.
     • the RULE around it (threshold, window, operator) and the label,
       description, icon and colour are marketing's call — editable,
       saved, and served to every page.

   Live: GET/PUT /api/marketing/audience-segments (Mongo `AudienceConfig`,
   seeded from DEFAULT_SEGMENTS below). Demo: localStorage
   'dro_audience_segments_v1' holds the whole edited list, so marketing
   edits reach client pages on next load exactly like the ad overrides.

   Consumers: marketing/ad-manager.js (editor), marketing/shared/ad-setup-
   data.js (SEGMENTS), marketing/shared/ad-setup-service.js (picker),
   services/audience-service.js (does this reader match?).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardAudienceRules) return;

  var LS_KEY = 'dro_audience_segments_v1';
  var API = '/api/marketing/audience-segments';

  /* Same convention as the rest of the marketing console: try the live
     endpoint, fall back to the local copy. Nothing here waits on the
     backend — `all()` is synchronous off localStorage, and refresh() feeds
     it from the server when one is answering. */
  /* Which side last answered. The editor shows it, because "did my edit
     take?" is unanswerable without knowing whether a backend was listening
     or the local copy just stood on its own. */
  var SOURCE = 'local';
  var SYNCED_AT = 0;
  function mark(source) { SOURCE = source; if (source === 'api') SYNCED_AT = Date.now(); return source; }

  function api(method, body, suffix) {
    var opt = { method: method, credentials: 'include', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(API + (suffix || ''), opt).then(function (r) {
      if (!r.ok) throw new Error('audience ' + method + ' failed');
      mark('api');
      return r.json();
    });
  }

  /* kind: 'count' = number vs threshold (window optional)
     'bool'  = reader either is or isn't
     'pair'  = two thresholds, matches if either is met
     live: which collection answers it once the backend is wired.
     ops: what the backend can actually answer. An event count is only ever
     "at least N" — "no more than 5 comments" would have to include every
     reader with zero comments, which is not a segment anyone wants to buy. */
  var SIGNALS = [
    { id: 'reactions', label: 'Reactions sent', kind: 'count', unit: 'reactions', window: true, ops: ['gte'], live: 'Reaction' },
    { id: 'comments', label: 'Comments + replies', kind: 'count', unit: 'comments', window: true, ops: ['gte'], live: 'Comment' },
    { id: 'shares', label: 'Stories shared', kind: 'count', unit: 'shares', window: true, ops: ['gte'], live: 'ShareEvent' },
    { id: 'saves', label: 'Stories saved', kind: 'count', unit: 'saves', window: true, ops: ['gte'], live: 'LibraryItem' },
    { id: 'books_finished', label: 'Books finished', kind: 'count', unit: 'books', window: true, ops: ['gte'], live: 'LibraryItem (history)' },
    { id: 'chapters_unlocked', label: 'Chapters unlocked with coins', kind: 'count', unit: 'unlocks', window: true, ops: ['gte'], live: 'LedgerEntry (spend)' },
    { id: 'tip_sent', label: 'Coins tipped to writers', kind: 'count', unit: 'tips', window: true, ops: ['gte'], live: 'LedgerEntry (tip)' },
    { id: 'coin_purchase', label: 'Coin purchases', kind: 'count', unit: 'purchases', window: true, ops: ['gte'], live: 'CoinTransaction' },
    { id: 'ad_click', label: 'Ad clicks', kind: 'count', unit: 'clicks', window: true, ops: ['gte'], live: 'AdClick' },
    { id: 'referrals_converted', label: 'Referrals that converted', kind: 'count', unit: 'referrals', window: true, ops: ['gte'], live: 'Referral' },
    { id: 'following_count', label: 'Accounts followed', kind: 'count', unit: 'follows', window: false, ops: ['gte'], live: 'Follow' },
    { id: 'days_since_active', label: 'Days since last visit', kind: 'count', unit: 'days', window: false, ops: ['gte', 'lte'], live: 'User.lastLoginAt' },
    { id: 'account_age_days', label: 'Days since signup', kind: 'count', unit: 'days', window: false, ops: ['gte', 'lte'], live: 'User.createdAt' },
    { id: 'weekly_hours_or_streak', label: 'Hours read this week OR reading streak', kind: 'pair', unit: 'hrs / days', window: false, ops: ['any'], live: 'ReadingProgress' },
    { id: 'subscription_active', label: 'Subscription is active', kind: 'bool', ops: ['eq'], live: 'Subscription' },
    { id: 'had_subscription', label: 'Ever subscribed', kind: 'bool', ops: ['eq'], live: 'Subscription' },
    { id: 'is_writer', label: 'Is a verified writer', kind: 'bool', ops: ['eq'], live: 'User.roles' },
  ];
  var SIG_BY_ID = {};
  SIGNALS.forEach(function (s) { SIG_BY_ID[s.id] = s; });

  /* The seed catalog. Reach here is a demo number — live, the backend
     replaces it with a real count of users matching the rule. */
  var DEFAULT_SEGMENTS = [
    { id: 'top-tippers', label: 'Top Tippers', icon: 'fa-coins', color: '#f0a800', desc: 'Tipped a writer in the last 30 days — proven spenders.', reach: 184000, rule: { signal: 'tip_sent', windowDays: 30, op: 'gte', value: 1 } },
    { id: 'super-reactors', label: 'Super Reactors', icon: 'fa-heart', color: '#ff0050', desc: '50+ reactions in 30 days — the loudest engagers.', reach: 642000, rule: { signal: 'reactions', windowDays: 30, op: 'gte', value: 50 } },
    { id: 'commentators', label: 'Commentators', icon: 'fa-comments', color: '#38bdf8', desc: '10+ comments in 30 days — discussion drivers.', reach: 388000, rule: { signal: 'comments', windowDays: 30, op: 'gte', value: 10 } },
    { id: 'sharers', label: 'Sharers', icon: 'fa-share-nodes', color: '#34d399', desc: 'Shared 3+ stories — organic amplifiers.', reach: 296000, rule: { signal: 'shares', windowDays: 90, op: 'gte', value: 3 } },
    { id: 'savers', label: 'Savers', icon: 'fa-bookmark', color: '#60a5fa', desc: '20+ saved stories — library builders with intent.', reach: 514000, rule: { signal: 'saves', windowDays: 90, op: 'gte', value: 20 } },
    { id: 'unlockers', label: 'Chapter Unlockers', icon: 'fa-lock-open', color: '#d97706', desc: 'Unlocked 3+ chapters — pay for content already.', reach: 228000, rule: { signal: 'chapters_unlocked', windowDays: 90, op: 'gte', value: 3 } },
    { id: 'coin-buyers', label: 'Coin Buyers', icon: 'fa-wallet', color: '#a78bfa', desc: 'Bought coins in the last 90 days — wallet open.', reach: 176000, rule: { signal: 'coin_purchase', windowDays: 90, op: 'gte', value: 1 } },
    { id: 'premium', label: 'Premium Members', icon: 'fa-crown', color: '#fbbf24', desc: 'Active subscription — highest lifetime value.', reach: 96000, rule: { signal: 'subscription_active', op: 'eq', value: true } },
    { id: 'power-followers', label: 'Power Followers', icon: 'fa-user-group', color: '#f472b6', desc: 'Follows 25+ accounts — discovery hungry.', reach: 342000, rule: { signal: 'following_count', op: 'gte', value: 25 } },
    { id: 'binge-readers', label: 'Binge Readers', icon: 'fa-fire', color: '#ef4444', desc: '5+ hrs/week or a 10-day streak — always reading.', reach: 458000, rule: { signal: 'weekly_hours_or_streak', op: 'any', value: [5, 10] } },
    { id: 'finishers', label: 'Finishers', icon: 'fa-circle-check', color: '#22c55e', desc: 'Completed 3+ books — commit to full stories.', reach: 524000, rule: { signal: 'books_finished', op: 'gte', value: 3 } },
    { id: 'referrers', label: 'Referrers', icon: 'fa-user-plus', color: '#0ea5e9', desc: 'Brought 1+ converted reader — trusted voices.', reach: 88000, rule: { signal: 'referrals_converted', op: 'gte', value: 1 } },
    { id: 'ad-responders', label: 'Ad Responders', icon: 'fa-rectangle-ad', color: '#fb923c', desc: 'Clicked an ad in 30 days — proven to convert.', reach: 612000, rule: { signal: 'ad_click', windowDays: 30, op: 'gte', value: 1 } },
    { id: 'winback', label: 'Win-back', icon: 'fa-moon', color: '#818cf8', desc: 'Dormant 30+ days — re-engagement plays.', reach: 734000, rule: { signal: 'days_since_active', op: 'gte', value: 30 } },
    { id: 'newcomers', label: 'Newcomers', icon: 'fa-seedling', color: '#4ade80', desc: 'Joined in the last 14 days — onboarding window.', reach: 142000, rule: { signal: 'account_age_days', op: 'lte', value: 14 } },
    { id: 'lapsed-subscribers', label: 'Lapsed Subscribers', icon: 'fa-ticket', color: '#f97316', desc: 'Held Daily/Weekly/Monthly before but not subscribed now — win them back.', reach: 64000, rule: { signal: 'had_subscription', op: 'eq', value: true } },
    { id: 'writers', label: 'Writers', icon: 'fa-feather-pointed', color: '#e879f9', desc: 'Verified authors — for tools, promos, services.', reach: 28000, rule: { signal: 'is_writer', op: 'eq', value: true } },
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function defaults() { return clone(DEFAULT_SEGMENTS); }
  function signals() { return clone(SIGNALS); }
  function signal(id) { return SIG_BY_ID[id] ? clone(SIG_BY_ID[id]) : null; }

  function readOverlay() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var ov = JSON.parse(raw);
      return ov && Array.isArray(ov.segments) && ov.segments.length ? ov.segments : null;
    } catch (e) { return null; }
  }
  function writeOverlay(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ segments: list, savedAt: Date.now() })); } catch (e) {}
  }

  /* Measured reach is a number the backend counts, not part of the
     definition — marketing can't edit it, so it lives in its own cache and
     is merged over whatever the definition says. */
  var REACH_KEY = 'dro_audience_reach_v1';
  function readReach() {
    try { return JSON.parse(localStorage.getItem(REACH_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function setReach(byId) {
    var cur = readReach();
    Object.keys(byId || {}).forEach(function (id) {
      var n = parseInt(byId[id], 10);
      if (n >= 0) cur[id] = n;
    });
    try { localStorage.setItem(REACH_KEY, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }

  /* Normalise whatever came from storage/the API against the shape the rest
     of the app assumes, so a hand-edited record can't blank a picker. */
  function normalize(seg) {
    var r = (seg && seg.rule) || {};
    var sig = SIG_BY_ID[r.signal] ? r.signal : 'reactions';
    var def = SIG_BY_ID[sig];
    var kind = def.kind;
    var allowed = def.ops || ['gte'];
    var op = allowed.indexOf(r.op) > -1 ? r.op : allowed[0];
    var id = String((seg && seg.id) || '').trim();
    var out = {
      id: id,
      label: String((seg && seg.label) || id || 'Segment'),
      icon: String((seg && seg.icon) || 'fa-users'),
      color: /^#[0-9a-fA-F]{6}$/.test(String(seg && seg.color || '')) ? seg.color : '#ff0050',
      desc: String((seg && seg.desc) || ''),
      reach: Math.max(0, parseInt(seg && seg.reach, 10) || 0),
      rule: { signal: sig, op: op },
    };
    if (kind === 'bool') out.rule.value = r.value !== false;
    else if (kind === 'pair') {
      var v = Array.isArray(r.value) ? r.value : [r.value, r.value];
      out.rule.value = [Math.max(0, +v[0] || 0), Math.max(0, +v[1] || 0)];
    } else out.rule.value = Math.max(0, +r.value || 0);
    if (def.window && r.windowDays) out.rule.windowDays = Math.max(1, +r.windowDays || 30);
    if (seg && seg.retired) out.retired = true;
    return out;
  }
  function normalizeAll(list) {
    var seen = {};
    return (list || []).map(normalize).filter(function (s) {
      if (!s.id || seen[s.id]) return false;
      seen[s.id] = true;
      return true;
    });
  }

  /* The catalog every surface reads. Retired segments stay in the list —
     ads already targeting them must keep resolving — but they are hidden
     from pickers, which is what `all()` returns by default. */
  function all(opts) {
    var list = normalizeAll(readOverlay() || defaults());
    var reach = readReach();
    list.forEach(function (s) { if (reach[s.id] != null) s.reach = reach[s.id]; });
    if (opts && opts.includeRetired) return list;
    return list.filter(function (s) { return !s.retired; });
  }
  function get(id, opts) {
    var list = all(Object.assign({ includeRetired: true }, opts || {}));
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function save(list) {
    var next = normalizeAll(list);
    return api('PUT', { segments: next })
      .then(function (d) { writeOverlay((d && d.segments) || next); return next; })
      .catch(function () { mark('local'); writeOverlay(next); return next; });
  }
  function patch(id, changes) {
    var list = normalizeAll(readOverlay() || defaults());
    var i = -1;
    for (var k = 0; k < list.length; k++) if (list[k].id === id) i = k;
    if (i === -1) return Promise.resolve(null);
    list[i] = normalize(Object.assign({}, list[i], changes, { rule: Object.assign({}, list[i].rule, changes && changes.rule || {}) }));
    return save(list).then(function () { return list[i]; });
  }
  /* Retire, never delete: an ad saved against a segment keeps working, it
     just stops being offered to whoever sets up the next campaign. */
  function setRetired(id, retired) { return patch(id, { retired: !!retired }); }
  function add(seg) {
    var list = normalizeAll(readOverlay() || defaults());
    var next = normalize(Object.assign({ id: 'seg-' + Date.now().toString(36), label: 'New segment', reach: 0 }, seg));
    if (list.some(function (s) { return s.id === next.id; })) next.id = next.id + '-' + Math.random().toString(36).slice(2, 5);
    list.push(next);
    return save(list).then(function () { return next; });
  }
  function reset() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    return api('POST', null, '/reset').then(function (d) {
      if (d && d.segments) writeOverlay(d.segments);
      return normalizeAll(d && d.segments) || defaults();
    }).catch(function () { mark('local'); return defaults(); });
  }
  /* Pull the live catalog into the local copy so client pages (which read
     synchronously) serve what marketing saved. Offline or anonymous the
     stored copy simply stands. */
  function refresh() {
    return api('GET').then(function (d) {
      if (d && Array.isArray(d.segments) && d.segments.length) writeOverlay(d.segments);
      return all({ includeRetired: true });
    }).catch(function () { mark('local'); return all({ includeRetired: true }); });
  }

  /* Human sentence for a rule — the picker and the editor both show it so
     nobody has to read `{op:'gte',value:50,windowDays:30}` to know who
     they are targeting. */
  function describe(seg) {
    var r = (seg && seg.rule) || {};
    var s = SIG_BY_ID[r.signal];
    if (!s) return '';
    var w = r.windowDays ? ' in the last ' + r.windowDays + ' days' : '';
    if (s.kind === 'bool') return s.label.toLowerCase();
    if (s.kind === 'pair') return r.value[0] + '+ hrs read in a week, or a ' + r.value[1] + '-day streak';
    var v = s.kind === 'count' ? (s.unit || '') : '';
    if (r.op === 'lte') return 'no more than ' + r.value + ' ' + v + w;
    if (r.op === 'eq') return 'exactly ' + r.value + ' ' + v + w;
    return r.value + '+ ' + v + w;
  }

  window.DroboardAudienceRules = {
    signals, signal, defaults, all, get, save, patch, add, reset, refresh,
    setReach,
    source: function () { return SOURCE; },
    syncedAt: function () { return SYNCED_AT; },
    retire: function (id) { return setRetired(id, true); },
    restore: function (id) { return setRetired(id, false); },
    describe,
  };
})();
