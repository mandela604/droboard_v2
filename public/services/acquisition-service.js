/**
 * acquisition-service.js — Paid-acquisition attribution & campaign P&L.
 * ─────────────────────────────────────────────────────────────────────────
 * Answers the five questions that GA4/Meta can't:
 *   A. How much did we spend?          (manual spend ledger)
 *   B. How many readers did we get?    (visitors, signups, first/meaningful readers)
 *   C. Do they return?                 (D1/D7/D30 cohort retention per campaign)
 *   D. Ad revenue they generated       (campaign-level estimate from our own ledger)
 *   E. Did they buy coins?             (attributed purchases → platform contribution)
 *
 * Live path: UTM capture on landing (utm_source/medium/campaign/content),
 * events keyed to the shared dro_viewer_id (same id AdService uses).
 * Seed path: deterministic 30-day demo cohorts so the dashboard works
 * before the first real campaign.
 *
 * Platform contribution = coinRevenue × (1 − writerShare) × (1 − feeRate)
 *                         + adEarningsEstimate − spend
 * (Never treat gross coin spend as profit — writer obligations + PSP fees.)
 *
 * Backend-ready: USE_API + endpoints below.
 *   GET  /api/acquisition/summary?days=30
 *   GET  /api/acquisition/spend
 *   POST /api/acquisition/spend   { date, campaignId, amount, note }
 *   POST /api/acquisition/events  { type, visitorId, campaignId, meta }
 */
(function () {
  'use strict';
  if (window.Acquisition && window.Acquisition.__ready) return;

  var USE_API = false;
  var API_BASE = '/api/acquisition';

  /* ── Config ── */
  var CONFIG = {
    writerShare: 0.40,      // writer obligation on coin revenue (matches Revenue Splits demo)
    paymentFee: 0.014,      // PSP take rate (Flutterwave-class)
    adECPM: 0.005,          // $ per impression — blended, mirrors AdRevenue demo rate
  };

  /* Campaign registry — stored, fully editable from the Acquisition page.
     Landing is NOT hardcoded: pick any page below, a specific story, or a
     custom path. Add/edit/delete campaigns in the dashboard. */
  var CAMPAIGNS_KEY = 'dro_acq_campaigns_v1';
  /* Catalog of pages an ad may land on. destination drives the chip +
     default landing path; 'story' additionally takes a storyId. */
  var LANDING_PAGES = [
    { key: 'home',      label: 'Home (app intro / bridge)', landing: 'Pages/index.html' },
    { key: 'discover',  label: 'Discover',                  landing: 'Pages/discover.html' },
    { key: 'feed',      label: 'Feed (social)',             landing: 'Pages/feed.html' },
    { key: 'genreHub',  label: 'Genre Hub',                 landing: 'Pages/genre-hub.html' },
    { key: 'library',   label: 'Library',                   landing: 'Pages/library.html' },
    { key: 'droboard',  label: 'DroBoard Page',             landing: 'Pages/droboard-page.html' },
    { key: 'story',     label: 'A specific story (reader)', landing: 'Pages/full-reader.html' },
    { key: 'custom',    label: 'Custom path…',              landing: '' },
  ];
  function landingCatalog() { return LANDING_PAGES.slice(); }
  function landingFor(dest, storyId) {
    for (var i = 0; i < LANDING_PAGES.length; i++) {
      if (LANDING_PAGES[i].key === dest) {
        if (dest === 'story') return 'Pages/full-reader.html' + (storyId ? '?story=' + encodeURIComponent(storyId) : '');
        if (dest === 'custom') return '';
        return LANDING_PAGES[i].landing;
      }
    }
    return 'Pages/index.html';
  }
  var DEFAULT_CAMPAIGNS = [
    { id: 'story_romance', label: 'Romance Story Push', destination: 'story',   storyId: 'ST-001', landing: 'Pages/full-reader.html?story=ST-001', source: 'facebook', utmCampaign: 'romance_launch' },
    { id: 'story_fantasy', label: 'Fantasy Story Push', destination: 'story',   storyId: 'ST-003', landing: 'Pages/full-reader.html?story=ST-003', source: 'facebook', utmCampaign: 'fantasy_launch' },
    { id: 'discover_push', label: 'Discover Push',      destination: 'discover', storyId: '',      landing: 'Pages/discover.html',                 source: 'facebook', utmCampaign: 'discover_launch' },
    { id: 'bridge_intro',  label: 'Bridge Page Test',   destination: 'home',     storyId: '',      landing: 'Pages/index.html',                    source: 'facebook', utmCampaign: 'bridge_launch' },
  ];

  function getCampaigns() {
    var rows = read(CAMPAIGNS_KEY, null);
    if (rows && rows.length) return rows;
    write(CAMPAIGNS_KEY, DEFAULT_CAMPAIGNS);
    return DEFAULT_CAMPAIGNS.slice();
  }
  function saveCampaigns(rows) { write(CAMPAIGNS_KEY, rows); }
  function slugify(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'campaign';
  }
  function normalizeCampaign(c) {
    var dest = c.destination || 'home';
    var row = {
      label: String(c.label || '').trim(),
      destination: dest,
      storyId: c.storyId || '',
      landing: String(c.landing || '').trim().replace(/^\//, ''),
      source: c.source || 'facebook',
      utmCampaign: c.utmCampaign || slugify(c.label),
    };
    if (dest === 'custom') {
      if (!row.landing) row.landing = landingFor('home');
    } else {
      /* Named page destinations always derive landing from catalog — never
         keep a stale path when the destination changes. */
      row.landing = landingFor(dest, row.storyId);
    }
    return row;
  }
  function addCampaign(c) {
    if (!c || !c.label) return null;
    var rows = getCampaigns();
    var row = normalizeCampaign(c);
    row.id = 'c_' + Date.now().toString(36);
    rows.push(row);
    saveCampaigns(rows);
    return row;
  }
  function updateCampaign(id, patch) {
    if (!id || !patch) return null;
    var rows = getCampaigns();
    var idx = -1;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) { idx = i; break; }
    if (idx === -1) return null;
    var merged = normalizeCampaign(Object.assign({}, rows[idx], patch));
    merged.id = id;
    rows[idx] = merged;
    saveCampaigns(rows);
    return merged;
  }
  function getCampaign(id) {
    var rows = getCampaigns();
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }
  function deleteCampaign(id) {
    var rows = getCampaigns().filter(function (c) { return c.id !== id; });
    saveCampaigns(rows);
    return rows;
  }
  /* Full tagged URL to paste into Meta/TikTok ads. creative → utm_content. */
  function buildTaggedUrl(c, creative) {
    if (!c) return '';
    var landing = c.landing || 'Pages/index.html';
    var qs = 'utm_source=' + encodeURIComponent(c.source || 'facebook')
      + '&utm_medium=paid_social'
      + '&utm_campaign=' + encodeURIComponent(c.utmCampaign || slugify(c.label))
      + '&utm_content=' + encodeURIComponent(creative || 'creative_01');
    var origin = (typeof location !== 'undefined' && location.origin && location.origin.indexOf('http') === 0)
      ? location.origin : 'https://droboard.app';
    return origin + '/' + landing.replace(/^\//, '') + (landing.indexOf('?') !== -1 ? '&' : '?') + qs;
  }

  var VISITOR_KEY = 'dro_acq_visitor_v1';
  var SPEND_KEY = 'dro_acq_spend_v1';
  var EVENTS_KEY = 'dro_acq_events_v1';
  var COHORT_KEY = 'dro_acq_cohorts_v1';

  function todayStr(ts) {
    var d = ts ? new Date(ts) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /* ── Storage ── */
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ── Visitor identity (shares dro_viewer_id with AdService) ── */
  function visitorId() {
    try {
      var v = localStorage.getItem('dro_viewer_id');
      if (!v) {
        v = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('dro_viewer_id', v);
      }
      return v;
    } catch (e) { return 'anon'; }
  }

  /* ── UTM capture (call on every landing; first-touch wins) ── */
  function captureUtm() {
    try {
      var q = new URLSearchParams(location.search);
      var src = q.get('utm_source') || q.get('utm_Source') || '';
      if (!src) return null;
      var touch = {
        source: src,
        medium: q.get('utm_medium') || '',
        campaign: q.get('utm_campaign') || '',
        content: q.get('utm_content') || '',
        landing: location.pathname.split('/').pop() + location.search,
        ts: Date.now(),
        date: todayStr(),
      };
      var v = read(VISITOR_KEY, null);
      if (!v) {
        v = { visitorId: visitorId(), firstTouch: touch, lastTouch: touch };
        write(VISITOR_KEY, v);
        record('landing', { campaignId: campaignIdFromUtm(touch.campaign), landing: true });
      } else {
        v.lastTouch = touch;
        write(VISITOR_KEY, v);
        var last = v.firstTouch && v.firstTouch.ts || 0;
        if (Date.now() - last > 86400000) record('return_visit', { campaignId: campaignIdFromUtm(touch.campaign) });
        else record('landing', { campaignId: campaignIdFromUtm(touch.campaign) });
      }
      return touch;
    } catch (e) { return null; }
  }
  function campaignIdFromUtm(utm) {
    var list = getCampaigns();
    for (var i = 0; i < list.length; i++) {
      if (list[i].utmCampaign && list[i].utmCampaign === utm) return list[i].id;
    }
    return utm || 'direct';
  }
  function activeCampaignId() {
    var v = read(VISITOR_KEY, null);
    if (v && v.firstTouch) return campaignIdFromUtm(v.firstTouch.campaign);
    return 'direct';
  }

  /* ── Event log ── */
  function record(type, meta) {
    meta = meta || {};
    var events = read(EVENTS_KEY, []);
    events.push({
      id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      visitorId: meta.visitorId || visitorId(),
      type: type,                                   // landing|return_visit|sign_up|story_open|chapter_read|coin_purchase
      campaignId: meta.campaignId || activeCampaignId(),
      storyId: meta.storyId || '',
      amount: Number(meta.amount) || 0,             // coin purchase USD
      coins: Number(meta.coins) || 0,
      pages: Number(meta.pages) || 0,               // pages explored in session
      ts: Date.now(),
      date: todayStr(),
    });
    if (events.length > 20000) events = events.slice(-20000);
    write(EVENTS_KEY, events);
  }

  /* ── Spend ledger (manual entry from Ads Manager) ── */
  function getSpend() { return read(SPEND_KEY, []); }
  function addSpend(row) {
    if (!row || !row.campaignId) return false;
    var rows = getSpend();
    rows.push({
      id: 'sp_' + Date.now().toString(36),
      date: row.date || todayStr(),
      campaignId: row.campaignId,
      amount: round2(row.amount),
      note: row.note || '',
      addedAt: new Date().toISOString(),
    });
    write(SPEND_KEY, rows);
    return true;
  }

  /* ── Seed: deterministic 30-day cohorts (demo before first campaign) ── */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /* Per-campaign behaviour profile — story wins on quality (the hypothesis
     under test); discover brings volume cheaply; bridge leaks the extra step. */
  var PROFILES = {
    story_romance: { perDay: 42, spendDay: 8.0,  regRate: 0.19, readRate: 0.15, meanRate: 0.12, d1: 0.41, d7: 0.23, d30: 0.14, buyRate: 0.048, avgBuy: 9.8,  pages: 5.8, impPer: 3.4 },
    story_fantasy: { perDay: 34, spendDay: 7.5,  regRate: 0.17, readRate: 0.14, meanRate: 0.11, d1: 0.38, d7: 0.21, d30: 0.12, buyRate: 0.041, avgBuy: 10.4, pages: 5.2, impPer: 3.1 },
    discover_push: { perDay: 58, spendDay: 7.0,  regRate: 0.12, readRate: 0.09, meanRate: 0.07, d1: 0.29, d7: 0.11, d30: 0.06, buyRate: 0.021, avgBuy: 8.2,  pages: 7.4, impPer: 4.6 },
    bridge_intro:  { perDay: 16, spendDay: 4.0,  regRate: 0.09, readRate: 0.06, meanRate: 0.045, d1: 0.25, d7: 0.08, d30: 0.04, buyRate: 0.015, avgBuy: 7.5,  pages: 3.1, impPer: 1.9 },
  };
  function seedIfEmpty() {
    try { if (localStorage.getItem(COHORT_KEY)) return; } catch (e) { return; }
    var rand = mulberry32(20261020);
    var cohorts = [];
    var spend = [];
    var now = new Date(); now.setHours(0, 0, 0, 0);
    DEFAULT_CAMPAIGNS.forEach(function (c) {
      var pr = PROFILES[c.id];
      if (!pr) return;
      for (var d = 29; d >= 0; d--) {
        var day = new Date(now.getTime());
        day.setDate(day.getDate() - d);
        var date = todayStr(day.getTime());
        var dow = day.getDay();
        var boost = (dow === 0 || dow === 6) ? 1.2 : 1;
        spend.push({ id: 'sp_seed_' + c.id + '_' + date, date: date, campaignId: c.id, amount: round2(pr.spendDay * boost * (0.9 + rand() * 0.2)), note: 'seed', addedAt: day.toISOString() });
        var n = Math.max(3, Math.round(pr.perDay * boost * (0.85 + rand() * 0.3)));
        for (var i = 0; i < n; i++) {
          var registered = rand() < pr.regRate;
          var firstRead = registered && rand() < (pr.readRate / pr.regRate);
          var meaningful = firstRead && rand() < (pr.meanRate / pr.readRate);
          var buys = rand() < pr.buyRate;
          cohorts.push({
            visitorId: 'sv_' + c.id + '_' + date + '_' + i,
            campaignId: c.id,
            firstDate: date,
            firstTs: day.getTime() + Math.floor(rand() * 86400000),
            registered: registered,
            firstRead: firstRead,
            meaningfulRead: meaningful,
            pages: Math.max(1, Math.round(pr.pages * (0.6 + rand() * 0.9))),
            impressions: Math.round(pr.impPer * (0.5 + rand())),
            d1: rand() < pr.d1,
            d7: rand() < pr.d7,
            d30: rand() < pr.d30,
            purchase: buys ? round2(pr.avgBuy * (0.6 + rand() * 0.9)) : 0,
          });
        }
      }
    });
    write(COHORT_KEY, cohorts);
    write(SPEND_KEY, spend);
  }

  /* ── Summary: the five questions per campaign ── */
  function cutoff(days) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return todayStr(d.getTime());
  }
  function campaignMeta(id) {
    var list = getCampaigns();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, label: id, destination: 'other' };
  }
  async function getSummary(days) {
    days = days || 30;
    try {
      if (USE_API) {
        var r = await fetch(API_BASE + '/summary?days=' + days, { credentials: 'include' }).then(function (x) { return x.json(); });
        if (r && r.campaigns) return r;
      }
    } catch (e) {}
    seedIfEmpty();
    var cut = cutoff(days);
    var cohorts = read(COHORT_KEY, []).filter(function (v) { return v.firstDate >= cut; });
    var spendRows = getSpend().filter(function (s) { return s.date >= cut; });
    var out = { days: days, campaigns: [], totals: null };
    var t = { spend: 0, visitors: 0, registrations: 0, firstReaders: 0, meaningful: 0, pages: 0, impressions: 0, coinRevenue: 0, adEarnings: 0, d7Returned: 0, d7Cohort: 0, contribution: 0 };
    getCampaigns().forEach(function (c) {
      var vs = cohorts.filter(function (v) { return v.campaignId === c.id; });
      var spend = spendRows.filter(function (s) { return s.campaignId === c.id; })
        .reduce(function (a, s) { return a + (Number(s.amount) || 0); }, 0);
      var regs = vs.filter(function (v) { return v.registered; }).length;
      var reads = vs.filter(function (v) { return v.firstRead; }).length;
      var means = vs.filter(function (v) { return v.meaningfulRead; }).length;
      var pages = vs.reduce(function (a, v) { return a + (v.pages || 0); }, 0);
      var imps = vs.reduce(function (a, v) { return a + (v.impressions || 0); }, 0);
      var coins = round2(vs.reduce(function (a, v) { return a + (v.purchase || 0); }, 0));
      var adEst = round2(imps * CONFIG.adECPM);
      var netCoins = round2(coins * (1 - CONFIG.writerShare) * (1 - CONFIG.paymentFee));
      var contribution = round2(netCoins + adEst - spend);
      var d7Pool = vs.filter(function (v) { return v.firstDate <= todayStr(Date.now() - 7 * 86400000); });
      var d7Ret = d7Pool.filter(function (v) { return v.d7; }).length;
      out.campaigns.push({
        campaignId: c.id, label: c.label, destination: c.destination, storyId: c.storyId,
        spend: round2(spend),
        visitors: vs.length,
        registrations: regs,
        firstReaders: reads,
        meaningfulReaders: means,
        costPerRegistration: regs ? round2(spend / regs) : null,
        costPerReader: reads ? round2(spend / reads) : null,
        avgPages: vs.length ? Math.round((pages / vs.length) * 10) / 10 : 0,
        impressions: imps,
        adEarnings: adEst,
        coinRevenue: coins,
        coinNet: netCoins,
        d7Retention: d7Pool.length ? Math.round((d7Ret / d7Pool.length) * 1000) / 10 : null,
        contribution: contribution,
        winner: contribution > 0,
      });
      t.spend += spend; t.visitors += vs.length; t.registrations += regs;
      t.firstReaders += reads; t.meaningful += means; t.pages += pages;
      t.impressions += imps; t.coinRevenue += coins; t.adEarnings += adEst;
      t.d7Returned += d7Ret; t.d7Cohort += d7Pool.length; t.contribution += contribution;
    });
    t.spend = round2(t.spend); t.coinRevenue = round2(t.coinRevenue);
    t.adEarnings = round2(t.adEarnings); t.contribution = round2(t.contribution);
    t.costPerReader = t.firstReaders ? round2(t.spend / t.firstReaders) : null;
    t.costPerRegistration = t.registrations ? round2(t.spend / t.registrations) : null;
    t.d7Retention = t.d7Cohort ? Math.round((t.d7Returned / t.d7Cohort) * 1000) / 10 : null;
    t.avgPages = t.visitors ? Math.round((t.pages / t.visitors) * 10) / 10 : 0;
    out.totals = t;
    return out;
  }

  /* Auto-capture on load (landing pages carry the UTMs). */
  try { if (typeof location !== 'undefined' && location.search && location.search.indexOf('utm_') !== -1) captureUtm(); } catch (e) {}

  window.Acquisition = {
    __ready: true,
    CONFIG: CONFIG,
    getCampaigns: getCampaigns,
    addCampaign: addCampaign,
    updateCampaign: updateCampaign,
    getCampaign: getCampaign,
    deleteCampaign: deleteCampaign,
    landingCatalog: landingCatalog,
    landingFor: landingFor,
    buildTaggedUrl: buildTaggedUrl,
    captureUtm: captureUtm,
    record: record,
    getSpend: getSpend,
    addSpend: addSpend,
    getSummary: getSummary,
    activeCampaignId: activeCampaignId,
    visitorId: visitorId,
  };
})();
