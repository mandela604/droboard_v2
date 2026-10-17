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

  function parseCount(v) {
    if (typeof v === 'number') return v;
    const m = String(v || '').trim().match(/^([\d.]+)\s*([MK])?$/i);
    if (!m) return 0;
    return Math.round(parseFloat(m[1]) * (m[2] ? (m[2].toUpperCase() === 'M' ? 1000000 : 1000) : 1));
  }
  function splitCat(cat) {
    const parts = String(cat || '').trim().split(/\s+/);
    if (!parts.length) return { emoji: '📖', name: 'Story' };
    const first = parts[0];
    const isEmoji = /\p{Extended_Pictographic}/u.test(first);
    return isEmoji
      ? { emoji: first, name: parts.slice(1).join(' ') || 'Story' }
      : { emoji: '📖', name: parts.join(' ') || 'Story' };
  }

  // Deterministic demo richness: stable per-story numbers derived from
  // the id (same every visit, no data files). Default story keeps its
  // handcrafted content; only normalized catalog records use this.
  function hashStr(s) {
    let h = 2166136261;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const GENRE_BY_CATEGORY = {
    betrayal: 'Romance', romance: 'Romance', fantasy: 'Fantasy', revenge: 'Revenge',
    mafia: 'Mafia', urban: 'Mafia', billionaire: 'Billionaire', ceo: 'Billionaire',
    werewolf: 'Werewolf', horror: 'Horror', heartbreak: 'Heartbreak', elegy: 'Elegy',
    twist: 'Twist', drama: 'Drama', comedy: 'Comedy', campus: 'Campus',
  };
  const TROPES_BY_GENRE = {
    Romance: ['Second Chance', 'Secret Baby', 'Forced Proximity', 'Fake Dating'],
    Fantasy: ['Chosen One', 'Hidden Magic', 'Prophecy', 'Reluctant Hero'],
    Revenge: ['Sweet Revenge', 'Hidden Identity', 'Downfall', 'Justice Served'],
    Mafia: ['Mafia Bride', 'Power Couple', 'Underworld Heir', 'Loyalty Test'],
    Billionaire: ['Secret Billionaire', 'Contract Marriage', 'Office Romance', 'Hidden Heir'],
    Default: ['Slow Burn', 'Plot Twist', 'Hidden Truth', 'Second Chance'],
  };
  function genreFor(catName) {
    const key = Object.keys(GENRE_BY_CATEGORY).find(k => (catName || '').toLowerCase().includes(k));
    return key ? GENRE_BY_CATEGORY[key] : 'Drama';
  }
  function tropesFor(genre, r) {
    const pool = (TROPES_BY_GENRE[genre] || TROPES_BY_GENRE.Default).slice();
    const out = [];
    while (out.length < 3 && pool.length) {
      out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    }
    return out;
  }
  const TAG_POOL = {
    betrayal: ['#betrayal', '#grief', '#marriage', '#secrets', '#redemption', '#nigeria'],
    romance: ['#romance', '#love', '#drama', '#slowburn', '#nigeria'],
    fantasy: ['#fantasy', '#magic', '#werewolf', '#adventure'],
    revenge: ['#revenge', '#drama', '#betrayal', '#justice'],
    mafia: ['#mafia', '#urban', '#power', '#crime'],
    billionaire: ['#billionaire', '#romance', '#ceo', '#drama'],
  };
  function tagsFor(genreName, r) {
    const key = Object.keys(TAG_POOL).find(k => (genreName || '').toLowerCase().includes(k)) || null;
    const pool = key ? TAG_POOL[key] : ['#drama', '#love', '#secrets', '#nigeria', '#trending'];
    const n = 4 + Math.floor(r() * 2);
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    }
    return out;
  }
  // gentle=true fills only missing/empty fields (passthrough data keeps
  // its real numbers); gentle=false seeds everything (built objects).
  function enrichDemo(d, gentle) {
    const r = rng(hashStr(d.id));
    const pick = (a, b) => Math.round(a + r() * (b - a));
    d.stats = d.stats || {};
    d.engagement = d.engagement || {};
    d.engagement.poll = d.engagement.poll || { q: '', opts: [] };
    d.engagement.debate = d.engagement.debate || { q: '', dFor: 0, dAg: 0 };
    d.engagement.pred = d.engagement.pred || { q: '', opts: [] };
    d.hubs = d.hubs || {};
    d.hubs.genre = d.hubs.genre || {};
    d.hubs.circle = d.hubs.circle || {};
    d.reactions = d.reactions || { userRx: null };
    d.writer = d.writer || {};
    const setN = (obj, key, val) => { if (!gentle || obj[key] == null) obj[key] = val; };
    const setS = (obj, key, val) => { if (!gentle || obj[key] == null || obj[key] === '') obj[key] = val; };
    const setA = (obj, key, val) => { if (!gentle || !Array.isArray(obj[key]) || !obj[key].length) obj[key] = val; };
    setN(d.stats, 'comments', pick(800, 9000));
    setN(d.stats, 'shares', pick(8000, 70000));
    setN(d.stats, 'rating', (42 + Math.floor(r() * 8)) / 10);
    setA(d, 'tags', tagsFor(d.category && d.category.name, r));
    const pv = (a, b) => pick(a, b);
    if (!gentle || !d.engagement.poll.opts.length) {
      d.engagement.poll.opts = [{ t: '❤️ Loving it', v: 0 }, { t: '🤷 Still deciding', v: 0 }];
    }
    d.engagement.poll.opts.forEach(o => { if (!gentle || !(o.v > 0)) o.v = pv(400, 5200); });
    setN(d.engagement.debate, 'dFor', pv(1500, 4200));
    setN(d.engagement.debate, 'dAg', pv(1500, 5200));
    if (!gentle || !d.engagement.pred.opts.length) {
      d.engagement.pred.opts = [{ t: '🔥 A twist', v: 0 }, { t: '💔 Heartbreak', v: 0 }];
    }
    d.engagement.pred.opts.forEach(o => { if (!gentle || !(o.v > 0)) o.v = pv(300, 2600); });
    setN(d.hubs.genre, 'members', pick(20000, 380000));
    setN(d.hubs.circle, 'members', pick(800, 9200));
    setN(d, 'tipCount', pick(200, 2400));
    [['love', 2000, 12000], ['crying', 1000, 7000], ['shocked', 300, 2500], ['broken', 500, 4500],
     ['emotional', 300, 2200], ['savage', 200, 1200], ['sus', 100, 800], ['twist', 100, 900]
    ].forEach(([k, a, b]) => setN(d.reactions, k, pick(a, b)));
    setN(d.writer, 'followers', pick(3000, 60000));
    setN(d.writer, 'reads', d.stats.reads || pick(40000, 900000));
    setN(d.writer, 'rating', d.stats.rating);
    setN(d.writer, 'stories', pick(1, 12));
    setS(d.writer, 'bio', 'Telling stories that live in your chest long after you close the tab.');
    setS(d.engagement.poll, 'q', 'What do you think so far?');
    setS(d.engagement.debate, 'q', 'Join the debate.');
    setS(d.engagement.pred, 'q', 'What happens next?');
    return d;
  }

  // Flat catalog records (DemoData.STORIES) → full bridge shape so every
  // renderer below gets the fields it expects. Short = 25 chapters max.
  function normalizeStory(s) {
    if (!s) return null;
    // Already bridge-shaped: complete any missing pieces instead of
    // trusting it blindly (an empty chapters list must never render).
    if (s.writer && Array.isArray(s.chapters)) {
      if (!s.length) s.length = (s.chapters.length || 0) <= 25 ? 'short' : 'long';
      if (!s.genre && s.category) s.genre = genreFor(s.category.name || s.category);
      if (!Array.isArray(s.tropes) || !s.tropes.length) {
        try { s.tropes = tropesFor(s.genre || 'Drama', rng(hashStr('tropes:' + (s.id || '')))); } catch (e) { s.tropes = []; }
      }
      if (s.likes == null) {
        try {
          const rx = s.reactions || {};
          s.likes = Object.keys(rx).reduce((sum, k) => sum + (k === 'userRx' ? 0 : (+rx[k] || 0)), 0);
        } catch (e) { s.likes = 0; }
      }
      return enrichDemo(s, true);
    }
    const totalCh = Math.max(1, parseInt(s.chapters, 10) || 1);
    const cat = splitCat(s.cat || s.category);
    const chapters = [];
    for (let n = 1; n <= totalCh; n++) {
      chapters.push({ n, title: 'Chapter ' + n, meta: '~4 min', badge: n === 1 ? 'free' : null, state: n === 1 ? 'current' : 'done' });
    }
    const genreName = (cat.name || 'Story') + ' Hub';
    const genre = genreFor(cat.name);
    const stories = (window.DemoData && window.DemoData.STORIES) || [];
    const _r = rng(hashStr('tropes:' + (s.id || '')));
    const tropes = tropesFor(genre, _r);
    return enrichDemo({
      id: s.id, title: s.title || 'Untitled', cover: s.cover || '',
      category: cat, genre: genre, tropes: tropes, length: totalCh <= 25 ? 'short' : 'long',
      chapterLabel: 'Ch 1',
      writer: {
        name: s.author || 'Unknown', handle: '@' + String(s.author || 'writer').replace('@', ''),
        avatar: s.authorAv || '', followers: 0, following: false,
        verified: !!s.verified, stories: 0, reads: 0, rating: 0, bio: '',
      },
      stats: { comments: 0, reads: parseCount(s.reads), shares: 0, rating: 0 },
      likes: parseCount(s.likes),
      likes: parseCount(s.likes),
      continue: { chapterId: 1, chapterTitle: 'Chapter 1', progress: 0, timeLeft: '' },
      synopsis: { short: s.desc || '', more: '' },
      engagement: {
        poll: { q: 'What do you think so far?', opts: [{ t: '❤️ Loving it', v: 0 }, { t: '🤷 Still deciding', v: 0 }] },
        debate: { q: 'Debate opens after Chapter 3.', dFor: 0, dAg: 0 },
        pred: { q: 'What happens next?', opts: [{ t: '🔥 A twist', v: 0 }, { t: '💔 Heartbreak', v: 0 }] },
      },
      hubs: {
        genre: { name: genreName, icon: cat.emoji, members: 0, joined: false },
        circle: { name: (s.author || 'Writer') + "'s Inner Circle", members: 0, joined: false, perks: 'Early chapters, behind-the-scenes, live Q&As' },
      },
      details: [
        { icon: '📚', lbl: 'Type', val: (totalCh <= 25 ? 'Short' : 'Long') + ' story · Ongoing' },
        { icon: '🏷️', lbl: 'Category', val: cat.emoji + ' ' + cat.name, acc: true },
        { icon: '🎭', lbl: 'Genre', val: genre, acc: true },
        { icon: '✨', lbl: 'Trope', val: tropes.slice(0, 2).join(' · ') },
        { icon: '📅', lbl: 'Chapters', val: totalCh + ' Chapter' + (totalCh === 1 ? '' : 's') },
        { icon: '⏱️', lbl: 'Read time', val: '~4 min/chapter' },
        { icon: '✅', lbl: 'Status', val: 'Ongoing', acc: true },
      ],
      tags: [],
      similar: stories.filter(x => String(x.id) !== String(s.id)).slice(0, 4),
      reactions: { userRx: null, love: 0, crying: 0, angry: 0, shocked: 0, broken: 0, emotional: 0, savage: 0, sus: 0, twist: 0, laughing: 0 },
      tipCount: 0,
    });
  }

  function getDefaultStory(id) {
    const defRx = { userRx: null, love: 9000, crying: 6000, angry: 0, shocked: 2000, broken: 4000, emotional: 1500, savage: 900, sus: 500, twist: 400, laughing: 0 };
    const defLikes = Object.keys(defRx).reduce((s, k) => s + (k === 'userRx' ? 0 : (defRx[k] || 0)), 0);
    return {
      id: id,
      title: "I came home early and caught my husband kissing my late sister's photograph",
      cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&q=85',
      category: { emoji: '💔', name: 'Betrayal' },
      genre: 'Romance',
      tropes: ['Second Chance', 'Secret Baby', 'Forced Proximity'],
      length: 'long',
      chapterLabel: 'Ch 15',
      writer: {
        name: 'Ada_Writes', handle: '@ada_writes', avatar: 'https://i.pravatar.cc/100?img=32',
        followers: 12400, following: false, verified: true, stories: 8, reads: 171000, rating: 4.7,
        bio: "Telling stories that live in your chest long after you close the tab. Betrayal · Family · Redemption. Lagos-based, always online at 2am."
      },
      stats: { comments: 4100, reads: 171000, shares: 34000, rating: 4.7 },
      likes: defLikes,
      continue: { chapterId: 15, chapterTitle: 'Chapter 15 — The night she asked him to be honest', progress: 62, timeLeft: '~3 min left' },
      synopsis: {
        short: "A woman returns home early to find her husband in an intimate moment with a photograph of her deceased sister. What follows is not a fight — it is the slow unravelling of a marriage built on two griefs that never met.",
        more: " Ada_Writes' most read story explores betrayal, grief, and the love that hides inside silence. It picks up a year after Ada moved back home — the husband has a new therapist, and Ada has a new question. Neither of them is ready for the answers."
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
      // Flat chapter list — stories are short (25 chapters max) or long.
      chapters: [
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
        { n: 12, title: 'New apartment, same nightmares', meta: '4 min · 800 words', badge: null, state: 'done' },
        { n: 13, title: 'He texted. She waited.', meta: '3 min · 650 words', badge: null, state: 'done' },
        { n: 14, title: "The therapist asked about her sister", meta: '4 min · 820 words', badge: null, state: 'done' },
        { n: 15, title: 'The night she asked him to be honest', meta: '5 min · 940 words', badge: 'new', state: 'current', progress: 62 },
        { n: 16, title: 'What he finally told her', meta: '5 min · 950 words', badge: null, state: 'locked' },
        { n: 17, title: 'The choice she almost made', meta: '4 min · 880 words', badge: null, state: 'locked' },
      ],
      reactions: defRx,
      hubs: {
        genre: { name: 'Betrayal Hub', icon: '💔', members: 84200, joined: false },
        circle: { name: "Ada_Writes' Inner Circle", members: 3200, joined: false, perks: 'Early chapters, behind-the-scenes, live Q&As' },
      },
      details: [
        { icon: '📚', lbl: 'Type', val: 'Long story · Ongoing' },
        { icon: '🏷️', lbl: 'Category', val: '💔 Betrayal', acc: true },
        { icon: '🎭', lbl: 'Genre', val: 'Romance', acc: true },
        { icon: '✨', lbl: 'Trope', val: 'Second Chance · Secret Baby' },
        { icon: '📅', lbl: 'Chapters', val: '17 Chapters · Long' },
        { icon: '⏱️', lbl: 'Read time', val: '~4 min/chapter' },
        { icon: '📅', lbl: 'Started', val: 'Jan 2025' },
        { icon: '✅', lbl: 'Status', val: 'Ongoing · Ch16 soon', acc: true },
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

  /* ── RATING ── */
  /* ── RATING (in-memory only, no localStorage) ──
     Stars persist across open/close toggles via myRating. */
  let myRating = 0;
  function goToDebate() {
    location.href = 'debate.html?id=' + encodeURIComponent(STORY_ID || 'deb_default');
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
      avgEl.innerHTML = `<b>${base.toFixed(1)}★</b> · ${fmtN(1247)} ratings`;
    }
    function syncText() {
      if (myRating) {
        label.textContent = ['Terrible', 'Bad', 'Okay', 'Good', 'Great!'][myRating - 1];
        yoursEl.textContent = '✓ You rated ' + myRating + ' star' + (myRating > 1 ? 's' : '');
        yoursEl.classList.add('show');
        hint.textContent = 'Tap to see details';
      } else {
        label.textContent = myRating ? '' : 'Tap a star to rate';
          yoursEl.classList.remove('show');
          hint.textContent = 'Tap to rate this story';
      }
    }
    paint(myRating);
    syncText();
    updateAvg();

      // Display-only summary — tapping the box opens the rate modal
      // (see openRateModal). No inline star handlers.
      const hintTxt = document.getElementById('rateHint');
      if (hintTxt) hintTxt.textContent = myRating ? 'Tap to edit your review' : 'Tap to rate this story';
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
    const likes = d.likes != null ? d.likes : ((d.reactions || {}).love || 0);
    document.getElementById('statsStrip').innerHTML = `
      <div class="stat-cell"><div class="sn acc" id="likesStatN">${fmtN(likes)}</div><div class="sl">Likes</div></div>
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
    const btn = document.getElementById('synBtn');
    if (btn) btn.style.display = (DATA.synopsis.more || '').trim() ? '' : 'none';
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

  function chapterCountTotal() {
    const direct = (DATA.chapters || []).length;
    if (direct > 0) return direct;
    // Last resort: the catalog record's own count (never render bare 0).
    try {
      const all = (window.DemoData && window.DemoData.STORIES) || [];
      const hit = all.find(s => String(s.id) === String(STORY_ID));
      const n = hit && parseInt(hit.chapters, 10);
      if (n > 0) return n;
    } catch (e) {}
    return 0;
  }
  function renderChapterCount() {
    const totalCh = chapterCountTotal();
    const kind = DATA.length === 'short' ? 'Short story' : 'Long story';
    try { console.info('[Bridge] chapters:', totalCh, 'story:', STORY_ID); } catch (e) {}
    document.getElementById('chCountN').textContent = totalCh > 0 ? totalCh + ' Chapters' : '—';
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
    const h = DATA.hubs || {};
    if (!window.DroboardCommunityCards) return;
    DroboardCommunityCards.mount('#hubsWrap', {
      genre: h.genre,
      circle: Object.assign({}, h.circle, { avatar: DATA.writer && DATA.writer.avatar }),
      onJoin: (type, joined) => joinHub(type, joined),
    });
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

  function renderTropes() {
    const el = document.getElementById('tropeRow');
    if (!el) return;
    const tropes = (DATA.tropes || []).slice(0, 2);
    if (!tropes.length) { el.innerHTML = ''; return; }
    const gid = (DATA.genre || DATA.category && DATA.category.name || 'drama').toLowerCase().replace(/[^a-z]+/g, '');
    el.innerHTML = tropes.map(t =>
      `<div class="tag" onclick="location.href='genre-hub.html?genre=${encodeURIComponent(gid)}'">✨ ${esc(t)}</div>`
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
    const items = DATA.similar.slice(0,4).map((s) => ({
      id: s.title, img: s.cover, title: s.title, author: s.author,
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

  function joinHub(type, joined) {
    DATA.hubs[type].joined = (joined !== undefined) ? joined : !DATA.hubs[type].joined;
    renderHubs();
    toast(DATA.hubs[type].joined ? `✅ Joined ${DATA.hubs[type].name}` : `Left ${DATA.hubs[type].name}`);
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
    // No id: rotate through the demo catalog so every load renders a
    // complete demo-data story (same story all day, different tomorrow).
    if (!STORY_ID) {
      const all = (window.DemoData && window.DemoData.STORIES) || [];
      STORY_ID = all.length
        ? String(all[Math.floor(Date.now() / 86400000) % all.length].id || 'st1')
        : 'st1';
    }
    document.getElementById('tbTitle').textContent = 'Loading...';
    let data = null;
    try {
      data = await fetchStory(STORY_ID);
    } catch (err) {
      console.warn('[Bridge] API failed, using default story', err);
    }
    DATA = normalizeStory(data) || getDefaultStory(STORY_ID);
    document.getElementById('tbTitle').textContent = DATA.title;
    renderAll();
  }

  /* Rate modal — 12-chapter gate mirrors the recommendation rule.
     presetStar: the star tapped on the inline box, pre-lit in the modal. */
  function openRateModal(presetStar) {
    if (!window.openRateModal) { toast('Rate modal not loaded'); return; }
    const chRead = DATA.continue ? (DATA.continue.chapterId || 1) : 1;
    window.openRateModal({
      storyId: STORY_ID,
      title: DATA.title,
      img: DATA.cover || '',
      chaptersRead: chRead,
      presetStars: typeof presetStar === 'number' ? presetStar : 0,
      onDone: (r) => {
        myRating = r.stars;
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
    toggleRate,
    openRateModal,
    rateStar,
    goToDebate,
  };
})();
