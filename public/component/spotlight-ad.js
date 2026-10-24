/* ===============================================================
   SPOTLIGHT AD v3 — cinematic full-screen takeover.
   Phone-width overlay with blurred cover backdrop, staggered
   entrance, countdown ring + progress bar, and two creative modes:
     - story  → poster, genre, title, author, stats, preview
     - user   → creator spotlight (avatar, handle, followers, books)
   Auto-closes at zero; CTA + optional Skip stay tappable throughout.

   Usage:
     DroboardSpotlight.show({
       story: DroboardSpotlight.fromAd(ad) || { kind:'user', name, handle, ... },
       seconds: 6, allowSkip: true, sponsored: true,
       href: 'bridge.html?id=x', trackId: 'ad-id',
       onCta: fn, onDone: fn,
     });
   =============================================================== */
(function () {
  'use strict';

  var _script = document.currentScript;
  var _iconSrc = '../assets/droboard-icon.png';
  try {
    if (_script && _script.src) _iconSrc = new URL('../assets/droboard-icon.png', _script.src).href;
  } catch (e) {}

  var CSS = [
    '.sl-ov{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:100%;max-width:420px;height:100vh;height:100dvh;z-index:12100;background:#07060a;color:#fff;display:none;overflow:hidden;isolation:isolate;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transition:opacity .26s ease}',
    '@media(min-width:520px){.sl-ov{height:min(92vh,900px);height:min(92dvh,900px);border-radius:30px;border:1px solid rgba(255,255,255,.1);box-shadow:0 40px 120px rgba(0,0,0,.72)}}',
    '.sl-ov.show{display:block}',
    '.sl-ov.vis{opacity:1}',
    '.sl-ov.closing{opacity:0;transition:opacity .22s ease}',
    '.sl-ov *,.sl-ov *::before,.sl-ov *::after{box-sizing:border-box}',
    '.sl-bg{position:absolute;inset:-14% -10%;z-index:0;background:#150b14 center/cover no-repeat;filter:blur(42px) saturate(1.2) brightness(.6);transform:scale(1.12);animation:slBg 9s ease-out both;pointer-events:none}',
    '.sl-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(5,4,9,.5) 0%,rgba(5,4,9,.16) 30%,rgba(5,4,9,.58) 68%,#050409 100%);pointer-events:none}',
    '.sl-glow{position:absolute;z-index:1;left:50%;top:12%;width:72%;aspect-ratio:1;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,0,80,.42) 0%,rgba(255,0,80,.13) 42%,transparent 68%);filter:blur(46px);pointer-events:none}',
    '.sl-top{position:absolute;top:0;left:0;right:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 15px) 18px 8px}',
    '.sl-brand{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.01em}',
    '.sl-mark{width:26px;height:26px;border-radius:8px;object-fit:cover;background:#fff;box-shadow:0 6px 18px rgba(255,0,80,.38);flex-shrink:0}',
    '.sl-wordmark{font-size:12.5px;font-weight:800;letter-spacing:.01em}',
    '.sl-label{font-size:8.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);padding:4px 8px;border-radius:6px}',
    '.sl-label.gold{color:#f4d58a;border-color:rgba(232,200,106,.4);background:rgba(232,200,106,.08)}',
    '.sl-quit{display:none;align-items:center;gap:6px;font:700 11px/1 inherit;color:rgba(255,255,255,.72);background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:8px 13px;cursor:pointer;backdrop-filter:blur(12px);transition:.16s;flex-shrink:0}',
    '.sl-quit.on{display:inline-flex}',
    '.sl-quit:hover{background:rgba(255,255,255,.17);color:#fff}',
    '.sl-quit b{font-variant-numeric:tabular-nums;color:#fff;font-weight:800}',
    '.sl-prog{position:absolute;top:calc(env(safe-area-inset-top,0px) + 58px);left:18px;right:18px;height:2px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden;z-index:6}',
    '.sl-prog-fill{display:block;height:100%;width:100%;border-radius:2px;background:linear-gradient(90deg,#ff0050,#ff9ab4);box-shadow:0 0 12px rgba(255,0,80,.8);transition:opacity .18s}',
    '.sl-hold{position:absolute;z-index:7;top:calc(env(safe-area-inset-top,0px) + 72px);left:50%;transform:translate(-50%,-6px);display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:rgba(8,6,12,.74);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(14px);font:700 10px/1 inherit;letter-spacing:.02em;color:rgba(255,255,255,.78);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;white-space:nowrap}',
    '.sl-hold i{font-size:9px;color:#f4d58a}',
    '.sl-hold.hint{opacity:1;transform:translate(-50%,0)}',
    '.sl-ov.held .sl-hold{opacity:1;transform:translate(-50%,0)}',
    '.sl-ov.held .sl-prog-fill{opacity:.55;box-shadow:none}',
    '.sl-ov.held .sl-ring .sl-ring-fg{stroke:#f4d58a}',
    '.sl-ov.held .sl-ring b{color:#f4d58a}',
    '.sl-ov.held .sl-cta::after{animation-play-state:paused}',
    '.sl-ov{-webkit-user-select:none;user-select:none}',
    '.sl-body{position:relative;z-index:2;height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:calc(env(safe-area-inset-top,0px) + 78px) 24px calc(env(safe-area-inset-bottom,0px) + 22px);display:flex;flex-direction:column}',
    '.sl-body::-webkit-scrollbar{display:none}',
    '.sl-stage{margin:auto 0;display:flex;flex-direction:column;align-items:center;text-align:center;width:100%}',
    '.sl-stage>*{animation:slRise .58s cubic-bezier(.2,.8,.2,1) both}',
    '.sl-stage>*:nth-child(2){animation-delay:.05s}.sl-stage>*:nth-child(3){animation-delay:.1s}.sl-stage>*:nth-child(4){animation-delay:.15s}.sl-stage>*:nth-child(5){animation-delay:.2s}.sl-stage>*:nth-child(6){animation-delay:.24s}.sl-stage>*:nth-child(7){animation-delay:.28s}',
    '.sl-poster{position:relative;width:min(56vw,214px);aspect-ratio:2/3;border-radius:18px;overflow:hidden;background:#141018;border:1px solid rgba(255,255,255,.16);box-shadow:0 34px 70px -18px rgba(255,0,80,.45),0 18px 44px rgba(0,0,0,.66),inset 0 1px 0 rgba(255,255,255,.25);margin-bottom:20px;flex-shrink:0;animation:slPoster .78s cubic-bezier(.2,.8,.2,1) both}',
    '.sl-poster img{width:100%;height:100%;object-fit:cover;display:block}',
    '.sl-poster::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent 26%,transparent 72%,rgba(0,0,0,.38));pointer-events:none}',
    '.sl-poster-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 30% 0%,#3a0f26,#141018 72%);color:rgba(255,255,255,.32);font-size:34px}',
    '.sl-kicker{display:inline-flex;align-items:center;gap:6px;font-size:9.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ffb3c4;margin-bottom:10px}',
    '.sl-kicker i{font-size:8px}',
    '.sl-title{font-family:Georgia,"Times New Roman",serif;font-size:26px;font-weight:700;line-height:1.17;letter-spacing:-.015em;margin:0 0 10px;max-width:334px;text-wrap:balance}',
    '.sl-by{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:rgba(255,255,255,.66);margin-bottom:11px}',
    '.sl-by b{color:#fff;font-weight:700}',
    '.sl-by-av{width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.28);flex-shrink:0;display:block}',
    '.sl-initial{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;background:linear-gradient(135deg,#ff0050,#7a0030);border:1px solid rgba(255,255,255,.22);flex-shrink:0}',
    /* ── top-three board creative (status-style slides) ── */
    '.sl-board{width:100%}',
    '.sl-bsegs{display:flex;gap:4px;width:100%;max-width:330px;margin-bottom:14px}',
    '.sl-bseg{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.18);border:none;padding:0;overflow:hidden;cursor:pointer}',
    '.sl-bseg i{display:block;height:100%;width:0%;background:#fff;border-radius:3px;transition:width .1s linear}',
    '.sl-blead{font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#ffb3c4;margin-bottom:14px;max-width:320px}',
    '.sl-bslide{display:flex;flex-direction:column;align-items:center;width:100%;animation:slSlide .4s cubic-bezier(.2,.8,.2,1) both}',
    '.sl-bavatar-wrap{position:relative;margin-bottom:16px;flex-shrink:0}',
    '.sl-bavatar{width:124px;height:124px;border-radius:50%;box-shadow:0 18px 44px rgba(0,0,0,.45)}',
    '.sl-bavatar img{width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.55);display:block}',
    '.sl-bavatar .sl-initial{width:100%;height:100%;font-size:42px;border:2px solid rgba(255,255,255,.45)}',
    '.sl-brank{position:absolute;bottom:-2px;right:-8px;min-width:38px;height:38px;padding:0 7px;border-radius:999px;display:flex;align-items:center;justify-content:center;font:800 14px/1 inherit;color:#1b1206;background:linear-gradient(135deg,#ffe9a8,#f4c45c);border:3px solid #0b0710;box-shadow:0 8px 18px rgba(244,197,92,.35)}',
    '.sl-brank.r2{background:linear-gradient(135deg,#f1f4f9,#aab3c2);color:#1b1f27}',
    '.sl-brank.r3{background:linear-gradient(135deg,#f0c3a2,#b9774b);color:#2b160b}',
    '.sl-podium{display:flex;gap:6px;width:100%;max-width:330px;margin:18px 0 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:8px;backdrop-filter:blur(8px)}',
    '.sl-pod{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:1px solid transparent;border-radius:10px;padding:6px 4px;cursor:pointer;color:inherit;font-family:inherit;transition:.16s}',
    '.sl-pod.on{background:rgba(255,0,80,.18);border-color:rgba(255,0,80,.45)}',
    '.sl-pod img{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.2);display:block}',
    '.sl-pod b{font-size:8.5px;font-weight:800;color:rgba(255,255,255,.72);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sl-pod.on b{color:#fff}',
    '.sl-pod small{font-size:8px;color:#f4d58a;font-weight:800}',
    '.sl-bnav{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:18px}',
    '.sl-bnav button{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:800 11px/1 inherit;color:#fff;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:9px 14px;cursor:pointer;font-family:inherit;transition:.16s}',
    '.sl-bnav button:hover{background:rgba(255,255,255,.18)}',
    '.sl-bnav .sl-next{background:#fff;color:#111;border-color:#fff}',
    '.sl-bnav .sl-next:hover{filter:brightness(.94)}',
    '.sl-bstats{margin-bottom:14px}',
    '.sl-bstats b{font-size:16px}',
    /* ── promotion / link creative (refer-a-friend, offers) ── */
    '.sl-promo-art{width:min(72vw,280px);aspect-ratio:16/10;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 64px -18px rgba(255,0,80,.4),0 16px 38px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.25);margin-bottom:18px;background:radial-gradient(120% 90% at 30% 0%,#3a0f26,#141018 72%);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.sl-promo-art img{width:100%;height:100%;object-fit:cover;display:block}',
    '.sl-promo-art i{font-size:40px;color:rgba(255,255,255,.3)}',
    '.sl-badge{display:inline-flex;align-items:center;gap:6px;margin-bottom:13px;padding:6px 12px;border-radius:999px;background:rgba(244,197,92,.12);border:1px solid rgba(244,197,92,.35);color:#f4d58a;font-size:10px;font-weight:800;letter-spacing:.04em}',
    '.sl-badge i{font-size:9px}',
    '.sl-meta{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;margin-bottom:13px}',
    '.sl-stat{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.76);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);padding:4px 9px;border-radius:999px;backdrop-filter:blur(8px)}',
    '.sl-stat i{font-size:9px;color:#ff8fb3}',
    '.sl-prev{font-size:12.5px;line-height:1.6;color:rgba(255,255,255,.6);max-width:330px;margin:0 0 22px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
    '.sl-actions{display:flex;align-items:center;gap:10px;width:100%;max-width:330px}',
    '.sl-cta{position:relative;flex:1;overflow:hidden;border:none;border-radius:15px;padding:16px 20px;font:800 14px/1 inherit;color:#fff;background:linear-gradient(135deg,#ff0050,#e0004a 55%,#ff3d78);box-shadow:0 14px 34px -8px rgba(255,0,80,.65),inset 0 1px 0 rgba(255,255,255,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:transform .16s,filter .16s;font-family:inherit}',
    '.sl-cta:hover{filter:brightness(1.07)}',
    '.sl-cta:active{transform:scale(.975)}',
    '.sl-cta i{font-size:12px;transition:transform .2s}',
    '.sl-cta:hover i{transform:translateX(3px)}',
    '.sl-cta::after{content:"";position:absolute;top:0;bottom:0;width:45%;left:-60%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:slShine 3.6s ease-in-out infinite}',
    '.sl-ring{position:relative;width:52px;height:52px;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.sl-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}',
    '.sl-ring circle{fill:none;stroke-width:3}',
    '.sl-ring .sl-ring-bg{stroke:rgba(255,255,255,.16)}',
    '.sl-ring .sl-ring-fg{stroke:#fff;stroke-linecap:round;transition:stroke-dashoffset .12s linear}',
    '.sl-ring b{position:relative;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}',
    '.sl-avatar{position:relative;width:132px;height:132px;border-radius:50%;box-shadow:0 18px 44px rgba(0,0,0,.45);margin-bottom:18px;flex-shrink:0;animation:slPoster .78s cubic-bezier(.2,.8,.2,1) both}',
    '.sl-avatar-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#1a1420;border:2px solid rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;font:700 44px/1 Georgia,serif;color:#ffd7e1}',
    '.sl-avatar-inner img{width:100%;height:100%;object-fit:cover;display:block}',
    '.sl-verified{position:absolute;right:2px;bottom:4px;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#2563eb);border:3px solid #0b0710;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;box-shadow:0 6px 14px rgba(37,99,235,.5)}',
    '.sl-handle{font-size:12px;font-weight:700;color:#ff9ab4;margin-bottom:9px}',
    '.sl-stats{display:flex;gap:8px;width:100%;max-width:330px;margin:0 0 20px}',
    '.sl-stats>div{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:10px 6px;backdrop-filter:blur(8px)}',
    '.sl-stats b{display:block;font-size:14px;font-weight:800}',
    '.sl-stats span{display:block;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);font-weight:700;margin-top:3px}',
    '@keyframes slRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
    '@keyframes slPoster{from{opacity:0;transform:translateY(22px) scale(.96)}to{opacity:1;transform:none}}',
    '@keyframes slSlide{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
    '@keyframes slBg{from{transform:scale(1.12)}to{transform:scale(1.2)}}',
    '@keyframes slShine{0%,55%{left:-60%}78%,100%{left:130%}}',
    '@media (max-height:640px){.sl-poster{width:min(46vw,168px);margin-bottom:14px}.sl-title{font-size:22px}.sl-avatar{width:108px;height:108px}.sl-prev{margin-bottom:16px}.sl-body{padding-top:calc(env(safe-area-inset-top,0px) + 70px)}}',
    '@media (prefers-reduced-motion:reduce){.sl-ov,.sl-ov *{animation:none!important;transition:none!important}}',
  ].join('\n');

  var _built = false, _raf = null, _opts = null, _endAt = 0, _dur = 0, _closeT = null, _prevOverflow = '';
  var _held = false, _leftAtHold = 0, _hintT = null;
  var _board = null, _boardIdx = 0, _boardAt = 0, _boardDur = 2200, _boardLeft = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtN(n) {
    if (n == null || n === '') return '';
    if (typeof n === 'string') return n;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function isUserAd(a) {
    return !!a && (a.kind === 'user' || a.kind === 'author' || a.promoKind === 'user' || a.type === 'user');
  }
  function isBoardAd(a) {
    return !!a && (a.kind === 'board' || a.kind === 'leaderboard' || a.promoKind === 'board' || (!a.kind && a.boardType));
  }
  function isPromoAd(a) {
    return !!a && (a.kind === 'promo' || a.kind === 'brand' || a.kind === 'link' || a.promoKind === 'promo');
  }
  /* Normalise a marketing spotlight creative into the shape used below. */
  function fromAd(ad) {
    ad = ad || {};
    if (isBoardAd(ad)) {
      return {
        kind: 'board',
        id: ad.id,
        boardType: ad.boardType || ad.board || 'readers',
        period: ad.period || 'last_week',
        title: ad.title || ad.heading || '',
        sub: ad.sub || ad.subtitle || '',
        cta: ad.cta || 'View leaderboard',
      };
    }
    if (isPromoAd(ad)) {
      return {
        kind: 'promo',
        id: ad.id,
        brand: ad.brand || ad.sponsor || '',
        title: ad.title || ad.heading || ad.headline || '',
        sub: ad.sub || ad.subtitle || ad.body || ad.preview || ad.desc || '',
        badge: ad.badge || '',
        img: ad.img || ad.image || ad.cover || '',
        cta: ad.cta || 'Learn more',
      };
    }
    if (isUserAd(ad)) {
      return {
        kind: 'user',
        id: ad.id,
        name: ad.name || ad.title || '',
        handle: String(ad.handle || '').replace(/^@/, ''),
        avatar: ad.avatar || ad.img || '',
        tagline: ad.tagline || ad.preview || ad.bio || '',
        followers: ad.followers,
        books: ad.books,
        reads: ad.reads,
        verified: ad.verified !== false,
        cta: ad.cta || 'Follow',
      };
    }
    return {
      kind: 'story',
      id: ad.id,
      title: ad.title || ad.heading || '',
      author: ad.author || ad.authorName || '',
      authorAvatar: ad.authorAvatar || ad.authorAv || '',
      genre: ad.genre || ad.cat || '',
      rating: ad.rating,
      chapters: ad.chapters,
      reads: ad.reads || ad.views,
      preview: ad.preview || ad.desc || ad.body || '',
      img: ad.img || ad.cover || ad.image || '',
      cta: ad.cta || 'Read now',
    };
  }

  function _ensure() {
    if (_built) return;
    _built = true;
    var st = document.createElement('style');
    st.id = 'sl-style';
    st.textContent = CSS;
    document.head.appendChild(st);

    var ov = document.createElement('div');
    ov.className = 'sl-ov';
    ov.id = 'slOv';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Sponsored feature');
    ov.innerHTML =
      '<div class="sl-bg" id="slBg"></div><div class="sl-glow"></div><div class="sl-veil"></div>' +
      '<div class="sl-top">' +
        '<div class="sl-brand"><img class="sl-mark" src="' + esc(_iconSrc) + '" alt="DroBoard"/> <span class="sl-wordmark">DroBoard</span> <span class="sl-label" id="slFlag">Featured</span></div>' +
        '<button class="sl-quit" id="slQuit" type="button" aria-label="Close ad"><span>Skip</span><b id="slQuitSec"></b></button>' +
      '</div>' +
      '<div class="sl-prog" aria-hidden="true"><i class="sl-prog-fill" id="slProg"></i></div>' +
      '<div class="sl-hold" id="slHold"><i class="fas fa-hand-pointer" id="slHoldIco"></i><span id="slHoldTxt">Press &amp; hold to pause</span></div>' +
      '<div class="sl-body" id="slBody"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#slQuit').addEventListener('click', function () { _close(false); });
    ov.addEventListener('pointerdown', function (e) {
      if (!ov.classList.contains('show') || ov.classList.contains('closing')) return;
      if (e.button) return;
      if (e.target && e.target.closest && e.target.closest('.sl-quit,.sl-cta')) return;
      _holdStart();
    });
    window.addEventListener('pointerup', _holdEnd);
    window.addEventListener('pointercancel', _holdEnd);
    ov.addEventListener('contextmenu', function (e) {
      if (ov.classList.contains('show')) e.preventDefault();
    });
    document.addEventListener('keydown', function (e) {
      if (!ov.classList.contains('show')) return;
      if (e.key === 'Escape' && _opts && _opts.allowSkip !== false) _close(false);
      if (_board && e.key === 'ArrowRight') _boardGo(_boardIdx + 1);
      if (_board && e.key === 'ArrowLeft') _boardGo(_boardIdx - 1);
    });
  }

  function _holdUi(on) {
    var ico = document.getElementById('slHoldIco');
    var txt = document.getElementById('slHoldTxt');
    var hint = document.getElementById('slHold');
    if (hint) hint.classList.remove('hint');
    if (ico) ico.className = on ? 'fas fa-pause' : 'fas fa-hand-pointer';
    if (txt) txt.textContent = on ? 'Paused — release to continue' : 'Press & hold to pause';
  }
  function _holdStart() {
    if (_held) return;
    _held = true;
    _leftAtHold = Math.max(0, _endAt - Date.now());
    _boardLeft = Math.max(0, _boardDur - (Date.now() - _boardAt));
    _stopTimer();
    clearTimeout(_hintT);
    var ov = document.getElementById('slOv');
    if (ov) ov.classList.add('held');
    _holdUi(true);
    try { localStorage.setItem('dro_spot_hold_hint', '1'); } catch (e) {}
  }
  function _holdEnd() {
    if (!_held) return;
    _held = false;
    var ov = document.getElementById('slOv');
    if (ov) ov.classList.remove('held');
    _holdUi(false);
    if (!ov || !ov.classList.contains('show')) return;
    _endAt = Date.now() + _leftAtHold;
    if (_board) _boardAt = Date.now() - (_boardDur - _boardLeft);
    _stopTimer();
    _raf = requestAnimationFrame(_tick);
  }

  function _authorAvatar(s) {
    var av = s.authorAvatar || '';
    if (!av && s.author) {
      try {
        if (window.DroboardPeople && typeof DroboardPeople.avatarFor === 'function') av = DroboardPeople.avatarFor(s.author) || '';
      } catch (e) {}
    }
    return av;
  }

  function _segHtml(n) {
    var out = '<div class="sl-bsegs" id="slBSegs">';
    for (var i = 0; i < n; i++) {
      out += '<button type="button" class="sl-bseg" data-board-idx="' + i + '" aria-label="Show #' + (i + 1) + '"><i></i></button>';
    }
    return out + '</div>';
  }
  function _boardSlideInner(e, data, idx) {
    if (!e) return '';
    var rank = e.rank || (idx + 1);
    var handle = String(e.handle || '').replace(/^@/, '');
    var initial = (e.name || handle || '?').trim().charAt(0).toUpperCase();
    var stats = (e.stats || []).slice(0, 3).map(function (st) {
      return '<div><b>' + esc(fmtN(st.value)) + '</b><span>' + esc(st.label || '') + '</span></div>';
    }).join('');
    return '<div class="sl-bavatar-wrap">' +
        '<div class="sl-bavatar">' +
          (e.avatar ? '<img src="' + esc(e.avatar) + '" alt=""/>' : '<span class="sl-initial">' + esc(initial) + '</span>') +
        '</div>' +
        '<span class="sl-brank' + (rank === 2 ? ' r2' : rank === 3 ? ' r3' : '') + '">#' + esc(rank) + '</span>' +
      '</div>' +
      '<div class="sl-kicker"><i class="fas fa-trophy"></i> ' + esc((data && data.label) || 'Top three') + '</div>' +
      '<h2 class="sl-title">' + esc(e.name || handle || '') + '</h2>' +
      (handle ? '<div class="sl-handle">@' + esc(handle) + '</div>' : '') +
      (stats ? '<div class="sl-stats sl-bstats">' + stats + '</div>' : '') +
      (e.blurb ? '<p class="sl-prev">' + esc(e.blurb) + '</p>' : '');
  }
  function _boardHtml(s, opts) {
    var data = _board || { entries: [] };
    var entries = data.entries || [];
    if (!entries.length) {
      return '<div class="sl-stage"><div class="sl-kicker"><i class="fas fa-trophy"></i> Leaderboard</div>' +
        '<h2 class="sl-title">' + esc(s.title || 'Top three') + '</h2>' +
        '<p class="sl-prev">Leaderboard data is not available on this page yet.</p>' +
        _actionsHtml(s, opts) + '</div>';
    }
    _boardIdx = Math.max(0, Math.min(_boardIdx, entries.length - 1));
    return '<div class="sl-stage sl-board">' +
      _segHtml(entries.length) +
      '<div class="sl-blead">' + esc((data && data.lead) || s.title || 'Meet the top three') + '</div>' +
      '<div class="sl-bslide" id="slBSlide">' + _boardSlideInner(entries[_boardIdx], data, _boardIdx) + '</div>' +
      '<div class="sl-podium" id="slBPodium">' +
        entries.map(function (e, i) {
          var nm = String(e.name || e.handle || '').split(' ')[0];
          return '<button type="button" class="sl-pod' + (i === _boardIdx ? ' on' : '') + '" data-board-idx="' + i + '" aria-label="Show #' + (i + 1) + ' ' + esc(e.name || '') + '">' +
            (e.avatar ? '<img src="' + esc(e.avatar) + '" alt=""/>' : '') +
            '<b>' + esc(nm) + '</b><small>#' + (i + 1) + '</small></button>';
        }).join('') +
      '</div>' +
      '<div class="sl-bnav">' +
        '<button type="button" id="slBPrev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>' +
        '<button type="button" class="sl-next" id="slBNext">Next <i class="fas fa-chevron-right"></i></button>' +
      '</div>' +
      _actionsHtml(s, opts) +
    '</div>';
  }
  function _promoHtml(s, opts) {
    return '<div class="sl-stage">' +
      '<div class="sl-promo-art">' +
        (s.img ? '<img src="' + esc(s.img) + '" alt=""/>' : '<i class="fas fa-gift"></i>') +
      '</div>' +
      '<div class="sl-kicker"><i class="fas fa-gift"></i> ' + esc(s.brand || 'Promotion') + '</div>' +
      '<h2 class="sl-title">' + esc(s.title || '') + '</h2>' +
      (s.badge ? '<div class="sl-badge"><i class="fas fa-coins"></i> ' + esc(s.badge) + '</div>' : '') +
      (s.sub ? '<p class="sl-prev">' + esc(s.sub) + '</p>' : '') +
      _actionsHtml(s, opts) +
    '</div>';
  }

  function _bodyHtml(s, opts) {
    if (s.kind === 'board') return _boardHtml(s, opts);
    if (s.kind === 'promo') return _promoHtml(s, opts);
    if (isUserAd(s) || s.kind === 'user') {
      var stats = [];
      if (s.followers) stats.push('<div><b>' + esc(fmtN(s.followers)) + '</b><span>Followers</span></div>');
      if (s.books) stats.push('<div><b>' + esc(fmtN(s.books)) + '</b><span>Books</span></div>');
      if (s.reads) stats.push('<div><b>' + esc(fmtN(s.reads)) + '</b><span>Reads</span></div>');
      var initial = (s.name || s.handle || '?').trim().charAt(0).toUpperCase();
      var handle = String(s.handle || '').replace(/^@/, '');
      return '<div class="sl-stage sl-user">' +
        '<div class="sl-avatar"><div class="sl-avatar-inner">' +
          (s.avatar ? '<img src="' + esc(s.avatar) + '" alt=""/>' : esc(initial)) +
        '</div>' + (s.verified !== false ? '<span class="sl-verified"><i class="fas fa-check"></i></span>' : '') + '</div>' +
        '<div class="sl-kicker"><i class="fas fa-user"></i> ' + (opts.sponsored ? 'Creator spotlight' : 'Featured creator') + '</div>' +
        '<h2 class="sl-title">' + esc(s.name || handle || '') + '</h2>' +
        (handle ? '<div class="sl-handle">@' + esc(handle) + '</div>' : '') +
        (s.tagline ? '<p class="sl-prev">' + esc(s.tagline) + '</p>' : '') +
        (stats.length ? '<div class="sl-stats">' + stats.join('') + '</div>' : '') +
        _actionsHtml(s, opts) +
      '</div>';
    }
    var kicker = [];
    if (s.genre) kicker.push(esc(s.genre));
    if (s.rating) kicker.push('★ ' + esc(s.rating));
    var meta = [];
    if (s.chapters) meta.push('<span class="sl-stat"><i class="fas fa-book-open"></i>' + esc(s.chapters) + ' chapters</span>');
    if (s.reads) meta.push('<span class="sl-stat"><i class="fas fa-eye"></i>' + esc(fmtN(s.reads)) + ' reads</span>');
    var author = String(s.author || '').replace(/^@/, '');
    var initial = (author || 'D').trim().charAt(0).toUpperCase();
    var av = _authorAvatar(s);
    return '<div class="sl-stage">' +
      '<div class="sl-poster">' +
        (s.img ? '<img src="' + esc(s.img) + '" alt=""/>' : '<div class="sl-poster-empty"><i class="fas fa-book-open"></i></div>') +
      '</div>' +
      '<div class="sl-kicker"><i class="fas fa-bolt"></i> ' + (kicker.length ? kicker.join(' · ') : 'Featured story') + '</div>' +
      '<h2 class="sl-title">' + esc(s.title || '') + '</h2>' +
      (author ? '<div class="sl-by">' + (av ? '<img class="sl-by-av" src="' + esc(av) + '" alt=""/>' : '<span class="sl-initial">' + esc(initial) + '</span>') + ' by <b>' + esc(author) + '</b></div>' : '') +
      (meta.length ? '<div class="sl-meta">' + meta.join('') + '</div>' : '') +
      (s.preview ? '<p class="sl-prev">' + esc(s.preview) + '</p>' : '') +
      _actionsHtml(s, opts) +
    '</div>';
  }

  function _actionsHtml(s, opts) {
    var fallback = s.kind === 'user' ? 'Follow' : s.kind === 'board' ? 'View leaderboard' : s.kind === 'promo' ? 'Learn more' : 'Read now';
    return '<div class="sl-actions">' +
      '<button class="sl-cta" id="slCta" type="button">' + esc(s.cta || fallback) + ' <i class="fas fa-arrow-right"></i></button>' +
      '<div class="sl-ring" aria-hidden="true">' +
        '<svg viewBox="0 0 52 52"><circle class="sl-ring-bg" cx="26" cy="26" r="22"></circle>' +
        '<circle class="sl-ring-fg" id="slRingFg" cx="26" cy="26" r="22" stroke-dasharray="138.23" stroke-dashoffset="0"></circle></svg>' +
        '<b id="slRingNum">6</b></div>' +
    '</div>';
  }

  function _resolveBoard(s) {
    var data = null;
    try {
      if (window.DroboardSpotlightBoard && typeof DroboardSpotlightBoard.get === 'function') {
        data = DroboardSpotlightBoard.get({ type: s.boardType, period: s.period, title: s.title, sub: s.sub });
      }
    } catch (e) {}
    if ((!data || !data.entries || !data.entries.length) && Array.isArray(s.entries)) {
      data = { label: s.sub || 'Top three', lead: s.title || 'Meet the top three', entries: s.entries };
    }
    return data || { label: s.sub || 'Top three', lead: s.title || 'Meet the top three', entries: [] };
  }

  function _boardGo(idx) {
    if (!_board || !_board.entries || !_board.entries.length) return;
    var n = _board.entries.length;
    _boardIdx = ((idx % n) + n) % n;
    _boardAt = Date.now();
    var slide = document.getElementById('slBSlide');
    if (slide) {
      slide.innerHTML = _boardSlideInner(_board.entries[_boardIdx], _board, _boardIdx);
      slide.style.animation = 'none';
      void slide.offsetWidth;
      slide.style.animation = '';
    }
    var pods = document.querySelectorAll('#slBPodium .sl-pod');
    for (var i = 0; i < pods.length; i++) pods[i].classList.toggle('on', i === _boardIdx);
    var segs = document.querySelectorAll('#slBSegs .sl-bseg i');
    for (var j = 0; j < segs.length; j++) segs[j].style.width = j < _boardIdx ? '100%' : '0%';
  }

  function _bindBoard() {
    var prev = document.getElementById('slBPrev');
    var next = document.getElementById('slBNext');
    if (prev) prev.addEventListener('click', function () { _boardGo(_boardIdx - 1); });
    if (next) next.addEventListener('click', function () { _boardGo(_boardIdx + 1); });
    document.querySelectorAll('#slBody [data-board-idx]').forEach(function (el) {
      el.addEventListener('click', function () { _boardGo(+el.getAttribute('data-board-idx')); });
    });
  }

  function _paint(story, opts) {
    var ov = document.getElementById('slOv');
    var bg = document.getElementById('slBg');
    _board = story.kind === 'board' ? _resolveBoard(story) : null;
    _boardIdx = 0;
    _boardAt = Date.now();
    var entries = (_board && _board.entries) || [];
    _boardDur = Math.max(1600, Math.min(3200, (_dur || 6000) / Math.max(3, entries.length)));
    var img = story.kind === 'user' ? story.avatar : (story.img || '');
    if (img) {
      bg.style.background = '';
      bg.style.backgroundImage = 'url("' + String(img).replace(/"/g, '\\"') + '")';
    } else {
      bg.style.backgroundImage = 'none';
      bg.style.background = 'radial-gradient(120% 90% at 30% 0%,#3a0f26 0%,#150b14 62%,#07060a 100%)';
    }
    var flag = document.getElementById('slFlag');
    if (story.kind === 'board') {
      flag.textContent = 'Top 3';
      flag.className = 'sl-label gold';
    } else if (story.kind === 'promo') {
      flag.textContent = opts.sponsored ? 'Sponsored' : 'Promotion';
      flag.className = 'sl-label' + (opts.sponsored ? '' : ' gold');
    } else {
      flag.textContent = opts.sponsored ? 'Sponsored' : 'Featured';
      flag.className = 'sl-label' + (opts.sponsored ? '' : ' gold');
    }
    var quit = document.getElementById('slQuit');
    quit.classList.toggle('on', opts.allowSkip !== false);
    document.getElementById('slBody').innerHTML = _bodyHtml(story, opts);
    document.getElementById('slCta').addEventListener('click', function () {
      if (!ov.classList.contains('show')) return;
      _close(true);
    });
    if (story.kind === 'board') _bindBoard();
  }

  function _tickBoard(now) {
    if (!_board || !_board.entries || !_board.entries.length) return;
    var segs = document.querySelectorAll('#slBSegs .sl-bseg i');
    var active = Math.max(0, Math.min(1, (now - _boardAt) / _boardDur));
    for (var i = 0; i < segs.length; i++) {
      segs[i].style.width = i < _boardIdx ? '100%' : (i === _boardIdx ? (active * 100).toFixed(1) + '%' : '0%');
    }
    if (now - _boardAt >= _boardDur) _boardGo(_boardIdx + 1);
  }

  function _tick() {
    if (_held) return;
    var now = Date.now();
    var left = _endAt - now;
    if (left <= 0) { _close(false); return; }
    var pct = Math.max(0, Math.min(1, left / _dur));
    if (_board) _tickBoard(now);
    var fill = document.getElementById('slProg');
    var ring = document.getElementById('slRingFg');
    var num = document.getElementById('slRingNum');
    var qs = document.getElementById('slQuitSec');
    var sec = Math.ceil(left / 1000);
    if (fill) fill.style.width = (pct * 100).toFixed(2) + '%';
    if (ring) ring.style.strokeDashoffset = (138.23 * (1 - pct)).toFixed(2);
    if (num) num.textContent = sec;
    if (qs) qs.textContent = sec;
    _raf = requestAnimationFrame(_tick);
  }

  function _stopTimer() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = null;
  }

  function _close(viaCta) {
    var ov = document.getElementById('slOv');
    if (!ov || !ov.classList.contains('show')) return;
    _stopTimer();
    _held = false;
    ov.classList.remove('held');
    clearTimeout(_hintT);
    _holdUi(false);
    ov.classList.remove('vis');
    ov.classList.add('closing');
    var o = _opts || {};
    _opts = null;
    try { document.body.style.overflow = _prevOverflow; } catch (e) {}
    clearTimeout(_closeT);
    _board = null;
    _closeT = setTimeout(function () {
      ov.classList.remove('show');
      ov.classList.remove('closing');
      document.getElementById('slBody').innerHTML = '';
    }, 230);
    if (viaCta) {
      try { if (window.AdService && o.trackId && !o.preview) AdService.track(o.trackId, 'click', { page: 'discover', slot: 'discover:spotlight' }); } catch (e) {}
      if (typeof o.onCta === 'function') { try { o.onCta(); return; } catch (e) {} }
      if (o.href) { try { window.location.href = o.href; return; } catch (e) {} }
    }
    if (typeof o.onDone === 'function') { try { o.onDone(); } catch (e) {} }
  }

  function show(opts) {
    _ensure();
    var ov = document.getElementById('slOv');
    if (ov.classList.contains('show') && !ov.classList.contains('closing')) return;
    clearTimeout(_closeT);
    ov.classList.remove('closing');
    _held = false;
    _leftAtHold = 0;
    ov.classList.remove('held');
    clearTimeout(_hintT);
    _holdUi(false);
    _opts = opts || {};
    var s = _opts.story || {};
    var seconds = Math.max(3, Math.min(30, +(_opts.seconds || 6)));
    _dur = seconds * 1000;
    _paint(s, _opts);
    try {
      _prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } catch (e) {}
    ov.classList.add('show');
    requestAnimationFrame(function () {
      ov.classList.add('vis');
      var cta = document.getElementById('slCta');
      if (cta) { try { cta.focus({ preventScroll: true }); } catch (e) {} }
      var hint = document.getElementById('slHold');
      if (hint && !_held) {
        var seen = false;
        try { seen = localStorage.getItem('dro_spot_hold_hint') === '1'; } catch (e) {}
        if (!seen) {
          hint.classList.add('hint');
          _hintT = setTimeout(function () { hint.classList.remove('hint'); }, 2800);
        }
      }
    });
    try { if (window.AdService && _opts.sponsored && !_opts.preview && s.id) AdService.track(s.id, 'impression', { page: 'discover', slot: 'discover:spotlight' }); } catch (e) {}
    _endAt = Date.now() + _dur;
    _stopTimer();
    _raf = requestAnimationFrame(_tick);
  }

  window.DroboardSpotlight = {
    show: show,
    hide: function () { _close(false); },
    fromAd: fromAd,
  };
})();
