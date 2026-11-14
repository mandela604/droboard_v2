/* ═══════════════════════════════════════════════════════════════
   FEED SERVICE
   Feed page orchestration. HTML calls FeedPage.init().
   Stories + posts: GET /api/feed/home (FeedData). "Trending in hubs"
   rows: GET /api/discussions/feed (FeedData). Writes go through
   /api/posts. No demo fallback — any failure surfaces the API error
   in the feed's error empty-state.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let STORIES_CACHE = [];
  let FEED_POSTS = [];
  let FEED_SORT = 'latest';
  let COMM_POSTS_A = [];
  let COMM_POSTS_B = [];
  let COMM_POSTS_MID = [];
  let BASE_POSTS = []; // organic posts, original order (sort source of truth)
  let AD_POOLS = {}, AD_GAP = 3;

  /* ── Live transport ─────────────────────────────────────────────────── */
  const API_BASE = '/api';
  async function api(method, path, body) {
    const res = await fetch(API_BASE + path, {
      method: method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error((json && (json.error || json.message)) || ('Request failed (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return json;
  }

  /* ── Following (live: the reader's own follow edges) ──────────────── */
  let FOLLOWING = new Set();          // lowercased usernames
  function isFollowing(name) { return FOLLOWING.has(String(name || '').toLowerCase()); }
  async function loadFollowing() {
    FOLLOWING = new Set();
    try { if (window.AuthSession && AuthSession.ensureAccount) await AuthSession.ensureAccount(); } catch (e) {}
    const me = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || null;
    const handle = me && me.handle ? String(me.handle).replace(/^@/, '') : '';
    if (!handle) return;
    try {
      const r = await api('GET', '/users/' + encodeURIComponent(handle) + '/following?limit=50');
      (r.items || []).forEach(u => FOLLOWING.add(String(u.name || '').toLowerCase()));
    } catch (e) { /* no follow edges yet, or the reader is a guest */ }
  }
  async function setFollowing(name, on) {
    const handle = String(name || '').replace(/^@/, '');
    if (!handle) throw new Error('That account has no handle');
    await api(on ? 'POST' : 'DELETE', '/users/' + encodeURIComponent(handle) + '/follow');
    if (on) FOLLOWING.add(handle.toLowerCase());
    else FOLLOWING.delete(handle.toLowerCase());
  }

  /* ── Pins ───────────────────────────────────────────────────────────
     The server owns `pinned` (Post.pinned) and already returns the feed
     pinned-first, so nothing is stamped from local storage here. Only the
     menu entry is decided client-side: pinning is a staff action. */
  function canPin() {
    try { return !!(window.AuthSession && AuthSession.hasRole && AuthSession.hasRole('admin')); }
    catch (e) { return false; }
  }
  function stampFeedPins(posts) {
    (posts || []).forEach(p => {
      if (!p || p.type === 'sponsored') return;
      p.pinnable = canPin();
      p.following = isFollowing(p.name);
    });
  }

  /* ── Hamburger sort/filter — actually re-orders the rendered feed ── */
  function applySort(scroll) {
    /* deadlines are enforced at render time — idempotent, so a poll that
       expired while the tab sat open closes itself and notifies once */
    if (window.DroboardExpiry) DroboardExpiry.sweep(BASE_POSTS, { isMine: p => p.name === 'You' });
    let organic = BASE_POSTS.slice();
    if (FEED_SORT === 'popular') {
      organic.sort((a, b) => (((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))));
    } else if (FEED_SORT === 'trending') {
      organic.sort((a, b) => ((b.comments || 0) - (a.comments || 0)) || ((b.likes || 0) - (a.likes || 0)));
    } else if (FEED_SORT === 'following') {
      const keep = organic.filter(p => p.type !== 'sponsored' && isFollowing(p.name));
      if (!keep.length) toast('You are not following anyone yet — showing everything');
      else organic = keep;
    } else if (FEED_SORT === 'debates') {
      organic = organic.filter(p => p.type === 'debate');
    }
    // Pinned posts always lead, whatever the sort is.
    const pinned = organic.filter(p => p.pinned);
    if (pinned.length) organic = pinned.concat(organic.filter(p => !p.pinned));
    FEED_POSTS = interleaveAds(organic, AD_POOLS, AD_GAP);
    if (window.DroboardPostCard) DroboardPostCard.setPosts(FEED_POSTS);
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = FEED_POSTS.length ? 'none' : 'block';
    if (scroll !== false) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }
  }

  function fmtN(n) { if (typeof n === 'string') return n; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function escAttr(s) { return String(s || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

  function trackAd(id, ev, ctx) { try { if (id && window.AdService) AdService.track(id, ev, ctx || { page: 'feed', slot: 'feed:in-feed' }); } catch (e) {} }
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
  function renderStories(stories) {
    try {
      if (window.DroboardStatus && DroboardStatus.registerStories) {
        stories = DroboardStatus.registerStories(stories);
      }
    } catch (e) {}
    document.getElementById('storiesRow').innerHTML = stories.map(s => {
      const n = s.statuses ? s.statuses.length : 0;
      const ringKey = s.you ? 'you' : (s.name || s.handle || s.id);
      const avatarHtml = s.avatar
        ? `<img class="story-avatar" src="${escAttr(s.avatar)}" alt="${escAttr(s.name)}">`
        : `<div class="story-avatar" style="display:flex;align-items:center;justify-content:center;background:rgba(255,0,80,.25);color:#fff;font-weight:800">${escAttr((s.name || '?').charAt(0).toUpperCase())}</div>`;
      const innerHtml = s.you
        ? (n ? avatarHtml : `<div class="story-add">+</div>`)
        : avatarHtml;
      return `
      <div class="story-item" data-story-id="${s.id}" data-you="${!!s.you}">
        ${DroboardStatusRing.html(s, { size: 62, key: ringKey, own: !!s.you && !n, isMine: !!s.you, innerHtml })}
        ${s.you ? `<div class="story-post-plus" data-act="post-status" title="Post a status">+</div>` : ``}
        <div class="story-name">${s.name}</div>
      </div>`;
    }).join('');
  }
  function bindStories() {
    document.getElementById('storiesRow').addEventListener('click', (e) => {
      const postBtn = e.target.closest('[data-act="post-status"]');
      if (postBtn) { openPostComposer('status'); return; }
      const item = e.target.closest('.story-item');
      if (!item) return;
      if (item.dataset.you === 'true') {
        const mine = (STORIES_CACHE || []).find(s => s.you) || ((window.DroboardStatus && window.DroboardStatus.myEntry()) || null);
        if (mine && mine.statuses && mine.statuses.length) {
          DroboardStatusRing.open([mine], mine.id || 'you', { onMissing: () => toast('Status viewer unavailable') });
          return;
        }
        openPostComposer('status');
        return;
      }
      const viewable = STORIES_CACHE.filter(s => !s.you && s.statuses && s.statuses.length);
      if (!viewable.length) { toast('No statuses available'); return; }
      DroboardStatusRing.open(viewable, item.dataset.storyId, { onMissing: () => toast('Status viewer unavailable') });
    });
  }
  window.onStatusViewerChange = function (wid, ring, name) {
    // The viewer keys on the author's name, so match id OR name.
    const emitKey = String(name || wid || '').replace(/^@/, '').toLowerCase().replace(/[\s\-]+/g, '_');
    const s = STORIES_CACHE.find(x => x.id === wid || String(x.name || x.handle || '').replace(/^@/, '').toLowerCase().replace(/[\s\-]+/g, '_') === emitKey);
    if (s) s.ring = ring;
    const domKey = (s && (s.name || s.id)) || wid;
    const item = document.querySelector(`.story-item[data-story-id="${domKey}"] .dring`)
      || document.querySelector(`.story-item[data-story-id="${wid}"] .dring`);
    if (item) {
      item.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
      if (ring) item.classList.add(ring);
    }
    // Feed post cards by the same person ask the shared ring themselves
    // (DroboardStatusRing reads StatusStore per author), so nothing to push here.
  };
  /* An avatar tapped on a post card plays that author inside the stories row,
     so the viewer still pages between people instead of stopping at one. */
  (function bindAvatarTapGroup() {
    const prev = window.onStatusAvatarTap;
    window.onStatusAvatarTap = function (entry, key) {
      if (typeof prev === 'function') {
        try { if (prev(entry, key) === true) return true; } catch (e) {}
      }
      const who = String(key || entry && entry.name || '').replace(/^@/, '').toLowerCase().replace(/[\s\-]+/g, '_');
      const viewable = (STORIES_CACHE || []).filter(s => !s.you && s.statuses && s.statuses.length);
      const hit = viewable.find(s => String(s.name || s.handle || '').replace(/^@/, '').toLowerCase().replace(/[\s\-]+/g, '_') === who);
      if (!hit) return false;
      DroboardStatusRing.open(viewable, hit.id);
      return true;
    };
  })();

  /* ── Promo (ad-marketing module: AdService promo pool, page 'feed') ── */
  async function mountPromo() {
    if (!window.DroboardPromoSlider || !window.AdService) return;
    let slides = [];
    try { slides = await AdService.getPromoSlides({ page: 'feed' }); }
    catch (e) { slides = []; }
    if (!slides.length) return;
    DroboardPromoSlider.mount('#promoMount', {
      slides, interval: 3200,
      // No onSelect: the component default navigates slide/CTA → bridge.
    });
  }

  /* ── Community ── */
  function bucketCommunity(all) {
    const byHot = all.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
    const n = byHot.length;
    if (n >= 9) return { hot: byHot.slice(0, 4), mid: byHot.slice(4, 8), more: byHot.slice(8, 12) };
    if (n >= 6) return { hot: byHot.slice(0, 3), mid: byHot.slice(3, 6), more: byHot.slice(0, 3).reverse() };
    return { hot: byHot.slice(), mid: byHot.slice().reverse(), more: byHot.slice() };
  }

  // Live only — FeedData.getCommunityPosts → GET /discussions/feed. Any
  // failure throws so init() paints the feed's error empty-state with the
  // real message; seed rows never substitute for a failed call.
  async function collectCommunityPosts() {
    if (!window.FeedData || !FeedData.getCommunityPosts) throw new Error('FeedData is not defined — check feed-data script path');
    const live = (await FeedData.getCommunityPosts()) || [];
    const all = live.map(p => {
      const { media, story, trope, participants, extra, ...rest } = p;
      return Object.assign({}, rest, {
        id: String(rest.id),
        time: (rest.time || '') + (rest._genreName ? ' · ' + rest._genreName : ''),
      });
    });
    return bucketCommunity(all);
  }

  function renderCommSlides(posts) {
    if (!window.DroboardGenreCard) return '';
    DroboardGenreCard.setGenreName('');
    return posts.map(p => `<div class="comm-slide">${DroboardGenreCard.renderCard(p)}</div>`).join('');
  }

  function openStoryGuarded(ref) {
    const sid = ref && (ref.id || '');
    const ttl = (ref && (ref.title || '')) || 'Story';
    if (sid && window.ReadingHistory && !ReadingHistory.guardRecommend(sid, ttl)) return;
    if (sid) { location.href = 'bridge.html?id=' + encodeURIComponent(sid); return; }
    toast('📖 ' + ttl);
  }
  function openHubDiscussion(post) {
    if (!post) return;
    location.href = 'discussion.html?genre=' + encodeURIComponent(post._genreId || 'fantasy') + '&id=' + encodeURIComponent(post.id);
  }
  function shareHubPost(post) {
    if (!post) return;
    if (window.openShareModal) {
      openShareModal({
        title: post.title || 'Hub post',
        sub: '@' + (post.name || '') + (post._genreName ? ' · ' + post._genreName : ''),
        img: (post.story && post.story.cover) || post.avatar || '',
        url: 'https://droboard.app/hub/' + (post._genreId || 'fantasy') + '/' + post.id,
        contentId: post.id,
        contentType: 'posts',
      });
    } else toast('Share · ' + (post.title || ''));
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
      /* Title / "… See more" and the comments button all open the full
         discussion page (same as the hub pages). */
      onThread: (post) => openHubDiscussion(post),
      onComment: (post) => openHubDiscussion(post),
      onShare: (post) => shareHubPost(post),
      onDots: (post, el) => { try { window._lastDotsAnchor = el || null; } catch(e){} if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, el); else toast('More…'); },
      onStory: (post) => openStoryGuarded(post && (post.story || post.storyRef)),
      onAvatar: (post) => openAuthorAvatar(post),
      onGenre: (post, genreId) => { location.href = 'genre-hub.html?genre=' + encodeURIComponent(genreId || (post && post._genreId) || 'fantasy'); },
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
      const comment = e.target.closest('[data-dgc-comment]');
      if (comment) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(comment.dataset.dgcComment)); if (p) openHubDiscussion(p); return; }
      const thread = e.target.closest('[data-dgc-thread]');
      if (thread) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(thread.dataset.dgcThread)); if (p) openHubDiscussion(p); return; }
      const share = e.target.closest('[data-dgc-share]');
      if (share) { e.stopPropagation(); const p = posts.find(x => String(x.id) === String(share.dataset.dgcShare)); if (p) shareHubPost(p); return; }
      const gen = e.target.closest('[data-dgc-genre]');
      if (gen) { e.stopPropagation(); location.href = 'genre-hub.html?genre=' + encodeURIComponent(gen.dataset.dgcGenre || 'fantasy'); return; }
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
    if (window.DroboardReactionPicker) DroboardReactionPicker.attachCounters(row, counterHooks());
    DroboardGenreCard.setPosts(posts);
    row.innerHTML = renderCommSlides(posts);
    bindCommunityRowFallback(row, posts);
    sec.style.display = 'block';
  }

  function injectMidCommunity(posts) {
    const list = document.getElementById('feedList');
    if (!list || !posts || !posts.length || !window.DroboardGenreCard) return;
    if (document.getElementById('commSecMid')) return;
    const sec = document.createElement('section');
    sec.className = 'comm-sec'; sec.id = 'commSecMid';
    sec.innerHTML = `<div class="comm-sec-head"><div class="comm-sec-title"><i class="fas fa-bolt"></i> Trending in hubs</div><button type="button" class="comm-sec-link" onclick="FeedPage.goToTrending()">See all ›</button></div><div class="comm-row" id="commRowMid"></div>`;
    const kids = Array.from(list.children);
    const midIdx = kids.length ? Math.max(1, Math.floor(kids.length / 2)) : 0;
    if (kids[midIdx]) list.insertBefore(sec, kids[midIdx]); else list.appendChild(sec);
    const row = document.getElementById('commRowMid');
    DroboardGenreCard.attach(row, genreCardHooks());
    if (window.DroboardReactionPicker) DroboardReactionPicker.attachCounters(row, counterHooks());
    DroboardGenreCard.setPosts(posts);
    row.innerHTML = renderCommSlides(posts);
    bindCommunityRowFallback(row, posts);
  }

  /* Mount the hub rows. The buckets are collected by init() in parallel with
     everything else and handed in, so this only paints — it never waits on
     the network. */
  function mountCommunitySections(collected) {
    if (!window.DroboardGenreCard) return;
    const { hot, mid, more } = collected || { hot: [], mid: [], more: [] };
    COMM_POSTS_A = hot; COMM_POSTS_MID = mid; COMM_POSTS_B = more;
    mountCommunityRow('commRow1', 'commSec1', COMM_POSTS_A);
    if (COMM_POSTS_B.length) {
      const row2 = document.getElementById('commRow2');
      const sec2 = document.getElementById('commSec2');
      DroboardGenreCard.attach(row2, genreCardHooks());
      if (window.DroboardReactionPicker) DroboardReactionPicker.attachCounters(row2, counterHooks());
      DroboardGenreCard.setPosts(COMM_POSTS_B);
      row2.innerHTML = renderCommSlides(COMM_POSTS_B);
      sec2.style.display = 'block';
      bindCommunityRowFallback(row2, COMM_POSTS_B);
    }
  }

  /* ── Ads ── */
  /* Ad creatives come ONLY from the AdService API. No local hardcodes,
     no secondary sources. Empty pool = no ads. */
  function interleaveAds(posts, pools, every) {
    pools = pools || {};
    const natives = (pools.native || []).slice(0, 3);
    const embeds = (pools.embed || []).filter(a => a && a.code).slice(0, 2);
    const others = [];
    embeds.forEach(ad => others.push({ format: 'embed', ad })); // paid network first
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
      else if (fmt === 'embed' && DroboardAdCard.renderEmbed) inner = DroboardAdCard.renderEmbed(post.ad);
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
      onNameClick: (post) => openAuthorName(post),
      onComment: (post) => {
        if (post && post.type === 'debate') { location.href = 'debate.html?id=' + encodeURIComponent(post.id); return; }
        location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || '');
      },
      onOpenPost: (post) => {
        if (post && post.type === 'debate') { location.href = 'debate.html?id=' + encodeURIComponent(post.id); return; }
        location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || '');
      },
      onShare: (post) => { if (!window.openShareModal) { toast('Share unavailable'); return; } openShareModal({ title: (post.chapterRef && post.chapterRef.title) || (post.storyRef && post.storyRef.title) || (post.original && post.original.title) || (post.heading) || (post.amaData && post.amaData.title) || (post.text ? post.text.slice(0, 60) : post.name + "'s post"), sub: '@' + post.name, img: post.image || (post.chapterRef && post.chapterRef.cover) || (post.storyRef && post.storyRef.cover) || (post.original && post.original.cover) || post.avatar || '', url: 'https://droboard.app/post/' + post.id, contentId: post.id, contentType: 'posts' }); },
      onSave: (post) => {
        /* A post that carries a story saves the STORY (the save sheet owns
           the story/collection lists); every other post is saved as a post
           row, which is what the library's Saved tab reads. */
        const ref = storyRefFor(post);
        if (ref && ref.id && window.openSaveModal) {
          openSaveModal({ title: ref.title, sub: 'by @' + ref.author, img: ref.cover, storyId: ref.id });
          return;
        }
        api('POST', '/posts/' + encodeURIComponent(post.id) + '/save')
          .then(r => {
            post.saved = !!r.saved;
            if (window.DroboardPostCard) DroboardPostCard.update(post);
            toast(post.saved ? '🔖 Saved!' : 'Removed from saved');
          })
          .catch(e => toast(e.message || 'Could not save this post'));
      },
      onDots: (post, anchor) => { try { window._lastDotsAnchor = anchor || null; } catch(e){} if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchor); else toast('More options…'); },
      onJoinAma: () => toast('🎙️ Joining AMA…'),
      onOpenLink: (post) => openStoryGuarded(storyRefFor(post) || (post && (post.storyRef || post.chapterRef))),
      onPollVote: (post, i) => {
        if (post.poll.voted >= 0) { toast('✅ Already voted!'); return; }
        api('POST', '/posts/' + encodeURIComponent(post.id) + '/poll/vote', { option: i })
          .then(card => {
            post.poll = card.poll;
            if (window.DroboardPostCard) DroboardPostCard.update(post);
            toast('✅ Vote cast!');
          })
          .catch(e => toast(e.message || 'Could not cast your vote'));
      },
      onDebateVote: (post, side) => {
        if (post.debateData.userVote) { toast('✅ Already voted!'); return; }
        api('POST', '/posts/' + encodeURIComponent(post.id) + '/debate/vote', { side: side })
          .then(card => {
            post.debateData = card.debateData;
            if (window.DroboardPostCard) DroboardPostCard.update(post);
            toast(side === 'for' ? '✅ Voted FOR!' : '❌ Voted AGAINST!');
          })
          .catch(e => toast(e.message || 'Could not cast your vote'));
      },
      onOpenDebate: (post) => { location.href = 'debate.html?id=' + encodeURIComponent((post && post.id) || ''); },
    });
  }

  function bindAdCard() {
    if (!window.DroboardAdCard) return;
    DroboardAdCard.attach(document.getElementById('feedList'), {
      getAds: () => FEED_POSTS.filter(p => p.type === 'sponsored').map(p => p.ad),
      onOpen: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('📖 Opening sponsored story…'); },
      onLike: (ad) => { if (ad && ad.id) trackAd(ad.id, 'like'); },
      onComment: () => toast('💬 Opening comments…'),
      onShare: (ad) => { if (!window.openShareModal) return; openShareModal({ title: ad.heading || ad.title || ad.brand, sub: ad.brand, img: ad.image || ad.cover || '', url: 'https://droboard.app/ad/' + ad.id }); },
      onCta: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('🔗 Opening ' + (ad.brand || ad.cta || 'link') + '…'); },
    });
  }

  /* Avatar → status viewer when the author has viewable statuses,
     else profile. Droboard always → droboard-page.html */
  function openAuthorAvatar(post) {
    const name = post && post.name;
    if(toDroboardPage(name)){ location.href='droboard-page.html'; return; }
    const viewable = STORIES_CACHE.filter(s => !s.you && s.statuses && s.statuses.length);
    const hit = viewable.find(s => s.name === name);
    if (hit && window.openStatusViewer) { openStatusViewer(viewable, hit.id); return; }
    if (hit && window.ensureStatusViewer) {
      window.ensureStatusViewer().then(function (ok) {
        if (ok) openStatusViewer(viewable, hit.id);
        else location.href = 'profile.html?u=' + encodeURIComponent(name || '');
      });
      return;
    }
    location.href = 'profile.html?u=' + encodeURIComponent(name || '');
  }
  function openAuthorName(post){
    const name = post && post.name;
    if(toDroboardPage(name)) location.href='droboard-page.html';
    else location.href='profile.html?u='+encodeURIComponent(name||'');
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
  /* attachCounters hooks — the picker owns all toggle math (love/switch/
     deselect + total-preserving bucket moves). This host supplies the
     server's reaction buckets and persists the choice to the API. */
  function counterHooks() {
    return {
      getCounts: (id) => {
        const p = findReactPost(id);
        if (!p) return null; // unknown id → picker stays inert
        const counts = Object.assign({}, p.reactions || {});
        return { userRx: (p.userRx || null), ...counts };
      },
      save: (id, state) => {
        const p = findReactPost(id);
        if (!p) return;
        const rid = state.userRx || null;
        const write = rid
          ? api('POST', '/posts/' + encodeURIComponent(p.id) + '/react', { rid: rid })
          : api('DELETE', '/posts/' + encodeURIComponent(p.id) + '/react');
        write.then(r => {
          p.reactions = r.counts || {};
          p.userRx = r.userRx || null;
          p.likes = Object.keys(p.reactions).reduce((n, k) => n + (p.reactions[k] || 0), 0);
          if (window.DroboardReactionPicker && DroboardReactionPicker.update) {
            DroboardReactionPicker.update(p.id, Object.assign({ userRx: p.userRx }, p.reactions));
          }
          if (FEED_POSTS.includes(p)) { if (window.DroboardPostCard) DroboardPostCard.update(p); }
          else if (window.DroboardGenreCard) DroboardGenreCard.update(p);
        }).catch(() => { /* keep the optimistic state until the next load */ });
      },
    };
  }
  function bindReactionPicker() {
    if (!window.DroboardReactionPicker) return;
    DroboardReactionPicker.attachCounters(document.getElementById('feedList'), counterHooks());
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
        FEED_SORT = t.dataset.sort || 'latest';
        applySort(true);
        toast('📂 ' + t.textContent.trim());
      });
    });
  }

  /* ── Post Composer (reusable component) ── */
  /* The composer builds a UI-shaped post; the API wants a content payload.
     This is the one place the two dialects meet. */
  function postBody(post) {
    const b = { type: post.type === 'text' ? 'post' : post.type };
    if (post.title) b.title = post.title;
    if (post.text) b.text = post.text;
    if (post.heading) b.heading = post.heading;
    if (post.note) b.note = post.note;
    if (post.image) b.image = post.image;
    if (post.quote) b.quote = post.quote;
    if (post.caption) b.caption = post.caption;
    if (post.quoteBg) b.quoteBg = post.quoteBg;
    if (post.quoteBgCss) b.quoteBgCss = post.quoteBgCss;
    if (post.expiresAt) b.expiresAt = post.expiresAt;
    if (post.poll) {
      b.poll = {
        q: post.poll.question || post.poll.q || '',
        opts: (post.poll.opts || []).map(o => (typeof o === 'string' ? o : (o.label || o.t || ''))).filter(Boolean),
      };
    }
    if (post.debateData) {
      const d = post.debateData;
      b.debateData = {
        motion: d.motion || d.question || '',
        question: d.motion || d.question || '',
        prompt: d.prompt || '',
        forText: d.forText || 'For',
        againstText: d.againstText || 'Against',
      };
    }
    if (post.amaData) {
      b.amaData = {
        isLive: post.amaData.isLive !== false,
        viewers: post.amaData.viewers || 0,
        title: post.amaData.title || '',
        meta: post.amaData.meta || '',
      };
    }
    if (post.storyRef) b.storyRef = post.storyRef;
    if (post.chapterRef) b.chapterRef = post.chapterRef;
    return b;
  }
  function pushPost(post, isEdit){
    if (post) {
      post.pinnable = canPin();
      if (post.following === undefined) post.following = isFollowing(post.name);
    }
    if(isEdit){
      [BASE_POSTS, FEED_POSTS].forEach(arr => {
        const idx=arr.findIndex(p=> String(p.id)===String(post.id));
        if(idx>-1) arr[idx]=post;
      });
      if(window.DroboardPostCard) DroboardPostCard.update(post);
    } else {
      BASE_POSTS.unshift(post);
      applySort(true);
      return;
    }
    const empty=document.getElementById('emptyState');
    if(empty) empty.style.display = 'none';
  }
  /* The composer is prepared in the background (its story list is a network
     call). If the reader taps "create" before that finishes, wait for it
     instead of opening a composer that was never attached. */
  let COMPOSER_READY = null;
  function openPostComposer(type) {
    if (!window.DroboardPostComposer) { toast('Composer unavailable — post-composer.js failed to load'); return; }
    if (COMPOSER_READY) {
      COMPOSER_READY.then(() => {
        try { DroboardPostComposer.open(type || 'text'); }
        catch (e) { toast('Could not open the composer'); }
      }).catch(() => {});
      return;
    }
    DroboardPostComposer.open(type || 'text');
  }
  function closePostComposer() {
    if (window.DroboardPostComposer) DroboardPostComposer.close();
  }
  /* The composer's story picker (recommendation / chapter drop) offers the
     real catalogue — GET /api/feed/discover/stories. */
  async function composerStories() {
    try {
      const r = await api('GET', '/feed/discover/stories?limit=30');
      const items = Array.isArray(r) ? r : (r.items || []);
      return items.map(s => ({
        id: s.id,
        title: s.title,
        author: s.author || s.authorName || '',
        cover: s.cover || s.img || '',
        cat: s.cat || s.genre || '',
      }));
    } catch (e) {
      return [];
    }
  }
  function currentUser() {
    const s = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
    return { name: s.name || 'You', avatar: s.avatar || '' };
  }
  async function initComposer() {
    if (!window.DroboardPostComposer) { toast('Composer unavailable — post-composer.js failed to load'); return; }
    DroboardPostComposer.attach(null, {
      getUser: currentUser,
      draftKey: 'dro_feed_composer_draft',
      stories: await composerStories(),
      onStatusSlide: async (slide)=>{
        if(!window.DroboardStatus) throw new Error('Status service missing');
        await window.DroboardStatus.post(slide);
        STORIES_CACHE = window.DroboardStatus.mergeStories(STORIES_CACHE);
        renderStories(STORIES_CACHE);
        toast('🟢 Status posted to your story!');
      },
      onSubmit: async (post, isEdit)=>{
        if(post && post.type==='status'){
          if(!window.DroboardStatus) throw new Error('Status service missing');
          await window.DroboardStatus.post(post.statusSlide);
          STORIES_CACHE = window.DroboardStatus.mergeStories(STORIES_CACHE);
          renderStories(STORIES_CACHE);
          toast('🟢 Status posted to your story!');
          return;
        }
        const body = postBody(post);
        const card = isEdit
          ? await api('PATCH', '/posts/' + encodeURIComponent(post.id), body)
          : await api('POST', '/posts', body);
        pushPost(card, isEdit);
        if(isEdit) toast('✅ Post updated!');
        else {
          const label={text:'Post', post:'Post', poll:'Poll', debate:'Debate', ama:'AMA', quote:'Quote', recommendation:'Recommendation', 'chapter-drop':'Chapter drop'}[post.type]||'Post';
          toast(post.type==='ama' ? '🎙️ AMA posted!' : `✅ ${label} published!`);
        }
      }
    });
  }

  /* ── Menu — My Circle accordion (live: the reader's own boards + collections) ── */
  async function getMyBoards(){
    try {
      const r = await api('GET', '/categories?limit=50');
      const all = (r.items || []).map(b => ({
        id: b.slug || b.id, name: b.name,
        icon: b.icon || 'fa-hashtag', members: b.members || '0',
        tagline: b.tagline || b.blurb || '', joined: !!b.isJoined,
      }));
      return { joined: all.filter(b => b.joined), rest: all.filter(b => !b.joined), all };
    } catch (e) { return { joined: [], rest: [], all: [] }; }
  }
  async function getMyCollections(){
    const map = (r) => {
      const rows = (r && r.items) || (Array.isArray(r) ? r : []);
      return rows.map(c => ({
        id: c.id, name: c.name || c.title || 'Collection',
        count: c.count || c.stories || 0,
        cover: c.cover || (c.covers && c.covers[0]) || '',
      }));
    };
    try {
      const [mine, followed, allRows] = await Promise.all([
        api('GET', '/collections?owner=me&limit=50'),
        api('GET', '/collections?followed=1&limit=50'),
        api('GET', '/collections?limit=50'),
      ]);
      const mineRows = map(mine), folRows = map(followed), every = map(allRows);
      const seen = new Set(), joined = [];
      mineRows.concat(folRows).forEach(c => {
        if (!seen.has(c.id)) { seen.add(c.id); joined.push(c); }
      });
      return { joined, rest: every.filter(c => !seen.has(c.id)), all: every };
    } catch (e) { return { joined: [], rest: [], all: [] }; }
  }
  // Droboard official handle always → droboard-page.html (even from demo data)
  function toDroboardPage(h){
    var v = String(h||'').replace(/^@/,'').toLowerCase();
    return v==='droboard' || v==='droboard_official' || v==='dro-board';
  }
  function routeHandle(h){
    if(toDroboardPage(h)) location.href='droboard-page.html';
    else location.href='profile.html?handle='+encodeURIComponent(String(h||'').replace(/^@/,'')); 
  }
  async function configureMenu() {
    if (!window.DroboardMenu) return;
    const s = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
    const user = { name: s.name || s.fullName || 'You', handle: String(s.handle || s.username || '').replace(/^@/, ''), avatar: s.avatar || '' };
    const boards = await getMyBoards();
    const collData = await getMyCollections();
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
        { items: [
          { id: 'droboard', iconImg: '../assets/droboard-icon.png', label: 'DroBoard', sub: 'Official DroBoard page', href: 'droboard-page.html' },
        ]},
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
          if (window.BoardsOverlay) {
            getMyBoards().then(bd => BoardsOverlay.open({ joined: bd.joined, rest: bd.rest }));
          } else {
            location.href = 'trending.html';
          }
          return;
        }
        if (item.id === 'collections-viewall') {
          if(window.BrowseOverlay) BrowseOverlay.open({title:'My Collections', mode:'collections'}); else toast('Opening collections…');
          return;
        }
        if (['latest', 'popular', 'trending', 'following'].includes(item.id)) {
          FEED_SORT = item.id;
          if (window.DroboardMenu) DroboardMenu.setActive(item.id);
          applySort(true);
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
    if (window.ScrollKeep) ScrollKeep.arm();
    initTheme();
    if (window.DroboardNav) DroboardNav.configure({ active: 'feed' });
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onEdit: (post) => {
          if(window.DroboardPostComposer) DroboardPostComposer.open({editPost: post});
          else toast('✏️ Edit · ' + (post.name || ''));
        },
        onDelete: (post) => {
          api('DELETE', '/posts/' + encodeURIComponent(post.id))
            .then(() => {
              const i = BASE_POSTS.findIndex(p => String(p.id) === String(post.id));
              if (i >= 0) BASE_POSTS.splice(i, 1);
              applySort(false);
              toast('🗑️ Post deleted');
            })
            .catch(e => toast(e.message || 'Could not delete this post'));
        },
        onReport: (post) => {
          if (window.DroboardDotsMenu && DroboardDotsMenu.openReportTypes) DroboardDotsMenu.openReportTypes(post, window._lastDotsAnchor || null);
          else toast('🚩 Reported. Thanks for flagging.');
        },
        onReportType: (post, typeId) => {
          api('POST', '/reports', { target: 'post', targetId: post.id, reason: typeId })
            .then(() => toast('🚩 Report filed. Our team will review it.'))
            .catch(e => toast(e.message || 'Could not file the report'));
        },
        onLess: (post) => {
          api('POST', '/posts/' + encodeURIComponent(post.id) + '/hide')
            .then(() => {
              const i = BASE_POSTS.findIndex(p => String(p.id) === String(post.id));
              if (i >= 0) BASE_POSTS.splice(i, 1);
              applySort(false);
              toast('Got it — showing less of this.');
            })
            .catch(e => toast(e.message || 'Could not hide this post'));
        },
        onFollow: (post) => {
          setFollowing(post && post.name, true)
            .then(() => {
              if (post) post.following = true;
              toast('Following @' + (post.name || 'user'));
            })
            .catch(e => toast(e.message || 'Could not follow this account'));
        },
        onUnfollow: (post) => {
          setFollowing(post && post.name, false)
            .then(() => {
              if (post) post.following = false;
              toast('Unfollowed @' + (post.name || 'user'));
            })
            .catch(e => toast(e.message || 'Could not unfollow this account'));
        },
        onMute: (post) => {
          const handle = String((post && post.name) || '').replace(/^@/, '');
          if (!handle) { toast('Could not mute this account'); return; }
          api('POST', '/users/' + encodeURIComponent(handle) + '/mute')
            .then(() => {
              const keep = BASE_POSTS.filter(p => String(p.name || '').toLowerCase() !== handle.toLowerCase());
              BASE_POSTS.length = 0; keep.forEach(p => BASE_POSTS.push(p));
              applySort(false);
              toast('Muted @' + handle);
            })
            .catch(e => toast(e.message || 'Could not mute this account'));
        },
        onPin: (post) => {
          if (!canPin()) { toast('Only moderators can pin.'); return; }
          api('PATCH', '/posts/' + encodeURIComponent(post.id), { pinned: true })
            .then(() => {
              post.pinned = true;
              applySort(false);
              toast('📌 Pinned to top');
            })
            .catch(e => toast(e.message || 'Could not pin this post'));
        },
        onUnpin: (post) => {
          if (!canPin()) { toast('Only moderators can unpin.'); return; }
          api('PATCH', '/posts/' + encodeURIComponent(post.id), { pinned: false })
            .then(() => {
              post.pinned = false;
              if (window.DroboardPostCard) DroboardPostCard.update(post);
              toast('Unpinned');
            })
            .catch(e => toast(e.message || 'Could not unpin this post'));
        },
        onCopyLink: (post) => { const url = 'https://droboard.app/post/' + post.id; if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied')).catch(() => toast('🔗 ' + url)); else toast('🔗 ' + url); },
      });
    }
    bindStories();
    initTabs();
    // The composer, the menu and the promo slider are NOT needed for the
    // feed's first paint. They used to be awaited BEFORE /feed/home was even
    // requested, which put three request groups in front of the posts. They
    // now run in the background and land whenever they land.
    const composerTask = initComposer().catch((e) => { console.warn('[feed] composer init failed', e); });
    COMPOSER_READY = composerTask;
    const menuTask = configureMenu().catch((e) => { console.warn('[feed] menu init failed', e); });
    const promoTask = mountPromo().catch((e) => { console.warn('[feed] promo init failed', e); });
     // global @droboard tap → droboard-page (catches post-card inline handles)
    document.addEventListener('click', function(e){
      const a=e.target.closest('a[href*="profile.html?u=droboard"], a[href*="profile.html?u=Droboard"]');
      if(a){ e.preventDefault(); location.href='droboard-page.html'; }
      const at=e.target.closest('[data-handle]');
      if(at && toDroboardPage(at.dataset.handle)){ e.preventDefault(); location.href='droboard-page.html'; }
    }, true);
     loadNotifCount();
    try {
      if (!window.FeedData) throw new Error('FeedData is not defined — check feed-data script path');
      /* Everything the feed needs for its first paint, in ONE parallel batch.
         These used to run as a chain of serial stages — composer → menu →
         promo → /feed/home → my status → ads → following → hubs — so the
         first post card could only appear after all of them had answered. */
      const [stories0, posts, mine, adPools, adPlacement, , community] = await Promise.all([
        FeedData.getStories(),
        FeedData.getFeedPosts(),
        // 401/403 means "guest, no story of my own" — not a failure.
        window.DroboardStatus
          ? window.DroboardStatus.refreshMine().then(() => ({ ok: true })).catch(() => ({ ok: false }))
          : Promise.resolve({ ok: false }),
        window.AdService ? AdService.getAds({ page: 'feed' }).catch(() => ({})) : Promise.resolve({}),
        window.AdService ? AdService.getPlacement('feed').catch(() => null) : Promise.resolve(null),
        loadFollowing().catch(() => null),
        collectCommunityPosts().catch(() => null),
      ]);
      let stories = stories0;
      if (window.DroboardStatus) {
        if (mine.ok) { try { stories = window.DroboardStatus.mergeStories(stories); } catch (e) {} }
        else toast('Could not load your story ring — refresh to retry.');
      }
      let adGap = 3;
      if (adPlacement && adPlacement.interval) adGap = adPlacement.interval;
      document.getElementById('loadingState').style.display = 'none';
      STORIES_CACHE = stories;
      BASE_POSTS = posts;
      AD_POOLS = adPools || {}; AD_GAP = adGap;
      stampFeedPins(BASE_POSTS);
      FEED_POSTS = interleaveAds(BASE_POSTS, AD_POOLS, AD_GAP);
      renderStories(STORIES_CACHE);
      if (!FEED_POSTS.length) {
        document.getElementById('emptyState').style.display = 'block';
      } else if (!window.DroboardPostCard) {
        throw new Error('DroboardPostCard is not defined — check component/post-card.js');
      } else {
        bindPostCard();
        bindReactionPicker();
        bindAdCard();
        DroboardPostCard.setPosts(FEED_POSTS);
        FEED_POSTS.filter(p => p.type === 'sponsored' && p.ad && p.ad.id).forEach(p => trackAd(p.ad.id, 'impression'));
      }
      // The hub rows land AFTER the posts are on screen — they are a
      // secondary section and used to sit in front of them.
      mountCommunitySections(community);
      injectMidCommunity(COMM_POSTS_MID);
      Promise.allSettled([composerTask, menuTask, promoTask]);
    } catch (err) {
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
      document.getElementById('emptyTitle').textContent = 'Feed failed to load';
      document.getElementById('emptySub').textContent = err.message || 'Something went wrong loading the feed.';
      console.error('[feed] init() failed:', err);
    }
    if (window.DroboardSearch) {
      DroboardSearch.configure({
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => {
          const h = (w && (w.handle || w.name)) || '';
          if(toDroboardPage(h)) location.href='droboard-page.html';
          else location.href='profile.html?u=' + encodeURIComponent(h.replace('@',''));
        },
        onOpenDebate: (d) => { location.href = 'debate.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
    if (window.ScrollKeep) ScrollKeep.restore();
  }

  function goToTrending() { location.href = 'trending.html'; }

  window.FeedPage = { init, toast, toggleTheme, openPostComposer, closePostComposer, goToTrending };
})();
