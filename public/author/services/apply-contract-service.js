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
  // The platform-wide standard contract rules (fetched once from the API;
  // contract-pdf.js standardRules() stays the fallback when offline).
  var fetchedStandardRules = null;

  function fetchStandardRules() {
    if (fetchedStandardRules) return;
    fetch('/api/author/contract-rules', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && Array.isArray(d.rules) && d.rules.length) fetchedStandardRules = d.rules;
      })
      .catch(function () { /* offline: PDF module defaults apply */ });
  }

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
    if (status === 'review') return '<span class="status-tag tag-review"><i class="fas fa-file-signature"></i> Offer received</span>';
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
        + (b.status === 'review' ? '<div class="status-detail review"><i class="fas fa-file-signature"></i> Offer received — review &amp; sign it at the top of this page</div>' : '')
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
      renderOffers();
      renderList();
    }).catch(showLoadError);
  }

  // Offers the editor sent that are waiting for the author to review/sign.
  function pendingOffers() {
    return books.filter(function (b) { return b.status === 'review' && b.contractId; });
  }

  function renderOffers() {
    var mount = document.getElementById('offersMount');
    if (!mount) return;
    var offers = pendingOffers();
    if (!offers.length) { mount.innerHTML = ''; return; }
    mount.innerHTML = '<div class="page-header" style="margin-top:4px"><h1 style="font-size:16px">Offers to review</h1><p>The editorial team sent these contracts. Review and sign to make them active.</p></div>'
      + offers.map(function (b) {
        return '<div class="offer-card" data-offer="' + esc(b.contractId) + '">'
          + '<div class="offer-top"><div class="offer-ico"><i class="fas fa-file-signature"></i></div>'
            + '<div class="offer-head"><b>' + esc(b.title || 'Untitled') + '</b><span>' + esc(b.offerType || 'Publishing contract') + '</span></div>'
            + '<span class="offer-pill">Action needed</span></div>'
          + '<div class="offer-book"><i class="fas fa-book" style="margin-right:6px;color:var(--acc,var(--pink))"></i>' + esc(b.title || 'Untitled') + '</div>'
          + '<div class="offer-terms">'
            + '<div class="offer-term"><label>Contract type</label><b>' + esc(b.offerType || '—') + '</b></div>'
            + '<div class="offer-term"><label>Term</label><b>' + (b.termMonths ? b.termMonths + ' months' : '—') + '</b></div>'
            + '<div class="offer-term"><label>Revenue split</label><b>' + (b.revenueSplit != null ? b.revenueSplit + ' / ' + (100 - b.revenueSplit) : '—') + '</b></div>'
            + '<div class="offer-term"><label>Sent</label><b>' + esc((b.offerSentAt || '').split('T')[0] || '—') + '</b></div>'
          + '</div>'
          + '<div class="offer-acts">'
            + '<button class="offer-btn decline" data-decline="' + esc(b.contractId) + '"><i class="fas fa-xmark"></i> Decline</button>'
            + '<button class="offer-btn sign" data-sign="' + esc(b.contractId) + '"><i class="fas fa-pen"></i> Review &amp; Sign</button>'
          + '</div></div>';
      }).join('');
    bindOfferEvents(mount);
  }

  function bindOfferEvents(mount) {
    mount.querySelectorAll('[data-sign]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cid = btn.getAttribute('data-sign');
        var book = pendingOffers().filter(function (b) { return b.contractId === cid; })[0];
        if (book) showOfferConfirm(cid, book);
      });
    });
    mount.querySelectorAll('[data-decline]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cid = btn.getAttribute('data-decline');
        if (!window.confirm('Decline this contract offer? Your book will return to available.')) return;
        btn.disabled = true;
        api.decline(cid).then(function () { toast('Offer declined'); load(); })
          .catch(function (e) { toast(e.message || 'Could not decline'); btn.disabled = false; });
      });
    });
  }

  /* ── Review & sign: custom modal (never the browser confirm) ─────────────
   * The modal shows every offer term plus the full rule set: the clauses the
   * chief editor saved on the contract template, followed by the standard
   * publishing rules. "Sign & Download" calls the API, then writes a PDF that
   * captures the author's name, the contract and the signature record.
   */
  var pendingSign = null;     // { cid, book }
  var profilePromise = null;  // one /api/users/me read per page load

  function getProfile() {
    if (!profilePromise) {
      profilePromise = fetch('/api/users/me', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return profilePromise;
  }

  function profileName(u) {
    return (u && (u.fullName || u.name || u.username)) || 'Author';
  }

  function fmtDate(v) {
    if (!v) return '—';
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function addMonths(date, months) {
    var d = new Date(date.getTime());
    d.setMonth(d.getMonth() + Number(months || 0));
    return d;
  }

  function money(v) {
    var num = Number(v);
    if (!isFinite(num)) return '—';
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // Everything the modal and the PDF need, taken from the offer + the signed
  // contract returned by the API (so the PDF is built from the real record).
  function contractData(book, signed, user) {
    signed = signed || {};
    var now = signed.signedAt ? new Date(signed.signedAt) : new Date();
    var termMonths = Number(signed.termMonths || book.termMonths || 0);
    var split = signed.revenueSplit != null ? signed.revenueSplit : book.revenueSplit;
    return {
      contractId: signed.id || book.contractId || '',
      authorName: profileName(user),
      authorHandle: user && user.username ? user.username : '',
      bookTitle: book.title || 'Untitled',
      bookGenre: book.genre || '',
      templateName: book.offerTemplate || '',
      contractType: signed.type || book.offerType || 'Publishing',
      termMonths: termMonths,
      duration: signed.duration || book.offerTermLength || (termMonths ? termMonths + ' months' : ''),
      revenueSplit: split == null ? null : split,
      autoRenew: !!book.offerAutoRenew,
      effectiveAt: now,
      expiryAt: termMonths ? addMonths(now, termMonths) : null,
      description: book.offerDescription || '',
      clauses: book.offerClauses || '',
      bonuses: book.offerBonuses || null,
      contractRules: fetchedStandardRules,
      signedAt: now,
      signatureRef: (signed.id || book.contractId || '') + '-' + now.toISOString()
    };
  }

  function standardRules(data) {
    if (Array.isArray(fetchedStandardRules) && fetchedStandardRules.length) return fetchedStandardRules;
    if (window.ContractPdf && window.ContractPdf.standardRules) return window.ContractPdf.standardRules(data);
    return [];
  }

  function clauseList(text) {
    if (window.ContractPdf && window.ContractPdf.clauseList) return window.ContractPdf.clauseList(text);
    return String(text || '').split(/\r?\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function kv(label, value) {
    return '<div class="sign-cell"><span>' + esc(label) + '</span><b>' + esc(value || '—') + '</b></div>';
  }

  function renderRuleList(items) {
    return '<ol class="rules-list">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
  }

  function renderSignModal(book, user) {
    var body = document.getElementById('signBody');
    if (!body) return;
    var data = contractData(book, null, user);

    var bonus = data.bonuses || {};
    var bonusRows = '';
    if (bonus.signupBonusMin || bonus.signupBonusMax) {
      bonusRows += kv('Signup bonus', money(bonus.signupBonusMin) + ' – ' + money(bonus.signupBonusMax));
    }
    if (bonus.completionTarget) {
      bonusRows += kv('Completion bonus', Number(bonus.completionTarget).toLocaleString('en-US') + ' reads'
        + (bonus.completionWindowMonths ? ' within ' + bonus.completionWindowMonths + ' months' : ''));
    }
    if (bonus.profitShareThreshold) {
      bonusRows += kv('Profit-share bonus', money(bonus.profitShareBonus) + ' at ' + money(bonus.profitShareThreshold));
    }

    var clauses = clauseList(data.clauses);
    var rules = standardRules(data);

    body.innerHTML = '<div class="contract-book">'
      + '<img src="' + esc(coverOf(book)) + '" alt="" onerror="this.onerror=null;this.src=\'../assets/droboard-icon.png\'"/>'
      + '<div><div class="contract-book-title">' + esc(data.bookTitle) + '</div>'
      + '<div class="contract-book-meta">' + esc(data.contractType)
      + (data.templateName ? ' • ' + esc(data.templateName) : '') + '</div></div></div>'
      + '<div class="sign-ref"><span>Contract reference</span><b>' + esc(data.contractId || '—') + '</b></div>'

      + '<div class="sign-section"><h4><i class="fas fa-user"></i> Parties</h4><div class="sign-grid">'
      + kv('Author', data.authorName)
      + kv('Platform', 'Droboard')
      + kv('Book', data.bookTitle)
      + kv('Genre', data.bookGenre || '—')
      + '</div></div>'

      + '<div class="sign-section"><h4><i class="fas fa-file-signature"></i> Contract terms</h4><div class="sign-grid">'
      + kv('Contract type', data.contractType)
      + kv('Term', data.duration || 'Per contract')
      + kv('Revenue split', data.revenueSplit != null
        ? data.revenueSplit + '% author / ' + (100 - data.revenueSplit) + '% Droboard' : 'Per contract')
      + kv('Effective date', fmtDate(data.effectiveAt))
      + kv('Expiry date', data.expiryAt ? fmtDate(data.expiryAt) : '—')
      + kv('Auto-renewal', data.autoRenew ? 'Yes' : 'No')
      + bonusRows
      + '</div></div>'

      + (data.description ? '<div class="sign-section"><h4><i class="fas fa-circle-info"></i> About this contract</h4>'
        + '<p class="sign-desc">' + esc(data.description) + '</p></div>' : '')

      + (clauses.length ? '<div class="sign-section"><h4><i class="fas fa-list-check"></i> Clauses set by the editorial team</h4>'
        + renderRuleList(clauses) + '</div>' : '')

      + '<div class="sign-section"><h4><i class="fas fa-scale-balanced"></i> Contract rules</h4>'
      + renderRuleList(rules) + '</div>'

      + '<div class="sign-section sign-signature"><h4><i class="fas fa-pen-nib"></i> Signature</h4>'
      + '<div class="sign-sign-line"><b>' + esc(data.authorName) + '</b><span>Signed electronically on '
      + esc(fmtDate(data.effectiveAt)) + '</span></div>'
      + '<p class="sign-note">By choosing <b>Sign &amp; Download</b>, you sign this contract electronically and '
      + 'a PDF copy is saved to your device with your name, the contract terms and this signature record. '
      + 'Droboard countersigns to activate it on the platform.</p></div>';
  }

  function closeSignModal() {
    var modal = document.getElementById('signModal');
    if (modal) modal.classList.remove('open');
    pendingSign = null;
  }

  function showOfferConfirm(cid, book) {
    var modal = document.getElementById('signModal');
    if (!modal) return;
    pendingSign = { cid: cid, book: book };
    // Paint immediately with the name we have (still loads the real one).
    renderSignModal(book, null);
    modal.classList.add('open');
    getProfile().then(function (user) { if (pendingSign) renderSignModal(book, user); });
  }

  function signAndDownload() {
    if (!pendingSign) return;
    var cid = pendingSign.cid;
    var book = pendingSign.book;
    var btn = document.getElementById('signConfirm');
    var old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing…'; }

    getProfile().then(function (user) {
      return api.sign(cid).then(function (signed) {
        var data = contractData(book, signed, user);
        var downloaded = false;
        try {
          if (window.ContractPdf) { window.ContractPdf.download(data); downloaded = true; }
        } catch (err) {
          console.error('[contract-pdf]', err);
        }
        closeSignModal();
        toast(downloaded
          ? '✅ Contract signed — your PDF is downloading'
          : '✅ Contract signed — PDF export is unavailable on this device');
        load();
      });
    }).catch(function (e) {
      toast(e.message || 'Could not sign contract');
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    });
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

    // Review & sign modal (custom confirmation with the full contract rules).
    var signModal = document.getElementById('signModal');
    var signClose = document.getElementById('signModalClose');
    var signCancel = document.getElementById('signCancel');
    var signConfirm = document.getElementById('signConfirm');
    if (signClose) signClose.addEventListener('click', closeSignModal);
    if (signCancel) signCancel.addEventListener('click', closeSignModal);
    if (signConfirm) signConfirm.addEventListener('click', signAndDownload);
    if (signModal) signModal.addEventListener('click', function (e) { if (e.target === signModal) closeSignModal(); });

    window.handleReject = handleReject;
    window.handleAccept = handleAccept;

    fetchStandardRules();
    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) doneBtn.addEventListener('click', function () { location.reload(); });
    var backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', function () { history.back(); });

    load();
  }

  api.sign = async function (contractId) {
    var res = await fetch(CFG.API_BASE + '/contracts/' + encodeURIComponent(contractId) + '/sign', {
      method: 'POST', credentials: 'include'
    });
    if (!res.ok) throw await readError(res);
    return await res.json();
  };
  api.decline = async function (contractId, reason) {
    var res = await fetch(CFG.API_BASE + '/contracts/' + encodeURIComponent(contractId) + '/decline', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Declined by author' })
    });
    if (!res.ok) throw await readError(res);
    return await res.json();
  };
  api.init = init;
  window.ApplyContractService = api;
  window.handleAccept = handleAccept;
  window.handleReject = handleReject;
})();
