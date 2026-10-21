/**
 * accept-invite-service.js — Accept Invite (standalone auth page, no sidebar).
 * PRODUCTION: backend only. No demo data, no fallbacks.
 * Flow: invite email must belong to a REGISTERED user; invites expire 72h
 * after issue (410 expired). Accept verifies the account password as proof
 * of ownership, attaches the senior_editor role, then lands on the dashboard.
 * Backend: GET/POST /api/chief/invites/by-token|accept
 */
(function () {
'use strict';

const API_BASE = '/api/chief';

async function callBackend(path, options) {
  const res = await fetch(API_BASE + path, options || {});
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    try { err.body = await res.json(); } catch (e) {}
    throw err;
  }
  return res.json();
}

var _initialized = false;

function showError(msg){
  document.getElementById('setupForm').style.display='none';
  document.getElementById('authInfo').style.display='none';
  document.getElementById('authWelcome').style.display='none';
  var box = document.getElementById('authError');
  box.style.display='block';
  if (msg) {
    var p = box.querySelector('p');
    if (p) p.textContent = msg;
  }
}

function bindPasswordStrength(){
  document.getElementById('setupPw').addEventListener('input',function(){
    var pw=this.value;
    var score=0;
    if(pw.length>=8)score++;
    if(pw.length>=12)score++;
    if(/[A-Z]/.test(pw)&&/[a-z]/.test(pw))score++;
    if(/[0-9]/.test(pw))score++;
    if(/[^A-Za-z0-9]/.test(pw))score++;
    var pct=Math.min(100,(score/5)*100);
    var fill=document.getElementById('pwFill');
    var label=document.getElementById('pwLabel');
    fill.style.width=pct+'%';
    if(!pw){fill.style.width='0%';label.innerHTML='&nbsp;';return}
    if(score<=1){fill.style.background='#e0293e';label.textContent='Weak'}
    else if(score<=3){fill.style.background='#c98a12';label.textContent='Okay'}
    else{fill.style.background='#1c9d5b';label.textContent='Strong'}
  });
}

function init(){
  if(_initialized)return;_initialized=true;

  var params=new URLSearchParams(window.location.search);
  var token=params.get('token');

  if(!token){showError('This invite link is invalid. Ask your Chief Editor for a new one.');bindPasswordStrength();return}

  callBackend('/invites/by-token/' + encodeURIComponent(token)).then(function(invite){
    document.getElementById('authInfo').style.display='flex';
    document.getElementById('authAvatar').src='https://i.pravatar.cc/100?img=5';
    document.getElementById('authName').textContent=invite.name;
    document.getElementById('authEmail').textContent=invite.email;
    document.getElementById('setupName').value=invite.name;
    document.getElementById('setupEmail').value=invite.email;

    document.getElementById('setupForm').addEventListener('submit',function(e){
      e.preventDefault();
      var name=document.getElementById('setupName').value.trim();
      var pw=document.getElementById('setupPw').value;
      var pw2=document.getElementById('setupPwConfirm').value;
      var valid=true;

      if(!name){document.getElementById('setupNameErr').style.display='block';valid=false}else{document.getElementById('setupNameErr').style.display='none'}
      if(pw.length<8){document.getElementById('setupPwErr').style.display='block';valid=false}else{document.getElementById('setupPwErr').style.display='none'}
      if(pw!==pw2){document.getElementById('setupPwConfirmErr').style.display='block';valid=false}else{document.getElementById('setupPwConfirmErr').style.display='none'}
      if(!valid)return;

      callBackend('/invites/accept', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ token:token, password:pw })
      }).then(function(result){
        try{
          // Key + shape must match what profile-menu.js reads (droboard_user,
          // roles[]) — the old 'droboard-user' hyphen key was invisible to the
          // profile drawer, so invited editors never saw their dashboard link.
          localStorage.setItem('droboard_user',JSON.stringify({
            id:result.id,name:name,email:result.email,avatar:'https://i.pravatar.cc/100?img=5',
            roles:['senior_editor','reader'],primaryRole:'senior_editor'
          }));
        }catch(se){}
        document.getElementById('setupForm').style.display='none';
        document.getElementById('authInfo').style.display='none';
        document.getElementById('authWelcome').style.display='none';
        document.getElementById('authSuccess').style.display='block';
        var cd=5;
        var iv=setInterval(function(){
          cd--;
          document.getElementById('countdown').textContent=cd;
          if(cd<=0){clearInterval(iv);window.location.href='dashboard.html'}
        },1000);
        document.getElementById('goDashBtn').addEventListener('click',function(){window.location.href='dashboard.html'});
      }).catch(function(err){
        if(err && err.status===410){showError('This invite has expired (72h). Ask your Chief Editor to resend it.');}
        else if(err && err.status===401){showError('Wrong password for ' + invite.email + '. Log in with your existing account password.');}
        else if(err && err.status===404){showError('This invite is no longer valid. Ask your Chief Editor for a new one.');}
        else{showError('Could not accept this invite. Check your connection and try again.');}
      });
    });
  }).catch(function(err){
    if(err && err.status===410){showError('This invite has expired (72h). Ask your Chief Editor to resend it.');}
    else{showError('This invite link is invalid. Ask your Chief Editor for a new one.');}
  });

  bindPasswordStrength();
}

window.AcceptInviteService={init:init};

})();
