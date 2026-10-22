/* ===============================================================
   SPOTLIGHT AD - full-screen story takeover with countdown.
   Poster-style: black stage, featured cover, centered story info.
   Constrained to the .phone column (max-width 420px, fixed height)
   like browse-overlay. Auto-closes when the countdown hits zero;
   CTA tappable the whole time. Skip pill only when allowSkip.

   Usage:
     DroboardSpotlight.show({
       story: { id, title, author, genre, chapters, reads, preview, img, cta },
       seconds: 7,              // 3-30, config in ad-manager placements
       allowSkip: true,
       sponsored: false,
       href: 'bridge.html?id=x',
       trackId: 'ad-id', onCta: fn, onDone: fn,
     });

   Impression/click tracked via AdService when sponsored + trackId.
   =============================================================== */
(function () {
  'use strict';

  var CSS = [
    '.sl-ov{position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;height:100vh;height:100dvh;z-index:12100;background:#000;display:none;flex-direction:column;overflow:hidden;box-shadow:0 0 60px rgba(0,0,0,.6)}',
    '.sl-ov.show{display:flex}',
    '.sl-ov *,.sl-ov *::before,.sl-ov *::after{box-sizing:border-box}',
    '.sl-head{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding:calc(env(safe-area-inset-top,10px) + 14px) 16px 10px}',
    '.sl-brand{display:flex;align-items:center;gap:8px;font:800 13px Inter,system-ui,sans-serif;color:#fff;letter-spacing:.01em}',
    '.sl-brand-ico{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ff0050,#ff5c8a);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff}',
    '.sl-quit{font:700 11px Inter,system-ui,sans-serif;color:rgba(255,255,255,.55);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;cursor:pointer}',
    '.sl-quit:hover{color:#fff}',
    '.sl-body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;overflow-y:auto;padding:6px 24px calc(env(safe-area-inset-bottom,14px) + 24px);font-family:Inter,system-ui,sans-serif}',
    '.sl-flag{font-size:9px;font-weight:800;letter-spacing:.14em;padding:5px 14px;border-radius:999px;background:rgba(255,0,80,.14);border:1px solid rgba(255,0,80,.55);color:#ff85a5;margin-bottom:16px}',
    '.sl-flag.gold{background:rgba(201,162,39,.1);border-color:rgba(201,162,39,.5);color:#e8c86a}',
    '.sl-cover{position:relative;width:min(62%,238px);aspect-ratio:2/3;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.1);box-shadow:0 26px 60px rgba(255,0,80,.16),0 10px 26px rgba(0,0,0,.7);background:#141018;margin-bottom:20px;flex-shrink:0}',
    '.sl-cover img{width:100%;height:100%;object-fit:cover;display:block}',
    '.sl-cover-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 90% at 30% 0%,#3a0f26 0%,#141018 70%);color:rgba(255,255,255,.3);font-size:34px}',
    '.sl-genre{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ff8fb3;margin-bottom:9px}',
    '.sl-title{font-family:Georgia,\'Times New Roman\',serif;font-size:24px;font-weight:700;line-height:1.2;color:#fff;margin:0 0 9px;max-width:330px;letter-spacing:-.01em}',
    '.sl-author{font-size:12.5px;font-weight:600;color:rgba(255,255,255,.72);margin-bottom:6px}',
    '.sl-meta{font-size:11px;color:rgba(255,255,255,.42);margin-bottom:12px}',
    '.sl-prev{font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.58);max-width:330px;margin:0 0 22px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.sl-actions{display:flex;align-items:center;gap:12px;width:100%;max-width:330px}',
    '.sl-cta{flex:1;background:#ff0050;color:#fff;font-weight:800;font-size:14px;padding:15px 18px;border-radius:14px;cursor:pointer;text-align:center;font-family:inherit;border:none;transition:.12s;box-shadow:0 8px 22px rgba(255,0,80,.35)}',
    '.sl-cta:hover{filter:brightness(1.08)}',
    '.sl-cta:active{transform:scale(.98)}',
    '.sl-count{width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0;font-variant-numeric:tabular-nums}',
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
        '<div class="sl-head">' +
          '<div class="sl-brand"><span class="sl-brand-ico"><i class="fas fa-bolt"></i></span> Droboard</div>' +
          '<button class="sl-quit" id="slQuit" style="display:none">No thanks</button>' +
        '</div>' +
        '<div class="sl-body">' +
          '<div class="sl-flag" id="slFlag">FEATURED</div>' +
          '<div class="sl-cover" id="slCover"><img id="slCoverImg" alt="" src=""/><div class="sl-cover-empty" id="slCoverEmpty" style="display:none"><i class="fas fa-book-open"></i></div></div>' +
          '<div class="sl-genre" id="slGenre"></div>' +
          '<h2 class="sl-title" id="slTitle"></h2>' +
          '<div class="sl-author" id="slAuthor"></div>' +
          '<div class="sl-meta" id="slMeta"></div>' +
          '<p class="sl-prev" id="slPrev"></p>' +
          '<div class="sl-actions">' +
            '<button class="sl-cta" id="slCta">Read now</button>' +
            '<div class="sl-count" id="slCount">7</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('slQuit').addEventListener('click', function () { _close(false); });
    document.getElementById('slCta').addEventListener('click', function () {
      if (!document.getElementById('slOv').classList.contains('show')) return;
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
    var seconds = Math.max(3, Math.min(30, +(_opts.seconds || 7)));
    var flag = document.getElementById('slFlag');
    flag.textContent = _opts.sponsored ? 'SPONSORED' : 'FEATURED';
    flag.className = 'sl-flag' + (_opts.sponsored ? '' : ' gold');
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
    var metaEl = document.getElementById('slMeta');
    metaEl.textContent = meta.join('  \u00b7  ');
    metaEl.style.display = meta.length ? '' : 'none';
    var prev = document.getElementById('slPrev');
    prev.textContent = s.preview || '';
    prev.style.display = s.preview ? '' : 'none';
    document.getElementById('slCta').textContent = s.cta || 'Read now';
    var img = document.getElementById('slCoverImg');
    var empty = document.getElementById('slCoverEmpty');
    try {
      if (s.img) { img.src = s.img; img.style.display = ''; empty.style.display = 'none'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; empty.style.display = ''; }
    } catch (e) {}
    try { if (window.AdService && s.id && _opts.sponsored) AdService.track(s.id, 'impression', { page: 'discover', slot: 'discover:spotlight' }); } catch (e) {}
    var count = document.getElementById('slCount');
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
