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

  /* ── Render: story leaderboard ── */
  function renderStories() {
    var el = document.getElementById('storyBody');
    if (!el || !summary) return;
    var rows = summary.byStory || [];
    if (!rows.length) { el.innerHTML = '<tr><td colspan="7" class="ae-empty">No story-ad revenue for this period.</td></tr>'; return; }
    el.innerHTML = rows.map(function (s) {
      var href = '../Pages/full-reader.html?story=' + encodeURIComponent(s.storyId);
      return '<tr>'
        + '<td><a class="ae-storylink" href="' + esc(href) + '">' + esc(s.storyTitle || s.storyId) + '</a></td>'
        + '<td>' + esc(s.authorName || '—') + '</td>'
        + '<td>' + fmtN(s.impressions) + '</td>'
        + '<td>' + fmtN(s.clicks) + '</td>'
        + '<td><b>' + fmtUSD(s.revenue) + '</b></td>'
        + '<td><span class="ae-chip plat">' + fmtUSD(s.platformShare) + '</span></td>'
        + '<td><span class="ae-chip">' + fmtUSD(s.authorShare) + '</span></td>'
        + '</tr>';
    }).join('');
  }

  async function load() {
    summary = await AdRevenue.getSummary(days);
    renderPools();
    renderSplit();
    renderSurfaces();
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
        load();
      });
    }
    await load();
  }

  window.AdEarningsService = { init: init, __ready: true };
})();
