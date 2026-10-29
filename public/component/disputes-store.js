/**
 * disputes-store.js — shared payment-dispute store.
 * ──────────────────────────────────────────────────────────────
 * Readers (store purchases, tips), authors (transaction history) and
 * finance staff (Payment Disputes page) all read/write this one list.
 *
 * Local key: dro_payment_disputes (what the demo experience runs on).
 * Live: add() posts to /api/finance/disputes — the same PaymentDispute
 * collection the finance console lists — and sync() pulls the filer's own
 * rows back so the reader/author side shows the real status. Both are
 * best-effort: with no backend the local list behaves exactly as before.
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
    postRemote(d);
    return d;
  }

  // The report is the same record on both sides, so the local row is replaced
  // by the server id once it lands — that is the id finance acts on.
  function postRemote(d) {
    try {
      fetch('/api/finance/disputes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: d.reason, role: d.role, item: d.item,
          amount: Number(d.amount) || 0, transactionId: String(d.txnId || '').slice(0, 40),
        }),
      }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (j) {
        if (j && j.id) patch(d.id, { id: String(j.id), status: j.status || 'open', remote: true });
      }).catch(function () {});
    } catch (e) {}
  }

  // Pull this account's disputes from the server and refresh their status here.
  function sync() {
    return fetch('/api/finance/disputes', { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return read();
        var list = read();
        rows.forEach(function (r) {
          var local = list.find(function (x) { return x.id === String(r.id) || (r.transactionId && x.txnId === r.transactionId); });
          var shape = {
            id: String(r.id), who: r.who || (local && local.who) || 'Reader', role: r.role || 'reader',
            amount: Number(r.amount) || 0, reason: r.reason || '', item: r.item || '',
            txnId: r.transactionId || (local && local.txnId) || '', status: r.status || 'open',
            filed: r.createdAt || (local && local.filed) || new Date().toISOString(),
            resolutionNote: r.resolutionNote || '', replies: r.replies || [],
          };
          if (local) Object.assign(local, shape); else list.unshift(shape);
        });
        write(list);
        return list;
      })
      .catch(function () { return read(); });
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
    sync: sync,
    mine: function (who) { return read().filter(function (d) { return d.who === who; }); },
  };
  // Fire-and-forget: pages that already render from the local list pick the
  // real statuses up on the droboard:disputes event.
  try { if (window.fetch) sync(); } catch (e) {}
})();
