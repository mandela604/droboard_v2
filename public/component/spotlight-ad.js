/* ===============================================================
   SPOTLIGHT AD - full-screen story promo with countdown.
   Auto-closes when the countdown reaches zero. The CTA is tappable
   the whole time (navigates immediately). Close button only when
   allowSkip is true (house promos); paid ads uncheck it in
   ad-manager placements.

   Usage:
     DroboardSpotlight.show({
       story: { id, title, author, genre, chapters, reads, preview, img, cta },
       seconds: 5,              // 3-30, config in ad-manager
       allowSkip: true,         // show "No thanks"
       sponsored: false,        // SPONSORED vs FEATURED flag
       href: 'bridge.html?id=x' // optional destination override
       onCta: fn, onDone: fn,
     });

   Impression/click tracked via AdService when story.id is an ad id.
   =============================================================== */
(function () {
  'use strict';

  var CSS = [
    '.sl-ov{position:fixed;inset:0;z-index:12100;background:#000;display:none;flex-direction:column}',
    '.sl-ov.show{display:flex}',
    '.sl-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(.55)}',
    '.sl-grad{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.97) 6%,rgba(0,0,0,.35) 58%,rgba(0,0,0,.55) 100%)}',
    '.sl-flag{position:absolute;top:calc(env(safe-area-inset-top,10px) + 14px);left:0;right:0;display:flex;justify-content:center;z-index:3}',
    '.sl-flag-inner{background:#ff0050;padding:5px 16px;border-radius:24px;font-size:10px;font-weight:800;color:#fff;letter-spacing:.05em;font-family:Inter,system-ui,sans-serif}',
    '.sl-quit{position:absolute;top:calc(env(safe-area-inset-top,10px) + 12px);right:14px;z-index:4;color:rgba(255,255,255,.65);font-size:11px;font-weight:700;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 13px;cursor:pointer;font-family:Inter,system-ui,sans-serif}',
    '.sl-body{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 22px calc(env(safe-area-inset-bottom,14px) + 26px);font-family:Inter,system-ui,sans-serif;color:#fff}',
    '.sl-genre{display:inline-flex;align-self:flex-start;background:rgba(255,0,80,.18);border:1px solid rgba(255,0,80,.5);color:#ff8fb3;font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:5px 12px;border-radius:999px;margin-bottom:12px}',
    '.sl-title{font-size:26px;font-weight:800;line-height:1.15;margin:0 0 8px;letter-spacing:-.01em}',
    '.sl-author{font-size:13px;color:rgba(255,255,255,.75);font-weight:600;margin-bottom:8px}',
    '.sl-meta{font-size:11.5px;color:rgba(255,255,255,.55);margin-bottom:10px}',
    '.sl-prev{font-size:13px;line-height:1.55;color:rgba(255,255,255,.82);margin-bottom:18px;max-width:420px}',
    '.sl-actions{display:flex;align-items:center;gap:12px}',
    '.sl-cta{flex:1;background:#ff0050;color:#fff;font-weight:800;font-size:14px;padding:14px 20px;border-radius:14px;cursor:pointer;text-align:center;font-family:inherit;border:none;transition:.12s}',
    '.sl-cta:hover{filter:brightness(1.08)}',
    '.sl-count{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid #ff0050;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;flex-shrink:0}',
    '.sl-count.done{background:#ff0050}',
  ].join('\n');

  var _built = false, _timer = null, _opts = null;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _ensure() {
    if (_built) return;
    _built = true;
    var st = document.createElement('style');
    st.id = 'sl-style';
    st.textContent = CSS;
    document.head.appendChild(st);
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="sl-ov" id="slOv">' +
        '<div class="sl-bg" id="slBg"></div>' +
        '<div class="sl-grad"></div>' +
        '<div class="sl-flag"><div class="sl-flag-inner" id="slFlag">FEATURED</div></div>' +
        '<button class="sl-quit" id="slQuit" style="display:none">No thanks</button>' +
        '<div class="sl-body">' +
          '<div class="sl-genre" id="slGenre"></div>' +
          '<h2 class="sl-title" id="slTitle"></h2>' +
          '<div class="sl-author" id="slAuthor"></div>' +
          '<div class="sl-meta" id="slMeta"></div>' +
          '<p class="sl-prev" id="slPrev"></p>' +
          '<div class="sl-actions">' +
            '<button class="sl-cta" id="slCta"></button>' +
            '<div class="sl-count" id="slCount">5</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('slQuit').addEventListener('click', function () { _close(false); });
    document.getElementById('slCta').addEventListener('click', function () {
      if (_timer === null && !document.getElementById('slOv').classList.contains('show')) return;
      _close(true);
    });
  }

  function _close(viaCta) {
    clearInterval(_timer);
    _timer = null;
    try { document.getElementById('slOv').classList.remove('show'); } catch (e) {}
    var o = _opts || {};
    _opts = null;
    if (viaCta) {
      try { if (window.AdService && o.trackId) AdService.track(o.trackId, 'click', { page: 'discover', slot: 'discover:spotlight' }); } catch (e) {}
      if (typeof o.onCta === 'function') { try { o.onCta(); return; } catch (e) {} }
      if (o.href) { try { window.location.href = o.href; return; } catch (e) {} }
    }
    if (typeof o.onDone === 'function') { try { o.onDone(); } catch (e) {} }
  }

  function show(opts) {
    _ensure();
    if (document.getElementById('slOv').classList.contains('show')) return;
    _opts = opts || {};
    var s = _opts.story || {};
    var seconds = Math.max(3, Math.min(30, +(_opts.seconds || 5)));
    document.getElementById('slFlag').textContent = _opts.sponsored ? 'SPONSORED' : 'FEATURED';
    var quit = document.getElementById('slQuit');
    quit.style.display = _opts.allowSkip === false ? 'none' : '';
    var genre = document.getElementById('slGenre');
    genre.textContent = s.genre || '';
    genre.style.display = s.genre ? '' : 'none';
    document.getElementById('slTitle').textContent = s.title || '';
    document.getElementById('slAuthor').textContent = s.author ? (String(s.author).charAt(0) === '@' ? s.author : 'By ' + s.author) : '';
    var meta = [];
    if (s.chapters) meta.push(s.chapters + ' chapters');
    if (s.reads) meta.push(s.reads + ' reads');
    document.getElementById('slMeta').textContent = meta.join('  \u00b7  ');
    document.getElementById('slPrev').textContent = s.preview || '';
    document.getElementById('slCta').textContent = s.cta || 'Read now';
    try {
      document.getElementById('slBg').style.backgroundImage = s.img ? "url('" + s.img + "')" : '';
    } catch (e) {}
    try { if (window.AdService && s.id && _opts.sponsored) AdService.track(s.id, 'impression', { page: 'discover', slot: 'discover:spotlight' }); } catch (e) {}
    var count = document.getElementById('slCount');
    count.classList.remove('done');
    var left = seconds;
    count.textContent = left;
    document.getElementById('slOv').classList.add('show');
    clearInterval(_timer);
    _timer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(_timer);
        _timer = null;
        _close(false);
      } else {
        count.textContent = left;
      }
    }, 1000);
  }

  window.DroboardSpotlight = { show: show };
})();
