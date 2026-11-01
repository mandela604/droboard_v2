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
    senior: 'senior_editor', senior_editor: 'senior_editor', senior_editor_dashboard: 'senior_editor',
    senioreditor: 'senior_editor',
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
    return account().handle;
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
      // Legacy demo keys from before login was wired.
      localStorage.removeItem('droboard_demo_as');
      localStorage.removeItem('dro_staff_role');
      localStorage.removeItem('aurum_user');
    } catch (e) {}
    return true;
  }

  function clearCache() {}

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
  };
})(window);
