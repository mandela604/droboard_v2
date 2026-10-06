/**
 * featured-banners-service.js — Page UI layer for Featured & Banners page
 * Pure call-and-render: HTML loads this service, then calls init().
 * Backend-ready: set USE_API=true and implement callBackend when API exists.
 */
(function(){
'use strict';
if(window.FeaturedBannersService && window.FeaturedBannersService.__ready) return;

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, opts){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, opts||{});
  if(!res.ok) throw new Error('backend ' + res.status);
  return res.json();
}

var _initDone = false;

function toast(m){
  if(typeof window.toast === 'function' && window.toast !== toast){
    try{ window.toast(m); return; }catch(e){}
  }
  var t = document.getElementById('toastEl');
  if(!t){
    t = document.createElement('div');
    t.id = 'toastEl';
    t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:10px 18px;border-radius:28px;font-size:12.5px;font-weight:700;z-index:900;opacity:0;transition:.28s;pointer-events:none;white-space:nowrap;max-width:88vw;text-align:center;';
    document.body.appendChild(t);
  }
  t.textContent = m; t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.style.opacity = '0'; }, 2400);
}

var BANNERS=[
  {id:'bnr-1',emoji:'🔥',grad:'linear-gradient(135deg,#ff0050,#cc0040)',title:'Summer Reading Sale',sub:'40% off selected titles',position:'Home Hero',dates:'Jun 1 - Jun 30, 2026',views:'12.4K',clicks:'486',ctr:'3.9%'},
  {id:'bnr-2',emoji:'🏆',grad:'linear-gradient(135deg,#2d2154,#5b4bcf)',title:'Author Spotlight',sub:'Featured Author: Amara Okafor',position:'Sidebar',dates:'Jun 15 - Jul 15, 2026',views:'8.2K',clicks:'215',ctr:'2.6%'},
  {id:'bnr-3',emoji:'📚',grad:'linear-gradient(135deg,#1f3a63,#2f7de1)',title:'New Release: Bound by the Alpha',sub:'By Luna Skye - Read now',position:'Home Hero',dates:'Jun 14 - Jul 14, 2026',views:'6.8K',clicks:'178',ctr:'2.6%'},
  {id:'bnr-4',emoji:'✍️',grad:'linear-gradient(135deg,#0f5132,#16a34a)',title:'Writing Contest 2026',sub:'Win prizes up to $5,000',position:'Pop-up',dates:'Jun 10 - Jul 10, 2026',views:'24.8K',clicks:'1,203',ctr:'4.8%'}
];
var STATS=[
  {num:'14',lbl:'Active Banners',ico:'fa-images',cls:'purple',delta:'+2 from last month'},
  {num:'5',lbl:'Scheduled',ico:'fa-calendar-check',cls:'green',delta:'+3 scheduled'},
  {num:'68.2K',lbl:'Total Impressions',ico:'fa-eye',cls:'amber',delta:'+24% from last month'},
  {num:'2,182',lbl:'Total Clicks',ico:'fa-mouse-pointer',cls:'blue',delta:'3.2% CTR'}
];

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function loadData(){
  var backend = await callBackend('/featured-banners');
  if(backend){
    if(Array.isArray(backend.banners)) BANNERS = backend.banners;
    if(Array.isArray(backend.stats)) STATS = backend.stats;
  }
}

function renderStats(){
  var el = document.getElementById('statsGrid');
  if(!el) return;
  el.innerHTML = STATS.map(function(s){
    return '<div class="stat-card"><div class="stat-top"><div class="stat-ico '+esc(s.cls)+'"><i class="fas '+esc(s.ico)+'"></i></div><span class="stat-delta">'+esc(s.delta)+'</span></div><div class="stat-num">'+esc(s.num)+'</div><div class="stat-lbl">'+esc(s.lbl)+'</div></div>';
  }).join('');
}

function renderBanners(){
  var el = document.getElementById('bannersGrid');
  if(!el) return;
  if(!BANNERS.length){ el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:28px">No banners yet.</div>'; return; }
  el.innerHTML = BANNERS.map(function(b){
    return '<div class="banner-card"><div class="banner-preview" style="background:'+esc(b.grad)+'"><span>'+esc(b.emoji)+'</span><div class="banner-overlay"><div class="title">'+esc(b.title)+'</div><div class="sub">'+esc(b.sub)+'</div></div></div><div class="banner-body"><div class="banner-meta"><span class="position">Position: '+esc(b.position)+'</span><span class="date">'+esc(b.dates)+'</span></div><div class="banner-stats"><div><b>'+esc(b.views)+'</b><span>Views</span></div><div><b>'+esc(b.clicks)+'</b><span>Clicks</span></div><div><b>'+esc(b.ctr)+'</b><span>CTR</span></div></div><div class="banner-actions"><button onclick="FeaturedBannersService.editBanner(\''+esc(b.id)+'\')">Edit</button><button onclick="FeaturedBannersService.pauseBanner(\''+esc(b.id)+'\')">Pause</button><button onclick="FeaturedBannersService.openAnalytics(\''+esc(b.id)+'\')">Analytics</button></div></div></div>';
  }).join('');
}

function createBanner(){ return callBackend('/featured-banners', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(function(r){ if(!r) toast('Creating new banner…'); }); }
function editBanner(id){ return callBackend('/featured-banners/' + encodeURIComponent(id)).then(function(r){ if(!r) toast('Editing banner…'); }); }
function pauseBanner(id){ return callBackend('/featured-banners/' + encodeURIComponent(id) + '/pause', { method:'POST' }).then(function(r){ if(!r) toast('Pausing banner…'); }); }
function openAnalytics(id){ return callBackend('/featured-banners/' + encodeURIComponent(id) + '/analytics').then(function(r){ if(!r) toast('Banner analytics…'); }); }

function init(){
  if(_initDone) return;
  _initDone = true;
  SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'featured-banners',title:'Featured & Banners',subtitle:'Manage promotional banners and featured content placements',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,hideSearch:true});
  // markup uses onclick="toast(...)" — expose globally
  if(typeof window.toast !== 'function') window.toast = toast;
  else {
    // keep sidebar toast if present; ensure our fallback is available as well
    try{ window.toast = window.toast; }catch(e){}
  }
  // ensure onclick toast resolves even if sidebar did not define it
  if(typeof window.toast !== 'function') window.toast = toast;
  loadData().then(function(){ renderStats(); renderBanners(); });
}

window.FeaturedBannersService = { init: init, createBanner: createBanner, editBanner: editBanner, pauseBanner: pauseBanner, openAnalytics: openAnalytics, __ready: true };
// re-expose global the markup needs
if(typeof window.toast !== 'function') window.toast = toast;

})();
