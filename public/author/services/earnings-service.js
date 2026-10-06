/**
 * earnings-service.js — Author-local wrapper (backend-ready).
 * Delegates to shared AuthorFinance until backend split.
 * TODO backend: GET /api/author/earnings
 */
(function () {
  'use strict';
  if (window.AuthorEarningsService) return;
  window.AuthorEarningsService = {
    async getEarnings() { return window.AuthorFinance ? window.AuthorFinance.getEarnings() : { balance: 0, pending: 0, lifetime: 0, thisMonth: 0, lastMonth: 0, byBook: [] }; },
    fmtCurrency: function (n) { return window.AuthorFinance ? window.AuthorFinance.fmtCurrency(n) : '$' + n; }
  };
})();
