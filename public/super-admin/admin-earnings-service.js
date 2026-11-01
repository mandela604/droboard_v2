/**
 * admin-earnings-service.js — Admin-only earnings dashboard (platform tips, marketing pool)
 * Demo fallback: renders local demo balances + coin records; set USE_API=true to wire live.
 */
(function(){
'use strict';
if(window.__adminEarningsService) return; window.__adminEarningsService = true;

const USE_API = false;
const API_BASE = '/api/super-admin/earnings';

/* ── Demo pools & transactions ── */
var POOLS = [
  { id:'platform', label:'Platform Reserve', balance:12580000, recomputedAt:new Date().toISOString() },
  { id:'marketing', label:'Marketing Pool', balance:3450000, recomputedAt:new Date().toISOString() },
];
/* Droboard tip records (local storage key) */
var TIP_RECORDS_KEY = 'dro_platform_tips';
function readTips(){ try{ var r=JSON.parse(localStorage.getItem(TIP_RECORDS_KEY)||'[]'); if(!Array.isArray(r))r=[]; return r.map(function(t){ return t.giftCode?{...t,kind:'gift'}:{...t,kind:'tip'}; }); }catch(e){ return []; } }

/* Rich demo data generator - creates realistic tip records */
function generateDemoData(){
  var demos = [];
  var users = ['Ada_Writes','Ifeanyi_Story','Zara_M','Chiamaka_N','Dami_Cole','Yusuf_Howl','Tunde_Books','Kemi_A','Bola_Reads','Femi_Tales'];
  var kinds = ['tip','gift'];
  var now = Date.now();
  for(var i=0;i<50;i++){
    var daysAgo = Math.floor(Math.random()*60);
    var date = new Date(now - daysAgo*86400000);
    date.setHours(9+Math.floor(Math.random()*12), Math.floor(Math.random()*60), 0);
    var user = users[Math.floor(Math.random()*users.length)];
    var kind = kinds[Math.floor(Math.random()*kinds.length)];
    var coins = Math.floor(Math.random()*500)+50;
    demos.push({
      at:date.toISOString(),
      userId:user,
      handle:user,
      kind:kind,
      coins:coins,
      note:'Platform tip'
    });
  }
  return demos.sort(function(a,b){ return new Date(b.at)-new Date(a.at); });
}

/* Initialize demo data if localStorage empty */
if(localStorage.getItem(TIP_RECORDS_KEY)==='null'||!localStorage.getItem(TIP_RECORDS_KEY)){
  try{ localStorage.setItem(TIP_RECORDS_KEY,JSON.stringify(generateDemoData())); }catch(e){}
}

var filters = { view:'all', page:1, pageSize:10 };
var filteredTips = [];

/* ── UI renderers ── */
function fmtNaira(n){ if(typeof window.DroboardCurrency!=='undefined'&&window.DroboardCurrency.ngnToMoney) return window.DroboardCurrency.ngnToMoney(n); return '₦'+fmtNum(n); }
function fmtNum(n){ n=Number(n||0); return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+'K':String(Math.round(n)); }
function isoDate(dt){ var d=new Date(dt); return d.toISOString().slice(0,10); }
function todayLabel(){ var d=new Date(); var y=d.getFullYear(); var m=('0'+(d.getMonth()+1)).slice(-2); var dd=('0'+d.getDate()).slice(-2); return y+'-'+m+'-'+dd; }

/* Color maps for figures */
var BG_MAP={ tip:'rgba(22,163,74,.1)', gift:'rgba(255,0,80,.1)' };

function renderCards(){
  var els=document.getElementById('cardsGrid'); if(!els) return;
  els.innerHTML=POOLS.map(function(p){
    return '<div class="card"><div class="ico-row"><i class="fas fa-crown" style="color:var(--accent)"></i><span style="font-size:11.5px;font-weight:700">'+esc(p.label)+'</span></div><div class="card-num" style="color:var(--green);font-size:24px">'+fmtNaira(p.balance)+'</div><div class="card-lbl">Recomputed: '+esc(isoDate(p.recomputedAt))+'</div></div>';
  }).join('');
}

const opts=[{val:'all',lbl:'All'}, {val:'tip',lbl:'Coins'}, {val:'gift',lbl:'Gifts'}];

function renderFilters(){
  var bar=document.getElementById('tipFilterBar'); if(!bar) return;
  var total=filteredTips.length;
  var count=' ('+total+')';
  bar.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:10px;display:block">Platform Tips <span id="totalCount">'+count+'</span></div>'+(opts.map(function(o){ var on=filters.view===o.val?'on':''; return '<button class="chip'+on+'" data-v="'+o.val+'">'+o.lbl+'</button>'; }).join(''));
  bar.addEventListener('click', function(e){ var btn=e.target.closest('button[data-v]'); if(!btn) return; filters.page=1; filters.view=btn.dataset.v; bar.querySelectorAll('.chip').forEach(function(c){ c.classList.toggle('on', c===btn); }); renderFilters(); renderTable(); renderPagination(); });
}

function totalPages(){ return Math.ceil(filteredTips.length / filters.pageSize); }
function pageRange(){ var start=(filters.page-1)*filters.pageSize+1; var end=Math.min(filters.page*filters.pageSize, filteredTips.length); return {start:start, end:end, total:filteredTips.length}; }

function tipsForView(){ var tips=readTips().sort(function(a,b){ return new Date(b.at) - new Date(a.at); }); if(filters.view==='all') return tips; return tips.filter(function(t){ return t.kind===filters.view; }); }

function renderTable(){
  filteredTips=tipsForView();
  var body=document.getElementById('tipTableBody'); if(!body) return;
  var range=pageRange();
  var pageTips=filteredTips.slice((filters.page-1)*filters.pageSize, filters.page*filters.pageSize);
  
  if(pageTips.length===0){
    body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:40px;">No records in this slice</td></tr>';
    return;
  }
  
  body.innerHTML=pageTips.map(function(t,i){
    var giftIcon=t.kind==='gift'?'<i class="fas fa-gift" style="font-size:9px;margin-right:4px;color:#ec4899"></i>':'';
    var coinVal=(t.coins||0);
    var amountClass=t.kind==='gift'?'badge.pink':'badge.green';
    return '<tr style="background:'+BG_MAP[t.kind]+'"><td><div style="font-size:11px;color:var(--text-muted);font-weight:600">'+isoDate(t.at)+'</div></td>'+
      '<td><div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;border-radius:50%;background:'+BG_MAP[t.kind]+';border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--'+(t.kind==='gift'?'pink':'green')+');">'+t.kind.charAt(0).toUpperCase()+'</div><b style="font-size:12px">'+esc(t.handle||t.userId||'unknown')+'</b></div></td>'+
      '<td>'+giftIcon+'<span class="badge '+amountClass+'">'+esc(t.kind.charAt(0).toUpperCase()+t.kind.slice(1))+'</span></td>'+
      '<td style="color:var(--green);font-weight:700;font-size:13px"><i class="fas fa-coins" style="font-size:9px;margin-right:4px"></i>'+coinVal+' coins</td>'+
      '<td><span class="badge badge.green">Completed</span></td></tr>';
  }).join('');
}

function renderPagination(){
  var pager=document.getElementById('paginationControls'); if(!pager) return;
  var total=filteredTips.length; var pages=totalPages();
  if(pages<=1){ pager.innerHTML=''; return; }
  var range=pageRange();
  var prevBtn=filters.page>1?'':'disabled';
  var nextBtn=filters.page<pages?'':'disabled';
  var pageNumbers='';
  for(var p=1;p<=pages&&p<=5;p++){ var on=filters.page===p?' on':' '; pageNumbers+='<button class="page-btn'+on+'" data-p="'+p+'">'+p+'</button>'; }
  pager.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">'+
    '<div style="font-size:11px;color:var(--text-muted);font-weight:600">Showing '+range.start+'-'+range.end+' of '+total+' records</div>'+
    '<div style="display:flex;gap:4px">'+
      '<button class="mini-btn "'+prevBtn+'" onclick="goPrevPage()" '+prevBtn+'><i class="fas fa-chevron-left"></i> Prev</button>'+
      pageNumbers+
      '<button class="mini-btn "'+nextBtn+'" onclick="goNextPage()" '+nextBtn+'> Next <i class="fas fa-chevron-right"></i></button>'+
    '</div>';
  pager.addEventListener('click', function(e){ var btn=e.target.closest('.page-btn[data-p]'); if(!btn) return; filters.page=parseInt(btn.dataset.p); renderTable(); renderPagination(); });
}

function goPrevPage(){ if(filters.page>1){ filters.page--; renderTable(); renderPagination(); } }
function goNextPage(){ if(filters.page<totalPages()){ filters.page++; renderTable(); renderPagination(); } }

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg){ var h=document.getElementById('toastHost'); if(!h) return; var t=document.createElement('div'); t.className='toast show'; t.textContent=msg; h.appendChild(t); setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ h.removeChild(t); },250); },2400); }

/* ── Payout panel (demo) ── */
function openModal(id){ document.getElementById('modal-'+id).classList.add('show'); }
function closeModal(id){ document.getElementById('modal-'+id).classList.remove('show'); }
function payoutPanel(){ document.getElementById('payoutAmount').value=Math.floor((POOLS[0].balance||0)/1e6)*1e6; updatePayoutSummary(); openModal('payoutModal'); }
function updatePayoutSummary(){ var amt=parseFloat(document.getElementById('payoutAmount').value||0); var pct=parseFloat(document.getElementById('payoutFeePct').value||0); var net=amt*(1 - (pct/100)); var el=document.getElementById('payoutSummary'); if(!el) return; el.innerHTML='<div class="row"><span>Total amount</span><b>'+fmtNaira(amt)+'</b></div><div class="row"><span>Network fee</span><b>'+pct+'%</b></div><div class="row"><span>Net paid to bank</span><b>'+fmtNaira(net)+'</b></div>'; }
document.getElementById('payoutCancelBtn')?.addEventListener('click', function(){ closeModal('payoutModal'); });
document.getElementById('payoutSubmitBtn')?.addEventListener('click', function(){ toast('Demo: platform payout request logged'); closeModal('payoutModal'); });
document.getElementById('payoutAmount')?.addEventListener('input', updatePayoutSummary);
document.getElementById('payoutFeePct')?.addEventListener('input', updatePayoutSummary);

/* ── Hooks + init ── */
window.AdminEarningsService={ payoutPanel:function(){ payoutPanel(); } };
SuperAdminSidebar.attach('#dashRoot',{ activeItem:'admin-earnings', title:'Admin Earnings', subtitle:'Platform split + Droboard tips visibility (hidden from Finance)', user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'}, notifCount:9, hideSearch:true });
renderCards(); renderFilters(); renderTable();

// Seed demo tips if empty
try{ var tips=JSON.parse(localStorage.getItem('dro_platform_tips')||'[]'); if(!tips || !tips.length){ localStorage.setItem('dro_platform_tips', JSON.stringify([{ userId:'usr_1', handle:'Ada_Writes', coins:500, kind:'tip', at:new Date(Date.now()-7200000).toISOString() }, { userId:'usr_2', handle:'Ifeanyi_Story', coins:1500, kind:'gift', giftCode:'gift-rose', at:new Date(Date.now()-3600000).toISOString() }, { userId:'usr_3', handle:'Zara_M', coins:250, kind:'tip', at:new Date(Date.now()-1800000).toISOString() }])); setTimeout(function(){ location.reload(); }, 100); } }catch(e){}

})();
// Modal defined in admin-earnings.html