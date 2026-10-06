/**
 * signup-service.js — Page logic for signup.html (call-and-render)
 * HTML is markup only; all logic lives here and runs on script load.
 * Backend-ready: keeps AUTH_CONFIG (/api/auth/* endpoints) AS IS; demo
 * fallbacks stay until backend is live. USE_API/API_BASE reserved for live swap.
 */
(function(){
'use strict';

const USE_API = false;
const API_BASE = '/api';

const LS_CODE='se_referral_code_SE-01', LS_AUTHORS='se_referred_authors_SE-01', SE_NAME='Chioma Reddy';
// ── Backend-ready auth ──
const AUTH_CONFIG = {
  API_BASE: (function(){ try{ return localStorage.getItem('droboard_api_base') || ''; }catch(e){ return ''; } })(),
  ENDPOINTS: { GOOGLE_URL: '/api/auth/google/url', GOOGLE_CALLBACK: '/api/auth/google/callback', SIGNUP: '/api/auth/signup' }
};
function apiUrl(p){ return (AUTH_CONFIG.API_BASE || '') + p; }
function setLoading(btn, on){
  if(!btn) return;
  if(on){ if(!btn.dataset.orig) btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…'; }
  else{ btn.disabled = false; if(btn.dataset.orig){ btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; } }
}
const COUNTRIES=['Nigeria','Ghana','Kenya','South Africa','United States','United Kingdom','Canada','India','Philippines','Brazil','Germany','France','Australia'];
(function(){
  const sel=document.getElementById('countryInput');
  COUNTRIES.forEach(function(c){
    const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o);
  });
  // auto-detect country via IP
  fetch('https://ipapi.co/json/').then(function(r){return r.json()}).then(function(j){
    if(j && j.country_name && COUNTRIES.indexOf(j.country_name)!==-1){ sel.value=j.country_name; document.getElementById('countryHint').textContent='Detected: '+j.country_name+'.'; }
  }).catch(function(){});
})();

function getReferralCode(){ return localStorage.getItem(LS_CODE)||''; }
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show')},2200); }
function prefillFromUrl(){
  const p=new URLSearchParams(location.search);
  let code=(p.get('ref')||p.get('code')||'').trim().toUpperCase();
  if(code) try{ localStorage.setItem('dro_pending_ref',code);}catch(e){}
  else try{ code=localStorage.getItem('dro_pending_ref')||'';}catch(e){}
  if(code){ const inp=document.getElementById('refInput'); if(inp){ inp.value=code; inp.classList.add('prefilled'); } const b=document.getElementById('referralBanner'); if(b){ document.getElementById('referralByCode').textContent=code; b.classList.add('show'); } }
}
prefillFromUrl();
document.getElementById('refInput').addEventListener('input',function(){
  const v=this.value.trim().toUpperCase(), b=document.getElementById('referralBanner');
  if(v && v.startsWith('SE-') && v.length>=6){ document.getElementById('referralByCode').textContent=v; b.classList.add('show'); } else if(!v){ b.classList.remove('show'); }
});
// username live validation
(function(){
  const u=document.getElementById('usernameInput'), hint=document.getElementById('usernameHint');
  const re=/^[a-z][a-z0-9_]{2,19}$/;
  u.addEventListener('input',function(){
    const v=u.value.trim().toLowerCase();
    if(!v){ hint.style.display='none'; u.style.borderColor=''; return; }
    const ok=re.test(v);
    hint.style.display='block';
    hint.textContent=ok?'✓ Username available':'✗ 3-20 chars, start with letter, a-z 0-9 _ only';
    hint.className='hint '+(ok?'ok':'bad'); hint.style.color=ok?'#16a34a':'#dc2626';
    u.style.borderColor=ok?'#16a34a':'#dc2626';
  });
})();
// eye + live match
document.querySelectorAll('.pw-eye').forEach(function(btn){
  btn.addEventListener('click',function(){
    const inp=document.getElementById(btn.dataset.target);
    const isPw=inp.type==='password'; inp.type=isPw?'text':'password';
    btn.querySelector('i').className=isPw?'far fa-eye-slash':'far fa-eye';
  });
});
(function(){
  const a=document.getElementById('passInput'), b=document.getElementById('confirmInput'), hint=document.getElementById('pwMatch');
  function check(){
    if(!b.value){ hint.style.display='none'; b.style.borderColor=''; return; }
    const ok=a.value===b.value;
    hint.style.display='block'; hint.textContent=ok?'✓ Passwords match':'✗ Passwords do not match';
    hint.className='pw-match '+(ok?'ok':'bad'); hint.style.display='block';
    b.style.borderColor=ok?'#16a34a':'#dc2626';
  }
  a.addEventListener('input',check); b.addEventListener('input',check);
})();

// Google sign-up (backend-ready OAuth + demo fallback)
(function handleOAuthCallback(){
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  if(!code) return;
  const btn = document.getElementById('googleBtn');
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.GOOGLE_CALLBACK), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, mode:'signup' }) })
    .then(function(r){ if(!r.ok) throw new Error('backend'); return r.json(); })
    .then(function(j){
      if(j && (j.name || (j.user && j.user.name))){ document.getElementById('nameInput').value = j.name || j.user.name; }
      if(j && (j.email || (j.user && j.user.email))){ document.getElementById('emailInput').value = j.email || j.user.email; }
      try{ if(j.token) localStorage.setItem('droboard_session', j.token); }catch(e){}
      toast('Google account connected — fill the rest and create account');
    })
    .catch(function(){ toast('Google connected (demo) — fill the rest'); })
    .finally(function(){ setLoading(btn, false); });
})();
document.getElementById('googleBtn').addEventListener('click',function(){
  const btn = this;
  setLoading(btn, true);
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.GOOGLE_URL + '?mode=signup'))
    .then(function(r){ if(!r.ok) throw new Error('no-backend'); return r.json(); })
    .then(function(j){ if(j && j.authUrl){ location.href = j.authUrl; return; } throw new Error('no-url'); })
    .catch(function(){
      setTimeout(function(){
        const name='Adaeze Cole', email='adaeze@example.com';
        document.getElementById('nameInput').value=name; document.getElementById('emailInput').value=email;
        toast('Google account connected — fill the rest and create account (demo)');
        setLoading(btn, false);
      },600);
    });
});

document.getElementById('signupBtn').addEventListener('click',function(){
  const btn = this;
  const name=document.getElementById('nameInput').value.trim();
  const username=document.getElementById('usernameInput').value.trim().toLowerCase();
  const email=document.getElementById('emailInput').value.trim();
  const country=document.getElementById('countryInput').value;
  const pass=document.getElementById('passInput').value;
  const confirm=document.getElementById('confirmInput').value;
  const refCode=document.getElementById('refInput').value.trim().toUpperCase();
  if(!name||!username||!email||!pass||!confirm){ toast('Fill name, username, email, password and confirm'); return; }
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(username)){ toast('Invalid username — 3-20 chars, start with letter'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Enter a valid email'); return; }
  if(pass.length<6){ toast('Password must be at least 6 characters'); return; }
  if(pass!==confirm){ toast('Passwords do not match'); return; }
  setLoading(btn, true);
  const payload = { name, username, email, country: country||null, password: pass, referralCode: refCode||null };
  function finishDemo(serverUser){
    const seCode=getReferralCode();
    const isReferred = refCode && seCode && refCode===seCode;
    let assignedSE=null;
    if(isReferred) assignedSE={id:'SE-01', name:SE_NAME, code:seCode};
    else if(refCode && seCode && refCode!==seCode) toast('Code not found — signing up without referral');

    const newWriter={ id:(serverUser && serverUser.id) || ('WR-'+Date.now()), name:name, username:username, email:email, country:country||null, avatar:(serverUser && serverUser.avatar) || ('https://i.pravatar.cc/100?img='+(Math.floor(Math.random()*70)+1)), code:refCode||'', signedUp:new Date().toISOString(), status:'active', seniorEditorId:assignedSE?assignedSE.id:null, seniorEditorName:assignedSE?assignedSE.name:null, viaGoogle:false };
    if(serverUser && serverUser.token){ try{ localStorage.setItem('droboard_session', serverUser.token); }catch(e){} }
    if(assignedSE){
      let list=[]; try{ list=JSON.parse(localStorage.getItem(LS_AUTHORS)||'[]');}catch(e){}
      list.unshift(newWriter); try{ localStorage.setItem(LS_AUTHORS, JSON.stringify(list)); }catch(e){}
      try{ localStorage.removeItem('dro_pending_ref');}catch(e){}
      document.getElementById('successMsg').innerHTML='Assigned to Senior Editor <b>'+assignedSE.name+'</b> via <b>'+assignedSE.code+'</b> and <span style="color:#16a34a;font-weight:800">Active</span> — no approval needed.';
    } else {
      document.getElementById('successMsg').textContent='Account created — no referral, you can be assigned later.';
    }
    if(country) try{ localStorage.setItem('droboard_signup_country', country);}catch(e){}
    document.getElementById('signupCard').style.display='none';
    document.getElementById('successCard').style.display='block';
    toast(assignedSE ? 'Referred — auto-assigned!' : 'Account created');
    setLoading(btn, false);
  }
  fetch(apiUrl(AUTH_CONFIG.ENDPOINTS.SIGNUP), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(function(r){ if(!r.ok) throw new Error('demo'); return r.json(); })
    .then(function(j){ finishDemo(j.user || j); })
    .catch(function(){ finishDemo(null); });
});
(function(){ const p=new URLSearchParams(location.search); if(p.get('ref')) document.title='Sign Up — Referred ('+p.get('ref').toUpperCase()+') — Droboard'; })();

// Expose identical window globals (prior top-level names)
window.LS_CODE = LS_CODE;
window.LS_AUTHORS = LS_AUTHORS;
window.SE_NAME = SE_NAME;
window.AUTH_CONFIG = AUTH_CONFIG;
window.apiUrl = apiUrl;
window.setLoading = setLoading;
window.COUNTRIES = COUNTRIES;
window.getReferralCode = getReferralCode;
window.toast = toast;
window.prefillFromUrl = prefillFromUrl;

})();
