/**
 * signup-service.js — Page logic for signup.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * Live backend only: /api/auth/signup, the username availability check and
 * Google OAuth. Register does not return a session, so a successful signup
 * is followed by /api/auth/login with the same credentials — the visitor
 * lands with a real session, never a demo one.
 */
(function(){
'use strict';

const API = '/api';
const SESSION_KEY = 'droboard_session';
const USER_KEY = 'droboard_user';

const COUNTRIES = ['Nigeria','Ghana','Kenya','South Africa','United States','United Kingdom','Canada','India','Philippines','Brazil','Germany','France','Australia'];

function el(id){ return document.getElementById(id); }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ if(!btn.dataset.orig) btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig){ btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; } }
}
function toast(m){ const t=el('toast'); if(!t) return; t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2600); }
function showError(msg){ const box=el('formError'); if(!box){ toast(msg); return; } box.textContent=msg; box.classList.add('show'); }
function clearError(){ const box=el('formError'); if(!box) return; box.textContent=''; box.classList.remove('show'); }

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

/* ── Country select ──────────────────────────────────────────────── */
(function(){
  const sel = el('countryInput');
  COUNTRIES.forEach(function(c){
    const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
  });
  const opts = {};
  try{ if(typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(4000); }catch(e){}
  fetch('https://ipapi.co/json/', opts).then(function(r){ return r.json(); }).then(function(j){
    if(j && j.country_name && COUNTRIES.indexOf(j.country_name) !== -1){
      sel.value = j.country_name;
      el('countryHint').textContent = 'Detected: ' + j.country_name + '.';
    }
  }).catch(function(){});
})();

/* ── Referral banner ─────────────────────────────────────────────── */
// The code is validated by the backend at signup — the page only confirms
// that it will be sent, it never claims who the inviter is.
function pendingRef(){ try{ return localStorage.getItem('dro_pending_ref') || ''; }catch(e){ return ''; } }
function setPendingRef(code){ try{ if(code) localStorage.setItem('dro_pending_ref', code); else localStorage.removeItem('dro_pending_ref'); }catch(e){} }
function applyReferralBanner(code){
  const b = el('referralBanner'); if(!b) return;
  code = String(code || '').trim().toUpperCase();
  if(!code){ b.classList.remove('show'); return; }
  el('refBannerTitle').textContent = 'Referral code applied';
  el('refBannerText').textContent = 'Code';
  el('referralByCode').textContent = code;
  el('refBannerTail').textContent = 'checked when your account is created.';
  b.classList.add('show');
}
function prefillFromUrl(){
  const p = new URLSearchParams(location.search);
  let code = (p.get('ref') || p.get('code') || '').trim().toUpperCase();
  if(code) setPendingRef(code);
  else code = pendingRef();
  if(code){ const inp = el('refInput'); if(inp){ inp.value = code; inp.classList.add('prefilled'); } }
  applyReferralBanner(code);
}
prefillFromUrl();
el('refInput').addEventListener('input', function(){ applyReferralBanner(this.value.trim().toUpperCase()); });

/* ── Username availability (real check) ──────────────────────────── */
(function(){
  const u = el('usernameInput'), hint = el('usernameHint');
  const re = /^[a-z][a-z0-9_]{2,19}$/;
  let timer = null, seq = 0;
  function status(text, ok){
    hint.style.display = 'block';
    hint.textContent = text;
    hint.className = 'hint ' + (ok === true ? 'ok' : (ok === false ? 'bad' : ''));
    hint.style.color = ok === true ? '#16a34a' : (ok === false ? '#dc2626' : '#9694ac');
    u.style.borderColor = ok === true ? '#16a34a' : (ok === false ? '#dc2626' : '');
  }
  u.addEventListener('input', function(){
    const v = u.value.trim().toLowerCase();
    clearTimeout(timer);
    if(!v){ hint.style.display = 'none'; u.style.borderColor = ''; return; }
    if(!re.test(v)){ status('✗ 3-20 chars, start with a letter, a-z 0-9 _ only', false); return; }
    status('Checking…', null);
    const mine = ++seq;
    timer = setTimeout(function(){
      request('/users/check-username?username=' + encodeURIComponent(v))
        .then(function(r){
          if(mine !== seq) return;
          if(!r.ok) throw new Error('http');
          if(r.body && r.body.available) status('✓ Username available', true);
          else status('✗ That username is taken', false);
        })
        .catch(function(){ if(mine !== seq) return; status('Couldn’t check that username — we’ll verify when you submit.', null); });
    }, 350);
  });
})();

/* ── Password visibility + live match ────────────────────────────── */
document.querySelectorAll('.pw-eye').forEach(function(btn){
  btn.addEventListener('click',function(){
    const inp = el(btn.dataset.target);
    const isPw = inp.type === 'password';
    inp.type = isPw ? 'text' : 'password';
    btn.querySelector('i').className = isPw ? 'far fa-eye-slash' : 'far fa-eye';
  });
});
(function(){
  const a = el('passInput'), b = el('confirmInput'), hint = el('pwMatch');
  function check(){
    if(!b.value){ hint.style.display = 'none'; b.style.borderColor = ''; return; }
    const ok = a.value === b.value;
    hint.style.display = 'block';
    hint.textContent = ok ? '✓ Passwords match' : '✗ Passwords do not match';
    hint.className = 'pw-match ' + (ok ? 'ok' : 'bad');
    b.style.borderColor = ok ? '#16a34a' : '#dc2626';
  }
  a.addEventListener('input', check); b.addEventListener('input', check);
})();

/* ── Google sign-up ──────────────────────────────────────────────── */
function stripAuthParams(){
  const p = new URLSearchParams(location.search);
  ['code','error','state','scope','authuser','prompt','hd'].forEach(function(k){ p.delete(k); });
  const q = p.toString();
  try{ history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); }catch(e){}
}
document.getElementById('googleBtn').addEventListener('click', function(){
  const btn = this;
  setLoading(btn, true);
  clearError();
  const ref = pendingRef();
  request('/auth/google/url?mode=signup' + (ref ? '&referralCode=' + encodeURIComponent(ref) : ''))
    .then(function(r){
      if(r.ok && r.body && r.body.authUrl){ location.href = r.body.authUrl; return; }
      showError(r.status === 501
        ? 'Google sign-up isn’t set up yet. Use the form below.'
        : 'Google sign-up isn’t available right now. Use the form below.');
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); })
    .finally(function(){ setLoading(btn, false); });
});

(function handleOAuthCallback(){
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  const err = p.get('error');
  if(!code && !err) return;
  if(err){ stripAuthParams(); showError('Google sign-up was cancelled.'); return; }
  stripAuthParams();
  const btn = el('googleBtn');
  setLoading(btn, true);
  postJson('/auth/google/callback', { code: code, mode: 'signup', referralCode: pendingRef() || undefined })
    .then(function(r){
      if(r.ok && r.body && (r.body.access || r.body.token)){
        try{
          localStorage.setItem(SESSION_KEY, r.body.access || r.body.token);
          if(r.body.user) localStorage.setItem(USER_KEY, JSON.stringify(r.body.user));
        }catch(e){}
        setPendingRef('');
        try{ if(window.Acquisition && Acquisition.record) Acquisition.record('sign_up'); }catch(e){}
        showSuccess({ emailed: false }, { signedIn: true });
        setTimeout(function(){ location.href = 'discover.html'; }, 1200);
        return;
      }
      if(r.ok && r.body && r.body.mfaRequired){
        showError('This Google account uses two-factor authentication. Log in to finish signing in.');
        return;
      }
      showError(r.status >= 500
        ? 'Google sign-up failed on our side. Please try again.'
        : 'Google sign-up failed. Please try again.');
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); })
    .finally(function(){ setLoading(btn, false); });
})();

/* ── Submit ──────────────────────────────────────────────────────── */
function signupMessage(status, body){
  const code = body && body.error;
  if(status === 409 || code === 'taken') return 'That email or username is already registered. Try logging in instead.';
  if(status === 429) return 'Too many sign-ups from your network. Please try again later.';
  if(status === 400) return 'Check your details and try again.';
  if(status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'We couldn’t create your account. Please try again.';
}

function showSuccess(account, opts){
  renderSuccess(account, opts);
  el('signupCard').style.display = 'none';
  el('successCard').style.display = 'block';
  window.scrollTo(0, 0);
}
function renderSuccess(account, opts){
  const msg = el('successMsg'), primary = el('successPrimary');
  const ref = (account && account.referral) || null;
  let note = '';
  if(ref && ref.editor) note = ' You were invited by a Senior Editor, so writer access is already active.';
  else if(ref && ref.invalid) note = ' The referral code wasn’t found, so your account was created without it.';
  else if(ref && ref.inviterId) note = ' Your referral was applied.';
  let emailNote = '';
  if(account && account.emailed) emailNote = ' Check your inbox to verify your email address.';
  else if(account && account.emailError) emailNote = ' We couldn’t send the verification email right now.';
  if(opts && opts.signedIn){
    msg.textContent = 'Account created — taking you in…' + note + emailNote;
    primary.textContent = 'Start Discovering';
    primary.onclick = function(){ location.href = 'discover.html'; };
  } else {
    msg.textContent = 'Account created.' + note + emailNote + ' Log in to continue.';
    primary.textContent = 'Log in';
    primary.onclick = function(){ location.href = 'login.html'; };
  }
}

function signInAfterSignup(email, pass, account){
  postJson('/auth/login', { emailOrUsername: email, password: pass })
    .then(function(r){
      if(r.ok && r.body && (r.body.access || r.body.token)){
        try{
          localStorage.setItem(SESSION_KEY, r.body.access || r.body.token);
          localStorage.setItem(USER_KEY, JSON.stringify(r.body.user || account));
        }catch(e){}
        try{ if(window.Acquisition && Acquisition.record) Acquisition.record('sign_up'); }catch(e){}
        showSuccess(account, { signedIn: true });
        setTimeout(function(){ location.href = 'discover.html'; }, 1200);
        return;
      }
      showSuccess(account, { signedIn: false });
    })
    .catch(function(){ showSuccess(account, { signedIn: false }); })
    .finally(function(){ setLoading(el('signupBtn'), false); });
}

document.getElementById('signupBtn').addEventListener('click', function(){
  const btn = this;
  const name = el('nameInput').value.trim();
  const username = el('usernameInput').value.trim().toLowerCase();
  const email = el('emailInput').value.trim();
  const country = el('countryInput').value;
  const pass = el('passInput').value;
  const confirm = el('confirmInput').value;
  const refCode = el('refInput').value.trim().toUpperCase();
  const website = el('websiteInput') ? el('websiteInput').value : '';
  clearError();
  if(!name || !username || !email || !pass || !confirm){ showError('Fill in your name, username, email and password.'); return; }
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(username)){ showError('Choose a valid username — 3–20 characters, starting with a letter.'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showError('Enter a valid email address.'); return; }
  if(pass.length < 8){ showError('Password must be at least 8 characters.'); return; }
  if(pass !== confirm){ showError('Passwords do not match.'); return; }
  setLoading(btn, true);
  const payload = {
    name: name,
    username: username,
    email: email,
    country: country || undefined,
    password: pass,
    referralCode: refCode || undefined,
    website: website || undefined,
  };
  postJson('/auth/signup', payload)
    .then(function(r){
      if(!r.ok){ showError(signupMessage(r.status, r.body)); setLoading(btn, false); return; }
      const account = (r.body && r.body.user) || {};
      setPendingRef('');
      signInAfterSignup(email, pass, account);
    })
    .catch(function(){ showError('Can’t reach Droboard. Check your connection and try again.'); setLoading(btn, false); });
});
el('passInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') el('confirmInput').focus(); });
el('confirmInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') el('signupBtn').click(); });
el('refInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') el('signupBtn').click(); });

(function(){ const p = new URLSearchParams(location.search); if(p.get('ref')) document.title = 'Sign Up — Referred (' + p.get('ref').toUpperCase() + ') — Droboard'; })();

})();
