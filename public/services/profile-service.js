/* ═══════════════════════════════════════════════════════════════
   PROFILE SERVICE
   Profile page orchestration. HTML calls ProfilePage.init().
   Live only: every render reads the profile from GET /api/users/:handle
   (posts arrive card-ready via posts.service shape) and every write
   goes through ProfileData's real endpoints. Failures surface as the
   page's error state — nothing falls back to seed data.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let PROFILE = null;
  let VIEW_HANDLE = null;
  let ME_HANDLE = null;
  let REQ_HANDLE = null;   // the raw ?u= param, null when it's my own profile
  let IS_OWNER = false;
  let IS_GUEST = false;
  let RENDERED = {};
  let FEED_HOOKED = false;
  let LIB_INSTANCE = null;
  let _following = false;
  /* Role preview. Everything on the page reads PROFILE.isWriter, so a role
     preview is just flipping that one flag and re-running the render pipeline.
       'real'   → no preview, the page as it really is
       null     → the VISITOR view: what a non-owner sees (owner chrome gone)
       'reader' → forced role view (you're still the owner, just as a reader)
       'writer' → forced role view (you're still the owner, just as a writer) */
  let PREVIEW_ROLE = 'real';
  let REAL_IS_WRITER = false;
  let REAL_IS_WRITER_SET = false;
  let ACTIVE_TAB = 'feed';

  /* ── Owner visibility helper ───────────────────────────────────────
     The single predicate for "may owner-only chrome be on screen?".
     False on someone else's profile, and false while previewing as a
     visitor (PREVIEW_ROLE === null) so that preview shows the real thing.

     Rule of thumb for callers:
       • presentation → canSeeOwnerUI() / ownerOnly()   (menus, buttons, badges)
       • permissions  → IS_OWNER                        (pin, edit, delete, open) */
  function canSeeOwnerUI() {
    return !!IS_OWNER && PREVIEW_ROLE !== null;
  }
  /* Hide an element unless the owner should be seeing it. `showAs` is the
     display to restore when it is visible (e.g. 'flex'); omit it to let the
     element's CSS decide. Returns whether the element is now visible. */
  function ownerOnly(el, showAs) {
    if (!el) return false;
    const show = canSeeOwnerUI();
    el.style.display = show ? (showAs || '') : 'none';
    return show;
  }
  /* The top bar sits outside profileRoot, so its owner-only chrome (hamburger,
     wallet pill) has to be re-applied on every render, not just the first. */
  function applyTopBarVisibility() {
    ownerOnly(document.getElementById('menuBtn'), 'flex');
    ownerOnly(document.getElementById('coinPill'), 'inline-flex');
  }
  /* The role currently being displayed, honouring a forced preview. */
  function roleIsWriter() {
    if (PREVIEW_ROLE === 'writer') return true;
    if (PREVIEW_ROLE === 'reader') return false;
    return REAL_IS_WRITER;
  }

  const STATUS_LABEL = { ongoing: 'Ongoing', completed: 'Completed', paused: 'Paused' };

  /* ── Live transport (same contract as feed-service) ─────────────── */
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

  /* Genre catalogue for label pills — GET /api/genres (the Chief's
     catalogue). A failed load is a failed enrichment, not a failed page:
     the pills simply render without labels rather than inventing any. */
  let GENRES_ALL = [];
  async function loadGenres() {
    try {
      const r = await fetch(API_BASE + '/genres?limit=100', { credentials: 'include' });
      if (!r.ok) throw new Error('Genres API failed: ' + r.status);
      const j = await r.json();
      GENRES_ALL = ((j && (j.items || j.data)) || []).map(g => ({ id: g.id || g.slug, label: g.name, icon: g.icon || '', members: g.members || '' }));
    } catch (e) { GENRES_ALL = []; }
  }

  function fmtN(n) { if (typeof n === 'string') return n; return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

  function toast(msg, dur) {
    dur = dur || 2500;
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), dur);
  }

  function bookStatus(b, i) {
    /* The backend owns book status; anything it doesn't vouch for reads as
       ongoing (the server's own default) — never a rotated guess. */
    if (b && b.status && STATUS_LABEL[b.status]) return b.status;
    return 'ongoing';
  }

  /* ── Theme ── */
  const THEME_KEY = 'droboardTheme';
  function loadSavedTheme() { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  function applyThemeIcon(t) { var el = document.getElementById('themeIcon'); if (el) el.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun'; }
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    applyThemeIcon(next);
    saveTheme(next);
    if (window.DroboardSearch) DroboardSearch.setTheme(next);
    if (window.DroboardNav) DroboardNav.setTheme(next);
  }
  function initTheme() {
    const saved = loadSavedTheme();
    document.documentElement.setAttribute('data-theme', saved);
    applyThemeIcon(saved);
  }

  /* ── Tab / Stat config ── */
  function getTabsForProfile(p) {
    const tabs = [{ id: 'feed', label: '🏠 Feed' }];
    if (p.isWriter) tabs.push({ id: 'books', label: '📖 Books', badge: (p.books || []).length });
    /* A profile's Library is its owner's private saved list, so it only
       exists for owner chrome — never for a stranger, nor in the visitor
       preview that stands in for one. */
    else if (canSeeOwnerUI()) tabs.push({ id: 'library', label: '📚 Library', badge: (p.library || []).length });
    tabs.push({ id: 'collections', label: '📂 Collections', badge: (p.collections || []).length });
    tabs.push({ id: 'following', label: '👥 Following' });
    tabs.push({ id: 'about', label: '✦ About' });
    return tabs;
  }
  async function getStatsForProfile(p) {
    const s = p.stats || {};
    if (p.isWriter) return [
      { label: 'Following', value: s.following, cls: '' },
      { label: 'Followers', value: s.followers, cls: 'r' },
      { label: 'Books', value: s.books, cls: 'b' },
      { label: 'Reads', value: s.reads, cls: 'r' },
      { label: 'Likes', value: s.likes, cls: 'g' },
    ];
    var _rank = null;
    // ReaderLeague.myRank() is async — must be awaited, otherwise _rank is a
    // Promise (truthy) and _rank.rank renders as "undefined".
    try {
      if (window.ReaderLeague && !p.isWriter && typeof ReaderLeague.myRank === 'function') {
        _rank = await ReaderLeague.myRank();
      }
    } catch (e) { _rank = null; }
    return [
      { label: 'Following', value: s.following, cls: '' },
      { label: 'Followers', value: s.followers, cls: 'r' },
      (_rank && _rank.rank)
        ? { label: 'Rank', value: '#' + _rank.rank, cls: 'gold', href: 'leaderboard.html', sub: _rank.endsIn }
        : { label: 'Saved', value: s.saved, cls: 'b' },
      { label: 'Time Spent', value: (Number(s.readingHours) || 0) + 'h', cls: 'g' },
      { label: 'Streak', value: (Number(s.streak) || 0) + 'd', cls: '' },
    ];
  }

  /* ── Coin balance (gold) — live wallet via StoreService ── */
  async function loadCoinBalance(){
    let coins=0;
    try{
      if(window.StoreService){
        if (StoreService.syncBalance) await StoreService.syncBalance();
        if (StoreService.getBalance) coins = StoreService.getBalance().coins;
      }
    }catch(e){}
    const el=document.getElementById('coinBalance');
    if(el) el.textContent = coins>=1000 ? (coins/1000).toFixed(1)+'K' : String(coins||0);
  }

  /* ── My Circle helpers (same as feed) ──
     Boards are the live genre catalogue (GET /api/genres, loaded by
     loadGenres); "joined" is the reader's own genre row on the User —
     both straight from the API, no seeded lineup. */
  function getMyBoardsForProfile(){
    const all = GENRES_ALL.map(g => ({
      id: g.id, name: g.label,
      icon: g.icon || 'fa-layer-group',
      members: g.members || '',
    }));
    const joinedIds = new Set((PROFILE && PROFILE.genres) || []);
    return {
      joined: all.filter(g => joinedIds.has(g.id)).slice(0, 3),
      rest: all.filter(g => !joinedIds.has(g.id)),
      all: all,
    };
  }
  function getMyCollectionsForProfile(){
    const mine = ((PROFILE && PROFILE.collections) || []).map((c,i)=> ({id:c.id||('coll_'+i), name:c.name||'Collection', count:c.count||0}));
    return { joined: mine.slice(0,2), rest: mine.slice(2), all: mine };
  }

  /* ── Render header / actions / stats ── */
  function renderHeader(p) {
    document.getElementById('heroBg').style.backgroundImage = `url('${p.cover}')`;
    document.getElementById('avImg').src = p.avatar;
    document.getElementById('avImg').alt = p.name;
    document.getElementById('avRing').className = 'av-ring ' + (p.isWriter ? 'role-writer' : 'role-reader');
    try {
      var _rg = (window.ReaderLeague && ReaderLeague.reigning) ? ReaderLeague.reigning() : null;
      if (_rg && _rg.handle && (p.handle === _rg.handle || p.username === _rg.handle)) {
        document.getElementById('avRing').className += ' champ';
      }
    } catch (e) {}
    document.getElementById('verifiedBadge').style.display = p.verified ? 'flex' : 'none';
    refreshStoryRing(p);
    document.getElementById('profileName').textContent = p.name;
    document.getElementById('roleTag').className = 'role-tag ' + (p.isWriter ? 'writer' : 'reader');
    document.getElementById('roleTag').textContent = p.isWriter ? '✍️ Writer' : '📖 Reader';
    document.getElementById('profileHandle').textContent = '@' + p.handle;
    document.getElementById('verifiedInline').style.display = p.verified ? 'inline-flex' : 'none';
    document.getElementById('profileBio').textContent = p.bio;
    ownerOnly(document.getElementById('heroEditBtn'), 'flex');
    ownerOnly(document.getElementById('heroStatsBtn'), 'flex');
    const shown = (p.genres || []).slice(0, 5);
    document.getElementById('genrePillsDisplay').innerHTML = shown.map(id => {
      const g = GENRES_ALL.find(x => x.id === id);
      return g ? `<a class="genre-pill" style="text-decoration:none" href="genre-hub.html?genre=${encodeURIComponent(g.id)}">${g.label}</a>` : '';
    }).join('') + (canSeeOwnerUI() ? `<div class="genre-pill inactive" id="editGenresPill">+ Edit</div>` : '');
    const pill = document.getElementById('editGenresPill');
    if (pill) pill.addEventListener('click', openGenreEdit);
  }

  async function handleStatusSlide(slide) {
    if (!window.DroboardStatus) throw new Error('Status service missing');
    await window.DroboardStatus.post(slide);
    try { refreshStoryRing(PROFILE); } catch (e) {}
    toast('🟢 Status posted to your story!');
  }
  /* ── Story ring + post entry on avatar ──
     Tap avatar = VIEW (opens viewer if a live story exists).
     Plus badge (owner) = POST (composer straight to status). */
  function myLiveSlides() {
    try { return (window.DroboardStatus && window.DroboardStatus.slides()) || []; }
    catch (e) { return []; }
  }
  function storySlidesFor(p) {
    var handle = (p && (p.handle || p.username)) || VIEW_HANDLE || '';
    if (IS_OWNER) {
      return myLiveSlides().map(function (s, i) {
        var viewed = !!s.viewed;
        try {
          if (window.StatusStore && StatusStore.isStatusSeen) viewed = StatusStore.isStatusSeen('you', s, i);
        } catch (e) {}
        return {
          id: s.id, bg: s.bg, quote: s.quote, caption: s.caption,
          storyRef: s.storyRef || null, viewed: viewed,
          views: s.views != null ? s.views : 0,
          time: s.time || 'Just now',
        };
      });
    }
    if (p && p.statuses && p.statuses.length) {
      return p.statuses.map(function (s, i) {
        var viewed = !!s.viewed;
        try {
          if (window.StatusStore && StatusStore.isStatusSeen) viewed = StatusStore.isStatusSeen(handle, s, i);
        } catch (e) {}
        return {
          id: s.id, bg: s.bg, quote: s.quote, caption: s.caption,
          storyRef: s.storyRef || null, viewed: viewed,
          views: s.views, time: s.time || 'Just now',
        };
      });
    }
    try {
      if (window.DroboardStatus && DroboardStatus.profileStatuses) {
        return DroboardStatus.profileStatuses(handle);
      }
    } catch (e) {}
    return [];
  }
  /* One viewer-ready entry for the profile's author. */
  function storyEntryFor(p) {
    if (!p) return null;
    var slides = storySlidesFor(p);
    if (!slides.length) return null;
    var handle = String((p.handle || p.username || '').replace(/^@/, ''));
    var wid = IS_OWNER ? 'you' : ('wr:' + handle.toLowerCase());
    var ring = 'ring-has';
    try {
      if (window.StatusStore && StatusStore.register) {
        ring = StatusStore.register(IS_OWNER ? 'you' : handle, slides, { isMine: IS_OWNER });
      }
    } catch (e) {}
    return {
      id: wid, handle: handle, name: IS_OWNER ? (p.name || 'You') : (p.name || handle),
      avatar: p.avatar || '', statuses: slides,
      ring: ring || 'ring-has', likes: 0, threads: slides.length,
    };
  }
  function refreshStoryRing(p) {
    var ring = document.getElementById('avRing');
    var plus = document.getElementById('avPlus');
    var img = document.getElementById('avImg');
    if (!ring) return;
    var isOwner = (typeof IS_OWNER !== 'undefined') ? IS_OWNER : true;
    var entry = storyEntryFor(p);
    var slides = entry ? entry.statuses : [];
    var has = slides.length > 0;
    var wid = entry ? entry.id : (isOwner ? 'you' : (VIEW_HANDLE || (p && p.handle) || ''));
    var storeRing = (window.StatusStore && StatusStore.ringOf) ? StatusStore.ringOf(wid) : null;
    var viewedAll = has && (storeRing === 'ring-viewed' || entry.ring === 'ring-viewed');
    var isChamp = false;
    try {
      var _rg = (window.ReaderLeague && ReaderLeague.reigning) ? ReaderLeague.reigning() : null;
      isChamp = !!(_rg && _rg.handle && (p.handle === _rg.handle || p.username === _rg.handle));
    } catch (e) {}
    /* No story → neutral ring. Story → red conic. Story viewed → grey.
       Champion keeps the gold frame. */
    var base = 'av-ring' + (isChamp ? ' champ' : (has ? (viewedAll ? ' viewed-story' : ' ' + (p.isWriter ? 'role-writer' : 'role-reader') + ' has-story') : ' no-story'));
    ring.className = base;
    if (img) { img.style.cursor = has ? 'pointer' : ''; img.onclick = null; ring.onclick = null;
      if (has) {
        var open = function () {
          if (!window.openStatusViewer) {
            if (window.ensureStatusViewer) {
              window.ensureStatusViewer().then(function (ok) {
                if (ok) window.openStatusViewer([entry], wid);
                else toast('Story viewer missing');
              });
              return;
            }
            toast('Story viewer missing');
            return;
          }
          window.openStatusViewer([entry], wid);
        };
        img.onclick = open; ring.onclick = open;
      } else if (isOwner) {
        var hint = function () { toast('No story yet — tap + to post one'); };
        img.onclick = hint; ring.onclick = hint;
      }
    }
    if (plus) {
      plus.style.display = isOwner ? 'flex' : 'none';
      plus.onclick = function (e) {
        if (e) e.stopPropagation();
        if (!window.DroboardPostComposer) { toast('Composer failed to load.'); return; }
        DroboardPostComposer.open({ type: 'status', author: { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified }, onStatusSlide: handleStatusSlide });
      };
    }
  }

  /* ── Status-viewer sync (component contract) ──
     The viewer emits (wid, ring) via window.onStatusViewerChange. Chain
     (never clobber); refresh BOTH ring surfaces: header avatar + post-card
     avatar borders. Seen state lives in StatusStore (per status). */
  var _prevStatusCb = window.onStatusViewerChange;
  window.onStatusViewerChange = function (wid, ring, name) {
    if (typeof _prevStatusCb === 'function') { try { _prevStatusCb(wid, ring, name); } catch (e) {} }
    if (!PROFILE) return;
    var entry = null;
    try { entry = storyEntryFor(PROFILE); } catch (e) {}
    if (!entry) return;
    if (window.StatusStore && StatusStore.key) {
      var mineKey = StatusStore.key(entry.id);
      // The viewer keys on the author's name; entry.id is the same person.
      var gotKey = StatusStore.key(name || wid);
      if (gotKey && mineKey !== gotKey) return;
      ring = StatusStore.ringOf(mineKey) || ring;
    }
    try { refreshStoryRing(PROFILE); } catch (e) {}
    /* Feed cards on this page derive their own ring from StatusStore via
       DroboardStatusRing.avatar() — stamping post.avatarRing from here only
       ever marked every card viewed, whoever the viewer had just played. */
  };

  function renderActionRow() {
    const el = document.getElementById('actionRow');
    if (canSeeOwnerUI()) {
      el.innerHTML = `<a class="pact edit" href="edit-profile.html">Edit Profile</a><button class="pact msg" id="msgEditorBtn" title="Message your editor"><i class="fas fa-paper-plane"></i></button>`;
      document.getElementById('msgEditorBtn').addEventListener('click', () => {
        // Try to get the assigned editor's handle from profile data, fall back to 'editor'
        const editorHandle = (PROFILE && PROFILE.editorHandle) || 'editor';
        window.location.href = 'chat.html?contact=' + encodeURIComponent(editorHandle);
      });
      return;
    }
    /* The server carries the viewer's follow flag on the profile payload. */
    const startedFollowing = !!PROFILE.isFollowing;
    _following = startedFollowing;
    el.innerHTML = `<button class="pact follow${startedFollowing ? ' ing' : ''}" id="followBtn">${startedFollowing ? '✓ Following' : '+ Follow'}</button>`;
    document.getElementById('followBtn').addEventListener('click', () => {
      if (PREVIEW_ROLE === null) { toast('👁 Visitor preview — following is disabled here.'); return; }
      toggleFollowOwner();
    });
  }

  async function toggleFollowOwner() {
    if (window.RequireAuth && !RequireAuth.ensure('follow this profile')) return;
    const willFollow = !_following;

    // Confirm before unfollowing
    if (!willFollow) {
      const handle = (PROFILE && PROFILE.handle) ? '@' + PROFILE.handle : 'this person';
      const confirmed = await showUnfollowConfirm(handle);
      if (!confirmed) return;
    }

    const btn = document.getElementById('followBtn');
    btn.disabled = true;
    try {
      const call = willFollow ? ProfileData.followUser : ProfileData.unfollowUser;
      await call(ME_HANDLE, VIEW_HANDLE);
      _following = willFollow;
      btn.textContent = _following ? '✓ Following' : '+ Follow';
      btn.className = 'pact follow' + (_following ? ' ing' : '');
      toast(_following ? `✅ Following @${PROFILE.handle}` : `Unfollowed @${PROFILE.handle}`);
    } catch (e) {
      toast('❌ ' + (e.message || 'Could not update follow — try again.'));
    }
    btn.disabled = false;
  }

  function showUnfollowConfirm(handle) {
    return new Promise((resolve) => {
      // Remove any existing confirm modal
      const existing = document.getElementById('unfollowConfirmModal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'unfollowConfirmModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,6,25,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px';
      modal.innerHTML = `
        <div style="background:var(--card,#fff);border:1px solid var(--border,#e8e5f0);border-radius:18px;padding:24px 22px;max-width:340px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center">
          <div style="font-size:28px;margin-bottom:12px">👋</div>
          <div style="font-size:15px;font-weight:800;color:var(--text,#17151b);margin-bottom:8px">Unfollow ${handle}?</div>
          <div style="font-size:12.5px;color:var(--text-muted,#635f6e);margin-bottom:22px;line-height:1.5">You can always follow them back.</div>
          <div style="display:flex;gap:10px">
            <button id="unfollowCancelBtn" style="flex:1;padding:11px;border-radius:11px;border:1px solid var(--border,#e8e5f0);background:var(--input-bg,#f7f5fc);color:var(--text,#17151b);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>
            <button id="unfollowConfirmBtn" style="flex:1;padding:11px;border-radius:11px;border:none;background:var(--red,#e0384d);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Unfollow</button>
          </div>
        </div>`;

      document.body.appendChild(modal);

      function cleanup(result) {
        modal.remove();
        resolve(result);
      }

      document.getElementById('unfollowConfirmBtn').addEventListener('click', () => cleanup(true));
      document.getElementById('unfollowCancelBtn').addEventListener('click', () => cleanup(false));
      modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(false); });
    });
  }

  async function renderStats(p) {
    const handle = p.handle || p.username || VIEW_HANDLE;
    const stats = await getStatsForProfile(p);
    document.getElementById('statsRow').innerHTML = stats.map(s => {
      const isFollow = s.label === 'Following' || s.label === 'Followers';
      const tab = s.label.toLowerCase();
      const href = s.href || (isFollow ? `followers.html?u=${encodeURIComponent(handle)}&tab=${tab}` : '');
      const linkable = href ? ` data-href="${href}" style="cursor:pointer"` : '';
      const title = s.sub ? ` title="${s.sub}"` : '';
      return `<div class="stat-item"${linkable}${title}><div class="stat-num ${s.cls}">${fmtN(s.value)}</div><div class="stat-label">${s.label}</div></div>`;
    }).join('');
    document.querySelectorAll('#statsRow .stat-item[data-href]').forEach(el => {
      el.addEventListener('click', () => location.href = el.dataset.href);
    });
  }
  function renderAchievements(p) {
    /* Chips come from the awards console via the profile payload
       (achievements[]) plus the reader's live league badges. */
    var list = (p.achievements || []).map(function(a){
      return { label:a.label || a.name, icon:a.icon, color:a.color || a.cls };
    });
    try {
      var lb = (window.ReaderLeague && typeof ReaderLeague.myBadges === 'function') ? ReaderLeague.myBadges() : [];
      lb.forEach(function (b) { list.unshift({ label: b.label, icon: b.icon, color: b.color }); });
    } catch (e) {}
    document.getElementById('achRow').innerHTML = list.map(function(a){
      var c = a.color || a.cls || '';
      if(c && c.indexOf('#')===0){
        var soft='rgba('+parseInt(c.slice(1,3),16)+','+parseInt(c.slice(3,5),16)+','+parseInt(c.slice(5,7),16)+',.12)';
        return '<div class="ach-chip" style="background:'+soft+';color:'+c+';border-color:'+c+'"><i class="fas '+(a.icon||'fa-star')+'"></i> '+a.label+'</div>';
      }
      return '<div class="ach-chip '+(c||'gold')+'"><i class="fas '+(a.icon||'fa-star')+'"></i> '+a.label+'</div>';
    }).join('');
  }
  function renderUpgradeStrip(p) {
    const el = document.getElementById('upgradeStrip');
    if (!el) return;
    if (!canSeeOwnerUI() || p.isWriter) { el.style.display = 'none'; el.innerHTML = ''; return; }

    /* Writer promotion is decided server-side (SE approval → grantWriterRole);
       per-submission review state lives in the Author Center, not on this
       page. Here: one honest call to action for readers, nothing staged. */
    el.style.display = 'flex';
    el.innerHTML =
      '<i class="fas fa-feather-pointed"></i>' +
      '<div class="upgrade-strip-text">' +
      '  <div class="upgrade-strip-title">Ready to publish?</div>' +
      '  <div class="upgrade-strip-sub">Create your first book \u2014 once an editor approves it, you become a writer.</div>' +
      '</div>' +
      '<button class="upgrade-strip-btn" onclick="location.href=\'create.html\'">Create a book</button>';
  }

  /* ── Tabs ── */
  function renderTabs(p) {
    const tabs = getTabsForProfile(p);
    /* Keep the tab you were on across a re-render (e.g. a role preview);
       the role may drop that tab — Books↔Library — so fall back to feed. */
    const ids = tabs.map(t => t.id);
    if (ids.indexOf(ACTIVE_TAB) === -1) ACTIVE_TAB = 'feed';
    document.getElementById('profileTabs').innerHTML = tabs.map((t) =>
      `<div class="ptab${t.id === ACTIVE_TAB ? ' active' : ''}" data-tab="${t.id}">${t.label}${t.badge ? `<span class="ptab-badge">${t.badge}</span>` : ''}</div>`
    ).join('');
    document.querySelectorAll('.ptab').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab)));
    RENDERED = {};
    switchTab(ACTIVE_TAB);
  }
  function switchTab(tab) {
    /* The tab must exist in the current mode: a role preview or a
       non-owner view can drop it (Library), and activating an orphaned
       panel would show content with no highlighted tab. */
    if (!document.querySelector('.ptab[data-tab="' + tab + '"]')) tab = 'feed';
    ACTIVE_TAB = tab;
    document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(pnl => pnl.classList.toggle('active', pnl.id === 'panel-' + tab));
    if (!RENDERED[tab]) { renderTabContent(tab); RENDERED[tab] = true; }
  }
  function renderTabContent(tab) {
    if (!PROFILE) return;
    if (tab === 'feed') renderFeed(PROFILE);
    else if (tab === 'books') renderBooks(PROFILE);
    else if (tab === 'library') renderLibrary(PROFILE);
    else if (tab === 'collections') renderCollections(PROFILE);
    else if (tab === 'following') renderFollowing(PROFILE);
    else if (tab === 'about') renderAbout(PROFILE);
  }

  /* ── Books ── */
  function renderBooks(p) {
    document.getElementById('booksCountTitle').textContent = (p.books || []).length + ' Books';
    if (canSeeOwnerUI() && p.isWriter && !document.getElementById('authorCenterLink')) {
      const link = document.createElement('a');
      link.id = 'authorCenterLink';
      link.className = 'sh-more';
      link.href = '../author/author-center.html';
      link.innerHTML = '<i class="fas fa-gauge" style="font-size:9px"></i> Author Center';
      const more = document.querySelector('#panel-books .sh-more');
      if (more) more.before(link);
    }
    const el = document.getElementById('booksList');
    if (!p.books || !p.books.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-book"></i>No books published yet.</div>`; return; }
    const books = p.books.map((b, i) => ({ id: b.id, title: b.title, genre: b.cat, cover: b.cover, reads: b.reads, likes: b.likes, chapters: b.chapters, status: bookStatus(b, i) }));
    DroboardBookCard.renderList(el, books, { onOpen: (book) => { location.href = `book-reader.html?id=${encodeURIComponent(book.id)}`; } });
  }

  /* ── Library ── */
  function renderLibrary(p) {
    document.getElementById('libSubtitle').textContent = `${(p.library || []).length} saved ${((p.library || []).length === 1) ? 'story' : 'stories'}`;
    document.getElementById('libFootnote').textContent = '';
    const items = (p.library || []).map((it, i) => ({ id: it.id || ('lib_' + i), cover: it.cover, cat: it.cat, title: it.title, author: it.author, status: it.badge === 'new' ? 'saved' : 'reading', progress: 0, lastCh: it.ch || '' }));
    LIB_INSTANCE = DroboardLibrary.attach('#libraryMount', { items, subtitleEl: '#libSubtitle', footnoteEl: '#libFootnote', onOpen: (item) => { location.href = 'bridge.html?id=' + encodeURIComponent((item && item.id) || ''); } });
  }

  /* ── Collections ── uses component/collection-card.js (DroboardCollectionCard) */
  function renderCollections(p) {
    const list = document.getElementById('collectionsList');
    if (!window.DroboardCollectionCard) {
      list.innerHTML = `<div class="panel-empty"><i class="fas fa-folder"></i>Collections component failed to load.</div>`;
      return;
    }
    // Re-attach on every render so callbacks always close over the current profile
    DroboardCollectionCard.attach(list, {
      hrefFor: (c) => 'collection.html?id=' + encodeURIComponent(c.id),
      onShare: (c) => { if (window.openShareModal) openShareModal({ title: c.name, sub: `${c.count} stories · ${p.name}`, img: (c.covers || [])[0], url: 'https://droboard.app/collection/' + c.id, contentId: c.id, contentType: 'collections' }); },
      onCreateNew: openNewCollection,
      onManage: canSeeOwnerUI() ? handleCollAction : undefined,
      createButtonEl: document.getElementById('newCollBtn'),
    });
    const withIds = (p.collections || []).map((c, i) => ({ ...c, id: c.id || ('coll_' + i) }));
    if (!withIds.length) { list.innerHTML = `<div class="panel-empty" style="grid-column:1/-1"><i class="fas fa-folder"></i>No collections yet.</div>`; return; }
    DroboardCollectionCard.setCollections(withIds);
  }

  /* ── Following — via FollowList component (paginated, reusable — same as genre hub members) ── */
  let followApi = null;
  function renderFollowing(p) {
    const handle = PROFILE.handle || PROFILE.username || VIEW_HANDLE;
    const intro = document.getElementById('followingIntro');
    if (intro) intro.innerHTML = `<span>Following <strong style="color:var(--tx-high)">${p.stats.following}</strong> writers &amp; readers</span><a href="followers.html?u=${encodeURIComponent(handle)}&tab=following" style="float:right;color:var(--acc);font-weight:700;text-decoration:none">View all ›</a><div style="clear:both"></div>`;
    const el = document.getElementById('followingList');
    if (!el) return;
    // Use FollowList if available, else fallback to inline (so tab never breaks)
    if (window.FollowList) {
      const list = (p.following || []).map(f => ({ handle: f.name, name: f.name, avatar: f.av, av: f.av, meta: f.meta, following: !!f.following }));
      if (!followApi) {
        followApi = FollowList.attach('#followingList', {
          perPage: 8,
          emptyText: 'Not following anyone yet.',
          onProfileClick: (h) => location.href='profile.html?u='+encodeURIComponent(h),
          onToggle: async (handle, item, btn) => {
            if (!item) return;
            btn.disabled = true;
            const idx = PROFILE.following.findIndex(x=>x.name===handle);
            const row = idx !== -1 ? PROFILE.following[idx] : item;
            try {
              const call = row.following ? ProfileData.unfollowUser : ProfileData.followUser;
              await call(ME_HANDLE, row.name);
              row.following = !row.following;
              item.following = row.following;
              const cur = followApi.getData(); const cItem = cur.find(x=>x.handle===handle); if(cItem) cItem.following = row.following;
              followApi.render();
              toast(row.following ? `Following @${handle}` : `Unfollowed @${handle}`);
            } catch (e) {
              /* keep the row as-is and say why it failed */
              toast('❌ ' + (e.message || 'Could not update follow — try again.'));
            }
            btn.disabled = false;
          }
        });
      }
      followApi.setData(list);
      // force re-render if tab was hidden when first attached (display:none → pager mis-measure)
      setTimeout(()=> followApi.render(), 30);
      return;
    }
    // Fallback inline (if component missing)
    if (!p.following || !p.following.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-user-group"></i>Not following anyone yet.</div>`; return; }
    el.innerHTML = p.following.map((f, i) => `<div class="follow-item"><a class="follow-av" href="profile.html?u=${encodeURIComponent(f.name)}"><img src="${f.av}" loading="lazy"/></a><div class="follow-info"><div class="follow-name">@${f.name}</div><div class="follow-meta">${f.meta}</div></div><button class="follow-btn${f.following ? ' ing' : ''}" data-i="${i}">${f.following ? '✓ Following' : '+ Follow'}</button></div>`).join('');
  }

  /* ── About ── */
  function renderAbout(p) {
    document.getElementById('aboutIntro').textContent = p.isWriter ? `A ${p.location.split(',')[0]}-based writer sharing stories on Droboard.` : `A ${p.location.split(',')[0]}-based reader on Droboard.`;
    document.getElementById('aboutLocation').textContent = p.location;
    document.getElementById('aboutJoined').textContent = p.joinedLabel;
    document.getElementById('aboutGenreDisplay').innerHTML = (p.about?.favoriteGenres || []).map(id => {
      const g = GENRES_ALL.find(x => x.id === id);
      return g ? `<div class="genre-pill">${g.label}</div>` : '';
    }).join('');
    document.getElementById('aboutExtra').innerHTML = (p.about?.extra || []).map(e => `
      <div class="about-item"><div class="about-icon"><i class="fas ${e.icon}" style="color:var(--acc)"></i></div>
        <div><div class="about-label">${e.label}</div><div class="about-val">${esc(e.value)}</div></div></div>`).join('');
  }

  /* ── Feed ── */
  function adaptPost(post) {
    // No avatarRing: post-card asks the shared ring, which derives red/grey/
    // none from StatusStore for that author.
    return Object.assign({}, post, { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified, type: post.type, mine: canSeeOwnerUI(), pinnable: canSeeOwnerUI() });
  }
  /* Shared picker hooks (component contract): getState reads the profile
     post, onReact mutates it. Mirrors feed-service's counterHooks so the
     multi-emoji buckets + top-3 badges behave identically here. */
  var _FEED_POSTS = []; // adapted posts handed to DroboardPostCard (picker reads these)
  function findReactPost(id) {
    return _FEED_POSTS.find(x => String(x.id) === String(id)) || null;
  }
  /* attachCounters hooks — picker owns all toggle math; host supplies the
     server's reaction buckets (post.reactions) and persists the choice to
     the API. Mirrors feed-service's counterHooks so the multi-emoji buckets
     + top-3 badges behave identically here. */
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
          if (window.DroboardPostCard) DroboardPostCard.update(p);
        }).catch(e => toast(e.message || 'Could not save your reaction'));
      },
    };
  }
  function ensureFeedComponents() {
    if (FEED_HOOKED) return;
    FEED_HOOKED = true;
    const feedList = document.getElementById('feedList');
    if (window.DroboardReactionPicker) DroboardReactionPicker.attachCounters(feedList, counterHooks());
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onEdit: (post) => {
          if(!window.DroboardPostComposer){ toast('✏️ Edit — composer missing'); return; }
          DroboardPostComposer.open({
            editPost: post,
            author: { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified },
            onSubmit: async (updated, isEdit) => {
              if(!isEdit) return;
              const patch = Object.assign({}, updated);
              // keep original id/time if composer generated new id
              patch.id = post.id;
              try {
                const res = await ProfileData.updatePost(VIEW_HANDLE, post.id, patch);
                PROFILE = res; renderFeed(PROFILE); toast('✅ Post updated');
              } catch (e) { toast('❌ ' + (e.message || 'Could not update the post')); }
            }
          });
        },
        onDelete: async (post) => {
          try {
            const updated = await ProfileData.deletePost(VIEW_HANDLE, post.id);
            PROFILE = updated; renderFeed(PROFILE); toast('🗑️ Post deleted');
          } catch (e) { toast('❌ ' + (e.message || 'Could not delete the post')); }
        },
        onPin: async (post) => {
          if (!IS_OWNER) { toast('Only the profile owner can pin.'); return; }
          try {
            const updated = await ProfileData.pinPost(VIEW_HANDLE, post.id, true);
            PROFILE = updated; renderFeed(PROFILE); toast('📌 Pinned to top');
          } catch (e) { toast('❌ ' + (e.message || 'Could not pin the post')); }
        },
        onUnpin: async (post) => {
          if (!IS_OWNER) { toast('Only the profile owner can unpin.'); return; }
          try {
            const updated = await ProfileData.pinPost(VIEW_HANDLE, post.id, false);
            PROFILE = updated; renderFeed(PROFILE); toast('Unpinned');
          } catch (e) { toast('❌ ' + (e.message || 'Could not unpin the post')); }
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
        onLess: () => toast('Got it — showing less of this.'),
        onFollow: (post) => toast('Following @' + post.name),
        onMute: (post) => toast('Muted @' + post.name),
        onCopyLink: (post) => { navigator.clipboard?.writeText('https://droboard.app/post/' + post.id).catch(() => {}); toast('🔗 Link copied'); },
      });
    }
    if (window.DroboardPostCard) {
      DroboardPostCard.attach(feedList, {
        getReactionHTML: (post) => window.DroboardReactionPicker ? DroboardReactionPicker.renderTrigger(post.id, { liked: post.liked, likeCount: post.likes }) : undefined,
        onAvatarClick: () => {
          var entry = null;
          try { entry = storyEntryFor(PROFILE); } catch (e) {}
          if (entry && window.openStatusViewer) {
            openStatusViewer([entry], entry.id);
            return;
          }
          location.href = 'profile.html?u=' + encodeURIComponent(PROFILE.handle);
        },
        onNameClick: () => { location.href = 'profile.html?u=' + encodeURIComponent(PROFILE.handle); },
        onComment: (post) => {
          if (post && post.type === 'debate') { location.href = 'debate.html?id=' + encodeURIComponent(post.id); return; }
          location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || '');
        },
        onOpenPost: (post) => {
          if (post && post.type === 'debate') { location.href = 'debate.html?id=' + encodeURIComponent(post.id); return; }
          location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || '');
        },
        onShare: (post) => { if (!window.openShareModal) return; openShareModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, url: 'https://droboard.app/post/' + post.id, contentId: post.id, contentType: 'posts' }); },
        onSave: (post) => { if (!window.openSaveModal) return; openSaveModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, storyId: post.id, type: 'post' }); },
        onDots: (post, anchorEl) => { try { window._lastDotsAnchor = anchorEl || null; } catch(e){} if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchorEl); },
        onJoinAma: () => toast('🎙️ Joining AMA…'),
        onPollVote: (post, i) => {
          if (!post.poll) return;
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
          if (!post.debateData) return;
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
        onOpenLink: (post) => {
          const ref = (post && (post.storyRef || post.chapterRef)) || null;
          const sid = ref && (ref.id || '');
          const ttl = (ref && (ref.title || '')) || PROFILE.name;
          if (sid && window.ReadingHistory && !ReadingHistory.guardRecommend(sid, ttl)) return;
          if (sid) { location.href = 'bridge.html?id=' + encodeURIComponent(sid); return; }
          toast('📖 Opening story…');
        },
      });
    }
    /* The save modal persists through /api/saves (saves-bridge); this hook
       only mirrors the new saved flag onto the card. */
    window.onDroboardSaveChange = (storyId, isSaved) => {
      if (!storyId) return;
      const post = findReactPost(storyId);
      if (post) { post.saved = isSaved; if (window.DroboardPostCard) DroboardPostCard.update(post); }
    };
  }
  function renderFeed(p) {
    ensureFeedComponents();
    const posts = (p.posts || []).map(adaptPost);
    posts.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
    _FEED_POSTS = posts;
    window._FEED_POSTS = _FEED_POSTS; // expose for share-modal optimistic insert
    if (!window.DroboardPostCard) { document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-triangle-exclamation"></i>Post component failed to load.</div>`; return; }
    DroboardPostCard.setPosts(posts);
    if (!posts.length) document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-inbox"></i>No posts yet.</div>`;
  }

  /* ── New Post Composer ── */
  function openNewPostComposer() {
    closeDrawer();
    if (!window.DroboardPostComposer) { toast('Composer failed to load.'); return; }
    const bookStories = (PROFILE.books || []).map(b => ({ id: b.id, title: b.title, author: PROFILE.name || '', cat: b.cat, cover: b.cover }));
    DroboardPostComposer.open({
      author: { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified },
      stories: bookStories,
      draftKey: 'dro_profile_composer_draft',
      defaultType: 'text',
      onStatusSlide: handleStatusSlide,
      onSubmit: async (post) => {
        if (post && post.type === 'status') { await handleStatusSlide(post.statusSlide); return; }
        try {
          const updated = await ProfileData.createPost(VIEW_HANDLE, post);
          PROFILE = updated;
          // Switch to feed tab first so the user sees their post
          switchTab('feed');
          // Re-render feed with updated posts — new post is at the top
          renderFeed(PROFILE);
        } catch (e) {
          toast('❌ ' + (e.message || 'Could not create the post — try again.'));
        }
      },
    });
  }

  /* ── Genre Edit ── */
  function openGenreEdit() {
    if (!IS_OWNER) { toast('You can only edit your own genres.'); return; }
    const active = new Set(PROFILE.genres || []);
    const grid = document.getElementById('genreTogGrid');
    grid.innerHTML = GENRES_ALL.map(g => `<div class="genre-tog${active.has(g.id) ? ' on' : ''}" data-gid="${g.id}">${g.label}</div>`).join('');
    grid.querySelectorAll('.genre-tog').forEach(el => el.addEventListener('click', () => el.classList.toggle('on')));
    document.getElementById('genreEditOv').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeGenreEdit() { document.getElementById('genreEditOv').classList.remove('open'); document.body.style.overflow = ''; }
  async function saveGenres() {
    const ids = [...document.querySelectorAll('#genreTogGrid .genre-tog.on')].map(el => el.dataset.gid);
    try {
      const updated = await ProfileData.updateGenres(VIEW_HANDLE, ids);
      PROFILE = updated;
      renderHeader(PROFILE);
      if (RENDERED.about) renderAbout(PROFILE);
      closeGenreEdit();
      toast('✅ Genres saved!');
    } catch (e) {
      toast('❌ ' + (e.message || 'Could not save genres — try again.'));
    }
  }

  /* ── COLLECTION STORY PICKER — books + library, shared by the
     create and manage sheets. Covers come from the chosen stories. ── */
  let LIVE_STORIES = null;
  async function fetchLiveStories() {
    if (LIVE_STORIES) return LIVE_STORIES;
    try {
      const res = await fetch('/api/collections/eligible-stories', { credentials: 'include' });
      if (!res.ok) return null;
      const j = await res.json();
      if (j && Array.isArray(j.items)) { LIVE_STORIES = j; return j; }
    } catch (e) {}
    return null;
  }
  function eligibleStories() {
    const seen = new Set();
    const out = [];
    const push = (s) => {
      const k = String(s.title || '').toLowerCase();
      if (!s.title || !s.cover || seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    if (LIVE_STORIES && Array.isArray(LIVE_STORIES.items) && LIVE_STORIES.items.length) {
      LIVE_STORIES.items.filter(s => s.eligible !== false).forEach(s => push({
        id: s.id, title: s.title, cat: s.genre, author: s.author,
        cover: s.cover, badge: '', reads: '',
      }));
      if (out.length) return out;
    }
    (PROFILE.books || []).forEach(b => push({ id: b.id || ('book_' + b.title), title: b.title, cat: b.cat, author: PROFILE.name, cover: b.cover, badge: '', reads: b.reads || '' }));
    (PROFILE.library || []).forEach((l, i) => push({ id: l.id || ('lib_' + i), title: l.title, cat: l.cat, author: l.author, cover: l.cover, badge: '', reads: '' }));
    return out;
  }
  /* ── STORY PICKER + LIVE SEARCH — selection lives in state (not DOM)
     so filtering never loses picked stories. ── */
  const PICK_STATE = {};
  function pickSearchId(gridId) { return gridId === 'ncStoryGrid' ? 'ncStorySearch' : 'mcStorySearch'; }
  function paintStoryGrid(gridId) {
    const grid = document.getElementById(gridId);
    const st = PICK_STATE[gridId];
    if (!grid || !st) return;
    if (!st.stories.length) {
      grid.innerHTML = `<div class="panel-empty" style="grid-column:1/-1"><i class="fas fa-book"></i>No stories available yet — publish or save stories first.</div>`;
      return;
    }
    const q = ((document.getElementById(pickSearchId(gridId)) || {}).value || '').trim().toLowerCase();
    const hits = !q ? st.stories : st.stories.filter(s =>
      ((s.title || '').toLowerCase().indexOf(q) !== -1) || ((s.author || '').toLowerCase().indexOf(q) !== -1));
    if (!hits.length) {
      grid.innerHTML = `<div class="panel-empty" style="grid-column:1/-1"><i class="fas fa-search"></i>No stories match your search.</div>`;
      return;
    }
    grid.innerHTML = hits.map(s => `
      <div class="story-pick${st.selected.has(String(s.id)) ? ' on' : ''}" data-sid="${escAttr(s.id)}">
        <img src="${s.cover}" loading="lazy" alt=""/>
        <div class="story-pick-check"><i class="fas fa-check"></i></div>
        <div class="story-pick-title">${s.title}</div>
      </div>`).join('');
    grid.querySelectorAll('.story-pick').forEach(el => el.addEventListener('click', () => {
      const id = String(el.dataset.sid);
      if (st.selected.has(id)) { st.selected.delete(id); el.classList.remove('on'); }
      else { st.selected.add(id); el.classList.add('on'); }
    }));
  }
  function renderStoryPicker(gridId, selectedIds) {
    PICK_STATE[gridId] = {
      stories: eligibleStories(),
      selected: new Set((selectedIds || []).map(String)),
    };
    const searchEl = document.getElementById(pickSearchId(gridId));
    if (searchEl) searchEl.value = '';
    paintStoryGrid(gridId);
    return {
      get: () => {
        const st = PICK_STATE[gridId];
        if (!st) return [];
        return st.stories.filter(s => st.selected.has(String(s.id)));
      },
    };
  }

  /* ── NEW COLLECTION — thin UI over ProfileData.createCollection ── */
  let NC_PICK = null;
  function openNewCollection() {
    if (!PROFILE) return;
    if (!IS_OWNER) { toast('You can only create collections on your own profile.'); return; }
    const name = document.getElementById('ncName');
    if (name) name.value = '';
    document.querySelectorAll('#ncPrivGrid .uw-genre').forEach(x => x.classList.toggle('on', x.dataset.priv === 'Public'));
    openNewCollectionLive();
  }
  async function openNewCollectionLive() {
    try { await fetchLiveStories(); } catch (e) {}
    NC_PICK = renderStoryPicker('ncStoryGrid', []);
    document.getElementById('newCollOv').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (name) setTimeout(() => name.focus(), 300);
  }
  function closeNewCollection() { document.getElementById('newCollOv').classList.remove('open'); document.body.style.overflow = ''; }
  function refreshCollectionCounts() {
    const n = (PROFILE.collections || []).length;
    const badge = document.querySelector('.ptab[data-tab="collections"] .ptab-badge');
    if (badge) badge.textContent = n;
    const sub = document.getElementById('drawerCollSub');
    if (sub) sub.textContent = `${n} curated lists`;
  }
  async function submitNewCollection() {
    const nameEl = document.getElementById('ncName');
    const name = (nameEl.value || '').trim();
    if (!name) { toast('📂 Give your collection a name!'); return; }
    const priv = (document.querySelector('#ncPrivGrid .uw-genre.on') || {}).dataset?.priv || 'Public';
    const stories = NC_PICK ? NC_PICK.get() : [];
    const btn = document.getElementById('ncCreateBtn');
    btn.textContent = 'Creating…'; btn.disabled = true;
    let updated = null;
    try { updated = await ProfileData.createCollection(VIEW_HANDLE, { name, privacy: priv, stories }); }
    catch (e) {
      btn.disabled = false; btn.textContent = 'Create Collection ✓';
      // The story picker only lists eligible stories, so reaching the server
      // with this error means the pick went stale — say what to do, not the
      // internal error code.
      if (e && /insufficient_reading/.test(String(e.message || ''))) {
        const left = Math.max(1, (Number(e.required) || 0) - (Number(e.chaptersRead) || 0));
        toast(`📖 Read ${left} more chapter${left === 1 ? '' : 's'} before adding a story to a collection`);
      } else {
        toast('❌ ' + (e.message || 'Could not create collection'));
      }
      return;
    }
    btn.disabled = false; btn.textContent = 'Create Collection ✓';
    PROFILE = updated;
    closeNewCollection();
    renderCollections(PROFILE);
    refreshCollectionCounts();
    toast(stories.length ? `📂 Collection created with ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}!` : '📂 Collection created!');
  }

  /* ── MANAGE COLLECTION STORIES — thin UI over ProfileData.updateCollection ── */
  let MC_COLL_ID = null;
  let MC_PICK = null;
  function handleCollAction(col, action) {
    if (!col) return;
    if (action === 'open') { location.href = 'collection.html?id=' + encodeURIComponent(col.id); return; }
    if (action === 'delete') { confirmDeleteCollection(col); return; }
    openManageCollection(col);
  }
  async function confirmDeleteCollection(col) {
    if (!IS_OWNER) { toast('You can only delete your own collections.'); return; }
    if (!confirm(`Delete "${col.name}"? This cannot be undone.`)) return;
    let updated = null;
    try { updated = await ProfileData.deleteCollection(VIEW_HANDLE, col.id); }
    catch (e) { toast('❌ ' + (e.message || 'Could not delete')); return; }
    PROFILE = updated;
    renderCollections(PROFILE);
    refreshCollectionCounts();
    toast('🗑️ Collection deleted');
  }
  function openManageCollection(col) {
    if (!PROFILE || !col) return;
    if (!IS_OWNER) { toast('You can only edit your own collections.'); return; }
    MC_COLL_ID = col.id;
    document.getElementById('mcTitle').textContent = 'Edit Collection';
    const nameEl = document.getElementById('mcName');
    if (nameEl) nameEl.value = col.name || '';
    document.querySelectorAll('#mcPrivGrid .uw-genre').forEach(x => x.classList.toggle('on', x.dataset.priv === (col.privacy || 'Public')));
    document.getElementById('mcCount').textContent = 'Tap stories to add or remove — covers update automatically.';
    openManageCollectionLive(col);
  }
  async function openManageCollectionLive(col) {
    try { await fetchLiveStories(); } catch (e) {}
    MC_PICK = renderStoryPicker('mcStoryGrid', (col.stories || []).map(s => s.id));
    document.getElementById('manageCollOv').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeManageCollection() { document.getElementById('manageCollOv').classList.remove('open'); document.body.style.overflow = ''; MC_COLL_ID = null; }
  async function submitManageCollection() {
    if (!MC_COLL_ID) return;
    const name = ((document.getElementById('mcName') || {}).value || '').trim();
    const priv = (document.querySelector('#mcPrivGrid .uw-genre.on') || {}).dataset?.priv;
    const stories = MC_PICK ? MC_PICK.get() : [];
    const patch = { stories };
    if (name) patch.name = name;
    if (priv) patch.privacy = priv;
    const btn = document.getElementById('mcSaveBtn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    let updated = null;
    try { updated = await ProfileData.updateCollection(VIEW_HANDLE, MC_COLL_ID, patch); }
    catch (e) {
      btn.disabled = false; btn.textContent = 'Save Changes ✓';
      toast('❌ ' + (e.message || 'Could not update the collection'));
      return;
    }
    btn.disabled = false; btn.textContent = 'Save Changes ✓';
    PROFILE = updated;
    closeManageCollection();
    renderCollections(PROFILE);
    toast(`✅ Collection updated · ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`);
  }

  /* ── Drawer (shared component/profile-menu.js) ── */
  function openDrawer() {
    /* The account menu is personal: it carries Edit Profile, Settings, Wallet
       and Sign Out, so it only opens when owner chrome is on screen — that
       rules out someone else's profile and the visitor preview alike. */
    if (!canSeeOwnerUI()) return;
    if (!PROFILE) { toast('Still loading your profile…'); return; }
    renderDrawer(PROFILE);
    if (window.DroboardProfileMenu) DroboardProfileMenu.open();
  }
  function closeDrawer() {
    if (window.DroboardProfileMenu) DroboardProfileMenu.close();
  }
  function renderDrawer(p) {
    if (!window.DroboardProfileMenu) return;
    var boardsData = getMyBoardsForProfile();
    var collDataP = getMyCollectionsForProfile();
    DroboardProfileMenu.configure({
      profile: p,
      isOwner: canSeeOwnerUI(),
      boards: boardsData.joined,
      collections: collDataP.joined,
      onNewPost: function () { openNewPostComposer(); },
      onNewBook: function () { location.href = 'create.html'; },
      onTab: function (tab) { switchTab(tab); },
      onRefer: function () { location.href = 'refer.html'; },
      onSignOut: function () { var ov = document.getElementById('logoutOverlay'); if (ov) ov.classList.add('open'); },
    });
  }

  /* ── Logout confirm modal (custom — no browser confirm) ── */
  (function wireLogoutModal() {
    var ov = document.getElementById('logoutOverlay');
    if (!ov) return;
    function close() { ov.classList.remove('open'); }
    var cl = document.getElementById('logoutClose');
    var ca = document.getElementById('logoutCancel');
    var ok = document.getElementById('logoutConfirm');
    if (cl) cl.addEventListener('click', close);
    if (ca) ca.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    if (ok) ok.addEventListener('click', async function () {
      try { if (window.AuthSession) await AuthSession.logout(); } catch (e) {}
      close();
      toast('👋 Signed out!');
      setTimeout(function () { location.href = 'index.html'; }, 600);
    });
  })();

  /* ── Top-level render + boot ── */
  function renderProfile(p) {
    if (!p) {
      /* No profile at all — only reachable if the data layer itself failed
         (init() shows the real error state before this could run).
         Must stay synchronous: rerenderProfile() calls it after a role preview. */
      document.getElementById('emptyState').style.display = 'flex';
      return;
    }
    if (window.DroboardGuestGate) DroboardGuestGate.unmount();
    /* Ownership is the server's call: GET /api/users/:handle compares the
       session viewer to the profile row and returns isOwner. No client-side
       handle comparison — a stored account with a missing handle field once
       turned the owner's own page into a stranger's. */
    IS_OWNER = !IS_GUEST && !!p.isOwner;
    document.body.classList.toggle('is-owner', IS_OWNER);
    /* Remember the true role once, before any preview override, so exiting a
       preview can always restore the real profile. */
    if (!REAL_IS_WRITER_SET) { REAL_IS_WRITER = !!p.isWriter; REAL_IS_WRITER_SET = true; }
    p.isWriter = roleIsWriter();
    /* Owner chrome in the top bar — hamburger and wallet pill — follows the
       same rule as everything else on the page. */
    applyTopBarVisibility();
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('profileRoot').style.display = 'block';
    renderHeader(p);
    renderActionRow();
    renderStats(p);
    renderAchievements(p);
    renderUpgradeStrip(p);
    renderPreviewControl(p);
    renderTabs(p);
    renderDrawer(p);
  }

  /* ── Preview ─────────────────────────────────────────────────────
     Owner-only switch that re-renders the whole profile in another state:
     as a reader, as a writer, or as a VISITOR (a non-owner) — so you can
     confirm exactly what each of them sees. */
  function setRolePreview(role) {
    if (!IS_OWNER || !PROFILE) return;
    /* 'real' exits; null picks the visitor view; everything else is a role. */
    if (role !== null && ['real', 'reader', 'writer'].indexOf(role) === -1) {
      toast("Preview: use 'real', 'reader', 'writer' or null.");
      return;
    }
    PREVIEW_ROLE = role;
    rerenderProfile();
    toast(
      role === null ? '👁 Visitor view — owner tools hidden'
        : role === 'real' ? 'Back to your real profile'
          : role === 'writer' ? '✍️ Previewing as Writer'
            : '📖 Previewing as Reader');
  }
  function rerenderProfile() {
    if (!PROFILE) return;
    PROFILE.isWriter = roleIsWriter();
    /* A stale Author Center link would linger in the Books panel when
       previewing as a reader — drop it and let renderBooks re-add it. */
    const _acl = document.getElementById('authorCenterLink');
    if (_acl) _acl.remove();
    /* Owner chrome outside profileRoot (top bar) must track the mode too. */
    applyTopBarVisibility();
    renderHeader(PROFILE);
    renderActionRow();
    renderStats(PROFILE);
    renderAchievements(PROFILE);
    renderUpgradeStrip(PROFILE);
    renderPreviewControl(PROFILE);
    renderTabs(PROFILE);   /* re-renders tabs and re-activates ACTIVE_TAB */
    renderDrawer(PROFILE);
  }
  function renderPreviewControl(p) {
    // "View as" role preview is a debug tool and is disabled in live.
    // The owner always sees their real effective role.
    const el = document.getElementById('rolePreview');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  }

  async function loadNotifCount() {
    try {
      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      if (!res.ok) throw new Error('Notifications API failed: ' + res.status);
      const d = await res.json();
      showNotif(d.count || 0);
    } catch (e) { showNotif(0); }
  }
  function showNotif(count) {
    const badge = document.getElementById('notifCount');
    if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }

  /* Explicit error empty-state: the failure message is part of the UI —
     the page never falls back to seeded content. */
  function showErrorState(err) {
    document.getElementById('loadingState').style.display = 'none';
    const box = document.getElementById('emptyState');
    if (!box) return;
    box.style.display = 'flex';
    const title = box.querySelector('.empty-title');
    const sub = box.querySelector('.empty-sub');
    if (err && err.status === 404) {
      if (title) title.textContent = 'Profile not found';
      if (sub) sub.textContent = "This account doesn't exist or may have been removed.";
    } else {
      if (title) title.textContent = 'Could not load profile';
      if (sub) sub.textContent = (err && err.message) ? ('The profile API failed — ' + err.message) : 'The profile API failed.';
    }
  }

  /* Logged-out "my profile" visit: the guest gate owns the screen (account
     CTA + perks). There is no demo persona behind it. */
  function mountGuestGate() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    if (!window.DroboardGuestGate) return;
    let loginHref = 'login.html?next=' + encodeURIComponent('profile.html');
    try { if (window.AuthSession && AuthSession.loginUrl) loginHref = AuthSession.loginUrl('profile.html'); } catch (e) {}
    DroboardGuestGate.mount({
      anchor: '#profileRoot',
      variant: 'profile',
      cta: [
        { label: 'Create account', href: 'signup.html', primary: true },
        { label: 'Log in', href: loginHref },
      ],
    });
  }

  async function init() {
    initTheme();
    window.toast = toast;
    loadNotifCount();
    loadCoinBalance();
    try {
      var _pt = (window.ReaderLeague && ReaderLeague.pendingToast) ? ReaderLeague.pendingToast() : null;
      if (_pt) setTimeout(function () { toast(_pt, 4200); loadCoinBalance(); }, 900);
    } catch (e) {}
    if (window.DroboardNav) DroboardNav.configure({ active: 'profile' });
    var _dClose = document.getElementById('drawerCloseBtn'); if (_dClose) _dClose.addEventListener('click', closeDrawer);
    var _dOv = document.getElementById('drawerOverlay'); if (_dOv) _dOv.addEventListener('click', closeDrawer);
    document.getElementById('genreCloseBtn').addEventListener('click', closeGenreEdit);
    document.getElementById('genreEditOv').addEventListener('click', function (e) { if (e.target === this) closeGenreEdit(); });
    document.getElementById('genreSaveBtn').addEventListener('click', saveGenres);
    document.getElementById('aboutEditGenresBtn').addEventListener('click', openGenreEdit);
    document.getElementById('ncCloseBtn').addEventListener('click', closeNewCollection);
    document.getElementById('newCollOv').addEventListener('click', function (e) { if (e.target === this) closeNewCollection(); });
    document.getElementById('ncCreateBtn').addEventListener('click', submitNewCollection);
    document.getElementById('mcCloseBtn').addEventListener('click', closeManageCollection);
    document.getElementById('manageCollOv').addEventListener('click', function (e) { if (e.target === this) closeManageCollection(); });
    document.getElementById('mcSaveBtn').addEventListener('click', submitManageCollection);
    document.querySelectorAll('#ncPrivGrid .uw-genre').forEach(el => el.addEventListener('click', () => {
      document.querySelectorAll('#ncPrivGrid .uw-genre').forEach(x => x.classList.remove('on'));
      el.classList.add('on');
    }));
    document.querySelectorAll('#mcPrivGrid .uw-genre').forEach(el => el.addEventListener('click', () => {
      document.querySelectorAll('#mcPrivGrid .uw-genre').forEach(x => x.classList.remove('on'));
      el.classList.add('on');
    }));
    const ncSearch = document.getElementById('ncStorySearch');
    if (ncSearch) ncSearch.addEventListener('input', () => paintStoryGrid('ncStoryGrid'));
    const mcSearch = document.getElementById('mcStorySearch');
    if (mcSearch) mcSearch.addEventListener('input', () => paintStoryGrid('mcStoryGrid'));
    const params = new URLSearchParams(location.search);
    /* If the session exists but the stored user row is missing (a login path
       that only returned tokens), restore it first — ownership on the payload
       depends on the session being complete. */
    if (window.AuthSession && AuthSession.ensureAccount) {
      try { await AuthSession.ensureAccount(); } catch (e) { /* keep going — the fetch below reports the truth */ }
    }
    await loadGenres();
    ME_HANDLE = await ProfileData.getCurrentUserHandle();
    const requested = params.get('u');
    REQ_HANDLE = requested;
    VIEW_HANDLE = requested || ME_HANDLE;

    /* Browsing someone else's profile (?u=handle) stays public — anyone can
       look. Only "my profile" (no ?u=) needs an account: without one there's
       no profile to show, so the guest gate takes over instead of a demo
       reader pretending to be you. */
    const signedIn = !!(window.AuthSession && AuthSession.isSignedIn && AuthSession.isSignedIn());
    IS_GUEST = !signedIn && !requested;
    if (IS_GUEST) { mountGuestGate(); return; }
    if (!VIEW_HANDLE) {
      showErrorState(new Error('No signed-in account to load a profile for.'));
      return;
    }

    let data;
    try {
      data = await ProfileData.getProfile(VIEW_HANDLE);
    } catch (e) {
      showErrorState(e);
      return;
    }
    document.getElementById('loadingState').style.display = 'none';
    PROFILE = data;
    if (window.DroboardStatus) {
      await Promise.all([
        window.DroboardStatus.refreshMine().catch(function () { toast('Could not load your story ring.'); }),
        window.DroboardStatus.loadWriters([VIEW_HANDLE]).catch(function () {}),
      ]);
    }
    renderProfile(PROFILE);
    // The profile being viewed is the counter target — the owner's own
    // Insights page reads these hits back.
    try { if (window.InsightsTracker) InsightsTracker.hit('profile', String(VIEW_HANDLE || '').toLowerCase()); } catch (e) {}
    // Deep links: ?tab=collections opens the tab, ?create=1 opens the
    // new-collection sheet (all collection creation flows through here).
    // Guests get no owner-only tabs/sheets — the gate owns their screen.
    if (!IS_GUEST) {
      try {
        const tab = params.get('tab');
        if (tab && ['feed', 'books', 'library', 'collections', 'following', 'about'].indexOf(tab) !== -1) switchTab(tab);
        if (params.get('create') === '1') {
          if (tab === 'collections' || !tab) switchTab('collections');
          setTimeout(function () { openNewCollection(); }, 350);
        }
      } catch (e) {}
    }
    if (window.DroboardSearch) {
      DroboardSearch.configure({
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => { location.href = 'profile.html?u=' + encodeURIComponent((w.handle || w.name || '').replace('@', '')); },
        onOpenDebate: (d) => { location.href = 'debate.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
  }

  window.ProfilePage = { init, toast, toggleTheme, openDrawer, closeDrawer, openGenreEdit, closeGenreEdit, saveGenres, openNewCollection, closeNewCollection, submitNewCollection, openManageCollection, closeManageCollection, submitManageCollection, switchTab, setRolePreview };
})();
