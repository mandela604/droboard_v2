/**
 * status-loader.js — guarantees the shared status viewer is present.
 * ────────────────────────────────────────────────────────────────
 * The status viewer is ONE component (public/component/status-viewer.js)
 * used by every surface: home row, feed row, comments, debates, profile.
 * Every page loads it under the same ?v= token, so one edit to the file
 * reaches every surface at once.
 *
 * If a page still ends up without it — a stale browser cache entry, an old
 * app bundle, a script request that failed — this re-fetches the component
 * with a cache-busting stamp so the click still works, instead of dying on
 * "status viewer unavailable".
 *
 * Exposes: window.ensureStatusViewer() → Promise<boolean>
 */
(function () {
  'use strict';

  var SRC = '../component/status-viewer.js';
  var pending = null;

  function ensureViewer() {
    if (typeof window.openStatusViewer === 'function') return Promise.resolve(true);
    if (pending) return pending;
    pending = new Promise(function (resolve) {
      // Clear any half-built instance so the re-fetch installs exactly one.
      var oldOv = document.getElementById('dsv2Ov');
      if (oldOv) oldOv.remove();
      var oldToast = document.getElementById('dsv2Toast');
      if (oldToast) oldToast.remove();
      try { delete window.__droboardStatusViewer; } catch (e) { window.__droboardStatusViewer = undefined; }

      var s = document.createElement('script');
      s.src = SRC + '?t=' + Date.now();
      s.onload = function () {
        resolve(typeof window.openStatusViewer === 'function');
      };
      s.onerror = function () {
        pending = null;
        resolve(false);
      };
      document.head.appendChild(s);
    });
    return pending;
  }

  // Its own global, not window.DroboardStatus — status-service.js replaces
  // that object wholesale and would wipe a method hung off it.
  window.ensureStatusViewer = ensureViewer;
})();
