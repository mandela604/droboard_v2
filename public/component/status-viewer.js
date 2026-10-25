/**
 * status-viewer.js — Droboard Reusable Status Viewer
 * ────────────────────────────────────────────────────
 * Drop one <script src="status-viewer.js"></script> in any page.
 * Then call: openStatusViewer(writerStatusesArray, writerIdToOpen)
 *
 * Expects each writer object to have:
 *   {
 *     id:           string,
 *     name:         string,
 *     avatar:       string | null,
 *     isLive:       boolean (optional),
 *     ring:         'ring-has' | 'ring-live' | 'ring-viewed' | 'ring-none',
 *     likes:        number,
 *     threads:      number,
 *     statuses: [
 *       { bg: string, quote: string, caption: string, time: string }
 *     ]
 *   }
 *
 * Exposes globals:
 *   openStatusViewer(writerStatuses, wid)   — open viewer at a specific writer
 *   closeStatusViewer()                     — close viewer
 *
 * Behaviour:
 *   • Progress bars per slide, auto-advance every STATUS_DUR ms
 *   • Press-and-hold pauses progress until release
 *   • Tap left 35% → previous slide / writer, tap right 35% → next
 *   • Clicking the writer name / avatar navigates to profile.html
 *   • Heart icon loves the status (count increments, icon turns accent pink)
 *   • Thread count click navigates to thread.html
 *   • Reply input box preserved
 *   • onStatusViewerChange(wid, ring) callback optional
 *
 * Ring sync — the component owns it (status of the art):
 *   • window.StatusStore        — persisted viewed-state (all pages/reloads)
 *   • Stamp any element: <x data-status-ring="authorId"> with ring-* class;
 *     the viewer auto-swaps its ring-* class the moment state changes,
 *     no per-page wiring. Call StatusStore.applyAll() after dynamic renders.
 *   • onStatusViewerChange(wid, ring) still fires for pages with custom UI.
 */

(function () {
  'use strict';

  if (window.__droboardStatusViewer && typeof window.openStatusViewer === 'function') return;
  window.__droboardStatusViewer = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    /* ── Overlay ── */
    .dsv2-ov {
      position: fixed; inset: 0; z-index: 4500;
      background: #000;
      display: none; flex-direction: column;
      font-family: 'DM Sans', system-ui, sans-serif;
      touch-action: manipulation;
      -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none;
    }
    .dsv2-ov.open { display: flex; }

    /* ── Top bar (progress + writer info) ── */
    .dsv2-top {
      position: absolute; top: 0; left: 0; right: 0; z-index: 20;
      padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 8px;
      background: linear-gradient(to bottom, rgba(0,0,0,.85), transparent);
    }

    /* Progress bars */
    .dsv2-bars {
      display: flex; gap: 4px; margin-bottom: 10px;
    }
    .dsv2-bar {
      flex: 1; height: 2.5px;
      background: rgba(255,255,255,.22); border-radius: 3px; overflow: hidden;
    }
    .dsv2-bar-fill {
      height: 100%; background: #fff; border-radius: 3px;
      width: 0%; transition: none;
    }
    .dsv2-bar-fill.complete { width: 100%; }
    .dsv2-bar-fill.animating {
      /* duration set via JS inline style */
      transition-property: width;
      transition-timing-function: linear;
    }

    /* Writer info row */
    .dsv2-writer {
      display: flex; align-items: center; gap: 10px;
    }
    .dsv2-writer-av {
      width: 34px; height: 34px; border-radius: 50%;
      object-fit: cover; border: 2px solid #38bdf8;
      cursor: pointer; flex-shrink: 0; display: block;
    }
    .dsv2-writer-av-init {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(255,0,80,.2); border: 2px solid #38bdf8;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; color: #fff;
      cursor: pointer; flex-shrink: 0;
    }
    .dsv2-writer-name {
      font-size: 13px; font-weight: 700; color: #fff;
      cursor: pointer; flex: 1; text-decoration: none;
    }
    .dsv2-writer-name:hover { text-decoration: underline; opacity: .85; }
    .dsv2-writer-time {
      font-size: 10px; color: rgba(255,255,255,.4); flex: 1;
      margin-top: 1px;
    }
    .dsv2-writer-meta { flex: 1; min-width: 0; }
    .dsv2-close {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(255,255,255,.1); border: none;
      color: #fff; font-size: 13px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-family: inherit;
    }
    .dsv2-close:active { transform: scale(.9); }

    /* ── Slide content ── */
    .dsv2-content {
      flex: 1; position: relative; overflow: hidden;
    }
    .dsv2-slide {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
    }
    .dsv2-slide-grad {
      position: absolute; inset: 0;
      background: linear-gradient(
        0deg,
        rgba(0,0,0,.92) 0%,
        rgba(0,0,0,.25) 55%,
        transparent 100%
      );
    }
    .dsv2-slide-text {
      position: relative; z-index: 2;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%;
      padding: 100px 26px 160px;
      text-align: center;
      pointer-events: none;
    }
    .dsv2-slide-quote {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px; font-weight: 700;
      line-height: 1.45; color: #e8e8e8;
    }
    .dsv2-slide-caption {
      font-size: 12px; color: rgba(255,255,255,.52); margin-top: 10px;
    }
    .dsv2-slide-story {
      display: inline-flex; align-items: center; gap: 8px; margin-top: 14px;
      background: #fff; border: none;
      border-radius: 999px; padding: 7px 15px 7px 8px; cursor: pointer;
      position: relative; z-index: 20; max-width: 100%;
      box-shadow: 0 8px 24px rgba(0,0,0,.45);
      pointer-events: auto !important;
    }
    .dsv2-slide-story img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .dsv2-slide-story span { font-size: 13px; font-weight: 800; color: #161616; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dsv2-slide-story .dsv2-story-go { font-size: 11px; font-weight: 800; color: #ff0050; flex-shrink: 0; }

    /* Tap nav zones */
    .dsv2-nav-left {
      position: absolute; left: 0; top: 0; bottom: 0; width: 35%; z-index: 10;
      cursor: pointer; touch-action: manipulation;
    }
    .dsv2-nav-right {
      position: absolute; right: 0; top: 0; bottom: 0; width: 35%; z-index: 10;
      cursor: pointer; touch-action: manipulation;
    }

    /* ── Engagement bar (likes + threads) ── */
    .dsv2-engage {
      position: absolute;
      bottom: 76px; left: 0; right: 0;
      z-index: 15;
      display: flex; align-items: center; justify-content: center;
      padding: 8px 16px;
    }
    .dsv2-engage-pill {
      display: flex; align-items: center; gap: 7px;
      background: rgba(0,0,0,.65);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 24px; padding: 8px 16px;
      cursor: pointer;
    }
    .dsv2-engage-like {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; color: #fff;
      cursor: pointer; user-select: none; padding: 2px 0;
    }
    .dsv2-engage-like i {
      font-size: 15px; color: rgba(255,255,255,.55);
      transition: color .2s, transform .18s;
    }
    .dsv2-engage-like.loved i {
      color: #ff4d7a;
    }
    .dsv2-engage-like:active i { transform: scale(1.3); }
    .dsv2-engage-div,
    .dsv2-views-div {
      width: 1px; height: 14px; background: rgba(255,255,255,.2);
    }
    /* Owner-only view count — sits beside the love count, never under a toast */
    .dsv2-engage-views {
      display: none; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; color: #fff;
      user-select: none;
    }
    .dsv2-engage-views.show { display: flex; }
    .dsv2-engage-views i { font-size: 13px; color: #38bdf8; }
    .dsv2-views-div { display: none; }
    .dsv2-views-div.show { display: block; }
    .dsv2-engage-threads {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; color: #fff;
      cursor: pointer;
    }
    .dsv2-engage-threads i { font-size: 13px; color: #38bdf8; }
    .dsv2-engage-threads:hover { opacity: .85; }
    .dsv2-engage-views.show { cursor: pointer; }

    /* ── Seen-by sheet (owner taps the eye count) ── */
    .dsv2-seen {
      position: absolute; inset: 0; z-index: 30;
      display: none; background: rgba(0,0,0,.55);
    }
    .dsv2-seen.open { display: flex; align-items: flex-end; }
    .dsv2-seen-sheet {
      width: 100%; max-height: 72%;
      background: #14141a; border-radius: 20px 20px 0 0;
      display: flex; flex-direction: column;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      animation: dsv2SeenUp .22s ease;
    }
    @keyframes dsv2SeenUp {
      from { transform: translateY(28px); opacity: .6; }
      to   { transform: none; opacity: 1; }
    }
    .dsv2-seen-head {
      display: flex; align-items: center; gap: 4px;
      padding: 14px 14px 10px 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .dsv2-seen-title { font-size: 14px; font-weight: 800; color: #fff; }
    .dsv2-seen-count { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.5); }
    .dsv2-seen-close {
      margin-left: auto; width: 28px; height: 28px; border-radius: 50%;
      background: rgba(255,255,255,.1); border: none; color: #fff;
      font-size: 12px; cursor: pointer; flex-shrink: 0;
    }
    .dsv2-seen-list { overflow-y: auto; padding: 6px 8px 12px; -webkit-overflow-scrolling: touch; }
    .dsv2-seen-row { display: flex; align-items: center; gap: 10px; padding: 9px 8px; border-radius: 12px; }
    .dsv2-seen-row:active { background: rgba(255,255,255,.05); }
    .dsv2-seen-av {
      width: 38px; height: 38px; border-radius: 50%; object-fit: cover;
      background: rgba(255,0,80,.18); color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800;
    }
    .dsv2-seen-meta { flex: 1; min-width: 0; }
    .dsv2-seen-name {
      font-size: 13px; font-weight: 700; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .dsv2-seen-handle { font-size: 11px; color: rgba(255,255,255,.45); }
    .dsv2-seen-at { font-size: 11px; color: rgba(255,255,255,.4); flex-shrink: 0; }
    .dsv2-seen-guest {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 8px; margin-top: 2px;
      border-top: 1px dashed rgba(255,255,255,.12);
      color: rgba(255,255,255,.65); font-size: 12px; font-weight: 600;
    }
    .dsv2-seen-empty { padding: 30px 16px; text-align: center; color: rgba(255,255,255,.45); font-size: 12px; }

    /* ── Bottom reply bar ── */
    .dsv2-bottom {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px);
      background: linear-gradient(to top, rgba(0,0,0,.88), transparent);
      display: flex; align-items: center; gap: 10px; z-index: 15;
    }
    .dsv2-reply-inp {
      flex: 1;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 30px; padding: 9px 14px;
      color: #fff; font-family: inherit; font-size: 12px; outline: none;
      transition: border-color .2s;
    }
    .dsv2-reply-inp::placeholder { color: rgba(255,255,255,.4); }
    .dsv2-reply-inp:focus { border-color: rgba(255,0,80,.5); }
    .dsv2-reply-send {
      width: 36px; height: 36px; border-radius: 50%;
      background: #ff0050; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 12px; color: #fff; flex-shrink: 0;
      transition: transform .15s, background .2s;
    }
    .dsv2-reply-send:disabled {
      background: rgba(255,255,255,.1); cursor: default;
    }
    .dsv2-reply-send:not(:disabled):active { transform: scale(.9); }

    /* ── Toast — anchored under the top bar so it can never cover the
       engagement pill / love + view counts at the bottom. ── */
    .dsv2-toast {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 86px);
      left: 50%; transform: translateX(-50%) translateY(-10px);
      background: #111; border: 1px solid rgba(255,255,255,.08);
      color: #e0e0e0; padding: 8px 18px; border-radius: 24px;
      font-size: 12px; font-weight: 600; z-index: 4600;
      opacity: 0; transition: .28s; pointer-events: none;
      max-width: calc(100vw - 32px);
      white-space: normal; text-align: center; font-family: inherit;
    }
    .dsv2-toast.show {
      opacity: 1; transform: translateX(-50%) translateY(0);
    }

    /* ── Ad slides reuse the shared ad-card stage; hide viewer chrome ── */
    .dsv2-ov.showing-ad .dsv2-engage, .dsv2-ov.showing-ad .dsv2-bottom { display: none; }
    /* ── Love-only engagement: threads + reply bar hidden everywhere ── */
    .dsv2-engage-threads, .dsv2-engage-div { display: none; }
    .dsv2-bottom { display: none; }
  `;

  // ══════════════════════════════════════════════════════════════════════
  // HTML skeleton
  // ══════════════════════════════════════════════════════════════════════
  const HTML = `
    <div class="dsv2-ov" id="dsv2Ov">

      <!-- Top bar -->
      <div class="dsv2-top">
        <div class="dsv2-bars" id="dsv2Bars"></div>
        <div class="dsv2-writer">
          <div id="dsv2AvWrap"></div>
          <div class="dsv2-writer-meta">
            <div
              class="dsv2-writer-name"
              id="dsv2WriterName"
              onclick="location.href='profile.html'"
            ></div>
            <div class="dsv2-writer-time" id="dsv2WriterTime"></div>
          </div>
          <button class="dsv2-close" id="dsv2CloseBtn">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Slide content -->
      <div class="dsv2-content" id="dsv2Content"></div>

      <!-- Engagement pill -->
      <div class="dsv2-engage">
        <div class="dsv2-engage-pill">
          <div class="dsv2-engage-like" id="dsv2LikeBtn">
            <i class="fas fa-heart"></i>
            <span id="dsv2LikeCount">0</span>
          </div>
          <div class="dsv2-views-div" id="dsv2ViewsDiv"></div>
          <div class="dsv2-engage-views" id="dsv2Views" title="Status views">
            <i class="fas fa-eye"></i>
            <span id="dsv2ViewCount">0</span>
          </div>
          <div class="dsv2-engage-div"></div>
          <div class="dsv2-engage-threads" id="dsv2ThreadsBtn">
            <i class="fas fa-comments"></i>
            <span id="dsv2ThreadCount">0 threads</span>
          </div>
        </div>
      </div>

      <!-- Reply bar -->
      <div class="dsv2-bottom">
        <input
          class="dsv2-reply-inp"
          id="dsv2ReplyInp"
          placeholder="Reply to status…"
        />
        <button class="dsv2-reply-send" id="dsv2ReplySend" disabled>
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>

      <!-- Owner: who saw this slide -->
      <div class="dsv2-seen" id="dsv2Seen">
        <div class="dsv2-seen-sheet" role="dialog" aria-label="Seen by">
          <div class="dsv2-seen-head">
            <span class="dsv2-seen-title">Seen by</span>
            <span class="dsv2-seen-count" id="dsv2SeenCount"></span>
            <button class="dsv2-seen-close" id="dsv2SeenClose" aria-label="Close">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div class="dsv2-seen-list" id="dsv2SeenList"></div>
        </div>
      </div>

    </div>

    <div class="dsv2-toast" id="dsv2Toast"></div>
  `;

  // ══════════════════════════════════════════════════════════════════════
  // Constants
  // ══════════════════════════════════════════════════════════════════════
  const STATUS_DUR = 8000; // ms per slide

  // ══════════════════════════════════════════════════════════════════════
  // Module state
  // ══════════════════════════════════════════════════════════════════════
  let _writers      = [];   // full array passed in
  let _writerIdx    = 0;    // which writer we're viewing
  let _slideIdx     = 0;    // which slide within that writer
  let _timer        = null;
  let _paused       = false;
  let _elapsed      = 0;    // ms of *playing* time already used on this slide
  let _lastTickAt   = 0;    // clock mark when the current play segment started
  let _slideToken   = 0;    // invalidates pending rAF callbacks after navigation
  let _pressAt      = 0;    // pointerdown time for tap-vs-hold detection
  let _navSuppressUntil = 0; // ignore the click browsers fire after a long hold
  let _likeState    = {};   // { [wid + ':' + slideIdx]: { liked: bool, count: number } } — per STATUS, not per author
  const _reportedViews = {}; // live status ids already sent to POST /view
  let _seenToken    = 0;    // invalidates a pending "Seen by" fetch
  let _seenWasPlaying = false;

  // A like belongs to each individual status — key by author + slide index.
  function _likeKey(w, si) { return (w && w.id) + ':' + si; }

  function _now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function _isMine(w) {
    return !!(w && (w.isMine || w.you || String(w.id) === 'you'));
  }

  function _ringOfWriter(w) {
    if (!w) return null;
    var ring = StatusStore.ringOf(w.name || w.id);
    if (!ring) {
      var st = w.statuses || [];
      ring = st.length ? (st.every(function (s) { return s && s.viewed; }) ? 'ring-viewed' : 'ring-has') : 'ring-none';
    }
    return ring;
  }

  // ══════════════════════════════════════════════════════════════════════
  // StatusStore — shared, persisted seen-state (per STATUS, not per author)
  // ──────────────────────────────────────────────────────────────────────
  // One author key per person across every surface (story id, wr:handle,
  // profile handle, comment prefix…). A ring is grey only when EVERY current
  // status is seen, so a new upload turns it red again automatically.
  // ══════════════════════════════════════════════════════════════════════
  const STATUS_STORE_KEY = 'dro_status_viewed_v2';
  const LEGACY_STORE_KEY = 'dro_status_viewed_v1';

  function _normAuthor(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return '';
    if (s === 'you' || s === 'your story' || s === 'me') return 'you';
    s = s.replace(/^@/, '').replace(/^wr:/, '');
    s = s.replace(/^dcs_[^_]+_/, '');
    s = s.replace(/^da_/, '').replace(/^ptf_/, '');
    s = s.replace(/[\s\-]+/g, '_');
    return s;
  }

  const StatusStore = {
    _m: null,
    _authors: {},   // key → { statuses, meta }
    _load() {
      if (this._m) return this._m;
      try {
        var raw = localStorage.getItem(STATUS_STORE_KEY);
        if (raw) { this._m = JSON.parse(raw) || {}; return this._m; }
        // One-time import: the old store was author-level, so treat those
        // authors as fully seen until they post again.
        var old = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || '{}') || {};
        this._m = {};
        var self = this;
        Object.keys(old).forEach(function (k) {
          self._m[_normAuthor(k)] = { count: 1, at: Date.now(), ids: {} };
        });
      } catch (e) { this._m = {}; }
      return this._m;
    },
    _save() { try { localStorage.setItem(STATUS_STORE_KEY, JSON.stringify(this._m)); } catch (e) {} },
    key(idOrHandle) { return _normAuthor(idOrHandle); },
    _statusKey(status, index) {
      if (status && status.id) return String(status.id);
      var t = (status && (status.ts || status.time)) || '';
      return 'i' + index + ':' + t;
    },
    _rec(key) {
      var m = this._load();
      if (!m[key]) m[key] = { ids: {}, count: 0, at: 0 };
      return m[key];
    },
    _markAllSeen(key, statuses) {
      var rec = this._rec(key);
      statuses.forEach(function (s, i) { rec.ids[StatusStore._statusKey(s, i)] = Date.now(); });
      // `count` is how many slides we know this author had when we last saw
      // them all — a later upload (more slides) flips the ring red again.
      rec.count = statuses.length;
      rec.total = statuses.length;
      rec.unseen = 0;
      rec.at = Date.now();
      this._save();
      return rec;
    },
    /* Register the author's CURRENT statuses; returns the ring to render. */
    register(idOrHandle, statuses, meta) {
      var key = this.key(idOrHandle);
      statuses = statuses || [];
      this._authors[key] = { statuses: statuses, meta: meta || {} };
      var rec = this._rec(key);
      if (!statuses.length) {
        rec.total = 0; rec.unseen = 0;
        this._save();
        return 'ring-none';
      }
      var self = this;
      var seen = statuses.filter(function (s, i) {
        return !!s.viewed || !!rec.ids[self._statusKey(s, i)];
      }).length;
      var allSeen = seen === statuses.length;
      if (allSeen) {
        this._markAllSeen(key, statuses);
        return 'ring-viewed';
      }
      // Cross-surface fallback: another surface may label the same demo
      // slides differently. Only trust it while nothing is unseen and the
      // author has not grown past the lineup we last finished.
      if (!rec.unseen && statuses.length <= (rec.count || 0)) {
        rec.total = statuses.length;
        this._save();
        return 'ring-viewed';
      }
      rec.total = statuses.length;
      rec.unseen = Math.max(rec.unseen || 0, statuses.length - seen) > 0 ? 1 : 0;
      this._save();
      return (meta && meta.isLive) || (meta && meta.isMine) ? 'ring-live' : 'ring-has';
    },
    ringForPerson(idOrHandle, statuses, meta) {
      return this.register(idOrHandle, statuses, meta);
    },
    ringOf(idOrHandle) {
      var key = this.key(idOrHandle);
      if (!key) return null;
      var meta = this._authors[key];
      if (meta && meta.statuses) return this.register(key, meta.statuses, meta.meta);
      var rec = this._load()[key];
      if (!rec) return null;
      if (rec.unseen > 0) return 'ring-has';
      if ((rec.total || 0) > 0 || (rec.count || 0) > 0) return 'ring-viewed';
      return null;
    },
    isStatusSeen(idOrHandle, status, index) {
      var key = this.key(idOrHandle);
      var rec = this._load()[key] || {};
      return !!status.viewed || !!((rec.ids || {})[this._statusKey(status, index)]);
    },
    /* Called for the slide currently on screen. Persists + returns new ring. */
    markSeen(idOrHandle, status, index) {
      var key = this.key(idOrHandle);
      var rec = this._rec(key);
      var meta = this._authors[key];
      var slides = (meta && meta.statuses) || null;
      if (slides && slides[index] && !slides[index].viewed) slides[index].viewed = true;
      if (status) status.viewed = true;
      rec.ids[this._statusKey(status, index)] = Date.now();
      // Only gray the ring when EVERY current slide has actually been seen.
      if (slides) {
        var self = this;
        var seen = slides.filter(function (s, i) {
          return !!s.viewed || !!rec.ids[self._statusKey(s, i)];
        }).length;
        rec.total = slides.length;
        rec.unseen = seen >= slides.length ? 0 : 1;
        if (!rec.unseen) rec.count = slides.length;
      } else {
        rec.unseen = 1;
      }
      rec.at = Date.now();
      this._save();
      if (!rec.unseen && slides) return { changed: true, ring: 'ring-viewed' };
      return { changed: true, ring: 'ring-has' };
    },
    /* Live backend state: { has, total, unseen, ring }. */
    setState(idOrHandle, st) {
      var key = this.key(idOrHandle);
      if (!key || !st) return;
      var rec = this._rec(key);
      if (st.has === false || st.total === 0) { rec.total = 0; rec.unseen = 0; }
      else {
        rec.total = +st.total || 0;
        rec.unseen = +st.unseen || 0;
        if (!rec.unseen) rec.count = Math.max(rec.count || 0, rec.total);
      }
      rec.at = Date.now();
      this._save();
    },
    /* Live DB truth: fetch seen-state for handles once per page load so a
       fresh device/session still greys rings the server already counted. */
    _liveAsked: {},
    syncLive(handles) {
      if (!_liveSession()) return Promise.resolve(null);
      var self = this;
      var keys = (handles || []).map(function (h) { return self.key(h); })
        .filter(function (k) { return k && k !== 'you' && !self._liveAsked[k]; });
      keys = keys.filter(function (k, i) { return keys.indexOf(k) === i; });
      if (!keys.length) return Promise.resolve(null);
      keys.forEach(function (k) { self._liveAsked[k] = 1; });
      return fetch('/api/statuses/state?handles=' + encodeURIComponent(keys.join(',')), {
        credentials: 'include',
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        var states = d && d.states;
        if (!states) return null;
        Object.keys(states).forEach(function (k) { self.setState(k, states[k]); });
        try { self.applyAll(); } catch (e) {}
        return states;
      }).catch(function () { return null; });
    },
    setRing(idOrHandle, ring) {
      var key = this.key(idOrHandle);
      if (!key || !ring) return;
      var rec = this._rec(key);
      if (ring === 'ring-viewed') {
        rec.unseen = 0;
        rec.count = Math.max(rec.count || 0, rec.total || 0);
      } else if (ring === 'ring-has' || ring === 'ring-live') {
        rec.unseen = Math.max(1, rec.unseen || 0);
      }
      rec.at = Date.now();
      this._save();
    },
    /* Start grey wherever the store already says viewed. Auto-runs once on
       inject; call again after rendering dynamic content. */
    applyAll(root) {
      try {
        (root || document).querySelectorAll('[data-status-ring]').forEach(function (el) {
          var ring = StatusStore.ringOf(el.getAttribute('data-status-ring'));
          if (ring) _syncDom(el.getAttribute('data-status-ring'), ring);
        });
      } catch (e) {}
    },
  };

  const _RING_CLASSES = ['ring-has', 'ring-live', 'ring-viewed', 'ring-none'];
  function _syncDom(wid, ring) {
    var key = _normAuthor(wid);
    if (!key) return;
    try {
      document.querySelectorAll('[data-status-ring]').forEach(function (el) {
        if (_normAuthor(el.getAttribute('data-status-ring')) !== key) return;
        el.classList.remove.apply(el.classList, _RING_CLASSES);
        if (ring) el.classList.add(ring);
      });
    } catch (e) {}
  }
  /* Single emit point: persist → auto-swap stamped DOM → page callbacks. */
  function _emit(wid, ring, name) {
    var key = _normAuthor(name || wid);
    if (key && ring) StatusStore.setRing(key, ring);
    _syncDom(key || wid, ring);
    try {
      window.dispatchEvent(new CustomEvent('drostatus:change', {
        detail: { key: key, wid: wid, ring: ring },
      }));
    } catch (e) {}
    if (typeof window.onStatusViewerChange === 'function') {
      try { window.onStatusViewerChange(wid, ring); } catch (e) {}
    }
  }

  /* ── Status ads: a full-page ad slide after every Nth status ──
     Slot id `status:every-3rd` is marketing-targetable (page `status`):
     kill switch, per-slot flags and inventory all apply. No pool (or a
     failed load) means no ad slides at all — never an empty ad frame. */
  const STATUS_AD_EVERY = 3;
  const STATUS_AD_SLOT  = 'status:every-3rd';
  let _statusEvery = STATUS_AD_EVERY;
  let _seq        = [];   // flat playback timeline: {kind:'status',wi,si} | {kind:'ad',ad,wi}
  let _seqIdx     = 0;
  let _onAd       = false;
  let _statusAds  = [];
  let _adCursor   = 0;
  let _currentAd  = null;   // ad on stage, waiting for complete/skip
  let _adCompleted = false; // full duration played
  let _lastStatusId = '';   // status the surrounding ad was served between
  let _adShowing   = '';    // showingId shared by this ad's lifecycle events

  function _trackAd(id, ev) {
    try {
      if (id && window.AdService) {
        AdService.track(id, ev, {
          page: 'status', slot: STATUS_AD_SLOT,
          statusId: _lastStatusId, showingId: _adShowing,
        });
      }
    } catch (e) {}
  }
  /* Leaving an ad: full play = complete, anything earlier = skip. */
  function _finishAd() {
    if (!_currentAd) return;
    _trackAd(_currentAd.id, _adCompleted ? 'complete' : 'skip');
    _currentAd = null;
    _adCompleted = false;
    _adShowing = '';
  }
  async function loadStatusAds() {
    _statusAds = [];
    try {
      if (!window.AdService) return;
      let placement = null;
      try { placement = await AdService.getPlacement('status'); } catch (e) { placement = null; }
      if (placement && placement.enabled === false) return;
      _statusEvery = Math.max(1, parseInt(placement && placement.interval, 10) || STATUS_AD_EVERY);
      try {
        const sk = placement && placement.slots && placement.slots[STATUS_AD_SLOT];
        if (sk === false || (sk && typeof sk === 'object' && sk.enabled === false)) return;
      } catch (e) {}
      const pools = await AdService.getAds({ page: 'status', slot: STATUS_AD_SLOT });
      const all = [].concat(pools.fullscreen || [], pools.native || [], pools.banner || [], pools.book || []).filter(Boolean);
      _statusAds = all.slice(0, 6);
    } catch (e) { _statusAds = []; }
  }
  function nextStatusAd() {
    if (!_statusAds.length) return null;
    const ad = _statusAds[_adCursor % _statusAds.length]; _adCursor++;
    return ad;
  }
  function buildSeq() {
    _seq = []; _seqIdx = 0; _onAd = false;
    let sinceAd = 0;
    _writers.forEach((w, wi) => {
      (w.statuses || []).forEach((s, si) => {
        _seq.push({ kind: 'status', wi: wi, si: si });
        sinceAd++;
      });
      /* Ads land BETWEEN authors — never between two statuses of the same
         author, which would cut one person's storyline in half. */
      if (sinceAd >= _statusEvery) {
        const ad = nextStatusAd();
        if (ad) _seq.push({ kind: 'ad', ad: ad, wi: wi });
        sinceAd = 0;
      }
    });
  }
  function _fillEl() {
    return document.getElementById(_onAd ? 'dsv2FillAd' : 'dsv2Fill' + _slideIdx);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Toast
  // ══════════════════════════════════════════════════════════════════════
  function _toast(msg) {
    // Viewer-owned toast: host toasts sit below this overlay (and near the
    // engagement pill) so they either vanish or cover the counts.
    const el = document.getElementById('dsv2Toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════
  function _fmtN(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  }

  function _currentWriter() {
    return _writers[_writerIdx] || null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Timer helpers
  // ══════════════════════════════════════════════════════════════════════
  function _startTimer(remaining) {
    clearTimeout(_timer);
    _lastTickAt = _now();
    _timer = setTimeout(() => {
      if (_onAd) _adCompleted = true;
      _navigate(1);
    }, Math.max(0, remaining));
  }

  function _pauseTimer() {
    if (_paused) return;
    _paused = true;
    const t = _now();
    _elapsed += Math.max(0, t - _lastTickAt);
    _lastTickAt = t;
    clearTimeout(_timer);
    // Freeze the fill bar where it visually is
    const fill = _fillEl();
    if (fill) {
      const computed = window.getComputedStyle(fill).width;
      const parentW  = fill.parentElement.offsetWidth || 1;
      const pct      = (parseFloat(computed) / parentW) * 100;
      fill.style.transition = 'none';
      fill.style.width      = pct + '%';
    }
  }

  function _resumeTimer() {
    if (!_paused) return;
    _paused  = false;
    _lastTickAt = _now();
    const remaining = Math.max(0, STATUS_DUR - _elapsed);

    // Re-animate the bar for the remaining time
    const fill = _fillEl();
    const token = _slideToken;
    if (fill) {
      const computed = window.getComputedStyle(fill).width;
      const parentW  = fill.parentElement.offsetWidth || 1;
      const fromPct  = (parseFloat(computed) / parentW) * 100;
      // Force reflow then animate
      fill.style.transition = 'none';
      fill.style.width      = fromPct + '%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (token !== _slideToken || _paused) return;
          fill.style.transition = `width ${remaining}ms linear`;
          fill.style.width      = '100%';
        });
      });
    }

    if (remaining <= 0) {
      // Slide ran out while held — advance once, and swallow the click the
      // browser fires on release so it can't skip a second slide.
      _navSuppressUntil = _now() + 700;
      if (_onAd) _adCompleted = true;
      _navigate(1);
      return;
    }
    _startTimer(remaining);
  }

  /* Taps advance; the synthetic click after a press-and-hold must not. */
  function _tapNav(dir) {
    if (_now() < _navSuppressUntil) return;
    _navigate(dir);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════
  function _isLiveStatusId(id) {
    return /^[a-f0-9]{24}$/i.test(String(id || ''));
  }
  function _liveSession() {
    try {
      return !!(window.AuthSession && typeof AuthSession.getStoredUser === 'function' && AuthSession.getStoredUser());
    } catch (e) { return false; }
  }
  /* Persist "I saw this" once per status. Signed-in readers and guests both
     count (guests carry a stable client id); demo slides log locally. */
  function _reportView(w, slide) {
    var sid = slide && slide.id;
    if (!sid || _reportedViews[sid] || _isMine(w)) return;
    _reportedViews[sid] = 1;
    if (window.DroboardStatus && typeof DroboardStatus.recordView === 'function') {
      try { DroboardStatus.recordView(slide, w); return; } catch (e) {}
    }
    if (!_isLiveStatusId(sid)) return;
    // Pages that don't load status-service.js still count guests: same
    // persistent client id the service uses.
    let anon = '';
    try {
      anon = localStorage.getItem('dro_status_anon_id') || '';
      if (!anon) {
        anon = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('dro_status_anon_id', anon);
      }
    } catch (e) {}
    fetch('/api/statuses/' + encodeURIComponent(sid) + '/view', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: anon || undefined }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.views != null) slide.views = d.views;
    }).catch(function () {});
  }

  // ══════════════════════════════════════════════════════════════════════
  // Seen-by sheet (owner taps the eye count)
  // ══════════════════════════════════════════════════════════════════════
  function _esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function _ago(iso) {
    if (!iso) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  }
  function _seenOpen() {
    const el = document.getElementById('dsv2Seen');
    return !!(el && el.classList.contains('open'));
  }
  function _closeSeen() {
    _seenToken++;
    const el = document.getElementById('dsv2Seen');
    if (el) el.classList.remove('open');
    if (_seenWasPlaying) _resumeTimer();
    _seenWasPlaying = false;
  }
  /* Per-slide viewers from the shared adapter (backend when live, seeded
     demo audience otherwise). Owners only — never rendered for other people. */
  function _openSeen() {
    const w = _currentWriter();
    const entry = _seq[_seqIdx];
    const slide = (w && entry && entry.kind === 'status') ? (w.statuses || [])[entry.si] : null;
    if (!w || !slide || !_isMine(w)) return;
    const sheet  = document.getElementById('dsv2Seen');
    const listEl = document.getElementById('dsv2SeenList');
    const countEl = document.getElementById('dsv2SeenCount');
    if (!sheet || !listEl) return;

    _seenWasPlaying = !_paused;
    _pauseTimer();
    const token = ++_seenToken;
    sheet.classList.add('open');
    countEl.textContent = '';
    listEl.innerHTML = '<div class="dsv2-seen-empty">Loading viewers…</div>';

    const api = window.DroboardStatus;
    const p = (api && typeof api.viewers === 'function')
      ? api.viewers(slide.id)
      : Promise.resolve({ views: slide.views || 0, named: [], guests: 0 });

    p.then(function (d) {
      if (token !== _seenToken) return;
      d = d || {};
      if (d.views != null) slide.views = d.views;
      countEl.textContent = _fmtN(d.views || 0);
      const named = (d.named || []).filter(Boolean);
      const guests = d.guests || 0;
      if (!named.length && !guests) {
        listEl.innerHTML = '<div class="dsv2-seen-empty">No views yet — share your status to get eyes on it.</div>';
        return;
      }
      listEl.innerHTML = named.map(function (v) {
        const init = (v.name || '?')[0].toUpperCase();
        const av = v.avatar
          ? '<img class="dsv2-seen-av" src="' + _esc(v.avatar) + '" alt=""/>'
          : '<div class="dsv2-seen-av">' + _esc(init) + '</div>';
        const sub = v.handle ? '@' + v.handle : 'Reader';
        return '<div class="dsv2-seen-row">' + av +
          '<div class="dsv2-seen-meta"><div class="dsv2-seen-name">' + _esc(v.name || 'Reader') + '</div>' +
          '<div class="dsv2-seen-handle">' + _esc(sub) + '</div></div>' +
          '<div class="dsv2-seen-at">' + _esc(_ago(v.at)) + '</div></div>';
      }).join('') + (guests
        ? '<div class="dsv2-seen-guest"><i class="fas fa-user-secret"></i>' +
          _fmtN(guests) + ' signed-out ' + (guests === 1 ? 'view' : 'views') + '</div>'
        : '');
    }).catch(function () {
      if (token !== _seenToken) return;
      listEl.innerHTML = '<div class="dsv2-seen-empty">Could not load viewers.</div>';
    });
  }

  function _renderSlide() {
    clearTimeout(_timer);
    _slideToken++;
    _elapsed  = 0;
    _paused   = false;
    _pressAt  = 0;
    _lastTickAt = _now();
    const entry = _seq[_seqIdx];
    if (!entry) return;
    if (entry.kind === 'ad' && entry.ad) { _renderAd(entry); return; }
    _onAd = false;
    document.getElementById('dsv2Ov').classList.remove('showing-ad');
    _writerIdx = entry.wi; _slideIdx = entry.si;

    const w = _currentWriter();
    if (!w) return;

    const slides  = w.statuses || [];
    const slide   = slides[_slideIdx];
    if (!slide) return;
    _lastStatusId = slide.id || '';
    _currentAd = null;
    _adCompleted = false;
    _adShowing = '';

    // ── Per-status seen state (never author-level) ──
    const authorKey = w.name || w.id;
    const priorRing = w.ring;
    StatusStore.register(authorKey, slides, { isLive: w.isLive, isMine: _isMine(w) });
    StatusStore.markSeen(authorKey, slide, _slideIdx);
    const ring = StatusStore.ringForPerson(authorKey, slides, { isLive: w.isLive, isMine: _isMine(w) });
    w.ring = ring;
    if (priorRing !== ring) _emit(w.id, ring, authorKey);
    _reportView(w, slide);

    // ── Progress bars ──
    const barsEl = document.getElementById('dsv2Bars');
    barsEl.innerHTML = slides.map((_, i) =>
      `<div class="dsv2-bar"><div class="dsv2-bar-fill${i < _slideIdx ? ' complete' : ''}" id="dsv2Fill${i}"></div></div>`
    ).join('');

    // ── Writer info ──
    const nameEl = document.getElementById('dsv2WriterName');
    const timeEl = document.getElementById('dsv2WriterTime');
    const avWrap = document.getElementById('dsv2AvWrap');

    nameEl.textContent = '@' + w.name;
    timeEl.textContent = slide.time || '';

    if (w.avatar) {
      avWrap.innerHTML = `<img class="dsv2-writer-av" src="${w.avatar}" alt="${w.name}" onclick="location.href='profile.html'"/>`;
    } else {
      const init = (w.name || '?')[0].toUpperCase();
      avWrap.innerHTML = `<div class="dsv2-writer-av-init" onclick="location.href='profile.html'">${init}</div>`;
    }

    // ── Slide content (bg may be an image URL or a CSS gradient) ──
    const bgStyle = (slide.bg && slide.bg.indexOf('linear-gradient') === 0)
      ? `background:${slide.bg}`
      : `background-image:url('${slide.bg || ''}')`;
    const contentEl = document.getElementById('dsv2Content');
    contentEl.innerHTML = `
      <div class="dsv2-slide" style="${bgStyle};background-size:cover;background-position:center">
        <div class="dsv2-slide-grad"></div>
        <div class="dsv2-slide-text">
          <div class="dsv2-slide-quote">${slide.quote || ''}</div>
          ${slide.caption ? `<div class="dsv2-slide-caption">${slide.caption}</div>` : ''}
          ${slide.storyRef && slide.storyRef.id ? `<div><div class="dsv2-slide-story" data-story-open="${String(slide.storyRef.id).replace(/"/g, '&quot;')}" title="Open ${String(slide.storyRef.title || 'story').replace(/"/g, '&quot;')} in reader">${slide.storyRef.cover ? `<img src="${slide.storyRef.cover}" alt=""/>` : ''}<span>${slide.storyRef.title || 'Open story'}</span><span class="dsv2-story-go">Read &rsaquo;</span></div></div>` : ''}
        </div>
      </div>
      <div class="dsv2-nav-left"  id="dsv2NavLeft"></div>
      <div class="dsv2-nav-right" id="dsv2NavRight"></div>
    `;

    // Tap navigation (long-press release clicks are swallowed)
    document.getElementById('dsv2NavLeft').addEventListener('click',  () => _tapNav(-1));
    document.getElementById('dsv2NavRight').addEventListener('click', () => _tapNav(1));
    // Linked story chip (status posted with a story attached)
    contentEl.querySelectorAll('[data-story-open]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var sid = chip.getAttribute('data-story-open');
        if (sid) location.href = 'bridge.html?id=' + encodeURIComponent(sid);
      });
    });

    // ── Engagement (per-status like) ──
    const ls = _likeState[_likeKey(w, _slideIdx)] || { liked: false, count: 0 };
    const likeBtn    = document.getElementById('dsv2LikeBtn');
    const likeCount  = document.getElementById('dsv2LikeCount');
    const threadCount = document.getElementById('dsv2ThreadCount');

    likeBtn.classList.toggle('loved', ls.liked);
    likeCount.textContent  = _fmtN(ls.count);
    threadCount.textContent = _fmtN(w.threads || 0) + ' threads';

    // ── Owner-only view count ──
    const mine    = _isMine(w);
    const viewsEl = document.getElementById('dsv2Views');
    const viewsDiv = document.getElementById('dsv2ViewsDiv');
    if (viewsEl && viewsDiv) {
      viewsEl.classList.toggle('show', mine);
      viewsDiv.classList.toggle('show', mine);
      let vn = slide.views != null ? slide.views : (w.views || 0);
      if (mine && !_isLiveStatusId(slide.id) && window.DroboardStatus && DroboardStatus.viewsOf) {
        try { vn = Math.max(vn, DroboardStatus.viewsOf(slide)); } catch (e) {}
      }
      document.getElementById('dsv2ViewCount').textContent = _fmtN(vn);
    }

    // ── Animate fill bar for current slide ──
    const token = _slideToken;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== _slideToken) return;
        const fill = _fillEl();
        if (fill) {
          fill.style.transition = `width ${STATUS_DUR}ms linear`;
          fill.style.width      = '100%';
        }
        _startTimer(STATUS_DUR);
      });
    });
  }

  /* ── Full-page ad slide: same stage, same duration, same timer ── */
  function _renderAd(entry) {
    const ad = entry.ad || {};
    _onAd = true;
    _slideToken++;
    _elapsed = 0;
    _paused  = false;
    _pressAt = 0;
    _lastTickAt = _now();
    if (typeof entry.wi === 'number') _writerIdx = entry.wi;
    const ov = document.getElementById('dsv2Ov');
    ov.classList.add('showing-ad');
    document.getElementById('dsv2Views').classList.remove('show');
    document.getElementById('dsv2ViewsDiv').classList.remove('show');

    // Bars: the ad owns the stage — the previous author's status bars are
    // not shown here, so an ad never looks like part of someone's profile.
    const barsEl = document.getElementById('dsv2Bars');
    barsEl.innerHTML = `<div class="dsv2-bar"><div class="dsv2-bar-fill" id="dsv2FillAd"></div></div>`;

    // Header carries the sponsor
    document.getElementById('dsv2WriterName').textContent = 'Sponsored';
    document.getElementById('dsv2WriterTime').textContent = ad.brand || '';
    const avWrap = document.getElementById('dsv2AvWrap');
    avWrap.innerHTML = ad.logo ? `<img class="dsv2-writer-av" src="${ad.logo}" alt=""/>` : '';

    // Full-bleed creative from the shared ad-card component (same visual
    // language as index fullscreen ads): story → cover slide, else brand.
    let inner = '';
    try {
      if (window.DroboardAdCard) {
        inner = (ad.isBook || ad.format === 'book' || ad.format === 'storyPromo')
          ? DroboardAdCard.renderFullscreenStory(ad)
          : DroboardAdCard.renderFullscreenBrand(ad);
      }
    } catch (e) { inner = ''; }
    if (!inner) { _navigate(1); return; }
    _currentAd = ad;
    _adCompleted = false;
    _adShowing = (window.AdService && AdService.newShowing) ? AdService.newShowing() : '';
    const contentEl = document.getElementById('dsv2Content');
    contentEl.innerHTML = `
      <div data-slot="status:every-3rd"${ad.id ? ` data-adid="${ad.id}"` : ''} style="height:100%">
        ${inner}
      </div>
      <div class="dsv2-nav-left" id="dsv2NavLeft"></div>
      <div class="dsv2-nav-right" id="dsv2NavRight"></div>
    `;
    document.getElementById('dsv2NavLeft').addEventListener('click', () => _tapNav(-1));
    document.getElementById('dsv2NavRight').addEventListener('click', () => _tapNav(1));
    contentEl.querySelectorAll('[data-fs-story]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _trackAd(ad.id, 'click');
      location.href = 'bridge.html?id=' + encodeURIComponent(btn.dataset.fsStory || '');
    }));
    contentEl.querySelectorAll('[data-fs-url]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _trackAd(ad.id, 'click');
      const url = btn.dataset.fsUrl;
      if (url) { try { window.open(url, '_blank'); } catch (err) {} }
      else _toast('🔗 ' + (ad.brand || ad.cta || 'Sponsored'));
    }));

    _trackAd(ad.id, 'impression');
    try {
      if (window.AdService && AdService.observe) {
        AdService.observe(contentEl, ad.id, {
          page: 'status', slot: STATUS_AD_SLOT,
          statusId: _lastStatusId, showingId: _adShowing,
        });
      }
    } catch (e) {}
    const token = _slideToken;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== _slideToken) return;
        const fill = document.getElementById('dsv2FillAd');
        if (fill) {
          fill.style.transition = `width ${STATUS_DUR}ms linear`;
          fill.style.width      = '100%';
        }
        _startTimer(STATUS_DUR);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Navigation (within slides and between writers)
  // ══════════════════════════════════════════════════════════════════════
  function _navigate(dir) {
    clearTimeout(_timer);
    _paused   = false;
    _elapsed  = 0;
    _pressAt  = 0;
    _slideToken++;

    _finishAd();

    const next = _seqIdx + dir;
    if (next < 0 || next >= _seq.length) {
      closeStatusViewer();
      return;
    }
    _seqIdx = next;
    _renderSlide();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public: open / close
  // ══════════════════════════════════════════════════════════════════════
  async function openStatusViewer(writerStatuses, wid) {
    _writers = (writerStatuses || []).filter(w => w.statuses && w.statuses.length);
    if (!_writers.length) { _toast('No statuses available'); return; }

    // Resolve each author's ring from persisted per-status seen state before
    // playback, so a fully-seen author starts grey even if the caller's data
    // still says "new".
    _writers.forEach(w => {
      w.ring = StatusStore.register(w.name || w.id, w.statuses, {
        isLive: w.isLive, isMine: _isMine(w),
      });
    });

    // Await the ad pool BEFORE building the timeline — otherwise the
    // first session always builds an ad-free timeline (pool not warm yet).
    try { await loadStatusAds(); } catch (e) {}

    // Flat playback timeline (status slides + ad markers)
    buildSeq();

    // Find target writer's first status
    _seqIdx = 0;
    for (let i = 0; i < _seq.length; i++) {
      const e = _seq[i];
      if (e.kind === 'status' && _writers[e.wi] && _writers[e.wi].id === wid) { _seqIdx = i; break; }
    }
    _paused    = false;
    _elapsed   = 0;
    _pressAt   = 0;
    _navSuppressUntil = 0;
    _slideToken++;

    // Init like state (per-session, one entry per individual status)
    _writers.forEach(w => {
      (w.statuses || []).forEach((st, si) => {
        const k = _likeKey(w, si);
        if (!_likeState[k]) {
          _likeState[k] = {
            liked: !!(st && st.liked),
            count: (st && st.likes != null) ? st.likes : (w.likes || 0),
          };
        }
      });
    });

    // Reset reply input
    const inp  = document.getElementById('dsv2ReplyInp');
    const send = document.getElementById('dsv2ReplySend');
    if (inp)  inp.value = '';
    if (send) send.disabled = true;

    document.getElementById('dsv2Ov').classList.add('open');
    document.body.style.overflow = 'hidden';

    _renderSlide();
  }

  function closeStatusViewer() {
    clearTimeout(_timer);
    _finishAd(); // closing on an ad = skip (complete only after full play)
    _paused   = false;
    _pressAt  = 0;
    _slideToken++;
    // No author-level "mark everything viewed" on close: each slide is
    // marked the moment it is shown, and a half-watched author stays red.
    const ov = document.getElementById('dsv2Ov');
    ov.classList.remove('open');
    ov.classList.remove('showing-ad');
    const seen = document.getElementById('dsv2Seen');
    if (seen) seen.classList.remove('open');
    _seenToken++;
    _seenWasPlaying = false;
    document.body.style.overflow = '';
  }

  // ══════════════════════════════════════════════════════════════════════
  // Inject CSS + HTML
  // ══════════════════════════════════════════════════════════════════════
  function _inject() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = HTML.trim();
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    _bindEvents();
    try { StatusStore.applyAll(); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // Bind events
  // ══════════════════════════════════════════════════════════════════════
  function _bindEvents() {
    // Close button
    document.getElementById('dsv2CloseBtn').addEventListener('click', closeStatusViewer);

    // ── Owner: viewers of the current slide ──
    document.getElementById('dsv2Views').addEventListener('click', e => {
      e.stopPropagation();
      _openSeen();
    });
    document.getElementById('dsv2SeenClose').addEventListener('click', e => {
      e.stopPropagation();
      _closeSeen();
    });
    document.getElementById('dsv2Seen').addEventListener('click', e => {
      if (e.target && e.target.id === 'dsv2Seen') _closeSeen();
    });

    // ── Press-and-hold to pause ──
    const ov = document.getElementById('dsv2Ov');
    const HOLD_MS = 320;

    ov.addEventListener('pointerdown', e => {
      // Don't pause on interactive controls
      if (e.target.closest('.dsv2-close, .dsv2-engage, .dsv2-bottom, .dsv2-top, .dsv2-slide-story, .dsv2-seen')) return;
      if (e.button != null && e.button > 0) return;
      _pressAt = _now();
      _pauseTimer();
    });

    // Release anywhere (finger may leave the stage) resumes playback once.
    function release(e) {
      // The Seen-by sheet owns playback state while it is open.
      if (_seenOpen()) { _pressAt = 0; return; }
      if (!_paused) { _pressAt = 0; return; }
      const held = _pressAt ? _now() - _pressAt : 0;
      _pressAt = 0;
      if (held >= HOLD_MS) {
        // Swallow the synthetic click that follows a long press; otherwise
        // releasing after a hold advances the slide a second time.
        _navSuppressUntil = _now() + 600;
      }
      _resumeTimer();
    }
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    window.addEventListener('blur', () => { if (_paused) release(); });

    // iOS/Android long-press callout can cancel the gesture mid-hold.
    ov.addEventListener('contextmenu', e => e.preventDefault());
    ov.addEventListener('dragstart', e => e.preventDefault());

    // ── Like (love) — per individual status ──
    document.getElementById('dsv2LikeBtn').addEventListener('click', e => {
      e.stopPropagation();
      const w = _currentWriter();
      if (!w) return;
      const k = _likeKey(w, _slideIdx);
      if (!_likeState[k]) _likeState[k] = { liked: false, count: 0 };
      const ls = _likeState[k];
      ls.liked  = !ls.liked;
      ls.count += ls.liked ? 1 : -1;
      const btn = document.getElementById('dsv2LikeBtn');
      btn.classList.toggle('loved', ls.liked);
      document.getElementById('dsv2LikeCount').textContent = _fmtN(ls.count);
      _toast(ls.liked ? '❤️ Loved!' : 'Removed love');

      const slide = (w.statuses || [])[_slideIdx];
      const sid = slide && slide.id;
      if (slide) { slide.liked = ls.liked; slide.likes = ls.count; }
      if (sid && _isLiveStatusId(sid) && _liveSession()) {
        fetch('/api/statuses/' + encodeURIComponent(sid) + '/like', {
          method: 'POST', credentials: 'include',
        }).then(r => r.ok ? r.json() : null).then(d => {
          if (!d) return;
          if (d.likes != null) ls.count = d.likes;
          else if (d.count != null) ls.count = d.count;
          if (d.liked != null) { ls.liked = !!d.liked; btn.classList.toggle('loved', ls.liked); }
          if (slide) { slide.likes = ls.count; slide.liked = ls.liked; }
          document.getElementById('dsv2LikeCount').textContent = _fmtN(ls.count);
        }).catch(() => {});
      }
    });

    // ── Threads → thread.html ──
    document.getElementById('dsv2ThreadsBtn').addEventListener('click', e => {
      e.stopPropagation();
      const w = _currentWriter();
      location.href = 'thread.html' + (w ? '?wid=' + w.id : '');
    });

    // ── Reply input ──
    const inp  = document.getElementById('dsv2ReplyInp');
    const send = document.getElementById('dsv2ReplySend');

    inp.addEventListener('focus', () => _pauseTimer());
    inp.addEventListener('blur',  () => _resumeTimer());
    inp.addEventListener('input', () => {
      send.disabled = inp.value.trim().length < 2;
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') _sendReply();
    });
    send.addEventListener('click', _sendReply);
  }

  function _sendReply() {
    const inp  = document.getElementById('dsv2ReplyInp');
    const send = document.getElementById('dsv2ReplySend');
    if (!inp || inp.value.trim().length < 2) return;
    _toast('💬 Reply sent!');
    inp.value     = '';
    send.disabled = true;
    inp.blur();
    _resumeTimer();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Expose globals
  // ══════════════════════════════════════════════════════════════════════
  window.openStatusViewer  = openStatusViewer;
  window.closeStatusViewer = closeStatusViewer;
  window.StatusStore       = StatusStore;
  window.STATUS_VIEWED_RING = '#f1f1f1';
  document.documentElement.style.setProperty('--status-viewed-ring', '#f1f1f1');

  // ══════════════════════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _inject);
  } else {
    _inject();
  }
  // Warm the status-ad pool early so it's ready by first open
  try { loadStatusAds(); } catch (e) {}

})();