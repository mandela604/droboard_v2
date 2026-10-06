/** transaction-history-service.js — wrapper. TODO: GET /api/author/transactions */
(function () { 'use strict'; if (window.AuthorTransactionsService) return;
  window.AuthorTransactionsService = {
    async list() { return window.AuthorFinance ? window.AuthorFinance.getTransactions() : []; },
    async kpis(l) { return window.AuthorFinance ? window.AuthorFinance.getTransactionKPIs(l) : {}; }
  };
})();
