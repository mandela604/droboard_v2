/* ═══════════════════════════════════════════════════════════════
   BRIDGE SERVICE
   Story detail page data + rendering. HTML calls BridgePage.init().
   When going live: set USE_API = true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  let DATA = null;
  let STORY_ID = null;
  const S = { heroFollow: false, debateVote: null, pollVoted: -1, predVoted: -1, synExp: false, engOpen: null };

  function fmtN(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
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

  async function fetchStory(id) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/stories/${id}`);
      if (!res.ok) throw new Error('Story API failed');
      return res.json();
    }
    if (window.DemoData && window.DemoData.STORIES) {
      return window.DemoData.STORIES.find(s => s.id === id) || null;
    }
    return null;
  }

  function getDefaultStory(id) {
    return {
      id: id,
      title: "I came home early and caught my husband kissing my late sister's photograph",
      cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&q=85',
      category: { emoji: '💔', name: 'Betrayal' },
      type: 'Series',
      seasonChapterLabel: 'S2 · Ch 4',
      writer: {
        name: 'Ada_Writes', handle: '@ada_writes', avatar: 'https://i.pravatar.cc/100?img=32',
        followers: 12400, following: false, verified: true, stories: 8, reads: 171000, rating: 4.7,
        bio: "Telling stories that live in your chest long after you close the tab. Betrayal · Family · Redemption. Lagos-based, always online at 2am."
      },
      stats: { comments: 4100, reads: 171000, shares: 34000, rating: 4.7 },
      continue: { chapterId: 4, chapterTitle: 'Chapter 4 — The night she asked him to be honest', progress: 62, timeLeft: '~3 min left' },
      synopsis: {
        short: "A woman returns home early to find her husband in an intimate moment with a photograph of her deceased sister. What follows is not a fight — it is the slow unravelling of a marriage built on two griefs that never met.",
        more: " Ada_Writes' most read series explores betrayal, grief, and the love that hides inside silence. Season 2 picks up a year after Ada moved back home — the husband has a new therapist, and Ada has a new question. Neither of them is ready for the answers."
      },
      engagement: {
        poll: { q: 'Who was truly at fault in this situation?', opts: [
          { t: "💔 His grief doesn't excuse the betrayal", v: 4812 },
          { t: "🕊️ He was grieving — it's complicated", v: 2344 },
          { t: '🤷 Nobody is fully right here', v: 1044 },
        ]},
        debate: { q: '"Ada should stay and fight for her marriage, not leave."', dFor: 2341, dAg: 3819 },
        pred: { q: 'What happens in Chapter 5?', opts: [
          { t: '💔 Ada confronts him and leaves', v: 2201 },
          { t: '🕊️ They start couples therapy', v: 1888 },
          { t: '📸 A secret about the sister is revealed', v: 987 },
          { t: '🏠 Ada moves out quietly', v: 574 },
        ]},
      },
      seasons: [
        { label: 'Season 1', chs: [
          { n: 1, title: 'The knock on the door', meta: '3 min · 640 words', badge: 'free', state: 'done' },
          { n: 2, title: 'The photograph he kept', meta: '4 min · 820 words', badge: null, state: 'done' },
          { n: 3, title: 'She asked him nothing that night', meta: '3 min · 700 words', badge: null, state: 'done' },
          { n: 4, title: 'The anniversary dinner', meta: '4 min · 790 words', badge: null, state: 'done' },
          { n: 5, title: 'What the neighbours heard', meta: '4 min · 810 words', badge: null, state: 'done' },
          { n: 6, title: "Her mother knew", meta: '3 min · 670 words', badge: null, state: 'done' },
          { n: 7, title: 'Two sleepless mornings', meta: '4 min · 830 words', badge: null, state: 'done' },
          { n: 8, title: 'She packed the small bag first', meta: '5 min · 960 words', badge: null, state: 'done' },
          { n: 9, title: 'The last Sunday meal', meta: '4 min · 800 words', badge: null, state: 'done' },
          { n: 10, title: 'She left the key under the mat', meta: '5 min · 980 words', badge: null, state: 'done' },
          { n: 11, title: 'One year later', meta: '6 min · 1100 words', badge: null, state: 'done' },
        ]},
        { label: 'Season 2', chs: [
          { n: 1, title: 'New apartment, same nightmares', meta: '4 min · 800 words', badge: null, state: 'done' },
          { n: 2, title: 'He texted. She waited.', meta: '3 min · 650 words', badge: null, state: 'done' },
          { n: 3, title: "The therapist asked about her sister", meta: '4 min · 820 words', badge: null, state: 'done' },
          { n: 4, title: 'The night she asked him to be honest', meta: '5 min · 940 words', badge: 'new', state: 'current', progress: 62 },
          { n: 5, title: 'What he finally told her', meta: '5 min · 950 words', badge: null, state: 'locked' },
          { n: 6, title: 'The choice she almost made', meta: '4 min · 880 words', badge: null, state: 'locked' },
        ]},
      ],
      reactions: { userRx: null, love: 9000, crying: 6000, angry: 0, shocked: 2000, broken: 4000, emotional: 1500, savage: 900, sus: 500, twist: 400, laughing: 0 },
      hubs: {
        genre: { name: 'Betrayal Hub', icon: '💔', members: 84200, joined: false },
        circle: { name: "Ada_Writes' Inner Circle", members: 3200, joined: false, perks: 'Early chapters, behind-the-scenes, live Q&As' },
      },
      details: [
        { icon: '📚', lbl: 'Type', val: 'Series · Ongoing' },
        { icon: '🏷️', lbl: 'Category', val: '💔 Betrayal', acc: true },
        { icon: '📅', lbl: 'Seasons', val: '2 Seasons · 17 Chapters' },
        { icon: '⏱️', lbl: 'Read time', val: '~4 min/chapter' },
        { icon: '📅', lbl: 'Started', val: 'Jan 2025' },
        { icon: '✅', lbl: 'Status', val: 'Ongoing · Ch5 soon', acc: true },
      ],
      tags: ['#betrayal', '#grief', '#marriage', '#secrets', '#redemption', '#nigeria'],
      similar: [
        { cover: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=75', cat: '💔 Heartbreak', title: "He proposed with my best friend's ring", author: 'Kemi_A' },
        { cover: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&q=75', cat: '🔥 Revenge', title: 'My stepmother stole my university fund', author: 'Zara_M' },
        { cover: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=75', cat: '👑 Family', title: "Grandmother's will revealed I wasn't blood", author: 'Chiamaka_N' },
        { cover: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=75', cat: '🌙 Elegy', title: 'The letter he never sent', author: 'Efe_O' },
        { cover: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=75', cat: '✨ Twist', title: 'The runaway bride in her socked feet', author: 'Ifeanyi_Story' },
      ],
      tipCount: 1240,
    };
  }

  function renderAll() {
    renderHero();
    renderStats();
    renderContinue();
    renderSynopsis();
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

  function renderHero() {
    const d = DATA;
    document.getElementById('heroSec').innerHTML = `
      <div class="hero-bg" style="background-image:url('${d.cover}')"></div>
      <div class="hero-scrim"></div>
      <div class="hero-top">
        <span class="hbadge hb-cat">${d.category.emoji} ${esc(d.category.name)}</span>
        ${d.type === 'Series' ? '<span class="hbadge hb-series">Series</span>' : ''}
        <span class="hbadge hb-type">${esc(d.seasonChapterLabel)}</span>
      </div>
      <div class="hero-body">
        <div class="hero-title">${esc(d.title)}</div>
        <div class="hero-writer">
          <div class="hw-av-ring" onclick="BridgePage.toast('👤 @${esc(d.writer.handle.replace('@', ''))}')"><div class="hw-av-inner"><img src="${d.writer.avatar}" loading="lazy" alt=""/></div></div>
          <div class="hw-info">
            <div class="hw-name">${esc(d.writer.name)}</div>
            <div class="hw-handle">${esc(d.writer.handle)} · ${fmtN(d.writer.followers)} followers</div>
          </div>
          <button class="hw-follow" id="heroFollow" onclick="BridgePage.toggleHeroFollow()">+ Follow</button>
        </div>
      </div>`;
  }

  function renderStats() {
    const d = DATA;
    document.getElementById('statsStrip').innerHTML = `
      <div class="stat-cell"><div class="sn acc" id="likesStatN">0</div><div class="sl">Likes</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.comments)}</div><div class="sl">Comments</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.reads)}</div><div class="sl">Reads</div></div>
      <div class="stat-cell"><div class="sn">${fmtN(d.stats.shares)}</div><div class="sl">Shares</div></div>
      <div class="stat-cell"><div class="sn gold">${d.stats.rating}★</div><div class="sl">Rating</div></div>`;
  }

  function renderContinue() {
    const c = DATA.continue;
    document.getElementById('rpTitle').textContent = c.chapterTitle;
    document.getElementById('rpBarFill').style.width = c.progress + '%';
    document.getElementById('rpPct').textContent = c.progress + '% complete';
    document.getElementById('rpLeft').textContent = c.timeLeft;
  }

  function renderSynopsis() {
    document.getElementById('synText').innerHTML = `${esc(DATA.synopsis.short)}<span id="synExt" style="display:none">${esc(DATA.synopsis.more)}</span>`;
  }

  function renderEngagement() {
    const e = DATA.engagement;
    document.getElementById('pollSub').textContent = fmtN(e.poll.opts.reduce((s, o) => s + o.v, 0)) + ' votes';
    document.getElementById('debateSub').textContent = fmtN(e.debate.dFor + e.debate.dAg) + ' live';
    document.getElementById('predSub').textContent = fmtN(e.pred.opts.reduce((s, o) => s + o.v, 0)) + ' locked';
    document.getElementById('pollQ').textContent = e.poll.q;
    document.getElementById('debateQ').textContent = e.debate.q;
    document.getElementById('predQ').textContent = e.pred.q;
    renderPoll();
    renderDebate();
    renderPred();
  }

  function renderPoll() {
    const opts = DATA.engagement.poll.opts;
    const tot = opts.reduce((s, o) => s + o.v, 0) || 1;
    document.getElementById('pollOpts').innerHTML = opts.map((o, i) => {
      const pct = Math.round(o.v / tot * 100);
      return `<div class="ec-opt${S.pollVoted === i ? ' voted' : ''}" onclick="BridgePage.votePoll(${i})"><div class="ec-opt-bar" style="width:${pct}%"></div><div class="ec-opt-inner"><span class="ec-opt-text">${esc(o.t)}</span><span class="ec-opt-pct">${pct}%</span></div></div>`;
    }).join('');
    document.getElementById('pollTotal').textContent = fmtN(opts.reduce((s, o) => s + o.v, 0)) + ' votes';
  }

  function renderDebate() {
    const db = DATA.engagement.debate;
    const tot = db.dFor + db.dAg || 1;
    const fp = Math.round(db.dFor / tot * 100);
    document.getElementById('forBar').style.width = fp + '%';
    document.getElementById('agBar').style.width = (100 - fp) + '%';
    document.getElementById('forPct').textContent = fp + '%';
    document.getElementById('agPct').textContent = (100 - fp) + '%';
    document.getElementById('forCnt').textContent = fmtN(db.dFor) + ' readers';
    document.getElementById('agCnt').textContent = fmtN(db.dAg) + ' readers';
    document.getElementById('debateLiveTotal').textContent = fmtN(db.dFor + db.dAg);
    document.getElementById('debateVoicesTotal').textContent = fmtN(db.dFor + db.dAg) + ' voices';
  }

  function renderPred() {
    const opts = DATA.engagement.pred.opts;
    const tot = opts.reduce((s, o) => s + o.v, 0) || 1;
    document.getElementById('predOpts').innerHTML = opts.map((o, i) => {
      const pct = Math.round(o.v / tot * 100);
      return `<div class="ec-opt${S.predVoted === i ? ' voted' : ''}" onclick="BridgePage.votePred(${i})"><div class="ec-opt-bar" style="width:${pct}%"></div><div class="ec-opt-inner"><span class="ec-opt-text">${esc(o.t)}</span><span class="ec-opt-pct">${pct}%</span></div></div>`;
    }).join('');
    document.getElementById('predTotal').textContent = fmtN(opts.reduce((s, o) => s + o.v, 0)) + ' predictions';
  }

  function renderChapterCount() {
    let totalCh = 0;
    DATA.seasons.forEach(s => totalCh += s.chs.length);
    const firstSeason = DATA.seasons[0] ? DATA.seasons[0].label : '';
    document.getElementById('chCountN').textContent = totalCh + ' Chapters';
    document.getElementById('chCountSub').textContent = DATA.seasons.length + ' seasons · ' + firstSeason + ' to ' + (DATA.seasons[DATA.seasons.length - 1] ? DATA.seasons[DATA.seasons.length - 1].label : '');
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
    const h = DATA.hubs;
    const genreId = h.genre.name.toLowerCase().replace(/[^a-z]+/g,'').replace('hub','').trim() || 'betrayal';
    document.getElementById('hubsWrap').innerHTML = `
      <div class="hub-card" onclick="location.href='genre-hub.html?genre=${genreId}'">
        <div class="hub-icon">${h.genre.icon}</div>
        <div class="hub-body">
          <div class="hub-name">${esc(h.genre.name)}</div>
          <div class="hub-sub"><i class="fas fa-users" style="font-size:9px"></i> ${fmtN(h.genre.members)} members · Tap to open hub</div>
        </div>
        <button class="hub-join-btn${h.genre.joined ? ' joined' : ''}" onclick="event.stopPropagation(); BridgePage.joinHub('genre')">${h.genre.joined ? '✓ Joined' : '+ Join'}</button>
      </div>
      <div class="hub-card">
        <div class="hub-icon circle-icon"><img src="${DATA.writer.avatar}" alt=""/></div>
        <div class="hub-body">
          <div class="hub-name">${esc(h.circle.name)}</div>
          <div class="hub-sub"><i class="fas fa-star" style="font-size:9px;color:var(--gold)"></i> ${fmtN(h.circle.members)} members · ${esc(h.circle.perks)}</div>
        </div>
        <button class="hub-join-btn circle-btn${h.circle.joined ? ' joined' : ''}" onclick="event.stopPropagation(); BridgePage.joinHub('circle')">${h.circle.joined ? '✓ Joined' : '+ Join'}</button>
      </div>`;
  }

  function renderWriter() {
    const w = DATA.writer;
    document.getElementById('writerBody').innerHTML = `
      <div class="wc-av-row">
        <div class="wc-av-ring" onclick="BridgePage.toast('👤 @${esc(w.handle.replace('@', ''))}')"><div class="wc-av-inner"><img src="${w.avatar}" alt=""/></div></div>
        <button class="wc-follow${w.following ? ' ing' : ''}" id="wcFollow" onclick="BridgePage.toggleWcFollow()">${w.following ? '✓ Following' : '+ Follow'}</button>
      </div>
      <div class="wc-name">${esc(w.name)}</div>
      <div class="wc-handle">${esc(w.handle)} ${w.verified ? '<span class="wc-vbadge">✓ Verified</span>' : ''}</div>
      <div class="wc-bio">${esc(w.bio)}</div>
      <div class="wc-stats">
        <div class="ws"><div class="ws-n">${fmtN(w.stories)}</div><div class="ws-l">Stories</div></div>
        <div class="ws"><div class="ws-n">${fmtN(w.reads)}</div><div class="ws-l">Reads</div></div>
        <div class="ws"><div class="ws-n">${w.rating}★</div><div class="ws-l">Rating</div></div>
        <div class="ws"><div class="ws-n">${fmtN(w.followers)}</div><div class="ws-l">Followers</div></div>
      </div>
      <div class="wc-view-btn" onclick="BridgePage.toast('Opening profile...')"><i class="fas fa-arrow-right" style="font-size:11px"></i> View Full Profile</div>`;
  }

  function renderComments() {
    document.getElementById('commentsPlaceholder').innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--muted)">
        <i class="fas fa-comment" style="font-size:24px;color:var(--acc);margin-bottom:8px;display:block"></i>
        <div style="font-size:12px;font-weight:700">${fmtN(DATA.stats.comments)} comments</div>
        <div style="font-size:11px;margin-top:4px">Join the conversation</div>
      </div>`;
  }

  function renderDetails() {
    document.getElementById('detailsTbl').innerHTML = DATA.details.map(d =>
      `<div class="dt-row"><div class="dt-icon">${d.icon}</div><div class="dt-lbl">${esc(d.lbl)}</div><div class="dt-val${d.acc ? ' acc' : ''}">${esc(d.val)}</div></div>`
    ).join('');
  }

  function renderTags() {
    document.getElementById('tagsRow').innerHTML = DATA.tags.map(t => {
      const gid = t.replace('#','').toLowerCase();
      return `<div class="tag" onclick="location.href='genre-hub.html?genre=${gid}'">${esc(t)}</div>`;
    }).join('');
  }

  function renderSimilar() {
    // Universal 4-card row — reuses discover-card `scard` (cover 110/148, title, @author, Chapter + progress)
    // so bridge + discover + any page share one component.
    const el = document.getElementById('simScroll');
    if (!el) return;
    if (!window.DiscoverCard) {
      el.innerHTML = DATA.similar.slice(0,4).map(s =>
        `<div class="sim-card" onclick="location.href='bridge.html?id=${encodeURIComponent(s.title)}'">
          <div class="sim-thumb" style="background-image:url('${s.cover}')"><div class="sim-scrim"></div></div>
          <div class="sim-body"><div class="sim-cat">${esc(s.cat)}</div><div class="sim-title">${esc(s.title)}</div><div class="sim-author">${esc(s.author)}</div></div>
        </div>`
      ).join('');
      return;
    }
    const chs = ['Chapter 18','Chapter 12','Chapter 24','Chapter 31'];
    const items = DATA.similar.slice(0,4).map((s,i) => ({
      id: s.title, img: s.cover, title: s.title, author: s.author,
      ch: chs[i] || 'Chapter ' + (12+i*6)
    }));
    el.innerHTML = items.map(it => DiscoverCard.scard(it)).join('');
    el.style.display = 'flex';
    el.style.gap = '10px';
    el.style.overflowX = 'auto';
  }

  function renderTipLine() {
    const el = document.getElementById('tipCountLbl');
    if (el) el.textContent = fmtN(DATA.tipCount || 0) + ' tips';
  }

  function setupTip() {
    renderTipLine();
    if (!window.DroboardTip) return;
    DroboardTip.attach({
      getWriter: () => ({ name: DATA.writer.name, avatar: DATA.writer.avatar, handle: DATA.writer.handle }),
      onSend: (id, amount, note, mode) => {
        DATA.tipCount = (DATA.tipCount || 0) + 1;
        renderTipLine();
        const label = mode === 'cash' ? '$' + fmtN(amount) : '🪙 ' + amount;
        toast(label + ' sent to ' + DATA.writer.name + '!');
      }
    });
  }

  function openTip() {
    if (!window.DroboardTip) { 
      console.error('[Bridge] DroboardTip not loaded — check ../component/tip-picker.js path');
      toast('Tip component not loaded — hard refresh (Ctrl+Shift+R)'); 
      return; 
    }
    DroboardTip.open(STORY_ID, { name: DATA.writer.name, avatar: DATA.writer.avatar, handle: DATA.writer.handle });
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

  function votePoll(i) {
    if (S.pollVoted >= 0) return;
    DATA.engagement.poll.opts[i].v++;
    S.pollVoted = i;
    renderPoll();
    toast('✅ Voted!');
  }

  function voteDebate(side) {
    if (S.debateVote) return;
    S.debateVote = side;
    if (side === 'for') DATA.engagement.debate.dFor++;
    else DATA.engagement.debate.dAg++;
    document.getElementById(side === 'for' ? 'dFor' : 'dAg').classList.add('chosen');
    renderDebate();
    toast(side === 'for' ? "✅ You're FOR this!" : "❌ You're AGAINST this!");
  }

  function votePred(i) {
    if (S.predVoted >= 0) return;
    DATA.engagement.pred.opts[i].v++;
    S.predVoted = i;
    renderPred();
    toast('🔮 Prediction locked!');
  }

  function toggleSyn() {
    S.synExp = !S.synExp;
    document.getElementById('synExt').style.display = S.synExp ? 'inline' : 'none';
    document.getElementById('synBtn').innerHTML = S.synExp
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

  function toggleHeroFollow() {
    S.heroFollow = !S.heroFollow;
    const b = document.getElementById('heroFollow');
    if (b) {
      b.textContent = S.heroFollow ? '✓ Following' : '+ Follow';
      b.classList.toggle('ing', S.heroFollow);
    }
    const wc = document.getElementById('wcFollow');
    if (wc) {
      wc.textContent = S.heroFollow ? '✓ Following' : '+ Follow';
      wc.classList.toggle('ing', S.heroFollow);
    }
    toast(S.heroFollow ? `✅ Following ${DATA.writer.handle}` : 'Unfollowed');
  }

  function toggleWcFollow() {
    S.heroFollow = !S.heroFollow;
    const wc = document.getElementById('wcFollow');
    if (wc) {
      wc.textContent = S.heroFollow ? '✓ Following' : '+ Follow';
      wc.classList.toggle('ing', S.heroFollow);
    }
    const hf = document.getElementById('heroFollow');
    if (hf) {
      hf.textContent = S.heroFollow ? '✓ Following' : '+ Follow';
      hf.classList.toggle('ing', S.heroFollow);
    }
    toast(S.heroFollow ? `✅ Following ${DATA.writer.handle}` : 'Unfollowed');
  }

  function joinHub(type) {
    DATA.hubs[type].joined = !DATA.hubs[type].joined;
    renderHubs();
    toast(DATA.hubs[type].joined ? `✅ Joined ${DATA.hubs[type].name}` : `Left ${DATA.hubs[type].name}`);
  }

  function goToReader() {
    const ch = DATA.continue ? DATA.continue.chapterId : 1;
    window.location.href = `full-reader.html?story=${encodeURIComponent(STORY_ID)}&ch=${encodeURIComponent(ch)}`;
  }

  function goToAllComments() {
    window.location.href = `full-reader.html?story=${encodeURIComponent(STORY_ID)}#comments`;
  }

  async function init(id) {
    STORY_ID = id || new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('story') || 'st1';
    document.getElementById('tbTitle').textContent = 'Loading...';
    let data = null;
    try {
      data = await fetchStory(STORY_ID);
    } catch (err) {
      console.warn('[Bridge] API failed, using default story', err);
    }
    DATA = data || getDefaultStory(STORY_ID);
    document.getElementById('tbTitle').textContent = DATA.title;
    renderAll();
  }

  window.BridgePage = {
    init,
    toast,
    votePoll,
    voteDebate,
    votePred,
    toggleSyn,
    toggleEng,
    toggleHeroFollow,
    toggleWcFollow,
    joinHub,
    goToReader,
    goToAllComments,
    openTip,
    openSave,
    openShare,
  };
})();
