/**
 * login-service.js — Page logic for login.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * Live backend only: /api/auth/login, /api/auth/mfa/verify and the Google
 * OAuth exchange. There is no demo session and no fake success — every
 * failure renders the real reason, and an unreachable backend says so.
 */
(function(){
'use strict';

const API = '/api';
const SESSION_KEY = 'droboard_session';
const USER_KEY = 'droboard_user';

let mfaTicket = null;

// Post-login landing: ?next= return-to when it is a safe same-folder page,
// otherwise Discover for every role. Staff reach dashboards from the
// profile drawer (role-aware "My Dashboard" section), never forced landing.
function landingUrl(){
  try{
    var n = new URLSearchParams(location.search).get('next') || '';
    if (/^[A-Za-z0-9_-]+\.html(\?.*)?$/.test(n)) return n;
  }catch(e){}
  return 'discover.html';
}
function el(id){ return document.getElementById(id); }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}
function toast(m){ const t=el('toast'); if(!t) return; t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2600); }
function showError(msg, boxId){
  const box = el(boxId || 'formError');
  if(!box){ toast(msg); return; }
  box.textContent = msg;
  box.classList.add('show');
}
function clearError(boxId){
  const box = el(boxId || 'formError');
  if(!box) return;
  box.textContent = '';
  box.classList.remove('show');
}

function request(path, opts){
  opts = opts || {};
  opts.credentials = 'same-origin';
  try{ if(typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(15000); }catch(e){}
  return fetch(API + path, opts).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(body){
      return { ok: r.ok, status: r.status, body: body };
    });
  });
}
function postJson(path, data){
  return request(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
}

/* The backend also sets httpOnly cookies; the stored access token is what
   the rest of the app reads until every page is wired. */
function storeSession(j){
  const token = j && (j.access || j.token);
  if(!token) return false;
  try{
    localStorage.setItem(SESSION_KEY, token);
    if(j.user) localStorage.setItem(USER_KEY, JSON.stringify(j.user));
  }catch(e){ return false; }
  return true;
}
function enter(j){
  if(!storeSession(j)){ showError('We couldn’t finish signing you in. Please try again.'); return; }
  toast('Welcome back');
  setTimeout(function(){ location.href = landingUrl(); }, 350);
}

function loginMessage(status, body){
  const code = body && body.error;
  if(status === 401) return 'Incorrect email or password.';
  if(status === 403) return code === 'banned'
    ? 'This account has been banned.'
    : 'This account is suspended. Contact support if you think this is a mistake.';
  if(status === 423) return 'Too many failed attempts. Try again in 15 minutes.';
  if(status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if(status === 400) return 'Enter a valid email and password.';
  if(status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'We couldn’t sign you in. Please try again.';
}

/* ── Two-factor step ─────────────────────────────────────────────── */
function openMfa(ticket){
  mfaTicket = ticket || null;
  if(!mfaTicket){ showError('Two-factor sign-in could not start. Please log in again.'); return; }
  clearError();
  clearError('mfaError');
  el('loginForm').style.display = 'none';
  el('mfaBox').style.display = 'block';
  el('mfaInput').value = '';
  el('mfaInput').focus();
}
function closeMfa(){
  mfaTicket = null;
  el('mfaBox').style.display = 'none';
  el('loginForm').style.display = 'block';
  clearError('mfaError');
}
function verifyMfa(){
  const code = String(el('mfaInput').value || '').trim();
  if(!code){ showError('Enter your authentication code.', 'mfaError'); return; }
  if(!mfaTicket){ closeMfa(); return; }
  const btn = el('mfaBtn');
  setLoading(btn, true);
  clearError('mfaError');
  postJson('/auth/mfa/verify', { ticket: mfaTicket, code: code })
    .then(function(r){
      if(r.ok && r.body && (r.body.access || r.body.token)){ enter(r.body); return; }
      if(r.status === 401) showError('That code is incorrect or has expired. Check your app and try again.', 'mfaError');
      else if(r.status === 429) showError('Too many attempts. Wait a few minutes and try again.', 'mfaError');
      else if(r.status >= 500) showError('Something went wrong on our side. Please try again.', 'mfaError');
      else showError('We couldn’t verify that code. Please try again.', 'mfaError');
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.', 'mfaError'); })
    .finally(function(){ setLoading(btn, false); });
}

/* ── Email + password ────────────────────────────────────────────── */
function login(){
  const email = el('emailInput').value.trim();
  const pass = el('passInput').value;
  clearError();
  if(!email || !pass){ showError('Enter your email and password.'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showError('Enter a valid email address.'); return; }
  const btn = el('loginBtn');
  setLoading(btn, true);
  postJson('/auth/login', { emailOrUsername: email, password: pass })
    .then(function(r){
      if(r.ok && r.body && r.body.mfaRequired){ setLoading(btn, false); openMfa(r.body.ticket); return; }
      if(r.ok && r.body && (r.body.access || r.body.token)){ enter(r.body); return; }
      showError(loginMessage(r.status, r.body));
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); })
    .finally(function(){ setLoading(btn, false); });
}
el('loginBtn').addEventListener('click', login);
el('passInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') login(); });
el('emailInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') el('passInput').focus(); });
el('mfaBtn').addEventListener('click', verifyMfa);
el('mfaInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') verifyMfa(); });
el('mfaBack').addEventListener('click', closeMfa);

/* ── Password visibility ─────────────────────────────────────────── */
document.querySelectorAll('.pw-eye').forEach(function(btn){
  btn.addEventListener('click',function(){
    const inp = el(btn.dataset.target);
    const isPw = inp.type === 'password';
    inp.type = isPw ? 'text' : 'password';
    btn.querySelector('i').className = isPw ? 'far fa-eye-slash' : 'far fa-eye';
  });
});

/* ── Google OAuth ────────────────────────────────────────────────── */
function stripAuthParams(){
  const p = new URLSearchParams(location.search);
  ['code','error','state','scope','authuser','prompt','hd'].forEach(function(k){ p.delete(k); });
  const q = p.toString();
  try{ history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); }catch(e){}
}
function googleStart(){
  const btn = el('googleBtn');
  setLoading(btn, true);
  clearError();
  request('/auth/google/url?mode=login')
    .then(function(r){
      if(r.ok && r.body && r.body.authUrl){ location.href = r.body.authUrl; return; }
      showError(r.status === 501
        ? 'Google sign-in isn’t set up yet. Use your email and password.'
        : 'Google sign-in isn’t available right now. Use your email and password.');
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); })
    .finally(function(){ setLoading(btn, false); });
}
el('googleBtn').addEventListener('click', googleStart);

(function handleOAuthCallback(){
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  const err = p.get('error');
  if(!code && !err) return;
  if(err){ stripAuthParams(); showError('Google sign-in was cancelled.'); return; }
  stripAuthParams();
  const btn = el('googleBtn');
  setLoading(btn, true);
  postJson('/auth/google/callback', { code: code })
    .then(function(r){
      if(r.ok && r.body && r.body.mfaRequired){ openMfa(r.body.ticket); return; }
      if(r.ok && r.body && (r.body.access || r.body.token)){ enter(r.body); return; }
      showError(r.status >= 500
        ? 'Google sign-in failed on our side. Please try again.'
        : 'Google sign-in failed. Please try again.');
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); })
    .finally(function(){ setLoading(btn, false); });
})();

/* Email-verification redirect from the backend (login.html?verified=1|0). */
(function handleVerificationFlag(){
  const p = new URLSearchParams(location.search);
  if(!p.has('verified')) return;
  toast(p.get('verified') === '1' ? 'Email verified — you can log in now.' : 'That verification link is invalid or has expired.');
  p.delete('verified');
  const q = p.toString();
  try{ history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); }catch(e){}
})();

/* ── Links ───────────────────────────────────────────────────────── */
el('forgotLink').addEventListener('click',function(e){
  e.preventDefault();
  var email = el('emailInput').value.trim();
  location.href = 'forgot-password.html' + (email ? '?email=' + encodeURIComponent(email) : '');
});
var guestLink = el('guestLink');
if(guestLink) guestLink.addEventListener('click', function(e){
  e.preventDefault();
  try{
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  }catch(e){}
  toast('Browsing as a guest');
  setTimeout(function(){ location.href = landingUrl(); }, 300);
});

})();
