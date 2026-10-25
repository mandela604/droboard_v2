/* ═══════════════════════════════════════════════════════════════
   PROFILE SERVICE
   Profile page orchestration. HTML calls ProfilePage.init().
   When going live: set USE_API = false → true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let PROFILE = null;
  let VIEW_HANDLE = null;
  let ME_HANDLE = null;
  let IS_OWNER = false;
  let IS_GUEST = false;
  let RENDERED = {};
  let FEED_HOOKED = false;
  let LIB_INSTANCE = null;
  let _following = false;

  const GENRES_ALL = window.ProfileData ? ProfileData.GENRES_ALL : [];
  const BOOK_STATUSES = ['ongoing', 'completed', 'paused'];
  const STATUS_LABEL = { ongoing: 'Ongoing', completed: 'Completed', paused: 'Paused' };

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
    if (b.status && STATUS_LABEL[b.status]) return b.status;
    return BOOK_STATUSES[i % BOOK_STATUSES.length];
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
    else tabs.push({ id: 'library', label: '📚 Library', badge: (p.library || []).length });
    tabs.push({ id: 'collections', label: '📂 Collections', badge: (p.collections || []).length });
    tabs.push({ id: 'following', label: '👥 Following' });
    tabs.push({ id: 'about', label: '✦ About' });
    return tabs;
  }
  function getStatsForProfile(p) {
    const s = p.stats || {};
    if (p.isWriter) return [
      { label: 'Following', value: s.following, cls: '' },
      { label: 'Followers', value: s.followers, cls: 'r' },
      { label: 'Books', value: s.books, cls: 'b' },
      { label: 'Reads', value: s.reads, cls: 'r' },
      { label: 'Likes', value: s.likes, cls: 'g' },
    ];
    var _rank = null;
    try { _rank = (window.ReaderLeague && !p.isWriter) ? ReaderLeague.myRank() : null; } catch (e) {}
    return [
      { label: 'Following', value: s.following, cls: '' },
      { label: 'Followers', value: s.followers, cls: 'r' },
      _rank
        ? { label: 'Rank', value: '#' + _rank.rank, cls: 'gold', href: 'leaderboard.html', sub: _rank.endsIn }
        : { label: 'Saved', value: s.saved, cls: 'b' },
      { label: 'Time Spent', value: (Number(s.readingHours) || 0) + 'h', cls: 'g' },
      { label: 'Streak', value: (Number(s.streak) || 0) + 'd', cls: '' },
    ];
  }

  /* ── Coin balance (gold) ── */
  async function loadCoinBalance(){
    let coins=0;
    try{
      if(window.StoreService && StoreService.getBalance) coins = StoreService.getBalance().coins;
      else if(window.DemoData && DemoData.USER_COIN_BALANCE) coins = DemoData.USER_COIN_BALANCE;
      else if(window.FinanceData && FinanceData.getDashboard) { const d=await FinanceData.getDashboard(); coins = parseInt(String(d.coinBalance||'0').replace(/[^0-9]/g,''))||0; }
    }catch(e){}
    const el=document.getElementById('coinBalance');
    if(el) el.textContent = coins>=1000 ? (coins/1000).toFixed(1)+'K' : String(coins||0);
  }

  /* ── My Circle helpers (same as feed) ── */
  function getMyBoardsForProfile(){
    const FALLBACK_ALL=[
      {id:'fantasy',name:'Fantasy',icon:'fa-hat-wizard',members:'45.7K'},
      {id:'romance',name:'Romance',icon:'fa-heart',members:'92.1K'},
      {id:'werewolf',name:'Werewolf',icon:'fa-moon',members:'31.2K'},
      {id:'mafia',name:'Mafia',icon:'fa-gun',members:'18.4K'},
      {id:'campus',name:'Campus',icon:'fa-graduation-cap',members:'22.1K'},
      {id:'revenge',name:'Revenge',icon:'fa-fire',members:'15.3K'},
      {id:'drama',name:'Drama',icon:'fa-masks-theater',members:'28.9K'},
      {id:'billionaire',name:'Billionaire',icon:'fa-briefcase',members:'34.5K'},
    ];
    try{
      const seed=window.GenreDemoSeed;
      if(seed && seed.DEMO_GENRES){
        const all=Object.values(seed.DEMO_GENRES);
        const map={}; FALLBACK_ALL.forEach(g=> map[g.id]=g); all.forEach(g=> map[g.id]=Object.assign({}, map[g.id]||{}, g));
        const allArr=Object.values(map);
        const joinedIds=['fantasy','romance','werewolf'];
        return { joined: allArr.filter(g=> joinedIds.includes(g.id)).slice(0,3), rest: allArr.filter(g=> !joinedIds.includes(g.id)), all: allArr };
      }
    }catch(e){}
    return { joined:FALLBACK_ALL.slice(0,3), rest:FALLBACK_ALL.slice(3), all:FALLBACK_ALL };
  }
  function getMyCollectionsForProfile(){
    const FALLBACK=[
      {id:'coll_1', name:'Midnight Reads', count:12},
      {id:'coll_2', name:'Tear-jerkers', count:8},
      {id:'coll_3', name:'Weekend Binge', count:15},
      {id:'coll_4', name:'Dark Romance Essentials', count:32},
    ];
    try{
      if (typeof PROFILE !== 'undefined' && PROFILE && Array.isArray(PROFILE.collections) && PROFILE.collections.length) {
        const mine = PROFILE.collections.map((c,i)=> ({id:c.id||'coll_'+i, name:c.name||'Collection', count:c.count||0}));
        return { joined: mine.slice(0,2), rest: mine.slice(2), all: mine };
      }
    }catch(e){}
    try{
      const cached = JSON.parse(localStorage.getItem('dro_live_collections') || '[]');
      if (Array.isArray(cached) && cached.length) {
        const all = cached.map((c,i)=> ({id:c.id||'coll_'+i, name:c.name||c.title||'Collection', count:c.count||c.stories||0}));
        return { joined: all.slice(0,2), rest: all.slice(2), all };
      }
    }catch(e){}
    try{
      const d=window.DemoData;
      if(d && (d.COLLECTIONS||d.COLLECTIONS_DATA)){
        const allRaw=d.COLLECTIONS||d.COLLECTIONS_DATA;
        const all=allRaw.map((c,i)=> ({id:c.id||'coll_'+i, name:c.name||c.title||'Collection', count:c.count||0}));
        return { joined: all.slice(0,2), rest: all.slice(2), all };
      }
    }catch(e){}
    return { joined:FALLBACK.slice(0,2), rest:FALLBACK.slice(2), all:FALLBACK };
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
    document.getElementById('heroEditBtn').style.display = IS_OWNER ? 'flex' : 'none';
    document.getElementById('heroStatsBtn').style.display = IS_OWNER ? 'flex' : 'none';
    const shown = (p.genres || []).slice(0, 5);
    document.getElementById('genrePillsDisplay').innerHTML = shown.map(id => {
      const g = GENRES_ALL.find(x => x.id === id);
      return g ? `<a class="genre-pill" style="text-decoration:none" href="genre-hub.html?genre=${encodeURIComponent(g.id)}">${g.label}</a>` : '';
    }).join('') + (IS_OWNER ? `<div class="genre-pill inactive" id="editGenresPill">+ Edit</div>` : '');
    const pill = document.getElementById('editGenresPill');
    if (pill) pill.addEventListener('click', openGenreEdit);
  }

  function handleStatusSlide(slide) {
    try { if (window.DroboardStatus) window.DroboardStatus.post(slide); } catch (e) {}
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
  window.onStatusViewerChange = function (wid, ring) {
    if (typeof _prevStatusCb === 'function') { try { _prevStatusCb(wid, ring); } catch (e) {} }
    if (!PROFILE) return;
    var entry = null;
    try { entry = storyEntryFor(PROFILE); } catch (e) {}
    if (!entry) return;
    if (window.StatusStore && StatusStore.key) {
      var mineKey = StatusStore.key(entry.id);
      var gotKey = StatusStore.key(wid);
      if (gotKey && mineKey !== gotKey) return;
      ring = StatusStore.ringOf(mineKey) || ring;
    }
    try { refreshStoryRing(PROFILE); } catch (e) {}
    try {
      if (window.DroboardPostCard) {
        var viewed = ring === 'ring-viewed';
        _FEED_POSTS.forEach(function (post) {
          var next = viewed ? 'viewed' : (entry ? true : false);
          if (post.avatarRing !== next) { post.avatarRing = next; DroboardPostCard.update(post); }
        });
      }
    } catch (e) {}
  };

  function renderActionRow() {
    const el = document.getElementById('actionRow');
    if (IS_OWNER) {
      el.innerHTML = `<a class="pact edit" href="edit-profile.html">Edit Profile</a><button class="pact msg" id="msgEditorBtn" title="Message your editor"><i class="fas fa-paper-plane"></i></button>`;
      document.getElementById('msgEditorBtn').addEventListener('click', () => {
        window.location.href = 'chat.html?contact=ed_morgan';
      });
      return;
    }
    const startedFollowing = (PROFILE.following || []).some(f => f.name === ME_HANDLE && f.following);
    el.innerHTML = `<button class="pact follow${startedFollowing ? ' ing' : ''}" id="followBtn">${startedFollowing ? '✓ Following' : '+ Follow'}</button>`;
    document.getElementById('followBtn').addEventListener('click', toggleFollowOwner);
  }

  async function toggleFollowOwner() {
    const btn = document.getElementById('followBtn');
    const willFollow = !_following;
    btn.disabled = true;
    const call = willFollow ? ProfileData.followUser : ProfileData.unfollowUser;
    const result = await call(ME_HANDLE, VIEW_HANDLE);
    btn.disabled = false;
    if (!result) { toast('Something went wrong — try again.'); return; }
    _following = willFollow;
    btn.textContent = _following ? '✓ Following' : '+ Follow';
    btn.className = 'pact follow' + (_following ? ' ing' : '');
    toast(_following ? `✅ Following @${PROFILE.handle}` : `Unfollowed @${PROFILE.handle}`);
  }

  function renderStats(p) {
    const handle = p.handle || p.username || VIEW_HANDLE;
    document.getElementById('statsRow').innerHTML = getStatsForProfile(p).map(s => {
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
    var awarded = [];
    if(window.AwardsEngine && typeof AwardsEngine.grantedFor === 'function'){
      try{ awarded = AwardsEngine.grantedFor(p.handle || p.username) || []; }catch(e){}
    }
    var list = awarded.length ? awarded.map(function(a){
      return { label:a.name, icon:a.icon, color:a.color || a.cls };
    }) : (p.achievements || []);
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
    if (!IS_OWNER || p.isWriter) { el.style.display = 'none'; el.innerHTML = ''; return; }

    let flow = null;
    try { flow = JSON.parse(localStorage.getItem('dro_writer_flow') || 'null'); } catch (e) {}

    let icon, title, sub, btn = '';
    if (flow && flow.status === 'pending') {
      icon = 'fa-hourglass-half';
      title = 'Book in review';
      sub = (flow.title ? '"' + flow.title + '" is ' : 'Your submission is ') +
            'with our editors. Your reader tools stay on until it\u2019s approved.';
    } else if (flow && flow.status === 'rejected') {
      icon = 'fa-rotate-left';
      title = 'Book needs changes';
      sub = (flow.feedback || 'The editor left feedback.') + ' Edit and resubmit to earn writer status.';
      btn = '<button class="upgrade-strip-btn" onclick="location.href=\'create.html\'">Edit &amp; resubmit</button>';
    } else {
      icon = 'fa-feather-pointed';
      title = 'Ready to publish?';
      sub = 'Create your first book \u2014 once an editor approves it, you become a writer.';
      btn = '<button class="upgrade-strip-btn" onclick="location.href=\'create.html\'">Create a book</button>';
    }

    el.style.display = 'flex';
    el.innerHTML =
      '<i class="fas ' + icon + '"></i>' +
      '<div class="upgrade-strip-text">' +
      '  <div class="upgrade-strip-title">' + esc(title) + '</div>' +
      '  <div class="upgrade-strip-sub">' + esc(sub) + '</div>' +
      '</div>' + btn;
  }

  /* ── Tabs ── */
  function renderTabs(p) {
    const tabs = getTabsForProfile(p);
    document.getElementById('profileTabs').innerHTML = tabs.map((t, i) =>
      `<div class="ptab${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}${t.badge ? `<span class="ptab-badge">${t.badge}</span>` : ''}</div>`
    ).join('');
    document.querySelectorAll('.ptab').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab)));
    RENDERED = {};
    switchTab('feed');
  }
  function switchTab(tab) {
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
    if (IS_OWNER && p.isWriter && !document.getElementById('authorCenterLink')) {
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
      onShare: (c) => { if (window.openShareModal) openShareModal({ title: c.name, sub: `${c.count} stories · ${p.name}`, img: (c.covers || [])[0], url: 'https://droboard.app/collection/' + c.id }); },
      onCreateNew: openNewCollection,
      onManage: IS_OWNER ? handleCollAction : undefined,
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
      let list = (p.following || []).map(f => ({ handle: f.name, name: f.name, avatar: f.av, av: f.av, meta: f.meta, following: !!f.following }));
      if (list.length && list.length < 12) {
        const extra = ['Alex_Jones','Mira_Lee','Sam_Wilson','Nina_Patel','Leo_King','Ivy_Chen','Omar_Farouk','Tara_Singh','Yuna_Kim','Jude_Obi'];
        let i=0; while(list.length < 12 && i < extra.length) {
          const h = extra[i++]; if (list.find(x=>x.handle===h)) continue;
          list.push({ handle:h, name:h, avatar:'https://i.pravatar.cc/100?img='+(10+i), av:'https://i.pravatar.cc/100?img='+(10+i), meta:'Reader · demo follow', following: Math.random() > 0.5 });
        }
      }
      if (!followApi) {
        followApi = FollowList.attach('#followingList', {
          perPage: 8,
          emptyText: 'Not following anyone yet.',
          onProfileClick: (h) => location.href='profile.html?u='+encodeURIComponent(h),
          onToggle: async (handle, item, btn) => {
            if (!item) return;
            btn.disabled = true;
            const idx = PROFILE.following.findIndex(x=>x.name===handle);
            if (idx===-1) {
              item.following = !item.following;
              const cur = followApi.getData(); const cItem = cur.find(x=>x.handle===handle); if(cItem) cItem.following = item.following;
              followApi.render(); btn.disabled=false; toast(item.following ? `Following @${handle}` : `Unfollowed @${handle}`); return;
            }
            const row = PROFILE.following[idx];
            try { const call = row.following ? ProfileData.unfollowUser : ProfileData.followUser; await call(ME_HANDLE, row.name); } catch(e){}
            row.following = !row.following;
            item.following = row.following;
            const cur = followApi.getData(); const cItem = cur.find(x=>x.handle===handle); if(cItem) cItem.following = row.following;
            followApi.render(); btn.disabled=false;
            toast(row.following ? `Following @${handle}` : `Unfollowed @${handle}`);
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
    var ring = false;
    try {
      var entry = storyEntryFor(PROFILE);
      if (entry) ring = entry.ring === 'ring-viewed' ? 'viewed' : true;
    } catch (e) {}
    return Object.assign({}, post, { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified, type: post.type === 'repost' ? 'recommendation' : post.type, mine: IS_OWNER, pinnable: IS_OWNER, avatarRing: ring });
  }
  /* Shared picker hooks (component contract): getState reads the profile
     post, onReact mutates it. Mirrors feed-service's counterHooks so the
     multi-emoji buckets + top-3 badges behave identically here. */
  var _FEED_POSTS = []; // adapted posts handed to DroboardPostCard (picker reads these)
  function findReactPost(id) {
    return _FEED_POSTS.find(x => String(x.id) === String(id)) || null;
  }
  /* attachCounters hooks — picker owns all toggle math; host supplies
     initial counts + persists result back onto the post. */
  function counterHooks() {
    return {
      getCounts: (id) => {
        const p = findReactPost(id);
        if (!p) return null; // unknown id → picker stays inert
        const likes = p.likes || 0;
        const buckets = ['crying', 'shocked', 'emotional'];
        let h = 0;
        String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
        const secondId = buckets[h];
        const second = Math.min(5, Math.max(0, likes));
        const counts = { love: Math.max(0, likes - second) };
        counts[secondId] = second;
        return { userRx: (p.userRx || (p.liked ? 'love' : null)) || null, ...counts };
      },
      save: (id, state) => {
        const p = findReactPost(id);
        if (!p) return;
        p.userRx = state.userRx;
        p.liked = state.userRx === 'love';
        let total = 0;
        Object.keys(state).forEach(k => { if (k !== 'userRx') total += state[k] || 0; });
        p.likes = total;
        if (window.DroboardPostCard) DroboardPostCard.update(p);
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
              const res = await ProfileData.updatePost(VIEW_HANDLE, post.id, patch);
              if(res){ PROFILE = res; renderFeed(PROFILE); toast('✅ Post updated'); }
            }
          });
        },
        onDelete: async (post) => { const updated = await ProfileData.deletePost(VIEW_HANDLE, post.id); if (updated) { PROFILE = updated; renderFeed(PROFILE); toast('🗑️ Post deleted'); } },
        onPin: async (post) => {
          if (!IS_OWNER) { toast('Only the profile owner can pin.'); return; }
          const updated = await ProfileData.pinPost(VIEW_HANDLE, post.id, true);
          if (updated) { PROFILE = updated; renderFeed(PROFILE); toast('📌 Pinned to top'); }
        },
        onUnpin: async (post) => {
          if (!IS_OWNER) { toast('Only the profile owner can unpin.'); return; }
          const updated = await ProfileData.pinPost(VIEW_HANDLE, post.id, false);
          if (updated) { PROFILE = updated; renderFeed(PROFILE); toast('Unpinned'); }
        },
        onReport: (post) => {
          if (window.DroboardDotsMenu && DroboardDotsMenu.openReportTypes) DroboardDotsMenu.openReportTypes(post, window._lastDotsAnchor || null);
          else toast('🚩 Reported. Thanks for flagging.');
        },
        onReportType: (post, typeId) => {
          try {
            const reports = JSON.parse(localStorage.getItem('DRO_REPORTS') || '[]');
            reports.push({ postId: post.id, typeId, at: Date.now() });
            localStorage.setItem('DRO_REPORTS', JSON.stringify(reports));
          } catch(e) {}
          toast('🚩 Report filed. Our team will review it.');
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
        onComment: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
        onOpenPost: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
        onShare: (post) => { if (!window.openShareModal) return; openShareModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, url: 'https://droboard.app/post/' + post.id }); },
        onSave: (post) => { if (!window.openSaveModal) return; openSaveModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, storyId: post.id, type: 'post' }); },
        onDots: (post, anchorEl) => { try { window._lastDotsAnchor = anchorEl || null; } catch(e){} if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchorEl); },
        onJoinAma: () => toast('🎙️ Joining AMA…'),
        onPollVote: (post, i) => { if (!post.poll) return; if (post.poll.voted >= 0) { toast('✅ Already voted!'); return; } post.poll.opts[i].v = (post.poll.opts[i].v || 0) + 1; post.poll.voted = i; post.poll.total = (post.poll.total || 0) + 1; DroboardPostCard.update(post); toast('✅ Vote cast!'); },
        onPredVote: (post, i) => { if (!post.prediction) return; if (post.prediction.voted >= 0) { toast('✅ Already predicted!'); return; } post.prediction.opts[i].v = (post.prediction.opts[i].v || 0) + 1; post.prediction.voted = i; post.prediction.total = (post.prediction.total || 0) + 1; DroboardPostCard.update(post); toast('🔮 Prediction locked!'); },
        onDebateVote: (post, side) => { if (!post.debateData) return; if (post.debateData.userVote) { toast('✅ Already voted!'); return; } post.debateData.userVote = side; if (side === 'for') post.debateData.forV = (post.debateData.forV || 0) + 1; else post.debateData.agV = (post.debateData.agV || 0) + 1; DroboardPostCard.update(post); toast(side === 'for' ? '✅ Voted FOR!' : '❌ Voted AGAINST!'); },
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
    window.onDroboardSaveChange = (storyId, isSaved) => { if (!storyId) return; ProfileData.savePost(VIEW_HANDLE, storyId, isSaved); };
  }
  function renderFeed(p) {
    ensureFeedComponents();
    const posts = (p.posts || []).map(adaptPost);
    posts.sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
    _FEED_POSTS = posts;
    if (!window.DroboardPostCard) { document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-triangle-exclamation"></i>Post component failed to load.</div>`; return; }
    DroboardPostCard.setPosts(posts);
    if (!posts.length) document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-inbox"></i>No posts yet.</div>`;
  }

  /* ── New Post Composer ── */
  function openNewPostComposer() {
    closeDrawer();
    if (!window.DroboardPostComposer) { toast('Composer failed to load.'); return; }
    const bookStories = (PROFILE.books || []).map(b => ({ id: b.id, title: b.title, author: PROFILE.name || '', cat: b.cat, cover: b.cover }));
    const demoStories = (window.DemoData && DemoData.STORIES) || [];
    const seen = new Set(bookStories.map(s => s.id));
    const pool = bookStories.concat(demoStories.filter(s => !seen.has(s.id)));
    DroboardPostComposer.open({
      author: { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified },
      stories: pool,
      draftKey: 'dro_profile_composer_draft',
      defaultType: 'text',
      onStatusSlide: handleStatusSlide,
      onSubmit: async (post) => {
        if (post && post.type === 'status') { handleStatusSlide(post.statusSlide); return; }
        const updated = await ProfileData.createPost(VIEW_HANDLE, post); if (!updated) { toast('Something went wrong — try again.'); return; } PROFILE = updated; renderFeed(PROFILE); switchTab('feed'); },
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
    const updated = await ProfileData.updateGenres(VIEW_HANDLE, ids);
    if (!updated) { toast('Something went wrong — try again.'); return; }
    PROFILE = updated;
    renderHeader(PROFILE);
    if (RENDERED.about) renderAbout(PROFILE);
    closeGenreEdit();
    toast('✅ Genres saved!');
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
    catch (e) { btn.disabled = false; btn.textContent = 'Create Collection ✓'; toast('❌ ' + (e.message || 'Could not create collection')); return; }
    btn.disabled = false; btn.textContent = 'Create Collection ✓';
    if (!updated) { toast('Something went wrong — try again.'); return; }
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
    if (!updated) { toast('Something went wrong — try again.'); return; }
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
    catch (e) { updated = null; }
    btn.disabled = false; btn.textContent = 'Save Changes ✓';
    if (!updated) { toast('Something went wrong — try again.'); return; }
    PROFILE = updated;
    closeManageCollection();
    renderCollections(PROFILE);
    toast(`✅ Collection updated · ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`);
  }

  /* ── Drawer (shared component/profile-menu.js) ── */
  function openDrawer() {
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
      isOwner: IS_OWNER,
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
  /* A visitor with no account has no profile of their own. Show the guest
     gate (create-account CTA + story recommendations) instead of an empty
     profile shell — see component/guest-gate.js. */
  function renderGuest() {
    const empty = document.getElementById('emptyState');
    const root = document.getElementById('profileRoot');
    if (empty) empty.style.display = 'none';
    if (root) root.style.display = 'none';
    if (!window.DroboardGuestGate) return;
    DroboardGuestGate.mount({
      anchor: '#profileRoot',
      variant: 'profile',
      cta: [
        { label: 'Create account', href: 'signup.html', primary: true, icon: 'fa-user-plus' },
        { label: 'Log in', href: (window.AuthSession && AuthSession.loginUrl) ? AuthSession.loginUrl('profile.html') : 'login.html', icon: 'fa-right-to-bracket' },
      ],
    });
  }

  /* Signed in, but this profile doesn't exist → plain "not found". */
  function renderNotFound() {
    if (window.DroboardGuestGate) DroboardGuestGate.unmount();
    const empty = document.getElementById('emptyState');
    const root = document.getElementById('profileRoot');
    if (empty) empty.style.display = 'block';
    if (root) root.style.display = 'none';
  }

  function renderProfile(p) {
    if (!p) {
      if (IS_GUEST) renderGuest();
      else renderNotFound();
      return;
    }
    if (window.DroboardGuestGate) DroboardGuestGate.unmount();
    IS_OWNER = (p.handle === ME_HANDLE);
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('profileRoot').style.display = 'block';
    renderHeader(p);
    renderActionRow();
    renderStats(p);
    renderAchievements(p);
    renderUpgradeStrip(p);
    renderTabs(p);
    renderDrawer(p);
  }

  async function loadNotifCount() {
    if (window.FeedData && FeedData.getNotifCount) {
      const count = await FeedData.getNotifCount();
      showNotif(count);
      return;
    }
    try { const res = await fetch('https://api.droboard.app/v1/notifications/unread-count'); if (!res.ok) throw 0; const d = await res.json(); showNotif(d.count); } catch (e) { showNotif(5); }
  }
  function showNotif(count) {
    const badge = document.getElementById('notifCount');
    if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.style.display = 'flex'; }
    else badge.style.display = 'none';
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
    ME_HANDLE = await ProfileData.getCurrentUserHandle();
    const requested = params.get('u');
    VIEW_HANDLE = requested || ME_HANDLE;

    /* Browsing someone else's profile (?u=handle) stays public — anyone
       can look. Only "my profile" (no ?u=) needs an account: without one
       there's no profile to show, so the guest gate takes over. */
    const signedIn = !!(window.AuthSession && AuthSession.isSignedIn && AuthSession.isSignedIn());
    IS_GUEST = !signedIn && !requested;

    let data = null;
    if (!IS_GUEST) {
      data = await ProfileData.getProfile(VIEW_HANDLE);
      if (!data) { data = await ProfileData.getProfile('You_Reader'); } // hardcode reader fallback (remove after testing)
    }
    document.getElementById('loadingState').style.display = 'none';
    PROFILE = data;
    renderProfile(PROFILE);
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
      let searchData;
      if (window.SearchIndex) { try { searchData = await SearchIndex.build(); } catch (e) {} }
      DroboardSearch.configure({
        data: searchData,
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => { location.href = 'profile.html?u=' + encodeURIComponent((w.handle || w.name || '').replace('@', '')); },
        onOpenDebate: (d) => { location.href = 'discussion.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
  }

  window.ProfilePage = { init, toast, toggleTheme, openDrawer, closeDrawer, openGenreEdit, closeGenreEdit, saveGenres, openNewCollection, closeNewCollection, submitNewCollection, openManageCollection, closeManageCollection, submitManageCollection, switchTab };
})();
