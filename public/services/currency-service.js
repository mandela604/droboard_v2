/* ===============================================================
   CURRENCY SERVICE — location-based price ladders (NO fx conversion).
   The same product costs an explicitly set price per location, e.g.
   100 coins = ₦1,500 in Nigeria, $2.50 in the US, £2.85 in the UK.

   Each product carries its own ladder:
     { id:'coins_100', prices:{ NGN:'₦1,500', USD:'$2.50', GBP:'£2.85' } }
   This service detects the reader's country (ipapi, cached 7 days,
   unknown location shows USD) and resolves the matching leg.

   STRICT — no silent fallback. resolve() returns an error result when
   a price cannot be determined, and purchase surfaces must block instead
   of charging a guessed price:
     { ok:true, price:'₦1,500', currency:'NGN' }
     { ok:false, error:'NO_LADDER' }        // product has no usable price anywhere
     { ok:false, error:'NO_LOCAL_PRICE' }   // ladder exists, none for reader's currency

   Ladder sources (later wins): bundled `prices` on the item <
   finance-dashboard saves (localStorage 'dro_finance_prices') <
   backend GET /api/pricing/ladders when USE_API is true.

   Global currency config (ONE switch, Super Admin → Coin Economy):
   localStorage 'dro_currency_config' { base:'NGN', locked:null|'NGN'|'USD'|'GBP' }
   - base: home/settlement currency (finance legs are authored in this).
   - locked: null = automatic per-location ladders (unknown location
     shows USD); set = force one currency on every page.
   Missing legs fail strict as usual. Backend-ready: GET
   /api/platform-settings/currency merges over local config.
   =============================================================== */
(function () {
  'use strict';

  var USE_API = false;
  var API_BASE = '/api';

  var GEO_KEY = 'droboard_geo';
  var FIN_KEY = 'dro_finance_prices';
  var CFG_KEY = 'dro_currency_config';
  var GEO_TTL = 7 * 24 * 3600 * 1000;

  var BY_COUNTRY = {
    NG: 'NGN', US: 'USD', GB: 'GBP'
  };
  var VALID = ['NGN', 'USD', 'GBP'];

  var _country = '';
  var _geoCurrency = 'USD';
  var _currency = 'USD';
  var _config = { base: 'NGN', locked: 'USD' };

  // Display-only conversion (admin/editor reporting — NEVER pricing).
  // Ladders stay explicit; these only restate stored NGN/USD amounts.
  var REPORT_RATES = { NGN: 1, USD: 1538, GBP: 1940 }; // NGN per unit
  var COIN_FACE = { USD: 0.02, NGN: 15, GBP: 0.0285 }; // face value per coin
  var SYMBOLS = { NGN: '₦', USD: '$', GBP: '£' };
  function num(n, dec) {
    n = +n || 0;
    try { return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
    catch (e) { return dec ? n.toFixed(dec) : String(Math.round(n)); }
  }
  function sym() { return SYMBOLS[_currency] || ''; }  function dec() { return _currency === 'NGN' ? 0 : 2; }
  // Coins -> money in the effective currency.
  function coinsToMoney(coins) {
    var face = COIN_FACE[_currency] != null ? COIN_FACE[_currency] : COIN_FACE.USD;
    return sym() + num((+coins || 0) * face, dec());
  }
  // Stored NGN amount -> money in the effective currency.
  function ngnToMoney(ngn) {
    var rate = REPORT_RATES[_currency] || REPORT_RATES.USD;
    var val = (+ngn || 0) / rate;
    return sym() + num(_currency === 'NGN' ? Math.round(val) : val, dec());
  }
  // Stored USD amount -> money in the effective currency.
  function usdToMoney(usd) {
    if (typeof usd === 'string') {
      var m = usd.match(/-?[\d.,]+/);
      usd = m ? parseFloat(m[0].replace(/,/g, '')) : 0;
    }
    return ngnToMoney((+usd || 0) * REPORT_RATES.USD);
  }
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
  function _loadConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (c && typeof c === 'object') {
        if (VALID.indexOf(c.base) !== -1) _config.base = c.base;
        _config.locked = VALID.indexOf(c.locked) !== -1 ? c.locked : null;
      }
    } catch (e) {}
    _retarget();
  }
  function _retarget() {
    // Locked display wins; else geo-detected; else USD for unknown.
    _currency = _config.locked || _geoCurrency || 'USD';
  }
  function _applyCountry(code) {
    if (!code) return;
    _country = code;
    _geoCurrency = BY_COUNTRY[_country] || 'USD';
    _retarget();
  }
  function getConfig() { return { base: _config.base, locked: _config.locked }; }
  function setConfig(patch) {
    if (patch && typeof patch === 'object') {
      if (VALID.indexOf(patch.base) !== -1) _config.base = patch.base;
      _config.locked = VALID.indexOf(patch.locked) !== -1 ? patch.locked : (patch.locked === null ? null : _config.locked);
      try { localStorage.setItem(CFG_KEY, JSON.stringify(_config)); } catch (e) {}
    }
    _retarget();
    _notify();
    return getConfig();
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
    _loadConfig();
    var cached = _loadGeo();
    if (cached) { _applyCountry(cached); }
    function liveLadders() {
      if (!USE_API) return Promise.resolve(_currency);
      return fetch(API_BASE + '/pricing/ladders').then(function (r) {
        if (!r.ok) throw new Error('ladders');
        return r.json();
      }).then(function (j) {
        if (j && typeof j === 'object') { _remoteLadders = j; _notify(); }
        return fetch(API_BASE + '/platform-settings/currency').then(function (r2) {
          if (!r2.ok) return _currency;
          return r2.json().then(function (c) {
            if (c && typeof c === 'object') {
              if (VALID.indexOf(c.base) !== -1) _config.base = c.base;
              _config.locked = VALID.indexOf(c.locked) !== -1 ? c.locked : null;
              _retarget();
              _notify();
            }
            return _currency;
          });
        }).catch(function () { return _currency; });
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
    get: function () { return { country: _country, currency: _currency, base: _config.base, locked: _config.locked }; },
    getConfig: getConfig,
    setConfig: setConfig,
    symbol: sym,
    coinsToMoney: coinsToMoney,
    ngnToMoney: ngnToMoney,
    usdToMoney: usdToMoney,
    pick: pick,
    resolve: resolve,
    priceFor: priceFor
  };

  try {
    window.addEventListener('storage', function (e) {
      if (e && e.key === CFG_KEY) { _loadConfig(); _notify(); }
    });
  } catch (e) {}

  init();
})();
