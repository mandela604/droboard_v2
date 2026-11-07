/**
 * component/auth-wall.js — RequireAuth (window.RequireAuth)
 * ─────────────────────────────────────────────────────────────
 * One gate for every action that WRITES. When a guest clicks something
 * that needs an account — post, comment, follow, save, react, tip,
 * report, create a collection — the sheet slides up instead of the
 * action silently failing (or, in demo mode, silently succeeding).
 *
 * The wall never collects credentials itself. It hands off to
 * login.html / signup.html, where the real email, password, MFA and
 * Google flows already live, and carries `next` so the guest lands back
 * on the exact page — and URL — they were on.
 *
 *   <script src="component/auth-wall.js"></script>
 *
 *   // At the top of any write action:
 *   if (!RequireAuth.ensure('send a tip')) return;
 *
 *   RequireAuth.isGuest()   → boolean, if you want to branch instead
 *   RequireAuth.wall(label) → force the sheet open
 *
 * `ensure()` returns true when the action may proceed, false when the
 * wall took over. It is deliberately forgiving: if this script failed to
 * load, callers guard with `window.RequireAuth &&` and fall back to the
 * old behaviour — the backend's requireAuth is still the real boundary.
 */
(function (global) {
  'use strict';

  if (global.RequireAuth) return;

  const SESSION_KEY = 'droboard_session';

  /* ── State ─────────────────────────────────────────────────────── */
  let built = false;
  let lastAction = '';          // shown in the sheet: "Sign in to send a tip"

  /* ── Session ───────────────────────────────────────────────────── */
  function isGuest() {
    /* Prefer the canonical session module when the page has it; fall back
       to the raw key so components work on pages that don't. */
    try {
      if (global.AuthSession && typeof global.AuthSession.isGuest === 'function') {
        return !!global.AuthSession.isGuest();
      }
      return !localStorage.getItem(SESSION_KEY);
    } catch (e) { return false; }
  }

  /* Where to send them back to — path plus query, so a deep link like
     bridge.html?id=story1 survives the round trip. */
  function _nextUrl() {
    return (location.pathname.split('/').pop() || 'index.html') + (location.search || '');
  }
  function _loginUrl() { return 'login.html?next=' + encodeURIComponent(_nextUrl()); }
  function _signupUrl() { return 'signup.html?next=' + encodeURIComponent(_nextUrl()); }

  /* ── Markup ────────────────────────────────────────────────────── */
  const CSS = `
    .ra-ov{position:fixed;inset:0;background:rgba(9,7,20,.62);backdrop-filter:blur(3px);
      z-index:1000;opacity:0;pointer-events:none;transition:opacity .22s ease}
    .ra-ov.show{opacity:1;pointer-events:auto}
    .ra-sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);
      width:100%;max-width:430px;background:var(--l1,#fff);border:1px solid var(--bd,#e7e5f0);
      border-bottom:none;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));
      z-index:1001;transition:transform .28s cubic-bezier(.22,1,.36,1);
      box-shadow:0 -12px 44px rgba(0,0,0,.22);text-align:center}
    .ra-sheet.show{transform:translate(-50%,0)}
    @media(min-width:520px){
      .ra-sheet{bottom:24px;border-radius:22px;border-bottom:1px solid var(--bd,#e7e5f0);
        transform:translate(-50%,140%)}
      .ra-sheet.show{transform:translate(-50%,0)}
    }
    .ra-close{position:absolute;top:12px;right:14px;width:30px;height:30px;border:none;
      background:transparent;color:var(--tx-muted,#8b88a3);font-size:16px;cursor:pointer;
      border-radius:50%;display:flex;align-items:center;justify-content:center}
    .ra-close:active{background:rgba(0,0,0,.06)}
    .ra-ico{width:56px;height:56px;border-radius:17px;margin:4px auto 13px;
      background:linear-gradient(135deg,rgba(255,0,80,.12),rgba(167,139,250,.1));
      border:1px solid var(--bd-acc,rgba(255,0,80,.24));display:flex;align-items:center;
      justify-content:center;color:var(--acc,#ff0050);font-size:22px}
    .ra-title{font-size:18px;font-weight:800;color:var(--tx-high,#161616);letter-spacing:-.3px}
    .ra-sub{font-size:12.5px;color:var(--tx-muted,#6b6880);line-height:1.55;margin:7px auto 17px;max-width:300px}
    .ra-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
      font-family:inherit;font-size:13px;font-weight:700;padding:12px;border-radius:12px;
      border:none;cursor:pointer;transition:.15s;margin-bottom:9px;text-decoration:none}
    .ra-btn:active{transform:scale(.985)}
    .ra-btn.ra-primary{background:var(--acc,#ff0050);color:#fff;box-shadow:0 5px 16px rgba(255,0,80,.3)}
    .ra-btn.ra-google{background:var(--l2,#fff);color:var(--tx-high,#161616);
      border:1px solid var(--bd,#e7e5f0)}
    .ra-btn.ra-google img{width:17px;height:17px}
    .ra-or{display:flex;align-items:center;gap:11px;margin:14px 0 12px}
    .ra-or::before,.ra-or::after{content:'';flex:1;height:1px;background:var(--bd,#e7e5f0)}
    .ra-or span{font-size:11px;font-weight:700;color:var(--tx-muted,#8b88a3)}
    .ra-signup{font-size:12.5px;color:var(--tx-muted,#6b6880);margin:0}
    .ra-signup a{color:var(--acc,#ff0050);font-weight:800;text-decoration:none}
    .ra-note{font-size:10.5px;color:var(--tx-muted,#9b98ae);margin-top:13px;line-height:1.5}
  `;

  function _build() {
    if (built) return;
    built = true;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.className = 'ra-ov';
    ov.id = 'raOverlay';

    const sheet = document.createElement('div');
    sheet.className = 'ra-sheet';
    sheet.id = 'raSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'raTitle');
    sheet.innerHTML =
      '<button type="button" class="ra-close" id="raClose" aria-label="Close"><i class="fas fa-xmark"></i></button>' +
      '<div class="ra-ico"><i class="fas fa-lock"></i></div>' +
      '<div class="ra-title" id="raTitle">Log in to continue</div>' +
      '<p class="ra-sub" id="raSub">This needs an account — it takes less than a minute.</p>' +
      '<a class="ra-btn ra-primary" id="raEmail" href="#"><i class="fas fa-envelope"></i> Continue with email</a>' +
      '<a class="ra-btn ra-google" id="raGoogle" href="#">' +
        '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt=""/>' +
        ' Continue with Google</a>' +
      '<div class="ra-or"><span>or</span></div>' +
      '<p class="ra-signup">New to Droboard? <a id="raSignup" href="#">Create account</a></p>' +
      '<p class="ra-note">You\'ll come right back here after signing in.</p>';

    document.body.appendChild(ov);
    document.body.appendChild(sheet);

    document.getElementById('raClose').addEventListener('click', close);
    ov.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('show')) close();
    });
    document.getElementById('raEmail').addEventListener('click', function (e) {
      e.preventDefault(); location.href = _loginUrl();
    });
    /* Google goes through login.html so its OAuth handler owns the
       callback, MFA and error copy — one place for all of it. */
    document.getElementById('raGoogle').addEventListener('click', function (e) {
      e.preventDefault(); location.href = _loginUrl() + '&google=1';
    });
    document.getElementById('raSignup').addEventListener('click', function (e) {
      e.preventDefault(); location.href = _signupUrl();
    });
  }

  function wall(action) {
    _build();
    lastAction = action || '';
    const sub = document.getElementById('raSub');
    if (sub) {
      sub.textContent = lastAction
        ? 'Sign in to ' + lastAction + ' — you\'ll come right back here.'
        : 'This needs an account — it takes less than a minute.';
    }
    document.getElementById('raOverlay').classList.add('show');
    document.getElementById('raSheet').classList.add('show');
    document.body.style.overflow = 'hidden';
    return false;
  }

  function close() {
    const ov = document.getElementById('raOverlay');
    const sh = document.getElementById('raSheet');
    if (ov) ov.classList.remove('show');
    if (sh) sh.classList.remove('show');
    document.body.style.overflow = '';
  }

  /* The one call site should use. */
  function ensure(action) {
    if (!isGuest()) return true;
    return wall(action);
  }

  global.RequireAuth = { ensure, wall, close, isGuest };

})(window);
