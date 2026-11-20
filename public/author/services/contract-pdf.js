/**
 * contract-pdf.js — signed-contract PDF for the author center.
 *
 * The author reviews an offer in a custom modal, signs it through the API, and
 * this module writes a real PDF (author name + full contract rules + signature
 * block) straight to the browser download. No third-party library: the writer
 * emits a minimal PDF 1.4 document using the built-in Helvetica fonts, so it
 * also works offline inside the Capacitor shell.
 *
 * Public API:
 *   ContractPdf.standardRules(data) -> string[]   (shared with the review modal)
 *   ContractPdf.clauseList(text)    -> string[]
 *   ContractPdf.download(data)      -> { fileName, bytes }
 */
(function () {
  'use strict';
  if (window.ContractPdf) return;

  var PW = 595.28, PH = 841.89, M = 54, BOTTOM = 66;
  var INK = [0.09, 0.09, 0.11];
  var MUTED = [0.44, 0.44, 0.48];
  var ACCENT = [1, 0, 0.31];
  var LINE = [0.84, 0.84, 0.87];

  function n(v) { return Number(v).toFixed(2); }

  // ASCII-only output keeps string length == byte length for the xref table.
  function clean(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2022/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function esc(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function measure(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), ch = s.charAt(i);
      if (c >= 65 && c <= 90) w += bold ? 0.72 : 0.67;
      else if (c >= 97 && c <= 122) w += 0.52;
      else if (c >= 48 && c <= 57) w += 0.556;
      else if (ch === ' ') w += 0.28;
      else if (ch === '.') w += 0.28;
      else if (ch === ',') w += 0.28;
      else if (ch === '-') w += 0.33;
      else w += 0.5;
    }
    return w * size;
  }

  function wrapText(text, size, bold, maxW) {
    var out = [], words = String(text).split(/\s+/), line = '';
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var test = line ? line + ' ' + word : word;
      if (line && measure(test, size, bold) > maxW) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
    return out.length ? out : [''];
  }

  function makeDoc() {
    var pages = [[]];
    var y = PH - M;

    function page() { return pages[pages.length - 1]; }
    function ensure(h) {
      if (y - h < BOTTOM) { pages.push([]); y = PH - M; }
    }
    function space(pt) { ensure(pt); y -= pt; }
    function text(str, o) {
      o = o || {};
      var size = o.size || 10.5;
      var bold = !!o.bold;
      var color = o.color || INK;
      var indent = o.indent || 0;
      var lead = o.lead || (size * 1.5);
      var lines = wrapText(clean(str), size, bold, PW - M * 2 - indent);
      for (var i = 0; i < lines.length; i++) {
        ensure(lead);
        page().push('BT /' + (bold ? 'F2' : 'F1') + ' ' + n(size) + ' Tf ' +
          color.join(' ') + ' rg 1 0 0 1 ' + n(M + indent) + ' ' + n(y) +
          ' Tm (' + esc(lines[i]) + ') Tj ET');
        y -= lead;
      }
    }
    function rule(color, gap) {
      ensure(12);
      page().push('q 0.8 w ' + (color || LINE).join(' ') + ' RG ' + n(M) + ' ' +
        n(y) + ' m ' + n(PW - M) + ' ' + n(y) + ' l S Q');
      y -= (gap == null ? 10 : gap);
    }
    function bullet(str) {
      var size = 10, lead = size * 1.5, indent = 16;
      var lines = wrapText(clean(str), size, false, PW - M * 2 - indent);
      for (var i = 0; i < lines.length; i++) {
        ensure(lead);
        if (i === 0) {
          page().push('BT /F1 10 Tf ' + INK.join(' ') + ' rg 1 0 0 1 ' + n(M + 3) + ' ' + n(y) + ' Tm (-) Tj ET');
        }
        page().push('BT /F1 10 Tf ' + INK.join(' ') + ' rg 1 0 0 1 ' + n(M + indent) + ' ' + n(y) + ' Tm (' + esc(lines[i]) + ') Tj ET');
        y -= lead;
      }
      y -= 2;
    }
    function kv(label, value) {
      var size = 10, lead = 16.5, indent = 128;
      var lines = wrapText(clean(value) || '—', size, false, PW - M * 2 - indent);
      for (var i = 0; i < lines.length; i++) {
        ensure(lead);
        if (i === 0) {
          page().push('BT /F2 9.5 Tf ' + MUTED.join(' ') + ' rg 1 0 0 1 ' + n(M) + ' ' + n(y) + ' Tm (' + esc(clean(label)) + ') Tj ET');
        }
        page().push('BT /F1 10 Tf ' + INK.join(' ') + ' rg 1 0 0 1 ' + n(M + indent) + ' ' + n(y) + ' Tm (' + esc(lines[i]) + ') Tj ET');
        y -= lead;
      }
      y -= 1;
    }
    function heading(title) {
      space(9);
      text(title.toUpperCase(), { size: 10, bold: true, color: ACCENT, lead: 17 });
      rule(LINE, 10);
    }

    return {
      pages: pages,
      text: text, space: space, rule: rule, bullet: bullet, kv: kv, heading: heading,
      top: function () { return y; }
    };
  }

  function fmtDate(v) {
    if (!v) return '—';
    var d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function fmtMoney(v) {
    var num = Number(v);
    if (!isFinite(num)) return '—';
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function clauseList(text) {
    if (!text) return [];
    var parts = String(text).split(/\r?\n+/);
    if (parts.length === 1 && parts[0].indexOf('\u00b7') !== -1) parts = parts[0].split('\u00b7');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim();
      if (s) out.push(s);
    }
    return out;
  }

  // Single source of truth for the rules: the review modal and the PDF render
  // exactly the same list, and every number comes from the actual offer.
  function standardRules(d) {
    d = d || {};
    var split = d.revenueSplit == null ? null : Number(d.revenueSplit);
    var platform = split == null ? null : (100 - split);
    var term = d.duration || (d.termMonths ? d.termMonths + ' months' : 'the term stated above');
    var title = d.bookTitle || 'the Book';
    return [
      'Scope. This agreement covers "' + title + '" and every chapter published under it on Droboard during the term.',
      'Rights granted. The author grants Droboard the right to publish, distribute, market and display the Book on the Droboard platform and its partner channels for the duration of the term.',
      'Copyright. The author keeps full copyright and ownership of the Book. This agreement does not transfer ownership.',
      split != null
        ? 'Royalty. The author receives ' + split + '% of net revenue earned by the Book, after platform and payment-processing fees; Droboard keeps ' + platform + '%.'
        : 'Royalty. The author receives the revenue share recorded in the contract terms above, paid on net revenue after platform and payment-processing fees.',
      'Term. The contract lasts ' + term + ' from the effective date, unless it is ended earlier under these rules.',
      d.autoRenew
        ? 'Renewal. The contract renews automatically for another equal term unless either party gives notice through the platform before the expiry date.'
        : 'Renewal. The contract does not renew automatically. Continuing beyond the expiry date requires a new signed agreement.',
      "Author warranties. The author confirms the Book is original, does not infringe anyone else's rights, and is not bound by another agreement that conflicts with this one.",
      "Content standards. The Book must follow Droboard's content and community policies. Droboard may unpublish material that breaks them without cancelling royalties already earned.",
      "Payments. Royalties are paid to the author's verified payout method on the platform payment schedule, subject to the minimum withdrawal threshold.",
      'Termination. Either party may end this agreement by written notice through the platform. On termination Droboard removes the Book from sale and pays royalties earned up to that date.',
      "Disputes. Both parties agree to use Droboard's dispute process first, then the platform's governing terms.",
      'Entire agreement. This contract, the terms above and the platform terms it references form the complete agreement between the author and Droboard.'
    ];
  }

  function buildPdf(pages, meta) {
    var total = pages.length;
    for (var p = 0; p < total; p++) {
      pages[p].push('q 0.8 w ' + LINE.join(' ') + ' RG ' + n(M) + ' 54 m ' + n(PW - M) + ' 54 l S Q');
      pages[p].push('BT /F1 8 Tf ' + MUTED.join(' ') + ' rg 1 0 0 1 ' + n(M) + ' 40 Tm (' +
        esc(clean('Droboard  -  Contract ' + (meta.contractId || '') + '  -  Page ' + (p + 1) + ' of ' + total)) + ') Tj ET');
    }

    var pageStart = 5;
    var contentStart = pageStart + total;
    var objects = [];
    var kids = [];
    for (var i = 0; i < total; i++) kids.push((pageStart + i) + ' 0 R');

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + total + ' >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    for (var j = 0; j < total; j++) {
      var stream = pages[j].join('\n');
      objects[pageStart + j] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(PW) + ' ' + n(PH) +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (contentStart + j) + ' 0 R >>';
      objects[contentStart + j] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
    }

    var out = '%PDF-1.4\n';
    var offsets = [];
    for (var k = 1; k < objects.length; k++) {
      offsets[k] = out.length;
      out += k + ' 0 obj\n' + objects[k] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
    for (var x = 1; x < objects.length; x++) {
      out += ('0000000000' + offsets[x]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';

    return out;
  }

  function download(data) {
    data = data || {};
    var doc = makeDoc();

    // Header band
    doc.pages[0].push('q ' + ACCENT.join(' ') + ' rg ' + n(M) + ' ' + n(PH - 50) + ' ' + n(PW - M * 2) + ' 3 re f Q');
    doc.space(26);
    doc.text('DROBOARD', { size: 9, bold: true, color: ACCENT, lead: 16 });
    doc.text('Publishing Contract', { size: 23, bold: true, color: INK, lead: 30 });
    doc.text('Electronic contract record for ' + (data.bookTitle || 'your book'), { size: 10.5, color: MUTED, lead: 20 });
    doc.space(4);
    doc.rule(LINE, 14);

    doc.kv('Contract reference', data.contractId || '—');
    doc.kv('Generated', fmtDate(data.signedAt || new Date()));

    doc.heading('Parties');
    doc.kv('Author', data.authorName || 'Author');
    if (data.authorHandle) doc.kv('Handle', '@' + data.authorHandle);
    doc.kv('Platform', 'Droboard');
    doc.kv('Book', data.bookTitle || '—');
    if (data.bookGenre) doc.kv('Genre', data.bookGenre);

    doc.heading('Contract terms');
    if (data.templateName) doc.kv('Template', data.templateName);
    doc.kv('Contract type', data.contractType || 'Publishing');
    doc.kv('Term', data.duration || (data.termMonths ? data.termMonths + ' months' : '—'));
    doc.kv('Revenue split', data.revenueSplit != null
      ? data.revenueSplit + '% author / ' + (100 - data.revenueSplit) + '% Droboard' : '—');
    doc.kv('Effective date', fmtDate(data.effectiveAt || data.signedAt || new Date()));
    doc.kv('Expiry date', data.expiryAt ? fmtDate(data.expiryAt) : '—');
    doc.kv('Auto-renewal', data.autoRenew ? 'Yes' : 'No');

    var b = data.bonuses || {};
    if (b.signupBonusMin || b.signupBonusMax) {
      doc.kv('Signup bonus', fmtMoney(b.signupBonusMin) + ' - ' + fmtMoney(b.signupBonusMax));
    }
    if (b.completionTarget) {
      doc.kv('Completion bonus', Number(b.completionTarget).toLocaleString('en-US') + ' reads' +
        (b.completionWindowMonths ? ' within ' + b.completionWindowMonths + ' months' : ''));
    }
    if (b.profitShareThreshold) {
      doc.kv('Profit-share bonus', fmtMoney(b.profitShareBonus) + ' at ' + fmtMoney(b.profitShareThreshold) + ' threshold');
    }

    if (data.description) {
      doc.heading('About this contract');
      doc.text(data.description, { size: 10, color: INK, lead: 15 });
      doc.space(2);
    }

    var clauses = clauseList(data.clauses);
    if (clauses.length) {
      doc.heading('Contract clauses set by the editorial team');
      for (var c = 0; c < clauses.length; c++) doc.bullet(clauses[c]);
      doc.space(2);
    }

    doc.heading('Contract rules');
    // The platform-wide rules the chief editor set (usually the backend
    // defaults if they never edited them); contract-pdf.js standardRules() is
    // the offline fallback.
    var rules = (Array.isArray(data.contractRules) && data.contractRules.length)
      ? data.contractRules
      : standardRules(data);
    for (var r = 0; r < rules.length; r++) doc.bullet(rules[r]);

    doc.heading('Electronic signature');
    doc.space(2);
    doc.text('Signed electronically by', { size: 9, bold: true, color: MUTED, lead: 15 });
    doc.text(data.authorName || 'Author', { size: 15, bold: true, color: INK, lead: 26 });
    doc.kv('Signed on', fmtDate(data.signedAt || new Date()));
    doc.kv('Signature reference', data.signatureRef || '—');
    doc.space(4);
    doc.rule(LINE, 12);
    doc.text('For Droboard', { size: 9, bold: true, color: MUTED, lead: 16 });
    doc.text('Name: ______________________________', { size: 10, lead: 18 });
    doc.text('Title: Authorized signatory', { size: 10, lead: 16 });
    doc.text('Date: ______________________________', { size: 10, lead: 16 });
    doc.space(6);
    doc.text('This copy records the author\'s electronic signature. Droboard countersigns the contract to activate it on the platform.',
      { size: 8.5, color: MUTED, lead: 13 });

    var pdf = buildPdf(doc.pages, { contractId: data.contractId || '' });
    var safeTitle = clean(data.bookTitle || 'contract').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    var fileName = 'droboard-contract-' + (safeTitle || 'book') + '.pdf';

    var blob = new Blob([pdf], { type: 'application/pdf' });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, fileName);
      return { fileName: fileName, bytes: pdf.length };
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
    }, 2000);
    return { fileName: fileName, bytes: pdf.length };
  }

  window.ContractPdf = {
    download: download,
    standardRules: standardRules,
    clauseList: clauseList,
    _build: buildPdf,
    _clean: clean
  };
})();
