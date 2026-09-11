/**
 * share-modal.js — Droboard Reusable Share Modal
 * ─────────────────────────────────────────────
 * Drop one <script src="share-modal.js"></script> in any page.
 * Then call:  openShareModal({ title, sub, img, url })
 *
 * Exposes globals:
 *   openShareModal(data)   — opens the share modal
 *   closeShareModal()      — closes it
 *
 * Production API hooks (optional — set before the script tag):
 *   window.DroboardAPI = {
 *     postToStatus:  async (payload) => { ... return { ok: true } },
 *     postToProfile: async (payload) => { ... return { ok: true } },
 *   }
 *   payload shape: { caption, url, title, img, type: 'status'|'profile' }
 *   If DroboardAPI is not defined, falls back to demo toast.
 *
 * THEMING — matches post-card.js / ad-card.js: reads the `data-theme`
 * attribute on <html>. Base CSS below stays dark (the original look, used
 * whenever the host page never sets data-theme); the `[data-theme="light"]`
 * block at the bottom overrides sheets, cards, inputs and text to
 * discover.html's white palette. The backdrop scrim behind both sheets is
 * left dark in both themes — dimming the page behind a bottom sheet is a
 * scrim convention, not page chrome, so it doesn't need to flip. Brand/
 * platform icon colors (WhatsApp green, X black, Instagram gradient, etc.)
 * and accent pink/blue pills are also left untouched — they're intentional
 * colors, not theme-dependent surfaces.
 */

(function () {
  'use strict';

  if (window.__droboardShareModal) return;
  window.__droboardShareModal = true;

  // ════════════════════════════════════════════════════════════════════════
  // CSS
  // ════════════════════════════════════════════════════════════════════════
  const CSS = `
    /* ── Shared backdrop ── */
    .dsm-bg {
      position: fixed; inset: 0; z-index: 2600;
      background: rgba(0,0,0,.75); backdrop-filter: blur(8px);
      display: none; align-items: flex-end; justify-content: center;
    }
    .dsm-bg.open { display: flex; }

    /* ── Base sheet ── */
    .dsm-sheet {
      width: 100%; max-width: 480px;
      background: #080808;
      border-radius: 18px 18px 0 0;
      animation: dsm-up .28s ease;
      max-height: 90vh; overflow-y: auto; scrollbar-width: none;
      padding-bottom: max(20px, env(safe-area-inset-bottom));
      transition: background .25s ease;
    }
    .dsm-sheet::-webkit-scrollbar { display: none; }

    @keyframes dsm-up {
      from { transform: translateY(100%); }
      to   { transform: translateY(0);    }
    }

    .dsm-handle {
      width: 32px; height: 3px;
      background: rgba(255,255,255,.12);
      border-radius: 3px; margin: 10px auto 0;
      transition: background .25s ease;
    }

    .dsm-hdr {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px 10px;
    }
    .dsm-hdr h3 { font-size: 14px; font-weight: 800; color: #e0e0e0; margin: 0; transition: color .25s ease; }

    .dsc-caption-lbl { font-size: 13px; font-weight: 800; color: #e0e0e0; transition: color .25s ease; }

    .dsm-close {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(255,255,255,.06);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 12px; color: #888;
      border: none; font-family: inherit;
      transition: background .2s ease, color .2s ease;
    }
    .dsm-close:hover { background: rgba(255,0,80,.15); color: #ff4d7a; }

    /* ── Preview strip ── */
    .dsm-prev {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.04);
      border-radius: 12px; padding: 10px;
      margin: 0 16px 12px;
      border: 1px solid rgba(255,255,255,.04);
      transition: background .25s ease, border-color .25s ease;
    }
    .dsm-prev-img {
      width: 44px; height: 44px; border-radius: 9px;
      background-size: cover; background-position: center;
      flex-shrink: 0; overflow: hidden;
    }
    .dsm-prev-t {
      font-size: 12px; font-weight: 700; color: #e0e0e0;
      line-height: 1.3; margin-bottom: 2px;
      transition: color .25s ease;
    }
    .dsm-prev-s { font-size: 10px; color: #444; transition: color .25s ease; }

    /* ── Quick-post buttons ── */
    .dsm-sp-row { display: flex; gap: 10px; padding: 0 16px 12px; }
    .dsm-sp {
      flex: 1; padding: 10px 8px; border-radius: 13px;
      font-size: 11px; font-weight: 700; cursor: pointer;
      border: none; font-family: inherit;
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      color: #fff; transition: opacity .15s;
    }
    .dsm-sp:active { opacity: .75; }
    .dsm-sp i { font-size: 16px; }
    .dsm-sp.status-sp  { background: linear-gradient(135deg,#0044ff,#00aaff); }
    .dsm-sp.profile-sp {
      background: rgba(255,0,80,.18);
      border: 1px solid rgba(255,0,80,.25);
    }

    /* ── Link copy row ── */
    .dsm-link-row {
      display: flex; align-items: center; gap: 7px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px; padding: 8px 11px;
      margin: 0 16px 12px;
      transition: background .25s ease, border-color .25s ease;
    }
    .dsm-link-row input {
      flex: 1; background: transparent; border: none;
      color: #666; font-size: 11px; outline: none;
      font-family: inherit;
      transition: color .25s ease;
    }
    .dsm-copy-btn {
      background: #ff0050; color: #fff; border: none;
      padding: 5px 11px; border-radius: 7px;
      font-size: 11px; font-weight: 700; cursor: pointer;
      font-family: inherit; transition: opacity .15s;
    }
    .dsm-copy-btn:active { opacity: .8; }

    /* ── Platform icons ── */
    .dsm-icons {
      display: flex; gap: 12px; flex-wrap: wrap;
      justify-content: center; padding: 0 16px 8px;
    }
    .dsm-ico {
      display: flex; flex-direction: column; align-items: center;
      gap: 3px; cursor: pointer;
    }
    .dsm-ico:active { opacity: .7; }
    .dsm-ico-bg {
      width: 42px; height: 42px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      transition: background .25s ease;
    }
    .dsm-ico span { font-size: 9px; font-weight: 600; color: #555; transition: color .25s ease; }

    .dsm-copy-msg {
      text-align: center; font-size: 11px;
      color: #ff4d7a; font-weight: 600;
      height: 16px; padding-bottom: 14px;
    }

    /* ════════════════════════════════════════════════════
       COMPOSE SHEET — slides up over the share sheet
    ════════════════════════════════════════════════════ */
    .dsc-bg {
      position: fixed; inset: 0; z-index: 2610;
      background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
      display: none; align-items: flex-end; justify-content: center;
    }
    .dsc-bg.open { display: flex; }

    .dsc-sheet {
      width: 100%; max-width: 480px;
      background: #0a0a0a;
      border-radius: 18px 18px 0 0;
      animation: dsm-up .26s ease;
      padding-bottom: max(20px, env(safe-area-inset-bottom));
      transition: background .25s ease;
    }

    /* Destination badge inside compose header */
    .dsc-dest {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 800; padding: 3px 10px;
      border-radius: 20px; letter-spacing: .04em;
    }
    .dsc-dest.status  { background: rgba(0,100,255,.18); color: #60aaff; border: 1px solid rgba(0,100,255,.25); }
    .dsc-dest.profile { background: rgba(255,0,80,.12);  color: #ff4d7a; border: 1px solid rgba(255,0,80,.2); }

    /* Story preview card inside compose */
    .dsc-card {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 12px; padding: 10px 12px;
      margin: 0 14px 12px;
      transition: background .25s ease, border-color .25s ease;
    }
    .dsc-card-img {
      width: 40px; height: 40px; border-radius: 8px;
      background-size: cover; background-position: center;
      flex-shrink: 0;
    }
    .dsc-card-t  { font-size: 11px; font-weight: 700; color: #e0e0e0; line-height: 1.3; transition: color .25s ease; }
    .dsc-card-s  { font-size: 9px; color: #444; margin-top: 2px; transition: color .25s ease; }

    /* Caption textarea */
    .dsc-ta-wrap { position: relative; margin: 0 14px 6px; }
    .dsc-ta {
      width: 100%; min-height: 88px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 12px; padding: 11px 13px 28px;
      color: #e0e0e0; font-family: inherit; font-size: 13px;
      line-height: 1.55; outline: none; resize: none;
      transition: border-color .2s, background .25s ease, color .25s ease;
    }
    .dsc-ta:focus { border-color: rgba(255,0,80,.35); }
    .dsc-ta::placeholder { color: #2e2e2e; }

    /* Character counter — sits inside textarea bottom-right */
    .dsc-counter {
      position: absolute; bottom: 8px; right: 11px;
      font-size: 9px; font-weight: 700; color: #333;
      pointer-events: none; transition: color .2s;
    }
    .dsc-counter.warn  { color: #f59e0b; }
    .dsc-counter.limit { color: #ef4444; }

    /* Tone chips */
    .dsc-chips {
      display: flex; gap: 6px; padding: 0 14px 12px;
      overflow-x: auto; scrollbar-width: none;
    }
    .dsc-chips::-webkit-scrollbar { display: none; }
    .dsc-chip {
      flex-shrink: 0; padding: 4px 11px; border-radius: 20px;
      font-size: 10px; font-weight: 700; cursor: pointer;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04); color: #666;
      transition: all .15s; user-select: none; font-family: inherit;
    }
    .dsc-chip.on {
      background: rgba(255,0,80,.14);
      border-color: rgba(255,0,80,.3); color: #ff4d7a;
    }

    /* Audience toggle */
    .dsc-audience {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 14px 14px;
    }
    .dsc-aud-lbl { font-size: 11px; color: #555; transition: color .25s ease; }
    .dsc-aud-tabs {
      display: flex; gap: 2px;
      background: rgba(255,255,255,.05);
      border-radius: 20px; padding: 3px;
      border: 1px solid rgba(255,255,255,.06);
      transition: background .25s ease, border-color .25s ease;
    }
    .dsc-aud-tab {
      font-size: 10px; font-weight: 700; padding: 4px 11px;
      border-radius: 16px; cursor: pointer; color: #444;
      transition: all .15s; user-select: none;
    }
    .dsc-aud-tab.on { background: #ff0050; color: #fff; }

    /* Post button row */
    .dsc-actions {
      display: flex; gap: 8px; padding: 0 14px 4px;
    }
    .dsc-back {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,.06); border: none;
      color: #888; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background .15s, color .2s; font-family: inherit;
    }
    .dsc-back:hover { background: rgba(255,255,255,.1); }
    .dsc-post {
      flex: 1; padding: 12px; border-radius: 13px;
      font-size: 13px; font-weight: 800; cursor: pointer;
      border: none; color: #fff; font-family: inherit;
      display: flex; align-items: center; justify-content: center; gap: 7px;
      transition: opacity .15s;
    }
    .dsc-post:active { opacity: .8; }
    .dsc-post.status-post  { background: linear-gradient(135deg,#0044ff,#00aaff); box-shadow: 0 4px 18px rgba(0,100,255,.3); }
    .dsc-post.profile-post { background: #ff0050; box-shadow: 0 4px 18px rgba(255,0,80,.3); }
    .dsc-post:disabled { background: #1a1a1a; color: #333; box-shadow: none; cursor: not-allowed; }

    /* Spinner inside post button */
    .dsc-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff;
      animation: dsc-spin .7s linear infinite;
      display: none;
    }
    .dsc-spinner.show { display: block; }
    @keyframes dsc-spin { to { transform: rotate(360deg); } }

    /* ── Toast ── */
    .dsm-toast {
      position: fixed; bottom: 88px; left: 50%;
      transform: translateX(-50%) translateY(16px);
      background: #111; border: 1px solid rgba(255,255,255,.08);
      color: #e0e0e0; padding: 8px 18px; border-radius: 24px;
      font-size: 12px; font-weight: 600; z-index: 2700;
      opacity: 0; transition: .28s; pointer-events: none;
      white-space: nowrap; font-family: inherit;
    }
    .dsm-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    /* ══════════════════════════════════════════════════════════════════
       LIGHT MODE — activated when the host page sets
       <html data-theme="light">. Mirrors post-card.js / ad-card.js's
       token choices (white surfaces, soft gray borders, dark text).
       Backdrop scrims and brand/accent colors stay as-is (see note above).
    ══════════════════════════════════════════════════════════════════ */
    [data-theme="light"] .dsm-sheet,
    [data-theme="light"] .dsc-sheet { background: #ffffff; }

    [data-theme="light"] .dsm-handle { background: rgba(0,0,0,.12); }

    [data-theme="light"] .dsm-hdr h3,
    [data-theme="light"] .dsc-caption-lbl,
    [data-theme="light"] .dsm-prev-t,
    [data-theme="light"] .dsc-card-t { color: #171717; }

    [data-theme="light"] .dsm-prev-s,
    [data-theme="light"] .dsc-card-s { color: #8a8a8a; }

    [data-theme="light"] .dsm-close { background: rgba(0,0,0,.05); color: #8a8a8a; }
    [data-theme="light"] .dsm-close:hover { background: rgba(255,0,80,.12); color: #ff2d55; }

    [data-theme="light"] .dsm-prev,
    [data-theme="light"] .dsc-card { background: rgba(0,0,0,.03); border-color: rgba(0,0,0,.07); }

    [data-theme="light"] .dsm-link-row { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.08); }
    [data-theme="light"] .dsm-link-row input { color: #8a8a8a; }

    [data-theme="light"] .dsm-ico span { color: #8a8a8a; }
    /* Only the "copy link" chip uses a translucent-white bg + white icon —
       that combo disappears on a white sheet, so it gets an explicit swap. */
    [data-theme="light"] .dsm-ico[data-platform="copy"] .dsm-ico-bg { background: rgba(0,0,0,.06); }
    [data-theme="light"] .dsm-ico[data-platform="copy"] .dsm-ico-bg i { color: #3a3a3a; }

    [data-theme="light"] .dsc-card-img { background-color: rgba(0,0,0,.04); }

    [data-theme="light"] .dsc-ta { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.08); color: #171717; }
    [data-theme="light"] .dsc-ta::placeholder { color: #c7c7cc; }
    [data-theme="light"] .dsc-counter { color: #b0b0b0; }

    [data-theme="light"] .dsc-chip { background: rgba(0,0,0,.03); border-color: rgba(0,0,0,.08); color: #8a8a8a; }

    [data-theme="light"] .dsc-aud-lbl { color: #8a8a8a; }
    [data-theme="light"] .dsc-aud-tabs { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.06); }
    [data-theme="light"] .dsc-aud-tab { color: #8a8a8a; }

    [data-theme="light"] .dsc-back { background: rgba(0,0,0,.05); color: #8a8a8a; }
    [data-theme="light"] .dsc-back:hover { background: rgba(0,0,0,.09); }
    [data-theme="light"] .dsc-post:disabled { background: #ececec; color: #b0b0b0; }

    [data-theme="light"] .dsm-toast { background: #f4f4f5; border-color: rgba(0,0,0,.08); color: #3a3a3a; }
  `;

  // ════════════════════════════════════════════════════════════════════════
  // HTML
  // ════════════════════════════════════════════════════════════════════════
  const HTML = `
    <!-- ── Main share sheet ── -->
    <div class="dsm-bg" id="dsmBg">
      <div class="dsm-sheet">
        <div class="dsm-handle"></div>
        <div class="dsm-hdr">
          <h3>Share</h3>
          <button class="dsm-close" id="dsmClose">✕</button>
        </div>
        <div class="dsm-prev" id="dsmPrev"></div>
        <div class="dsm-sp-row">
          <button class="dsm-sp status-sp"  id="dsmStatusBtn">
            <i class="fas fa-circle-notch"></i>Post to Status
          </button>
          <button class="dsm-sp profile-sp" id="dsmProfileBtn">
            <i class="fas fa-user-circle"></i>Post to Profile
          </button>
        </div>
        <div class="dsm-link-row">
          <input type="text" id="dsmLinkInp" readonly />
          <button class="dsm-copy-btn" id="dsmCopyBtn">Copy</button>
        </div>
        <div class="dsm-icons">
          <div class="dsm-ico" data-platform="whatsapp">
            <div class="dsm-ico-bg" style="background:#1ebe57"><i class="fab fa-whatsapp" style="color:#fff;font-size:19px"></i></div>
            <span>WhatsApp</span>
          </div>
          <div class="dsm-ico" data-platform="twitter">
            <div class="dsm-ico-bg" style="background:#000;border:1px solid #222"><i class="fab fa-x-twitter" style="color:#fff;font-size:18px"></i></div>
            <span>X</span>
          </div>
          <div class="dsm-ico" data-platform="instagram">
            <div class="dsm-ico-bg" style="background:linear-gradient(135deg,#f09433,#dc2743,#bc1888)"><i class="fab fa-instagram" style="color:#fff;font-size:19px"></i></div>
            <span>Insta</span>
          </div>
          <div class="dsm-ico" data-platform="telegram">
            <div class="dsm-ico-bg" style="background:#0088cc"><i class="fab fa-telegram" style="color:#fff;font-size:19px"></i></div>
            <span>Telegram</span>
          </div>
          <div class="dsm-ico" data-platform="facebook">
            <div class="dsm-ico-bg" style="background:#1877f2"><i class="fab fa-facebook-f" style="color:#fff;font-size:17px"></i></div>
            <span>Facebook</span>
          </div>
          <div class="dsm-ico" data-platform="copy">
            <div class="dsm-ico-bg" style="background:rgba(255,255,255,.06)"><i class="fas fa-link" style="color:#fff;font-size:16px"></i></div>
            <span>Copy link</span>
          </div>
        </div>
        <div class="dsm-copy-msg" id="dsmCopyMsg"></div>
      </div>
    </div>

    <!-- ── Compose sheet (status / profile) ── -->
    <div class="dsc-bg" id="dscBg">
      <div class="dsc-sheet">
        <div class="dsm-handle"></div>

        <!-- Header -->
        <div class="dsm-hdr">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="dsc-caption-lbl">Add a caption</span>
            <span class="dsc-dest" id="dscDest">Status</span>
          </div>
          <button class="dsm-close" id="dscClose">✕</button>
        </div>

        <!-- Story card preview -->
        <div class="dsc-card" id="dscCard"></div>

        <!-- Caption textarea -->
        <div class="dsc-ta-wrap">
          <textarea class="dsc-ta" id="dscTa" maxlength="280"
            placeholder="What do you want to say about this?"></textarea>
          <span class="dsc-counter" id="dscCounter">280</span>
        </div>

        <!-- Tone chips -->
        <div class="dsc-chips" id="dscChips">
          <button class="dsc-chip" data-text="🔥 You need to read this">🔥 Must read</button>
          <button class="dsc-chip" data-text="😭 This one hits different">😭 Hits different</button>
          <button class="dsc-chip" data-text="💔 Chapter broke me">💔 Heartbreaking</button>
          <button class="dsc-chip" data-text="👀 The plot twist though…">👀 Plot twist</button>
          <button class="dsc-chip" data-text="✨ Currently obsessed with this story">✨ Obsessed</button>
        </div>

        <!-- Audience -->
        <div class="dsc-audience">
          <span class="dsc-aud-lbl">Audience</span>
          <div class="dsc-aud-tabs">
            <div class="dsc-aud-tab on" data-aud="everyone">Everyone</div>
            <div class="dsc-aud-tab"    data-aud="followers">Followers</div>
            <div class="dsc-aud-tab"    data-aud="close">Close friends</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="dsc-actions">
          <button class="dsc-back" id="dscBack"><i class="fas fa-arrow-left"></i></button>
          <button class="dsc-post" id="dscPost">
            <div class="dsc-spinner" id="dscSpinner"></div>
            <span id="dscPostLbl"><i class="fas fa-circle-notch"></i> Post</span>
          </button>
        </div>
      </div>
    </div>

    <div class="dsm-toast" id="dsmToast"></div>
  `;

  // ════════════════════════════════════════════════════════════════════════
  // State
  // ════════════════════════════════════════════════════════════════════════
  let _data       = {};
  let _destType   = 'status';   // 'status' | 'profile'
  let _audience   = 'everyone';
  let _posting    = false;

  // ════════════════════════════════════════════════════════════════════════
  // Toast
  // ════════════════════════════════════════════════════════════════════════
  function _toast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    const el = document.getElementById('dsmToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Inject
  // ════════════════════════════════════════════════════════════════════════
  function inject() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = HTML.trim();
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    bindEvents();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Open / close — main share sheet
  // ════════════════════════════════════════════════════════════════════════
  function openShareModal(data) {
    _data = data || {};

    document.getElementById('dsmLinkInp').value = _data.url || 'https://droboard.app';
    document.getElementById('dsmCopyMsg').textContent = '';
    document.getElementById('dsmCopyBtn').textContent = 'Copy';

    const imgHtml = _data.img
      ? `<div class="dsm-prev-img" style="background-image:url('${_data.img}')"></div>`
      : `<div class="dsm-prev-img" style="background:rgba(255,0,80,.15);display:flex;align-items:center;justify-content:center;font-size:20px">📤</div>`;

    document.getElementById('dsmPrev').innerHTML =
      imgHtml +
      `<div>
         <div class="dsm-prev-t">${_data.title || 'Droboard'}</div>
         ${_data.sub ? `<div class="dsm-prev-s">${_data.sub}</div>` : ''}
       </div>`;

    document.getElementById('dsmBg').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeShareModal() {
    document.getElementById('dsmBg').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════════════════════════════════════════
  // Open / close — compose sheet
  // ════════════════════════════════════════════════════════════════════════
  function openCompose(type) {
    _destType = type;
    _audience = 'everyone';
    _posting  = false;

    // Destination badge
    const dest = document.getElementById('dscDest');
    dest.textContent = type === 'status' ? '📢 Status' : '👤 Profile';
    dest.className   = 'dsc-dest ' + type;

    // Story card
    const imgHtml = _data.img
      ? `<div class="dsc-card-img" style="background-image:url('${_data.img}')"></div>`
      : `<div class="dsc-card-img" style="background:rgba(255,0,80,.12);display:flex;align-items:center;justify-content:center;font-size:16px">📖</div>`;
    document.getElementById('dscCard').innerHTML =
      imgHtml +
      `<div>
         <div class="dsc-card-t">${_data.title || 'Droboard'}</div>
         ${_data.sub ? `<div class="dsc-card-s">${_data.sub}</div>` : ''}
       </div>`;

    // Reset textarea + counter
    const ta = document.getElementById('dscTa');
    ta.value = '';
    _updateCounter();

    // Reset chips
    document.querySelectorAll('.dsc-chip').forEach(c => c.classList.remove('on'));

    // Reset audience
    document.querySelectorAll('.dsc-aud-tab').forEach(t => {
      t.classList.toggle('on', t.dataset.aud === 'everyone');
    });

    // Post button style
    const postBtn = document.getElementById('dscPost');
    postBtn.className = 'dsc-post ' + (type === 'status' ? 'status-post' : 'profile-post');
    postBtn.disabled  = false;

    const lbl = document.getElementById('dscPostLbl');
    lbl.innerHTML = type === 'status'
      ? '<i class="fas fa-circle-notch"></i> Post to Status'
      : '<i class="fas fa-user-circle"></i> Post to Profile';

    document.getElementById('dscSpinner').classList.remove('show');
    document.getElementById('dscBg').classList.add('open');
  }

  function closeCompose() {
    document.getElementById('dscBg').classList.remove('open');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Counter
  // ════════════════════════════════════════════════════════════════════════
  function _updateCounter() {
    const ta  = document.getElementById('dscTa');
    const el  = document.getElementById('dscCounter');
    const rem = 280 - (ta.value.length || 0);
    el.textContent = rem;
    el.className = 'dsc-counter' + (rem <= 20 ? (rem <= 0 ? ' limit' : ' warn') : '');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Post — production API with demo fallback
  // ════════════════════════════════════════════════════════════════════════
  async function _doPost() {
    if (_posting) return;
    _posting = true;

    const caption = document.getElementById('dscTa').value.trim();
    const postBtn = document.getElementById('dscPost');
    const spinner = document.getElementById('dscSpinner');
    const lbl     = document.getElementById('dscPostLbl');

    // Loading state
    postBtn.disabled = true;
    spinner.classList.add('show');
    lbl.style.display = 'none';

    const payload = {
      type:     _destType,
      caption,
      audience: _audience,
      url:      _data.url   || '',
      title:    _data.title || '',
      img:      _data.img   || '',
    };

    try {
      // ── Production path ──────────────────────────────────────────────
      if (window.DroboardAPI) {
        const fn = _destType === 'status'
          ? window.DroboardAPI.postToStatus
          : window.DroboardAPI.postToProfile;

        if (typeof fn !== 'function') throw new Error('API method not found');

        const result = await fn(payload);

        if (!result || !result.ok) throw new Error(result?.message || 'Post failed');

        _onSuccess();

      // ── Demo fallback ─────────────────────────────────────────────────
      } else {
        // Simulate a short network delay so the UI feels real
        await new Promise(r => setTimeout(r, 900));
        _onSuccess();
      }

    } catch (err) {
      _onError(err.message || 'Something went wrong');
    }
  }

  function _onSuccess() {
    const label = _destType === 'status' ? 'Status' : 'Profile';
    closeCompose();
    closeShareModal();
    _toast(`✅ Posted to ${label}!`);
    _posting = false;
  }

  function _onError(msg) {
    const postBtn = document.getElementById('dscPost');
    const spinner = document.getElementById('dscSpinner');
    const lbl     = document.getElementById('dscPostLbl');

    postBtn.disabled = false;
    spinner.classList.remove('show');
    lbl.style.display = '';
    _posting = false;
    _toast(`❌ ${msg}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Platform share
  // ════════════════════════════════════════════════════════════════════════
  function _share(platform) {
    const url  = encodeURIComponent(_data.url  || 'https://droboard.app');
    const text = encodeURIComponent(`📖 "${_data.title || 'Check this out'}" on Droboard!`);

    const routes = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      twitter:  `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    };

    if (platform === 'copy' || platform === 'instagram') {
      navigator.clipboard?.writeText(_data.url || '').catch(() => {});
      document.getElementById('dsmCopyMsg').textContent = '✅ Link copied!';
      document.getElementById('dsmCopyBtn').textContent = '✓ Copied';
      _toast('🔗 Link copied!');
      return;
    }

    if (routes[platform]) {
      window.open(routes[platform], '_blank');
      closeShareModal();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Bind events
  // ════════════════════════════════════════════════════════════════════════
  function bindEvents() {
    // ── Main share sheet ──
    document.getElementById('dsmClose').addEventListener('click', closeShareModal);
    document.getElementById('dsmBg').addEventListener('click', function (e) {
      if (e.target === this) closeShareModal();
    });
    document.getElementById('dsmCopyBtn').addEventListener('click', () => {
      navigator.clipboard?.writeText(document.getElementById('dsmLinkInp').value).catch(() => {});
      document.getElementById('dsmCopyMsg').textContent = '✅ Link copied!';
      document.getElementById('dsmCopyBtn').textContent = '✓ Copied';
      _toast('🔗 Link copied!');
    });
    document.getElementById('dsmStatusBtn').addEventListener('click',  () => openCompose('status'));
    document.getElementById('dsmProfileBtn').addEventListener('click', () => openCompose('profile'));
    document.querySelectorAll('.dsm-ico[data-platform]').forEach(ico => {
      ico.addEventListener('click', () => _share(ico.dataset.platform));
    });

    // ── Compose sheet ──
    document.getElementById('dscClose').addEventListener('click', closeCompose);
    document.getElementById('dscBack').addEventListener('click',  closeCompose);
    document.getElementById('dscBg').addEventListener('click', function (e) {
      if (e.target === this) closeCompose();
    });

    // Textarea counter
    document.getElementById('dscTa').addEventListener('input', _updateCounter);

    // Tone chips — tap to append text, tap again to remove
    document.querySelectorAll('.dsc-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ta   = document.getElementById('dscTa');
        const isOn = chip.classList.contains('on');

        // Turn off all chips first
        document.querySelectorAll('.dsc-chip').forEach(c => c.classList.remove('on'));

        if (!isOn) {
          chip.classList.add('on');
          ta.value = chip.dataset.text + ' ';
        } else {
          ta.value = '';
        }
        _updateCounter();
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    });

    // Audience tabs
    document.querySelectorAll('.dsc-aud-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        _audience = tab.dataset.aud;
        document.querySelectorAll('.dsc-aud-tab').forEach(t =>
          t.classList.toggle('on', t === tab)
        );
      });
    });

    // Post button
    document.getElementById('dscPost').addEventListener('click', _doPost);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Expose globals
  // ════════════════════════════════════════════════════════════════════════
  window.openShareModal  = openShareModal;
  window.closeShareModal = closeShareModal;

  // ════════════════════════════════════════════════════════════════════════
  // Init
  // ════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

})();