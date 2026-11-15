/* ═══════════════════════════════════════════════════════════════
   DEBATE SERVICE
   Standalone debate page. All vote state lives in the backend.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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

  /* ── Vote state: read from API response, written back to API ── */
  async function persistVote(side) {
    try {
      // Post-based debate vote
      if (!DEBATE || !DEBATE.bookId || !DEBATE.type) {
        await fetch('/api/posts/' + encodeURIComponent(DEBATE_ID) + '/debate/vote', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side })
        });
      } else if (DEBATE.type === 'chapter') {
        // Chapter-scoped debate vote
        await fetch('/api/stories/' + encodeURIComponent(DEBATE.bookId) + '/chapters/' + encodeURIComponent(DEBATE.chapterId) + '/debate/vote', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side: side === 'for' ? 'for' : 'against' })
        });
      } else {
        // Book-level debate vote
        await fetch('/api/stories/' + encodeURIComponent(DEBATE.bookId) + '/engagement/vote', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: DEBATE_ID, kind: 'debate', side: side === 'for' ? 'for' : 'against' })
        });
      }
    } catch (e) {}
  }

  /* ── seed arguments live in debate-args.js (single source of truth);
     this copy below is a fallback only, used if the component is missing ── */
  function seedArgs() {
    if (window.DroboardDebateArgs && DroboardDebateArgs.seedArgs) return window.DroboardDebateArgs.seedArgs();
    return []; // No fallback demo data — let real data load from API
  }

  /* ── poster (who started the debate) → profile link ── */
  function posterFrom(post, time, forceOfficial) {
    if (!post) return null;
    var name = post.name || post.author || '';
    var avatar = post.avatar || '';
    var handle = post.handle || post.username || (name ? name.replace(/\s+/g, '_') : '');
    
    // Do NOT treat any name as "official" — show the actual creator
    return {
      name: name || 'Unknown',
      avatar: avatar,
      href: 'profile.html?u=' + encodeURIComponent(handle || name),
      time: time || post.time || '',
      official: false
    };
  }

  /* ── resolve debate — all data from API ──
     Three paths: (1) Post-based: /api/posts/:id (debate posts with threading)
                  (2) Chapter-debate by ID: /api/debates/:debateId?book=<bookId>&ch=<chapterId>
                  (3) Book-debate by ID: /api/debates/:debateId?book=<bookId>
  */
  async function resolveDebate() {
    var params = new URLSearchParams(location.search);
    var postId = params.get('id') || params.get('d');
    var debateId = params.get('debate');
    var bookId = params.get('book');
    var chapterId = params.get('ch');
    var sidePicked = params.get('side'); // pre-selected side from accordion click
    
    if (!postId && !debateId && !bookId) throw new Error('No debate id or book in URL');

    // Path 1: Post-based debate (from feed/droboard)
    if (postId && !debateId && !bookId) {
      var res = await fetch('/api/posts/' + encodeURIComponent(postId), { credentials: 'include' });
      if (!res.ok) throw new Error('Debate API failed: ' + res.status);
      var post = await res.json();
      var d = (post && post.debateData) || {};

      // Restore user's prior vote from API response
      S.userVote = post.userVote || null;
      S.side = post.userSide || S.userVote || null;
      
      DEBATE_ID = postId; // Set for backend API calls

      return {
        id: postId,
        question: d.question || d.motion || post.title || 'Join the debate.',
        prompt: d.prompt || '',
        forText: d.forText || 'For',
        againstText: d.againstText || 'Against',
        forV: d.forV || 0,
        agV: d.agV || 0,
        expiresAt: post.expiresAt || null,
        poster: posterFrom(post),
      };
    }

    // Path 2 & 3: Debate by ID (chapter-level or book-level)
    if (debateId && bookId) {
      var queryStr = '?book=' + encodeURIComponent(bookId);
      if (chapterId) queryStr += '&ch=' + encodeURIComponent(chapterId);
      
      var debateRes = await fetch('/api/debates/' + encodeURIComponent(debateId) + queryStr, { credentials: 'include' });
      if (!debateRes.ok) throw new Error('Debate API failed: ' + debateRes.status);
      var debate = await debateRes.json();
      
      if (!debate || !debate.motion) throw new Error('No debate found');

      // Restore user's prior vote
      S.userVote = debate.userVote || null;
      S.side = sidePicked || S.userVote || null;
      
      DEBATE_ID = debateId;

      return {
        id: debateId,
        question: debate.motion || 'Join the debate.',
        prompt: '',
        forText: debate.forText || 'For',
        againstText: debate.againstText || 'Against',
        forV: debate.forV || 0,
        agV: debate.agV || 0,
        expiresAt: debate.expiresAt || null,
        poster: null,
        bookId: bookId,
        chapterId: debate.chapterId || null,
        type: debate.type || (chapterId ? 'chapter' : 'book'),
      };
    }

    throw new Error('Invalid debate URL parameters');
  }

  /* ── render sides ── */
  function isShut() { return !!(window.DroboardExpiry && DroboardExpiry.isClosed(DEBATE)); }
  function renderSides() {
    var d = DEBATE;
    var total = (d.forV || 0) + (d.agV || 0) || 1;
    var forPct = Math.round((d.forV / total) * 100) || 0;
    var agPct = Math.round((d.agV / total) * 100) || 0;
    var shut = isShut();

    document.getElementById('forFill').style.width = forPct + '%';
    document.getElementById('agFill').style.width = agPct + '%';
    document.getElementById('forPct').textContent = forPct + '%';
    document.getElementById('agPct').textContent = agPct + '%';
    document.getElementById('forCnt').textContent = fmtN(d.forV) + ' votes';
    document.getElementById('agCnt').textContent = fmtN(d.agV) + ' votes';
    document.getElementById('debTotal').textContent = shut
      ? fmtN((d.forV || 0) + (d.agV || 0)) + ' votes — final'
      : fmtN((d.forV || 0) + (d.agV || 0)) + ' joined the discussion';

    document.getElementById('sideFor').classList.toggle('chosen', S.userVote === 'for');
    document.getElementById('sideAg').classList.toggle('chosen', S.userVote === 'against');
    document.getElementById('debSides').classList.toggle('shut', shut);

    var badge = document.getElementById('debBadge');
    if (badge) badge.innerHTML = shut
      ? '<i class="fas fa-lock"></i> Debate closed'
      : '<span class="deb-live"></span> Live Debate';
    if (d.expiresAt && !shut) {
      var ms = +d.expiresAt - Date.now(), h = ms / 3600000;
      badge.innerHTML = '<span class="deb-live"></span> Closes in ' + (h < 1 ? Math.max(1, Math.round(ms / 60000)) + 'm' : h <= 72 ? Math.round(h) + 'h' : Math.round(h / 24) + 'd');
    }
    var shutLine = document.getElementById('debClosed');
    if (shutLine) {
      shutLine.style.display = shut ? '' : 'none';
      if (shut) shutLine.innerHTML = '<i class="fas fa-lock" style="color:#c92a2a;margin-right:6px"></i> Voting closed ' +
        new Date(+d.expiresAt || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
        ' — ' + (forPct >= agPct ? '\u2705 ' + esc(d.forText) : '\u274C ' + esc(d.againstText)) + ' won at ' + Math.max(forPct, agPct) + '%.';
    }
  }

  /* ── vote ── */
  function vote(side) {
    if (isShut()) { toast('This debate has closed — the result is final.'); return; }
    if (S.userVote === side) return;
    if (S.userVote === 'for') DEBATE.forV--;
    if (S.userVote === 'against') DEBATE.agV--;
    S.userVote = side;
    if (side === 'for') DEBATE.forV++;
    else DEBATE.agV++;
    if (!S.side) S.side = side;
    persistVote(side);
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
    DEBATE = await resolveDebate();
    // S already populated from API in resolveDebate

    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onFollow: function (post) { toast('✅ Following @' + post.name + '!'); },
        onReport: function (post) { DroboardDotsMenu.openReportTypes(post); },
        onReportType: function (post, typeId) {
          fetch('/api/reports', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'debate_arg', targetId: post.id, reason: typeId })
          }).catch(() => {});
          toast('🚩 Report submitted. Thank you.');
        },
        onCopyLink: function () { toast('🔗 Link copied'); },
      });
    }

    document.getElementById('debQ').textContent = DEBATE.question;
    var posterEl = document.getElementById('debPoster');
    if (posterEl) {
      var pt = DEBATE.poster;
      if (pt) {
        posterEl.href = pt.href;
        posterEl.innerHTML =
          '<img class="deb-poster-av" src="' + esc(pt.avatar) + '" alt="" loading="lazy" onerror="this.src=\'../assets/droboard-icon.png\'"/>' +
          '<span><span class="deb-poster-name">' + (pt.official ? '<i class="fas fa-shield-halved" style="font-size:10px;color:var(--acc);margin-right:3px"></i>' : '') + esc(pt.name) + '</span>' +
          (pt.time ? '<span class="deb-poster-time">' + esc(pt.time) + '</span>' : '') + '</span>';
        posterEl.style.display = '';
      } else {
        posterEl.style.display = 'none';
      }
    }
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
        readOnly: isShut(),
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
