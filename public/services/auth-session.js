/**
 * services/auth-session.js — Demo session (window.AuthSession)
 * DEMO ONLY. Replace when going live.
 *
 * Demo account switcher — default account is the READER (You_Reader) so the
 * reader → writer flow (Create → submit → approve) is visible on profile.html.
 * Flip accounts from any page URL (persists):
 *   ?as=writer  → Ada Writes (existing writer)
 *   ?as=reader  → Jordan Blake (reader, default)
 */
(function (global) {
  'use strict';

  const ACCOUNTS = {
    reader: { handle: 'You_Reader', name: 'Jordan Blake', avatar: 'https://i.pravatar.cc/200?img=11' },
    writer: { handle: 'Ada_Writes', name: 'Ada Writes', avatar: 'https://i.pravatar.cc/200?img=32' },
  };
  const STORAGE_KEY = 'droboard_demo_as';

  function resolveAccount() {
    try {
      const as = new URLSearchParams(location.search).get('as');
      if (as === 'reader' || as === 'writer') localStorage.setItem(STORAGE_KEY, as);
    } catch (e) {}
    let mode = null;
    try { mode = localStorage.getItem(STORAGE_KEY); } catch (e) {}
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
  };
})(window);
