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
        + '<img class="book-cover" src="' + b.cover + '" alt=""/>'
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
    document.getElementById('contractBook').innerHTML =
      '<img src="' + book.cover + '" alt=""/>'
      + '<div><div class="contract-book-title">' + book.title + '</div>'
      + '<div class="contract-book-meta">' + book.genre + ' · ' + book.chapters + ' chapters</div></div>';
    document.getElementById('contractModal').classList.add('open');
    document.getElementById('contractModal')._bid = bid;
  }

  function handleReject() {
    var btn = document.getElementById('rejectBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting…';
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    setTimeout(function () {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-xmark"></i> Reject';
      book.status = 'none';
      renderList();
      toast(book.title + ' — contract rejected.');
    }, 1200);
  }

  function handleAccept() {
    var btn = document.getElementById('acceptBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing…';
    var modal = document.getElementById('contractModal');
    var bid = modal._bid;
    var book = BOOKS.find(function (x) { return x.id === bid; });
    setTimeout(function () {
      modal.classList.remove('open');
      btn.innerHTML = '<i class="fas fa-check"></i> Accept';
      book.status = 'contracted';
      renderList();
      toast(book.title + ' — contract signed!');
    }, 1200);
  }

  /* ═══ Identity / KYC — 3-path contract gate ═══
     path 'self'      = 18+ with NIN
     path 'guardian'  = under 18, guardian co-sign
     path 'pending'   = 18+ without NIN yet (alternate ID, stays pending identity) */
  var kycTargetBid = null;

  function ageFrom(dobStr) {
    if (!dobStr) return null;
    var d = new Date(dobStr), now = new Date();
    if (isNaN(d.getTime())) return null;
    var a = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  }

  function kycShow(view) {
    document.getElementById('formView').style.display = view === 'form' ? '' : 'none';
    document.getElementById('kycView').style.display = view === 'kyc' ? '' : 'none';
    var sv = document.getElementById('successView');
    if (sv && view !== 'success') sv.style.display = 'none';
  }

  function openKyc(bid) {
    kycTargetBid = bid;
    document.getElementById('kycDob').value = '';
    document.getElementById('kycNin').value = '';
    document.getElementById('kycNoNin').checked = false;
    document.getElementById('altBox').style.display = 'none';
    document.getElementById('kycAltType').value = '';
    document.getElementById('kycAltNo').value = '';
    document.getElementById('kycGName').value = '';
    document.getElementById('kycGRel').value = '';
    document.getElementById('kycGId').value = '';
    document.getElementById('kycGConsent').checked = false;
    document.getElementById('kycAgeNote').textContent = 'We use this to choose the right signing path.';
    document.getElementById('kycErr').classList.remove('show');
    ['kycFront', 'kycBack'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    ['frontImg', 'backImg'].forEach(function (id) {
      var im = document.getElementById(id);
      if (im.dataset.url && URL.revokeObjectURL) { try { URL.revokeObjectURL(im.dataset.url); } catch (e) {} }
      im.removeAttribute('src'); delete im.dataset.url; im.hidden = true;
    });
    document.getElementById('frontName').textContent = 'Tap to capture';
    document.getElementById('backName').textContent = 'Tap to capture';
    document.getElementById('upFrontBox').classList.remove('filled');
    document.getElementById('upBackBox').classList.remove('filled');
    kycPathRefresh();
    kycShow('kyc');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeKyc() { kycShow('form'); }

  function kycPathRefresh() {
    var age = ageFrom(document.getElementById('kycDob').value);
    var note = document.getElementById('kycAgeNote');
    var photoBox = document.getElementById('photoBox');
    if (age !== null && (age < 10 || age > 110)) {
      note.textContent = 'Enter a valid date of birth.';
      document.getElementById('guardianBox').style.display = 'none';
      document.getElementById('selfBox').style.display = 'none';
      photoBox.style.display = 'none';
      return;
    }
    var minor = age !== null && age >= 0 && age < 18;
    document.getElementById('guardianBox').style.display = minor ? 'block' : 'none';
    document.getElementById('selfBox').style.display = (age === null || !minor) ? 'block' : 'none';
    if (age === null || age < 0) note.textContent = 'We use this to choose the right signing path.';
    else if (age < 18) note.innerHTML = '<b>Age ' + age + '</b> &mdash; guardian co-sign path. Parent/guardian signs with you.';
    else note.innerHTML = '<b>Age ' + age + '</b> &mdash; you can sign with your own NIN.';
    if (minor) document.getElementById('kycNoNin').checked = false;
    // photo block: shown once a path is known; label follows the path
    if (age === null || age < 0 || age > 110) { photoBox.style.display = 'none'; return; }
    photoBox.style.display = 'block';
    var altType = document.getElementById('kycAltType').value;
    if (minor) document.getElementById('photoLbl').textContent = 'Photo of your guardian\u2019s ID *';
    else if (document.getElementById('kycNoNin').checked) document.getElementById('photoLbl').textContent = 'Photo of your ' + (altType || 'alternate') + ' *';
    else document.getElementById('photoLbl').textContent = 'Photo of your NIN slip or ID *';
  }

  function kycErr(msg) {
    var el = document.getElementById('kycErr');
    el.textContent = msg; el.classList.add('show');
  }

  function validateKyc() {
    var dob = document.getElementById('kycDob').value;
    var age = ageFrom(dob);
    if (!dob) return { err: 'Enter your date of birth.' };
    if (age === null || age < 10 || age > 110) return { err: 'That date of birth looks invalid.' };
    var front = document.getElementById('kycFront').files[0];
    var back = document.getElementById('kycBack').files[0];
    if (!front || !back) return { err: 'Editors require clear photos of your ID — front AND back.' };
    var idPhotos = { front: front.name, back: back.name };
    if (age < 18) {
      var gName = document.getElementById('kycGName').value.trim();
      var gRel = document.getElementById('kycGRel').value;
      var gId = document.getElementById('kycGId').value.trim();
      if (!gName) return { err: "Enter your guardian's full name." };
      if (!gRel) return { err: 'Select your relationship to the guardian.' };
      if (gId.length < 6) return { err: "Enter your guardian's NIN or ID number (6+ characters)." };
      if (!document.getElementById('kycGConsent').checked) return { err: 'Your guardian must confirm consent to co-sign.' };
      return { kyc: { type: 'guardian', dob: dob, age: age, nin: '', guardian: { name: gName, relationship: gRel, idNo: gId }, idPhotos: idPhotos } };
    }
    if (document.getElementById('kycNoNin').checked) {
      var aType = document.getElementById('kycAltType').value;
      var aNo = document.getElementById('kycAltNo').value.trim();
      if (!aType) return { err: 'Select an alternate ID type.' };
      if (aNo.length < 5) return { err: 'Enter your alternate ID number.' };
      return { kyc: { type: 'pending', dob: dob, age: age, nin: '', altId: { type: aType, no: aNo }, idPhotos: idPhotos } };
    }
    var nin = document.getElementById('kycNin').value.trim();
    if (!/^\d{11}$/.test(nin)) return { err: 'NIN must be exactly 11 digits.' };
    return { kyc: { type: 'self', dob: dob, age: age, nin: nin, idPhotos: idPhotos } };
  }

  function submitKyc() {
    var v = validateKyc();
    if (v.err) { kycErr(v.err); return; }
    document.getElementById('kycErr').classList.remove('show');
    var book = BOOKS.find(function (x) { return x.id === kycTargetBid; });
    if (!book) return;
    var btn = document.getElementById('kycSubmitBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    var idFiles = { front: document.getElementById('kycFront').files[0], back: document.getElementById('kycBack').files[0] };
    // All writes go through the service API layer (POST /api/author/contracts when USE_API=true;
    // ID photos travel as multipart FormData alongside the JSON payload).
    api.submit({ bookId: book.id, title: book.title, kyc: v.kyc }, idFiles).then(function (r) {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit application';
      if (r && r.ok === false) { kycErr((r && r.error) || 'Could not submit. Try again.'); return; }
      book.status = 'applied';
      kycShow('form');
      renderList();
      var label = v.kyc.type === 'guardian' ? ' (guardian co-sign)' : v.kyc.type === 'pending' ? ' (pending identity)' : '';
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
    document.getElementById('modalClose').onclick = function () {
      document.getElementById('contractModal').classList.remove('open');
    };
    document.getElementById('contractModal').onclick = function (e) {
      if (e.target === this) this.classList.remove('open');
    };
    document.getElementById('backBtn').addEventListener('click', function () {
      if (window.history.length > 1) window.history.back(); else window.location.href = 'author-center.html';
    });
    document.getElementById('kycDob').addEventListener('input', kycPathRefresh);
    document.getElementById('kycNoNin').addEventListener('change', function () {
      document.getElementById('altBox').style.display = this.checked ? 'block' : 'none';
      kycPathRefresh();
    });
    document.getElementById('kycAltType').addEventListener('change', kycPathRefresh);
    document.getElementById('kycDob').max = new Date().toISOString().slice(0, 10);
    [['kycFront', 'frontName', 'upFrontBox', 'frontImg'], ['kycBack', 'backName', 'upBackBox', 'backImg']].forEach(function (t) {
      document.getElementById(t[0]).addEventListener('change', function () {
        var f = this.files && this.files[0];
        var img = document.getElementById(t[3]);
        document.getElementById(t[1]).textContent = f ? f.name : 'Tap to upload';
        document.getElementById(t[2]).classList.toggle('filled', !!f);
        if (img.dataset.url && URL.revokeObjectURL) { try { URL.revokeObjectURL(img.dataset.url); } catch (e) {} }
        delete img.dataset.url;
        if (f && typeof URL !== 'undefined' && URL.createObjectURL) {
          var url = URL.createObjectURL(f);
          img.src = url; img.dataset.url = url; img.hidden = false;
        } else {
          img.removeAttribute('src'); img.hidden = true;
        }
      });
    });
    document.getElementById('kycSubmitBtn').addEventListener('click', submitKyc);
    document.getElementById('kycBackBtn').addEventListener('click', closeKyc);
    if (window.AuthorDrawer) { window.AuthorDrawer.render('apply-contract.html'); window.AuthorDrawer.bind(); }
    window.handleReject = handleReject;
    window.handleAccept = handleAccept;
    window.openKyc = openKyc;
  }

  var api = window.ApplyContractService || {};
  api.list = api.list || async function () { if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/contracts'); if (r.ok) return await r.json(); } catch (e) {} } await delay(); return []; };
  api.submit = api.submit || async function (d, idFiles) {
    if (CFG.USE_API) {
      try {
        var opts;
        if (idFiles && idFiles.front) {
          var fd = new FormData();
          fd.append('data', JSON.stringify(d));
          fd.append('idFront', idFiles.front, idFiles.front.name);
          if (idFiles.back) fd.append('idBack', idFiles.back, idFiles.back.name);
          opts = { method: 'POST', body: fd };
        } else {
          opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) };
        }
        var r = await fetch(CFG.API_BASE + '/contracts', opts);
        if (r.ok) return await r.json();
      } catch (e) {}
    }
    await delay(250);
    return { ok: true, id: 'CT-' + Date.now() };
  };
  api.init = init;
  api._BOOKS = BOOKS;
  api._renderList = renderList;
  api._toast = toast;
  window.ApplyContractService = api;
  window.handleReject = handleReject;
  window.handleAccept = handleAccept;
})();
