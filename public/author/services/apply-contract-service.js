/**
 * apply-contract-service.js — contract applications for real books.
 *
 * GET  /api/author/contracts  → one row per book with its contract state and
 *                               the author's identity status
 * POST /api/author/contracts  → multipart { data: {bookId|bookId+kyc}, idFront, idBack }
 *
 * A verified writer applies in one click; everyone else supplies identity in
 * the same form. Success is only shown when the API returns 201.
 */
(function () {
  'use strict';
  if (window.ApplyContractService && window.ApplyContractService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 15000 };

  var books = [];
  var selectedBook = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 3000);
  }
  function coverOf(b) { return (b && b.cover) || '../assets/droboard-icon.png'; }

  function getTag(status) {
    if (status === 'contracted') return '<span class="status-tag tag-contracted"><i class="fas fa-check-circle"></i> Contracted</span>';
    if (status === 'applied') return '<span class="status-tag tag-pending"><i class="fas fa-clock"></i> Pending</span>';
    if (status === 'review') return '<span class="status-tag tag-review"><i class="fas fa-hourglass-half"></i> Review</span>';
    if (status === 'rejected') return '<span class="status-tag tag-rejected"><i class="fas fa-xmark"></i> Not approved</span>';
    return '<span class="status-tag"><i class="fas fa-file-lines"></i> Available</span>';
  }

  async function readError(res) {
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    var msg = (body && (body.message || body.error)) || ('Request failed (' + res.status + ')');
    var err = new Error(String(msg).replace(/_/g, ' '));
    err.status = res.status;
    return err;
  }

  var api = window.ApplyContractService || {};

  api.list = async function () {
    var res = await fetch(CFG.API_BASE + '/contracts', { credentials: 'include' });
    if (!res.ok) throw await readError(res);
    var data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.books)) return data.books;
    return [];
  };

  api.verification = async function () {
    var res = await fetch(CFG.API_BASE + '/verification', { credentials: 'include' });
    if (!res.ok) throw await readError(res);
    return await res.json();
  };

  api.submit = async function (d, idFiles) {
    idFiles = idFiles || {};
    var fd = new FormData();
    fd.append('data', JSON.stringify(d));
    if (idFiles.front) fd.append('idFront', idFiles.front, idFiles.front.name);
    if (idFiles.back) fd.append('idBack', idFiles.back, idFiles.back.name);
    var res = await fetch(CFG.API_BASE + '/contracts', { method: 'POST', credentials: 'include', body: fd });
    if (!res.ok) throw await readError(res);
    return await res.json();
  };

  function canApply(b) { return !b.status || b.status === 'none' || b.status === 'rejected'; }

  function renderList() {
    var list = document.getElementById('bookList');
    if (!list) return;
    if (!books.length) {
      list.innerHTML = '<div class="empty" style="padding:40px 20px;text-align:center;color:var(--tx-muted)"><i class="fas fa-inbox"></i><p>You have no books available for contracts.</p></div>';
      return;
    }
    list.innerHTML = books.map(function (b) {
      var ch = Number(b.chapters) || 0;
      return '<div class="book-row" data-bid="' + esc(b.id) + '">'
        + '<div class="book-header">'
        + '<img src="' + esc(coverOf(b)) + '" class="book-cover" alt="' + esc(b.title || '') + '" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
        + '<div class="book-info"><div class="book-title">' + esc(b.title || 'Untitled') + '</div>'
        + '<div class="book-meta">' + esc(b.genre || 'No genre') + ' • ' + ch + ' chapters</div></div>'
        + '<span class="book-chevron"><i class="fas fa-chevron-down"></i></span></div>'
        + '<div class="book-accordion"><div class="accordion-inner"><div>' + getTag(b.status || 'none') + '</div>'
        + (canApply(b) ? '<button class="apply-btn" data-bid="' + esc(b.id) + '"><i class="fas fa-file-contract"></i> Apply for Contract</button>' : '')
        + (b.status === 'applied' ? '<div class="status-detail applied"><i class="fas fa-clock"></i> Application Pending</div>' : '')
        + (b.status === 'review' ? '<div class="status-detail applied"><i class="fas fa-hourglass-half"></i> With the review team</div>' : '')
        + (b.status === 'contracted' ? '<div class="status-detail contracted"><i class="fas fa-check-circle"></i> Contract Active</div>' : '')
        + '</div></div></div>';
    }).join('');

    Array.prototype.forEach.call(list.querySelectorAll('.book-row'), function (row) {
      row.querySelector('.book-header').addEventListener('click', function () { row.classList.toggle('open'); });
    });
    Array.prototype.forEach.call(list.querySelectorAll('.apply-btn'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var book = books.filter(function (b) { return String(b.id) === String(btn.dataset.bid); })[0];
        if (book) { selectedBook = book; openContractModal(book); }
      });
    });
  }

  function openContractModal(book) {
    var modal = document.getElementById('contractModal');
    if (!modal) return;
    document.getElementById('contractBook').innerHTML = '<div class="contract-book">'
      + '<img src="' + esc(coverOf(book)) + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
      + '<div><div class="contract-book-title">' + esc(book.title || 'Untitled') + '</div>'
      + '<div class="contract-book-meta">' + esc(book.genre || 'No genre') + ' • ' + (Number(book.chapters) || 0) + ' chapters</div></div></div>';
    var verified = book.verificationStatus === 'approved';
    var accept = document.getElementById('acceptBtn');
    if (accept) accept.innerHTML = verified ? '<i class="fas fa-check"></i> Submit application' : '<i class="fas fa-arrow-right"></i> Continue';
    var note = document.getElementById('contractIdentityNote');
    if (note) note.textContent = verified
      ? 'Your identity is already verified — continuing submits the application directly.'
      : 'Next you will confirm your identity (ID photos), and the same verification unlocks your writer badge.';
    modal.classList.add('open');
  }

  function closeContractModal() {
    var modal = document.getElementById('contractModal');
    if (modal) modal.classList.remove('open');
  }

  function handleReject() {
    closeContractModal();
    selectedBook = null;
  }

  function showSuccess(book) {
    document.getElementById('formView').style.display = 'none';
    var kycView = document.getElementById('kycView');
    if (kycView) kycView.style.display = 'none';
    document.getElementById('successView').classList.add('show');
    var msg = document.getElementById('successMsg');
    if (msg) msg.textContent = 'Your contract application for "' + (book.title || 'this book') + '" has been submitted. The review team will send the contract terms for you to sign next.';
  }

  async function submitApplication(payload, files, btn) {
    var old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…'; }
    if (window.KycForm) KycForm.setBusy(true);
    try {
      await api.submit(payload, files);
      if (window.KycForm) KycForm.setBusy(false);
      closeContractModal();
      showSuccess(selectedBook || {});
    } catch (e) {
      if (window.KycForm) { KycForm.setBusy(false); KycForm.showError(e.message || 'Submission failed'); }
      toast(e.message || 'Submission failed');
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
  }

  function handleAccept() {
    if (!selectedBook) return;
    var book = selectedBook;
    var accept = document.getElementById('acceptBtn');
    if (book.verificationStatus === 'approved') {
      // Verified identity on file — no KYC repeat, just the application.
      submitApplication({ bookId: book.id }, null, accept);
      return;
    }
    closeContractModal();
    var formView = document.getElementById('formView');
    var kycView = document.getElementById('kycView');
    if (formView) formView.style.display = 'none';
    if (kycView) kycView.style.display = 'block';
  }

  function submitKyc() {
    if (!selectedBook) return;
    if (!window.KycForm) { toast('Identity form failed to load'); return; }
    var out = KycForm.read();
    if (out.err) { KycForm.showError(out.err); return; }
    KycForm.showError('');
    KycForm.setBusy(true);
    api.submit({ bookId: selectedBook.id, kyc: out.kyc }, KycForm.files())
      .then(function () {
        KycForm.setBusy(false);
        showSuccess(selectedBook);
      })
      .catch(function (e) {
        KycForm.setBusy(false);
        KycForm.showError(e.message || 'Submission failed');
        toast(e.message || 'Submission failed');
      });
  }

  function showLoadError(e) {
    document.getElementById('bookList').innerHTML =
      '<div class="empty" style="padding:40px 20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i>'
      + '<p>Could not load your contracts</p><p style="font-size:12px;margin-top:8px">' + esc((e && e.message) || 'Please try again') + '</p>'
      + '<button type="button" id="retryContracts" style="margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--red);background:#fff;color:var(--red);font-weight:700;cursor:pointer">Retry</button></div>';
    var btn = document.getElementById('retryContracts');
    if (btn) btn.addEventListener('click', load);
  }

  function load() {
    document.getElementById('bookList').innerHTML = '<div class="empty" style="padding:30px 20px;text-align:center;color:var(--tx-muted)">Loading your books…</div>';
    api.list().then(function (data) {
      books = data || [];
      renderList();
    }).catch(showLoadError);
  }

  function init() {
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-contract.html'); window.AuthorDrawer.bind(); }
    if (window.KycForm && document.getElementById('kycMount')) {
      KycForm.mount(document.getElementById('kycMount'), {
        submitLabel: 'Submit application',
        backLabel: 'Back to books',
        onSubmit: submitKyc,
        onBack: function () {
          document.getElementById('formView').style.display = 'block';
          document.getElementById('kycView').style.display = 'none';
          selectedBook = null;
        }
      });
    }
    var modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', closeContractModal);
    var modal = document.getElementById('contractModal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeContractModal(); });

    window.handleReject = handleReject;
    window.handleAccept = handleAccept;

    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) doneBtn.addEventListener('click', function () { location.reload(); });
    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { history.back(); });

    load();
  }

  api.decline = function () {
    return Promise.reject(new Error('Declining an offer happens from the contract offer page, not this application form.'));
  };
  api.init = init;
  window.ApplyContractService = api;
  window.handleAccept = handleAccept;
  window.handleReject = handleReject;
})();
