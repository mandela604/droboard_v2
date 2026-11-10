/**
 * ad-revenue-service.js — Ad Revenue data layer
 * Live API only, no localStorage ledger, no demo seed.
 */
(function () {
  'use strict';

  if (window.AdRevenue && window.AdRevenue.__ready) return;

  var API_BASE = '/api/super-admin/ad-revenue';
  var TIMEOUT_MS = 5000;

  var CONFIG = {
    platformShare: 0.70,
    authorShare: 0.30,
    rates: { impression: 0.005, click: 0.35 },
  };

  async function callApi(path, options) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(API_BASE + (path || ''), Object.assign({ signal: c.signal, credentials: 'include' }, options || {}));
      clearTimeout(t);
      if (!res.ok) throw new Error('API error ' + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  }

  async function getLedger(days) {
    return await callApi('/ledger?days=' + (days || 30));
  }

  async function getSummary(days) {
    return await callApi('/summary?days=' + (days || 30));
  }

  async function record(entry) {
    return await callApi('/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  }

  async function markAuthorPaid(authorId, month) {
    return await callApi('/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorId, month })
    });
  }

  async function isAuthorPaid(authorId, month) {
    try {
      var data = await callApi('/paid-status?authorId=' + encodeURIComponent(authorId) + '&month=' + encodeURIComponent(month));
      return !!data.paid;
    } catch (e) {
      return false;
    }
  }

  window.AdRevenue = {
    __ready: true,
    CONFIG: CONFIG,
    record: record,
    getLedger: getLedger,
    getSummary: getSummary,
    markAuthorPaid: markAuthorPaid,
    isAuthorPaid: isAuthorPaid,
  };
})();
