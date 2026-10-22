/**
 * services/auth-session.js — Session state (window.AuthSession)
 * ─────────────────────────────────────────────────────────────────────
 * DEMO account switcher + real session helpers.
 *
 * Demo account switcher — default account is the READER (You_Reader) so the
 * reader → writer flow (Create → submit → approve) is visible on profile.html.
 * Flip accounts from any page URL (persists):
 *   ?as=writer  → Ada Writes (existing writer)
 *   ?as=reader  → Jordan Blake (reader, default)
 *   ?as=guest   → signed out — no account, no profile, no library
 *
 * Signing out also switches the demo to 'guest', so the guest views
 * (profile + library) are reachable without a backend.
 *
 * Real session helpers (used by the live backend):
 *   AuthSession.isSignedIn()    → has a session?
 *   AuthSession.isGuest()       → no session (guest)?
 *   AuthSession.getStoredUser() → the signed-in user record, or null
 *   AuthSession.loginUrl(next)  → login link that returns to `next`
 */
(function (global) {
  'use strict';

  const ACCOUNTS = {
    reader: { handle: 'You_Reader', name: 'Jordan Blake', avatar: 'https://i.pravatar.cc/200?img=11' },
    writer: { handle: 'Ada_Writes', name: 'Ada Writes', avatar: 'https://i.pravatar.cc/200?img=32' },
  };
  const STORAGE_KEY = 'droboard_demo_as';

  /* Real session keys — written by login-service.js / signup-service.js.
     Their presence is the ONLY reliable "this person has an account"
     signal; the demo account switcher above is not one. */
  const SESSION_KEY = 'droboard_session';
  const USER_KEY = 'droboard_user';

  /* ── Effective mode ────────────────────────────────────────────────
     One place that decides "who is this person right now", so the
     identity and the signed-in flag can never disagree.

     Precedence:
       1. ?as=reader|writer|guest  → explicit override (always wins)
       2. a real session            → signed in (wins over a stale 'guest')
       3. the stored demo mode      → 'reader' | 'writer' | 'guest'
       4. nothing stored            → 'reader' (demo default)          */
  function effectiveMode() {
    // 1. explicit ?as= override
    try {
      const as = new URLSearchParams(location.search).get('as');
      if (as === 'reader' || as === 'writer' || as === 'guest') {
        try { localStorage.setItem(STORAGE_KEY, as); } catch (e) {}
        return as;
      }
    } catch (e) {}
    // 2. a real session beats the demo switcher
    try { if (localStorage.getItem(SESSION_KEY)) return 'reader'; } catch (e) {}
    // 3./4. stored demo mode (may be null)
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  /* True when the visitor has actually signed in (has a session).
     Demo mode also counts: the account switcher stands in for a session
     until the visitor switches to 'guest' or signs out. */
  function isSignedIn() {
    const mode = effectiveMode();
    return mode === 'reader' || mode === 'writer';
  }

  /* Which demo account is active: 'reader' | 'writer' | 'guest'. */
  function getMode() {
    const mode = effectiveMode();
    return mode === 'writer' ? 'writer' : (mode === 'guest' ? 'guest' : 'reader');
  }

  /* Switch the demo account (reader / writer / guest) and reload. */
  function setMode(mode) {
    const m = (mode === 'writer' || mode === 'guest') ? mode : 'reader';
    try { localStorage.setItem(STORAGE_KEY, m); } catch (e) {}
    // Switching accounts replaces whatever session was there.
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
    _cache = resolveAccount();
    return m;
  }

  /* The signed-in user's record, or null for a guest. */
  function getStoredUser() {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return (u && typeof u === 'object') ? u : null;
    } catch (e) { return null; }
  }

  /* Guest = nobody signed in. Pages use this to decide whether to show a
     login gate instead of account-only UI (profile, library, …). */
  function isGuest() { return !isSignedIn(); }

  /* Send a guest to the login page and back again afterwards. */
  function loginUrl(next) {
    const back = next || (location.pathname.split('/').pop() || 'index.html');
    return 'login.html?next=' + encodeURIComponent(back);
  }

  function resolveAccount() {
    const mode = effectiveMode();
    if (mode === 'guest') return { handle: null, name: null, avatar: null };
    if (!mode) {
      // First run in the demo: default to the reader account and remember it.
      try { localStorage.setItem(STORAGE_KEY, 'reader'); } catch (e) {}
      return Object.assign({}, ACCOUNTS.reader);
    }
    return Object.assign({}, ACCOUNTS[mode === 'writer' ? 'writer' : 'reader']);
  }

  let _cache = resolveAccount();

  // Synchronous read for components that render synchronously (e.g.
  // comment-section currentUser). Returns a copy, never null fields.
  function getSync() {
    return { ..._cache };
  }

  async function getSession() {
    return { ..._cache };
  }

  async function getCurrentUserHandle() {
    return _cache.handle || null;
  }

  async function logout() {
    _cache = { handle: null, name: null, avatar: null };
    // Sign out for real: drop the stored session + user so the app
    // treats this visitor as a guest again on the next page load.
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {}
    // Demo mode: remember that we're signed out, otherwise the account
    // switcher would silently sign us back in on the next page load.
    try { localStorage.setItem(STORAGE_KEY, 'guest'); } catch (e) {}
    return true;
  }

  function clearCache() {
    _cache = resolveAccount();
  }

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
    getMode,
    setMode,
  };
})(window);
