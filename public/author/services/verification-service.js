/**
 * verification-service.js — writer identity badge on the Author Center.
 * Reads GET /api/author/verification, submits the shared KycForm (multipart).
 * Demo fallback: keeps the status in localStorage when USE_API is off.
 */
(function () {
  'use strict';
  if (window.VerificationService) return;

  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  var DEMO_KEY = 'droWriterVerification';
  var state = { status: 'none', kycType: null };
  var mounted = false;

  function toast(m) {
    if (window.AuthorDrawer && window.AuthorDrawer.toast) return window.AuthorDrawer.toast(m);
  }

  function loadDemo() {
    try {
      var s = localStorage.getItem(DEMO_KEY);
      if (s) state = JSON.parse(s);
    } catch (e) {}
  }

  function saveDemo() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify({ status: state.status, kycType: state.kycType })); } catch (e) {}
  }

  function checkStatus() {
    if (!CFG.USE_API) { loadDemo(); return Promise.resolve(state); }
    return fetch(CFG.API_BASE + '/verification', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { if (v && v.status) state = v; return state; })
      .catch(function () { return state; });
  }

  function render() {
    var card = document.getElementById('verifyCard');
    if (!card) return;
    var html = '';
    if (state.status === 'approved') {
      html = '<div class="verify-row">'
        + '<div class="verify-badge ok"><i class="fas fa-shield-halved"></i></div>'
        + '<div class="verify-copy"><div class="verify-title">Verified writer</div>'
        + '<div class="verify-sub">Your identity is confirmed. Contracts sign without re-uploading documents.</div></div>'
        + '<span class="verify-pill ok">Verified</span>'
        + '</div>';
    } else if (state.status === 'pending') {
      html = '<div class="verify-row">'
        + '<div class="verify-badge wait"><i class="fas fa-hourglass-half"></i></div>'
        + '<div class="verify-copy"><div class="verify-title">Verification in review</div>'
        + '<div class="verify-sub">Our editors are checking your ID. You can keep writing meanwhile.</div></div>'
        + '<span class="verify-pill wait">Pending</span>'
        + '</div>';
    } else {
      var rejected = state.status === 'rejected';
      html = '<div class="verify-row">'
        + '<div class="verify-badge"><i class="fas fa-id-card"></i></div>'
        + '<div class="verify-copy"><div class="verify-title">' + (rejected ? 'Verification rejected' : 'Get verified') + '</div>'
        + '<div class="verify-sub">' + (rejected ? 'Resubmit clear front and back photos of your ID.' : 'Confirm your identity to earn the verified badge — it also unlocks contract signing.') + '</div></div>'
        + '<button class="verify-btn" id="verifyOpenBtn" type="button">' + (rejected ? 'Resubmit' : 'Verify') + '</button>'
        + '</div>';
    }
    card.innerHTML = html;
    var btn = document.getElementById('verifyOpenBtn');
    if (btn) btn.addEventListener('click', open);
  }

  function open() {
    var ov = document.getElementById('verifyOverlay');
    if (!ov) return;
    if (!mounted) {
      KycForm.mount(document.getElementById('verifyMount'), {
        submitLabel: 'Submit for verification',
        backLabel: 'Cancel',
        onSubmit: submit,
        onBack: close,
      });
      mounted = true;
    } else {
      KycForm.reset();
      KycForm.showError('');
    }
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    var ov = document.getElementById('verifyOverlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }

  function finish(out, kycType) {
    state = { status: (out && out.status) || 'pending', kycType: kycType || null };
    if (!CFG.USE_API) saveDemo();
    KycForm.setBusy(false);
    close();
    render();
    toast(state.status === 'approved' ? 'You are already verified.' : 'Verification submitted — our editors will review it.');
  }

  function submit() {
    var v = KycForm.read();
    if (v.err) { KycForm.showError(v.err); return; }
    KycForm.showError('');
    KycForm.setBusy(true);
    var files = KycForm.files();

    if (!CFG.USE_API) {
      setTimeout(function () { finish({ status: 'pending' }, v.kyc.type); }, 700);
      return;
    }
    var fd = new FormData();
    fd.append('data', JSON.stringify({ kyc: v.kyc }));
    fd.append('idFront', files.front, files.front.name);
    if (files.back) fd.append('idBack', files.back, files.back.name);
    fetch(CFG.API_BASE + '/verification', { method: 'POST', credentials: 'include', body: fd })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw body;
          return body;
        });
      })
      .then(function (out) { finish(out, v.kyc.type); })
      .catch(function (e) {
        KycForm.setBusy(false);
        KycForm.showError((e && e.error) || 'Could not submit. Try again.');
      });
  }

  function init() {
    var closeBtn = document.getElementById('verifyClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var ov = document.getElementById('verifyOverlay');
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    checkStatus().then(function () {
      render();
      /* The card is built after first paint, so the browser's own anchor jump
         lands on an empty slot — scroll again once the row actually exists. */
      if (location.hash === '#verification') {
        var el = document.getElementById('verification');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  window.VerificationService = { init: init, open: open, current: function () { return state; } };
})();
