/**
 * services/auth-session.js — Demo session (window.AuthSession)
 * DEMO ONLY. Replace when going live.
 */
(function (global) {
  'use strict';

  const DEMO_ME = {
    handle: 'Ada_Writes',
    name: 'Ada Writes',
    avatar: 'https://i.pravatar.cc/200?img=32',
  };

  let _cache = { ...DEMO_ME };

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
    _cache = { ...DEMO_ME };
  }

  global.AuthSession = {
    getSession,
    getCurrentUserHandle,
    logout,
    clearCache,
  };
})(window);
