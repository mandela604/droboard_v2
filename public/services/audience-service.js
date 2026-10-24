/* ═══════════════════════════════════════════════════════════════
   AUDIENCE SERVICE — window.DroboardAudience
   Resolves which behavior segments (AdSetupData.SEGMENTS) the current
   device matches from data the app already tracks:
     dro_league_activity · dro_following · dro_finance_subs · dro_premium
     droboard_user / droboard_session · dro_writer_flow · dro_refer_stats_v2_*
     AdService.readStats() clicks · first/last seen stamps

   The same rules the marketing Audience step writes are evaluated here,
   so a targeted ad only serves to matching readers. Live swap: hydrate
   signals() from GET /api/audience/me (same keys) instead of localStorage.
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

  function segmentsCatalog() {
    try { return (window.AdSetupData && AdSetupData.SEGMENTS) || []; } catch (e) { return []; }
  }
  /* Client pages don't load the marketing catalog, so rules ship here too.
     Keep ids in sync with marketing/shared/ad-setup-data.js. */
  var FALLBACK_RULES = {
    'top-tippers': { signal: 'tip_sent', op: 'gte', value: 1 },
    'super-reactors': { signal: 'reactions', op: 'gte', value: 50 },
    'commentators': { signal: 'comments', op: 'gte', value: 10 },
    'sharers': { signal: 'shares', op: 'gte', value: 3 },
    'savers': { signal: 'saves', op: 'gte', value: 20 },
    'unlockers': { signal: 'chapters_unlocked', op: 'gte', value: 3 },
    'coin-buyers': { signal: 'coin_purchase', op: 'gte', value: 1 },
    'premium': { signal: 'subscription_active', op: 'eq', value: true },
    'power-followers': { signal: 'following_count', op: 'gte', value: 25 },
    'binge-readers': { signal: 'weekly_hours_or_streak', op: 'any', value: [5, 10] },
    'finishers': { signal: 'books_finished', op: 'gte', value: 3 },
    'referrers': { signal: 'referrals_converted', op: 'gte', value: 1 },
    'ad-responders': { signal: 'ad_click', op: 'gte', value: 1 },
    'winback': { signal: 'days_since_active', op: 'gte', value: 30 },
    'newcomers': { signal: 'account_age_days', op: 'lte', value: 14 },
    'lapsed-subscribers': { signal: 'had_subscription', op: 'eq', value: true },
    'writers': { signal: 'is_writer', op: 'eq', value: true },
  };
  function segment(id) {
    var all = segmentsCatalog();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return FALLBACK_RULES[id] ? { id: id, rule: FALLBACK_RULES[id] } : null;
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

  function matchesSegment(id, sig) {
    var seg = segment(id);
    if (!seg || !seg.rule) return false;
    sig = sig || signals();
    var value = sig[seg.rule.signal];
    if (value == null || value === false) {
      if (seg.rule.op === 'eq' && seg.rule.value === false) return true;
      return false;
    }
    return compare(value, seg.rule);
  }

  /* ids: segment ids from the creative/placement · mode: any | all */
  function matches(ids, mode, sig) {
    if (!Array.isArray(ids) || !ids.length) return true;
    sig = sig || signals();
    var test = function (id) { return matchesSegment(id, sig); };
    return mode === 'all' ? ids.every(test) : ids.some(test);
  }

  function matchedIds() {
    var sig = signals();
    return segmentsCatalog().filter(function (s) { return matchesSegment(s.id, sig); })
      .map(function (s) { return s.id; });
  }

  window.DroboardAudience = {
    signals: signals,
    matches: matches,
    matchesSegment: matchesSegment,
    matchedIds: matchedIds,
    segment: segment,
  };
})();
