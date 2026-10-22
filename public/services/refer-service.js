/* ===============================================================
   REFER SERVICE — Refer-a-Friend program (5 coins per joined referral)
   Demo: localStorage. Live: GET/POST /api/referrals.
   Pages/refer.html owns markup. This file owns data + share helpers.
   Attribution: invite link is signup.html?ref=CODE (signup-service
   already picks up ?ref= and pre-fills the referral field).
=============================================================== */
(function () {
  'use strict';
  if (window.ReferService) return;

  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api' };
  // Referrals are mounted at the API root (/api/referrals/*), not under /api/author.
  var REFERRALS_BASE = '/api';
  var REWARD_COINS = 5;
  var PAGE_SIZE = 10; // "Referred friends" paginates 10 per page
  var _view = { page: 1, list: [] };

  function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // v2 keys → reseeds the demo list/stats when the shape changed.
  function codeKey(h) { return 'dro_refer_code_v2_' + (h || 'guest').toLowerCase(); }
  function statsKey(h) { return 'dro_refer_stats_v2_' + (h || 'guest').toLowerCase(); }
  function listKey(h) { return 'dro_refer_list_v2_' + (h || 'guest').toLowerCase(); }

  function makeCode(handle) {
    var base = String(handle || 'DRO').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || 'DRO';
    var rand = '';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return base + '-' + rand;
  }

  // Demo rows: enough of them to exercise the 10-per-page pager.
  var DEMO_ROWS = [
    ['Chiamaka N', 'chiamaka_n', 47, '2d ago', 'joined'],
    ['Efe O', 'efe_o', 22, '5d ago', 'invited'],
    ['Adaeze C', 'adaeze_c', 32, '1d ago', 'joined'],
    ['Tunde B', 'tunde_b', 12, '1w ago', 'joined'],
    ['Ngozi E', 'ngozi_e', 44, '3d ago', 'joined'],
    ['Bolu A', 'bolu_a', 15, '6d ago', 'joined'],
    ['Yemi S', 'yemi_s', 5, '8d ago', 'invited'],
    ['Kelechi M', 'kelechi_m', 58, '2w ago', 'joined'],
    ['Zara O', 'zara_o', 16, '9d ago', 'joined'],
    ['Damilola A', 'damilola_a', 64, '11d ago', 'joined'],
    ['Ifeanyi K', 'ifeanyi_k', 8, '12d ago', 'invited'],
    ['Oluwa T', 'oluwa_t', 26, '3w ago', 'joined'],
    ['Amaka N', 'amaka_n', 41, '1mo ago', 'joined'],
    ['Sade F', 'sade_f', 3, '1mo ago', 'joined']
  ];

  function demoList() {
    return DEMO_ROWS.map(function (r) {
      return {
        name: r[0], handle: r[1], avatar: 'https://i.pravatar.cc/100?img=' + r[2],
        when: r[3], status: r[4], earned: r[4] === 'joined' ? REWARD_COINS : 0
      };
    });
  }

  async function callBackend(path, opts) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 3000);
    var o = Object.assign({ signal: c.signal, headers: authHeaders() }, opts || {});
    try {
      var res = await fetch(REFERRALS_BASE + path, o);
      clearTimeout(t);
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) { clearTimeout(t); throw e; }
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    try { var t = localStorage.getItem('droboard_session'); if (t) h.Authorization = 'Bearer ' + t; } catch (e) {}
    return h;
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
    REWARD_COINS: REWARD_COINS,

    async getCode(handle) {
      if (CFG.USE_API) { try { var r = await callBackend('/referrals/code'); if (r && r.code) return r.code; } catch (e) {} }
      var code = lsGet(codeKey(handle), null);
      if (!code) { code = makeCode(handle); lsSet(codeKey(handle), code); }
      return code;
    },

    inviteLink: function (code) {
      // absolute when possible so shared links work outside the app
      try {
        var u = new URL('signup.html', location.href);
        u.searchParams.set('ref', code);
        return u.href;
      } catch (e) { return 'signup.html?ref=' + encodeURIComponent(code); }
    },

    async getStats(handle) {
      if (CFG.USE_API) { try { return await callBackend('/referrals/stats'); } catch (e) {} }
      var s = lsGet(statsKey(handle), null);
      if (!s) {
        var list = demoList();
        var joined = list.filter(function (x) { return x.status === 'joined'; }).length;
        s = { invited: list.length, joined: joined, earned: joined * REWARD_COINS };
        lsSet(statsKey(handle), s);
        lsSet(listKey(handle), list);
      }
      if (!lsGet(listKey(handle), null)) lsSet(listKey(handle), demoList());
      return s;
    },

    async getReferred(handle) {
      if (CFG.USE_API) {
        try {
          var r = await callBackend('/referrals?limit=100');
          if (r && Array.isArray(r.items)) return r.items;
          if (Array.isArray(r)) return r;
        } catch (e) {}
      }
      var list = lsGet(listKey(handle), null);
      if (!list) { await this.getStats(handle); list = lsGet(listKey(handle), []); }
      return list;
    },

    // credit coins locally (StoreService balance) until backend owns rewards
    creditCoins: function (n) {
      try {
        if (window.StoreService && StoreService.addCoins) return StoreService.addCoins(n);
      } catch (e) {}
      return null;
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

  async function currentHandle() {
    try {
      if (window.AuthSession && AuthSession.getSession) {
        var s = await AuthSession.getSession();
        if (s && s.handle) return s.handle;
      }
      if (window.ProfileData && ProfileData.getCurrentUserHandle) return await ProfileData.getCurrentUserHandle();
    } catch (e) {}
    return 'Ada_Writes';
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
        return '<div class="ref-row">'
          + '<img class="ref-av" src="' + esc(r.avatar || '') + '" loading="lazy" alt=""/>'
          + '<div>' + name + '<div class="ref-sub">@' + esc(r.handle || '') + ' · ' + esc(whenLabel(r.when)) + '</div></div>'
          + '<div class="ref-badge ' + (joined ? 'joined' : 'invited') + '">' + (joined ? '+' + REWARD_COINS + ' coins' : 'Invited') + '</div>'
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
    var handle = await currentHandle();
    var code = await RS.getCode(handle);
    var link = RS.inviteLink(code);
    document.getElementById('refCode').textContent = code;
    document.getElementById('refLink').textContent = link;
    var stats = await RS.getStats(handle);
    document.getElementById('stInvited').textContent = stats.invited;
    document.getElementById('stJoined').textContent = stats.joined;
    document.getElementById('stEarned').textContent = stats.earned;
    _view.list = (await RS.getReferred(handle)) || [];
    _view.page = 1;
    renderList();
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
