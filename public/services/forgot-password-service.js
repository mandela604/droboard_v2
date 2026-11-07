/**
 * forgot-password-service.js — Page logic for forgot-password.html
 * Production: real API only, real errors shown, no demo fallbacks.
 */
(function () {
  'use strict';

  const API = '/api';

  function el(id) { return document.getElementById(id); }
  function setLoading(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
    else { btn.disabled = false; if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
  }
  function toast(m) {
    const t = el('toast'); if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function showError(msg) {
    toast(msg);
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  let lastEmail = '';

  function sendReset(email) {
    const btn = el('sendBtn');
    setLoading(btn, true);
    fetch(API + '/auth/forgot-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, status: r.status, body };
        });
      })
      .then(function (r) {
        if (r.ok) {
          lastEmail = email;
          showSuccess(email);
          return;
        }
        if (r.status === 429) { showError('Too many attempts. Wait a few minutes and try again.'); return; }
        if (r.status === 400) { showError('Enter a valid email address.'); return; }
        if (r.status >= 500) { showError('Something went wrong on our side. Please try again.'); return; }
        showError('We couldn\'t send the reset link. Please try again.');
      })
      .catch(function () { showError('Can\'t reach Droboard. Check your connection and try again.'); })
      .finally(function () { setLoading(btn, false); });
  }

  function showSuccess(email) {
    el('forgotCard').style.display = 'none';
    el('successCard').style.display = 'block';
    el('successMsg').textContent = 'If an account exists for ' + email + ', a reset link is on its way. It expires in 30 minutes.';
  }

  el('sendBtn').addEventListener('click', function () {
    const email = el('emailInput').value.trim();
    if (!email) { showError('Enter your email address.'); return; }
    if (!isEmail(email)) { showError('Enter a valid email address.'); return; }
    sendReset(email);
  });

  el('emailInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') el('sendBtn').click();
  });

  el('resendBtn').addEventListener('click', function () {
    const email = lastEmail || el('emailInput').value.trim();
    if (email && isEmail(email)) sendReset(email);
  });

  // Prefill when coming from login (?email=…)
  try {
    const q = new URLSearchParams(location.search).get('email') || '';
    if (q) el('emailInput').value = q;
  } catch (e) {}
})();
