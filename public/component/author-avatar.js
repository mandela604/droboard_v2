/**
 * component/author-avatar.js — the signed-in author's own picture in the
 * Author Center header, on every author page.
 * ─────────────────────────────────────────────────────────────────────
 * No hardcoded faces, no Droboard "D" placeholder: the avatar slot is filled
 * from the LIVE user row (/api/users/me), not just the cached login payload —
 * a picture uploaded after sign-in shows up on the next page load. If the
 * author has no picture yet, their initials are shown instead — still theirs.
 *
 * Clicking the avatar opens the author's own profile page.
 *
 * Handles both header layouts used by author pages:
 *   .topbar   (dashboard, finance, workspace pages — some already have a slot)
 *   .top-bar  (application pages — hamburger + back + title)
 *
 * Include once, early in <body>:
 *   <script src="../component/author-avatar.js?v=2"></script>
 */
(function (global) {
  'use strict';
  if (global.AuthorAvatar) return;

  var STYLE_ID = 'dro-author-avatar-style';
  var PROFILE_URL = '../Pages/profile.html';

  function readUser() {
    var u = null;
    try {
      if (global.AuthSession && global.AuthSession.getSync) u = global.AuthSession.getSync();
      if (!u || !(u.avatar || u.name || u.handle)) {
        var stored = null;
        try { stored = JSON.parse(localStorage.getItem('droboard_user') || 'null'); } catch (e) {}
        if (stored && typeof stored === 'object') {
          u = {
            avatar: stored.avatar || null,
            name: stored.fullName || stored.name || null,
            handle: stored.handle || stored.username || null
          };
        }
      }
    } catch (e) {}
    return u || null;
  }

  function initialsOf(u) {
    var name = String((u && (u.name || u.handle)) || '').trim();
    if (!name) return 'A';
    var parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID) || !document.head) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.avatar-btn.dro-author-avatar{width:38px;height:38px;display:flex;align-items:center;justify-content:center;' +
        'overflow:hidden;border-radius:50%;flex-shrink:0;cursor:pointer;margin-left:auto;' +
        'border:1px solid rgba(0,0,0,.08);background:linear-gradient(135deg,#ff2d55,#7c3aed)}' +
      '.avatar-btn.dro-author-avatar img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.avatar-btn.dro-author-avatar .dro-initials{color:#fff;font-size:11px;font-weight:800;' +
        'line-height:1;letter-spacing:.02em;user-select:none}';
    document.head.appendChild(s);
  }

  function setInitials(box, u) {
    var el = box.querySelector('.dro-initials');
    if (!el) {
      el = document.createElement('span');
      el.className = 'dro-initials';
      box.appendChild(el);
    }
    el.textContent = initialsOf(u);
  }

  function paint() {
    var u = readUser();
    if (!u) {
      // Cookie-only login: restore the user row, then paint with real data.
      refreshFromApi();
      return;
    }

    ensureStyle();
    var name = String(u.name || u.handle || 'Author');
    var src = u.avatar || '';
    var bars = [];
    var main = document.querySelector('.topbar');
    var alt = document.querySelector('.top-bar');
    if (main) bars.push(main);
    if (alt && alt !== main) bars.push(alt);

    bars.forEach(function (bar) {
      var box = bar.querySelector('[data-author-avatar],#userAvatarImg,.avatar-btn');
      var img;
      if (box && box.tagName === 'IMG') { img = box; box = img.parentElement; }
      else if (box) { img = box.querySelector('img'); }
      if (!box) {
        box = document.createElement('div');
        box.className = 'avatar-btn dro-author-avatar';
        bar.appendChild(box);
      }
      box.classList.add('dro-author-avatar');
      box.setAttribute('data-author-avatar', '');
      box.title = name + ' — open profile';
      box.onclick = function () { location.href = PROFILE_URL; };
      box.setAttribute('role', 'link');
      box.setAttribute('tabindex', '0');
      box.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.href = PROFILE_URL; }
      };

      if (!img) {
        img = document.createElement('img');
        box.appendChild(img);
      }
      img.alt = name + ' avatar';
      img.onerror = function () {
        img.style.display = 'none';
        setInitials(box, u);
      };
      if (src) {
        img.style.display = '';
        var old = box.querySelector('.dro-initials');
        if (old) old.remove();
        if (img.getAttribute('src') !== src) img.src = src;
      } else {
        img.style.display = 'none';
        setInitials(box, u);
      }
    });
  }

  /* The stored login payload can be stale (a photo added after sign-in), and
     AuthSession.ensureAccount() deliberately skips a row that already exists.
     Always re-read the live user row so the real image is used. */
  function refreshFromApi() {
    try {
      fetch('/api/users/me', { credentials: 'include' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (fresh) {
          if (!fresh || !fresh.id) return;
          try { localStorage.setItem('droboard_user', JSON.stringify(fresh)); } catch (e) {}
          paint();
        })
        .catch(function () {});
    } catch (e) {}
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { paint(); refreshFromApi(); }, { once: true });
    } else {
      paint();
      refreshFromApi();
    }
  }
  init();

  global.AuthorAvatar = { refresh: paint, refreshFromApi: refreshFromApi };
})(window);
