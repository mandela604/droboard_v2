/**
 * status-ring.js — the ONE status ring used by every surface.
 * ───────────────────────────────────────────────────────────
 * Home row, feed stories, comments, debates, people-to-follow, writers row,
 * profile, discussion, bridge and readers all render their avatar ring from
 * here, so a visual fix lands everywhere from one file.
 *
 * State is NOT owned here. The viewer's StatusStore is the single source of
 * truth (per-status seen state, persisted in dro_status_viewed_v2). Every ring
 * is stamped with data-status-ring="<author key>", and StatusStore.applyAll()
 * repaints them — so viewing a status turns every copy of that person's ring
 * grey at once, on every surface.
 *
 * Usage:
 *   DroboardStatusRing.avatar(person, opts) → THE one call an avatar makes:
 *       asks "does this person have statuses?" and answers with border,
 *       no-border, and a working tap-to-play in the same markup.
 *   DroboardStatusRing.html(person, opts)  → ring markup only (surfaces that
 *       already own their tap, e.g. the feed story row)
 *   DroboardStatusRing.apply(root)         → repaint after a dynamic render
 *   DroboardStatusRing.open(list, key)     → open the viewer defensively
 *
 * person: { id|handle|name, avatar, statuses, ring, isLive, isMine }
 * opts:   { size, pad, gap, gradient, gapColor, innerBg, own, attrs, pointer,
 *           innerClass, innerHtml, extraHtml }
 *   gradient — full CSS gradient for the red state (default linear story look)
 *   gapColor — colour of the cut between ring and avatar (defaults to --bg)
 *   extraHtml — live dot / verified badge / plus button, appended inside ring
 */
(function () {
  'use strict';
  if (window.DroboardStatusRing) return;

  var DEFAULT_GRAD = 'linear-gradient(135deg,#ff0050,#ff4d7a 55%,#ff7a9a)';

  var CSS = [
    '.dring{position:relative;flex-shrink:0;border-radius:50%;box-sizing:border-box;',
    'width:var(--dring-size,44px);height:var(--dring-size,44px);padding:var(--dring-pad,2px);',
    'background:var(--dring-grad,linear-gradient(135deg,#ff0050,#ff4d7a 55%,#ff7a9a));',
    'transition:transform .2s,background .2s;-webkit-tap-highlight-color:transparent}',
    '.dring:active{transform:scale(.96)}',
    '.dring.ring-none{background:var(--dring-none,transparent)}',
    '.dring.ring-viewed{background:var(--dring-viewed,var(--tx-muted,#9ca3af))}',
    '.dring.ring-has,.dring.ring-live{background:var(--dring-grad,linear-gradient(135deg,#ff0050,#ff4d7a 55%,#ff7a9a))}',
    '.dring.ring-live{box-shadow:0 0 12px rgba(255,0,80,.55)}',
    '.dring.ring-own{background:none}',
    '.dring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;box-sizing:border-box;',
    'background:var(--dring-bg,var(--bg,#000));border:var(--dring-gap,2px) solid var(--dring-gap-color,var(--bg,#000));',
    'display:flex;align-items:center;justify-content:center}',
    '.dring-inner img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
    '.dring-initial{width:100%;height:100%;display:flex;align-items:center;justify-content:center;',
    'font-size:calc(var(--dring-size,44px) * .34);font-weight:800;color:#fff}',
    '.dring.ring-own .dring-inner{border-style:dashed;border-color:var(--dring-own,var(--tx-muted,#666))}',
  ].join('');

  function injectCss() {
    if (document.getElementById('dringCss')) return;
    var s = document.createElement('style');
    s.id = 'dringCss';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function keyOf(p) { return p.key || p.id || p.handle || p.name || ''; }

  /* The seen-state key. The viewer stores every author under their NAME, so
     a surface's own row/comment id must never win here — that splits one
     person's state across surfaces and the ring can't read back "viewed". */
  function authorKeyOf(p, override) {
    if (override) return override;
    return p.name || p.handle || p.id || p.key || '';
  }

  /* The whole rule, in one place:
       no lineup     → no border (and so no click to fail)
       some unseen   → red
       all finished  → grey, from the shared store every surface reads
     The store is asked with the author's REAL lineup, so the border and the
     tap always describe the same set of slides. */
  function ringFor(p, keyOverride) {
    var key = authorKeyOf(p || {}, keyOverride);
    var statuses = lineupFor(p, key);
    if (!statuses.length) return 'ring-none';
    try {
      if (window.StatusStore && key) {
        var r = StatusStore.register(key, statuses, { isLive: p.isLive, isMine: p.isMine });
        if (r === 'ring-has' && (p.isLive || p.ring === 'ring-live')) return 'ring-live';
        if (r) return r;
      }
    } catch (e) {}
    if (p.ring) return p.ring;
    return 'ring-has';
  }

  /* The status service is the only place that knows who has statuses.
     Asking it here means no surface ever guesses again — and a person with
     no lineup gets NO border, which is the third state the rule demands. */
  function lineupFor(p, key) {
    if (p && Array.isArray(p.statuses) && p.statuses.length) return p.statuses;
    var who = key || (p && (p.name || p.handle || p.id));
    try {
      return (window.DroboardStatus && window.DroboardStatus.writerStatuses(who)) || [];
    } catch (e) { return []; }
  }

  function html(p, opts) {
    injectCss();
    p = p || {}; opts = opts || {};
    var size = opts.size || 44;
    var pad = opts.pad != null ? opts.pad : (size >= 56 ? 3 : 2);
    var gap = opts.gap != null ? opts.gap : (size >= 40 ? 2 : 1);
    var ring = opts.own ? 'ring-own' : ringFor(p, opts.personKey || opts.key);
    // The repaint stamp must be the SAME key ringFor() consulted, or a
    // surface that renders red would never be found by the viewed repaint.
    var key = authorKeyOf(p, opts.personKey || opts.key);

    var inner = opts.innerHtml;
    if (inner == null) {
      inner = p.avatar
        ? '<img src="' + esc(p.avatar) + '" loading="lazy" alt=""/>'
        : '<div class="dring-initial" style="background:' + esc(p.initialBg || 'rgba(255,0,80,.25)') + '">' +
          esc((p.name || '?').charAt(0).toUpperCase()) + '</div>';
    }

    var style = '--dring-size:' + size + 'px;--dring-pad:' + pad + 'px;--dring-gap:' + gap + 'px;';
    if (opts.gradient) style += '--dring-grad:' + opts.gradient + ';';
    if (opts.gapColor) style += '--dring-gap-color:' + opts.gapColor + ';';
    if (opts.innerBg) style += '--dring-bg:' + opts.innerBg + ';';
    if (opts.viewedBg) style += '--dring-viewed:' + opts.viewedBg + ';';
    if (opts.noneBg) style += '--dring-none:' + opts.noneBg + ';';
    if (opts.ownBorder) style += '--dring-own:' + opts.ownBorder + ';';
    if (opts.extraStyle) style += opts.extraStyle;
    if (opts.pointer) style += 'cursor:pointer;';

    return '<div class="dring ' + ring + '"' +
      (key ? ' data-status-ring="' + esc(key) + '"' : '') +
      (opts.attrs ? ' ' + opts.attrs : '') +
      ' style="' + style + '">' +
      '<div class="dring-inner' + (opts.innerClass ? ' ' + opts.innerClass : '') + '">' + inner + '</div>' +
      (opts.extraHtml || '') +
      '</div>';
  }

  /* ── Tap-to-play, wired once for every surface ──
     avatar() stamps the ring with data-status-open and parks the exact
     lineup here, so the tap replays what the border promised. Surfaces that
     already own their tap (story row, comment threads) use html() instead and
     are never touched by this listener. */
  var _openers = {};
  var _clicksOn = false;

  function bindClicks() {
    if (_clicksOn || typeof document === 'undefined') return;
    _clicksOn = true;
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-status-open]');
      if (!el) return;
      var entry = _openers[el.getAttribute('data-status-open')];
      if (!entry || !entry.statuses.length) return;
      e.preventDefault();
      e.stopPropagation();
      /* A page may want to play this author inside its own group (swipe to
         the next person) — same chain-never-clobber contract as
         window.onStatusViewerChange. Return true from it to take the tap. */
      try {
        if (typeof window.onStatusAvatarTap === 'function' &&
            window.onStatusAvatarTap(entry, entry.id) === true) return;
      } catch (err) {}
      open([entry], entry.id);
    }, true);
  }

  /* THE call. One question, one answer, no local guessing:
       has statuses  → red/grey border from the store + tap plays them
       no statuses   → no border, no pointer, the surface's own tap still runs */
  function avatar(p, opts) {
    p = p || {}; opts = opts || {};
    var key = authorKeyOf(p, opts.personKey || opts.key);
    var statuses = lineupFor(p, key);
    if (!statuses.length) {
      return html({ name: p.name, handle: p.handle, id: p.id, avatar: p.avatar,
                    initialBg: p.initialBg, statuses: [], ring: 'ring-none' }, opts);
    }
    _openers[key] = {
      id: key, name: p.name || key, handle: p.handle || '', avatar: p.avatar || '',
      statuses: statuses, ring: 'ring-has', isLive: !!p.isLive, isMine: !!p.isMine,
      likes: 0, threads: statuses.length,
    };
    bindClicks();
    var withStamp = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) withStamp[k] = opts[k];
    withStamp.attrs = (opts.attrs ? opts.attrs + ' ' : '') + 'data-status-open="' + esc(key) + '"';
    withStamp.pointer = true;
    return html({ name: p.name, handle: p.handle, id: p.id, key: p.key, avatar: p.avatar,
                  initialBg: p.initialBg, statuses: statuses, ring: p.ring,
                  isLive: p.isLive, isMine: p.isMine }, withStamp);
  }

  /* Repaint stamped rings from the store after a dynamic render. */
  function apply(root) {
    bindClicks();
    try { if (window.StatusStore && StatusStore.applyAll) StatusStore.applyAll(root); } catch (e) {}
  }

  /* Single open path: recover a missing viewer, then open at `key`. */
  function open(list, key, opts) {
    opts = opts || {};
    return Promise.resolve()
      .then(function () {
        if (typeof window.openStatusViewer === 'function') return true;
        return window.ensureStatusViewer ? window.ensureStatusViewer() : false;
      })
      .then(function (ready) {
        if (!ready) {
          if (typeof opts.onMissing === 'function') opts.onMissing();
          return false;
        }
        window.openStatusViewer(list, key);
        return true;
      })
      .catch(function () { return false; });
  }

  window.DroboardStatusRing = {
    avatar: avatar,
    html: html,
    apply: apply,
    open: open,
    ringFor: ringFor,
    lineupFor: lineupFor,
    keyOf: keyOf,
    GRADIENT: DEFAULT_GRAD,
  };
})();
