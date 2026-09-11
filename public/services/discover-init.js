/* ═══════════════════════════════════════════════════════════════
   DISCOVER PAGE CONTROLLER
   All orchestration logic: hero carousel, infinite scroll,
   ad interleaving, genre grid, component wiring, content protection.
   The HTML page just calls DiscoverPage.init() — nothing else.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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
  const MORE_LIMIT = 8, AD_INTERVAL = 6, AD_CYCLE = ['book', 'book', 'book', 'book', 'platform'];

  let heroes = [], hi = 0, heroTimer;
  let ADS = { platformAds: [], bookAds: [] };
  let TOP_WRITERS = [];
  let morePage = 1, moreHasMore = true, moreLoading = false;
  let moreGlobalIndex = 0, moreAdCounter = 0, writersRowInserted = false;

  /* ── Hero ── */
  function goHero(i) {
    if (!heroes.length) return;
    hi = i;
    const h = heroes[i];
    document.getElementById('heroImg').style.backgroundImage = `url('${h.img}')`;
    document.getElementById('heroTitle').innerHTML = h.title;
    document.getElementById('heroAuthor').innerHTML = h.author + ' <i class="fas fa-circle-check"></i>';
    document.getElementById('heroTags').innerHTML = (h.tags || []).map(t => `<span class="hero-tag">${t}</span>`).join('');
    document.querySelectorAll('#heroDots .dot').forEach((d, j) => d.classList.toggle('on', j === i));
  }

  function startHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goHero((hi + 1) % heroes.length), 4500);
  }

  /* ── Top Writers ── */
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

  /* ── Ad interleaving ── */
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

  function renderFeedEntry(entry) {
    if (entry.kind === 'writers') return DiscoverCard.writersRow(TOP_WRITERS);
    if (entry.kind === 'platformAd') return DiscoverCard.platformAdItem(entry.data);
    if (entry.kind === 'bookAd') return DiscoverCard.bookAdItem(entry.data);
    return DiscoverCard.listItem(entry.data);
  }

  /* ── Infinite scroll ── */
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
      ({ items, hasMore } = await DiscoverData.getMoreStories(morePage, MORE_LIMIT));
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

  /* ── Genre grid ── */
  function renderGenreGrid() {
    document.getElementById('genreGrid').innerHTML = GENRES.map(g =>
      `<div class="genre-item" ${g.filter ? `data-browse-trigger data-browse-title="${g.name} Stories" data-browse-filter="${g.filter}"` : 'data-browse-trigger data-browse-title="All Stories"'}>
        <div class="genre-icon" style="background:${g.bg};color:${g.color}"><i class="fas ${g.icon}"></i></div>
        <div class="genre-name">${g.name}</div>
      </div>`
    ).join('');
  }

  /* ── Component wiring ── */
  function wireComponents(data) {
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
        data: {
          poolStories: pool.map(s => ({ type: 'story', img: s.img, cat: s.cat, title: s.title, author: s.author.replace('@', ''), av: s.av, views: s.views, likes: s.likes, badge: s.badge, keywords: s.keywords })),
        },
        onOpenStory: story => { location.href = `bridge.html?id=${encodeURIComponent(story.id || '')}`; },
        onOpenWriter: writer => { location.href = `profile.html?u=${encodeURIComponent((writer.handle || writer.name || '').replace('@', ''))}`; },
      });
    }
  }

  /* ── Scroll-to-top ── */
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

  /* ── Content protection ── */
  function initContentProtection() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
    document.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(k)) e.preventDefault();
    });
  }

  /* ── Tab clicks ── */
  function initTabs() {
    document.querySelectorAll('.tab:not(.grid-icon):not([data-browse-trigger])').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API — the ONLY thing the HTML page calls.
  ═══════════════════════════════════════════════════════════ */
  async function init() {
    const pageLoader = document.getElementById('pageLoader');

    let data;
    try { data = await DiscoverData.getDiscoverData(); } catch (e) { data = { heroes: [], continueReading: [], topRomance: [], trending: [], collections: [], newReleases: [], editorsPicks: [], recommended: [], complete: [], recentlyUpdated: [], moreStories: [] }; }
    try { ADS = await DiscoverData.getDiscoverAds(); } catch (e) { ADS = { platformAds: [], bookAds: [] }; }
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
    wireComponents(data);
    await loadMoreBatch();
    new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMoreBatch(); }, { root: null, rootMargin: '0px 0px 24px 0px', threshold: 0 }).observe(document.getElementById('scrollSentinel'));
    initToTop();
    initContentProtection();

    pageLoader.classList.add('hidden');
    setTimeout(() => pageLoader.remove(), 400);
  }

  window.DiscoverPage = { init };
})();
