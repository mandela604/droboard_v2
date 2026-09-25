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
  let ALL_POSTS = [];
  let PROMO_SLIDES = [];
  let sort = 'hot';
  let activeTab = 'discussions';
  let joined = true;
  let _adTurn = 0;

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

  function trackAd(id, ev) { try { if (id && window.AdService) AdService.track(id, ev); } catch (e) {} }
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
  const ABOUT_KEY = 'dro_genre_about_override';
  const MEMBER_KEY = 'dro_genre_members_override';
  function readAboutOverride(id) {
    try { const m = JSON.parse(localStorage.getItem(ABOUT_KEY) || '{}'); return m[id] || null; } catch (e) { return null; }
  }
  function writeAboutOverride(id, patch) {
    try { const m = JSON.parse(localStorage.getItem(ABOUT_KEY) || '{}'); m[id] = Object.assign({}, m[id] || {}, patch); localStorage.setItem(ABOUT_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function loadGenre() {
    const seed = window.GenreDemoSeed;
    const demo = window.DemoData;
    const params = new URLSearchParams(location.search);
    const rawId = params.get('genre') || (seed && seed.DEFAULT_GENRE_ID) || 'fantasy';
    GENRE_ID = (rawId||'fantasy').toLowerCase();
    let base = null;
    if (seed && seed.DEMO_GENRES) base = seed.DEMO_GENRES[GENRE_ID] || seed.DEMO_GENRES[rawId] || seed.DEMO_GENRES[seed.DEFAULT_GENRE_ID];
    if (!base && demo && demo.GENRES) {
      const g = demo.GENRES.find(x => (x.id||'').toLowerCase() === GENRE_ID);
      if (g) base = { id:g.id, name:g.name, tagline:g.tagline, icon:'fa-book', cover:g.cover||'', members:g.members, discussions:g.discussions, stories:g.stories, blurb:g.tagline };
    }
    if (!base) { base = { id:'fantasy', name:'Fantasy', tagline:'Where imagination becomes legend.', icon:'fa-hat-wizard', cover:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop', members:'45.7K', discussions:'3.2K', stories:'1.8K', blurb:'Discuss tropes, argue theories.' }; GENRE_ID='fantasy'; }
    const ov = readAboutOverride(GENRE_ID);
    GENRE = Object.assign({}, base, ov || {});
    GENRE_ID = (GENRE.id||GENRE_ID).toLowerCase();
    if (seed && seed.DEMO_DISCUSSIONS && seed.DEMO_DISCUSSIONS[GENRE_ID]) {
      ALL_POSTS = [seed.DEMO_PINNED[GENRE_ID], ...seed.DEMO_DISCUSSIONS[GENRE_ID]].filter(Boolean);
    } else if (seed && seed.DEMO_DISCUSSIONS && seed.DEMO_DISCUSSIONS[rawId]) {
      ALL_POSTS = [seed.DEMO_PINNED[rawId], ...seed.DEMO_DISCUSSIONS[rawId]].filter(Boolean);
    } else {
      ALL_POSTS = (demo && demo.COMMENTS ? demo.COMMENTS.slice(0,12).map(c=>({id:'c'+c.id,title:c.text,body:c.text,likes:c.likes,comments:2,score:c.likes})) : []);
      if (!ALL_POSTS.length) ALL_POSTS = [{id:'pinned-fallback',pinned:true,title:'Welcome to '+GENRE.name,desc:'Start a discussion.',likes:0,comments:0}];
    }
    PROMO_SLIDES = [];
    return true;
  }

  function applyGenre() {
    document.getElementById('pageTitle').textContent = GENRE.name;
    document.getElementById('heroName').textContent = GENRE.name;
    document.getElementById('heroTag').textContent = GENRE.tagline || '';
    document.getElementById('heroImg').src = GENRE.cover || '';
    document.getElementById('heroIcon').className = 'fas ' + (GENRE.icon || 'fa-book');
    document.getElementById('statMembers').textContent = GENRE.members || '—';
    document.getElementById('statDisc').textContent = GENRE.discussions || '—';
    document.getElementById('statStories').textContent = GENRE.stories || '—';
    document.getElementById('blurbText').textContent = GENRE.blurb || '';
    document.getElementById('composerPh').textContent = 'Start a discussion in ' + GENRE.name + '…';
    document.title = GENRE.name + ' · Genre Hub · DroBoard';
    if (window.DroboardGenreCard) DroboardGenreCard.setGenreName(GENRE.name);
  }

  /* ── Feed ── */
  function sortedDiscussions() {
    const list = ALL_POSTS.filter(p => !p.pinned).slice();
    if (sort === 'hot') return list.sort((a, b) => (b.score || 0) - (a.score || 0) || ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)));
    if (sort === 'controversial') return list.sort((a, b) => (b.controversy || 0) - (a.controversy || 0) || (b.comments || 0) - (a.comments || 0));
    if (sort === 'top') return list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    if (sort === 'unanswered') return list.filter(p => !p.comments).concat(list.filter(p => p.comments));
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
    const pinned = ALL_POSTS.filter(p => p.pinned);
    const list = sortedDiscussions();
    if (!window.DroboardGenreCard) {
      document.getElementById('feed').innerHTML = '<div style="padding:20px;color:var(--tx-muted)">genre-card.js missing</div>';
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
      onSelect: (s) => toast('📖 ' + (s.title || '')),
    });
  }
  function setActiveTab(tab) {
    activeTab = tab;
    document.querySelectorAll('#hubTabs .tab').forEach(x => x.classList.toggle('active', x.dataset.tab===tab));
    const sortRow = document.getElementById('sortRow');
    const composer = document.getElementById('composerStrip');
    if (tab==='members' || tab==='about') { sortRow.style.display='none'; composer.style.display='none'; }
    else { sortRow.style.display='flex'; composer.style.display='flex'; }
    if (tab==='discussions') renderFeed();
    else if (tab==='hot') renderHot();
    else if (tab==='stories') renderStories();
    else if (tab==='members') renderMembers();
    else if (tab==='about') renderAbout();
  }

  /* ── About inline CRUD ── */
  function renderAbout() {
    const feed = document.getElementById('feed');
    feed.innerHTML = '<div style="padding:14px"><div style="background:var(--l1);border:1px solid var(--bd);border-radius:14px;padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:14px">About '+GENRE.name+'</b><button id="aboutEditBtn" style="font-size:11px;font-weight:700;color:var(--acc);background:rgba(255,0,80,.08);border:1px solid var(--bd-acc);padding:6px 10px;border-radius:10px"><i class="fas fa-pen"></i> Edit</button></div><div style="font-size:12px;line-height:1.6;color:var(--tx-body)" id="aboutBlurbView">'+(GENRE.blurb||'')+'</div><div id="aboutForm" style="display:none;margin-top:10px"><input id="aboutName" value="'+(GENRE.name||'').replace(/"/g,'&quot;')+'" placeholder="Genre name" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px"/><input id="aboutTagline" value="'+(GENRE.tagline||'').replace(/"/g,'&quot;')+'" placeholder="Tagline" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:8px"/><textarea id="aboutBlurb" rows="3" placeholder="About this hub" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:13px;resize:none;margin-bottom:8px">'+(GENRE.blurb||'')+'</textarea><input id="aboutCover" value="'+(GENRE.cover||'').replace(/"/g,'&quot;')+'" placeholder="Cover image URL" style="width:100%;background:var(--l2);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;font-size:12px;margin-bottom:10px"/><div style="display:flex;gap:8px"><button id="aboutSave" style="flex:1;background:var(--acc);color:#fff;padding:10px;border-radius:10px;font-weight:700">Save</button><button id="aboutDelete" style="flex:1;background:var(--l2);border:1px solid var(--bd);padding:10px;border-radius:10px;font-weight:700">Reset</button><button id="aboutCancel" style="flex:1;background:transparent;border:1px solid var(--bd);padding:10px;border-radius:10px">Cancel</button></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.members||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Members</div></div><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.stories||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Stories</div></div><div style="background:var(--l2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:800">'+(GENRE.discussions||'—')+'</div><div style="font-size:10px;color:var(--tx-muted)">Threads</div></div></div></div>';
    document.getElementById('aboutEditBtn').onclick = () => { document.getElementById('aboutForm').style.display='block'; document.getElementById('aboutBlurbView').style.display='none'; };
    document.getElementById('aboutCancel').onclick = () => { document.getElementById('aboutForm').style.display='none'; document.getElementById('aboutBlurbView').style.display='block'; };
    document.getElementById('aboutSave').onclick = () => {
      const patch = { name: document.getElementById('aboutName').value.trim()||GENRE.name, tagline: document.getElementById('aboutTagline').value.trim(), blurb: document.getElementById('aboutBlurb').value.trim(), cover: document.getElementById('aboutCover').value.trim() };
      writeAboutOverride(GENRE_ID, patch); Object.assign(GENRE, patch); applyGenre(); renderAbout(); toast('About saved');
    };
    document.getElementById('aboutDelete').onclick = () => { try { const m = JSON.parse(localStorage.getItem(ABOUT_KEY)||'{}'); delete m[GENRE_ID]; localStorage.setItem(ABOUT_KEY, JSON.stringify(m)); } catch(e){} location.reload(); };
  }
  function getMembers() {
    try { const ov = JSON.parse(localStorage.getItem(MEMBER_KEY)||'{}'); if (ov[GENRE_ID]) return ov[GENRE_ID]; } catch(e){}
    const seed = window.GenreDemoSeed;
    if (seed && seed.DEMO_MEMBERS && seed.DEMO_MEMBERS[GENRE_ID]) return seed.DEMO_MEMBERS[GENRE_ID];
    return [];
  }
  function toggleMemberFollow(handle) {
    try { const m = JSON.parse(localStorage.getItem(MEMBER_KEY)||'{}'); if (!m[GENRE_ID]) m[GENRE_ID]=getMembers(); const mem=m[GENRE_ID].find(x=>x.handle===handle); if(mem) mem.following=!mem.following; localStorage.setItem(MEMBER_KEY, JSON.stringify(m)); renderMembers(); } catch(e){}
  }
  function renderMembers() {
    const members = getMembers();
    const feed = document.getElementById('feed');
    if (!members.length) { feed.innerHTML='<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No members yet.</div>'; return; }
    feed.innerHTML = members.map(m => '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--bd);background:var(--l1)"><img src="'+(m.av||m.avatar||'https://i.pravatar.cc/100?img=12')+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover"/><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(m.name||m.handle)+'</div><div style="font-size:11px;color:var(--tx-muted)">'+(m.role||'')+' · '+(m.posts||0)+' posts</div></div><button onclick="GenreHubPage.toggleMember(\''+m.handle+'\')" style="padding:6px 12px;border-radius:16px;font-size:11px;font-weight:700;border:1px solid var(--bd);background:'+(m.following?'var(--acc);color:#fff':'var(--l2)')+'">'+(m.following?'Following':'Follow')+'</button></div>').join('');
  }
  function renderStories() {
    const seed = window.GenreDemoSeed;
    let stories = [];
    if (seed && seed.DEMO_STORIES && seed.DEMO_STORIES[GENRE_ID]) stories = seed.DEMO_STORIES[GENRE_ID];
    else if (window.DemoData && DemoData.STORIES) stories = DemoData.STORIES.filter(s=> (s.genre||'').toLowerCase().includes(GENRE_ID)).slice(0,12);
    if (!stories.length) { document.getElementById('feed').innerHTML='<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No stories in this hub yet.</div>'; return; }
    const feedEl = document.getElementById('feed');
    feedEl.innerHTML = stories.map(s => '<div class="story-hit" data-bid="'+(s.id||'').replace(/"/g,'&quot;')+'" style="display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid var(--bd);background:var(--l1);cursor:pointer"><div style="width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:var(--l2)"><img src="'+(s.cover||s.img||'')+'" style="width:100%;height:100%;object-fit:cover"/></div><div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;color:var(--acc);text-transform:uppercase">'+(s.genre||GENRE.name)+'</div><div style="font-size:13.5px;font-weight:700;line-height:1.3;margin:2px 0">'+s.title+'</div><div style="font-size:11.5px;color:var(--tx-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+(s.preview||s.desc||'')+'</div><div style="display:flex;gap:10px;margin-top:6px;font-size:10px;color:var(--tx-muted)"><span>⭐ '+(s.rating||'4.8')+'</span><span>👁 '+(s.reads||'')+'</span></div></div></div>').join('');
    feedEl.querySelectorAll('.story-hit').forEach(el=> el.addEventListener('click', ()=> location.href='bridge.html?id='+encodeURIComponent(el.dataset.bid)));
  }
  function renderHot() {
    const hot = ALL_POSTS.filter(p=>p.hot).slice(0,12);
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
      DroboardReactionPicker.attach(feedEl, {
        topRow: 'external',
        getState: (id) => {
          const post = findPost(id);
          return { userRx: post && post.liked ? 'love' : null, love: (post && post.likes) || 0 };
        },
        onReact: (id) => {
          const post = findPost(id);
          if (!post) return;
          post.liked = !post.liked;
          post.likes = (post.likes || 0) + (post.liked ? 1 : -1);
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
        onStory: (post) => toast('📖 ' + ((post.story && post.story.title) || 'Story')),
        onAvatar: (post) => { location.href = 'profile.html?u=' + encodeURIComponent(post.name || ''); },
        onNameClick: (post, name) => { location.href = 'profile.html?u=' + encodeURIComponent(name || (post && post.name) || ''); },
        onPinned: () => toast('Hub rules…'),
      });
    }
    if (window.DroboardDotsMenu) {
      DroboardDotsMenu.configure({
        onFollow: (post) => toast('Following @' + (post.name || 'user')),
        onMute: (post) => toast('Muted @' + (post.name || 'user')),
        onLess: () => toast('Showing less of this.'),
        onReport: () => toast('🚩 Reported'),
        onCopyLink: (post) => {
          const url = 'https://droboard.app/hub/' + GENRE_ID + '/' + post.id;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('🔗 Link copied')).catch(() => toast(url));
          else toast(url);
        },
        onEdit: () => toast('✏️ Edit'),
        onDelete: () => toast('🗑️ Delete'),
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
  function initFilters() {
    document.querySelectorAll('#sortRow .sort-chip').forEach(c => {
      c.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('#sortRow .sort-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        sort = c.dataset.sort;
        if (activeTab==='discussions' || activeTab==='hot') renderFeed();
        else if (activeTab==='stories') renderStories();
      });
    });
    document.querySelectorAll('#hubTabs .tab').forEach(t => {
      t.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(t.dataset.tab); });
    });
  }
  function initJoin() {
    document.getElementById('joinBtn').addEventListener('click', function () {
      joined = !joined;
      this.classList.toggle('on', joined);
      this.innerHTML = joined ? '<i class="fas fa-check"></i> Joined' : '<i class="fas fa-plus"></i> Join';
      toast(joined ? 'Joined ' + GENRE.name : 'Left hub');
    });
  }
  function openComposer() {
    if (window.PostComposer) {
      PostComposer.open({
        genreName: GENRE.name,
        onPost: function (post) {
          post.score = Date.now();
          ALL_POSTS.unshift(post);
          renderFeed();
          toast('Posted to ' + GENRE.name + '!');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
    } else {
      toast('Composer — start a ' + GENRE.name + ' discussion');
    }
  }
  function initComposer() {
    document.getElementById('composerStrip').addEventListener('click', openComposer);
    document.getElementById('fabNew').addEventListener('click', openComposer);
  }
  function initToTop() {
    const toTop = document.getElementById('toTop');
    const sortRow = document.getElementById('sortRow');
    window.addEventListener('scroll', () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      toTop.classList.toggle('show', y > 420);
    }, { passive: true });
    toTop.addEventListener('click', () => {
      const top = sortRow.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  /* ── Boot ── */
  async function init() {
    initTheme();
    window.toast = toast;
    window.toggleTheme = toggleTheme;
    if (!loadGenre()) return;
    await loadHubAds();
    wireComponents();
    initFilters();
    initJoin();
    initComposer();
    initToTop();
    applyGenre();
    setActiveTab('discussions');
    mountPromo();
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
    if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
  }

  window.GenreHubPage = { init, toast, toggleTheme, renderFeed, toggleMember: toggleMemberFollow, renderAbout, renderMembers, renderStories, renderHot, setActiveTab };
})();
