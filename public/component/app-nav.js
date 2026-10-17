/* ═══════════════════════════════════════════════════════════════
   APP-NAV — native-feel navigation for the Capacitor wrapper.
   Safe no-op enhancements on plain web. Runs from <head>, no deps.

   1) BACK BUTTON — listens via @capacitor/app (guarded; retries until
      the native bridge is ready). Own sessionStorage stack tracks real
      depth: back walks history, and at the logical root a double-press
      shows "Press back again to exit" instead of killing the page.
   2) TAB DEDUPE — tapping the already-active bottom-nav tab scrolls to
      top instead of stacking a duplicate history entry.
   3) EDGE SWIPE — swipe in from the left edge = back, from the right
      edge = forward. Ignores inputs, carousels and horizontally
      scrollable strips. Opt out: window.__noEdgeSwipe = true.
   4) PULL TO REFRESH — pull down from the very top (window scroll or
      the page's own scroller, e.g. bridge .scroll-body) shows a slim
      spinner; release past threshold reloads. Opt out:
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

  function loadStack() {
    try { var s = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]'); return Array.isArray(s) ? s : []; }
    catch (e) { return []; }
  }
  function saveStack(s) {
    try { sessionStorage.setItem(STACK_KEY, JSON.stringify(s.slice(-30))); } catch (e) {}
  }
  var stack = loadStack();
  if (stack[stack.length - 1] !== HERE) { stack.push(HERE); saveStack(stack); }

  function toast(m) {
    var t = document.getElementById('droAppNavToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'droAppNavToast';
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:10px 18px;border-radius:20px;font-size:12.5px;font-weight:600;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;z-index:9999;font-family:system-ui,sans-serif';
      (document.body || document.documentElement).appendChild(t);
    }
    t.textContent = m;
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.style.opacity = '0'; }, 2000);
  }

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
  var exitArmed = false, exitTimer = null;
  function goBack() {
    stack = loadStack();
    if (stack.length > 1) {
      stack.pop();
      saveStack(stack);
      exitArmed = false;
      history.back();
      return;
    }
    if (!isNative()) { history.back(); return; }
    var App = appPlugin();
    if (exitArmed) {
      if (App && App.exitApp) { try { App.exitApp(); } catch (e) {} }
      return;
    }
    exitArmed = true;
    toast('Press back again to exit');
    clearTimeout(exitTimer);
    exitTimer = setTimeout(function () { exitArmed = false; }, 2000);
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

  /* ── 0) system chrome: app always sits BELOW the phone's own
     icons (native only, web no-op) ──
     The WebView is inset below the status bar, so page headers can
     never slide under the clock/battery — on any page, on scroll.
     Light page → bar painted warm cream (#F9EDE3, never white) with
     dark icons. Dark page → bar painted the page's own background
     color with white icons. */
  var DRO_LIGHT_STRIP = '#F9EDE3';
  var droOverlayMode = false; // never draw under the status bar
  function pageLum() {
    var bg = '#ffffff';
    try {
      bg = getComputedStyle(document.body).backgroundColor || bg;
      if (/rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(String(bg))) {
        bg = getComputedStyle(document.documentElement).backgroundColor || bg;
      }
    } catch (e) {}
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(bg));
    return m ? { lum: (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255, rgb: [+m[1], +m[2], +m[3]] } : { lum: 1, rgb: [255, 255, 255] };
  }
  function toHex(rgb) {
    try {
      return '#' + rgb.map(function (v) {
        var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return h.length === 1 ? '0' + h : h;
      }).join('');
    } catch (e) { return '#000000'; }
  }
  function applyChrome() {
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (!SB || !SB.setOverlaysWebView) return false;
      droOverlayMode = false;
      var info = pageLum();
      SB.setOverlaysWebView({ overlay: false });
      try {
        if (SB.setBackgroundColor) {
          SB.setBackgroundColor({ color: info.lum > 0.6 ? DRO_LIGHT_STRIP : toHex(info.rgb) });
        }
      } catch (e) {}
      try { if (SB.setStyle) SB.setStyle({ style: info.lum > 0.6 ? 'DARK' : 'LIGHT' }); } catch (e) {}
      try { scheduleSat(); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  if (!applyChrome()) {
    var sbTries = 0;
    var sbIv = setInterval(function () { sbTries++; if (applyChrome() || sbTries > 24) clearInterval(sbIv); }, 250);
  }
  // Delayed re-tunes: early calls can race page stylesheets.
  setTimeout(function () { try { applyChrome(); } catch (e) {} }, 1500);
  setTimeout(function () { try { applyChrome(); } catch (e) {} }, 3500);

  /* Some pages lack viewport-fit=cover in their meta tag (discover,
     library, feed). Without it the WebView letterboxes below the
     status bar (white strip) and env(safe-area-…) reports 0. Patching
     the meta at parse time (this script runs in <head>) takes effect
     before layout. Native only — website files untouched. */
  function ensureViewportFit() {
    if (!isNative()) return false;
    try {
      var m = document.querySelector('meta[name="viewport"]');
      if (!m) return false;
      var c = m.getAttribute('content') || '';
      if (/viewport-fit/.test(c)) return true;
      m.setAttribute('content', c + ', viewport-fit=cover');
      return true;
    } catch (e) { return false; }
  }
  ensureViewportFit();
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        ensureViewportFit();
        if (window.Capacitor) scheduleSat();
      });
    }
  } catch (e) {}

  /* Reads the live status-bar inset (px). Falls back to 28px when the
     WebView doesn't report safe-area (older devices). */
  function satProbe() {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;left:0;height:0;padding:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;';
      document.documentElement.appendChild(d);
      var h = d.offsetHeight || 0;
      d.remove();
      return h;
    } catch (e) { return 0; }
  }

  /* Dark icons on light pages, white icons on dark pages. */
  function tuneStatusIcons() {
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (!SB || !SB.setStyle) return;
      var bg = '#ffffff';
      try { bg = getComputedStyle(document.body).backgroundColor || bg; } catch (e) {}
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(bg));
      var lum = m ? (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255 : 1;
      SB.setStyle({ style: lum > 0.6 ? 'DARK' : 'LIGHT' });
    } catch (e) {}
  }

  /* Selectors whose own CSS already handles the notch (var(--safe-t)
     / env(safe-area-…)) — the engine must not pad those twice.
     Scanned once from same-origin stylesheets (CDN sheets throw and
     are skipped). */
  var safeSelCache = null;
  function safeAreaSelectors() {
    if (safeSelCache) return safeSelCache;
    var out = [];
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var rules;
        try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var r = rules[j];
          if (r && r.selectorText && r.cssText && /safe-area|safe-t/.test(r.cssText)) out.push(r.selectorText);
        }
      }
    } catch (e) {}
    safeSelCache = out;
    return out;
  }
  function alreadySafe(el) {
    var sels = safeAreaSelectors();
    for (var i = 0; i < sels.length; i++) {
      try { if (el.matches(sels[i])) return true; } catch (e) {}
    }
    return false;
  }

  /* Pads top bars by the inset. Matches by geometry, not class names,
     so it works on all 30+ pages without per-page edits: bars are
     short (10–160px), wide and touch the viewport top. Bottom navs,
     toasts, sheets and heroes never match.
     SCROLL SAFETY: static (in-flow) elements are padded ONLY while
     the page is at the very top — padding one mid-scroll is what
     stretched cards and scattered layouts. Sticky/fixed headers are
     viewport-stable so they can be padded on any pass. */
  /* True when a stylesheet fixes this element's height (e.g. the
     full-reader top bar, height:50px). Padding a fixed-height,
     border-box bar crushes its buttons instead of moving it — those
     bars must GROW (height + inset) instead. Same-origin sheets only;
     CDN sheets throw and are skipped. */
  function cssHeightFixed(el) {
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var rules;
        try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var r = rules[j];
          if (!r || !r.selectorText || !r.style) continue;
          var h;
          try { h = r.style.height; } catch (e) { continue; }
          if (!h || h === 'auto') continue;
          try { if (el.matches(r.selectorText)) return true; } catch (e) {}
        }
      }
    } catch (e) {}
    return false;
  }
  function padCandidate(el, inset, allowStatic) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag !== 'DIV' && tag !== 'HEADER' && tag !== 'NAV') return;
    if (el.dataset.droSat === String(inset)) return;
    // Never pad inside an already-padded bar (double spacing — the
    // discover search row and genre-hub air came from this).
    try {
      if (el.parentElement && el.parentElement.closest('[data-dro-sat]')) {
        el.dataset.droSat = String(inset);
        return;
      }
    } catch (e) {}
    if (alreadySafe(el)) { el.dataset.droSat = String(inset); return; }
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return; }
    var pos = cs.position;
    if (pos !== 'sticky' && pos !== 'fixed' && pos !== 'static') return;
    if (pos === 'static' && !allowStatic) return;
    var r;
    try { r = el.getBoundingClientRect(); } catch (e) { return; }
    if (r.top > inset + 24 || r.top < -2) return;
    if (r.height < 10 || r.height > 160) return;
    if (r.width < window.innerWidth * 0.5) return;
    try {
      // Re-pad from the ORIGINAL padding so rotation (inset change)
      // never stacks padding twice.
      var orig = el.dataset.droSatOrig !== undefined
        ? parseFloat(el.dataset.droSatOrig)
        : (parseFloat(cs.paddingTop) || 0);
      if (el.dataset.droSatOrig === undefined) el.dataset.droSatOrig = String(orig);
      el.style.paddingTop = (orig + inset) + 'px';
      if (cssHeightFixed(el)) {
        // Fixed-height bar: also grow it, else the padding crushes
        // the buttons (full-reader top bar).
        var h0 = el.dataset.droSatH0 !== undefined
          ? parseFloat(el.dataset.droSatH0)
          : el.offsetHeight;
        if (el.dataset.droSatH0 === undefined) el.dataset.droSatH0 = String(h0);
        el.style.height = (h0 + inset) + 'px';
      }
      el.dataset.droSat = String(inset);
    } catch (e) {}
  }
  /* Page-scoped corrections (native only, injected stylesheet —
     website files untouched):
     - scroll-reader .story-top designs its own notch room
       (safe-t + 70px); cap the notch part so the title doesn't float.
     - genre-hub stacks sticky rows at hardcoded tops (57/101px);
       shift them by the grown header so they don't slide under it.
     - full-reader .read-progress sits at var(--topbar-h); follow the
       grown top bar down. */
  function injectAppCss() {
    if (!isNative()) return;
    try {
      if (document.getElementById('droAppFix')) return;
      var pg = '';
      try { pg = (location.pathname.split('/').pop() || '').toLowerCase(); } catch (e) {}
      var css = '';
      if (pg === 'scroll-reader.html') {
        css += '.story-top{padding-top:calc(70px + min(var(--safe-t,10px),14px)) !important;}';
      }
      if (pg === 'genre-hub.html') {
        css += '.tabs{top:calc(57px + var(--dro-sat,0px)) !important;}'
          + '.sort-row{top:calc(101px + var(--dro-sat,0px)) !important;}'
          + '.floating-filters{top:calc(101px + var(--dro-sat,0px)) !important;}';
      }
      if (pg === 'full-reader.html') {
        css += '.read-progress{top:calc(var(--topbar-h) + var(--dro-sat,0px)) !important;}';
      }
      if (!css) return;
      var st = document.createElement('style');
      st.id = 'droAppFix';
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }
  function applySat(nodes) {
    if (!isNative()) return;
    injectAppCss();
    var inset = satProbe();
    // Below-the-bar mode reports 0 and needs no padding; only assume
    // 28px when actually drawing edge-to-edge.
    if (!inset || inset < 10) inset = droOverlayMode === false ? 0 : 28;
    try { document.documentElement.style.setProperty('--dro-sat', inset + 'px'); } catch (e) {}
    var allowStatic = (window.scrollY || window.pageYOffset || 0) <= 4;
    var list = nodes;
    if (!list) {
      try { list = document.body.querySelectorAll('div,header,nav'); } catch (e) { return; }
    }
    for (var i = 0; i < list.length; i++) padCandidate(list[i], inset, allowStatic);
    tuneStatusIcons();
  }

  var satTimer = null;
  function scheduleSat(nodes) {
    clearTimeout(satTimer);
    satTimer = setTimeout(function () { applySat(nodes); }, 350);
  }
  window.addEventListener('load', function () { scheduleSat(); });
  window.addEventListener('resize', function () { scheduleSat(); });
  window.addEventListener('orientationchange', function () { scheduleSat(); });
  window.addEventListener('focus', function () { scheduleSat(); });
  try {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { scheduleSat(); });
  } catch (e) {}
  try {
    // Cheap observer: only examines NEWLY added bars (a full-tree
    // computed-style sweep on every feed append is what caused the
    // scroll jank). Static content mid-scroll is never padded.
    new MutationObserver(function (muts) {
      if (!isNative()) return;
      var hits = [];
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'DIV' || n.tagName === 'HEADER' || n.tagName === 'NAV') hits.push(n);
          else if (n.querySelectorAll) {
            var inner = n.querySelectorAll('div,header,nav');
            for (var k = 0; k < inner.length && hits.length < 40; k++) hits.push(inner[k]);
          }
          if (hits.length >= 40) break;
        }
        if (hits.length >= 40) break;
      }
      if (hits.length) scheduleSat(hits);
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  try {
    // Theme toggles (body class / html data-theme) change page
    // luminance — re-pick strip vs edge-to-edge without a reload.
    var themeObs = new MutationObserver(function () {
      if (!isNative()) return;
      try { applyChrome(); } catch (e) {}
    });
    function watchTheme() {
      try {
        if (document.body) themeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      } catch (e) {}
    }
    if (document.body) watchTheme();
    else document.addEventListener('DOMContentLoaded', watchTheme);
    document.addEventListener('droboard-theme', function () { try { applyChrome(); } catch (e) {} });
  } catch (e) {}
  // First pass as early as possible (script runs in <head>).
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSat);
    else scheduleSat();
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
  var ptrEl = null, py = 0, ptrOn = false, pullDy = 0;
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
  document.addEventListener('touchstart', function (e) {
    if (window.__noPullRefresh || e.touches.length !== 1) { ptrOn = false; return; }
    py = e.touches[0].clientY;
    pullDy = 0;
    ptrOn = scrollerAtTop(e.target);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!ptrOn || window.__noPullRefresh || e.touches.length !== 1) return;
    pullDy = e.touches[0].clientY - py;
    if (pullDy > 12 && scrollerAtTop(e.target)) {
      var bar = ptrBar();
      bar.style.opacity = pullDy > 70 ? '1' : String(Math.min(0.9, pullDy / 90));
    } else if (pullDy <= 0) {
      ptrOn = false;
      if (ptrEl) ptrEl.style.opacity = '0';
    }
  }, { passive: true });
  document.addEventListener('touchend', function () {
    if (!ptrOn) { if (ptrEl) ptrEl.style.opacity = '0'; return; }
    ptrOn = false;
    if (window.__noPullRefresh || pullDy < 70) { if (ptrEl) ptrEl.style.opacity = '0'; return; }
    if (typeof window.__appRefresh === 'function') {
      try { window.__appRefresh(); } catch (e) { location.reload(); }
    } else {
      location.reload();
    }
    setTimeout(function () { if (ptrEl) ptrEl.style.opacity = '0'; }, 600);
  }, { passive: true });
})();
