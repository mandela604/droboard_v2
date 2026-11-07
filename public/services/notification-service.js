/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION SERVICE — the bell badge, everywhere
   ───────────────────────────────────────────────────────────────
   The only writer of a bell count chip in the app: reader pages, the
   author center and the staff consoles all include this one file.

   Numbers come from GET /api/notifications/unread-count → {count, chats}.
   With no reachable API the local demo log answers; with neither, the
   chip stays hidden. A bell never invents a count.

   The chip turns BLUE while an unread chat is part of the total. Every
   other notification keeps the accent its page already gave it.

   Markup contract:
     <span class="notif-dot">…</span>   number chip
     <span class="notif-count">…</span> number chip
     <span data-notif-count>…</span>    number chip (staff topbars)
     <span data-notif-dot></span>       colour-only dot, no number
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.NotifService) return;

  const API = '/api/notifications/unread-count';
  const POLL_INTERVAL = 60000;
  const LOG_KEY = 'dro_notif_log';
  const BLUE = '#2563eb';
  const CHIPS = '.notif-dot, .notif-count, [data-notif-count], .dro-icon-btn__badge';
  const DOTS = '[data-notif-dot]';

  let _timer = null;
  let _storage = null;
  let _observer = null;
  let _started = false;
  let _live = false;
  let _count = 0;
  let _chats = 0;

  /* ── where the numbers come from ─────────────────────────── */
  function localCounts() {
    const S = window.DroboardNotifStore;
    if (S && typeof S.unread === 'function') {
      const cats = typeof S.unreadByCat === 'function' ? S.unreadByCat() : {};
      return { count: S.unread(), chats: cats.messages || 0 };
    }
    try {
      const items = (JSON.parse(localStorage.getItem(LOG_KEY) || '{}').items) || [];
      return {
        count: items.reduce((n, i) => n + (i.unread ? 1 : 0), 0),
        chats: items.reduce((n, i) => n + (i.unread && i.type === 'direct_message' ? 1 : 0), 0),
      };
    } catch (e) { return { count: 0, chats: 0 }; }
  }

  function readCounts() {
    return fetch(API, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.count != null) { _live = true; return { count: d.count | 0, chats: d.chats | 0 }; }
        return localCounts();
      })
      .catch(localCounts);
  }

  /* ── one painter ─────────────────────────────────────────── */
  function tint(el, chat) {
    if (chat) { if (el.style.background !== BLUE) el.style.background = BLUE; }
    else if (el.style.background) el.style.removeProperty('background');
    if (el.classList.contains('is-chat') !== chat) el.classList.toggle('is-chat', chat);
  }

  function paint() {
    const chat = _chats > 0;
    const show = _count > 0;
    const label = _count > 99 ? '99+' : String(_count);
    document.querySelectorAll(CHIPS).forEach(el => {
      if (el.textContent !== label) el.textContent = label;
      const display = show ? (el.dataset.notifDisplay || 'flex') : 'none';
      if (el.style.display !== display) el.style.display = display;
      tint(el, chat);
    });
    document.querySelectorAll(DOTS).forEach(el => {
      const display = show ? '' : 'none';
      if (el.style.display !== display) el.style.display = display;
      tint(el, chat);
    });
  }

  function poll() {
    return Promise.resolve(readCounts()).then(n => {
      _count = n.count; _chats = n.chats;
      paint();
      return _count;
    }).catch(() => { _count = 0; _chats = 0; paint(); return 0; });
  }

  /* Staff topbars and late overlays render their chip after boot, so a
     chip that appears later still gets painted. Every write above is
     guarded, so observing our own mutations settles instead of looping. */
  function watch() {
    if (_observer || !window.MutationObserver || !document.body) return;
    let t = 0;
    _observer = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(paint, 150);
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (_started) return poll();
    _started = true;
    poll();
    watch();
    _timer = setInterval(poll, POLL_INTERVAL);
    /* a server event owns the numbers; a demo emit only repaints the log */
    window.addEventListener('dro:notification', poll);
    window.addEventListener('dro:notification-count', () => { if (_live) poll(); else { const n = localCounts(); _count = n.count; _chats = n.chats; paint(); } });
    window.addEventListener('focus', poll);
    window.addEventListener('pageshow', poll);
    /* another tab marked things read */
    _storage = e => { if (e.key === LOG_KEY) poll(); };
    window.addEventListener('storage', _storage);
    return Promise.resolve(_count);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_storage) { window.removeEventListener('storage', _storage); _storage = null; }
    if (_observer) { _observer.disconnect(); _observer = null; }
    _started = false;
  }

  window.NotifService = {
    start, stop, poll, paint,
    getCount: () => _count,
    getChats: () => _chats,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();