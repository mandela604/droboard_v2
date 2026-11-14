/** apply-contract-service.js — owns data + render + bindings for apply-contract.html. Uses /api/author/contracts. */
(function () { 'use strict';
  if (window.ApplyContractService && window.ApplyContractService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author' };
  var books = [];
  var selectedBook = null;

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
    
    if (!books || books.length === 0) {
      list.innerHTML = '<div class="empty" style="padding:40px 20px;text-align:center;color:var(--tx-muted)"><i class="fas fa-inbox"></i><p>You have no books available for contracts.</p></div>';
      return;
    }

    list.innerHTML = books.map(function(b, idx) {
      return '<div class="book-row" data-bid="' + b.id + '">' +
        '<div class="book-header">' +
          '<img src="' + coverOf(b) + '" class="book-cover" alt="' + b.title + '"/>' +
          '<div class="book-info">' +
            '<div class="book-title">' + b.title + '</div>' +
            '<div class="book-meta">' + (b.genre || 'Unknown Genre') + ' • ' + (b.chapters || 0) + ' chapters</div>' +
          '</div>' +
          '<span class="book-chevron"><i class="fas fa-chevron-down"></i></span>' +
        '</div>' +
        '<div class="book-accordion">' +
          '<div class="accordion-inner">' +
            '<div>' + getTag(b.contractStatus || 'none') + '</div>' +
            (b.contractStatus === 'none' ? '<button class="apply-btn" data-bid="' + b.id + '"><i class="fas fa-file-contract"></i> Apply for Contract</button>' : '') +
            (b.contractStatus === 'applied' ? '<div class="status-detail applied"><i class="fas fa-clock"></i> Application Pending</div>' : '') +
            (b.contractStatus === 'contracted' ? '<div class="status-detail contracted"><i class="fas fa-check-circle"></i> Contract Active</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Bind book row click handlers
    document.querySelectorAll('.book-row').forEach(function(row) {
      row.querySelector('.book-header').addEventListener('click', function() {
        row.classList.toggle('open');
      });
    });

    // Bind apply buttons
    document.querySelectorAll('.apply-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var bid = btn.dataset.bid;
        var book = books.find(function(b) { return b.id === bid; });
        if (book) {
          selectedBook = book;
          openContractModal(book);
        }
      });
    });
  }

  function openContractModal(book) {
    var modal = document.getElementById('contractModal');
    if (!modal) return;
    
    var bookHtml = '<div class="contract-book">' +
      '<img src="' + coverOf(book) + '" alt="' + book.title + '"/>' +
      '<div>' +
        '<div class="contract-book-title">' + book.title + '</div>' +
        '<div class="contract-book-meta">' + (book.genre || 'Unknown') + ' • ' + (book.chapters || 0) + ' chapters</div>' +
      '</div>' +
    '</div>';
    
    document.getElementById('contractBook').innerHTML = bookHtml;
    modal.classList.add('open');
    modal._bid = book.id;
  }

  function closeContractModal() {
    var modal = document.getElementById('contractModal');
    if (modal) modal.classList.remove('open');
    selectedBook = null;
  }

  function handleReject() {
    closeContractModal();
    toast('Contract rejected');
  }

  function handleAccept() {
    if (!selectedBook) return;
    var modal = document.getElementById('contractModal');
    modal._accepting = true;
    document.getElementById('acceptBtn').disabled = true;
    document.getElementById('acceptBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…';
    
    // Show KYC form
    var formView = document.getElementById('formView');
    var kycView = document.getElementById('kycView');
    if (formView) formView.style.display = 'none';
    if (kycView) kycView.style.display = 'block';
    closeContractModal();
  }

  function submitKyc() {
    if (!selectedBook) return;
    var btn = document.getElementById('kycSubmitBtn');
    if (!btn) return;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    btn.disabled = true;
    KycForm.setBusy(true);
    
    api.submit({ bookId: selectedBook.id }, KycForm.files())
      .then(function (r) {
        KycForm.setBusy(false);
        btn.disabled = false;
        if (r && r.ok) {
          document.getElementById('formView').style.display = 'none';
          document.getElementById('kycView').style.display = 'none';
          document.getElementById('successView').classList.add('show');
          var msg = document.getElementById('successMsg');
          if (msg) msg.textContent = 'Your contract application for "' + selectedBook.title + '" has been submitted successfully. The review team will contact you soon.';
        } else {
          btn.innerHTML = 'Submit application';
          toast(r && r.error ? r.error : 'Submission failed');
        }
      })
      .catch(function (e) {
        KycForm.setBusy(false);
        btn.disabled = false;
        btn.innerHTML = 'Submit application';
        toast(e.message || 'Submission failed');
      });
  }

  function init() {
    // Load books and render
    api.list()
      .then(function (data) {
        if (data && data.books && Array.isArray(data.books)) {
          books = data.books;
          renderList();
        } else if (Array.isArray(data)) {
          books = data;
          renderList();
        } else {
          document.getElementById('bookList').innerHTML = '<div class="empty" style="padding:40px 20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i><p>Invalid response from server</p></div>';
        }
      })
      .catch(function (e) {
        console.error('Failed to load contracts:', e);
        document.getElementById('bookList').innerHTML = '<div class="empty" style="padding:40px 20px;text-align:center;color:var(--red)"><i class="fas fa-exclamation-triangle"></i><p>Failed to load contracts</p><p style="font-size:12px;margin-top:8px">' + (e.message || 'Please refresh the page') + '</p></div>';
      });

    // Setup KYC form
    if (window.KycForm && document.getElementById('kycMount')) {
      KycForm.mount(document.getElementById('kycMount'), {
        submitLabel: 'Submit application',
        backLabel: 'Back to books',
        onSubmit: submitKyc,
        onBack: function() {
          document.getElementById('formView').style.display = 'block';
          document.getElementById('kycView').style.display = 'none';
          selectedBook = null;
        }
      });
    }

    // Modal handlers
    var modalClose = document.getElementById('modalClose');
    if (modalClose) {
      modalClose.addEventListener('click', closeContractModal);
    }

    window.handleReject = handleReject;
    window.handleAccept = handleAccept;

    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function() {
        location.reload();
      });
    }

    // Back button
    var backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        history.back();
      });
    }
  }

  api.decline = api.decline || function (contractId, reason) { return api.submit({ contractId: contractId, action: 'decline', reason: reason || '' }); };
  api.init = init;
  api._toast = toast;
})();
