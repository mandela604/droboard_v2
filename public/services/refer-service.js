/* ===============================================================
   REFER SERVICE — Refer-a-Friend program (window.ReferService)
   Live only. Every number on the page comes from the backend:
     GET /api/referrals/code   → { code, link }        (requireAuth)
     GET /api/referrals/stats  → { invited, joined, earned }
     GET /api/referrals        → { items: [{ name, handle, avatar, when,
                                   status: 'joined'|'invited', earned }] }
   Coins are credited server-side on invitee signup/reading — nothing is
   ever added from the browser. Pages/refer.html owns markup; this file
   owns data + share helpers. Attribution: the invite link points at
   signup.html?ref=CODE (signup-service picks up ?ref= and pre-fills the
   referral field).
=============================================================== */
(function () {
  'use strict';
  if (window.ReferService) return;

  var REFERRALS_BASE = '/api';
  var PAGE_SIZE = 10; // "Referred friends" paginates 10 per page
  var _view = { page: 1, list: [] };

  async function callBackend(path) {
    var res = await fetch(REFERRALS_BASE + path, { credentials: 'include' });
    if (!res.ok) throw new Error('Referrals API failed: ' + res.status);
    return res.json();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Reader profiles live at Pages/profile.html?u=<handle>
  function profileHref(handle) {
    var h = String(handle || '').replace(/^@/, '');
    return h ? 'profile.html?u=' + encodeURIComponent(h) : '';
  }

  function whenLabel(w) {
    if (!w) return '';
    var s = String(w);
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; // already relative ("2d ago")
    var t = new Date(s).getTime();
    if (isNaN(t)) return s;
    var d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return '1d ago';
    if (d < 30) return d + 'd ago';
    var mo = Math.floor(d / 30);
    if (mo < 12) return mo + 'mo ago';
    return Math.floor(mo / 12) + 'y ago';
  }

  window.ReferService = {

    /* The user's real code, minted server-side on first call. */
    async getCode() {
      var r = await callBackend('/referrals/code');
      if (!r || !r.code) throw new Error('Referrals API returned no code');
      return { code: r.code, link: r.link || '' };
    },

    /* Absolute share URL for a code. The server's link wins when present;
       building signup.html?ref=… locally is plain URL math, not fake data. */
    inviteLink: function (code, serverLink) {
      if (serverLink) {
        try { return new URL(serverLink, location.href).href; } catch (e) { return serverLink; }
      }
      try {
        var u = new URL('signup.html', location.href);
        u.searchParams.set('ref', code);
        return u.href;
      } catch (e) { return 'signup.html?ref=' + encodeURIComponent(code); }
    },

    async getStats() {
      var s = await callBackend('/referrals/stats');
      if (!s || typeof s !== 'object') throw new Error('Referrals stats failed');
      return { invited: Number(s.invited) || 0, joined: Number(s.joined) || 0, earned: Number(s.earned) || 0 };
    },

    async getReferred() {
      var r = await callBackend('/referrals?limit=100');
      if (r && Array.isArray(r.items)) return r.items;
      if (Array.isArray(r)) return r;
      return [];
    },

    async copyLink(link) {
      try { await navigator.clipboard.writeText(link); return true; }
      catch (e) {
        var ta = document.createElement('textarea');
        ta.value = link; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        ta.remove(); return true;
      }
    },

    async nativeShare(title, text, url) {
      if (navigator.share) {
        try { await navigator.share({ title: title, text: text, url: url }); return true; }
        catch (e) { return false; }
      }
      return false;
    },

    whatsappUrl: function (link) {
      return 'https://wa.me/?text=' + encodeURIComponent('Join me on Droboard! Sign up with my link and I earn coins for every friend who joins: ' + link);
    },
    xUrl: function (link) {
      return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Join me on Droboard — stories worth your 2am 📚') + '&url=' + encodeURIComponent(link);
    }
  };

  function toast(m) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* Explicit error empty-state: the page content is replaced so no stale
     zeros can masquerade as real counts. */
  function fatal(msg) {
    var content = document.querySelector('.content');
    if (!content) return;
    var href = (window.AuthSession && AuthSession.loginUrl)
      ? AuthSession.loginUrl('refer.html') : 'login.html?next=refer.html';
    content.innerHTML = '<div class="empty" style="padding:48px 16px;text-align:center">'
      + '<div style="font-size:14px;font-weight:800;color:var(--tx-high,#f0f0f2)">Could not load referrals</div>'
      + '<div style="margin-top:6px">' + esc(msg || 'request failed') + '</div>'
      + '<a href="' + href + '" style="display:inline-block;margin-top:14px;padding:10px 22px;border-radius:22px;background:var(--acc);color:#fff;font-weight:800;text-decoration:none">Log in</a>'
      + '</div>';
  }

  function totalPages() {
    return Math.max(1, Math.ceil((_view.list.length || 0) / PAGE_SIZE));
  }

  function renderList() {
    var list = _view.list || [];
    var total = list.length;
    var countEl = document.getElementById('refCount');
    if (countEl) countEl.textContent = total + ' invited';

    var pages = totalPages();
    if (_view.page > pages) _view.page = pages;
    if (_view.page < 1) _view.page = 1;
    var start = (_view.page - 1) * PAGE_SIZE;
    var slice = list.slice(start, start + PAGE_SIZE);

    var host = document.getElementById('refList');
    if (!host) return;
    if (!total) {
      host.innerHTML = '<div class="empty">No referrals yet — share your link above.</div>';
    } else {
      host.innerHTML = slice.map(function (r) {
        var joined = r.status === 'joined';
        var href = profileHref(r.handle);
        var label = esc(r.name || r.handle || 'Friend');
        var name = href
          ? '<a class="ref-name" href="' + href + '">' + label + '</a>'
          : '<div class="ref-name">' + label + '</div>';
        var badge = joined
          ? '+' + (Number(r.earned) || 0) + ' coins'
          : 'Invited';
        return '<div class="ref-row">'
          + '<img class="ref-av" src="' + esc(r.avatar || '') + '" loading="lazy" alt=""/>'
          + '<div>' + name + '<div class="ref-sub">@' + esc(r.handle || '') + ' · ' + esc(whenLabel(r.when)) + '</div></div>'
          + '<div class="ref-badge ' + (joined ? 'joined' : 'invited') + '">' + esc(badge) + '</div>'
          + '</div>';
      }).join('');
    }

    var pager = document.getElementById('refPager');
    if (pager) {
      pager.hidden = pages <= 1;
      var info = document.getElementById('pgInfo');
      if (info) info.textContent = 'Page ' + _view.page + ' of ' + pages;
      var prev = document.getElementById('pgPrev');
      var next = document.getElementById('pgNext');
      if (prev) prev.disabled = _view.page <= 1;
      if (next) next.disabled = _view.page >= pages;
    }
  }

  async function init() {
    var RS = window.ReferService;
    if (window.AuthSession && AuthSession.isGuest && AuthSession.isGuest()) {
      fatal('Sign in to see your referral code, stats and invited friends.');
      return;
    }
    var codeRow = { code: '', link: '' };
    try {
      codeRow = await RS.getCode();
    } catch (e) {
      fatal((e && e.message) || 'request failed');
      return;
    }
    var code = codeRow.code;
    var link = RS.inviteLink(code, codeRow.link);
    document.getElementById('refCode').textContent = code;
    document.getElementById('refLink').textContent = link;
    try {
      var stats = await RS.getStats();
      document.getElementById('stInvited').textContent = stats.invited;
      document.getElementById('stJoined').textContent = stats.joined;
      document.getElementById('stEarned').textContent = stats.earned;
      _view.list = (await RS.getReferred()) || [];
      _view.page = 1;
      renderList();
    } catch (e) {
      fatal((e && e.message) || 'request failed');
      return;
    }
    document.getElementById('copyCodeBtn').addEventListener('click', async function () {
      await RS.copyLink(link); toast('📋 Link copied!');
    });
    document.getElementById('shareBtn').addEventListener('click', async function () {
      var ok = await RS.nativeShare('Join me on Droboard', 'Sign up with my link and I earn 5 coins!', link);
      if (!ok) { await RS.copyLink(link); toast('📋 Link copied!'); }
    });
    document.getElementById('waBtn').addEventListener('click', function () { window.open(RS.whatsappUrl(link), '_blank'); });
    document.getElementById('xBtn').addEventListener('click', function () { window.open(RS.xUrl(link), '_blank'); });
    var prev = document.getElementById('pgPrev');
    var next = document.getElementById('pgNext');
    if (prev) prev.addEventListener('click', function () {
      if (_view.page > 1) { _view.page--; renderList(); }
    });
    if (next) next.addEventListener('click', function () {
      if (_view.page < totalPages()) { _view.page++; renderList(); }
    });
  }

  window.ReferService.init = init;
  window.ReferService.toast = toast;
})();
