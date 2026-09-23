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
