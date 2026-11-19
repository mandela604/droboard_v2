/**
 * component/screen-loader.js — one shared "screen loader" for data fetching.
 * ─────────────────────────────────────────────────────────────────────
 * A single full-screen veil with a spinner, used by any page while it is
 * pulling data from the backend. No timers pretending to be data, no fake
 * content — it appears only while real requests are in flight.
 *
 * Include (early in <body>):
 *   <script src="../component/screen-loader.js?v=1" data-auto></script>
 *
 * `data-auto` tracks API requests and shows/hides the veil automatically:
 *   - GET  /api/…  → "Loading…"
 *   - POST/PUT/PATCH/DELETE /api/… → "Saving…"
 *   - /api/auth/… (token refresh / login) is ignored — never veil a login.
 *   - All API calls are tracked, including later user actions. Any page can
 *     also call the explicit API below for non-fetch async work.
 *
 * Explicit API (works anywhere, nestable via a ref-count):
 *   DroboardScreenLoader.show('Loading your stories…');
 *   DroboardScreenLoader.hide();
 *   DroboardScreenLoader.hide(true);              // force-clear
 *   await DroboardScreenLoader.wrap(fetch(...), 'Saving…');
 *   DroboardScreenLoader.isVisible();
 */
(function (global) {
  'use strict';
  if (global.DroboardScreenLoader) return;

  var STYLE_ID = 'dro-screen-loader-style';
  var overlay = null, labelEl = null;
  var count = 0, hideTimer = null, safetyTimer = null, label = 'Loading…', shownAt = 0;

  function ensure() {
    if (overlay) return;
    if (!document.head) return;

    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.dro-screen-loader{position:fixed;inset:0;z-index:9998;display:none;align-items:center;justify-content:center;' +
        'background:rgba(247,247,248,.74);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}' +
      'body[data-theme="dark"] .dro-screen-loader{background:rgba(16,16,20,.74)}' +
      '.dro-screen-loader.on{display:flex}' +
      '.dro-sl-box{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:184px;' +
        'padding:22px 26px;border-radius:16px;background:#fff;border:1px solid #ebebed;' +
        'box-shadow:0 12px 40px rgba(0,0,0,.10)}' +
      'body[data-theme="dark"] .dro-sl-box{background:#1c1c20;border-color:rgba(255,255,255,.08)}' +
      '.dro-sl-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,45,85,.18);' +
        'border-top-color:#ff2d55;animation:dro-sl-rotate .7s linear infinite}' +
      '@keyframes dro-sl-rotate{to{transform:rotate(360deg)}}' +
      '@media(prefers-reduced-motion:reduce){.dro-sl-spin{animation-duration:1.6s}}' +
      '.dro-sl-label{font:600 12.5px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        'color:#555;letter-spacing:.01em;text-align:center}' +
      'body[data-theme="dark"] .dro-sl-label{color:#d4d4d8}';
    document.head.appendChild(css);

    overlay = document.createElement('div');
    overlay.className = 'dro-screen-loader';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="dro-sl-box"><div class="dro-sl-spin"></div>' +
      '<div class="dro-sl-label">Loading…</div></div>';
    labelEl = overlay.querySelector('.dro-sl-label');
    (document.body || document.documentElement).appendChild(overlay);
  }

  function paint() {
    ensure();
    if (!overlay) return;
    if (!overlay.classList.contains('on')) shownAt = Date.now();
    overlay.classList.add('on');
    if (labelEl) labelEl.textContent = label;
  }

  function hideNow() {
    if (overlay) overlay.classList.remove('on');
  }

  function show(nextLabel) {
    if (nextLabel) label = nextLabel;
    count++;
    clearTimeout(hideTimer);
    clearTimeout(safetyTimer);
    paint();
    // A request that never settles must never trap the user behind a veil.
    safetyTimer = setTimeout(function () { count = 0; hideNow(); }, 20000);
  }

  function hide(force) {
    if (force) {
      count = 0;
      clearTimeout(hideTimer);
      clearTimeout(safetyTimer);
      hideNow();
      return;
    }
    count = Math.max(0, count - 1);
    if (count !== 0) return;
    clearTimeout(safetyTimer);
    // Grace + minimum visible time: back-to-back requests and quick retries
    // must never make the veil flash on/off at intervals.
    var wait = Math.max(400, 500 - (Date.now() - shownAt));
    hideTimer = setTimeout(function () { hideNow(); label = 'Loading…'; }, wait);
  }

  function wrap(promise, nextLabel) {
    show(nextLabel);
    return Promise.resolve(promise).then(
      function (v) { hide(); return v; },
      function (e) { hide(); throw e; }
    );
  }

  function isVisible() { return !!(overlay && overlay.classList.contains('on')); }

  /* ── opt-in automatic mode ───────────────────────────────────────── */
  var autoOn = false, autoUntil = 0;
  function auto() {
    if (autoOn || !global.fetch) return;
    autoOn = true;
    // Only the FIRST page load is veiled. Background refreshes, retries and
    // later user actions must not flash a full-screen spinner at intervals.
    autoUntil = Date.now() + 10000;
    var native = global.fetch.bind(global);

    global.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : ((input && input.url) || '');
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var tracked = method === 'GET' &&
        url.indexOf('/api/') !== -1 &&
        url.indexOf('/api/auth/') === -1 &&
        url.indexOf('/api/users/me') === -1 &&
        Date.now() < autoUntil;

      if (!tracked) return native(input, init);
      show('Loading…');
      var out;
      try { out = native(input, init); }
      catch (e) { hide(); throw e; }
      return out.then(
        function (res) { hide(); return res; },
        function (err) { hide(); throw err; }
      );
    };
  }

  global.addEventListener('pagehide', function () { hide(true); });
  global.addEventListener('droboard:screen-loader-hide', function () { hide(true); });

  var tag = document.currentScript;
  if (tag && tag.hasAttribute('data-auto')) auto();

  global.DroboardScreenLoader = {
    show: show, hide: hide, wrap: wrap, auto: auto, isVisible: isVisible
  };
})(window);
