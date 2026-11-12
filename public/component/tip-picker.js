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
 *     getWriter:      (id) => ({ id, name:'Ada_Writes', avatar:'...', handle:'@ada_writes' }), // optional
 *     getAuthorId:    (id) => 'usr_author_id',                                              // optional — the wallet target for this story
 *     getSupporters:  (id) => [{ id, name, avatar, time }, ...],                            // optional — else GET /api/wallet/tips/:authorId
 *     getCurrency:    (id) => ({ symbol:'₦', code:'NGN' }),                                 // optional — defaults to Naira
 *     onSent:         (id, amount, note, mode, giftId) => { ... },                          // optional — UI refresh AFTER the wallet accepted the tip
 *     getTargetId:    (id) => 'platform',                                                   // optional — wallet id gifts are posted to (defaults to the author id)
 *     profileUrl:     (supporter) => `profile.html?u=${supporter.id}`,                      // optional
 *   });
 *
 *   // Wire any existing tip button to:
 *   DroboardTip.open('story-1', { id:'usr_author_id', name:'Ada_Writes', avatar:'https://...' });
 *
 * Tips are sent to the live wallet (`POST /api/wallet/tip`), the balance comes
 * from `GET /api/wallet/balance`, gifts from `GET /api/wallet/store`, and the
 * supporters list from `GET /api/wallet/tips/:authorId`. There is no local
 * coin ledger and no demo supporters: with no backend answer the sheet shows
 * the real empty state instead of inventing people or coins.
 */
(function () {
  'use strict';
  if (window.__droboardTipPicker) return;
  window.__droboardTipPicker = true;

  const COIN_AMOUNTS = [15, 50, 100];
  const CASH_AMOUNTS = [100, 500, 1000];
  const DEFAULT_CURRENCY = { symbol: '$', code: 'USD' };
  /* No local catalog: gifts are whatever the store API serves. An empty list
     means the store has no active gifts and the tab says so. */
  const API_BASE = '/api';
  const AVATAR_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
    '<rect width="80" height="80" rx="40" fill="#2a2a2a"/>' +
    '<circle cx="40" cy="31" r="14" fill="#555"/>' +
    '<path d="M12 72c3-16 14-24 28-24s25 8 28 24" fill="#555"/></svg>');

  // ══════════════════════════════════════════════════════════════════════
  // CSS (dtp- prefixed, self-contained, falls back gracefully if the
  // host page hasn't defined --acc / --bg3 / --bd etc.)
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .dtp-overlay{position:fixed;inset:0;z-index:2600;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .25s;}
    .dtp-overlay.show{opacity:1;pointer-events:auto}

    .dtp-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2601;max-width:480px;margin:0 auto;background:var(--l1);border:1px solid var(--bd);border-top:1px solid var(--bd);border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);padding-bottom:max(18px,env(safe-area-inset-bottom,18px));font-family:'DM Sans',system-ui,sans-serif;color:var(--tx);max-height:88vh;overflow-y:auto;scrollbar-width:none;}
    .dtp-sheet::-webkit-scrollbar{display:none}
    .dtp-sheet.open{transform:translateY(0)}
    .dtp-handle{width:34px;height:4px;background:var(--bd);border-radius:4px;margin:10px auto 4px}

    .dtp-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 12px}
    .dtp-hdr h3{font-size:14px;font-weight:800;color:var(--tx);display:flex;align-items:center;gap:7px;margin:0}
    .dtp-close{width:28px;height:28px;border-radius:50%;background:var(--l2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--tx-muted);cursor:pointer;flex-shrink:0;}
    .dtp-close:active{transform:scale(.92)}

    .dtp-writer-row{display:flex;align-items:center;gap:11px;background:var(--l2);border:1px solid var(--bd);border-radius:12px;padding:11px;margin:0 16px 14px;}
    .dtp-writer-av{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,0,80,.3);flex-shrink:0;background:var(--glow-sm);}
    .dtp-writer-info{flex:1;min-width:0}
    .dtp-writer-name{font-size:13px;font-weight:800;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dtp-writer-sub{font-size:10px;color:var(--tx-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    .dtp-mode-tabs{display:flex;gap:6px;background:var(--l2);border:1px solid var(--bd);border-radius:12px;padding:4px;margin:0 16px 14px;}
    .dtp-mode-tab{flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:11.5px;font-weight:700;color:var(--tx-muted);cursor:pointer;transition:.18s;user-select:none;display:flex;align-items:center;justify-content:center;gap:5px;}
    .dtp-mode-tab.on{background:var(--acc);color:#fff;box-shadow:0 2px 10px var(--glow);}

    .dtp-amt-label{font-size:9px;font-weight:800;color:var(--tx-muted);text-transform:uppercase;letter-spacing:.08em;padding:0 16px 8px}
    .dtp-amt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 16px 4px}
    .dtp-amt-pill{position:relative;padding:11px 4px;border-radius:12px;cursor:pointer;border:1.5px solid var(--bd);background:var(--l2);text-align:center;transition:.16s;user-select:none;display:flex;flex-direction:column;align-items:center;gap:2px;}
    .dtp-amt-pill:active{transform:scale(.95)}
    .dtp-amt-pill.on{background:var(--glow-sm);border-color:var(--acc);box-shadow:0 2px 10px var(--glow);}
    .dtp-amt-num{font-size:14px;font-weight:800;color:var(--tx)}
    .dtp-amt-coin{font-size:10px}
    .dtp-amt-pill.on .dtp-amt-num{color:var(--acc)}
    .dtp-amt-pill.custom .dtp-amt-num{font-size:11px;font-weight:700;color:var(--tx-muted)}
    .dtp-amt-pill.custom.on .dtp-amt-num{color:var(--acc)}

    .dtp-custom-wrap{padding:9px 16px 4px;display:none;}
    .dtp-custom-wrap.show{display:block}
    .dtp-custom-input-row{display:flex;align-items:center;gap:8px;background:var(--l2);border:1.5px solid var(--bd-acc);border-radius:11px;padding:9px 13px;}
    .dtp-custom-input-row i{color:var(--acc);font-size:14px}
    .dtp-custom-input{flex:1;background:transparent;border:none;outline:none;color:var(--tx);font-family:inherit;font-size:14px;font-weight:700;}
    .dtp-custom-input::placeholder{color:var(--tx-faint);font-weight:500}

    .dtp-note-toggle{display:flex;align-items:center;gap:6px;padding:14px 16px 4px;font-size:11px;font-weight:700;color:var(--tx-muted);cursor:pointer;user-select:none;}
    .dtp-note-toggle i{font-size:11px;transition:transform .2s}
    .dtp-note-toggle.open i{transform:rotate(45deg)}
    .dtp-note-wrap{max-height:0;overflow:hidden;transition:max-height .3s ease,opacity .25s;opacity:0;padding:0 16px;}
    .dtp-note-wrap.open{max-height:120px;opacity:1;padding:8px 16px 4px;}
    .dtp-note{width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:11px;padding:9px 12px;color:var(--tx);font-family:inherit;font-size:12px;outline:none;resize:none;min-height:52px;box-sizing:border-box;}
    .dtp-note::placeholder{color:var(--tx-faint)}

    .dtp-divider{height:1px;background:var(--bd);margin:16px 16px 0}

    .dtp-supp-row{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;transition:.15s;}
    .dtp-supp-row:active{background:rgba(255,255,255,.03)}
    .dtp-supp-stack{display:flex;align-items:center;flex-shrink:0;}
    .dtp-supp-av{width:26px;height:26px;border-radius:50%;object-fit:cover;border:2px solid var(--l1);margin-left:-9px;background:var(--glow-sm);flex-shrink:0;}
    .dtp-supp-av:first-child{margin-left:0}
    .dtp-supp-more{width:26px;height:26px;border-radius:50%;border:2px solid var(--l1);margin-left:-9px;background:var(--l3);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:var(--tx-muted);flex-shrink:0;}
    .dtp-supp-plus{width:26px;height:26px;border-radius:50%;border:2px dashed var(--bd);margin-left:-9px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--tx-muted);flex-shrink:0;background:var(--l1);}
    .dtp-supp-text{flex:1;font-size:11.5px;font-weight:700;color:var(--tx-muted);}
    .dtp-supp-text b{color:var(--tx)}
    .dtp-supp-chev{font-size:11px;color:var(--tx-muted);flex-shrink:0}

    .dtp-send-wrap{padding:14px 16px 0}
    .dtp-send{width:100%;background:var(--acc);color:#fff;border:none;padding:13px;border-radius:14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px var(--glow);display:flex;align-items:center;justify-content:center;gap:7px;}
    .dtp-send:active{transform:scale(.98)}
    .dtp-send:disabled{opacity:.45;box-shadow:none;cursor:default}

    /* SUPPORTERS SHEET */
    .dtp-sup-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2610;max-width:480px;margin:0 auto;background:var(--l1);border:1px solid var(--bd);border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);height:78vh;display:flex;flex-direction:column;font-family:'DM Sans',system-ui,sans-serif;}
    .dtp-sup-sheet.open{transform:translateY(0)}
    .dtp-sup-hdr{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 16px 12px;border-bottom:1px solid var(--bd);}
    .dtp-sup-hdr h3{font-size:14px;font-weight:800;color:var(--tx);margin:0}
    .dtp-sup-list{flex:1;overflow-y:auto;padding:6px 10px calc(16px + env(safe-area-inset-bottom,0px));scrollbar-width:none;}
    .dtp-sup-list::-webkit-scrollbar{display:none}
    .dtp-sup-item{display:flex;align-items:center;gap:11px;padding:9px 6px;border-radius:11px;cursor:pointer;transition:.15s;}
    .dtp-sup-item:active{background:rgba(255,255,255,.04)}
    .dtp-sup-item-av{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--glow-sm);}
    .dtp-sup-item-body{flex:1;min-width:0}
    .dtp-sup-item-name{font-size:12.5px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dtp-sup-item-time{font-size:10px;color:var(--tx-muted);margin-top:1px}

    .dtp-bal-row{display:flex;align-items:center;justify-content:space-between;background:var(--l2);border:1px solid var(--bd);border-radius:11px;padding:8px 12px;margin:0 16px 12px}
    .dtp-bal-left{display:flex;align-items:center;gap:8px}
    .dtp-bal-ico{width:28px;height:28px;border-radius:8px;background:rgba(255,0,80,.15);display:flex;align-items:center;justify-content:center;color:var(--acc);font-size:11px}
    .dtp-bal-label{font-size:9px;font-weight:800;color:var(--tx-muted);text-transform:uppercase;letter-spacing:.06em}
    .dtp-bal-val{font-size:12px;font-weight:800;color:var(--tx)}
    .dtp-bal-eye{width:28px;height:28px;border-radius:8px;background:var(--l2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--tx-muted);font-size:11px;cursor:pointer}
    .dtp-gift-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 16px 4px}
    .dtp-gift-card{background:var(--l2);border:1.5px solid var(--bd);border-radius:12px;padding:10px 4px;text-align:center;cursor:pointer;transition:.15s}
    .dtp-gift-card:active{transform:scale(.96)}
    .dtp-gift-card.on{background:var(--glow-sm);border-color:var(--acc);box-shadow:0 2px 10px var(--glow)}
    .dtp-gift-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;margin:0 auto 6px;font-size:16px}
    .dtp-gift-name{font-size:10px;font-weight:800;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dtp-gift-price{font-size:10px;font-weight:700;color:var(--tx-muted);display:flex;align-items:center;justify-content:center;gap:3px;margin-top:2px}
    .dtp-gift-card.on .dtp-gift-name{color:var(--acc)}
    .dtp-gift-card.disabled{opacity:.45;pointer-events:none}

    .dtp-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(14px);background:#111;border:1px solid var(--bd);color:#e0e0e0;padding:8px 18px;border-radius:24px;font-size:12px;font-weight:600;z-index:2700;opacity:0;transition:.26s;pointer-events:none;white-space:nowrap;font-family:'DM Sans',system-ui,sans-serif;}
    .dtp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;

  // ══════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════
  let _hooks = {};
  let _built = false;
  let _curId = null;
  let _curAuthorId = null;
  let _curWriter = null;
  let _selectedAmount = null;
  let _customMode = false;
  let _mode = 'coin'; // 'coin' | 'cash' | 'gift'
  let _selectedGiftId = null;
  let _selectedGiftPrice = null;
  let _balanceVisible = true;
  let _balance = null;      // { coins, bonus, paid } from GET /api/wallet/balance
  let _supporters = [];     // live rows from GET /api/wallet/tips/:authorId
  let _supportersTotal = 0;
  let _supportersLoaded = false;
  let _gifts = [];          // live catalog from GET /api/wallet/store
  let _giftsLoaded = false;
  let _requestId = null;    // one idempotency id per open sheet

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

  /* ── Guest gate ────────────────────────────────────────────────────
     Tipping moves money/coins, so it needs an account. Delegates to the
     shared RequireAuth wall (component/auth-wall.js) so guests get the
     same login prompt as every other write action; falls back to a
     toast on pages that don't load it. The backend remains the real
     boundary — POST /api/wallet/tip is requireAuth. */
  function _isGuest() {
    try {
      if (window.AuthSession && typeof AuthSession.isGuest === 'function') return !!AuthSession.isGuest();
      return !localStorage.getItem('droboard_session');
    } catch (e) { return false; }
  }
  function _refuseForGuest() {
    if (window.RequireAuth) { RequireAuth.wall('send a tip'); return false; }
    _toast('Sign in to send a tip');
    setTimeout(function () {
      var back = location.pathname.split('/').pop() || 'index.html';
      location.href = 'login.html?next=' + encodeURIComponent(back + (location.search || ''));
    }, 700);
    return false;
  }

  /* ── Live data ─────────────────────────────────────────────────────
     Every number and name in this sheet comes from the wallet API. There is
     no local ledger and no generated supporters list: if the API has nothing
     to say, the sheet shows its empty state. */
  function _authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try {
      var tok = localStorage.getItem('droboard_session');
      if (tok) h.Authorization = 'Bearer ' + tok;
    } catch (e) {}
    return h;
  }
  function _apiGet(path) {
    return fetch(API_BASE + path, { credentials: 'include', headers: _authHeaders() })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function _getSupporters(id) {
    if (typeof _hooks.getSupporters === 'function') {
      var hooked = _hooks.getSupporters(id);
      return Array.isArray(hooked) ? hooked : [];
    }
    return _supporters.slice();
  }

  function _getWriter(id, fallback) {
    if (typeof _hooks.getWriter === 'function') {
      const w = _hooks.getWriter(id);
      if (w) return w;
    }
    if (fallback) return fallback;
    if (_curWriter) return _curWriter;
    return { name: 'this writer', avatar: AVATAR_FALLBACK, handle: '' };
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
    var key = supporter.handle || supporter.id || supporter.name;
    return 'profile.html?u=' + encodeURIComponent(key);
  }
  function _getGifts(){ return _gifts; }
  function _getBalance(){ return _balance || { coins: 0, bonus: 0, paid: 0 }; }

  function _loadBalance() {
    return _apiGet('/wallet/balance').then(function (bal) {
      if (bal && bal.coins != null) {
        _balance = { coins: Number(bal.coins) || 0, bonus: Number(bal.bonus) || 0, paid: Number(bal.paid) || 0 };
        if (window.StoreService && StoreService.setServerBalance) StoreService.setServerBalance(_balance);
      }
      _updateBalanceRow();
      _renderGiftGridIfOpen();
      return _balance;
    }).catch(function () {
      /* Signed-out or offline: leave the row at its loading placeholder. The
         send path still refuses, because the server is the authority. */
      _updateBalanceRow();
      return null;
    });
  }

  function _loadGifts() {
    if (_giftsLoaded) return Promise.resolve(_gifts);
    var fetchStore = (window.StoreService && typeof StoreService.fetchStoreData === 'function')
      ? StoreService.fetchStoreData().then(function () { return StoreService.getGifts(); })
      : _apiGet('/wallet/store').then(function (d) { return d.gifts || []; });
    return fetchStore.then(function (list) {
      _gifts = Array.isArray(list) ? list : [];
      _giftsLoaded = true;
      _renderGiftGridIfOpen();
      return _gifts;
    }).catch(function () {
      _gifts = [];
      _giftsLoaded = true;
      _renderGiftGridIfOpen();
      return _gifts;
    });
  }

  function _loadSupporters(authorId) {
    var target = String(authorId || '');
    _supporters = [];
    _supportersTotal = 0;
    _supportersLoaded = false;
    var requested = target;
    var p = (target && target !== 'platform')
      ? _apiGet('/wallet/tips/' + encodeURIComponent(target) + '?limit=50')
      : Promise.resolve({ total: 0, items: [] });
    return p.then(function (d) {
      if (requested !== String(_curAuthorId || '')) return null; // sheet moved on
      _supporters = Array.isArray(d && d.items) ? d.items : [];
      _supportersTotal = Number(d && d.total) || _supporters.length;
      _supportersLoaded = true;
      if (_curId !== null) {
        _renderSupportersRow(_curId);
        var sheet = document.getElementById('dtp-sup-sheet');
        if (sheet && sheet.classList.contains('open')) openSupporters(_curId);
      }
      return _supporters;
    }).catch(function () {
      if (requested !== String(_curAuthorId || '')) return null;
      _supporters = [];
      _supportersTotal = 0;
      _supportersLoaded = true;
      if (_curId !== null) _renderSupportersRow(_curId);
      return [];
    });
  }

  function _updateBalanceRow(){
    const el=document.getElementById('dtp-bal-val');
    const eye=document.getElementById('dtp-bal-eye');
    if(!el) return;
    var bal=_getBalance();
    el.textContent = !_balance ? '…' : (_balanceVisible ? bal.coins.toLocaleString() + ' coins' : '••••');
    if(eye) eye.innerHTML = _balanceVisible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
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
          <div class="dtp-mode-tab" data-mode="gift"><i class="fas fa-gift" style="font-size:11px"></i> Gift</div>
        </div>

        <div class="dtp-bal-row" id="dtp-bal-row">
          <div class="dtp-bal-left">
            <div class="dtp-bal-ico"><i class="fas fa-coins"></i></div>
            <div>
              <div class="dtp-bal-label">Your balance</div>
              <div class="dtp-bal-val" id="dtp-bal-val">—</div>
            </div>
          </div>
          <div class="dtp-bal-eye" id="dtp-bal-eye"><i class="fas fa-eye"></i></div>
        </div>

        <div class="dtp-amt-label" id="dtp-amt-label">Choose an amount</div>
        <div class="dtp-amt-grid" id="dtp-amt-grid"></div>
        <div class="dtp-gift-grid" id="dtp-gift-grid" style="display:none"></div>
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

  function _renderGiftGrid(){
    const grid=document.getElementById('dtp-gift-grid');
    if(!grid) return;
    const gifts=_getGifts();
    if(!gifts.length){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:18px 4px;text-align:center;font-size:11.5px;font-weight:600;color:var(--tx-muted)">' +
        (_giftsLoaded ? 'No gifts available right now.' : 'Loading gifts…') + '</div>';
      _syncSendBtn();
      return;
    }
    const bal=_getBalance().coins;
    grid.innerHTML = gifts.map(g=>{
      // Console-saved gifts carry only `icon`; the store API also sends `faIcon`.
      const ico = g.faIcon || (/^fa-/.test(g.icon||'') ? g.icon : 'fa-gem');
      return `
      <div class="dtp-gift-card${bal < g.price ? ' disabled':''}${_selectedGiftId===g.id?' on':''}" data-gift="${g.id}" data-price="${g.price}">
        <div class="dtp-gift-ico" style="background:${g.color}"><i class="fas ${ico}"></i></div>
        <div class="dtp-gift-name">${g.name}</div>
        <div class="dtp-gift-price"><i class="fas fa-coins" style="font-size:9px"></i> ${g.price}</div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.dtp-gift-card:not(.disabled)').forEach(card=>{
      card.addEventListener('click', ()=>{
        const id=card.dataset.gift;
        const price=+card.dataset.price;
        if(_selectedGiftId===id){
          card.classList.remove('on');
          _selectedGiftId=null; _selectedGiftPrice=null;
        } else {
          grid.querySelectorAll('.dtp-gift-card').forEach(c=>c.classList.remove('on'));
          card.classList.add('on');
          _selectedGiftId=id; _selectedGiftPrice=price;
        }
        _syncSendBtn();
        _updateSendBtnLabel(_curId);
      });
    });
  }

  function _renderGiftGridIfOpen() {
    const grid = document.getElementById('dtp-gift-grid');
    if (grid && _mode === 'gift' && grid.style.display !== 'none') _renderGiftGrid();
  }

  function _switchMode(mode, id) {
    _mode = mode;
    _selectedAmount = null;
    _customMode = false;
    if(mode!=='gift'){ _selectedGiftId=null; _selectedGiftPrice=null; }
    document.querySelectorAll('.dtp-mode-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === mode));
    document.getElementById('dtp-custom-wrap').classList.remove('show');
    document.getElementById('dtp-custom-input').value = '';
    const amtGrid=document.getElementById('dtp-amt-grid');
    const giftGrid=document.getElementById('dtp-gift-grid');
    const amtLabel=document.getElementById('dtp-amt-label');
    const customWrap=document.getElementById('dtp-custom-wrap');
    if(mode==='gift'){
      amtGrid.style.display='none';
      customWrap.style.display='none';
      amtLabel.textContent='Choose a gift';
      giftGrid.style.display='grid';
      _renderGiftGrid();
    } else {
      amtGrid.style.display='grid';
      customWrap.style.display='';
      amtLabel.textContent='Choose an amount';
      giftGrid.style.display='none';
      _renderAmountGrid(id);
    }
    _updateBalanceRow();
    _syncSendBtn();
    _updateSendBtnLabel(id);
  }

  function _updateSendBtnLabel(id) {
    const btn = document.getElementById('dtp-send');
    const currency = _getCurrency(id);
    if (_mode === 'cash') {
      btn.innerHTML = `<span style="font-size:14px;font-weight:800">${currency.symbol}</span> Send Support`;
    } else if (_mode === 'gift') {
      btn.innerHTML = _selectedGiftPrice ? `<i class="fas fa-gift"></i> Send Gift · ${ _selectedGiftPrice} coins` : `<i class="fas fa-gift"></i> Send Gift`;
    } else {
      btn.innerHTML = `<i class="fas fa-coins"></i> Send Tip`;
    }
  }

  function _renderSupportersRow(id) {
    const supporters = _getSupporters(id);
    const stack = document.getElementById('dtp-supp-stack');
    const text = document.getElementById('dtp-supp-text');
    if (!stack || !text) return;
    const shown = supporters.slice(0, 3);
    const overflow = (typeof _hooks.getSupporters === 'function' ? supporters.length : _supportersTotal) - shown.length;

    stack.innerHTML = shown.map(s => `<img class="dtp-supp-av" src="${_esc(s.avatar) || AVATAR_FALLBACK}" loading="lazy" alt=""/>`).join('')
      + (overflow > 0
          ? `<div class="dtp-supp-more">+${overflow > 99 ? '99' : overflow}</div>`
          : (shown.length === 0 ? `<div class="dtp-supp-plus"><i class="fas fa-user-plus"></i></div>` : ''));

    if (!_supportersLoaded && typeof _hooks.getSupporters !== 'function') {
      text.innerHTML = `Loading supporters…`;
    } else if (supporters.length === 0) {
      text.innerHTML = `Be the <b>first</b> to support`;
    } else {
      const n = typeof _hooks.getSupporters === 'function' ? supporters.length : Math.max(_supportersTotal, supporters.length);
      text.innerHTML = `<b>${_fmtN(n)}</b> ${n === 1 ? 'person has' : 'people have'} supported`;
    }
  }

  function _syncSendBtn() {
    const btn = document.getElementById('dtp-send');
    let ok=false;
    if(_mode==='gift') ok = !!_selectedGiftId && !!_selectedGiftPrice;
    else ok = _selectedAmount && _selectedAmount > 0;
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

    document.getElementById('dtp-bal-eye').addEventListener('click', ()=>{
      _balanceVisible=!_balanceVisible;
      _updateBalanceRow();
    });

    document.getElementById('dtp-supp-row').addEventListener('click', () => {
      if (_curId !== null) openSupporters(_curId);
    });

    document.getElementById('dtp-send').addEventListener('click', _sendTip);

    document.getElementById('dtp-sup-close').addEventListener('click', closeSupporters);
  }

  /* Everything below writes through the live wallet. `POST /api/wallet/tip`
     takes { authorId, coins, giftCode?, requestId? } — the server debits the
     reader, splits the author/platform share and writes the ledger row. No
     local ledger, no demo mutation: a refused tip never shows success. */
  function _targetId(){
    if (typeof _hooks.getTargetId === 'function') return String(_hooks.getTargetId(_curId) || '');
    return String(_curAuthorId || '');
  }

  function _applyBalance(bal){
    if(!bal || bal.coins == null) return;
    _balance = { coins: Number(bal.coins)||0, bonus: Number(bal.bonus)||0, paid: Number(bal.paid)||0 };
    if(window.StoreService && StoreService.setServerBalance) StoreService.setServerBalance(_balance);
    _updateBalanceRow();
  }

  function _postTip(authorId, coins, giftCode){
    var body = { authorId: String(authorId), coins: Number(coins) };
    if (giftCode) body.giftCode = String(giftCode);
    if (_requestId) body.requestId = String(_requestId);
    return fetch(API_BASE + '/wallet/tip', {
      method: 'POST', credentials: 'include', headers: _authHeaders(), body: JSON.stringify(body),
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(j){
        return { ok: res.ok, status: res.status, j: j || {} };
      });
    });
  }

  function _tipError(res){
    if (res && res.status === 402) {
      return (res.j && res.j.error === 'bonus_no_tip')
        ? "Bonus coins read stories, they can't tip — buy coins to gift"
        : 'Not enough coins — buy more in Store';
    }
    if (res && (res.status === 401 || res.status === 403)) return 'Sign in to send a tip';
    if (res && res.status === 404) return 'This writer cannot receive tips yet';
    return 'Tip not sent — try again';
  }

  function _disableSend(off){
    var btn = document.getElementById('dtp-send');
    if(btn) btn.disabled = !!off;
    if(!off) _syncSendBtn();
  }

  function _afterSent(writer, amountLabel, note, mode, giftId, bal){
    if (bal) _applyBalance(bal);
    /* The host may want to repaint its own tip counter. It runs AFTER the
       server accepted the payment, so a failed write can never bump a count. */
    if (typeof _hooks.onSent === 'function') {
      try { _hooks.onSent(_curId, _selectedAmount || _selectedGiftPrice, note, mode, giftId); } catch (e) {}
    }
    _toast(amountLabel + ' sent to ' + writer.name + '!');
    close();
    if (_curAuthorId && _curAuthorId !== 'platform') _loadSupporters(_curAuthorId);
  }

  function _sendTip() {
    const writer = _getWriter(_curId);
    /* Re-checked at send time: the sheet can outlive a sign-out. */
    if (_isGuest()) return _refuseForGuest();
    const note = document.getElementById('dtp-note').value.trim();
    const target = _targetId();
    if (!target) { _toast('Cannot tell which writer to tip'); return; }

    if(_mode==='gift'){
      if(!_selectedGiftId || !_selectedGiftPrice) return;
      const gift=_getGifts().find(g=>g.id===_selectedGiftId);
      const giftName=gift?gift.name:_selectedGiftId;
      _disableSend(true);
      _postTip(target, _selectedGiftPrice, _selectedGiftId).then(function(res){
        _disableSend(false);
        if(!res.ok){
          _toast(_tipError(res));
          if(res.status===402) _loadBalance();
          return;
        }
        _afterSent(writer, '🎁 ' + giftName, note, 'gift', _selectedGiftId, res.j.balance);
      }).catch(function(){
        _disableSend(false);
        _toast('Tip not sent — check your connection');
      });
      return;
    }

    if (!_selectedAmount || _selectedAmount <= 0) return;
    const currency = _getCurrency(_curId);
    const amountLabel = _mode === 'cash' ? `${currency.symbol}${_fmtN(_selectedAmount)}` : `🪙 ${_selectedAmount}`;
    _disableSend(true);
    _postTip(target, _selectedAmount).then(function(res){
      _disableSend(false);
      if(!res.ok){
        _toast(_tipError(res));
        if(res.status===402) _loadBalance();
        return;
      }
      _afterSent(writer, amountLabel, note, _mode, null, res.j.balance);
    }).catch(function(){
      _disableSend(false);
      _toast('Tip not sent — check your connection');
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Supporters sheet
  // ══════════════════════════════════════════════════════════════════════
  function _relTime(at) {
    if (!at) return '';
    var ms = Date.now() - new Date(at).getTime();
    if (!isFinite(ms) || ms < 0) return '';
    var m = Math.floor(ms / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(at).toLocaleDateString();
  }

  function openSupporters(id) {
    const supporters = _getSupporters(id);
    const total = typeof _hooks.getSupporters === 'function' ? supporters.length : Math.max(_supportersTotal, supporters.length);
    document.getElementById('dtp-sup-title').textContent = `Supporters (${total})`;
    if (!supporters.length) {
      document.getElementById('dtp-sup-list').innerHTML =
        '<div style="padding:42px 16px;text-align:center;color:var(--tx-muted);font-size:12px;font-weight:600">' +
        (_supportersLoaded || typeof _hooks.getSupporters === 'function'
          ? 'No supporters yet — be the first.'
          : 'Loading supporters…') + '</div>';
    } else {
      document.getElementById('dtp-sup-list').innerHTML = supporters.map(s => `
        <div class="dtp-sup-item" data-uid="${_esc(s.id || s.name)}">
          <img class="dtp-sup-item-av" src="${_esc(s.avatar) || AVATAR_FALLBACK}" loading="lazy" alt=""/>
          <div class="dtp-sup-item-body">
            <div class="dtp-sup-item-name">${_esc(s.name)}</div>
            <div class="dtp-sup-item-time">${_esc(s.time || _relTime(s.at))}</div>
          </div>
          <i class="fas fa-chevron-right" style="font-size:10px;color:var(--tx-muted,#444);flex-shrink:0"></i>
        </div>`).join('');
    }

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
   *   id          — unique id for the story/writer surface being tipped
   *   writerMeta  — { id, name, avatar, handle }; `id` is the author's public
   *                 user id and is what the wallet actually pays. Without it
   *                 the `getAuthorId`/`getTargetId` hook is used; if neither
   *                 answers, the sheet refuses instead of guessing.
   */
  function open(id, writerMeta) {
    /* No account → no tip sheet at all. */
    if (_isGuest()) return _refuseForGuest();
    _build();
    _curId = id;
    _curWriter = writerMeta || null;
    _curAuthorId = (writerMeta && writerMeta.id)
      || (typeof _hooks.getAuthorId === 'function' ? _hooks.getAuthorId(id) : null)
      || (typeof _hooks.getTargetId === 'function' ? _hooks.getTargetId(id) : null)
      || null;
    _requestId = 'dtp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    _selectedAmount = null;
    _selectedGiftId = null;
    _selectedGiftPrice = null;
    _customMode = false;
    _mode = 'coin';
    _balance = null;
    _supporters = [];
    _supportersTotal = 0;
    _supportersLoaded = false;

    const writer = _getWriter(id, writerMeta);
    const currency = _getCurrency(id);
    document.getElementById('dtp-writer-name-hdr').textContent = writer.name;
    document.getElementById('dtp-writer-av').src = writer.avatar || AVATAR_FALLBACK;
    document.getElementById('dtp-writer-av').onerror = function () { this.onerror = null; this.src = AVATAR_FALLBACK; };
    document.getElementById('dtp-writer-name').textContent = writer.name;
    document.getElementById('dtp-writer-sub').textContent = writer.handle || 'Support this writer';
    var cashTab = document.getElementById('dtp-cash-tab-symbol');
    if (cashTab) cashTab.textContent = currency.symbol;

    document.getElementById('dtp-note').value = '';
    document.getElementById('dtp-note-wrap').classList.remove('open');
    document.getElementById('dtp-note-toggle').classList.remove('open');
    document.getElementById('dtp-custom-wrap').classList.remove('show');
    document.getElementById('dtp-custom-wrap').style.display='';
    document.getElementById('dtp-custom-input').value = '';
    document.getElementById('dtp-amt-grid').style.display='grid';
    document.getElementById('dtp-gift-grid').style.display='none';
    document.getElementById('dtp-amt-label').textContent='Choose an amount';
    document.querySelectorAll('.dtp-mode-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === 'coin'));

    _updateBalanceRow();
    _renderAmountGrid(id);
    _renderSupportersRow(id);
    _syncSendBtn();
    _updateSendBtnLabel(id);

    document.getElementById('dtp-overlay').classList.add('show');
    document.getElementById('dtp-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';

    /* Live reads run after the sheet is visible so a slow API never blocks the
       open, and each one paints as soon as it answers. */
    _loadBalance();
    _loadGifts();
    _loadSupporters(_curAuthorId);
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