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
  const THEME_KEY = 'droboardTheme';
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
  function buildRingStyle(s){
    const n = s.statuses ? s.statuses.length : 0;
    if(s.you || n <= 1) return '';
    const gap = 4; // degrees gap between segments
    const segAngle = 360 / n;
    const seg = segAngle - gap;
    const isViewed = s.ring === 'ring-viewed';
    const segColor = isViewed ? '#9ca3af' : '#ff0050';
    const gapColor = 'var(--bg)';
    let stops = [];
    for(let i=0;i<n;i++){
      const start = i * segAngle;
      const segEnd = start + seg;
      const gapEnd = start + segAngle;
      const viewedSeg = s.statuses[i] && s.statuses[i].viewed;
      const c = (viewedSeg || isViewed) ? '#9ca3af' : segColor;
      stops.push(`${c} ${start}deg ${segEnd}deg`);
      stops.push(`${gapColor} ${segEnd}deg ${gapEnd}deg`);
    }
    return `background: conic-gradient(from 0deg, ${stops.join(', ')});`;
  }
  function renderStories(stories) {
    document.getElementById('storiesRow').innerHTML = stories.map(s => {
      const n = s.statuses ? s.statuses.length : 0;
      const isMulti = !s.you && n > 1;
      const ringClass = s.you ? 'own' : (isMulti ? (s.ring || 'ring-has') + ' ring-multi' : (s.ring || ''));
      const style = isMulti ? ` style="${buildRingStyle(s)}"` : '';
      return `
      <div class="story-item" data-story-id="${s.id}" data-you="${!!s.you}">
        <div class="story-ring ${ringClass}"${style}><div class="inner">
          ${s.you ? `<div class="story-add">+</div>` : `<img class="story-avatar" src="${s.avatar}" alt="${escAttr(s.name)}">`}
        </div></div>
        <div class="story-name">${s.name}</div>
      </div>`;
    }).join('');
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
      if(s && s.statuses && s.statuses.length > 1){
        item.setAttribute('style', buildRingStyle(s));
      } else {
        item.removeAttribute('style');
      }
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
      onShare: (post) => { if (!window.openShareModal) { toast('Share unavailable'); return; } openShareModal({ title: (post.chapterRef && post.chapterRef.title) || (post.storyRef && post.storyRef.title) || (post.original && post.original.title) || (post.heading) || (post.amaData && post.amaData.title) || (post.text ? post.text.slice(0, 60) : post.name + "'s post"), sub: '@' + post.name, img: post.image || (post.chapterRef && post.chapterRef.cover) || (post.storyRef && post.storyRef.cover) || (post.original && post.original.cover) || post.avatar || '', url: 'https://droboard.app/post/' + post.id }); },
      onSave: (post) => {
        if(post.type === 'ama'){
          if(window.openSaveModal) openSaveModal({ title: (post.amaData && post.amaData.title) || 'AMA', sub: (post.amaData && post.amaData.meta) || '@' + post.name, img: post.avatar || '', storyId: post.id });
          else { post.saved = !post.saved; DroboardPostCard.update(post); toast(post.saved ? '🔖 Saved AMA!' : 'Removed AMA'); }
          return;
        }
        const ref = storyRefFor(post);
        if (ref && window.openSaveModal) openSaveModal({ title: ref.title, sub: 'by @' + ref.author, img: ref.cover, storyId: post.id });
        else if (window.openSaveModal) { post.saved = !post.saved; DroboardPostCard.update(post); toast(post.saved ? '🔖 Saved!' : 'Removed from saved'); }
        else toast('Save unavailable');
      },
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

  /* ── Post Composer (reusable component) ── */
  function pushPost(post, isEdit){
    if(isEdit){
      const idx=FEED_POSTS.findIndex(p=> String(p.id)===String(post.id));
      if(idx>-1){ FEED_POSTS[idx]=post; if(window.DroboardPostCard) DroboardPostCard.update(post); }
      else { FEED_POSTS.unshift(post); if(window.DroboardPostCard) DroboardPostCard.setPosts(FEED_POSTS); }
    } else {
      FEED_POSTS.unshift(post);
      if (window.DroboardPostCard) DroboardPostCard.setPosts(FEED_POSTS);
    }
    const empty=document.getElementById('emptyState');
    if(empty) empty.style.display = 'none';
  }
  function openPostComposer(type) {
    if(window.DroboardPostComposer){
      DroboardPostComposer.open(type||'text');
      return;
    }
    const el=document.getElementById('postComposerOv');
    if(el){ el.classList.add('open'); document.body.style.overflow = 'hidden'; }
    if (type) document.querySelectorAll('.ctype').forEach(t => t.classList.toggle('active', t.dataset.ct === type));
  }
  function closePostComposer() {
    if(window.DroboardPostComposer){ DroboardPostComposer.close(); return; }
    const el=document.getElementById('postComposerOv');
    if(el) el.classList.remove('open');
    document.body.style.overflow = '';
  }
  function initComposer() {
    if(window.DroboardPostComposer){
      DroboardPostComposer.attach(null, {
        getUser: ()=> ({ name:'You', avatar:(window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5' }),
        onSubmit: (post, isEdit)=>{
          pushPost(post, isEdit);
          if(isEdit) toast('✅ Post updated!');
          else {
            const label={text:'Post', poll:'Poll', debate:'Debate', ama:'AMA', quote:'Quote'}[post.type]||'Post';
            toast(post.type==='ama' ? '🎙️ AMA posted!' : `✅ ${label} published!`);
          }
        }
      });
      return;
    }
    document.querySelectorAll('.ctype').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ctype').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
  function submitPost() {
    if(window.DroboardPostComposer){
      // handled inside component
      return;
    }
    const text = document.getElementById('composerText').value.trim();
    if (!text) { toast('✍️ Write something first!'); return; }
    const av = (window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5';
    const activeCt = document.querySelector('.composer-tools .ctype.active');
    const ct = activeCt ? activeCt.dataset.ct : 'text';
    let newPost;
    if(ct === 'ama'){
      newPost = { id: 'p_' + Date.now(), type: 'ama', name: 'You', avatar: av, time: 'Just now', amaData: { isLive: true, viewers: Math.floor(Math.random()*200+20), title: text.slice(0,60) || 'Ask Me Anything', meta: text.slice(0,120) }, likes: 0, liked: false, comments: 0 };
    } else if(ct === 'poll'){
      newPost = { id: 'p_' + Date.now(), type: 'poll', name: 'You', avatar: av, time: 'Just now', poll: { question: text, opts: [{label:'Yes', v:0},{label:'No', v:0}], total:0, voted:-1 }, likes:0, liked:false, comments:0 };
    } else if(ct === 'debate'){
      newPost = { id: 'p_' + Date.now(), type: 'debate', name: 'You', avatar: av, time: 'Just now', debateData: { question: text, prompt:'Share your thoughts', forText:'For', againstText:'Against', forV:0, agV:0, userVote:null }, likes:0, liked:false, comments:0 };
    } else if(ct === 'image'){
      newPost = { id: 'p_' + Date.now(), type: 'post', name: 'You', avatar: av, time: 'Just now', text, image: 'https://picsum.photos/seed/'+Date.now()+'/900/500', likes: 0, liked: false, comments: 0 };
    } else {
      newPost = { id: 'p_' + Date.now(), type: 'post', name: 'You', avatar: av, time: 'Just now', text, likes: 0, liked: false, comments: 0 };
    }
    pushPost(newPost);
    closePostComposer();
    const el=document.getElementById('composerText'); if(el) el.value='';
    toast(ct === 'ama' ? '🎙️ AMA posted!' : '✅ Post published!');
  }

  /* ── Menu — My Circle accordion ── */
  function getMyBoards(){
    const FALLBACK_ALL = [
      {id:'fantasy',name:'Fantasy',icon:'fa-hat-wizard',members:'45.7K',tagline:'Where imagination becomes legend.'},
      {id:'romance',name:'Romance',icon:'fa-heart',members:'92.1K',tagline:'Hearts, heat, and happy endings.'},
      {id:'werewolf',name:'Werewolf',icon:'fa-moon',members:'31.2K',tagline:'Packs, mates, and moonlit chaos.'},
      {id:'mafia',name:'Mafia',icon:'fa-gun',members:'18.4K',tagline:'Power, loyalty and betrayal.'},
      {id:'campus',name:'Campus',icon:'fa-graduation-cap',members:'22.1K',tagline:'Youth, drama and first loves.'},
      {id:'revenge',name:'Revenge',icon:'fa-fire',members:'15.3K',tagline:'Payback is a story.'},
      {id:'drama',name:'Drama',icon:'fa-masks-theater',members:'28.9K',tagline:'Everyday chaos and twists.'},
      {id:'billionaire',name:'Billionaire',icon:'fa-briefcase',members:'34.5K',tagline:'Wealth, power, love.'},
      {id:'mystery',name:'Mystery',icon:'fa-magnifying-glass',members:'19.7K',tagline:'Clues, secrets, whodunit.'},
      {id:'horror',name:'Horror',icon:'fa-ghost',members:'12.8K',tagline:'Fear lives here.'},
      {id:'adventure',name:'Adventure',icon:'fa-compass',members:'16.2K',tagline:'Journeys beyond.'},
      {id:'scifi',name:'Sci-Fi',icon:'fa-rocket',members:'21.4K',tagline:'Future and beyond.'},
    ];
    try{
      const seed = window.GenreDemoSeed;
      if(seed && seed.DEMO_GENRES){
        const seedAll = Object.values(seed.DEMO_GENRES);
        const allMap={}; FALLBACK_ALL.forEach(g=> allMap[g.id]=g); seedAll.forEach(g=> allMap[g.id]=Object.assign({}, allMap[g.id]||{}, g));
        const all = Object.values(allMap);
        const joinedIds = ['fantasy','romance','werewolf'];
        const joined = all.filter(g=> joinedIds.includes(g.id)).slice(0,5);
        const rest = all.filter(g=> !joinedIds.includes(g.id));
        return { joined, rest, all };
      }
    }catch(e){}
    const joinedIds2=['fantasy','romance','werewolf'];
    return { joined:FALLBACK_ALL.filter(g=>joinedIds2.includes(g.id)), rest:FALLBACK_ALL.filter(g=>!joinedIds2.includes(g.id)), all:FALLBACK_ALL };
  }
  function getMyCollections(){
    const FALLBACK_COLLS=[
      {id:'coll_1', name:'Midnight Reads', count:12, cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg'},
      {id:'coll_2', name:'Tear-jerkers', count:8, cover:'https://i.postimg.cc/N9jY0w4m/5.jpg'},
      {id:'coll_3', name:'Weekend Binge', count:15, cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg'},
      {id:'coll_4', name:'Dark Romance Essentials', count:32, cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg'},
      {id:'coll_5', name:'Heartfelt Romance', count:24, cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg'},
      {id:'coll_6', name:'Best of 2025', count:18, cover:'https://i.postimg.cc/xqmHfyNR/wolf2.jpg'},
      {id:'coll_7', name:'Family Secrets', count:15, cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg'},
      {id:'coll_8', name:'Crowned in Sin', count:22, cover:'https://i.postimg.cc/0MyxNqfz/7.jpg'},
      {id:'coll_9', name:'Fangs & Fortune', count:19, cover:'https://i.postimg.cc/cgLZJNmC/8.jpg'},
      {id:'coll_10', name:'The Billionaire Never Forgets', count:27, cover:'https://i.postimg.cc/DJwFzKgd/4.jpg'},
    ];
    try{
      const d=window.DemoData;
      if(d && (d.COLLECTIONS||d.COLLECTIONS_DATA)){
        const allRaw=d.COLLECTIONS||d.COLLECTIONS_DATA;
        const all=allRaw.map((c,i)=> ({id:c.id||'coll_'+i, name:c.name||c.title||'Collection', count:c.count||c.stories||0, cover:(c.covers&&c.covers[0])||c.cover||FALLBACK_COLLS[i%FALLBACK_COLLS.length].cover}));
        const joinedIds=['coll_1','coll_2','coll_3'];
        const joined=all.filter(c=> joinedIds.includes(c.id)).slice(0,5);
        const rest=all.filter(c=> !joinedIds.includes(c.id));
        const finalJoined=joined.length?joined:FALLBACK_COLLS.slice(0,3);
        const finalRest=rest.length?rest:FALLBACK_COLLS.slice(3);
        return { joined:finalJoined, rest:finalRest, all: all.length?all:FALLBACK_COLLS };
      }
    }catch(e){}
    return { joined:FALLBACK_COLLS.slice(0,3), rest:FALLBACK_COLLS.slice(3), all:FALLBACK_COLLS };
  }
  function openBoardsExplorer(){
    const data=getMyBoards();
    if(window.BoardsOverlay){ BoardsOverlay.open(data); return; }
    let ov=document.getElementById('boardsExplorerOv');
    if(!ov){
      ov=document.createElement('div');
      ov.id='boardsExplorerOv';
      ov.style.cssText='position:fixed;inset:0;z-index:4000;background:var(--bg,#fff);display:none;flex-direction:column;max-width:420px;margin:0 auto;left:50%;transform:translateX(-50%);box-shadow:0 0 50px rgba(0,0,0,.1)';
      ov.innerHTML=`
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border,#f1f1f1);background:var(--bg,#fff)">
          <button id="boardsExBack" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border,#f1f1f1);background:var(--l1,#f8f9fa);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="fas fa-arrow-left"></i></button>
          <div style="font-weight:800;font-size:16px">My Boards</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px" id="boardsExScroll"></div>
      `;
      document.body.appendChild(ov);
      ov.querySelector('#boardsExBack').addEventListener('click', ()=>{ ov.style.display='none'; document.body.style.overflow=''; });
      ov.addEventListener('click', e=>{ if(e.target===ov){ ov.style.display='none'; document.body.style.overflow=''; } });
    }
    const scrollEl=ov.querySelector('#boardsExScroll');
    const joined=data.joined;
    const rest=data.rest && data.rest.length? data.rest : (data.all && data.all.length? data.all.filter(g=>!joined.some(j=>j.id===g.id)) : []);
    const allBoards = [
      ...joined.map(g=> ({...g, _section:'joined'})),
      ...rest.slice(0,12).map(g=> ({...g, _section:'explore'}))
    ];
    // interleave ads every 6 boards
    const adHtml = (i)=> `<div style="border:1px solid var(--border,#f1f1f1);border-radius:12px;padding:12px;margin-bottom:8px;background:linear-gradient(135deg,rgba(255,0,80,.06),rgba(167,139,250,.04));display:flex;gap:10px;align-items:center"><div style="width:48px;height:48px;border-radius:8px;background:var(--acc,#ff0050);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0"><i class="fas fa-bullhorn"></i></div><div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;color:var(--acc,#ff0050);text-transform:uppercase">Sponsored</div><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Discover Premium Boards</div><div style="font-size:11px;color:var(--tx-muted,#6b7280)">Unlock exclusive hubs & features</div></div><button onclick="location.href='store.html'" style="background:var(--acc,#ff0050);color:#fff;border:none;padding:7px 12px;border-radius:8px;font-size:11px;font-weight:700;flex-shrink:0">View</button></div>`;
    let html = `<div style="font-size:11px;font-weight:800;color:var(--tx-muted,#6b7280);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Joined hubs</div>`;
    let count=0;
    joined.forEach(g=>{
      html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border,#f1f1f1);border-radius:10px;margin-bottom:8px;text-decoration:none;color:inherit"><div style="width:36px;height:36px;border-radius:8px;background:var(--l1,#f8f9fa);display:flex;align-items:center;justify-content:center;color:var(--acc,#ff0050)"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div style="flex:1"><div style="font-weight:700;font-size:13px">${g.name}</div><div style="font-size:11px;color:var(--tx-muted,#6b7280)">${g.members||'1.2K'} members</div></div><i class="fas fa-chevron-right" style="font-size:11px;color:var(--tx-muted,#6b7280)"></i></a>`;
      count++; if(count%6===0) html+=adHtml(count);
    });
    if(!joined.length) html+= '<div style="font-size:12px;color:var(--tx-muted)">No hubs joined yet</div>';
    html += `<div style="font-size:11px;font-weight:800;color:var(--tx-muted,#6b7280);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">Explore more hubs</div>`;
    rest.slice(0,12).forEach((g, idx)=>{
      html += `<a href="genre-hub.html?genre=${encodeURIComponent(g.id)}" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border,#f1f1f1);border-radius:10px;margin-bottom:8px;text-decoration:none;color:inherit"><div style="width:36px;height:36px;border-radius:8px;background:var(--l1,#f8f9fa);display:flex;align-items:center;justify-content:center;color:var(--tx-muted,#6b7280)"><i class="fas ${g.icon||'fa-hashtag'}"></i></div><div style="flex:1"><div style="font-weight:700;font-size:13px">${g.name}</div><div style="font-size:11px;color:var(--tx-muted,#6b7280)">${g.tagline||''}</div></div><span style="font-size:11px;font-weight:700;color:var(--acc,#ff0050)">Join</span></a>`;
      count++; if(count%6===0) html+=adHtml(count);
    });
    if(!rest.length) html+= '<div style="font-size:12px;color:var(--tx-muted)">No more hubs</div>';
    scrollEl.innerHTML = html;
    ov.style.display='flex';
    document.body.style.overflow='hidden';
  }
  function configureMenu() {
    if (!window.DroboardMenu) return;
    const user = { name: 'You', handle: 'you', avatar: (window.FeedData && FeedData.YOU_AV) || 'https://i.pravatar.cc/150?img=5' };
    const boards = getMyBoards();
    const collData = getMyCollections();
    const myCirclesChildren = [
      { isHeader:true, label:'My Boards' },
      ...boards.joined.slice(0,2).map(g=> ({ id:'board-'+g.id, label:g.name, icon:g.icon||'fa-hashtag', sub:(g.members||'1.2K')+' members', href:'genre-hub.html?genre='+encodeURIComponent(g.id) })),
      { id:'boards-viewall', label:'View all boards', isViewAll:true },
      { isHeader:true, label:'My Collections' },
      ...collData.joined.slice(0,2).map(c=> ({ id:'coll-'+c.id, label:c.name||c.title||'Collection', icon:'fa-folder', sub:(c.count||c.stories||0)+' stories', href:'collection.html?id='+encodeURIComponent(c.id) })),
      { id:'collections-viewall', label:'View all collections', isViewAll:true }
    ];
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
          { id:'circles', icon:'fa-circle-nodes', label:'My Circles', sub: boards.joined.length+' boards · '+collData.joined.length+' collections', children: myCirclesChildren },
          { id: 'saved', icon: 'fa-bookmark', label: 'Saved', href: 'library.html' },
          { id: 'profile', icon: 'fa-user', label: 'My Profile', href: 'profile.html' },
        ]},
      ],
      onSelect: (item) => {
        if (item.id === 'new-post') { openPostComposer('text'); return; }
        if (item.id === 'boards-viewall') {
          DroboardMenu.close();
          setTimeout(()=> openBoardsExplorer(), 250);
          return;
        }
        if (item.id === 'collections-viewall') {
          DroboardMenu.close();
          setTimeout(()=> { if(window.BrowseOverlay) BrowseOverlay.open({title:'My Collections', mode:'collections'}); else toast('Opening collections…'); }, 250);
          return;
        }
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
        onEdit: (post) => {
          if(window.DroboardPostComposer) DroboardPostComposer.open({editPost: post});
          else toast('✏️ Edit · ' + (post.name || ''));
        },
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
