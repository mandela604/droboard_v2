/**
 * ad-revenue-service.js — Ad revenue tracking + author payout allocation.
 *
 * Single funnel: AdService.track() calls AdRevenue.record(payload) for every
 * impression/click. Money is booked only when the creative belongs to a
 * campaign; story-owned slots then split (platform 70% / author 30%), other
 * surfaces are 100% platform. House ads and network embeds count impressions
 * but book $0 — a network payout has no per-impression price, so it is
 * entered from the network's report (recordNetwork) and spread over the
 * impressions counted in that window.
 *
 * Story-owned slots (user decision):
 *   - in-chapter  (fullReader:per-300-words, scrollReader:per-300-words)
 *   - end-of-story (fullReader:bottom, scrollReader:bottom, bookReader:top)
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
 *   GET  /network                   → imported network reports
 *   POST /network                   { adId?, network?, from, to, amount,
 *                                     currency?, fxRate?, note? } → import row
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
     story (book page edge slot), comments (story comment slots). */
  var STORY_SLOT_RE = /^(fullReader|scrollReader|story|comments)[:.]/;

  /* Story → author registry (mirrors the marketing campaign library so
     payout pages and campaigns show the same names). */
  var STORIES = {
    'ST-001': { title: 'Bound by the Ruthless Alpha', authorId: 'au_1024', authorName: 'Chioma Okafor', cover: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg' },
    'ST-002': { title: "The CEO's Hidden Son",        authorId: 'au_2041', authorName: 'Luna Skye', cover: 'https://i.postimg.cc/23WvkFLH/images-(2).jpg' },
    'ST-003': { title: "Wolf King's Vow",             authorId: 'au_3099', authorName: 'Elena Vasquez', cover: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg' },
    'ST-004': { title: 'Betrayed by the Mafia Prince', authorId: 'au_4177', authorName: 'Marcus Webb Jr.', cover: 'https://i.postimg.cc/WF1j4Pnh/6.jpg' },
    'ST-005': { title: "The Duke's Secret",           authorId: 'au_5210', authorName: 'Isabelle Moreau', cover: 'https://i.postimg.cc/fkdXzjSj/wife.jpg' },
    'ST-006': { title: 'Revenge at the Ivy League',   authorId: 'au_6321', authorName: 'Wren Okonkwo', cover: 'https://i.postimg.cc/cgLZJNmC/8.jpg' },
    'ST-007': { title: 'The Runaway Bride in Socked Feet', authorId: 'au_7432', authorName: 'Ifeanyi_Story', cover: 'https://i.postimg.cc/tY7KnJyr/images.jpg' },
    'ST-008': { title: 'The Letter He Never Sent',    authorId: 'au_8543', authorName: 'Efe_O', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg' },
    /* Luna Vale — the demo author (author/earnings pages). Book ids match
       DemoData.AUTHOR_EARNINGS.byBook so ad share accumulates by book. */
    'b1': { title: 'Season of Betrayal', authorId: 'au_luna_vale', authorName: 'Luna Vale', cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg' },
    'b2': { title: 'Crowned in Sin',     authorId: 'au_luna_vale', authorName: 'Luna Vale', cover: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg' },
    'b3': { title: 'Until You Regret',   authorId: 'au_luna_vale', authorName: 'Luna Vale', cover: 'https://i.postimg.cc/DJwFzKgd/4.jpg' },
  };

  /* Author identity: real avatar + profile handle (avatars mirror the
     senior-editor AVATARS maps; Ifeanyi_Story / Efe_O are DemoData central
     profile keys, so their links resolve to real profiles). */
  var AUTHORS = {
    'au_1024':     { handle: 'chioma_okafor',  avatar: 'https://i.pravatar.cc/60?img=5' },
    'au_2041':     { handle: 'luna_skye',      avatar: 'https://i.pravatar.cc/60?img=24' },
    'au_3099':     { handle: 'elena_vasquez',  avatar: 'https://i.pravatar.cc/60?img=31' },
    'au_4177':     { handle: 'marcus_webb_jr', avatar: 'https://i.pravatar.cc/60?img=33' },
    'au_5210':     { handle: 'isabelle_moreau', avatar: 'https://i.pravatar.cc/60?img=44' },
    'au_6321':     { handle: 'wren_okonkwo',   avatar: 'https://i.pravatar.cc/60?img=41' },
    'au_7432':     { handle: 'Ifeanyi_Story',  avatar: 'https://i.pravatar.cc/100?img=53' },
    'au_8543':     { handle: 'Efe_O',          avatar: 'https://i.pravatar.cc/100?img=22' },
    'au_luna_vale': { handle: 'luna_vale',     avatar: 'https://i.pravatar.cc/100?img=26' },
  };
  function authorMeta(authorId, authorName) {
    var m = AUTHORS[authorId];
    if (m) return m;
    return {
      handle: String(authorName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
      avatar: '',
    };
  }

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

  /* ── Record one tracked event (called from AdService.track) ──
     Money only moves when a campaign bought the slot. House ads and network
     tags count impressions/clicks but book $0: a network payout arrives later
     as a report import (recordNetwork). */
  var OWNER = { at: 0, p: null, map: {} };
  function adOwners() {
    if (OWNER.map && Date.now() - OWNER.at < 60000) return Promise.resolve(OWNER.map);
    if (OWNER.p) return OWNER.p;
    OWNER.p = Promise.resolve()
      .then(function () {
        if (!window.MarketingData || typeof MarketingData.getAdInventory !== 'function') return null;
        return MarketingData.getAdInventory();
      })
      .then(function (inv) {
        var map = {};
        var pools = (inv && inv.pools) || {};
        Object.keys(pools).forEach(function (f) {
          (pools[f] || []).forEach(function (a) { if (a && a.id) map[String(a.id)] = { campaign: a.campaign || '', format: f }; });
        });
        OWNER = { at: Date.now(), p: null, map: map };
        return map;
      })
      .catch(function () { OWNER = { at: Date.now(), p: null, map: {} }; return OWNER.map; });
    return OWNER.p;
  }

  async function record(payload) {
    if (!payload || !payload.id) return;
    var own = (await adOwners())[String(payload.id)] || {};
    var billed = !!own.campaign;
    var network = own.format === 'embed';
    var rev = billed && !network ? eventRevenue(payload.event) : 0;
    var storyOwned = isStoryOwned(payload);
    var storyId = storyOwned ? String(payload.storyId) : '';
    var meta = storyOwned ? resolveStory(storyId) : null;
    var date = todayStr(payload.ts);
    var ctry = /^[A-Za-z]{2}$/.test(String(payload.country || '')) ? String(payload.country).toUpperCase() : '';
    var key = [date, storyId, payload.id, payload.slot || '', ctry].join('|');
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
        network: network,
        billed: billed,
        country: ctry,
        paidAt: null,
      };
      rows.push(row);
    }
    if (payload.event === 'click') row.clicks += 1;
    else row.impressions += 1;
    row.network = !!row.network || network;
    row.billed = !!row.billed || billed;
    if (rev) {
      row.revenue = round2(row.revenue + rev);
      if (storyOwned) {
        row.platformShare = round2(row.platformShare + rev * CONFIG.platformShare);
        row.authorShare = round2(row.authorShare + rev * CONFIG.authorShare);
      } else {
        row.platformShare = round2(row.platformShare + rev);
      }
    }
    writeLedger(rows);
  }

  /* ── network earnings import (demo parity with ad-revenue.service.js) ── */
  var NETWORK_KEY = 'dro_network_earnings_v1';

  function readNetwork() {
    try { return JSON.parse(localStorage.getItem(NETWORK_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function splitCents(totalUsd, weights) {
    var cents = Math.round(totalUsd * 100);
    var sum = weights.reduce(function (s, w) { return s + w; }, 0) || 1;
    var left = cents;
    return weights.map(function (w, i) {
      var c = i === weights.length - 1 ? left : Math.round(cents * (w / sum));
      left -= c;
      return c / 100;
    });
  }
  /* Spread one import over the rows it owns; blank country = "Others" (every
     tracked country no per-country import claimed). Returns rows paid. */
  function applyNetwork(rec) {
    var rows = readLedger();
    var others = readNetwork();
    rows.forEach(function (row) {
      if (row.networkEarningId === rec.id) { row.revenue = 0; row.platformShare = 0; row.authorShare = 0; row.networkEarningId = ''; }
    });
    var covered = {};
    others.forEach(function (n) {
      if (n.id === rec.id || !n.country) return;
      if ((n.adId || '') === rec.adId && n.from === rec.from && n.to === rec.to) covered[n.country] = true;
    });
    var mine = rows.filter(function (row) {
      if (!row.network || row.date < rec.from || row.date > rec.to) return false;
      if (rec.adId && String(row.adId) !== rec.adId) return false;
      var c = String(row.country || '');
      return rec.country ? c === rec.country : !covered[c];
    });
    if (!mine.length) {
      var k = [rec.to, '', rec.adId || 'network', 'network:report', rec.country || ''].join('|');
      var row = rows.filter(function (r) { return r._k === k; })[0];
      if (!row) {
        row = { _k: k, date: rec.to, storyId: '', storyTitle: '', authorId: '', authorName: '', adId: rec.adId || 'network', slot: 'network:report', page: '', impressions: 0, clicks: 0, revenue: 0, platformShare: 0, authorShare: 0, network: true, country: rec.country || '', paidAt: null };
        rows.push(row);
      }
      row.revenue = rec.amountUsd;
      row.platformShare = rec.amountUsd;
      row.authorShare = 0;
      row.networkEarningId = rec.id;
    } else {
      var weights = mine.map(function (r) { return Math.max(Number(r.impressions) || 0, 0); });
      if (!weights.some(function (w) { return w > 0; })) weights = weights.map(function () { return 1; });
      var parts = splitCents(rec.amountUsd, weights);
      mine.forEach(function (row, i) {
        var cut = parts[i];
        var owned = !!row.storyId && STORY_SLOT_RE.test(String(row.slot || ''));
        var author = owned ? round2(cut * CONFIG.authorShare) : 0;
        row.revenue = cut;
        row.platformShare = round2(cut - author);
        row.authorShare = author;
        row.networkEarningId = rec.id;
      });
    }
    writeLedger(rows);
    return mine.length;
  }
  async function recordNetwork(payload) {
    payload = payload || {};
    var total = Number(payload.amount);
    if (!(total > 0) || !payload.from || !payload.to || String(payload.from) > String(payload.to)) return null;
    var cur = String(payload.currency || 'USD').toUpperCase();
    var rate = cur === 'USD' ? 1 : Number(payload.fxRate);
    if (!(rate > 0)) return null;
    var totalUsd = round2(total * rate);
    var adId = String(payload.adId || '');
    var ctry = /^[A-Za-z]{2}$/.test(String(payload.country || '')) ? String(payload.country).toUpperCase() : '';

    try {
      var r = await callBackend('/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: adId || undefined, network: payload.network || '', country: ctry || undefined, from: payload.from, to: payload.to, amount: total, currency: cur, fxRate: cur === 'USD' ? undefined : rate, note: payload.note || '' }),
      });
      if (r && r.id) return r;
    } catch (e) {}

    var list = readNetwork();
    var prev = list.filter(function (n) { return (n.adId || '') === adId && n.from === payload.from && n.to === payload.to && (n.country || '') === ctry; })[0];
    var rec = {
      id: prev ? prev.id : 'nw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      adId: adId, network: String(payload.network || ''), country: ctry,
      from: payload.from, to: payload.to,
      amount: total, currency: cur, fxRate: rate, amountUsd: totalUsd,
      allocated: 0, note: String(payload.note || ''), enteredBy: '',
    };
    list = list.filter(function (n) {
      return n.id !== rec.id && !((n.adId || '') === adId && n.from === rec.from && n.to === rec.to && (n.country || '') === ctry);
    });
    list.unshift(rec);
    try { localStorage.setItem(NETWORK_KEY, JSON.stringify(list)); } catch (e) {}

    rec.allocated = applyNetwork(rec);
    try { localStorage.setItem(NETWORK_KEY, JSON.stringify(list)); } catch (e) {}

    if (ctry) {
      var rest = list.filter(function (n) { return !n.country && (n.adId || '') === adId && n.from === rec.from && n.to === rec.to; })[0];
      if (rest) {
        rest.allocated = applyNetwork(rest);
        try { localStorage.setItem(NETWORK_KEY, JSON.stringify(list)); } catch (e) {}
      }
    }
    return rec;
  }
  async function getNetworkImports() {
    try {
      var r = await callBackend('/network');
      if (r && Array.isArray(r.rows)) return r.rows;
    } catch (e) {}
    return readNetwork();
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
          paidRevenue: 0, networkRevenue: 0, paidImpressions: 0, networkImpressions: 0,
          storyId: '', storyTitle: '', authorId: '', authorName: '',
        };
      }
      g.impressions += r.impressions;
      g.clicks += r.clicks;
      g.revenue = round2(g.revenue + r.revenue);
      g.platformShare = round2(g.platformShare + r.platformShare);
      g.authorShare = round2(g.authorShare + r.authorShare);
      if (r.network) {
        g.networkRevenue = round2(g.networkRevenue + r.revenue);
        g.networkImpressions += r.impressions;
      } else if (r.billed || r.revenue > 0) {
        // legacy rows predate the billed flag; rate-card revenue was paid inventory
        g.paidRevenue = round2(g.paidRevenue + r.revenue);
        g.paidImpressions += r.impressions;
      }
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
    var stories = byStory(rows);
    var storyCountry = {};
    stories.forEach(function (g) {
      storyCountry[g.storyId] = groupBy(rows.filter(function (r) { return r.storyId === g.storyId; }), function (r) { return r.country || 'unknown'; });
    });
    return {
      totals: sumTotals(rows),
      bySurface: bySurface(rows),
      byStory: stories,
      byStoryCountry: storyCountry,
      byCountry: groupBy(rows, function (r) { return r.country || 'unknown'; }),
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
      { slot: 'bookReader:top', page: 'bookReader', w: 1 },
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
    /* Demo has no edge, so countries are a deterministic synthetic spread —
       roughly the CPM ladder (US/GB/CA/AU high, NG/IN/BR low). Live rows get
       CF-IPCountry from Cloudflare instead. */
    var ctryPool = ['US', 'US', 'US', 'US', 'US', 'GB', 'GB', 'CA', 'AU', 'NG', 'NG', 'IN', 'DE', 'BR'];
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
            country: ctryPool[Math.floor(rand() * ctryPool.length)],
            billed: true,
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
          platformShare: revenue, authorShare: 0,
          country: ctryPool[Math.floor(rand() * ctryPool.length)],
          billed: true, paidAt: null,
        });
      });
    }
    writeLedger(rows);
  }

  /* Seeded demo rows carry a synthetic country spread (see ctryPool). Rows
     created later by demo tracking have no edge behind them, so they fall back
     to the browser's region — the same weak fallback we'd use live when
     CF-IPCountry is missing. */
  function browserCountry() {
    try {
      var m = String(navigator.language || '').match(/-([A-Za-z]{2})$/);
      if (m) return m[1].toUpperCase();
    } catch (e) {}
    return '';
  }
  function stampDemoCountry() {
    var c = browserCountry();
    if (!c) return;
    var rows = readLedger();
    var touched = 0;
    rows.forEach(function (r) { if (!r.country) { r.country = c; touched++; } });
    if (touched) writeLedger(rows);
  }

  /* ── Surface label helpers for UIs ── */
  var SURFACE_LABELS = {
    'story:fullReader': 'Story · Full Reader',
    'story:scrollReader': 'Story · Scroll Reader',
    'story:comments': 'Story · Comments',
    'story:story': 'Story · Bridge Page',
    home: 'Home Feed', discover: 'Discover', feed: 'Feed',
    bookReader: 'Book Reader',
    genreHub: 'Genre Hub', library: 'Library', search: 'Search',
    droboardPage: 'DroBoard Page', overlayBrowse: 'Browse Overlay',
    comments: 'Comments', profile: 'Profile', debate: 'Debate',
    status: 'Status Viewer', genreStories: 'Genre Stories',
    leaderboard: 'Leaderboard', blog: 'Blog', notifications: 'Notifications', store: 'Store',
  };
  function surfaceLabel(key) { return SURFACE_LABELS[key] || key; }

  seedIfEmpty();
  stampDemoCountry();

  window.AdRevenue = {
    __ready: true,
    CONFIG: CONFIG,
    isStoryOwned: isStoryOwned,
    record: record,
    getLedger: getLedger,
    getSummary: getSummary,
    markAuthorPaid: markAuthorPaid,
    isAuthorPaid: isAuthorPaid,
    recordNetwork: recordNetwork,
    getNetworkImports: getNetworkImports,
    surfaceLabel: surfaceLabel,
    authorMeta: authorMeta,
    storyCover: function (id) { var s = STORIES[String(id || '')]; return s && s.cover ? s.cover : ''; },
    STORIES: STORIES,
  };
})();
