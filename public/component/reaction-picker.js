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
  *     getState: (id)   => ({ userRx, love: 40, crying: 12, angry: 3, ... }) | null,
  *     onReact:  (id, rid) => { ... a reaction was picked/changed/removed ... },
  *   });
  *
  *   // Anywhere inside the attached root:
  *   `<div>${DroboardReactionPicker.renderTrigger('post-1')}</div>`
  *
  * ── STATE OWNERSHIP (strict, no internal fallback) ──────────────────────
  * All reaction state lives in the HOST. getState(id) is the single source
  * of truth: return a state object for ids you own, or null to let another
  * binding claim them. The component NEVER stores counts, NEVER seeds demo
  * numbers, and NEVER mutates anything itself — onReact is the only write
  * path. An id no binding owns renders inert (zero counts, taps do nothing).
  *
  * Behaviour:
  *   • Tap the trigger  → toggles the "love" reaction (same as tapping ❤️ in the popup)
  *   • Hold the trigger → after ~550ms opens the reaction popup
  *   • Tap an emoji     → fires onReact(id, reactionId), moves the vote to
  *                        that reaction (only one active reaction per id)
  *   • Tap elsewhere    → closes any open popup
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
    .drp-like{display:contents}
    .drp-like-count{font-size:11px;font-weight:600}

    .drp-top3{display:flex;align-items:center;margin-right:1px}
    .drp-top3-emoji{display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:transparent;border:1.5px solid transparent;font-size:9px;line-height:1;margin-left:-6px;box-shadow:0 0 0 0 rgba(0,0,0,0)}
    .drp-top3-emoji:first-child{margin-left:0}
    .drp-top{display:inline-flex;align-items:center}
    .drp-top-emoji{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:transparent;border:1.5px solid transparent;font-size:9px;line-height:1;margin-left:-6px}
    .drp-top-emoji:first-child{margin-left:0}

     .drp-popup{position:absolute;bottom:40px;left:0;z-index:500;background:#13141a;border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:8px 8px;display:none;flex-wrap:wrap;gap:2px;width:268px;box-shadow:0 8px 32px rgba(0,0,0,.95);animation:drp-popIn .2s cubic-bezier(.34,1.56,.64,1)}
    .drp-popup.show{display:flex}
    @keyframes drp-popIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
    .drp-btn{flex:0 0 calc(20% - 2px);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:5px 2px;border-radius:12px;transition:.15s;user-select:none;box-sizing:border-box}
    .drp-btn:active{transform:scale(.88)}
    .drp-emoji{font-size:20px;line-height:1}
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

  /** Top N reactions (default 2) for a given state object:
   *   1. keep only reactions with count > 0
   *   2. sort by count, highest first
   *   3. take the first N
   * Returns an array of { id, emoji, label, count }. */
  function _topReactions(rx, n) {
    n = n || 2;
    return REACTIONS
      .map(r => ({ id: r.id, emoji: r.emoji, label: r.label, count: rx[r.id] || 0 }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /** HTML for the top-2 overlapping emoji badges shown beside the heart. */
  function _renderTop3Html(rx) {
    const top = _topReactions(rx, 2);
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
  // State — the component holds NO reaction counts. It resolves ownership
  // per id by asking each binding's getState. Reverse iteration so the most
  // recently attached binding wins ties. A binding OWNS an id iff its
  // getState returns a non-null object; otherwise the id passes to the next
  // binding. If no binding owns the id it is unowned → render inert, taps
  // are a no-op. No internal cache, no random demo numbers.
  // ══════════════════════════════════════════════════════════════════════
  let _bindings = []; // [{root, hooks}] — supports feed + comments + hubs on same page
  /** Returns { hooks, state } for the binding that owns `id`, or null. */
  function _resolve(id) {
    for (let i = _bindings.length - 1; i >= 0; i--) {
      const h = _bindings[i].hooks || {};
      if (typeof h.getState !== 'function') continue;
      let st = null;
      try { st = h.getState(id); } catch (e) { st = null; }
      if (st && typeof st === 'object') return { hooks: h, state: st };
    }
    return null;
  }
  function _getState(id) { const r = _resolve(id); return r ? r.state : null; }
  function _topRowModeFor(id) { const r = _resolve(id); return (r && r.hooks.topRow) || 'inline'; }

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════

  /**
   * renderTrigger(id, opts)
   *   id                  — unique id for the item this trigger belongs to
   *   opts.liked          — display seed used ONLY when no binding owns this
   *                          id (ephemeral, never stored): true = show as loved
   *   opts.likeCount       — display seed for the count when unowned (ephemeral)
   *   opts.icon            — Font Awesome icon name without prefix (default: 'heart')
   * Returns an HTML string — drop it anywhere inside the element passed to attach().
   * Once a binding owns `id`, its getState is the source of truth (opts ignored).
   */
  function renderTrigger(id, opts) {
    opts = opts || {};
    const icon = opts.icon || 'heart';

    let rx = _getState(id);
    if (!rx) {
      // Unowned id: render an inert display seeded from opts. Nothing is
      // stored and taps stay inert — real counts require an owning binding.
      rx = { userRx: opts.liked ? 'love' : null };
      REACTIONS.forEach(r => (rx[r.id] = 0));
      rx.love = opts.liked ? Math.max(1, opts.likeCount || 1) : (opts.likeCount || 0);
    }
    const total = _totalCount(rx);
    // Heart fills ONLY when Love itself is picked — other reactions show
    // via the emoji badges + count, not a filled heart.
    const liked = rx.userRx === 'love';

    return `<div class="drp-trigger${liked ? ' liked' : ''}" data-drp-id="${id}" data-drp-trigger="1">
      <div class="drp-popup" id="drp-pop-${id}">
        ${REACTIONS.map(r => `
          <div class="drp-btn${rx.userRx === r.id ? ' reacted' : ''}" data-drp-pid="${id}" data-drp-rid="${r.id}">
            <span class="drp-emoji">${r.emoji}</span>
            <span class="drp-count">${_fmtN(rx[r.id] || 0)}</span>
          </div>`).join('')}
      </div>
      ${_topRowModeFor(id) === 'external' ? '' : _renderTop3Html(rx)}
      <span class="drp-like"><i class="${liked ? 'fas' : 'far'} fa-${icon}" data-drp-icon="${icon}"></i><span class="drp-like-count">${_fmtN(total)}</span></span>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Reaction toggle — the single code path used by BOTH the quick heart
  // tap (rid='love') and every emoji tap in the popup, so the trigger's
  // combined total and the popup's per-emoji breakdown can never drift
  // apart from each other.
  // ══════════════════════════════════════════════════════════════════════
  function _toggleReaction(id, rid) {
    const r = _resolve(id);
    // No owning binding (or it can't write) → inert. State lives in the host.
    if (!r || typeof r.hooks.onReact !== 'function') return;
    r.hooks.onReact(id, rid);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DOM refresh helpers (used after a tap/react so the UI stays in sync
  // without requiring the host page to re-render the whole card)
  // ══════════════════════════════════════════════════════════════════════
  function _refreshPopup(id) {
    const pop = document.getElementById('drp-pop-' + id);
    if (!pop) return;
    const rx = _getState(id);
    if (!rx) return;
    pop.innerHTML = REACTIONS.map(r => `
      <div class="drp-btn${rx.userRx === r.id ? ' reacted' : ''}" data-drp-pid="${id}" data-drp-rid="${r.id}">
        <span class="drp-emoji">${r.emoji}</span>
        <span class="drp-count">${_fmtN(rx[r.id] || 0)}</span>
      </div>`).join('');
  }

  function _refreshTrigger(id) {
    const trigger = document.querySelector(`.drp-trigger[data-drp-id="${id}"]`);
    if (!trigger) return;
    const rx = _getState(id);
    if (!rx) return;
    const total = _totalCount(rx);
    const liked = rx.userRx === 'love';

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
    document.querySelectorAll('[data-drp-top="' + _escSel(id) + '"]').forEach(slot => {
      slot.innerHTML = _topInner(rx, 2);
    });

    // Rebuild the top-3 emoji row — counts (and therefore ranking/inclusion)
    // may have changed, so the whole badge set is regenerated in place.
    // Skipped entirely in external mode (badges live after share, synced above).
    if (_topRowModeFor(id) === 'external') return;
    const existingTop3 = trigger.querySelector('.drp-top3');
    const newTop3Html = _renderTop3Html(rx);
    if (existingTop3) {
      if (newTop3Html) {
        existingTop3.outerHTML = newTop3Html;
      } else {
        existingTop3.remove();
      }
    } else if (newTop3Html && ico) {
      // Anchor before .drp-like when present so badges land OUTSIDE the
      // pill wrapper — matching renderTrigger's initial placement (badges
      // are emitted before the wrapper there). Falls back to <i> for
      // legacy markup without the wrapper.
      const anchor = trigger.querySelector('.drp-like') || ico;
      anchor.insertAdjacentHTML('beforebegin', newTop3Html);
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
   * state object returned by the owning binding's getState(), same shape
   * getState/onReact use, e.g.:
   *   DroboardReactionPicker.update('post-1', { userRx: 'love', love: 41 });
   * getState is the source of truth — update() only re-reads it (and
   * optionally merges a patch onto that state object) then re-renders.
   */
  function update(id, patch) {
    const r = _resolve(id);
    if (r && patch) Object.assign(r.state, patch);
    _refresh(id);
  }

  function hideAllPopups() {
    document.querySelectorAll('.drp-popup.show').forEach(p => p.classList.remove('show'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // Events — delegated on the attached root
  // ══════════════════════════════════════════════════════════════════════
  function _bindEvents(root) {
    let holdTimer = null;
    let heldOpen = false; // true when this press opened the popup (long-press)
    let downX = 0, downY = 0;

    root.addEventListener('pointerdown', (e) => {
      const trigger = e.target.closest('[data-drp-trigger]');
      if (!trigger) return;
      heldOpen = false;
      clearTimeout(holdTimer);
      if (e.clientX !== undefined) { downX = e.clientX; downY = e.clientY; }
      holdTimer = setTimeout(() => {
        heldOpen = true;
        hideAllPopups();
        const pop = document.getElementById('drp-pop-' + trigger.dataset.drpId);
        if (pop) pop.classList.add('show');
        else { const t = root.querySelector('.drp-trigger[data-drp-id="' + trigger.dataset.drpId + '"] .drp-popup'); if (t) t.classList.add('show'); }
      }, 550);
    });

    // Drag/scroll during a press is not a tap — never open the popup for it.
    root.addEventListener('pointermove', (e) => {
      if (e.clientX === undefined) return;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 14) clearTimeout(holdTimer);
    });

    root.addEventListener('pointerup', () => { clearTimeout(holdTimer); });

    root.addEventListener('pointercancel', () => clearTimeout(holdTimer));

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.drp-btn');
      if (btn) {
        e.stopPropagation();
        const id = btn.dataset.drpPid;
        const rid = btn.dataset.drpRid;
        _toggleReaction(id, rid);
        _refresh(id);
        hideAllPopups();
        return;
      }
      // Plain tap on the trigger: if a non-love reaction is already picked,
      // deselect it (so one tap removes the custom reaction instead of
      // silently switching to Love and keeping the count unchanged). If
      // nothing is picked or Love itself is picked, toggle Love as before.
      if (e.target.closest('.drp-popup')) return;
      const trigger = e.target.closest('[data-drp-trigger]');
      if (!trigger || heldOpen) return;
      e.stopPropagation();
      const id = trigger.dataset.drpId;
      const st = _getState(id);
      const rid = (st && st.userRx && st.userRx !== 'love') ? st.userRx : 'love';
      _toggleReaction(id, rid);
      _refresh(id);
      hideAllPopups();
    });

    // Close popups on any outside tap (bound once globally)
    if (!window.__drpDocBound) {
      window.__drpDocBound = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-drp-trigger]') && !e.target.closest('.drp-popup')) {
          hideAllPopups();
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // attachCounters — high-level binding for hosts that just want
  // "counts in, counts out" without reimplementing the toggle math.
  //
  // The picker owns the state shape and the love/switch/deselect logic.
  // The host only supplies:
  //   getCounts(id) -> { userRx, love, crying, ... } | null
  //                   Initial state for this id (null = unknown id, picker
  //                   stays inert). Called once per id, then cached.
  //   save(id, state)  Called after every toggle with the new state so the
  //                   host can persist (localStorage/API) and refresh any
  //                   other UI (e.g. card total). state = same shape as
  //                   getCounts' return.
  //
  // This replaces the per-page copy-paste of the love/second/extra dance
  // that previously lived in feed/genre-hub/droboard-page/discussion/...
  // and was the source of "picking a non-love reaction does nothing" bugs.
  // ══════════════════════════════════════════════════════════════════════
  function attachCounters(rootEl, hooks) {
    hooks = hooks || {};
    const cache = {}; // id -> { userRx, counts: {love, crying, ...} }

    function ensure(id) {
      if (cache[id]) return cache[id];
      if (typeof hooks.getCounts !== 'function') return null;
      let init = null;
      try { init = hooks.getCounts(id); } catch (e) { init = null; }
      if (!init || typeof init !== 'object') return null; // unknown id → inert
      const counts = {};
      Object.keys(init).forEach(k => {
        if (k === 'userRx') return;
        const v = +init[k] || 0;
        if (v > 0) counts[k] = v; // drop zero/negative buckets so top-2 stays clean
      });
      cache[id] = { userRx: init.userRx || null, counts };
      return cache[id];
    }

    function toState(st) {
      const out = { userRx: st.userRx };
      Object.keys(st.counts).forEach(k => { out[k] = st.counts[k]; });
      return out;
    }

    // Forward the whole hooks object (e.g. topRow:'external') so host-level
    // options still reach the low-level binding; override the two we own.
    attach(rootEl, Object.assign({}, hooks, {
      getState(id) {
        const st = ensure(id);
        return st ? toState(st) : null;
      },
      onReact(id, rid) {
        const st = ensure(id);
        if (!st) return;
        rid = rid || 'love';
        const c = st.counts;
        if (st.userRx === rid) {
          // deselect current reaction
          c[rid] = Math.max(0, (c[rid] || 0) - 1);
          if (!c[rid]) delete c[rid];
          st.userRx = null;
        } else {
          // switch: decrement old, increment new, keep total stable
          if (st.userRx) {
            c[st.userRx] = Math.max(0, (c[st.userRx] || 0) - 1);
            if (!c[st.userRx]) delete c[st.userRx];
          }
          c[rid] = (c[rid] || 0) + 1;
          st.userRx = rid;
        }
        const state = toState(st);
        if (typeof hooks.save === 'function') {
          try { hooks.save(id, state); } catch (e) {}
        }
      },
    }));

    return {
      clear() { Object.keys(cache).forEach(k => delete cache[k]); },
    };
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
    if (!rootEl) return;
    if (_bindings.some(b => b.root === rootEl)) {
      const ex = _bindings.find(b => b.root === rootEl);
      ex.hooks = hooks || {};
      return;
    }
    _bindings.push({ root: rootEl, hooks: hooks || {} });
    _bindEvents(rootEl);
  }

  function topRowMode() { return (_bindings.length && _bindings[0].hooks.topRow) || 'inline'; }
  window.DroboardReactionPicker = {
    attach,
    attachCounters,
    renderTrigger,
    render: renderTrigger,   // alias, matches DroboardPostCard.render naming
    renderTop,
    topRowMode,
    update,
    hideAllPopups,
    REACTIONS,
  };

})();