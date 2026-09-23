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
  const THEME_KEY = 'dro_search_theme_v1';
  function loadSavedTheme() { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  function applyThemeIcon(t) { document.getElementById('themeIcon').className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun'; }
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
    return [
      { label: 'Following', value: s.following, cls: '' },
      { label: 'Followers', value: s.followers, cls: 'r' },
      { label: 'Saved', value: s.saved, cls: 'b' },
      { label: 'Reactions', value: s.reactions, cls: 'g' },
      { label: 'Comments', value: s.comments, cls: '' },
    ];
  }

  /* ── Render header / actions / stats ── */
  function renderHeader(p) {
    document.getElementById('heroBg').style.backgroundImage = `url('${p.cover}')`;
    document.getElementById('avImg').src = p.avatar;
    document.getElementById('avImg').alt = p.name;
    document.getElementById('avRing').className = 'av-ring ' + (p.isWriter ? 'role-writer' : 'role-reader');
    document.getElementById('verifiedBadge').style.display = p.verified ? 'flex' : 'none';
    document.getElementById('profileName').textContent = p.name;
    document.getElementById('roleTag').className = 'role-tag ' + (p.isWriter ? 'writer' : 'reader');
    document.getElementById('roleTag').textContent = p.isWriter ? '✍️ Writer' : '📖 Reader';
    document.getElementById('profileHandle').textContent = '@' + p.handle;
    document.getElementById('verifiedInline').style.display = p.verified ? 'inline-flex' : 'none';
    document.getElementById('profileBio').textContent = p.bio;
    document.getElementById('heroEditBtn').style.display = IS_OWNER ? 'flex' : 'none';
    const shown = (p.genres || []).slice(0, 5);
    document.getElementById('genrePillsDisplay').innerHTML = shown.map(id => {
      const g = GENRES_ALL.find(x => x.id === id);
      return g ? `<a class="genre-pill" style="text-decoration:none" href="genre-hub.html?genre=${encodeURIComponent(g.id)}">${g.label}</a>` : '';
    }).join('') + (IS_OWNER ? `<div class="genre-pill inactive" id="editGenresPill">+ Edit</div>` : '');
    const pill = document.getElementById('editGenresPill');
    if (pill) pill.addEventListener('click', openGenreEdit);
  }

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
    document.getElementById('statsRow').innerHTML = getStatsForProfile(p).map(s => {
      const linkable = (s.label === 'Following' || s.label === 'Followers') ? ' data-goto="following"' : '';
      return `<div class="stat-item"${linkable}><div class="stat-num ${s.cls}">${fmtN(s.value)}</div><div class="stat-label">${s.label}</div></div>`;
    }).join('');
    document.querySelectorAll('#statsRow .stat-item[data-goto]').forEach(el => {
      el.addEventListener('click', () => switchTab(el.dataset.goto));
    });
  }
  function renderAchievements(p) {
    document.getElementById('achRow').innerHTML = (p.achievements || []).map(a =>
      `<div class="ach-chip ${a.cls || a.color}"><i class="fas ${a.icon || 'fa-star'}"></i> ${a.label}</div>`
    ).join('');
  }
  function renderUpgradeStrip(p) {
    document.getElementById('upgradeStrip').style.display = (IS_OWNER && !p.isWriter) ? 'flex' : 'none';
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
    DroboardBookCard.renderList(el, books, { onOpen: (book) => { location.href = `series-reader.html?id=${encodeURIComponent(book.id)}`; } });
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

  /* ── Following ── */
  function renderFollowing(p) {
    document.getElementById('followingIntro').innerHTML = `Following <strong style="color:var(--tx-high)">${p.stats.following}</strong> writers &amp; readers`;
    const el = document.getElementById('followingList');
    if (!p.following || !p.following.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-user-group"></i>Not following anyone yet.</div>`; return; }
    el.innerHTML = p.following.map((f, i) => {
      const href = 'profile.html?u=' + encodeURIComponent(f.name);
      return `
      <div class="follow-item">
        <a class="follow-av" style="display:block;text-decoration:none" href="${href}"><img src="${f.av}" loading="lazy"/></a>
        <a class="follow-info" style="flex:1;min-width:0;text-decoration:none;color:inherit" href="${href}"><div class="follow-name">@${f.name}</div><div class="follow-meta">${f.meta}</div></a>
        <button class="follow-btn${f.following ? ' ing' : ''}" data-i="${i}">${f.following ? '✓ Following' : '+ Follow'}</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.follow-btn').forEach(btn => btn.addEventListener('click', () => toggleFollowRow(+btn.dataset.i, btn)));
  }
  async function toggleFollowRow(i, btn) {
    const row = PROFILE.following[i];
    btn.disabled = true;
    const call = row.following ? ProfileData.unfollowUser : ProfileData.followUser;
    const result = await call(ME_HANDLE, row.name);
    btn.disabled = false;
    if (!result) { toast('Something went wrong — try again.'); return; }
    row.following = !row.following;
    btn.textContent = row.following ? '✓ Following' : '+ Follow';
    btn.classList.toggle('ing', row.following);
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
    return Object.assign({}, post, { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified, type: post.type === 'repost' ? 'recommendation' : post.type, mine: IS_OWNER });
  }
  function ensureFeedComponents() {
    if (FEED_HOOKED) return;
    FEED_HOOKED = true;
    const feedList = document.getElementById('feedList');
    if (window.DroboardReactionPicker) DroboardReactionPicker.attach(feedList, {});
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onEdit: () => toast('✏️ Editing post isn\'t wired up yet'),
        onDelete: async (post) => { const updated = await ProfileData.deletePost(VIEW_HANDLE, post.id); if (updated) { PROFILE = updated; renderFeed(PROFILE); toast('🗑️ Post deleted'); } },
        onReport: () => toast('🚩 Reported. Thanks for flagging.'),
        onLess: () => toast('Got it — showing less of this.'),
        onFollow: (post) => toast('Following @' + post.name),
        onMute: (post) => toast('Muted @' + post.name),
        onCopyLink: (post) => { navigator.clipboard?.writeText('https://droboard.app/post/' + post.id).catch(() => {}); toast('🔗 Link copied'); },
      });
    }
    if (window.DroboardPostCard) {
      DroboardPostCard.attach(feedList, {
        getReactionHTML: (post) => window.DroboardReactionPicker ? DroboardReactionPicker.renderTrigger(post.id, { liked: post.liked, likeCount: post.likes }) : undefined,
        onAvatarClick: () => { location.href = 'profile.html?u=' + encodeURIComponent(PROFILE.handle); },
        onNameClick: () => { location.href = 'profile.html?u=' + encodeURIComponent(PROFILE.handle); },
        onComment: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
        onOpenPost: (post) => { location.href = 'discussion.html?id=' + encodeURIComponent((post && post.id) || ''); },
        onShare: (post) => { if (!window.openShareModal) return; openShareModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, url: 'https://droboard.app/post/' + post.id }); },
        onSave: (post) => { if (!window.openSaveModal) return; openSaveModal({ title: post.chapterRef?.title || post.storyRef?.title || PROFILE.name, sub: PROFILE.name, img: post.chapterRef?.cover || post.storyRef?.cover || PROFILE.avatar, storyId: post.id }); },
        onDots: (post, anchorEl) => { if (window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchorEl); },
        onJoinAma: () => toast('🎙️ Joining AMA…'),
        onOpenLink: () => toast('📖 Opening story…'),
      });
    }
    window.onDroboardSaveChange = (storyId, isSaved) => { if (!storyId) return; ProfileData.savePost(VIEW_HANDLE, storyId, isSaved); };
  }
  function renderFeed(p) {
    ensureFeedComponents();
    const posts = (p.posts || []).map(adaptPost);
    if (!window.DroboardPostCard) { document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-triangle-exclamation"></i>Post component failed to load.</div>`; return; }
    DroboardPostCard.setPosts(posts);
    if (!posts.length) document.getElementById('feedList').innerHTML = `<div class="panel-empty" style="padding:40px 16px"><i class="fas fa-inbox"></i>No posts yet.</div>`;
  }

  /* ── New Post Composer ── */
  function openNewPostComposer() {
    closeDrawer();
    if (!window.DroboardPostComposer) { toast('Composer failed to load.'); return; }
    DroboardPostComposer.open({
      author: { name: PROFILE.name, avatar: PROFILE.avatar, verified: PROFILE.verified },
      stories: (PROFILE.books || []).map(b => ({ id: b.id, title: b.title, cat: b.cat, cover: b.cover })),
      defaultType: 'post',
      onSubmit: async (post) => { const updated = await ProfileData.createPost(VIEW_HANDLE, post); if (!updated) { toast('Something went wrong — try again.'); return; } PROFILE = updated; renderFeed(PROFILE); switchTab('feed'); },
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

  /* ── Become-a-Writer Wizard ── */
  function openUpgradeWizard() {
    closeDrawer();
    const grid = document.getElementById('uwGenreGrid');
    grid.innerHTML = GENRES_ALL.slice(0, 10).map((g, i) => `<div class="uw-genre${i === 0 ? ' on' : ''}" data-gid="${g.id}">${g.label}</div>`).join('');
    grid.querySelectorAll('.uw-genre').forEach(el => el.addEventListener('click', () => { grid.querySelectorAll('.uw-genre').forEach(x => x.classList.remove('on')); el.classList.add('on'); }));
    document.getElementById('upgradeOv').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeUpgradeWizard() { document.getElementById('upgradeOv').classList.remove('open'); document.body.style.overflow = ''; }
  async function submitUpgrade() {
    const title = document.getElementById('uwTitle').value.trim();
    if (!title) { toast('✍️ Give your first book a title!'); return; }
    const genre = document.querySelector('.uw-genre.on')?.dataset.gid;
    const btn = document.getElementById('uwSubmitBtn');
    btn.textContent = 'Publishing…'; btn.disabled = true;
    const updated = await ProfileData.becomeWriter(PROFILE.handle, { firstBookTitle: title, genre });
    btn.disabled = false; btn.textContent = 'Publish & Unlock Writer Tools ✓';
    if (!updated) { toast('Something went wrong — try again.'); return; }
    PROFILE = updated;
    closeUpgradeWizard();
    renderProfile(PROFILE);
    toast('🎉 Writer tools unlocked!');
  }

  /* ── COLLECTION STORY PICKER — books + library, shared by the
     create and manage sheets. Covers come from the chosen stories. ── */
  function eligibleStories() {
    const seen = new Set();
    const out = [];
    const push = (s) => {
      const k = String(s.title || '').toLowerCase();
      if (!s.title || !s.cover || seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    (PROFILE.books || []).forEach(b => push({ id: b.id || ('book_' + b.title), title: b.title, cat: b.cat, author: PROFILE.name, cover: b.cover, badge: '', reads: b.reads || '' }));
    (PROFILE.library || []).forEach((l, i) => push({ id: l.id || ('lib_' + i), title: l.title, cat: l.cat, author: l.author, cover: l.cover, badge: '', reads: '' }));
    return out;
  }
  function renderStoryPicker(gridId, selectedIds) {
    const grid = document.getElementById(gridId);
    const stories = eligibleStories();
    const sel = new Set((selectedIds || []).map(String));
    if (!stories.length) {
      grid.innerHTML = `<div class="panel-empty" style="grid-column:1/-1"><i class="fas fa-book"></i>No stories available yet — publish or save stories first.</div>`;
      return { get: () => [] };
    }
    grid.innerHTML = stories.map(s => `
      <div class="story-pick${sel.has(String(s.id)) ? ' on' : ''}" data-sid="${escAttr(s.id)}">
        <img src="${s.cover}" loading="lazy" alt=""/>
        <div class="story-pick-check"><i class="fas fa-check"></i></div>
        <div class="story-pick-title">${s.title}</div>
      </div>`).join('');
    grid.querySelectorAll('.story-pick').forEach(el => el.addEventListener('click', () => el.classList.toggle('on')));
    return {
      get: () => [...grid.querySelectorAll('.story-pick.on')]
        .map(el => stories.find(s => String(s.id) === el.dataset.sid))
        .filter(Boolean),
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
    const updated = await ProfileData.createCollection(VIEW_HANDLE, { name, privacy: priv, stories });
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
    const updated = await ProfileData.deleteCollection(VIEW_HANDLE, col.id);
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

  /* ── Drawer ── */
  function openDrawer() {
    if (!PROFILE) { toast('Still loading your profile…'); return; }
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }
  function renderDrawer(p) {
    document.getElementById('drawerAv').src = p.avatar;
    document.getElementById('drawerName').textContent = p.name;
    document.getElementById('drawerHandle').textContent = `@${p.handle} · ${fmtN(p.stats.followers)} followers`;
    document.getElementById('drawerBadge').textContent = p.isWriter ? '✍️ Verified Writer' : '📖 Verified Reader';
    let html = `<div class="drawer-section"><div class="drawer-section-title">Create</div>`;
    html += `<button class="drawer-item" id="drawerNewPost"><div class="drawer-item-icon" style="background:rgba(255,0,80,.08);border:1px solid var(--bd-acc)"><i class="fas fa-pen" style="color:var(--acc)"></i></div><div style="flex:1"><div class="drawer-item-title">New Post</div><div class="drawer-item-sub">${p.isWriter ? 'Text, photo, chapter or AMA' : 'Quote, reaction or recommendation'}</div></div></button>`;
    if (p.isWriter) html += `<button class="drawer-item" id="drawerNewBook"><div class="drawer-item-icon" style="background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.12)"><i class="fas fa-book-open" style="color:var(--green)"></i></div><div style="flex:1"><div class="drawer-item-title">New Book</div><div class="drawer-item-sub">Start a new story</div></div></button>`;
    html += `</div><div class="drawer-divider"></div><div class="drawer-section"><div class="drawer-section-title">My Content</div>`;
    if (p.isWriter) {
      html += `<button class="drawer-item" id="drawerBooksLink"><div class="drawer-item-icon" style="background:rgba(255,0,80,.06);border:1px solid var(--bd-acc)"><i class="fas fa-book" style="color:var(--acc)"></i></div><div style="flex:1"><div class="drawer-item-title">Books</div><div class="drawer-item-sub">${(p.books || []).length} published</div></div><div class="drawer-item-right"><span class="drawer-badge-sm">${(p.books || []).length}</span></div></button>`;
      if (IS_OWNER) html += `<button class="drawer-item" onclick="location.href='../author/author-center.html'"><div class="drawer-item-icon" style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.15)"><i class="fas fa-gauge" style="color:var(--purple)"></i></div><div style="flex:1"><div class="drawer-item-title">Author Center</div><div class="drawer-item-sub">Dashboard, analytics &amp; revenue</div></div></button>`;
    } else {
      html += `<button class="drawer-item" id="drawerLibraryTab"><div class="drawer-item-icon" style="background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.12)"><i class="fas fa-bookmark" style="color:var(--blue)"></i></div><div style="flex:1"><div class="drawer-item-title">Library</div><div class="drawer-item-sub">${(p.library || []).length} saved stories</div></div></button>`;
    }
    html += `<button class="drawer-item" id="drawerCollectionsLink"><div class="drawer-item-icon" style="background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.12)"><i class="fas fa-folder" style="color:var(--green)"></i></div><div style="flex:1"><div class="drawer-item-title">Collections</div><div class="drawer-item-sub" id="drawerCollSub">${(p.collections || []).length} curated lists</div></div></button>`;
    html += `<button class="drawer-item" id="drawerFollowingLink"><div class="drawer-item-icon" style="background:rgba(0,0,0,.04);border:1px solid var(--bd)"><i class="fas fa-user-group" style="color:var(--tx-muted)"></i></div><div style="flex:1"><div class="drawer-item-title">Following</div><div class="drawer-item-sub">${p.stats.following} accounts</div></div></button>`;
    if (IS_OWNER && !p.isWriter) html += `<button class="drawer-item" id="drawerBecomeWriter"><div class="drawer-item-icon" style="background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.12)"><i class="fas fa-feather-pointed" style="color:var(--purple)"></i></div><div style="flex:1"><div class="drawer-item-title">Become a Writer</div><div class="drawer-item-sub">Unlock books &amp; author tools</div></div></button>`;
    html += `</div>`;
    if (IS_OWNER) html += `<div class="drawer-divider"></div><div class="drawer-section"><div class="drawer-section-title">Wallet</div><button class="drawer-item" onclick="location.href='store.html'"><div class="drawer-item-icon" style="background:var(--gold-soft);border:1px solid rgba(240,168,0,.3)"><i class="fas fa-wallet" style="color:var(--gold)"></i></div><div style="flex:1"><div class="drawer-item-title" style="color:var(--gold)">Wallet</div><div class="drawer-item-sub">Coins, balance &amp; payouts</div></div><div class="drawer-item-right"><i class="fas fa-chevron-right" style="font-size:10px"></i></div></button></div>`;
    html += `<div class="drawer-divider"></div><div class="drawer-section"><div class="drawer-section-title">Account</div>`;
    if (IS_OWNER) html += `<button class="drawer-item" onclick="location.href='edit-profile.html'"><div class="drawer-item-icon" style="background:rgba(0,0,0,.04);border:1px solid var(--bd)"><i class="fas fa-user-edit" style="color:var(--tx-muted)"></i></div><div style="flex:1"><div class="drawer-item-title">Edit Profile</div><div class="drawer-item-sub">Name, bio, avatar, genres</div></div></button><button class="drawer-item" onclick="location.href='settings.html'"><div class="drawer-item-icon" style="background:rgba(0,0,0,.04);border:1px solid var(--bd)"><i class="fas fa-gear" style="color:var(--tx-muted)"></i></div><div style="flex:1"><div class="drawer-item-title">Settings</div><div class="drawer-item-sub">Privacy, notifications, payout</div></div></button>`;
    html += `<button class="drawer-item" id="drawerReferBtn"><div class="drawer-item-icon" style="background:var(--gold-soft);border:1px solid rgba(240,168,0,.2)"><i class="fas fa-share-alt" style="color:var(--gold)"></i></div><div style="flex:1"><div class="drawer-item-title">Refer a Friend</div><div class="drawer-item-sub">Earn $5 per referral</div></div></button>`;
    html += `<button class="drawer-item" id="drawerSignOutBtn"><div class="drawer-item-icon" style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.15)"><i class="fas fa-sign-out-alt" style="color:#dc2626"></i></div><div style="flex:1"><div class="drawer-item-title" style="color:#dc2626">Sign Out</div></div></button></div>`;
    document.getElementById('drawerBody').innerHTML = html;
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    bind('drawerNewPost', openNewPostComposer);
    bind('drawerNewBook', () => { closeDrawer(); location.href = 'create.html'; });
    bind('drawerBooksLink', () => { closeDrawer(); switchTab('books'); });
    bind('drawerLibraryTab', () => { closeDrawer(); switchTab('library'); });
    bind('drawerCollectionsLink', () => { closeDrawer(); switchTab('collections'); });
    bind('drawerFollowingLink', () => { closeDrawer(); switchTab('following'); });
    bind('drawerBecomeWriter', openUpgradeWizard);
    bind('drawerReferBtn', () => { toast('🤝 Referral service isn\'t wired up yet'); closeDrawer(); });
    bind('drawerSignOutBtn', async () => { closeDrawer(); if (window.AuthSession) await AuthSession.logout(); toast('👋 Signed out!'); setTimeout(() => location.href = 'index.html', 600); });
  }

  /* ── Top-level render + boot ── */
  function renderProfile(p) {
    IS_OWNER = (p.handle === ME_HANDLE);
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
    if (window.DroboardNav) DroboardNav.configure({ active: 'profile' });
    document.getElementById('drawerCloseBtn').addEventListener('click', closeDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    document.getElementById('upgradeCloseBtn').addEventListener('click', closeUpgradeWizard);
    document.getElementById('upgradeOv').addEventListener('click', function (e) { if (e.target === this) closeUpgradeWizard(); });
    document.getElementById('uwSubmitBtn').addEventListener('click', submitUpgrade);
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
    const params = new URLSearchParams(location.search);
    ME_HANDLE = await ProfileData.getCurrentUserHandle();
    VIEW_HANDLE = params.get('u') || ME_HANDLE;
    const data = await ProfileData.getProfile(VIEW_HANDLE);
    document.getElementById('loadingState').style.display = 'none';
    if (!data) { document.getElementById('emptyState').style.display = 'block'; return; }
    PROFILE = data;
    document.getElementById('profileRoot').style.display = 'block';
    renderProfile(PROFILE);
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

  window.ProfilePage = { init, toast, toggleTheme, openDrawer, closeDrawer, openGenreEdit, closeGenreEdit, saveGenres, openUpgradeWizard, closeUpgradeWizard, submitUpgrade, openNewCollection, closeNewCollection, submitNewCollection, openManageCollection, closeManageCollection, submitManageCollection, switchTab };
})();
