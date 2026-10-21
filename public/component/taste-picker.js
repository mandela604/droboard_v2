/* ===============================================================
   TASTE PICKER - first-visit genre + trope chooser for Discover.
   Shown once (localStorage dro_tastes_seen). Both steps skippable.
   Saves dro_tastes = { genres:[...], tropes:[...] } which
   discover-service uses to personalize the Recommended row.

   Usage:
     DroboardTastePicker.maybeShow({ onDone: fn }); // first visit only
     DroboardTastePicker.open({ onDone: fn });       // "Tune your feed" chip

   Live swap: persist dro_tastes via POST /api/profile/tastes.
   =============================================================== */
(function () {
  'use strict';

  var SEEN_KEY = 'dro_tastes_seen';
  var PREF_KEY = 'dro_tastes';

  var TROPES_BY_GENRE = {
    Romance: ['Second Chance', 'Secret Baby', 'Forced Proximity', 'Fake Dating', 'Enemies to Lovers'],
    Fantasy: ['Chosen One', 'Hidden Magic', 'Prophecy', 'Reluctant Hero'],
    Revenge: ['Sweet Revenge', 'Hidden Identity', 'Downfall', 'Justice Served'],
    Mafia: ['Mafia Bride', 'Power Couple', 'Underworld Heir', 'Loyalty Test'],
    Billionaire: ['Secret Billionaire', 'Contract Marriage', 'Office Romance', 'Hidden Heir'],
    Werewolf: ['Fated Mates', 'Rejected Mate', 'Second Chance', 'Hidden Luna'],
    Campus: ['First Love', 'Rivals to Lovers', 'Secret Crush'],
    Mystery: ['Whodunit', 'Cold Case', 'Unreliable Narrator'],
    Horror: ['Haunted House', 'Slow Descent', 'Survival'],
    Default: ['Slow Burn', 'Plot Twist', 'Hidden Truth', 'Second Chance'],
  };

  var FALLBACK_GENRES = [
    'Romance', 'Mafia', 'Werewolf', 'Billionaire', 'Fantasy', 'Revenge',
    'Drama', 'Betrayal', 'Mystery', 'Horror', 'Campus', 'Family',
  ];

  var CSS = [
    '.tp-ov{position:fixed;inset:0;z-index:11500;display:none;align-items:center;justify-content:center;padding:18px;',
    'background:linear-gradient(160deg,rgba(12,6,20,.92) 0%,rgba(40,8,32,.94) 55%,rgba(120,10,60,.92) 100%);backdrop-filter:blur(6px)}',
    '.tp-ov.show{display:flex}',
    '.tp-card{width:100%;max-width:470px;background:#16121f;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px 22px 20px;box-shadow:0 30px 70px rgba(0,0,0,.5);animation:tpIn .22s ease;color:#f2f2f7;font-family:Inter,system-ui,sans-serif}',
    '@keyframes tpIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}',
    '.tp-top{display:flex;align-items:center;gap:10px;margin-bottom:16px}',
    '.tp-logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#ff0050,#ff5c8a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px}',
    '.tp-brand{font-weight:800;font-size:13.5px;letter-spacing:.02em}',
    '.tp-steps{margin-left:auto;display:flex;gap:6px}',
    '.tp-dot{width:22px;height:5px;border-radius:99px;background:rgba(255,255,255,.16)}',
    '.tp-dot.on{background:#ff0050}',
    '.tp-title{font-size:19px;font-weight:800;line-height:1.25;margin:0 0 6px}',
    '.tp-sub{font-size:12.5px;color:rgba(242,242,247,.62);line-height:1.55;margin:0 0 16px}',
    '.tp-grid{display:flex;flex-wrap:wrap;gap:8px;max-height:44vh;overflow-y:auto;padding:2px 1px 6px}',
    '.tp-pill{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#e9e9f2;font:600 12.5px Inter,system-ui,sans-serif;padding:9px 14px;border-radius:999px;cursor:pointer;transition:.12s;user-select:none}',
    '.tp-pill:hover{border-color:rgba(255,0,80,.55)}',
    '.tp-pill.on{background:rgba(255,0,80,.16);border-color:#ff0050;color:#fff}',
    '.tp-pill.on::before{content:"\\2713 ";color:#ff5c8a;font-weight:800}',
    '.tp-hint{font-size:11.5px;color:#fbbf24;font-weight:600;min-height:15px;margin:8px 0 0}',
    '.tp-actions{display:flex;align-items:center;gap:10px;margin-top:14px}',
    '.tp-skip{background:none;border:none;color:rgba(242,242,247,.55);font:600 12px Inter,system-ui,sans-serif;cursor:pointer;padding:8px 6px}',
    '.tp-skip:hover{color:#fff}',
    '.tp-next{margin-left:auto;background:#ff0050;color:#fff;border:none;border-radius:12px;padding:11px 20px;font:800 13px Inter,system-ui,sans-serif;cursor:pointer;transition:.12s}',
    '.tp-next:disabled{opacity:.4;cursor:default}',
    '.tp-count{font-weight:600;opacity:.85}',
  ].join('\n');

  var _built = false, _step = 1, _genres = [], _tropeSel = [], _cb = null;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _read(key, fb) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function _genres_() {
    var g = (window.DemoData && window.DemoData.GENRES) || null;
    if (g && g.length) return g.map(function (x) { return { id: x.id, name: x.name }; });
    return FALLBACK_GENRES.map(function (n) { return { id: n.toLowerCase(), name: n }; });
  }
  function _tropePool() {
    var pool = [], seen = {};
    _genres.forEach(function (id) {
      var g = _genres_().find(function (x) { return x.id === id; });
      if (!g) return;
      (TROPES_BY_GENRE[g.name] || TROPES_BY_GENRE.Default).forEach(function (t) {
        if (!seen[t]) { seen[t] = 1; pool.push(t); }
      });
    });
    if (!pool.length) pool = TROPES_BY_GENRE.Default.slice();
    return pool.slice(0, 14);
  }

  function _ensure() {
    if (_built) return;
    _built = true;
    var st = document.createElement('style');
    st.id = 'tp-style';
    st.textContent = CSS;
    document.head.appendChild(st);
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="tp-ov" id="tpOv">' +
        '<div class="tp-card" role="dialog" aria-modal="true">' +
          '<div class="tp-top">' +
            '<div class="tp-logo"><i class="fas fa-bolt"></i></div>' +
            '<div class="tp-brand">Tune your feed</div>' +
            '<div class="tp-steps"><div class="tp-dot on" id="tpDot1"></div><div class="tp-dot" id="tpDot2"></div></div>' +
          '</div>' +
          '<div id="tpStep1">' +
            '<h3 class="tp-title">What are you in the mood for?</h3>' +
            '<p class="tp-sub">Pick at least 3 genres and we will build your Discover feed around them.</p>' +
            '<div class="tp-grid" id="tpGenreGrid"></div>' +
            '<div class="tp-hint" id="tpHint"></div>' +
          '</div>' +
          '<div id="tpStep2" style="display:none">' +
            '<h3 class="tp-title">Any tropes you love?</h3>' +
            '<p class="tp-sub">Optional - pick the vibes you always come back for (or just skip).</p>' +
            '<div class="tp-grid" id="tpTropeGrid"></div>' +
          '</div>' +
          '<div class="tp-actions">' +
            '<button class="tp-skip" id="tpSkip" type="button">Skip for now</button>' +
            '<button class="tp-next" id="tpNext" type="button"></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('tpSkip').addEventListener('click', function () { _finish(_step === 1); });
    document.getElementById('tpNext').addEventListener('click', function () {
      if (_step === 1) {
        if (_genres.length < 3) {
          document.getElementById('tpHint').textContent = 'Pick at least 3 genres to continue (' + _genres.length + '/3).';
          return;
        }
        _goStep(2);
      } else {
        _finish(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('tpOv').classList.contains('show')) _finish(_step === 1);
    });
  }

  function _goStep(n) {
    _step = n;
    document.getElementById('tpStep1').style.display = n === 1 ? '' : 'none';
    document.getElementById('tpStep2').style.display = n === 2 ? '' : 'none';
    document.getElementById('tpDot1').className = 'tp-dot on';
    document.getElementById('tpDot2').className = 'tp-dot' + (n === 2 ? ' on' : '');
    document.getElementById('tpHint').textContent = '';
    if (n === 2) _renderTropeGrid();
    _updateNext();
  }

  function _renderGenreGrid() {
    var el = document.getElementById('tpGenreGrid');
    el.innerHTML = _genres_().map(function (g) {
      var on = _genres.indexOf(g.id) !== -1;
      return '<button type="button" class="tp-pill' + (on ? ' on' : '') + '" data-g="' + _esc(g.id) + '">' + _esc(g.name) + '</button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.tp-pill'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-g');
        var i = _genres.indexOf(id);
        if (i === -1) _genres.push(id); else _genres.splice(i, 1);
        b.classList.toggle('on');
        document.getElementById('tpHint').textContent = '';
        _updateNext();
      });
    });
  }

  function _renderTropeGrid() {
    var el = document.getElementById('tpTropeGrid');
    el.innerHTML = _tropePool().map(function (t) {
      var on = _tropeSel.indexOf(t) !== -1;
      return '<button type="button" class="tp-pill' + (on ? ' on' : '') + '" data-t="' + _esc(t) + '">' + _esc(t) + '</button>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.tp-pill'), function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-t');
        var i = _tropeSel.indexOf(t);
        if (i === -1) _tropeSel.push(t); else _tropeSel.splice(i, 1);
        b.classList.toggle('on');
        _updateNext();
      });
    });
  }

  function _updateNext() {
    var btn = document.getElementById('tpNext');
    if (_step === 1) {
      btn.innerHTML = 'Continue <span class="tp-count">(' + _genres.length + '/3)</span>';
      btn.disabled = false;
    } else {
      btn.innerHTML = _tropeSel.length ? 'Show my feed <span class="tp-count">(' + _tropeSel.length + ')</span>' : 'Show my feed';
      btn.disabled = false;
    }
  }

  function _open() {
    _ensure();
    var saved = _read(PREF_KEY, null) || {};
    if (!_genres.length) _genres = (saved.genres || []).slice();
    _goStep(_step === 2 && _genres.length >= 3 ? 2 : 1);
    _renderGenreGrid();
    if (_step === 2) _renderTropeGrid();
    _updateNext();
    document.getElementById('tpOv').classList.add('show');
  }

  function _finish(skipped) {
    var ov = document.getElementById('tpOv');
    if (ov) ov.classList.remove('show');
    if (!skipped && _genres.length) {
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify({ genres: _genres.slice(), tropes: _tropeSel.slice(), at: Date.now() }));
      } catch (e) {}
    }
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    var cb = _cb;
    _cb = null;
    _step = 1;
    if (typeof cb === 'function') { try { cb(); } catch (e) {} }
  }

  function maybeShow(opts) {
    _cb = (opts && opts.onDone) || null;
    var seen = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
    if (seen) {
      var cb = _cb; _cb = null;
      if (typeof cb === 'function') { try { cb(); } catch (e) {} }
      return false;
    }
    setTimeout(_open, 400);
    return true;
  }

  function open(opts) {
    _cb = (opts && opts.onDone) || null;
    _open();
  }

  function prefs() { return _read(PREF_KEY, null); }

  window.DroboardTastePicker = { maybeShow: maybeShow, open: open, prefs: prefs };
})();
