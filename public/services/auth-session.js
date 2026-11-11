/**
 * services/auth-session.js — Session state (window.AuthSession)
 * ─────────────────────────────────────────────────────────────────────
 * The one place the app reads "who is signed in".
 *
 * A session is written by services/login-service.js (and signup-service.js
 * after auto-login):
 *   droboard_session  → access token
 *   droboard_user     → the user row returned by /api/auth/login
 *
 * No session means guest: no account, no profile, no library. There is no
 * demo persona and no account switcher — signed out really is signed out.
 *
 *   AuthSession.isSignedIn()    → has a session?
 *   AuthSession.isGuest()       → no session?
 *   AuthSession.getStoredUser() → the signed-in user record, or null
 *   AuthSession.getSync()       → { handle, name, avatar } for sync renders
 *   AuthSession.loginUrl(next)  → login link that returns to `next`
 *   AuthSession.getRoles()      → normalized roles from the user row
 */
(function (global) {
  'use strict';

  const SESSION_KEY = 'droboard_session';
  const USER_KEY = 'droboard_user';

  function readJson(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return (v && typeof v === 'object') ? v : null;
    } catch (e) { return null; }
  }

  /* The signed-in user's record, or null for a guest. */
  function getStoredUser() {
    return readJson(USER_KEY);
  }

  function isSignedIn() {
    if (_stale) return false;
    try { return !!localStorage.getItem(SESSION_KEY); } catch (e) { return false; }
  }

  function isGuest() { return !isSignedIn(); }

  function account() {
    if (!isSignedIn()) return { handle: null, name: null, avatar: null };
    const u = getStoredUser();
    if (!u) return { handle: null, name: null, avatar: null };
    const handle = u.handle || u.username || '';
    return {
      handle: handle || null,
      name: u.fullName || u.name || handle || null,
      avatar: u.avatar || null,
    };
  }

  /* ── Roles ──────────────────────────────────────────────────────────
     Canonical role names for menu/dashboard links, read from the real
     session user (droboard_user.roles/role/primaryRole). Visibility only —
     dashboards must still authorize server-side. */
  const ROLE_ALIASES = {
    superadmin: 'admin', super_admin: 'admin', administrator: 'admin',
    chief: 'chief_editor', chiefeditor: 'chief_editor',
    ce: 'chief_editor', 'chief_editor_(ce)': 'chief_editor',
    senior: 'senior_editor', senior_editor: 'senior_editor', senior_editor_dashboard: 'senior_editor',
    senioreditor: 'senior_editor', se: 'senior_editor', 'senior_editor_(se)': 'senior_editor',
    editors: 'editor', content_editor: 'editor',
    finance_manager: 'finance', marketing_manager: 'marketing',
  };
  function normalizeRole(r) {
    const key = String(r || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return ROLE_ALIASES[key] || key;
  }
  function getRoles() {
    const roles = new Set();
    const add = (r) => {
      if (Array.isArray(r)) { r.forEach(add); return; }
      String(r || '').split(',').forEach((part) => {
        const n = normalizeRole(part);
        if (n) roles.add(n);
      });
    };
    const u = getStoredUser();
    if (u) { add(u.roles); add(u.role); add(u.primaryRole); }
    return [...roles];
  }
  function hasRole() {
    const roles = getRoles();
    return [...arguments].some((r) => roles.indexOf(normalizeRole(r)) !== -1);
  }

  /* Send a guest to the login page and back again afterwards. */
  function loginUrl(next) {
    const back = next || (location.pathname.split('/').pop() || 'index.html');
    return 'login.html?next=' + encodeURIComponent(back);
  }

  function getSync() {
    return { ...account() };
  }

  async function getSession() {
    return { ...account() };
  }

  async function getCurrentUserHandle() {
    var acc = account();
    return (acc && acc.handle) ? acc.handle : '';
  }

  /* ── Session bootstrap ─────────────────────────────────────────────
     A session can exist without a stored user row (a login path that only
     returned tokens, or a row that got cleared). Handle and roles — and so
     owner detection and the role dashboards — all read that row, so restore
     it once from the API when it's missing. Safe on demo servers: if the
     endpoint isn't reachable, nothing changes. */
  let _restore = null;
  function ensureAccount() {
    const stored = getStoredUser();
    if (stored || !isSignedIn()) return Promise.resolve(stored);
    if (!_restore) {
      _restore = fetch('/api/users/me', { credentials: 'same-origin' })
        .then(function (r) { return (r && r.ok) ? r.json().catch(function () { return null; }) : null; })
        .then(function (u) {
          if (u && u.id) {
            try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {}
          }
          _restore = null;
          return u || null;
        })
        .catch(function () { _restore = null; return null; });
    }
    return _restore;
  }

  async function logout() {
    // Revoke the refresh family first — dropping only the local copy would
    // leave a valid httpOnly session cookie behind.
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) { /* backend unreachable — still sign out locally */ }
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
    stopRefresh();
    return true;
  }

  function clearCache() {}

  /* ── Proactive access-token refresh ────────────────────────────────
     The refresh cookie is scoped to /api/auth only, so it is never sent to
     /api/posts and the server can no longer re-mint the 15-minute access
     token on an ordinary API call. The client keeps the token fresh instead:
     it refreshes shortly before expiry, and also refreshes once on any 401
     from an API call and then replays the original request. */
  let _refreshInFlight = null;
  let _refreshTimer = null;
  let _stale = false;

  function accessToken() {
    try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }

  function decodeExpMs(token) {
    try {
      const part = String(token || '').split('.')[1];
      if (!part) return 0;
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = JSON.parse(decodeURIComponent(escape(atob(b64))));
      return (json && json.exp) ? json.exp * 1000 : 0;
    } catch (e) { return 0; }
  }

  /* Ask the server for a new access token. The refresh cookie (scoped to
     /api/auth) rides along; the server also re-mints the dro_access cookie.
     Concurrent callers share one in-flight request. */
  function refreshAccess() {
    if (_refreshInFlight) return _refreshInFlight;
    _refreshInFlight = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(function (r) { return (r && r.ok) ? r.json().catch(function () { return null; }) : null; })
      .then(function (b) {
        const tok = b && (b.access || b.token);
        if (tok) {
          try { localStorage.setItem(SESSION_KEY, tok); } catch (e) {}
          scheduleRefresh();
          return true;
        }
        return false;
      })
      .catch(function () { return false; })
      .then(function (ok) { _refreshInFlight = null; return ok; });
    return _refreshInFlight;
  }

  /* Schedule the next refresh just before the access token expires. */
  function scheduleRefresh() {
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
    if (!isSignedIn()) return;
    const expMs = decodeExpMs(accessToken());
    const delay = expMs
      ? Math.min(Math.max(expMs - Date.now() - 300000, 5000), 14 * 60 * 1000)
      : 13 * 60 * 1000; // unreadable exp → refresh well inside the 15-min window
    _refreshTimer = setTimeout(function () { refreshAccess(); }, delay);
  }

  function stopRefresh() {
    if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  }

  /* Proactive keep-alive: call on user activity so the access token stays warm
     as long as the person is actively browsing. Safe to call often — refresh is
     deduplicated via _refreshInFlight and only re-issues near expiry. */
  function keepAlive() {
    if (_stale || !isSignedIn()) return;
    const expMs = decodeExpMs(accessToken());
    if (expMs && expMs - Date.now() > 300000) return; // more than 5 min left — no-op
    refreshAccess();
  }

  /* ── Dead-session honesty ──────────────────────────────────────────
     The client keeps the access token fresh (above), so a browsing user is
     never signed out mid-session. When the 30-day refresh session is truly
     gone (expired, revoked, or signed out elsewhere) the refresh call fails
     and an API call returns 401 {error:'unauthorized'} while this tab still
     believes it is signed in. Rather than silently degrade to a guest —
     menus vanishing, "unauthorized" on save — clear the stale local session
     and route the person back to a real sign-in, with a reason. */
  function sessionExpired() {
    stopRefresh();
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
    if (window.__droExpiryHandled) return;
    window.__droExpiryHandled = true;
    try { window.dispatchEvent(new CustomEvent('droboard:session-expired')); } catch (e) {}
    // Do not redirect mid-browse: mark the session stale so the next auth
    // action (or the next 401) routes to login. A user idling on a page is not
    // interrupted — they only hit the login wall when they act.
    _stale = true;
  }

  /* Only {error:'unauthorized'} means "signed out". Other 401s are wrong
     credentials (MFA step-up, password re-confirmation), not a dead session. */
  function isDeadSession(res) {
    var ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if (ct.indexOf('application/json') === -1) return Promise.resolve(false);
    return res.clone().json().then(function (b) { return !!(b && b.error === 'unauthorized'); })
      .catch(function () { return false; });
  }

  (function installSessionGuard() {
    if (!window.fetch || window.__droSessionGuard) return;
    window.__droSessionGuard = true;
    var native = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var out = native(input, init);
      if (url.indexOf('/api/') === -1 || url.indexOf('/api/auth/') !== -1) return out;
      return out.then(function (res) {
        if (!res || res.status !== 401 || !isSignedIn()) return res;
        // The access token has most likely just expired. Refresh once, then
        // replay the original request. Only if the refresh itself fails is the
        // session actually dead.
        return refreshAccess().then(function (ok) {
          if (ok) { try { return native(input, init); } catch (e) { return res; } }
          return isDeadSession(res).then(function (dead) { if (dead) sessionExpired(); return res; });
        });
      });
    };
  })();

  // Keep the access token warm for the whole session.
  if (isSignedIn()) scheduleRefresh();

  // Facebook-style seamless session: keep the token warm on any user activity,
  // and refresh immediately when the tab regains focus. This prevents the
  // "session expired while browsing" 401 — active users stay signed in.
  (function attachKeepAlive() {
    var _kaTimer = null;
    function keepAliveDebounced() { if (_kaTimer) return; _kaTimer = setTimeout(function () { _kaTimer = null; keepAlive(); }, 2000); }
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') keepAlive();
      }, { passive: true });
      ['click', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
        document.addEventListener(ev, keepAliveDebounced, { passive: true });
      });
    } catch (e) {}
  })();

  global.AuthSession = {
    getSession,
    getSync,
    getCurrentUserHandle,
    logout,
    clearCache,
    isSignedIn,
    getStoredUser,
    isGuest,
    loginUrl,
    getRoles,
    hasRole,
    ensureAccount,
    sessionExpired,
    refresh: refreshAccess,
    scheduleRefresh,
    keepAlive,
  };
})(window);
