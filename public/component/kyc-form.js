/**
 * kyc-form.js — the single identity form for every surface that needs it:
 * writer profile verification and the contract application page.
 *
 *   KycForm.mount(containerEl, { submitLabel, backLabel, onSubmit, onBack })
 *   KycForm.read()        -> { kyc } | { err }
 *   KycForm.files()       -> { front: File, back: File }
 *   KycForm.reset() / showError(msg) / setBusy(on)
 *
 * Markup carries stable ids (kycDob, kycFront, …) — one instance per page.
 */
(function () {
  'use strict';
  if (window.KycForm) return;

  var STYLE_ID = 'kycFormStyle';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.kyc-card{background:var(--l1,#fff);border:1px solid var(--border,#e7e7ee);border-radius:14px;padding:16px}',
      '.kyc-label{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--tx-muted,#8e8e93);margin:14px 0 6px}',
      '.kyc-card .kyc-label:first-child{margin-top:0}',
      '.kyc-input{width:100%;padding:11px 12px;border:1.5px solid var(--border,#e2e2ea);border-radius:10px;background:var(--bg,#fff);font:inherit;font-size:13.5px;color:inherit;box-sizing:border-box}',
      '.kyc-input:focus{outline:none;border-color:var(--acc,#ff0050)}',
      '.kyc-hint{font-size:11.5px;color:var(--tx-muted,#8e8e93);margin-top:6px}',
      '.kyc-check{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;font-weight:600;margin-top:12px;cursor:pointer}',
      '.kyc-check input{margin-top:2px;accent-color:var(--acc,#ff0050)}',
      '.kyc-note{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5;background:rgba(255,0,80,.06);border:1px solid rgba(255,0,80,.15);border-radius:10px;padding:10px 12px;margin-top:12px;color:inherit}',
      '.kyc-note i{margin-top:2px;color:var(--acc,#ff0050);flex:none}',
      '.kyc-note span{flex:1}',
      '.kyc-uploads{display:flex;gap:10px;margin-top:10px}',
      '.kyc-upload{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px;border:1.5px dashed var(--border,#c9c9d4);border-radius:12px;background:var(--bg,#fafafc);cursor:pointer;text-align:center;transition:.15s}',
      '.kyc-upload:hover{border-color:var(--acc,#ff0050)}',
      '.kyc-upload i{font-size:18px;color:var(--acc,#ff0050)}',
      '.kyc-upload span{font-size:11.5px;font-weight:800}',
      '.kyc-upload em{font-size:10px;font-style:normal;color:var(--tx-muted,#8e8e93);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
      '.kyc-up-img{width:100%;height:96px;object-fit:cover;border-radius:8px;background:#0002}',
      '.kyc-upload.filled{border-style:solid;border-color:var(--green,#0f9d58);background:rgba(15,157,88,.06)}',
      '.kyc-upload.filled i{display:none}',
      '.kyc-upload.filled em{color:var(--green,#0f9d58);font-weight:700}',
      '.kyc-err{display:none;font-size:12.5px;font-weight:700;color:#e5484d;margin-top:12px}',
      '.kyc-err.show{display:block}',
      '.kyc-submit{display:block;width:100%;margin-top:16px;padding:13px;border:none;border-radius:12px;background:var(--acc,#ff0050);color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}',
      '.kyc-submit:disabled{opacity:.55;cursor:default}',
      '.kyc-back{display:block;width:100%;margin-top:10px;padding:10px;border:1px solid var(--border,#e2e2ea);border-radius:10px;background:none;font:inherit;font-size:12.5px;font-weight:700;color:var(--tx-muted,#8e8e93);cursor:pointer}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var MARKUP =
    '<div class="kyc-card">' +
      '<label class="kyc-label">Your date of birth *</label>' +
      '<input class="kyc-input" type="date" id="kycDob"/>' +
      '<div class="kyc-hint" id="kycAgeNote">We use this to choose the right signing path.</div>' +

      '<div id="photoBox" style="display:none">' +
        '<label class="kyc-label" id="photoLbl">ID photos *</label>' +
        '<div class="kyc-hint" style="margin-top:0">Clear photos of your ID, <b>front and back</b> — required by our editors.</div>' +
        '<div class="kyc-uploads">' +
          '<label class="kyc-upload" id="upFrontBox">' +
            '<input type="file" accept="image/*" id="kycFront" hidden/>' +
            '<img class="kyc-up-img" id="frontImg" alt="" hidden/>' +
            '<i class="fas fa-cloud-arrow-up"></i><span>Front of ID</span><em id="frontName">Tap to upload</em>' +
          '</label>' +
          '<label class="kyc-upload" id="upBackBox">' +
            '<input type="file" accept="image/*" id="kycBack" hidden/>' +
            '<img class="kyc-up-img" id="backImg" alt="" hidden/>' +
            '<i class="fas fa-cloud-arrow-up"></i><span>Back of ID</span><em id="backName">Tap to upload</em>' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div id="selfBox">' +
        '<label class="kyc-label">Your NIN (11 digits) *</label>' +
        '<input class="kyc-input" id="kycNin" inputmode="numeric" maxlength="11" placeholder="e.g. 12345678901"/>' +
        '<label class="kyc-check"><input type="checkbox" id="kycNoNin"/> I don\'t have my NIN yet — continue with an alternate ID</label>' +
        '<div id="altBox" style="display:none">' +
          '<label class="kyc-label">Alternate ID type *</label>' +
          '<select class="kyc-input" id="kycAltType">' +
            '<option value="">Select ID…</option>' +
            '<option>Voter\'s Card</option>' +
            '<option>International Passport</option>' +
            '<option>Driver\'s Licence</option>' +
            '<option>National Health ID</option>' +
          '</select>' +
          '<label class="kyc-label">ID number *</label>' +
          '<input class="kyc-input" id="kycAltNo" placeholder="ID number"/>' +
          '<div class="kyc-note"><i class="fas fa-circle-info"></i><span>Your application stays <b>Pending identity</b>. You keep writing and your earnings accrue in your wallet — signing and withdrawals unlock once your NIN is verified.</span></div>' +
        '</div>' +
      '</div>' +

      '<div id="guardianBox" style="display:none">' +
        '<div class="kyc-note"><i class="fas fa-user-shield"></i><span>Under-18 writers are welcome — a parent or guardian co-signs your contract.</span></div>' +
        '<label class="kyc-label">Guardian full name *</label>' +
        '<input class="kyc-input" id="kycGName" placeholder="Parent/guardian full name"/>' +
        '<label class="kyc-label">Relationship *</label>' +
        '<select class="kyc-input" id="kycGRel">' +
          '<option value="">Select…</option>' +
          '<option>Parent</option><option>Legal Guardian</option><option>Older Sibling (18+)</option><option>Other</option>' +
        '</select>' +
        '<label class="kyc-label">Guardian NIN or ID number *</label>' +
        '<input class="kyc-input" id="kycGId" placeholder="Guardian\'s NIN / ID number"/>' +
        '<label class="kyc-check"><input type="checkbox" id="kycGConsent"/> I confirm my guardian has agreed to co-sign.</label>' +
      '</div>' +

      '<div class="kyc-err" id="kycErr"></div>' +
      '<button class="kyc-submit" id="kycSubmitBtn" type="button"><i class="fas fa-paper-plane"></i> Submit</button>' +
      '<button class="kyc-back" id="kycBackBtn" type="button"><i class="fas fa-arrow-left"></i> Back</button>' +
    '</div>';

  var el = function (id) { return document.getElementById(id); };
  var opts = {};

  function ageFrom(dobStr) {
    if (!dobStr) return null;
    var d = new Date(dobStr), now = new Date();
    if (isNaN(d.getTime())) return null;
    var a = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  }

  function pathRefresh() {
    var age = ageFrom(el('kycDob').value);
    var note = el('kycAgeNote');
    var photoBox = el('photoBox');
    if (age !== null && (age < 10 || age > 110)) {
      note.textContent = 'Enter a valid date of birth.';
      el('guardianBox').style.display = 'none';
      el('selfBox').style.display = 'none';
      photoBox.style.display = 'none';
      return;
    }
    var minor = age !== null && age >= 0 && age < 18;
    el('guardianBox').style.display = minor ? 'block' : 'none';
    el('selfBox').style.display = (age === null || !minor) ? 'block' : 'none';
    if (age === null || age < 0) note.textContent = 'We use this to choose the right signing path.';
    else if (age < 18) note.innerHTML = '<b>Age ' + age + '</b> &mdash; guardian co-sign path. Parent/guardian signs with you.';
    else note.innerHTML = '<b>Age ' + age + '</b> &mdash; you can sign with your own NIN.';
    if (minor) el('kycNoNin').checked = false;
    if (age === null || age < 0 || age > 110) { photoBox.style.display = 'none'; return; }
    photoBox.style.display = 'block';
    var altType = el('kycAltType').value;
    if (minor) el('photoLbl').textContent = 'Photo of your guardian\u2019s ID *';
    else if (el('kycNoNin').checked) el('photoLbl').textContent = 'Photo of your ' + (altType || 'alternate') + ' *';
    else el('photoLbl').textContent = 'Photo of your NIN slip or ID *';
  }

  function clearPhoto(fileId, nameId, boxId, imgId) {
    var im = el(imgId);
    if (im.dataset.url && URL.revokeObjectURL) { try { URL.revokeObjectURL(im.dataset.url); } catch (e) {} }
    delete im.dataset.url;
    im.removeAttribute('src');
    im.hidden = true;
    el(fileId).value = '';
    el(nameId).textContent = 'Tap to upload';
    el(boxId).classList.remove('filled');
  }

  function bindPhoto(fileId, nameId, boxId, imgId) {
    el(fileId).addEventListener('change', function () {
      var f = this.files && this.files[0];
      var img = el(imgId);
      el(nameId).textContent = f ? f.name : 'Tap to upload';
      el(boxId).classList.toggle('filled', !!f);
      if (img.dataset.url && URL.revokeObjectURL) { try { URL.revokeObjectURL(img.dataset.url); } catch (e) {} }
      delete img.dataset.url;
      if (f && typeof URL !== 'undefined' && URL.createObjectURL) {
        var url = URL.createObjectURL(f);
        img.src = url;
        img.dataset.url = url;
        img.hidden = false;
      } else {
        img.removeAttribute('src');
        img.hidden = true;
      }
    });
  }

  function reset() {
    if (!el('kycDob')) return;
    el('kycDob').value = '';
    el('kycNin').value = '';
    el('kycNoNin').checked = false;
    el('altBox').style.display = 'none';
    el('kycAltType').value = '';
    el('kycAltNo').value = '';
    el('kycGName').value = '';
    el('kycGRel').value = '';
    el('kycGId').value = '';
    el('kycGConsent').checked = false;
    el('kycAgeNote').textContent = 'We use this to choose the right signing path.';
    el('kycErr').classList.remove('show');
    clearPhoto('kycFront', 'frontName', 'upFrontBox', 'frontImg');
    clearPhoto('kycBack', 'backName', 'upBackBox', 'backImg');
    el('kycDob').max = new Date().toISOString().slice(0, 10);
    pathRefresh();
  }

  function mount(container, options) {
    if (!container) return null;
    injectStyle();
    options = options || {};
    opts = options;
    container.innerHTML = MARKUP;

    el('kycSubmitBtn').textContent = options.submitLabel || 'Submit';
    el('kycBackBtn').innerHTML = '<i class="fas fa-arrow-left"></i> ' + (options.backLabel || 'Back');
    el('kycBackBtn').style.display = options.onBack ? '' : 'none';

    el('kycDob').addEventListener('input', pathRefresh);
    el('kycNoNin').addEventListener('change', function () {
      el('altBox').style.display = this.checked ? 'block' : 'none';
      pathRefresh();
    });
    el('kycAltType').addEventListener('change', pathRefresh);
    bindPhoto('kycFront', 'frontName', 'upFrontBox', 'frontImg');
    bindPhoto('kycBack', 'backName', 'upBackBox', 'backImg');

    el('kycSubmitBtn').addEventListener('click', function (e) {
      e.preventDefault();
      if (options.onSubmit) options.onSubmit();
    });
    el('kycBackBtn').addEventListener('click', function (e) {
      e.preventDefault();
      if (options.onBack) options.onBack();
    });

    reset();
    return window.KycForm;
  }

  function read() {
    var dob = el('kycDob').value;
    var age = ageFrom(dob);
    if (!dob) return { err: 'Enter your date of birth.' };
    if (age === null || age < 10 || age > 110) return { err: 'That date of birth looks invalid.' };
    var front = el('kycFront').files[0];
    var back = el('kycBack').files[0];
    if (!front || !back) return { err: 'Editors require clear photos of your ID — front AND back.' };
    var idPhotos = { front: front.name, back: back.name };
    if (age < 18) {
      var gName = el('kycGName').value.trim();
      var gRel = el('kycGRel').value;
      var gId = el('kycGId').value.trim();
      if (!gName) return { err: "Enter your guardian's full name." };
      if (!gRel) return { err: 'Select your relationship to the guardian.' };
      if (gId.length < 6) return { err: "Enter your guardian's NIN or ID number (6+ characters)." };
      if (!el('kycGConsent').checked) return { err: 'Your guardian must confirm consent to co-sign.' };
      return { kyc: { type: 'guardian', dob: dob, age: age, nin: '', guardian: { name: gName, relationship: gRel, idNo: gId }, idPhotos: idPhotos } };
    }
    if (el('kycNoNin').checked) {
      var aType = el('kycAltType').value;
      var aNo = el('kycAltNo').value.trim();
      if (!aType) return { err: 'Select an alternate ID type.' };
      if (aNo.length < 5) return { err: 'Enter your alternate ID number.' };
      return { kyc: { type: 'pending', dob: dob, age: age, nin: '', altId: { type: aType, no: aNo }, idPhotos: idPhotos } };
    }
    var nin = el('kycNin').value.trim();
    if (!/^\d{11}$/.test(nin)) return { err: 'NIN must be exactly 11 digits.' };
    return { kyc: { type: 'self', dob: dob, age: age, nin: nin, idPhotos: idPhotos } };
  }

  function files() {
    return { front: el('kycFront').files[0] || null, back: el('kycBack').files[0] || null };
  }

  function showError(msg) {
    var e = el('kycErr');
    if (!e) return;
    if (!msg) { e.classList.remove('show'); e.textContent = ''; return; }
    e.textContent = msg;
    e.classList.add('show');
  }

  function setBusy(on) {
    var b = el('kycSubmitBtn');
    if (!b) return;
    b.disabled = !!on;
    if (on) b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';
    else b.textContent = (opts && opts.submitLabel) || 'Submit';
  }

  window.KycForm = { mount: mount, read: read, files: files, reset: reset, showError: showError, setBusy: setBusy };
})();
