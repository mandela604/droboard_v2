/**
 * admin-earnings-service.js — Admin-only earnings dashboard (platform tips).
 * All data from live API. No demo fallback, no localStorage seeding.
 */
(function(){
'use strict';
if(window.__adminEarningsService) return; window.__adminEarningsService = true;

const API_BASE = '/api/super-admin/earnings';

var filters = { view:'all', page:1, pageSize:10 };
var allTips = [];
var filteredTips = [];
var pools = [];

function fmtNaira(n){ if(typeof window.DroboardCurrency!=='undefined'&&window.DroboardCurrency.ngnToMoney) return window.DroboardCurrency.ngnToMoney(n); return '₦'+fmtNum(n); }
function fmtNum(n){ n=Number(n||0); return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+'K':String(Math.round(n)); }
function isoDate(dt){ var d=new Date(dt); return d.toISOString().slice(0,10); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg){ var h=document.getElementById('toastHost'); if(!h) return; var t=document.createElement('div'); t.className='toast show'; t.textContent=msg; h.appendChild(t); setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ if(h.contains(t)) h.removeChild(t); },250); },2400); }

function showError(msg){
  var el = document.getElementById('tipTableBody');
  if(el) el.innerHTML='<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--red)"><i class="fas fa-circle-exclamation" style="margin-right:6px"></i>'+esc(msg)+'</td></tr>';
}

var BG_MAP={ tip:'rgba(22,163,74,.1)', gift:'rgba(255,0,80,.1)' };
const opts=[{val:'all',lbl:'All'}, {val:'tip',lbl:'Coins'}, {val:'gift',lbl:'Gifts'}];

function renderCards(){
  var els=document.getElementById('cardsGrid'); if(!els) return;
  if(!pools.length){
    els.innerHTML='<div style="color:var(--text-faint);font-size:12px;padding:16px">No pool data available.</div>';
    return;
  }
  els.innerHTML=pools.map(function(p){
    return '<div class="card"><div class="ico-row"><i class="fas fa-crown" style="color:var(--accent)"></i><span style="font-size:11.5px;font-weight:700">'+esc(p.label)+'</span></div><div class="card-num" style="color:var(--green);font-size:24px">'+fmtNaira(p.balance)+'</div><div class="card-lbl">Recomputed: '+esc(isoDate(p.recomputedAt))+'</div></div>';
  }).join('');
}

function renderFilters(){
  var bar=document.getElementById('tipFilterBar'); if(!bar) return;
  var total=filteredTips.length;
  bar.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:10px;display:block">Platform Tips <span id="totalCount">('+total+')</span></div>'+(opts.map(function(o){ var on=filters.view===o.val?'on':''; return '<button class="chip'+on+'" data-v="'+o.val+'">'+o.lbl+'</button>'; }).join(''));
  bar.addEventListener('click', function(e){ var btn=e.target.closest('button[data-v]'); if(!btn) return; filters.page=1; filters.view=btn.dataset.v; bar.querySelectorAll('.chip').forEach(function(c){ c.classList.toggle('on', c===btn); }); applyFilter(); renderTable(); renderPagination(); });
}

function totalPages(){ return Math.ceil(filteredTips.length / filters.pageSize); }

function applyFilter(){
  filteredTips = filters.view==='all' ? allTips.slice() : allTips.filter(function(t){ return t.kind===filters.view; });
  filteredTips.sort(function(a,b){ return new Date(b.at) - new Date(a.at); });
}

function renderTable(){
  var body=document.getElementById('tipTableBody'); if(!body) return;
  var pageTips=filteredTips.slice((filters.page-1)*filters.pageSize, filters.page*filters.pageSize);
  if(!pageTips.length){
    body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:40px">No records found</td></tr>';
    return;
  }
  body.innerHTML=pageTips.map(function(t){
    var giftIcon=t.kind==='gift'?'<i class="fas fa-gift" style="font-size:9px;margin-right:4px;color:#ec4899"></i>':'';
    var amountClass=t.kind==='gift'?'badge.pink':'badge.green';
    return '<tr style="background:'+BG_MAP[t.kind]+'"><td><div style="font-size:11px;color:var(--text-muted);font-weight:600">'+isoDate(t.at)+'</div></td>'+
      '<td><div style="display:flex;align-items:center;gap:8px"><b style="font-size:12px">'+esc(t.handle||t.userId||'unknown')+'</b></div></td>'+
      '<td>'+giftIcon+'<span class="badge '+amountClass+'">'+esc((t.kind||'').charAt(0).toUpperCase()+(t.kind||'').slice(1))+'</span></td>'+
      '<td style="color:var(--green);font-weight:700;font-size:13px"><i class="fas fa-coins" style="font-size:9px;margin-right:4px"></i>'+(t.coins||0)+' coins</td>'+
      '<td><span class="badge badge.green">Completed</span></td></tr>';
  }).join('');
}

function renderPagination(){
  var pager=document.getElementById('paginationControls'); if(!pager) return;
  var total=filteredTips.length; var pages=totalPages();
  if(pages<=1){ pager.innerHTML=''; return; }
  var range={start:(filters.page-1)*filters.pageSize+1, end:Math.min(filters.page*filters.pageSize, total)};
  var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">'
    +'<div style="font-size:11px;color:var(--text-muted);font-weight:600">Showing '+range.start+'–'+range.end+' of '+total+' records</div>'
    +'<div style="display:flex;gap:4px">';
  html+='<button class="mini-btn" '+(filters.page<=1?'disabled':'')+' data-pact="prev"><i class="fas fa-chevron-left"></i> Prev</button>';
  for(var p=1;p<=Math.min(pages,5);p++){ html+='<button class="page-btn'+(filters.page===p?' on':'')+'" data-p="'+p+'">'+p+'</button>'; }
  html+='<button class="mini-btn" '+(filters.page>=pages?'disabled':'')+' data-pact="next">Next <i class="fas fa-chevron-right"></i></button></div></div>';
  pager.innerHTML=html;
  pager.querySelectorAll('[data-p]').forEach(function(btn){ btn.addEventListener('click', function(){ filters.page=parseInt(btn.dataset.p); renderTable(); renderPagination(); }); });
  pager.querySelectorAll('[data-pact]').forEach(function(btn){ btn.addEventListener('click', function(){ if(btn.dataset.pact==='prev'&&filters.page>1) filters.page--; else if(btn.dataset.pact==='next'&&filters.page<pages) filters.page++; renderTable(); renderPagination(); }); });
}

function payoutPanel(){
  if(!pools.length){ toast('No pool data available'); return; }
  document.getElementById('payoutAmount').value=Math.floor((pools[0].balance||0)/1e6)*1e6;
  updatePayoutSummary();
  document.getElementById('modal-payoutModal').classList.add('show');
}
function updatePayoutSummary(){
  var amt=parseFloat(document.getElementById('payoutAmount').value||0);
  var pct=parseFloat(document.getElementById('payoutFeePct').value||0);
  var net=amt*(1-(pct/100));
  var el=document.getElementById('payoutSummary');
  if(!el) return;
  el.innerHTML='<div class="row"><span>Total amount</span><b>'+fmtNaira(amt)+'</b></div><div class="row"><span>Network fee</span><b>'+pct+'%</b></div><div class="row"><span>Net paid to bank</span><b>'+fmtNaira(net)+'</b></div>';
}
document.getElementById('payoutCancelBtn')?.addEventListener('click', function(){ document.getElementById('modal-payoutModal').classList.remove('show'); });
document.getElementById('payoutSubmitBtn')?.addEventListener('click', async function(){
  var amt = parseFloat(document.getElementById('payoutAmount').value||0);
  var pct = parseFloat(document.getElementById('payoutFeePct').value||0);
  try {
    var res = await fetch(API_BASE+'/payout', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount:amt,feePct:pct}) });
    if(!res.ok) throw new Error(res.status);
    document.getElementById('modal-payoutModal').classList.remove('show');
    toast('Payout request submitted');
    loadData();
  } catch(e) {
    toast('Failed to submit payout: '+e.message);
  }
});
document.getElementById('payoutAmount')?.addEventListener('input', updatePayoutSummary);
document.getElementById('payoutFeePct')?.addEventListener('input', updatePayoutSummary);

async function loadData(){
  try {
    var res = await fetch(API_BASE, { credentials:'include' });
    if(!res.ok) throw new Error('API error '+res.status);
    var data = await res.json();
    pools = Array.isArray(data.pools) ? data.pools : [];
    allTips = Array.isArray(data.tips) ? data.tips.map(function(t){ return t.giftCode?Object.assign({},t,{kind:'gift'}):Object.assign({},t,{kind:t.kind||'tip'}); }) : [];
    applyFilter();
    renderCards();
    renderFilters();
    renderTable();
    renderPagination();
  } catch(e) {
    showError('Failed to load earnings data: '+e.message);
    renderCards();
  }
}

window.AdminEarningsService={ payoutPanel:function(){ payoutPanel(); } };
SuperAdminSidebar.attach('#dashRoot',{ activeItem:'admin-earnings', title:'Admin Earnings', subtitle:'Platform split + Droboard tips visibility (hidden from Finance)', user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'}, notifCount:9, hideSearch:true });

loadData();
})();
