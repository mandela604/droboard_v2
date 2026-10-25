/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE — the bell badge
   ───────────────────────────────────────────────────────────────
   Reads the unread count from the shared store (window.DroboardNotifStore
   when loaded, otherwise its localStorage log directly) and paints every
   .notif-dot on the page. No hardcoded counts, no second data source.
   Live: POST-free — the count comes from GET /api/notifications/unread
   once the backend owns the log; swap readCount() only.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';
  const POLL_INTERVAL = 60000;
  const LOG_KEY = 'dro_notif_log';

  let _timer = null;
  let _count = 0;

  function readCount() {
    if (USE_API) return fetch(`${API_BASE}/notifications/unread`, { credentials: 'include' }).then(r => r.json()).then(d => d.count | 0);
    if (window.DroboardNotifStore) return window.DroboardNotifStore.unread();
    try {
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
      return (log.items || []).reduce((n, i) => n + (i.unread ? 1 : 0), 0);
    } catch (e) { return 0; }
  }

  function paint() {
    document.querySelectorAll('.notif-dot').forEach(dot => {
      if (_count > 0) { dot.style.display = 'block'; dot.textContent = _count > 9 ? '9+' : _count; }
      else { dot.style.display = 'none'; dot.textContent = ''; }
    });
  }

  function poll() {
    try { _count = readCount(); } catch (e) { console.error('[Notif] count failed:', e); _count = 0; }
    paint();
    return _count;
  }

  function start() {
    stop();
    poll();
    _timer = setInterval(poll, POLL_INTERVAL);
    window.addEventListener('dro:notification-count', poll);
    window.addEventListener('focus', poll);
    /* another tab marked things read */
    _storage = function (e) { if (e.key === LOG_KEY) poll(); };
    window.addEventListener('storage', _storage);
  }

  let _storage = null;
  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_storage) window.removeEventListener('storage', _storage);
  }

  function getCount() { return _count; }

  window.NotifService = { start, stop, getCount, poll };
})();
