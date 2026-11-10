/* ═══════════════════════════════════════════════════════════════
   FOLLOWERS SERVICE — full page for /Pages/followers.html
   Live: GET /api/users/:handle/followers?page=&q=&filter=
   Shows Following / Followers with search, filter chips, pagination via FollowList + 1-2 ads.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
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
    return p.get('u') || p.get('handle') || '';
  }
  function getTab() {
    const p = new URLSearchParams(location.search);
    const t = (p.get('tab')||'').toLowerCase();
    return t==='followers' ? 'followers' : 'following';
  }
  async function fetchList(handle, tab) {
    const url = `${API_BASE}/users/${encodeURIComponent(handle)}/${tab}?limit=${PER_PAGE}&q=${encodeURIComponent(QUERY)}&filter=${FILTER}`;
    const r = await fetch(url, {credentials:'include'});
    if (!r.ok) throw new Error('Followers API failed: ' + r.status);
    const j = await r.json();
    return j.items || j.data || [];
  }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function toast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#161616;color:#fff;padding:10px 16px;border-radius:12px;font-size:12.5px;font-weight:600;z-index:300;max-width:min(360px,90vw);box-shadow:0 8px 24px rgba(0,0,0,.25)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
  /* Explicit error empty-state: the failure message is rendered, the page
     never falls back to canned data. */
  function renderError(err) {
    const listEl = document.getElementById('followersList');
    const pg = document.getElementById('followersPager');
    if (pg) pg.innerHTML = '';
    if (listEl) listEl.innerHTML = '<div style="padding:40px 14px;text-align:center;color:var(--tx-muted)"><i class="fas fa-triangle-exclamation" style="display:block;font-size:20px;margin-bottom:8px;opacity:.6"></i>Could not load ' + esc(TAB) + ' — ' + esc((err && err.message) || 'request failed') + '</div>';
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
          const isFollowing = item.following;
          const method = isFollowing ? 'POST' : 'DELETE';
          try {
            const r = await fetch(`${API_BASE}/users/${encodeURIComponent(handle)}/follow`, {
              method,
              credentials: 'include'
            });
            if (!r.ok) throw new Error('Follow failed (' + r.status + ')');
            item.following = isFollowing;
            const cur = followApi.getData(); const c=cur.find(x=>x.handle===handle); if(c) c.following=item.following;
            followApi.render();
          } catch(e) {
            // revert on failure and say why
            item.following = !isFollowing;
            followApi.render();
            toast('❌ ' + (e.message || 'Could not update follow — try again.'));
          }
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
        try{ if(window.AdService) AdService.track(ads[0].ad.id,'impression',{page:'followers',slot:'followers:in-feed'}); }catch(e){}
      }
      if (ads[1] && window.DroboardAdCard) {
        const slot2 = document.createElement('div'); slot2.className='follower-ad'; slot2.style.margin='10px 14px';
        slot2.innerHTML = ads[1].type==='storyPromo' ? DroboardAdCard.renderStoryPromo(ads[1].ad) : DroboardAdCard.renderNative(ads[1].ad);
        const pagerEl = document.getElementById('followersPager');
        if (pagerEl) pagerEl.before(slot2); else listEl.after(slot2);
        try{ if(window.AdService) AdService.track(ads[1].ad.id,'impression',{page:'followers',slot:'followers:in-feed'}); }catch(e){}
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
    try {
      ALL_ITEMS = await fetchList(HANDLE, TAB);
    } catch (e) {
      ALL_ITEMS = [];
      FILTERED = [];
      renderError(e);
      return;
    }
    applyFilters();
    render();
  }
  async function init() {
    HANDLE = getHandle();
    TAB = getTab();
    // set active tab UI
    document.querySelectorAll('.f-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===TAB));
    bindEvents();
    if (!HANDLE) {
      renderError(new Error('no ?u= handle in the URL'));
      return;
    }
    await initList();
  }
  window.FollowersPage = { init };
})();
