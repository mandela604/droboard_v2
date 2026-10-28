/**
 * shared/kyc-panel.js — Author identity (KYC) panel + ID document viewer
 * ──────────────────────────────────────────────────────────────────────
 * One renderer for "what the author actually submitted": legal details,
 * identity path (self NIN / alternate ID / guardian co-sign) and the
 * uploaded document images, with a full-size viewer.
 *
 * Used by senior-editor/contract-review.html (identity gate before signing)
 * and senior-editor/author-verification.html (the review itself).
 *
 *   <script src="shared/kyc-panel.js"></script>
 *   html += KycPanel.html({ id:'CTR-001', author:'Luna Skye', bookTitle:'The Last Horizon', kyc:{…} })
 *   KycPanel.open(id, 'front')          // programmatic (clicks are handled for you)
 *   KycPanel.badge(kyc)
 *
 * kyc = { type:'self'|'pending'|'guardian', dob:'YYYY-MM-DD', age, nin,
 *         altId:{type,no}, guardian:{name,relationship,idNo},
 *         idPhotos:{front,back} }            ← exactly backend kycSchema
 * optional (verification form only, absent on contract applications):
 *         selfie, photo:{label}, phone, email, address, country, expiry, note
 * `idPhotos` values are Cloudflare Images delivery URLs in production (the demo
 * draws a document for bare file names instead).
 */
(function () {
  'use strict';
  if (window.KycPanel) return;

  var CSS = `
    .kyc-panel{background:var(--card,#fff);border:1px solid var(--border,#e5e5e5);border-radius:12px;padding:14px 16px;margin-bottom:16px}
    .kyc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
    .kyc-panel-title{font-size:10px;font-weight:700;color:var(--text-faint,#999);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:6px}
    .kyc-panel-title i{color:var(--accent,#ff0050)}
    .kyc-badge{display:inline-flex;align-items:center;gap:5px;font-size:9.5px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap}
    .kyc-badge i{font-size:9px}
    .kyc-badge.verified{background:var(--green-bg,#e4f8ea);color:var(--green,#16a34a)}
    .kyc-badge.guardian{background:var(--blue-bg,#e4eeff);color:var(--blue,#2563eb)}
    .kyc-badge.pending{background:var(--amber-bg,#fff6e0);color:var(--amber,#b7791f)}
    .kyc-badge.missing{background:var(--red-bg,#ffe5e8);color:var(--red,#e0384d)}
    .kyc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}
    .kyc-field{background:var(--input-bg,#fafafa);border:1px solid var(--border,#e5e5e5);border-radius:9px;padding:9px 11px;min-width:0}
    .kyc-field label{display:block;font-size:8.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-faint,#999);margin-bottom:3px}
    .kyc-field b{display:block;font-size:12.5px;font-weight:800;overflow-wrap:anywhere;line-height:1.3}
    .kyc-field b.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.03em}
    .kyc-field b small{font-size:10px;font-weight:600;color:var(--text-muted,#555);margin-left:2px}
    .kyc-photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}
    .kyc-photo{display:flex;align-items:center;gap:10px;text-align:left;padding:8px;background:var(--input-bg,#fafafa);border:1.5px solid var(--input-border,#e5e5e5);border-radius:10px;cursor:pointer;transition:.15s;font-family:inherit;color:var(--text,#1a1730);min-width:0}
    .kyc-photo:hover{border-color:var(--accent,#ff0050);background:var(--hover,#f3f3f3)}
    .kyc-photo.is-missing{cursor:default;border-style:dashed;opacity:.75}
    .kyc-photo-thumb{position:relative;width:88px;height:56px;flex-shrink:0;border-radius:6px;overflow:hidden;border:1px solid var(--border,#e5e5e5);background:#fff;display:flex;align-items:center;justify-content:center}
    .kyc-photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .kyc-photo-thumb>i{font-size:16px;color:var(--text-faint,#999)}
    .kyc-zoom{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,25,.45);color:#fff;font-size:13px;opacity:0;transition:.15s}
    .kyc-photo:hover .kyc-zoom{opacity:1}
    .kyc-photo-meta{min-width:0;display:block}
    .kyc-photo-meta b{display:block;font-size:11.5px;font-weight:800}
    .kyc-photo-meta small{display:block;font-size:10px;color:var(--text-faint,#999);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
    .kyc-photo-meta em{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:var(--accent,#ff0050);margin-top:3px;opacity:0;transition:.15s}
    .kyc-photo:hover .kyc-photo-meta em{opacity:1}
    .kyc-note{display:flex;align-items:flex-start;gap:6px;margin-top:11px;font-size:10.5px;line-height:1.5;color:var(--text-faint,#999)}
    .kyc-note i{margin-top:2px;color:var(--green,#16a34a)}
    .kyc-empty{display:flex;align-items:flex-start;gap:9px;background:var(--red-bg,#ffe5e8);border:1px solid rgba(224,56,77,.18);border-radius:10px;padding:11px 13px;color:var(--red,#e0384d);font-size:11.5px;line-height:1.55}
    .kyc-empty i{margin-top:2px}
    .kyc-empty b{display:block;font-size:12px;margin-bottom:2px}
    .kyc-empty span{color:var(--text-muted,#555)}
    .kyc-lightbox{position:fixed;inset:0;background:rgba(10,6,25,.78);z-index:5000;display:none;align-items:center;justify-content:center;padding:24px}
    .kyc-lightbox.open{display:flex}
    .kyc-lb-box{background:var(--card,#fff);border-radius:16px;width:100%;max-width:760px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.45)}
    .kyc-lb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border,#e5e5e5)}
    .kyc-lb-head b{display:block;font-size:13.5px;font-weight:800}
    .kyc-lb-head span{display:block;font-size:11px;color:var(--text-muted,#555);margin-top:2px}
    .kyc-lb-x{width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border,#e5e5e5);background:var(--input-bg,#fafafa);color:var(--text,#1a1730);cursor:pointer;font-size:12px;flex-shrink:0}
    .kyc-lb-x:hover{border-color:var(--accent,#ff0050);color:var(--accent,#ff0050)}
    .kyc-lb-imgwrap{padding:18px;overflow:auto;background:var(--hover,#f3f3f3);display:flex;align-items:center;justify-content:center;min-height:220px}
    .kyc-lb-imgwrap img{max-width:100%;max-height:64vh;border-radius:8px;box-shadow:0 12px 34px rgba(0,0,0,.18);display:block;background:#fff}
    .kyc-lb-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border,#e5e5e5);flex-wrap:wrap}
    .kyc-lb-foot .kyc-lb-note{flex:1;min-width:120px;display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--text-faint,#999)}
    .kyc-lb-foot .kyc-lb-note i{color:var(--green,#16a34a)}
    .kyc-lb-btn{display:inline-flex;align-items:center;gap:6px;background:var(--input-bg,#fafafa);color:var(--text-muted,#555);border:1px solid var(--input-border,#e5e5e5);border-radius:9px;padding:8px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:.15s}
    .kyc-lb-btn:hover:not(:disabled){border-color:var(--accent,#ff0050);color:var(--accent,#ff0050)}
    .kyc-lb-btn.on{border-color:var(--accent,#ff0050);color:var(--accent,#ff0050);background:var(--accent-soft,#ffe1eb)}
    .kyc-lb-btn:disabled{opacity:.4;cursor:not-allowed}
    @media(max-width:1200px){.kyc-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:640px){.kyc-photos{grid-template-columns:1fr}.kyc-grid{grid-template-columns:1fr}.kyc-lb-foot .kyc-lb-note{display:none}}
    @media(hover:none){.kyc-zoom{opacity:1;background:rgba(10,6,25,.22)}.kyc-photo-meta em{opacity:1}}
  `;

  var _records = {};
  var _lbRec = null;
  var _lbSide = 'front';
  var _clicksOn = false;

  function ensureStyle() {
    if (document.getElementById('kyc-style')) return;
    var st = document.createElement('style');
    st.id = 'kyc-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function date(d) {
    if (!d) return '—';
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var p = String(d).split('-');
    if (p.length !== 3) return esc(d);
    return parseInt(p[2], 10) + ' ' + m[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function name(rec) { return rec.author || rec.name || 'Author'; }
  function docLabel(rec) { return rec.bookTitle || rec.doc || rec.id || ''; }

  function badge(k) {
    if (!k) return '<span class="kyc-badge missing"><i class="fas fa-circle-exclamation"></i> Not submitted</span>';
    if (!k.idPhotos || !k.idPhotos.front || !k.idPhotos.back) return '<span class="kyc-badge pending"><i class="fas fa-image"></i> Photos missing</span>';
    if (k.type === 'guardian') return '<span class="kyc-badge guardian"><i class="fas fa-user-shield"></i> Guardian co-sign</span>';
    /* An alternate ID (passport, licence, voter's card) is its own verified path —
       only an alternate that is still waiting on the NIN reads as "pending". */
    if (k.altId) {
      if (k.type === 'pending') return '<span class="kyc-badge pending"><i class="fas fa-hourglass-half"></i> Pending NIN</span>';
      return '<span class="kyc-badge verified"><i class="fas fa-stamp"></i> Verified · ' + esc(k.altId.type) + '</span>';
    }
    return '<span class="kyc-badge verified"><i class="fas fa-shield-halved"></i> Verified · self NIN</span>';
  }

  function fields(rec) {
    var k = rec.kyc;
    var path = k.type === 'guardian' ? 'Guardian co-sign'
      : k.altId ? (k.type === 'pending' ? 'Pending NIN · alternate ID' : 'Verified · ' + esc(k.altId.type))
      : 'NIN verified';
    var f = [
      { l: 'Full legal name', v: esc(name(rec)) },
      { l: 'Date of birth', v: date(k.dob) + ' <small>age ' + esc(k.age) + '</small>' },
      { l: 'Identity path', v: path }
    ];
    if (k.type === 'guardian' && k.guardian) {
      f.push({ l: 'Guardian', v: esc(k.guardian.name) });
      f.push({ l: 'Relationship', v: esc(k.guardian.relationship) });
      f.push({ l: 'Guardian ID no.', v: esc(k.guardian.idNo), mono: true });
    } else if (k.altId) {
      f.push({ l: 'ID type', v: esc(k.altId.type) });
      f.push({ l: 'ID no.', v: esc(k.altId.no), mono: true });
    } else {
      f.push({ l: 'NIN', v: esc(k.nin), mono: true });
    }
    /* Contact rows only appear when the author actually gave them — the
       contract application collects less than the verification form. */
    if (k.phone) f.push({ l: 'Phone', v: esc(k.phone), mono: true });
    if (k.email) f.push({ l: 'Account email', v: esc(k.email) });
    if (k.address) f.push({ l: 'Address', v: esc(k.address) });
    if (k.country) f.push({ l: 'Country', v: esc(k.country) });
    return f;
  }

  /* Demo document preview: draws the submitted ID as a document so editors can
     inspect a face/ID pairing. In live mode idPhotos holds real image URLs. */
  function demoDoc(rec, k, side) {
    var guardian = k.type === 'guardian' && k.guardian;
    var pending = !!k.altId;
    var holder = guardian ? k.guardian.name : name(rec);
    var idNo = guardian ? k.guardian.idNo : (pending ? k.altId.no : k.nin);
    var issuer = guardian ? 'GUARDIAN IDENTIFICATION' : pending ? String(k.altId.type).toUpperCase() : 'FEDERAL REPUBLIC OF NIGERIA';
    var docTitle = guardian ? 'Guardian identity document' : pending ? String(k.altId.type) : 'National Identification Number (NIN) Slip';
    var idLabel = guardian ? 'GUARDIAN ID NUMBER' : pending ? 'ID NUMBER' : 'NATIONAL IDENTIFICATION NUMBER';
    var roleLine = guardian ? ('<text x="176" y="286" font-size="10" fill="#5c5c52" font-family="Arial">RELATIONSHIP: ' + esc(k.guardian.relationship).toUpperCase() + '</text>') : '';
    var digits = String(idNo || '').replace(/\D/g, '') || '1234567';
    var bars = '', i;
    for (i = 0; i < 46; i++) {
      var bh = 18 + (parseInt(digits.charAt(i % digits.length), 10) || i % 9) * 6;
      bars += '<rect x="' + (28 + i * 12) + '" y="' + (315 - bh) + '" width="' + (i % 4 === 0 ? 5 : 2.5) + '" height="' + bh + '" fill="#17171a"/>';
    }
    var front = ''
      + '<rect width="600" height="380" fill="#fbfaf4"/>'
      + '<rect width="600" height="72" fill="#0b6b3a"/>'
      + '<circle cx="40" cy="36" r="18" fill="none" stroke="#f0cf6b" stroke-width="2"/>'
      + '<text x="40" y="42" font-size="12" text-anchor="middle" fill="#f0cf6b" font-family="Georgia,serif" font-weight="700">NG</text>'
      + '<text x="72" y="31" font-size="14" font-weight="700" fill="#fff" font-family="Arial">' + esc(issuer) + '</text>'
      + '<text x="72" y="50" font-size="9.5" fill="#cfe8d8" font-family="Arial" letter-spacing="1.6">IDENTITY DOCUMENT · FRONT</text>'
      + '<text x="30" y="102" font-size="10.5" font-weight="700" fill="#0b6b3a" font-family="Arial" letter-spacing="1.1">' + esc(docTitle).toUpperCase() + '</text>'
      + '<rect x="30" y="118" width="118" height="150" rx="4" fill="#e7e7de" stroke="#c9c9bd"/>'
      + '<circle cx="89" cy="167" r="27" fill="#b9b9ac"/>'
      + '<path d="M45 268c5-37 25-55 44-55s39 18 44 55z" fill="#b9b9ac"/>'
      + '<text x="89" y="287" font-size="8" text-anchor="middle" fill="#8d8d80" font-family="Arial" letter-spacing="1">PHOTOGRAPH</text>'
      + '<text x="176" y="136" font-size="8.5" fill="#7a7a6f" font-family="Arial" letter-spacing="1">FULL NAME</text>'
      + '<text x="176" y="158" font-size="16" font-weight="700" fill="#17171a" font-family="Arial">' + esc(holder) + '</text>'
      + '<line x1="176" y1="168" x2="562" y2="168" stroke="#deded4"/>'
      + '<text x="176" y="191" font-size="8.5" fill="#7a7a6f" font-family="Arial" letter-spacing="1">DATE OF BIRTH</text>'
      + '<text x="176" y="211" font-size="13" font-weight="700" fill="#17171a" font-family="Arial">' + date(k.dob) + '</text>'
      + '<text x="380" y="191" font-size="8.5" fill="#7a7a6f" font-family="Arial" letter-spacing="1">AGE</text>'
      + '<text x="380" y="211" font-size="13" font-weight="700" fill="#17171a" font-family="Arial">' + esc(k.age) + ' years</text>'
      + '<text x="176" y="242" font-size="8.5" fill="#7a7a6f" font-family="Arial" letter-spacing="1">' + idLabel + '</text>'
      + '<text x="176" y="266" font-size="19" font-weight="700" fill="#0b6b3a" font-family="Courier New,monospace" letter-spacing="2">' + esc(idNo) + '</text>'
      + roleLine
      + '<rect x="0" y="322" width="600" height="58" fill="#0b6b3a" opacity=".07"/>'
      + '<text x="30" y="342" font-size="8" fill="#5c5c52" font-family="Arial" letter-spacing="1">THIS DOCUMENT REMAINS THE PROPERTY OF THE ISSUING AUTHORITY</text>';
    var back = ''
      + '<rect width="600" height="380" fill="#fbfaf4"/>'
      + '<rect width="600" height="72" fill="#0b6b3a"/>'
      + '<circle cx="40" cy="36" r="18" fill="none" stroke="#f0cf6b" stroke-width="2"/>'
      + '<text x="40" y="42" font-size="12" text-anchor="middle" fill="#f0cf6b" font-family="Georgia,serif" font-weight="700">NG</text>'
      + '<text x="72" y="31" font-size="14" font-weight="700" fill="#fff" font-family="Arial">' + esc(issuer) + '</text>'
      + '<text x="72" y="50" font-size="9.5" fill="#cfe8d8" font-family="Arial" letter-spacing="1.6">IDENTITY DOCUMENT · BACK</text>'
      + '<rect x="0" y="118" width="600" height="200" fill="#f3f2ea"/>'
      + bars
      + '<text x="300" y="368" font-size="9" text-anchor="middle" fill="#7a7a6f" font-family="Arial" letter-spacing="1">DOCUMENT NO. ' + esc(idNo) + ' · ' + esc(holder).toUpperCase() + '</text>'
      + '<text x="30" y="95" font-size="8.5" fill="#7a7a6f" font-family="Arial" letter-spacing="1">MACHINE READABLE ZONE</text>'
      + '<text x="30" y="108" font-size="10" fill="#17171a" font-family="Courier New,monospace" letter-spacing="1.4">IDNGA' + esc(idNo) + '&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>'
      + '<text x="30" y="345" font-size="8" fill="#5c5c52" font-family="Arial" letter-spacing="1">IF FOUND, RETURN TO THE NEAREST ISSUING OFFICE</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">' + (side === 'back' ? back : front) + '</svg>';
  }

  /* Side is any of front / back / selfie; `selfie` has no back, so the demo
     generator is only used for the two ID faces. */
  function photoSrc(rec, side) {
    var k = rec.kyc;
    if (!k) return '';
    var v = side === 'selfie' ? k.selfie : (k.idPhotos && k.idPhotos[side]);
    if (!v) return '';
    if (/^(https?:|data:|blob:|\/|\.{1,2}\/)/i.test(v)) return v;
    if (side === 'selfie') return '';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(demoDoc(rec, k, side));
  }

  function photoCard(rec, side, label) {
    var k = rec.kyc;
    var src = photoSrc(rec, side);
    var file = side === 'selfie' ? (k.selfie || '') : ((k.idPhotos && k.idPhotos[side]) || '');
    if (!src) {
      return '<div class="kyc-photo is-missing"><span class="kyc-photo-thumb"><i class="fas fa-image-slash"></i></span>'
        + '<span class="kyc-photo-meta"><b>' + esc(label) + '</b><small>Not uploaded</small></span></div>';
    }
    return '<button type="button" class="kyc-photo" data-kyc-view="' + esc(rec.id) + '" data-kyc-side="' + esc(side) + '" title="View full size">'
      + '<span class="kyc-photo-thumb"><img src="' + esc(src) + '" alt="' + esc(name(rec)) + ' ' + esc(label) + '"><span class="kyc-zoom"><i class="fas fa-magnifying-glass-plus"></i></span></span>'
      + '<span class="kyc-photo-meta"><b>' + esc(label) + '</b><small>' + esc(file) + '</small><em>Click to view full size</em></span>'
      + '</button>';
  }

  function photoSides(rec) {
    var out = [
      { side: 'front', label: 'ID photo — front' },
      { side: 'back', label: 'ID photo — back' }
    ];
    if (rec.kyc && rec.kyc.selfie) out.push({ side: 'selfie', label: rec.kyc.photo && rec.kyc.photo.label || 'Selfie with ID' });
    return out;
  }

  function html(rec) {
    if (!rec || !rec.id) return '';
    var k = rec.kyc;
    _records[String(rec.id)] = rec;
    var h = '<div class="kyc-panel"><div class="kyc-panel-head">'
      + '<div class="kyc-panel-title"><i class="fas fa-id-card"></i> Author Identity &amp; Personal Details</div>'
      + badge(k) + '</div>';
    if (!k) {
      h += '<div class="kyc-empty"><i class="fas fa-circle-exclamation"></i><div><b>No identity details submitted</b>'
        + '<span>This application has no KYC record. Ask the author to submit identity in the Author Center before signing.</span></div></div></div>';
      return h;
    }
    h += '<div class="kyc-grid">';
    fields(rec).forEach(function (f) {
      h += '<div class="kyc-field"><label>' + f.l + '</label><b' + (f.mono ? ' class="mono"' : '') + '>' + f.v + '</b></div>';
    });
    h += '</div><div class="kyc-photos">';
    photoSides(rec).forEach(function (p) { h += photoCard(rec, p.side, p.label); });
    h += '</div><div class="kyc-note"><i class="fas fa-lock"></i><span>'
      + (k.note ? esc(k.note) : 'Submitted by the author with this application. ID documents are confidential and visible only to senior editors.')
      + '</span></div></div>';
    return h;
  }

  function ensureLightbox() {
    if (document.getElementById('kycLightbox')) return;
    var d = document.createElement('div');
    d.id = 'kycLightbox';
    d.className = 'kyc-lightbox';
    d.innerHTML = '<div class="kyc-lb-box" role="dialog" aria-modal="true" aria-label="Submitted document viewer">'
      + '<div class="kyc-lb-head"><div><b id="kycLbTitle"></b><span id="kycLbSub"></span></div>'
      + '<button class="kyc-lb-x" id="kycLbClose" aria-label="Close"><i class="fas fa-xmark"></i></button></div>'
      + '<div class="kyc-lb-imgwrap"><img id="kycLbImg" alt="Submitted document"></div>'
      + '<div class="kyc-lb-foot"><span class="kyc-lb-note"><i class="fas fa-lock"></i> Confidential — senior editors only</span>'
      + '<span id="kycLbBtns" style="display:flex;gap:8px;flex-wrap:wrap"></span></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    document.getElementById('kycLbClose').onclick = close;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && d.classList.contains('open')) close();
    });
  }

  function render() {
    if (!_lbRec) return;
    var sides = photoSides(_lbRec);
    if (!photoSrc(_lbRec, _lbSide)) _lbSide = sides[0].side;
    var cur = sides.filter(function (s) { return s.side === _lbSide; })[0] || sides[0];
    document.getElementById('kycLbImg').src = photoSrc(_lbRec, _lbSide);
    document.getElementById('kycLbImg').alt = name(_lbRec) + ' ' + cur.label;
    document.getElementById('kycLbTitle').textContent = name(_lbRec) + ' — ' + cur.label;
    document.getElementById('kycLbSub').textContent = docLabel(_lbRec) + ' · ' + _lbRec.id;
    document.getElementById('kycLbBtns').innerHTML = sides.map(function (s) {
      var ic = s.side === 'front' ? 'fa-address-card' : s.side === 'back' ? 'fa-rotate' : 'fa-camera';
      return '<button class="kyc-lb-btn' + (s.side === _lbSide ? ' on' : '') + '" data-kyc-side="' + esc(s.side) + '"'
        + (photoSrc(_lbRec, s.side) ? '' : ' disabled') + '><i class="fas ' + ic + '"></i> '
        + (s.side === 'front' ? 'Front' : s.side === 'back' ? 'Back' : 'Selfie') + '</button>';
    }).join('');
  }

  function close() {
    var d = document.getElementById('kycLightbox');
    if (d) d.classList.remove('open');
  }

  function open(idOrRec, side) {
    var rec = typeof idOrRec === 'object' ? idOrRec : _records[String(idOrRec)];
    if (!rec || !rec.kyc) return;
    ensureStyle();
    _lbRec = rec;
    _lbSide = side || 'front';
    ensureLightbox();
    render();
    document.getElementById('kycLightbox').classList.add('open');
  }

  /* Delegated, so a re-rendered table never loses the viewer. */
  function bind() {
    if (_clicksOn || typeof document === 'undefined') return;
    _clicksOn = true;
    document.addEventListener('click', function (e) {
      var lbSide = e.target.closest && e.target.closest('#kycLbBtns [data-kyc-side]');
      if (lbSide && !lbSide.disabled) { _lbSide = lbSide.getAttribute('data-kyc-side'); render(); return; }
      var t = e.target.closest && e.target.closest('[data-kyc-view]');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      open(t.getAttribute('data-kyc-view'), t.getAttribute('data-kyc-side') || 'front');
    });
  }

  ensureStyle();
  bind();

  window.KycPanel = { html: html, badge: badge, open: open, close: close, esc: esc, date: date, photoSrc: photoSrc };
})();
