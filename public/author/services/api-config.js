/**
 * api-config.js — Shared backend config for author center.
 * Set USE_API = true when backend is live.
 *
 * Also the single writer-only gate for every author-center page (all 18 pages
 * load this file). The author center is for approved writers only: a reader
 * becomes a writer when an editor approves their first book (grantWriterRole
 * in senior.controller). Reader book submission/resubmission happens on the
 * public Pages/create.html, which does NOT load this file — so readers keep
 * that path and only lose access to the writer dashboards.
 *
 * The role is read FRESH from /api/users/me (not localStorage, which can be
 * stale right after approval), and the redirect is skip-able for a single page
 * via sessionStorage so an admin previewing as a reader is not trapped.
 */
(function () {
  'use strict';
  if (window.AuthorApiConfig) return;
  window.AuthorApiConfig = {
    USE_API: true,     // CHANGE TO: true for production
    API_BASE: '/api/author',
    TIMEOUT_MS: 20000
  };

  function toast(message) {
    var t = document.getElementById('authorGateToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'authorGateToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:12px 20px;border-radius:22px;background:#1a1730;color:#fff;font:600 13px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35)';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.display = 'block';
  }
  function redirectReader() {
    toast('Author Center is for approved writers. Submit a book and get approved to unlock it.');
    // Brief pause so the message is readable before leaving the page.
    setTimeout(function () { location.replace('../Pages/profile.html'); }, 1400);
  }

  function gate() {
    // An explicit preview opt-out (super-admin "view as reader") is honoured
    // once, so QA is not locked out of the pages they are inspecting.
    try {
      if (sessionStorage.getItem('dro_author_gate_skip') === '1') {
        sessionStorage.removeItem('dro_author_gate_skip');
        return;
      }
    } catch (e) {}
    fetch('/api/users/me', { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) { location.replace('../Pages/login.html?next=' + encodeURIComponent(location.pathname.split('/').pop())); return; }
        if (!r.ok) return; // on a transient error, do not lock the page
        return r.json();
      })
      .then(function (u) {
        if (!u || !u.id) return;
        var roles = [].concat(u.roles || [], u.role || [], u.primaryRole || [])
          .map(function (x) { return String(x || '').trim().toLowerCase(); });
        // Match users.service WRITER_ROLES: ['writer','senior_editor','chief_editor','admin'].
        var WRITER_ROLES = ['writer', 'senior_editor', 'chief_editor', 'admin'];
        if (!roles.some(function (r) { return WRITER_ROLES.indexOf(r) !== -1; })) redirectReader();
      })
      .catch(function () { /* network error — fail open, never trap a writer */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', gate);
  else gate();
})();
