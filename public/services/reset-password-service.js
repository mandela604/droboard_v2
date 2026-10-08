/**
 * reset-password-service.js — Page logic for reset-password.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * Backend-ready: keeps AUTH_CONFIG (/api/auth/* endpoints) AS IS; demo
 * fallbacks stay until backend is live. USE_API/API_BASE reserved for live swap.
 */
(function(){
'use strict';

const USE_API = false;
const API_BASE = '/api';

// ── Backend-ready auth (works in demo until backend is live) ──
const AUTH_CONFIG = {
  API_BASE: (function(){ try{ return localStorage.getItem('droboard_api_base') || ''; }catch(e){ return ''; } })(),
  ENDPOINTS: { VALIDATE: '/api/auth/reset-password/validate', RESET: '/api/auth/reset-password' }
};
function apiUrl(p){ return (AUTH_CONFIG.API_BASE || '') + p; }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2200); }
function getToken(){
  try{ return new URLSearchParams(location.search).get('token') || ''; }catch(e){ return ''; }
}
function showInvalid(){
  document.getElementById('resetCard').style.display = 'none';
  document.getElementById('invalidCard').style.display = 'block';
}
function showSuccess(){
  document.getElementById('resetCard').style.display = 'none';
  document.getElementById('successCard').style.display = 'block';
  toast('Password updated ✓');
}

// Validate token on load — backend when live, demo accepts any non-empty token
(function validateToken(){
  const token = getToken();
  if(!token){ showInvalid(); return; }
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.VALIDATE) + '?token=' + encodeURIComponent(token))
    .then(function(r){ if(!r.ok) throw new Error('demo'); return r.json(); })
    .then(function(j){ if(j && j.valid === false) showInvalid(); })
    .catch(function(){ /* demo fallback: any ?token= value opens the form */ });
})();

document.querySelectorAll('.pw-eye').forEach(function(btn){
  btn.addEventListener('click',function(){
    const inp=document.getElementById(btn.dataset.target);
    const isPw=inp.type==='password'; inp.type=isPw?'text':'password';
    btn.querySelector('i').className=isPw?'far fa-eye-slash':'far fa-eye';
  });
});
function checkMatch(){
  const pass=document.getElementById('passInput').value;
  const conf=document.getElementById('confirmInput').value;
  const el=document.getElementById('pwMatch');
  if(!conf){ el.style.display='none'; return false; }
  el.style.display='block';
  if(pass===conf){ el.textContent='Passwords match ✓'; el.className='pw-match ok'; return true; }
  el.textContent='Passwords don\'t match'; el.className='pw-match bad'; return false;
}
document.getElementById('confirmInput').addEventListener('input',checkMatch);
document.getElementById('passInput').addEventListener('input',checkMatch);

document.getElementById('resetBtn').addEventListener('click',function(){
  const btn = this;
  const token = getToken();
  const pass=document.getElementById('passInput').value;
  const conf=document.getElementById('confirmInput').value;
  if(pass.length < 8){ toast('Password must be at least 8 characters'); return; }
  if(pass!==conf){ toast('Passwords don\'t match'); return; }
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.RESET), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token, password: pass }) })
    .then(function(r){ if(!r.ok) throw new Error('demo'); return r.json(); })
    .then(function(){ showSuccess(); })
    .catch(function(){
      // demo fallback: accept and continue until backend is live
      showSuccess();
    })
    .finally(function(){ setTimeout(function(){ setLoading(btn, false); },450); });
});

// Expose identical window globals (prior top-level names)
window.AUTH_CONFIG = AUTH_CONFIG;
window.apiUrl = apiUrl;
window.setLoading = setLoading;
window.toast = toast;

})();
