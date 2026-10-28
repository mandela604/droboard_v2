/* ═══════════════════════════════════════════════════════════════
   APP-NAV — native-feel navigation for the Capacitor wrapper.
   Safe no-op enhancements on plain web. Runs from <head>, no deps.

   1) BACK BUTTON — listens via @capacitor/app (guarded; retries until
      the native bridge is ready). Own sessionStorage stack tracks real
      depth: back walks history, and at the logical root it exits the app
      on the first press. The launcher's redirect stub is never counted as
      a page, so it cannot swallow a press.
   2) TAB DEDUPE — tapping the already-active bottom-nav tab scrolls to
      top instead of stacking a duplicate history entry.
   3) EDGE SWIPE — swipe in from the left edge = back, from the right
      edge = forward. Ignores inputs, carousels and horizontally
      scrollable strips. Opt out: window.__noEdgeSwipe = true.
   4) PULL TO REFRESH — pull down from the very top (window scroll or
      the page's own scroller, e.g. bridge .scroll-body) shows a slim
      spinner; release past threshold reloads. Deliberate pulls only:
      needs 100px + 400ms — fast flicks are ignored so ordinary
      scrolling never reloads the page. Opt out:
      window.__noPullRefresh = true.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__droAppNav) return;
  window.__droAppNav = true;

  function isNative() {
    try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
    catch (e) { return false; }
  }
  function appPlugin() {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) || null; }
    catch (e) { return null; }
  }

  var HERE = String(location.href).split('#')[0];
  var STACK_KEY = 'dro_nav_stack';

  /* public/index.html is only a redirect stub: it replaces itself with
     Pages/discover.html, so there is no history entry to go back to. Counting
     it made the app land on discover with a stack of two, and the first back
     press then did nothing at all. */
  function isLauncherStub(href) {
    var path = '';
    try { path = new URL(href, location.href).pathname; } catch (e) { return false; }
    return /\/index\.html$/i.test(path) && !/\/pages\/index\.html$/i.test(path);
  }
  function loadStack() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]');
      if (!Array.isArray(s)) return [];
      return s.filter(function (u) { return !isLauncherStub(u); });
    }
    catch (e) { return []; }
  }
  function saveStack(s) {
    try { sessionStorage.setItem(STACK_KEY, JSON.stringify(s.slice(-30))); } catch (e) {}
  }
  var stack = loadStack();
  if (!isLauncherStub(HERE) && stack[stack.length - 1] !== HERE) { stack.push(HERE); saveStack(stack); }

  /* ── 2) tab dedupe: current-tab tap scrolls home, no history dupe ── */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href) || a.target === '_blank') return;
    var url;
    try { url = new URL(href, location.href).href.split('#')[0]; } catch (err) { return; }
    if (url === HERE) {
      e.preventDefault();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
      var sc = document.querySelector('.scroll-body');
      if (sc) { try { sc.scrollTo({ top: 0, behavior: 'smooth' }); } catch (__) { sc.scrollTop = 0; } }
    }
  }, false);

  /* ── 1) back button ── */
  function goBack() {
    stack = loadStack();
    if (stack.length > 1 && history.length > 1) {
      stack.pop();
      saveStack(stack);
      history.back();
      return;
    }
    if (!isNative()) { history.back(); return; }
    /* At the logical root, back means leave — the platform default. The old
       "press back again to exit" guard is what made the landing page feel like
       it needed two presses (plus one wasted on the redirect stub) to close. */
    var App = appPlugin();
    if (App && App.exitApp) { try { App.exitApp(); return; } catch (e) {} }
    history.back();
  }
  function bindBack() {
    try {
      var App = appPlugin();
      if (App && App.addListener) { App.addListener('backButton', goBack); return true; }
    } catch (e) {}
    return false;
  }
  if (!bindBack()) {
    var tries = 0;
    var iv = setInterval(function () { tries++; if (bindBack() || tries > 24) clearInterval(iv); }, 250);
  }
  // Cordova-style fallback (harmless elsewhere).
  document.addEventListener('backbutton', goBack, false);

  /* ── 0) system chrome: the status-bar row (clock, wifi, battery) is
     painted in the page's own top color (native only, web no-op) ──
     It has to be MEASURED, not guessed from the theme setting: pages disagree
     about where their background lives (the home page paints black on .phone
     behind a gradient .top-bar, discover paints on body, readers on a
     wrapper), and a gradient or alpha layer reports `transparent` to
     getComputedStyle. So we composite the real stack of backgrounds at the top
     edge of the viewport, bottom-up, until it is opaque.
     That gives the two rules the app needs:
       · Pages/index.html is dark-only CSS → black strip whatever Settings says
         (pinned below anyway, so a future light override cannot break it);
       · every other page follows data-theme, because its own CSS changes and
         the measurement changes with it.
     Icon contrast follows the STRIP, not the page: Capacitor's 'LIGHT' means
     "dark icons for a light background". On Android 15+ the status-bar color
     API is blocked, so the color is pushed to the native window background by
     the DroWindow plugin — same look on every Android version, website files
     untouched. */
  var DRO_LIGHT_STRIP = '#FFFFFF';
  function parseRGB(css) {
    var m = /rgba?\(([^)]+)\)/.exec(String(css || ''));
    if (!m) return null;
    var p = m[1].split(',').map(function (v) { return parseFloat(v); });
    if (p.length < 3 || isNaN(p[0]) || isNaN(p[1]) || isNaN(p[2])) return null;
    var a = p.length > 3 && !isNaN(p[3]) ? p[3] : 1;
    return { r: p[0], g: p[1], b: p[2], a: a };
  }
  function toHex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) {
      var h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
      return h.length < 2 ? '0' + h : h;
    }).join('');
  }
  function isHome() {
    /* The home feed is Pages/index.html — not the public/index.html redirect
       stub the app launches into, which is a blank white page. */
    try { return /\/pages\/index\.html$/i.test(String(location.pathname)); }
    catch (e) { return false; }
  }
  /* Composite an element's background up through its ancestors until one is
     opaque. Gradients and alpha layers report `transparent` to
     getComputedStyle, which is why reading `body` alone kept lying about the
     page's real color. */
  function compositeUp(el) {
    var layers = [];
    try {
      for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
        var c = parseRGB(getComputedStyle(n).backgroundColor);
        if (!c) continue;
        layers.push(c);
        if (c.a >= 1) break;
      }
    } catch (e) {}
    if (!layers.length) return null;
    var out = { r: 255, g: 255, b: 255, a: 1 };
    for (var j = layers.length - 1; j >= 0; j--) {
      var L = layers[j];
      out = {
        r: L.r * L.a + out.r * (1 - L.a),
        g: L.g * L.a + out.g * (1 - L.a),
        b: L.b * L.a + out.b * (1 - L.a),
        a: 1
      };
    }
    return toHex(out);
  }
  /* Same header selector list shared/theme-chrome.js uses to keep
     <meta name="theme-color"> honest, so both report one color. */
  var TOP_SELS = '.topbar,.top-bar,.header,.app-header,.navbar,.appbar,'
    + '.ces-topbar,.sa-topbar,.mss-topbar,.dso-topbar';
  function paintAt(x, y) {
    var el = null;
    try { el = document.elementFromPoint(x, y); } catch (e) {}
    return el ? compositeUp(el) : null;
  }
  function stripHex() {
    if (isHome()) return '#000000';
    try {
      var bar = document.querySelector(TOP_SELS);
      var hex = bar ? compositeUp(bar) : null;
      if (hex) return hex;
      /* Page whose header row is not in that list: fall back to the widest
         element actually painted at the top edge. */
      var counts = {}, best = null, bestN = 0;
      for (var s = 0; s < 5; s++) {
        var col = paintAt(Math.round(window.innerWidth * (s + 0.5) / 5), 2);
        if (!col) continue;
        counts[col] = (counts[col] || 0) + 1;
        if (counts[col] > bestN) { bestN = counts[col]; best = col; }
      }
      if (best) return best;
      return compositeUp(document.body) || DRO_LIGHT_STRIP;
    } catch (e) { return DRO_LIGHT_STRIP; }
  }
  /* The strip is native chrome — invisible to devtools. Console hooks:
     __droStrip.hex() → what the app would paint; __droStrip.at(x, y) → the
     composited color under one pixel. */
  window.__droStrip = { hex: stripHex, at: paintAt };
  function setWindowStrip(color) {
    try {
      var W = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DroWindow;
      if (!W || !W.setBackgroundColor) return false;
      W.setBackgroundColor({ color: color });
      return true;
    } catch (e) { return false; }
  }
  var lastPainted = null, lastPaintAt = 0;
  /* Repainting the native window is NOT free: it re-dispatches window insets,
     which relayouts the whole WebView. Doing it on every lifecycle event made
     the page jump. So a color already painted is never painted again. */
  function applyChrome() {
    var hex = stripHex();
    var now = Date.now();
    if (lastPainted === hex) return true;
    if (lastPainted !== null && now - lastPaintAt < 600) return false;
    if (!setWindowStrip(hex)) return false;
    lastPainted = hex;
    lastPaintAt = now;
    return true;
  }
  if (isNative()) {
    /* One paint per page. Measuring in <head> sees an unpainted body, picks the
       fallback color and then has to correct itself — and every correction is
       a native window call. So wait until the page has actually painted. */
    var chromeTries = 0;
    function bootChrome() {
      if (applyChrome() || chromeTries++ > 24) return;
      setTimeout(bootChrome, 250);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootChrome);
    } else {
      bootChrome();
    }
    // Late stylesheets, fonts and hero images can settle the top color later.
    window.addEventListener('load', function () { try { applyChrome(); } catch (e) {} });
    setTimeout(function () { try { applyChrome(); } catch (e) {} }, 2500);
  }

  /* The WebView sits BELOW the status-bar row: Capacitor reserves the inset
     natively (SystemBars insetsHandling = "native") and no page ships
     viewport-fit=cover, so env(safe-area-inset-*) is 0 and every page lays out
     exactly as it does on the website. The old engine measured that inset and
     poured it into the top bar on top of the page's own padding — the
     double-count was the white band. There is nothing to pad here. */
  try {
    // Theme toggles (html data-theme / data-bg, body class) change the painted
    // top color — re-measure and repaint the strip to match.
    var chromeQueued = 0;
    function reChrome() {
      if (!isNative() || chromeQueued) return;
      /* 300ms, not a animation frame: measuring forces a layout pass, and the
         carousels churn body classes continuously. */
      chromeQueued = setTimeout(function () {
        chromeQueued = 0;
        try { applyChrome(); } catch (e) {}
      }, 300);
    }
    var themeObs = new MutationObserver(reChrome);
    function watchTheme() {
      try {
        if (document.body) themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-bg', 'class'] });
      } catch (e) {}
    }
    if (document.body) watchTheme();
    else document.addEventListener('DOMContentLoaded', watchTheme);
    document.addEventListener('droboard-theme', reChrome);
    // Config changes (rotation, dark-mode toggle) can reset the native
    // strip to the theme default — re-assert the page's color.
    window.addEventListener('resize', reChrome);
  } catch (e) {}

  /* ── helpers ── */
  function inField(el) {
    try { return !!(el && el.closest && el.closest('input,textarea,select,[contenteditable],[data-noswipe]')); }
    catch (e) { return false; }
  }
  function inHScroll(el) {
    try {
      var n = el, depth = 0;
      while (n && n !== document.body && depth < 5) {
        if (n.scrollWidth && n.clientWidth && n.scrollWidth > n.clientWidth + 8) return true;
        n = n.parentElement; depth++;
      }
    } catch (e) {}
    return false;
  }

  /* ── 3) edge swipe back / forward ── */
  var sx = 0, sy = 0, st = 0, edge = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { edge = null; return; }
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now(); edge = null;
    if (sx <= 26) edge = 'left';
    else if (sx >= window.innerWidth - 26) edge = 'right';
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (edge === null || window.__noEdgeSwipe) return;
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 800) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (inField(e.target) || inHScroll(e.target)) return;
    if (edge === 'left' && dx > 80) {
      stack = loadStack();
      if (stack.length > 1) { stack.pop(); saveStack(stack); }
      history.back();
    } else if (edge === 'right' && dx < -80) {
      history.forward();
    }
  }, { passive: true });

  /* ── 4) pull to refresh ── */
  function scrollerAtTop(el) {
    try {
      var n = el, depth = 0;
      while (n && n !== document.body && n !== document.documentElement && depth < 6) {
        if (n.scrollHeight && n.clientHeight && n.scrollHeight > n.clientHeight + 4 && n.scrollTop > 4) return false;
        n = n.parentElement; depth++;
      }
    } catch (e) {}
    return (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) <= 4;
  }
  var ptrEl = null, py = 0, pt = 0, ptrOn = false, pullDy = 0;
  var PTR_MIN_DY = 100;   // deliberate pull distance
  var PTR_MIN_MS = 400;   // deliberate pull duration (flicks are faster)
  function ptrBar() {
    if (!ptrEl) {
      ptrEl = document.createElement('div');
      ptrEl.id = 'droPtrBar';
      ptrEl.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;display:flex;justify-content:center;pointer-events:none;opacity:0;transition:opacity .15s';
      ptrEl.innerHTML = '<div style="margin-top:10px;background:#1a1730;color:#fff;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:700;font-family:system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)">⟳ Release to refresh</div>';
      (document.body || document.documentElement).appendChild(ptrEl);
    }
    return ptrEl;
  }
  function ptrHide() { if (ptrEl) ptrEl.style.opacity = '0'; }
  document.addEventListener('touchstart', function (e) {
    if (window.__noPullRefresh || e.touches.length !== 1) { ptrOn = false; return; }
    py = e.touches[0].clientY;
    pt = Date.now();
    pullDy = 0;
    ptrOn = scrollerAtTop(e.target);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!ptrOn || window.__noPullRefresh || e.touches.length !== 1) return;
    pullDy = e.touches[0].clientY - py;
    if (pullDy > 40) {
      // Fast flick = ordinary scrolling, not a pull — cancel so it can
      // never refresh (and never shows the hint).
      var speed = pullDy / Math.max(1, Date.now() - pt);
      if (speed > 0.5) { ptrOn = false; ptrHide(); return; }
    }
    if (pullDy > 16 && scrollerAtTop(e.target)) {
      var bar = ptrBar();
      bar.style.opacity = pullDy >= PTR_MIN_DY ? '1' : String(Math.min(0.9, pullDy / 120));
    } else if (pullDy <= 0) {
      ptrOn = false;
      ptrHide();
    }
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!ptrOn) { ptrHide(); return; }
    ptrOn = false;
    if (window.__noPullRefresh || pullDy < PTR_MIN_DY || Date.now() - pt < PTR_MIN_MS) { ptrHide(); return; }
    if (typeof window.__appRefresh === 'function') {
      try { window.__appRefresh(); } catch (e) { location.reload(); }
    } else {
      location.reload();
    }
    setTimeout(function () { ptrHide(); }, 600);
  }, { passive: true });
})();
