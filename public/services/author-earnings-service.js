/**
 * author-earnings-service.js — shared finance data layer for the author money
 * pages (earnings, transaction history, payment details, withdrawals).
 *
 * Every method talks to the real API and throws on a non-2xx response, so a
 * page can render an error + retry instead of inventing numbers. There is no
 * demo data and no local-storage fallback: if the request fails, the page says
 * so.
 */
(function () {
  'use strict';
  if (window.AuthorFinance && window.AuthorFinance.__real) return;

  var API_BASE = '/api/finance';
  var AUTHOR_BASE = '/api/author';
  var TIMEOUT_MS = 12000;

  /* ── helpers ── */
  /* Author earnings settle in dollars, so this page never restates into the
     admin-set staff currency — dollars() is the fixed-USD formatter. The sign
     is kept out of the formatter so a debit still reads as negative. */
  function fmtCurrency(n) {
    var v = Number(n) || 0;
    var s = (window.DroboardCurrency && DroboardCurrency.dollars)
      ? DroboardCurrency.dollars(Math.abs(v))
      : '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-' : '') + s;
  }
  function fmtDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function timeAgo(d) {
    if (!d) return '—';
    var diff = Date.now() - new Date(d).getTime();
    if (isNaN(diff)) return '—';
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return fmtDate(d);
  }

  async function call(url, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    var init = Object.assign({ credentials: 'include', signal: controller.signal }, opts);
    if (init.body && typeof init.body !== 'string') {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    var res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? 'Request timed out' : 'Network error');
    }
    clearTimeout(timer);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
      var err = new Error(String(msg).replace(/_/g, ' '));
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  /* Author book metadata, used to annotate earnings/transaction rows with the
     book title and chapter/read counts. Cached for the page lifetime. */
  var booksPromise = null;
  function authorBooks() {
    if (!booksPromise) {
      booksPromise = call(AUTHOR_BASE + '/books').catch(function () { return []; });
    }
    return booksPromise;
  }
  function bookMap(list) {
    var map = {};
    (list || []).forEach(function (b) { map[String(b.id)] = b; });
    return map;
  }

  /* ── page-level error surface ── */
  function pageError(message, retry) {
    var el = document.getElementById('afErrorBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'afErrorBanner';
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:sticky;top:0;z-index:80;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 14px;background:#fdecec;color:#b3261e;font-size:12.5px;font-weight:700;border-bottom:1px solid #f3c0c0';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML = '<i class="fas fa-triangle-exclamation"></i><span></span>';
    el.querySelector('span').textContent = message || 'Something went wrong.';
    if (typeof retry === 'function') {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Retry';
      btn.style.cssText = 'margin-left:6px;padding:4px 12px;border-radius:999px;border:1px solid #b3261e;background:#fff;color:#b3261e;font-weight:700;font-size:12px;cursor:pointer';
      btn.addEventListener('click', function () { clearPageError(); retry(); });
      el.appendChild(btn);
    }
    return el;
  }
  function clearPageError() {
    var el = document.getElementById('afErrorBanner');
    if (el) el.remove();
  }
  function failText(what, err) {
    return 'Could not load ' + what + '. ' + ((err && err.message) ? err.message : 'Please try again.');
  }

  /* Put the signed-in author's real avatar/name in the page header instead of
     a stock portrait. Falls back to the app icon when no avatar is set. */
  function mountIdentity() {
    var acc = (window.AuthSession && AuthSession.getSync) ? AuthSession.getSync() : null;
    var name = (acc && acc.name) || 'Author';
    var avatar = (acc && acc.avatar) || '../assets/droboard-icon.png';
    var imgs = document.querySelectorAll('.avatar-btn img, .profile-avatar img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = avatar;
      imgs[i].alt = name;
      imgs[i].onerror = function () { this.onerror = null; this.src = '../assets/droboard-icon.png'; };
    }
  }

  /* ══════════════════════════════════════════════════════════════
     API
     ══════════════════════════════════════════════════════════════ */
  window.AuthorFinance = {
    __real: true,

    /* ── Earnings ── */
    async getEarnings() {
      var results = await Promise.all([call(API_BASE + '/earnings'), authorBooks()]);
      var data = results[0] || {};
      var meta = bookMap(results[1]);
      var byBook = (data.byBook || []).map(function (b) {
        var m = meta[String(b.id)] || {};
        return Object.assign({}, b, {
          title: b.title || m.title || 'Untitled',
          cover: b.cover || m.cover || '',
          genre: m.genre || '',
          status: m.status || '',
          chapters: m.chapterCount != null ? m.chapterCount : 0,
          reads: m.reads != null ? m.reads : 0,
        });
      });
      return Object.assign({}, data, {
        balance: Number(data.balance) || 0,
        lifetime: Number(data.lifetime) || 0,
        thisMonth: Number(data.thisMonth) || 0,
        lastMonth: Number(data.lastMonth) || 0,
        pending: Number(data.pending) || 0,
        minWithdrawal: 100,
        byBook: byBook,
      });
    },

    /* ── Transactions ── */
    async getTransactions() {
      var results = await Promise.all([call(API_BASE + '/transactions'), authorBooks()]);
      var rows = results[0] || [];
      var meta = bookMap(results[1]);
      return rows.map(function (t) {
        var m = t.bookId ? meta[String(t.bookId)] : null;
        return {
          id: t.id,
          rawId: t.id,
          transactionId: t.id,
          type: t.type,
          desc: t.desc || 'Transaction',
          book: m ? m.title : '',
          bookId: t.bookId || '',
          amount: Number(t.amount) || 0,
          date: t.createdAt || t.updatedAt || null,
          status: t.status || 'pending',
        };
      });
    },

    async getTransactionKPIs(list) {
      var totalIncome = 0, totalWithdrawn = 0, totalBonuses = 0;
      (list || []).forEach(function (t) {
        if (t.status !== 'completed') return;
        if (t.type === 'earned') totalIncome += t.amount;
        else if (t.type === 'withdrawal') totalWithdrawn += Math.abs(t.amount);
        else if (t.type === 'bonus') totalBonuses += t.amount;
      });
      return { totalIncome: totalIncome, totalWithdrawn: totalWithdrawn, totalBonuses: totalBonuses, count: (list || []).length };
    },

    /* ── Payment Methods ── */
    async getPaymentMethods() {
      var rows = await call(API_BASE + '/payment-methods');
      return (rows || []).map(function (m) {
        return Object.assign({}, m, {
          accountNumber: m.accountNumber || m.accountNumberMasked || '',
          verified: !!m.verified,
        });
      });
    },

    async getPaymentMethod(id) {
      return await call(API_BASE + '/payment-methods/' + encodeURIComponent(id));
    },

    async addPaymentMethod(data) {
      return await call(API_BASE + '/payment-methods', { method: 'POST', body: data });
    },

    async deletePaymentMethod(id) {
      return await call(API_BASE + '/payment-methods/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    async updatePaymentMethod(id, data) {
      return await call(API_BASE + '/payment-methods/' + encodeURIComponent(id), { method: 'PUT', body: data });
    },

    async setDefaultMethod(id) {
      return await call(API_BASE + '/payment-methods/' + encodeURIComponent(id) + '/default', { method: 'PUT' });
    },

    /* ── Withdrawals ── */
    async getWithdrawals() {
      var rows = await call(API_BASE + '/withdrawals');
      return (rows || []).map(function (w) {
        return Object.assign({}, w, {
          date: w.requested || w.createdAt || null,
          requested: w.requested || w.createdAt || null,
        });
      });
    },

    async requestWithdrawal(amount, methodId) {
      return await call(API_BASE + '/withdrawals', { method: 'POST', body: { amount: amount, methodId: methodId } });
    },

    /* ── Disputes ── */
    async getDisputes() {
      return await call(API_BASE + '/disputes');
    },

    async fileDispute(transactionId, reason, extra) {
      return await call(API_BASE + '/disputes', {
        method: 'POST',
        body: Object.assign({ transactionId: transactionId, reason: reason, role: 'author' }, extra || {}),
      });
    },

    /* ── UI helpers ── */
    pageError: pageError,
    clearPageError: clearPageError,
    failText: failText,
    mountIdentity: mountIdentity,
    fmtCurrency: fmtCurrency,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    timeAgo: timeAgo,
  };
})();
