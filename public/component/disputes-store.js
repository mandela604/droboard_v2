/**
 * disputes-store.js — shared payment-dispute store.
 * ──────────────────────────────────────────────────────────────
 * Readers (store purchases, tips), authors (transaction history) and
 * finance staff (Payment Disputes page) all read/write this one list.
 * Key: dro_payment_disputes · swap the body for an API call when live.
 */
(function () {
  'use strict';
  if (window.DroboardDisputes) return;
  var KEY = 'dro_payment_disputes';

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('droboard:disputes', { detail: list.length })); } catch (e) {}
  }

  function add(rec) {
    var list = read();
    var d = Object.assign({
      id: 'PD-' + String(400 + list.length + 1),
      who: rec.who || 'Reader',
      role: rec.role || 'reader',
      avatar: rec.avatar || 'https://i.pravatar.cc/60?img=12',
      amount: Number(rec.amount) || 0,
      reason: rec.reason || '',
      item: rec.item || '',
      txnId: rec.txnId || '',
      status: 'open',
      filed: new Date().toISOString(),
      resolutionNote: '',
      replies: [],
    }, rec);
    list.unshift(d);
    write(list);
    return d;
  }

  function patch(id, p) {
    var list = read();
    var d = list.find(function (x) { return x.id === id; });
    if (!d) return null;
    Object.assign(d, p);
    write(list);
    return d;
  }

  window.DroboardDisputes = {
    list: read,
    add: add,
    patch: patch,
    mine: function (who) { return read().filter(function (d) { return d.who === who; }); },
  };
})();
