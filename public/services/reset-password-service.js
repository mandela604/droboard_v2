/**
 * reset-password-service.js — Page logic for reset-password.html
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
  function getToken() {
    try { return new URLSearchParams(location.search).get('token') || ''; } catch (e) { return ''; }
  }
  function showInvalid() {
    el('resetCard').style.display = 'none';
    el('invalidCard').style.display = 'block';
  }
  function showSuccess() {
    el('resetCard').style.display = 'none';
    el('successCard').style.display = 'block';
  }

  // Validate token on load — invalid or missing token shows the error card immediately
  (function validateToken() {
    const token = getToken();
    if (!token) { showInvalid(); return; }
    fetch(API + '/auth/reset-password/validate?token=' + encodeURIComponent(token), {
      credentials: 'same-origin',
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, status: r.status, body };
        });
      })
      .then(function (r) {
        if (!r.ok || (r.body && r.body.valid === false)) showInvalid();
      })
      .catch(function () {
        // Network failure on validation — show error so user requests a fresh link
        showInvalid();
      });
  })();

  // Password visibility toggles
  document.querySelectorAll('.pw-eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const inp = el(btn.dataset.target);
      const isPw = inp.type === 'password';
      inp.type = isPw ? 'text' : 'password';
      btn.querySelector('i').className = isPw ? 'far fa-eye-slash' : 'far fa-eye';
    });
  });

  // Live password match indicator
  function checkMatch() {
    const pass = el('passInput').value;
    const conf = el('confirmInput').value;
    const hint = el('pwMatch');
    if (!conf) { hint.style.display = 'none'; return false; }
    hint.style.display = 'block';
    if (pass === conf) { hint.textContent = '✓ Passwords match'; hint.className = 'pw-match ok'; return true; }
    hint.textContent = '✗ Passwords do not match'; hint.className = 'pw-match bad'; return false;
  }
  el('passInput').addEventListener('input', checkMatch);
  el('confirmInput').addEventListener('input', checkMatch);

  el('resetBtn').addEventListener('click', function () {
    const btn = this;
    const token = getToken();
    const pass = el('passInput').value;
    const conf = el('confirmInput').value;
    if (!token) { showInvalid(); return; }
    if (pass.length < 8) { toast('Password must be at least 8 characters.'); return; }
    if (pass !== conf) { toast('Passwords do not match.'); return; }
    setLoading(btn, true);
    fetch(API + '/auth/reset-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: pass }),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, status: r.status, body };
        });
      })
      .then(function (r) {
        if (r.ok) { showSuccess(); return; }
        if (r.status === 400 || r.status === 404) { showInvalid(); return; }
        if (r.status === 429) { toast('Too many attempts. Wait a few minutes and try again.'); return; }
        if (r.status >= 500) { toast('Something went wrong on our side. Please try again.'); return; }
        toast('We couldn\'t reset your password. Please try again.');
      })
      .catch(function () { toast('Can\'t reach Droboard. Check your connection and try again.'); })
      .finally(function () { setLoading(btn, false); });
  });
})();
