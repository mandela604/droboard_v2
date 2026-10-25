/* ═══════════════════════════════════════════════════════════════
   DISCUSSION SERVICE
   Thread page orchestration. HTML calls DiscussionPage.init().
   OP + comments come from data/genre-demo-seed.js; the mid-page ad
   from the central inventory (ad-service). No hardcoded content.
   When going live: swap seed reads for API calls.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'droboardTheme';

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
  function trackAd() {}

  /* ── Theme ── */
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    var iconEl = document.getElementById('themeIcon');
    if (iconEl) iconEl.className = next === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    syncCommentTheme();
  }
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    var iconEl = document.getElementById('themeIcon');
    if (iconEl) iconEl.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
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
  /* Official Droboard post → discussion OP shape (avatar from asset seed). */
  function adaptDroboardPost(p) {
    const hero = (window.DroboardPageSeed && window.DroboardPageSeed.DROBOARD_HERO) || {};
    const text = p.text || p.note || p.title || '';
    const motion = (p.debateData && p.debateData.motion) || '';
    const pollQ = (p.poll && p.poll.q) || '';
    return {
      id: p.id, title: p.title || text.slice(0, 70) || 'Droboard post',
      body: text || motion || pollQ,
      name: 'Droboard', avatar: hero.avatar || '../assets/droboard-icon.png', time: p.time || '',
      likes: p.likes || 0, liked: !!p.liked, comments: p.comments || 0,
      media: p.image || null,
      story: p.storyRef ? { title: p.storyRef.title, cover: p.storyRef.cover, writer: p.storyRef.writer } : null,
      _genreId: null, _genreName: null, _feed: false, _droboard: true,
      tag: p.type === 'announcement' ? 'Announcement' : p.type === 'debate' ? 'Debate' : p.type === 'shoutout' ? 'Shoutout' : null,
      tagClass: 'discussion',
    };
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
    let postId = params.get('id') || params.get('d');
    // Feed community cards link with prefixed ids ('fc_<genre>_<id>') —
    // unwrap to the original hub post id before pool lookup.
    if (typeof postId === 'string' && postId.indexOf('fc_') === 0) {
      const rest = postId.slice(3);
      const gids = Object.keys(seed.DEMO_GENRES || {}).sort((a, b) => b.length - a.length);
      for (const gid of gids) {
        if (rest.indexOf(gid + '_') === 0) { postId = rest.slice(gid.length + 1); break; }
      }
    }
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
    /* Official Droboard page posts (d1..): resolved from the page seed so
       See-more / view-replies links from anywhere land on a real thread. */
    if (!POST && window.DroboardPageSeed) {
      const all = [].concat(window.DroboardPageSeed.DROBOARD_POSTS || [], window.DroboardPageSeed.DROBOARD_MORE_POSTS || []);
      try {
        const extra = JSON.parse(localStorage.getItem('drb_posts_extra') || '[]');
        if (Array.isArray(extra) && extra.length) extra.forEach(p => { if (p && p.id) all.unshift(p); });
      } catch (e) {}
      const hit = all.find(p => String(p.id) === String(postId));
      if (hit) POST = adaptDroboardPost(hit);
    }
    /* No silent fallback: unknown ids show the not-found state,
       exactly as production will. */
    document.getElementById('hubSub').textContent = (GENRE && GENRE.name && (GENRE_EXPLICIT || (POST && !POST._feed)))
      ? GENRE.name + ' Hub' : 'Discussion';
    return true;
  }

  /* ── OP render ── */
  function profileHref(name) { return 'profile.html?u=' + encodeURIComponent(name || ''); }

  /* Resolve the OP author's status ring ('has' | 'viewed' | 'none') from
     the same status pool the avatar-click handler uses, so the ring is
     drawn at mount time, not only after a click. */
  async function resolveOpStatusRing(name) {
    try {
      if (window.FeedData && FeedData.getStories) {
        const stories = await FeedData.getStories();
        const viewable = (stories || []).filter(s => s && s.statuses && s.statuses.length);
        const hit = viewable.find(s => s.name === name);
        if (hit) return hit.ring === 'ring-viewed' ? 'viewed' : (hit.ring === 'ring-none' ? 'none' : 'has');
      }
    } catch (e) {}
    try {
      const pool = (window.COMMENTS_DATA || []).filter(c => c && c.statuses && c.statuses.length);
      const hit = pool.find(c => c.name === name);
      if (hit) return hit.statusRing === 'viewed' ? 'viewed' : (hit.statusRing === 'none' ? 'none' : 'has');
    } catch (e) {}
    return 'none';
  }

  function renderOp() {
    const mount = document.getElementById('opMount');
    if (!POST) {
      mount.innerHTML = '<div class="empty">Discussion not found. <a href="genre-hub.html">Back to hub</a></div>';
      return;
    }
    if (POST.pinned && !POST._droboard) {
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
    const actions = `${rx}
      <button type="button" class="op-act" id="opReplyBtn"><i class="far fa-comment"></i> ${POST.comments || 0}</button>
      <button type="button" class="op-act" id="opShareBtn"><i class="fas fa-share-nodes"></i> Share</button>`;
    mount.innerHTML = `<div class="op">
      <div class="op-head">
        <div class="op-av-wrap" id="opAvWrap">
          ${DroboardStatusRing.html({ name: POST.name, avatar: POST.avatar }, {
            size: 44, key: POST.name, attrs: 'id="opAvRing"',
            innerHtml: `<img class="op-av" id="opAv" src="${esc(POST.avatar || '')}" alt=""/>`,
            innerBg: 'var(--l2)', gapColor: 'var(--l2)',
          })}
        </div>
        <div class="op-meta">
          <div><span class="op-name" id="opName">${esc(POST.name || '')}</span>${badge}</div>
          <div class="op-time">${esc(POST.time || '')}${GENRE ? ' · ' + esc(GENRE.name) : ''}</div>
        </div>
      </div>
      <div class="op-title">${esc(POST.title || '')}</div>
      <div class="op-body">${esc(POST.body || '')}</div>
      ${tags ? `<div class="op-tags">${tags}</div>` : ''}
      ${media}${story}
      <div class="op-actions" id="opActions">${actions}</div>
    </div>`;
    document.title = (POST.title || 'Discussion') + ' · DroBoard';

    // Draw the status ring now that the avatar is mounted
    (async () => {
      const ring = await resolveOpStatusRing(POST.name);
      const ringEl = document.getElementById('opAvRing');
      if (ringEl) {
        ringEl.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
        ringEl.classList.add('ring-' + ring);
      }
    })();

    // Gray the ring after the status is viewed — same contract as
    // comment-section/debate-args so every host page stays in sync.
    (function bindOpStatusSync() {
      const prev = window.onStatusViewerChange;
      window.onStatusViewerChange = function (wid, ring) {
        if (typeof prev === 'function') { try { prev(wid, ring); } catch (e) {} }
        const ringEl = document.getElementById('opAvRing');
        if (!ringEl || !POST) return;
        // The viewer dedupes by name; match loosely on the author's name
        // appearing in the viewer id, or fall back to any viewed event.
        const newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : 'none';
        ringEl.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
        ringEl.classList.add('ring-' + newRing);
      };
    })();

    document.getElementById('opAvWrap')?.addEventListener('click', async () => {
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
    document.getElementById('opReplyBtn')?.addEventListener('click', () => {
      const inp = document.querySelector('#commentsPlaceholder .dcs-input, #commentsPlaceholder input[type="text"], #commentsPlaceholder textarea');
      if (inp) {
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => inp.focus(), 350);
      } else {
        document.getElementById('commentsPlaceholder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    document.getElementById('opShareBtn')?.addEventListener('click', () => {
      const data = {
        title: POST.title || 'Discussion',
        sub: (POST.name || '') + (GENRE ? ' · ' + GENRE.name : ''),
        img: POST.story?.cover || POST.media || POST.avatar || '',
        url: location.href,
      };
      if (typeof window.openShareModal === 'function') window.openShareModal(data);
      else if (navigator.clipboard) { navigator.clipboard.writeText(location.href).then(() => toast('📋 Link copied!')).catch(() => toast('📤 Share link copied!')); }
      else toast('📤 Share link copied!');
    });
  }

  /* ── Discussion ads removed per product request: no mid-page slot. ── */
  async function mountAd() { return; }

  /* ── Comments: droboard OPs reuse the page comment seed; everything
     else keeps the genre demo thread. ── */
  function normThreadRing(r) {
    const s = String(r || '').replace(/^ring-/, '');
    return (s === 'has' || s === 'viewed') ? s : 'none';
  }
  /* Thread seeds carry no status data — match authors against COMMENTS_DATA
     first, else deal statuses round-robin so every comment behaves like
     reader comments (ring shows, avatar opens the viewer). */
  function enrichThreadStatuses(list) {
    let pool = [];
    try {
      pool = (window.COMMENTS_DATA || []).filter(c => c && c.statuses && c.statuses.length);
    } catch (e) { pool = []; }
    if (!pool.length) return list;
    const byName = {};
    pool.forEach(p => { if (p.name && !byName[p.name]) byName[p.name] = p; });
    let n = 0;
    (function walk(arr) {
      (arr || []).forEach(c => {
        const hit = byName[c.name];
        if (hit) {
          if (!c.statuses || !c.statuses.length) c.statuses = hit.statuses;
          c.statusRing = normThreadRing((c.statusRing && c.statusRing !== 'none') ? c.statusRing : hit.statusRing);
        } else if (!c.statuses || !c.statuses.length) {
          const p = pool[n++ % pool.length];
          c.statuses = p.statuses;
          c.statusRing = (n % 3 === 0) ? 'viewed' : 'has';
        } else {
          c.statusRing = normThreadRing(c.statusRing);
        }
        walk(c.replies || []);
      });
    })(list);
    return list;
  }
  function threadComments() {
    if (POST && POST._droboard && window.COMMENTS_DATA) {
      return JSON.parse(JSON.stringify(window.COMMENTS_DATA));
    }
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
    return enrichThreadStatuses(list);
  }
  function mountComments() {
    if (window.DroboardComments && POST && !(POST.pinned && !POST._droboard)) {
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
    } else if (!POST || (POST.pinned && !POST._droboard)) {
      document.getElementById('commentsPlaceholder').innerHTML =
        '<div class="empty" style="padding:24px 0">No thread on hub rules.</div>';
    } else {
      document.getElementById('commentsPlaceholder').innerHTML =
        '<div class="empty">comment-section.js missing</div>';
    }
  }

  /* ── Deep link (?comment=ID): scroll to + flash the comment ── */
  function scrollToComment() {
    let cid = null;
    try { cid = new URLSearchParams(location.search).get('comment'); } catch (e) {}
    if (!cid) return;
    cid = String(cid).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cid) return;
    setTimeout(function () {
      let el = null;
      try { el = document.querySelector('[id$="-ci-' + cid + '"]'); } catch (e) {}
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow .3s';
      el.style.boxShadow = '0 0 0 2px rgba(255,0,80,.55)';
      setTimeout(function () { el.style.boxShadow = ''; }, 2400);
    }, 450);
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
      // attachCounters — picker owns all toggle math (love/switch/deselect,
      // total-preserving). Host only seeds initial counts + persists.
      DroboardReactionPicker.attachCounters(document.getElementById('opMount'), {
        getCounts: (id) => {
          if (!POST || String(id) !== String(POST.id)) return null;
          const likes = POST.likes || 0;
          const buckets = ['crying', 'shocked', 'emotional'];
          let h = 0; String(POST.id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
          const secondId = buckets[h];
          const second = Math.min(5, Math.max(0, likes));
          const counts = { love: Math.max(0, likes - second) };
          counts[secondId] = second;
          return { userRx: (POST.userRx || (POST.liked ? 'love' : null)) || null, ...counts };
        },
        save: (id, state) => {
          if (!POST || String(id) !== String(POST.id)) return;
          POST.userRx = state.userRx;
          POST.liked = state.userRx === 'love';
          let total = 0;
          Object.keys(state).forEach(k => { if (k !== 'userRx') total += state[k] || 0; });
          POST.likes = total;
        },
      });
    }
  }

  async function init() {
    initTheme();
    window.toast = toast;
    window.toggleTheme = toggleTheme;
    if (!(await loadThread())) { toast('GenreDemoSeed missing'); return; }
    initWiring();
    renderOp();
    mountComments();
    scrollToComment();
  }

  window.DiscussionPage = { init, toast, toggleTheme, renderOp };
})();
