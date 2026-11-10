/**
 * finance-data.js — Data layer for Finance pages.
 * All methods call /api/finance directly. Errors propagate to the caller.
 */
(function () {
  'use strict';
  if (window.__financeData) return;
  window.__financeData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/finance';
  const TIMEOUT_MS = 8000;

  async function api(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal, credentials: 'include' }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.status === 204 ? null : await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  function post(path, body) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function put(path, body) {
    return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function del(path) {
    return api(path, { method: 'DELETE' });
  }

  window.FinanceData = {
    getDashboard()                         { return api('/dashboard'); },

    getWithdrawals()                       { return api('/withdrawals'); },
    approveWithdrawal(id)                  { return post('/withdrawals/' + id + '/approve'); },
    declineWithdrawal(id, reason)          { return post('/withdrawals/' + id + '/decline', { reason }); },

    getAuthorPayments()                    { return api('/author-payments'); },
    getPaymentHistory()                    { return api('/payment-history'); },
    schedulePayout(authorId, amount, date) { return post('/author-payments/' + authorId + '/schedule', { amount, date }); },
    processPayment(authorId)               { return post('/author-payments/' + authorId + '/process'); },

    getCoinTransactions()                  { return api('/coin-transactions'); },

    getBonuses()                           { return api('/bonuses'); },
    createBonus(payload)                   { return post('/bonuses', payload); },
    updateBonus(id, payload)               { return put('/bonuses/' + id, payload); },
    deleteBonus(id)                        { return del('/bonuses/' + id); },
    distributeBonus(id)                    { return post('/bonuses/' + id + '/distribute'); },

    getPaymentDisputes()                   { return api('/payment-disputes'); },
    resolveDispute(id, note)               { return post('/payment-disputes/' + id + '/resolve', { note }); },
    rejectDispute(id, note)                { return post('/payment-disputes/' + id + '/reject', { note }); },
    replyToDispute(id, message)            { return post('/payment-disputes/' + id + '/reply', { message }); },

    getFinancialReports()                  { return api('/financial-reports'); },

    getTaxDocuments()                      { return api('/tax-documents'); },
    generateTaxDocument(payload)           { return post('/tax-documents', payload); },

    /* ── Store settings ── */
    getCoinPacks()  { return api('/store/coin-packs').then(d => Array.isArray(d) ? d : d.packs); },
    saveCoinPack(p) { return post('/store/coin-packs', p); },
    deleteCoinPack(id) { return del('/store/coin-packs/' + encodeURIComponent(id)); },

    getAdRewards()   { return api('/store/ad-rewards').then(d => Array.isArray(d) ? d : d.rewards); },
    saveAdReward(r)  { return post('/store/ad-rewards', r); },
    deleteAdReward(id) { return del('/store/ad-rewards/' + encodeURIComponent(id)); },

    getBundles()     { return api('/store/bundles').then(d => Array.isArray(d) ? d : d.bundles); },
    saveBundle(b)    { return post('/store/bundles', b); },
    deleteBundle(id) { return del('/store/bundles/' + encodeURIComponent(id)); },
  };
})();
