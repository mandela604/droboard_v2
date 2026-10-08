/* ===============================================================
   REWARDED AD — fullscreen sponsored interstitial with countdown.
   A completed view (countdown reaches zero + close) earns the caller
   one reward credit (e.g. 1 of 2 ad-views toward a free chapter).

   Usage:
     DroboardRewardedAd.show({
       ads: [{ type:'banner'|'native', ad:{...} }], // optional inventory;
                                                // house promo when empty
       seconds: 5,                             // countdown length
       rewardLabel: 'Watch to the end to earn your unlock',
       onComplete: function () {},             // full view watched
       onQuit: function () {},                 // closed early, no credit
     });

   Impressions/clicks tracked through AdService when available.
   =============================================================== */
(function () {
  'use strict';

  var CSS = [
    '.rwd-ov{position:fixed;inset:0;z-index:1200;background:#000;display:none;flex-direction:column}',
    '.rwd-ov.show{display:flex}',
    '.rwd-bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(.5)}',
    '.rwd-grad{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.96) 8%,rgba(0,0,0,.25) 60%)}',
    '.rwd-flag{position:absolute;top:calc(env(safe-area-inset-top,10px) + 14px);left:0;right:0;display:flex;justify-content:center;z-index:3}',
    '.rwd-flag-inner{background:#ff0050;padding:5px 16px;border-radius:24px;font-size:10px;font-weight:800;color:#fff;letter-spacing:.04em}',
    '.rwd-quit{position:absolute;top:calc(env(safe-area-inset-top,10px) + 12px);right:14px;z-index:4;color:rgba(255,255,255,.65);font-size:11px;font-weight:700;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 13px;cursor:pointer;font-family:inherit}',
    '.rwd-body{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:0 22px calc(env(safe-area-inset-bottom,14px) + 26px)}',
    '.rwd-creative{margin-bottom:16px}',
    '.rwd-creative .dac-banner,.rwd-creative .dac-native{border-radius:14px}',
    '.rwd-house{border-radius:16px;padding:22px 20px;background:linear-gradient(160deg,#2a0a1e 0%,#5c0f3a 45%,#ff0050 100%);border:1px solid rgba(255,255,255,.2);text-align:center}',
    '.rwd-house-brand{font-family:Georgia,serif;font-size:18px;font-weight:900;color:#fff;margin-bottom:6px}',
    '.rwd-house-sub{font-size:12px;color:rgba(255,255,255,.8);line-height:1.5}',
    '.rwd-reward{font-size:11px;font-weight:700;color:#fbbf24;margin-bottom:14px;display:flex;align-items:center;gap:6px}',
    '.rwd-actions{display:flex;align-items:center;gap:10px}',
    '.rwd-cta{flex:1;background:#ff0050;color:#fff;font-weight:800;font-size:13px;padding:13px 20px;border-radius:14px;cursor:pointer;text-align:center;font-family:inherit;border:none}',
    '.rwd-cta:disabled{opacity:.55;cursor:default}',
    '.rwd-count{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid #ff0050;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;flex-shrink:0}',
    '.rwd-count.done{background:#ff0050;border-color:#ff0050}',
  ].join('\n');

  var _built = false;
  var _timer = null;
  var _opts = null;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function _ensure() {
    if (_built) return;
    _built = true;
    var st = document.createElement('style');
    st.id = 'rwd-style';
    st.textContent = CSS;
    document.head.appendChild(st);
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="rwd-ov" id="rwdOv">' +
        '<div class="rwd-bg" id="rwdBg"></div>' +
        '<div class="rwd-grad"></div>' +
        '<div class="rwd-flag"><div class="rwd-flag-inner">SPONSORED</div></div>' +
        '<button class="rwd-quit" id="rwdQuit">No thanks</button>' +
        '<div class="rwd-body">' +
          '<div class="rwd-creative" id="rwdCreative"></div>' +
          '<div class="rwd-reward"><i class="fas fa-gift"></i><span id="rwdRewardLbl"></span></div>' +
          '<div class="rwd-actions">' +
            '<button class="rwd-cta" id="rwdCta" disabled>Watching…</button>' +
            '<div class="rwd-count" id="rwdCount">5</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('rwdQuit').addEventListener('click', function () {
      _finish(false);
    });
    document.getElementById('rwdCta').addEventListener('click', function () {
      var cta = document.getElementById('rwdCta');
      if (cta.disabled) return;
      _finish(true);
    });
  }

  function _pickCreative(ads) {
    ads = ads || [];
    var i, item;
    // Prefer banner, then native, then anything renderable.
    var order = ['banner', 'native', 'platform', 'storyPromo'];
    for (var o = 0; o < order.length; o++) {
      for (i = 0; i < ads.length; i++) {
        item = ads[i];
        if (item && item.type === order[o] && item.ad) return item;
      }
    }
    return null;
  }
  function _renderCreative(item) {
    var box = document.getElementById('rwdCreative');
    if (!item) {
      box.innerHTML =
        '<div class="rwd-house">' +
          '<div class="rwd-house-brand">Droboard</div>' +
          '<div class="rwd-house-sub">Stories worth staying up for.<br/>Thanks for supporting free chapters.</div>' +
        '</div>';
      document.getElementById('rwdBg').style.backgroundImage = '';
      return;
    }
    var ad = item.ad;
    var html = '';
    try {
      if (window.DroboardAdCard) {
        if (item.type === 'native') html = DroboardAdCard.renderNative(ad);
        else if (item.type === 'storyPromo') html = DroboardAdCard.renderStoryPromo(ad);
        else if (item.type === 'platform') html = DroboardAdCard.renderPlatform(ad);
        else html = DroboardAdCard.renderBanner(ad);
      }
    } catch (e) { html = ''; }
    if (!html) {
      box.innerHTML =
        '<div class="rwd-house">' +
          '<div class="rwd-house-brand">' + _esc(ad.brand || 'Droboard') + '</div>' +
          '<div class="rwd-house-sub">' + _esc(ad.headline || ad.title || 'Thanks for supporting free chapters.') + '</div>' +
        '</div>';
    } else {
      box.innerHTML = html;
    }
    try {
      if (ad.cover || ad.image) document.getElementById('rwdBg').style.backgroundImage = "url('" + (ad.cover || ad.image) + "')";
      else document.getElementById('rwdBg').style.backgroundImage = '';
    } catch (e) {}
    try { if (window.AdService && ad.id) AdService.track(ad.id, 'impression'); } catch (e) {}
    box.onclick = function () {
      try { if (window.AdService && ad.id) AdService.track(ad.id, 'click'); } catch (e) {}
    };
  }

  function _finish(completed) {
    clearInterval(_timer);
    _timer = null;
    try { document.getElementById('rwdOv').classList.remove('show'); } catch (e) {}
    var cb = _opts && (completed ? _opts.onComplete : _opts.onQuit);
    _opts = null;
    if (typeof cb === 'function') {
      try { cb(); } catch (e) {}
    }
  }

  function show(opts) {
    _ensure();
    if (document.getElementById('rwdOv').classList.contains('show')) return;
    _opts = opts || {};
    var seconds = Math.max(3, Math.min(30, +(_opts.seconds || 5)));
    document.getElementById('rwdRewardLbl').textContent = _opts.rewardLabel || 'Watch to the end to earn your reward';
    _renderCreative(_pickCreative(_opts.ads));
    var cta = document.getElementById('rwdCta');
    var count = document.getElementById('rwdCount');
    cta.disabled = true;
    cta.textContent = 'Watching…';
    count.classList.remove('done');
    var left = seconds;
    count.textContent = left;
    document.getElementById('rwdOv').classList.add('show');
    clearInterval(_timer);
    _timer = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(_timer);
        _timer = null;
        count.innerHTML = '<i class="fas fa-check"></i>';
        count.classList.add('done');
        cta.disabled = false;
        cta.textContent = 'Done — claim reward';
      } else {
        count.textContent = left;
      }
    }, 1000);
  }

  window.DroboardRewardedAd = { show: show };
})();
