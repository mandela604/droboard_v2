/**
 * tip-picker.js — Droboard Reusable Tip Component
 * ─────────────────────────────────────────────
 * A standalone, self-contained tip sheet that matches the Droboard visual
 * language (dark theme, #ff0050 accent, DM Sans, rounded pill controls) —
 * uses a "dtp-" prefix so it can drop into any Droboard page next to
 * reaction-picker.js without colliding with existing styles.
 *
 * WHAT IT BUILDS
 * ───────────────
 *  1. TIP SHEET
 *     • Header: 🪙 Tip <writer name>
 *     • Writer row (avatar + name + sub line)
 *     • Amount grid: 15 / 50 / 100 coins + a "Custom" pill that reveals
 *       an inline number input
 *     • Optional note field (collapsed behind a toggle)
 *     • Supporters row: a divider, then a stack of overlapping supporter
 *       avatars (+N badge for the overflow) and "N people have
 *       supported" — tapping it opens the full supporters list
 *     • Send Tip button
 *
 *  2. SUPPORTERS SHEET
 *     • Full scrollable list of everyone who has tipped this target
 *     • Tapping a supporter's name/avatar navigates to profile.html
 *
 * TWO WAYS TO SEND SUPPORT
 * ─────────────────────────
 * The sheet opens with a small mode switcher above the amount grid:
 *   • 🪙 Coin  — tip with in-app coins (15 / 50 / 100 + custom)
 *   • ₦ Cash   — support in the reader's local currency, defaulting to
 *                Naira (₦100 / ₦500 / ₦1,000 + custom). Pass a `getCurrency`
 *                hook to switch the symbol/code per user.
 *
 * USAGE
 * ─────
 *   <script src="tip-picker.js"></script>
 *
 *   DroboardTip.attach({
 *     getWriter:      (id) => ({ name:'Ada_Writes', avatar:'...', handle:'@ada_writes' }), // optional
 *     getSupporters:  (id) => [{ id, name, avatar, time }, ...],                            // optional (no amount needed — the list never displays it)
 *     getCurrency:    (id) => ({ symbol:'₦', code:'NGN' }),                                 // optional — defaults to Naira
 *     onSend:         (id, amount, note, mode) => { ... mode is 'coin' or 'cash' ... },      // optional
 *     profileUrl:     (supporter) => `profile.html?u=${supporter.id}`,                      // optional
 *   });
 *
 *   // Wire any existing tip button to:
 *   DroboardTip.open('story-1', { name:'Ada_Writes', avatar:'https://...' });
 *
 * Without any hooks, the component runs entirely standalone with demo
 * supporters and a local toast, exactly like reaction-picker.js does when
 * no hooks are supplied.
 */
(function () {
  'use strict';
  if (window.__droboardTipPicker) return;
  window.__droboardTipPicker = true;

  const COIN_AMOUNTS = [15, 50, 100];
  const CASH_AMOUNTS = [100, 500, 1000];
  const DEFAULT_CURRENCY = { symbol: '₦', code: 'NGN' };

  // ══════════════════════════════════════════════════════════════════════
  // CSS (dtp- prefixed, self-contained, falls back gracefully if the
  // host page hasn't defined --acc / --bg3 / --bd etc.)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .dtp-overlay{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .25s;}
    .dtp-overlay.show{opacity:1;pointer-events:auto}

    .dtp-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2601;max-width:480px;margin:0 auto;background:var(--bg3,#0a0a0d);border:1px solid var(--bd,rgba(255,255,255,.08));border-top:1px solid var(--bd,rgba(255,255,255,.08));border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);padding-bottom:max(18px,env(safe-area-inset-bottom,18px));font-family:'DM Sans',system-ui,sans-serif;color:var(--tx,#e0e0e0);max-height:88vh;overflow-y:auto;scrollbar-width:none;}
    .dtp-sheet::-webkit-scrollbar{display:none}
    .dtp-sheet.open{transform:translateY(0)}
    .dtp-handle{width:34px;height:4px;background:var(--bd,rgba(255,255,255,.15));border-radius:4px;margin:10px auto 4px}

    .dtp-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 12px}
    .dtp-hdr h3{font-size:14px;font-weight:800;color:var(--tx,#fff);display:flex;align-items:center;gap:7px;margin:0}
    .dtp-close{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--bd,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;cursor:pointer;flex-shrink:0;}
    .dtp-close:active{transform:scale(.92)}

    .dtp-writer-row{display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.04);border:1px solid var(--bd,rgba(255,255,255,.06));border-radius:12px;padding:11px;margin:0 16px 14px;}
    .dtp-writer-av{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,0,80,.3);flex-shrink:0;background:var(--acc-dim,rgba(255,0,80,.15));}
    .dtp-writer-info{flex:1;min-width:0}
    .dtp-writer-name{font-size:13px;font-weight:800;color:var(--tx,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dtp-writer-sub{font-size:10px;color:#666;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    .dtp-mode-tabs{display:flex;gap:6px;background:rgba(255,255,255,.04);border:1px solid var(--bd,rgba(255,255,255,.06));border-radius:12px;padding:4px;margin:0 16px 14px;}
    .dtp-mode-tab{flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:11.5px;font-weight:700;color:#888;cursor:pointer;transition:.18s;user-select:none;display:flex;align-items:center;justify-content:center;gap:5px;}
    .dtp-mode-tab.on{background:var(--acc,#ff0050);color:#fff;box-shadow:0 2px 10px var(--glow,rgba(255,0,80,.3));}

    .dtp-amt-label{font-size:9px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.08em;padding:0 16px 8px}
    .dtp-amt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 16px 4px}
    .dtp-amt-pill{position:relative;padding:11px 4px;border-radius:12px;cursor:pointer;border:1.5px solid var(--bd,rgba(255,255,255,.08));background:rgba(255,255,255,.03);text-align:center;transition:.16s;user-select:none;display:flex;flex-direction:column;align-items:center;gap:2px;}
    .dtp-amt-pill:active{transform:scale(.95)}
    .dtp-amt-pill.on{background:var(--acc-dim,rgba(255,0,80,.16));border-color:var(--acc,#ff0050);box-shadow:0 2px 10px var(--glow,rgba(255,0,80,.25));}
    .dtp-amt-num{font-size:14px;font-weight:800;color:var(--tx,#fff)}
    .dtp-amt-coin{font-size:10px}
    .dtp-amt-pill.on .dtp-amt-num{color:var(--acc,#ff0050)}
    .dtp-amt-pill.custom .dtp-amt-num{font-size:11px;font-weight:700;color:#888}
    .dtp-amt-pill.custom.on .dtp-amt-num{color:var(--acc,#ff0050)}

    .dtp-custom-wrap{padding:9px 16px 4px;display:none;}
    .dtp-custom-wrap.show{display:block}
    .dtp-custom-input-row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1.5px solid var(--acc-border,rgba(255,0,80,.3));border-radius:11px;padding:9px 13px;}
    .dtp-custom-input-row i{color:var(--acc,#ff0050);font-size:14px}
    .dtp-custom-input{flex:1;background:transparent;border:none;outline:none;color:var(--tx,#fff);font-family:inherit;font-size:14px;font-weight:700;}
    .dtp-custom-input::placeholder{color:#555;font-weight:500}

    .dtp-note-toggle{display:flex;align-items:center;gap:6px;padding:14px 16px 4px;font-size:11px;font-weight:700;color:#888;cursor:pointer;user-select:none;}
    .dtp-note-toggle i{font-size:11px;transition:transform .2s}
    .dtp-note-toggle.open i{transform:rotate(45deg)}
    .dtp-note-wrap{max-height:0;overflow:hidden;transition:max-height .3s ease,opacity .25s;opacity:0;padding:0 16px;}
    .dtp-note-wrap.open{max-height:120px;opacity:1;padding:8px 16px 4px;}
    .dtp-note{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--bd,rgba(255,255,255,.08));border-radius:11px;padding:9px 12px;color:var(--tx,#fff);font-family:inherit;font-size:12px;outline:none;resize:none;min-height:52px;box-sizing:border-box;}
    .dtp-note::placeholder{color:#444}

    .dtp-divider{height:1px;background:var(--bd,rgba(255,255,255,.06));margin:16px 16px 0}

    .dtp-supp-row{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;transition:.15s;}
    .dtp-supp-row:active{background:rgba(255,255,255,.03)}
    .dtp-supp-stack{display:flex;align-items:center;flex-shrink:0;}
    .dtp-supp-av{width:26px;height:26px;border-radius:50%;object-fit:cover;border:2px solid var(--bg3,#0a0a0d);margin-left:-9px;background:var(--acc-dim,rgba(255,0,80,.2));flex-shrink:0;}
    .dtp-supp-av:first-child{margin-left:0}
    .dtp-supp-more{width:26px;height:26px;border-radius:50%;border:2px solid var(--bg3,#0a0a0d);margin-left:-9px;background:#1c1d24;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#aaa;flex-shrink:0;}
    .dtp-supp-plus{width:26px;height:26px;border-radius:50%;border:2px dashed rgba(255,255,255,.2);margin-left:-9px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;flex-shrink:0;background:var(--bg3,#0a0a0d);}
    .dtp-supp-text{flex:1;font-size:11.5px;font-weight:700;color:#ccc;}
    .dtp-supp-text b{color:var(--tx,#fff)}
    .dtp-supp-chev{font-size:11px;color:#555;flex-shrink:0}

    .dtp-send-wrap{padding:14px 16px 0}
    .dtp-send{width:100%;background:var(--acc,#ff0050);color:#fff;border:none;padding:13px;border-radius:14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px var(--glow,rgba(255,0,80,.3));display:flex;align-items:center;justify-content:center;gap:7px;}
    .dtp-send:active{transform:scale(.98)}
    .dtp-send:disabled{opacity:.45;box-shadow:none;cursor:default}

    /* SUPPORTERS SHEET */
    .dtp-sup-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2610;max-width:480px;margin:0 auto;background:var(--bg3,#0a0a0d);border:1px solid var(--bd,rgba(255,255,255,.08));border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);height:78vh;display:flex;flex-direction:column;font-family:'DM Sans',system-ui,sans-serif;}
    .dtp-sup-sheet.open{transform:translateY(0)}
    .dtp-sup-hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 16px 12px;border-bottom:1px solid var(--bd,rgba(255,255,255,.06));}
    .dtp-sup-hdr h3{font-size:14px;font-weight:800;color:var(--tx,#fff);margin:0}
    .dtp-sup-list{flex:1;overflow-y:auto;padding:6px 10px calc(16px + env(safe-area-inset-bottom,0px));scrollbar-width:none;}
    .dtp-sup-list::-webkit-scrollbar{display:none}
    .dtp-sup-item{display:flex;align-items:center;gap:11px;padding:9px 6px;border-radius:11px;cursor:pointer;transition:.15s;}
    .dtp-sup-item:active{background:rgba(255,255,255,.04)}
    .dtp-sup-item-av{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--acc-dim,rgba(255,0,80,.2));}
    .dtp-sup-item-body{flex:1;min-width:0}
    .dtp-sup-item-name{font-size:12.5px;font-weight:700;color:var(--tx,#e0e0e0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dtp-sup-item-time{font-size:10px;color:#555;margin-top:1px}

    .dtp-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#111;border:1px solid var(--bd,rgba(255,255,255,.08));color:#e0e0e0;padding:8px 18px;border-radius:24px;font-size:12px;font-weight:600;z-index:2700;opacity:0;transition:.26s;pointer-events:none;white-space:nowrap;font-family:'DM Sans',system-ui,sans-serif;}
    .dtp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;

  // ══════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════
  let _hooks = {};
  let _built = false;
  let _curId = null;
  let _selectedAmount = null;
  let _customMode = false;
  let _mode = 'coin'; // 'coin' | 'cash'
  const _supportersCache = {}; // per-id demo supporters, so repeated opens stay stable

  // ══════════════════════════════════════════════════════════════════════
  // Utils
  // ══════════════════════════════════════════════════════════════════════
  function _fmtN(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0); }
  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _toast(msg) {
    // Prefer the host page's own toast() if it exists, so styling stays consistent
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const t = document.getElementById('dtp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  const DEMO_NAMES = ['Chioma_R', 'Emeka_Writes', 'Ada_Lover', 'Zara_M', 'Dami_Cole', 'Efe_O', 'Kemi_A', 'Sade_Reads', 'CampusQueen', 'Chiamaka_N', 'Ifeanyi_Story', 'Anon_Reader'];
  function _demoSupporters(id) {
    if (_supportersCache[id]) return _supportersCache[id];
    const count = 8 + Math.floor(Math.random() * 30);
    const list = [];
    for (let i = 0; i < count; i++) {
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] + (i > DEMO_NAMES.length ? '_' + i : '');
      list.push({
        id: 'u_' + i,
        name,
        avatar: `https://i.pravatar.cc/100?img=${(i * 7 + 3) % 70}`,
        time: `${1 + Math.floor(Math.random() * 20)}h ago`,
      });
    }
    _supportersCache[id] = list;
    return list;
  }

  function _getSupporters(id) {
    if (typeof _hooks.getSupporters === 'function') return _hooks.getSupporters(id) || [];
    return _demoSupporters(id);
  }

  function _getWriter(id, fallback) {
    if (typeof _hooks.getWriter === 'function') {
      const w = _hooks.getWriter(id);
      if (w) return w;
    }
    return fallback || { name: 'this writer', avatar: 'https://i.pravatar.cc/100?img=32', handle: '' };
  }

  function _getCurrency(id) {
    if (typeof _hooks.getCurrency === 'function') {
      const c = _hooks.getCurrency(id);
      if (c && c.symbol) return c;
    }
    return DEFAULT_CURRENCY;
  }

  function _profileUrl(supporter) {
    if (typeof _hooks.profileUrl === 'function') return _hooks.profileUrl(supporter);
    return `profile.html?u=${encodeURIComponent(supporter.id || supporter.name)}`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // DOM build (once)
  // ══════════════════════════════════════════════════════════════════════
  function _build() {
    if (_built) return;
    _built = true;

    const style = document.createElement('style');
    style.id = 'dtp-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'dtp-root';
    wrap.innerHTML = `
      <div class="dtp-overlay" id="dtp-overlay"></div>

      <div class="dtp-sheet" id="dtp-sheet">
        <div class="dtp-handle"></div>
        <div class="dtp-hdr">
          <h3><i class="fas fa-coins" style="color:var(--acc,#ff0050)"></i> Tip <span id="dtp-writer-name-hdr"></span></h3>
          <div class="dtp-close" id="dtp-close"><i class="fas fa-xmark"></i></div>
        </div>

        <div class="dtp-writer-row">
          <img class="dtp-writer-av" id="dtp-writer-av" src="" alt=""/>
          <div class="dtp-writer-info">
            <div class="dtp-writer-name" id="dtp-writer-name"></div>
            <div class="dtp-writer-sub" id="dtp-writer-sub"></div>
          </div>
        </div>

        <div class="dtp-mode-tabs" id="dtp-mode-tabs">
          <div class="dtp-mode-tab on" data-mode="coin"><i class="fas fa-coins" style="font-size:11px"></i> Coin</div>
          <div class="dtp-mode-tab" data-mode="cash"><span id="dtp-cash-tab-symbol">₦</span> Cash</div>
        </div>

        <div class="dtp-amt-label">Choose an amount</div>
        <div class="dtp-amt-grid" id="dtp-amt-grid"></div>
        <div class="dtp-custom-wrap" id="dtp-custom-wrap">
          <div class="dtp-custom-input-row">
            <span id="dtp-custom-icon">🪙</span>
            <input type="number" min="1" class="dtp-custom-input" id="dtp-custom-input" placeholder="Enter amount"/>
          </div>
        </div>

        <div class="dtp-note-toggle" id="dtp-note-toggle"><i class="fas fa-plus"></i> Add a note (optional)</div>
        <div class="dtp-note-wrap" id="dtp-note-wrap">
          <textarea class="dtp-note" id="dtp-note" rows="2" placeholder="Say something nice…"></textarea>
        </div>

        <div class="dtp-divider"></div>
        <div class="dtp-supp-row" id="dtp-supp-row">
          <div class="dtp-supp-stack" id="dtp-supp-stack"></div>
          <div class="dtp-supp-text" id="dtp-supp-text"></div>
          <i class="fas fa-chevron-right dtp-supp-chev"></i>
        </div>

        <div class="dtp-send-wrap">
          <button class="dtp-send" id="dtp-send" disabled><i class="fas fa-coins"></i> Send Tip</button>
        </div>
      </div>

      <div class="dtp-sup-sheet" id="dtp-sup-sheet">
        <div class="dtp-sup-hdr">
          <h3 id="dtp-sup-title">Supporters</h3>
          <div class="dtp-close" id="dtp-sup-close"><i class="fas fa-xmark"></i></div>
        </div>
        <div class="dtp-sup-list" id="dtp-sup-list"></div>
      </div>

      <div class="dtp-toast" id="dtp-toast"></div>
    `;
    document.body.appendChild(wrap);

    _bindStaticEvents();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Rendering pieces
  // ══════════════════════════════════════════════════════════════════════
  function _renderAmountGrid(id) {
    const grid = document.getElementById('dtp-amt-grid');
    const isCash = _mode === 'cash';
    const currency = _getCurrency(id);
    const amounts = isCash ? CASH_AMOUNTS : COIN_AMOUNTS;

    grid.innerHTML = amounts.map(a => `
      <div class="dtp-amt-pill" data-amt="${a}">
        <span class="dtp-amt-num">${isCash ? currency.symbol + _fmtN(a) : a}</span>
        ${isCash ? '' : `<span class="dtp-amt-coin">🪙</span>`}
      </div>`).join('') + `
      <div class="dtp-amt-pill custom" data-amt="custom">
        <span class="dtp-amt-num">Custom</span>
        <span class="dtp-amt-coin"><i class="fas fa-pen" style="font-size:8px"></i></span>
      </div>`;

    // Keep the custom-input icon and placeholder in sync with the active mode
    document.getElementById('dtp-custom-icon').textContent = isCash ? currency.symbol : '🪙';
    document.getElementById('dtp-custom-input').placeholder = isCash ? `Enter amount in ${currency.code}` : 'Enter amount';

    grid.querySelectorAll('.dtp-amt-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.dataset.amt;
        const customWrap = document.getElementById('dtp-custom-wrap');

        // Clicking Custom again while it's already open closes it back down —
        // this applies the same way whether we're in coin or cash mode, since
        // this handler is rebuilt fresh every time the grid re-renders.
        if (val === 'custom' && pill.classList.contains('on')) {
          pill.classList.remove('on');
          _customMode = false;
          _selectedAmount = null;
          customWrap.classList.remove('show');
          document.getElementById('dtp-custom-input').value = '';
          _syncSendBtn();
          return;
        }

        grid.querySelectorAll('.dtp-amt-pill').forEach(p => p.classList.remove('on'));
        pill.classList.add('on');
        if (val === 'custom') {
          _customMode = true;
          customWrap.classList.add('show');
          const inp = document.getElementById('dtp-custom-input');
          inp.focus();
          _selectedAmount = inp.value ? +inp.value : null;
        } else {
          _customMode = false;
          customWrap.classList.remove('show');
          _selectedAmount = +val;
        }
        _syncSendBtn();
      });
    });
  }

  function _switchMode(mode, id) {
    _mode = mode;
    _selectedAmount = null;
    _customMode = false;
    document.querySelectorAll('.dtp-mode-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === mode));
    document.getElementById('dtp-custom-wrap').classList.remove('show');
    document.getElementById('dtp-custom-input').value = '';
    _renderAmountGrid(id);
    _syncSendBtn();
    _updateSendBtnLabel(id);
  }

  function _updateSendBtnLabel(id) {
    const btn = document.getElementById('dtp-send');
    const currency = _getCurrency(id);
    if (_mode === 'cash') {
      btn.innerHTML = `<span style="font-size:14px;font-weight:800">${currency.symbol}</span> Send Support`;
    } else {
      btn.innerHTML = `<i class="fas fa-coins"></i> Send Tip`;
    }
  }

  function _renderSupportersRow(id) {
    const supporters = _getSupporters(id);
    const stack = document.getElementById('dtp-supp-stack');
    const text = document.getElementById('dtp-supp-text');
    const shown = supporters.slice(0, 3);
    const overflow = supporters.length - shown.length;

    stack.innerHTML = shown.map(s => `<img class="dtp-supp-av" src="${s.avatar}" loading="lazy" alt=""/>`).join('')
      + (overflow > 0
          ? `<div class="dtp-supp-more">+${overflow > 99 ? '99' : overflow}</div>`
          : (shown.length === 0 ? `<div class="dtp-supp-plus"><i class="fas fa-user-plus"></i></div>` : ''));

    if (supporters.length === 0) {
      text.innerHTML = `Be the <b>first</b> to support`;
    } else {
      text.innerHTML = `<b>${_fmtN(supporters.length)}</b> ${supporters.length === 1 ? 'person has' : 'people have'} supported`;
    }
  }

  function _syncSendBtn() {
    const btn = document.getElementById('dtp-send');
    const ok = _selectedAmount && _selectedAmount > 0;
    btn.disabled = !ok;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Static event bindings (bound once, work off the live _curId)
  // ══════════════════════════════════════════════════════════════════════
  function _bindStaticEvents() {
    document.getElementById('dtp-close').addEventListener('click', close);
    document.getElementById('dtp-overlay').addEventListener('click', close);

    document.querySelectorAll('.dtp-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.mode === _mode) return;
        _switchMode(tab.dataset.mode, _curId);
      });
    });

    document.getElementById('dtp-custom-input').addEventListener('input', (e) => {
      const v = e.target.value ? +e.target.value : null;
      _selectedAmount = v;
      _syncSendBtn();
    });

    document.getElementById('dtp-note-toggle').addEventListener('click', () => {
      const toggle = document.getElementById('dtp-note-toggle');
      const wrap = document.getElementById('dtp-note-wrap');
      const isOpen = wrap.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      if (isOpen) setTimeout(() => document.getElementById('dtp-note').focus(), 200);
    });

    document.getElementById('dtp-supp-row').addEventListener('click', () => {
      if (_curId !== null) openSupporters(_curId);
    });

    document.getElementById('dtp-send').addEventListener('click', _sendTip);

    document.getElementById('dtp-sup-close').addEventListener('click', closeSupporters);
  }

  function _sendTip() {
    if (!_curId || !_selectedAmount || _selectedAmount <= 0) return;
    const note = document.getElementById('dtp-note').value.trim();
    const writer = _getWriter(_curId);
    const currency = _getCurrency(_curId);

    if (typeof _hooks.onSend === 'function') {
      _hooks.onSend(_curId, _selectedAmount, note, _mode);
    } else {
      // Standalone demo mode: push "You" into the local supporters cache
      const list = _demoSupporters(_curId);
      list.unshift({ id: 'you', name: 'You', avatar: 'https://i.pravatar.cc/100?img=1', time: 'Just now' });
    }

    const amountLabel = _mode === 'cash' ? `${currency.symbol}${_fmtN(_selectedAmount)}` : `🪙 ${_selectedAmount}`;
    _toast(`${amountLabel} sent to ${writer.name}!`);
    close();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Supporters sheet
  // ══════════════════════════════════════════════════════════════════════
  function openSupporters(id) {
    const supporters = _getSupporters(id);
    document.getElementById('dtp-sup-title').textContent = `Supporters (${supporters.length})`;
    document.getElementById('dtp-sup-list').innerHTML = supporters.map(s => `
      <div class="dtp-sup-item" data-uid="${_esc(s.id || s.name)}">
        <img class="dtp-sup-item-av" src="${s.avatar}" loading="lazy" alt=""/>
        <div class="dtp-sup-item-body">
          <div class="dtp-sup-item-name">${_esc(s.name)}</div>
          <div class="dtp-sup-item-time">${_esc(s.time || '')}</div>
        </div>
        <i class="fas fa-chevron-right" style="font-size:10px;color:#444;flex-shrink:0"></i>
      </div>`).join('');

    document.querySelectorAll('#dtp-sup-list .dtp-sup-item').forEach((row, i) => {
      row.addEventListener('click', () => {
        const supporter = supporters[i];
        window.location.href = _profileUrl(supporter);
      });
    });

    document.getElementById('dtp-sup-sheet').classList.add('open');
  }
  function closeSupporters() {
    document.getElementById('dtp-sup-sheet').classList.remove('open');
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════
  function attach(hooks) {
    _hooks = hooks || {};
    _build();
  }

  /**
   * open(id, writerMeta)
   *   id          — unique id for the writer/story being tipped
   *   writerMeta  — optional { name, avatar, handle } used the first time
   *                 (or whenever getWriter() isn't supplied)
   */
  function open(id, writerMeta) {
    _build();
    _curId = id;
    _selectedAmount = null;
    _customMode = false;
    _mode = 'coin';

    const writer = _getWriter(id, writerMeta);
    const currency = _getCurrency(id);
    document.getElementById('dtp-writer-name-hdr').textContent = writer.name;
    document.getElementById('dtp-writer-av').src = writer.avatar;
    document.getElementById('dtp-writer-name').textContent = writer.name;
    document.getElementById('dtp-writer-sub').textContent = writer.handle || 'Support this writer';
    document.getElementById('dtp-cash-tab-symbol').textContent = currency.symbol;

    document.getElementById('dtp-note').value = '';
    document.getElementById('dtp-note-wrap').classList.remove('open');
    document.getElementById('dtp-note-toggle').classList.remove('open');
    document.getElementById('dtp-custom-wrap').classList.remove('show');
    document.getElementById('dtp-custom-input').value = '';
    document.querySelectorAll('.dtp-mode-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === 'coin'));

    _renderAmountGrid(id);
    _renderSupportersRow(id);
    _syncSendBtn();
    _updateSendBtnLabel(id);

    document.getElementById('dtp-overlay').classList.add('show');
    document.getElementById('dtp-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const sheet = document.getElementById('dtp-sheet');
    const overlay = document.getElementById('dtp-overlay');
    if (sheet) sheet.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    closeSupporters();
    document.body.style.overflow = '';
  }

  window.DroboardTip = {
    attach,
    open,
    close,
    openSupporters,
    closeSupporters,
    COIN_AMOUNTS,
    CASH_AMOUNTS,
    DEFAULT_CURRENCY,
  };

})();