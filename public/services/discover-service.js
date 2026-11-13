/* ═══════════════════════════════════════════════════════════════
   DISCOVER SERVICE
   Data + orchestration in one file. HTML calls DiscoverPage.init().
   Live: stories/writers come from GET /api/feed/discover and friends.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  /* Hosted backends sleep: a request during a cold start can hang until the
     browser gives up, and the old boot path left the loader up forever. Every
     read now has a deadline, and Discover retries once before showing a card
     that asks the reader to try again. */
  const FETCH_TIMEOUT_MS = 25000;
  function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || FETCH_TIMEOUT_MS);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
      .finally(() => clearTimeout(timer));
  }

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
  let LAST_DISCOVER = null, LAST_TASTE = '';
  let morePage = 1, moreHasMore = true, moreLoading = false;
  let moreGlobalIndex = 0, moreAdCounter = 0, writersRowInserted = false;

  /* ═══════════════════════════════════════════════════════════
     DATA LAYER — all data comes from backend API (GET /api/discover)
  ═══════════════════════════════════════════════════════════ */

  /* Taste filter from the "Tune your feed" chip (localStorage).
     Live swap: send it as ?taste=a,b on GET /api/feed/discover. */
  function readTastes() {
    try { return JSON.parse(localStorage.getItem('dro_tastes') || 'null') || null; }
    catch (e) { return null; }
  }
  // The ?taste= string this visit sends: the picker's genre names, max 4.
  function tasteKey() {
    const t = readTastes();
    const g = (t && Array.isArray(t.genres) ? t.genres : []).map(x => String(x).trim()).filter(Boolean);
    return g.slice(0, 4).join(',');
  }

  /* The recommended row has one source: the backend's ranking for the current
     taste filter — the picker re-asks the API instead of re-scoring locally,
     so "tune your feed" changes what the server returns. */
  async function renderRecRow() {
    let rows = null;
    const key = tasteKey();
    if (LAST_DISCOVER && key === LAST_TASTE) {
      rows = LAST_DISCOVER.recommended;
    } else {
      const res = await fetch(`${API_BASE}/discover${key ? '?taste=' + encodeURIComponent(key) : ''}`, { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j.recommended)) { LAST_DISCOVER = j; LAST_TASTE = key; rows = j.recommended; }
      }
    }
    if (!rows) rows = [];
    DiscoverCard.renderRow('recRow', rows, 'No recommendations yet.');
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
    if (!ad) return; // no creative configured in Marketing → no spotlight
    const story = window.DroboardSpotlight.fromAd
      ? DroboardSpotlight.fromAd(ad)
      : { kind: 'story', id: ad.id, title: ad.title, author: ad.author || ad.authorName, genre: ad.genre, chapters: ad.chapters, reads: ad.reads, preview: ad.preview, img: ad.img || ad.cover, cta: ad.cta || 'Read now' };
    let href = null;
    if (ad.url) href = ad.url;
    else if (story.kind === 'user') href = 'profile.html?u=' + encodeURIComponent(story.handle || story.name || '');
    else if (story.kind === 'board') href = 'leaderboard.html';
    else if (story.kind === 'promo') href = 'refer.html';
    else href = window.DiscoverCard ? DiscoverCard.storyHref({ id: ad.storyId || ad.id, title: ad.title }) : null;
    try {
      sessionStorage.setItem('dro_spotlight_v', '1');
      localStorage.setItem('dro_spotlight_last', String(Date.now()));
    } catch (e) {}
    DroboardSpotlight.show({
      story: story,
      seconds: parseInt(cfg.seconds, 10) || 6,
      allowSkip: cfg.allowSkip !== false,
      sponsored: true,
      trackId: ad.id,
      href: href,
    });
  }

  /* First visit: render, then the spotlight. There is no onboarding picker —
     genre picks are a filter (the "Tune your feed" chip) and never a profile
     fact, so nothing is asked upfront and dro_tastes_seen is gone. */
  function startFirstVisitFlow() {
    renderRecRow();
    setTimeout(maybeShowSpotlight, 1200);
  }

  async function fetchDiscoverData() {
    const key = tasteKey();
    const url = `${API_BASE}/discover${key ? '?taste=' + encodeURIComponent(key) : ''}`;
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(url, { credentials: 'include' });
        if (!res.ok) throw new Error('Discover API failed: ' + res.status);
        const j = await res.json();
        LAST_DISCOVER = j; LAST_TASTE = key;
        return j;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
      }
    }
    throw lastErr;
  }

  async function fetchDiscoverAds() {
    const res = await fetchWithTimeout(`${API_BASE}/discover/ads`, { credentials: 'include' });
    if (!res.ok) throw new Error('Ads API failed: ' + res.status);
    return res.json();
  }

  async function fetchMoreStories(page, limit) {
    const res = await fetchWithTimeout(`${API_BASE}/discover/stories?page=${page}&limit=${limit}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Stories API failed: ' + res.status);
    return res.json();
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

  /* The Top Writers row is the backend's ranking, delivered as
     data.topWriters[] by GET /api/feed/discover (total reads across the
     writer's live books, followers as tiebreaker). Nothing is ranked, named
     or pictured here: when the live row is empty the row renders empty (its
     empty-state) — there is no demo directory to fall back to.
     loadWriters() prefetches the real status slides so the rings on
     this row come from the live store. */
  async function buildTopWriters(data) {
    const rows = (data && data.topWriters) || [];
    if (window.DroboardPeople && DroboardPeople.setLiveWriters) {
      DroboardPeople.setLiveWriters(rows);
    }
    if (!window.DroboardPeople) return [];
    const live = typeof DroboardPeople.liveWriters === 'function' ? DroboardPeople.liveWriters() : [];
    const list = live.slice(0, 6);
    if (window.DroboardStatus && typeof DroboardStatus.loadWriters === 'function') {
      try { await DroboardStatus.loadWriters(list.map(w => w.handle)); } catch (e) { /* row renders ringless */ }
    }
    return list;
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

  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev, { page: 'discover', slot: 'discover:strip' }); } catch (e) {} }
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
      DroboardSearch.configure({
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
    try {
      await boot();
    } catch (err) {
      console.error('[discover] load failed:', err);
      showBootError();
    }
  }

  async function boot() {
    if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
    if (window.ScrollKeep) ScrollKeep.arm();
    initTheme();
    const pageLoader = document.getElementById('pageLoader');
    // Keep status bar black while the loader is covering the screen
    const _tc = document.querySelector('meta[name="theme-color"]');
    if (_tc) _tc.content = '#000000';
    let data;
    data = await fetchDiscoverData();
    // Always fetch live collections
    try {
      const collRes = await fetchWithTimeout('/api/collections?limit=12&sort=popular', { credentials: 'include' });
      if (collRes.ok) { const collJ = await collRes.json(); if (Array.isArray(collJ) && collJ.length) data.collections = collJ; }
    } catch (e) {
      // Collections are a nicety: keep the rest of Discover usable without them.
    }
    try { ADS = await fetchDiscoverAds(); } catch (e) { ADS = { platformAds: [], bookAds: [] }; }
    ADS.platformAds = ADS.platformAds || [];
    ADS.bookAds = ADS.bookAds || [];

    TOP_WRITERS = await buildTopWriters(data);
    heroes = data.heroes || [];
    document.getElementById('heroDots').innerHTML = heroes.map((_, i) => `<div class="dot${i === 0 ? ' on' : ''}"></div>`).join('');
    document.querySelectorAll('#heroDots .dot').forEach((d, i) => d.addEventListener('click', () => { goHero(i); startHero(); }));
    if (heroes.length) { goHero(0); startHero(); }

    // Strip rating from sections that should not display star ratings
    const noRating = (arr) => (arr || []).map(s => Object.assign({}, s, { rating: 0 }));

    DiscoverCard.renderRow('topRatedRow', data.topRated, 'No top rated stories yet.');
    DiscoverCard.renderRow('romanceRow', noRating(data.topRomance), 'No romance picks right now.');
    DiscoverCard.renderRow('trendingRow', noRating(data.trending), 'Nothing trending right now.');
    DiscoverCard.renderRow('newRow', noRating(data.newReleases), 'No new releases yet.');
    DiscoverCard.renderRow('editorRow', noRating(data.editorsPicks), "No editor's picks yet.");
    DiscoverCard.renderRow('recRow', noRating(data.recommended), 'No recommendations yet.');
    DiscoverCard.renderRow('completeRow', noRating(data.complete), 'No completed stories yet.');
    DiscoverCard.renderRow('updatedRow', noRating(data.recentlyUpdated), 'No recent updates.');
    DiscoverCard.renderCollRow('collRow', data.collections, 'No collections yet.');
    renderGenreGrid();

    initTabs();
    await wireComponents(data);
    initAdClicks();
    try { await loadMoreBatch(); } catch (e) { /* scroll can retry the next batch */ }
    new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMoreBatch(); }, { root: null, rootMargin: '0px 0px 24px 0px', threshold: 0 }).observe(document.getElementById('scrollSentinel'));
    initToTop();
    initContentProtection();
    renderTuneChip();
    startFirstVisitFlow();

    if (window.ScrollKeep) ScrollKeep.restore();
    pageLoader.classList.add('hidden');
    setTimeout(() => {
      pageLoader.remove();
      // Let theme-chrome.js re-sync status bar to the actual page theme
      if (window.DroboardThemeChrome && typeof DroboardThemeChrome.sync === 'function') DroboardThemeChrome.sync();
      else { const e = document.createEvent('Event'); e.initEvent('pageshow', true, true); window.dispatchEvent(e); }
    }, 400);
  }

  /* The loader must never be the last thing a reader sees. If the very first
     read fails (a sleeping host, a network drop), hide it and offer a retry. */
  function showBootError() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => { if (loader.parentNode) loader.remove(); }, 400);
    }
    if (document.getElementById('discoverBootError')) return;
    const box = document.createElement('div');
    box.id = 'discoverBootError';
    box.style.cssText = 'position:fixed;inset:0;z-index:6000;display:flex;flex-direction:column;'
      + 'align-items:center;justify-content:center;gap:14px;padding:28px;text-align:center;'
      + 'background:var(--bg,#fff);color:var(--text,#111)';
    box.innerHTML = '<div style="font-size:17px;font-weight:700">Discover could not load</div>'
      + '<div style="font-size:14px;opacity:.7;max-width:320px">The server may still be waking up. '
      + 'Give it a moment, then try again.</div>'
      + '<button id="discoverRetry" style="border:0;border-radius:10px;padding:11px 22px;font:inherit;'
      + 'font-weight:600;background:#ff2d55;color:#fff;cursor:pointer">Try again</button>';
    document.body.appendChild(box);
    const btn = document.getElementById('discoverRetry');
    if (btn) btn.addEventListener('click', () => window.location.reload());
  }

  window.DiscoverPage = { init, toggleTheme, renderRecRow, maybeShowSpotlight, renderTuneChip };
})();
