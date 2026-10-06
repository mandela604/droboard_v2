/**
 * settings-service.js — Data + controller for Settings page
 * All logic lives here. settings.html is HTML only + SettingsPage.init().
 * DEMO: localStorage for visibility/readingActivity, auth-session for logout.
 * Going live: swap demoStore with API calls.
 */
(function(global){
'use strict';

const THEME_KEY='droboardTheme';
function getTheme(){ try{ return localStorage.getItem(THEME_KEY)||'light';}catch(e){ return 'light'; } }
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{ localStorage.setItem(THEME_KEY,t);}catch(e){}
  document.querySelectorAll('.theme-option').forEach(function(opt){
    opt.classList.toggle('active',opt.getAttribute('data-theme')===t);
  });
}

function toast(msg){
  var el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(function(){ el.classList.remove('show'); }, 2200);
}

async function getProfile(){
  // prefer auth-session if available
  try{
    if(global.AuthSession && AuthSession.getSession){
      var s=await AuthSession.getSession();
      if(s && s.handle) return { name:s.name||'Luna Morgan', handle:s.handle, email:'luna.morgan@email.com', avatar:s.avatar||'https://i.pravatar.cc/150?img=32' };
    }
  }catch(e){}
  // demo fallback
  return { name:'Luna Morgan', handle:'luna_morgan', email:'luna.morgan@email.com', avatar:'https://i.pravatar.cc/150?img=32' };
}

const STORE_KEYS={ vis:'droboard_visibility', reading:'droboard_reading_activity' };
function loadVis(){ try{ return localStorage.getItem(STORE_KEYS.vis)||'public';}catch(e){ return 'public'; } }
function saveVis(v){ try{ localStorage.setItem(STORE_KEYS.vis, v);}catch(e){} }

function renderProfile(p){
  var pa=document.querySelector('.profile-avatar'); if(pa) pa.src=p.avatar;
  var pn=document.querySelector('.profile-name'); if(pn) pn.textContent=p.name;
  var pe=document.querySelector('.profile-email'); if(pe) pe.textContent=p.email;
  var er=document.getElementById('emailRowDesc'); if(er) er.textContent=p.email;
  var em=document.getElementById('emailModalAddr'); if(em) em.textContent=p.email;
}

// ── Drawer — reuse profile component ──
async function initDrawer(profile){
  renderProfile(profile);
  if(!global.DroboardProfileMenu) return;
  // pull the full profile so menu counts match profile page exactly
  var full = null;
  try {
    if (global.ProfileData && profile && profile.handle) full = await ProfileData.getProfile(profile.handle);
  } catch (e) {}
  var src = full || {};
  // build a profile-shaped object the component expects
  var menuProfile={
    name: src.name || profile.name, handle: src.handle || profile.handle, avatar: src.avatar || profile.avatar,
    isWriter: !!(src.isWriter || profile.isWriter),
    books: src.books || profile.books || [], library: src.library || profile.library || [],
    collections: src.collections || profile.collections || [],
    stats: src.stats || profile.stats || { following: 0 },
    following: []
  };
  var boards=[
    {id:'fantasy',name:'Fantasy',icon:'fa-hat-wizard',members:'45.7K'},
    {id:'romance',name:'Romance',icon:'fa-heart',members:'92.1K'},
    {id:'werewolf',name:'Werewolf',icon:'fa-moon',members:'31.2K'}
  ];
  var joinedColls=[
    {id:'coll_1', name:'Midnight Reads', count:12},
    {id:'coll_2', name:'Tear-jerkers', count:8},
    {id:'coll_3', name:'Weekend Binge', count:15}
  ];
  DroboardProfileMenu.configure({
    profile: menuProfile, isOwner: true,
    boards: boards, collections: joinedColls,
    onTab: function(tab){
      if(tab==='books') location.href='profile.html#books';
      else if(tab==='library') location.href='library.html';
      else if(tab==='collections') location.href='profile.html#collections';
      else location.href='profile.html';
    },
    onNewPost: function(){ location.href='create.html'; },
    onNewBook: function(){ location.href='create.html'; },
    onBecomeWriter: function(){ location.href='edit-profile.html'; },
    onRefer: function(){ location.href='refer.html'; },
    onSignOut: function(){ document.getElementById('logoutRow').click(); }
  });
  document.getElementById('menuBtn').addEventListener('click', function(){ DroboardProfileMenu.open(); });
}

async function init(){
  setTheme(getTheme());
  window.setTheme=setTheme;
  window.toast=toast;

  // theme options (markup carries no inline handlers)
  document.querySelectorAll('.theme-option').forEach(function(opt){
    opt.addEventListener('click', function(){ setTheme(opt.getAttribute('data-theme')); });
  });

  var profile=await getProfile();
  renderProfile(profile);
  initDrawer(profile);

  document.getElementById('backBtn').addEventListener('click',function(){
    if(window.history.length>1) window.history.back();
    else window.location.href='profile.html';
  });

  // ── Visibility (demo, persisted) ──
  var isPublic=loadVis()==='public';
  var visRow=document.getElementById('visibilityRow');
  var visDesc=document.getElementById('visibilityDesc');
  var visOv=document.getElementById('visOverlay');
  var curLabel=document.getElementById('visCurrentLabel');
  var toggleBtn=document.getElementById('visToggle');
  function syncVis(){
    if(visDesc) visDesc.textContent=isPublic?'Public':'Private';
    if(curLabel) curLabel.textContent=isPublic?'Public':'Private';
    if(toggleBtn) toggleBtn.textContent=isPublic?'Switch to Private':'Switch to Public';
  }
  function openVis(){ syncVis(); visOv.classList.add('open'); }
  function closeVis(){ visOv.classList.remove('open'); }
  syncVis();
  if(visRow) visRow.addEventListener('click', openVis);
  document.getElementById('visClose').addEventListener('click', closeVis);
  document.getElementById('visCancel').addEventListener('click', closeVis);
  if(visOv) visOv.addEventListener('click', function(e){ if(e.target===visOv) closeVis(); });
  toggleBtn.addEventListener('click', function(){
    isPublic=!isPublic;
    saveVis(isPublic?'public':'private');
    syncVis(); closeVis();
    toast('Profile is now '+(isPublic?'Public':'Private'));
  });

  // ── Reading activity toggle ──
  var readingToggle=document.getElementById('readingToggle');
  if(readingToggle){
    try{ var saved=localStorage.getItem(STORE_KEYS.reading); if(saved==='off') readingToggle.classList.remove('on'); }catch(e){}
    readingToggle.addEventListener('click', function(){
      this.classList.toggle('on');
      var on=this.classList.contains('on');
      try{ localStorage.setItem(STORE_KEYS.reading, on?'on':'off');}catch(e){}
      toast(on?'Reading activity visible':'Reading activity hidden');
    });
  }

  // ── Email modal ──
  var eOv=document.getElementById('emailOverlay');
  function openEmail(){ eOv.classList.add('open'); }
  function closeEmail(){ eOv.classList.remove('open'); }
  document.getElementById('emailRow').addEventListener('click', openEmail);
  document.getElementById('emailClose').addEventListener('click', closeEmail);
  document.getElementById('emailOk').addEventListener('click', function(){ closeEmail(); location.href='edit-profile.html#email'; });
  if(eOv) eOv.addEventListener('click', function(e){ if(e.target===eOv) closeEmail(); });

  // ── Password modal + eye + live match ──
  var pwOv=document.getElementById('pwOverlay');
  function openPw(){ pwOv.classList.add('open'); }
  function closePw(){ pwOv.classList.remove('open'); }
  document.getElementById('passwordRow').addEventListener('click', openPw);
  document.getElementById('pwClose').addEventListener('click', closePw);
  document.getElementById('pwCancel').addEventListener('click', closePw);
  if(pwOv) pwOv.addEventListener('click', function(e){ if(e.target===pwOv) closePw(); });
  document.querySelectorAll('.pw-eye').forEach(function(btn){
    btn.addEventListener('click',function(){
      var input=document.getElementById(btn.dataset.target);
      var isPw=input.type==='password';
      input.type=isPw?'text':'password';
      btn.querySelector('i').className=isPw?'far fa-eye-slash':'far fa-eye';
    });
  });
  (function(){
    var newPw=document.getElementById('pwNew');
    var confirmPw=document.getElementById('pwConfirm');
    var hint=document.getElementById('pwMatch');
    function check(){
      var a=newPw.value, b=confirmPw.value;
      if(!b){ hint.style.display='none'; confirmPw.style.borderColor=''; return; }
      var match=a===b;
      hint.style.display='block';
      hint.textContent=match?'✓ Passwords match':'✗ Passwords do not match';
      hint.style.color=match?'#16a34a':'#e0384d';
      confirmPw.style.borderColor=match?'#16a34a':'#e0384d';
    }
    newPw.addEventListener('input',check);
    confirmPw.addEventListener('input',check);
  })();
  document.getElementById('pwSave').addEventListener('click',function(){
    var cur=document.getElementById('pwCurrent').value, nw=document.getElementById('pwNew').value, cf=document.getElementById('pwConfirm').value;
    if(!cur||!nw||!cf){ toast('Fill all fields'); return; }
    if(nw!==cf){ toast('Passwords do not match'); return; }
    toast('Password updated (demo)');
    document.getElementById('pwCurrent').value='';document.getElementById('pwNew').value='';document.getElementById('pwConfirm').value='';
    var hint=document.getElementById('pwMatch'); if(hint) hint.style.display='none';
    document.getElementById('pwConfirm').style.borderColor='';
    closePw();
  });

  // ── Logout (confirm → demo logout → redirect) ──
  var loOv=document.getElementById('logoutOverlay');
  function openLogout(){ loOv.classList.add('open'); }
  function closeLogout(){ loOv.classList.remove('open'); }
  var loRow=document.getElementById('logoutRow');
  if(loRow) loRow.addEventListener('click', openLogout);
  document.getElementById('logoutClose').addEventListener('click', closeLogout);
  document.getElementById('logoutCancel').addEventListener('click', closeLogout);
  if(loOv) loOv.addEventListener('click', function(e){ if(e.target===loOv) closeLogout(); });
  document.getElementById('logoutConfirm').addEventListener('click', async function(){
    try{ if(global.AuthSession && AuthSession.logout) await AuthSession.logout(); }catch(e){}
    try{ localStorage.removeItem('droboard_session'); }catch(e){}
    toast('Logged out');
    setTimeout(function(){
      // demo: back to feed/index
      location.href='../Pages/index.html';
    }, 600);
  });
}

global.SettingsPage={ init:init, setTheme:setTheme, getTheme:getTheme, toast:toast };

})(window);
