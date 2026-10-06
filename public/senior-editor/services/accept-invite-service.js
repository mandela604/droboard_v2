/**
 * accept-invite-service.js — Accept Invite (standalone auth page, no sidebar) logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = false;
const API_BASE = '/api/auth';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[AcceptInviteService] backend unavailable, using demo data', e);
    return null;
  }
}

var _initialized = false;

function showError(){
  document.getElementById('setupForm').style.display='none';
  document.getElementById('authInfo').style.display='none';
  document.getElementById('authWelcome').style.display='none';
  document.getElementById('authError').style.display='block';
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
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/invite/validate?token=' + encodeURIComponent(token));
  callBackend('/invite/validate');

  var params=new URLSearchParams(window.location.search);
  var token=params.get('token');

  if(!token){showError();bindPasswordStrength();return}

  ChiefEditorData.getByInviteToken(token).then(function(editor){
    if(!editor){showError();return}
    document.getElementById('authInfo').style.display='flex';
    document.getElementById('authAvatar').src=editor.avatar;
    document.getElementById('authName').textContent=editor.name;
    document.getElementById('authEmail').textContent=editor.email;
    document.getElementById('setupName').value=editor.name;
    document.getElementById('setupEmail').value=editor.email;

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

      ChiefEditorData.acceptInvite(token,pw).then(function(result){
        if(!result){showError();return}
        localStorage.setItem('droboard-user',JSON.stringify({
          id:result.id,name:name,email:result.email,avatar:result.avatar,
          role:'Senior Editor',dashboard:'senior-editor'
        }));
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
      });
    });
  });

  bindPasswordStrength();
}

window.AcceptInviteService={init:init};

})();
