/* ═══════════════════════════════════════════════════════════════
   CHAPTER REACTIONS — window.DroboardChapterReactions
   ───────────────────────────────────────────────────────────────
   The reaction surface that belongs at the END OF EACH CHAPTER.
   One active reaction per reader per chapter, persisted against the
   chapter — never the whole-book total.

   Backend contract:
     GET    /api/stories/:bookId/chapters/:key/reaction → { counts, userRx, likes }
     POST   /api/stories/:bookId/chapters/:key/reaction   { rid }
     DELETE /api/stories/:bookId/chapters/:key/reaction

   Hosts pass the initial state from the chapters list so the strip paints
   without an extra request:
     DroboardChapterReactions.mount(el, {
       storyId, chapterId, chapterN, counts, userRx
     })
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardChapterReactions) return;

  var FALLBACK = [
    { id: 'love', emoji: '❤️' }, { id: 'crying', emoji: '😭' },
    { id: 'angry', emoji: '😡' }, { id: 'shocked', emoji: '😱' },
    { id: 'broken', emoji: '💔' }, { id: 'emotional', emoji: '🥹' },
    { id: 'savage', emoji: '🔥' }, { id: 'sus', emoji: '👀' },
    { id: 'twist', emoji: '🫢' }, { id: 'laughing', emoji: '😂' },
  ];

  var STATES = {};   // story:chapter -> { counts, userRx }
  var BUSY = {};     // story:chapter -> true while a write is in flight

  function reactions() {
    var rp = window.DroboardReactionPicker;
    return (rp && Array.isArray(rp.REACTIONS) && rp.REACTIONS.length) ? rp.REACTIONS : FALLBACK;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  function fmtN(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function keyOf(o) {
    o = o || {};
    return String(o.storyId || '') + ':' + String(o.chapterId || o.chapterN || '');
  }
  function chapterKey(o) { return String(o.chapterId || o.chapterN || ''); }

  function normalizeCounts(c) {
    var out = {};
    if (c && typeof c === 'object') {
      // Lean Map fields can arrive as Map-like objects.
      var raw = (typeof c.toObject === 'function') ? c.toObject() : c;
      Object.keys(raw || {}).forEach(function (k) {
        if (k !== 'userRx' && k !== 'likes') out[k] = Math.max(0, Number(raw[k]) || 0);
      });
    }
    return out;
  }

  function getState(o) {
    var k = keyOf(o);
    if (!STATES[k]) STATES[k] = { counts: normalizeCounts(o.counts), userRx: o.userRx || null };
    return STATES[k];
  }

  function total(st) {
    return Object.keys(st.counts || {}).reduce(function (a, k) { return a + (Number(st.counts[k]) || 0); }, 0);
  }

  function buttonHtml(r, st) {
    var on = st.userRx === r.id;
    var n = (st.counts || {})[r.id] || 0;
    return '<button type="button" class="dcr-btn' + (on ? ' on' : '') + '" data-dcr-rid="' + esc(r.id) + '" ' +
      'aria-pressed="' + (on ? 'true' : 'false') + '" title="' + esc(r.label || r.id) + '">' +
      '<span class="dcr-emoji">' + r.emoji + '</span>' +
      '<span class="dcr-count">' + fmtN(n) + '</span>' +
      '</button>';
  }

  function paint(el, o) {
    if (!el) return;
    var st = getState(o);
    var list = reactions();
    var head = '<div class="dcr-label">React to this chapter</div>' +
      '<div class="dcr-row">' + list.map(function (r) { return buttonHtml(r, st); }).join('') + '</div>' +
      '<div class="dcr-err" data-dcr-err></div>';
    el.innerHTML = head;
    el.dataset.dcrTotal = String(total(st));
  }

  function repaintCounts(el, o) {
    var st = getState(o);
    var list = reactions();
    list.forEach(function (r) {
      var btn = el.querySelector('[data-dcr-rid="' + r.id + '"]');
      if (!btn) return;
      var on = st.userRx === r.id;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var c = btn.querySelector('.dcr-count');
      if (c) c.textContent = fmtN((st.counts || {})[r.id] || 0);
    });
    el.dataset.dcrTotal = String(total(st));
  }

  function showError(el, msg) {
    var box = el.querySelector('[data-dcr-err]');
    if (!box) return;
    box.textContent = msg || '';
    if (msg) setTimeout(function () { if (box.textContent === msg) box.textContent = ''; }, 3200);
  }

  function applyServerState(o, json) {
    if (!json || typeof json !== 'object') return;
    var k = keyOf(o);
    STATES[k] = {
      counts: normalizeCounts(json.counts),
      userRx: json.userRx || null,
    };
  }

  function write(el, o, nextRid, before) {
    var k = keyOf(o);
    if (BUSY[k]) return;
    BUSY[k] = true;
    var storyId = String(o.storyId || '');
    var ck = chapterKey(o);
    var base = '/api/stories/' + encodeURIComponent(storyId) + '/chapters/' + encodeURIComponent(ck) + '/reaction';
    var req = nextRid
      ? fetch(base, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rid: nextRid }),
        })
      : fetch(base, { method: 'DELETE', credentials: 'include' });

    req.then(function (res) {
      if (res.status === 401 || res.status === 403) {
        var e = new Error('Sign in to react to this chapter.');
        e.status = res.status;
        throw e;
      }
      if (!res.ok) throw new Error('Could not save reaction (' + res.status + ')');
      return res.json();
    }).then(function (json) {
      applyServerState(o, json);
      repaintCounts(el, o);
    }).catch(function (err) {
      // Revert the optimistic paint and surface the failure.
      var k2 = keyOf(o);
      STATES[k2] = before;
      repaintCounts(el, o);
      showError(el, err && err.status ? err.message : ((err && err.message) || 'Could not save reaction.'));
    }).then(function () {
      BUSY[k] = false;
    });
  }

  function onTap(el, o, rid) {
    var st = getState(o);
    var before = { counts: Object.assign({}, st.counts), userRx: st.userRx };
    var next = st.userRx === rid ? null : rid;
    // Optimistic toggle: the strip answers the tap immediately.
    if (st.userRx) {
      st.counts[st.userRx] = Math.max(0, (st.counts[st.userRx] || 0) - 1);
      if (!st.counts[st.userRx]) delete st.counts[st.userRx];
    }
    if (next) st.counts[next] = (st.counts[next] || 0) + 1;
    st.userRx = next;
    repaintCounts(el, o);
    write(el, o, next, before);
  }

  function bind(el, o) {
    if (el.__dcrBound) return;
    el.__dcrBound = true;
    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-dcr-rid]') : null;
      if (!btn || !el.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      // The same strip element is reused when the reader moves between
      // chapters (full reader) — always use the latest opts, not the ones
      // captured when this listener was first bound.
      var cur = el.__dcrOpts || o;
      onTap(el, cur, btn.getAttribute('data-dcr-rid'));
    });
  }

  function mount(el, opts) {
    if (!el) return;
    var o = Object.assign({}, opts || {});
    el.__dcrOpts = o;
    if (!o.storyId || !chapterKey(o)) {
      el.innerHTML = '<div class="dcr-label">React to this chapter</div><div class="dcr-err">Chapter reactions unavailable.</div>';
      return;
    }
    var k = keyOf(o);
    var haveCounts = opts && opts.counts && Object.keys(normalizeCounts(opts.counts)).length > 0;
    getState(o);
    paint(el, o);
    bind(el, o);
    // Initial state came in with the chapters payload; only fall back to a
    // request when the host had no counts at all.
    if (!haveCounts && !STATES[k]._fetched) {
      STATES[k]._fetched = true;
      fetch('/api/stories/' + encodeURIComponent(o.storyId) + '/chapters/' + encodeURIComponent(chapterKey(o)) + '/reaction', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
          if (!json) return;
          applyServerState(o, json);
          repaintCounts(el, o);
        })
        .catch(function () { /* counts stay at whatever the list supplied */ });
    }
  }

  // One global stylesheet; themed with the host page's CSS variables.
  function ensureStyle() {
    if (document.getElementById('dcr-style')) return;
    var st = document.createElement('style');
    st.id = 'dcr-style';
    st.textContent =
      '.dcr-wrap{max-width:680px;margin:20px auto 4px;padding:0 22px;text-align:center}' +
      '.dcr-label{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#71717a);margin-bottom:9px}' +
      '.dcr-row{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}' +
      '.dcr-btn{display:inline-flex;align-items:center;gap:4px;padding:7px 11px;border-radius:999px;' +
        'border:1.5px solid var(--bd,rgba(255,255,255,.12));background:var(--surface,#161616);' +
        'color:var(--tx,#f0f0f0);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;' +
        'transition:transform .15s,border-color .15s,background .15s;line-height:1;font-family:var(--font-ui,inherit)}' +
      '.dcr-btn:active{transform:scale(.94)}' +
      '.dcr-btn.on{border-color:rgba(255,0,80,.5);background:rgba(255,0,80,.14);color:#ff4d7a}' +
      '.dcr-emoji{font-size:14px;line-height:1}' +
      '.dcr-count{font-size:10px;font-weight:800;color:var(--muted,#9ca3af)}' +
      '.dcr-btn.on .dcr-count{color:inherit}' +
      '.dcr-err{font-size:10px;color:#f87171;margin-top:6px;min-height:12px}' +
      'body.theme-white .dcr-btn{background:#f5f5f5;border-color:rgba(0,0,0,.1);color:#111}' +
      'body.theme-white .dcr-count{color:#666}';
    document.head.appendChild(st);
  }
  ensureStyle();

  window.DroboardChapterReactions = { mount: mount, reactions: reactions };
})();
