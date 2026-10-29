/* ═══════════════════════════════════════════════════════════════
   AD PRICING — window.DroboardAdPricing
   ───────────────────────────────────────────────────────────────
   What an impression and a click cost, priced per currency.

   Priced per currency, never converted — the same rule the platform applies
   to coin ladders (currency-service.js). Each market carries its own authored
   price, so moving the naira price never silently reprices the dollar one.
   The USD leg is also what the ad revenue ledger books, because the
   earnings console has always reported in dollars.

   Live: GET/PUT /api/marketing/ad-pricing (Mongo `AdRateCard`, seeded from
   DEFAULTS). Demo: localStorage 'dro_ad_pricing_v1'.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardAdPricing) return;

  var API = '/api/marketing/ad-pricing';
  var LS_KEY = 'dro_ad_pricing_v1';
  var CURRENCIES = ['NGN', 'USD', 'GBP'];
  var SYM = { NGN: '₦', USD: '$', GBP: '£' };

  var DEFAULTS = {
    active: 'NGN',
    prices: {
      NGN: { impression: 8, click: 560 },
      USD: { impression: 0.005, click: 0.35 },
      GBP: { impression: 0.004, click: 0.28 },
    },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, f) { var n = Number(v); return Number.isFinite(n) && n >= 0 ? n : f; }

  function readOverlay() {
    try { var raw = localStorage.getItem(LS_KEY); if (!raw) return null; var o = JSON.parse(raw); return o && o.prices ? o : null; } catch (e) { return null; }
  }
  function writeOverlay(card) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(card)); } catch (e) {}
  }

  function normalise(card) {
    var prices = {};
    CURRENCIES.forEach(function (c) {
      var row = (card && card.prices && card.prices[c]) || {};
      var d = DEFAULTS.prices[c];
      prices[c] = { impression: num(row.impression, d.impression), click: num(row.click, d.click) };
    });
    return {
      active: CURRENCIES.indexOf(card && card.active) > -1 ? card.active : DEFAULTS.active,
      prices: prices,
    };
  }

  var _card = normalise(readOverlay() || DEFAULTS);
  var _source = 'local';

  function api(method, body) {
    var opt = { method: method, credentials: 'include', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(API, opt).then(function (r) {
      if (!r.ok) throw new Error('ad-pricing ' + method + ' failed');
      _source = 'api';
      return r.json();
    });
  }

  function card() { return clone(_card); }
  function active() { return _card.active; }
  function symbol(cur) { return SYM[cur] || SYM[_card.active]; }
  function rate(cur, event) {
    var c = CURRENCIES.indexOf(cur) > -1 ? cur : _card.active;
    var row = _card.prices[c] || _card.prices.USD;
    return event === 'click' ? row.click : row.impression;
  }

  function refresh() {
    return api('GET').then(function (d) {
      _card = normalise(d);
      writeOverlay(_card);
      return _card;
    }).catch(function () { _source = 'local'; return _card; });
  }

  function save(body) {
    var next = normalise(Object.assign({}, _card, body));
    return api('PUT', body).then(function (d) {
      _card = normalise(d || next);
      writeOverlay(_card);
      return _card;
    }).catch(function () {
      _card = next;
      writeOverlay(_card);
      return _card;
    });
  }

  window.DroboardAdPricing = {
    CURRENCIES: CURRENCIES,
    DEFAULTS: DEFAULTS,
    card: card,
    active: active,
    symbol: symbol,
    rate: rate,
    refresh: refresh,
    save: save,
    source: function () { return _source; },
  };
})();