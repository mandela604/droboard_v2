/* ── Shared UI Helpers JS ── */
/* Include on any page: <script src="../shared/ui-helpers.js"></script> */

/**
 * Show loading spinner on a button.
 * @param {HTMLElement|string} btn - button element or ID
 * @param {string} [loadingText] - text to show while loading (icon replaced by spinner)
 */
function showBtnLoading(btn, loadingText) {
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn) return;
  btn.classList.add('loading');
  btn._origHtml = btn.innerHTML;
  if (loadingText) btn.innerHTML = '<span class="btn-text">' + loadingText + '</span>';
}

/**
 * Remove loading spinner from a button.
 * @param {HTMLElement|string} btn - button element or ID
 */
function hideBtnLoading(btn) {
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn) return;
  btn.classList.remove('loading');
  if (btn._origHtml) btn.innerHTML = btn._origHtml;
}

/**
 * Run an action with loading spinner on one or more buttons.
 * @param {HTMLElement|HTMLElement[]|string|string[]} btns - button(s) to spin
 * @param {number} delay - ms to wait before completing
 * @param {Function} callback - function to call after delay
 * @param {string} [loadingText] - text to show while loading
 */
function withBtnLoading(btns, delay, callback, loadingText) {
  if (!Array.isArray(btns)) btns = [btns];
  btns.forEach(b => showBtnLoading(b, loadingText));
  setTimeout(() => {
    btns.forEach(b => hideBtnLoading(b));
    if (callback) callback();
  }, delay);
}

/* ── Staff gate for moderation UI (pin/unpin, etc.) ──
   Reads an explicit role override first (dro_staff_role = admin |
   moderator | user). DEMO-OPEN default: demo sessions act as staff so
   moderation UI is testable. Live: resolve from AuthSession/user.roles
   AND enforce server-side — the client flag only hides the menu item. */
window.canModerate = function () {
  try {
    const r = String(localStorage.getItem('dro_staff_role') || '').toLowerCase();
    if (r === 'admin' || r === 'moderator' || r === 'mod') return true;
    if (r === 'user' || r === 'reader' || r === 'member') return false;
  } catch (e) {}
  return true;
};

/* ── ScrollKeep: keep list-page scroll across back-navigation ──
   Usage: ScrollKeep.arm() first thing in page init; ScrollKeep.restore()
   after first render. Saves scrollY on pagehide; restores it (once content
   exists) only on back/forward or reload — fresh visits start at top, and
   the browser's own (too-early) restoration is disabled so it can't fight. */
window.ScrollKeep = (function () {
  'use strict';
  function key() { return 'dro_scrollkeep_' + location.pathname + location.search; }
  function navType() {
    try {
      const n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      return (n && n.type) || '';
    } catch (e) { return ''; }
  }
  function arm() {
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    window.addEventListener('pagehide', function () {
      try { sessionStorage.setItem(key(), String(window.scrollY || 0)); } catch (e) {}
    });
  }
  function restore() {
    let y = 0;
    try { y = parseInt(sessionStorage.getItem(key()) || '0', 10) || 0; } catch (e) {}
    const nav = navType();
    if (!y || (nav !== 'back_forward' && nav !== 'reload')) return;
    const apply = function () { try { window.scrollTo(0, y); } catch (e) {} };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { requestAnimationFrame(apply); });
    } else apply();
    // Second pass after images settle — skipped if the user already moved.
    setTimeout(function () {
      try { if ((window.scrollY || 0) === y) window.scrollTo(0, y); } catch (e) {}
    }, 350);
  }
  return { arm: arm, restore: restore };
})();
