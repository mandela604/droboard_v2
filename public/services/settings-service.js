/**
 * settings-service.js — Data + controller for Settings page
 * All logic lives here. settings.html is HTML only + SettingsPage.init().
 * Live: /api/users/me for profile, /api/users/me/settings for preferences
 * (GET/PATCH), /api/users/me/password to change the password.
 */
(function(global){
'use strict';

const API_BASE = '/api';

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

let currentSettings = {};
let currentProfile = {};

async function getProfile(){
  const res = await fetch(API_BASE + '/users/me', { credentials: 'include' });
  if (!res.ok) throw new Error('Profile API failed: ' + res.status);
  const data = await res.json();
  currentProfile = data.user || data.data || data;
  return {
    name: currentProfile.name || currentProfile.handle || '',
    handle: currentProfile.handle || '',
    email: currentProfile.email || '',
    avatar: currentProfile.avatar || ''
  };
}

async function loadSettings(){
  const res = await fetch(API_BASE + '/users/me/settings', { credentials: 'include' });
  if (!res.ok) throw new Error('Settings API failed: ' + res.status);
  const data = await res.json();
  currentSettings = data.settings || data.data || data;
  return currentSettings;
}

/* The server owns one settings row: { theme, notifications, privacy,
   readingActivity }. Unknown keys are rejected, so only real fields are
   ever sent. */
async function saveSettings(patch){
  try{
    const res = await fetch(API_BASE + '/users/me/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      let msg = 'save failed (' + res.status + ')';
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch(e){}
      return { ok: false, message: msg };
    }
    const data = await res.json().catch(function(){ return null; });
    currentSettings = Object.assign({}, currentSettings, (data && data.settings) || patch);
    return { ok: true };
  } catch(e){
    return { ok: false, message: (e && e.message) || 'network error' };
  }
}

/* Explicit load-failure state — never a silent page of defaults. */
function renderLoadError(msg){
  const content=document.querySelector('.content');
  if(!content) return;
  const el=document.createElement('div');
  el.className='load-error';
  el.style.cssText='background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:16px;font-size:12.5px;color:var(--tx-body);text-align:center';
  el.innerHTML='<b style="color:var(--tx-high)">Could not load your settings</b><br>'+msg;
  content.prepend(el);
}

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
  
  // Build profile from currentProfile (loaded via /api/users/me)
  var menuProfile = {
    name: currentProfile.name || profile.name,
    handle: currentProfile.handle || profile.handle,
    avatar: currentProfile.avatar || profile.avatar,
    isWriter: !!(currentProfile.isWriter || profile.isWriter),
    books: currentProfile.books || [],
    library: currentProfile.library || [],
    collections: currentProfile.collections || [],
    stats: currentProfile.stats || { following: 0 },
    following: []
  };
  
  // Load user's collections from API
  var joinedColls = [];
  try {
    const collRes = await fetch(API_BASE + '/collections?limit=20', { credentials: 'include' });
    if (collRes.ok) {
      const collData = await collRes.json();
      const colls = collData.collections || collData.data || [];
      const mine = colls.filter(c => c.isOwner);
      const fol = colls.filter(c => c.following && !c.isOwner);
      joinedColls = mine.concat(fol).slice(0, 8).map(c => ({ id: c.id, name: c.name || c.title, count: c.stories || 0 }));
    }
  } catch(e) {}
  
  DroboardProfileMenu.configure({
    profile: menuProfile, isOwner: true,
    boards: [], collections: joinedColls,
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

  // No account → nothing to configure. The visitor is told so instead of
  // staring at a settings page that cannot save anything.
  if(global.AuthSession && AuthSession.isGuest && AuthSession.isGuest()){
    const content=document.querySelector('.content');
    if(content){
      const href=(AuthSession.loginUrl)?AuthSession.loginUrl('settings.html'):'login.html?next=settings.html';
      content.innerHTML='<div style="text-align:center;padding:60px 20px;font-size:13px;color:var(--tx-muted)">'
        +'Sign in to manage your account settings.<br>'
        +'<a href="'+href+'" style="display:inline-block;margin-top:14px;padding:10px 22px;border-radius:22px;background:var(--acc);color:#fff;font-weight:800;text-decoration:none">Log in</a></div>';
    }
    return;
  }

  // theme options (markup carries no inline handlers): applied instantly,
  // then persisted to the account row so the choice survives devices.
  document.querySelectorAll('.theme-option').forEach(function(opt){
    opt.addEventListener('click', function(){
      const t=opt.getAttribute('data-theme');
      setTheme(t);
      saveSettings({ theme: t }).then(function(r){
        if(!r.ok) toast('Theme saved on this device only — '+r.message);
      });
    });
  });

  let profile=null, settings=null, loadErr=null;
  try {
    profile=await getProfile();
  } catch(e){ loadErr=(e&&e.message)||'profile request failed'; }
  try {
    settings=await loadSettings();
  } catch(e){ loadErr=loadErr?loadErr+' · '+((e&&e.message)||'settings request failed'):((e&&e.message)||'settings request failed'); }
  if(loadErr) renderLoadError(loadErr);

  // The server's theme wins once it has answered (same key the toggle writes).
  if(settings && settings.theme){ setTheme(settings.theme); }
  if(profile) renderProfile(profile);
  initDrawer(profile||{name:'',handle:'',email:'',avatar:''});

  document.getElementById('backBtn').addEventListener('click',function(){
    if(window.history.length>1) window.history.back();
    else window.location.href='profile.html';
  });

  // ── Visibility (server field: settings.privacy 'public'|'private') ──
  var isPublic = !settings || settings.privacy !== 'private';
  var readingOn = !settings || settings.readingActivity !== false;

  // ── Visibility ──
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
  toggleBtn.addEventListener('click', async function(){
    isPublic=!isPublic;
    const saved = await saveSettings({ privacy: isPublic ? 'public' : 'private' });
    if (saved.ok) {
      syncVis(); closeVis();
      toast('Profile is now '+(isPublic?'Public':'Private'));
    } else {
      isPublic=!isPublic;
      toast('Failed to update visibility — '+saved.message);
    }
  });

  // ── Reading activity toggle ──
  var readingToggle=document.getElementById('readingToggle');
  if(readingToggle){
    if(!readingOn) readingToggle.classList.remove('on');
    readingToggle.addEventListener('click', async function(){
      this.classList.toggle('on');
      var on=this.classList.contains('on');
      const saved = await saveSettings({ readingActivity: on });
      if (saved.ok) {
        toast(on?'Reading activity visible':'Reading activity hidden');
      } else {
        this.classList.toggle('on', !on);
        toast('Failed to update — '+saved.message);
      }
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
  document.getElementById('pwSave').addEventListener('click',async function(){
    var cur=document.getElementById('pwCurrent').value, nw=document.getElementById('pwNew').value, cf=document.getElementById('pwConfirm').value;
    if(!cur||!nw||!cf){ toast('Fill all fields'); return; }
    if(nw!==cf){ toast('Passwords do not match'); return; }
    
    try {
      const res = await fetch(API_BASE + '/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: cur, newPassword: nw })
      });
      if (!res.ok) {
        let msg='Failed to update password ('+res.status+')';
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch(e){}
        toast(msg);
        return;
      }
      toast('Password updated');
      document.getElementById('pwCurrent').value='';document.getElementById('pwNew').value='';document.getElementById('pwConfirm').value='';
      var hint=document.getElementById('pwMatch'); if(hint) hint.style.display='none';
      document.getElementById('pwConfirm').style.borderColor='';
      closePw();
    } catch(e) {
      toast('Failed to update password');
    }
  });

  // ── Logout (confirm → revoke session server-side → redirect) ──
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
    toast('Logged out');
    setTimeout(function(){
      location.href='../Pages/index.html';
    }, 600);
  });
}

global.SettingsPage={ init:init, setTheme:setTheme, getTheme:getTheme, toast:toast, getProfile:getProfile, loadSettings:loadSettings };

})(window);
