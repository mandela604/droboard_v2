/**
 * acquisition-page-service.js — Acquisition dashboard logic (pure call-and-render).
 * acquisition.html only loads this + calls init(). Data from window.Acquisition.
 */
(function () {
  'use strict';
  if (window.AcquisitionPage && window.AcquisitionPage.__ready) return;

  var days = 30;
  var summary = null;
  var editingId = null;
  var CMP_PAGE_SIZE = 6;   /* Campaign Comparison rows per page */
  var LIST_PAGE_SIZE = 5;  /* Your Campaigns cards per page */
  var comparePage = 1;
  var listPage = 1;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtUSD(n) {
    n = Math.round((Number(n) || 0) * 100) / 100;
    if (window.DroboardCurrency && DroboardCurrency.usdToMoney) { try { return DroboardCurrency.usdToMoney(n); } catch (e) {} }
    return '$' + n.toFixed(2);
  }
  function fmtN(n) { return (Math.round(Number(n) || 0)).toLocaleString('en-US'); }
  function fmtPct(n) { return n == null ? '—' : n + '%'; }
  function toast(m) { if (typeof window.toast === 'function') { try { window.toast(m); return; } catch (e) {} } }

  /* ── Pagination helper ── */
  function renderPager(containerId, page, pageSize, total, onGo) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var pages = Math.max(1, Math.ceil((total || 0) / pageSize));
    if (page > pages) page = pages;
    if (total <= pageSize) { el.innerHTML = ''; return; }
    var html = '<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;font-size:11.5px;color:var(--text-muted)">'
      + '<span>Page ' + page + ' of ' + pages + '</span>'
      + '<button class="btn-aq-mini" data-pg="' + containerId + '" data-to="prev"' + (page <= 1 ? ' disabled style="opacity:.4;cursor:default"' : '') + '><i class="fas fa-chevron-left"></i></button>'
      + '<button class="btn-aq-mini" data-pg="' + containerId + '" data-to="next"' + (page >= pages ? ' disabled style="opacity:.4;cursor:default"' : '') + '><i class="fas fa-chevron-right"></i></button>'
      + '</div>';
    el.innerHTML = html;
    el.querySelectorAll('button[data-to]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var to = btn.getAttribute('data-to') === 'next' ? page + 1 : page - 1;
        onGo(to);
      });
    });
  }

  function pageSlice(rows, page, size) {
    var start = (Math.max(1, page) - 1) * size;
    return { slice: rows.slice(start, start + size), start: start };
  }

  /* ── Stat cards ── */
  function renderStats() {
    var el = document.getElementById('statCards');
    if (!el || !summary) return;
    var t = summary.totals;
    var cards = [
      { n: fmtUSD(t.spend), l: 'Ad Spend', ico: 'fa-credit-card', clr: 'var(--amber)', bg: 'var(--amber-bg)', sub: summary.days + '-day total' },
      { n: fmtN(t.firstReaders), l: 'First-Time Readers', ico: 'fa-book-open', clr: 'var(--accent)', bg: 'rgba(255,0,80,.1)', sub: fmtN(t.registrations) + ' registrations' },
      { n: t.costPerReader == null ? '—' : fmtUSD(t.costPerReader), l: 'Cost per Reader', ico: 'fa-bullseye', clr: 'var(--blue)', bg: 'var(--blue-bg)', sub: 'spend ÷ first readers' },
      { n: fmtPct(t.d7Retention), l: 'D7 Retention', ico: 'fa-rotate', clr: 'var(--green)', bg: 'var(--green-bg)', sub: 'returned after 7 days' },
      { n: fmtUSD(t.coinRevenue), l: 'Coin Purchases', ico: 'fa-coins', clr: 'var(--purple)', bg: 'var(--purple-bg)', sub: 'attributed, confirmed' },
      { n: fmtUSD(t.adEarnings), l: 'Ad Earnings (est.)', ico: 'fa-rectangle-ad', clr: 'var(--blue)', bg: 'var(--blue-bg)', sub: fmtN(t.impressions) + ' impressions' },
      { n: t.avgPages + '', l: 'Avg Pages / Visitor', ico: 'fa-file-lines', clr: 'var(--green)', bg: 'var(--green-bg)', sub: 'exploration depth' },
      { n: fmtUSD(t.contribution), l: 'Platform Contribution', ico: 'fa-scale-balanced', clr: t.contribution >= 0 ? 'var(--green)' : 'var(--red)', bg: t.contribution >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', sub: 'revenue − costs', win: t.contribution >= 0 },
    ];
    el.innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="stat-ico" style="background:' + c.bg + ';color:' + c.clr + '"><i class="fas ' + c.ico + '"></i></div>'
        + '<div><div class="stat-num" style="' + (c.win === false ? 'color:var(--red)' : '') + '">' + esc(c.n) + '</div>'
        + '<div class="stat-lbl">' + esc(c.l) + '</div>'
        + '<div class="stat-sub">' + esc(c.sub) + '</div></div></div>';
    }).join('');
  }

  /* ── Campaign comparison (paginated) ── */
  function renderCampaigns() {
    var el = document.getElementById('campaignBody');
    if (!el || !summary) return;
    var rows = summary.campaigns || [];
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="12" class="aq-empty">No campaigns in this period.</td></tr>';
      renderPager('comparePager', 1, CMP_PAGE_SIZE, 0, function () {});
      return;
    }
    var best = rows.reduce(function (m, r) { return (r.contribution > (m ? m.contribution : -Infinity)) ? r : m; }, null);
    var pages = Math.max(1, Math.ceil(rows.length / CMP_PAGE_SIZE));
    if (comparePage > pages) comparePage = pages;
    var p = pageSlice(rows, comparePage, CMP_PAGE_SIZE);
    var numFrom = p.start + 1, numTo = Math.min(rows.length, p.start + CMP_PAGE_SIZE);
    el.innerHTML = p.slice.map(function (r) {
      var isBest = best && r.campaignId === best.campaignId && r.contribution > 0;
      return '<tr>'
        + '<td style="font-weight:700">' + esc(r.label) + (isBest ? ' <span class="pill">winner</span>' : '') + '</td>'
        + '<td><span class="dest-chip ' + esc(r.destination) + '">' + esc(r.destination) + '</span></td>'
        + '<td class="num">' + fmtUSD(r.spend) + '</td>'
        + '<td class="num">' + fmtN(r.visitors) + '</td>'
        + '<td class="num">' + fmtN(r.registrations) + '</td>'
        + '<td class="num">' + (r.costPerRegistration == null ? '—' : fmtUSD(r.costPerRegistration)) + '</td>'
        + '<td class="num">' + fmtN(r.firstReaders) + '</td>'
        + '<td class="num ' + (r === best ? 'win' : '') + '">' + (r.costPerReader == null ? '—' : fmtUSD(r.costPerReader)) + '</td>'
        + '<td class="num">' + fmtPct(r.d7Retention) + '</td>'
        + '<td class="num">' + fmtUSD(r.coinRevenue) + '</td>'
        + '<td class="num">' + fmtUSD(r.adEarnings) + '</td>'
        + '<td class="num"><span class="' + (r.contribution >= 0 ? 'pill' : 'pill neg') + '">' + fmtUSD(r.contribution) + '</span></td>'
        + '</tr>';
    }).join('') + '<tr><td colspan="12" style="font-size:10.5px;color:var(--text-faint);padding:8px">Showing ' + numFrom + '–' + numTo + ' of ' + rows.length + '</td></tr>';
    renderPager('comparePager', comparePage, CMP_PAGE_SIZE, rows.length, function (to) {
      comparePage = to;
      renderCampaigns();
    });
  }

  /* ── Spend log (latest entries) ── */
  function renderSpendLog() {
    var el = document.getElementById('spendLog');
    if (!el) return;
    var rows = Acquisition.getSpend().slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.addedAt.localeCompare(a.addedAt); }).slice(0, 8);
    if (!rows.length) { el.innerHTML = '<div class="aq-empty">No spend recorded yet.</div>'; return; }
    var cmap = {};
    Acquisition.getCampaigns().forEach(function (c) { cmap[c.id] = c.label; });
    el.innerHTML = rows.map(function (s) {
      return '<div class="aq-spend-row"><span><b>' + esc(s.date) + '</b> · ' + esc(cmap[s.campaignId] || s.campaignId)
        + (s.note && s.note !== 'seed' ? ' <span class="mut">(' + esc(s.note) + ')</span>' : '')
        + '</span><span style="font-weight:800">' + fmtUSD(s.amount) + '</span></div>';
    }).join('');
  }

  function fillCampaignSelect() {
    var sel = document.getElementById('spendCampaign');
    if (!sel) return;
    sel.innerHTML = Acquisition.getCampaigns().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
    }).join('');
  }

  /* ── Campaign manager list (paginated: URL + copy + edit + delete) ── */
  function renderCampaignList() {
    var el = document.getElementById('campaignList');
    if (!el) return;
    var rows = Acquisition.getCampaigns();
    if (!rows.length) {
      el.innerHTML = '<div class="aq-empty">No campaigns yet — create one below.</div>';
      renderPager('campaignPager', 1, LIST_PAGE_SIZE, 0, function () {});
      return;
    }
    var pages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
    if (listPage > pages) listPage = pages;
    var p = pageSlice(rows, listPage, LIST_PAGE_SIZE);
    el.innerHTML = p.slice.map(function (c) {
      var url = Acquisition.buildTaggedUrl(c, 'creative_01');
      return '<div class="aq-camp">'
        + '<div class="aq-camp-main">'
        + '<div class="aq-camp-name">' + esc(c.label)
        + ' <span class="dest-chip ' + esc(c.destination) + '">' + esc(c.destination) + '</span>'
        + ' <span class="dest-chip other">' + esc(c.source || 'facebook') + '</span></div>'
        + '<div style="font-size:10.5px;color:var(--text-faint);margin-top:4px">Lands on: <code>' + esc(c.landing) + '</code></div>'
        + '<div class="aq-camp-url">' + esc(url) + '</div>'
        + '</div>'
        + '<div class="aq-camp-acts">'
        + '<button class="btn-aq-mini" data-copy-camp="' + esc(c.id) + '"><i class="fas fa-copy"></i> Copy URL</button>'
        + '<button class="btn-aq-mini" data-edit-camp="' + esc(c.id) + '"><i class="fas fa-pen"></i> Edit</button>'
        + '<button class="btn-aq-mini danger" data-del-camp="' + esc(c.id) + '"><i class="fas fa-trash"></i></button>'
        + '</div>'
        + '</div>';
    }).join('');
    renderPager('campaignPager', listPage, LIST_PAGE_SIZE, rows.length, function (to) {
      listPage = to;
      renderCampaignList();
    });
    el.querySelectorAll('[data-copy-camp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = Acquisition.getCampaign(btn.getAttribute('data-copy-camp'));
        if (!c) return;
        var url = Acquisition.buildTaggedUrl(c, 'creative_01');
        try {
          navigator.clipboard.writeText(url).then(function () { toast('Tagged URL copied — paste it into your ad'); },
            function () { window.prompt('Copy this URL:', url); });
        } catch (e) { window.prompt('Copy this URL:', url); }
      });
    });
    el.querySelectorAll('[data-edit-camp]').forEach(function (btn) {
      btn.addEventListener('click', function () { startEdit(btn.getAttribute('data-edit-camp')); });
    });
    el.querySelectorAll('[data-del-camp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-del-camp');
        if (editingId === id) cancelEdit();
        Acquisition.deleteCampaign(id);
        toast('Campaign removed');
        fillCampaignSelect();
        renderCampaignList();
        load();
      });
    });
  }

  /* ── Edit flow ── */
  function startEdit(id) {
    var c = Acquisition.getCampaign(id);
    if (!c) return;
    editingId = id;
    var nameIn = document.getElementById('cName');
    var destSel = document.getElementById('cDest');
    var storyIdIn = document.getElementById('cStoryId');
    var customIn = document.getElementById('cCustom');
    var sourceSel = document.getElementById('cSource');
    var utmIn = document.getElementById('cUtm');
    if (nameIn) nameIn.value = c.label || '';
    if (destSel) destSel.value = c.destination || 'home';
    if (storyIdIn) storyIdIn.value = c.storyId || '';
    if (customIn) customIn.value = (c.destination === 'custom' || c.destination === 'story') ? (c.landing || '') : '';
    if (sourceSel) sourceSel.value = c.source || 'facebook';
    if (utmIn) utmIn.value = c.utmCampaign || '';
    syncDest();
    var title = document.getElementById('cFormTitle');
    if (title) title.textContent = 'Edit Campaign';
    var submit = document.getElementById('cSubmit');
    if (submit) submit.innerHTML = '<i class="fas fa-check"></i> Save changes';
    var cancel = document.getElementById('cCancelEdit');
    if (cancel) cancel.style.display = '';
    document.getElementById('campaignForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cancelEdit() {
    editingId = null;
    var form = document.getElementById('campaignForm');
    if (form) form.reset();
    var title = document.getElementById('cFormTitle');
    if (title) title.textContent = 'New Campaign';
    var submit = document.getElementById('cSubmit');
    if (submit) submit.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Create &amp; get URL';
    var cancel = document.getElementById('cCancelEdit');
    if (cancel) cancel.style.display = 'none';
    syncDest();
  }

  /* ── Landing catalog wiring ── */
  function fillDestSelect() {
    var sel = document.getElementById('cDest');
    if (!sel) return;
    sel.innerHTML = (Acquisition.landingCatalog ? Acquisition.landingCatalog() : []).map(function (p) {
      return '<option value="' + esc(p.key) + '">' + esc(p.label) + '</option>';
    }).join('');
    if (!sel.value) sel.value = 'home';
  }

  function syncDest() {
    var destSel = document.getElementById('cDest');
    var dest = destSel ? destSel.value : 'home';
    var storyWrap = document.getElementById('cStoryWrap');
    var customWrap = document.getElementById('cCustomWrap');
    if (storyWrap) storyWrap.style.display = dest === 'story' ? '' : 'none';
    if (customWrap) customWrap.style.display = dest === 'custom' ? '' : 'none';
  }

  function collectCampaignForm() {
    var nameIn = document.getElementById('cName');
    var destSel = document.getElementById('cDest');
    var dest = destSel ? destSel.value : 'home';
    var storyId = ((document.getElementById('cStoryId') || {}).value || '').trim();
    var custom = ((document.getElementById('cCustom') || {}).value || '').trim().replace(/^\//, '');
    var landing = '';
    if (dest === 'custom') landing = custom;
    else if (dest === 'story' && custom && custom.indexOf('full-reader') !== -1) landing = custom; /* allow override with chapter etc. */
    else landing = (Acquisition.landingFor ? Acquisition.landingFor(dest, storyId) : '');
    return {
      label: nameIn ? nameIn.value : '',
      destination: dest,
      storyId: dest === 'story' ? storyId : '',
      landing: landing,
      source: (document.getElementById('cSource') || {}).value || 'facebook',
      utmCampaign: ((document.getElementById('cUtm') || {}).value || '').trim() || undefined,
    };
  }

  async function load() {
    summary = await Acquisition.getSummary(days);
    renderStats();
    renderCampaigns();
    renderSpendLog();
    renderCampaignList();
    fillCampaignSelect();
  }

  async function init() {
    MarketingSidebar.attach('#acqRoot', {
      activeItem: 'acquisition',
      title: 'Acquisition',
      subtitle: 'Paid traffic → readers → revenue, per campaign',
      user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
      notifCount: 5,
      searchPlaceholder: 'Search campaigns…',
    });
    var ps = document.getElementById('periodSel');
    if (ps) ps.addEventListener('change', function () { days = parseInt(ps.value, 10) || 30; comparePage = 1; load(); });
    var dateIn = document.getElementById('spendDate');
    if (dateIn) dateIn.value = new Date().toISOString().slice(0, 10);

    /* Campaign form (create + edit) */
    fillDestSelect();
    var nameIn = document.getElementById('cName');
    var utmIn = document.getElementById('cUtm');
    var destSel = document.getElementById('cDest');
    function syncUtm() {
      if (!nameIn || !utmIn || editingId) return;
      utmIn.value = nameIn.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    }
    if (nameIn) nameIn.addEventListener('input', syncUtm);
    if (destSel) destSel.addEventListener('change', syncDest);
    syncDest();
    var cancelBtn = document.getElementById('cCancelEdit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
    var cform = document.getElementById('campaignForm');
    if (cform) {
      cform.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = collectCampaignForm();
        if (!data.label) return;
        if (editingId) {
          var upd = Acquisition.updateCampaign(editingId, data);
          toast(upd ? 'Campaign updated' : 'Update failed');
          cancelEdit();
        } else {
          var row = Acquisition.addCampaign(data);
          toast(row ? 'Campaign created — copy its URL below' : 'Could not create campaign');
          if (row) {
            nameIn.value = '';
            if (utmIn) utmIn.value = '';
            var sid = document.getElementById('cStoryId'); if (sid) sid.value = '';
            var cust = document.getElementById('cCustom'); if (cust) cust.value = '';
          }
        }
        listPage = 1;
        comparePage = 1;
        load();
      });
    }

    var form = document.getElementById('spendForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = Acquisition.addSpend({
          date: document.getElementById('spendDate').value,
          campaignId: document.getElementById('spendCampaign').value,
          amount: parseFloat(document.getElementById('spendAmount').value),
          note: document.getElementById('spendNote').value.trim(),
        });
        if (ok) {
          toast('Spend recorded');
          document.getElementById('spendAmount').value = '';
          document.getElementById('spendNote').value = '';
          load();
        }
      });
    }
    await load();
  }

  window.AcquisitionPage = { init: init, __ready: true };
})();
