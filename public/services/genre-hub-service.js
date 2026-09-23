/* ═══════════════════════════════════════════════════════════════
   GENRE HUB SERVICE
   Genre hub page orchestration. HTML calls GenreHubPage.init().
   Discussions render via component/genre-card.js (window.DroboardGenreCard).
   When going live: swap GenreDemoSeed reads for API calls.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'droboardTheme';

  let GENRE = null;
  let GENRE_ID = null;
  let ALL_POSTS = [];
  let PROMO_SLIDES = [];
  let sort = 'hot';
  let joined = true;
  let _adTurn = 0;

  /* Ads: served ONLY by the central inventory (ad-service). Empty pool = no ads. */
  let HUB_AD_CONFIG = { enabled: true, every: 3, topPromo: true };
  let HUB_ADS = [];

  async function loadHubAds() {
    if (!window.AdService) return;
    try {
      const placement = await AdService.getPlacement('genreHub');
      if (placement.interval) HUB_AD_CONFIG.every = placement.interval;
      if (typeof placement.topPromo === 'boolean') HUB_AD_CONFIG.topPromo = placement.topPromo;
      const pools = await AdService.getAds({ page: 'genreHub' });
      const next = [];
      if ((pools.book || []).length) {
        next.push({ format: 'storyPromo', ad: Object.assign({}, pools.book[0], { cat: GENRE.name }) });
      }
      if ((pools.platform || []).length) next.push({ format: 'platform', ad: pools.platform[0] });
      if (next.length) HUB_ADS = next;
      try { PROMO_SLIDES = await AdService.getPromoSlides({ page: 'genreHub', genre: GENRE_ID }); }
      catch (e) { PROMO_SLIDES = []; }
    } catch (e) {}
  }

  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
  function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 2200);
  }

  /* ── Theme ── */
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    var iconEl = document.getElementById('themeIcon');
    if (iconEl) iconEl.className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#ffffff' : '#000000');
    if (window.DroboardNav) DroboardNav.setTheme(next);
  }
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    var iconEl = document.getElementById('themeIcon');
    if (iconEl) iconEl.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#ffffff' : '#000000');
    const applyNav = () => { if (window.DroboardNav) DroboardNav.setTheme(t); };
    applyNav();
    setTimeout(applyNav, 0);
  }

  /* ── Genre ── */
  function loadGenre() {
    const seed = window.GenreDemoSeed;
    if (!seed) { toast('GenreDemoSeed missing'); return false; }
    const params = new URLSearchParams(location.search);
    GENRE_ID = params.get('genre') || seed.DEFAULT_GENRE_ID;
    GENRE = seed.DEMO_GENRES[GENRE_ID] || seed.DEMO_GENRES[seed.DEFAULT_GENRE_ID];
    GENRE_ID = GENRE.id || GENRE_ID;
    ALL_POSTS = [seed.DEMO_PINNED[GENRE_ID], ...((seed.DEMO_DISCUSSIONS[GENRE_ID]) || [])].filter(Boolean);
    PROMO_SLIDES = [];
    return true;
  }

  function applyGenre() {
    document.getElementById('pageTitle').textContent = GENRE.name;
    document.getElementById('heroName').textContent = GENRE.name;
    document.getElementById('heroTag').textContent = GENRE.tagline || '';
    document.getElementById('heroImg').src = GENRE.cover || '';
    document.getElementById('heroIcon').className = 'fas ' + (GENRE.icon || 'fa-book');
    document.getElementById('statMembers').textContent = GENRE.members || '—';
    document.getElementById('statDisc').textContent = GENRE.discussions || '—';
    document.getElementById('statStories').textContent = GENRE.stories || '—';
    document.getElementById('blurbText').textContent = GENRE.blurb || '';
    document.getElementById('composerPh').textContent = 'Start a discussion in ' + GENRE.name + '…';
    document.title = GENRE.name + ' · Genre Hub · DroBoard';
    if (window.DroboardGenreCard) DroboardGenreCard.setGenreName(GENRE.name);
  }

  /* ── Feed ── */
  function sortedDiscussions() {
    const list = ALL_POSTS.filter(p => !p.pinned).slice();
    if (sort === 'hot') return list.sort((a, b) => (b.score || 0) - (a.score || 0) || ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
    if (sort === 'controversial') return list.sort((a, b) => (b.controversy || 0) - (a.controversy || 0) || (b.comments || 0) - (a.comments || 0));
    if (sort === 'top') return list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    if (sort === 'unanswered') return list.filter(p => !p.comments).concat(list.filter(p => p.comments));
    return list;
  }

  function renderAdSlot(item) {
    if (!window.DroboardAdCard || !item) return '';
    let inner = '';
    try {
      if (item.format === 'storyPromo') inner = DroboardAdCard.renderStoryPromo(item.ad);
      else if (item.format === 'platform') inner = DroboardAdCard.renderPlatform(item.ad);
      else if (item.format === 'follow') inner = DroboardAdCard.renderFollowPromo(item.ad);
      else if (item.format === 'native') inner = DroboardAdCard.renderNative(item.ad);
      else inner = DroboardAdCard.renderStoryPromo(item.ad);
    } catch (e) { inner = ''; }
    return inner ? '<div class="promo-slot">' + inner + '</div>' : '';
  }

  function renderFeed() {
    const pinned = ALL_POSTS.filter(p => p.pinned);
    const list = sortedDiscussions();
    if (!window.DroboardGenreCard) {
      document.getElementById('feed').innerHTML = '<div style="padding:20px;color:var(--tx-muted)">genre-card.js missing</div>';
      return;
    }
    DroboardGenreCard.setSort(sort);
    let html = '';
    pinned.forEach(p => { html += DroboardGenreCard.renderCard(p); });
    if (HUB_AD_CONFIG.enabled && HUB_ADS.length && HUB_AD_CONFIG.every) {
      _adTurn = 0;
      list.forEach((p, i) => {
        html += DroboardGenreCard.renderCard(p);
        if ((i + 1) % HUB_AD_CONFIG.every === 0) {
          html += renderAdSlot(HUB_ADS[_adTurn % HUB_ADS.length]);
          _adTurn++;
        }
      });
    } else {
      list.forEach(p => { html += DroboardGenreCard.renderCard(p); });
    }
    document.getElementById('feed').innerHTML = html;
    DroboardGenreCard.setPosts(pinned.concat(list));
    document.getElementById('feed').innerHTML = html;
    HUB_ADS.forEach(x => { if (x.ad && x.ad.id) trackAd(x.ad.id, 'impression'); });
  }

  function mountPromo() {
    if (!HUB_AD_CONFIG.topPromo || !window.DroboardPromoSlider || !PROMO_SLIDES.length) return;
    DroboardPromoSlider.mount('#hubPromoMount', {
      slides: PROMO_SLIDES,
      interval: 3200,
      eyebrow: GENRE.name + ' picks',
      onSelect: (s) => toast('📖 ' + (s.title || '')),
    });
  }

  /* ── Component wiring ── */
  function wireComponents() {
    const feedEl = document.getElementById('feed');
    if (window.DroboardReactionPicker) {
      // Paired hooks (component contract): getState reads the post, onReact
      // mutates it. An onReact alone would swallow taps with no update.
      const findPost = (id) => ALL_POSTS.find(p => String(p.id) === String(id));
      DroboardReactionPicker.attach(feedEl, {
        topRow: 'external',
        getState: (id) => {
          const post = findPost(id);
          const likes = (post && post.likes) || 0;
          // Demo spread: love bucket = post likes, second bucket rotates per
          // post so the top-2 badges always have two icons. Stable per id.
          const buckets = ['crying', 'shocked', 'emotional'];
          let h = 0;
          String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
          const second = {};
          second[buckets[h]] = Math.max(4, Math.round(likes * 0.3));
          return Object.assign({ userRx: post && post.liked ? 'love' : null, love: likes }, second);
        },
        onReact: (id) => {
          const post = findPost(id);
          if (!post) return;
          post.liked = !post.liked;
          post.likes = (post.likes || 0) + (post.liked ? 1 : -1);
          if (window.DroboardGenreCard) DroboardGenreCard.update(post);
        },
      });
    }
    if (window.DroboardGenreCard) {
      DroboardGenreCard.attach(feedEl, {
        genreName: GENRE.name,
        getReactionHTML: (post) => {
          if (!window.DroboardReactionPicker) {
            return `<button type="button" class="dgc-act ${post.liked ? 'liked' : ''}" data-dgc-like="${post.id}">` +
              `<i class="${post.liked ? 'fas' : 'far'} fa-heart"></i> ${post.likes || 0}</button>`;
          }
          return DroboardReactionPicker.renderTrigger(String(post.id), { liked: !!post.liked, likeCount: post.likes || 0 });
        },
        onLike: (post) => { post.liked = !post.liked; post.likes = (post.likes || 0) + (post.liked ? 1 : -1); DroboardGenreCard.update(post); },
        onThread: (post) => { location.href = 'discussion.html?genre=' + encodeURIComponent(GENRE_ID) + '&id=' + encodeURIComponent(post.id); },
        onShare: (post) => {
          if (window.openShareModal) {
            openShareModal({
              title: post.title, sub: '@' + (post.name || '') + ' · ' + GENRE.name,
              img: post.media || (post.story && post.story.cover) || '',
              url: 'https://droboard.app/hub/' + GENRE_ID + '/' + post.id,
            });
          } else toast('Share · ' + (post.title || ''));
        },
        onDots: (post, el) => { if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, el); else toast('More…'); },
        onStory: (post) => toast('📖 ' + ((post.story && post.story.title) || 'Story')),
        onAvatar: (post) => { location.href = 'profile.html?u=' + encodeURIComponent(post.name || ''); },
        onNameClick: (post, name) => { location.href = 'profile.html?u=' + encodeURIComponent(name || (post && post.name) || ''); },
        onPinned: () => toast('Hub rules…'),
      });
    }
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onFollow: (post) => toast('Following @' + (post.name || 'user')),
        onMute: (post) => toast('Muted @' + (post.name || 'user')),
        onLess: () => toast('Showing less of this.'),
        onReport: () => toast('🚩 Reported'),
        onCopyLink: (post) => {
          const url = 'https://droboard.app/hub/' + GENRE_ID + '/' + post.id;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied')).catch(() => toast(url));
          else toast(url);
        },
        onEdit: () => toast('✏️ Edit'),
        onDelete: () => toast('🗑️ Delete'),
      });
    }
    if (window.DroboardAdCard) {
      DroboardAdCard.attach(feedEl, {
        getAds: () => HUB_ADS.map(x => x.ad),
        onOpen: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('📖 ' + (ad.title || ad.heading || 'Ad')); },
        onCta: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('🔗 ' + (ad.cta || 'CTA')); },
        onLike: () => {},
        onComment: () => toast('💬'),
        onShare: (ad) => {
          if (window.openShareModal) {
            openShareModal({
              title: ad.title || ad.heading || ad.brand, sub: ad.brand || 'Sponsored',
              img: ad.cover || ad.image || '', url: 'https://droboard.app/ad/' + (ad.id || ''),
            });
          }
        },
      });
    }
  }

  /* ── Filters / tabs / join / composer ── */
  function initFilters() {
    document.querySelectorAll('#sortRow .sort-chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('#sortRow .sort-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        sort = c.dataset.sort;
        renderFeed();
      });
    });
    document.querySelectorAll('#hubTabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#hubTabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        if (t.dataset.tab === 'hot') {
          sort = 'hot';
          document.querySelectorAll('#sortRow .sort-chip').forEach(c => c.classList.toggle('active', c.dataset.sort === 'hot'));
          renderFeed();
        }
        toast(t.textContent.trim());
      });
    });
  }
  function initJoin() {
    document.getElementById('joinBtn').addEventListener('click', function () {
      joined = !joined;
      this.classList.toggle('on', joined);
      this.innerHTML = joined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join';
      toast(joined ? 'Joined ' + GENRE.name : 'Left hub');
    });
  }
  function openComposer() {
    if (window.PostComposer) {
      PostComposer.open({
        genreName: GENRE.name,
        onPost: function (post) {
          post.score = Date.now();
          ALL_POSTS.unshift(post);
          renderFeed();
          toast('Posted to ' + GENRE.name + '!');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
    } else {
      toast('Composer — start a ' + GENRE.name + ' discussion');
    }
  }
  function initComposer() {
    document.getElementById('composerStrip').addEventListener('click', openComposer);
    document.getElementById('fabNew').addEventListener('click', openComposer);
  }
  function initToTop() {
    const toTop = document.getElementById('toTop');
    const sortRow = document.getElementById('sortRow');
    window.addEventListener('scroll', () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      toTop.classList.toggle('show', y > 420);
    }, { passive: true });
    toTop.addEventListener('click', () => {
      const top = sortRow.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  /* ── Boot ── */
  async function init() {
    initTheme();
    window.toast = toast;
    window.toggleTheme = toggleTheme;
    if (!loadGenre()) return;
    await loadHubAds();
    wireComponents();
    initFilters();
    initJoin();
    initComposer();
    initToTop();
    applyGenre();
    renderFeed();
    mountPromo();
    if (window.DroboardSearch) {
      let searchData;
      if (window.SearchIndex) { try { searchData = await SearchIndex.build(); } catch (e) {} }
      DroboardSearch.configure({
        data: searchData,
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => { location.href = 'profile.html?u=' + encodeURIComponent(((w && (w.handle || w.name)) || '').replace('@', '')); },
        onOpenDebate: (d) => { location.href = 'discussion.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
    if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
  }

  window.GenreHubPage = { init, toast, toggleTheme, renderFeed };
})();
