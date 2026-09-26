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

async function fetchPosts(){
  if(USE_API){
    const r=await fetch(API_BASE+'/posts',{credentials:'include'}); if(r.ok){ const j=await r.json(); return j.data||j; }
  }
  // writer avatars come from WRITER_STATUSES (post-data.js) — service enriches
  const s=_seed();
  return { posts: (s.DROBOARD_POSTS||[]).slice(), morePosts:(s.DROBOARD_MORE_POSTS||[]).slice() };
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

function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function nl(s){return (s||'').replace(/\n/g,'<br>')}
function fmtN(n){return n>=1000?(n/1000).toFixed(1)+'k':String(n||0)}
const DROBOARD_LOGO='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff0050"/><stop offset="1" stop-color="#7a0030"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(#g)"/><text x="50" y="68" font-family="Georgia,serif" font-size="56" font-weight="900" fill="#fff" text-anchor="middle">D</text></svg>');

function getWriterPool(){ return (typeof WRITER_STATUSES!=='undefined') ? WRITER_STATUSES.filter(function(w){return !w.isYou}) : []; }
function writerById(id){ const pool=getWriterPool(); return pool.find(function(w){return w.id===id})||null; }
function mapPost(p){
  if(p.type==='shoutout' && p.shoutout && p.shoutout.id){
    const w=writerById(p.shoutout.id);
    return Object.assign({}, p, { shoutout:Object.assign({}, p.shoutout, { name:w?w.name:'Droboard Writer', avatar:w?w.avatar:DROBOARD_LOGO, following:!!FOLLOW_STATE[p.shoutout.id] }) });
  }
  return p;
}
function currentList(){ const base=moreLoaded? allCache : POSTS; if(currentTab==='all') return base; return base.filter(function(p){return p.type===currentTab}); }

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
  const REACTION_IDS=['love','fire','cry','shock','angry','clap'];
  const rxState={};
  function getReactionFor(post){
    if(!rxState[post.id]){ const o={userRx:null}; REACTION_IDS.forEach(function(r){o[r]=Math.floor(Math.random()*180)+5}); rxState[post.id]=o; }
    return rxState[post.id];
  }
  // register custom types once
  try{
    DroboardPostCard.registerType('announcement', function(post){
      return '<div class="dpc-body"><div class="drb-badge drb-badge-ann"><i class="fas fa-bullhorn"></i> Announcement</div>'+(post.title?'<div class="dpc-title">'+esc(post.title)+'</div>':'')+(post.text?'<div class="dpc-text trunc-5" id="dpc-txt-'+post.id+'">'+nl(esc(post.text))+'</div><span class="dpc-more" data-pid="'+post.id+'">See more <i class="fas fa-chevron-down" style="font-size:8px"></i></span>':'')+(post.image?'<img class="dpc-image" src="'+post.image+'" loading="lazy" data-image-open="1"/>':'')+'</div>';
    });
    DroboardPostCard.registerType('shoutout', function(post){
      const s=post.shoutout||{};
      return '<div class="dpc-body"><div class="drb-badge drb-badge-shout"><i class="fas fa-star"></i> Writer Shoutout</div>'+(post.text?'<div class="dpc-text trunc-5" id="dpc-txt-'+post.id+'">'+nl(esc(post.text))+'</div><span class="dpc-more" data-pid="'+post.id+'">See more <i class="fas fa-chevron-down" style="font-size:8px"></i></span>':'')+'<div class="drb-shout-card" data-shout-open="'+post.id+'"><img class="drb-shout-av" src="'+(s.avatar||'')+'" loading="lazy"/><div class="drb-shout-info"><div class="drb-shout-name">@'+esc(s.name||'')+'</div><div class="drb-shout-tag">'+esc(s.tagline||'')+'</div></div><button class="drb-shout-follow'+(s.following?' ing':'')+'" data-shout-follow="'+s.id+'">'+(s.following?'✓ Following':'+ Follow')+'</button></div></div>';
    });
  }catch(e){}

  DroboardPostCard.attach(area, {
    getReaction:getReactionFor,
    onLike:function(post){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig) return; orig.liked=!orig.liked; orig.likes+=(orig.liked?1:-1); DroboardPostCard.update(mapPost(orig)); },
    onReact:function(post, rid){ const rx=getReactionFor(post); if(rx.userRx===rid){rx[rid]--; rx.userRx=null;} else { if(rx.userRx) rx[rx.userRx]--; rx[rid]++; rx.userRx=rid; } const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(orig) DroboardPostCard.update(mapPost(orig)); },
    onComment:function(post){ openComments(post); },
    onShare:function(post){ window.openShareModal({ title:post.title||post.quote||(post.text?post.text.substring(0,60):'Droboard'), sub:'@droboard · Official Page', img:post.image||(post.storyRef&&post.storyRef.cover)||DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); },
    onDotsAction:function(action, post){
      if(action==='report') return toast('🚩 Reported.');
      if(action==='less') return toast("👁️ You'll see less of this.");
      if(action==='follow') return toast('✅ You already follow @droboard!');
      if(action==='share'){ window.openShareModal({ title:post.title||'Droboard', sub:'@droboard', img:DROBOARD_LOGO, url:'https://droboard.app/droboard/post/'+post.id }); return; }
      if(action==='save'){ window.openSaveModal({ title:post.title||post.quote||'Droboard post', sub:'@droboard', img:post.image||DROBOARD_LOGO, storyId:post.id }); return; }
    },
    onPollVote:function(post, oi){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig||!orig.poll) return; if(orig.poll.voted>=0) return toast('✅ Already voted!'); orig.poll.opts[oi].v++; orig.poll.voted=oi; orig.poll.total++; DroboardPostCard.update(mapPost(orig)); toast('✅ Vote cast!'); },
    onDebateVote:function(post, side){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig||!orig.debateData) return; if(orig.debateData.userVote) return toast('✅ Already voted!'); orig.debateData.userVote=side; if(side==='for') orig.debateData.forV++; else orig.debateData.agV++; DroboardPostCard.update(mapPost(orig)); toast(side==='for'?'✅ Voted FOR!':'❌ Voted AGAINST!'); },
    onAvatarClick:function(){ window.scrollTo({top:0,behavior:'smooth'}); },
    onReplySend:function(post){ const orig=allCache.find(function(p){return p.id===post.id})||POSTS.find(function(p){return p.id===post.id}); if(!orig) return; orig.comments++; DroboardPostCard.update(mapPost(orig)); toast('💬 Reply posted!'); }
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
  mount.innerHTML='';
  if(cs && cs.destroy) cs.destroy();
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
    attachPostCard();
    renderFeed();
    initSpotlight();
    initCollections();
    const wf=document.getElementById('statWritersFeatured'); if(wf) wf.textContent = (function(){ const ids=new Set(); allCache.forEach(function(p){ if(p.type==='shoutout'&&p.shoutout&&p.shoutout.id) ids.add(p.shoutout.id); }); return ids.size; })();
    // wire follow/notify/share already bound via onclick + renderFollowUI
    const lm=document.getElementById('loadMoreBtn'); if(lm) lm.addEventListener('click', loadMore);
    // expose for inline onclicks
    global.DroboardOfficial._closeComments=closeComments;
  }catch(e){
    if(ls) ls.innerHTML='<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Couldn\'t load</h4><p>'+esc(e.message||String(e))+'</p></div>';
  }
  // toast helper exposed
  global.toast = toast;
}

global.DroboardOfficial = { init:init, switchTab:switchTab, loadMore:loadMore, toggleFollow:function(){ following=!following; localStorage.setItem('drb_following', following?'1':'0'); if(!following){notifyOn=false; localStorage.setItem('drb_notify','0');} renderFollowUI(); toast(following?'✅ Following @droboard!':'Unfollowed @droboard'); }, toggleNotify:function(){ if(!following) return toast('Follow @droboard first to get notified'); notifyOn=!notifyOn; localStorage.setItem('drb_notify', notifyOn?'1':'0'); renderFollowUI(); toast(notifyOn?'🔔 You’ll get notified about new posts':'Notifications turned off'); }, openSupport:openSupport, sharePage:sharePage, closeComments:closeComments };

})(window);
