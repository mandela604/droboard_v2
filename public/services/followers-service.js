/* ═══════════════════════════════════════════════════════════════
   FOLLOWERS SERVICE — full page for /Pages/followers.html
   Call-and-render only. Demo: DemoData.USERS + ProfileData
   Live: GET /api/users/:handle/followers?page=&q=&filter=
   Shows Following / Followers with search, filter chips, pagination via FollowList + 1-2 ads.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const USE_API = false;
  const API_BASE = '/api';
  const PER_PAGE = 20;

  let HANDLE = null;
  let TAB = 'following'; // following | followers
  let QUERY = '';
  let FILTER = 'all'; // all | writers | readers
  let ALL_ITEMS = [];
  let FILTERED = [];
  let followApi = null;

  function getHandle() {
    const p = new URLSearchParams(location.search);
    return p.get('u') || p.get('handle') || (window.DemoData && DemoData.USERS && Object.keys(DemoData.USERS)[0]) || 'You_Reader';
  }
  function getTab() {
    const p = new URLSearchParams(location.search);
    const t = (p.get('tab')||'').toLowerCase();
    return t==='followers' ? 'followers' : 'following';
  }
  async function fetchList(handle, tab) {
    if (USE_API) {
      const url = `${API_BASE}/users/${encodeURIComponent(handle)}/${tab}?q=${encodeURIComponent(QUERY)}&filter=${FILTER}`;
      const r = await fetch(url, {credentials:'include'});
      if (!r.ok) throw new Error('Followers API failed');
      const j = await r.json();
      return j.items || j.data || [];
    }
    await new Promise(r=> setTimeout(r, 80));
    // demo: build from central DemoData + ProfileData
    let base = [];
    try {
      const d = window.DemoData;
      if (d && d.USERS && d.USERS[handle] && d.USERS[handle].following) {
        // following list is stored as following array for that user
        const src = tab==='following' ? d.USERS[handle].following : d.USERS[handle].followers;
        if (Array.isArray(src) && src.length) base = src.map(f=> ({ handle:f.name||f.handle, name:f.name||f.handle, avatar:f.av||f.avatar, meta:f.meta||'', role: f.role||'', following: !!f.following, isWriter: !!f.isWriter }));
      }
      // fallback: if no followers data, synthesize from USERS directory + pad to 1k demo
      if (!base.length) {
        const allHandles = d ? Object.keys(d.USERS) : [];
        const pool = allHandles.map(h=> d.USERS[h]).filter(u=> u.handle!==handle);
        // pad to ~24 for demo, but support 1k via generation
        const need = Math.min(1000, Math.max(24, pool.length * 3));
        while (base.length < need) {
          const u = pool[base.length % pool.length];
          if (!u) break;
          base.push({ handle:u.handle, name:u.name, avatar:u.avatar, meta:(u.isWriter?'Writer':'Reader')+' · '+(u.stats?u.stats.followers:''), role: u.isWriter?'Writer':'Reader', following: Math.random()>0.5, isWriter: !!u.isWriter });
        }
        if (tab==='followers') base = base.slice(0, Math.min(base.length, 1000));
      }
    } catch(e){ base=[]; }
    // demo pad to at least 24 to show pagination/search
    if (base.length && base.length < 24) {
      const extra = ['Alex_Jones','Mira_Lee','Sam_Wilson','Nina_Patel','Leo_King','Ivy_Chen','Omar_Farouk','Tara_Singh','Yuna_Kim','Jude_Obi','Aisha_Bello','Chinedu_Okafor','Fatima_Ali','Emeka_Nwosu','Zainab_Musa'];
      let i=0; while(base.length < 24 && i<extra.length) {
        const h=extra[i++]; if(base.find(x=>x.handle===h)) continue;
        base.push({ handle:h, name:h, avatar:'https://i.pravatar.cc/100?img='+(10+base.length), meta:'Reader · demo', role:'Reader', following: Math.random()>0.5, isWriter:false });
      }
    }
    return base;
  }
  function applyFilters() {
    let out = ALL_ITEMS.slice();
    if (FILTER==='writers') out = out.filter(x=> x.isWriter);
    else if (FILTER==='readers') out = out.filter(x=> !x.isWriter);
    if (QUERY) {
      const q=QUERY.toLowerCase();
      out = out.filter(x=> (x.handle||'').toLowerCase().includes(q) || (x.name||'').toLowerCase().includes(q));
    }
    FILTERED = out;
  }
  async function loadAds() {
    let ads=[];
    try {
      if (window.AdService) {
        const pools = await AdService.getAds({page:'followers'});
        (pools.native||[]).slice(0,1).forEach(ad=> ads.push({type:'native', ad}));
        (pools.book||[]).slice(0,1).forEach(ad=> ads.push({type:'storyPromo', ad}));
      }
    } catch(e){}
    return ads.slice(0,2);
  }
  function render() {
    const listEl = document.getElementById('followersList');
    if (!listEl) return;
    if (!FILTERED.length) {
      // show empty
      if (followApi) followApi.setData([]);
      listEl.innerHTML = '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)">No users found.</div>';
      const pg=document.getElementById('followersPager');
      if(pg) pg.innerHTML='';
      return;
    }
    if (!window.FollowList) {
      listEl.innerHTML = FILTERED.map(f=> `<div style="padding:10px 14px;border-bottom:1px solid var(--bd)">${f.handle}</div>`).join('');
      return;
    }
    // attach FollowList once
    if (!followApi) {
      followApi = FollowList.attach('#followersList', {
        perPage: PER_PAGE,
        emptyText: 'No users found.',
        onProfileClick: h=> location.href='profile.html?u='+encodeURIComponent(h),
        onToggle: async (handle, item)=>{
          // demo toggle locally
          item.following = !item.following;
          const cur = followApi.getData(); const c=cur.find(x=>x.handle===handle); if(c) c.following=item.following;
          followApi.render();
          try {
            const isFollowing = item.following;
            const call = isFollowing ? (window.ProfileData && ProfileData.followUser) : (window.ProfileData && ProfileData.unfollowUser);
            if(call) await call(HANDLE, handle);
          } catch(e){}
        }
      });
    }
    followApi.setData(FILTERED);
    // inject 1-2 ads after first page
    setTimeout(async ()=>{
      const ads = await loadAds();
      if(!ads.length) return;
      const pager = document.getElementById('followersPager');
      const container = pager ? pager.parentNode : listEl.parentNode;
      // remove old ad slots
      container.querySelectorAll('.follower-ad').forEach(el=> el.remove());
      if (ads[0] && window.DroboardAdCard) {
        const slot = document.createElement('div'); slot.className='follower-ad'; slot.style.margin='10px 14px';
        slot.innerHTML = ads[0].type==='native' ? DroboardAdCard.renderNative(ads[0].ad) : DroboardAdCard.renderStoryPromo(ads[0].ad);
        // insert after first page items (approx after 8 items)
        const after = listEl.querySelector('.fl-item:nth-child(8)');
        if (after) after.after(slot); else listEl.after(slot);
        try{ if(window.AdService) AdService.track(ads[0].ad.id,'impression'); }catch(e){}
      }
      if (ads[1] && window.DroboardAdCard) {
        const slot2 = document.createElement('div'); slot2.className='follower-ad'; slot2.style.margin='10px 14px';
        slot2.innerHTML = ads[1].type==='storyPromo' ? DroboardAdCard.renderStoryPromo(ads[1].ad) : DroboardAdCard.renderNative(ads[1].ad);
        const pagerEl = document.getElementById('followersPager');
        if (pagerEl) pagerEl.before(slot2); else listEl.after(slot2);
        try{ if(window.AdService) AdService.track(ads[1].ad.id,'impression'); }catch(e){}
      }
    }, 80);
  }
  function bindEvents() {
    const search = document.getElementById('followersSearch');
    if (search) {
      search.addEventListener('input', ()=>{
        QUERY = search.value.trim();
        applyFilters(); render();
      });
    }
    document.querySelectorAll('.f-filter-chip').forEach(ch=>{
      ch.addEventListener('click', ()=>{
        document.querySelectorAll('.f-filter-chip').forEach(c=> c.classList.remove('active'));
        ch.classList.add('active');
        FILTER = ch.dataset.filter || 'all';
        applyFilters(); render();
      });
    });
    document.querySelectorAll('.f-tab').forEach(t=>{
      t.addEventListener('click', ()=>{
        document.querySelectorAll('.f-tab').forEach(x=> x.classList.remove('active'));
        t.classList.add('active');
        TAB = t.dataset.tab;
        const url = new URL(location.href);
        url.searchParams.set('tab', TAB);
        history.replaceState(null,'', url);
        // reload list for new tab
        initList();
      });
    });
  }
  async function initList() {
    document.getElementById('followersTitle').textContent = TAB==='followers' ? 'Followers' : 'Following';
    document.getElementById('followersSub').textContent = HANDLE;
    ALL_ITEMS = await fetchList(HANDLE, TAB);
    applyFilters();
    render();
  }
  async function init() {
    HANDLE = getHandle();
    TAB = getTab();
    // set active tab UI
    document.querySelectorAll('.f-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===TAB));
    bindEvents();
    await initList();
  }
  window.FollowersPage = { init };
})();
