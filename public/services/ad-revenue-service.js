/**
 * ad-revenue-service.js — Ad revenue tracking + author payout allocation.
 *
 * Single funnel: AdService.track() calls AdRevenue.record(payload) for every
 * impression/click. Story-owned slots are split (platform 70% / author 30%);
 * all other surfaces are 100% platform.
 *
 * Story-owned slots (user decision):
 *   - in-chapter  (fullReader:per-300-words, scrollReader:per-300-words)
 *   - end-of-story (fullReader:bottom, scrollReader:bottom, series:top)
 *   - story comments (comments:*)
 * Everything else (home, discover, feed, search, hub, library, browse
 * overlay, profile, droboardPage, debate, …) → 100% platform.
 *
 * Rule: a payload is story-owned iff storyId is present AND the slot matches
 * STORY_SLOT_RE. comment-section already passes storyId via DroboardAdSlot
 * mount ctx, so story comments are covered automatically.
 *
 * Backend-ready: set USE_API=true and implement the endpoints documented
 * below. Demo path aggregates a localStorage ledger, seeded on first use so
 * super-admin/marketing pages are never empty.
 *
 * BACKEND CONTRACT
 * ────────────────
 * Collections:
 *   ad_revenue_ledger { _id, date:'YYYY-MM-DD', storyId, storyTitle, authorId,
 *                       authorName, adId, slot, page, impressions, clicks,
 *                       revenue, platformShare, authorShare, paidAt? }
 *     - one row per (date, storyId, adId, slot); record() upserts.
 *   ad_revenue_config { _id:'ad_split', platformShare:0.70, authorShare:0.30,
 *                       rates:{ impression:0.005, click:0.35 } }
 * Endpoints (API_BASE = '/api/super-admin/ad-revenue'):
 *   GET  /ledger?from=&to=          → ledger rows desc
 *   GET  /summary?days=30           → { totals, bySurface, byStory, byAuthor }
 *   POST /pay                       { authorId } → marks author rows paid
 */
(function () {
  'use strict';
  if (window.AdRevenue && window.AdRevenue.__ready) return;

  var USE_API = false;
  var API_BASE = '/api/super-admin/ad-revenue';
  var TIMEOUT_MS = 2500;

  /* ── Config (author decision: 70/30 platform/author) ── */
  var CONFIG = {
    platformShare: 0.70,
    authorShare: 0.30,
    /* Blended demo rates — $5 eCPM impressions, $0.35 CPC. Swap for the
       real yield feed at go-live. */
    rates: { impression: 0.005, click: 0.35 },
  };

  /* Story-owned slot namespaces: fullReader, scrollReader (both readers),
     series (book page edge slot), comments (story comment slots). */
  var STORY_SLOT_RE = /^(fullReader|scrollReader|series|comments)[:.]/;

  /* Story → author registry (mirrors the marketing campaign library so
     payout pages and campaigns show the same names). */
  var STORIES = {
    'ST-001': { title: 'Bound by the Ruthless Alpha', authorId: 'au_1024', authorName: 'Chioma Okafor' },
    'ST-002': { title: "The CEO's Hidden Son",        authorId: 'au_2041', authorName: 'Luna Skye' },
    'ST-003': { title: "Wolf King's Vow",             authorId: 'au_3099', authorName: 'Elena Vasquez' },
    'ST-004': { title: 'Betrayed by the Mafia Prince', authorId: 'au_4177', authorName: 'Marcus Webb Jr.' },
    'ST-005': { title: "The Duke's Secret",           authorId: 'au_5210', authorName: 'Isabelle Moreau' },
    'ST-006': { title: 'Revenge at the Ivy League',   authorId: 'au_6321', authorName: 'Wren Okonkwo' },
    'ST-007': { title: 'The Runaway Bride in Socked Feet', authorId: 'au_7432', authorName: 'Ifeanyi_Story' },
    'ST-008': { title: 'The Letter He Never Sent',    authorId: 'au_8543', authorName: 'Efe_O' },
    /* Luna Vale — the demo author (author/earnings pages). Book ids match
       DemoData.AUTHOR_EARNINGS.byBook so ad share accumulates by book. */
    'b1': { title: 'Season of Betrayal', authorId: 'au_luna_vale', authorName: 'Luna Vale' },
    'b2': { title: 'Crowned in Sin',     authorId: 'au_luna_vale', authorName: 'Luna Vale' },
    'b3': { title: 'Until You Regret',   authorId: 'au_luna_vale', authorName: 'Luna Vale' },
  };

  var LEDGER_KEY = 'dro_ad_revenue_ledger_v2';
  var PAID_KEY = 'dro_ad_revenue_paid_v1';

  function timeoutFetch(url, opts) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
    return fetch(url, Object.assign({ signal: c.signal }, opts || {}))
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); throw e; });
  }
  async function callBackend(path, options) {
    if (!USE_API) return null;
    return timeoutFetch(API_BASE + path, options);
  }

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function todayStr(ts) {
    var d = ts ? new Date(ts) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ── Ledger storage ── */
  function readLedger() {
    try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function writeLedger(rows) {
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(rows)); } catch (e) {}
  }
  function readPaid() {
    try { return JSON.parse(localStorage.getItem(PAID_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writePaid(map) {
    try { localStorage.setItem(PAID_KEY, JSON.stringify(map)); } catch (e) {}
  }

  /* ── Classification ── */
  function isStoryOwned(payload) {
    if (!payload) return false;
    if (!payload.storyId) return false;
    var slot = payload.slot || '';
    return STORY_SLOT_RE.test(slot);
  }
  function resolveStory(storyId) {
    return STORIES[storyId] || { title: 'Unknown story', authorId: 'unknown', authorName: 'Unknown author' };
  }
  function eventRevenue(event) {
    if (event === 'click') return CONFIG.rates.click;
    if (event === 'impression') return CONFIG.rates.impression;
    return 0; /* like/other events carry no payout */
  }

  /* ── Record one tracked event (called from AdService.track) ── */
  function record(payload) {
    if (!payload || !payload.id) return;
    var rev = eventRevenue(payload.event);
    if (!rev) return;
    var storyOwned = isStoryOwned(payload);
    var storyId = storyOwned ? String(payload.storyId) : '';
    var meta = storyOwned ? resolveStory(storyId) : null;
    var date = todayStr(payload.ts);
    var key = [date, storyId, payload.id, payload.slot || ''].join('|');
    var rows = readLedger();
    var row = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i]._k === key) { row = rows[i]; break; } }
    if (!row) {
      row = {
        _k: key,
        date: date,
        storyId: storyId,
        storyTitle: meta ? meta.title : '',
        authorId: meta ? meta.authorId : '',
        authorName: meta ? meta.authorName : '',
        adId: payload.id,
        slot: payload.slot || '',
        page: payload.page || '',
        impressions: 0,
        clicks: 0,
        revenue: 0,
        platformShare: 0,
        authorShare: 0,
        paidAt: null,
      };
      rows.push(row);
    }
    if (payload.event === 'click') row.clicks += 1;
    else row.impressions += 1;
    row.revenue = round2(row.revenue + rev);
    row.platformShare = round2(storyOwned ? rev * CONFIG.platformShare : rev);
    row.authorShare = round2(storyOwned ? rev * CONFIG.authorShare : 0);
    writeLedger(rows);
  }

  /* ── Aggregation (works on ledger rows; USE_API fetches /summary) ── */
  function cutoffDays(days) {
    if (!days) return null;
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return todayStr(d.getTime());
  }
  function filterRows(rows, days) {
    var cut = cutoffDays(days);
    if (!cut) return rows;
    var paid = readPaid();
    return rows.filter(function (r) {
      if (r.date < cut) return false;
      return true;
    }).map(function (r) {
      var out = Object.assign({}, r);
      out.paid = !!(out.authorId && paid[out.authorId] && out.date <= paid[out.authorId]);
      return out;
    });
  }
  function sumTotals(rows) {
    var t = { impressions: 0, clicks: 0, revenue: 0, platformShare: 0, authorShare: 0, authorShareUnpaid: 0 };
    var paid = readPaid();
    rows.forEach(function (r) {
      t.impressions += r.impressions;
      t.clicks += r.clicks;
      t.revenue = round2(t.revenue + r.revenue);
      t.platformShare = round2(t.platformShare + r.platformShare);
      t.authorShare = round2(t.authorShare + r.authorShare);
      var isPaid = !!(r.authorId && paid[r.authorId] && r.date <= paid[r.authorId]);
      if (!isPaid) t.authorShareUnpaid = round2(t.authorShareUnpaid + r.authorShare);
    });
    return t;
  }
  function groupBy(rows, keyFn) {
    var map = {};
    rows.forEach(function (r) {
      var k = keyFn(r);
      if (!k) return;
      var g = map[k];
      if (!g) {
        g = map[k] = {
          key: k,
          label: k,
          impressions: 0, clicks: 0, revenue: 0,
          platformShare: 0, authorShare: 0,
          storyId: '', storyTitle: '', authorId: '', authorName: '',
        };
      }
      g.impressions += r.impressions;
      g.clicks += r.clicks;
      g.revenue = round2(g.revenue + r.revenue);
      g.platformShare = round2(g.platformShare + r.platformShare);
      g.authorShare = round2(g.authorShare + r.authorShare);
      if (r.storyId) { g.storyId = r.storyId; g.storyTitle = r.storyTitle; }
      if (r.authorId) { g.authorId = r.authorId; g.authorName = r.authorName; }
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });
  }
  function bySurface(rows) {
    return groupBy(rows, function (r) { return r.storyId ? 'story:' + (r.slot.split(':')[0] || r.slot) : (r.page || r.slot || 'other'); });
  }
  function byStory(rows) {
    return groupBy(rows, function (r) { return r.storyId || ''; }).filter(function (g) { return !!g.storyId; });
  }
  function byAuthor(rows) {
    var paid = readPaid();
    return groupBy(rows, function (r) { return r.authorId || ''; }).filter(function (g) { return !!g.authorId; })
      .map(function (g) {
        g.paid = !!(paid[g.authorId] && rows.every(function (r) { return r.authorId !== g.authorId || r.date <= paid[g.authorId]; }));
        g.unpaid = g.paid ? 0 : g.authorShare;
        return g;
      });
  }

  /* ── Public async API (backend-first, demo fallback) ── */
  async function getLedger(days) {
    try {
      var r = await callBackend('/ledger' + (days ? '?days=' + days : ''));
      if (r && Array.isArray(r.rows)) return r.rows;
    } catch (e) {}
    return filterRows(readLedger(), days);
  }
  async function getSummary(days) {
    try {
      var s = await callBackend('/summary?days=' + (days || 30));
      if (s && s.totals) return s;
    } catch (e) {}
    var rows = filterRows(readLedger(), days || 30);
    var paid = readPaid();
    return {
      totals: sumTotals(rows),
      bySurface: bySurface(rows),
      byStory: byStory(rows),
      byAuthor: byAuthor(rows).map(function (g) {
        g.paid = !!(paid[g.authorId] && rows.every(function (r) { return r.authorId !== g.authorId || r.date <= paid[g.authorId]; }));
        return g;
      }),
      days: days || 30,
    };
  }
  async function markAuthorPaid(authorId) {
    if (!authorId) return false;
    try {
      var r = await callBackend('/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: authorId }),
      });
      if (r && r.ok) return true;
    } catch (e) {}
    var paid = readPaid();
    paid[authorId] = todayStr(Date.now());
    writePaid(paid);
    return true;
  }
  function isAuthorPaid(authorId, upToDays) {
    var paid = readPaid();
    if (!paid[authorId]) return false;
    var rows = filterRows(readLedger(), upToDays).filter(function (r) { return r.authorId === authorId; });
    return rows.every(function (r) { return r.date <= paid[authorId]; });
  }

  /* ── Deterministic demo seed (30 days × stories + platform surfaces) ── */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedIfEmpty() {
    try {
      if (localStorage.getItem(LEDGER_KEY)) return;
    } catch (e) { return; }
    var rand = mulberry32(20261020);
    var rows = [];
    var storyIds = Object.keys(STORIES);
    var storySlots = [
      { slot: 'fullReader:per-300-words', page: 'full-reader', w: 5 },
      { slot: 'fullReader:top', page: 'full-reader', w: 2 },
      { slot: 'fullReader:bottom', page: 'full-reader', w: 2 },
      { slot: 'scrollReader:per-300-words', page: 'scroll-reader', w: 4 },
      { slot: 'comments:inline', page: 'comments', w: 2 },
      { slot: 'series:top', page: 'series', w: 1 },
    ];
    var platformSlots = [
      { slot: 'home:swipe-card', page: 'home', adId: 'ad_home_hero', w: 3 },
      { slot: 'discover:platform', page: 'discover', adId: 'ad_disc_platform', w: 3 },
      { slot: 'discover:book', page: 'discover', adId: 'ad_disc_book', w: 2 },
      { slot: 'feed:in-feed', page: 'feed', adId: 'ad_feed_native', w: 3 },
      { slot: 'genreHub:in-feed', page: 'genreHub', adId: 'ad_hub_native', w: 2 },
      { slot: 'library:in-feed', page: 'library', adId: 'ad_lib_banner', w: 2 },
      { slot: 'droboardPage:sponsored', page: 'droboardPage', adId: 'ad_drb_sponsored', w: 2 },
    ];
    var adPool = ['ad_luxe_01', 'ad_wolf_02', 'ad_ceo_03', 'ad_mafia_04', 'ad_campus_05', 'ad_herbal_06'];
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    for (var d = 29; d >= 0; d--) {
      var day = new Date(now.getTime());
      day.setDate(day.getDate() - d);
      var date = todayStr(day.getTime());
      var dow = day.getDay();
      var dayBoost = (dow === 0 || dow === 6) ? 1.35 : 1;
      /* story-owned rows */
      storyIds.forEach(function (sid, si) {
        storySlots.forEach(function (sl) {
          if (rand() > 0.55) return;
          var base = (18 + Math.floor(rand() * 90)) * sl.w * dayBoost * (1 - si * 0.05);
          var impressions = Math.max(3, Math.floor(base));
          var clicks = Math.max(0, Math.floor(impressions * (0.008 + rand() * 0.03)));
          var adId = adPool[Math.floor(rand() * adPool.length)];
          var revenue = round2(impressions * CONFIG.rates.impression + clicks * CONFIG.rates.click);
          var meta = STORIES[sid];
          rows.push({
            _k: [date, sid, adId, sl.slot].join('|'),
            date: date, storyId: sid, storyTitle: meta.title,
            authorId: meta.authorId, authorName: meta.authorName,
            adId: adId, slot: sl.slot, page: sl.page,
            impressions: impressions, clicks: clicks, revenue: revenue,
            platformShare: round2(revenue * CONFIG.platformShare),
            authorShare: round2(revenue * CONFIG.authorShare),
            paidAt: null,
          });
        });
      });
      /* platform rows */
      platformSlots.forEach(function (sl) {
        if (rand() > 0.7) return;
        var impressions = Math.max(5, Math.floor((40 + rand() * 220) * sl.w * 0.3 * dayBoost));
        var clicks = Math.max(0, Math.floor(impressions * (0.004 + rand() * 0.02)));
        var revenue = round2(impressions * CONFIG.rates.impression + clicks * CONFIG.rates.click);
        rows.push({
          _k: [date, '', sl.adId, sl.slot].join('|'),
          date: date, storyId: '', storyTitle: '', authorId: '', authorName: '',
          adId: sl.adId, slot: sl.slot, page: sl.page,
          impressions: impressions, clicks: clicks, revenue: revenue,
          platformShare: revenue, authorShare: 0, paidAt: null,
        });
      });
    }
    writeLedger(rows);
  }

  /* ── Surface label helpers for UIs ── */
  var SURFACE_LABELS = {
    'story:fullReader': 'Story · Full Reader',
    'story:scrollReader': 'Story · Scroll Reader',
    'story:comments': 'Story · Comments',
    'story:series': 'Story · Series Page',
    home: 'Home Feed', discover: 'Discover', feed: 'Feed',
    genreHub: 'Genre Hub', library: 'Library', search: 'Search',
    droboardPage: 'DroBoard Page', overlayBrowse: 'Browse Overlay',
    comments: 'Comments', profile: 'Profile', debate: 'Debate',
  };
  function surfaceLabel(key) { return SURFACE_LABELS[key] || key; }

  seedIfEmpty();

  window.AdRevenue = {
    __ready: true,
    CONFIG: CONFIG,
    isStoryOwned: isStoryOwned,
    record: record,
    getLedger: getLedger,
    getSummary: getSummary,
    markAuthorPaid: markAuthorPaid,
    isAuthorPaid: isAuthorPaid,
    surfaceLabel: surfaceLabel,
    STORIES: STORIES,
  };
})();
