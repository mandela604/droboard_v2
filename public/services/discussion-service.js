/* ═══════════════════════════════════════════════════════════════
   DISCUSSION SERVICE
   Thread page orchestration. HTML calls DiscussionPage.init().
   OP = GET /api/discussions/:id — the ONE flat toFlatCard card the
   hub list and the feed trending row render. Replies =
   GET /api/comments?scope=discussion. Mid-page ad from the central
   inventory (ad-service). No demo content, no fallbacks.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const THEME_KEY = 'droboardTheme';

  let GENRE = null;
  let GENRE_ID = 'fantasy';
  let POST = null;

  // Cache for API requests and computed data
  const cache = {
    thread: null,
    comments: null,
    pending: new Map()
  };

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

  const API_BASE = '/api';

  async function loadThread() {
    const params = new URLSearchParams(location.search);
    let postId = params.get('id') || params.get('d');
    if (!postId) throw new Error('No discussion id in URL');
    
    // Check cache first
    if (cache.thread && cache.thread.id === postId) {
      POST = cache.thread.data;
      GENRE_ID = POST._genreId || 'general';
      GENRE = { name: POST._genreName || POST._genreId || 'Discussion' };
      document.getElementById('hubSub').textContent = GENRE.name + ' Hub';
      return true;
    }
    
    // Deduplicate concurrent requests
    const cacheKey = `thread:${postId}`;
    if (cache.pending.has(cacheKey)) {
      return cache.pending.get(cacheKey);
    }
    
    const promise = (async () => {
      const res = await fetch(`${API_BASE}/discussions/${encodeURIComponent(postId)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Discussion API failed: ' + res.status);
      POST = await res.json();
      GENRE_ID = POST._genreId || 'general';
      GENRE = { name: POST._genreName || POST._genreId || 'Discussion' };
      document.getElementById('hubSub').textContent = GENRE.name + ' Hub';
      
      cache.thread = { id: postId, data: POST };
      return true;
    })().finally(() => cache.pending.delete(cacheKey));
    
    cache.pending.set(cacheKey, promise);
    return promise;
  }

  async function threadComments() {
    // The comments API filters on discussionId (strict query schema).
    const res = await fetch(`${API_BASE}/comments?scope=discussion&discussionId=${encodeURIComponent(POST.id)}&limit=50`, { credentials: 'include' });
    if (!res.ok) throw new Error('Comments API failed: ' + res.status);
    const data = await res.json();
    return (data && data.items) || [];
  }
  /* ── OP render ── */
  function profileHref(name) { return 'profile.html?u=' + encodeURIComponent(name || ''); }

  /* The OP's real lineup + ring come from the shared status service and
     StatusStore — same as every other avatar. No seed-derived guesses. */
  function opPerson() {
    const name = String((POST && POST.name) || '').replace(/^@/, '');
    let statuses = [];
    try {
      if (window.DroboardStatus) statuses = DroboardStatus.writerStatuses(name) || [];
    } catch (e) {}
    return { name, avatar: (POST && POST.avatar) || '', statuses };
  }

  function renderOp() {
    const mount = document.getElementById('opMount');
    if (!POST) {
      mount.innerHTML = '<div class="empty">Discussion not found. <a href="genre-hub.html">Back to hub</a></div>';
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
          ${DroboardStatusRing.html(opPerson(), {
            size: 44, personKey: POST.name, attrs: 'id="opAvRing"',
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

    // Gray the ring after the status is viewed — same contract as
    // comment-section/debate-args so every host page stays in sync.
    (function bindOpStatusSync() {
      const prev = window.onStatusViewerChange;
      window.onStatusViewerChange = function (wid, ring, name) {
        if (typeof prev === 'function') { try { prev(wid, ring, name); } catch (e) {} }
        const ringEl = document.getElementById('opAvRing');
        if (!ringEl || !POST) return;
        // Only repaint when the viewed author IS the OP.
        const opKey = String(POST.name || '').replace(/^@/, '').toLowerCase();
        const gotKey = String(name || wid || '').replace(/^@/, '').toLowerCase();
        if (opKey && gotKey !== opKey) return;
        const newRing = ring === 'ring-viewed' ? 'viewed' : ring === 'ring-has' ? 'has' : ring === 'ring-live' ? 'live' : 'none';
        ringEl.classList.remove('ring-has', 'ring-live', 'ring-viewed', 'ring-none');
        ringEl.classList.add('ring-' + newRing);
      };
    })();

    document.getElementById('opAvWrap')?.addEventListener('click', async () => {
      // Play the SAME lineup the ring was drawn from (the shared store keys
      // it by author name), otherwise "viewed" lands on slides nobody sees.
      const p = opPerson();
      if (p.statuses.length && window.DroboardStatusRing) {
        const ok = await DroboardStatusRing.open([{
          id: p.name, name: p.name, avatar: p.avatar, statuses: p.statuses,
        }], p.name);
        if (ok) return;
      }
      location.href = profileHref(p.name);
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

  /* ── Discussion inline ad slot (discussion:inline). Mounted after the OP so
     the slot auto-fills from the central inventory. ── */
  async function mountAd() {
    const el = document.querySelector('[data-ad-slot="discussion:inline"]');
    if (!el) return;
    if (window.DroboardAdSlot) {
      await DroboardAdSlot.mount(el, { slot: 'discussion:inline', page: 'discussion' });
    }
  }

  /* ── Comments: live from GET /api/comments?scope=discussion. ── */
  async function mountComments() {
    const mount = document.getElementById('commentsPlaceholder');
    if (!window.DroboardComments) {
      mount.innerHTML = '<div class="empty">comment-section.js missing</div>';
      return;
    }
    try {
      const comments = await threadComments();
      const me = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
      DroboardComments.attach('#commentsPlaceholder', {
        title: 'Replies',
        comments: comments,
        currentUser: { name: me.name || 'You', avatar: me.avatar || '' },
        collapsible: false,
        startOpen: true,
        requireTeam: false,
        getCommentUrl: (c) => location.href.split('#')[0] + '#comment-' + (c && c.id),
        onPost: () => toast('💬 Reply posted'),
        onReply: () => toast('💬 Reply posted'),
        onEdit: () => toast('✏️ Updated'),
        onProfileClick: (c) => { if (c && c.name) location.href = profileHref(c.name); },
      });
    } catch (e) {
      mount.innerHTML = '<div class="empty">Could not load replies — ' + esc((e && e.message) || 'network error') + '</div>';
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
    try {
      await loadThread();
    } catch (err) {
      const msg = (err && err.message) || 'network error';
      const op = document.getElementById('opMount');
      if (op) op.innerHTML = '<div class="empty">Could not load this discussion — ' + esc(msg) + '</div>';
      const cm = document.getElementById('commentsPlaceholder');
      if (cm) cm.innerHTML = '';
      const sub = document.getElementById('hubSub');
      if (sub) sub.textContent = 'Discussion';
      toast('Could not load discussion');
      return;
    }
    initWiring();
    renderOp();
    await mountAd();
    await mountComments();
    scrollToComment();
  }

  window.DiscussionPage = { init, toast, toggleTheme, renderOp };
})();
