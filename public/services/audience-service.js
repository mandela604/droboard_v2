/* ═══════════════════════════════════════════════════════════════
   AUDIENCE SERVICE — window.DroboardAudience
   Resolves which behavior segments the current device matches from data
   the app already tracks:
     dro_league_activity · dro_following · dro_finance_subs · dro_premium
     droboard_user / droboard_session · dro_writer_flow · dro_refer_stats_v2_*
     AdService.readStats() clicks · first/last seen stamps

   The segment definitions themselves are the editable catalog in
   services/audience-rules.js — this file only computes the reader's
   signals and evaluates them. Live swap: hydrate signals() from
   GET /api/audience/me (same keys) instead of localStorage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ls(key, fb) {
    try {
      var v = localStorage.getItem(key);
      if (v == null) return fb;
      return JSON.parse(v);
    } catch (e) { return fb; }
  }
  function num(key) { return +ls(key, 0) || 0; }

  /* The catalog is one shared, editable list (services/audience-rules.js),
     loaded before this file on every page that matches readers. */
  function segmentsCatalog() {
    try { return (window.DroboardAudienceRules && DroboardAudienceRules.all()) || []; } catch (e) { return []; }
  }
  function segment(id) {
    try { return DroboardAudienceRules.get(id) || null; } catch (e) { return null; }
  }

  function currentUser() {
    try {
      if (window.AuthSession && typeof AuthSession.getSync === 'function') return AuthSession.getSync() || {};
    } catch (e) {}
    if (window.DroboardUser) return window.DroboardUser;
    return ls('droboard_user', {}) || {};
  }

  function leagueTotals() {
    var all = ls('dro_league_activity', {}) || {};
    var out = { chapter: 0, hour: 0, reaction: 0, comment: 0, reply: 0, debate: 0, win: 0, streak: 0 };
    Object.keys(all).forEach(function (season) {
      var row = all[season] || {};
      Object.keys(out).forEach(function (k) { out[k] += +row[k] || 0; });
    });
    return out;
  }

  function adClicks() {
    try {
      var stats = window.AdService && AdService.readStats ? AdService.readStats() : {};
      return Object.keys(stats).reduce(function (n, id) { return n + (+stats[id].clicks || 0); }, 0);
    } catch (e) { return 0; }
  }

  function referralCount() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i) || '';
        if (k.indexOf('dro_refer_stats_v2_') !== 0) continue;
        var s = ls(k, {}) || {};
        n += +s.converted || +s.completed || 0;
      }
    } catch (e) {}
    return n;
  }

  function hasRole(role) {
    var u = currentUser();
    var roles = [u.role, u.primaryRole].concat(Array.isArray(u.roles) ? u.roles : []);
    return roles.some(function (r) { return String(r || '').toLowerCase() === role; });
  }

  /* Keep the previous visit stamp for win-back, then refresh it. */
  var _prevActive = 0;
  (function touchActivity() {
    var now = Date.now();
    try {
      _prevActive = +localStorage.getItem('dro_last_active') || now;
      if (!localStorage.getItem('dro_first_seen')) localStorage.setItem('dro_first_seen', String(now));
      localStorage.setItem('dro_last_active', String(now));
    } catch (e) {}
  })();

  function signals() {
    var act = leagueTotals();
    var u = currentUser();
    var follows = ls('dro_following', []);
    var subs = ls('dro_finance_subs', []);
    var premium = ls('dro_premium', false);
    var firstSeen = +ls('dro_first_seen', 0) || Date.now();
    var lastSeen = _prevActive || +ls('dro_last_active', 0) || Date.now();
    var now = Date.now();
    return {
      reactions: act.reaction || 0,
      comments: (act.comment || 0) + (act.reply || 0),
      shares: num('dro_shares_sent'),
      saves: num('dro_saves_count'),
      chapters_unlocked: act.chapter || 0,
      tip_sent: num('dro_tips_sent'),
      coin_purchase: num('dro_coin_purchases'),
      subscription_active: !!(premium || (Array.isArray(subs) && subs.length)),
      following_count: Array.isArray(follows) ? follows.length : 0,
      weekly_hours_or_streak: [act.hour || 0, act.streak || 0],
      books_finished: num('dro_books_finished'),
      referrals_converted: referralCount(),
      ad_click: adClicks(),
      days_since_active: Math.max(0, Math.floor((now - lastSeen) / 864e5)),
      account_age_days: Math.max(0, Math.floor((now - (+u.createdAt || +u.joinedAt || firstSeen)) / 864e5)),
      had_subscription: !!(premium || (Array.isArray(subs) && subs.length) || u.subscribedBefore === true),
      is_writer: hasRole('writer') || hasRole('author') || !!ls('dro_writer_flow', null),
    };
  }

  function compare(value, rule) {
    if (!rule) return true;
    var op = rule.op || 'gte';
    if (op === 'any') {
      var vals = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (Array.isArray(value)) return value.some(function (n) { return vals.some(function (v) { return +n >= +v; }); });
      return vals.some(function (v) { return +value >= +v; });
    }
    if (op === 'eq') return typeof rule.value === 'boolean' ? value === rule.value : String(value) === String(rule.value);
    if (op === 'gte') return +value >= +rule.value;
    if (op === 'lte') return +value <= +rule.value;
    return true;
  }

  /* A missing signal reads as zero, not as "unknown" — that way raising a
     threshold can never accidentally switch a segment off for a reader we
     simply have no counter for yet. */
  function matchesRule(rule, sig) {
    if (!rule || !rule.signal) return false;
    var value = (sig || {})[rule.signal];
    if (value == null) value = 0;
    if (value === false && rule.value === false && rule.op === 'eq') return true;
    return compare(value, rule);
  }

  function matchesSegment(idOrRule, sig) {
    var rule = (idOrRule && idOrRule.signal) ? idOrRule : (segment(idOrRule) || {}).rule;
    if (!rule) return false;
    return matchesRule(rule, sig || signals());
  }

  /* Live path: GET /api/users/me/audience counts this reader's real events
     and answers with the segment ids they belong to. Prefer it whenever it
     has answered — the device counters below have no timestamps, so they
     cannot honour a rule's window ("50+ reactions in the last 30 days") and
     quietly read as all-time. Cached so a page load never waits on it;
     logged out, offline or un-deployed, matching falls back to local. */
  var ME_KEY = 'dro_audience_me';
  var ME_TTL = 6 * 3600e3;
  var _server = null;
  (function readMe() {
    try {
      var c = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
      if (c && Array.isArray(c.segments) && Date.now() - (+c.at || 0) < ME_TTL) _server = c.segments;
    } catch (e) {}
  })();
  function fetchMe() {
    var u = currentUser();
    if (!u || !u.id) return;
    try {
      fetch('/api/users/me/audience', { credentials: 'include' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (d) {
        if (!d || !Array.isArray(d.segments)) return;
        _server = d.segments;
        try { localStorage.setItem(ME_KEY, JSON.stringify({ segments: d.segments, at: Date.now() })); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }
  fetchMe();

  /* ids: segment ids from the creative/placement · mode: any | all */
  function matches(ids, mode, sig) {
    if (!Array.isArray(ids) || !ids.length) return true;
    if (_server) {
      var inSet = function (id) { return _server.indexOf(id) !== -1; };
      return mode === 'all' ? ids.every(inSet) : ids.some(inSet);
    }
    sig = sig || signals();
    var test = function (id) { return matchesSegment(id, sig); };
    return mode === 'all' ? ids.every(test) : ids.some(test);
  }

  function matchedIds() {
    if (_server) return _server.slice();
    var sig = signals();
    return segmentsCatalog().filter(function (s) { return matchesSegment(s.id, sig); })
      .map(function (s) { return s.id; });
  }

  /* Pull the stored catalog once per load so a marketing edit lands on the
     next page view rather than the next deploy. Nothing awaits it — this
     page's own matching may use the previous copy, which is the same
     behaviour as the ad inventory cache. */
  try { if (window.DroboardAudienceRules) DroboardAudienceRules.refresh(); } catch (e) {}

  window.DroboardAudience = {
    signals: signals,
    matches: matches,
    matchesRule: matchesRule,
    matchesSegment: matchesSegment,
    matchedIds: matchedIds,
    segment: segment,
    fromServer: function () { return !!_server; },
    refresh: fetchMe,
  };
})();
