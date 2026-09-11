/* ═══════════════════════════════════════════════════════════════
   FEED SERVICE
   Feed page orchestration. HTML calls FeedPage.init().
   When going live: set USE_API = false → true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let STORIES_CACHE = [];
  let FEED_POSTS = [];
  let FEED_SORT = 'latest';
  let COMM_POSTS_A = [];
  let COMM_POSTS_B = [];
  let COMM_POSTS_MID = [];

  function fmtN(n) { if (typeof n === 'string') return n; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function escAttr(s) { return String(s || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
  function toast(msg, dur) {
    dur = dur || 2500;
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur);
  }

  /* ── Theme ── */
  const THEME_KEY = 'dro_search_theme_v1';
  function loadSavedTheme() { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  function applyThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000');
  }
  function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    applyThemeIcon(next);
    saveTheme(next);
    if (window.DroboardSearch) DroboardSearch.setTheme(next);
    if (window.DroboardNav) DroboardNav.setTheme(next);
    toast(next === 'light' ? '☀️ Light mode on' : '🌙 Dark mode on');
  }
  function initTheme() {
    const saved = loadSavedTheme();
    document.documentElement.setAttribute('data-theme', saved);
    applyThemeIcon(saved);
  }

  /* ── Stories ── */
  function renderStories(stories) {
    document.getElementById('storiesRow').innerHTML = stories.map(s => `
      <div class="story-item" data-story-id="${s.id}" data-you="${!!s.you}">
        <div class="story-ring ${s.you ? 'own' : (s.ring || '')}"><div class="inner">
          ${s.you ? `<div class="story-add">+</div>` : `<img class="story-avatar" src="${s.avatar}" alt="${escAttr(s.name)}">`}
        </div></div>
        <div class="story-name">${s.name}</div>
      </div>`).join('');
  }
  function bindStories() {
    document.getElementById('storiesRow').addEventListener('click', (e) => {
      const item = e.target.closest('.story-item');
      if (!item) return;
      if (item.dataset.you === 'true') { toast('📸 Add to your story'); return; }
      const viewable = STORIES_CACHE.filter(s => !s.you && s.statuses && s.statuses.length);
      if (!viewable.length) { toast('No statuses available'); return; }
      if (!window.openStatusViewer) { toast('Status viewer unavailable'); return; }
      openStatusViewer(viewable, item.dataset.storyId);
    });
  }
  window.onStatusViewerChange = function (wid, ring) {
    const s = STORIES_CACHE.find(x => x.id === wid);
    if (s) s.ring = ring;
    const item = document.querySelector(`.story-item[data-story-id="${wid}"] .story-ring`);
    if (item) {
      item.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
      if (ring) item.classList.add(ring);
    }
  };

  /* ── Promo ── */
  async function mountPromo() {
    if (!window.DroboardPromoSlider || !window.FeedData || !FeedData.getPromoSlides) return;
    const slides = await FeedData.getPromoSlides();
    if (!slides.length) return;
    DroboardPromoSlider.mount('#promoMount', {
      slides, interval: 3200,
      onSelect: (slide) => toast('📖 ' + (slide.title || 'Opening…')),
    });
  }

  /* ── Community ── */
  function collectCommunityPosts() {
    const seed = window.GenreDemoSeed;
    if (!seed || !seed.DEMO_DISCUSSIONS) return { hot: [], mid: [], more: [] };
    const all = [];
    Object.keys(seed.DEMO_DISCUSSIONS).forEach(gid => {
      const genre = (seed.DEMO_GENRES && seed.DEMO_GENRES[gid]) || { name: gid, id: gid };
      (seed.DEMO_DISCUSSIONS[gid] || []).forEach((p, i) => {
        const gName = genre.name || gid;
        const gId = genre.id || gid;
        const { media, story, participants, extra, ...rest } = p;
        all.push({ ...rest, id: 'fc_' + gId + '_' + (p.id || i), _genreId: gId, _genreName: gName, time: (p.time || '') + ' · ' + gName });
      });
    });
    const byHot = all.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
    const n = byHot.length;
    if (n >= 9) return { hot: byHot.slice(0, 4), mid: byHot.slice(4, 8), more: byHot.slice(8, 12) };
    if (n >= 6) return { hot: byHot.slice(0, 3), mid: byHot.slice(3, 6), more: byHot.slice(0, 3).reverse() };
    return { hot: byHot.slice(), mid: byHot.slice().reverse(), more: byHot.slice() };
  }

  function renderCommSlides(posts) {
    if (!window.DroboardGenreCard) return '';
    DroboardGenreCard.setGenreName('');
    return posts.map(p => `<div class="comm-slide">${DroboardGenreCard.renderCard(p)}</div>`).join('');
  }

  function genreCardHooks() {
    return {
      getReactionHTML: (post) => {
        if (!window.DroboardReactionPicker) {
          return `<button type="button" class="dgc-act ${post.liked ? 'liked' : ''}" data-dgc-like="${post.id}"><i class="${post.liked ? 'fas' : 'far'} fa-heart"></i> ${post.likes || 0}</button>`;
        }
        return DroboardReactionPicker.renderTrigger(String(post.id), { liked: !!post.liked, likeCount: post.likes || 0 });
      },
      onLike: (post) => { post.liked = !post.liked; post.likes = (post.likes || 0) + (post.liked ? 1 : -1); if (window.DroboardGenreCard) DroboardGenreCard.update(post); },
      onThread: (post) => { location.href = 'genre-hub.html?genre=' + encodeURIComponent(post._genreId || 'fantasy') + '&id=' + encodeURIComponent(post.id); },
      onShare: (post) => { if (window.openShareModal) openShareModal({ title: post.title, sub: '@' + (post.name || '') + (post._genreName ? ' · ' + post._genreName : ''), img: '', url: 'https://droboard.app/hub/' + (post._genreId || 'fantasy') + '/' + post.id }); else toast('Share · ' + (post.title || '')); },
      onDots: (post, el) => { if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, el); else toast('More…'); },
      onStory: (post) => toast('📖 ' + ((post.story && post.story.title) || 'Story')),
      onAvatar: (post) => openAuthorAvatar(post),
      onNameClick: (post, name) => { location.href = 'profile.html?u=' + encodeURIComponent(name || (post && post.name) || ''); },
      onPinned: () => toast('Hub rules…'),
    };
  }

  function bindCommunityRowFallback(rowEl, posts) {
    rowEl.addEventListener('click', (e) => {
      const like = e.target.closest('[data-dgc-like]');
      if (like) {
        e.stopPropagation();
        const p = posts.find(x => String(x.id) === String(like.dataset.dgcLike));
        if (!p) return;
        p.liked = !p.liked; p.likes = (p.likes || 0) + (p.liked ? 1 : -1);
        const card = like.closest('[data-dgc-id]');
        if (card && window.DroboardGenreCard) { const tmp = document.createElement('div'); tmp.innerHTML = DroboardGenreCard.renderCard(p); if (tmp.firstElementChild) card.replaceWith(tmp.firstElementChild); }
        return;
      }
      const thread = e.target.closest('[data-dgc-thread]');
      if (thread) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(thread.dataset.dgcThread)); if (p) location.href = 'genre-hub.html?genre=' + encodeURIComponent(p._genreId || 'fantasy') + '&id=' + encodeURIComponent(p.id); return; }
      const share = e.target.closest('[data-dgc-share]');
      if (share) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(share.dataset.dgcShare)); if (p && window.openShareModal) openShareModal({ title: p.title, sub: '@' + (p.name || '') + (p._genreName ? ' · ' + p._genreName : ''), img: '', url: 'https://droboard.app/hub/' + (p._genreId || 'fantasy') + '/' + p.id }); return; }
      const av = e.target.closest('[data-dgc-av]');
      if (av) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(av.dataset.dgcAv)); if (p) openAuthorAvatar(p); return; }
      const nm = e.target.closest('[data-dgc-name]');
      if (nm) { e.stopPropagation(); location.href = 'profile.html?u=' + encodeURIComponent(nm.dataset.dgcName || ''); }
    });
  }

  function mountCommunityRow(rowId, secId, posts) {
    const row = document.getElementById(rowId);
    const sec = document.getElementById(secId);
    if (!row || !sec || !window.DroboardGenreCard || !posts.length) return;
    DroboardGenreCard.attach(row, genreCardHooks());
    if (window.DroboardReactionPicker) DroboardReactionPicker.attach(row, pickerHooks());
    row.innerHTML = renderCommSlides(posts);
    DroboardGenreCard.setPosts(posts);
    row.innerHTML = renderCommSlides(posts);
    sec.style.display = 'block';
  }

  function injectMidCommunity(posts) {
    const list = document.getElementById('feedList');
    if (!list || !posts || !posts.length || !window.DroboardGenreCard) return;
    if (document.getElementById('commSecMid')) return;
    const sec = document.createElement('section');
    sec.className = 'comm-sec'; sec.id = 'commSecMid';
    sec.innerHTML = `<div class="comm-sec-head"><div class="comm-sec-title"><i class="fas fa-bolt"></i> Trending in hubs</div><button type="button" class="comm-sec-link" onclick="FeedPage.goToHubs()">See all ›</button></div><div class="comm-row" id="commRowMid"></div>`;
    const kids = Array.from(list.children);
    const midIdx = kids.length ? Math.max(1, Math.floor(kids.length / 2)) : 0;
    if (kids[midIdx]) list.insertBefore(sec, kids[midIdx]); else list.appendChild(sec);
    const row = document.getElementById('commRowMid');
    DroboardGenreCard.attach(row, genreCardHooks());
    if (window.DroboardReactionPicker) DroboardReactionPicker.attach(row, pickerHooks());
    row.innerHTML = renderCommSlides(posts);
    DroboardGenreCard.setPosts(posts);
    row.innerHTML = renderCommSlides(posts);
    bindCommunityRowFallback(row, posts);
  }

  function mountCommunitySections() {
    if (!window.DroboardGenreCard) return;
    const { hot, mid, more } = collectCommunityPosts();
    COMM_POSTS_A = hot; COMM_POSTS_MID = mid; COMM_POSTS_B = more;
    mountCommunityRow('commRow1', 'commSec1', COMM_POSTS_A);
    if (COMM_POSTS_B.length) {
      const row2 = document.getElementById('commRow2');
      const sec2 = document.getElementById('commSec2');
      DroboardGenreCard.attach(row2, genreCardHooks());
      if (window.DroboardReactionPicker) DroboardReactionPicker.attach(row2, pickerHooks());
      row2.innerHTML = renderCommSlides(COMM_POSTS_B);
      DroboardGenreCard.setPosts(COMM_POSTS_B);
      row2.innerHTML = renderCommSlides(COMM_POSTS_B);
      sec2.style.display = 'block';
      bindCommunityRowFallback(row2, COMM_POSTS_B);
    }
  }

  /* ── Ads ── */
  /* Ad creatives come ONLY from the central inventory (AdService ←
     central-demo-data.js, editable in ad-manager). No local hardcodes,
     no secondary sources. Empty pool = no ads. */
  function interleaveAds(posts, pools, every) {
    pools = pools || {};
    const natives = (pools.native || []).slice(0, 3);
    const others = [];
    const poolPlatform = pools.platform || [];
    const poolBooks = pools.book || [];
    if (poolPlatform[0]) { others.push({ format: 'platform', ad: poolPlatform[0] }); others.push({ format: 'listPlatform', ad: poolPlatform[0] }); }
    if (poolBooks[0]) { others.push({ format: 'storyPromo', ad: poolBooks[0] }); others.push({ format: 'listBook', ad: poolBooks[0] }); }
    if ((pools.follow || [])[0]) others.push({ format: 'follow', ad: pools.follow[0] });
    if ((pools.banner || [])[0]) others.push({ format: 'banner', ad: pools.banner[0] });
    const rotation = [];
    let ni = 0, oi = 0;
    while (ni < natives.length || oi < others.length) {
      if (oi < others.length) rotation.push(others[oi++]);
      if (ni < natives.length) rotation.push({ format: 'native', ad: natives[ni++] });
    }
    if (!rotation.length) return posts.slice();
    const out = [];
    let adTurn = 0, adsInserted = 0;
    function nextAd(i) {
      const slot = rotation[adTurn % rotation.length];
      adTurn++; adsInserted++;
      return { id: 'sp_' + (slot.ad.id || adTurn) + '_' + i + '_' + slot.format, type: 'sponsored', adFormat: slot.format, ad: slot.ad };
    }
    const gap = (typeof every === 'number' && every > 0) ? every : 3;
    posts.forEach((post, i) => { out.push(post); if ((i + 1) % gap === 0) out.push(nextAd(i)); });
    if (posts.length > 0 && adsInserted === 0) out.push(nextAd(posts.length));
    return out;
  }

  function storyRefFor(post) {
    if (post.type === 'chapter-drop' && post.chapterRef) return { title: post.chapterRef.title, cover: post.chapterRef.cover, author: post.name };
    if ((post.type === 'review' || post.type === 'recommendation') && post.storyRef) return { title: post.storyRef.title, cover: post.storyRef.cover, author: post.storyRef.author };
    if (post.type === 'repost' && post.original) return { title: post.original.title, cover: post.original.cover, author: post.original.name };
    return null;
  }

  function renderSponsored(post) {
    if (!post || !post.ad) return '<div class="pc-ad-wrap" style="padding:14px;background:var(--l1);color:var(--tx-muted);font-size:12px">Sponsored slot (no ad data)</div>';
    if (!window.DroboardAdCard) return '<div class="pc-ad-wrap" style="padding:14px;background:var(--l1);color:var(--tx-muted);font-size:12px">Sponsored · ad-card.js missing</div>';
    let inner = '';
    try {
      const fmt = post.adFormat || '';
      if (fmt === 'listBook' || fmt === 'book') inner = DroboardAdCard.renderListBook(post.ad);
      else if (fmt === 'listPlatform') inner = DroboardAdCard.renderListPlatform(post.ad);
      else if (fmt === 'storyPromo') inner = DroboardAdCard.renderStoryPromo(post.ad);
      else if (fmt === 'platform') inner = DroboardAdCard.renderPlatform(post.ad);
      else if (fmt === 'follow') inner = DroboardAdCard.renderFollowPromo(post.ad);
      else if (fmt === 'banner') inner = DroboardAdCard.renderBanner(post.ad);
      else if (fmt === 'fullscreen') inner = DroboardAdCard.renderFullscreen(post.ad);
      else if (fmt === 'native') inner = DroboardAdCard.renderNative(post.ad);
      else if (String(post.ad.brand || post.ad.sponsor || '').toLowerCase().includes('droboard')) inner = DroboardAdCard.renderPlatform(post.ad);
      else inner = DroboardAdCard.renderNative(post.ad);
    } catch (err) { inner = '<div style="padding:14px;color:var(--acc);font-size:12px">Ad render error: ' + String(err.message || err) + '</div>'; }
    const pad = (post.adFormat === 'listBook' || post.adFormat === 'listPlatform') ? 'padding:8px 14px;background:var(--l1)' : '';
    return '<div class="pc-ad-wrap" style="' + pad + '">' + (inner || '') + '</div>';
  }

  /* ── Bind components ── */
  function bindPostCard() {
    if (!window.DroboardPostCard) return;
    DroboardPostCard.attach(document.getElementById('feedList'), {
      getReactionHTML: (post) => window.DroboardReactionPicker ? DroboardReactionPicker.renderTrigger(post.id, { liked: post.liked, likeCount: post.likes }) : undefined,
      renderSponsored: renderSponsored,
      onAvatarClick: (post) => openAuthorAvatar(post),
      onNameClick: (post) => { location.href = 'profile.html?u=' + encodeURIComponent((post && post.name) || ''); },
      onComment: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
      onOpenPost: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
      onShare: (post) => { if (!window.openShareModal) { toast('Share unavailable'); return; } openShareModal({ title: (post.chapterRef && post.chapterRef.title) || (post.storyRef && post.storyRef.title) || (post.original && post.original.title) || (post.heading) || (post.text ? post.text.slice(0, 60) : post.name + "'s post"), sub: '@' + post.name, img: post.image || (post.chapterRef && post.chapterRef.cover) || (post.storyRef && post.storyRef.cover) || (post.original && post.original.cover) || '', url: 'https://droboard.app/post/' + post.id }); },
      onSave: (post) => { const ref = storyRefFor(post); if (ref && window.openSaveModal) openSaveModal({ title: ref.title, sub: 'by @' + ref.author, img: ref.cover, storyId: post.id }); else if (window.openSaveModal) { post.saved = !post.saved; DroboardPostCard.update(post); toast(post.saved ? '🔖 Saved!' : 'Removed from saved'); } else toast('Save unavailable'); },
      onDots: (post, anchor) => { if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchor); else toast('More options…'); },
      onJoinAma: () => toast('🎙️ Joining AMA…'),
      onOpenLink: () => toast('📖 Opening story…'),
      onPollVote: (post, i) => { if (post.poll.voted >= 0) { toast('✅ Already voted!'); return; } post.poll.opts[i].v++; post.poll.voted = i; post.poll.total = (post.poll.total || 0) + 1; DroboardPostCard.update(post); toast('✅ Vote cast!'); },
      onDebateVote: (post, side) => { if (post.debateData.userVote) { toast('✅ Already voted!'); return; } post.debateData.userVote = side; if (side === 'for') post.debateData.forV = (post.debateData.forV || 0) + 1; else post.debateData.agV = (post.debateData.agV || 0) + 1; DroboardPostCard.update(post); toast(side === 'for' ? '✅ Voted FOR!' : '❌ Voted AGAINST!'); },
    });
  }

  function bindAdCard() {
    if (!window.DroboardAdCard) return;
    DroboardAdCard.attach(document.getElementById('feedList'), {
      getAds: () => FEED_POSTS.filter(p => p.type === 'sponsored').map(p => p.ad),
      onOpen: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('📖 Opening sponsored story…'); },
      onLike: (ad) => { ad.liked = !ad.liked; ad.likes += ad.liked ? 1 : -1; const card = document.querySelector(`.dac-native[data-adid="${ad.id}"]`); if (card) { const btn = card.querySelector('.dac-like'); btn.classList.toggle('dac-liked', ad.liked); btn.querySelector('i').className = (ad.liked ? 'fas' : 'far') + ' fa-heart'; btn.querySelector('.dac-like-ct').textContent = fmtN(ad.likes); } },
      onComment: () => toast('💬 Opening comments…'),
      onShare: (ad) => { if (!window.openShareModal) return; openShareModal({ title: ad.heading || ad.title || ad.brand, sub: ad.brand, img: ad.image || ad.cover || '', url: 'https://droboard.app/ad/' + ad.id }); },
      onCta: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('🔗 Opening ' + (ad.brand || ad.cta || 'link') + '…'); },
    });
  }

  /* Avatar → status viewer when the author has viewable statuses,
     else profile. Usernames always go straight to profile. */
  function openAuthorAvatar(post) {
    const name = post && post.name;
    const viewable = STORIES_CACHE.filter(s => !s.you && s.statuses && s.statuses.length);
    const hit = viewable.find(s => s.name === name);
    if (hit && window.openStatusViewer) { openStatusViewer(viewable, hit.id); return; }
    location.href = 'profile.html?u=' + encodeURIComponent(name || '');
  }

  /* Shared picker hooks (component contract): getState reads the post,
     onReact mutates it. Covers feed posts + all community rows. */
  function findReactPost(id) {
    const pools = [FEED_POSTS, COMM_POSTS_A, COMM_POSTS_B, COMM_POSTS_MID];
    for (const arr of pools) {
      const p = (arr || []).find(x => String(x.id) === String(id));
      if (p) return p;
    }
    return null;
  }
  function pickerHooks() {
    return {
      getState: (id) => {
        const p = findReactPost(id);
        const likes = (p && p.likes) || 0;
        const buckets = ['crying', 'shocked', 'emotional'];
        let h = 0;
        String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
        const second = {};
        second[buckets[h]] = Math.max(4, Math.round(likes * 0.3));
        return Object.assign({ userRx: p && p.liked ? 'love' : null, love: likes }, second);
      },
      onReact: (id) => {
        const p = findReactPost(id);
        if (!p) return;
        p.liked = !p.liked;
        p.likes = (p.likes || 0) + (p.liked ? 1 : -1);
        if (FEED_POSTS.includes(p)) { if (window.DroboardPostCard) DroboardPostCard.update(p); }
        else if (window.DroboardGenreCard) DroboardGenreCard.update(p);
      },
    };
  }
  function bindReactionPicker() {
    if (!window.DroboardReactionPicker) return;
    DroboardReactionPicker.attach(document.getElementById('feedList'), pickerHooks());
  }

  window.onDroboardSaveChange = function (storyId, saved) {
    if (!storyId) return;
    const post = FEED_POSTS.find(p => p.id === storyId);
    if (post) { post.saved = saved; if (window.DroboardPostCard) DroboardPostCard.update(post); }
  };

  /* ── Tabs ── */
  function initTabs() {
    document.querySelectorAll('.f-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.f-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        toast('📂 ' + t.textContent.trim());
      });
    });
  }

  /* ── Post Composer ── */
  function openPostComposer(type) {
    document.getElementById('postComposerOv').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (type) document.querySelectorAll('.ctype').forEach(t => t.classList.toggle('active', t.dataset.ct === type));
  }
  function closePostComposer() {
    document.getElementById('postComposerOv').classList.remove('open');
    document.body.style.overflow = '';
  }
  function initComposer() {
    document.querySelectorAll('.ctype').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ctype').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  function submitPost() {
    const text = document.getElementById('composerText').value.trim();
    if (!text) { toast('✍️ Write something first!'); return; }
    const av = (window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5';
    const newPost = { id: 'p_' + Date.now(), type: 'post', name: 'You', avatar: av, time: 'Just now', text, likes: 0, liked: false, comments: 0 };
    FEED_POSTS.unshift(newPost);
    closePostComposer();
    document.getElementById('composerText').value = '';
    if (window.DroboardPostCard) DroboardPostCard.setPosts(FEED_POSTS);
    document.getElementById('emptyState').style.display = 'none';
    toast('✅ Post published!');
  }

  /* ── Menu ── */
  function configureMenu() {
    if (!window.DroboardMenu) return;
    const user = { name: 'You', handle: 'you', avatar: (window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5' };
    DroboardMenu.configure({
      title: 'Feed', subtitle: 'Filters & options', user, footer: 'Droboard',
      sections: [
        { label: 'Create', items: [{ id: 'new-post', icon: 'fa-pen', label: 'New Post', sub: 'Share an update with readers' }] },
        { label: 'Sort feed', items: [
          { id: 'latest', icon: 'fa-clock', label: 'Latest', sub: 'Newest first', active: FEED_SORT === 'latest' },
          { id: 'popular', icon: 'fa-fire', label: 'Popular', sub: 'Most engaged', active: FEED_SORT === 'popular' },
          { id: 'trending', icon: 'fa-arrow-trend-up', label: 'Trending', sub: 'Rising now', active: FEED_SORT === 'trending' },
          { id: 'following', icon: 'fa-user-group', label: 'Following', sub: 'People you follow', active: FEED_SORT === 'following' },
        ]},
        { label: 'Quick links', items: [
          { id: 'circles', icon: 'fa-circle-nodes', label: 'My Circles', href: '#' },
          { id: 'saved', icon: 'fa-bookmark', label: 'Saved', href: 'library.html' },
          { id: 'profile', icon: 'fa-user', label: 'My Profile', href: 'profile.html' },
        ]},
      ],
      onSelect: (item) => {
        if (item.id === 'new-post') { openPostComposer('text'); return; }
        if (['latest', 'popular', 'trending', 'following'].includes(item.id)) {
          FEED_SORT = item.id;
          if (window.DroboardMenu) DroboardMenu.setActive(item.id);
          toast('Sorted by ' + item.label);
        }
      },
    });
    document.getElementById('menuBtn').addEventListener('click', () => DroboardMenu.open());
  }

  /* ── Notifications ── */
  async function loadNotifCount() {
    if (!window.FeedData || !FeedData.getNotifCount) return;
    const count = await FeedData.getNotifCount();
    const badge = document.getElementById('notifCount');
    if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }

  /* ── Boot ── */
  async function init() {
    initTheme();
    if (window.DroboardNav) DroboardNav.configure({ active: 'feed' });
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onEdit: (post) => toast('✏️ Edit · ' + (post.name || '')),
        onDelete: (post) => { const i = FEED_POSTS.findIndex(p => p.id === post.id); if (i >= 0) { FEED_POSTS.splice(i, 1); DroboardPostCard.setPosts(FEED_POSTS); toast('🗑️ Post deleted'); } },
        onReport: () => toast('🚩 Reported. Thanks for flagging.'),
        onLess: () => toast('Got it — showing less of this.'),
        onFollow: (post) => toast('Following @' + (post.name || 'user')),
        onMute: (post) => toast('Muted @' + (post.name || 'user')),
        onCopyLink: (post) => { const url = 'https://droboard.app/post/' + post.id; if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied')).catch(() => toast('🔗 ' + url)); else toast('🔗 ' + url); },
      });
    }
    bindStories();
    initTabs();
    initComposer();
    configureMenu();
    await mountPromo();
    loadNotifCount();
    try {
      if (!window.FeedData) throw new Error('FeedData is not defined — check feed-data script path');
      const [stories, posts] = await Promise.all([FeedData.getStories(), FeedData.getFeedPosts()]);
      let adPools = {}, adGap = 3;
      if (window.AdService) {
        try {
          const placement = await AdService.getPlacement('feed');
          if (placement.interval) adGap = placement.interval;
          adPools = await AdService.getAds({ page: 'feed' });
        } catch (e) {}
      }
      document.getElementById('loadingState').style.display = 'none';
      STORIES_CACHE = stories;
      FEED_POSTS = interleaveAds(posts, adPools, adGap);
      renderStories(STORIES_CACHE);
      mountCommunitySections();
      if (!FEED_POSTS.length) {
        document.getElementById('emptyState').style.display = 'block';
        injectMidCommunity(COMM_POSTS_MID);
      } else if (!window.DroboardPostCard) {
        throw new Error('DroboardPostCard is not defined — check component/post-card.js');
      } else {
        bindPostCard();
        bindReactionPicker();
        bindAdCard();
        DroboardPostCard.setPosts(FEED_POSTS);
        FEED_POSTS.filter(p => p.type === 'sponsored' && p.ad && p.ad.id).forEach(p => trackAd(p.ad.id, 'impression'));
        injectMidCommunity(COMM_POSTS_MID);
      }
    } catch (err) {
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
      document.getElementById('emptyTitle').textContent = 'Feed failed to load';
      document.getElementById('emptySub').textContent = err.message || 'Something went wrong loading the feed.';
      console.error('[feed] init() failed:', err);
    }
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
  }

  function goToHubs() { location.href = 'genre-hub.html'; }

  window.FeedPage = { init, toast, toggleTheme, openPostComposer, closePostComposer, submitPost, goToHubs };
})();
