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
 */

(function () {
  'use strict';

  if (window.__droboardStatusViewer) return;
  window.__droboardStatusViewer = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    /* ── Overlay ── */
    .dsv2-ov {
      position: fixed; inset: 0; z-index: 2000;
      background: #000;
      display: none; flex-direction: column;
      font-family: 'DM Sans', system-ui, sans-serif;
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
      display: inline-flex; align-items: center; gap: 7px; margin-top: 12px;
      background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px; padding: 7px 14px 7px 8px; cursor: pointer;
      position: relative; z-index: 20; max-width: 100%;
    }
    .dsv2-slide-story img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
    .dsv2-slide-story span { font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Tap nav zones */
    .dsv2-nav-left {
      position: absolute; left: 0; top: 0; bottom: 0; width: 35%; z-index: 10;
      cursor: pointer;
    }
    .dsv2-nav-right {
      position: absolute; right: 0; top: 0; bottom: 0; width: 35%; z-index: 10;
      cursor: pointer;
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
    .dsv2-engage-div {
      width: 1px; height: 14px; background: rgba(255,255,255,.2);
    }
    .dsv2-engage-threads {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 700; color: #fff;
      cursor: pointer;
    }
    .dsv2-engage-threads i { font-size: 13px; color: #38bdf8; }
    .dsv2-engage-threads:hover { opacity: .85; }

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

    /* ── Toast ── */
    .dsv2-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
      left: 50%; transform: translateX(-50%) translateY(16px);
      background: #111; border: 1px solid rgba(255,255,255,.08);
      color: #e0e0e0; padding: 8px 18px; border-radius: 24px;
      font-size: 12px; font-weight: 600; z-index: 2100;
      opacity: 0; transition: .28s; pointer-events: none;
      white-space: nowrap; font-family: inherit;
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
  let _pauseStart   = 0;
  let _elapsed      = 0;    // ms already elapsed on this slide before any pause
  let _likeState    = {};   // { [wid + ':' + slideIdx]: { liked: bool, count: number } } — per STATUS, not per author
  let _animFrame    = null;

  // A like belongs to each individual status — key by author + slide index.
  function _likeKey(w, si) { return (w && w.id) + ':' + si; }

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

  function _trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
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
    let n = 0;
    _writers.forEach((w, wi) => {
      (w.statuses || []).forEach((s, si) => {
        _seq.push({ kind: 'status', wi: wi, si: si }); n++;
        if (n % _statusEvery === 0) {
          const ad = nextStatusAd();
          if (ad) _seq.push({ kind: 'ad', ad: ad, wi: wi });
        }
      });
    });
  }
  function _fillEl() {
    return document.getElementById(_onAd ? 'dsv2FillAd' : 'dsv2Fill' + _slideIdx);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Toast
  // ══════════════════════════════════════════════════════════════════════
  function _toast(msg) {
    // Prefer the host page's global toast if available
    if (typeof window.toast === 'function') { window.toast(msg); return; }
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
    _timer = setTimeout(() => _navigate(1), remaining);
  }

  function _pauseTimer() {
    if (_paused) return;
    _paused = true;
    _pauseStart = Date.now();
    clearTimeout(_timer);
    // Freeze the fill bar
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
    const held = Date.now() - _pauseStart;
    _elapsed += held;
    const remaining = Math.max(0, STATUS_DUR - _elapsed);

    // Re-animate the bar for the remaining time
    const fill = _fillEl();
    if (fill) {
      const computed = window.getComputedStyle(fill).width;
      const parentW  = fill.parentElement.offsetWidth || 1;
      const fromPct  = (parseFloat(computed) / parentW) * 100;
      // Force reflow then animate
      fill.style.transition = 'none';
      fill.style.width      = fromPct + '%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fill.style.transition = `width ${remaining}ms linear`;
          fill.style.width      = '100%';
        });
      });
    }

    _startTimer(remaining);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════
  function _renderSlide() {
    clearTimeout(_timer);
    _elapsed  = 0;
    _paused   = false;
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

    // ── Mark this slide as viewed (per-segment) ──
    const vw = _currentWriter();
    if(vw && vw.statuses[_slideIdx] && !vw.statuses[_slideIdx].viewed){
      vw.statuses[_slideIdx].viewed = true;
      const allViewed = vw.statuses.every(st=> st.viewed);
      const newRing = allViewed ? 'ring-viewed' : 'ring-has';
      if(vw.ring !== newRing){
        vw.ring = newRing;
        if(typeof window.onStatusViewerChange === 'function') window.onStatusViewerChange(vw.id, newRing);
      } else if(typeof window.onStatusViewerChange === 'function'){
        window.onStatusViewerChange(vw.id, newRing);
      }
    }

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
          ${slide.storyRef && slide.storyRef.id ? `<div><div class="dsv2-slide-story" data-story-open="${String(slide.storyRef.id).replace(/"/g, '&quot;')}">${slide.storyRef.cover ? `<img src="${slide.storyRef.cover}" alt=""/>` : ''}<span>📖 ${slide.storyRef.title || 'Open story'}</span></div></div>` : ''}
        </div>
      </div>
      <div class="dsv2-nav-left"  id="dsv2NavLeft"></div>
      <div class="dsv2-nav-right" id="dsv2NavRight"></div>
    `;

    // Tap navigation
    document.getElementById('dsv2NavLeft').addEventListener('click',  () => _navigate(-1));
    document.getElementById('dsv2NavRight').addEventListener('click', () => _navigate(1));
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

    // ── Animate fill bar for current slide ──
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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
    if (typeof entry.wi === 'number') _writerIdx = entry.wi;
    const w = _writers[_writerIdx] || {};
    const slides = w.statuses || [];
    const ov = document.getElementById('dsv2Ov');
    ov.classList.add('showing-ad');

    // Bars: writer's bars complete + one animating ad bar
    const barsEl = document.getElementById('dsv2Bars');
    barsEl.innerHTML = slides.map((_, i) =>
      `<div class="dsv2-bar"><div class="dsv2-bar-fill complete" id="dsv2Fill${i}"></div></div>`
    ).join('') + `<div class="dsv2-bar"><div class="dsv2-bar-fill" id="dsv2FillAd"></div></div>`;

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
    const contentEl = document.getElementById('dsv2Content');
    contentEl.innerHTML = `
      <div data-slot="status:every-3rd"${ad.id ? ` data-adid="${ad.id}"` : ''} style="height:100%">
        ${inner}
      </div>
      <div class="dsv2-nav-left" id="dsv2NavLeft"></div>
      <div class="dsv2-nav-right" id="dsv2NavRight"></div>
    `;
    document.getElementById('dsv2NavLeft').addEventListener('click', () => _navigate(-1));
    document.getElementById('dsv2NavRight').addEventListener('click', () => _navigate(1));
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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
    _paused  = false;
    _elapsed = 0;

    const next = _seqIdx + dir;
    if (next < 0 || next >= _seq.length) {
      closeStatusViewer();
      return;
    }
    const prevEntry = _seq[_seqIdx];
    _seqIdx = next;
    const entry = _seq[_seqIdx];

    // Keep writer-viewed semantics when crossing into another writer's status
    if (entry.kind === 'status') {
      const w = _writers[entry.wi];
      if (w && (!prevEntry || prevEntry.wi !== entry.wi)) {
        w.ring = 'ring-viewed';
        if (typeof window.onStatusViewerChange === 'function') {
          window.onStatusViewerChange(w.id, 'ring-viewed');
        }
      }
    }

    _renderSlide();
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public: open / close
  // ══════════════════════════════════════════════════════════════════════
  async function openStatusViewer(writerStatuses, wid) {
    _writers = (writerStatuses || []).filter(w => w.statuses && w.statuses.length);
    if (!_writers.length) { _toast('No statuses available'); return; }
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
    _paused = false;
    // Mark current writer as viewed on close (covers single-status writers
    // and early-close — the slide-advance path only fires on multi-slide).
    // Never mark while sitting on an ad slide.
    const vw = _currentWriter();
    if (vw && !_onAd && vw.ring !== 'ring-viewed') {
      vw.ring = 'ring-viewed';
      (vw.statuses || []).forEach(function (st) { st.viewed = true; });
      if (typeof window.onStatusViewerChange === 'function') {
        window.onStatusViewerChange(vw.id, 'ring-viewed');
      }
    }
    document.getElementById('dsv2Ov').classList.remove('open');
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
  }

  // ══════════════════════════════════════════════════════════════════════
  // Bind events
  // ══════════════════════════════════════════════════════════════════════
  function _bindEvents() {
    // Close button
    document.getElementById('dsv2CloseBtn').addEventListener('click', closeStatusViewer);

    // ── Press-and-hold to pause ──
    const ov = document.getElementById('dsv2Ov');
    ov.addEventListener('pointerdown', e => {
      // Don't pause on interactive controls
      if (e.target.closest('.dsv2-close, .dsv2-engage, .dsv2-bottom, .dsv2-writer')) return;
      _pauseTimer();
    });
    ov.addEventListener('pointerup',     () => _resumeTimer());
    ov.addEventListener('pointercancel', () => _resumeTimer());

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