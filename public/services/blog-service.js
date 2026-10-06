/* ===============================================================
   BLOG SERVICE
   Blog posts + niche filter + templates + localStorage progress (verbatim move from blog.html). Auto-initializes on load.
   When going live: set USE_API = true, update API_BASE.
   =============================================================== */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';


const POSTS=[
  {id:'t1', cat:'tech', title:'Best budget smartphones 2026 — full review', excerpt:'We tested 12 phones under $300 — here is the winner for battery and camera.', readTime:'4 min'},
  {id:'t2', cat:'tech', title:'AI side hustles that actually pay', excerpt:'5 tools you can use this week to earn $500/mo — step by step.', readTime:'3 min'},
  {id:'t3', cat:'tech', title:'Laptop buying guide: students vs creators', excerpt:'Avoid overpaying — specs that matter for 2026.', readTime:'3 min'},
  {id:'t4', cat:'tech', title:'How to secure your phone in 2 minutes', excerpt:'Simple settings that block 90% of scams.', readTime:'2 min'},
  {id:'t5', cat:'tech', title:'Starlink vs fiber in Nigeria — real speed test', excerpt:'Latency, cost and uptime compared.', readTime:'3 min'},
  {id:'h1', cat:'health', title:'5 morning habits that lower blood pressure', excerpt:'Doctor-backed routine — no drugs needed.', readTime:'3 min'},
  {id:'h2', cat:'health', title:'High-protein meals on a budget', excerpt:'Weekly plan under ₦15k that keeps you full.', readTime:'4 min'},
  {id:'h3', cat:'health', title:'Sleep better tonight — 7 fixes', excerpt:'Why you wake at 3am and how to stop.', readTime:'2 min'},
  {id:'h4', cat:'health', title:'Gym vs home workout — what burns more?', excerpt:'Calorie data from 500 users.', readTime:'3 min'},
  {id:'h5', cat:'health', title:'Supplements that waste your money', excerpt:'What to skip and what actually works.', readTime:'2 min'},
];

let activeNiche='tech';
const qs=new URLSearchParams(location.search);
if(qs.get('cat')) activeNiche=qs.get('cat')==='health'?'health':'tech';

const PAGES_REQUIRED=3;
function keyFor(cat){ return 'dro_blog_read_ids_'+cat; }
function getReadIds(cat){ cat=cat||activeNiche; try{ return JSON.parse(localStorage.getItem(keyFor(cat))||'[]'); }catch(e){ return []; } }
function setReadIds(a,cat){ cat=cat||activeNiche; localStorage.setItem(keyFor(cat), JSON.stringify(a)); }
function getProgress(cat){ return getReadIds(cat).length; }

function switchNiche(cat){
  activeNiche=cat;
  document.querySelectorAll('.niche-tab').forEach(b=>{
    const on=b.dataset.niche===cat;
    b.style.background=on?'var(--pink)':'var(--white)';
    b.style.color=on?'#fff':'var(--ink)';
    b.style.borderColor=on?'var(--pink)':'var(--line)';
    b.classList.toggle('active', on);
  });
  renderProgress(); renderList();
}

function renderProgress(){
  const prog=getProgress();
  const pct=Math.min(100, prog/PAGES_REQUIRED*100);
  const done=prog>=PAGES_REQUIRED;
  const label=activeNiche==='tech'?'Tech Niche — High CPM':'Health Niche — High CPM';
  document.getElementById('progressCard').innerHTML = `
    <div style="font-size:11px;font-weight:800;opacity:.8;letter-spacing:.05em">${label.toUpperCase()} — YOUR PROGRESS</div>
    <div style="font-size:18px;font-weight:800;margin-top:4px">${prog} / ${PAGES_REQUIRED} pages read</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div style="font-size:11px;margin-top:8px;opacity:.9">${done ? '🎉 Earn ready! Tap Claim to get 20 coins — ads paid for this niche' : 'Read '+ (PAGES_REQUIRED-prog) +' more '+label+' page(s) to earn 20 coins — each page = ad impression for you'}</div>
    ${done ? '<button onclick="claim()" style="margin-top:10px;background:#fff;color:var(--pink);border:none;padding:8px 14px;border-radius:10px;font-weight:800;cursor:pointer;width:100%">Claim 20 Coins</button>' : ''}
  `;
}
function claim(){
  if(window.StoreService&&StoreService.addCoins){ StoreService.addCoins(20); }
  localStorage.setItem(keyFor(activeNiche), JSON.stringify([]));
  alert('✅ +20 coins for '+activeNiche+' niche! Ad impressions counted. Check Store balance.');
  renderProgress(); renderList();
}

function renderList(){
  const read=getReadIds();
  const filtered=POSTS.filter(p=>p.cat===activeNiche);
  document.getElementById('blogList').innerHTML = filtered.map(p=>{
    const isRead=read.includes(p.id);
    return `<div class="post-card ${isRead?'read':''}" onclick="openPost('${p.id}')">
      <div class="post-title">${isRead?'✅ ':''}${p.title}</div>
      <div class="post-excerpt">${p.excerpt}</div>
      <div class="post-meta"><span><i class="fas fa-clock"></i> ${p.readTime}</span><span>·</span><span>${isRead?'Read':'Tap to read & view ad'}</span></div>
    </div>`;
  }).join('');
}

function openPost(id){
  let read=getReadIds();
  if(!read.includes(id)){
    read.push(id);
    setReadIds(read);
  }
  renderProgress(); renderList();
  setTimeout(()=> alert('📖 You read: '+ POSTS.find(x=>x.id===id).title + '\n\nAd shown — impression counted for you! Progress: '+getProgress()+'/'+PAGES_REQUIRED), 100);
}

switchNiche(activeNiche);

  /* -- window exports (verbatim-move: preserve inline onclick globals) -- */
  window.keyFor = keyFor;
  window.getReadIds = getReadIds;
  window.setReadIds = setReadIds;
  window.getProgress = getProgress;
  window.switchNiche = switchNiche;
  window.renderProgress = renderProgress;
  window.claim = claim;
  window.renderList = renderList;
  window.openPost = openPost;
  try { Object.defineProperty(window, 'POSTS', { configurable: true, enumerable: true, get: function () { return POSTS; }, set: function (val) { POSTS = val; } }); } catch (e) { try { window['POSTS'] = POSTS; } catch (_) {} }
  try { Object.defineProperty(window, 'activeNiche', { configurable: true, enumerable: true, get: function () { return activeNiche; }, set: function (val) { activeNiche = val; } }); } catch (e) { try { window['activeNiche'] = activeNiche; } catch (_) {} }
  try { Object.defineProperty(window, 'qs', { configurable: true, enumerable: true, get: function () { return qs; }, set: function (val) { qs = val; } }); } catch (e) { try { window['qs'] = qs; } catch (_) {} }
  try { Object.defineProperty(window, 'PAGES_REQUIRED', { configurable: true, enumerable: true, get: function () { return PAGES_REQUIRED; }, set: function (val) { PAGES_REQUIRED = val; } }); } catch (e) { try { window['PAGES_REQUIRED'] = PAGES_REQUIRED; } catch (_) {} }
})();
