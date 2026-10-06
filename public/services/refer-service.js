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
  var REWARD_COINS = 5;

  function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function codeKey(h) { return 'dro_refer_code_' + (h || 'guest').toLowerCase(); }
  function statsKey(h) { return 'dro_refer_stats_' + (h || 'guest').toLowerCase(); }
  function listKey(h) { return 'dro_refer_list_' + (h || 'guest').toLowerCase(); }

  function makeCode(handle) {
    var base = String(handle || 'DRO').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || 'DRO';
    var rand = '';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return base + '-' + rand;
  }

  function demoList() {
    return [
      { name: 'Chiamaka N', handle: 'chiamaka_n', avatar: 'https://i.pravatar.cc/100?img=47', when: '2d ago', status: 'joined', earned: REWARD_COINS },
      { name: 'Efe O', handle: 'efe_o', avatar: 'https://i.pravatar.cc/100?img=22', when: '5d ago', status: 'invited', earned: 0 },
    ];
  }

  async function callBackend(path, opts) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, 3000);
    try {
      var res = await fetch(CFG.API_BASE + path, Object.assign({ signal: c.signal }, opts || {}));
      clearTimeout(t);
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) { clearTimeout(t); throw e; }
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
        s = { invited: list.length + 1, joined: joined, earned: joined * REWARD_COINS };
        lsSet(statsKey(handle), s);
        lsSet(listKey(handle), list);
      }
      return s;
    },

    async getReferred(handle) {
      if (CFG.USE_API) { try { var r = await callBackend('/referrals'); if (Array.isArray(r)) return r; } catch (e) {} }
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
      return 'https://wa.me/?text=' + encodeURIComponent('Join me on Droboard! Sign up with my link and we both earn coins: ' + link);
    },
    xUrl: function (link) {
      return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Join me on Droboard — stories worth your 2am 📚') + '&url=' + encodeURIComponent(link);
    }
  };
})();
