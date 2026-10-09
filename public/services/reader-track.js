/* ═══════════════════════════════════════════════════════════════
   READER TRACK — live reading telemetry for full/scroll readers.
   post(storyId, key, body): fire-and-forget POST to the chapter-progress
     endpoint (credentials; silent fail for anonymous/demo).
   session(storyId, key, words): chapter session — heartbeats accumulated
     time every 30s while the tab is visible, .finish() once at chapter
     end (sends pct 100 + words), .stop() flushes leftovers on leave.
     Opening ping registers the chapter row; chapters only earn read
     credit after real time (120s) or finish — opens alone don't count.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ReaderTrack) return;

  var API = '/api/stories';

  function post(storyId, key, body) {
    if (!storyId || !key) return Promise.resolve(null);
    try {
      return fetch(API + '/' + encodeURIComponent(storyId) + '/chapters/' + encodeURIComponent(key) + '/progress', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || { secondsSpent: 0 }),
      }).catch(function () {});
    } catch (e) { return Promise.resolve(null); }
  }

  function session(storyId, key, words) {
    var acc = 0, last = Date.now(), finishedSent = false, stopped = false;
    function drain() {
      var now = Date.now();
      var d = Math.max(0, Math.round((now - last) / 1000));
      last = now;
      return d;
    }
    function heartbeat() {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { last = Date.now(); return; }
      acc += drain();
      if (acc >= 30) { var s = acc; acc = 0; post(storyId, key, { secondsSpent: s }); }
    }
    var timer = setInterval(heartbeat, 10000);
    function stop() {
      if (stopped) return;
      stopped = true;
      try { clearInterval(timer); } catch (e) {}
      var total = drain() + acc;
      if (total > 0 && !finishedSent) post(storyId, key, { secondsSpent: total });
    }
    function finish() {
      if (finishedSent) return;
      finishedSent = true;
      acc += drain();
      var body = { secondsSpent: acc, pct: 100, finished: true };
      if (words) body.wordsRead = words;
      acc = 0;
      post(storyId, key, body);
    }
    post(storyId, key, { secondsSpent: 0 });
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () { last = Date.now(); });
    }
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pagehide', stop);
    return { finish: finish, stop: stop };
  }

  window.ReaderTrack = { post: post, session: session, entitlements: entitlements };

  /* Plan entitlements (daily/weekly/monthly/yearly/merge): caches the wallet
     answer; subscribers get window.DroboardAdsFree + ad slots hidden. */
  var _ent = null;
  function entitlements() {
    if (_ent) return Promise.resolve(_ent);
    try {
      return fetch('/api/wallet/entitlements', { credentials: 'include' }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (j) {
        _ent = j || null;
        if (_ent && _ent.adsFree) {
          window.DroboardAdsFree = true;
          try {
            var st = document.createElement('style');
            st.textContent = '.ad-slot,.dac-banner,.ad-slot-label,.ad-slot-lbl{display:none!important}';
            document.head.appendChild(st);
          } catch (e) {}
        }
        if (_ent && _ent.adsFreeEverywhere) window.DroboardAdsFreeEverywhere = true;
        return _ent;
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
})();
