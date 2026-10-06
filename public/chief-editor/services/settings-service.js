(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend error ' + res.status);
  return res.json();
}

/* ── Toast ── */
function toast(msg, icon){
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `<i class="fas ${icon||'fa-circle-check'}"></i><span>${msg}</span>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.25s'; setTimeout(()=>el.remove(),250); }, 2600);
}
window.toast = toast;

/* ── Modal helpers ── */
function openModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }

/* ══════════════════ PROFILE (read-only — editor platform account) ══════════════════ */
const USE_PROFILE_API = false;
const PROFILE_API = '/api/editor/profile';
const PROFILE_DEFAULTS = {
  name:'Adaeze Bello', email:'adaeze.bello@droboard.io', phone:'+234 802 555 0134',
  bio:'Chief Editor overseeing platform-wide editorial quality, senior editor performance, and author agreements.',
  avatar:'https://i.pravatar.cc/140?img=9',
};
async function fetchEditorProfile(){
  if (USE_PROFILE_API) {
    try {
      const res = await fetch(PROFILE_API, { credentials:'include' });
      if (!res.ok) throw new Error('profile API failed');
      return await res.json();
    } catch (e) { /* fall through to demo */ }
  }
  await new Promise(function(r){ setTimeout(r, 120); });
  return Object.assign({}, PROFILE_DEFAULTS);
}
function renderEditorProfile(p){
  document.getElementById('profileAvatarImg').src = p.avatar || PROFILE_DEFAULTS.avatar;
  document.getElementById('profileHeadName').textContent = p.name || '';
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pEmail').value = p.email || '';
  document.getElementById('pPhone').value = p.phone || '';
  document.getElementById('pBio').value = p.bio || '';
  bioCount();
}
function bioCount(){ document.getElementById('pBioCount').textContent = document.getElementById('pBio').value.length; }

/* ══════════════════ APPEARANCE ══════════════════ */
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('droboard-theme', theme);
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active', p.dataset.theme===theme));
}
window.setTheme = setTheme;

/* ══════════════════ DANGER ZONE ══════════════════ */
let pendingDanger = null;

function init(){
  const shell = ChiefEditorSidebar.attach('#dashRoot',{
    activeItem:'settings', title:'Settings', subtitle:'Manage your profile, security, and platform preferences',
    user:{name:'Adaeze Bello',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=9'}, notifCount:6,
    searchPlaceholder:'Search anything…',
  });

  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click', ()=>closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click', e=>{ if(e.target===ov) closeModal(ov.id); }));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.show').forEach(ov=>closeModal(ov.id)); });

  fetchEditorProfile().then(renderEditorProfile);

  document.querySelectorAll('.theme-pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      setTheme(p.dataset.theme);
      toast(`Switched to ${p.dataset.theme} mode`, p.dataset.theme==='dark'?'fa-moon':'fa-sun');
    });
  });
  setTheme(localStorage.getItem('droboard-theme')||'light');

  document.getElementById('logoutAllBtn').addEventListener('click', ()=>{
    pendingDanger = 'logoutAll';
    document.getElementById('confirmTitle').innerHTML = '<i class="fas fa-right-from-bracket" style="color:var(--red)"></i> Log Out All Devices';
    document.getElementById('confirmText').innerHTML = 'This will end every active session except this one. You won\'t be logged out here.';
    openModal('confirmModal');
  });

  document.getElementById('confirmActionBtn').addEventListener('click', ()=>{
    toast('Logged out of all other devices', 'fa-right-from-bracket');
    pendingDanger = null;
    closeModal('confirmModal');
  });
}

window.SettingsService = { init: init };

})();
