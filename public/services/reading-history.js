/* ===============================================================
   READING HISTORY — local read ledger (demo until backend read-state
   lands). Readers record chapter views + time; recommendation gates
   read from here. Call-and-render safe: no DOM, no init needed.
   =============================================================== */
(function () {
  'use strict';

  var KEY = 'dro_read_hist';
  var SEED_KEY = 'dro_read_hist_seeded';
  var MIN_CHAPTERS = 3;
  var MIN_SECONDS = 720; // 12 minutes

  var _lastId = null;
  var _lastTs = 0;

  // Seed demo reading history once so recommendation gate is testable.
  function seedDemo() {
    try {
      if (localStorage.getItem(SEED_KEY)) return;
      var seeded = { st1: { ch: [1,2,3,4,5], sec: 900 }, st2: { ch: [1,2,3], sec: 800 }, st3: { ch: [1,2,3,4,5,6,7], sec: 1200 } };
      localStorage.setItem(KEY, JSON.stringify(seeded));
      localStorage.setItem(SEED_KEY, '1');
    } catch (e) {}
  }
  seedDemo();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function save(hist) {
    try { localStorage.setItem(KEY, JSON.stringify(hist)); } catch (e) {}
  }
  function sid(id) { return String(id == null ? '' : id); }

  // Record viewing chapter chN of storyId; accrues wall time since last touch.
  function touch(storyId, chN) {
    try {
      var id = sid(storyId);
      if (!id) return;
      var now = Date.now();
      var hist = load();
      var rec = hist[id] || { ch: [], sec: 0 };
      if (_lastId && _lastTs && now > _lastTs) {
        var prev = hist[_lastId] || { ch: [], sec: 0 };
        prev.sec = (prev.sec || 0) + Math.min(600, Math.round((now - _lastTs) / 1000));
        hist[_lastId] = prev;
      }
      var n = parseInt(chN, 10);
      if (!isNaN(n) && rec.ch.indexOf(n) === -1) rec.ch.push(n);
      hist[id] = rec;
      save(hist);
      _lastId = id;
      _lastTs = now;
    } catch (e) {}
  }

  function stats(storyId) {
    var rec = load()[sid(storyId)] || { ch: [], sec: 0 };
    // fold any open session time into the reading
    if (_lastId === sid(storyId) && _lastTs) {
      rec = { ch: rec.ch.slice(), sec: rec.sec + Math.min(600, Math.round((Date.now() - _lastTs) / 1000)) };
    }
    return { chapters: rec.ch.length, seconds: rec.sec || 0 };
  }

  function meetsBar(storyId) {
    var s = stats(storyId);
    return s.chapters >= MIN_CHAPTERS && s.seconds >= MIN_SECONDS;
  }

  // Gate for recommending a story. Returns true when allowed; otherwise
  // toasts the requirement and returns false (caller must block).
  function guardRecommend(storyId, title) {
    if (!storyId) return true;
    if (meetsBar(storyId)) return true;
    var msg = '📖 Read at least up to 3 chapters of a story to recommend the story';
    if (title) msg += ' — keep reading "' + title + '"';
    if (typeof window.toast === 'function') window.toast(msg);
    return false;
  }

  window.ReadingHistory = {
    touch: touch,
    stats: stats,
    meetsBar: meetsBar,
    guardRecommend: guardRecommend,
    MIN_CHAPTERS: MIN_CHAPTERS,
    MIN_SECONDS: MIN_SECONDS,
  };
})();
