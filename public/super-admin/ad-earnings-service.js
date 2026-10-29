/**
 * ad-earnings-service.js — Super-admin Ad Earnings page (pure call-and-render).
 * ad-earnings.html only loads this + calls init(). All data comes from
 * window.AdRevenue (../services/ad-revenue-service.js) — backend-ready.
 */
(function () {
  'use strict';
  if (window.AdEarningsService && window.AdEarningsService.__ready) return;

  var days = 30;
  var summary = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtUSD(n) { return '$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
  function fmtN(n) { return (Math.round(Number(n) || 0)).toLocaleString('en-US'); }
  function toast(m) { if (typeof window.toast === 'function') { try { window.toast(m); return; } catch (e) {} } }

  function avatarFor(name) {
    var s = String(name || 'author'), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'https://i.pravatar.cc/100?img=' + ((h % 70) + 1);
  }

  /* ── Render: stat pools ── */
  function renderPools() {
    var el = document.getElementById('poolRow');
    if (!el || !summary) return;
    var t = summary.totals;
    var cards = [
      { ico: 'fa-coins', lbl: 'Gross ad revenue', val: fmtUSD(t.revenue), sub: fmtN(t.impressions) + ' impressions · ' + fmtN(t.clicks) + ' clicks' },
      { ico: 'fa-building', lbl: 'Platform share', val: fmtUSD(t.platformShare), sub: 'Includes 100% of non-story surfaces' },
      { ico: 'fa-pen-nib', lbl: 'Author share (all)', val: fmtUSD(t.authorShare), sub: '30% of story-owned ad revenue' },
      { ico: 'fa-wallet', lbl: 'Authors payable', val: fmtUSD(t.authorShareUnpaid), sub: 'Unpaid balance across all authors' },
    ];
    el.innerHTML = cards.map(function (c) {
      return '<div class="ae-pool"><div class="ae-pool-top"><span class="ae-pool-ico"><i class="fas ' + c.ico + '"></i></span>'
        + '<span class="ae-pool-lbl">' + esc(c.lbl) + '</span></div>'
        + '<div class="ae-pool-val">' + esc(c.val) + '</div>'
        + '<div class="ae-pool-sub">' + esc(c.sub) + '</div></div>';
    }).join('');
  }

  /* ── Render: split overview ── */
  function renderSplit() {
    var el = document.getElementById('splitOverview');
    if (!el || !summary) return;
    var t = summary.totals;
    var total = (Number(t.revenue) || 0) || 1;
    var platPct = Math.max(0, Math.min(100, (t.platformShare / total) * 100));
    var authPct = Math.max(0, Math.min(100, 100 - platPct));
    el.innerHTML =
      '<div class="ae-row-lbl">Platform <span>' + fmtUSD(t.platformShare) + ' · ' + platPct.toFixed(1) + '%</span></div>'
      + '<div class="ae-splitbar"><div class="plat" style="width:' + platPct + '%"></div><div class="auth" style="width:' + authPct + '%"></div></div>'
      + '<div class="ae-splitleg"><span>Platform ' + Math.round(AdRevenue.CONFIG.platformShare * 100) + '% on story slots</span><span>Author ' + Math.round(AdRevenue.CONFIG.authorShare * 100) + '%</span></div>'
      + '<div class="ae-note" style="margin-top:14px">Story-owned slots: <b>in-chapter</b> (full/scroll reader), <b>end-of-story</b> (bottom edge, story top), <b>story comments</b>. Every other surface (home, discover, feed, hub, library, overlay, profile) is 100% platform.</div>';
  }

  /* ── Render: surface breakdown ── */
  function renderSurfaces() {
    var el = document.getElementById('surfaceList');
    if (!el || !summary) return;
    var rows = summary.bySurface || [];
    if (!rows.length) { el.innerHTML = '<div class="ae-empty">No ad events in this period.</div>'; return; }
    var maxRev = rows.reduce(function (m, r) { return Math.max(m, r.revenue); }, 0) || 1;
    el.innerHTML = rows.map(function (r) {
      var label = AdRevenue.surfaceLabel(r.key);
      var w = Math.max(4, (r.revenue / maxRev) * 100);
      var story = !!r.storyId || String(r.key).indexOf('story:') === 0;
      return '<div style="margin-bottom:12px">'
        + '<div class="ae-row-lbl">' + esc(label)
        + ' <span>' + fmtUSD(r.revenue) + (story ? ' · 30% to author' : ' · 100% platform') + '</span></div>'
        + '<div style="height:8px;border-radius:6px;background:var(--border);overflow:hidden">'
        + '<div style="height:100%;width:' + w + '%;background:' + (story ? 'var(--accent,#ff0050)' : 'var(--blue,#2f7de1)') + ';border-radius:6px"></div></div>'
        + '<div style="font-size:10.5px;color:var(--text-faint);margin-top:3px">' + fmtN(r.impressions) + ' impressions · ' + fmtN(r.clicks) + ' clicks</div>'
        + '</div>';
    }).join('');
  }

  /* ── Render: revenue by country ── */
  function countryName(code) {
    if (!code || code === 'unknown') return 'Unknown';
    try {
      var dn = new Intl.DisplayNames([(navigator.language || 'en')], { type: 'region' });
      var n = dn.of(code);
      if (n && n !== code) return n;
    } catch (e) {}
    return code;
  }
  function renderCountries() {
    var el = document.getElementById('countryList');
    if (!el || !summary) return;
    var rows = (summary.byCountry || []).slice().sort(function (a, b) { return b.revenue - a.revenue; });
    if (!rows.length) { el.innerHTML = '<div class="ae-empty">No ad events in this period.</div>'; return; }
    el.innerHTML = rows.slice(0, 12).map(function (r) {
      var w = Math.max(4, (r.revenue / (rows[0].revenue || 1)) * 100);
      var color = r.networkRevenue > 0 && !r.paidRevenue ? 'var(--amber,#d97706)' : 'var(--blue,#2f7de1)';
      return '<div style="margin-bottom:12px">'
        + '<div class="ae-row-lbl">' + esc(r.key === 'unknown' ? 'Unknown' : countryName(r.key))
        + ' <span>' + fmtUSD(r.revenue) + '</span></div>'
        + '<div style="height:8px;border-radius:6px;background:var(--border);overflow:hidden">'
        + '<div style="height:100%;width:' + w + '%;background:' + color + ';border-radius:6px"></div></div>'
        + '<div style="font-size:10.5px;color:var(--text-faint);margin-top:3px">' + fmtN(r.impressions) + ' impressions · paid '
        + fmtUSD(r.paidRevenue) + ' · network ' + fmtUSD(r.networkRevenue) + ' · author ' + fmtUSD(r.authorShare) + '</div>'
        + '</div>';
    }).join('');
  }

  /* ── Render: authors payable table ── */
  function renderAuthors() {
    var el = document.getElementById('authorBody');
    if (!el || !summary) return;
    var rows = (summary.byAuthor || []).slice().sort(function (a, b) { return b.authorShare - a.authorShare; });
    if (!rows.length) { el.innerHTML = '<tr><td colspan="6" class="ae-empty">No story-ad revenue for this period.</td></tr>'; return; }
    el.innerHTML = rows.map(function (a) {
      var stories = (summary.byStory || []).filter(function (s) { return s.authorId === a.authorId; }).length;
      var paid = a.paid || a.unpaid === 0;
      var meta = (window.AdRevenue && AdRevenue.authorMeta) ? AdRevenue.authorMeta(a.authorId, a.authorName) : {};
      var av = a.authorAv || meta.avatar || avatarFor(a.authorName);
      var handle = a.authorHandle || meta.handle || a.authorName;
      var href = '../Pages/profile.html?u=' + encodeURIComponent(handle);
      return '<tr>'
        + '<td><span class="ae-who"><img class="ae-av" src="' + esc(av) + '" alt=""/><a class="ae-authorlink" href="' + esc(href) + '">' + esc(a.authorName) + '</a></span></td>'
        + '<td>' + stories + '</td>'
        + '<td>' + fmtN(a.impressions) + '</td>'
        + '<td>' + fmtN(a.clicks) + '</td>'
        + '<td><b>' + fmtUSD(a.authorShare) + '</b></td>'
        + '<td><span class="ae-chip' + (paid ? '' : ' unpaid') + '">' + (paid ? 'Paid' : 'Unpaid') + '</span></td>'
        + '</tr>';
    }).join('');
  }

  /* ── Render: story leaderboard (paged) ── */
  var STORY_PAGE_SIZE = 8;
  var storyPage = 0;
  function storyMix(storyId) {
    var list = (summary.byStoryCountry && summary.byStoryCountry[storyId]) || [];
    var tot = list.reduce(function (n, c) { return n + (c.impressions || 0); }, 0);
    if (!tot) return null;
    var parts = list.map(function (c) {
      return (c.key === 'unknown' ? 'Unknown' : countryName(c.key)) + ' ' + Math.round((c.impressions / tot) * 100) + '%';
    });
    return { top: parts.slice(0, 3).join(' · '), all: parts.join(' · ') };
  }
  function renderStories() {
    var el = document.getElementById('storyBody');
    if (!el || !summary) return;
    var rows = summary.byStory || [];
    var countEl = document.getElementById('storyCount');
    if (countEl) countEl.textContent = rows.length ? rows.length + (rows.length === 1 ? ' book' : ' books') : '';
    var rangeEl = document.getElementById('storyRange');
    var prevBtn = document.getElementById('storyPrev');
    var nextBtn = document.getElementById('storyNext');
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="8" class="ae-empty">No story-ad revenue for this period.</td></tr>';
      if (rangeEl) rangeEl.textContent = '';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    var pages = Math.max(1, Math.ceil(rows.length / STORY_PAGE_SIZE));
    if (storyPage >= pages) storyPage = pages - 1;
    if (storyPage < 0) storyPage = 0;
    var start = storyPage * STORY_PAGE_SIZE;
    var slice = rows.slice(start, start + STORY_PAGE_SIZE);
    if (rangeEl) rangeEl.textContent = 'Showing ' + (start + 1) + '–' + Math.min(start + STORY_PAGE_SIZE, rows.length) + ' of ' + rows.length;
    if (prevBtn) prevBtn.disabled = storyPage <= 0;
    if (nextBtn) nextBtn.disabled = storyPage >= pages - 1;
    el.innerHTML = slice.map(function (s) {
      var href = '../Pages/full-reader.html?story=' + encodeURIComponent(s.storyId);
      var mix = storyMix(s.storyId);
      var cov = (window.AdRevenue && AdRevenue.storyCover) ? AdRevenue.storyCover(s.storyId) : '';
      var impTitle = fmtN(s.paidImpressions) + ' paid · ' + fmtN(s.networkImpressions) + ' network'
        + (mix ? ' · ' + mix.all : '');
      return '<tr>'
        + '<td><div class="ae-story">'
        + (cov ? '<img class="ae-cover" src="' + esc(cov) + '" alt=""/>' : '<span class="ae-cover"></span>')
        + '<div style="min-width:0"><a class="ae-storylink" href="' + esc(href) + '">' + esc(s.storyTitle || s.storyId) + '</a>'
        + (mix ? '<div style="font-size:10.5px;color:var(--text-faint);margin-top:2px">' + esc(mix.top) + '</div>' : '')
        + '</div></div></td>'
        + '<td>' + esc(s.authorName || '—') + '</td>'
        + '<td title="' + esc(impTitle) + '">' + fmtN(s.impressions) + '</td>'
        + '<td>' + fmtUSD(s.paidRevenue) + '</td>'
        + '<td>' + fmtUSD(s.networkRevenue) + '</td>'
        + '<td><b>' + fmtUSD(s.revenue) + '</b></td>'
        + '<td><span class="ae-chip plat">' + fmtUSD(s.platformShare) + '</span></td>'
        + '<td><span class="ae-chip">' + fmtUSD(s.authorShare) + '</span></td>'
        + '</tr>';
    }).join('');
  }

  /* ── Network earnings (AdSense/Adsterra/Monetag report import) ── */
  function fmtCur(n, cur) {
    var n2 = Number(n) || 0;
    if (cur === 'USD') return fmtUSD(n2);
    return ({ NGN: '₦', GBP: '£' }[cur] || (cur + ' ')) + (Math.round(n2 * 100) / 100).toFixed(2);
  }
  function todayISO(offset) {
    var d = new Date();
    d.setDate(d.getDate() - (offset || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  async function renderNetwork() {
    var body = document.getElementById('nwBody');
    if (!body) return;
    var rows = await AdRevenue.getNetworkImports();
    if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="ae-empty">No network report imported yet.</td></tr>'; return; }
    body.innerHTML = rows.map(function (r) {
      return '<tr>'
        + '<td>' + esc(r.network || 'Network') + ' · ' + (r.country ? esc(r.country) : '<b>Others</b>') + '</td>'
        + '<td>' + esc(r.from) + ' → ' + esc(r.to) + '</td>'
        + '<td>' + fmtCur(r.amount, r.currency) + '</td>'
        + '<td><b>' + fmtUSD(r.amountUsd) + '</b></td>'
        + '<td>' + (r.allocated ? fmtN(r.allocated) + ' ledger rows' : '<span class="ae-chip unpaid">unallocated</span>') + '</td>'
        + '</tr>';
    }).join('');
  }
  function nwMsg(m) { var el = document.getElementById('nwMsg'); if (el) el.textContent = m || ''; }
  async function saveNetwork() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var cur = g('nwCur') || 'USD';
    var payload = {
      network: g('nwName').trim(),
      country: String(g('nwCountry') || '').trim().toUpperCase(),
      from: g('nwFrom'), to: g('nwTo'),
      amount: Number(g('nwAmount')) || 0,
      currency: cur,
      fxRate: cur === 'USD' ? 1 : (Number(g('nwFx')) || 0),
      note: g('nwNote') || '',
    };
    if (!payload.amount || !payload.from || !payload.to) { nwMsg('Enter a window and an amount.'); return; }
    if (payload.country && !/^[A-Z]{2}$/.test(payload.country)) { nwMsg('Country must be a 2-letter code, or blank for all.'); return; }
    if (cur !== 'USD' && !(payload.fxRate > 0)) { nwMsg('Enter the FX rate the network used.'); return; }
    var btn = document.getElementById('nwSave');
    if (btn) btn.disabled = true;
    try {
      var rec = await AdRevenue.recordNetwork(payload);
      if (!rec) { nwMsg('Could not record that report.'); return; }
      nwMsg('Recorded ' + fmtUSD(rec.amountUsd) + ' over ' + (rec.allocated || 0) + ' rows.');
      await load();
      await renderNetwork();
    } finally { if (btn) btn.disabled = false; }
  }

  async function load() {
    summary = await AdRevenue.getSummary(days);
    renderPools();
    renderSplit();
    renderSurfaces();
    renderCountries();
    renderAuthors();
    renderStories();
  }

  async function init() {
    SuperAdminSidebar.attach('#dashboardRoot', {
      activeItem: 'ad-earnings',
      title: 'Ad Earnings',
      subtitle: 'Ad revenue by surface, story & author payout pools',
      user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
      notifCount: 9,
      hideSearch: true,
    });
    var sel = document.getElementById('periodSel');
    if (sel) {
      sel.addEventListener('change', function () {
        days = parseInt(sel.value, 10) || 30;
        storyPage = 0;
        load();
      });
    }
    var prevStory = document.getElementById('storyPrev');
    if (prevStory) {
      prevStory.addEventListener('click', function () {
        if (storyPage > 0) { storyPage--; renderStories(); }
      });
    }
    var nextStory = document.getElementById('storyNext');
    if (nextStory) {
      nextStory.addEventListener('click', function () { storyPage++; renderStories(); });
    }
    var nf = document.getElementById('nwFrom'); if (nf) nf.value = todayISO(29);
    var nt = document.getElementById('nwTo'); if (nt) nt.value = todayISO(0);
    var nc = document.getElementById('nwCur');
    var nx = document.getElementById('nwFx');
    if (nc && nx) {
      nc.addEventListener('change', function () {
        var usd = nc.value === 'USD';
        nx.disabled = usd;
        nx.placeholder = usd ? 'USD only' : 'e.g. 0.00065';
        if (usd) nx.value = '';
      });
    }
    var save = document.getElementById('nwSave');
    if (save) save.addEventListener('click', saveNetwork);
    await load();
    await renderNetwork();
  }

  window.AdEarningsService = { init: init, __ready: true };
})();
