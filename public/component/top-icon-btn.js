/**
 * top-icon-btn.js — Shared top-bar icon button style
 * ─────────────────────────────────────────────────────────────
 * Injects ONE global CSS class `.dro-icon-btn` so every top-bar
 * action button (notification bell, search, menu, gift/store) looks
 * identical on every page: circular, bordered, red-accented on tint.
 *
 * Usage: add  class="dro-icon-btn"  to any <button> or <a> in a top bar.
 *
 * Variants (add alongside dro-icon-btn):
 *   dro-icon-btn--acc   → red accent fill  (store/gift button)
 *   dro-icon-btn--dot   → shows the red notification dot
 *
 * Badge count:  place  <span class="dro-icon-btn__badge">3</span>  inside.
 *
 * <script src="../component/top-icon-btn.js"></script>
 */
(function () {
  'use strict';
  if (window.__droIconBtn) return;
  window.__droIconBtn = true;

  var CSS = [
    /* ── Base ── */
    '.dro-icon-btn{',
      'display:inline-flex;align-items:center;justify-content:center;',
      'width:36px;height:36px;border-radius:50%;',
      'background:var(--card,#fff);',
      'border:1px solid var(--bd,rgba(0,0,0,.12));',
      'color:var(--tx-muted,#555);',
      'font-size:15px;',
      'cursor:pointer;',
      'position:relative;',
      'flex-shrink:0;',
      'text-decoration:none;',
      'transition:transform .15s,background .15s,border-color .15s;',
      '-webkit-tap-highlight-color:transparent;',
    '}',

    /* ── Dark mode ── */
    '[data-theme="dark"] .dro-icon-btn{',
      'background:var(--l1,#0e0f13);',
      'border-color:var(--bd,rgba(255,255,255,.12));',
      'color:var(--tx-muted,#888);',
    '}',

    /* ── Press state ── */
    '.dro-icon-btn:active{transform:scale(.9)}',

    /* ── Accent variant (store / gift) ── */
    '.dro-icon-btn--acc{',
      'background:rgba(255,0,80,.08);',
      'border-color:rgba(255,0,80,.25);',
      'color:var(--acc,#ff0050);',
    '}',
    '[data-theme="dark"] .dro-icon-btn--acc{',
      'background:rgba(255,0,80,.12);',
      'border-color:rgba(255,0,80,.28);',
    '}',

    /* ── Notification dot (no count) ── */
    '.dro-icon-btn--dot::after{',
      'content:"";',
      'position:absolute;top:5px;right:5px;',
      'width:8px;height:8px;border-radius:50%;',
      'background:var(--acc,#ff0050);',
      'border:2px solid var(--card,#fff);',
      'pointer-events:none;',
    '}',
    '[data-theme="dark"] .dro-icon-btn--dot::after{',
      'border-color:var(--l1,#0e0f13);',
    '}',

    '.dro-icon-btn__badge{',
      'position:absolute;top:-2px;right:-2px;',
      'min-width:16px;height:16px;border-radius:8px;',
      'background:var(--acc,#ff0050);',
      'color:#fff;',
      'font-size:8px;font-weight:800;',
      'display:flex;align-items:center;justify-content:center;',
      'padding:0 3px;',
      'border:2px solid var(--card,#fff);',
      'pointer-events:none;',
      'line-height:1;',
    '}',
    '[data-theme="dark"] .dro-icon-btn__badge{',
      'border-color:var(--l1,#0e0f13);',
    '}',
    '.dro-icon-btn__badge:empty{display:none}',
  ].join('');

  function inject() {
    if (document.getElementById('dro-icon-btn-style')) return;
    var el = document.createElement('style');
    el.id = 'dro-icon-btn-style';
    el.textContent = CSS;
    (document.head || document.documentElement).appendChild(el);
  }

  if (document.head) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }

  window.DroIconBtn = { inject: inject };
})();
