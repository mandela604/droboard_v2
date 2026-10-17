/* ═══════════════════════════════════════════════════════════════
   DEBATE SERVICE
   Standalone debate page. Uses DroboardDebateArgs for arguments.
   Resolves ?id= from FeedData debates → DemoData.SERIES debates.
   State persisted in localStorage.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LS_KEY = 'dro_debate_state';
  let DEBATE = null;
  let DEBATE_ID = null;
  let S = { userVote: null, side: null };
  let ARGS = null;

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtN(n) { n = +n || 0; if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(n); }

  function toast(m) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ── localStorage ── */
  function loadState() {
    try {
      var all = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
      var s = all[DEBATE_ID] || {};
      return { userVote: s.userVote || null, side: s.side || null };
    } catch (e) { return { userVote: null, side: null }; }
  }
  function saveState() {
    try {
      var all = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
      all[DEBATE_ID] = { userVote: S.userVote, side: S.side };
      localStorage.setItem(LS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  /* ── seed arguments live in debate-args.js (single source of truth);
     this copy below is a fallback only, used if the component is missing ── */
  function seedArgs() {
    if (window.DroboardDebateArgs && DroboardDebateArgs.seedArgs) return window.DroboardDebateArgs.seedArgs();
    return [
      { id: 'a1', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', verified: 'writer', side: 'for', statusRing: 'has', time: '2h', text: 'Every character deserves growth. Redemption arcs are what make stories unforgettable.', up: 48, down: 6, myVote: null,
        statuses: [{ bg: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=500&h=900&fit=crop', quote: '"Writing at 2am has a different energy."', caption: 'Ada_Writes · Live now', time: '20m ago' }],
        replies: [
        { id: 'r1', name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48', verified: true, side: 'for', statusRing: 'has', time: '1h', text: 'Exactly! The journey from darkness to light is what hooks us.', up: 12, down: 1, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', quote: '"Team Alex or Team Jaxon?"', caption: 'Poll live now', time: '5h ago' }],
          replies: [] },
        { id: 'r2', name: 'Kenji_Tanaka', avatar: 'https://i.pravatar.cc/100?img=60', side: 'for', statusRing: 'none', time: '45m', text: 'Agreed. Without redemption, stories feel hollow.', up: 5, down: 0, myVote: null, replies: [] },
      ]},
      { id: 'a2', name: 'Marcus_Thorn', avatar: 'https://i.pravatar.cc/100?img=15', verified: false, side: 'against', statusRing: 'viewed', time: '1d', text: 'Some actions cross a line. Forcing redemption cheapens the consequences.', up: 62, down: 9, myVote: null,         replies: [
        { id: 'r3', name: 'Luna_Reyes', avatar: 'https://i.pravatar.cc/100?img=25', side: 'against', statusRing: 'has', time: '22h', text: 'Right? If the villain just says sorry, what was the point of the suffering?', up: 18, down: 2, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' }],
          replies: [] },
        { id: 'r5', name: 'Priya_Sharma', avatar: 'https://i.pravatar.cc/100?img=44', verified: true, side: 'against', statusRing: 'viewed', time: '20h', text: 'Consequences are what make choices matter in a story.', up: 9, down: 1, myVote: null, replies: [] },
        { id: 'r6', name: 'Finn_Calloway', avatar: 'https://i.pravatar.cc/100?img=68', side: 'against', statusRing: 'none', time: '18h', text: 'If everyone gets redeemed, nobody is truly dangerous.', up: 14, down: 3, myVote: null, replies: [] },
        { id: 'r7', name: 'Mei_Lin', avatar: 'https://i.pravatar.cc/100?img=31', side: 'against', statusRing: 'has', time: '15h', text: 'The tension dies when you know the villain will be forgiven.', up: 11, down: 2, myVote: null,
          statuses: [{ bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy series', time: '6h ago' }],
          replies: [] },
      ]},
      { id: 'a3', name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48', verified: true, side: 'for', statusRing: 'has', time: '3d', text: 'If we don\'t believe people can change, what\'s the point of any story at all?', up: 31, down: 4, myVote: null, replies: [] },
      { id: 'a4', name: 'Luna_Reyes', avatar: 'https://i.pravatar.cc/100?img=25', verified: false, side: 'against', statusRing: 'has', time: '2d', text: 'Villains who get forgiven without real sacrifice aren\'t redeemed — they\'re just excused.', up: 44, down: 7, myVote: null,
        statuses: [{ bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' }],
        replies: [] },
      { id: 'a5', name: 'Kenji_Tanaka', avatar: 'https://i.pravatar.cc/100?img=60', verified: false, side: 'for', statusRing: 'none', time: '5d', text: 'The best villains are the ones who mirror the hero. Their redemption is the hero\'s reflection.', up: 27, down: 3, myVote: null, replies: [] },
      { id: 'a6', name: 'Priya_Sharma', avatar: 'https://i.pravatar.cc/100?img=44', verified: true, side: 'for', statusRing: 'viewed', time: '4d', text: 'Redemption doesn\'t mean forgetting. It means choosing to be better despite what you\'ve done.', up: 19, down: 5, myVote: null, replies: [] },
      { id: 'a7', name: 'Diego_Vargas', avatar: 'https://i.pravatar.cc/100?img=53', verified: false, side: 'against', statusRing: 'none', time: '6h', text: 'We hold heroes to impossible standards but villains get a free pass? Nah.', up: 55, down: 8, myVote: null, replies: [] },
      { id: 'a8', name: 'Zara_Okafor', avatar: 'https://i.pravatar.cc/100?img=36', verified: true, side: 'against', statusRing: 'has', time: '1w', text: 'Forgiveness is for the victims to give, not for writers to force on them.', up: 71, down: 11, myVote: null,
        statuses: [
          { bg: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=900&fit=crop', quote: '"Chapter 21 is finally live — the truth comes out tonight."', caption: 'His Sweet Revenge · New chapter', time: '2h ago' },
          { bg: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', quote: '"I did not expect this ending. Neither will you."', caption: 'Behind the scenes', time: '1h ago' },
        ],
        replies: [
        { id: 'r4', name: 'Diego_Vargas', avatar: 'https://i.pravatar.cc/100?img=53', side: 'against', statusRing: 'none', time: '6d', text: 'This. The victim\'s journey matters more than the villain\'s arc.', up: 22, down: 3, myVote: null, replies: [] },
      ]},
      { id: 'a9', name: 'Finn_Calloway', avatar: 'https://i.pravatar.cc/100?img=68', verified: false, side: 'for', statusRing: 'none', time: '8d', text: 'Some of the greatest characters in fiction started as villains. Imagine robbing readers of that journey.', up: 36, down: 5, myVote: null, replies: [] },
      { id: 'a10', name: 'Mei_Lin', avatar: 'https://i.pravatar.cc/100?img=31', verified: false, side: 'against', statusRing: 'has', time: '3h', text: 'A villain crying at the end doesn\'t erase a hundred chapters of cruelty.', up: 49, down: 6, myVote: null,
        statuses: [{ bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy series', time: '6h ago' }],
        replies: [] },
      { id: 'a11', name: 'Omar_Hassan', avatar: 'https://i.pravatar.cc/100?img=57', verified: false, side: 'for', statusRing: 'viewed', time: '9d', text: 'Redemption arcs teach empathy. That\'s literally the point of literature.', up: 22, down: 4, myVote: null, replies: [] },
      { id: 'a12', name: 'Chloe_Bennett', avatar: 'https://i.pravatar.cc/100?img=45', verified: true, side: 'against', statusRing: 'none', time: '5d', text: 'If the villain is truly irredeemable, giving them a soft ending is bad writing.', up: 38, down: 7, myVote: null, replies: [] },
    ];
  }

  /* ── resolve debate ── */
  async function resolveDebate() {
    var params = new URLSearchParams(location.search);
    DEBATE_ID = params.get('id') || params.get('d') || 'deb_default';

    if (window.FeedData && FeedData.getFeedPosts) {
      try {
        var posts = await FeedData.getFeedPosts();
        var post = posts.find(function (p) { return p.id === DEBATE_ID && p.debateData; });
        if (post) {
          var d = post.debateData;
          return {
            id: DEBATE_ID,
            question: d.question || d.motion || 'Join the debate.',
            prompt: d.prompt || '',
            forText: d.forText || 'For',
            againstText: d.againstText || 'Against',
            forV: d.forV || 0,
            agV: d.agV || 0,
          };
        }
      } catch (e) {}
    }

    if (window.DemoData && DemoData.SERIES) {
      for (var i = 0; i < DemoData.SERIES.length; i++) {
        if (DemoData.SERIES[i].debates) {
          var deb = DemoData.SERIES[i].debates.find(function (x) { return x.id === DEBATE_ID; });
          if (deb) {
            return {
              id: DEBATE_ID,
              question: deb.motion || 'Join the debate.',
              prompt: '',
              forText: 'For',
              againstText: 'Against',
              forV: deb.forV || 0,
              agV: deb.agV || 0,
            };
          }
        }
      }
    }

    return {
      id: DEBATE_ID,
      question: 'Should villains get redemption?',
      prompt: 'Share your thoughts and join the debate!',
      forText: 'Yes, everyone deserves a second chance.',
      againstText: 'No, some actions are unforgivable.',
      forV: 264,
      agV: 164,
    };
  }

  /* ── render sides ── */
  function renderSides() {
    var d = DEBATE;
    var total = (d.forV || 0) + (d.agV || 0) || 1;
    var forPct = Math.round((d.forV / total) * 100) || 0;
    var agPct = Math.round((d.agV / total) * 100) || 0;

    document.getElementById('forFill').style.width = forPct + '%';
    document.getElementById('agFill').style.width = agPct + '%';
    document.getElementById('forPct').textContent = forPct + '%';
    document.getElementById('agPct').textContent = agPct + '%';
    document.getElementById('forCnt').textContent = fmtN(d.forV) + ' votes';
    document.getElementById('agCnt').textContent = fmtN(d.agV) + ' votes';
    document.getElementById('debTotal').textContent = fmtN((d.forV || 0) + (d.agV || 0)) + ' joined the discussion';

    document.getElementById('sideFor').classList.toggle('chosen', S.userVote === 'for');
    document.getElementById('sideAg').classList.toggle('chosen', S.userVote === 'against');
  }

  /* ── vote ── */
  function vote(side) {
    if (S.userVote === side) return;
    if (S.userVote === 'for') DEBATE.forV--;
    if (S.userVote === 'against') DEBATE.agV--;
    S.userVote = side;
    if (side === 'for') DEBATE.forV++;
    else DEBATE.agV++;
    if (!S.side) S.side = side;
    saveState();
    renderSides();
    if (ARGS) ARGS.setUserSide(S.side);
    try { if (window.ReaderLeague) ReaderLeague.track('debate'); } catch (e) {}
    toast('Vote recorded: ' + (side === 'for' ? '\u2705 For' : '\u274C Against'));
  }

  /* ── share ── */
  function share() {
    var url = location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Link copied'); }).catch(function () { toast(url); });
    } else { toast(url); }
  }

  /* ── init ── */
  async function init() {
    try { DEBATE = await resolveDebate(); } catch (e) { DEBATE = { id: DEBATE_ID || 'deb_default', question: 'Should villains get redemption?', prompt: 'Share your thoughts and join the debate!', forText: 'For', againstText: 'Against', forV: 264, agV: 164 }; }
    S = loadState();

    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onFollow: function (post) { toast('✅ Following @' + post.name + '!'); },
        onReport: function (post) { DroboardDotsMenu.openReportTypes(post); },
        onReportType: function (post, typeId) {
          try {
            var reports = JSON.parse(localStorage.getItem('DRO_REPORTS') || '[]');
            reports.push({ target: 'debate_arg', targetId: post.id, targetType: post.name, reason: typeId, time: Date.now() });
            localStorage.setItem('DRO_REPORTS', JSON.stringify(reports));
          } catch (e) {}
          toast('🚩 Report submitted. Thank you.');
        },
        onCopyLink: function () { toast('🔗 Link copied'); },
      });
    }

    document.getElementById('debQ').textContent = DEBATE.question;
    var promptEl = document.getElementById('debPrompt');
    promptEl.textContent = DEBATE.prompt || '';
    promptEl.style.display = DEBATE.prompt ? '' : 'none';
    document.getElementById('forLabel').textContent = DEBATE.forText;
    document.getElementById('agLabel').textContent = DEBATE.againstText;

    renderSides();

    // top ad slot — owned by DroboardAdSlot (unified view-track + ctx)
    var topAdWrap = document.getElementById('debTopAd');
    var topAd = document.getElementById('debTopAdSlot');
    if (topAd && topAdWrap) {
      if (window.DroboardAdSlot) {
        DroboardAdSlot.mount(topAd, { slot: 'debate:top', postId: DEBATE_ID || '' }).then(function (filled) {
          topAdWrap.style.display = filled ? '' : 'none';
        }).catch(function () { topAdWrap.style.display = 'none'; });
      } else {
        topAdWrap.style.display = 'none';
      }
    }

    // attach debate args component
    if (window.DroboardDebateArgs) {
      ARGS = DroboardDebateArgs.attach('#argsMount', {
        sides: { for: DEBATE.forText, against: DEBATE.againstText },
        currentUser: { name: 'You', avatar: 'https://i.pravatar.cc/100?img=5', verified: false },
        requireSide: true,
        userSide: S.side,
        ads: true,
        debateId: DEBATE_ID,
        args: seedArgs(),
        onSidePick: function (side) {
          S.side = side;
          if (!S.userVote) { S.userVote = side; if (side === 'for') DEBATE.forV++; else DEBATE.agV++; renderSides(); }
          saveState();
          toast('You picked: ' + (side === 'for' ? '\u2705 For' : '\u274C Against'));
        },
        onPost: function () {},
        onReply: function () {},
        onLike: function () {},
      });
    }
  }

  window.DebatePage = { init: init, vote: vote, share: share };
})();
