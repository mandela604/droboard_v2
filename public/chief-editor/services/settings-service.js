(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = true;
const API_BASE = '/api/chief';
async function callBackend(path, options){
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
const PROFILE_API = '/api/users/me';
const FALLBACK_AV = '../assets/droboard-icon.png';
async function fetchEditorProfile(){
  try {
    const res = await fetch(PROFILE_API, { credentials:'include' });
    if (res.ok) {
      const u = await res.json();
      return {
        name: u.fullName || u.name || u.username || '',
        email: u.email || '',
        phone: u.phone || '',
        bio: u.bio || '',
        avatar: u.avatar || '',
      };
    }
  } catch (e) {}
  // Session fallback — never a demo persona.
  try {
    const s = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
    return { name: s.name || '', email: '', phone: '', bio: '', avatar: s.avatar || '' };
  } catch (e) {}
  return { name: '', email: '', phone: '', bio: '', avatar: '' };
}
function renderEditorProfile(p){
  var img = document.getElementById('profileAvatarImg');
  img.src = p.avatar || FALLBACK_AV;
  img.onerror = function(){ this.onerror = null; this.src = FALLBACK_AV; };
  document.getElementById('profileHeadName').textContent = p.name || 'Editor';
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
    user:null, notifCount:6,
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
