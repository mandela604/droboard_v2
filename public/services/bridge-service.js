/* ═══════════════════════════════════════════════════════════════
   BRIDGE SERVICE
   Story detail page data + rendering. HTML calls BridgePage.init().
   LIVE ONLY: every number, row and card comes from the backend
   (GET /api/books/:id and the /api/stories engagement routes).
   On any API failure the page shows an explicit error empty-state —
   demo content is never substituted.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  let DATA = null;
  let STORY_ID = null;
  const S = { heroFollow: false, synExp: false, engOpen: null, busy: {} };

  function fmtN(n) { n = +n || 0; if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(n); }
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function toast(m) {
    let t = document.getElementById('bridgeToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'bridgeToast';
      t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(14px);background:#111118;color:#f5f5f7;padding:8px 16px;border-radius:999px;font-size:12px;font-weight:600;z-index:900;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.09);box-shadow:0 4px 20px rgba(0,0,0,.35);font-family:var(--font-b)';
      document.body.appendChild(t);
    }
    t.textContent = m;
    t.classList.add('show');
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(14px)'; }, 2500);
  }

  /* Shared live-fetch helper: surfaces the backend's own error message
     (e.g. the 404 'not_found' for an unknown story id) — never a silent
     fallback. */
  async function apiJson(res, label) {
    let j = null;
    try { j = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const detail = (j && (j.error || j.message)) || '';
      throw new Error(label + ' failed (' + res.status + ')' + (detail ? ' — ' + detail : ''));
    }
    return j;
  }
  async function getJSON(url, label) {
    return apiJson(await fetch(url, { credentials: 'include' }), label);
  }
  async function postJSON(url, body, label, method) {
    return apiJson(await fetch(url, {
      method: method || 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }), label);
  }

  async function fetchStory(id) {
    const res = await fetch(`${API_BASE}/books/${encodeURIComponent(id)}`, { credentials: 'include' });
    let j = null;
    try { j = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const detail = (j && (j.error || j.message)) || '';
      throw new Error('Story not found (' + res.status + ')' + (detail ? ' — ' + detail : ''));
    }
    return j;
  }

  function catOf(s) {
    const board = (s.hubs && s.hubs.board) || null;
    const name = s.genre || (board && board.name) || 'Story';
    return { emoji: (board && board.icon) || '📖', name: name };
  }

  // Maps GET /api/books/:id response → bridge DATA shape. No synthesis:
  // missing fields stay empty and the renderers show honest empty states.
  function normalizeStory(s) {
    if (!s) return null;
    const rows = Array.isArray(s.chapters) ? s.chapters : [];
    const totalCh = rows.length || s.chapterCount || 0;
    const totalWords = rows.reduce((a, c) => a + (c.words || 0), 0);
    const cat = catOf(s);
    const genre = s.genre || cat.name;

    // engagement: backend sends { polls[], predictions[], debates[] } —
    // rows only exist when the author created them (id === null → none).
    const eng = s.engagement || {};
    const poll0 = (eng.polls || [])[0] || null;
    const pred0 = (eng.predictions || [])[0] || null;
    const deb0  = (eng.debates || [])[0] || null;

    // reactions: backend sends { counts: { love, crying, ... }, userRx }
    const rxCounts = (s.reactions && s.reactions.counts) ? s.reactions.counts : {};
    const userRx   = (s.reactions && s.reactions.userRx) || null;

    // continue reading from backend continueReading object
    const cr = s.continueReading || null;
    const firstFreeChapter = rows.find(c => !c.price || c.price === 0) || rows[0] || {};
    const continueChId = cr ? (cr.chapterId || firstFreeChapter.n || 1) : (firstFreeChapter.n || 1);
    const continueRow = rows.find(c => String(c.n) === String(continueChId) || c.id === continueChId);
    const continueChTitle = continueRow ? (continueRow.title || 'Chapter ' + continueChId) : (firstFreeChapter.title || (totalCh ? 'Chapter 1' : '—'));
    const continuePct = cr ? Math.round(cr.pct || 0) : 0;

    // hubs: backend sends hubs.board (null when the story has no category
    // board) and circle: null until a membership model ships.
    const board = (s.hubs && s.hubs.board) || null;

    // similar: backend sends similar[{ id, title, cover, author: {name,handle,avatar} }]
    const similar = (s.similar || []).map(x => ({
      id: x.id, img: x.cover || '', title: x.title || '',
      author: (x.author && (x.author.name || x.author.handle)) || '',
    }));

    const stats = s.stats || {};
    const w = s.writer || {};

    return {
      id: s.id, title: s.title || 'Untitled', cover: s.cover || '',
      category: cat, genre: genre,
      tropes: (Array.isArray(s.tropes) ? s.tropes : []).slice(0, 3),
      length: totalCh <= 25 ? 'short' : 'long',
      chapterLabel: s.lastChapterN ? 'Ch ' + s.lastChapterN : (totalCh ? 'Ch ' + totalCh : 'Ch 1'),
      writer: {
        id: w.id, name: w.name || w.username || 'Unknown',
        handle: w.handle || (w.username ? '@' + w.username : '@unknown'),
        username: w.username || '',
        avatar: w.avatar || '',
        followers: w.followers || 0,
        following: !!w.following,
        verified: !!w.verified,
        stories: w.stories || 0,
        reads: w.reads || 0,
        rating: w.rating || 0,
        bio: w.bio || '',
      },
      stats: {
        comments: stats.comments || 0,
        reads: stats.reads || s.reads || 0,
        shares: stats.shares || 0,
        rating: stats.rating || s.rating || 0,
        ratingCount: stats.ratingCount || s.ratingCount || 0,
      },
      likes: s.likes || stats.likes || 0,
      continue: { chapterId: continueChId, chapterTitle: continueChTitle, progress: continuePct, timeLeft: cr && cr.secondsSpent ? fmtN(cr.secondsSpent) + 's read' : '' },
      synopsis: { short: s.synopsis || '' },
      engagement: {
        poll: poll0 ? {
          id: poll0.id,
          q: poll0.q || '',
          opts: (poll0.opts || []).map(o => ({ t: o.t, v: o.v || 0 })),
          voted: poll0.myVote != null ? poll0.myVote : -1,
        } : null,
        debate: deb0 ? {
          id: deb0.id,
          q: deb0.motion || '',
          dFor: deb0.forV || 0,
          dAg: deb0.agV || 0,
          voted: deb0.myVote != null ? deb0.myVote : -1,
        } : null,
        pred: pred0 ? {
          id: pred0.id,
          q: pred0.q || '',
          opts: (pred0.opts || []).map(o => ({ t: o.t, v: o.v || 0 })),
          voted: pred0.myVote != null ? pred0.myVote : -1,
        } : null,
      },
      hubs: {
        board: board,
        genre: board
          ? { name: board.name, slug: board.slug || '', icon: board.icon || cat.emoji, members: board.members || 0, joined: !!board.joined }
          : null,
        circle: null,
      },
      details: [
        { icon: '📚', lbl: 'Type', val: (totalCh <= 25 ? 'Short' : 'Long') + ' story · ' + (s.status === 'completed' ? 'Completed' : 'Ongoing') },
        { icon: '🏷️', lbl: 'Category', val: cat.emoji + ' ' + cat.name, acc: true },
        { icon: '🎭', lbl: 'Genre', val: genre, acc: true },
        ...(totalCh ? [{ icon: '📅', lbl: 'Chapters', val: totalCh + ' Chapter' + (totalCh === 1 ? '' : 's') }] : []),
        { icon: '⏱️', lbl: 'Read time', val: totalWords && totalCh ? Math.max(1, Math.round(totalWords / 200 / totalCh)) + ' min/chapter' : '—' },
        { icon: '📝', lbl: 'Word count', val: totalWords ? totalWords.toLocaleString() + ' words' : '—' },
        { icon: '✅', lbl: 'Status', val: s.status === 'completed' ? 'Completed' : 'Ongoing', acc: true },
      ],
      tags: (Array.isArray(s.tags) ? s.tags : []).slice(0, 8),
      similar: similar,
      reactions: {
        userRx: userRx,
        love: rxCounts.love || 0, crying: rxCounts.crying || 0,
        angry: rxCounts.angry || 0, shocked: rxCounts.shocked || 0,
        broken: rxCounts.broken || 0, emotional: rxCounts.emotional || 0,
        savage: rxCounts.savage || 0, sus: rxCounts.sus || 0,
        twist: rxCounts.twist || 0, laughing: rxCounts.laughing || 0,
      },
      tipCount: s.tipCount || 0,
      save: s.save || null,
      chapters: rows.map((c, i) => ({
        n: c.n, title: c.title || 'Chapter ' + c.n,
        meta: c.words ? Math.max(1, Math.round(c.words / 200)) + ' min · ' + c.words + ' words' : '—',
        badge: c.price > 0 ? 'paid' : (i === 0 ? 'free' : null),
        state: c.price > 0 ? 'locked' : (i === 0 ? 'current' : 'done'),
      })),
    };
  }

  /* ── SITE THEME — mirror Settings page (droboardTheme light/dark).
     Bridge styles key off body.theme-white, so map it here on every
     init + when returning via bfcache. ── */
  function applySiteTheme() {
    try {
      const t = localStorage.getItem('droboardTheme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
      if (t === 'light') document.body.classList.add('theme-white');
      else document.body.classList.remove('theme-white');
    } catch (e) {}
  }
  try { window.addEventListener('pageshow', applySiteTheme); } catch (e) {}
  try { window.addEventListener('storage', (e) => { if (e && e.key === 'droboardTheme') applySiteTheme(); }); } catch (e) {}

  function renderAll() {
    renderHero();
    renderStats();
    renderContinue();
    renderSynopsis();
    renderRating();
    renderTropes();
    renderEngagement();
    renderChapterCount();
    renderReactions();
    renderHubs();
    renderWriter();
    renderComments();
    renderDetails();
    renderTags();
    renderSimilar();
    setupTip();
    setupScrollListener();
  }

  /* ── RATING — live: GET /api/stories/:id/rating { ok, mine, avg, count }.
     Stars persist across open/close toggles via myRating. */
  let myRating = 0;
  let ratingGate = null;   // last GET /rating payload: {chaptersRead, need, canRate}
  function goToDebate() {
    location.href = 'debate.html?id=' + encodeURIComponent(STORY_ID || '');
  }
  function toggleRate() {
    const box = document.getElementById('rateBox');
    if (box) box.classList.toggle('open');
    // Re-paint from memory so open/close never clears lit stars.
    try {
      const wrap = document.getElementById('rateStars');
      if (wrap) [...wrap.querySelectorAll('.rate-star')].forEach((s, i) => s.classList.toggle('lit', i < myRating));
    } catch (e) {}
  }
  async function loadRating() {
    try {
      const r = await getJSON(`${API_BASE}/stories/${encodeURIComponent(STORY_ID)}/rating`, 'Rating API');
      myRating = (r.mine && r.mine.stars) || 0;
      DATA.stats.rating = r.avg || 0;
      DATA.stats.ratingCount = r.count || 0;
      ratingGate = r;
    } catch (e) { /* rating strip falls back to the story payload numbers */ }
    renderRating();
  }
  function renderRating() {
    const wrap = document.getElementById('rateStars');
    if (!wrap) return;
    const stars = [...wrap.querySelectorAll('.rate-star')];
    const label = document.getElementById('rateLabel');
    const avgEl = document.getElementById('rateAvg');
    const yoursEl = document.getElementById('rateYours');
    const hint = document.getElementById('rateHint');
    const base = parseFloat(DATA.stats.rating) || 0;

    function paint(n) {
      stars.forEach((s, i) => {
        s.classList.toggle('lit', i < n);
        s.classList.remove('pop');
        if (i === n - 1) { void s.offsetWidth; s.classList.add('pop'); }
      });
    }
    function updateAvg() {
      avgEl.innerHTML = `<b>${base.toFixed(1)}★</b> · ${fmtN(DATA.stats.ratingCount)} ratings`;
      const rc = document.getElementById('rateRevCount');
      if (rc) rc.textContent = fmtN(DATA.stats.ratingCount);
    }
    function syncText() {
      if (myRating) {
        label.textContent = ['Terrible', 'Bad', 'Okay', 'Good', 'Great!'][myRating - 1];
        yoursEl.textContent = '✓ You rated ' + myRating + ' star' + (myRating > 1 ? 's' : '');
        yoursEl.classList.add('show');
        hint.textContent = 'Tap to edit your review';
      } else {
        label.textContent = 'Tap a star to rate';
        yoursEl.classList.remove('show');
        hint.textContent = 'Tap to rate this story';
      }
    }
    paint(myRating);
    syncText();
    updateAvg();
  }

  /* ── PROFILE NAV + STATUS RING ──
     Same contract as comments/debate: the avatar gets a red ring ONLY when
     the writer actually has statuses (live from the status service, which
     reads GET /api/statuses/writers by handle), gray after the status has
     been viewed, and no ring at all for a statusless avatar. */
  function writerRing(w, size) {
    return DroboardStatusRing.html(w || {}, {
      size: size, key: (w && (w.name || w.handle || w.id)) || '',
      innerHtml: '<img src="' + ((w && w.avatar) || '') + '" loading="lazy" alt=""/>',
      innerBg: '#000', gapColor: 'var(--bg,#000)',
      attrs: 'onclick="BridgePage.onWriterAvatar()"',
    });
  }
  function goProfile() {
    const w = DATA.writer || {};
    location.href = 'profile.html?u=' + encodeURIComponent(String(w.username || w.handle || w.name || '').replace(/^@/, ''));
  }
  function attachWriterStatus() {
    const w = DATA && DATA.writer;
    if (!w || w._stWired) return;
    w._stWired = true;
    try {
      const name = String(w.username || w.handle || w.name || '').replace(/^@/, '');
      const statuses = (window.DroboardStatus && DroboardStatus.writerStatuses(name)) || [];
      w.statuses = statuses;
      w.statusRing = statuses.length ? 'has' : 'none';
    } catch (e) { w.statuses = []; w.statusRing = 'none'; }
  }
  function openWriterStatus() {
    const w = DATA.writer || {};
    if (!(w.statuses && w.statuses.length) || typeof window.openStatusViewer !== 'function') return false;
    window.openStatusViewer([{
      id: 'bridge_writer', name: w.name, avatar: w.avatar,
      ring: w.statusRing === 'viewed' ? 'ring-viewed' : 'ring-has',
      likes: 0, threads: 0, statuses: w.statuses,
    }], 'bridge_writer');
    return true;
  }
  function onWriterAvatar() {
    if (openWriterStatus()) return;
    goProfile();
  }
  /* Status viewed → gray the ring (chained so any other handler still runs) */
  function wireStatusRing() {
    const prev = window.onStatusViewerChange;
    window.onStatusViewerChange = function (wid, ring, name) {
      const w = DATA && DATA.writer;
      // The viewer keys on the author's name, not our 'bridge_writer' id.
      const isWriter = w && (String(w.name || '').toLowerCase() === String(name || wid || '').toLowerCase());
      if (isWriter && w) {
        // Viewer reports full class names ('ring-viewed' | 'ring-has')
        const newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : ring === 'ring-live' ? 'live' : 'none';
        w.statusRing = newRing;
        // Only this writer's rings — the page also carries commenter avatars.
        document.querySelectorAll('[data-status-ring]').forEach(el => {
          if (String(el.getAttribute('data-status-ring') || '').toLowerCase() !== String(w.name || '').toLowerCase()) return;
          el.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
          if (newRing === 'has' || newRing === 'viewed' || newRing === 'live') el.classList.add('ring-' + newRing);
        });
      }
      if (typeof prev === 'function') prev(wid, ring, name);
    };
  }

  function renderHero() {
    const d = DATA;
    document.getElementById('heroSec').innerHTML = `
      <div class="hero-bg" style="background-image:url('${d.cover}')"></div>
      <div class="hero-scrim"></div>
      <div class="hero-top">
        <span class="hbadge hb-cat">${d.category.emoji} ${esc(d.category.name)}</span>
        ${d.genre ? `<span class="hbadge hb-genre">${esc(d.genre)}</span>` : ''}
        ${d.tropes && d.tropes[0] ? `<span class="hbadge hb-trope">✨ ${esc(d.tropes[0])}</span>` : ''}
        <span class="hbadge hb-type">${esc(d.chapterLabel || '')}</span>
      </div>
      <div class="hero-body">
        <div class="hero-title">${esc(d.title)}</div>
        <div class="hero-writer">
          ${writerRing(d.writer, 34)}
          <div class="hw-info">
            <div class="hw-name" onclick="BridgePage.goProfile()">${esc(d.writer.name)}</div>
            <div class="hw-handle">${esc(d.writer.handle)} · ${fmtN(d.writer.followers)} followers</div>
          </div>
          <button class="hw-follow${d.writer.following ? ' ing' : ''}" id="heroFollow" onclick="BridgePage.toggleFollow()">${d.writer.following ? '✓ Following' : '+ Follow'}</button>
        </div>
      </div>`;
  }

  function renderStats() {
    const d = DATA;
    const likes = d.likes != null ? d.likes : ((d.reactions || {}).love || 0);
    document.getElementById('statsStrip').innerHTML = `
      <div class="stat-cell"><div class="sn acc" id="likesStatN">${fmtN(likes)}</div><div class="sl">Likes</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.comments)}</div><div class="sl">Comments</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.reads)}</div><div class="sl">Reads</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.shares)}</div><div class="sl">Shares</div></div>
      <div class="stat-cell"><div class="sn gold">${d.stats.rating ? d.stats.rating + '★' : '—'}</div><div class="sl">Rating</div></div>`;
  }

  function renderContinue() {
    const c = DATA.continue;
    document.getElementById('rpTitle').textContent = c.chapterTitle;
    document.getElementById('rpBarFill').style.width = c.progress + '%';
    document.getElementById('rpPct').textContent = c.progress + '% complete';
    document.getElementById('rpLeft').textContent = c.timeLeft || '—';
  }

  function renderSynopsis() {
    document.getElementById('synText').innerHTML = esc(DATA.synopsis.short) || '<span style="color:var(--muted)">No synopsis yet.</span>';
    const btn = document.getElementById('synBtn');
    if (btn) btn.style.display = (DATA.synopsis.short || '').length > 300 ? '' : 'none';
  }

  function renderEngagement() {
    const e = DATA.engagement;
    document.getElementById('pollSub').textContent = e.poll ? fmtN(e.poll.opts.reduce((s, o) => s + o.v, 0)) + ' votes' : 'No poll yet';
    document.getElementById('debateSub').textContent = e.debate ? fmtN(e.debate.dFor + e.debate.dAg) + ' live' : 'No debate yet';
    document.getElementById('predSub').textContent = e.pred ? fmtN(e.pred.opts.reduce((s, o) => s + o.v, 0)) + ' locked' : 'No prediction yet';
    renderPoll();
    renderDebate();
    renderPred();
  }

  function renderPoll() {
    const p = DATA.engagement.poll;
    const el = document.getElementById('pollOpts');
    if (!p) {
      el.innerHTML = '<div style="padding:14px;text-align:center;font-size:11px;color:var(--muted)">The writer hasn\u2019t posted a poll yet.</div>';
      document.getElementById('pollQ').textContent = 'Poll';
      document.getElementById('pollTotal').textContent = '';
      S.pollVoted = -1;
      return;
    }
    S.pollVoted = p.voted;
    document.getElementById('pollQ').textContent = p.q;
    const opts = p.opts;
    const tot = opts.reduce((s, o) => s + o.v, 0) || 1;
    el.innerHTML = opts.map((o, i) => {
      const pct = Math.round(o.v / tot * 100);
      return `<div class="ec-opt${S.pollVoted === i ? ' voted' : ''}" onclick="BridgePage.votePoll(${i})"><div class="ec-opt-bar" style="width:${pct}%"></div><div class="ec-opt-inner"><span class="ec-opt-text">${esc(o.t)}</span><span class="ec-opt-pct">${pct}%</span></div></div>`;
    }).join('');
    document.getElementById('pollTotal').textContent = fmtN(opts.reduce((s, o) => s + o.v, 0)) + ' votes';
  }

  function renderDebate() {
    const db = DATA.engagement.debate;
    const qEl = document.getElementById('debateQ');
    const sides = document.getElementById('dFor');
    if (!db) {
      if (sides) sides.parentElement.style.display = 'none';
      qEl.textContent = 'No debate yet';
      document.getElementById('debateLiveTotal').textContent = '0';
      document.getElementById('debateVoicesTotal').textContent = '0 voices';
      S.debateVote = null;
      return;
    }
    if (sides) sides.parentElement.style.display = '';
    S.debateVote = db.voted === 0 ? 'for' : db.voted === 1 ? 'against' : null;
    qEl.textContent = db.q;
    const tot = db.dFor + db.dAg || 1;
    const fp = Math.round(db.dFor / tot * 100);
    document.getElementById('forBar').style.width = fp + '%';
    document.getElementById('agBar').style.width = (100 - fp) + '%';
    document.getElementById('forPct').textContent = fp + '%';
    document.getElementById('agPct').textContent = (100 - fp) + '%';
    document.getElementById('forCnt').textContent = fmtN(db.dFor) + ' readers';
    document.getElementById('agCnt').textContent = fmtN(db.dAg) + ' readers';
    document.getElementById('dFor').classList.toggle('chosen', S.debateVote === 'for');
    document.getElementById('dAg').classList.toggle('chosen', S.debateVote === 'against');
    document.getElementById('debateLiveTotal').textContent = fmtN(db.dFor + db.dAg);
    document.getElementById('debateVoicesTotal').textContent = fmtN(db.dFor + db.dAg) + ' voices';
  }

  function renderPred() {
    const p = DATA.engagement.pred;
    const el = document.getElementById('predOpts');
    if (!p) {
      el.innerHTML = '<div style="padding:14px;text-align:center;font-size:11px;color:var(--muted)">The writer hasn\u2019t posted a prediction yet.</div>';
      document.getElementById('predQ').textContent = 'Prediction';
      document.getElementById('predTotal').textContent = '';
      S.predVoted = -1;
      return;
    }
    S.predVoted = p.voted;
    document.getElementById('predQ').textContent = p.q;
    const opts = p.opts;
    const tot = opts.reduce((s, o) => s + o.v, 0) || 1;
    el.innerHTML = opts.map((o, i) => {
      const pct = Math.round(o.v / tot * 100);
      return `<div class="ec-opt${S.predVoted === i ? ' voted' : ''}" onclick="BridgePage.votePred(${i})"><div class="ec-opt-bar" style="width:${pct}%"></div><div class="ec-opt-inner"><span class="ec-opt-text">${esc(o.t)}</span><span class="ec-opt-pct">${pct}%</span></div></div>`;
    }).join('');
    document.getElementById('predTotal').textContent = fmtN(opts.reduce((s, o) => s + o.v, 0)) + ' predictions';
  }

  function chapterCountTotal() {
    return (DATA.chapters || []).length;
  }
  function renderChapterCount() {
    const totalCh = chapterCountTotal();
    const kind = DATA.length === 'short' ? 'Short story' : 'Long story';
    document.getElementById('chCountN').textContent = totalCh > 0 ? totalCh + ' Chapters' : 'No chapters yet';
    document.getElementById('chCountSub').textContent = totalCh > 0 ? totalCh + ' chapters · ' + kind : kind;
  }

  function renderReactions() {
    const rx = DATA.reactions;
    const items = [
      { emoji: '❤️', label: 'Love', key: 'love', count: rx.love },
      { emoji: '😭', label: 'Crying', key: 'crying', count: rx.crying },
      { emoji: '😡', label: 'Angry', key: 'angry', count: rx.angry },
      { emoji: '😱', label: 'Shocked', key: 'shocked', count: rx.shocked },
      { emoji: '💔', label: 'Broken', key: 'broken', count: rx.broken },
      { emoji: '🥺', label: 'Emotional', key: 'emotional', count: rx.emotional },
      { emoji: '🔥', label: 'Savage', key: 'savage', count: rx.savage },
      { emoji: '🤨', label: 'Sus', key: 'sus', count: rx.sus },
    ];
    document.getElementById('rxGrid').innerHTML = items.map(r =>
      `<div class="rx-card${rx.userRx === r.key ? ' picked' : ''}"><div class="rx-e">${r.emoji}</div><div class="rx-l">${r.label}</div><div class="rx-n">${fmtN(r.count)}</div></div>`
    ).join('');
  }

  function renderHubs() {
    const h = (DATA.hubs || {}).genre;
    const wrap = document.getElementById('hubsWrap');
    if (!wrap) return;
    // No backend board → no hub card. A fabricated hub promises a join the
    // backend cannot honour.
    if (!h) { wrap.innerHTML = '<div style="text-align:center;font-size:11px;color:var(--muted);padding:12px 0">No community board for this story yet.</div>'; return; }
    if (!window.DroboardCommunityCards) return;
    DroboardCommunityCards.mount(wrap, {
      genre: h,
      circle: null,
      showCircle: false,
      onJoin: (type, joined) => joinHub(joined),
    });
  }

  function renderWriter() {
    const w = DATA.writer;
    document.getElementById('writerBody').innerHTML = `
      <div class="wc-av-row">
        ${writerRing(w, 48)}
        <button class="wc-follow${w.following ? ' ing' : ''}" id="wcFollow" onclick="BridgePage.toggleFollow()">${w.following ? '✓ Following' : '+ Follow'}</button>
      </div>
      <div class="wc-name" style="cursor:pointer" onclick="BridgePage.goProfile()">${esc(w.name)}</div>
      <div class="wc-handle">${esc(w.handle)} ${w.verified ? '<span class="wc-vbadge">✓ Verified</span>' : ''}</div>
      <div class="wc-bio">${esc(w.bio)}</div>
      <div class="wc-stats">
        <div class="ws"><div class="ws-n">${fmtN(w.stories)}</div><div class="ws-l">Stories</div></div>
        <div class="ws"><div class="ws-n">${fmtN(w.reads)}</div><div class="ws-l">Reads</div></div>
        <div class="ws"><div class="ws-n">${w.rating}★</div><div class="ws-l">Rating</div></div>
        <div class="ws"><div class="ws-n">${fmtN(w.followers)}</div><div class="ws-l">Followers</div></div>
      </div>
      <div class="wc-view-btn" onclick="BridgePage.goProfile()"><i class="fas fa-arrow-right" style="font-size:11px"></i> View Full Profile</div>`;
  }

  /* ── COMMENTS — live thread via the shared comment component
     (GET/POST /api/comments, scope=story). */
  function renderComments() {
    const mount = document.getElementById('commentsPlaceholder');
    if (!mount) return;
    const fail = (msg) => {
      mount.innerHTML = '<div class="empty" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Could not load comments — ' + esc(msg) + '</div>';
    };
    if (!window.DroboardComments) { fail('comment component missing — hard refresh'); return; }
    mount.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--muted)"><i class="fas fa-spinner fa-spin"></i> Loading comments…</div>';
    const API = window.DroboardComments.api;
    API.fetchComments({ storyId: STORY_ID })
      .then(function (live) {
        const trueTotal = (function countAll(list) {
          return (list || []).reduce(function (n, c) { return n + 1 + countAll(c.replies || []); }, 0);
        })(live);
        window.DroboardComments.attach(mount, {
          storyId: STORY_ID,
          title: fmtN(trueTotal) + ' comments',
          comments: live,
          teams: [],
          currentUser: { name: 'You', avatar: null, team: null },
          requireTeam: false,
          collapsible: true,
          startOpen: false,
          adsFirst: false,
          adsRepeat: false,
          scrollBox: 420,
          fullCommentsUrl: function () { return 'comments.html?story=' + encodeURIComponent(STORY_ID); },
          getCommentUrl: (c) => 'comments.html?story=' + encodeURIComponent(STORY_ID) + '#comment-' + (c && c.id),
          onPost: (c) => API.postComment({ storyId: STORY_ID, text: c.text }),
          onReply: (parentId, c) => API.postComment({ storyId: STORY_ID, text: c.text, parentId: parentId }),
          onEdit: (c, oldText, newText) => API.editComment(c.id, newText),
        });
        const lbl = document.getElementById('cmViewAllLbl');
        if (lbl) lbl.textContent = 'View full comment thread';
      })
      .catch(function (err) {
        fail((err && err.message) || err);
      });
  }

  function renderDetails() {
    document.getElementById('detailsTbl').innerHTML = DATA.details.map(d =>
      `<div class="dt-row"><div class="dt-icon">${d.icon}</div><div class="dt-lbl">${esc(d.lbl)}</div><div class="dt-val${d.acc ? ' acc' : ''}">${esc(d.val)}</div></div>`
    ).join('');
  }

  function renderTropes() {
    const el = document.getElementById('tropeRow');
    if (!el) return;
    const tropes = (DATA.tropes || []).slice(0, 2);
    if (!tropes.length) { el.innerHTML = ''; return; }
    const gid = encodeURIComponent((DATA.genre || '').toLowerCase().replace(/[^a-z]+/g, ''));
    el.innerHTML = tropes.map(t =>
      `<div class="tag" onclick="location.href='genre-hub.html?genre=${gid}'">✨ ${esc(t)}</div>`
    ).join('');
  }

  function renderTags() {
    const el = document.getElementById('tagsRow');
    if (!el) return;
    el.innerHTML = (DATA.tags || []).map(t => {
      const gid = String(t).replace('#', '').toLowerCase();
      return `<div class="tag" onclick="location.href='genre-hub.html?genre=${encodeURIComponent(gid)}'">${esc(t)}</div>`;
    }).join('');
  }

  function renderSimilar() {
    // Shared component (more-like-this.js) renders the header + card row —
    // cards come from DiscoverCard, same as discover + book reader.
    const el = document.getElementById('simScroll');
    if (!el) return;
    const items = (DATA.similar || []).slice(0, 8).map(s => ({
      id: s.id, img: s.img, title: s.title, author: s.author,
    }));
    if (!items.length) { el.innerHTML = ''; return; }
    if (window.DroboardMoreLikeThis) {
      DroboardMoreLikeThis.mount(el, items, { title: 'More Like This', icon: '✨' });
      return;
    }
    el.innerHTML = items.slice(0, 4).map(s =>
      `<div class="sim-card" onclick="location.href='bridge.html?id=${encodeURIComponent(s.id)}'">
        <div class="sim-thumb" style="background-image:url('${s.img}')"><div class="sim-scrim"></div></div>
        <div class="sim-body"><div class="sim-title">${esc(s.title)}</div><div class="sim-author">${esc(s.author)}</div></div>
      </div>`
    ).join('');
  }

  function renderTipLine() {
    const el = document.getElementById('tipCountLbl');
    if (el) el.textContent = fmtN(DATA.tipCount || 0) + ' tips';
  }

  function setupTip() {
    renderTipLine();
    if (!window.DroboardTip) return;
    DroboardTip.attach({
      getWriter: () => ({ id: DATA.writer.id, name: DATA.writer.name, avatar: DATA.writer.avatar, handle: DATA.writer.handle }),
      getAuthorId: () => DATA.writer.id || '',
      onSent: () => { DATA.tipCount = (DATA.tipCount || 0) + 1; renderTipLine(); },
    });
  }

  function openTip() {
    if (!window.DroboardTip) {
      console.error('[Bridge] DroboardTip not loaded — check ../component/tip-picker.js path');
      toast('Tip component not loaded — hard refresh (Ctrl+Shift+R)');
      return;
    }
    DroboardTip.open(STORY_ID, { id: DATA.writer.id, name: DATA.writer.name, avatar: DATA.writer.avatar, handle: DATA.writer.handle });
  }

  function openSave() {
    if (window.DroboardSave) DroboardSave.open(STORY_ID);
    else if (window.openSaveModal) openSaveModal({ title: DATA.title, sub: DATA.writer.name, img: DATA.cover, storyId: STORY_ID });
    else toast('Save unavailable');
  }

  function openShare() {
    if (window.DroboardShare) DroboardShare.open(STORY_ID);
    else if (window.openShareModal) openShareModal({ title: DATA.title, sub: DATA.writer.name, img: DATA.cover, url: location.href });
    else toast('Share unavailable');
  }

  function setupScrollListener() {
    const sb = document.getElementById('scrollBody');
    const tbT = document.getElementById('tbTitle');
    if (sb && tbT) {
      sb.addEventListener('scroll', () => tbT.classList.toggle('vis', sb.scrollTop > 240), { passive: true });
    }
  }

  /* ── LIVE VOTES — POST /api/stories/:bookId/engagement/vote, then the
     totals are re-read from the server (GET …/engagement) so the numbers
     on screen are never a local guess. */
  async function refreshEngagement() {
    const j = await getJSON(`${API_BASE}/stories/${encodeURIComponent(STORY_ID)}/engagement`, 'Engagement API');
    const eng = j.engagement || {};
    const poll0 = (eng.polls || [])[0] || null;
    const pred0 = (eng.predictions || [])[0] || null;
    const deb0  = (eng.debates || [])[0] || null;
    DATA.engagement.poll = poll0 ? {
      id: poll0.id, q: poll0.q || '',
      opts: (poll0.opts || []).map(o => ({ t: o.t, v: o.v || 0 })),
      voted: poll0.myVote != null ? poll0.myVote : -1,
    } : null;
    DATA.engagement.pred = pred0 ? {
      id: pred0.id, q: pred0.q || '',
      opts: (pred0.opts || []).map(o => ({ t: o.t, v: o.v || 0 })),
      voted: pred0.myVote != null ? pred0.myVote : -1,
    } : null;
    DATA.engagement.debate = deb0 ? {
      id: deb0.id, q: deb0.motion || '',
      dFor: deb0.forV || 0, dAg: deb0.agV || 0,
      voted: deb0.myVote != null ? deb0.myVote : -1,
    } : null;
    renderEngagement();
  }

  async function bookVote(body, label) {
    if (window.RequireAuth && !RequireAuth.ensure(label)) return false;
    try {
      await postJSON(`${API_BASE}/stories/${encodeURIComponent(STORY_ID)}/engagement/vote`, body, 'Vote API');
      await refreshEngagement();
      return true;
    } catch (e) {
      const msg = (e && e.message) || 'Vote failed';
      toast(/already_voted/i.test(msg) ? '✅ Already voted!' : 'Vote failed — ' + msg);
      try { await refreshEngagement(); } catch (e2) { /* keep current paint */ }
      return false;
    }
  }

  function votePoll(i) {
    const p = DATA.engagement.poll;
    if (!p || !p.id) return;
    if (S.pollVoted >= 0) { toast('✅ Already voted!'); return; }
    bookVote({ id: p.id, kind: 'poll', option: i }, 'vote in this poll');
  }

  function voteDebate(side) {
    const db = DATA.engagement.debate;
    if (!db || !db.id) return;
    if (S.debateVote) { toast('✅ Already voted!'); return; }
    bookVote({ id: db.id, kind: 'debate', side: side }, 'take a side');
  }

  function votePred(i) {
    const p = DATA.engagement.pred;
    if (!p || !p.id) return;
    if (S.predVoted >= 0) { toast('✅ Already locked!'); return; }
    bookVote({ id: p.id, kind: 'prediction', option: i }, 'lock this prediction');
  }

  function toggleSyn() {
    S.synExp = !S.synExp;
    document.getElementById('synText').classList.toggle('open');
    const btn = document.getElementById('synBtn');
    if (btn) btn.innerHTML = S.synExp
      ? '<i class="fas fa-chevron-up" style="font-size:9px"></i> Show less'
      : '<i class="fas fa-chevron-down" style="font-size:9px"></i> Read more';
  }

  function toggleEng(type) {
    const cards = { poll: 'card-poll', debate: 'card-debate', pred: 'card-pred' };
    const pills = { poll: 'pill-poll', debate: 'pill-debate', pred: 'pill-pred' };
    const activeClass = { poll: 'active-poll', debate: 'active-debate', pred: 'active-pred' };
    const isOpen = S.engOpen === type;
    Object.keys(cards).forEach(k => {
      document.getElementById(cards[k]).classList.remove('open');
      document.getElementById(pills[k]).classList.remove('active-poll', 'active-debate', 'active-pred');
    });
    if (!isOpen) {
      document.getElementById(cards[type]).classList.add('open');
      document.getElementById(pills[type]).classList.add(activeClass[type]);
      S.engOpen = type;
    } else {
      S.engOpen = null;
    }
  }

  /* ── FOLLOW — POST/DELETE /api/users/:handle/follow (server truth), then
     both follow buttons repaint from DATA.writer.following. */
  async function toggleFollow() {
    if (S.busy.follow) return;
    if (window.RequireAuth && !RequireAuth.ensure('follow this writer')) return;
    const w = DATA.writer;
    const handle = String(w.username || w.handle || '').replace(/^@/, '');
    if (!handle) { toast('Follow unavailable'); return; }
    S.busy.follow = true;
    const wantFollow = !w.following;
    try {
      await postJSON(`${API_BASE}/users/${encodeURIComponent(handle)}/follow`, {}, 'Follow API', wantFollow ? 'POST' : 'DELETE');
      w.following = wantFollow;
      paintFollowButtons();
      toast(wantFollow ? `✅ Following ${w.handle}` : `Unfollowed ${w.handle}`);
    } catch (e) {
      toast('Follow failed — ' + ((e && e.message) || 'try again'));
    } finally {
      S.busy.follow = false;
    }
  }
  function paintFollowButtons() {
    const on = !!(DATA.writer && DATA.writer.following);
    ['heroFollow', 'wcFollow'].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.textContent = on ? '✓ Following' : '+ Follow';
      b.classList.toggle('ing', on);
    });
  }

  /* ── HUB JOIN — POST/DELETE /api/categories/:slug/join (the backend board
     row carries the slug + real member count). No board → nothing to join. */
  async function joinHub(joined) {
    const h = (DATA.hubs || {}).genre;
    if (!h || !h.slug) { toast('No board to join'); return; }
    if (S.busy.hub) return;
    if (window.RequireAuth && !RequireAuth.ensure('join this community')) return;
    S.busy.hub = true;
    try {
      await postJSON(`${API_BASE}/categories/${encodeURIComponent(h.slug)}/join`, {}, 'Join API', joined ? 'POST' : 'DELETE');
      h.joined = !!joined;
      h.members = Math.max(0, (h.members || 0) + (joined ? 1 : -1));
      renderHubs();
      toast(h.joined ? `✅ Joined ${h.name}` : `Left ${h.name}`);
    } catch (e) {
      toast('Could not update membership — ' + ((e && e.message) || 'try again'));
    } finally {
      S.busy.hub = false;
    }
  }

  function goToReader() {
    const ch = DATA.continue ? DATA.continue.chapterId : 1;
    window.location.href = `full-reader.html?story=${encodeURIComponent(STORY_ID)}&ch=${encodeURIComponent(ch)}`;
  }

  function goToAllComments() {
    window.location.href = `comments.html?story=${encodeURIComponent(STORY_ID)}`;
  }

  async function init(id) {
    applySiteTheme();
    STORY_ID = id || new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('story');
    if (!STORY_ID) {
      showError('No story ID provided.');
      return;
    }
    document.getElementById('tbTitle').textContent = 'Loading...';
    try {
      const raw = await fetchStory(STORY_ID);
      DATA = normalizeStory(raw);
      if (!DATA) throw new Error('Story data was empty');
    } catch (err) {
      showError(err.message || 'Failed to load story.');
      return;
    }
    document.getElementById('tbTitle').textContent = DATA.title;
    attachWriterStatus();
    renderAll();
    wireStatusRing();
    loadRating();
  }

  function showError(msg) {
    document.getElementById('tbTitle').textContent = 'Error';
    const body = document.getElementById('scrollBody');
    if (body) body.innerHTML = '<div class="empty" style="padding:60px 20px;text-align:center;color:var(--muted);font-size:14px"><i class="fas fa-exclamation-circle" style="font-size:32px;margin-bottom:12px;display:block;color:var(--acc)"></i>Could not load this story — ' + esc(msg) + '</div>';
  }

  /* Rate modal — opens the shared rate-modal; the 12-chapter gate is
     enforced server-side from ReadingProgress rows.
     presetStar: the star tapped on the inline box, pre-lit in the modal. */
  function openRateModal(presetStar) {
    if (!window.openRateModal) { toast('Rate modal not loaded'); return; }
    window.openRateModal({
      storyId: STORY_ID,
      title: DATA.title,
      img: DATA.cover || '',
      presetStars: typeof presetStar === 'number' ? presetStar : 0,
      chaptersRead: ratingGate && ratingGate.chaptersRead,
      need: ratingGate && ratingGate.need,
      canRate: ratingGate && ratingGate.canRate,
      onDone: (r) => {
        if (r && (r.deleted || r.mine === null)) {
          myRating = 0;
        } else {
          myRating = (r && r.mine && r.mine.stars) || (r && r.stars) || myRating;
        }
        if (r && r.avg != null) DATA.stats.rating = r.avg;
        if (r && r.count != null) DATA.stats.ratingCount = r.count;
        if (r && typeof r.canRate === 'boolean') ratingGate = r;
        renderRating();
      }
    });
  }
  /* Inline star tap → open accordion first, then the modal with that star pre-lit */
  function rateStar(n) {
    const box = document.getElementById('rateBox');
    if (box) box.classList.add('open');
    openRateModal(n);
  }

  /* "View all reviews" → book reader, Overview tab, scrolled to reviews.
     Live ids share one space (real book ids), so the bridge id forwards. */
  function openAllReviews() {
    location.href = 'book-reader.html?view=reviews&id=' + encodeURIComponent(STORY_ID || '');
  }

  window.BridgePage = {
    init,
    toast,
    votePoll,
    voteDebate,
    votePred,
    toggleSyn,
    toggleEng,
    toggleFollow,
    joinHub,
    goToReader,
    goToAllComments,
    openTip,
    openSave,
    openShare,
    toggleRate,
    openRateModal,
    rateStar,
    openAllReviews,
    goProfile,
    onWriterAvatar,
    goToDebate,
  };
})();
