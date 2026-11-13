/* ═══════════════════════════════════════════════════════════════
   DROBOARD-PAGE SERVICE — call-and-render only
   Use: DroboardOfficial.init(). Everything below is live:

     Feed        GET  /api/droboard-page/posts        (listPosts alias; page+limit)
     Create/edit POST /api/posts · PATCH /api/posts/:id
     Delete      DELETE /api/posts/:id
     Pin         PATCH /api/posts/:id  { pinned }
     Like        POST  /api/posts/:id/like
     Save        POST  /api/posts/:id/save
     Poll vote   POST  /api/posts/:id/poll/vote  { option }
     Debate vote POST  /api/posts/:id/debate/vote { side }
     Reactions   POST/DELETE /api/posts/:id/react  { rid }
     Comments    GET/POST /api/comments?scope=post&postId=…
     Page follow GET /api/users/droboard · POST/DELETE /api/users/:handle/follow
     Collections GET /api/collections
     Status rings GET /api/statuses/writers?handles=…
     Reports     POST /api/reports { target:'post', … }

   Page-manager roles have NO backend route yet: DroboardPageData.
   getManagers/addManager/updateManagerRole/removeManager throw instead
   of rendering fake data. Page info (bio/links/rules) saving also has
   no route, so the about editor is disabled — the panel renders the
   page's static copy only.
   ═══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';
const API_BASE = '/api';
const PAGE_SIZE = 20; // feed row cap — the page never ranks or batches beyond this
const RP = global.DroboardReactionPicker; // loaded from component/reaction-picker.js before this service

async function api(path, opts){
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, opts || {}));
  let j = null; try { j = await res.json(); } catch(e) {}
  if (!res.ok) { const e = new Error((j && j.error) || ('API failed: ' + res.status)); e.status = res.status; throw e; }
  return j;
}

async function getCurrentUser(){
  try {
    const data = await api('/users/me');
    return data.user || data.data || data;
  } catch(e) { return null; }
}

function rolesOf(user){
  if (Array.isArray(user && user.roles)) return user.roles.map(String);
  if (user && user.role) return [String(user.role)];
  return [];
}
async function canManage(handle, need){
  const user = await getCurrentUser();
  if (!user) return false;
  const roles = rolesOf(user);
  if (need === 'post') return roles.indexOf('admin') !== -1 || roles.indexOf('senior_editor') !== -1 || roles.indexOf('chief_editor') !== -1;
  if (need === 'manage_roles') return roles.indexOf('admin') !== -1;
  return false;
}

let editingId = null; // post id being edited through the composer (null = new post)
async function createPost(payload){
  const allowed = ['announcement','post','debate','shoutout','repost','forum-poll','ama'];
  if (!payload || !payload.type || allowed.indexOf(payload.type) === -1) throw new Error('Invalid post type');
  if (!payload.text && !payload.title && !payload.shoutout && !payload.storyRef && !payload.debateData && !payload.poll) throw new Error('Post needs content');
  if (editingId){
    // The composer always "creates"; while an edit is open we redirect the
    // same call to PATCH so nothing is duplicated and nothing is faked.
    const id = editingId;
    const j = await api('/posts/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return Object.assign({ _editedId: id }, j);
  }
  return await api('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function fetchPosts(page){
  const j = await api('/droboard-page/posts?page=' + (parseInt(page, 10) || 1) + '&limit=' + PAGE_SIZE);
  const items = Array.isArray(j) ? j : (j.items || []);
  const total = (j && j.total) != null ? Number(j.total) : items.length;
  return { posts: items, total: total };
}

async function fetchCollections(){
  const j = await api('/collections?limit=20');
  return Array.isArray(j) ? j : (j.items || []);
}

// Page managers: no backend route exists — fail loudly instead of faking a roster.
function getManagers(){ throw new Error('Page managers API is not available yet (no backend route)'); }
function addManager(){ throw new Error('Page managers API is not available yet (no backend route)'); }
function updateManagerRole(){ throw new Error('Page managers API is not available yet (no backend route)'); }
function removeManager(){ throw new Error('Page managers API is not available yet (no backend route)'); }

global.DroboardPageData = { fetchPosts, fetchCollections, canManage, canCurrentManage, createPost, getManagers, addManager, updateManagerRole, removeManager, API_BASE };

// ── Page controller ──
let _pageSettings={}; // in-memory UI preference (support strip visibility)
let POSTS=[], feedTotal=0, currentTab='all';
let FOLLOW_STATE = {}; // shoutout author id -> following (loaded from live profiles)
let followersCount = 0;
let following = false;
let notifyOn = false;
const inlineOpen = {}; // postId -> bool (inline comments expanded)
const inlineCS = {};   // postId -> DroboardComments instance
let mountInlineRef = null; // set by attachPostCard; used to restore open threads

function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function fmtN(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n||0)}
const DROBOARD_LOGO='../assets/droboard-icon.png';

function mapPost(p){
  // Remap repost → recommendation so story picks render as story cards,
  // not repost cards. Matches feed-service.js behavior.
  const mapped = Object.assign({}, p);
  if (mapped.type === 'repost') mapped.type = 'recommendation';
  if(mapped.type==='shoutout' && mapped.shoutout && mapped.shoutout.id){
    const s = mapped.shoutout;
    const name = s.name || 'Droboard Writer';
    const av   = s.avatar || DROBOARD_LOGO;
    return Object.assign({}, mapped, { avatar: DROBOARD_LOGO, name: mapped.name || 'Droboard', shoutout:Object.assign({}, s, { name:name, avatar:av, following:!!FOLLOW_STATE[s.id], _writerId:s.id }) });
  }
  return Object.assign({ avatar: DROBOARD_LOGO, name: 'Droboard' }, mapped);
}
function findPostAnywhere(id){
  return POSTS.find(function(p){return String(p.id)===String(id)}) || null;
}
function replaceInPOSTS(card){
  const i=POSTS.findIndex(function(x){return String(x.id)===String(card.id)});
  if(i>-1) POSTS[i]=card; else POSTS.unshift(card);
}
function updateCard(post){
  DroboardPostCard.update(mapPost(post));
  if(inlineOpen[post.id] && mountInlineRef) mountInlineRef(post);
}
function currentList(){
  const list=(currentTab==='all') ? POSTS.slice() : POSTS.filter(function(p){return p.type===currentTab});
  const pinned=list.filter(function(p){return p.pinned});
  const rest=list.filter(function(p){return !p.pinned});
  return pinned.concat(rest); // pinned always on top, stable order otherwise
}
function pinnedCountExcept(id){
  const seen={}; let n=0;
  POSTS.forEach(function(p){
    if(!p || seen[p.id] || String(p.id)===String(id)) return;
    seen[p.id]=1; if(p.pinned) n++;
  });
  return n;
}

function renderFollowUI(){
  const btn=document.getElementById('followBtn'); if(!btn) return;
  btn.innerHTML = following ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-plus"></i> Follow';
  btn.classList.toggle('ing', following);
  const count=followersCount+(following?1:0);
  const sf=document.getElementById('statFollowers'); if(sf) sf.textContent=fmtN(count);
  const tf=document.getElementById('topFollowerCount'); if(tf) tf.textContent=fmtN(count)+' followers';
  const nb=document.getElementById('notifBtn'); if(nb) nb.classList.toggle('on', notifyOn && following);
}
async function loadPageProfile(){
  try {
    const data = await api('/users/droboard');
    const u = data.profile || data.user || data.data || data;
    if (u && u.followers != null) followersCount = Number(u.followers) || 0;
    if (u && u.isFollowing != null) following = !!u.isFollowing;
  } catch(e) { /* the follow strip keeps its last known live value */ }
}

function initTabs(){
  document.querySelectorAll('.pg-tab').forEach(function(t){
    t.addEventListener('click', function(){ switchTab(t.dataset.tab); });
  });
}
function switchTab(tab){
  currentTab=tab;
  document.querySelectorAll('.pg-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.tab===tab); });
  const pf=document.getElementById('panel-feed'); if(pf) pf.style.display = tab==='about'?'none':'block';
  const pa=document.getElementById('panel-about'); if(pa) pa.style.display = tab==='about'?'block':'none';
  if(tab!=='about') renderFeed();
}

function renderFeed(){
  const area=document.getElementById('feedArea'); if(!area) return;
  if(window.DroboardExpiry){ DroboardExpiry.sweep(POSTS, { isMine: p => p.mine || p.name === 'You' }); }
  const list=currentList();
  if(!list.length){
    area.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i><h4>Nothing here yet</h4><p>No posts in this category right now — check back soon.</p></div>';
    return;
  }
  if(typeof DroboardPostCard==='undefined'){ area.innerHTML='<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Feed unavailable</h4><p>Component not loaded.</p></div>'; return; }
  DroboardPostCard.setPosts(list.map(mapPost));
  paintFeedAds(list);
}

/* ── Feed ad slots: every N posts via the shared ad component ──
   Placement 'droboardPage' (enabled + interval) is marketing-controlled;
   ads target the page via their pages list. Cached per session. */
let drbAdCfg = null, drbAdLoading = false;
function trackAdSlot(id, ev){ try{ if(id && window.AdService) AdService.track(id, ev, { page: 'droboardPage', slot: 'droboardPage:feed' }); }catch(e){} }
async function loadDroboardAdCfg(){
  if(!window.AdService || !window.DroboardAdCard) return null;
  try{
    const placement = await AdService.getPlacement('droboardPage');
    if(placement && placement.enabled === false) return null;
    const pools = await AdService.getAds({ page: 'droboardPage' });
    const iv = placement && parseInt(placement.interval, 10);
    return { pools: pools || {}, interval: (iv > 0 ? iv : 4) };
  }catch(e){ return null; }
}
function pickDroboardAd(pools, turn){
  pools = pools || {};
  const em = (pools.embed || []).filter(function(a){ return a && a.code; });
  const nat = pools.native || [], plat = pools.platform || [], bk = pools.book || [];
  const order = [];
  if(em.length) order.push({ format: 'embed', ad: em[turn % em.length] });
  if(nat.length) order.push({ format: 'native', ad: nat[turn % nat.length] });
  if(plat.length) order.push({ format: 'platform', ad: plat[turn % plat.length] });
  if(bk.length) order.push({ format: 'storyPromo', ad: bk[turn % bk.length] });
  if(!order.length) return null;
  return order[turn % order.length];
}
function paintFeedAds(list){
  if(drbAdCfg){ paintFeedAdsWith(drbAdCfg, list); return; }
  if(drbAdLoading || !window.AdService) return;
  drbAdLoading = true;
  loadDroboardAdCfg().then(function(cfg){
    drbAdLoading = false;
    drbAdCfg = cfg || false;
    if(!cfg) return;
    if(!document.getElementById('feedArea')) return;
    paintFeedAdsWith(cfg, currentList());
  }).catch(function(){ drbAdLoading = false; });
}
function paintFeedAdsWith(cfg, list){
  const out = []; let turn = 0;
  list.forEach(function(p, i){
    out.push(p);
    if((i + 1) % cfg.interval === 0){
      const pick = pickDroboardAd(cfg.pools, turn);
      if(pick){ turn++; out.push({ id: 'drbsp_' + (pick.ad.id || turn) + '_' + i, type: 'sponsored', adFormat: pick.format, ad: pick.ad }); }
    }
  });
  if(!turn) return;
  DroboardPostCard.setPosts(out.map(mapPost));
  out.forEach(function(p){ if(p.type === 'sponsored' && p.ad) trackAdSlot(p.ad.id, 'impression'); });
  if(!window.__drbAdBound){
    window.__drbAdBound = true;
    try{
      DroboardAdCard.attach(document.getElementById('feedArea'), {
        getAds:function(){ return []; },
        onOpen:function(ad){ if(ad) trackAdSlot(ad.id, 'click'); },
        onCta:function(ad){ if(ad) trackAdSlot(ad.id, 'click'); toast('🔗 ' + ((ad && ad.cta) || 'Opening…')); },
        onLike:function(){},
        onComment:function(){},
        onShare:function(ad){ if(window.openShareModal && ad){ openShareModal({ title:ad.title||ad.heading||ad.brand, sub:ad.brand||'Sponsored', img:ad.cover||ad.image||'', url:'https://droboard.app/ad/'+(ad.id||'') }); } },
      });
    }catch(e){}
  }
}
function renderSponsoredPost(post){
  if(!post || !post.ad || !window.DroboardAdCard) return '';
  const fmt = post.adFormat || '';
  let inner = '';
  try{
    if(fmt === 'embed' && DroboardAdCard.renderEmbed) inner = DroboardAdCard.renderEmbed(post.ad);
    else if(fmt === 'native') inner = DroboardAdCard.renderNative(post.ad);
    else if(fmt === 'platform') inner = DroboardAdCard.renderPlatform(post.ad);
    else if(fmt === 'storyPromo') inner = DroboardAdCard.renderStoryPromo(post.ad);
    else if(fmt === 'listBook' || fmt === 'book') inner = DroboardAdCard.renderListBook(post.ad);
    else if(fmt === 'listPlatform') inner = DroboardAdCard.renderListPlatform(post.ad);
    else inner = DroboardAdCard.renderNative(post.ad);
  }catch(e){ return ''; }
  if(!inner) return '';
  // same card padding + 8px divider as regular posts
  return '<div style="padding:14px 16px;background:var(--l1);border-bottom:8px solid var(--bg)">'+inner+'</div>';
}

let loadingMore=false;
function hasMorePosts(){ return POSTS.length < feedTotal; }
function paintLoadMoreBtn(){
  const b=document.getElementById('loadMoreBtn'); if(!b) return;
  b.style.display = hasMorePosts() ? '' : 'none';
  if(!hasMorePosts()) b.innerHTML='<i class="fas fa-check"></i> All posts loaded';
}
async function loadMore(){
  const b=document.getElementById('loadMoreBtn'); if(!b || loadingMore) return;
  if(!hasMorePosts()){ toast('All posts loaded'); return; }
  loadingMore=true;
  const old=b.innerHTML;
  b.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Loading…';
  try{
    const page = Math.floor(POSTS.length / PAGE_SIZE) + 1;
    const j = await fetchPosts(page);
    const fresh=(j.posts||[]).filter(function(p){ return !findPostAnywhere(p.id); });
    POSTS=POSTS.concat(fresh);
    feedTotal=j.total||feedTotal;
    renderFeed();
    toast(fresh.length ? 'More posts loaded' : 'All posts loaded');
  }catch(e){
    toast('Could not load more posts — try again');
  }
  paintLoadMoreBtn();
  loadingMore=false;
}

function toast(msg, dur){ dur=dur||2500; const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},dur); }

function openSupport(){ if(global.DroboardTip) DroboardTip.open('droboard-page', { name:'Droboard', handle:'@droboard · Official page', avatar:DROBOARD_LOGO }); }

/* Support Droboard is platform revenue, not a writer tip: the wallet posts it
   with the 'platform' sentinel and debits paid coins only. The picker posts
   to /api/wallet/tip itself, so all this page has to say is WHERE the money
   goes — the sheet never posts on the host's behalf any more. */
function attachSupportTips(){
  if(!global.DroboardTip || typeof DroboardTip.attach!=='function') return;
  DroboardTip.attach({
    getTargetId:function(){ return 'platform'; },
  });
}
function sharePage(){ if(global.openShareModal) window.openShareModal({ title:'Droboard — Official Page', sub:'@droboard · Announcements, debates & story picks', img:DROBOARD_LOGO, url:'https://droboard.app/droboard' }); }

/* ── Live post actions ── */
async function toggleLikeAPI(post){
  const prevLiked=!!post.liked, prevLikes=post.likes||0;
  post.liked=!prevLiked; post.likes=Math.max(0,prevLikes+(post.liked?1:-1));
  updateCard(post);
  try{
    const j=await api('/posts/'+encodeURIComponent(post.id)+'/like', { method:'POST' });
    post.liked=!!j.liked; post.likes=j.likesCount||0;
  }catch(e){
    post.liked=prevLiked; post.likes=prevLikes;
    toast(e.status===401?'Sign in to react':('Could not save like — '+e.message));
  }
  updateCard(post);
}
async function toggleSaveAPI(post){
  const prev=!!post.saved;
  post.saved=!prev; updateCard(post);
  try{
    const j=await api('/posts/'+encodeURIComponent(post.id)+'/save', { method:'POST' });
    post.saved=!!j.saved;
  }catch(e){
    post.saved=prev;
    toast(e.status===401?'Sign in to save':('Could not save — '+e.message));
  }
  updateCard(post);
}
async function pollVoteAPI(post, oi){
  if(post.poll.voted>=0) return toast('You already voted');
  const prevV=post.poll.opts[oi].v||0, prevTotal=post.poll.total||0, prevVoted=post.poll.voted;
  post.poll.opts[oi].v=prevV+1; post.poll.voted=oi; post.poll.total=prevTotal+1;
  updateCard(post);
  try{
    const card=await api('/posts/'+encodeURIComponent(post.id)+'/poll/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ option: oi }) });
    replaceInPOSTS(card); updateCard(findPostAnywhere(card.id)||card);
    toast('✅ Vote cast!');
  }catch(e){
    post.poll.opts[oi].v=prevV; post.poll.voted=prevVoted; post.poll.total=prevTotal;
    updateCard(post);
    toast(e.status===401?'Sign in to vote':(e.message==='already_voted'?'You already voted':'Vote failed — '+e.message));
  }
}
async function debateVoteAPI(post, side){
  if(post.debateData.userVote) return toast('You already voted');
  const prevFor=post.debateData.forV||0, prevAg=post.debateData.agV||0, prevVote=post.debateData.userVote;
  if(side==='for') post.debateData.forV=prevFor+1; else post.debateData.agV=prevAg+1;
  post.debateData.userVote=side;
  updateCard(post);
  try{
    const card=await api('/posts/'+encodeURIComponent(post.id)+'/debate/vote', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ side: side }) });
    replaceInPOSTS(card); updateCard(findPostAnywhere(card.id)||card);
    toast(side==='for'?'✅ Voted FOR!':'❌ Voted AGAINST!');
  }catch(e){
    post.debateData.forV=prevFor; post.debateData.agV=prevAg; post.debateData.userVote=prevVote;
    updateCard(post);
    toast(e.status===401?'Sign in to vote':(e.message==='already_voted'?'You already voted':'Vote failed — '+e.message));
  }
}
async function reportPostAPI(post){
  try{
    await api('/reports', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ target:'post', targetId:String(post.id), reason:'other' }) });
    toast('🚩 Report submitted — our team will review it');
  }catch(e){
    toast(e.status===401?'Sign in to report':('Could not submit report — '+e.message));
  }
}

function attachPostCard(){
  const area=document.getElementById('feedArea'); if(!area || typeof DroboardPostCard==='undefined') return;
  // ── attachCounters hooks — picker owns all toggle math; host supplies
  //    the server's reaction buckets and persists via POST/DELETE /react. ──
  function counterHooks(){
    return {
      getCounts: function(id){
        const post = findPostAnywhere(id);
        if (!post) return null; // unknown id → picker stays inert
        const r = post.reactions || {};
        return {
          userRx: post.userRx || null,
          love: r.love || 0, crying: r.crying || 0, shocked: r.shocked || 0, emotional: r.emotional || 0,
        };
      },
      save: function(id, state){
        const post = findPostAnywhere(id);
        if (!post) return;
        const prevRx = post.userRx || null;
        const prevReactions = post.reactions || {};
        const rid = state.userRx || null;
        post.userRx = rid;
        const next = {}; Object.keys(prevReactions).forEach(function(k){ next[k]=prevReactions[k]||0; });
        if(prevRx) next[prevRx]=Math.max(0,(next[prevRx]||0)-1);
        if(rid) next[rid]=(next[rid]||0)+1;
        post.reactions = next;
        post.liked = rid === 'love';
        updateCard(post);
        const req = rid
          ? api('/posts/'+encodeURIComponent(post.id)+'/react', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ rid: rid }) })
          : api('/posts/'+encodeURIComponent(post.id)+'/react', { method:'DELETE' });
        req.then(function(j){
          post.reactions = j.counts || next; post.userRx = j.userRx || null; post.liked = post.userRx === 'love';
          updateCard(post);
        }).catch(function(e){
          post.userRx = prevRx; post.reactions = prevReactions; post.liked = prevRx === 'love';
          updateCard(post);
          toast(e.status===401?'Sign in to react':('Could not save reaction — '+e.message));
        });
      },
    };
  }
  // ── Inline comments (comment-section component, mounted per-card) ──
  function bumpComments(post){
    post.comments=(post.comments||0)+1;
    try{
      const card=area.querySelector('[data-pcc-id="'+(CSS.escape?CSS.escape(post.id):post.id)+'"]');
      const s=card && card.querySelector('[data-pcc-comment] span');
      if(s) s.textContent=fmtN(post.comments);
    }catch(e){}
  }
  function shapeComments(items){
    const shape=(global.DroboardComments && DroboardComments.api && DroboardComments.api.shapeComment) || function(c){return c;};
    return (items||[]).map(shape);
  }
  function fetchPostComments(postId){
    return api('/comments?scope=post&postId='+encodeURIComponent(postId)+'&limit=50').then(function(j){
      return shapeComments(Array.isArray(j)?j:(j.items||[]));
    });
  }
  // Persist an optimistically-inserted comment to POST /api/comments and
  // swap in the server ids/counts; on failure pull the bubble back out.
  function attachCommentSurface(box, post, list){
    function deepRemove(lst, c){
      return (lst||[]).filter(function(x){
        if(x===c) return false;
        if(x.replies && x.replies.length) x.replies=deepRemove(x.replies, c);
        return true;
      });
    }
    function persist(c, parentId){
      const body={ scope:'post', postId:String(post.id), text:c.text };
      if(parentId) body.parentId=parentId;
      if(c.team) body.team=c.team;
      api('/comments', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
        .then(function(card){
          const shaped=shapeComments([card])[0];
          if(c){ c.id=shaped.id; c.time=shaped.time||c.time; c.likes=shaped.likes||0; c.liked=false; c.mine=!!shaped.mine; if(shaped.reactions) c.reactions=shaped.reactions; }
          try{ inst.setComments(inst.getComments()); }catch(e){}
        })
        .catch(function(e){
          toast(e.status===401?'Sign in to comment':('Could not post comment — '+e.message));
          try{ inst.setComments(deepRemove(inst.getComments(), c)); }catch(e2){}
        });
    }
    const inst=DroboardComments.attach(box, { postId:String(post.id), title:'Comments', comments:list||[], currentUser:{name:'You', avatar:null}, collapsible:false, threadSheet:true, fullCommentsUrl:function(){ return 'discussion.html?id='+encodeURIComponent(post.id); }, placeholder:'Add a comment…', getCommentUrl:function(c){return 'https://droboard.app/droboard/post/'+post.id+'#comment-'+c.id}, onPost:function(c){ bumpComments(post); persist(c,null); }, onReply:function(parentId,c){ bumpComments(post); persist(c,parentId); } });
    return inst;
  }
  async function mountInline(post){
    let card=null;
    try{ card=area.querySelector('[data-pcc-id="'+(CSS.escape?CSS.escape(post.id):post.id)+'"]'); }catch(e){}
    if(!card) return;
    let box=card.querySelector('.drb-inline-comments');
    if(!box){ box=document.createElement('div'); box.className='drb-inline-comments'; const acts=card.querySelector('.pcc-actions'); if(acts) acts.after(box); else card.appendChild(box); }
    box.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--tx-muted)"><i class="fas fa-circle-notch fa-spin"></i> Loading comments…</div>';
    let list;
    try{ list=await fetchPostComments(post.id); }
    catch(e){
      box.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--tx-muted)">'+esc('Could not load comments — '+(e.message||'try again'))+'</div>';
      return;
    }
    if(!inlineOpen[post.id]) return; // reader collapsed it while loading
    if(inlineCS[post.id] && inlineCS[post.id].destroy){ try{ inlineCS[post.id].destroy(); }catch(e){} }
    inlineCS[post.id]=attachCommentSurface(box, post, list);
  }
  function toggleInline(post){
    if(inlineOpen[post.id]){
      inlineOpen[post.id]=false;
      let card=null;
      try{ card=area.querySelector('[data-pcc-id="'+(CSS.escape?CSS.escape(post.id):post.id)+'"]'); }catch(e){}
      const box=card && card.querySelector('.drb-inline-comments');
      if(box) box.remove();
      if(inlineCS[post.id] && inlineCS[post.id].destroy){ try{ inlineCS[post.id].destroy(); }catch(e){} }
      delete inlineCS[post.id];
      return;
    }
    inlineOpen[post.id]=true;
    mountInline(post);
  }
  function goDiscussion(id){ if(id) location.href='discussion.html?id='+encodeURIComponent(id); }
  mountInlineRef = mountInline;
  // register custom types once.
  // Text uses .pcc-text (shared uniform clamp + measured "See more" from
  // post-card's truncation pass) and images use .pcc-image (160px cap) —
  // never emit bare classes: an unstyled <img> here used to render at
  // natural height and blow up the whole card.
  try{
    DroboardPostCard.registerType('announcement', function(post){
      return '<div class="dpc-body"><div class="drb-badge drb-badge-ann"><i class="fas fa-bullhorn"></i> Announcement</div>'+(post.title?'<div class="dpc-title">'+esc(post.title)+'</div>':'')+(post.text?'<div class="pcc-text">'+esc(post.text)+'</div>':'')+(post.image?'<img class="pcc-image" src="'+esc(post.image)+'" alt="" loading="lazy" data-image-open="1"/>':'')+'</div>';
    });
    // Shoutout facts come only from the post's server payload (set when the
    // manager composed it) — there is no client-side writer directory.
    DroboardPostCard.registerType('shoutout', function(post){
      const s=post.shoutout||{};
      const role=s.role||'Writer';
      let statBits='';
      const st=s.stats||{};
      if(role==='Reader'){
        statBits='<span><b style="color:var(--tx-high)">'+esc(String(s.readingHours||0))+'</b>h read</span><span><b style="color:var(--tx-high)">'+esc(String(s.chaptersRead||0))+'</b> chapters</span><span><b style="color:var(--tx-high)">'+esc(String(s.streak||0))+'</b> day streak</span>';
      } else {
        const reads=st.reads!=null? (st.reads>=1000? (st.reads/1000|0)+'k' : st.reads) : '';
        const followers=st.followers!=null? st.followers : '';
        const books=st.books!=null? (Array.isArray(st.books)?st.books.length:st.books) : '';
        if(reads!=='' || followers!=='' || books!=='') statBits='<span><b style="color:var(--tx-high)">'+esc(String(reads))+'</b> reads</span><span><b style="color:var(--tx-high)">'+esc(String(followers))+'</b> followers</span><span><b style="color:var(--tx-high)">'+esc(String(books))+'</b> books</span>';
      }
      return '<div class="dpc-body"><div class="drb-badge drb-badge-shout"><i class="fas fa-star"></i> Shoutout</div>'+(post.text?'<div class="pcc-text">'+esc(post.text)+'</div>':'')+'<div class="drb-shout-card" data-shout-open="'+post.id+'"><img class="drb-shout-av" src="'+esc(s.avatar||'')+'" loading="lazy"/><div class="drb-shout-info"><div class="drb-shout-name">@'+esc(s.name||'')+'</div><div class="drb-shout-tag">'+esc(s.tagline||'')+'</div>'+(statBits?'<div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:var(--tx-muted)">'+statBits+'</div>':'')+'</div><button class="drb-shout-follow'+(s.following?' ing':'')+'" data-shout-follow="'+esc(s.id||s._writerId||'')+'">'+(s.following?'✓ Following':'+ Follow')+'</button></div></div>';
    });
  }catch(e){}

  DroboardPostCard.attach(area, {
    getReactionHTML:function(post){ return RP ? RP.renderTrigger(post.id, {}) : undefined; },
    renderSponsored:function(post){ return renderSponsoredPost(post); },
    onLike:function(post){ const orig=findPostAnywhere(post.id); if(orig) toggleLikeAPI(orig); },
    onComment:function(post){ openComments(post); },
    onOpenPost:function(post){ goDiscussion(post.id); },
    onSave:function(post){
      const orig=findPostAnywhere(post.id); if(!orig) return;
      if(window.openSaveModal){ window.openSaveModal({ title:orig.title||(orig.text?orig.text.substring(0,60):'Droboard post'), sub:'@droboard · Official Page', img:orig.image||(orig.storyRef&&orig.storyRef.cover)||DROBOARD_LOGO, storyId:orig.id, type:'post' }); }
      else { toggleSaveAPI(orig); }
    },
    onShare:function(post){ window.openShareModal({ title:post.title||post.quote||(post.text?post.text.substring(0,60):'Droboard'), sub:'@droboard · Official Page', img:post.image||(post.storyRef&&post.storyRef.cover)||DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); },
    onDotsAction:function(action, post){
      if(action==='report') return reportPostAPI(post);
      if(action==='less') return toast("👁️ You'll see less of this.");
      if(action==='follow') return toast('✅ You already follow @droboard!');
      if(action==='share'){ window.openShareModal({ title:post.title||'Droboard', sub:'@droboard', img:DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); return; }
      if(action==='save'){ window.openSaveModal({ title:post.title||post.quote||'Droboard post', sub:'@droboard', img:post.image||DROBOARD_LOGO, storyId:post.id, type:'post' }); return; }
    },
    onPollVote:function(post, oi){ const orig=findPostAnywhere(post.id); if(orig&&orig.poll) pollVoteAPI(orig, oi); },
    onDebateVote:function(post, side){ const orig=findPostAnywhere(post.id); if(orig&&orig.debateData) debateVoteAPI(orig, side); },
    onOpenDebate:function(post){ location.href='debate.html?id='+encodeURIComponent(post.id); },
    onAvatarClick:function(){ window.scrollTo({top:0,behavior:'smooth'}); },
    onDots:function(post, anchor){ if(window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchor); }
  });

  if(RP){ RP.attachCounters(area, counterHooks()); }

  // Text tap / debate footer → discussion page for that post.
  // NOTE: "See more" is deliberately NOT intercepted here — post-card.js
  // expands the clamped block inline (same behavior as feed + profile).
  area.addEventListener('click', function(e){
    const df=e.target.closest('.pcc-debate-footer');
    if(df){ const card=e.target.closest('.pcc-post'); if(card&&card.dataset.pccId) goDiscussion(card.dataset.pccId); return; }
    const ot=e.target.closest('[data-pcc-openpost]');
    if(ot){ const card=e.target.closest('.pcc-post'); if(card&&card.dataset.pccId) goDiscussion(card.dataset.pccId); return; }
  });

  area.addEventListener('click', async function(e){
    const fb=e.target.closest('[data-shout-follow]');
    if(fb){
      const wid=fb.dataset.shoutFollow;
      const isFollowing = FOLLOW_STATE[wid];
      const method = isFollowing ? 'DELETE' : 'POST';
      try {
        const r = await fetch(API_BASE + '/users/' + encodeURIComponent(wid) + '/follow', {
          method: method,
          credentials: 'include'
        });
        if (r.ok) {
          FOLLOW_STATE[wid] = !isFollowing;
          toast(FOLLOW_STATE[wid] ? '✅ Following!' : 'Unfollowed');
          renderFeed();
        } else { toast(r.status===401?'Sign in to follow':'Failed to update follow'); }
      } catch(err) { toast('Failed to update follow'); }
      return;
    }
    if(e.target.closest('[data-shout-open]')){ toast('👤 Opening profile…'); return; }
    if(e.target.closest('[data-story-chip]')){ toast('📖 Opening story…'); return; }
    if(e.target.closest('[data-ama-open]')){ toast('🎙 Joining Droboard Live…'); return; }
    if(e.target.closest('[data-image-open]')){ toast('🖼 Viewing…'); return; }
  });
}

let cs=null;
async function openComments(post){
  const overlay=document.getElementById('commentOverlay');
  const mount=document.getElementById('commentMount'); if(!overlay||!mount) return;
  if(cs && cs.destroy){ try{cs.destroy();}catch(e){} cs=null; }
  mount.innerHTML='<div class="empty-state" style="padding:28px"><i class="fas fa-circle-notch fa-spin"></i><p>Loading comments…</p></div>';
  overlay.classList.add('open'); document.body.style.overflow='hidden';
  let list;
  try{ list=await fetchPostCommentsFor(post.id); }
  catch(e){
    mount.innerHTML='<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Could not load comments</h4><p>'+esc(e.message||'Try again later.')+'</p></div>';
    return;
  }
  mount.innerHTML='';
  cs=attachCommentSurface(mount, post, list);
}
function fetchPostCommentsFor(postId){
  return api('/comments?scope=post&postId='+encodeURIComponent(postId)+'&limit=50').then(function(j){
    return shapeComments(Array.isArray(j)?j:(j.items||[]));
  });
}
function closeComments(){ const o=document.getElementById('commentOverlay'); if(o) o.classList.remove('open'); document.body.style.overflow=''; }

/* Spotlight ("People to follow") — the writers shouted out on this page,
   with follow state from their live profiles and rings from live statuses. */
async function initSpotlight(){
  if(typeof DroboardPeopleToFollow==='undefined') return;
  const seen={}; const authors=[];
  POSTS.forEach(function(p){
    if(p.type==='shoutout' && p.shoutout && p.shoutout.id && !seen[p.shoutout.id]){
      seen[p.shoutout.id]=1;
      authors.push({ id:String(p.shoutout.id), handle:String(p.shoutout.handle||p.shoutout.id||'').replace(/^@/,''), name:p.shoutout.name||'Writer', av:p.shoutout.avatar||'', verified:!!p.shoutout.verified });
    }
  });
  if(!authors.length) return;
  const people = await Promise.all(authors.slice(0,8).map(async function(a){
    let isFollowing=false;
    try{
      const data=await api('/users/'+encodeURIComponent(a.id));
      const u=data.profile||data.user||data.data||data;
      if(u && u.isFollowing!=null) isFollowing=!!u.isFollowing;
    }catch(e){}
    FOLLOW_STATE[a.id]=isFollowing;
    return { id:a.id, name:a.name, av:a.av, ring:'none', isLive:false, statuses:null, verified:a.verified, rank:null, following:isFollowing, profileUrl:'profile.html?handle='+encodeURIComponent(a.handle) };
  }));
  // Status rings come from the live status store (by handle) — never seeded.
  const handles=people.map(function(p){ const a=authors.find(function(a2){return a2.id===p.id}); return a&&a.handle; }).filter(Boolean);
  if(handles.length){
    try{
      const rows=await api('/statuses/writers?handles='+encodeURIComponent(handles.join(',')));
      (Array.isArray(rows)?rows:[]).forEach(function(row){
        const st=row.statuses||[];
        if(!st.length) return;
        const p=people.find(function(x){ const a=authors.find(function(a2){return a2.id===x.id}); return a && String(a.handle).toLowerCase()===String(row.handle||'').toLowerCase(); });
        if(p){ p.statuses=st; p.ring=st.every(function(s){return s.viewed;})?'viewed':'has'; p.isLive=st.some(function(s){return s.isLive;}); p.rank=p.isLive?'🔴 Live now':null; }
      });
    }catch(e){ /* rings stay off — never seeded */ }
  }
  DroboardPeopleToFollow.render('#ptfMount', {
    people:people, title:'', maxVisible:8,
    onFollow: async function(o){
      const method = o.following ? 'DELETE' : 'POST';
      try {
        const r = await fetch(API_BASE + '/users/' + encodeURIComponent(o.id) + '/follow', {
          method: method,
          credentials: 'include'
        });
        if (r.ok) {
          FOLLOW_STATE[o.id] = !o.following;
          toast(!o.following ? '✅ Following @' + o.name : 'Unfollowed @' + o.name);
        } else { toast(r.status===401?'Sign in to follow':'Failed to update follow'); }
      } catch(err) { toast('Failed to update follow'); }
    }
  });
}
function initCollections(){
  if(typeof DroboardCollectionCard==='undefined') return;
  const mount=document.getElementById('collectionsGrid'); if(!mount) return;
  DroboardCollectionCard.attach(mount, {
    onOpen:function(c){ toast('📂 Opening "'+c.name+'"…'); },
    onShare:function(c){ window.openShareModal({ title:c.name, sub:(c.count||0)+' stories · Curated by @droboard', img:(c.covers&&c.covers[0])||DROBOARD_LOGO, url:'https://droboard.app/collection/'+c.id }); }
  });
  fetchCollections().then(function(cols){ DroboardCollectionCard.setCollections(cols); }).catch(function(){ toast('Could not load collections'); });
}

  /* ── Page info (bio / links / guidelines) ──
     No backend route exists for page-info saves, so this panel renders the
     page's static copy and the edit entry point stays hidden. */
  const DEFAULT_RULES=['Be kind — debate the story, not the person.','Tag spoilers so everyone gets to feel the twist.','No harassment of writers or fellow readers.','Shoutouts and story picks are curated by the team, not paid placements.'];
  const SOCIAL_ICONS={ instagram:'fab fa-instagram', x:'fab fa-x-twitter', facebook:'fab fa-facebook', tiktok:'fab fa-tiktok', youtube:'fab fa-youtube', linkedin:'fab fa-linkedin', threads:'fab fa-threads', snapchat:'fab fa-snapchat', whatsapp:'fab fa-whatsapp', telegram:'fab fa-telegram', website:'fas fa-globe' };
  function getAbout(){
    // Static page copy — there is no droboard-page hero API to read from.
    return {
      bio: null, // null keeps the markup's static bio
      blurb: null,
      email: 'hello@droboard.app',
      support: 'support.droboard.app',
      links: [ { network:'instagram', handle:'@droboard.app' }, { network:'x', handle:'@droboard' } ],
      rules: DEFAULT_RULES.slice()
    };
  }
  function setText(id, v){ const el=document.getElementById(id); if(el && v!==undefined && v!==null) el.textContent=v; }
  function renderAbout(){
    const a=getAbout();
    setText('pageBio', a.bio);
    if(a.blurb) setText('aboutBlurb', a.blurb);
    setText('aboutContact', a.email+' · '+a.support);
    const linksBox=document.getElementById('aboutLinks');
    if(linksBox) linksBox.innerHTML=a.links.map(function(l){
      const icon=SOCIAL_ICONS[l.network]||'fas fa-globe';
      return '<span style="color:var(--blue);font-size:12px;white-space:nowrap"><i class="'+icon+'"></i> '+esc(l.handle)+'</span>';
    }).join('') || '<span style="font-size:11px;color:var(--tx-faint)">No links yet</span>';
    const ul=document.getElementById('aboutRules'); if(ul) ul.innerHTML=a.rules.map(function(r){return '<li>'+esc(r)+'</li>'}).join('');
    const eb=document.getElementById('aboutEditBtn'); if(eb) eb.style.display='none'; // page-info saving has no backend route yet
  }
  function getPageSettings(){ return Object.assign({showSupport:true}, _pageSettings||{}); }
  function savePageSettings(patch){ _pageSettings=Object.assign({},getPageSettings(),patch||{}); return _pageSettings; }
  function renderMainSupport(){
    const mount=document.getElementById('composerMount'); if(!mount) return;
    let strip=document.getElementById('mainSupportStrip');
    if(!getPageSettings().showSupport){ if(strip) strip.remove(); return; }
    if(!strip){
      strip=document.createElement('div');
      strip.id='mainSupportStrip';
      strip.style.marginTop='12px';
      mount.after(strip);
    }
    strip.innerHTML='<div class="support-strip" onclick="DroboardOfficial.openSupport()">'
      +'<div class="support-ico">💛</div>'
      +'<div class="support-body"><div class="support-title">Support Droboard</div><div class="support-sub">Help keep the platform ad-light and independent</div></div>'
      +'<button class="support-btn" onclick="event.stopPropagation();DroboardOfficial.openSupport()">Support</button></div>';
  }
  function closePageMenu(){ const o=document.getElementById('pageMenuOv'); if(o) o.remove(); }
  async function openPageMenu(){
    closePageMenu();
    const isManager=await canCurrentManage('post');
    const showSupport=getPageSettings().showSupport;
    const ov=document.createElement('div');
    ov.id='pageMenuOv';
    ov.style.cssText='position:fixed;inset:0;z-index:1800;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML='<div style="width:100%;max-width:420px;margin:0 auto;background:var(--l1,#fff);border-radius:20px 20px 0 0;padding:12px 16px calc(20px + env(safe-area-inset-bottom,0px));max-height:70vh;overflow-y:auto;box-shadow:0 -12px 40px rgba(0,0,0,.25)">'
      +'<div style="width:40px;height:4px;border-radius:4px;background:rgba(128,128,128,.35);margin:2px auto 12px"></div>'
      +'<div style="font-size:14px;font-weight:800;color:var(--tx-high,#161616);margin-bottom:12px">Page settings</div>'
      +'<button id="pmSupport" style="width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:14px;border:1px solid rgba(251,191,36,.4);background:rgba(251,191,36,.1);cursor:pointer;margin-bottom:10px"><span style="font-size:20px">💛</span><span style="flex:1;text-align:left"><b style="display:block;font-size:13.5px;color:var(--tx-high,#161616)">Support Droboard</b><span style="font-size:11.5px;color:var(--tx-muted,#666)">Tips help keep the platform independent</span></span><i class="fas fa-chevron-right" style="font-size:11px;color:var(--tx-faint,#999)"></i></button>'
      +(isManager
        ? '<button id="pmSupportToggle" style="width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:14px;border:1px solid rgba(128,128,128,.22);background:rgba(128,128,128,.07);cursor:pointer;margin-bottom:10px"><i class="fas fa-heart" style="color:var(--acc,#ff0050);font-size:15px"></i><span style="flex:1;text-align:left"><b style="display:block;font-size:13.5px;color:var(--tx-high,#161616)">Support strip on main feed</b><span style="font-size:11.5px;color:var(--tx-muted,#666)">'+(showSupport?'Showing below the composer':'Hidden from the main feed')+'</span></span><span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;color:'+(showSupport?'#16a34a':'var(--tx-faint,#999)')+';background:'+(showSupport?'rgba(22,163,74,.12)':'rgba(128,128,128,.12)')+'">'+(showSupport?'ON':'OFF')+'</span></button>'
        : '')
      +'<button id="pmCancel" style="width:100%;padding:13px;border-radius:14px;border:1px solid rgba(128,128,128,.22);background:transparent;color:var(--tx-muted,#666);font-size:13px;font-weight:700;cursor:pointer">Cancel</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) closePageMenu(); });
    document.getElementById('pmCancel').addEventListener('click', closePageMenu);
    document.getElementById('pmSupport').addEventListener('click', function(){ closePageMenu(); openSupport(); });
    const tg=document.getElementById('pmSupportToggle');
    if(tg) tg.addEventListener('click', function(){
      const next=savePageSettings({ showSupport:!getPageSettings().showSupport });
      renderMainSupport(); closePageMenu(); openPageMenu();
      toast(next.showSupport?'✅ Support strip showing':'Support strip hidden');
    });
  }

async function canCurrentManage(need){
  return canManage(null, need);
}

// Post moderation — real API; the caller surfaces errors.
async function updatePostAPI(id, patch){
  return api('/posts/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}
async function deletePostAPI(id){
  return api('/posts/' + encodeURIComponent(id), { method: 'DELETE' });
}

function dropPostEverywhere(id){
  POSTS=POSTS.filter(function(p){ return String(p.id)!==String(id); });
}

  /* ── Dots menu (Edit / Delete / Pin / Unpin) ── */
  function setComposerVal(id, v){ const el=document.getElementById(id); if(el && v) { el.value=v; el.dispatchEvent(new Event('input', {bubbles:true})); } }
  function onEditPost(post){
    const orig=findPostAnywhere(post.id); if(!orig){ toast('Post no longer exists'); return; }
    if(!window.DroboardComposer || !DroboardComposer.open){ toast('Composer unavailable'); return; }
    editingId=orig.id;
    DroboardComposer.open();
    const ov=document.querySelector('.drb-ov');
    const tab=ov && (ov.querySelector('[data-t="'+orig.type+'"]') || ov.querySelector('[data-t="post"]'));
    if(tab) tab.click();
    setComposerVal('drbTitleF', orig.title||'');
    setComposerVal('drbText', orig.text||orig.note||'');
    if(orig.debateData) setComposerVal('drbExtra', String(orig.debateData.motion||'').replace(/^"|"$/g,''));
    if(orig.poll) setComposerVal('drbPollQ', orig.poll.q||'');
    const btn=document.getElementById('drbPost'); if(btn) btn.textContent='Save';
    const cancel=document.getElementById('drbCancel');
    if(cancel) cancel.addEventListener('click', function(){ editingId=null; }, { once:true });
    toast('✏️ Editing — update and hit Save');
  }
  async function onDeletePost(post){
    const orig=findPostAnywhere(post.id); if(!orig){ toast('Post no longer exists'); return; }
    const snapshot=POSTS.slice();
    dropPostEverywhere(orig.id);
    renderFeed();
    try{
      await deletePostAPI(orig.id);
      toast('🗑️ Post deleted');
    }catch(e){
      POSTS=snapshot;
      renderFeed();
      toast(e.status===401||e.status===403?'You can delete your own posts only':('Delete failed — '+e.message));
    }
  }
  async function onPinPost(post, pinned){
    const orig=findPostAnywhere(post.id); if(!orig){ toast('Post no longer exists'); return; }
    if(pinned && !orig.pinned && pinnedCountExcept(orig.id) >= 3){ toast('📌 Pin limit reached (3 max) — unpin one first'); return; }
    const prev=!!orig.pinned;
    orig.pinned=!!pinned;
    renderFeed();
    try{
      const card=await updatePostAPI(orig.id, { pinned: !!pinned });
      replaceInPOSTS(card);
      renderFeed();
      toast(pinned ? '📌 Post pinned to top' : 'Unpinned');
    }catch(e){
      orig.pinned=prev;
      renderFeed();
      toast(e.status===401||e.status===403?'Only page managers can pin':('Pin failed — '+e.message));
    }
  }
  function configureDotsMenu(){
    if(!window.DroboardDotsMenu) return;
    DroboardDotsMenu.configure({
      onEdit:function(post){ onEditPost(post); },
      onDelete:function(post){ onDeletePost(post); },
      onPin:function(post){ onPinPost(post, true); },
      onUnpin:function(post){ onPinPost(post, false); },
      onCopyLink:function(post){ const url='https://droboard.app/droboard/post/'+post.id; if(navigator.clipboard) navigator.clipboard.writeText(url).then(function(){toast('🔗 Link copied')}).catch(function(){toast('🔗 '+url)}); else toast('🔗 '+url); },
    });
  }

function wirePageChrome(){
  // Global broken-image fallback — avoids empty grey boxes (moved from inline)
  if(!wirePageChrome._imgFallback){
    wirePageChrome._imgFallback=true;
    document.addEventListener('error', function(e){
      var t=e.target;
      if(t && t.tagName==='IMG'){
        if(t.dataset.fallbackApplied) return;
        t.dataset.fallbackApplied='1';
        var isAv = (t.closest && t.closest('.av-ring,.dpm-av,.drb-shout-av')) || (t.width && t.width<=60);
        t.src = isAv ? 'https://i.pravatar.cc/150?img=12' : 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=400&h=400&fit=crop';
      }
    }, true);
  }
  // Follow / notify top buttons (owned by service)
  var fb=document.getElementById('followBtn');
  if(fb && !fb._wired){ fb._wired=true; fb.addEventListener('click', function(){ global.DroboardOfficial.toggleFollow(); }); }
  var nb=document.getElementById('notifBtn');
  if(nb && !nb._wired){ nb._wired=true; nb.addEventListener('click', function(){ global.DroboardOfficial.toggleNotify(); }); }
  // Keep comment-section colors in sync with page theme (light -> body.theme-white, dark -> default)
  if(!wirePageChrome._themeSync){
    wirePageChrome._themeSync=true;
    var sync=function(){ document.body.classList.toggle('theme-white', document.documentElement.getAttribute('data-theme') !== 'dark'); };
    sync();
    try{ new MutationObserver(sync).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] }); }catch(e){}
  } else {
    document.body.classList.toggle('theme-white', document.documentElement.getAttribute('data-theme') !== 'dark');
  }
}

async function init(){
  // loading → empty → root states like profile.html:30
  const ls=document.getElementById('loadingState');
  const rs=document.getElementById('droboardRoot');
  const es=document.getElementById('emptyState');
  wirePageChrome();
  attachSupportTips();
  try{
    const fp=await fetchPosts(1);
    POSTS=fp.posts||[]; feedTotal=fp.total||POSTS.length;
    loadPageProfile().then(renderFollowUI);
    if(!POSTS.length){
      if(ls) ls.style.display='none'; if(es) es.style.display='block'; return;
    }
    if(ls) ls.style.display='none'; if(rs) rs.style.display='block';
    renderFollowUI();
    try{ const sb=document.getElementById('droboardStatsBtn'); if(sb) sb.style.display=(window.canModerate&&canModerate())?'flex':'none'; }catch(e){}
    initTabs();
    configureDotsMenu();
    renderAbout();
    attachPostCard();
    renderFeed();
    initSpotlight();
    initCollections();
    const wf=document.getElementById('statWritersFeatured'); if(wf) wf.textContent = (function(){ const ids=new Set(); POSTS.forEach(function(p){ if(p.type==='shoutout'&&p.shoutout&&p.shoutout.id) ids.add(p.shoutout.id); }); return ids.size; })();
    const sp=document.getElementById('statPosts'); if(sp) sp.textContent=fmtN(feedTotal);
    const lm=document.getElementById('loadMoreBtn'); if(lm) lm.addEventListener('click', loadMore);
    paintLoadMoreBtn();
    // composer — manager-gated server-side; the composer posts via
    // DroboardPageData.createPost and hands the created card back here.
    try{ if(global.DroboardComposer) DroboardComposer.mount('#composerMount', { onPosted:function(p){
      if(p && p._editedId){
        replaceInPOSTS(p);
        renderFeed(); toast('✅ Post updated!');
        return;
      }
      editingId=null; // fresh compose — never keep a stale edit target
      if(p && p.id){ POSTS.unshift(p); renderFeed(); toast('Posted to @droboard'); }
    } }); }catch(e){}
    renderMainSupport();
    const pmb=document.getElementById('pageMenuBtn'); if(pmb) pmb.addEventListener('click', openPageMenu);
    // expose for inline onclicks
    global.DroboardOfficial._closeComments=closeComments;
  }catch(e){
    if(ls) ls.innerHTML='<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Couldn\'t load</h4><p>'+esc(e.message||String(e))+'</p></div>';
  }
  // toast helper exposed
  global.toast = toast;
}

  // Save-modal confirmations land here (same contract as feed): flip the card state.
  window.onDroboardSaveChange = function (storyId, saved) {
    if (!storyId) return;
    const orig = findPostAnywhere(storyId);
    if (!orig) return;
    if (!!orig.saved === !!saved) return; // no-op: modal closed without changes
    orig.saved = !!saved;
    updateCard(orig);
    toast(saved ? '🔖 Saved!' : 'Removed from saved');
  };
global.DroboardOfficial = {
  init:init, switchTab:switchTab, loadMore:loadMore,
  toggleFollow: async function(){
    var method = following ? 'DELETE' : 'POST';
    try {
      var r = await fetch(API_BASE + '/users/droboard/follow', { method: method, credentials: 'include' });
      if (r.ok) {
        following = !following;
        if (!following) notifyOn = false;
        await loadPageProfile();
        renderFollowUI();
        toast(following ? 'Following @droboard!' : 'Unfollowed @droboard');
      } else { toast(r.status===401?'Sign in to follow':'Failed to update follow'); }
    } catch(e) { toast('Error updating follow'); }
  },
  toggleNotify: async function(){
    if (!following) return toast('Follow @droboard first to get notified');
    notifyOn = !notifyOn;
    renderFollowUI();
    toast(notifyOn ? 'Notifications on' : 'Notifications off');
  },
  openSupport:openSupport, openPageMenu:openPageMenu, sharePage:sharePage,
  closeComments:closeComments, canManage:canManage, canCurrentManage:canCurrentManage
};

})(window);
