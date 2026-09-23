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

  const USE_API = false;
  const API_BASE = '/api/author/finance';
  const TIMEOUT_MS = 2500;

  /* ── helpers ── */
  function delay(ms) { return new Promise(r => setTimeout(r, ms || 150 + Math.random() * 150)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmtCurrency(n) { return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0 }); }
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
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Bad response: ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  /* ── demo data from central ── */
  function getDemo() {
    const D = window.DemoData || {};
    return {
      earnings: clone(D.AUTHOR_EARNINGS || { balance: 0, pending: 0, lifetime: 0, thisMonth: 0, lastMonth: 0, byBook: [], monthlyHistory: [] }),
      transactions: clone(D.AUTHOR_TRANSACTIONS || []),
      methods: clone(D.AUTHOR_PAYMENT_METHODS || []),
      withdrawals: clone(D.AUTHOR_WITHDRAWALS || []),
      disputes: clone(D.AUTHOR_DISPUTES || []),
      minWithdrawal: D.WITHDRAWAL_MIN || 100,
    };
  }

  /* ══════════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════════ */
  window.AuthorFinance = {

    /* ── Earnings ── */
    async getEarnings() {
      if (USE_API) { try { return await callBackend('/earnings'); } catch (e) { /* fallthrough */ } }
      await delay();
      return getDemo().earnings;
    },

    /* ── Transactions ── */
    async getTransactions() {
      if (USE_API) { try { return await callBackend('/transactions'); } catch (e) { /* fallthrough */ } }
      await delay();
      return getDemo().transactions;
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
      if (USE_API) { try { return await callBackend('/payment-methods'); } catch (e) { /* fallthrough */ } }
      await delay();
      return getDemo().methods;
    },

    async addPaymentMethod(data) {
      if (USE_API) { try { return await callBackend('/payment-methods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch (e) { /* fallthrough */ } }
      await delay(200);
      const demo = getDemo();
      const newMethod = Object.assign({ id: 'PM-' + String(demo.methods.length + 1).padStart(2, '0'), verified: false, isDefault: demo.methods.length === 0 }, data);
      demo.methods.push(newMethod);
      return clone(newMethod);
    },

    async deletePaymentMethod(id) {
      if (USE_API) { try { return await callBackend('/payment-methods/' + id, { method: 'DELETE' }); } catch (e) { /* fallthrough */ } }
      await delay(150);
      const demo = getDemo();
      const idx = demo.methods.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Method not found');
      const wasDefault = demo.methods[idx].isDefault;
      demo.methods.splice(idx, 1);
      if (wasDefault && demo.methods.length > 0) demo.methods[0].isDefault = true;
      return { ok: true };
    },

    async setDefaultMethod(id) {
      if (USE_API) { try { return await callBackend('/payment-methods/' + id + '/default', { method: 'PUT' }); } catch (e) { /* fallthrough */ } }
      await delay(100);
      const demo = getDemo();
      demo.methods.forEach(m => m.isDefault = (m.id === id));
      return { ok: true };
    },

    /* ── Withdrawals ── */
    async getWithdrawals() {
      if (USE_API) { try { return await callBackend('/withdrawals'); } catch (e) { /* fallthrough */ } }
      await delay();
      return getDemo().withdrawals;
    },

    async requestWithdrawal(amount, methodId) {
      if (USE_API) { try { return await callBackend('/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, methodId }) }); } catch (e) { /* fallthrough */ } }
      await delay(250);
      const demo = getDemo();
      const method = demo.methods.find(m => m.id === methodId);
      if (!method) throw new Error('Payment method not found');
      if (amount < demo.minWithdrawal) throw new Error('Minimum withdrawal is $' + demo.minWithdrawal);
      if (amount > demo.earnings.balance) throw new Error('Insufficient balance');
      const accountLabel = method.type === 'bank' ? method.bankName + ' •••• ' + method.accountNumber.slice(-4) :
                           method.type === 'paypal' ? method.email :
                           method.phoneNumber;
      const withdrawal = {
        id: 'WD-' + String(demo.withdrawals.length + 6001).padStart(4, '0'),
        amount: amount,
        method: method.type === 'bank' ? 'Bank Transfer' : method.type === 'paypal' ? 'PayPal' : 'Mobile Money',
        account: accountLabel,
        requested: new Date().toISOString(),
        status: 'pending',
        processed: null,
      };
      demo.withdrawals.unshift(withdrawal);
      demo.earnings.balance -= amount;
      demo.earnings.pending += amount;
      return clone(withdrawal);
    },

    /* ── Disputes ── */
    async getDisputes() {
      if (USE_API) { try { return await callBackend('/disputes'); } catch (e) { /* fallthrough */ } }
      await delay();
      return getDemo().disputes;
    },

    async fileDispute(transactionId, reason) {
      if (USE_API) { try { return await callBackend('/disputes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId, reason }) }); } catch (e) { /* fallthrough */ } }
      await delay(200);
      const demo = getDemo();
      const txn = demo.transactions.find(t => t.id === transactionId);
      const dispute = {
        id: 'DSP-' + String(demo.disputes.length + 1).padStart(3, '0'),
        transactionId: transactionId,
        type: txn ? txn.type : 'other',
        amount: txn ? Math.abs(txn.amount) : 0,
        reason: reason,
        status: 'open',
        filed: new Date().toISOString(),
        resolutionNote: '',
        adminReply: '',
      };
      demo.disputes.unshift(dispute);
      return clone(dispute);
    },

    /* ── Helpers ── */
    fmtCurrency,
    fmtDate,
    fmtDateTime,
    timeAgo,
  };
})();
