/* ═══════════════════════════════════════════════════════════════
   DISCOVER SERVICE
   Data + orchestration in one file. HTML calls DiscoverPage.init().
   When going live: set USE_API = true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  const GENRES = [
    { icon: 'fa-heart', name: 'Romance', bg: '#ffe4ec', color: '#ff2d55', filter: 'romance' },
    { icon: 'fa-paw', name: 'Werewolf', bg: '#f3e8ff', color: '#9333ea', filter: 'werewolf' },
    { icon: 'fa-gun', name: 'Mafia', bg: '#e8e8ed', color: '#555', filter: 'mafia' },
    { icon: 'fa-crown', name: 'Fantasy', bg: '#fef3c7', color: '#d97706', filter: 'fantasy' },
    { icon: 'fa-magnifying-glass', name: 'Mystery', bg: '#e0f2fe', color: '#0284c7', filter: 'mystery' },
    { icon: 'fa-atom', name: 'Sci-Fi', bg: '#dbeafe', color: '#2563eb', filter: 'fantasy' },
    { icon: 'fa-skull', name: 'Horror', bg: '#f3e8ff', color: '#7c3aed', filter: 'horror' },
    { icon: 'fa-th', name: 'More', bg: '#f4f4f5', color: '#71717a', filter: '' },
  ];

  const GENRE_MAP = { Drama: 'drama', Romance: 'romance', Family: 'family', Revenge: 'revenge', Betrayal: 'betrayal', Campus: 'campus', Heartbreak: 'heartbreak', Horror: 'horror', Mafia: 'mafia', Werewolf: 'werewolf', Billionaire: 'billionaire', Mystery: 'mystery' };
  const MORE_LIMIT = 8;
  const THEME_KEY = 'droboardTheme';
  let AD_INTERVAL = 6, AD_CYCLE = ['book', 'book', 'book', 'book', 'platform'];

  let heroes = [], hi = 0, heroTimer;
  let ADS = { platformAds: [], bookAds: [] };
  let TOP_WRITERS = [];
  let morePage = 1, moreHasMore = true, moreLoading = false;
  let moreGlobalIndex = 0, moreAdCounter = 0, writersRowInserted = false;

  /* ═══════════════════════════════════════════════════════════
     DATA LAYER — fetch from API or build from DemoData
  ═══════════════════════════════════════════════════════════ */

  function buildHeroes() {
    const d = window.DemoData, covers = d.COVERS;
    const staticHeroes = [
      { id: 'st1', img: covers[0], title: 'HIS <em>Sweet</em><br>REVENGE', author: 'By Luna Grey', tags: ['Mafia', 'Romance'] },
      { id: 'st2', img: covers[1], title: 'UNTIL YOU<br>REGRET', author: 'By Ada Writes', tags: ['Revenge', 'Romance'] },
      { id: 'st3', img: covers[2], title: 'CLAIMING HIS<br>LUNA', author: 'By Ifeanyi Story', tags: ['Werewolf', 'Romance'] },
      { id: 'st4', img: covers[3], title: 'BOUND<br>BY HER', author: 'By Efe O', tags: ['Romance', 'Drama'] },
    ];
    /* Featured placements set in the chief editor module — up to five stories
       in the slider. Saved placements (localStorage) keep feature/unfeature
       actions working across pages without a backend. */
    try {
      const ed = window.EditorDemo;
      if (ed && Array.isArray(ed.FEATURED_PLACEMENTS)) {
        const lib = ed.FEATURED_LIBRARY || [];
        let placements = ed.FEATURED_PLACEMENTS;
        try {
          const raw = localStorage.getItem('droboard_ce_featured_placements');
          if (raw) { const saved = JSON.parse(raw); if (Array.isArray(saved)) placements = saved; }
        } catch (e) {}
        const heroes = placements.slice()
          .sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))
          .filter(p => (p.tags || []).includes('featured'))
          .map(p => lib.find(s => s.id === p.id))
          .filter(Boolean)
          .slice(0, 5)
          .map(s => ({
            id: s.id,
            img: s.cover,
            title: s.title,
            author: 'By ' + s.author,
            tags: String(s.genre || '').split(' & ').filter(Boolean),
          }));
        if (heroes.length) return heroes;
      }
    } catch (e) {}
    return staticHeroes;
  }

  function buildContinueReading() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(2), title: "The Alpha's Obsession", author: '@Ifeanyi_Story', ch: 'Chapter 18', pct: 43 },
      { img: c(0), title: 'Falling for My Fake Husband', author: '@Ada_Writes', ch: 'Chapter 12', pct: 25 },
      { img: c(1), title: "The Mafia's Secret Wife", author: '@Chiamaka_N', ch: 'Chapter 24', pct: 60 },
      { img: c(3), title: 'His Ruthless Obsession', author: '@Zara_M', ch: 'Chapter 31', pct: 78 },
      { img: c(4), title: 'Bound by Her Silence', author: '@Kemi_A', ch: 'Chapter 9', pct: 15 },
      { img: c(5), title: 'Claimed at Midnight', author: '@Efe_O', ch: 'Chapter 42', pct: 55 },
      { img: c(6), title: 'The Contract Bride', author: '@CampusQueen', ch: 'Chapter 16', pct: 33 },
      { img: c(7), title: 'Luna of the North', author: '@Dami_Cole', ch: 'Chapter 28', pct: 70 },
    ];
  }

  function buildTopRomance() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(0), title: "The CEO's Hidden Heir", author: '@Ada_Writes', badge: 'new', rating: '4.8' },
      { img: c(1), title: 'Devil in a Suit', author: '@Zara_M', badge: 'hot', rating: '4.7' },
      { img: c(2), title: 'Protected by the Billionaire', author: '@Chiamaka_N', badge: 'new', rating: '4.9' },
      { img: c(3), title: 'Broken Vows', author: '@Kemi_A', badge: 'new', rating: '4.6' },
      { img: c(4), title: 'His Second Chance', author: '@Efe_O', rating: '4.5' },
      { img: c(5), title: 'Married for Revenge', author: '@Ifeanyi_Story', badge: 'hot', rating: '4.8' },
      { img: c(6), title: 'The Billionaire Next Door', author: '@CampusQueen', rating: '4.4' },
      { img: c(7), title: 'Love in Disguise', author: '@Dami_Cole', badge: 'new', rating: '4.7' },
      { img: c(8), title: 'Her Secret Admirer', author: '@Ada_Writes', rating: '4.3' },
      { img: c(9), title: 'Twisted Hearts', author: '@Zara_M', badge: 'hot', rating: '4.9' },
    ];
  }

  function buildTrending() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(0), title: 'The Ruthless Billionaire', author: '@Ada_Writes', rank: 1 },
      { img: c(2), title: 'Second Chance for the Luna', author: '@Ifeanyi_Story', rank: 2 },
      { img: c(1), title: "Mafia's Little Angel", author: '@Chiamaka_N', rank: 3 },
      { img: c(3), title: 'Entangled Hearts', author: '@Kemi_A', rank: 4 },
      { img: c(4), title: 'The Forbidden Alpha', author: '@Zara_M', rank: 5 },
      { img: c(5), title: 'She Was His Weakness', author: '@Efe_O', rank: 6 },
      { img: c(6), title: 'Vengeance & Vows', author: '@CampusQueen', rank: 7 },
      { img: c(7), title: 'The Silent Bride', author: '@Dami_Cole', rank: 8 },
      { img: c(8), title: 'Blood and Roses', author: '@Ada_Writes', rank: 9 },
      { img: c(9), title: 'His Dark Promise', author: '@Ifeanyi_Story', rank: 10 },
    ];
  }

  function buildCollections() {
    const d = window.DemoData, c = d.c;
    return [
      { name: 'Stories That Wrecked Me', count: 14, covers: [c(1), c(0), c(4), c(2)] },
      { name: 'Best Plot Twists 2026', count: 8, covers: [c(5), c(3), c(6), c(7)] },
      { name: '2am Crying Material', count: 11, covers: [c(4), c(0), c(8), c(1)] },
      { name: 'Campus & CEO Classics', count: 6, covers: [c(6), c(9), c(3), c(5)] },
      { name: 'Revenge Arc Masterclass', count: 9, covers: [c(1), c(2), c(0), c(4)] },
    ];
  }

  function buildNewReleases() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(4), title: 'Untouchable Desire', author: '@Zara_M', badge: 'new' },
      { img: c(5), title: "Fate's Revenge", author: '@Ada_Writes', badge: 'new' },
      { img: c(6), title: 'Not Your Princess', author: '@CampusQueen', badge: 'new' },
      { img: c(7), title: 'Married to the Enemy', author: '@Chiamaka_N', badge: 'new' },
      { img: c(8), title: 'The Last Confession', author: '@Efe_O', badge: 'new' },
      { img: c(9), title: 'Whispers of Betrayal', author: '@Kemi_A', badge: 'new' },
      { img: c(0), title: 'Crown of Thorns', author: '@Ifeanyi_Story', badge: 'new' },
      { img: c(1), title: 'Her Hidden Truth', author: '@Dami_Cole', badge: 'new' },
      { img: c(2), title: 'The Stranger at Midnight', author: '@Zara_M', badge: 'new' },
      { img: c(3), title: 'Love After Ruin', author: '@Ada_Writes', badge: 'new' },
    ];
  }

  function buildEditorsPicks() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(1), title: 'Until You Regret', author: '@Ada_Writes' },
      { img: c(0), title: 'I Will Never Be Yours', author: '@Chiamaka_N' },
      { img: c(2), title: "Carrying The Mafia Lord's Baby", author: '@Zara_M' },
      { img: c(3), title: 'Reclaimed by My Alpha', author: '@Ifeanyi_Story' },
      { img: c(4), title: 'The Night She Returned', author: '@Kemi_A' },
      { img: c(5), title: 'His Untamed Luna', author: '@Efe_O' },
      { img: c(6), title: 'Broken by Him', author: '@CampusQueen' },
      { img: c(7), title: 'The Price of Love', author: '@Dami_Cole' },
      { img: c(8), title: 'Shadows of Desire', author: '@Ada_Writes' },
      { img: c(9), title: 'When Hearts Collide', author: '@Zara_M' },
    ];
  }

  /* Taste preferences from the first-visit picker (localStorage).
     Live swap: dro_tastes synced via POST /api/profile/tastes. */
  function readTastes() {
    try { return JSON.parse(localStorage.getItem('dro_tastes') || 'null') || null; }
    catch (e) { return null; }
  }

  function staticRecommended() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(4), title: "His Choice Wasn't Me", author: '@Kemi_A' },
      { img: c(0), title: 'Bound by Obsession', author: '@Ada_Writes' },
      { img: c(1), title: 'The Wife He Threw Away', author: '@Chiamaka_N' },
      { img: c(2), title: "My Sister's Best Friend", author: '@Zara_M' },
      { img: c(5), title: 'The Man She Left Behind', author: '@Efe_O' },
      { img: c(6), title: 'Stolen Moments', author: '@CampusQueen' },
      { img: c(7), title: 'Her Ruthless King', author: '@Ifeanyi_Story' },
      { img: c(8), title: 'A Love Like Fire', author: '@Dami_Cole' },
      { img: c(9), title: 'Never Look Back', author: '@Ada_Writes' },
      { img: c(3), title: 'The Softest Rejection', author: '@Kemi_A' },
    ];
  }

  /* Personalized picks: STORIES matching selected genres first (cat may
     carry a mojibake emoji prefix - lowercase include still matches),
     then the rest of the pool, padded with the static list. */
  function buildRecommended() {
    const t = readTastes();
    const d = window.DemoData;
    if (!t || !Array.isArray(t.genres) || !t.genres.length || !d || !Array.isArray(d.STORIES)) return staticRecommended();
    const want = t.genres.map(g => String(g).toLowerCase());
    const scored = (d.STORIES || []).map(s => {
      const cat = String(s.cat || '').toLowerCase();
      let score = 0;
      want.forEach(g => { if (cat.indexOf(g) !== -1) score += 1; });
      return { id: s.id, img: s.cover, title: s.title, author: '@' + s.author, score };
    });
    const matched = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    const rest = scored.filter(x => x.score === 0);
    const out = matched.concat(rest).slice(0, 10);
    const seen = {};
    out.forEach(s => { seen[String(s.title).toLowerCase()] = 1; });
    staticRecommended().forEach(s => {
      if (out.length >= 10) return;
      if (seen[String(s.title).toLowerCase()]) return;
      out.push(s);
    });
    return out;
  }

  function renderRecRow() {
    DiscoverCard.renderRow('recRow', buildRecommended(), 'No recommendations yet.');
    renderTuneChip();
  }

  function renderTuneChip() {
    const row = document.getElementById('recRow');
    if (!row) return;
    const head = row.closest('.section') && row.closest('.section').querySelector('.sec-head');
    if (!head || document.getElementById('recTuneBtn')) return;
    const chip = document.createElement('button');
    chip.id = 'recTuneBtn';
    chip.className = 'view-all';
    chip.style.cssText = 'margin-right:8px;border:1px solid var(--border);background:var(--card);color:var(--text-muted);font-size:10px;padding:4px 10px;border-radius:999px;cursor:pointer;font-weight:600';
    chip.innerHTML = '<i class="fas fa-sliders" style="font-size:9px"></i> Tune your feed';
    const viewAll = head.querySelector('.view-all');
    if (viewAll) head.insertBefore(chip, viewAll);
    else head.appendChild(chip);
    chip.addEventListener('click', function () {
      if (window.DroboardTastePicker) DroboardTastePicker.open({ onDone: renderRecRow });
    });
  }

  /* Day / time-window / cooldown gate for the spotlight popup. */
  function withinSpotlightWindow(cfg) {
    const now = new Date();
    const days = Array.isArray(cfg.days) ? cfg.days.map(Number) : [];
    if (days.length && days.indexOf(now.getDay()) === -1) return false;
    if (cfg.startHour != null && cfg.endHour != null && cfg.startHour !== '' && cfg.endHour !== '') {
      const h = now.getHours() + now.getMinutes() / 60;
      const s = +cfg.startHour, e = +cfg.endHour;
      if (s !== e && (s < e ? !(h >= s && h < e) : !(h >= s || h < e))) return false;
    }
    const cool = +cfg.cooldownHours || 0;
    if (cool > 0) {
      try {
        const last = +localStorage.getItem('dro_spotlight_last') || 0;
        if (last && Date.now() - last < cool * 3600e3) return false;
      } catch (e) {}
    }
    return true;
  }

  /* Full-screen spotlight: once per visit, every N visits, Discover only.
     Config comes from the ad-manager "Spotlight" card — on/off, seconds,
     frequency, skip, delay/time window/cooldown, audience and creative. */
  async function maybeShowSpotlight() {
    if (!window.DroboardSpotlight || typeof AdService === 'undefined') return;
    try { if (sessionStorage.getItem('dro_spotlight_v')) return; } catch (e) {}
    let cfg = {};
    try { cfg = (await AdService.getPlacement('spotlight')) || {}; } catch (e) { return; }
    if (cfg.enabled === false) return;
    const hasCfg = ['enabled', 'seconds', 'everyN', 'allowSkip', 'adId', 'delaySeconds', 'days', 'audienceMode'].some(k => k in cfg);
    if (!hasCfg) return; // surface not configured yet
    if (!withinSpotlightWindow(cfg)) return;
    if (cfg.audienceMode === 'targeted' && window.DroboardAudience) {
      if (!DroboardAudience.matches(cfg.segments || [], cfg.match || 'any')) return;
    }
    const every = Math.max(1, parseInt(cfg.everyN, 10) || 1);
    try {
      const vis = (parseInt(localStorage.getItem('dro_spotlight_vis'), 10) || 0) + 1;
      localStorage.setItem('dro_spotlight_vis', vis);
      if (vis % every !== 0) return;
    } catch (e) { /* show anyway */ }
    const delay = Math.max(0, Math.min(30, +cfg.delaySeconds || 0));
    if (delay) await new Promise(r => setTimeout(r, delay * 1000));
    let ad = null;
    try {
      const pools = await AdService.getAds({ page: 'discover', slot: 'discover:spotlight' });
      const pool = pools.spotlight || [];
      if (cfg.adId) ad = pool.find(a => String(a.id) === String(cfg.adId)) || null;
      if (!ad && pool.length) {
        /* No creative pinned in Marketing → rotate active ones per visit. */
        let idx = 0;
        try { idx = parseInt(localStorage.getItem('dro_spotlight_rot'), 10) || 0; } catch (e) {}
        ad = pool[idx % pool.length];
        try { localStorage.setItem('dro_spotlight_rot', String((idx + 1) % pool.length)); } catch (e) {}
      }
    } catch (e) {}
    const tastes = readTastes();
    let story = null, href = null;
    if (ad) {
      story = window.DroboardSpotlight.fromAd
        ? DroboardSpotlight.fromAd(ad)
        : { kind: 'story', id: ad.id, title: ad.title, author: ad.author || ad.authorName, genre: ad.genre, chapters: ad.chapters, reads: ad.reads, preview: ad.preview, img: ad.img || ad.cover, cta: ad.cta || 'Read now' };
      if (ad.url) href = ad.url;
      else if (story.kind === 'user') href = 'profile.html?u=' + encodeURIComponent(story.handle || story.name || '');
      else if (story.kind === 'board') href = 'leaderboard.html';
      else if (story.kind === 'promo') href = 'refer.html';
      else href = window.DiscoverCard ? DiscoverCard.storyHref({ id: ad.storyId || ad.id, title: ad.title }) : null;
    } else {
      const pool = (window.DemoData && DemoData.STORIES) || [];
      let pick = null;
      if (tastes && Array.isArray(tastes.genres) && tastes.genres.length) {
        const want = tastes.genres.map(g => String(g).toLowerCase());
        pick = pool.find(s => want.some(g => String(s.cat || '').toLowerCase().indexOf(g) !== -1));
      }
      if (!pick) pick = pool[0];
      if (!pick) return;
      story = { kind: 'story', id: pick.id, title: pick.title, author: '@' + pick.author, genre: String(pick.cat || '').replace(/[^A-Za-z ]/g, '').trim(), chapters: pick.chapters, reads: pick.reads, preview: pick.desc, img: pick.cover, cta: 'Read now' };
      href = window.DiscoverCard ? DiscoverCard.storyHref(story) : null;
    }
    try {
      sessionStorage.setItem('dro_spotlight_v', '1');
      localStorage.setItem('dro_spotlight_last', String(Date.now()));
    } catch (e) {}
    DroboardSpotlight.show({
      story: story,
      seconds: parseInt(cfg.seconds, 10) || 6,
      allowSkip: cfg.allowSkip !== false,
      sponsored: !!ad,
      trackId: ad ? ad.id : null,
      href: href,
    });
  }

  /* First-visit flow: taste picker, then spotlight once the picker settles. */
  function startFirstVisitFlow() {
    const after = function () {
      renderRecRow();
      setTimeout(maybeShowSpotlight, 1200);
    };
    if (window.DroboardTastePicker && typeof DroboardTastePicker.maybeShow === 'function') {
      DroboardTastePicker.maybeShow({ onDone: after });
    } else {
      setTimeout(after, 100);
    }
  }

  function buildComplete() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(2), title: 'Alpha Stefano', author: '@Ifeanyi_Story' },
      { img: c(0), title: 'The Secret Heir', author: '@Ada_Writes' },
      { img: c(1), title: 'Bound by Darkness', author: '@Zara_M' },
      { img: c(3), title: "The Billionaire's Contract", author: '@Chiamaka_N' },
      { img: c(4), title: 'Complete Surrender', author: '@Kemi_A' },
      { img: c(5), title: 'The Final Vow', author: '@Efe_O' },
      { img: c(6), title: 'Ends With Us', author: '@CampusQueen' },
      { img: c(7), title: 'Forever His', author: '@Dami_Cole' },
      { img: c(8), title: 'The Last Chapter', author: '@Ada_Writes' },
      { img: c(9), title: 'Home at Last', author: '@Ifeanyi_Story' },
    ];
  }

  function buildRecentlyUpdated() {
    const d = window.DemoData, c = d.c;
    return [
      { img: c(1), title: 'Ruthless Desires', author: '@Ada_Writes', badge: 'update', meta: 'Ch. 86' },
      { img: c(2), title: 'Claimed by The Alpha', author: '@Ifeanyi_Story', badge: 'update', meta: 'Ch. 72' },
      { img: c(0), title: "The CEO's Obsession", author: '@Zara_M', badge: 'update', meta: 'Ch. 54' },
      { img: c(3), title: 'Hidden Truths Unveiled', author: '@Chiamaka_N', badge: 'update', meta: 'Ch. 97' },
      { img: c(4), title: 'Her Silent War', author: '@Kemi_A', badge: 'update', meta: 'Ch. 41' },
      { img: c(5), title: 'Bloodline Secrets', author: '@Efe_O', badge: 'update', meta: 'Ch. 63' },
      { img: c(6), title: 'The Pack Divided', author: '@CampusQueen', badge: 'update', meta: 'Ch. 29' },
      { img: c(7), title: 'Empire of Lies', author: '@Dami_Cole', badge: 'update', meta: 'Ch. 105' },
      { img: c(8), title: 'After the Fall', author: '@Ada_Writes', badge: 'update', meta: 'Ch. 18' },
      { img: c(9), title: 'Rise of the Luna', author: '@Ifeanyi_Story', badge: 'update', meta: 'Ch. 77' },
    ];
  }

  function buildMoreStories() {
    const d = window.DemoData, c = d.c;
    return [
      { title: 'The Letter Never Sent', author: '@Efe_O', genre: 'Drama', preview: 'She found the letter in his drawer three years after he left.', img: c(8) },
      { title: 'Socks at the Altar', author: '@Ifeanyi_Story', genre: 'Romance', preview: 'The bride ran in socks. The groom followed.', img: c(5) },
      { title: "Grandmother's Hidden Will", author: '@Chiamaka_N', genre: 'Family', preview: 'The will named someone no one had ever heard of.', img: c(5) },
      { title: 'Stepmother Stole My Future', author: '@Zara_M', genre: 'Revenge', preview: 'She took the scholarship, the inheritance, and the man.', img: c(3) },
      { title: 'Kissing Her Photograph', author: '@Ada_Writes', genre: 'Betrayal', preview: 'He kissed the photo every night. She thought it was devotion.', img: c(4) },
      { title: 'Richest Boy in Class', author: '@CampusQueen', genre: 'Campus', preview: 'He owned half the campus before he turned twenty.', img: c(6) },
      { title: 'Deleted on Our Anniversary', author: '@Kemi_A', genre: 'Heartbreak', preview: 'Every photo, every message, gone.', img: c(7) },
      { title: 'Three Times She Said No', author: '@Dami_Cole', genre: 'Romance', preview: 'He asked three times. She said no three times.', img: c(9) },
      { title: 'The House on Willow Lane', author: '@Efe_O', genre: 'Horror', preview: 'The house had been empty for twelve years.', img: c(8) },
      { title: 'Scholarship Girl Rising', author: '@CampusQueen', genre: 'Campus', preview: 'One scholarship. One secret. One boy who knew both.', img: c(6) },
      { title: 'Boss Before Revealing', author: '@Zara_M', genre: 'Revenge', preview: 'She worked under him for two years. He never knew.', img: c(0) },
      { title: 'Left Everything Behind', author: '@Ada_Writes', genre: 'Drama', preview: 'Passport. One bag. No goodbye.', img: c(1) },
      { title: 'The Softest Goodbye', author: '@Kemi_A', genre: 'Romance', preview: 'They agreed it was over. No fighting. No blame.', img: c(3) },
      { title: 'Blood in the Boardroom', author: '@Chiamaka_N', genre: 'Mafia', preview: 'The deal was clean on paper. In the room, nothing was.', img: c(2) },
      { title: 'Moonlight Betrayal', author: '@Ifeanyi_Story', genre: 'Werewolf', preview: 'The pack called her luna. The alpha called her his.', img: c(2) },
      { title: 'Contract Without Love', author: '@Dami_Cole', genre: 'Billionaire', preview: 'A one-year marriage. No feelings. No questions.', img: c(0) },
      { title: 'Her Name Was Vengeance', author: '@Zara_M', genre: 'Revenge', preview: 'They took her family. They took her name.', img: c(1) },
      { title: 'The Quiet Twin', author: '@Efe_O', genre: 'Mystery', preview: 'One twin died. One twin lived.', img: c(5) },
      { title: 'Fire in the Rain', author: '@Ada_Writes', genre: 'Romance', preview: 'They met in a storm. She needed a ride.', img: c(4) },
      { title: 'Alpha Without a Pack', author: '@Ifeanyi_Story', genre: 'Werewolf', preview: 'He lost everything in one night.', img: c(2) },
      { title: 'The Heiress Who Ran', author: '@Chiamaka_N', genre: 'Drama', preview: 'Billions waiting. A wedding planned.', img: c(7) },
      { title: 'Paper Rings & Lies', author: '@Kemi_A', genre: 'Romance', preview: 'Paper rings in a parking lot.', img: c(9) },
      { title: 'Night of the Rogues', author: '@CampusQueen', genre: 'Werewolf', preview: 'The border fell at midnight.', img: c(8) },
      { title: 'His Cold Empire', author: '@Dami_Cole', genre: 'Mafia', preview: 'He built an empire on silence and fear.', img: c(0) },
      { title: 'When She Stopped Waiting', author: '@Ada_Writes', genre: 'Heartbreak', preview: 'Five years of waiting. One letter that never came.', img: c(3) },
    ];
  }

  async function fetchDiscoverData() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/discover`);
      if (!res.ok) throw new Error('Discover API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 100));
    return {
      heroes: buildHeroes(), continueReading: buildContinueReading(),
      topRomance: buildTopRomance(), trending: buildTrending(),
      collections: buildCollections(), newReleases: buildNewReleases(),
      editorsPicks: buildEditorsPicks(), recommended: buildRecommended(),
      complete: buildComplete(), recentlyUpdated: buildRecentlyUpdated(),
      moreStories: buildMoreStories(),
    };
  }

  async function fetchDiscoverAds() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/discover/ads`);
      if (!res.ok) throw new Error('Ads API failed');
      return res.json();
    }
    // Central inventory (ad-service) first; local build as fallback
    if (window.AdService) {
      try {
        const placement = await AdService.getPlacement('discover');
        if (placement.interval) AD_INTERVAL = placement.interval;
        if (Array.isArray(placement.cycle) && placement.cycle.length) AD_CYCLE = placement.cycle;
        const pools = await AdService.getAds({ page: 'discover' });
        if ((pools.platform || []).length || (pools.book || []).length) {
          return { platformAds: pools.platform || [], bookAds: pools.book || [] };
        }
      } catch (e) {}
    }
    return { platformAds: [], bookAds: [] };
  }

  async function fetchMoreStories(page, limit) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/discover/stories?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error('Stories API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 500));
    const all = buildMoreStories();
    const expanded = [];
    while (expanded.length < 50) {
      all.forEach((s, i) => {
        if (expanded.length >= 50) return;
        expanded.push({ ...s, img: window.DemoData.c((i + expanded.length) % window.DemoData.COVERS.length) });
      });
    }
    const start = (page - 1) * limit;
    const items = expanded.slice(start, start + limit);
    return { items, hasMore: start + limit < expanded.length };
  }

  /* ═══════════════════════════════════════════════════════════
     CONTROLLER LAYER — hero, scroll, ads, wiring, protection
  ═══════════════════════════════════════════════════════════ */

  /* ── Hero slider ──────────────────────────────────────────────────
     Two stacked image layers alternate so the next slide CROSSFADES over
     the current one (with a slow zoom) instead of swapping abruptly.
     The text fades out, swaps, then fades back in line by line. */
  let _heroLayers = null;
  let _heroPainted = false;
  let _heroHideTimer = null;

  function _heroLayerPair() {
    if (_heroLayers) return _heroLayers;
    const a = document.getElementById('heroImg');
    const b = document.getElementById('heroImg2');
    if (!a || !b) return null;
    _heroLayers = { a: a, b: b };
    return _heroLayers;
  }

  /* Warm the cache for the slide that's coming next so the crossfade
     never reveals an empty layer. */
  function _preloadHero(src) {
    if (!src) return;
    try { const im = new Image(); im.src = src; } catch (e) {}
  }

  function goHero(i, instant) {
    if (!heroes.length) return;
    hi = i;
    const h = heroes[i];
    const layers = _heroLayerPair();
    const body = document.querySelector('.hero-body');
    const wrap = document.querySelector('.hero-wrap');
    const heroEl = document.querySelector('.hero');

    /* ── image crossfade ──
       The OLD slide stays fully opaque underneath for the whole fade; only
       the NEW slide fades in above it (is-front). Fading both out/in at once
       would drop the composite to ~75% alpha and let the page background
       bleed through the hero mid-transition. */
    if (layers) {
      const front = layers.b, back = layers.a;
      clearTimeout(_heroHideTimer);

      // incoming layer → clean, fully transparent, zoomed start state
      front.style.transition = 'none';
      front.classList.remove('is-on', 'is-front');
      if (!_heroPainted) back.style.backgroundImage = `url('${h.img}')`; // 1st paint: never flash empty
      _heroPainted = true;
      front.style.backgroundImage = `url('${h.img}')`;
      void front.offsetWidth;
      front.style.transition = '';

      // backdrop → opaque instantly, never above the incoming layer
      back.style.transition = 'none';
      back.classList.remove('is-front');
      back.classList.add('is-on');
      void back.offsetWidth;
      back.style.transition = '';

      // fade + zoom the new slide in over the backdrop
      front.classList.add('is-on', 'is-front');

      // Drop the old backdrop only after the crossfade completes. It sits
      // behind an opaque layer so this is invisible; it just keeps the next
      // transition from starting on a half-transparent base.
      _heroHideTimer = setTimeout(() => back.classList.remove('is-on', 'is-front'), 820);

      layers.a = front;                // roles swap for the next slide
      layers.b = back;
    } else {
      const img = document.getElementById('heroImg');
      if (img) img.style.backgroundImage = `url('${h.img}')`;
    }

    /* ── text: fade out → swap → fade in (staggered) ── */
    const paintText = () => {
      const t = document.getElementById('heroTitle');
      const a = document.getElementById('heroAuthor');
      const g = document.getElementById('heroTags');
      if (t) t.innerHTML = h.title;
      if (a) {
        const av = (window.DroboardPeople && DroboardPeople.avatarFor) ? DroboardPeople.avatarFor(h.author) : '';
        a.innerHTML = (av ? `<img class="hero-author-av" src="${av}" alt=""/>` : '') + h.author + ' <i class="fas fa-circle-check"></i>';
      }
      if (g) g.innerHTML = (h.tags || []).map(t => `<span class="hero-tag">${t}</span>`).join('');
      if (body) body.classList.add('in');
    };

    document.querySelectorAll('#heroDots .dot').forEach((d, j) => d.classList.toggle('on', j === i));
    if (heroEl) heroEl.onclick = () => { window.location.href = `bridge.html?id=${encodeURIComponent(h.id)}`; };

    if (instant || !body) { paintText(); }
    else {
      if (wrap) wrap.classList.add('hero-anim');
      body.classList.remove('in');
      setTimeout(paintText, 260);
    }

    // warm the next slide
    if (heroes.length > 1) _preloadHero(heroes[(i + 1) % heroes.length].img);
  }

  function startHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goHero((hi + 1) % heroes.length), 4500);
  }

  /* Pause the carousel while the tab is hidden so it doesn't burn
     through slides in the background. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(heroTimer);
    else if (heroes.length) startHero();
  });

  function buildTopWriters(stories) {
    const seen = new Set(), out = [];
    stories.forEach((s, i) => {
      const handle = (s.author || '').replace('@', '');
      if (!handle || seen.has(handle) || out.length >= 6) return;
      seen.add(handle);
      out.push({ name: handle.replace(/_/g, ' '), handle, avatar: `https://i.pravatar.cc/100?img=${(i * 7 + 11) % 70}` });
    });
    return out;
  }

  function interleaveExtras(items) {
    const out = [];
    items.forEach(item => {
      out.push({ kind: 'story', data: item });
      moreGlobalIndex++;
      if (!writersRowInserted && moreGlobalIndex === 3 && TOP_WRITERS.length) {
        out.push({ kind: 'writers' });
        writersRowInserted = true;
      }
      if (moreGlobalIndex % AD_INTERVAL === 0 && (ADS.platformAds.length || ADS.bookAds.length)) {
        const adType = AD_CYCLE[moreAdCounter % AD_CYCLE.length];
        if (adType === 'platform' && ADS.platformAds.length) {
          out.push({ kind: 'platformAd', data: ADS.platformAds[moreAdCounter % ADS.platformAds.length] });
        } else if (ADS.bookAds.length) {
          out.push({ kind: 'bookAd', data: ADS.bookAds[moreAdCounter % ADS.bookAds.length] });
        }
        moreAdCounter++;
      }
    });
    return out;
  }

  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
  function renderFeedEntry(entry) {
    if (entry.kind === 'writers') return DiscoverCard.writersRow(TOP_WRITERS);
    if (entry.kind === 'platformAd') { if (entry.data.id) trackAd(entry.data.id, 'impression'); return DiscoverCard.platformAdItem(entry.data); }
    if (entry.kind === 'bookAd') { if (entry.data.id) trackAd(entry.data.id, 'impression'); return DiscoverCard.bookAdItem(entry.data); }
    return DiscoverCard.listItem(entry.data);
  }
  function initAdClicks() {
    const list = document.getElementById('moreList');
    if (!list) return;
    list.addEventListener('click', (e) => {
      const card = e.target.closest('[data-adid]');
      if (!card || !card.dataset.adid) return;
      if (e.target.closest('.dc-list-author')) return; // author → profile, not an ad click
      trackAd(card.dataset.adid, 'click');
    });
  }

  function appendMoreBatch(items, hasMore) {
    moreHasMore = hasMore;
    morePage++;
    const feed = interleaveExtras(items);
    document.getElementById('moreList').insertAdjacentHTML('beforeend', feed.map(renderFeedEntry).join(''));
  }

  async function loadMoreBatch() {
    if (moreLoading || !moreHasMore) return;
    moreLoading = true;
    const loader = document.getElementById('moreLoader');
    loader.classList.remove('hidden');
    loader.innerHTML = '<div class="spinner"></div> Loading more…';
    let items = [], hasMore = false;
    try {
      ({ items, hasMore } = await fetchMoreStories(morePage, MORE_LIMIT));
    } catch (e) {
      moreHasMore = false;
      loader.innerHTML = document.getElementById('moreList').children.length === 0
        ? '<i class="fas fa-book" style="opacity:.5"></i>&nbsp; Nothing to show right now.'
        : "You've reached the end";
      moreLoading = false;
      return;
    }
    appendMoreBatch(items, hasMore);
    if (!hasMore) {
      loader.innerHTML = document.getElementById('moreList').children.length === 0
        ? '<i class="fas fa-book" style="opacity:.5"></i>&nbsp; Nothing to show right now.'
        : "You've reached the end";
    } else {
      loader.classList.add('hidden');
    }
    moreLoading = false;
  }

  function renderGenreGrid() {
    document.getElementById('genreGrid').innerHTML = GENRES.map(g =>
      `<div class="genre-item" ${g.filter ? `data-browse-trigger data-browse-title="${g.name} Stories" data-browse-filter="${g.filter}"` : 'data-browse-trigger data-browse-title="All Stories"'}>
        <div class="genre-icon" style="background:${g.bg};color:${g.color}"><i class="fas ${g.icon}"></i></div>
        <div class="genre-name">${g.name}</div>
      </div>`
    ).join('');
  }

  async function wireComponents(data) {
    const pool = (data.moreStories || []).map((s, i) => ({
      id: `ds-${i}`, img: s.img, title: s.title, author: s.author,
      genre: GENRE_MAP[s.genre] || s.genre.toLowerCase(), cat: s.genre,
      preview: s.preview, views: `${70 + (i * 9) % 260}k`, likes: `${8 + (i * 3) % 40}k`,
      badge: i % 6 === 0 ? 'hot' : i % 5 === 0 ? 'new' : '',
      rating: (4.3 + (i % 7) * 0.08).toFixed(1), chapters: 6 + (i % 20),
      av: `https://i.pravatar.cc/100?img=${(i * 7 + 4) % 70}`,
      keywords: [(GENRE_MAP[s.genre] || s.genre).toLowerCase(), s.author.replace('@', '').toLowerCase(), ...s.title.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 4)],
    }));
    if (window.BrowseOverlay) {
      BrowseOverlay.configure({
        stories: pool,
        onOpenStory: story => { location.href = `bridge.html?id=${encodeURIComponent(story.id)}`; },
        onOpenWriter: writer => { location.href = `profile.html?u=${encodeURIComponent((writer.handle || writer.name || '').replace('@', ''))}`; },
      });
    }
    if (window.DroboardSearch) {
      let searchData;
      if (window.SearchIndex) { try { searchData = await SearchIndex.build(); } catch (e) {} }
      DroboardSearch.configure({
        data: searchData || { poolStories: pool.map(s => ({ type: 'story', img: s.img, cat: s.cat, title: s.title, author: s.author.replace('@', ''), av: s.av, views: s.views, likes: s.likes, badge: s.badge, keywords: s.keywords })) },
        onOpenStory: story => { location.href = `bridge.html?id=${encodeURIComponent(story.id || '')}`; },
        onOpenWriter: writer => { location.href = `profile.html?u=${encodeURIComponent((writer.handle || writer.name || '').replace('@', ''))}`; },
      });
    }
  }

  function initToTop() {
    const btn = document.getElementById('toTopBtn');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { btn.classList.toggle('show', window.scrollY > 480); ticking = false; });
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function initContentProtection() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(k)) e.preventDefault();
    });
  }

  function initTabs() {
    document.querySelectorAll('.tab:not(.grid-icon):not([data-browse-trigger])').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC — the ONLY thing the HTML page calls.
  ═══════════════════════════════════════════════════════════ */
  function applyThemeIcon(t) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    applyThemeIcon(t);
  }
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    applyThemeIcon(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    if (window.DroboardSearch) DroboardSearch.setTheme(next);
    if (window.DroboardNav) DroboardNav.setTheme(next);
  }
  async function init() {
    if (window.ScrollKeep) ScrollKeep.arm();
    initTheme();
    const pageLoader = document.getElementById('pageLoader');
    let data;
    try { data = await fetchDiscoverData(); } catch (e) { data = { heroes: [], continueReading: [], topRomance: [], trending: [], collections: [], newReleases: [], editorsPicks: [], recommended: [], complete: [], recentlyUpdated: [], moreStories: [] }; }
    try {
      const lr = await fetch('/api/collections?limit=12&sort=popular', { credentials: 'include' });
      if (lr.ok) { const lj = await lr.json(); if (Array.isArray(lj) && lj.length) data.collections = lj; }
    } catch (e) { /* demo row stands */ }
    try { ADS = await fetchDiscoverAds(); } catch (e) { ADS = { platformAds: [], bookAds: [] }; }
    ADS.platformAds = ADS.platformAds || [];
    ADS.bookAds = ADS.bookAds || [];

    TOP_WRITERS = buildTopWriters(data.moreStories || []);
    heroes = data.heroes || [];
    document.getElementById('heroDots').innerHTML = heroes.map((_, i) => `<div class="dot${i === 0 ? ' on' : ''}"></div>`).join('');
    document.querySelectorAll('#heroDots .dot').forEach((d, i) => d.addEventListener('click', () => { goHero(i); startHero(); }));
    if (heroes.length) { goHero(0); startHero(); }

    DiscoverCard.renderRow('continueRow', data.continueReading, 'No books in progress yet.');
    DiscoverCard.renderRow('romanceRow', data.topRomance, 'No romance picks right now.');
    DiscoverCard.renderRow('trendingRow', data.trending, 'Nothing trending right now.');
    DiscoverCard.renderRow('newRow', data.newReleases, 'No new releases yet.');
    DiscoverCard.renderRow('editorRow', data.editorsPicks, "No editor's picks yet.");
    DiscoverCard.renderRow('recRow', data.recommended, 'No recommendations yet.');
    DiscoverCard.renderRow('completeRow', data.complete, 'No completed stories yet.');
    DiscoverCard.renderRow('updatedRow', data.recentlyUpdated, 'No recent updates.');
    DiscoverCard.renderCollRow('collRow', data.collections, 'No collections yet.');
    renderGenreGrid();

    initTabs();
    await wireComponents(data);
    initAdClicks();
    await loadMoreBatch();
    new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMoreBatch(); }, { root: null, rootMargin: '0px 0px 24px 0px', threshold: 0 }).observe(document.getElementById('scrollSentinel'));
    initToTop();
    initContentProtection();
    renderTuneChip();
    startFirstVisitFlow();

    if (window.ScrollKeep) ScrollKeep.restore();
    pageLoader.classList.add('hidden');
    setTimeout(() => pageLoader.remove(), 400);
  }

  window.DiscoverPage = { init, toggleTheme, renderRecRow, maybeShowSpotlight, renderTuneChip };
})();
