/** apply-contract-service.js — owns data + render + bindings for apply-contract.html. TODO: GET/POST /api/author/contracts */
(function () { 'use strict';
  if (window.ApplyContractService && window.ApplyContractService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }

  var BOOKS = [
    { id: 'b1', title: 'The Midnight Protocol', genre: 'Romance', cover: 'https://picsum.photos/seed/book1/100/140', chapters: 24, status: 'none' },
    { id: 'b2', title: 'Echoes of Yesterday', genre: 'Drama', cover: 'https://picsum.photos/seed/book2/100/140', chapters: 18, status: 'contracted' },
    { id: 'b3', title: 'Crimson Horizons', genre: 'Thriller', cover: 'https://picsum.photos/seed/book3/100/140', chapters: 32, status: 'applied' },
    { id: 'b4', title: 'Starlight Crossing', genre: 'Sci-Fi', cover: 'https://picsum.photos/seed/book4/100/140', chapters: 28, status: 'review' }
  ];

  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  function coverOf(b) { return (b && b.cover) || '../assets/droboard-icon.png'; }

  function getTag(status) {
    if (status === 'contracted') return '<span class="status-tag tag-contracted"><i class="fas fa-check-circle"></i> Contracted</span>';
    if (status === 'applied') return '<span class="status-tag tag-pending"><i class="fas fa-clock"></i> Pending</span>';
    if (status === 'review') return '<span class="status-tag tag-pending"><i class="fas fa-file-signature"></i> Ready to Sign</span>';
    return '<span class="status-tag tag-none">No Contract</span>';
  }

  function getAccordionContent(status, b) {
    if (status === 'applied') {
      return '<div class="status-detail applied"><i class="fas fa-clock"></i> Application submitted — awaiting review from your editor.</div>';
    }
    if (status === 'contracted') {
      return '<div class="status-detail contracted"><i class="fas fa-check-circle"></i> Contract active since Jan 15, 2026.</div>';
    }
    if (status === 'review') {
      return '<button class="apply-btn sign" data-action="sign" data-bid="' + b.id + '"><i class="fas fa-file-signature"></i> Review & Sign Contract</button>';
    }
    return '<button class="apply-btn" data-action="apply" data-bid="' + b.id + '"><i class="fas fa-file-signature"></i> Apply for Contract</button>';
  }

  function renderList() {
    var list = document.getElementById('bookList');
    if (!list) return;
    list.innerHTML = BOOKS.map(function (b) {
      return '<div class="book-row" data-bid="' + b.id + '">'
        + '<div class="book-header">'
        + '<img class="book-cover" src="' + coverOf(b) + '" alt=""/>'
        + '<div class="book-info"><div class="book-title">' + b.title + '</div>'
        + '<div class="book-meta">' + b.genre + ' · ' + b.chapters + ' chapters</div></div>'
        + getTag(b.status)
        + '<i class="fas fa-chevron-down book-chevron"></i></div>'
        + '<div class="book-accordion"><div class="accordion-inner">'
        + getAccordionContent(b.status, b)
        + '</div></div></div>';
    }).join('');

    list.querySelectorAll('.book-header').forEach(function (h) {
      h.addEventListener('click', function () {
        var row = h.parentElement;
        var wasOpen = row.classList.contains('open');
        list.querySelectorAll('.book-row').forEach(function (r) { r.classList.remove('open'); });
        if (!wasOpen) row.classList.add('open');
      });
    });

    list.querySelectorAll('[data-action="apply"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openKyc(btn.getAttribute('data-bid'));
      });
    });

    list.querySelectorAll('[data-action="sign"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var bid = btn.getAttribute('data-bid');
        openContractModal(bid);
      });
    });
  }

  function openContractModal(bid) {
    var book = BOOKS.find(function (x) { return x.id === bid; });
    if (!book) return;
    var offer = book.offerType
      ? '<div style="font-size:11.5px;font-weight:700;color:var(--acc,#ff2d55);margin-top:4px">'
        + typeLabel(book.offerType) + (book.termMonths ? ' · ' + book.termMonths + ' months' : '')
        + (book.revenueSplit != null ? ' · ' + book.revenueSplit + '/' + (100 - book.revenueSplit) + ' split' : '')
        + '</div>'
      : '';
    document.getElementById('contractBook').innerHTML =
      '<img src="' + coverOf(book) + '" alt=""/>'
      + '<div><div class="contract-book-title">' + book.title + '</div>'
      + '<div class="contract-book-meta">' + book.genre + ' · ' + book.chapters + ' chapters</div>'
      + offer + '</div>';
    document.getElementById('contractModal').classList.add('open');
    document.getElementById('contractModal')._bid = bid;
  }

  function typeLabel(t) {
    if (t === 'Exclusive_Publishing') return 'Exclusive Publishing';
    if (t === 'Non_Exclusive') return 'Non-Exclusive Publishing';
    if (t === 'Revenue_Share') return 'Revenue Share';
    if (t === 'License_Agreement') return 'License Agreement';
    return t || '';
  }

  function apiErrorMessage(code) {
    if (code === 'identity_not_verified') return 'Get your identity verified before signing.';
    if (code === 'contract_not_open') return 'This offer is no longer open.';
    if (code === 'network') return 'Network error — try again.';
    return 'Could not reach the contract service. Try again.';
  }

  function handleReject() {
    var btn = document.getElementById('rejectBtn');
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    if (!book) return;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting…';
    function done() {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-xmark"></i> Reject';
      book.status = 'none';
      renderList();
      toast(book.title + ' — contract rejected.');
    }
    if (CFG.USE_API && book.contractId) {
      api.decline(book.contractId).then(function (r) {
        if (r && r.ok === false) {
          btn.innerHTML = '<i class="fas fa-xmark"></i> Reject';
          toast(apiErrorMessage(r.error));
          return;
        }
        done();
      });
      return;
    }
    setTimeout(done, 1200);
  }

  function handleAccept() {
    var btn = document.getElementById('acceptBtn');
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    if (!book) return;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing…';
    function done() {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-check"></i> Accept';
      book.status = 'contracted';
      renderList();
      toast(book.title + ' — contract signed!');
    }
    if (CFG.USE_API && book.contractId) {
      api.sign(book.contractId).then(function (r) {
        if (r && r.ok === false) {
          btn.innerHTML = '<i class="fas fa-check"></i> Accept';
          toast(apiErrorMessage(r.error));
          return;
        }
        done();
      });
      return;
    }
    setTimeout(done, 1200);
  }

  /* ═══ Identity / KYC — shared form (component/kyc-form.js) ═══
     path 'self'      = 18+ with NIN
     path 'guardian'  = under 18, guardian co-sign
     path 'pending'   = 18+ without NIN yet (alternate ID, stays pending identity) */
  var kycTargetBid = null;

  function kycShow(view) {
    document.getElementById('formView').style.display = view === 'form' ? '' : 'none';
    document.getElementById('kycView').style.display = view === 'kyc' ? '' : 'none';
    var sv = document.getElementById('successView');
    if (sv && view !== 'success') sv.style.display = 'none';
  }

  function openKyc(bid) {
    kycTargetBid = bid;
    // A verified writer already has an approved identity on file — apply
    // without asking for the same documents twice.
    api.verification().then(function (v) {
      if (v && v.status === 'approved') { submitApplication(bid, null); return; }
      KycForm.reset();
      kycShow('kyc');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function closeKyc() { kycShow('form'); }

  function submitKyc() {
    var v = KycForm.read();
    if (v.err) { KycForm.showError(v.err); return; }
    KycForm.showError('');
    submitApplication(kycTargetBid, v.kyc);
  }

  function submitApplication(bid, kyc) {
    var book = BOOKS.find(function (x) { return x.id === bid; });
    if (!book) return;
    if (kyc) KycForm.setBusy(true);
    var payload = { bookId: book.id, title: book.title };
    if (kyc) payload.kyc = kyc;
    api.submit(payload, kyc ? KycForm.files() : null).then(function (r) {
      if (kyc) KycForm.setBusy(false);
      if (r && r.ok === false) {
        var msg = (r && r.error) || 'Could not submit. Try again.';
        if (kyc) KycForm.showError(msg); else toast(msg);
        return;
      }
      book.status = 'applied';
      kycShow('form');
      renderList();
      var label = kyc && kyc.type === 'guardian' ? ' (guardian co-sign)'
        : kyc && kyc.type === 'pending' ? ' (pending identity)' : '';
      toast(book.title + ' — application submitted' + label + '!');
      if (window.droNotify) window.droNotify({
        type: 'contract_update', key: 'contract:' + book.id + ':applied',
        title: 'Contract application submitted',
        desc: book.title + ' is with our editors. Expect a decision within 5 working days.',
        link: { label: 'Track application' },
      });
    });
  }

  function init() {
    renderList();
    // Live mode lists this writer's real books; demo mode keeps BOOKS.
    if (CFG.USE_API) {
      api.list().then(function (rows) {
        if (!Array.isArray(rows)) return;
        BOOKS.length = 0;
        rows.forEach(function (r) { BOOKS.push(r); });
        renderList();
      });
    }
    document.getElementById('modalClose').onclick = function () {
      document.getElementById('contractModal').classList.remove('open');
    };
    document.getElementById('contractModal').onclick = function (e) {
      if (e.target === this) this.classList.remove('open');
    };
    document.getElementById('backBtn').addEventListener('click', function () {
      if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html';
    });
    KycForm.mount(document.getElementById('kycMount'), {
      submitLabel: 'Submit application',
      backLabel: 'Back to books',
      onSubmit: submitKyc,
      onBack: closeKyc,
    });
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-contract.html'); window.AuthorDrawer.bind(); }
    window.handleReject = handleReject;
    window.handleAccept = handleAccept;
    window.openKyc = openKyc;
  }

  var api = window.ApplyContractService || {};
  // null = backend unreachable (keep the demo rows); [] = this writer has none.
  api.list = api.list || async function () {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts'); if (r.ok) return await r.json(); } catch (e) {} return null; }
    await delay(); return [];
  };
  api.verification = api.verification || async function () {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/verification'); if (r.ok) return await r.json(); } catch (e) {} }
    return { status: 'none' };
  };
  api.submit = api.submit || async function (d, idFiles) {
    if (CFG.USE_API) {
      try {
        var opts;
        if (idFiles && idFiles.front) {
          var fd = new FormData();
          fd.append('data', JSON.stringify(d));
          fd.append('idFront', idFiles.front, idFiles.front.name);
          if (idFiles.back) fd.append('idBack', idFiles.back, idFiles.back.name);
          opts = { method: 'POST', credentials: 'include', body: fd };
        } else {
          opts = { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) };
        }
        var r = await fetch(CFG.API_BASE + '/contracts', opts);
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    await delay(250);
    return { ok: true, id: 'CT-' + Date.now() };
  };
  async function postOffer(contractId, action, body) {
    try {
      var r = await fetch(CFG.API_BASE + '/contracts/' + encodeURIComponent(contractId) + '/' + action, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (r.ok) return Object.assign({ ok: true }, await r.json());
      var j = null;
      try { j = await r.json(); } catch (e) {}
      return { ok: false, error: (j && j.error) || 'request_failed' };
    } catch (e) {
      return { ok: false, error: 'network' };
    }
  }
  api.sign = api.sign || function (contractId) { return postOffer(contractId, 'sign', {}); };
  api.decline = api.decline || function (contractId, reason) { return postOffer(contractId, 'decline', { reason: reason || '' }); };
  api.init = init;
  api._BOOKS = BOOKS;
  api._renderList = renderList;
  api._toast = toast;
  window.ApplyContractService = api;
  window.handleReject = handleReject;
  window.handleAccept = handleAccept;
})();
