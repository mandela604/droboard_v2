/* ===============================================================
   CURRENCY SERVICE — location-based price ladders (NO fx conversion).
   The same product costs an explicitly set price per location, e.g.
   100 coins = ₦1,500 in Nigeria, $2.50 in the US, £2.85 in the UK.

   Each product carries its own ladder:
     { id:'coins_100', prices:{ NGN:'₦1,500', USD:'$2.50', GBP:'£2.85' } }
   This service detects the reader's country (ipapi, cached 7 days,
   defaults to NG) and resolves the matching leg.

   STRICT — no silent fallback. resolve() returns an error result when
   a price cannot be determined, and purchase surfaces must block instead
   of charging a guessed price:
     { ok:true, price:'₦1,500', currency:'NGN' }
     { ok:false, error:'NO_LADDER' }        // product has no usable price anywhere
     { ok:false, error:'NO_LOCAL_PRICE' }   // ladder exists, none for reader's currency

   Ladder sources (later wins): bundled `prices` on the item <
   finance-dashboard saves (localStorage 'dro_finance_prices') <
   backend GET /api/pricing/ladders when USE_API is true.

   Finance overrides without code: localStorage 'dro_finance_prices'
     { "coins_100": { "USD":"$1.99", "NGN":"₦1,200", "GBP":"£2.20" } }
   Backend-ready: GET /api/pricing/ladders -> same shape merges over
   everything when USE_API is true.
   =============================================================== */
(function () {
  'use strict';

  var USE_API = false;
  var API_BASE = '/api';

  var GEO_KEY = 'droboard_geo';
  var FIN_KEY = 'dro_finance_prices';
  var GEO_TTL = 7 * 24 * 3600 * 1000;

  var BY_COUNTRY = {
    NG: 'NGN', US: 'USD', GB: 'GBP'
  };
  var DEFAULT_CURRENCY = 'NGN';

  var _country = 'NG';
  var _currency = 'NGN';
  var _ready = false;
  var _listeners = [];
  var _remoteLadders = {};

  function _saveGeo(code) {
    try { localStorage.setItem(GEO_KEY, JSON.stringify({ code: code, ts: Date.now() })); } catch (e) {}
  }
  function _loadGeo() {
    try {
      var g = JSON.parse(localStorage.getItem(GEO_KEY) || 'null');
      if (g && g.code && (Date.now() - (g.ts || 0)) < GEO_TTL) return g.code;
    } catch (e) {}
    return null;
  }
  function _financeLadders() {
    try {
      var v = JSON.parse(localStorage.getItem(FIN_KEY) || 'null');
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return {}; }
  }
  function _applyCountry(code) {
    _country = code || 'NG';
    _currency = BY_COUNTRY[_country] || 'USD';
  }
  function _notify() {
    _listeners.forEach(function (fn) { try { fn(_currency); } catch (e) {} });
  }

  // Merge every ladder source for one product id (later sources win).
  function mergedLadder(id, bundled) {
    var out = {};
    if (bundled && typeof bundled === 'object') {
      Object.keys(bundled).forEach(function (k) { out[k] = bundled[k]; });
    }
    var fin = _financeLadders();
    if (id && fin[id] && typeof fin[id] === 'object') {
      Object.keys(fin[id]).forEach(function (k) { out[k] = fin[id][k]; });
    }
    if (id && _remoteLadders[id] && typeof _remoteLadders[id] === 'object') {
      Object.keys(_remoteLadders[id]).forEach(function (k) { out[k] = _remoteLadders[id][k]; });
    }
    return out;
  }
  function nonEmpty(s) { return typeof s === 'string' && s.trim() !== ''; }

  // Strict resolve: exact leg for the reader's currency, or an error.
  // Never substitutes another currency's price.
  function resolve(item) {
    var id = item && (item.id || item.storeProductId);
    var ladder = mergedLadder(id, item && item.prices);
    // Legacy single-price products resolve as a USD-only ladder.
    if (!nonEmpty(ladder.USD) && !nonEmpty(ladder.NGN) && !nonEmpty(ladder.GBP)) {
      var usd = null;
      if (item && item.priceUSD != null && !isNaN(+item.priceUSD)) usd = '$' + (+item.priceUSD).toFixed(2);
      else if (item && typeof item.price === 'number') usd = '$' + item.price.toFixed(2);
      else if (item && typeof item.price === 'string') {
        var m = item.price.match(/^\$\s*([\d.,]+)/);
        if (m) usd = '$' + parseFloat(m[1].replace(/,/g, '')).toFixed(2);
        else if (item.price.trim() !== '') return { ok: true, price: item.price.trim(), currency: null, assumed: true };
      }
      if (usd) ladder = { USD: usd };
    }
    var keys = Object.keys(ladder).filter(function (k) { return nonEmpty(ladder[k]); });
    if (!keys.length) return { ok: false, error: 'NO_LADDER', product: id || null };
    if (!nonEmpty(ladder[_currency])) {
      return { ok: false, error: 'NO_LOCAL_PRICE', product: id || null, currency: _currency, available: keys };
    }
    return { ok: true, price: ladder[_currency], currency: _currency };
  }

  // Display string for templates. 'Unavailable' on failure — callers that
  // charge money must check resolve().ok first and block on error.
  function priceFor(item) {
    var r = resolve(item);
    return r.ok ? r.price : 'Unavailable';
  }

  // Raw leg pick, exact currency only, no fallback. Non-purchase display.
  function pick(ladder) {
    if (!ladder) return '';
    if (typeof ladder === 'string') return ladder;
    var v = ladder[_currency];
    return nonEmpty(v) ? v : '';
  }

  function init() {
    if (_ready) return Promise.resolve(_currency);
    _ready = true;
    var cached = _loadGeo();
    if (cached) { _applyCountry(cached); }
    function liveLadders() {
      if (!USE_API) return Promise.resolve(_currency);
      return fetch(API_BASE + '/pricing/ladders').then(function (r) {
        if (!r.ok) throw new Error('ladders');
        return r.json();
      }).then(function (j) {
        if (j && typeof j === 'object') { _remoteLadders = j; _notify(); }
        return _currency;
      }).catch(function () { return _currency; });
    }
    return new Promise(function (resolve) {
      fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (j) {
        var code = j && j.country_code ? String(j.country_code).toUpperCase() : null;
        if (code) { _applyCountry(code); _saveGeo(code); _notify(); }
        liveLadders().then(resolve);
      }).catch(function () { liveLadders().then(resolve); });
    });
  }
  function refresh() { if (!_ready) init(); }
  function onChange(fn) {
    if (typeof fn === 'function') _listeners.push(fn);
  }

  window.DroboardCurrency = {
    init: init,
    refresh: refresh,
    onChange: onChange,
    get: function () { return { country: _country, currency: _currency }; },
    pick: pick,
    resolve: resolve,
    priceFor: priceFor
  };

  init();
})();
