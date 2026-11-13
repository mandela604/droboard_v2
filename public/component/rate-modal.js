/**
 * rate-modal.js — Droboard Rate & Review Modal
 * ───────────────────────────────────────────────
 * Drop one <script src="rate-modal.js"></script> in any page.
 * Then call:  openRateModal({ storyId, title, img, chaptersRead, onDone })
 *
 *   storyId      : string — used for demo storage + onDone payload
 *   title        : optional story title shown in the sheet
 *   img          : optional cover image (dataURL or URL)
 *   chaptersRead : optional number — informational; the server is the source
 *                  of truth for the gate (GET …/rating → canRate/need).
 *   onDone       : optional fn(result) after submit — the API response
 *                  { ok, mine, avg, count } when live, else the payload.
 *
 * Exposes globals:
 *   openRateModal(data)  — opens the sheet
 *   closeRateModal()     — closes it
 *   hasRated(storyId)    — true if a rating was submitted this session
 *
 * Demo state is in-memory per story. Backend hook:
 *   window.DroboardRateAPI = {
 *     getRating:  async (storyId) => ({ ok, mine:{stars,text,spoiler}|null, avg, count }),
 *     submitRate: async (storyId, { stars, text, spoiler }) => ({ ok })
 *   }
 *   If DroboardRateAPI is not defined, falls back to in-memory demo.
 */

(function () {
  'use strict';

  if (window.__droboardRateModal) return;
  window.__droboardRateModal = true;

  var MIN_CHAPTERS = 3; // same gate as recommendations (posts.service)

  // ══ CSS ══
  var CSS = [
    '.drm-bg{position:fixed;inset:0;z-index:2700;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:none;align-items:flex-end;justify-content:center}',
    '.drm-bg.open{display:flex}',
    '.drm-sheet{width:100%;max-width:480px;background:#0c0c10;border-radius:22px 22px 0 0;border-top:1px solid rgba(255,255,255,.08);animation:drm-up .3s cubic-bezier(.3,0,.2,1);max-height:90vh;overflow-y:auto;scrollbar-width:none;padding-bottom:max(20px,env(safe-area-inset-bottom))}',
    '.drm-sheet::-webkit-scrollbar{display:none}',
    '@keyframes drm-up{from{transform:translateY(100%)}to{transform:translateY(0)}}',
    '.drm-handle{width:36px;height:4px;background:rgba(255,255,255,.12);border-radius:4px;margin:12px auto 0}',
    '.drm-hdr{display:flex;align-items:center;gap:10px;padding:14px 16px 6px}',
    '.drm-cover{width:44px;height:58px;border-radius:8px;object-fit:cover;background:#1a1a22;flex-shrink:0}',
    '.drm-hdr-txt{flex:1;min-width:0}',
    '.drm-kicker{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ff4d7a}',
    '.drm-title{font-size:13px;font-weight:800;color:#f0f0f3;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.drm-close{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px;cursor:pointer;flex-shrink:0}',
    '.drm-close:active{transform:scale(.9)}',
    '.drm-stars-row{display:flex;justify-content:center;gap:10px;padding:18px 16px 6px}',
    '.drm-star{font-size:34px;color:#3a3a44;cursor:pointer;transition:color .15s,transform .12s;line-height:1;user-select:none}',
    '.drm-star:hover{transform:scale(1.18)}',
    '.drm-star.lit{color:#fbbf24}',
    '.drm-star.pop{animation:drm-pop .3s ease}',
    '@keyframes drm-pop{0%{transform:scale(1)}40%{transform:scale(1.4)}100%{transform:scale(1)}}',
    '.drm-word{text-align:center;font-size:13px;font-weight:800;color:#f0f0f3;min-height:20px;margin-top:4px;transition:.2s}',
    '.drm-avg{text-align:center;font-size:11px;color:rgba(255,255,255,.5);margin-top:2px}',
    '.drm-avg b{color:#fbbf24}',
    '.drm-body{padding:14px 16px 4px}',
    '.drm-label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:7px;display:flex;justify-content:space-between;align-items:center}',
    '.drm-count{font-weight:600;letter-spacing:0;text-transform:none;color:rgba(255,255,255,.3)}',
    '.drm-text{width:100%;min-height:104px;resize:vertical;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 13px;color:#ececf0;font-size:13px;line-height:1.55;font-family:inherit;outline:none;transition:border-color .15s}',
    '.drm-text:focus{border-color:rgba(255,0,80,.45)}',
    '.drm-text::placeholder{color:rgba(255,255,255,.28)}',
    '.drm-note{font-size:10px;color:rgba(255,255,255,.4);margin-top:6px;display:flex;align-items:center;gap:5px}',
    '.drm-spoiler{display:flex;align-items:center;gap:9px;margin-top:12px;cursor:pointer;user-select:none}',
    '.drm-sw{width:36px;height:20px;border-radius:20px;background:rgba(255,255,255,.12);position:relative;transition:background .18s;flex-shrink:0}',
    '.drm-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s}',
    '.drm-spoiler.on .drm-sw{background:#ff0050}',
    '.drm-spoiler.on .drm-sw::after{transform:translateX(16px)}',
    '.drm-sp-txt{font-size:11.5px;font-weight:700;color:rgba(255,255,255,.75)}',
    '.drm-sp-sub{font-size:9.5px;color:rgba(255,255,255,.4);margin-top:1px}',
    '.drm-submit{width:calc(100% - 32px);margin:16px;padding:14px;border:none;border-radius:14px;background:#ff0050;color:#fff;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;transition:.15s;letter-spacing:.02em}',
    '.drm-submit:active{transform:scale(.98)}',
    '.drm-submit:disabled{opacity:.4;cursor:not-allowed}',
    '.drm-remove{display:block;width:calc(100% - 32px);margin:0 16px 14px;padding:10px;border:none;border-radius:12px;background:transparent;color:rgba(255,255,255,.45);font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;text-decoration:underline}',
    '.drm-remove:disabled{opacity:.4;cursor:not-allowed}',
    '.drm-locked{padding:28px 24px 34px;text-align:center}',
    '.drm-lock-ico{width:52px;height:52px;border-radius:50%;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:#fbbf24;font-size:20px}',
    '.drm-lock-t{font-size:14px;font-weight:800;color:#f0f0f3;margin-bottom:6px}',
    '.drm-lock-s{font-size:12px;color:rgba(255,255,255,.5);line-height:1.55}',
    '.drm-lock-n{margin-top:14px;font-size:11px;font-weight:800;color:#ff4d7a}',
    '.drm-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px}',
    '.drm-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#ff0050,#ff7a9a)}',
    'body.theme-white .drm-sheet{background:#ffffff;border-top-color:rgba(0,0,0,.08)}',
    'body.theme-white .drm-title,body.theme-white .drm-word,body.theme-white .drm-lock-t{color:#161616}',
    'body.theme-white .drm-close{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.1);color:#555}',
    'body.theme-white .drm-star{color:#c8c8ce}',
    'body.theme-white .drm-star.lit{color:#fbbf24}',
    'body.theme-white .drm-avg,body.theme-white .drm-lock-s,body.theme-white .drm-sp-sub{color:rgba(0,0,0,.5)}',
    'body.theme-white .drm-text{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.12);color:#1a1a24}',
    'body.theme-white .drm-text::placeholder{color:rgba(0,0,0,.3)}',
    'body.theme-white .drm-note{color:rgba(0,0,0,.45)}',
    'body.theme-white .drm-text:focus{border-color:rgba(255,0,80,.5)}',
    'body.theme-white .drm-label{color:rgba(0,0,0,.45)}',
    'body.theme-white .drm-count{color:rgba(0,0,0,.35)}',
    'body.theme-white .drm-sp-txt{color:rgba(0,0,0,.75)}',
    'body.theme-white .drm-sw{background:rgba(0,0,0,.15)}',
    'body.theme-white .drm-sw::after{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}'
  ].join('');

  if (!document.getElementById('drm-css')) {
    var st = document.createElement('style');
    st.id = 'drm-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ══ State ══
  var votes = {};   // storyId -> { stars, text, spoiler }
  var draft = { stars: 0, text: '', spoiler: false };
  var cfg = {};
  var WORDS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great!'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function $(id) { return document.getElementById(id); }

  function ensureDom() {
    if ($('drm-bg')) return;
    var wrap = document.createElement('div');
    wrap.className = 'drm-bg';
    wrap.id = 'drm-bg';
    wrap.innerHTML =
      '<div class="drm-sheet" id="drmSheet" onclick="event.stopPropagation()">' +
        '<div class="drm-handle"></div>' +
        '<div class="drm-hdr">' +
          '<img class="drm-cover" id="drmCover" alt=""/>' +
          '<div class="drm-hdr-txt">' +
            '<div class="drm-kicker">Rate &amp; Review</div>' +
            '<div class="drm-title" id="drmTitle"></div>' +
          '</div>' +
          '<div class="drm-close" onclick="closeRateModal()"><i class="fas fa-times"></i></div>' +
        '</div>' +
        '<div id="drmContent"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', closeRateModal);
  }

  function starsHtml() {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="drm-star' + (i <= draft.stars ? ' lit' : '') + '" data-r="' + i + '" onclick="RateModal.pick(' + i + ')">\u2605</span>';
    }
    return '<div class="drm-stars-row" id="drmStars">' + out + '</div>' +
      '<div class="drm-word" id="drmWord">' + (draft.stars ? WORDS[draft.stars] : '&nbsp;') + '</div>' +
      '<div class="drm-avg" id="drmAvg"></div>';
  }

  function lockedHtml() {
    // Only the reading gate locks the sheet — an existing rating is edited
    // in place (the form is pre-filled), never shown read-only.
    var read = cfg.chaptersRead || 0;
    var need = cfg.need || MIN_CHAPTERS;
    var pct = Math.min(100, Math.round(read / need * 100));
    return '<div class="drm-locked">' +
      '<div class="drm-lock-ico"><i class="fas fa-lock"></i></div>' +
      '<div class="drm-lock-t">Ratings unlock at ' + need + ' chapters</div>' +
      '<div class="drm-lock-s">Same rule as recommendations — only readers who stuck with the story can judge it.</div>' +
      '<div class="drm-lock-n">' + read + ' / ' + need + ' chapters read</div>' +
      '<div class="drm-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>';
  }

  function formHtml() {
    var editing = !!(votes[cfg.storyId || 'demo'] && votes[cfg.storyId || 'demo'].stars);
    return '<div class="drm-body">' +
      '<div class="drm-label">' + (editing ? 'Edit your review' : 'Your review') + ' <span class="drm-count" id="drmCount">' + draft.text.length + '/600</span></div>' +
      '<textarea class="drm-text" id="drmText" maxlength="600" placeholder="What worked? What dragged? Would you tell a friend to read it?">' + esc(draft.text) + '</textarea>' +
        '<div class="drm-note"><i class="fas fa-exclamation-circle" style="font-size:9px"></i>Don\'t reveal twists or endings.</div>' +
      '<div class="drm-spoiler' + (draft.spoiler ? ' on' : '') + '" id="drmSpoiler" onclick="RateModal.spoiler()">' +
        '<div class="drm-sw"></div>' +
        '<div><div class="drm-sp-txt">Contains spoilers</div><div class="drm-sp-sub">Hidden behind a tap for other readers</div></div>' +
      '</div>' +
      '</div>' +
      '<button class="drm-submit" id="drmSubmit" onclick="RateModal.submit()"' + (draft.stars ? '' : ' disabled') + '>' +
        (draft.stars ? (editing ? 'Update review' : 'Post review') : 'Tap a star to rate') + '</button>' +
      (editing ? '<button type="button" class="drm-remove" id="drmRemove" onclick="RateModal.remove()">Remove rating</button>' : '');
  }

  function renderForm() {
    var el = $('drmContent');
    if (!el) return;
    el.innerHTML = starsHtml() + formHtml();
    var avg = $('drmAvg');
    if (avg && cfg.avg != null) {
      avg.innerHTML = '<b>' + Number(cfg.avg).toFixed(1) + '</b> \u00b7 ' + (cfg.count != null ? cfg.count : 0) + ' ratings';
    }
    var ta = $('drmText');
    if (ta) {
      ta.addEventListener('input', function () {
        draft.text = ta.value;
        var c = $('drmCount');
        if (c) c.textContent = ta.value.length + '/600';
        syncSubmit();
      });
    }
  }

  function syncSubmit() {
    var b = $('drmSubmit');
    if (!b) return;
    b.disabled = !draft.stars;
    var editing = !!(votes[cfg.storyId || 'demo'] && votes[cfg.storyId || 'demo'].stars);
    b.textContent = draft.stars ? (editing ? 'Update review' : 'Post review') : 'Tap a star to rate';
  }

  function render() {
    if (cfg.canRate === false) {
      $('drmContent').innerHTML = lockedHtml();
    } else {
      renderForm();
    }
  }

  // ══ Public API ══
  window.RateModal = {
    pick: function (n) {
      draft.stars = n;
      var stars = document.querySelectorAll('#drmStars .drm-star');
      stars.forEach(function (s, i) {
        s.classList.toggle('lit', i < n);
        s.classList.remove('pop');
        if (i === n - 1) { void s.offsetWidth; s.classList.add('pop'); }
      });
      var w = $('drmWord');
      if (w) w.textContent = WORDS[n];
      syncSubmit();
    },
    spoiler: function () {
      draft.spoiler = !draft.spoiler;
      var el = $('drmSpoiler');
      if (el) el.classList.toggle('on', draft.spoiler);
    },
    submit: function () {
      if (!draft.stars) return;
      var payload = { stars: draft.stars, text: draft.text.trim(), spoiler: draft.spoiler };
      var id = cfg.storyId || 'demo';
      var editing = !!(votes[id] && votes[id].stars);
      var btn = $('drmSubmit');
      if (btn) { btn.disabled = true; btn.textContent = editing ? 'Updating\u2026' : 'Posting\u2026'; }
      var api = window.DroboardRateAPI;

      // Only a confirmed server write counts as a rating — a 403/network
      // error must not leave the modal showing "already rated" after a reload.
      var succeed = function (res) {
        votes[id] = (res && res.mine) || payload;
        closeRateModal();
        if (window.toast) toast(editing ? '\u2b50 Review updated' : '\u2b50 Rating posted');
        if (typeof cfg.onDone === 'function') cfg.onDone(res || payload);
      };
      var fail = function (msg) {
        if (btn) { btn.disabled = false; btn.textContent = editing ? 'Update review' : 'Post review'; }
        if (window.toast) toast(msg || '\u2717 Could not post rating');
      };

      if (api && api.submitRate) {
        api.submitRate(id, payload).then(function (r) {
          if (r && r.ok === false) {
            fail(r.error === 'not_enough_reading' ? 'Read more chapters to rate' : 'Could not post rating');
            return;
          }
          succeed(r);
        }).catch(function () { fail(); });
      } else {
        setTimeout(function () { succeed(payload); }, 350);
      }
    },
    remove: function () {
      var id = cfg.storyId || 'demo';
      var api = window.DroboardRateAPI;
      var btn = $('drmRemove');
      if (btn) { btn.disabled = true; btn.textContent = 'Removing\u2026'; }
      var finish = function (res, ok) {
        if (!ok) {
          if (btn) { btn.disabled = false; btn.textContent = 'Remove rating'; }
          if (window.toast) toast('\u2717 Could not remove rating');
          return;
        }
        delete votes[id];
        draft = { stars: 0, text: '', spoiler: false };
        closeRateModal();
        if (window.toast) toast('Rating removed');
        if (typeof cfg.onDone === 'function') cfg.onDone(res || { ok: true, deleted: true, mine: null });
      };
      if (api && api.deleteRating) {
        api.deleteRating(id).then(function (r) {
          if (r && r.ok === false) { finish(r, false); return; }
          finish(r || { ok: true, deleted: true, mine: null }, true);
        }).catch(function () { finish(null, false); });
      } else {
        setTimeout(function () { finish({ ok: true, deleted: true, mine: null }, true); }, 300);
      }
    }
  };

  window.openRateModal = function (data) {
    ensureDom();
    cfg = data || {};
    var prev = votes[cfg.storyId || 'demo'];
    draft = prev && prev.stars
      ? { stars: prev.stars, text: prev.text, spoiler: !!prev.spoiler }
      : { stars: 0, text: '', spoiler: false };
    // Star tapped on the page (e.g. bridge inline stars) pre-lights the modal
    if (!draft.stars && cfg.presetStars > 0 && cfg.presetStars <= 5) {
      draft.stars = cfg.presetStars;
    }
    var t = $('drmTitle'), c = $('drmCover');
    if (t) t.textContent = cfg.title || 'This story';
    if (c) { c.src = cfg.img || ''; c.style.display = cfg.img ? '' : 'none'; }
    render();
    $('drm-bg').classList.add('open');
    // Backend fetch hook
    var api = window.DroboardRateAPI;
    if (api && api.getRating) {
      api.getRating(cfg.storyId).then(function (r) {
        if (r && r.ok !== false) {
          if (r.mine && r.mine.stars) { votes[cfg.storyId || 'demo'] = r.mine; draft.stars = r.mine.stars; }
          if (r.avg != null) cfg.avg = r.avg;
          if (r.count != null) cfg.count = r.count;
          // Server owns the gate (books shorter than MIN_CHAPTERS unlock at
          // their full length) — never lock on the caller's guess.
          if (typeof r.chaptersRead === 'number') cfg.chaptersRead = r.chaptersRead;
          if (typeof r.need === 'number') cfg.need = r.need;
          if (typeof r.canRate === 'boolean') cfg.canRate = r.canRate;
          render();
        }
      }).catch(function () {});
    }
  };

  window.closeRateModal = function () {
    var el = $('drm-bg');
    if (el) el.classList.remove('open');
  };

  window.hasRated = function (storyId) { return !!votes[storyId || 'demo']; };
})();
