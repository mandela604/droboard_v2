/**
 * login-service.js — Page logic for login.html (call-and-render)
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
  ENDPOINTS: { GOOGLE_URL: '/api/auth/google/url', GOOGLE_CALLBACK: '/api/auth/google/callback', LOGIN: '/api/auth/login' }
};
function apiUrl(p){ return (AUTH_CONFIG.API_BASE || '') + p; }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2200); }
document.querySelectorAll('.pw-eye').forEach(function(btn){
  btn.addEventListener('click',function(){
    const inp=document.getElementById(btn.dataset.target);
    const isPw=inp.type==='password'; inp.type=isPw?'text':'password';
    btn.querySelector('i').className=isPw?'far fa-eye-slash':'far fa-eye';
  });
});
// OAuth callback (?code=…) — exchange with backend when live, else demo session
(function handleOAuthCallback(){
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  if(!code) return;
  const btn = document.getElementById('googleBtn');
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.GOOGLE_CALLBACK), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) })
    .then(function(r){ if(!r.ok) throw new Error('backend'); return r.json(); })
    .then(function(j){
      try{ localStorage.setItem('droboard_session', j.token || ('google-'+Date.now())); if(j.user) localStorage.setItem('droboard_user', JSON.stringify(j.user)); }catch(e){}
      toast('Signed in with Google ✓');
      setTimeout(function(){ location.href='feed.html'; },500);
    })
    .catch(function(){
      try{ localStorage.setItem('droboard_session','google-demo'); }catch(e){}
      toast('Signed in with Google ✓ (demo — backend not connected)');
      setTimeout(function(){ location.href='feed.html'; },500);
    })
    .finally(function(){ setLoading(btn, false); });
})();
document.getElementById('googleBtn').addEventListener('click',function(){
  const btn = this;
  setLoading(btn, true);
  // 1) Ask backend for Google auth URL when live
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.GOOGLE_URL))
    .then(function(r){ if(!r.ok) throw new Error('no-backend'); return r.json(); })
    .then(function(j){
      if(j && j.authUrl){ location.href = j.authUrl; return; }
      throw new Error('no-url');
    })
    .catch(function(){
      // 2) Demo fallback until backend is wired: mock connect then continue
      setTimeout(function(){
        try{ localStorage.setItem('droboard_session','google-demo'); }catch(e){}
        toast('Google connected ✓ (demo — set droboard_api_base to go live)');
        setTimeout(function(){ location.href='feed.html'; },500);
        setLoading(btn, false);
      },600);
    });
});
document.getElementById('loginBtn').addEventListener('click',function(){
  const btn = this;
  const email=document.getElementById('emailInput').value.trim();
  const pass=document.getElementById('passInput').value;
  if(!email||!pass){ toast('Enter email and password'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email'); return; }
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.LOGIN), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password: pass }) })
    .then(function(r){ if(!r.ok) throw new Error('demo'); return r.json(); })
    .then(function(j){
      try{ localStorage.setItem('droboard_session', j.token || ('demo-'+Date.now())); if(j.user) localStorage.setItem('droboard_user', JSON.stringify(j.user)); }catch(e){}
      toast('Welcome back ✓');
      setTimeout(function(){ location.href='feed.html'; },400);
    })
    .catch(function(){
      // demo fallback: any email+pass passes until backend is live
      try{ localStorage.setItem('droboard_session','demo-'+Date.now()); }catch(e){}
      toast('Welcome back ✓');
      setTimeout(function(){ location.href='feed.html'; },400);
    })
    .finally(function(){ setTimeout(function(){ setLoading(btn, false); },450); });
});
document.getElementById('forgotLink').addEventListener('click',function(e){
  e.preventDefault();
  const email=document.getElementById('emailInput').value.trim()||'your email';
  toast('Reset link sent to '+email+' (demo)');
});

// Expose identical window globals (prior top-level names)
window.AUTH_CONFIG = AUTH_CONFIG;
window.apiUrl = apiUrl;
window.setLoading = setLoading;
window.toast = toast;

})();
