/**
 * api-config.js — Shared backend config for author center.
 * Set USE_API = true when backend is live.
 */
(function () {
  'use strict';
  if (window.AuthorApiConfig) return;
  window.AuthorApiConfig = {
    USE_API: true,     // CHANGE TO: true for production
    API_BASE: '/api/author',
    TIMEOUT_MS: 5000
  };
})();
