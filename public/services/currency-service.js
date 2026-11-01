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
   backend GET /api/pricing/ladders (always attempted, silently skipped when
   the backend is down).

   Global currency config (ONE switch, Super Admin → Platform settings):
   localStorage 'dro_currency_config' { base:'NGN', locked:null|'NGN'|'USD'|'GBP' }
   - base: home/settlement currency (finance legs are authored in this).
   - locked: null = no forced currency; set = force it on every staff page.

   Three policies, on purpose:
     · Reader prices (store, chapter unlocks) → resolve()/priceFor()/pick(),
       always the reader's own location leg, never converted, never locked.
     · Staff reporting (super-admin, finance, chief/senior editor, marketing)
       → ngnToMoney()/usdToMoney() for stored money, coins() for coin acts,
       restated in locked || base — the admin's setting, independent of where
       they are. There is no coins→money converter on purpose: a coin's face
       moves, so the money is read from what was stored, never re-derived.
     · Author earnings → dollars(), fixed USD because that is what authors
       are paid in; no setting changes it.
   Missing legs fail strict as usual. Backend-ready: GET
   /api/platform-settings/currency merges over local config.
   =============================================================== */
(function () {
  'use strict';

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
  // Staff/reporting currency (what the converters below use). Resolved from
  // the admin setting only — see _retarget().
  var _currency = 'NGN';
  // locked:null = follow the reader's location; the Super Admin switch in
  // Platform settings is the only thing that forces one currency everywhere.
  var _config = { base: 'NGN', locked: null };

  // Display-only conversion (admin/editor reporting — NEVER pricing).
  // Ladders stay explicit; these only restate stored NGN/USD amounts.
  var REPORT_RATES = { NGN: 1, USD: 1538, GBP: 1940 }; // NGN per unit
  var SYMBOLS = { NGN: '₦', USD: '$', GBP: '£' };
  function num(n, dec) {
    n = +n || 0;
    try { return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
    catch (e) { return dec ? n.toFixed(dec) : String(Math.round(n)); }
  }
  function sym() { return SYMBOLS[_currency] || ''; }  function dec() { return _currency === 'NGN' ? 0 : 2; }
  // Coin acts (unlocks, tips, gifts) are denominated in coins, so the console
  // states them in coins. Money behind a coin act is never recomputed here —
  // the row already stores the naira it was worth (faceAmount / fiatAmount),
  // and that stored figure is what ngnToMoney() renders.
  function coinsShort(coins) {
    var n = +coins || 0, a = Math.abs(n), div = 1, sfx = '';
    if (a >= 1e6) { div = 1e6; sfx = 'M'; }
    else if (a >= 1e3) { div = 1e3; sfx = 'k'; }
    if (!sfx) return num(n, 0) + ' coins';
    var v = n / div;
    return num(v, Math.abs(v) >= 10 ? 0 : 1) + sfx + ' coins';
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
  // Author earnings settle in dollars, so they show in dollars whatever the
  // staff display says. No conversion, and the admin lock does not reach it.
  function dollars(usd) { return '$' + num(+usd || 0, 2); }

  // USD -> value in the staff currency, unformatted.
  function _staffFromUsd(usd) {
    return (+usd || 0) * REPORT_RATES.USD / (REPORT_RATES[_currency] || REPORT_RATES.USD);
  }
  // Headline figures are authored with a scale suffix ('$48.2M', '$31.2K');
  // restate them and keep the same scale in the staff currency.
  function _compact(v) {
    var a = Math.abs(v), div = 1, sfx = '';
    if (a >= 1e9) { div = 1e9; sfx = 'B'; }
    else if (a >= 1e6) { div = 1e6; sfx = 'M'; }
    else if (a >= 1e3) { div = 1e3; sfx = 'K'; }
    if (!sfx) return sym() + num(v, dec());
    var n = v / div;
    return sym() + num(n, Math.abs(n) >= 100 ? 0 : 1) + sfx;
  }
  // Pull a number out of '$48.2M' / '2,450.00' / '$1200', honouring K/M/B.
  function usdAmount(x) {
    var s = String(x == null ? '' : x);
    var m = s.match(/-?[\d][\d.,]*(?:\s*[KMB])?/i);
    if (!m) return 0;
    var n = parseFloat(m[0].replace(/,/g, '')) || 0;
    var u = (m[0].match(/[KMB]/i) || [''])[0].toUpperCase();
    return n * (u === 'K' ? 1e3 : u === 'M' ? 1e6 : u === 'B' ? 1e9 : 1);
  }
  function usdToMoneyShort(x) { return _compact(_staffFromUsd(usdAmount(x))); }
  // Restate every "$…" inside a sentence (activity feeds, prize copy) into the
  // staff currency. The suffix must touch the digits ('$1.2M'), so "$200
  // milestone" can't be misread as 200 mega. Precision follows the source:
  // '$12,840' stays whole, '$9.99' keeps its cents.
  function usdProse(text) {
    if (typeof text !== 'string' || text.indexOf('$') === -1) return text;
    return text.replace(/\$\s*(\d[\d,]*(?:\.\d+)?)([KMB])?(?![a-z])/gi, function (m, digits, sfx) {
      var usd = parseFloat(String(digits).replace(/,/g, '')) || 0;
      if (sfx) usd = usd * ({ K: 1e3, M: 1e6, B: 1e9 }[sfx.toUpperCase()]);
      var v = _staffFromUsd(usd);
      if (sfx) return _compact(v);
      var d = _currency === 'NGN' ? 0 : (digits.indexOf('.') === -1 ? 0 : 2);
      return sym() + num(v, d);
    });
  }
  var _ready = false;
  var _listeners = [];
  var _remoteLadders = {};

  // Production runs on server truth only. If the backend cannot be reached the
  // page stops and asks for a refresh — it never presents demo configuration as
  // if it were real. Local dev keeps the demo path while frontend wiring is
  // frozen; production is anything not served from this machine or a webview.
  var _STRICT = !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);

  function _backendDown() {
    if (!_STRICT || document.getElementById('droConnErr')) return;
    var ov = document.createElement('div');
    ov.id = 'droConnErr';
    ov.setAttribute('role', 'alert');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f0a1e;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center';
    ov.innerHTML = '<div style="max-width:360px">'
      + '<div style="width:46px;height:46px;border-radius:50%;background:rgba(224,56,77,.15);color:#e0384d;font-size:22px;font-weight:800;line-height:46px;margin:0 auto 14px">!</div>'
      + '<div style="font-size:17px;font-weight:800;margin-bottom:8px">Can\u2019t connect to Droboard</div>'
      + '<div style="font-size:13px;line-height:1.6;color:#b9b3c9;margin-bottom:20px">We couldn\u2019t reach our servers. Check your connection and refresh the page.</div>'
      + '<button type="button" style="font:inherit;font-size:13px;font-weight:700;padding:11px 22px;border-radius:10px;border:0;background:#7c5cfc;color:#fff;cursor:pointer">Refresh</button>'
      + '</div>';
    ov.querySelector('button').addEventListener('click', function () { location.reload(); });
    (document.body || document.documentElement).appendChild(ov);
  }
  function _backendUp() {
    var ov = document.getElementById('droConnErr');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  // Bounded fetch: a hung backend must reach the error state too, not leave the
  // page frozen on cached values.
  function _getJson(url, ms) {
    var opts = {};
    try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(ms || 8000); } catch (e) {}
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

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
    // Staff reporting follows the admin's setting and nothing else: an
    // explicit lock when one is set, otherwise the settlement base. It never
    // drifts with wherever the admin happens to be reading from.
    _currency = _config.locked || _config.base || 'NGN';
  }
  // Reader-facing prices always follow the reader's own location. The admin
  // lock is a staff preference and deliberately does not reach this.
  function _readerCur() { return _geoCurrency || 'USD'; }
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
    var readerCur = _readerCur();
    if (!nonEmpty(ladder[readerCur])) {
      return { ok: false, error: 'NO_LOCAL_PRICE', product: id || null, currency: readerCur, available: keys };
    }
    return { ok: true, price: ladder[readerCur], currency: readerCur };
  }

  // Display string for templates. 'Unavailable' on failure — callers that
  // charge money must check resolve().ok first and block on error.
  function priceFor(item) {
    var r = resolve(item);
    return r.ok ? r.price : 'Unavailable';
  }

  // Raw leg pick, exact currency only, no fallback. Non-purchase display.
  // Reader surfaces price in the reader's own currency, never the staff one.
  function pick(ladder) {
    if (!ladder) return '';
    if (typeof ladder === 'string') return ladder;
    var v = ladder[_readerCur()];
    return nonEmpty(v) ? v : '';
  }

  function init() {
    if (_ready) return Promise.resolve(_currency);
    _ready = true;
    _loadConfig();
    var cached = _loadGeo();
    if (cached) { _applyCountry(cached); }
    function liveLadders() {
      // Always attempted: the super-admin's ladder edits and the base-currency
      // lock are server truth and merge over the catalog's own prices. In
      // production an unreachable backend is an error state, not demo truth.
      return _getJson(API_BASE + '/pricing/ladders').then(function (j) {
        if (j && typeof j === 'object') { _remoteLadders = j; _notify(); }
        return _getJson(API_BASE + '/platform-settings/currency').then(function (c) {
          if (c && typeof c === 'object') {
            if (VALID.indexOf(c.base) !== -1) _config.base = c.base;
            _config.locked = VALID.indexOf(c.locked) !== -1 ? c.locked : null;
            _retarget();
            _notify();
          }
          _backendUp();
          return _currency;
        }).catch(function () { _backendDown(); return _currency; });
      }).catch(function () { _backendDown(); return _currency; });
    }
    return new Promise(function (resolve) {
      _getJson('https://ipapi.co/json/', 4000).then(function (j) {
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
    get: function () { return { country: _country, currency: _currency, staff: _currency, reader: _readerCur(), base: _config.base, locked: _config.locked }; },
    getConfig: getConfig,
    setConfig: setConfig,
    symbol: sym,
    readerSymbol: function () { return SYMBOLS[_readerCur()] || ''; },
    coins: coinsShort,
    ngnToMoney: ngnToMoney,
    usdToMoney: usdToMoney,
    usdToMoneyShort: usdToMoneyShort,
    usdAmount: usdAmount,
    usdProse: usdProse,
    dollars: dollars,
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
