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
  const THEME_KEY = 'dro_search_theme_v1';
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
    return [
      { id: 'st1', img: covers[0], title: 'HIS <em>Sweet</em><br>REVENGE', author: 'By Luna Grey', tags: ['Mafia', 'Romance'] },
      { id: 'st2', img: covers[1], title: 'UNTIL YOU<br>REGRET', author: 'By Ada Writes', tags: ['Revenge', 'Romance'] },
      { id: 'st3', img: covers[2], title: 'CLAIMING HIS<br>LUNA', author: 'By Ifeanyi Story', tags: ['Werewolf', 'Romance'] },
      { id: 'st4', img: covers[3], title: 'BOUND<br>BY HER', author: 'By Efe O', tags: ['Romance', 'Drama'] },
    ];
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

  function buildRecommended() {
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

  function goHero(i) {
    if (!heroes.length) return;
    hi = i;
    const h = heroes[i];
    document.getElementById('heroImg').style.backgroundImage = `url('${h.img}')`;
    document.getElementById('heroTitle').innerHTML = h.title;
    document.getElementById('heroAuthor').innerHTML = h.author + ' <i class="fas fa-circle-check"></i>';
    document.getElementById('heroTags').innerHTML = (h.tags || []).map(t => `<span class="hero-tag">${t}</span>`).join('');
    document.querySelectorAll('#heroDots .dot').forEach((d, j) => d.classList.toggle('on', j === i));
    document.querySelector('.hero').onclick = () => { window.location.href = `bridge.html?id=${encodeURIComponent(h.id)}`; };
  }

  function startHero() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goHero((hi + 1) % heroes.length), 4500);
  }

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
    initTheme();
    const pageLoader = document.getElementById('pageLoader');
    let data;
    try { data = await fetchDiscoverData(); } catch (e) { data = { heroes: [], continueReading: [], topRomance: [], trending: [], collections: [], newReleases: [], editorsPicks: [], recommended: [], complete: [], recentlyUpdated: [], moreStories: [] }; }
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

    pageLoader.classList.add('hidden');
    setTimeout(() => pageLoader.remove(), 400);
  }

  window.DiscoverPage = { init, toggleTheme };
})();
