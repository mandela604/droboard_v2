/* ═══════════════════════════════════════════════════════════════
   DROBOARD-PAGE SERVICE — call-and-render only
   Use: DroboardOfficial.init(). No fallback compute in HTML.
   When API exists: set USE_API=true — no HTML change.
   ═══════════════════════════════════════════════════════════════ */
(function(global){
'use strict';
const USE_API = false;
const API_BASE = '/api/droboard-page';

function _seed(){ return global.DroboardPageSeed || {}; }

const LS_MANAGERS='drb_managers';
function getManagers(){
  try{ const v=localStorage.getItem(LS_MANAGERS); if(v){ const j=JSON.parse(v); if(Array.isArray(j)) return j; }}catch(e){}
  return ((_seed().DROBOARD_MANAGERS||[]).slice());
}
function saveManagers(list){ try{ localStorage.setItem(LS_MANAGERS, JSON.stringify(list)); }catch(e){} }
function canManage(handle, need){ // need: 'post' | 'manage_roles'
  const role=(getManagers().find(function(m){return m.handle===handle})||{}).role;
  if(need==='post') return role==='admin'||role==='editor';
  if(need==='manage_roles') return role==='admin';
  return false;
}
async function addManager(handle, role){ const list=getManagers(); if(list.find(function(m){return m.handle===handle})) return list; list.push({handle:handle, role:role||'editor'}); saveManagers(list); return list; }
async function updateManagerRole(handle, role){ const list=getManagers(); const m=list.find(function(x){return x.handle===handle}); if(m) m.role=role; saveManagers(list); return list; }
async function removeManager(handle){ let list=getManagers(); list=list.filter(function(m){return m.handle!==handle}); saveManagers(list); return list; }

async function createPost(payload){
  // demo: validate + push to POSTS, persist via localStorage
  const allowed=(_seed().DROBOARD_ALLOWED_TYPES||['announcement','post','debate','shoutout','repost','forum-poll','ama']);
  if(!payload || !payload.type || allowed.indexOf(payload.type)===-1) throw new Error('Invalid post type');
  if(!payload.text && !payload.title && !payload.shoutout && !payload.storyRef && !payload.debateData && !payload.poll) throw new Error('Post needs content');
  const p={ id:'d'+Date.now(), time:'now', likes:0, comments:0, liked:false, ...payload };
  // insert at top — visible after re-render
  return p;
}

async function fetchPosts(){
  if(USE_API){
    const r=await fetch(API_BASE+'/posts',{credentials:'include'}); if(r.ok){ const j=await r.json(); return j.data||j; }
  }
  const s=_seed();
  // merge any locally created posts on top (LS)
  let extra=[]; try{ extra=JSON.parse(localStorage.getItem('drb_posts_extra')||'[]'); }catch(e){}
  let posts=(extra.length? extra.concat(s.DROBOARD_POSTS||[]) : (s.DROBOARD_POSTS||[]).slice());
  let more=(s.DROBOARD_MORE_POSTS||[]).slice();
  // overlay persisted manager actions (edits / deletes / pins) so they
  // survive reloads; seed data itself is never rewritten.
  let edits={}, deleted=[], pins={};
  try{ edits=JSON.parse(localStorage.getItem('drb_posts_edits')||'{}')||{}; }catch(e){}
  try{ deleted=JSON.parse(localStorage.getItem('drb_posts_deleted')||'[]')||[]; }catch(e){}
  try{ pins=JSON.parse(localStorage.getItem('drb_posts_pins')||'{}')||{}; }catch(e){}
  const applyMeta=function(p){
    if(!p) return null;
    if(deleted.indexOf(String(p.id))!==-1) return null;
    let o=p;
    if(edits[p.id]) o=Object.assign({}, o, edits[p.id]);
    if(pins[p.id]!==undefined) o=Object.assign({}, o, { pinned:!!pins[p.id] });
    return o;
  };
  posts=posts.map(applyMeta).filter(Boolean);
  more=more.map(applyMeta).filter(Boolean);
  return { posts: posts, morePosts: more };
}
async function fetchCollections(){
  if(USE_API){ const r=await fetch(API_BASE+'/collections',{credentials:'include'}); if(r.ok){ const j=await r.json(); return j.data||j; } }
  return (_seed().DROBOARD_COLLECTIONS||[]).slice();
}
function getHero(){ return Object.assign({}, _seed().DROBOARD_HERO||{}); }

global.DroboardPageData = { fetchPosts, fetchCollections, getHero, USE_API, API_BASE };

// ── Page controller ──
let POSTS=[], MORE_POSTS=[], allCache=[], currentTab='all', moreLoaded=false, writersFeatured=0;
let FOLLOW_STATE = JSON.parse(localStorage.getItem('drb_shout_follows')||'{}');
const BASE_FOLLOWERS=12400;
let following = localStorage.getItem('drb_following')==='1';
let notifyOn  = localStorage.getItem('drb_notify')==='1';
const inlineOpen = {}; // postId -> bool (inline comments expanded)
const inlineCS = {};   // postId -> DroboardComments instance
let mountInlineRef = null; // set by attachPostCard; used by renderFeed to restore open threads

function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function nl(s){return (s||'').replace(/\n/g,'<br>')}
function fmtN(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n||0)}
const DROBOARD_LOGO='../assets/droboard-icon.png';

function getWriterPool(){
  try{ if(global.DroboardPageSeed && global.DroboardPageSeed.DROBOARD_COMPOSER_USERS) return global.DroboardPageSeed.DROBOARD_COMPOSER_USERS.slice(); }catch(e){}
  return (typeof WRITER_STATUSES!=='undefined') ? WRITER_STATUSES.filter(function(w){return !w.isYou}) : [];
}
function writerById(id){
  const pool=getWriterPool();
  return pool.find(function(w){return w.id===id || w.handle===id})||null;
}
function mapPost(p){
  if(p.type==='shoutout' && p.shoutout && p.shoutout.id){
    const w=writerById(p.shoutout.id);
    // trust payload's own name/avatar/stats (from picker) first — pickers include w8 etc not in WRITER_STATUSES
    const name = p.shoutout.name || (w&&w.name) || 'Droboard Writer';
    const av   = p.shoutout.avatar || (w&&w.avatar) || DROBOARD_LOGO;
    const stats= p.shoutout.stats || (w&&w.stats) || null;
    return Object.assign({}, p, { avatar: DROBOARD_LOGO, name: p.name || 'Droboard', mine: true, pinnable: true, shoutout:Object.assign({}, p.shoutout, { name:name, avatar:av, stats:stats, following:!!FOLLOW_STATE[p.shoutout.id], _writer:w||{name:name,avatar:av,stats:stats}, _writerId:p.shoutout.id }) });
  }
  return Object.assign({ avatar: DROBOARD_LOGO, name: 'Droboard', mine: true, pinnable: true }, p);
}
function currentList(){
  const base=moreLoaded? allCache : POSTS;
  const list=(currentTab==='all') ? base.slice() : base.filter(function(p){return p.type===currentTab});
  const pinned=list.filter(function(p){return p.pinned});
  const rest=list.filter(function(p){return !p.pinned});
  return pinned.concat(rest); // pinned always on top, stable order otherwise
}
function pinnedCountExcept(id){
  const seen={}; let n=0;
  [allCache, MORE_POSTS].forEach(function(arr){
    (arr||[]).forEach(function(p){
      if(!p || seen[p.id] || String(p.id)===String(id)) return;
      seen[p.id]=1; if(p.pinned) n++;
    });
  });
  return n;
}

function renderFollowUI(){
  const btn=document.getElementById('followBtn'); if(!btn) return;
  btn.innerHTML = following ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-plus"></i> Follow';
  btn.classList.toggle('ing', following);
  const count=BASE_FOLLOWERS+(following?1:0);
  const sf=document.getElementById('statFollowers'); if(sf) sf.textContent=fmtN(count);
  const tf=document.getElementById('topFollowerCount'); if(tf) tf.textContent=fmtN(count)+' followers';
  const nb=document.getElementById('notifBtn'); if(nb) nb.classList.toggle('on', notifyOn && following);
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
function trackAdSlot(id, ev){ try{ if(id && window.AdService) AdService.track(id, ev); }catch(e){} }
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

function loadMore(){
  if(moreLoaded){ toast('✅ All posts loaded!'); return; }
  moreLoaded=true;
  allCache = POSTS.concat(MORE_POSTS);
  renderFeed();
  const b=document.getElementById('loadMoreBtn'); if(b) b.innerHTML='<i class="fas fa-check"></i> All posts loaded';
  toast('✨ More posts loaded!');
}

function toast(msg, dur){ dur=dur||2500; const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},dur); }

function openSupport(){ if(global.DroboardTip) DroboardTip.open('droboard-page'); }
function sharePage(){ if(global.openShareModal) window.openShareModal({ title:'Droboard — Official Page', sub:'@droboard · Announcements, debates & story picks', img:DROBOARD_LOGO, url:'https://droboard.app/droboard' }); }

function attachPostCard(){
  const area=document.getElementById('feedArea'); if(!area || typeof DroboardPostCard==='undefined') return;
  // ── Shared reaction-picker state (total-preserving, like feed-service) ──
  const RP = window.DroboardReactionPicker || null;
  const RP_IDS = RP ? RP.REACTIONS.map(function(r){return r.id}) : ['love','crying','angry','shocked'];
  const rxState={};
  function findReactPost(id){ return allCache.find(function(p){return String(p.id)===String(id)}) || POSTS.find(function(p){return String(p.id)===String(id)}) || (MORE_POSTS||[]).find(function(p){return String(p.id)===String(id)}) || null; }
  function getReactionFor(post){
    if(!rxState[post.id]){
      const o={userRx:null};
      RP_IDS.forEach(function(r){o[r]=0});
      const likes=post.likes||0;
      let secondId = RP_IDS.indexOf('crying')!==-1 ? 'crying' : RP_IDS[1] || RP_IDS[0];
      if(secondId==='love') secondId = RP_IDS[1] || 'crying';
      const second=Math.min(5,Math.max(0,likes));
      o.love=Math.max(0,likes-second);
      o[secondId]=second;
      o._secondId=secondId; o._extraId=null; o._extra=0;
      rxState[post.id]=o;
    }
    return rxState[post.id];
  }
  function rxPublic(id){
    const post=findReactPost(id);
    if(!post) return null; // unknown id: let other picker bindings claim it
    const st=getReactionFor(post);
    const out={userRx:st.userRx, love:st.love||0};
    if(st._secondId) out[st._secondId]=st[st._secondId]||0;
    if(st._extraId) out[st._extraId]=st._extra||0;
    return out;
  }
  function rxSum(st){ let s=0; RP_IDS.forEach(function(r){ s += st[r]||0; }); return s; }
  function onPickReact(id, rid){
    const post=findReactPost(id); if(!post) return;
    const st=getReactionFor(post);
    rid = rid || 'love';
    function decr(r){ if(r==='love') st.love=Math.max(0,(st.love||0)-1); else if(r===st._secondId) st[st._secondId]=Math.max(0,(st[st._secondId]||0)-1); else if(r===st._extraId){ st._extra=Math.max(0,(st._extra||0)-1); if(!st._extra) st._extraId=null; } }
    if(st.userRx===rid){ decr(rid); st.userRx=null; }
    else{
      if(st.userRx) decr(st.userRx);
      if(rid==='love') st.love=(st.love||0)+1;
      else if(rid===st._secondId) st[st._secondId]=(st[st._secondId]||0)+1;
      else{ st._extraId=rid; st._extra=(st._extra||0)+1; }
      st.userRx=rid;
    }
    post.userRx=st.userRx; post.liked=(st.userRx==='love'); post.likes=rxSum(st);
    DroboardPostCard.update(mapPost(post));
    if(inlineOpen[post.id]) mountInline(post);
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
  function mountInline(post){
    let card=null;
    try{ card=area.querySelector('[data-pcc-id="'+(CSS.escape?CSS.escape(post.id):post.id)+'"]'); }catch(e){}
    if(!card) return;
    let box=card.querySelector('.drb-inline-comments');
    if(!box){ box=document.createElement('div'); box.className='drb-inline-comments'; const acts=card.querySelector('.pcc-actions'); if(acts) acts.after(box); else card.appendChild(box); }
    if(inlineCS[post.id] && inlineCS[post.id].destroy){ try{ inlineCS[post.id].destroy(); }catch(e){} }
    inlineCS[post.id]=DroboardComments.attach(box, { storyId:post.id, title:'', comments:seedCommentsFor(post.id), currentUser:{name:'You', avatar:null}, collapsible:false, placeholder:'Add a comment…', getCommentUrl:function(c){return 'https://droboard.app/droboard/post/'+post.id+'#comment-'+c.id}, onPost:function(){bumpComments(post)}, onReply:function(){bumpComments(post)} });
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
  // register custom types once
  try{
    DroboardPostCard.registerType('announcement', function(post){
      return '<div class="dpc-body"><div class="drb-badge drb-badge-ann"><i class="fas fa-bullhorn"></i> Announcement</div>'+(post.title?'<div class="dpc-title">'+esc(post.title)+'</div>':'')+(post.text?'<div class="dpc-text trunc-5" id="dpc-txt-'+post.id+'">'+nl(esc(post.text))+'</div><span class="dpc-more" data-pid="'+post.id+'">See more <i class="fas fa-chevron-down" style="font-size:8px"></i></span>':'')+(post.image?'<img class="dpc-image" src="'+post.image+'" loading="lazy" data-image-open="1"/>':'')+'</div>';
    });
    DroboardPostCard.registerType('shoutout', function(post){
      const s=post.shoutout||{};
      const w=s._writer||writerById(s.id);
      const reads=w&&w.stats&&w.stats.reads? (w.stats.reads>=1000? (w.stats.reads/1000|0)+'k' : w.stats.reads) : '';
      const followers=w&&w.stats&&w.stats.followers!=null? w.stats.followers : '';
      const books=w&&w.books? w.books.length : '';
      const hasStats = reads!=='' || followers!=='' || books!=='';
      return '<div class="dpc-body"><div class="drb-badge drb-badge-shout"><i class="fas fa-star"></i> Writer Shoutout</div>'+(post.text?'<div class="dpc-text trunc-5" id="dpc-txt-'+post.id+'">'+nl(esc(post.text))+'</div><span class="dpc-more" data-pid="'+post.id+'">See more <i class="fas fa-chevron-down" style="font-size:8px"></i></span>':'')+'<div class="drb-shout-card" data-shout-open="'+post.id+'"><img class="drb-shout-av" src="'+(s.avatar||(w&&w.avatar)||'')+'" loading="lazy"/><div class="drb-shout-info"><div class="drb-shout-name">@'+esc(s.name||(w&&w.name)||'')+'</div><div class="drb-shout-tag">'+esc(s.tagline||'')+'</div>'+(hasStats?'<div style="display:flex;gap:8px;margin-top:4px;font-size:10px;color:var(--tx-muted)"><span><b style="color:var(--tx-high)">'+esc(String(reads))+'</b> reads</span><span><b style="color:var(--tx-high)">'+esc(String(followers))+'</b> followers</span><span><b style="color:var(--tx-high)">'+esc(String(books))+'</b> books</span></div>':'')+'</div><button class="drb-shout-follow'+(s.following?' ing':'')+'" data-shout-follow="'+(s.id||s._writerId||'')+'">'+(s.following?'✓ Following':'+ Follow')+'</button></div></div>';
    });
  }catch(e){}

  DroboardPostCard.attach(area, {
    getReactionHTML:function(post){ return RP ? RP.renderTrigger(post.id, {}) : undefined; },
    renderSponsored:function(post){ return renderSponsoredPost(post); },
    onLike:function(post){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig) return; orig.liked=!orig.liked; orig.likes+=(orig.liked?1:-1); DroboardPostCard.update(mapPost(orig)); if(inlineOpen[orig.id]) mountInline(orig); },
    onComment:function(post){ openComments(post); },
    onOpenPost:function(post){ goDiscussion(post.id); },
    onSave:function(post){
      const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig) return;
      if(window.openSaveModal){ window.openSaveModal({ title:orig.title||(orig.text?orig.text.substring(0,60):'Droboard post'), sub:'@droboard · Official Page', img:orig.image||(orig.storyRef&&orig.storyRef.cover)||DROBOARD_LOGO, storyId:orig.id }); }
      else { orig.saved=!orig.saved; DroboardPostCard.update(mapPost(orig)); if(inlineOpen[orig.id]) mountInline(orig); toast(orig.saved?'🔖 Saved!':'Removed from saved'); }
    },
    onShare:function(post){ window.openShareModal({ title:post.title||post.quote||(post.text?post.text.substring(0,60):'Droboard'), sub:'@droboard · Official Page', img:post.image||(post.storyRef&&post.storyRef.cover)||DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); },
    onDotsAction:function(action, post){
      if(action==='report') return toast('🚩 Reported.');
      if(action==='less') return toast("👁️ You'll see less of this.");
      if(action==='follow') return toast('✅ You already follow @droboard!');
      if(action==='share'){ window.openShareModal({ title:post.title||'Droboard', sub:'@droboard', img:DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); return; }
      if(action==='save'){ window.openSaveModal({ title:post.title||post.quote||'Droboard post', sub:'@droboard', img:post.image||DROBOARD_LOGO, storyId:post.id }); return; }
    },
    onPollVote:function(post, oi){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig||!orig.poll) return; if(orig.poll.voted>=0) return toast('✅ Already voted!'); orig.poll.opts[oi].v++; orig.poll.voted=oi; orig.poll.total++; DroboardPostCard.update(mapPost(orig)); if(inlineOpen[orig.id]) mountInline(orig); toast('✅ Vote cast!'); },
    onDebateVote:function(post, side){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig||!orig.debateData) return; if(orig.debateData.userVote) return toast('✅ Already voted!'); orig.debateData.userVote=side; if(side==='for') orig.debateData.forV++; else orig.debateData.agV++; DroboardPostCard.update(mapPost(orig)); if(inlineOpen[orig.id]) mountInline(orig); toast(side==='for'?'✅ Voted FOR!':'❌ Voted AGAINST!'); },
    onAvatarClick:function(){ window.scrollTo({top:0,behavior:'smooth'}); },
    onDots:function(post, anchor){ if(window.DroboardDotsMenu) DroboardDotsMenu.open(post, anchor); },
    onReplySend:function(post){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig) return; orig.comments++; DroboardPostCard.update(mapPost(orig)); toast('💬 Reply posted!'); }
  });

  if(RP){ RP.attach(area, { getState:function(id){ return rxPublic(id); }, onReact:function(id, rid){ onPickReact(id, rid); } }); }

  // Every See more / text tap / debate footer → discussion page for that post
  area.addEventListener('click', function(e){
    const sm=e.target.closest('.dpc-more[data-pid], [data-pcc-readmore]');
    if(sm){ const card=e.target.closest('.pcc-post'); const pid=(sm.dataset&&sm.dataset.pid)||(card&&card.dataset.pccId); if(pid) goDiscussion(pid); return; }
    const df=e.target.closest('.pcc-debate-footer');
    if(df){ const card=e.target.closest('.pcc-post'); if(card&&card.dataset.pccId) goDiscussion(card.dataset.pccId); return; }
    const ot=e.target.closest('[data-pcc-openpost]');
    if(ot){ const card=e.target.closest('.pcc-post'); if(card&&card.dataset.pccId) goDiscussion(card.dataset.pccId); return; }
  });

  area.addEventListener('click', function(e){
    const fb=e.target.closest('[data-shout-follow]');
    if(fb){ const wid=fb.dataset.shoutFollow; FOLLOW_STATE[wid]=!FOLLOW_STATE[wid]; localStorage.setItem('drb_shout_follows', JSON.stringify(FOLLOW_STATE)); const w=writerById(wid); toast(FOLLOW_STATE[wid] ? '✅ Following @'+(w?w.name:'writer')+'!' : 'Unfollowed @'+(w?w.name:'writer')); renderFeed(); return; }
    if(e.target.closest('[data-shout-open]')){ toast('👤 Opening profile…'); return; }
    if(e.target.closest('[data-story-chip]')){ toast('📖 Opening story…'); return; }
    if(e.target.closest('[data-ama-open]')){ toast('🎙 Joining Droboard Live…'); return; }
    if(e.target.closest('[data-image-open]')){ toast('🖼 Viewing…'); return; }
  });
}

let cs=null; const postCommentsCache={};
function prepareCommentSeed(list){
  return (list||[]).map(function(c){
    const ws=c.wid ? writerById(c.wid) : null;
    return Object.assign({}, c, { rx:c.reactions||null, statuses: ws? ws.statuses : null, replies: prepareCommentSeed(c.replies) });
  });
}
function seedCommentsFor(postId){
  if(!postCommentsCache[postId]){
    const raw=typeof COMMENTS_DATA!=='undefined' ? JSON.parse(JSON.stringify(COMMENTS_DATA)) : [];
    postCommentsCache[postId]=prepareCommentSeed(raw);
  }
  return postCommentsCache[postId];
}
function openComments(post){
  const overlay=document.getElementById('commentOverlay');
  const mount=document.getElementById('commentMount'); if(!overlay||!mount) return;
  if(cs && cs.destroy){ try{cs.destroy();}catch(e){} cs=null; }
  mount.innerHTML='';
  cs = DroboardComments.attach(mount, { storyId:post.id, title:'Comments', comments: seedCommentsFor(post.id), currentUser:{name:'You', avatar:null}, collapsible:false, placeholder:'Add a comment…', getCommentUrl:function(c){return 'https://droboard.app/droboard/post/'+post.id+'#comment-'+c.id}, onPost:function(){ const o=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(o){o.comments++; DroboardPostCard.update(mapPost(o));}}, onReply:function(){ const o=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(o){o.comments++; DroboardPostCard.update(mapPost(o));}} });
  overlay.classList.add('open'); document.body.style.overflow='hidden';
}
function closeComments(){ const o=document.getElementById('commentOverlay'); if(o) o.classList.remove('open'); document.body.style.overflow=''; }

function initSpotlight(){
  const pool=getWriterPool();
  const people=pool.map(function(w){
    return { id:w.id, name:w.name, av:w.avatar, ring:w.ring, isLive:w.isLive||false, statuses:w.statuses, verified:['w1','w5','w6'].indexOf(w.id)!==-1, rank: w.isLive?'🔴 Live now':null, following:!!FOLLOW_STATE[w.id], profileUrl:'profile.html' };
  });
  if(!people.length || typeof DroboardPeopleToFollow==='undefined') return;
  DroboardPeopleToFollow.render('#ptfMount', { people:people, title:'', maxVisible:8, onFollow:function(o){ FOLLOW_STATE[o.id]=o.following; localStorage.setItem('drb_shout_follows', JSON.stringify(FOLLOW_STATE)); toast(o.following ? '✅ Following @'+o.name : 'Unfollowed @'+o.name); } });
}
function initCollections(){
  if(typeof DroboardCollectionCard==='undefined') return;
  const mount=document.getElementById('collectionsGrid'); if(!mount) return;
  DroboardCollectionCard.attach(mount, {
    onOpen:function(c){ toast('📂 Opening "'+c.name+'"…'); },
    onShare:function(c){ window.openShareModal({ title:c.name, sub:(c.count||0)+' stories · Curated by @droboard', img:(c.covers&&c.covers[0])||DROBOARD_LOGO, url:'https://droboard.app/collection/'+c.id }); }
  });
  fetchCollections().then(function(cols){ DroboardCollectionCard.setCollections(cols); });
}

  /* ── Page info (bio / links / guidelines) — manager-editable ── */
  const ABOUT_KEY='drb_about_info';
  /* ── Page settings (support strip visibility) — manager-editable ── */
  const SETTINGS_KEY='drb_page_settings';
  function getPageSettings(){
    let s={ showSupport:true };
    try{ s=Object.assign(s, JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}); }catch(e){}
    return s;
  }
  function savePageSettings(patch){
    const next=Object.assign(getPageSettings(), patch||{});
    try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }catch(e){}
    return next;
  }
  const DEFAULT_RULES=['Be kind — debate the story, not the person.','Tag spoilers so everyone gets to feel the twist.','No harassment of writers or fellow readers.','Shoutouts and story picks are curated by the team, not paid placements.'];
  const SOCIAL_NETWORKS=['instagram','x','facebook','tiktok','youtube','linkedin','threads','snapchat','whatsapp','telegram','website'];
  const SOCIAL_ICONS={ instagram:'fab fa-instagram', x:'fab fa-x-twitter', facebook:'fab fa-facebook', tiktok:'fab fa-tiktok', youtube:'fab fa-youtube', linkedin:'fab fa-linkedin', threads:'fab fa-threads', snapchat:'fab fa-snapchat', whatsapp:'fab fa-whatsapp', telegram:'fab fa-telegram', website:'fas fa-globe' };
  function defaultLinks(hero){
    const links=(hero&&hero.links)||{};
    return [
      { network:'instagram', handle:links.instagram||'@droboard.app' },
      { network:'x', handle:links.x||'@droboard' }
    ];
  }
  function getAbout(){
    const hero=getHero();
    let ov={}; try{ ov=JSON.parse(localStorage.getItem(ABOUT_KEY)||'{}')||{}; }catch(e){}
    let links=Array.isArray(ov.links)&&ov.links.length ? ov.links : null;
    if(!links){
      // migrate legacy single fields, else seed defaults
      const ig = ov.instagram || ((hero.links&&hero.links.instagram)||'@droboard.app');
      const x = ov.x || ((hero.links&&hero.links.x)||'@droboard');
      links=[{ network:'instagram', handle:ig }, { network:'x', handle:x }];
      if(ov.links && !ov.links.length) links=[];
    }
    return {
      bio: ov.bio!==undefined ? ov.bio : (hero.bio||''),
      blurb: ov.blurb || null,
      email: ov.email || ((hero.links&&hero.links.email)||'hello@droboard.app'),
      support: ov.support || ((hero.links&&hero.links.support)||'support.droboard.app'),
      links: links.filter(function(l){ return l && l.handle; }),
      rules: (Array.isArray(ov.rules)&&ov.rules.length) ? ov.rules : DEFAULT_RULES.slice()
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
    const eb=document.getElementById('aboutEditBtn'); if(eb) eb.style.display=canCurrentManage('post')?'block':'none';
  }
  function closeAboutEditor(){ const o=document.getElementById('aboutEditorOv'); if(o) o.remove(); }
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
  function openPageMenu(){
    closePageMenu();
    const isManager=canCurrentManage('post');
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
  function openAboutEditor(){
    if(!canCurrentManage('post')){ toast('Only page managers can edit this'); return; }
    closeAboutEditor();
    const a=getAbout();
    const curBlurb=((document.getElementById('aboutBlurb')||{}).textContent||'').trim();
    const ov=document.createElement('div');
    ov.id='aboutEditorOv';
    ov.style.cssText='position:fixed;inset:0;z-index:1800;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center';
    function fld(id, label, val, rows){
      const input = rows
        ? '<textarea id="'+id+'" rows="'+rows+'" style="width:100%;padding:9px 11px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12.5px;font-family:inherit;resize:vertical">'+esc(val||'')+'</textarea>'
        : '<input id="'+id+'" value="'+esc(val||'').replace(/"/g,'&quot;')+'" style="width:100%;padding:9px 11px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12.5px;font-family:inherit"/>';
      return '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;margin-bottom:5px">'+label+'</div>'+input+'</div>';
    }
    ov.innerHTML='<div style="width:100%;max-width:520px;background:var(--l1,#fff);border-radius:20px 20px 0 0;padding:16px;max-height:88vh;overflow-y:auto">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><b style="font-size:14px">Edit page info</b><button id="abClose" style="width:28px;height:28px;border-radius:50%;background:var(--l2);border:none;color:var(--tx-muted);cursor:pointer">✕</button></div>'
      +fld('abBio','Page bio (under the name)',a.bio,3)
      +fld('abBlurb','About section text',a.blurb||curBlurb,4)
      +fld('abEmail','Contact email',a.email)
      +fld('abSupport','Support line',a.support)
      +'<div style="font-size:11px;font-weight:700;margin:12px 0 5px">Social links (any network — all added appear on the page)</div><div id="abLinks"></div>'
      +'<button id="abAddLink" style="width:100%;padding:9px;border:1.5px dashed var(--bd);border-radius:10px;background:transparent;color:var(--tx-muted);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:10px">+ Add social link</button>'
      +fld('abRules','Community guidelines (one per line)',a.rules.join('\n'),5)
      +'<button id="abSave" style="width:100%;padding:11px;border:none;border-radius:12px;background:var(--acc);color:#fff;font-size:13px;font-weight:800;cursor:pointer;margin-top:4px">Save changes</button></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) closeAboutEditor(); });
    document.getElementById('abClose').addEventListener('click', closeAboutEditor);
    function linkRow(l){
      l = l || { network:'instagram', handle:'' };
      const opts = SOCIAL_NETWORKS.map(function(n){ return '<option value="'+n+'"'+(n===l.network?' selected':'')+'>'+n+'</option>'; }).join('');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
      row.innerHTML = '<select data-socnet style="flex:0 0 118px;padding:9px 8px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12px">'+opts+'</select>'
        + '<input data-sochandle value="'+esc(l.handle||'').replace(/"/g,'&quot;')+'" placeholder="@handle or URL" style="flex:1;min-width:0;padding:9px 11px;border:1px solid var(--bd);border-radius:10px;background:var(--l2);color:var(--tx-high);font-size:12px;font-family:inherit"/>'
        + '<button data-socx style="flex-shrink:0;width:36px;border-radius:10px;border:1px solid var(--bd);background:var(--l2);color:var(--tx-muted);cursor:pointer">✕</button>';
      row.querySelector('[data-socx]').addEventListener('click', function(){ row.remove(); });
      return row;
    }
    const linksBox = document.getElementById('abLinks');
    a.links.forEach(function(l){ linksBox.appendChild(linkRow(l)); });
    document.getElementById('abAddLink').addEventListener('click', function(){ linksBox.appendChild(linkRow(null)); });
    document.getElementById('abSave').addEventListener('click', function(){
      const gv=function(id){ const el=document.getElementById(id); return el?el.value.trim():''; };
      const rules=gv('abRules').split('\n').map(function(s){return s.trim()}).filter(Boolean);
      const links=Array.from(linksBox.children).map(function(row){
        const sel=row.querySelector('[data-socnet]'), inp=row.querySelector('[data-sochandle]');
        return { network: sel?sel.value:'website', handle: inp?inp.value.trim():'' };
      }).filter(function(l){ return l.handle; });
      const patch={ bio:gv('abBio'), blurb:gv('abBlurb'), email:gv('abEmail'), support:gv('abSupport'), links:links, rules:rules.length?rules:DEFAULT_RULES.slice() };
      try{ localStorage.setItem(ABOUT_KEY, JSON.stringify(patch)); }catch(e){}
      renderAbout(); closeAboutEditor(); toast('✅ Page info updated');
    });
  }

function canCurrentManage(need){
  // current viewer handle — from auth-session if available, fallback demo
  let h=null; try{ if(global.AuthSession && AuthSession.getSession){ /* sync cache */ } }catch(e){}
  // sync path: read demo ME from profile demo seed global if present
  try{ if(global.PROFILE_ME) h=global.PROFILE_ME.handle; }catch(e){}
  if(!h) try{ h=JSON.parse(localStorage.getItem('drb_me')||'null')?.handle || 'Ada_Writes'; }catch(e){ h='Ada_Writes'; }
  return canManage(h, need);
}
function persistExtra(post){ try{ const a=JSON.parse(localStorage.getItem('drb_posts_extra')||'[]'); a.unshift(post); localStorage.setItem('drb_posts_extra', JSON.stringify(a.slice(0,50))); }catch(e){} }
function rewriteExtras(list){ try{ localStorage.setItem('drb_posts_extra', JSON.stringify((list||[]).slice(0,50))); }catch(e){} }
function readExtras(){ try{ const a=JSON.parse(localStorage.getItem('drb_posts_extra')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function removeExtraFromLS(id){ rewriteExtras(readExtras().filter(function(x){ return String(x.id)!==String(id); })); }
function upsertExtra(post){ const a=readExtras(); const i=a.findIndex(function(x){ return String(x.id)===String(post.id); }); if(i>-1) a[i]=post; else a.unshift(post); rewriteExtras(a); }
function saveEditPatch(id, patch){ try{ const m=JSON.parse(localStorage.getItem('drb_posts_edits')||'{}')||{}; m[id]=Object.assign({}, m[id], patch); localStorage.setItem('drb_posts_edits', JSON.stringify(m)); }catch(e){} }
function recordDelete(id){ try{ const d=JSON.parse(localStorage.getItem('drb_posts_deleted')||'[]')||[]; if(d.indexOf(String(id))===-1) d.push(String(id)); localStorage.setItem('drb_posts_deleted', JSON.stringify(d)); }catch(e){} }
function recordPin(id, pinned){ try{ const m=JSON.parse(localStorage.getItem('drb_posts_pins')||'{}')||{}; m[id]=!!pinned; localStorage.setItem('drb_posts_pins', JSON.stringify(m)); }catch(e){} }
let editingId=null; // post id being edited through the composer (null = new post)
function findPostAnywhere(id){
  return allCache.find(function(p){return String(p.id)===String(id)}) || POSTS.find(function(p){return String(p.id)===String(id)}) || (MORE_POSTS||[]).find(function(p){return String(p.id)===String(id)}) || null;
}
function dropPostEverywhere(id){
  const pred=function(p){ return String(p.id)!==String(id); };
  POSTS=POSTS.filter(pred); MORE_POSTS=MORE_POSTS.filter(pred); allCache=allCache.filter(pred);
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
  function onDeletePost(post){
    const orig=findPostAnywhere(post.id); if(!orig){ toast('Post no longer exists'); return; }
    dropPostEverywhere(orig.id);
    removeExtraFromLS(orig.id); recordDelete(orig.id);
    renderFeed(); toast('🗑️ Post deleted');
  }
  function onPinPost(post, pinned){
    const orig=findPostAnywhere(post.id); if(!orig){ toast('Post no longer exists'); return; }
    if(pinned && !orig.pinned && pinnedCountExcept(orig.id) >= 3){ toast('📌 Pin limit reached (3 max) — unpin one first'); return; }
    [POSTS, MORE_POSTS, allCache].forEach(function(arr){ const it=arr.find(function(x){return String(x.id)===String(orig.id)}); if(it) it.pinned=!!pinned; });
    if(readExtras().some(function(x){return String(x.id)===String(orig.id)})){
      const a=readExtras(); const it=a.find(function(x){return String(x.id)===String(orig.id)}); if(it){ it.pinned=!!pinned; rewriteExtras(a); }
    } else recordPin(orig.id, pinned);
    renderFeed(); toast(pinned ? '📌 Post pinned to top' : 'Unpinned');
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

async function init(){
  // loading → empty → root states like profile.html:30
  const ls=document.getElementById('loadingState');
  const rs=document.getElementById('droboardRoot');
  const es=document.getElementById('emptyState');
  try{
    const fp=await fetchPosts(); POSTS=fp.posts||[]; MORE_POSTS=fp.morePosts||[]; allCache=POSTS.slice();
    if(!POSTS.length){
      if(ls) ls.style.display='none'; if(es) es.style.display='block'; return;
    }
    if(ls) ls.style.display='none'; if(rs) rs.style.display='block';
    renderFollowUI();
    initTabs();
    configureDotsMenu();
    renderAbout();
    const aeb=document.getElementById('aboutEditBtn'); if(aeb) aeb.addEventListener('click', openAboutEditor);
    attachPostCard();
    renderFeed();
    initSpotlight();
    initCollections();
    const wf=document.getElementById('statWritersFeatured'); if(wf) wf.textContent = (function(){ const ids=new Set(); allCache.forEach(function(p){ if(p.type==='shoutout'&&p.shoutout&&p.shoutout.id) ids.add(p.shoutout.id); }); return ids.size; })();
    // wire follow/notify/share already bound via onclick + renderFollowUI
    const lm=document.getElementById('loadMoreBtn'); if(lm) lm.addEventListener('click', loadMore);
    // composer + role panel — manager-gated
    try{ if(global.DroboardComposer) DroboardComposer.mount('#composerMount', { onPosted:function(p){
      if(editingId){
        const id=editingId; editingId=null;
        const orig=findPostAnywhere(id);
        if(!orig){ toast('Post no longer exists'); return; }
        const patch=Object.assign({}, p);
        delete patch.likes; delete patch.comments; delete patch.liked; delete patch.saved; delete patch.id;
        const merged=Object.assign({}, orig, patch);
        [POSTS, MORE_POSTS, allCache].forEach(function(arr){ const i=arr.findIndex(function(x){return String(x.id)===String(id)}); if(i>-1) arr[i]=merged; });
        if(readExtras().some(function(x){return String(x.id)===String(id)})) upsertExtra(merged);
        else saveEditPatch(id, patch);
        renderFeed(); toast('✅ Post updated!');
        return;
      }
      persistExtra(p); POSTS.unshift(p); allCache.unshift(p); renderFeed(); toast('Posted to @droboard');
    } }); }catch(e){}
    try{ if(global.DroboardManagers) DroboardManagers.mount('#managersMount'); }catch(e){}
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

  global.DroboardPageData.canManage=canManage; global.DroboardPageData.canCurrentManage=canCurrentManage; global.DroboardPageData.getManagers=getManagers; global.DroboardPageData.addManager=addManager; global.DroboardPageData.updateManagerRole=updateManagerRole; global.DroboardPageData.removeManager=removeManager; global.DroboardPageData.createPost=createPost;
  // Save-modal confirmations land here (same contract as feed): flip the card state.
  window.onDroboardSaveChange = function (storyId, saved) {
    if (!storyId) return;
    const orig = allCache.find(function(p){return String(p.id)===String(storyId)}) || POSTS.find(function(p){return String(p.id)===String(storyId)});
    if (!orig) return;
    if (!!orig.saved === !!saved) return; // no-op: modal closed without changes
    orig.saved = !!saved;
    if (window.DroboardPostCard) DroboardPostCard.update(mapPost(orig));
    if (inlineOpen[orig.id] && mountInlineRef) mountInlineRef(orig);
    toast(saved ? '🔖 Saved!' : 'Removed from saved');
  };
global.DroboardOfficial = { init:init, switchTab:switchTab, loadMore:loadMore, toggleFollow:function(){ following=!following; localStorage.setItem('drb_following', following?'1':'0'); if(!following){notifyOn=false; localStorage.setItem('drb_notify','0');} renderFollowUI(); toast(following?'✅ Following @droboard!':'Unfollowed @droboard'); }, toggleNotify:function(){ if(!following) return toast('Follow @droboard first to get notified'); notifyOn=!notifyOn; localStorage.setItem('drb_notify', notifyOn?'1':'0'); renderFollowUI(); toast(notifyOn?'🔔 You’ll get notified about new posts':'Notifications turned off'); }, openSupport:openSupport, openPageMenu:openPageMenu, sharePage:sharePage, closeComments:closeComments, canManage:canManage, canCurrentManage:canCurrentManage };

})(window);
