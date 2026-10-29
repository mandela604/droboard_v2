/**
 * services/payment-service.js — platform-aware checkout (live).
 * Web → Paystack / Flutterwave inline SDKs, then server verification:
 *   POST /api/payments/paystack/verify {reference, packCode}
 *   POST /api/payments/flutterwave/verify {transactionId, packCode}
 *   POST /api/play/verify {purchaseToken, productId}
 * Coins credit server-side only, from the catalog by packCode — the client
 * never self-credits. Missing provider keys fail closed with a clear error.
 * App store billing is not bundled: it rejects honestly instead of faking.
 */
(function () {
  'use strict';
  if (window.PaymentService) return;

  var API = '/api/payments';

  function platform() {
    try {
      var cap = window.Capacitor;
      if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
        var p = (cap.getPlatform && cap.getPlatform()) || 'android';
        return p === 'ios' ? 'ios-app' : 'android-app';
      }
    } catch (e) {}
    return 'web';
  }
  function isApp() { return platform() !== 'web'; }

  var ALL_WEB = [
    { id: 'flutterwave', name: 'Flutterwave', icon: 'fas fa-wallet', hint: 'Card · Bank · Mobile money' },
    { id: 'paystack', name: 'Paystack', icon: 'fas fa-credit-card', hint: 'Card · Transfer · USSD' },
  ];
  // Only channels the server actually has keys for. Before /payments/config has
  // been read the sheet shows the launch provider (Flutterwave) alone — never
  // a list a tap could fail on.
  function methods() {
    var pf = platform();
    if (pf === 'android-app') return [{ id: 'play', name: 'Google Play', icon: 'fab fa-google-play', hint: 'Billed by Google' }];
    if (pf === 'ios-app') return [{ id: 'appstore', name: 'App Store', icon: 'fab fa-apple', hint: 'Billed by Apple' }];
    if (!_config) return ALL_WEB.slice(0, 1);
    var enabled = Array.isArray(_config.enabled) ? _config.enabled : null;
    if (!enabled) return ALL_WEB;
    return ALL_WEB.filter(function (m) { return enabled.indexOf(m.id) !== -1; });
  }
  // Fire-and-forget at page init so the sheet knows the real provider list
  // before a user taps Buy.
  function warm() { return getConfig().catch(function () { return null; }); }

  var _sdk = {};
  function loadScript(src) {
    if (_sdk[src]) return _sdk[src];
    _sdk[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('sdk_load_failed')); };
      document.head.appendChild(s);
    });
    return _sdk[src];
  }

  function genRef(prefix) {
    var r = '';
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var b = new Uint8Array(8);
        window.crypto.getRandomValues(b);
        for (var i = 0; i < b.length; i++) r += b[i].toString(16).padStart(2, '0');
      }
    } catch (e) {}
    if (!r) r = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return (prefix || 'DRO') + '-' + r.toUpperCase();
  }

  var _config = null;
  function getConfig() {
    if (_config) return Promise.resolve(_config);
    return fetch(API + '/config', { credentials: 'include' }).then(function (res) {
      if (!res.ok) throw new Error('config_failed');
      return res.json();
    }).then(function (j) { _config = j || {}; return _config; });
  }

  // Providers echo this back on their webhook; without it the server cannot
  // attribute a completed charge to a user + pack and rejects the webhook.
  var _me = null;
  function getMe() {
    if (_me) return Promise.resolve(_me);
    return fetch('/api/users/me', { credentials: 'include' }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (j) {
      _me = j ? { id: j.id || j.userId || j._id || null, email: j.email || null } : null;
      return _me;
    }).catch(function () { return null; });
  }
  function getEmail() { return getMe().then(function (m) { return m && m.email ? m.email : null; }); }

  function verify(channel, body) {
    return fetch(API + '/' + channel + '/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          var e = new Error((j && j.error) || 'verify_failed');
          e.status = res.status;
          throw e;
        }
        // Attributed conversion (uses the last ad clicked, if any).
        try {
          if (window.AdService && AdService.convert) {
            AdService.convert({
              orderId: body && (body.reference || body.transactionId || body.purchaseToken),
              value: j && j.amount != null ? Number(j.amount) : undefined,
              currency: (j && j.currency) || 'USD',
            });
          }
        } catch (err) {}
        return j;
      });
    });
  }

  function payWithPaystack(opts) {
    return getConfig().then(function (cfg) {
      if (!cfg.paystackPublicKey) {
        var e = new Error('paystack_not_configured');
        e.status = 503;
        throw e;
      }
      return loadScript('https://js.paystack.co/v1/inline.js');
    }).then(function () {
      return getMe();
    }).then(function (me) {
      var email = opts.email || (me && me.email);
      if (!email) throw new Error('email_required');
      return new Promise(function (resolve, reject) {
        var handler = window.PaystackPop.setup({
          key: _config.paystackPublicKey,
          email: email,
          amount: Math.round(Number(opts.amountNGN) * 100), // naira -> kobo
          currency: 'NGN',
          ref: genRef('PSK'),
          metadata: { userId: (me && me.id) || '', packCode: opts.packCode },
          callback: function (resp) {
            verify('paystack', { reference: resp.reference, packCode: opts.packCode }).then(resolve, reject);
          },
          onClose: function () {
            var e = new Error('cancelled');
            e.cancelled = true;
            reject(e);
          },
        });
        handler.openIframe();
      });
    });
  }

  function payWithFlutterwave(opts) {
    return getConfig().then(function (cfg) {
      if (!cfg.flutterwavePublicKey) {
        var e = new Error('flutterwave_not_configured');
        e.status = 503;
        throw e;
      }
      return loadScript('https://checkout.flutterwave.com/v3.js');
    }).then(function () {
      return getMe();
    }).then(function (me) {
      var email = opts.email || (me && me.email);
      if (!email) throw new Error('email_required');
      return new Promise(function (resolve, reject) {
        window.FlutterwaveCheckout({
          public_key: _config.flutterwavePublicKey,
          tx_ref: genRef('FLW'),
          amount: Number(opts.amountNGN),
          currency: 'NGN',
          customer: { email: email },
          meta: { userId: (me && me.id) || '', packCode: opts.packCode },
          callback: function (d) {
            var txId = d && (d.transaction_id || d.id || d.tx_ref);
            if (!txId) { reject(new Error('no_receipt')); return; }
            verify('flutterwave', { transactionId: txId, packCode: opts.packCode }).then(resolve, reject);
          },
          onclose: function () {
            var e = new Error('cancelled');
            e.cancelled = true;
            reject(e);
          },
        });
      });
    });
  }

  // checkout({ packCode, amountNGN, email?, method? }) -> server receipt.
  function checkout(opts) {
    opts = opts || {};
    if (!opts.packCode) return Promise.reject(new Error('pack_required'));
    if (!(Number(opts.amountNGN) > 0)) return Promise.reject(new Error('amount_required'));
    var list = methods();
    if (!list.length) {
      // Config answered with zero enabled channels — no keys exist yet, so no
      // provider can take this money. Fail before the SDK rather than inside it.
      var none = new Error('no_provider_configured');
      none.status = 503;
      return Promise.reject(none);
    }
    var method = opts.method || list[0].id;
    if (method === 'play' || method === 'appstore') {
      var e = new Error('store_billing_unavailable');
      e.status = 501;
      return Promise.reject(e);
    }
    if (_config && Array.isArray(_config.enabled) && _config.enabled.indexOf(method) === -1) {
      var off = new Error(method + '_not_configured');
      off.status = 503;
      return Promise.reject(off);
    }
    if (method === 'flutterwave') return payWithFlutterwave(opts);
    return payWithPaystack(opts);
  }

  window.PaymentService = {
    platform: platform, isApp: isApp, methods: methods,
    checkout: checkout, getConfig: getConfig, warm: warm,
  };
})();
