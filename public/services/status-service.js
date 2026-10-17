/* ═══════════════════════════════════════════════════════════════
   STATUS SERVICE — window.DroboardStatus
   My ephemeral statuses (story row → status viewer). Demo: my slides
   persist in localStorage 'dro_my_statuses_v1' (24h expiry), merged over
   the feed's seed stories at render time. Live: swap to API:

     GET  /api/statuses/me   → { statuses: [{bg,quote,caption,time}] }
     POST /api/statuses       { bg, quote, caption } → slide
     (feed/profile read the merged row; viewer reads slide list)

   Slide shape matches status-viewer.js: { bg, quote, caption, time }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var USE_API = false;
  var API_BASE = '/api';
  var MY_KEY = 'dro_my_statuses_v1';
  var DAY = 864e5;

  function loadMine() {
    try {
      var list = JSON.parse(localStorage.getItem(MY_KEY) || '[]') || [];
      var now = Date.now();
      list = list.filter(function (s) { return s && (!s.ts || now - s.ts < DAY); });
      return list;
    } catch (e) { return []; }
  }
  function saveMine(list) {
    try { localStorage.setItem(MY_KEY, JSON.stringify((list || []).slice(0, 20))); }
    catch (e) {}
  }
  function meIdentity() {
    var name = 'You', avatar = '';
    try {
      if (window.AuthSession && typeof window.AuthSession.getSync === 'function') {
        var s = window.AuthSession.getSync() || {};
        if (s.name) name = s.name;
        if (s.avatar) avatar = s.avatar;
      } else if (window.DroboardUser) {
        if (window.DroboardUser.name) name = window.DroboardUser.name;
        if (window.DroboardUser.avatar) avatar = window.DroboardUser.avatar;
      }
      if (!avatar && window.FeedData && window.FeedData.YOU_AV) avatar = window.FeedData.YOU_AV;
    } catch (e) {}
    return { name: name, avatar: avatar };
  }

  /* Post one status slide straight to my story (not the feed). */
  function post(slide) {
    slide = slide || {};
    var now = Date.now();
    var item = {
      bg: slide.bg || ('https://picsum.photos/seed/drostatus' + now + '/500/900'),
      quote: slide.quote || '',
      caption: slide.caption || '',
      storyRef: slide.storyRef || null,
      time: 'Just now',
      ts: now,
    };
    if (USE_API) {
      fetch(API_BASE + '/statuses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg: item.bg, quote: item.quote, caption: item.caption, storyId: item.storyRef && item.storyRef.id }),
      }).catch(function () {});
    }
    var list = loadMine();
    list.unshift(item);
    saveMine(list);
    return item;
  }

  function slides() { return loadMine(); }

  /* Story-row entry for me (replaces the static 'you' tile). */
  function myEntry() {
    var me = meIdentity();
    var list = loadMine();
    return {
      id: 'you', name: 'Your Story', you: true,
      avatar: me.avatar || 'https://i.pravatar.cc/100?img=51',
      ring: list.length ? 'ring-live' : 'ring-none',
      likes: 0, threads: list.length,
      statuses: list.map(function (s) { return { bg: s.bg, quote: s.quote, caption: s.caption, storyRef: s.storyRef || null, time: s.time }; }),
    };
  }

  /* Merge my live entry over a stories array (feed/profile rows). */
  function mergeStories(stories) {
    var mine = null;
    try { mine = myEntry(); } catch (e) { return stories; }
    var out = (stories || []).map(function (s) { return (s && s.you) ? mine : s; });
    if (!out.some(function (s) { return s && s.you; })) out.unshift(mine);
    return out;
  }

  window.DroboardStatus = {
    post: post, slides: slides, myEntry: myEntry, mergeStories: mergeStories,
  };
})();
