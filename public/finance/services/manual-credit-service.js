/* manual-credit-service.js — staff-only recovery UI.
 * Writes only through POST /api/finance/manual-credit (audited + idempotent).
 */
(function () {
  'use strict';
  if (window.ManualCreditService) return;
  const API = (window.DROBOARD_API_BASE || '/api/finance');
  let selected = null, timer = null;

  function toast(msg) {
    const el = document.getElementById('mcToast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  async function api(path, opts) {
    const res = await fetch(API + path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {}));
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || ('Request failed: ' + res.status));
    return body;
  }

  function refreshSubmit() {
    const coins = Number(document.getElementById('mcCoins').value);
    const reason = document.getElementById('mcReason').value.trim();
    const ok = !!selected && coins > 0 && reason.length >= 5 && document.getElementById('mcConfirm').checked;
    document.getElementById('mcSubmit').disabled = !ok;
  }

  async function searchUsers() {
    const q = document.getElementById('mcSearch').value.trim();
    const box = document.getElementById('mcUsers');
    if (q.length < 2) { box.innerHTML = ''; return; }
    try {
      const rows = await api('/users/search?q=' + encodeURIComponent(q));
      box.innerHTML = rows.length ? rows.map(u =>
        '<div class="user-row" data-id="' + esc(u.id) + '" data-name="' + esc(u.name || u.username) + '">'
        + '<span>' + esc(u.name || u.username) + '</span><small>' + esc(u.email || u.username) + '</small></div>'
      ).join('') : '<div class="user-row"><small>No matching reader</small></div>';
      box.querySelectorAll('.user-row[data-id]').forEach(row => row.addEventListener('click', () => {
        selected = { id: row.dataset.id, name: row.dataset.name };
        box.querySelectorAll('.user-row').forEach(x => x.classList.toggle('sel', x === row));
        const p = document.getElementById('mcPicked');
        p.style.display = 'block';
        p.textContent = 'Selected: ' + selected.name + ' (' + selected.id + ')';
        refreshSubmit();
      }));
    } catch (e) {
      box.innerHTML = '<div class="user-row"><small>' + esc(e.message) + '</small></div>';
    }
  }

  async function submit() {
    if (!selected) return;
    const btn = document.getElementById('mcSubmit');
    btn.disabled = true; btn.textContent = 'Crediting…';
    try {
      const body = {
        userId: selected.id,
        coins: Number(document.getElementById('mcCoins').value),
        reason: document.getElementById('mcReason').value.trim(),
      };
      const ref = document.getElementById('mcRef').value.trim();
      if (ref) body.reference = ref;
      const out = await api('/manual-credit', { method: 'POST', body: JSON.stringify(body) });
      toast(out.duplicate ? 'Already credited — no duplicate added. Balance: ' + out.balance + ' coins'
        : '✅ ' + out.coins + ' coins credited to ' + (out.user || selected.name) + '. Balance: ' + out.balance);
      document.getElementById('mcReason').value = '';
      document.getElementById('mcConfirm').checked = false;
      await recent();
    } catch (e) {
      toast('Failed — ' + e.message);
    } finally {
      btn.textContent = 'Credit coins';
      refreshSubmit();
    }
  }

  async function recent() {
    const box = document.getElementById('mcRecent');
    try {
      const rows = await api('/payment-activity?channel=manual&limit=50');
      box.innerHTML = rows.length ? rows.map(r =>
        '<div class="list-row"><b>+' + Number(r.coins || 0).toLocaleString('en-US') + ' coins</b> · ' + esc(r.user || r.userId)
        + '<br><small>' + esc(r.note || '') + '</small><br><small class="ref">' + esc(r.storeRef) + '</small></div>'
      ).join('') : '<div class="note">No manual credits yet.</div>';
    } catch (e) {
      box.innerHTML = '<div class="note">Could not load recent credits — ' + esc(e.message) + '</div>';
    }
  }

  async function init() {
    if (window.FinanceSidebar && FinanceSidebar.attach) {
      FinanceSidebar.attach('#pageRoot', {
        activeItem: 'manual-credit', title: 'Manual Credit',
        subtitle: 'Audited recovery for verified missed payments',
        user: { name: 'Finance', role: 'Staff', avatar: 'https://i.pravatar.cc/60?img=12' },
        notifCount: 0, searchPlaceholder: 'Search…',
      });
    }
    const s = document.getElementById('mcSearch');
    let st = null;
    s.addEventListener('input', () => { clearTimeout(st); st = setTimeout(searchUsers, 300); });
    ['mcCoins', 'mcReason', 'mcConfirm'].forEach(id => {
      document.getElementById(id).addEventListener('input', refreshSubmit);
      document.getElementById(id).addEventListener('change', refreshSubmit);
    });
    document.getElementById('mcSubmit').addEventListener('click', submit);
    await recent();
  }

  window.ManualCreditService = { init, toast };
  document.addEventListener('DOMContentLoaded', init);
})();
