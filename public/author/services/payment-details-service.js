/** payment-details-service.js — wrapper. TODO: GET /api/author/payment-methods */
(function () { 'use strict'; if (window.AuthorPaymentService) return;
  window.AuthorPaymentService = {
    async list() { return window.AuthorFinance ? window.AuthorFinance.getPaymentMethods() : []; },
    async add(d) { return window.AuthorFinance ? window.AuthorFinance.addPaymentMethod(d) : d; },
    async remove(id) { return window.AuthorFinance ? window.AuthorFinance.deletePaymentMethod(id) : { ok: true }; },
    async setDefault(id) { return window.AuthorFinance ? window.AuthorFinance.setDefaultMethod(id) : { ok: true }; }
  };
})();
