/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION PAGE SERVICE — Pages/notifications.html
   ───────────────────────────────────────────────────────────────
   Markup only in the page; this file owns filter state + render +
   settings UI. All data, dedupe, channels and counts come from
   window.DroboardNotifStore; all row HTML comes from
   component/notification-item.js (DroboardNotif).
   One inbox, two views: the role switch filters by item.audience.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__notifPageService) return;
  window.__notifPageService = true;

  const Store = () => window.DroboardNotifStore;
  let role = 'all';
  let activeFilter = 'all';

  const ROUTES = {
    league_finish: 'leaderboard.html',
    reader_weekly: 'leaderboard.html',
    achievement: 'leaderboard.html',
    trending_enter: 'discover.html',
    top_ten: 'discover.html',
    editor_pick: 'discover.html',
    featured: 'discover.html',
    status_24h: 'feed.html',
    weekly_stats: '../author/book-overview.html',
    weekly_earnings: '../author/earnings.html',
    payout: '../author/transaction-history.html',
    contract_update: '../author/apply-contract.html',
    review_result: '../author/request-chapter-review.html',
    book_change_result: '../author/request-book-change.html',
    chapter_live: '../author/book-workspace.html',
    schedule_failed: '../author/book-workspace.html',
    comment: 'comments.html',
    like: 'comments.html',
    reply: 'comments.html',
    mention: 'comments.html',
    share: 'debate.html',
    save: '../author/book-overview.html',
    status_24h: 'feed.html',
    repost: 'debate.html',
    debate_reply: 'debate.html',
    debate_verdict: 'debate.html',
    poll_closed: 'debate.html',
    prediction_settled: 'debate.html',
    security: 'settings.html',
  };

  function toast(m) {
    let t = document.getElementById('notifToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'notifToast';
      t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;z-index:999;opacity:0;transition:.3s';
      document.body.appendChild(t);
    }
    t.textContent = m; t.style.opacity = '1';
    clearTimeout(t._t); t._t = setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  function updateBadges() {
    const counts = Store().unreadByCat();
    let visible = 0;
    Store().all().forEach(function (i) {
      if (i.unread && (role === 'all' || i.audience === 'both' || i.audience === role)) visible++;
    });
    counts.all = visible;
    Object.keys(counts).forEach(function (k) {
      const el = document.getElementById('b-' + k);
      if (!el) return;
      if (counts[k] > 0) { el.textContent = counts[k] > 99 ? '99+' : counts[k]; el.style.display = 'flex'; }
      else el.style.display = 'none';
    });
    const sub = document.getElementById('pageSub');
    if (sub) sub.textContent = visible ? visible + ' unread update' + (visible > 1 ? 's' : '') + ' · what happened in the last 24h' : 'You are all caught up';
  }

  function render() {
    const S = Store();
    const items = S.list({ role: role, cat: activeFilter });
    const mount = document.getElementById('feed');
    if (!window.DroboardNotif) { mount.innerHTML = '<div class="empty">Notification component failed to load.</div>'; return; }
    mount.innerHTML = items.length
      ? DroboardNotif.renderGroups(S.groupByDay(items))
      : '<div class="empty">Nothing here yet — new activity, milestones and stats land here.</div>';

    DroboardNotif.bind(mount, {
      profileBase: 'profile.html',
      findById: id => S.get(id),
      onOpen: function (n) {
        if (!n) return;
        if (n.unread) S.markRead(n.id);
        const href = (n.link && n.link.href) || ROUTES[n.type];
        if (href) { setTimeout(() => { location.href = href; }, 120); return; }
        render();
      },
      onAction: function (n, act) {
        if (!n && act !== 'delete') return;
        const id = n ? n.id : null;
        if (act === 'read') S.markRead(id);
        if (act === 'unread') S.markUnread(id);
        if (act === 'delete') { S.remove(id); toast('Deleted'); }
        if (act === 'mute') { S.muteType(n.type, true); toast('Muted ' + (n.typeLabel || n.type)); }
        render();
      },
    });
    updateBadges();
  }

  /* ── settings: per-category channel matrix ───────────────── */
  const CH = [['inapp', 'In-app'], ['push', 'Push'], ['email', 'Email']];
  function renderSettings() {
    const S = Store();
    const mount = document.getElementById('settingsMount');
    if (!mount || !S) return;
    const s = S.settings();
    mount.innerHTML =
      '<div class="settings-section"><div class="settings-label">Channels by category</div>' +
      Object.keys(S.CATS).map(function (k) {
        const c = S.CATS[k];
        const row = s[k] || { inapp: true, push: false, email: false };
        return '<div class="settings-row"><div class="settings-info">' +
          '<div class="settings-name"><i class="fas ' + c.icon + '" style="color:' + c.color + ';margin-right:6px"></i>' + c.label + '</div>' +
          '<div class="settings-desc">' + (CAT_DESC[k] || '') + '</div></div>' +
          '<div class="chan-group">' + CH.map(function (ch) {
            return '<button class="chan' + (row[ch[0]] ? ' on' : '') + '" data-cat="' + k + '" data-ch="' + ch[0] + '">' + ch[1] + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>' +

      '<div class="settings-section"><div class="settings-label">Digests &amp; quiet</div>' +
      row('digest', 'Summaries', '24-hour post report, weekly stats and weekly league finish.') +
      row('quiet', 'Quiet hours', 'Hold pushes between the times you choose.') +
      '<div id="quietTimeRow" class="quiet-row" style="display:' + (s.quiet ? 'flex' : 'none') + '">' +
      '<input type="time" id="quietStart" value="' + s.quietStart + '"/><span>to</span>' +
      '<input type="time" id="quietEnd" value="' + s.quietEnd + '"/>' +
      '<span id="quietHint" class="quiet-hint">Max 12h</span></div>' +
      '<div class="settings-row"><div class="settings-info"><div class="settings-name">Device permission</div>' +
      '<div class="settings-desc" id="permDesc">' + permText() + '</div></div>' +
      '<button class="perm-btn" id="permBtn">' + permLabel() + '</button></div>' +
      '<div class="settings-row"><div class="settings-info"><div class="settings-name">Reset feed</div>' +
      '<div class="settings-desc">Clears every notification on this device.</div></div>' +
      '<button class="perm-btn danger" id="resetBtn"><i class="fas fa-rotate-left"></i> Reset</button></div>' +
      '</div>';

    mount.querySelectorAll('.chan').forEach(function (b) {
      b.addEventListener('click', function () {
        const S2 = Store();
        const cur = S2.settings()[b.dataset.cat] || {};
        const on = !cur[b.dataset.ch];
        S2.setChannel(b.dataset.cat, b.dataset.ch, on);
        b.classList.toggle('on', on);
        render();
      });
    });
    mount.querySelectorAll('.toggle[data-key]').forEach(function (t) {
      t.addEventListener('click', function () {
        const key = t.dataset.key;
        const cur = Store().settings();
        const next = !cur[key];
        Store().saveSettings(setObj({}, key, next));
        if (key === 'quiet') document.getElementById('quietTimeRow').style.display = next ? 'flex' : 'none';
        t.classList.toggle('on', next);
      });
    });
    const qs = document.getElementById('quietStart'), qe = document.getElementById('quietEnd'), hint = document.getElementById('quietHint');
    function validateQuiet() {
      const dur = quietDuration(qs.value, qe.value);
      if (dur > 12) { hint.style.display = ''; hint.textContent = 'Max 12h — selected ' + dur.toFixed(1) + 'h'; return; }
      hint.style.display = 'none';
      Store().saveSettings({ quietStart: qs.value, quietEnd: qe.value });
    }
    if (qs) qs.addEventListener('change', validateQuiet);
    if (qe) qe.addEventListener('change', validateQuiet);
    document.getElementById('permBtn').addEventListener('click', function () {
      Store().requestPermission().then(function (p) {
        document.getElementById('permDesc').textContent = permText();
        document.getElementById('permBtn').textContent = permLabel();
        if (p === 'granted') toast('Push enabled on this device');
      });
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      Store().clearAll(); render(); renderSettings(); toast('Feed cleared');
    });
  }
  function setObj(o, k, v) { o[k] = v; return o; }
  function row(key, name, desc) {
    const s = Store().settings();
    return '<div class="settings-row"><div class="settings-info"><div class="settings-name">' + name + '</div>' +
      '<div class="settings-desc">' + desc + '</div></div><div class="toggle' + (s[key] ? ' on' : '') + '" data-key="' + key + '"></div></div>';
  }
  const CAT_DESC = {
    highlights: 'Trending, top ten, editor picks, league finish, debate verdicts, settled predictions.',
    achievements: 'Awards granted from the admin catalog and the weekly league.',
    stats: 'A 24-hour report for each of your statuses, plus weekly rollups.',
    activity: 'Likes, comments, replies, mentions, follows, shares, saves, reposts, debate arguments.',
    stories: 'New chapters from authors you follow; your drops going live.',
    revenue: 'Coins, tips, earnings, withdrawals.',
    system: 'Contracts, review results, verification, security.',
  };
  function permText() {
    if (!('Notification' in window)) return 'This browser cannot show system notifications.';
    return { granted: 'Allowed — pushes fire on this device.', denied: 'Blocked in browser settings.', default: 'Not allowed yet. We ask the first time a push-worthy event arrives.' }[Notification.permission] || '';
  }
  function permLabel() {
    if (!('Notification' in window)) return 'Unavailable';
    return Notification.permission === 'granted' ? 'Allowed' : 'Allow';
  }
  function quietDuration(a, b) {
    const toMin = t => { const p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
    let d = toMin(b) - toMin(a); if (d < 0) d += 1440; return d / 60;
  }

  function bindEvents() {
    document.querySelectorAll('#roleRow .role-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('#roleRow .role-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        role = tab.dataset.r;
        render();
      });
    });
    document.querySelectorAll('#filterRow .filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#filterRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.f;
        render();
      });
    });
    document.getElementById('markAllBtn').addEventListener('click', function () {
      Store().markAllRead(); render(); toast('All marked as read');
    });
    const sheet = document.getElementById('settingsSheet');
    const open = function () { renderSettings(); sheet.classList.add('open'); document.body.style.overflow = 'hidden'; };
    const close = function () { sheet.classList.remove('open'); document.body.style.overflow = ''; };
    document.getElementById('settingsBtn').addEventListener('click', open);
    document.getElementById('settingsClose').addEventListener('click', close);
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    window.addEventListener('dro:notification', function () { render(); });
  }

  async function init() {
    if (!window.DroboardNotifStore) { document.getElementById('feed').innerHTML = '<div class="empty">Store failed to load.</div>'; return; }
    Store().seed();
    const q = new URLSearchParams(location.search);
    const wanted = q.get('role');
    if (wanted === 'author' || wanted === 'reader') role = wanted;
    else {
      const acct = Store().account();
      if (acct.isWriter && !acct.isReader) role = 'author';
    }
    const initial = q.get('cat');
    if (initial && Store().CATS[initial]) activeFilter = initial;
    document.querySelectorAll('#roleRow .role-tab').forEach(t => t.classList.toggle('active', t.dataset.r === role));
    document.querySelectorAll('#filterRow .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.f === activeFilter));
    render();
    renderSettings();
    bindEvents();
  }

  window.NotifPageService = { init: init, render: render, toast: toast };
})();
