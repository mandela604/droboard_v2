/* payment-activity-service.js — read-only finance audit surface.
 * Reads GET /api/finance/payment-activity. Never posts or mutates anything.
 */
(function () {
  'use strict';
  if (window.PaymentActivityService) return;
  const API = (window.DROBOARD_API_BASE || '/api/finance');
  let timer = null;

  function toast(msg) {
    const el = document.getElementById('paToast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n, cur) {
    const v = Number(n) || 0;
    return String(cur || 'NGN').toUpperCase() === 'USD' ? '$' + v.toFixed(2) : '₦' + v.toLocaleString('en-US');
  }
  function date(iso) {
    const d = new Date(iso);
    return isNaN(d) ? String(iso || '') : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  async function load() {
    const box = document.getElementById('paTable');
    const q = (document.getElementById('paSearch').value || '').trim();
    const channel = document.getElementById('paChannel').value;
    const limit = document.getElementById('paLimit').value;
    box.innerHTML = '<div class="empty"><i class="fas fa-spinner fa-spin"></i> Loading activity…</div>';
    try {
      const url = API + '/payment-activity?q=' + encodeURIComponent(q) + '&channel=' + encodeURIComponent(channel) + '&limit=' + encodeURIComponent(limit);
      const res = await fetch(url, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || ('Request failed: ' + res.status));
      render(Array.isArray(body) ? body : []);
    } catch (e) {
      box.innerHTML = '<div class="empty">Could not load activity — ' + esc(e.message) + '</div>';
    }
  }

  function render(rows) {
    const box = document.getElementById('paTable');
    if (!rows.length) { box.innerHTML = '<div class="empty">No coin activity found.</div>'; return; }
    box.innerHTML = '<table><thead><tr><th>Date</th><th>User</th><th>Type</th><th>Channel</th><th>Coins</th><th>Paid</th><th>Reference</th><th>Status</th></tr></thead><tbody>'
      + rows.map(r => {
        const legs = (r.legs || []).map(l => esc(l.debit) + ' → ' + esc(l.credit) + ' · ' + money(l.amount, 'NGN') + (l.coins ? ' / ' + l.coins + ' coins' : '')).join('<br>');
        return '<tr>'
          + '<td>' + esc(date(r.date)) + '</td>'
          + '<td>' + esc(r.user || r.userId) + '<div class="legs">' + esc(r.note || '') + '</div></td>'
          + '<td>' + esc(r.type) + '</td>'
          + '<td>' + esc(r.channel) + '</td>'
          + '<td class="pos">+' + Number(r.coins || 0).toLocaleString('en-US') + '</td>'
          + '<td>' + money(r.fiatAmount, r.fiatCurrency) + '<div class="legs">fee ' + money(r.fee, r.fiatCurrency) + ' · net ' + money(r.net, r.fiatCurrency) + '</div></td>'
          + '<td><span class="ref">' + esc(r.storeRef || '—') + '</span>' + (legs ? '<div class="legs">' + legs + '</div>' : '') + '</td>'
          + '<td><span class="chip">' + esc(r.status) + '</span></td>'
          + '</tr>';
      }).join('') + '</tbody></table>';
  }

  async function init() {
    if (window.FinanceSidebar && FinanceSidebar.attach) {
      FinanceSidebar.attach('#pageRoot', {
        activeItem: 'payment-activity', title: 'Payment Activity',
        subtitle: 'Every coin credit and its ledger legs',
        user: { name: 'Finance', role: 'Staff', avatar: 'https://i.pravatar.cc/60?img=12' },
        notifCount: 0, searchPlaceholder: 'Search activity…',
      });
    }
    const s = document.getElementById('paSearch');
    let st = null;
    s.addEventListener('input', () => { clearTimeout(st); st = setTimeout(load, 300); });
    document.getElementById('paChannel').addEventListener('change', load);
    document.getElementById('paLimit').addEventListener('change', load);
    await load();
  }

  window.PaymentActivityService = { init, toast };
  document.addEventListener('DOMContentLoaded', init);
})();
