/**
 * api-config.js — Shared backend config for author center.
 * Set USE_API = true when backend is live.
 */
(function () {
  'use strict';
  if (window.AuthorApiConfig) return;
  window.AuthorApiConfig = {
    USE_API: false,
    API_BASE: '/api/author',
    TIMEOUT_MS: 3000
  };
})();
