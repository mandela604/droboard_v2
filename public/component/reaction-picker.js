/**
 * reaction-picker.js — Droboard Reusable Reaction Picker
 * ─────────────────────────────────────────────
 * Extracted from index.html's REACTIONS array + .rx-pop / .act-like
 * long-press system, generalized into a standalone component with the
 * same visual language as the other Droboard components (dac-, dpc-,
 * ptf- prefixed files) — this one uses a "drp-" prefix.
 *
 * REACTIONS — Love is now a first-class reaction alongside the rest:
 *   ❤️ Love · 😭 Crying · 😡 Angry · 😱 Shocked · 💔 Heartbroken ·
 *   🥹 Emotional · 🔥 Savage · 👀 Suspicious · 🫢 Plot Twist · 😂 Laughing
 *
 * ── UNIFIED COUNTING MODEL ──────────────────────────────────────────────
 * There is only ONE set of numbers per id: one count per reaction
 * (love, crying, angry, ...) plus which one (if any) the current user
 * picked (userRx). There is no separate "like count" anymore.
 *
 *   • The number shown next to the trigger heart = the SUM of every
 *     reaction's count (love + crying + angry + ... all added together).
 *   • The popup breaks that same total back down — each emoji shows its
 *     own individual count, and those counts always add up to the number
 *     on the trigger.
 *   • A quick tap on the trigger is just shorthand for picking "Love" —
 *     it runs through the exact same increment/decrement logic as tapping
 *     any other emoji in the popup, so it can never get out of sync with
 *     the popup's numbers.
 *   • Picking a new reaction moves the vote: the old reaction (if any) is
 *     decremented and the new one incremented, so a given id only ever
 *     contributes to ONE reaction's count at a time. Tapping the same
 *     reaction again removes the vote entirely.
 *
 * Usage
 * ─────
 *   <script src="reaction-picker.js"></script>
 *
 *   DroboardReactionPicker.attach(document.getElementById('feedArea'), {
 *     onReact:  (id, rid)   => { ... a reaction was picked/changed/removed ... },
 *     getState: (id)        => ({ userRx, love: 40, crying: 12, angry: 3, ... }),  // optional
 *   });
 *
 *   // Anywhere inside the attached root:
 *   `<div>${DroboardReactionPicker.renderTrigger('post-1', { liked:false, likeCount:42 })}</div>`
 *
 * Behaviour:
 *   • Tap the trigger  → toggles the "love" reaction (same as tapping ❤️ in the popup)
 *   • Hold the trigger → after ~550ms opens the reaction popup
 *   • Tap an emoji     → fires onReact(id, reactionId), moves the vote to
 *                        that reaction (only one active reaction per id)
 *   • Tap elsewhere    → closes any open popup
 *
 * Without any hooks supplied, the component runs entirely standalone,
 * keeping its own per-id reaction counts (seeded with random demo
 * numbers) — exactly like ad-card.js / post-card.js do when no hook
 * is given.
 */
(function () {
  'use strict';
  if (window.__droboardReactionPicker) return;
  window.__droboardReactionPicker = true;

  // ══════════════════════════════════════════════════════════════════════
  // REACTIONS — Love first, then index.html's original 8, plus 😂 Laughing
  // ══════════════════════════════════════════════════════════════════════
  const REACTIONS = [
    { id: 'love',      emoji: '❤️', label: 'Love' },
    { id: 'crying',    emoji: '😭', label: 'Crying' },
    { id: 'angry',     emoji: '😡', label: 'Angry' },
    { id: 'shocked',   emoji: '😱', label: 'Shocked' },
    { id: 'broken',    emoji: '💔', label: 'Heartbroken' },
    { id: 'emotional', emoji: '🥹', label: 'Emotional' },
    { id: 'savage',    emoji: '🔥', label: 'Savage' },
    { id: 'sus',       emoji: '👀', label: 'Suspicious' },
    { id: 'twist',     emoji: '🫢', label: 'Plot Twist' },
    { id: 'laughing',  emoji: '😂', label: 'Laughing' },
  ];

  // ══════════════════════════════════════════════════════════════════════
  // CSS (drp- prefixed, self-contained)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .drp-trigger{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#3f3f46;cursor:pointer;padding:5px 8px;border-radius:9px;user-select:none;position:relative;flex-shrink:0;font-family:'DM Sans',system-ui,sans-serif}
    .drp-trigger:active{background:rgba(255,255,255,.04)}
    .drp-trigger.liked{color:#ff0050}
    .drp-trigger i{font-size:13px}
    .drp-like-count{font-size:11px;font-weight:600}

    .drp-top3{display:flex;align-items:center;margin-right:1px}
    .drp-top3-emoji{display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#1c1d24;border:1.5px solid #0b0b0f;font-size:9px;line-height:1;margin-left:-6px;box-shadow:0 0 0 0 rgba(0,0,0,0)}
    .drp-top3-emoji:first-child{margin-left:0}
    .drp-top{display:inline-flex;align-items:center}
    .drp-top-emoji{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#1c1d24;border:1.5px solid #0b0b0f;font-size:9px;line-height:1;margin-left:-6px}
    .drp-top-emoji:first-child{margin-left:0}

    .drp-popup{position:absolute;bottom:40px;left:0;z-index:500;background:#13141a;border:1px solid rgba(255,255,255,.07);border-radius:36px;padding:8px 10px;display:none;flex-direction:row;gap:2px;box-shadow:0 8px 32px rgba(0,0,0,.95);animation:drp-popIn .2s cubic-bezier(.34,1.56,.64,1)}
    .drp-popup.show{display:flex}
    @keyframes drp-popIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
    .drp-btn{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:5px 6px;border-radius:12px;transition:.15s;user-select:none}
    .drp-btn:active{transform:scale(.88)}
    .drp-emoji{font-size:22px;line-height:1}
    .drp-count{font-size:8px;font-weight:700;color:#3f3f46;min-width:16px;text-align:center}
    .drp-btn.reacted .drp-count{color:#ff7a9a}
  `;

  // ══════════════════════════════════════════════════════════════════════
  // Utils
  // ══════════════════════════════════════════════════════════════════════
  function _fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0); }

  /** Sum of every reaction's count for a given state object — this is the
   *  single number shown on the trigger, and it's always exactly what the
   *  popup's individual counts add up to (since a vote only ever lives in
   *  one reaction bucket at a time). */
  function _totalCount(rx) {
    return REACTIONS.reduce((sum, r) => sum + (rx[r.id] || 0), 0);
  }

  /** Top N reactions (default 3) for a given state object:
   *   1. keep only reactions with count > 0
   *   2. sort by count, highest first
   *   3. take the first N
   * Returns an array of { id, emoji, label, count }. */
  function _topReactions(rx, n) {
    n = n || 3;
    return REACTIONS
      .map(r => ({ id: r.id, emoji: r.emoji, label: r.label, count: rx[r.id] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /** HTML for the top-3 overlapping emoji badges shown beside the heart. */
  function _renderTop3Html(rx) {
    const top = _topReactions(rx, 3);
    if (!top.length) return '';
    return `<span class="drp-top3">${top.map(r =>
      `<span class="drp-top3-emoji" title="${r.label}: ${_fmtN(r.count)}">${r.emoji}</span>`
    ).join('')}</span>`;
  }

  /** Inner badges for an external top-N slot (sits outside the trigger,
   *  e.g. after a card's share button). renderTop returns the full slot. */
  function _topInner(rx, n) {
    const top = _topReactions(rx, n || 2);
    if (!top.length) return '';
    return top.map(r =>
      `<span class="drp-top-emoji" title="${r.label}: ${_fmtN(r.count)}">${r.emoji}</span>`
    ).join('');
  }
  function renderTop(id, n) {
    let rx = null;
    try { rx = _getState(id); } catch (e) { rx = null; }
    if (!rx) return '';
    return `<span class="drp-top" data-drp-top="${id}">${_topInner(rx, n || 2)}</span>`;
  }
  function _escSel(s) {
    try { return (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(String(s)) : String(s); }
    catch (e) { return String(s); }
  }

  // ══════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════
  let _root = null;
  let _hooks = {};
  const _rxCache = {}; // per-id: { userRx, love, crying, angry, ... } — the ONLY counters

  function _defaultState(id) {
    if (!_rxCache[id]) {
      const o = { userRx: null };
      REACTIONS.forEach(r => (o[r.id] = Math.floor(Math.random() * 60) + 2));
      _rxCache[id] = o;
    }
    return _rxCache[id];
  }
  function _getState(id) {
    return (typeof _hooks.getState === 'function') ? _hooks.getState(id) : _defaultState(id);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════

  /**
   * renderTrigger(id, opts)
   *   id                  — unique id for the item this trigger belongs to
   *   opts.liked          — boolean, legacy seed: true means the user's
   *                          current reaction is "love" (only used the
   *                          FIRST time this id is rendered, to seed the
   *                          internal cache — ignored once state exists)
   *   opts.likeCount       — number, legacy seed for the "love" bucket's
   *                          starting count (same first-render-only rule)
   *   opts.icon            — Font Awesome icon name without prefix (default: 'heart')
   * Returns an HTML string — drop it anywhere inside the element passed to attach().
   */
  function renderTrigger(id, opts) {
    opts = opts || {};
    const icon = opts.icon || 'heart';

    // Seed the internal cache from legacy {liked, likeCount} props, but only
    // the first time we see this id — after that, the reaction state (however
    // it changed since) is the source of truth.
    if (!(id in _rxCache) && typeof _hooks.getState !== 'function') {
      const seeded = { userRx: opts.liked ? 'love' : null };
      REACTIONS.forEach(r => (seeded[r.id] = 0));
      seeded.love = opts.liked ? Math.max(1, opts.likeCount || 1) : (opts.likeCount || 0);
      _rxCache[id] = seeded;
    }

    const rx = _getState(id);
    const total = _totalCount(rx);
    const liked = !!rx.userRx; // trigger reads "active" whenever ANY reaction is picked

    return `<div class="drp-trigger${liked ? ' liked' : ''}" data-drp-id="${id}" data-drp-trigger="1">
      <div class="drp-popup" id="drp-pop-${id}">
        ${REACTIONS.map(r => `
          <div class="drp-btn${rx.userRx === r.id ? ' reacted' : ''}" data-drp-pid="${id}" data-drp-rid="${r.id}">
            <span class="drp-emoji">${r.emoji}</span>
            <span class="drp-count">${_fmtN(rx[r.id] || 0)}</span>
          </div>`).join('')}
      </div>
      ${_hooks.topRow === 'external' ? '' : _renderTop3Html(rx)}
      <i class="${liked ? 'fas' : 'far'} fa-${icon}" data-drp-icon="${icon}"></i>
      <span class="drp-like-count">${_fmtN(total)}</span>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Reaction toggle — the single code path used by BOTH the quick heart
  // tap (rid='love') and every emoji tap in the popup, so the trigger's
  // combined total and the popup's per-emoji breakdown can never drift
  // apart from each other.
  // ══════════════════════════════════════════════════════════════════════
  function _toggleReaction(id, rid) {
    if (typeof _hooks.onReact === 'function') {
      _hooks.onReact(id, rid);
      return;
    }
    const rx = _defaultState(id);
    if (rx.userRx === rid) {
      rx[rid] = Math.max(0, (rx[rid] || 0) - 1);
      rx.userRx = null;
    } else {
      if (rx.userRx) rx[rx.userRx] = Math.max(0, (rx[rx.userRx] || 0) - 1);
      rx[rid] = (rx[rid] || 0) + 1;
      rx.userRx = rid;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // DOM refresh helpers (used after a tap/react so the UI stays in sync
  // without requiring the host page to re-render the whole card)
  // ══════════════════════════════════════════════════════════════════════
  function _refreshPopup(id) {
    const pop = document.getElementById('drp-pop-' + id);
    if (!pop) return;
    const rx = _getState(id);
    pop.innerHTML = REACTIONS.map(r => `
      <div class="drp-btn${rx.userRx === r.id ? ' reacted' : ''}" data-drp-pid="${id}" data-drp-rid="${r.id}">
        <span class="drp-emoji">${r.emoji}</span>
        <span class="drp-count">${_fmtN(rx[r.id] || 0)}</span>
      </div>`).join('');
  }

  function _refreshTrigger(id) {
    const trigger = _root ? _root.querySelector(`.drp-trigger[data-drp-id="${id}"]`) : null;
    if (!trigger) return;
    const rx = _getState(id);
    const total = _totalCount(rx);
    const liked = !!rx.userRx;

    trigger.classList.toggle('liked', liked);
    const ico = trigger.querySelector('i');
    if (ico) {
      const iconName = ico.dataset.drpIcon || 'heart';
      ico.className = (liked ? 'fas' : 'far') + ' fa-' + iconName;
      ico.dataset.drpIcon = iconName;
    }
    const ct = trigger.querySelector('.drp-like-count');
    if (ct) ct.textContent = _fmtN(total);

    // Keep any external top-N slots for this id in sync (e.g. badges
    // rendered after a card's share button via renderTop).
    try {
      const rx2 = _getState(id);
      document.querySelectorAll('[data-drp-top="' + _escSel(id) + '"]').forEach(slot => {
        slot.innerHTML = _topInner(rx2, 2);
      });
    } catch (e) {}

    // Rebuild the top-3 emoji row — counts (and therefore ranking/inclusion)
    // may have changed, so the whole badge set is regenerated in place.
    // Skipped entirely in external mode (badges live after share, synced above).
    if (_hooks.topRow === 'external') return;
    const existingTop3 = trigger.querySelector('.drp-top3');
    const newTop3Html = _renderTop3Html(rx);
    if (existingTop3) {
      if (newTop3Html) {
        existingTop3.outerHTML = newTop3Html;
      } else {
        existingTop3.remove();
      }
    } else if (newTop3Html && ico) {
      ico.insertAdjacentHTML('beforebegin', newTop3Html);
    }
  }

  function _refresh(id) {
    _refreshTrigger(id);
    _refreshPopup(id);
  }

  /**
   * update(id, patch)
   * Public method for the host page to push a reaction-state change into
   * an already-rendered trigger (e.g. after its own data mutation),
   * without needing to re-render the whole card. `patch` merges onto the
   * internal cache the same shape getState()/onReact use, e.g.:
   *   DroboardReactionPicker.update('post-1', { userRx: 'love', love: 41 });
   * Only meaningful when no getState hook is supplied — if you provide
   * getState, that's your source of truth and update() just re-reads it.
   */
  function update(id, patch) {
    if (typeof _hooks.getState !== 'function') {
      _rxCache[id] = Object.assign({}, _defaultState(id), patch || {});
    }
    _refresh(id);
  }

  function hideAllPopups() {
    document.querySelectorAll('.drp-popup.show').forEach(p => p.classList.remove('show'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // Events — delegated on the attached root
  // ══════════════════════════════════════════════════════════════════════
  function _bindEvents() {
    let holdTimer = null;
    let isHolding = false;

    _root.addEventListener('pointerdown', (e) => {
      const trigger = e.target.closest('[data-drp-trigger]');
      if (!trigger) return;
      isHolding = false;
      holdTimer = setTimeout(() => {
        isHolding = true;
        hideAllPopups();
        document.getElementById('drp-pop-' + trigger.dataset.drpId)?.classList.add('show');
      }, 550);
    });

    _root.addEventListener('pointerup', (e) => {
      clearTimeout(holdTimer);
      const trigger = e.target.closest('[data-drp-trigger]');
      if (!trigger || isHolding || e.target.closest('.drp-popup')) return;

      // A quick tap is just "love" going through the exact same toggle
      // path as picking an emoji from the popup — same counts, same rules.
      const id = trigger.dataset.drpId;
      _toggleReaction(id, 'love');
      _refresh(id);
    });

    _root.addEventListener('pointercancel', () => clearTimeout(holdTimer));

    _root.addEventListener('click', (e) => {
      const btn = e.target.closest('.drp-btn');
      if (!btn) return;
      e.stopPropagation();

      const id = btn.dataset.drpPid;
      const rid = btn.dataset.drpRid;

      _toggleReaction(id, rid);
      _refresh(id);
      hideAllPopups();
    });

    // Close popups on any outside tap
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-drp-trigger]') && !e.target.closest('.drp-popup')) {
        hideAllPopups();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════
  function attach(rootEl, hooks) {
    if (!document.getElementById('drp-style')) {
      const style = document.createElement('style');
      style.id = 'drp-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    _root = rootEl;
    _hooks = hooks || {};
    _bindEvents();
  }

  function topRowMode() { return _hooks.topRow || 'inline'; }
  window.DroboardReactionPicker = {
    attach,
    renderTrigger,
    render: renderTrigger,   // alias, matches DroboardPostCard.render naming
    renderTop,
    topRowMode,
    update,
    hideAllPopups,
    REACTIONS,
  };

})();