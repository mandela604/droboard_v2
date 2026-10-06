/** withdrawal-request-service.js — wrapper. TODO: POST /api/author/withdrawals */
(function () { 'use strict'; if (window.AuthorWithdrawalService) return;
  window.AuthorWithdrawalService = {
    async list() { return window.AuthorFinance ? window.AuthorFinance.getWithdrawals() : []; },
    async methods() { return window.AuthorFinance ? window.AuthorFinance.getPaymentMethods() : []; },
    async request(a, m) { return window.AuthorFinance ? window.AuthorFinance.requestWithdrawal(a, m) : { id: 'WD-new' }; }
  };
})();
