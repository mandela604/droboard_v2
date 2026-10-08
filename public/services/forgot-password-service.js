/**
 * forgot-password-service.js — Page logic for forgot-password.html (call-and-render)
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
  ENDPOINTS: { FORGOT: '/api/auth/forgot-password' }
};
function apiUrl(p){ return (AUTH_CONFIG.API_BASE || '') + p; }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2200); }
function isEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function sendReset(email){
  const btn = document.getElementById('sendBtn');
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.FORGOT), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) })
    .then(function(r){ if(!r.ok) throw new Error('demo'); return r.json(); })
    .then(function(){
      showSuccess(email);
    })
    .catch(function(){
      // demo fallback: pretend the link was sent until backend is live
      showSuccess(email);
    })
    .finally(function(){ setTimeout(function(){ setLoading(btn, false); },450); });
}
function showSuccess(email){
  document.getElementById('forgotCard').style.display = 'none';
  document.getElementById('successCard').style.display = 'block';
  document.getElementById('successMsg').textContent = 'If an account exists for ' + email + ', a reset link is on its way. It expires in 30 minutes.';
  toast('Reset link sent ✓');
}
document.getElementById('sendBtn').addEventListener('click',function(){
  const email=document.getElementById('emailInput').value.trim();
  if(!email){ toast('Enter your email'); return; }
  if(!isEmail(email)){ toast('Enter a valid email'); return; }
  sendReset(email);
});
// Prefill when coming from login (?email=…)
try{
  const q = new URLSearchParams(location.search).get('email') || '';
  if(q) document.getElementById('emailInput').value = q;
}catch(e){}
document.getElementById('emailInput').addEventListener('keydown',function(e){ if(e.key==='Enter') document.getElementById('sendBtn').click(); });
document.getElementById('resendBtn').addEventListener('click',function(){
  const email=document.getElementById('emailInput').value.trim();
  if(email && isEmail(email)) sendReset(email);
});

// Expose identical window globals (prior top-level names)
window.AUTH_CONFIG = AUTH_CONFIG;
window.apiUrl = apiUrl;
window.setLoading = setLoading;
window.toast = toast;

})();
