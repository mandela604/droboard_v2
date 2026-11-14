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
  /* Chip labels carry the display name ("Fantasy"); the URL wants the id
     ("fantasy"). Used by the category-chip → board link. */
  function genreSlug(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  let ALL_POSTS = [];
  let PROMO_SLIDES = [];
  let sort = 'all';
  let tropeFilter = '';
  let activeTab = 'discussions';
  let joined = false;
  let _joinBusy = false;
  let _adTurn = 0;
  let memberApi = null;

  // In-flight GET deduplication
  const _pending = new Map();
  let _genreCache = null;

  /* Reports. Live: POST /api/reports
     {target:'discussion', targetId:post.id, reason:typeId, title}.
     Same record + same toast as the feed's report flow (feed-service.js
     onReportType) — no demo wording leaks into the UI. */
  const REPORTS_API = '/api/reports';

  async function fileReport(post, typeId) {
    const res = await fetch(REPORTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        target: 'discussion', targetId: String(post.id || ''),
        reason: typeId, title: String(post.title || '').slice(0, 160),
      }),
    });
    if (!res.ok) throw new Error('Report API failed: ' + res.status);
    toast('🚩 Report filed. Our team will review it.');
  }

  /* Tropes are the live CE catalog (GET /api/tropes). No seeded per-genre
     lists: a board with no active tropes simply hides the filter. */
  let HUB_TROPES = [];
  async function loadTropes() {
    try {
      const res = await fetch(`${API_BASE}/tropes?limit=100`, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json();
      HUB_TROPES = (Array.isArray(d) ? d : (d.items || [])).map(t => t.name).filter(Boolean);
    } catch (e) { HUB_TROPES = []; }
    return HUB_TROPES;
  }
  function hubTropes() {
    return HUB_TROPES;
  }

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

  function trackAd(id, ev, ctx) { try { if (id && window.AdService) AdService.track(id, ev, ctx || { page: 'genreHub', slot: 'genreHub:in-feed' }); } catch (e) {} }

  /* Both markers are deferred because a frequency cap scoped to 'target'
     counts per board, and GENRE_ID is only known after loadGenre(). */
  function mountHubAd() {
    [['genreHub:strip', ''], ['genreHub:popup', 'embed']].forEach(function (p) {
      var el = document.querySelector('[data-ad-slot="' + p[0] + '"]');
      if (!el || !window.DroboardAdSlot) return;
      el.setAttribute('data-ad-target', GENRE_ID || '');
      DroboardAdSlot.mount(el, { page: 'genreHub', slot: p[0], target: GENRE_ID || '', format: p[1] || 'auto' });
    });
  }

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
  const API_BASE = '/api';

  async function loadGenre() {
    const params = new URLSearchParams(location.search);
    const rawId = params.get('id') || params.get('genre') || 'fantasy';
    GENRE_ID = rawId.toLowerCase();

    // Fetch genre hub info and discussions in parallel
    const [genreRes, discRes] = await Promise.all([
      fetch(`${API_BASE}/genres/${encodeURIComponent(GENRE_ID)}`, { credentials: 'include' }),
      fetch(`${API_BASE}/discussions?genre=${encodeURIComponent(GENRE_ID)}&limit=30`, { credentials: 'include' })
    ]);

    if (!genreRes.ok) {
      GENRE = null;
      ALL_POSTS = [];
      const el = document.getElementById('feed');
      if (el) el.innerHTML = '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">This board does not exist.</div>';
      document.getElementById('pageTitle')?.textContent && (document.getElementById('pageTitle').textContent = 'Board not found');
      return false;
    }
    if (!discRes.ok) {
      ALL_POSTS = [];
    } else {
      const dData = await discRes.json();
      ALL_POSTS = Array.isArray(dData) ? dData : (dData.items || []);
    }

    const data = await genreRes.json();
    GENRE = data.genre || data;
    GENRE_ID = (GENRE.id || GENRE.slug || GENRE_ID).toLowerCase();
    PROMO_SLIDES = [];
    _genreCache = GENRE;
    return true;
  }

  function applyGenre() {
    if (!GENRE) return;
    document.getElementById('pageTitle').textContent = GENRE.name;
    document.getElementById('heroName').textContent = GENRE.name;
    document.getElementById('heroTag').textContent = GENRE.tagline || '';
    document.getElementById('heroImg').src = GENRE.cover || '';
    document.getElementById('heroIcon').className = 'fas ' + (GENRE.icon || 'fa-book');
    document.getElementById('statMembers').textContent = GENRE.members || GENRE.membersCount || '0';
    document.getElementById('statDisc').textContent = GENRE.discussions || GENRE.discussionsCount || '0';
    document.getElementById('statStories').textContent = GENRE.stories || GENRE.storiesCount || '0';
    document.getElementById('blurbText').textContent = GENRE.blurb || '';
    document.getElementById('composerPh').textContent = 'Start a discussion in ' + GENRE.name + '…';
    document.title = GENRE.name + ' · Genre Hub · DroBoard';
    if (window.DroboardGenreCard) DroboardGenreCard.setGenreName(GENRE.name);
    joined = !!GENRE.isJoined;
    paintJoin();
    const eb = document.getElementById('hubEditBtn');
    if (eb) {
      if (isStaff()) eb.style.display = '';
      eb.onclick = function () { location.href = 'board-edit.html?board=' + encodeURIComponent(GENRE.slug || GENRE_ID); };
    }
    paintComposerAvatar();
  }

  function paintJoin() {
    const btn = document.getElementById('joinBtn');
    if (!btn) return;
    btn.classList.toggle('on', !!joined);
    btn.innerHTML = joined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join';
    btn.disabled = !!_joinBusy;
    btn.style.opacity = _joinBusy ? '.6' : '';
  }

  function paintComposerAvatar() {
    const img = document.querySelector('#composerStrip .composer-av');
    if (!img) return;
    const acc = (window.AuthSession && AuthSession.getSync) ? AuthSession.getSync() : null;
    const av = acc && acc.avatar ? String(acc.avatar) : '';
    const isDemo = /pravatar\.cc|picsum\.photos|placeholder|example\.com|gravatar\.com\/avatar\?d=/.test(av);
    if (av && !isDemo) { img.src = av; img.style.display = ''; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
  }

  /* ── Feed ── */
  /* Relative time strings ('45m', '2h', '3d', '1w') → minutes, for New sort. */
  function timeMins(t) {
    const m = String(t || '').match(/(\d+)\s*([mhdw])/i);
    if (!m) return 1e9;
    const n = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    return n * (u === 'm' ? 1 : u === 'h' ? 60 : u === 'd' ? 1440 : 10080);
  }
  function isControversial(p) {
    return (p.controversy || 0) >= 50
      || String(p.tagClass || '').toLowerCase() === 'controversial'
      || String(p.tag || '').toLowerCase() === 'controversial';
  }
  function isStaff() {
    try { return window.canModerate ? window.canModerate() : false; } catch (e) { return false; }
  }
  /* Every filter works like the Hot tab: a real subset in a real order
     (not a silent re-sort of the same list). API-pinned threads (p.pinned) lead. */
  function visibleDiscussions() {
    let list = ALL_POSTS.filter(p => !p.pinned);
    if (tropeFilter) list = list.filter(p => (p.trope || '') === tropeFilter);
    if (activeTab === 'hot' || sort === 'hot') list = list.filter(p => p.hot);
    else if (sort === 'controversial') list = list.filter(isControversial);
    else if (sort === 'unanswered') list = list.filter(p => !(p.comments > 0));
    list = list.slice();
    if (sort === 'controversial') list.sort((a, b) => ((b.controversy || 0) - (a.controversy || 0)) || ((b.comments || 0) - (a.comments || 0)));
    else if (sort === 'new') list.sort((a, b) => timeMins(a.time) - timeMins(b.time));
    else if (sort === 'top') list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    else if (sort === 'hot' || activeTab === 'hot') list.sort((a, b) => (b.score || 0) - (a.score || 0));
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
    if (!GENRE) return;
    const pinned = ALL_POSTS.filter(p => p.pinned);
    const list = visibleDiscussions();
    if (!window.DroboardGenreCard) {
      document.getElementById('feed').innerHTML = '<div style="padding:20px;color:var(--tx-muted)">genre-card.js missing</div>';
      return;
    }
    if (!list.length) {
      let html = '';
      pinned.forEach(p => { html += DroboardGenreCard.renderCard(p); });
      html += '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">Nothing here under this filter yet.</div>';
      document.getElementById('feed').innerHTML = html;
      DroboardGenreCard.setPosts(pinned.concat(list));
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
      // No onSelect: the component default navigates slide/CTA → bridge.
    });
  }
  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#hubTabs .tab').forEach(x => x.classList.toggle('active', x.dataset.tab===tab));
    const sortRow = document.getElementById('sortRow');
    const floating = document.getElementById('floatingFilters');
    const composer = document.getElementById('composerStrip');
    if (tab==='members' || tab==='about') { sortRow.style.display='none'; if(floating) floating.classList.remove('show'); composer.style.display='none'; }
    else { sortRow.style.display='flex'; if(floating) floating.classList.remove('show'); composer.style.display='flex'; }
    if (tab!=='members') clearMemberPager();
    if (tab==='discussions') renderFeed();
    else if (tab==='hot') renderHot();
    else if (tab==='stories') renderStories();
    else if (tab==='members') renderMembers();
    else if (tab==='about') renderAbout();
  }

  /* ── About inline CRUD — saves via API ── */
  function renderAbout() {
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="padding:14px"><div style="background:var(--l1);border:1px solid var(--bd);border-radius:14px;padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:14px">About '+GENRE.name+'</b><button id="aboutEditBtn" style="font-size:11px;font-weight:700;color:var(--acc);background:rgba(255,0,80,.08);border:1px solid var(--bd-acc);padding:6px 10px;border-radius:10px"><i class="fas fa-pen"></i> Edit</button></div><div style="font-size:12px;line-height:1.6;color:var(--tx-body)" id="aboutBlurbView">'+(GENRE.blurb||'')+'</div><div id="aboutForm" style="display:none;margin-top:10px"><input id="aboutName" value="'+(GENRE.name||'').replace(/"/g,'&quot;')+'" placeholder="Genre name" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px"/><input id="aboutTagline" value="'+(GENRE.tagline||'').replace(/"/g,'&quot;')+'" placeholder="Tagline" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px"/><textarea id="aboutBlurb" rows="3" placeholder="About this hub" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;resize:none;margin-bottom:8px">'+(GENRE.blurb||'')+'</textarea><input id="aboutCover" value="'+(GENRE.cover||'').replace(/"/g,'&quot;')+'" placeholder="Cover image URL" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:12px;margin-bottom:10px"/><div style="display:flex;gap:8px"><button id="aboutSave" style="flex:1;background:var(--acc);color:#fff;padding:10px;border-radius:10px;font-weight:700">Save</button><button id="aboutCancel" style="flex:1;background:transparent;border:1px solid var(--bd);padding:10px;border-radius:10px">Cancel</button></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.members||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Members</div></div><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.stories||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Stories</div></div><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.discussions||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Threads</div></div></div></div>';
    document.getElementById('aboutEditBtn').onclick = () => { location.href = 'board-edit.html?board=' + encodeURIComponent(GENRE_ID) + '#details'; };
    document.getElementById('aboutCancel').onclick = () => { document.getElementById('aboutForm').style.display='none'; document.getElementById('aboutBlurbView').style.display='block'; };
    document.getElementById('aboutSave').onclick = async () => {
      const patch = { name: document.getElementById('aboutName').value.trim()||GENRE.name, tagline: document.getElementById('aboutTagline').value.trim(), blurb: document.getElementById('aboutBlurb').value.trim(), cover: document.getElementById('aboutCover').value.trim() };
      try {
        await fetch(`${API_BASE}/genres/${encodeURIComponent(GENRE_ID)}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        }).then(r => { if (!r.ok) throw new Error(r.status); });
        Object.assign(GENRE, patch); applyGenre(); renderAbout(); toast('About saved');
      } catch(e) { toast('Failed to save. Please try again.'); }
    };
  }
  /* ── Members — fetched from API ── */
  async function fetchMembers() {
    try {
      const res = await fetch(`${API_BASE}/genres/${encodeURIComponent(GENRE_ID)}/members?limit=50`, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.items || []);
      return list.map(m => ({
        handle: m.handle || m.name,
        name: m.name || m.handle,
        avatar: m.avatar || m.av || '',
        av: m.avatar || m.av || '',
        meta: m.meta || ((m.role || 'Member') + ' · ' + (m.posts || 0) + ' posts'),
        following: !!m.following
      }));
    } catch (e) { return []; }
  }
  async function toggleMemberFollow(handle) {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(handle)}/follow`, {
        method: 'POST', credentials: 'include'
      });
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      const following = j.following !== undefined ? j.following : !j.unfollowed;
      toast(following ? 'Following @' + handle : 'Unfollowed @' + handle);
      if (memberApi) {
        const cur = memberApi.getData();
        const c = cur.find(x => (x.handle || x.name) === handle);
        if (c) c.following = following;
        memberApi.render();
      }
    } catch(e) { toast('Action failed. Please try again.'); }
  }
  function clearMemberPager() {
    const feed = document.getElementById('feed');
    const pg = feed ? feed.nextElementSibling : null;
    if (pg && pg.classList.contains('fl-pager')) pg.remove();
  }
  async function renderMembers() {
    const members = await fetchMembers();
    const feed = document.getElementById('feed');
    if (!window.FollowList) { feed.innerHTML='<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">FollowList component missing</div>'; return; }
    if (!memberApi) {
      memberApi = FollowList.attach('#feed', {
        perPage: 8,
        emptyText: 'No members yet.',
        onProfileClick: (h)=> location.href='profile.html?u='+encodeURIComponent(h),
        onToggle: (h)=> toggleMemberFollow(h)
      });
    }
    clearMemberPager();
    memberApi.setData(members);
  }
  function updateStoryTabBadge(newCount) {
    const tab = document.querySelector('[data-tab="stories"]');
    if (!tab) return;
    let badge = tab.querySelector('.tab-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-badge';
      badge.style.cssText = 'margin-left:6px;background:var(--acc);color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle';
      tab.appendChild(badge);
    }
    if (newCount > 0) { badge.textContent = newCount; badge.style.display = 'inline-flex'; }
    else badge.style.display = 'none';
  }
  async function renderStories() {
    const feedEl = document.getElementById('feed');
    feedEl.innerHTML = '<div style="padding:30px 14px;text-align:center;color:var(--tx-muted)">Loading…</div>';
    try {
      const res = await fetch(`${API_BASE}/genres/${encodeURIComponent(GENRE_ID)}/stories?limit=20`, { credentials: 'include' });
      if (!res.ok) throw new Error('Genre stories API failed: ' + res.status);
      const data = await res.json();
      const stories = Array.isArray(data) ? data : (data.items || []);

      // Update tab badge with count returned by API (field: newCount or similar)
      updateStoryTabBadge(data.newCount || 0);

      if (!stories.length) {
        feedEl.innerHTML = '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No stories in this hub yet.</div>';
        return;
      }

      if (window.DroboardBookCard) {
        const books = stories.map(s => ({
          id: s.id, title: s.title, genre: s.genre || GENRE.name, cover: s.cover || s.img || '',
          reads: s.reads || '', likes: s.likes || '',
          chapters: s.chapters || s.ch || s.chaptersCount || 0,
          status: s.status || 'ongoing',
          _newDrop: s.newChapters || 0
        }));
        DroboardBookCard.renderList('#feed', books, {
          onOpen: (book) => { location.href = 'bridge.html?id=' + encodeURIComponent(book.id); }
        });
        // Inject new-chapter badge if the API says so
        setTimeout(() => {
          document.querySelectorAll('#feed .dbc-card').forEach((card, i) => {
            const book = books[i];
            if (!book || !book._newDrop) return;
            const cover = card.querySelector('.dbc-cover');
            if (!cover) return;
            const badge = document.createElement('div');
            badge.textContent = book._newDrop + ' new';
            badge.style.cssText = 'position:absolute;top:6px;right:6px;background:var(--acc);color:#fff;font-size:9px;font-weight:800;padding:3px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.15)';
            cover.style.position = 'relative';
            cover.appendChild(badge);
          });
        }, 30);
      } else {
        feedEl.innerHTML = stories.map(s =>
          '<div class="story-hit" data-bid="' + (s.id || '').replace(/"/g, '&quot;') + '" style="display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid var(--bd);background:var(--l1);cursor:pointer">' +
          '<div style="width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:var(--l2)"><img src="' + (s.cover || s.img || '') + '" style="width:100%;height:100%;object-fit:cover"/></div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;color:var(--acc);text-transform:uppercase">' + (s.genre || GENRE.name) + '</div>' +
          '<div style="font-size:13.5px;font-weight:700;line-height:1.3;margin:2px 0">' + s.title + '</div></div></div>'
        ).join('');
        feedEl.querySelectorAll('.story-hit').forEach(el => el.addEventListener('click', () => {
          location.href = 'bridge.html?id=' + encodeURIComponent(el.dataset.bid);
        }));
      }

      // View All button
      const old = document.getElementById('hubViewAllStories');
      if (old) old.remove();
      const btn = document.createElement('button');
      btn.id = 'hubViewAllStories';
      btn.type = 'button';
      btn.textContent = 'View all stories';
      btn.style.cssText = 'width:100%;margin:2px 0 10px;padding:12px;border-radius:12px;background:var(--l2);border:1px solid var(--bd);font-size:13px;font-weight:800;color:var(--tx-high)';
      btn.addEventListener('click', () => { location.href = 'genre-stories.html?genre=' + encodeURIComponent(GENRE_ID); });
      if (feedEl.parentNode) feedEl.parentNode.insertBefore(btn, feedEl.nextSibling);
      clearMemberPager();
    } catch(e) {
      feedEl.innerHTML = '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">Failed to load stories.</div>';
    }
  }
  function renderHot() {
    const hot = visibleDiscussions().slice(0,12);
    if (!hot.length) { document.getElementById('feed').innerHTML='<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No hot topics right now.</div>'; return; }
    let html=''; hot.forEach(p=>{ html += window.DroboardGenreCard ? DroboardGenreCard.renderCard(p) : '<div style="padding:12px;border-bottom:1px solid var(--bd)">'+p.title+'</div>'; });
    document.getElementById('feed').innerHTML = html;
    if (window.DroboardGenreCard) DroboardGenreCard.setPosts(hot);
  }

  /* ── Component wiring ── */
  function wireComponents() {
    const feedEl = document.getElementById('feed');
    if (window.DroboardReactionPicker) {
      const findPost = (id) => ALL_POSTS.find(p => String(p.id) === String(id));
      // attachCounters hooks — picker owns all toggle math; host supplies
      // initial counts + persists result back onto the post.
      DroboardReactionPicker.attachCounters(feedEl, {
        topRow: 'external',
        getCounts: (id) => {
          const post = findPost(id);
          if (!post) return null; // unknown id → picker stays inert
          const likes = post.likes || 0;
          const buckets = ['crying', 'shocked', 'emotional'];
          let h = 0; String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
          const secondId = buckets[h];
          const second = Math.min(5, Math.max(0, likes));
          const counts = { love: Math.max(0, likes - second) };
          counts[secondId] = second;
          return { userRx: (post.userRx || (post.liked ? 'love' : null)) || null, ...counts };
        },
        save: (id, state) => {
          const post = findPost(id);
          if (!post) return;
          post.userRx = state.userRx;
          post.liked = state.userRx === 'love';
          let total = 0;
          Object.keys(state).forEach(k => { if (k !== 'userRx') total += state[k] || 0; });
          post.likes = total;
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
        onPollVote: (post, i) => { if (!post.poll) return; if (post.poll.voted >= 0) { toast('✅ Already voted!'); return; } post.poll.opts[i].v = (post.poll.opts[i].v || 0) + 1; post.poll.voted = i; post.poll.total = (post.poll.total || 0) + 1; DroboardGenreCard.update(post); toast('✅ Vote cast!'); },
        onDebateVote: (post, side) => { if (!post.debateData) return; if (post.debateData.userVote) { toast('✅ Already voted!'); return; } post.debateData.userVote = side; if (side === 'for') post.debateData.forV = (post.debateData.forV || 0) + 1; else post.debateData.agV = (post.debateData.agV || 0) + 1; DroboardGenreCard.update(post); toast(side === 'for' ? '✅ Voted FOR!' : '❌ Voted AGAINST!'); },
        onOpenDebate: (post) => { location.href = 'debate.html?id=' + encodeURIComponent((post && post.id) || ''); },
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
        onStory: (post) => {
          const s = (post && (post.story || post.storyRef)) || null;
          const sid = s && (s.id || '');
          const ttl = (s && (s.title || '')) || 'Story';
          if (sid && window.ReadingHistory && !ReadingHistory.guardRecommend(sid, ttl)) return;
          if (sid) { location.href = 'bridge.html?id=' + encodeURIComponent(sid); return; }
          toast('📖 ' + ttl);
        },
        onAvatar: (post) => { location.href = 'profile.html?u=' + encodeURIComponent(post.name || ''); },
        onNameClick: (post, name) => { location.href = 'profile.html?u=' + encodeURIComponent(name || (post && post.name) || ''); },
        onGenre: (post, genreId) => {
          const gid = genreSlug(genreId || GENRE_ID);
          if (!gid || gid === genreSlug(GENRE_ID) || gid === genreSlug(GENRE.name)) {
            toast('You are already in this board'); return;
          }
          location.href = 'genre-hub.html?genre=' + encodeURIComponent(gid);
        },
        onPinned: () => toast('Hub rules…'),
      });
    }
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onFollow: (post) => toast('Following @' + (post.name || 'user')),
        onMute: (post) => toast('Muted @' + (post.name || 'user')),
        onLess: () => toast('Showing less of this.'),
        onReport: (post) => {
          if (window.DroboardDotsMenu.openReportTypes) DroboardDotsMenu.openReportTypes(post);
          else toast('🚩 Reported. Thanks for flagging.');
        },
        onReportType: (post, typeId) => fileReport(post, typeId),
        onCopyLink: (post) => {
          const url = 'https://droboard.app/hub/' + GENRE_ID + '/' + post.id;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied')).catch(() => toast(url));
          else toast(url);
        },
        onEdit: () => toast('✏️ Edit'),
        onDelete: () => toast('🗑️ Delete'),
        onPin: (post) => {
          if (!isStaff()) { toast('Only moderators can pin.'); return; }
          fetch(`${API_BASE}/discussions/${encodeURIComponent(post.id)}/pin`, { method: 'POST', credentials: 'include' })
            .then(() => { post.pinned = true; setActiveTab(activeTab); toast('📌 Pinned to top'); })
            .catch(() => toast('Pin failed.'));
        },
        onUnpin: (post) => {
          if (!isStaff()) { toast('Only moderators can unpin.'); return; }
          fetch(`${API_BASE}/discussions/${encodeURIComponent(post.id)}/pin`, { method: 'DELETE', credentials: 'include' })
            .then(() => { post.pinned = false; setActiveTab(activeTab); toast('Unpinned'); })
            .catch(() => toast('Unpin failed.'));
        },
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
  function initTropeFilter() {
    const row = document.getElementById('sortRow');
    if (!row) return;
    if (!hubTropes().length) {
      const old = document.getElementById('tropeFilterSel');
      if (old) old.remove();
      tropeFilter = '';
      return;
    }
    if (document.getElementById('tropeFilterSel')) return;
    const sel = document.createElement('select');
    sel.id = 'tropeFilterSel';
    sel.setAttribute('aria-label', 'Filter by trope');
    sel.style.cssText = 'flex-shrink:0;padding:7px 10px;border-radius:20px;font-size:11.5px;font-weight:700;background:var(--l2);border:1px solid var(--bd);color:var(--tx-muted);font-family:inherit;max-width:150px';
    const paint = () => {
      const opts = ['<option value="">All tropes</option>']
        .concat(hubTropes().map(t => '<option value="' + t + '"' + (tropeFilter === t ? ' selected' : '') + '>' + t + '</option>'));
      sel.innerHTML = opts.join('');
      sel.style.borderColor = tropeFilter ? 'var(--bd-acc)' : '';
      sel.style.color = tropeFilter ? 'var(--acc)' : '';
    };
    paint();
    sel.addEventListener('change', () => {
      tropeFilter = sel.value;
      paint();
      if (activeTab === 'discussions' || activeTab === 'hot') renderFeed();
      scrollToFirstCard();
    });
    row.appendChild(sel);
    sel._repaint = paint;
  }
  function repaintTropeFilter() {
    const sel = document.getElementById('tropeFilterSel');
    if (sel && sel._repaint) sel._repaint();
    else initTropeFilter();
  }
  function initFilters() {
    document.querySelectorAll('#sortRow .sort-chip').forEach(c => {
      c.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('#sortRow .sort-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        sort = c.dataset.sort;
        if (activeTab==='discussions' || activeTab==='hot') renderFeed();
        else if (activeTab==='stories') renderStories();
        scrollToFirstCard();
      });
    });
    document.querySelectorAll('#hubTabs .tab').forEach(t => {
      t.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(t.dataset.tab); });
    });
  }
  /* Joining is a board action, so it goes to the API that owns membership
     (POST/DELETE /api/genres/:slug/join). The button paints the server's
     answer — never a local toggle — so a reader cannot "look joined" while
     the board still refuses their posts. */
  function initJoin() {
    const btn = document.getElementById('joinBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (_joinBusy) return;
      if (window.RequireAuth && !RequireAuth.ensure(joined ? 'leave this board' : 'join this board')) return;
      const slug = GENRE.slug || GENRE_ID;
      const wantJoin = !joined;
      _joinBusy = true;
      paintJoin();
      try {
        const res = await fetch(`${API_BASE}/genres/${encodeURIComponent(slug)}/join`, {
          method: wantJoin ? 'POST' : 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) throw new Error('Join API failed: ' + res.status);
        const j = await res.json();
        joined = (j && typeof j.joined === 'boolean') ? j.joined : wantJoin;
        GENRE.isJoined = joined;
        if (j && j.membersCount != null) {
          GENRE.membersCount = j.membersCount;
          GENRE.members = String(j.membersCount);
          document.getElementById('statMembers').textContent = GENRE.members;
        }
        toast(joined ? 'Joined ' + GENRE.name : 'Left ' + GENRE.name);
        clearMemberPager();
        if (activeTab === 'members') renderMembers();
      } catch (e) {
        toast('Could not update membership. Please try again.');
      } finally {
        _joinBusy = false;
        paintJoin();
      }
    });
  }
  function ensureHubComposer() {
    if (document.getElementById('ghcOv')) return;
    const css = '.ghc-ov{position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .22s} .ghc-ov.open{opacity:1;pointer-events:auto} .ghc-sheet{width:100%;max-width:420px;height:100dvh;background:#fff;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 50px rgba(0,0,0,.3)} .ghc-ov.open .ghc-sheet{transform:translateY(0)} .ghc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--bd,rgba(0,0,0,.08));background:#fff;flex-shrink:0} .ghc-body{flex:1;overflow-y:auto;padding:16px;background:#fff} .ghc-label{font-size:11px;font-weight:700;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 6px;display:block} .ghc-label:first-child{margin-top:0} .ghc-input,.ghc-textarea{width:100%;border:1.5px solid var(--bd,rgba(0,0,0,.08));border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;background:var(--l2,#f1f1f1);color:var(--tx-high,#161616);outline:none} .ghc-input:focus,.ghc-textarea:focus{border-color:var(--acc,#ff0050);background:#fff} .ghc-textarea{min-height:100px;resize:none} .ghc-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px} .ghc-tag{padding:7px 12px;border-radius:20px;font-size:11.5px;font-weight:700;border:1.5px solid var(--bd,rgba(0,0,0,.08));background:var(--l2,#f1f1f1);color:var(--tx-muted,#666);cursor:pointer} .ghc-tag.on{background:rgba(255,0,80,.08);border-color:var(--bd-acc,rgba(255,0,80,.2));color:var(--acc,#ff0050)}';
    const st=document.createElement('style'); st.id='ghc-style'; st.textContent=css; document.head.appendChild(st);
    const st2=document.createElement('style'); st2.id='ghc-story-style';
    st2.textContent='.ghc-story-hits{display:flex;flex-direction:column;gap:6px;margin-top:8px}.ghc-story-hit{display:flex;gap:10px;align-items:center;border:1px solid var(--bd,rgba(0,0,0,.08));border-radius:10px;padding:8px;cursor:pointer;text-align:left;width:100%;font-family:inherit;background:#fff;color:var(--tx-high,#161616)}.ghc-story-hit img{width:34px;height:46px;border-radius:6px;object-fit:cover;flex-shrink:0}.ghc-story-hit-t{font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ghc-story-hit-a{font-size:10.5px;color:var(--tx-muted,#666);margin-top:1px}';
    document.head.appendChild(st2);
    const html = `<div class="ghc-ov" id="ghcOv"><div class="ghc-sheet"><div class="ghc-head"><button id="ghcCancel" style="background:none;border:none;font-size:14px;color:var(--tx-muted);font-family:inherit;cursor:pointer">Cancel</button><div style="font-size:15px;font-weight:700">New in ${GENRE.name}</div><button id="ghcPost" style="background:var(--acc);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;opacity:.45;pointer-events:none">Post</button></div><div class="ghc-body"><label class="ghc-label" id="ghcGenreLabel" style="display:none">Post in</label><select id="ghcGenre" class="ghc-input" style="display:none"></select><label class="ghc-label">Title *</label><input id="ghcTitle" class="ghc-input" placeholder="What's the discussion about?"/><label class="ghc-label">Body *</label><textarea id="ghcBody" class="ghc-textarea" placeholder="Share details, ask a question, post a theory…"></textarea><label class="ghc-label">Tag</label><div class="ghc-tags" id="ghcTags"><button class="ghc-tag on" data-tag="Discussion" data-cls="discussion">Discussion</button><button class="ghc-tag" data-tag="Theory" data-cls="theory">Theory</button><button class="ghc-tag" data-tag="Recommendation" data-cls="recommendation">Recommendation</button><button class="ghc-tag" data-tag="Question" data-cls="question">Question</button><button class="ghc-tag" data-tag="Controversial" data-cls="controversial">Controversial</button></div><label class="ghc-label">Trope (optional)</label><select id="ghcTrope" class="ghc-input"><option value="">No trope</option></select><label class="ghc-label">Photo (optional)</label><input type="file" id="ghcMediaFile" accept="image/*" class="ghc-input"/><div id="ghcMediaPrev" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;max-height:180px"><img id="ghcMediaPrevImg" style="width:100%;max-height:180px;object-fit:cover;display:block"/></div><label class="ghc-label">Image URL (optional)</label><input id="ghcMedia" class="ghc-input" placeholder="https://..."/><label class="ghc-label">Story (optional)</label><input id="ghcStory" class="ghc-input" placeholder="Story title you are discussing"/><div id="ghcStoryHits"></div></div></div></div>`;
    const wrap=document.createElement('div'); wrap.innerHTML=html; while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('ghcCancel').addEventListener('click', closeHubComposer);
    document.getElementById('ghcOv').addEventListener('click', e=>{ if(e.target.id==='ghcOv') closeHubComposer(); });
    document.getElementById('ghcTitle').addEventListener('input', function(){ validateHubComposer(); saveGhcDraft(); });
    document.getElementById('ghcBody').addEventListener('input', function(){ validateHubComposer(); saveGhcDraft(); });
    document.getElementById('ghcStory').addEventListener('input', function () { renderGhcStoryHits(document.getElementById('ghcStory').value); saveGhcDraft(); });
    document.getElementById('ghcStory').addEventListener('focus', function () { renderGhcStoryHits(document.getElementById('ghcStory').value); });
    document.getElementById('ghcStory').addEventListener('click', function () { const box=document.getElementById('ghcStoryHits'); if(box && !box.innerHTML) renderGhcStoryHits(document.getElementById('ghcStory').value); });
    document.querySelectorAll('#ghcTags .ghc-tag').forEach(el=> el.addEventListener('click', ()=>{ document.querySelectorAll('#ghcTags .ghc-tag').forEach(x=>x.classList.remove('on')); el.classList.add('on'); }));
    document.getElementById('ghcPost').addEventListener('click', submitHubPost);
    const fileEl=document.getElementById('ghcMediaFile'), prev=document.getElementById('ghcMediaPrev'), prevImg=document.getElementById('ghcMediaPrevImg'), urlEl=document.getElementById('ghcMedia');
    if(fileEl && prev && prevImg){
      fileEl.addEventListener('change', ()=>{
        const f=fileEl.files[0]; if(!f) return;
        const r=new FileReader(); r.onload=e=>{ prevImg.src=e.target.result; prev.style.display='block'; if(urlEl) urlEl.value=''; }; r.readAsDataURL(f);
      });
    }
    if(urlEl && prev && prevImg){
      urlEl.addEventListener('input', ()=>{
        const v=urlEl.value.trim(); if(v){ prevImg.src=v; prev.style.display='block'; if(fileEl) fileEl.value=''; } else { prev.style.display='none'; prevImg.src=''; }
      });
    }
  }
  function ghcDraftKey() { return 'dro_genre_composer_draft_' + (GENRE_ID || 'hub'); }
  function saveGhcDraft() {
    try {
      const t = document.getElementById('ghcTitle'), b = document.getElementById('ghcBody'), s = document.getElementById('ghcStory');
      if(!t && !b && !s) return;
      const d = {
        title: t ? t.value : '', body: b ? b.value : '',
        story: s ? s.value : '', storyId: s ? (s.dataset.storyId || '') : '',
        storyCover: s ? (s.dataset.storyCover || '') : '',
        storyAuthor: s ? (s.dataset.storyAuthor || '') : '',
        storyCat: s ? (s.dataset.storyCat || '') : '',
      };
      if((d.title||'').trim() || (d.body||'').trim() || (d.story||'').trim()) localStorage.setItem(ghcDraftKey(), JSON.stringify(d));
      else localStorage.removeItem(ghcDraftKey());
    } catch(e){}
  }
  function restoreGhcDraft() {
    try {
      const raw = localStorage.getItem(ghcDraftKey());
      if(!raw) return;
      const d = JSON.parse(raw);
      if(d.title) document.getElementById('ghcTitle').value = d.title;
      if(d.body) document.getElementById('ghcBody').value = d.body;
      if(d.story) {
        const inp = document.getElementById('ghcStory');
        inp.value = d.story;
        if(d.storyId) inp.dataset.storyId = d.storyId;
        if(d.storyCover) inp.dataset.storyCover = d.storyCover;
        if(d.storyAuthor) inp.dataset.storyAuthor = d.storyAuthor;
        if(d.storyCat) inp.dataset.storyCat = d.storyCat;
      }
    } catch(e){}
  }
  function hubStoryLibrary() { return []; } // Story search is now live via API
  async function renderGhcStoryHits(q) {
    const box = document.getElementById('ghcStoryHits');
    if (!box) return;
    q = (q || '').trim();
    if (!q) { box.innerHTML = ''; return; }
    try {
      const res = await fetch(`${API_BASE}/stories/search?q=${encodeURIComponent(q)}&limit=6`, { credentials: 'include' });
      if (!res.ok) { box.innerHTML = ''; return; }
      const data = await res.json();
      const hits = Array.isArray(data) ? data : (data.items || []);
      box.innerHTML = hits.length ? hits.map((s, i) =>
        `<button type="button" class="ghc-story-hit" data-hit="${i}">` +
        (s.cover ? `<img src="${s.cover}" loading="lazy" alt=""/>` : '') +
        `<div style="flex:1;min-width:0"><div class="ghc-story-hit-t">${s.title}</div><div class="ghc-story-hit-a">${s.author || ''}</div></div></button>`
      ).join('') : `<div style="font-size:11.5px;color:var(--tx-muted,#666);padding:6px 2px">No stories match.</div>`;
      box._hits = hits;
      box.querySelectorAll('[data-hit]').forEach(btn => btn.addEventListener('click', () => {
        const s = (box._hits || [])[+btn.dataset.hit];
        if (!s) return;
        if (window.ReadingHistory && !ReadingHistory.guardRecommend(s.id, s.title)) return;
        const inp = document.getElementById('ghcStory');
        inp.value = s.title;
        inp.dataset.storyId = s.id || '';
        inp.dataset.storyCover = s.cover || '';
        inp.dataset.storyAuthor = s.author || '';
        inp.dataset.storyCat = s.cat || s.genre || GENRE.name || '';
        box.innerHTML = '';
      }));
    } catch(e) { box.innerHTML = ''; }
  }
  function refreshTropeOptions(){
    const sel=document.getElementById('ghcTrope');
    if(!sel) return;
    const keep=sel.value;
    sel.innerHTML='<option value="">No trope</option>'+hubTropes().map(t=>'<option value="'+t+'">'+t+'</option>').join('');
    sel.value=keep;
  }
  /* A board can own several genres, and a thread attaches to ONE of them.
     With more than one child the API needs `genreId`; with a single child it
     can infer it. The composer mirrors that instead of failing with 400. */
  function refreshGenreOptions(){
    const sel=document.getElementById('ghcGenre');
    const lbl=document.getElementById('ghcGenreLabel');
    if(!sel||!lbl) return '';
    const list=(GENRE && Array.isArray(GENRE.genres))?GENRE.genres:[];
    if(list.length<=1){
      sel.style.display='none'; lbl.style.display='none';
      sel.innerHTML='';
      return list[0]?(list[0].id||''):'';
    }
    const keep=sel.value;
    sel.innerHTML=list.map(g=>'<option value="'+g.id+'">'+g.name+'</option>').join('');
    if(keep && list.some(g=>String(g.id)===String(keep))) sel.value=keep;
    sel.style.display=''; lbl.style.display='';
    return sel.value;
  }
  function validateHubComposer(){
    const t=document.getElementById('ghcTitle'), b=document.getElementById('ghcBody'), btn=document.getElementById('ghcPost');
    const ok = t && b && t.value.trim().length>=4 && b.value.trim().length>=6;
    if(btn){ btn.style.opacity = ok? '1':'.45'; btn.style.pointerEvents = ok? 'auto':'none'; }
  }
  function closeHubComposer(){ saveGhcDraft(); const ov=document.getElementById('ghcOv'); if(ov) ov.classList.remove('open'); document.body.style.overflow=''; }
  async function submitHubPost() {
    const title = document.getElementById('ghcTitle').value.trim();
    const body = document.getElementById('ghcBody').value.trim();
    if (!title || !body) return;
    const tagEl = document.querySelector('#ghcTags .ghc-tag.on');
    const tag = tagEl ? tagEl.dataset.tag : 'Discussion';
    const tagCls = tagEl ? tagEl.dataset.cls : 'discussion';
    let media = '';
    const prevImgEl = document.getElementById('ghcMediaPrevImg');
    if (prevImgEl && prevImgEl.src && prevImgEl.src.startsWith('data:')) media = prevImgEl.src;
    else media = document.getElementById('ghcMedia').value.trim() || '';
    const storyEl = document.getElementById('ghcStory');
    const storyTitle = storyEl.value.trim();
    const storyId = storyEl.dataset.storyId || '';
    const storyCover = storyEl.dataset.storyCover || '';
    const storyAuthor = storyEl.dataset.storyAuthor || '';
    const storyCat = storyEl.dataset.storyCat || GENRE.name || '';
    const tropeSel = document.getElementById('ghcTrope');
    const trope = tropeSel ? tropeSel.value : '';
    const boardGenreId = (document.getElementById('ghcGenre') || {}).value || '';
    const kids = (GENRE && Array.isArray(GENRE.genres)) ? GENRE.genres : [];
    const genreId = boardGenreId || (kids.length === 1 ? kids[0].id : '');

    if ((tag === 'Recommendation' || tagCls === 'recommendation') && storyId && window.ReadingHistory) {
      if (!ReadingHistory.guardRecommend(storyId, storyTitle)) return;
    }

    const payload = {
      genre: GENRE_ID, title, body, tag, tagClass: tagCls,
      ...(genreId && { genreId }),
      ...(trope && { trope }),
      ...(media && { media }),
      ...(storyTitle && { story: { id: storyId, title: storyTitle, writer: storyAuthor, cover: storyCover, cat: storyCat } })
    };

    const btn = document.getElementById('ghcPost');
    if (btn) { btn.style.opacity = '.45'; btn.style.pointerEvents = 'none'; }

    try {
      const res = await fetch(`${API_BASE}/discussions`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(res.status);
      const newPost = await res.json();
      ALL_POSTS.unshift(newPost);
      closeHubComposer();
      if (activeTab !== 'discussions') setActiveTab('discussions'); else renderFeed();
      toast('Posted to ' + GENRE.name + '!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // clear form
      document.getElementById('ghcTitle').value = '';
      document.getElementById('ghcBody').value = '';
      document.getElementById('ghcMedia').value = '';
      const fe = document.getElementById('ghcMediaFile'); if (fe) fe.value = '';
      const pv = document.getElementById('ghcMediaPrev'); if (pv) pv.style.display = 'none';
      const pi = document.getElementById('ghcMediaPrevImg'); if (pi) pi.src = '';
      storyEl.value = ''; storyEl.dataset.storyId = ''; storyEl.dataset.storyCover = '';
      storyEl.dataset.storyAuthor = ''; storyEl.dataset.storyCat = '';
      if (tropeSel) tropeSel.value = '';
      validateHubComposer();
      try { localStorage.removeItem(ghcDraftKey()); } catch(e) {}
    } catch(e) {
      toast('Failed to post. Please try again.');
      if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    }
  }
  function openComposer() {
    /* Posting needs an account — guests get the shared login wall. */
    if (window.RequireAuth && !RequireAuth.ensure('start a discussion')) return;
    /* ...and it is a board action, so membership comes first. The Join button
       above is the one path that writes CategoryMembership. */
    if (!joined) {
      toast('Join ' + GENRE.name + ' to start a discussion');
      const jb = document.getElementById('joinBtn');
      if (jb) { jb.classList.remove('on'); jb.focus(); }
      return;
    }
    ensureHubComposer();
    refreshTropeOptions();
    refreshGenreOptions();
    paintComposerAvatar();
    const h=document.querySelector('#ghcOv .ghc-head div'); if(h) h.textContent='New in '+GENRE.name;
    restoreGhcDraft();
    document.getElementById('ghcOv').classList.add('open'); document.body.style.overflow='hidden'; validateHubComposer();
  }
  function initComposer() {
    document.getElementById('composerStrip').addEventListener('click', openComposer);
    document.getElementById('fabNew').addEventListener('click', openComposer);
  }
  /* After a filter change, land on the first card — not page top. */
  function scrollToFirstCard() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    const top = feed.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  function initToTop() {
    const toTop = document.getElementById('toTop');
    window.addEventListener('scroll', () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      toTop.classList.toggle('show', y > 420);
    }, { passive: true });
    /* Land at the top of the page. Do NOT compute a target from
       sortRow.getBoundingClientRect(): .sort-row is position:sticky
       (top:101px), so once stuck its rect.top is pinned at 101 and
       `rect.top + scrollY - 110` collapses to `scrollY - 9` — the arrow
       then nudges the page up by 9px and looks dead. */
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  function initFilterFab(){
    const floating=document.getElementById('floatingFilters');
    const row=document.getElementById('sortRow');
    if(!floating||!row) return;
    function syncActive(s){
      document.querySelectorAll('#floatingFilters .sort-chip').forEach(c=> c.classList.toggle('active', c.dataset.sort===s));
      document.querySelectorAll('#sortRow .sort-chip').forEach(c=> c.classList.toggle('active', c.dataset.sort===s));
    }
    floating.querySelectorAll('.sort-chip').forEach(c=>{
      c.addEventListener('click', ()=>{
        const s=c.dataset.sort;
        sort=s; syncActive(s);
        if (activeTab==='discussions' || activeTab==='hot') renderFeed();
        else if (activeTab==='stories') renderStories();
        scrollToFirstCard();
        floating.classList.remove('show');
      });
    });
    // keep main row chips sync
    document.querySelectorAll('#sortRow .sort-chip').forEach(c=>{
      c.addEventListener('click', ()=> syncActive(c.dataset.sort));
    });
    // tap page aside when scrolled deep shows transparent floating filters
    document.addEventListener('click', (e)=>{
      if (e.target.closest('#sortRow') || e.target.closest('#floatingFilters') || e.target.closest('.sort-chip') || e.target.closest('#hubTabs') || e.target.closest('.top-bar') || e.target.closest('.fab') || e.target.closest('.to-top')) return;
      if (e.target.closest('[data-bro-ad]') || e.target.closest('.bro-ad') || e.target.closest('.promo-slot') || e.target.closest('.dac-native') || e.target.closest('.dac-story-promo')) return;
      if (activeTab==='members' || activeTab==='about') return;
      const y=window.scrollY||document.documentElement.scrollTop;
      if (y < 280) return;
      const post = e.target.closest('.dgc-post');
      const card = e.target.closest('.dbc-card');
      let isDivider = false;
      if (post) { const r=post.getBoundingClientRect(); if (r.bottom - e.clientY <= 12 && r.bottom - e.clientY >= -2) isDivider = true; }
      else if (card) { const r=card.getBoundingClientRect(); if (r.bottom - e.clientY <= 12 && r.bottom - e.clientY >= -2) isDivider = true; }
      else if (e.target.closest('#feed')) isDivider = true;
      if (!isDivider) return;
      if (floating.classList.contains('show')) { floating.classList.remove('show'); clearTimeout(floating._hideT); }
      else { floating.classList.add('show'); clearTimeout(floating._hideT); floating._hideT=setTimeout(()=> floating.classList.remove('show'), 4000); }
    });
    window.addEventListener('scroll', ()=>{
      const y=window.scrollY||document.documentElement.scrollTop;
      if (y < 180) floating.classList.remove('show');
    }, {passive:true});
    // hide on filter select via main row already syncs
  }

  /* ── Boot ── */
  async function init() {
    if (window.ScrollKeep) ScrollKeep.arm();
    initTheme();
    window.toast = toast;
    window.toggleTheme = toggleTheme;
    await loadGenre();
    await Promise.all([loadHubAds(), loadTropes()]);
    mountHubAd();
    wireComponents();
    initFilters();
    initTropeFilter();
    initJoin();
    initComposer();
    initToTop();
    initFilterFab();
    applyGenre();
    if (window.InsightsTracker) InsightsTracker.hit('hub', GENRE_ID);
    updateStoryTabBadge(0);
    setActiveTab('discussions');
    mountPromo();
    if (window.ScrollKeep) ScrollKeep.restore();
    if (window.DroboardSearch) {
      DroboardSearch.configure({
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => { location.href = 'profile.html?u=' + encodeURIComponent(((w && (w.handle || w.name)) || '').replace('@', '')); },
        onOpenDebate: (d) => { location.href = 'discussion.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
    if (window.DroboardNav) DroboardNav.configure({ active: 'none' });
  }

  window.GenreHubPage = { init, toast, toggleTheme, renderFeed, toggleMember: toggleMemberFollow, renderAbout, renderMembers, renderStories, renderHot, setActiveTab };
})();
