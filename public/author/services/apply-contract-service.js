/** apply-contract-service.js — owns data + render + bindings for apply-contract.html. Uses /api/author/contracts. */
(function () { 'use strict';
  if (window.ApplyContractService && window.ApplyContractService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  function coverOf(b) { return (b && b.cover) || '../assets/droboard-icon.png'; }

  function getTag(status) {
    if (status === 'contracted') return '<span class="status-tag tag-contracted"><i class="fas fa-check-circle"></i> Contracted</span>';
    if (status === 'applied') return '<span class="status-tag tag-pending"><i class="fas fa-clock"></i> Pending</span>';
    if (status === 'review') return '<span class="status-tag tag-review"><i class="fas fa-hourglass-half"></i> Review</span>';
    return '<span class="status-tag"><i class="fas fa-file-lines"></i> Available</span>';
  }

  var api = window.ApplyContractService || {};

  api.list = api.list || async function () {
    var r = await fetch(CFG.API_BASE + '/contracts', { credentials: 'include' });
    if (!r.ok) throw new Error('Contracts API failed: ' + r.status);
    return await r.json();
  };

  api.verification = api.verification || async function () {
    var r = await fetch(CFG.API_BASE + '/verification', { credentials: 'include' });
    if (!r.ok) return { status: 'none' };
    return await r.json();
  };

  api.submit = api.submit || async function (d, idFiles) {
    var fd = new FormData();
    fd.append('data', JSON.stringify(d));
    if (idFiles.front) fd.append('idFront', idFiles.front, idFiles.front.name);
    if (idFiles.back) fd.append('idBack', idFiles.back, idFiles.back.name);
    var r = await fetch(CFG.API_BASE + '/contracts', {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    if (!r.ok) throw new Error('Submit failed: ' + r.status);
    return await r.json();
  };

  function renderList() {
    var list = document.getElementById('bookList');
    if (!list) return;
    list.innerHTML = '';
  }

  function closeContractModal() {
    var modal = document.getElementById('contractModal');
    if (modal) modal.classList.remove('open');
  }

  function submitKyc(bid) {
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = null;
    if (!book) return;
    var btn = document.getElementById('kycSubmitBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    KycForm.setBusy(true);
    api.submit({ bookId: bid }, KycForm.files())
      .then(function (r) {
        KycForm.setBusy(false);
        btn.innerHTML = 'Submit application';
        if (r && r.ok) {
          toast(book.title + ' — application submitted!');
          closeContractModal();
        } else {
          toast(r && r.error ? r.error : 'Submission failed');
        }
      })
      .catch(function (e) {
        KycForm.setBusy(false);
        btn.innerHTML = 'Submit application';
        toast(e.message || 'Submission failed');
      });
  }

  function init() {
    renderList();
    KycForm.mount(document.getElementById('kycMount'), {
      submitLabel: 'Submit application',
      backLabel: 'Back to books',
      onSubmit: submitKyc,
      onBack: closeContractModal
    });
    // Load contracts from API
    api.list()
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          document.getElementById('bookList').innerHTML = '<div class="empty">You have no contracts available.</div>';
        }
      })
      .catch(function (e) {
        document.getElementById('bookList').innerHTML = '<div class="empty">Failed to load contracts. Please try again.</div>';
      });
  }

  api.decline = api.decline || function (contractId, reason) { return api.submit({ contractId: contractId, action: 'decline', reason: reason || '' }); };
  api.init = init;
  api._toast = toast;
})();
