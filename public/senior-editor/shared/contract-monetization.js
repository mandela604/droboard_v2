/**
 * shared/contract-monetization.js — Contract Monetization component
 * ─────────────────────────────────────────────────────────────────
 * Free chapters + ads-to-unlock + searchable per-chapter pricing table.
 * Used by BOTH senior-editor/review-queue.html (Accept wizard) and
 * senior-editor/contract-review.html (pre-sign terms). Self-contained
 * CSS (cm- prefix) + DOM. Backend: persist getTerms() to
 * PUT /api/contracts/:id/pricing.
 *
 *   <script src="shared/contract-monetization.js"></script>
 *   const mz = ContractMonetization.mount('#mzMount', {
 *     chapters: [{num:1,title:'...'}],   // or totalChapters: 12
 *     initial: { freeChapters:3, adsPerChapter:2, allowAdUnlock:true },
 *     readOnly: false,
 *     onChange: (terms) => {},
 *   });
 *   mz.getTerms() → { freeChapters, adsPerChapter, allowAdUnlock,
 *                     rows:[{num,title,price,ads,free}], paid:[...],
 *                     summary:'Accepted under …' }
 *   mz.setReadOnly(true)
 */
(function () {
  'use strict';
  if (window.ContractMonetization) return;

  const CSS = `
    .cm-wrap{font-family:inherit}
    .cm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media(max-width:560px){.cm-grid2{grid-template-columns:1fr}}
    .cm-field{margin-bottom:12px}
    .cm-field>label{font-size:11px;font-weight:700;color:var(--text-muted,#555);display:block;margin-bottom:6px}
    .cm-field input[type=number]{width:100%;background:var(--input-bg,#fff);border:1.5px solid var(--input-border,#ddd);border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600;color:var(--text,#1a1730);font-family:inherit;outline:none}
    .cm-field input[type=number]:focus{border-color:var(--accent,#ff0050)}
    .cm-field small{font-size:10.5px;color:var(--text-faint,#999);display:block;margin-top:4px;line-height:1.5}
    .cm-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--input-bg,#fafafa);border:1px solid var(--input-border,#e5e5e5);border-radius:10px;padding:10px 14px;margin-bottom:12px}
    .cm-toggle-label{font-size:12.5px;font-weight:700;color:var(--text,#1a1730)}
    .cm-toggle-sub{font-size:10.5px;color:var(--text-faint,#999);margin-top:2px}
    .cm-switch{position:relative;width:42px;height:24px;flex-shrink:0;cursor:pointer}
    .cm-switch input{opacity:0;width:0;height:0}
    .cm-slider{position:absolute;inset:0;background:#ccc;border-radius:24px;transition:.2s}
    .cm-slider:before{content:'';position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
    .cm-switch input:checked + .cm-slider{background:var(--accent,#ff0050)}
    .cm-switch input:checked + .cm-slider:before{transform:translateX(18px)}
    .cm-search{display:flex;align-items:center;gap:9px;background:var(--input-bg,#fff);border:1.5px solid var(--input-border,#ddd);border-radius:10px;padding:9px 14px;margin:14px 0 10px}
    .cm-search:focus-within{border-color:var(--accent,#ff0050)}
    .cm-search input{border:none;background:none;outline:none;flex:1;font-size:12.5px;font-family:inherit;color:var(--text,#1a1730)}
    .cm-search i{color:var(--text-faint,#999);font-size:12px}
    .cm-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .cm-count{font-size:11px;font-weight:700;color:var(--text-muted,#555)}
    .cm-bulk{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text-muted,#555);font-weight:600}
    .cm-bulk input{width:64px;background:var(--input-bg,#fff);border:1.5px solid var(--input-border,#ddd);border-radius:8px;padding:6px 8px;font-size:12px;font-weight:700;font-family:inherit;text-align:center}
    .cm-bulk button{background:var(--accent,#ff0050);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit}
    .cm-list{max-height:300px;overflow-y:auto;border:1px solid var(--border,#e5e5e5);border-radius:10px}
    .cm-head,.cm-row{display:grid;grid-template-columns:1fr 90px 90px 90px;gap:6px;align-items:center;padding:8px 12px}
    .cm-head{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-faint,#999);border-bottom:1px solid var(--border,#e5e5e5);position:sticky;top:0;background:var(--card,#fff);z-index:1}
    .cm-head span:nth-child(n+2){text-align:center}
    .cm-row{border-bottom:1px solid var(--hover,#f3f3f3);font-size:12px}
    .cm-row:last-child{border-bottom:none}
    .cm-row .cm-ch{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cm-row .cm-ch small{display:block;font-weight:500;color:var(--text-faint,#999);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cm-free-tag{font-size:9px;font-weight:800;color:var(--green,#16a34a);background:var(--green-bg,#e4f8ea);padding:2px 8px;border-radius:8px}
    .cm-paid-tag{font-size:9px;font-weight:700;color:var(--text-muted,#555)}
    .cm-row input[type=number]{width:64px;background:var(--input-bg,#fff);border:1.5px solid var(--input-border,#ddd);border-radius:8px;padding:6px 6px;font-size:12px;font-weight:700;text-align:center;font-family:inherit}
    .cm-row input[type=number]:focus{border-color:var(--accent,#ff0050);outline:none}
    .cm-ads-badge{font-size:10px;font-weight:700;color:var(--purple,#7c3aed);background:rgba(124,58,237,.08);padding:3px 9px;border-radius:8px;white-space:nowrap}
    .cm-dash{color:var(--text-faint,#bbb);font-size:11px}
    .cm-note{display:flex;gap:7px;align-items:flex-start;font-size:10.5px;color:var(--text-muted,#555);background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.15);border-radius:8px;padding:8px 12px;margin-top:10px;line-height:1.5}
    .cm-note i{color:var(--purple,#7c3aed);margin-top:1px}
    .cm-summary{margin-top:12px;border:1px solid var(--border,#e5e5e5);border-radius:10px;overflow:hidden}
    .cm-sum-row{display:flex;justify-content:space-between;gap:10px;padding:8px 14px;font-size:12px;border-bottom:1px solid var(--hover,#f3f3f3)}
    .cm-sum-row:last-child{border-bottom:none}
    .cm-sum-row span:first-child{color:var(--text-muted,#555);font-weight:600}
    .cm-sum-row span:last-child{font-weight:800;text-align:right}
    .cm-empty{padding:22px;text-align:center;font-size:12px;color:var(--text-faint,#999)}
    .cm-ro-banner{background:var(--green-bg,#e4f8ea);border:1px solid rgba(22,163,74,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11.5px;color:var(--green,#16a34a);font-weight:600}
  `;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ensureStyle() {
    if (document.getElementById('cm-style')) return;
    var st = document.createElement('style');
    st.id = 'cm-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(sel, opts) {
    ensureStyle();
    var root = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!root) return null;
    opts = opts || {};

    var chapters = [];
    if (Array.isArray(opts.chapters) && opts.chapters.length) {
      chapters = opts.chapters.map(function (c, i) {
        return typeof c === 'number' ? { num: c, title: '' } : { num: c.num || (i + 1), title: c.title || '' };
      });
    } else {
      var n = Math.max(1, parseInt(opts.totalChapters, 10) || 12);
      for (var i = 1; i <= n; i++) chapters.push({ num: i, title: '' });
    }

    var init = opts.initial || {};
    var state = {
      freeChapters: Math.max(0, parseInt(init.freeChapters, 10) || 0),
      adsPerChapter: Math.max(0, parseInt(init.adsPerChapter, 10) || 0),
      allowAdUnlock: init.allowAdUnlock !== false,
      readOnly: !!opts.readOnly,
      query: '',
      rows: chapters.map(function (c) {
        var free = c.num <= (Math.max(0, parseInt(init.freeChapters, 10) || 0));
        var pr = init.prices && init.prices[c.num] != null ? parseInt(init.prices[c.num], 10) || 0 : (free ? 0 : 15);
        var ad = init.ads && init.ads[c.num] != null ? parseInt(init.ads[c.num], 10) || 0
          : (free ? 0 : ((init.allowAdUnlock !== false) ? (Math.max(0, parseInt(init.adsPerChapter, 10) || 0)) : 0));
        return { num: c.num, title: c.title, price: pr, ads: ad };
      }),
      onChange: (typeof opts.onChange === 'function') ? opts.onChange : null,
    };

    function isFree(num) { return num <= state.freeChapters; }
    function paidRows() { return state.rows.filter(function (r) { return r.num > state.freeChapters; }); }
    function filteredRows() {
      var q = (state.query || '').trim().toLowerCase();
      if (!q) return state.rows;
      return state.rows.filter(function (r) {
        return String(r.num) === q || ('ch.' + r.num).indexOf(q) === 0 ||
          ('chapter ' + r.num).indexOf(q) === 0 || (r.title || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    function getTerms() {
      var paid = paidRows();
      return {
        freeChapters: state.freeChapters,
        adsPerChapter: state.adsPerChapter,
        allowAdUnlock: state.allowAdUnlock,
        rows: state.rows.map(function (r) {
          return { num: r.num, title: r.title, price: isFree(r.num) ? 0 : r.price, ads: (!isFree(r.num) && state.allowAdUnlock) ? r.ads : 0, free: isFree(r.num) };
        }),
        paidCount: paid.length,
        adChapters: paid.filter(function (r) { return state.allowAdUnlock && r.ads > 0; }).length,
      };
    }

    function summaryHTML(t) {
      var h = '<div class="cm-summary">';
      h += '<div class="cm-sum-row"><span>Free chapters</span><span>' + (t.freeChapters > 0 ? '1 – ' + t.freeChapters : 'None') + '</span></div>';
      h += '<div class="cm-sum-row"><span>Ad unlock</span><span>' + (t.allowAdUnlock ? t.adsPerChapter + ' ads/chapter (' + t.adChapters + ' chapters)' : 'OFF') + '</span></div>';
      t.rows.filter(function (r) { return !r.free; }).forEach(function (r) {
        h += '<div class="cm-sum-row"><span>Ch. ' + r.num + '</span><span>' + r.price + ' coins' + (r.ads > 0 ? ' or ' + r.ads + ' ads' : '') + '</span></div>';
      });
      return h + '</div>';
    }

    function emit() { if (state.onChange) { try { state.onChange(getTerms()); } catch (e) {} } }

    function render() {
      var t = getTerms();
      var rows = filteredRows();
      var h = '<div class="cm-wrap">';
      if (state.readOnly) {
        h += '<div class="cm-ro-banner"><i class="fas fa-lock" style="margin-right:6px"></i>Locked — terms signed and read-only.</div>';
      }
      h += '<div class="cm-grid2">'
        + '<div class="cm-field"><label>Free chapters (lock after)</label>'
        + '<input type="number" data-cm="free" value="' + state.freeChapters + '" min="0" max="200"' + (state.readOnly ? ' disabled' : '') + '/>'
        + '<small>First N chapters are free. Paywall starts at chapter N+1.</small></div>'
        + '<div class="cm-field"><label>Ads per chapter</label>'
        + '<input type="number" data-cm="ads" value="' + state.adsPerChapter + '" min="0" max="10"' + (state.readOnly ? ' disabled' : '') + '/>'
        + '<small>How many ads a reader watches to unlock (applies to paid chapters).</small></div></div>';
      h += '<div class="cm-toggle-row"><div><div class="cm-toggle-label">Allow ad-based chapter unlock</div>'
        + '<div class="cm-toggle-sub">Turn off to make all chapters coin-only (no ad option)</div></div>'
        + '<label class="cm-switch"><input type="checkbox" data-cm="allow"' + (state.allowAdUnlock ? ' checked' : '') + (state.readOnly ? ' disabled' : '') + '/><span class="cm-slider"></span></label></div>';
      h += '<div class="cm-search"><i class="fas fa-magnifying-glass"></i>'
        + '<input type="text" data-cm="search" placeholder="Search chapter… e.g. 12 or “twist”" value="' + esc(state.query) + '"/></div>';
      h += '<div class="cm-meta"><span class="cm-count">' + state.rows.length + ' chapters · ' + t.paidCount + ' paid</span>';
      if (!state.readOnly && t.paidCount > 0) {
        h += '<span class="cm-bulk"><span>All paid to</span><input type="number" data-cm="bulk" value="15" min="0" max="999"/><span>coins</span><button type="button" data-cm="apply">Apply</button></span>';
      }
      h += '</div>';
      h += '<div class="cm-list"><div class="cm-head"><span>Chapter</span><span>Status</span><span>Coins</span><span>Ads</span></div>';
      if (!rows.length) {
        h += '<div class="cm-empty">No chapters match “' + esc(state.query) + '”.</div>';
      } else {
        h += rows.map(function (r) {
          var free = r.num <= state.freeChapters;
          return '<div class="cm-row" data-num="' + r.num + '">'
            + '<span class="cm-ch">Ch. ' + r.num + (r.title ? '<small>' + esc(r.title) + '</small>' : '') + '</span>'
            + '<span>' + (free ? '<span class="cm-free-tag">FREE</span>' : '<span class="cm-paid-tag">Paid</span>') + '</span>'
            + '<span style="text-align:center">' + (free || state.readOnly
              ? '<span class="cm-dash">—</span>'
              : '<input type="number" data-cm="price" data-num="' + r.num + '" value="' + r.price + '" min="0" max="999"/>') + '</span>'
            + '<span style="text-align:center">' + (free ? '<span class="cm-dash">—</span>'
              : (state.allowAdUnlock && r.ads > 0 ? '<span class="cm-ads-badge">' + r.ads + ' ads</span>' : '<span class="cm-dash">—</span>')) + '</span>'
            + '</div>';
        }).join('');
      }
      h += '</div>';
      if (state.allowAdUnlock) {
        h += '<div class="cm-note"><i class="fas fa-circle-info"></i><span>Ad count set above. Override per chapter when saving (backend: rows[].ads).</span></div>';
      }
      h += summaryHTML(t);
      h += '</div>';
      root.innerHTML = h;
    }

    // delegated events (survives re-render)
    root.addEventListener('input', function (e) {
      var k = e.target && e.target.dataset ? e.target.dataset.cm : null;
      if (!k || state.readOnly) return;
      if (k === 'free') {
        state.freeChapters = Math.max(0, parseInt(e.target.value, 10) || 0);
        state.rows.forEach(function (r) {
          var free = r.num <= state.freeChapters;
          if (free) { r.price = 0; r.ads = 0; }
          else { if (!r.price) r.price = 15; if (state.allowAdUnlock && !r.ads) r.ads = state.adsPerChapter; }
        });
        render(); emit();
      } else if (k === 'ads') {
        state.adsPerChapter = Math.max(0, parseInt(e.target.value, 10) || 0);
        state.rows.forEach(function (r) { if (r.num > state.freeChapters) r.ads = state.adsPerChapter; });
        render(); emit();
      } else if (k === 'search') {
        state.query = e.target.value;
        // filter without full re-render (keeps focus + typed price inputs)
        var q = state.query.trim().toLowerCase();
        root.querySelectorAll('.cm-row').forEach(function (row) {
          var num = row.dataset.num || '';
          var title = ((row.querySelector('.cm-ch small') || {}).textContent || '').toLowerCase();
          var hit = !q || num === q || ('ch.' + num).indexOf(q) === 0 || ('chapter ' + num).indexOf(q) === 0 || title.indexOf(q) !== -1;
          row.style.display = hit ? '' : 'none';
        });
        var vis = root.querySelectorAll('.cm-row:not([style*="none"])').length;
        var cnt = root.querySelector('.cm-count');
        if (cnt) cnt.textContent = state.rows.length + ' chapters · ' + getTerms().paidCount + ' paid' + (q ? ' · ' + vis + ' shown' : '');
      } else if (k === 'price') {
        var row = state.rows.find(function (r) { return r.num === parseInt(e.target.dataset.num, 10); });
        if (row) row.price = Math.max(0, parseInt(e.target.value, 10) || 0);
        emit();
      } else if (k === 'bulk') {
        // staged until Apply
      }
    });

    root.addEventListener('change', function (e) {
      var k = e.target && e.target.dataset ? e.target.dataset.cm : null;
      if (!k || state.readOnly) return;
      if (k === 'allow') {
        state.allowAdUnlock = !!e.target.checked;
        if (!state.allowAdUnlock) state.rows.forEach(function (r) { r.ads = 0; });
        else state.rows.forEach(function (r) { if (r.num > state.freeChapters && !r.ads) r.ads = state.adsPerChapter; });
        render(); emit();
      } else if (k === 'price') {
        // commit on blur/change too
        var row = state.rows.find(function (r) { return r.num === parseInt(e.target.dataset.num, 10); });
        if (row) row.price = Math.max(0, parseInt(e.target.value, 10) || 0);
        render(); emit();
      }
    });

    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-cm="apply"]');
      if (!el || state.readOnly) return;
      var inp = root.querySelector('[data-cm="bulk"]');
      var v = Math.max(0, parseInt(inp && inp.value, 10) || 0);
      state.rows.forEach(function (r) { if (r.num > state.freeChapters) r.price = v; });
      render(); emit();
    });

    // sync price inputs into state without losing focus/scroll
    function syncFromDOM() {
      root.querySelectorAll('[data-cm="price"]').forEach(function (inp) {
        var row = state.rows.find(function (r) { return r.num === parseInt(inp.dataset.num, 10); });
        if (row) row.price = Math.max(0, parseInt(inp.value, 10) || 0);
      });
    }

    render();

    return {
      getTerms: function () { syncFromDOM(); return getTerms(); },
      setReadOnly: function (ro) { state.readOnly = !!ro; render(); },
      setChapters: function (chapters, initial) {
        var list = Array.isArray(chapters) ? chapters : [];
        state.rows = list.map(function (c, i) {
          var num = (typeof c === 'number') ? c : (c.num || (i + 1));
          var title = (typeof c === 'number') ? '' : (c.title || '');
          var free = num <= state.freeChapters;
          return { num: num, title: title, price: free ? 0 : 15, ads: free ? 0 : (state.allowAdUnlock ? state.adsPerChapter : 0) };
        });
        if (initial) {
          if (initial.freeChapters != null) state.freeChapters = Math.max(0, parseInt(initial.freeChapters, 10) || 0);
          if (initial.adsPerChapter != null) state.adsPerChapter = Math.max(0, parseInt(initial.adsPerChapter, 10) || 0);
          if (initial.allowAdUnlock != null) state.allowAdUnlock = !!initial.allowAdUnlock;
          if (initial.prices) Object.keys(initial.prices).forEach(function (k) {
            var row = state.rows.find(function (r) { return r.num === parseInt(k, 10); });
            if (row) row.price = Math.max(0, parseInt(initial.prices[k], 10) || 0);
          });
          if (initial.ads) Object.keys(initial.ads).forEach(function (k) {
            var row = state.rows.find(function (r) { return r.num === parseInt(k, 10); });
            if (row) row.ads = Math.max(0, parseInt(initial.ads[k], 10) || 0);
          });
        }
        render(); emit();
      },
    };
  }

  window.ContractMonetization = { mount: mount };
})();
