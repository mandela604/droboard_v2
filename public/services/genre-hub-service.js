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
  let sort = 'all';
  let activeTab = 'discussions';
  let joined = true;
  let _adTurn = 0;
  let memberApi = null;

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
    let list = [];
    try { const ov = JSON.parse(localStorage.getItem(MEMBER_KEY)||'{}'); if (ov[GENRE_ID] && ov[GENRE_ID].length) list = ov[GENRE_ID].map(m=> Object.assign({ handle:m.handle||m.name, name:m.name||m.handle, avatar:m.av||m.avatar||m.avatar, av:m.av||m.avatar||m.av, meta: m.meta || ((m.role||'Member')+' · '+(m.posts||0)+' posts'), following:!!m.following })); } catch(e){}
    if (!list.length) {
      const seed = window.GenreDemoSeed;
      if (seed && seed.DEMO_MEMBERS && seed.DEMO_MEMBERS[GENRE_ID]) list = seed.DEMO_MEMBERS[GENRE_ID].map(m=> Object.assign({ handle:m.handle, name:m.name, avatar:m.av||m.avatar, av:m.av||m.avatar, meta:(m.role||'Member')+' · '+(m.posts||0)+' posts', following:!!m.following }));
    }
    // pad to 12 for demo pagination
    if (list.length && list.length < 12) {
      const extra = ['Alex_Jones','Mira_Lee','Sam_Wilson','Nina_Patel','Leo_King','Ivy_Chen','Omar_Farouk','Tara_Singh','Yuna_Kim','Jude_Obi'];
      let i=0; while(list.length < 12 && i < extra.length) {
        const h=extra[i++]; if (list.find(x=> (x.handle||x.name)===h)) continue;
        list.push({ handle:h, name:h, avatar:'https://i.pravatar.cc/100?img='+(20+i), av:'https://i.pravatar.cc/100?img='+(20+i), meta:'Member · '+(5+i)+' posts', following: Math.random()>0.5 });
      }
    }
    return list;
  }
  function toggleMemberFollow(handle) {
    try {
      const m = JSON.parse(localStorage.getItem(MEMBER_KEY)||'{}');
      if (!m[GENRE_ID] || !m[GENRE_ID].length) m[GENRE_ID] = getMembers();
      const mem = m[GENRE_ID].find(x=> (x.handle||x.name)===handle);
      if (mem) mem.following = !mem.following;
      localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
      if (memberApi) {
        const cur = memberApi.getData(); const c = cur.find(x=> (x.handle||x.name)===handle); if(c) c.following = mem ? mem.following : !c.following;
        memberApi.render();
      } else renderMembers();
      toast(mem && mem.following ? 'Following @'+handle : 'Unfollowed @'+handle);
    } catch(e){}
  }
  function clearMemberPager() {
    const feed = document.getElementById('feed');
    const pg = feed ? feed.nextElementSibling : null;
    if (pg && pg.classList.contains('fl-pager')) pg.remove();
  }
  function renderMembers() {
    const members = getMembers();
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
  const NEW_DROP_KEY = 'dro_genre_newdrops';
  function getNewDropState(){
    try { return JSON.parse(localStorage.getItem(NEW_DROP_KEY)||'{}'); } catch(e){ return {}; }
  }
  function setNewDropState(m){ try { localStorage.setItem(NEW_DROP_KEY, JSON.stringify(m)); } catch(e){} }
  function updateStoryTabBadge(){
    const now = Date.now();
    const st = getNewDropState();
    let cnt = 0;
    Object.keys(st).forEach(k=>{
      if (!k.startsWith(GENRE_ID+':')) return;
      const v = st[k];
      if (v && v.count && (now - v.at < 2*60*60*1000)) cnt++;
    });
    const tab = document.querySelector('[data-tab="stories"]');
    if (!tab) return;
    let badge = tab.querySelector('.tab-badge');
    if (!badge) { badge = document.createElement('span'); badge.className='tab-badge'; badge.style.cssText='margin-left:6px;background:var(--acc);color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;padding:0 4px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle'; tab.appendChild(badge); }
    if (cnt>0) { badge.textContent = cnt; badge.style.display='inline-flex'; } else badge.style.display='none';
  }
  function ensureNewDrops(){
    const now=Date.now();
    const dropState=getNewDropState();
    const seed=window.GenreDemoSeed;
    let stories=[];
    if(seed && seed.DEMO_STORIES && seed.DEMO_STORIES[GENRE_ID]) stories=seed.DEMO_STORIES[GENRE_ID].slice(0,10);
    else if(window.DemoData && DemoData.STORIES) stories=DemoData.STORIES.filter(s=> (s.genre||'').toLowerCase().includes(GENRE_ID)).slice(0,10);
    let changed=false;
    stories.forEach(s=>{
      const key=GENRE_ID+':'+s.id;
      if(dropState[key]===undefined){
        if(Math.random()<0.3){ dropState[key]={count:1+(Math.random()>0.5?1:0), at: now - Math.floor(Math.random()*3*60*60*1000)}; } else dropState[key]=null;
        changed=true;
      }
    });
    let curNew=Object.keys(dropState).filter(k=> k.startsWith(GENRE_ID+':') && dropState[k] && (now - dropState[k].at < 2*60*60*1000)).length;
    if(curNew===0 && stories.length){
      for(let i=0;i<Math.min(2, stories.length); i++){
        const k=GENRE_ID+':'+stories[i].id;
        dropState[k]={count:1, at: now - 30*60*1000}; changed=true;
      }
    }
    if(changed) setNewDropState(dropState);
  }
  function renderStories() {
    const seed = window.GenreDemoSeed;
    let stories = [];
    if (seed && seed.DEMO_STORIES && seed.DEMO_STORIES[GENRE_ID]) stories = seed.DEMO_STORIES[GENRE_ID].slice(0,10);
    else if (window.DemoData && DemoData.STORIES) stories = DemoData.STORIES.filter(s=> (s.genre||'').toLowerCase().includes(GENRE_ID)).slice(0,10);
    else stories = [];
    if (!stories.length) { document.getElementById('feed').innerHTML='<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No stories in this hub yet.</div>'; clearMemberPager(); return; }
    // attach new-drop badge state (2hr window)
    const now = Date.now();
    const dropState = getNewDropState();
    stories.forEach(s=>{
      const key = GENRE_ID+':'+s.id;
      if (dropState[key] === undefined) {
        if (Math.random() < 0.3) {
          dropState[key] = { count: 1 + (Math.random()>0.5?1:0), at: now - Math.floor(Math.random()* 3*60*60*1000) };
        } else dropState[key] = null;
      }
    });
    // ensure at least 2 new for demo so badge always shows
    let curNew = Object.keys(dropState).filter(k=> k.startsWith(GENRE_ID+':') && dropState[k] && (now - dropState[k].at < 2*60*60*1000)).length;
    if (curNew === 0) {
      for(let i=0;i<Math.min(2, stories.length); i++){
        const k = GENRE_ID+':'+stories[i].id;
        dropState[k] = { count: 1, at: now - 30*60*1000 };
      }
    }
    setNewDropState(dropState);
    updateStoryTabBadge();
    // filter to only those within 2h and not yet cleared (count>0)
    const feedEl = document.getElementById('feed');
    // use book-card component like profile
    if (window.DroboardBookCard) {
      // map stories to book-card shape with status
      const books = stories.map(s=>{
        const key = GENRE_ID+':'+s.id;
        const nd = dropState[key];
        const isNew = nd && nd.count && (now - nd.at < 2*60*60*1000);
        return {
          id: s.id, title: s.title, genre: s.genre||GENRE.name, cover: s.cover||s.img||'',
          reads: s.reads||'', likes: s.likes||'', chapters: s.chapters|| s.ch || s.chaptersCount || 12,
          status: isNew ? 'new' : (s.status||'ongoing'),
          _newDrop: isNew ? nd.count : 0
        };
      });
      DroboardBookCard.renderList('#feed', books, {
        onOpen: (book)=>{
          // clear badge on click
          const key = GENRE_ID+':'+book.id;
          const st = getNewDropState();
          if (st[key]) { delete st[key]; setNewDropState(st); updateStoryTabBadge(); }
          location.href='bridge.html?id='+encodeURIComponent(book.id);
        }
      });
      // inject count badges after render
      setTimeout(()=>{
        document.querySelectorAll('#feed .dbc-card').forEach((card, i)=>{
          const book = books[i]; if (!book || !book._newDrop) return;
          const cover = card.querySelector('.dbc-cover');
          if (!cover) return;
          const badge = document.createElement('div');
          badge.textContent = book._newDrop + ' new';
          badge.style.cssText='position:absolute;top:6px;right:6px;background:var(--acc);color:#fff;font-size:9px;font-weight:800;padding:3px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.15)';
          cover.style.position='relative'; cover.appendChild(badge);
          // auto-clear after 2h is handled by time check on next render; also clear on click already
        });
      }, 30);
    } else {
      // fallback inline
      feedEl.innerHTML = stories.map(s => '<div class="story-hit" data-bid="'+(s.id||'').replace(/"/g,'&quot;')+'" style="display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid var(--bd);background:var(--l1);cursor:pointer"><div style="width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:var(--l2)"><img src="'+(s.cover||s.img||'')+'" style="width:100%;height:100%;object-fit:cover"/></div><div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;color:var(--acc);text-transform:uppercase">'+(s.genre||GENRE.name)+'</div><div style="font-size:13.5px;font-weight:700;line-height:1.3;margin:2px 0">'+s.title+'</div></div></div>').join('');
      feedEl.querySelectorAll('.story-hit').forEach(el=> el.addEventListener('click', ()=> {
        const key = GENRE_ID+':'+el.dataset.bid; const st=getNewDropState(); if(st[key]){ delete st[key]; setNewDropState(st); updateStoryTabBadge(); }
        location.href='bridge.html?id='+encodeURIComponent(el.dataset.bid);
      }));
    }
    clearMemberPager();
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
          const likes = (post && post.likes) || 0;
          const buckets = ['crying', 'shocked', 'emotional'];
          let h = 0; String(id).split('').forEach(ch => { h = (h + ch.charCodeAt(0)) % buckets.length; });
          const second = {}; second[buckets[h]] = 5; // fixed so tap is +1 only, but 2 icons still show
          return Object.assign({ userRx: post && post.liked ? 'love' : null, love: likes }, second);
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
        window.scrollTo({top:0, behavior:'smooth'});
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
  function ensureHubComposer() {
    if (document.getElementById('ghcOv')) return;
    const css = '.ghc-ov{position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:stretch;opacity:0;pointer-events:none;transition:opacity .22s} .ghc-ov.open{opacity:1;pointer-events:auto} .ghc-sheet{width:100%;max-width:420px;height:100dvh;background:#fff;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 0 50px rgba(0,0,0,.3)} .ghc-ov.open .ghc-sheet{transform:translateY(0)} .ghc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--bd,rgba(0,0,0,.08));background:#fff;flex-shrink:0} .ghc-body{flex:1;overflow-y:auto;padding:16px;background:#fff} .ghc-label{font-size:11px;font-weight:700;color:var(--tx-muted,#666);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 6px;display:block} .ghc-label:first-child{margin-top:0} .ghc-input,.ghc-textarea{width:100%;border:1.5px solid var(--bd,rgba(0,0,0,.08));border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;background:var(--l2,#f1f1f1);color:var(--tx-high,#161616);outline:none} .ghc-input:focus,.ghc-textarea:focus{border-color:var(--acc,#ff0050);background:#fff} .ghc-textarea{min-height:100px;resize:none} .ghc-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px} .ghc-tag{padding:7px 12px;border-radius:20px;font-size:11.5px;font-weight:700;border:1.5px solid var(--bd,rgba(0,0,0,.08));background:var(--l2,#f1f1f1);color:var(--tx-muted,#666);cursor:pointer} .ghc-tag.on{background:rgba(255,0,80,.08);border-color:var(--bd-acc,rgba(255,0,80,.2));color:var(--acc,#ff0050)}';
    const st=document.createElement('style'); st.id='ghc-style'; st.textContent=css; document.head.appendChild(st);
    const html = `<div class="ghc-ov" id="ghcOv"><div class="ghc-sheet"><div class="ghc-head"><button id="ghcCancel" style="background:none;border:none;font-size:14px;color:var(--tx-muted);font-family:inherit;cursor:pointer">Cancel</button><div style="font-size:15px;font-weight:700">New in ${GENRE.name}</div><button id="ghcPost" style="background:var(--acc);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;opacity:.45;pointer-events:none">Post</button></div><div class="ghc-body"><label class="ghc-label">Title *</label><input id="ghcTitle" class="ghc-input" placeholder="What's the discussion about?"/><label class="ghc-label">Body *</label><textarea id="ghcBody" class="ghc-textarea" placeholder="Share details, ask a question, post a theory…"></textarea><label class="ghc-label">Tag</label><div class="ghc-tags" id="ghcTags"><button class="ghc-tag on" data-tag="Discussion" data-cls="discussion">Discussion</button><button class="ghc-tag" data-tag="Theory" data-cls="theory">Theory</button><button class="ghc-tag" data-tag="Recommendation" data-cls="recommendation">Recommendation</button><button class="ghc-tag" data-tag="Question" data-cls="question">Question</button><button class="ghc-tag" data-tag="Controversial" data-cls="controversial">Controversial</button></div><label class="ghc-label">Photo (optional)</label><input type="file" id="ghcMediaFile" accept="image/*" class="ghc-input"/><div id="ghcMediaPrev" style="display:none;margin-top:8px;border-radius:10px;overflow:hidden;max-height:180px"><img id="ghcMediaPrevImg" style="width:100%;max-height:180px;object-fit:cover;display:block"/></div><label class="ghc-label">Image URL (optional)</label><input id="ghcMedia" class="ghc-input" placeholder="https://..."/><label class="ghc-label">Story (optional)</label><input id="ghcStory" class="ghc-input" placeholder="Story title you are discussing"/></div></div></div>`;
    const wrap=document.createElement('div'); wrap.innerHTML=html; while(wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.getElementById('ghcCancel').addEventListener('click', closeHubComposer);
    document.getElementById('ghcOv').addEventListener('click', e=>{ if(e.target.id==='ghcOv') closeHubComposer(); });
    document.getElementById('ghcTitle').addEventListener('input', validateHubComposer);
    document.getElementById('ghcBody').addEventListener('input', validateHubComposer);
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
  function validateHubComposer(){
    const t=document.getElementById('ghcTitle'), b=document.getElementById('ghcBody'), btn=document.getElementById('ghcPost');
    const ok = t && b && t.value.trim().length>=4 && b.value.trim().length>=6;
    if(btn){ btn.style.opacity = ok? '1':'.45'; btn.style.pointerEvents = ok? 'auto':'none'; }
  }
  function closeHubComposer(){ const ov=document.getElementById('ghcOv'); if(ov) ov.classList.remove('open'); document.body.style.overflow=''; }
  function submitHubPost(){
    const title=document.getElementById('ghcTitle').value.trim();
    const body=document.getElementById('ghcBody').value.trim();
    if(!title || !body) return;
    const tagEl=document.querySelector('#ghcTags .ghc-tag.on');
    const tag=tagEl ? tagEl.dataset.tag : 'Discussion';
    const tagCls=tagEl ? tagEl.dataset.cls : 'discussion';
    let media=''; const prevImgEl=document.getElementById('ghcMediaPrevImg'); if(prevImgEl && prevImgEl.src && prevImgEl.src.startsWith('data:')) media=prevImgEl.src; else media=document.getElementById('ghcMedia').value.trim() || '';
    const storyTitle=document.getElementById('ghcStory').value.trim();
    const post={
      id:'gh_'+Date.now(), name: (window.DemoData && DemoData.USERS && DemoData.USERS['You_Reader'] ? 'You_Reader' : 'You'), avatar: (window.DemoData && DemoData.USERS && DemoData.USERS['You_Reader'] ? DemoData.USERS['You_Reader'].avatar : 'https://i.pravatar.cc/100?img=12'),
      time:'Just now', title, body, tag, tagClass:tagCls, likes:0, comments:0, liked:false, score:Date.now()
    };
    if(media) post.media=media;
    if(storyTitle) post.story={ title:storyTitle, writer:'', cover:'' };
    ALL_POSTS.unshift(post);
    closeHubComposer();
    if (activeTab !== 'discussions') setActiveTab('discussions'); else renderFeed();
    toast('Posted to '+GENRE.name+'!');
    window.scrollTo({top:0, behavior:'smooth'});
    // clear form
    document.getElementById('ghcTitle').value=''; document.getElementById('ghcBody').value=''; document.getElementById('ghcMedia').value=''; const fe=document.getElementById('ghcMediaFile'); if(fe) fe.value=''; const pv=document.getElementById('ghcMediaPrev'); if(pv) pv.style.display='none'; const pi=document.getElementById('ghcMediaPrevImg'); if(pi) pi.src=''; document.getElementById('ghcStory').value=''; validateHubComposer();
  }
  function openComposer() {
    ensureHubComposer();
    const h=document.querySelector('#ghcOv .ghc-head div'); if(h) h.textContent='New in '+GENRE.name;
    document.getElementById('ghcOv').classList.add('open'); document.body.style.overflow='hidden'; validateHubComposer();
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
        window.scrollTo({top:0, behavior:'smooth'});
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
    try {
      initTheme();
      window.toast = toast;
      window.toggleTheme = toggleTheme;
      loadGenre();
      if (!GENRE) { GENRE={id:'fantasy',name:'Fantasy',tagline:'Where imagination becomes legend.',icon:'fa-hat-wizard',cover:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',members:'45.7K',discussions:'3.2K',stories:'1.8K',blurb:'Discuss tropes.'}; GENRE_ID='fantasy'; ALL_POSTS=[{id:'pinned-fallback',pinned:true,title:'Welcome to Fantasy',desc:'Start a discussion.',likes:0,comments:0}]; }
      await loadHubAds();
    wireComponents();
    initFilters();
    initJoin();
    initComposer();
    initToTop();
    initFilterFab();
    applyGenre();
    ensureNewDrops();
    updateStoryTabBadge();
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
    } catch(e){ console.error(e); toast('Hub load failed'); }
  }

  window.GenreHubPage = { init, toast, toggleTheme, renderFeed, toggleMember: toggleMemberFollow, renderAbout, renderMembers, renderStories, renderHot, setActiveTab };
})();
