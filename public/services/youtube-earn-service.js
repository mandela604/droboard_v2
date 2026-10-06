/* ===============================================================
   YOUTUBE EARN SERVICE
   Watch-time tracking + claim + card template + local progress (verbatim move from youtube-earn.html). Auto-initializes on load.
   When going live: set USE_API = true, update API_BASE.
   =============================================================== */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';


const qs=new URLSearchParams(location.search);
const vid=qs.get('vid')||'dQw4w9WgXcQ';
const coins=parseInt(qs.get('coins')||'15',10);
const needSec=parseInt(qs.get('sec')||'60',10);
let watched=0, timer=null, claimed=false, player=null;

function onYouTubeIframeAPIReady(){
  player=new YT.Player('player',{
    videoId: vid,
    playerVars:{ playsinline:1, rel:0 },
    events:{
      onStateChange:(e)=>{
        if(e.data===YT.PlayerState.PLAYING){
          if(timer) clearInterval(timer);
          timer=setInterval(()=>{
            watched++;
            updateUI();
            if(watched>=needSec && !claimed) enableClaim();
          },1000);
        } else {
          if(timer) clearInterval(timer);
        }
      }
    }
  });
  document.getElementById('infoCard').innerHTML = `<div style="font-weight:800">Earn +${coins} coins</div><div style="font-size:12px;color:#635F6E;margin-top:4px">Watch at least ${needSec}s — keep the video playing. Progress is tracked locally.</div><div class="progress"><div class="fill" id="fill" style="width:0%"></div></div><div style="font-size:11px;color:#9A96A3;margin-top:6px" id="progressText">0s / ${needSec}s</div>`;
}

function updateUI(){
  const pct=Math.min(100, watched/needSec*100);
  const f=document.getElementById('fill'); if(f) f.style.width=pct+'%';
  const t=document.getElementById('progressText'); if(t) t.textContent=watched+'s / '+needSec+'s';
  const b=document.getElementById('claimBtn'); if(b) b.textContent = watched>=needSec ? 'Claim +'+coins+' coins' : 'Watch '+watched+'s / '+needSec+'s';
}
function enableClaim(){
  claimed=false;
  const b=document.getElementById('claimBtn');
  b.disabled=false;
  b.textContent='Claim +'+coins+' coins — YouTube verified';
  b.onclick=()=>{
    if(claimed) return; claimed=true;
    if(window.StoreService&&StoreService.addCoins){ StoreService.addCoins(coins); }
    alert('✅ +'+coins+' coins for watching! (YouTube verification via watch time)');
    location.href='store.html';
  };
  // auto hint
  updateUI();
}
// fallback if API fails
setTimeout(()=>{
  if(!player || !player.getPlayerState){
    document.getElementById('infoCard').innerHTML = `<div style="font-weight:800">Demo fallback</div><div style="font-size:12px;color:#635F6E">YouTube API blocked — simulating ${needSec}s watch. <button onclick="watched=${needSec};updateUI();enableClaim()" style="color:var(--pink);background:none;border:none;font-weight:800;cursor:pointer">Simulate watch</button></div>`;
  }
},3000);

  /* -- window exports (verbatim-move: preserve inline onclick globals) -- */
  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
  window.updateUI = updateUI;
  window.enableClaim = enableClaim;
  try { Object.defineProperty(window, 'qs', { configurable: true, enumerable: true, get: function () { return qs; }, set: function (val) { qs = val; } }); } catch (e) { try { window['qs'] = qs; } catch (_) {} }
  try { Object.defineProperty(window, 'vid', { configurable: true, enumerable: true, get: function () { return vid; }, set: function (val) { vid = val; } }); } catch (e) { try { window['vid'] = vid; } catch (_) {} }
  try { Object.defineProperty(window, 'coins', { configurable: true, enumerable: true, get: function () { return coins; }, set: function (val) { coins = val; } }); } catch (e) { try { window['coins'] = coins; } catch (_) {} }
  try { Object.defineProperty(window, 'needSec', { configurable: true, enumerable: true, get: function () { return needSec; }, set: function (val) { needSec = val; } }); } catch (e) { try { window['needSec'] = needSec; } catch (_) {} }
  try { Object.defineProperty(window, 'watched', { configurable: true, enumerable: true, get: function () { return watched; }, set: function (val) { watched = val; } }); } catch (e) { try { window['watched'] = watched; } catch (_) {} }
  try { Object.defineProperty(window, 'timer', { configurable: true, enumerable: true, get: function () { return timer; }, set: function (val) { timer = val; } }); } catch (e) { try { window['timer'] = timer; } catch (_) {} }
  try { Object.defineProperty(window, 'claimed', { configurable: true, enumerable: true, get: function () { return claimed; }, set: function (val) { claimed = val; } }); } catch (e) { try { window['claimed'] = claimed; } catch (_) {} }
  try { Object.defineProperty(window, 'player', { configurable: true, enumerable: true, get: function () { return player; }, set: function (val) { player = val; } }); } catch (e) { try { window['player'] = player; } catch (_) {} }
})();
