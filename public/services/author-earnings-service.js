/**
 * author-earnings-service.js — Shared data layer for author finance pages.
 * ─────────────────────────────────────────────────────────────────────────
 * Earnings, transactions, payment methods, withdrawals, disputes.
 * Set USE_API = true to switch to backend.
 */
(function () {
  'use strict';
  if (window.__authorFinanceService) return;
  window.__authorFinanceService = true;

  const USE_API = true;
  const API_BASE = '/api/author/finance';
  const TIMEOUT_MS = 2500;
  /* Demo author identity — matches AdRevenue.STORIES book authors. */
  const CURRENT_AUTHOR_ID = 'au_luna_vale';

  /* ── helpers ── */
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 150 + Math.random() * 150)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* Author earnings settle in dollars, so this page never restates into the
     admin-set staff currency — dollars() is the fixed-USD formatter. The sign
     is kept out of the formatter so a debit still reads as negative. */
  function fmtCurrency(n) {
    const v = Number(n) || 0;
    const s = (window.DroboardCurrency && DroboardCurrency.dollars)
      ? DroboardCurrency.dollars(Math.abs(v))
      : '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0 });
    return (v < 0 ? '-' : '') + s;
  }
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function timeAgo(d) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return fmtDate(d);
  }
  function uid() { return 'TXN-' + Math.floor(Math.random() * 90000 + 10000); }

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal, credentials: 'include' }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  /* ── demo data from central ── */
  function getDemo() {
    const D = {};
    return {
      earnings: clone(D.AUTHOR_EARNINGS || { balance: 0, pending: 0, lifetime: 0, thisMonth: 0, lastMonth: 0, byBook: [], monthlyHistory: [] }),
      transactions: clone(D.AUTHOR_TRANSACTIONS || []),
      methods: clone(D.AUTHOR_PAYMENT_METHODS || []),
      withdrawals: clone(D.AUTHOR_WITHDRAWALS || []),
      disputes: clone(D.AUTHOR_DISPUTES || []),
      minWithdrawal: D.WITHDRAWAL_MIN || 100,
    };
  }

  /* Payment methods are edited by the author in Payment Details; the finance
     staff's withdrawal modal reads the same list, so persist across pages. */
  const PM_KEY = 'dro_author_payment_methods';
  function loadMethods() {
    try {
      const stored = JSON.parse(localStorage.getItem(PM_KEY) || 'null');
      if (Array.isArray(stored) && stored.length) return stored;
    } catch (e) {}
    return getDemo().methods;
  }
  function saveMethods(list) {
    try { localStorage.setItem(PM_KEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }

  /* ══════════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════════ */
  window.AuthorFinance = {

    /* ── Earnings ── */
    async getEarnings() {
      return await callBackend('/earnings');
    },

    /* ── Transactions ── */
    async getTransactions() {
      return await callBackend('/transactions');
    },

    async getTransactionKPIs(list) {
      let totalIncome = 0, totalWithdrawn = 0, totalBonuses = 0;
      list.forEach(t => {
        if (t.status !== 'completed') return;
        if (t.type === 'earned') totalIncome += t.amount;
        else if (t.type === 'withdrawal') totalWithdrawn += Math.abs(t.amount);
        else if (t.type === 'bonus') totalBonuses += t.amount;
      });
      return { totalIncome, totalWithdrawn, totalBonuses, count: list.length };
    },

    /* ── Payment Methods ── */
    async getPaymentMethods() {
      return await callBackend('/payment-methods');
    },

    async addPaymentMethod(data) {
      return await callBackend('/payment-methods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    },

    async deletePaymentMethod(id) {
      return await callBackend('/payment-methods/' + id, { method: 'DELETE' });
    },

    async updatePaymentMethod(id, data) {
      return await callBackend('/payment-methods/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    },

    async setDefaultMethod(id) {
      return await callBackend('/payment-methods/' + id + '/default', { method: 'PUT' });
    },

    /* ── Withdrawals ── */
    async getWithdrawals() {
      return await callBackend('/withdrawals');
    },

    async requestWithdrawal(amount, methodId) {
      return await callBackend('/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, methodId }) });
    },

    /* ── Disputes ── */
    async getDisputes() {
      return await callBackend('/disputes');
    },

    async fileDispute(transactionId, reason) {
      return await callBackend('/disputes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId, reason }) });
    },

    /* ── Helpers ── */
    fmtCurrency,
    fmtDate,
    fmtDateTime,
    timeAgo,
  };
})();
