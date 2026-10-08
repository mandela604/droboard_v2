/**
 * services/payment-service.js — platform-aware checkout (demo).
 * Web → Paystack/Flutterwave-style sheet. Capacitor app → store billing
 * (Google Play / App Store) mock sheet. Backend later verifies receipts:
 *   POST /api/payments/paystack/verify {reference}
 *   POST /api/payments/play/verify {purchaseToken}
 *   POST /api/payments/appstore/verify {transactionId}
 * Demo only: no real charge happens; success returns a fake receipt.
 */
(function () {
  'use strict';
  if (window.PaymentService) return;

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

  // payment methods per platform (demo labels; live uses real SDKs)
  function methods() {
    var pf = platform();
    if (pf === 'android-app') return [{ id: 'play', name: 'Google Play', icon: 'fab fa-google-play', hint: 'Billed by Google' }];
    if (pf === 'ios-app') return [{ id: 'appstore', name: 'App Store', icon: 'fab fa-apple', hint: 'Billed by Apple' }];
    return [
      { id: 'paystack', name: 'Paystack', icon: 'fas fa-credit-card', hint: 'Card · Transfer · USSD' },
      { id: 'flutterwave', name: 'Flutterwave', icon: 'fas fa-wallet', hint: 'Card · Bank · Mobile money' },
    ];
  }

  function fakeRef(prefix) {
    return (prefix || 'DEMO') + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // Simulated checkout: resolves {ref, method, platform, amount} after delay.
  // Live swap: PaystackPop.setup / FlutterwaveCheckout / in-app-purchases plugin,
  // then POST receipt to backend verify endpoint before crediting coins.
  function checkout(opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve({
          ref: fakeRef(opts.method === 'play' ? 'PLAY' : opts.method === 'appstore' ? 'APP' : 'PSK'),
          method: opts.method || methods()[0].id,
          platform: platform(),
          amount: opts.amount || '',
          coins: opts.coins || 0,
          demo: true,
        });
      }, 1800);
      // caller may pass onCancel via opts.signal hook
      if (opts.cancelHook) opts.cancelHook(function () {
        if (done) return;
        done = true; clearTimeout(timer);
        var e = new Error('cancelled'); e.cancelled = true; reject(e);
      });
    });
  }

  window.PaymentService = { platform: platform, isApp: isApp, methods: methods, checkout: checkout };
})();
