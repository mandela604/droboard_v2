/**
 * launch-kit-service.js — Author-local re-export.
 * Real logic lives in ../marketing/shared/launch-kit-service.js until backend.
 * TODO backend: GET/POST /api/author/launch-kit
 */
(function () { 'use strict'; if (window.AuthorLaunchKitService) return;
  window.AuthorLaunchKitService = {
    passthrough: true,
    note: 'Uses ../marketing/shared/launch-kit-service.js. Replace with fetch to /api/author/launch-kit when backend live.'
  };
})();
