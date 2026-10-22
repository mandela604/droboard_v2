/**
 * theme-chrome.js — keeps <meta name="theme-color"> (browser address bar /
 * status bar tint) in sync with the ACTUAL rendered top-bar color of the page.
 *
 * How: reads the computed background of the page's header element (topbar /
 * top-bar / header), composites any alpha over the body color, writes the
 * hex to the theme-color meta. Re-syncs when data-theme or body class
 * (reader theme-white) changes, and after DOM ready.
 *
 * Include on any page:  <script src="../shared/theme-chrome.js"></script>
 * Works for dual-theme, dark-only, light-only and reader pages alike,
 * because it measures reality instead of assuming a palette.
 */
(function () {
  'use strict';

  var rafId = 0;

  function parse(css) {
    var m = String(css || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 };
  }

  function hex2(n) { n = Math.round(Math.max(0, Math.min(255, n))).toString(16); return n.length < 2 ? '0' + n : n; }

  function composite(fg, bg) {
    var a = fg.a;
    if (a >= 1 || !bg) return '#' + hex2(fg.r) + hex2(fg.g) + hex2(fg.b);
    var ba = bg.a == null ? 1 : bg.a;
    return '#' + hex2(fg.r * a + bg.r * (1 - a) * ba)
               + hex2(fg.g * a + bg.g * (1 - a) * ba)
               + hex2(fg.b * a + bg.b * (1 - a) * ba);
  }

  function sync() {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    var el = document.querySelector('.topbar, .top-bar, .header, .navbar, .appbar, .ces-topbar, .sa-topbar, .mss-topbar, .dso-topbar');
    if (!el || !el.offsetHeight) el = document.body || document.documentElement;
    var fg = parse(getComputedStyle(el).backgroundColor);
    var bg = document.body ? parse(getComputedStyle(document.body).backgroundColor) : null;
    var color = (fg && fg.a < 1 && bg) ? composite(fg, bg) : (fg ? composite(fg, null) : null);
    if (!color) return;
    var m = head.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      head.appendChild(m);
    }
    if (String(m.content).toUpperCase() !== color.toUpperCase()) m.content = color;
  }

  function schedule() {
    if (rafId) return;
    rafId = (window.requestAnimationFrame || setTimeout)(function () { rafId = 0; sync(); }, 50);
  }

  function boot() {
    sync();
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
    document.addEventListener('DOMContentLoaded', schedule);
    window.addEventListener('pageshow', schedule);
    /* Late layout settles (fonts/overlays) */
    setTimeout(sync, 300);
    setTimeout(sync, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
