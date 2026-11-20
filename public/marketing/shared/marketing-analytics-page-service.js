/**
 * marketing-analytics-page-service.js — Marketing Analytics page logic.
 * Live API only, no demo figures. Real data from /api/ads/performance,
 * /api/acquisition/summary and /api/marketing/campaigns.
 */
(function(){
'use strict';

let _days = 30;
let _q = '';

MarketingSidebar.attach('#anRoot', {
  activeItem: 'marketing-analytics',
  title: 'Marketing Analytics',
  subtitle: 'Full performance report',
  searchPlaceholder: 'Search placements & campaigns…',
  onSearch: (v) => { _q = (v || '').trim().toLowerCase(); renderPlacements(); renderTopCampaigns(); },
});

let PERF = null, ACQ = null, CAMPAIGNS = [];

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(n){n=Number(n)||0;if(n>=1e6)return (n/1e6).toFixed(1)+'M';if(n>=1e3)return (n/1e3).toFixed(1)+'K';return String(n);}
function r1(n){return Math.round((Number(n)||0)*10)/10;}
function showError(msg){
  const el=document.getElementById('statCards');
  if(el)el.innerHTML='<div class="err-note"><i class="fas fa-circle-exclamation"></i> '+esc(msg)+'</div>';
}
async function api(p){const res=await fetch(p,{credentials:'include'});if(!res.ok)throw new Error('API error '+res.status);return await res.json();}

async function loadData(){
  const el=document.getElementById('statCards');
  if(el)el.innerHTML='<div class="skeleton"><i class="fas fa-spinner fa-spin"></i> Loading data…</div>';
  try{
    [PERF,ACQ,CAMPAIGNS]=await Promise.all([
      api('/api/ads/performance?days='+_days),
      api('/api/acquisition/summary?days='+_days),
      api('/api/marketing/campaigns'),
    ]);
    CAMPAIGNS=Array.isArray(CAMPAIGNS)?CAMPAIGNS:[];
    renderStats();renderTrend();renderPlacements();renderFunnel();renderMix();renderTopCampaigns();renderRevenue();
  }catch(e){console.error('Marketing analytics API error:',e);showError('Failed to load marketing data: '+e.message);}
}

function renderStats(){
  const el=document.getElementById('statCards');if(!el)return;
  const a=PERF.totals||{},s=ACQ.totals||{};
  const stats=[
    {v:fmt(a.impressions||0),l:'Impressions',i:'fa-eye',c:'blue'},
    {v:fmt(a.clicks||0),l:'Clicks',i:'fa-hand-pointer',c:'green'},
    {v:r1(a.ctr||0)+'%',l:'CTR',i:'fa-bullseye',c:'purple'},
    {v:fmt(a.conversions||0),l:'Conversions',i:'fa-arrow-turn-down',c:'amber'},
    {v:fmt(s.spend||0),l:'Spend',i:'fa-sack-dollar',c:'red'},
    {v:fmt(a.uniqueViewers||0),l:'Unique viewers',i:'fa-users',c:'pink'},
  ];
  el.innerHTML=stats.map(x=>'<div class="stat-card"><div class="stat-ico '+x.c+'"><i class="fas '+x.i+'"></i></div><div class="stat-num">'+x.v+'</div><div class="stat-lbl">'+x.l+'</div></div>').join('');
}

function renderTrend(){
  const wrap=document.getElementById('trendChartWrap');if(!wrap)return;
  const series=PERF.series||[];
  if(!window.Chart||!series.length){wrap.innerHTML='<div class="skeleton">No time-series data available for this range.</div>';return;}
  const canvas=document.createElement('canvas');canvas.id='trendChart';wrap.innerHTML='';wrap.appendChild(canvas);
  new Chart(canvas,{type:'line',data:{labels:series.map(x=>x.day||x.date||''),datasets:[
    {label:'Impressions',data:series.map(x=>x.impressions||0),borderColor:'#ff0050',fill:false,tension:.3},
    {label:'Clicks',data:series.map(x=>x.clicks||0),borderColor:'#3b82f6',fill:false,tension:.3},
  ]},options:{responsive:true}});
}

function renderPlacements(){
  const el=document.getElementById('placementList');if(!el)return;
  const rows=(PERF.slots||[]).filter(p=>!_q||String(p.page||p.slot||p.adId||'').toLowerCase().indexOf(_q)!==-1);
  if(!rows.length){el.innerHTML='<div class="skeleton">No placement data available</div>';return;}
  const max=Math.max.apply(null,rows.map(x=>x.impressions||0))||1;
  el.innerHTML=rows.slice(0,12).map(p=>'<div class="ph-row"><div class="ph-name">'+esc(p.page||p.slot||p.adId||'Placement')+'<div class="ph-meta">'+fmt(p.impressions||0)+' impressions</div></div><div class="ph-bar-wrap"><div class="ph-bar-track"><div class="ph-bar-fill" style="width:'+Math.min(100,Math.round((p.impressions||0)/max*100))+'%"></div></div></div><div class="ph-ctr">'+r1(p.ctr||0)+'%</div></div>').join('');
}

function renderFunnel(){
  const el=document.getElementById('funnel');if(!el)return;
  const t=PERF.totals||{};
  const steps=[['Impressions',t.impressions||0],['Viewable',t.viewables||0],['Unique viewers',t.uniqueViewers||0],['Clicks',t.clicks||0],['Conversions',t.conversions||0]];
  const max=Math.max.apply(null,steps.map(s=>s[1]))||1;
  el.innerHTML=steps.map(s=>'<div class="funnel-step"><div class="funnel-lbl">'+s[0]+'</div><div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:'+Math.round(s[1]/max*100)+'%">'+fmt(s[1])+'</div></div></div>').join('');
}

function renderMix(){
  const legend=document.getElementById('mixLegend');const wrap=document.getElementById('mixChartWrap');
  const rows=ACQ.campaigns||[];
  const total=rows.reduce((s,c)=>s+(Number(c.spend)||0),0);
  if(legend)legend.innerHTML=rows.slice(0,5).map(c=>'<span>'+esc(c.label||c.campaignId)+' · '+fmt(c.spend||0)+'</span>').join('');
  if(!wrap)return;
  if(!window.Chart||!rows.length){wrap.innerHTML='<div class="skeleton">No campaign spend data available</div>';return;}
  const canvas=document.createElement('canvas');canvas.id='mixChart';wrap.innerHTML='';wrap.appendChild(canvas);
  new Chart(canvas,{type:'doughnut',data:{labels:rows.slice(0,5).map(c=>c.label||c.campaignId),datasets:[{data:rows.slice(0,5).map(c=>c.spend||0)}]},options:{responsive:true,plugins:{legend:{display:false}}}});
}

function renderTopCampaigns(){
  const el=document.getElementById('topCampaigns');if(!el)return;
  const rows=CAMPAIGNS.filter(c=>!_q||String(c.name||'').toLowerCase().indexOf(_q)!==-1)
    .sort((a,b)=>(Number(b.ctr)||0)-(Number(a.ctr)||0)).slice(0,5);
  if(!rows.length){el.innerHTML='<div class="skeleton">No campaign data available</div>';return;}
  el.innerHTML=rows.map((c,i)=>'<div class="tc-row"><div class="tc-rank">'+(i+1)+'</div><div class="tc-info"><div class="tc-name">'+esc(c.name||'Untitled')+' <span class="type-chip '+(c.type||'business')+'">'+esc(c.type||c.status||'business')+'</span></div><div class="tc-meta">'+esc(c.objective||c.description||'')+'</div></div><div class="tc-stats"><div class="tc-stat"><b>'+r1(c.ctr||0)+'%</b><span>CTR</span></div><div class="tc-stat"><b>'+fmt(c.reach||0)+'</b><span>Reach</span></div></div></div>').join('');
}

function renderRevenue(){
  const el=document.getElementById('adRevenuePanel');if(!el)return;
  const t=PERF.totals||{};
  el.innerHTML='<div class="panel-sub">Story-owned ad slots split 70% platform / 30% author. Other surfaces stay 100% platform.</div>'+
    '<div class="funnel-step"><div class="funnel-lbl">Total ad value</div><div class="funnel-pct">'+fmt(t.value||0)+'</div></div>'+
    '<a class="panel-link" href="../super-admin/ad-earnings.html">Open payout detail <i class="fas fa-arrow-right"></i></a>';
}

(function bindControls(){
  const sel=document.getElementById('rangeSel');
  if(sel)sel.addEventListener('change',()=>{_days=Number(sel.value)||30;loadData();});
  const btn=document.getElementById('exportBtn');
  if(btn)btn.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({days:_days,performance:PERF,acquisition:ACQ,campaigns:CAMPAIGNS},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='marketing-analytics-'+_days+'d.json';a.click();URL.revokeObjectURL(url);
  });
})();

loadData();
})();
