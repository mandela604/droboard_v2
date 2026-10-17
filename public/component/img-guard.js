/* ═══════════════════════════════════════════════════════════════
   IMG-GUARD — app-proof images for web + Capacitor wrapper.
   Runs from <head> (no dependencies) so it catches failures early.

   1) referrerpolicy="no-referrer" on every <img> (existing + injected).
      Free hosts like postimg.cc often reject hotlinks based on the
      Referer header — stripping it fixes most "works on desktop,
      broken in app" covers.
   2) Capture-phase error listener: any image that still fails is
      swapped for a branded inline-SVG placeholder (avatar vs cover
      detected automatically). A broken icon is never shown.
   Pages can opt an image out with data-noguard.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__droImgGuard) return;
  window.__droImgGuard = true;

  var AVATAR_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
    '<rect width="96" height="96" rx="48" fill="#1a1730"/>' +
    '<circle cx="48" cy="36" r="16" fill="#ff0050" opacity=".85"/>' +
    '<path d="M18 84c6-18 18-26 30-26s24 8 30 26" fill="#ff0050" opacity=".45"/>' +
    '</svg>');

  var COVER_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1a0010"/><stop offset=".5" stop-color="#2a0025"/>' +
    '<stop offset="1" stop-color="#0d0020"/></linearGradient></defs>' +
    '<rect width="400" height="300" fill="url(#g)"/>' +
    '<text x="200" y="140" font-size="52" text-anchor="middle">📖</text>' +
    '<text x="200" y="180" font-size="20" fill="#f5f5f7" text-anchor="middle" font-family="sans-serif" font-weight="bold">Droboard</text>' +
    '</svg>');

  function isAvatar(img) {
    if (img.hasAttribute('data-avatar')) return true;
    var cls = '';
    try { cls = String(img.className || '').toLowerCase(); } catch (e) {}
    if (/av|avatar|profile|pravatar|thumb/.test(cls)) return true;
    var src = '';
    try { src = String(img.getAttribute('src') || img.src || '').toLowerCase(); } catch (e) {}
    if (/pravatar|avatar|profile|thumb/.test(src)) return true;
    var w = img.clientWidth || img.width || 0;
    var h = img.clientHeight || img.height || 0;
    if (w > 0 && w <= 112 && h > 0 && h <= 112 && Math.abs(w - h) <= 10) return true;
    return false;
  }

  function guard(img) {
    if (!img || img.nodeName !== 'IMG') return;
    if (img.hasAttribute('data-noguard') || img.dataset.imgGuarded) return;
    img.dataset.imgGuarded = '1';
    try { img.setAttribute('referrerpolicy', 'no-referrer'); } catch (e) {}
    // Late check: markup parsed before this script may already be broken.
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
      swap(img);
    }
  }

  function swap(img) {
    if (!img || img.dataset.imgGuarded === 'done') return;
    img.dataset.imgGuarded = 'done';
    try { img.src = isAvatar(img) ? AVATAR_PH : COVER_PH; } catch (e) {}
  }

  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.nodeName === 'IMG') swap(t);
  }, true);

  function sweep(root) {
    var list;
    try { list = (root || document).querySelectorAll('img'); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) guard(list[i]);
  }

  sweep(document);

  try {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.target && m.target.nodeName === 'IMG' && m.attributeName === 'src') {
          // src changed (retry by app code) — allow one more attempt.
          if (m.target.dataset.imgGuarded === 'done') m.target.dataset.imgGuarded = '1';
          guard(m.target);
        }
        var nodes = m.addedNodes || [];
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || !n.querySelectorAll) continue;
          if (n.nodeName === 'IMG') guard(n);
          sweep(n);
        }
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['src'],
    });
  } catch (e) { /* old webviews: static sweep already done */ }
})();
