/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE
   Polls every 20s for unread count. Updates badge on all pages.
   When going live: set USE_API = true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';
  const POLL_INTERVAL = 20000;

  let _timer = null;
  let _count = 0;

  async function fetchCount() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/notifications/unread-count`);
      if (!res.ok) throw new Error('Notif API failed');
      const d = await res.json();
      return d.count;
    }
    await new Promise(r => setTimeout(r, 50));
    return 3;
  }

  function updateBadge() {
    document.querySelectorAll('.notif-dot').forEach(dot => {
      if (_count > 0) {
        dot.style.display = 'block';
        dot.textContent = _count > 9 ? '9+' : _count;
      } else {
        dot.style.display = 'none';
      }
    });
  }

  async function poll() {
    try {
      _count = await fetchCount();
      updateBadge();
    } catch (e) {
      console.error('[Notif] Poll failed:', e);
    }
  }

  function start() {
    stop();
    poll();
    _timer = setInterval(poll, POLL_INTERVAL);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  function getCount() { return _count; }

  window.NotifService = { start, stop, getCount, poll };
})();
