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
 *   DroboardStatusRing.html(person, opts)  → ring markup
 *   DroboardStatusRing.apply(root)         → repaint after a dynamic render
 *   DroboardStatusRing.open(list, key)     → open the viewer defensively
 *
 * person: { id|handle|name, avatar, statuses, ring, isLive, isMine }
 * opts:   { size, pad, gap, gradient, gapColor, innerBg, own, attrs,
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

  /* Ask the shared store first, so every surface agrees on the same ring. */
  function ringFor(p) {
    var key = keyOf(p);
    try {
      if (window.StatusStore && key) {
        if (Array.isArray(p.statuses) && p.statuses.length) {
          var r = StatusStore.register(key, p.statuses, { isLive: p.isLive, isMine: p.isMine });
          if (r === 'ring-has' && (p.isLive || p.ring === 'ring-live')) return 'ring-live';
          return r;
        }
        var fromStore = StatusStore.ringOf(key);
        if (fromStore) return fromStore;
      }
    } catch (e) {}
    if (p.ring) return p.ring;
    return (Array.isArray(p.statuses) && p.statuses.length) ? 'ring-has' : 'ring-none';
  }

  function html(p, opts) {
    injectCss();
    p = p || {}; opts = opts || {};
    var size = opts.size || 44;
    var pad = opts.pad != null ? opts.pad : (size >= 56 ? 3 : 2);
    var gap = opts.gap != null ? opts.gap : (size >= 40 ? 2 : 1);
    var ring = opts.own ? 'ring-own' : ringFor(p);
    var key = opts.key != null ? opts.key : keyOf(p);

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

    return '<div class="dring ' + ring + '"' +
      (key ? ' data-status-ring="' + esc(key) + '"' : '') +
      (opts.attrs ? ' ' + opts.attrs : '') +
      ' style="' + style + '">' +
      '<div class="dring-inner' + (opts.innerClass ? ' ' + opts.innerClass : '') + '">' + inner + '</div>' +
      (opts.extraHtml || '') +
      '</div>';
  }

  /* Repaint stamped rings from the store after a dynamic render. */
  function apply(root) {
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
    html: html,
    apply: apply,
    open: open,
    ringFor: ringFor,
    keyOf: keyOf,
    GRADIENT: DEFAULT_GRAD,
  };
})();
