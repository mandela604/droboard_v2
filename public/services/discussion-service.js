/* ═══════════════════════════════════════════════════════════════
   DISCUSSION SERVICE
   Thread page orchestration. HTML calls DiscussionPage.init().
   OP + comments come from data/genre-demo-seed.js; the mid-page ad
   from the central inventory (ad-service). No hardcoded content.
   When going live: swap seed reads for API calls.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'dro_search_theme_v1';

  let GENRE = null;
  let GENRE_ID = 'fantasy';
  let POST = null;

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 2200);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }

  /* ── Theme ── */
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    document.getElementById('themeIcon').className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    syncCommentTheme();
  }
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeIcon').className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    syncCommentTheme();
  }
  function syncCommentTheme() {
    const light = (document.documentElement.getAttribute('data-theme') || 'light') === 'light';
    document.body.classList.toggle('theme-white', light);
  }

  /* ── Thread load: genre hub threads first, then feed posts, so ANY
     post id from any card opens here with ?id=. ── */
  let GENRE_EXPLICIT = false;
  function genrePool(seed) {
    if (!seed || !seed.DEMO_GENRES) return [];
    const out = [];
    Object.keys(seed.DEMO_GENRES).forEach(gid => {
      const g = seed.DEMO_GENRES[gid];
      if (seed.DEMO_PINNED && seed.DEMO_PINNED[gid]) out.push(Object.assign({ _genreId: gid, _genreName: g.name }, seed.DEMO_PINNED[gid]));
      ((seed.DEMO_DISCUSSIONS[gid]) || []).forEach(p =>
        out.push(Object.assign({ _genreId: gid, _genreName: g.name }, p)));
    });
    return out;
  }
  function adaptFeedPost(p) {
    const text = p.text || p.quote || p.caption || p.note || (p.amaData && p.amaData.title) || '';
    return {
      id: p.id, title: text.slice(0, 70) || 'Post',
      body: text,
      name: p.name, avatar: p.avatar, time: p.time,
      likes: p.likes, liked: p.liked, comments: p.comments,
      media: p.image || null,
      story: p.chapterRef ? { title: p.chapterRef.title, cover: p.chapterRef.cover } :
             p.storyRef ? { title: p.storyRef.title, cover: p.storyRef.cover } : null,
      _genreId: null, _genreName: null, _feed: true,
    };
  }
  async function loadThread() {
    const params = new URLSearchParams(location.search);
    const seed = window.GenreDemoSeed;
    if (!seed) return false;
    GENRE_EXPLICIT = !!params.get('genre');
    GENRE_ID = params.get('genre') || seed.DEFAULT_GENRE_ID;
    const postId = params.get('id') || params.get('d');
    GENRE = seed.DEMO_GENRES[GENRE_ID] || seed.DEMO_GENRES[seed.DEFAULT_GENRE_ID];
    const pool = genrePool(seed);
    POST = postId ? pool.find(p => String(p.id) === String(postId)) : null;
    if (POST && POST._genreId) {
      GENRE_ID = POST._genreId;
      GENRE = seed.DEMO_GENRES[GENRE_ID] || GENRE;
    }
    if (!POST && window.FeedData && window.FeedData.getFeedPosts) {
      try {
        const feed = await window.FeedData.getFeedPosts();
        const hit = (feed || []).find(p => String(p.id) === String(postId));
        if (hit) POST = adaptFeedPost(hit);
      } catch (e) {}
    }
    if (!POST) {
      const users = (window.DemoData && window.DemoData.USERS) || {};
      for (const handle of Object.keys(users)) {
        const up = (users[handle].posts || []).find(p => String(p.id) === String(postId));
        if (up) {
          POST = adaptFeedPost(Object.assign({ name: users[handle].name, avatar: users[handle].avatar }, up));
          break;
        }
      }
    }
    /* No silent fallback: unknown ids show the not-found state,
       exactly as production will. */
    document.getElementById('hubSub').textContent = (GENRE && GENRE.name && (GENRE_EXPLICIT || (POST && !POST._feed)))
      ? GENRE.name + ' Hub' : 'Discussion';
    return true;
  }

  /* ── OP render ── */
  function profileHref(name) { return 'profile.html?u=' + encodeURIComponent(name || ''); }
  function renderOp() {
    const mount = document.getElementById('opMount');
    if (!POST) {
      mount.innerHTML = '<div class="empty">Discussion not found. <a href="genre-hub.html">Back to hub</a></div>';
      document.getElementById('discAd').style.display = 'none';
      return;
    }
    if (POST.pinned) {
      mount.innerHTML = `<div class="op">
        <div class="op-title">${esc(POST.title)}</div>
        <div class="op-body">${esc(POST.desc || POST.body || '')}</div>
      </div>`;
      document.title = 'Hub rules · DroBoard';
      return;
    }
    let tags = '';
    if (POST.tag) tags += `<span class="op-tag ${POST.tagClass || 'discussion'}">${esc(POST.tag)}</span>`;
    if (POST.hot) tags += `<span class="op-tag hot"><i class="fas fa-fire"></i> Hot</span>`;
    if ((POST.controversy || 0) >= 50) tags += `<span class="op-tag controversial"><i class="fas fa-bolt"></i> Controversial</span>`;
    const badge = POST.badge
      ? `<span class="op-badge ${POST.badgeClass === 'author' ? 'author' : ''}">${esc(POST.badge)}</span>` : '';
    const media = POST.media ? `<div class="op-media"><img src="${esc(POST.media)}" alt=""/></div>` : '';
    const story = POST.story
      ? `<div class="op-story" id="storyRef">
          <img class="op-story-cover" src="${esc(POST.story.cover || '')}" alt=""/>
          <div>
            <div class="op-story-title">${esc(POST.story.title)}</div>
            <div class="op-story-by">by ${esc(POST.story.writer || '')}</div>
          </div>
        </div>` : '';
    const rx = window.DroboardReactionPicker
      ? DroboardReactionPicker.renderTrigger(String(POST.id), { liked: !!POST.liked, likeCount: POST.likes || 0 })
      : `<span style="font-weight:700;color:var(--tx-muted)">${POST.likes || 0}</span>`;
    mount.innerHTML = `<div class="op">
      <div class="op-head">
        <img class="op-av" id="opAv" src="${esc(POST.avatar || '')}" alt=""/>
        <div class="op-meta">
          <div><span class="op-name" id="opName">${esc(POST.name || '')}</span>${badge}</div>
          <div class="op-time">${esc(POST.time || '')}${GENRE ? ' · ' + esc(GENRE.name) : ''}</div>
        </div>
      </div>
      <div class="op-title">${esc(POST.title || '')}</div>
      <div class="op-body">${esc(POST.body || '')}</div>
      ${tags ? `<div class="op-tags">${tags}</div>` : ''}
      ${media}${story}
      <div class="op-actions" id="opActions">${rx}</div>
    </div>`;
    document.title = (POST.title || 'Discussion') + ' · DroBoard';
    document.getElementById('opAv')?.addEventListener('click', async () => {
      const name = POST.name;
      if (window.FeedData && FeedData.getStories && window.openStatusViewer) {
        try {
          const stories = await FeedData.getStories();
          const viewable = (stories || []).filter(s => !s.you && s.statuses && s.statuses.length);
          const hit = viewable.find(s => s.name === name);
          if (hit) { openStatusViewer(viewable, hit.id); return; }
        } catch (e) {}
      }
      location.href = profileHref(name);
    });
    document.getElementById('opName')?.addEventListener('click', () => { location.href = profileHref(POST.name); });
    document.getElementById('storyRef')?.addEventListener('click', () => toast('📖 Opening story…'));
  }

  /* ── Mid-page ad: central inventory only (book first, else platform) ── */
  async function mountAd() {
    const el = document.getElementById('discAd');
    if (!el || !window.DroboardAdCard) { if (el) el.style.display = 'none'; return; }
    let slot = null;
    if (window.AdService) {
      try {
        const pools = await AdService.getAds({ page: 'discussion' });
        const book = (pools.book || [])[0];
        const plat = (pools.platform || [])[0];
        if (book) slot = { format: 'storyPromo', ad: Object.assign({}, book, { cat: (GENRE && GENRE.name) || book.cat }) };
        else if (plat) slot = { format: 'platform', ad: plat };
      } catch (e) { slot = null; }
    }
    if (!slot) { el.style.display = 'none'; return; }
    let inner = '';
    try {
      if (slot.format === 'platform') inner = DroboardAdCard.renderPlatform(slot.ad);
      else if (slot.format === 'native') inner = DroboardAdCard.renderNative(slot.ad);
      else inner = DroboardAdCard.renderStoryPromo(slot.ad);
    } catch (e) { el.style.display = 'none'; return; }
    el.innerHTML = inner;
    trackAd(slot.ad.id, 'impression');
    DroboardAdCard.attach(el, {
      getAds: () => [slot.ad],
      onOpen: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('📖 ' + (ad.title || ad.heading || 'Ad')); },
      onCta: (ad) => { if (ad) trackAd(ad.id, 'click'); toast('🔗 ' + (ad.cta || 'CTA')); },
      onLike: () => {},
      onComment: () => toast('💬'),
      onShare: (ad) => {
        if (window.openShareModal) {
          openShareModal({
            title: ad.title || ad.heading || ad.brand,
            sub: ad.brand || 'Sponsored',
            img: ad.cover || ad.image || '',
            url: 'https://droboard.app/ad/' + (ad.id || ''),
          });
        }
      },
    });
  }

  /* ── Comments: seed thread with the OP reply personalized ── */
  function threadComments() {
    const seed = (window.GenreDemoSeed && window.GenreDemoSeed.DEMO_THREAD_COMMENTS) || [];
    const list = JSON.parse(JSON.stringify(seed));
    if (POST && !POST.pinned) {
      list.forEach(c => (c.replies || []).forEach(r => {
        if (r.name === '@OP') {
          r.name = POST.name || 'OP';
          r.avatar = POST.avatar || '';
          r.verified = POST.badge === 'Author' ? 'writer' : false;
        }
      }));
    }
    return list;
  }
  function mountComments() {
    if (window.DroboardComments && POST && !POST.pinned) {
      DroboardComments.attach('#commentsPlaceholder', {
        title: 'Replies',
        comments: threadComments(),
        currentUser: { name: 'You', avatar: 'https://i.pravatar.cc/100?img=32' },
        collapsible: false,
        startOpen: true,
        requireTeam: false,
        getCommentUrl: (c) => location.href.split('#')[0] + '#comment-' + (c && c.id),
        onPost: () => toast('💬 Reply posted'),
        onReply: () => toast('💬 Reply posted'),
        onEdit: () => toast('✏️ Updated'),
        onProfileClick: (c) => { if (c && c.name) location.href = profileHref(c.name); },
      });
    } else if (!POST || POST.pinned) {
      document.getElementById('commentsPlaceholder').innerHTML =
        '<div class="empty" style="padding:24px 0">No thread on hub rules.</div>';
    } else {
      document.getElementById('commentsPlaceholder').innerHTML =
        '<div class="empty">comment-section.js missing</div>';
    }
  }

  /* ── Wiring ── */
  function initWiring() {
    document.getElementById('backBtn').addEventListener('click', () => {
      if (history.length > 1) history.back();
      else if (GENRE_EXPLICIT) location.href = 'genre-hub.html?genre=' + encodeURIComponent(GENRE_ID);
      else location.href = 'feed.html';
    });
    document.getElementById('shareBtn').addEventListener('click', () => {
      if (!POST) return;
      const url = location.href;
      if (window.openShareModal) {
        openShareModal({
          title: POST.title,
          sub: '@' + (POST.name || '') + ' · ' + (GENRE && GENRE.name),
          img: POST.media || '',
          url,
        });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied'));
      } else toast(url);
    });
    if (window.DroboardReactionPicker) {
      DroboardReactionPicker.attach(document.getElementById('opMount'), {});
    }
  }

  async function init() {
    initTheme();
    window.toast = toast;
    window.toggleTheme = toggleTheme;
    if (!(await loadThread())) { toast('GenreDemoSeed missing'); return; }
    initWiring();
    renderOp();
    await mountAd();
    mountComments();
  }

  window.DiscussionPage = { init, toast, toggleTheme, renderOp };
})();
