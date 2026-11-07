/* ═══════════════════════════════════════════════════════════════
   TRENDING ACROSS HUBS — the "See all" page for the feed's
   "Trending in hubs" row. Board-agnostic: it lists trending
   discussion threads from EVERY hub, paged.
   Cards render through component/genre-card.js (window.DroboardGenreCard),
   the same renderer the feed row and hub pages use, so a card looks
   and behaves identically here.
   HTML calls TrendingPage.init().
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'droboardTheme';
  const PAGE_SIZE = 12;

  let posts = [];
  let page = 0;
  let hasMore = false;
  let loading = false;
  let demoMode = false; // live unavailable → seed list, no paging

  /* Ad cadence is marketing config, never a page constant: Ad Manager →
     Placements → Trending ("Every N cards", default 4). Live reads
     GET /api/ads/placements, demo reads the same store the console writes,
     so a change in the marketing module lands here without a code change. */
  let AD_GAP = 4;
  let ADS_ON = true;
  const AD_MARKER = '<div data-ad-slot="trending:in-feed" style="margin:0 14px 8px"></div>';

  async function loadAdConfig() {
    if (!window.AdService) return; // no ad stack on this build → plain list
    try {
      const pl = await AdService.getPlacement('trending');
      if (!pl) return;
      const n = parseInt(pl.interval, 10);
      if (n > 0) AD_GAP = n;
      if (pl.enabled === false) ADS_ON = false;
    } catch (e) { /* unreadable config → keep the 4-cards default */ }
  }

  /* Cards + a slot marker every AD_GAP cards. DroboardAdSlot fills each
     marker (it auto-scans the DOM) using the 'trending' surface, so the
     creative, the kill switch and impression tracking all come from the
     marketing module. */
  function cardsHtml(list) {
    const out = [];
    list.forEach((p, i) => {
      out.push(DroboardGenreCard.renderCard(p));
      if (ADS_ON && window.DroboardAdSlot && (i + 1) % AD_GAP === 0) out.push(AD_MARKER);
    });
    return out.join('');
  }

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 2200);
  }

  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
  }

  /* Live cards arrive flat (name, avatar, time, _genreId, _genreName, likes,
     comments, tag, tagClass, score, hot, badge…). The card renderer wants the
     board baked into the time string and no media/story/trope block — the same
     transform the feed row applies, so the two never drift. */
  function toCard(p) {
    const { media, story, trope, participants, extra, ...rest } = p;
    return Object.assign({}, rest, {
      id: String(rest.id),
      time: (rest.time || '') + (rest._genreName ? ' · ' + rest._genreName : ''),
    });
  }

  // Demo fallback: flatten the seed discussions across every genre, hottest
  // first. One screen only — paging needs the live read.
  function seedCards() {
    const seed = window.GenreDemoSeed;
    if (!seed || !seed.DEMO_DISCUSSIONS) return [];
    const all = [];
    Object.keys(seed.DEMO_DISCUSSIONS).forEach(gid => {
      const genre = (seed.DEMO_GENRES && seed.DEMO_GENRES[gid]) || { name: gid, id: gid };
      (seed.DEMO_DISCUSSIONS[gid] || []).forEach((p, i) => {
        const gName = genre.name || gid;
        const gId = genre.id || gid;
        const { media, story, participants, extra, ...rest } = p;
        all.push(Object.assign({}, rest, {
          id: 'fc_' + gId + '_' + (p.id || i),
          _genreId: gId, _genreName: gName,
          time: (p.time || '') + ' · ' + gName,
        }));
      });
    });
    return all
      .sort((a, b) => (b.score || 0) - (a.score || 0) || ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
      .map(toCard);
  }

  function hooks() {
    return {
      getReactionHTML: (post) => {
        if (!window.DroboardReactionPicker) {
          return `<button type="button" class="dgc-act ${post.liked ? 'liked' : ''}" data-dgc-like="${post.id}"><i class="${post.liked ? 'fas' : 'far'} fa-heart"></i> ${post.likes || 0}</button>`;
        }
        return DroboardReactionPicker.renderTrigger(String(post.id), { liked: !!post.liked, likeCount: post.likes || 0 });
      },
      /* Same counter hooks the feed's "Trending in hubs" row uses: the picker
         owns the toggle math (love / switch / deselect, total preserved) and
         this host only seeds the counts from the post and writes them back. */
      counterHooks: () => ({
        getCounts: (id) => {
          const p = posts.find(x => String(x.id) === String(id));
          if (!p) return null; // unknown id → picker stays inert
          const likes = p.likes || 0;
          const buckets = ['crying', 'shocked', 'emotional'];
          let h = 0;
          String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
          const second = Math.min(5, Math.max(0, likes));
          const counts = { love: Math.max(0, likes - second) };
          counts[buckets[h]] = second;
          return { userRx: (p.userRx || (p.liked ? 'love' : null)) || null, ...counts };
        },
        save: (id, state) => {
          const p = posts.find(x => String(x.id) === String(id));
          if (!p) return;
          p.userRx = state.userRx;
          p.liked = state.userRx === 'love';
          let total = 0;
          Object.keys(state).forEach(k => { if (k !== 'userRx') total += state[k] || 0; });
          p.likes = total;
          if (window.DroboardGenreCard) DroboardGenreCard.update(p);
        },
      }),
      onLike: (post) => {
        post.liked = !post.liked;
        post.likes = (post.likes || 0) + (post.liked ? 1 : -1);
        if (window.DroboardGenreCard) DroboardGenreCard.update(post);
      },
      onThread: (post) => openThread(post),
      onComment: (post) => openThread(post),
      onShare: (post) => share(post),
      onDots: (post, el) => { try { window._lastDotsAnchor = el || null; } catch (e) {} if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, el); else toast('More…'); },
      onGenre: (post, genreId) => { location.href = 'genre-hub.html?genre=' + encodeURIComponent(genreId || (post && post._genreId) || 'fantasy'); },
      onNameClick: (post, name) => { location.href = 'profile.html?u=' + encodeURIComponent(name || (post && post.name) || ''); },
      onAvatar: (post) => { location.href = 'profile.html?u=' + encodeURIComponent((post && post.name) || ''); },
    };
  }

  function openThread(post) {
    if (!post) return;
    location.href = 'discussion.html?genre=' + encodeURIComponent(post._genreId || 'fantasy') + '&id=' + encodeURIComponent(post.id);
  }

  function share(post) {
    if (!post) return;
    if (window.openShareModal) {
      openShareModal({
        title: post.title || 'Trending thread',
        sub: '@' + (post.name || '') + (post._genreName ? ' · ' + post._genreName : ''),
        img: post.avatar || '',
        url: 'https://droboard.app/hub/' + (post._genreId || 'fantasy') + '/' + post.id,
      });
    } else toast('Share · ' + (post.title || ''));
  }

  function paint() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    if (!posts.length) {
      feed.innerHTML = '<div class="empty">Nothing trending yet. Check back soon.</div>';
    } else {
      /* setPosts() internally _paint()s the root from its own array — cards
         only — so it must run BEFORE our innerHTML, or it wipes the markers
         one line after we insert them (cards stay identical either way). */
      if (window.DroboardGenreCard) DroboardGenreCard.setPosts(posts);
      feed.innerHTML = cardsHtml(posts);
      if (window.DroboardAdSlot) DroboardAdSlot.scan(feed);
    }
    paintMore();
  }

  function paintMore() {
    const btn = document.getElementById('loadMore');
    if (!btn) return;
    if (demoMode || !hasMore) { btn.style.display = 'none'; return; }
    btn.style.display = 'block';
    btn.disabled = loading;
    btn.textContent = loading ? 'Loading…' : 'Load more';
  }

  async function loadNext() {
    if (loading || demoMode) return;
    loading = true;
    paintMore();
    try {
      const d = await FeedData.getCommunityPage(page + 1, PAGE_SIZE);
      page = d.page;
      hasMore = d.hasMore;
      posts = posts.concat((d.items || []).map(toCard));
      if (!posts.length && page === 1) throw new Error('empty');
    } catch (e) {
      // No live read (offline, or the hub has no threads yet) → seed, no paging.
      demoMode = true;
      hasMore = false;
      if (!posts.length) posts = seedCards();
    }
    loading = false;
    paint();
  }

  async function init() {
    initTheme();
    const back = document.getElementById('backBtn');
    if (back) back.addEventListener('click', () => { if (history.length > 1) history.back(); else location.href = 'feed.html'; });
    const more = document.getElementById('loadMore');
    if (more) more.addEventListener('click', loadNext);

    const h = hooks();
    if (window.DroboardGenreCard) DroboardGenreCard.attach(document.getElementById('feed'), h);
    /* Same wiring the feed row has: attachCounters injects the picker's
       stylesheet — without it `.drp-popup` has no display:none and the emoji
       list renders open, spilling down the card — and it owns the reaction
       math for every card on this page. */
    if (window.DroboardReactionPicker) DroboardReactionPicker.attachCounters(document.getElementById('feed'), h.counterHooks());
    if (window.DroboardDotsMenu) DroboardDotsMenu.configure({
      onReportType: (post, typeId) => {
        try {
          const reports = JSON.parse(localStorage.getItem('DRO_REPORTS') || '[]');
          reports.push({ postId: post && post.id, typeId, at: Date.now() });
          localStorage.setItem('DRO_REPORTS', JSON.stringify(reports));
        } catch (e) {}
        toast('🚩 Report filed. Our team will review it.');
      },
    });

    await loadAdConfig();
    await loadNext();
    if (window.DroboardNav) DroboardNav.configure({ active: 'none' });
  }

  window.TrendingPage = { init, toast };
})();
