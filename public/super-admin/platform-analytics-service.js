/**
 * platform-analytics-service.js — Platform Analytics page logic (call-and-render)
 * ────────────────────────────────────────────────────────────────────
 * Verbatim page logic moved from platform-analytics.html inline script.
 * Backend later owns analytics aggregation.
 * Going live: swap USE_API=true, no HTML change.
 */
(function(){
'use strict';
var USE_API = true;
var API_BASE = window.DROBOARD_API_BASE || '/api/super-admin/analytics';

var shell = SuperAdminSidebar.attach('#analyticsRoot',{
  activeItem:'platform-analytics',
  title:'Platform Analytics',
  subtitle:'Comprehensive insights across every module',
  user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'},
  notifCount:9,
  searchPlaceholder:'Search everything...',
});

var ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',gold:'var(--gold)',accent:'var(--accent)'};
var BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',gold:'var(--gold-bg)',accent:'rgba(255,0,80,.1)'};

var COIN_RATE=15;
function fmtNum(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
/* Revenue rows are authored in dollars (Jun 2026 = 47,280), so the staff
   restatement is usdToMoneyShort — ngnToMoney here would divide by the rate. */
function fmtMoney(n){ if(window.DroboardCurrency && DroboardCurrency.usdToMoneyShort) return DroboardCurrency.usdToMoneyShort(n); if(n>=1e6)return'$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(1)+'K';return'$'+n;}
// Coin acts stay in coins on this console — restating them as naira would make
// the column header a lie. There is no coins→money helper by design.
function coins(n){ if(window.DroboardCurrency && DroboardCurrency.coins) return DroboardCurrency.coins(n); return fmtNum(n)+' coins'; }

/* ── Platform data — filled from GET /analytics/summary ── */
var DATA = {
  totalUsers:0, activeUsers:0, newUsersWeek:0, newUsersPrev:0,
  totalWriters:0, totalReaders:0, totalEditors:0, totalAuthors:0,
  activeToday:0, activeYesterday:0,
  mrr:0, mrrPrev:0, totalRevenue:0, revenuePrev:0,
  coinBalance:0, coinTransWeek:0, coinTransPrev:0,
  pendingPayouts:0, pendingPayoutAmt:0, openDisputes:0,
  totalBooks:0, publishedBooks:0, flaggedBooks:0, draftBooks:0,
  totalPosts:0, publishedPosts:0, flaggedPosts:0,
  totalReads:0, totalChapters:0, avgRating:0,
  totalCampaigns:0, liveCampaigns:0, totalImpressions:0, totalClicks:0, ctr:0, conversions:0,
  pendingReports:0, resolvedReports:0, bannedUsers:0, suspendedUsers:0,
  uptime:100, avgSessionMin:0, avgStreakDays:0, totalReadingHours:0,
  systemHealth:'ok', apiLatency:0, errorRate:0
};

var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var GENRES_DATA=[];
var ROLES_DATA=[];
var REVENUE_MONTHLY=[];
var USER_ACQ=[];
var TOP_WRITERS=[];
var TOP_READERS=[];

/* One boot call keeps every panel on the same numbers the backend aggregates. */
async function loadAnalytics(){
  var r = await fetch(API_BASE + '/summary', { credentials:'include' });
  if(!r.ok){ var b=null; try{ b=await r.json(); }catch(e){} throw new Error('HTTP '+r.status+(b&&b.error?' · '+b.error:'')); }
  var j = await r.json();
  if(j && j.data) DATA = Object.assign(DATA, j.data);
  if(j && j.totalUsers != null) DATA.totalUsers = j.totalUsers;
  if(j && j.pendingReports != null) DATA.pendingReports = j.pendingReports;
  if(j && Array.isArray(j.monthlyRevenue) && j.monthlyRevenue.length) REVENUE_MONTHLY = j.monthlyRevenue;
  if(j && Array.isArray(j.userAcq)) USER_ACQ = j.userAcq;
  if(j && Array.isArray(j.genreData)) GENRES_DATA = j.genreData;
  var ROLE_COLORS=['var(--blue)','var(--purple)','var(--green)','var(--gold)','var(--amber)','var(--red)'];
  var GENRE_COLORS=['var(--accent)','var(--purple)','var(--blue)','var(--green)','var(--amber)','var(--gold)','var(--text-faint)'];
  if(j && Array.isArray(j.roleData)) ROLES_DATA = j.roleData.map(function(r,i){ return Object.assign({color:ROLE_COLORS[i%ROLE_COLORS.length]}, r); });
  if(Array.isArray(GENRES_DATA)) GENRES_DATA = GENRES_DATA.map(function(g,i){ return Object.assign({color:GENRE_COLORS[i%GENRE_COLORS.length]}, g); });
  if(j && Array.isArray(j.topWriters)) TOP_WRITERS = j.topWriters;
  try {
    var tr = await fetch(API_BASE + '/top-readers?limit=50', { credentials:'include' });
    if(tr.ok){ var tj = await tr.json(); if(tj && Array.isArray(tj.items)) TOP_READERS = tj.items; }
  } catch(e){}
}

/* ── Renderers ── */
var revPage=1, acqPage=1, readerPage=1;
var activeRevenueView = 'monthly';
var PAGE_SIZE=6;

async function fetchRevenue(view){
  var r = await fetch(API_BASE + '/revenue?view=' + encodeURIComponent(view), { credentials:'include' });
  if(!r.ok){ var b=null; try{ b=await r.json(); }catch(e){} throw new Error('HTTP '+r.status+(b&&b.error?' · '+b.error:'')); }
  return r.json();
}

function renderTopStats(){
  var mrrTrend = DATA.mrr > DATA.mrrPrev ? 'up' : 'down';
  var mrrPct = DATA.mrrPrev ? Math.round(((DATA.mrr-DATA.mrrPrev)/DATA.mrrPrev)*100) : 0;
  var userTrend = DATA.newUsersWeek > DATA.newUsersPrev ? 'up' : 'down';
  var userPct = DATA.newUsersPrev ? Math.round(((DATA.newUsersWeek-DATA.newUsersPrev)/DATA.newUsersPrev)*100) : 0;
  var coinTrend = DATA.coinTransWeek > DATA.coinTransPrev ? 'up' : 'down';
  var coinPct = DATA.coinTransPrev ? Math.round(((DATA.coinTransWeek-DATA.coinTransPrev)/DATA.coinTransPrev)*100) : 0;
  var stats = [
    {n:fmtNum(DATA.totalUsers),l:'Total Users',ico:'fa-users',cls:'blue',trend:userTrend,pct:userPct+'% this week'},
    {n:fmtMoney(DATA.mrr),l:'Monthly Revenue',ico:'fa-chart-line',cls:'green',trend:mrrTrend,pct:'+'+mrrPct+'% vs last month'},
    {n:fmtNum(DATA.totalBooks),l:'Total Books',ico:'fa-book-open',cls:'gold',trend:'up',pct:fmtNum(DATA.publishedBooks)+' published'},
    {n:DATA.uptime+'%',l:'Platform Uptime',ico:'fa-server',cls:'purple',trend:'up',pct:DATA.systemHealth+'% health'}
  ];
  document.getElementById('topStats').innerHTML = stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:'+BG[s.cls]+';color:'+ICO[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div><div class="stat-trend '+s.trend+'"><i class="fas fa-arrow-'+s.trend+'"></i> '+s.pct+'</div></div></div>';
  }).join('');
}

function renderRevenueDetail(view){
  activeRevenueView = view;
  var el=document.getElementById('revenueDetail');
  el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:24px"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  
  fetchRevenue(view).then(function(data){
    var rows = data && data.rows ? data.rows : [];
    if(view==='bySource'){
      if(!rows.length){
        el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:24px">No revenue source data available</div>';
        return;
      }
      el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">'+rows.map(function(s){
        return '<div style="text-align:center;padding:14px;background:var(--input-bg);border-radius:10px"><div style="font-size:22px;font-weight:800;color:'+s.color+'">'+s.pct+'%</div><div style="font-size:11px;color:var(--text-faint);font-weight:700;margin-top:2px">'+s.name+'</div><div style="font-size:13px;font-weight:800;margin-top:4px">'+s.amt+'</div></div>';
      }).join('')+'</div>';
      var total = rows.reduce(function(s,r){ return s + (Number(r.amt?.replace?.(/[^0-9.]/g,'')) || 0); }, 0);
      el.innerHTML+='<div style="font-size:11px;color:var(--text-faint);font-weight:700;text-align:center">Current month breakdown — Total: '+fmtMoney(total)+'</div>';
      return;
    }
    if(!rows.length){
      el.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:24px">No revenue data available for this period</div>';
      return;
    }
  var total=rows.length;
  var start=(revPage-1)*PAGE_SIZE;
  var pageRows=rows.slice(start,start+PAGE_SIZE);
  var totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  var maxRev=Math.max.apply(null,rows.map(function(r){return r.revenue;}));
  var html='<table class="mini-tbl"><thead><tr>'+(view==='quarterly'?'<th>Quarter</th>':'<th>Month</th>')+'<th class="num">Revenue</th><th class="num">Coins</th><th class="num">Ads</th><th class="num">Subs</th><th class="num">vs Prev</th></tr></thead><tbody>'+
    pageRows.map(function(r){
      var change=r.prev?Math.round(((r.revenue-r.prev)/r.prev)*100):0;
      var changeStr=r.prev?(change>=0?'+':'')+change+'%':'—';
      var changeColor=r.prev?(change>=0?'var(--green)':'var(--red)'):'var(--text-faint)';
      var barPct=Math.round((r.revenue/maxRev)*100);
      return '<tr><td><b>'+r.label+'</b></td><td class="num"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px"><div style="width:60px;height:5px;border-radius:3px;background:var(--table-head);overflow:hidden"><div style="height:100%;width:'+barPct+'%;background:var(--accent);border-radius:3px"></div></div>'+fmtMoney(r.revenue)+'</div></td><td class="num">'+fmtMoney(r.coins)+'</td><td class="num">'+fmtMoney(r.ads)+'</td><td class="num">'+fmtMoney(r.subs)+'</td><td class="num" style="color:'+changeColor+';font-weight:800">'+changeStr+'</td></tr>';
    }).join('')+'</tbody></table>';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px"><div style="font-size:11px;color:var(--text-faint)">Showing '+(start+1)+'–'+Math.min(start+PAGE_SIZE,total)+' of '+total+'</div><div style="display:flex;gap:4px">';
  html+='<button onclick="revPage=Math.max(1,revPage-1);renderRevenueDetail(\''+view+'\')" '+(revPage===1?'disabled':'')+' style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"'+(revPage===1?' disabled':'')+'><i class="fas fa-chevron-left"></i></button>';
  for(var p=1;p<=totalPages;p++){
    html+='<button onclick="revPage='+p+';renderRevenueDetail(\''+view+'\')" style="width:28px;height:28px;border-radius:6px;border:1px solid '+(p===revPage?'var(--accent)':'var(--input-border)')+';background:'+(p===revPage?'var(--accent)':'var(--input-bg)')+';color:'+(p===revPage?'#fff':'var(--text)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'+p+'</button>';
  }
  html+='<button onclick="revPage=Math.min('+totalPages+',revPage+1);renderRevenueDetail(\''+view+'\')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"'+(revPage===totalPages?' disabled':'')+'><i class="fas fa-chevron-right"></i></button>';
  html+='</div></div>';
  el.innerHTML=html;
  }).catch(function(e){
    el.innerHTML = '<div style="text-align:center;color:var(--red);padding:24px"><i class="fas fa-circle-exclamation"></i> Failed to load: '+esc(e.message)+'</div>';
  });
}

function renderUserAcquisition(){
  var el=document.getElementById('userAcquisition');
  var total=USER_ACQ.length;
  var start=(acqPage-1)*PAGE_SIZE;
  var pageRows=USER_ACQ.slice(start,start+PAGE_SIZE);
  var totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  var html='<table class="mini-tbl"><thead><tr><th>Month</th><th class="num">New Users</th><th class="num">Active</th><th class="num">Churned</th><th class="num">Retention</th></tr></thead><tbody>'+
    pageRows.map(function(u){
      var retColor=u.retention>=90?'var(--green)':u.retention>=87?'var(--amber)':'var(--red)';
      return '<tr><td><b>'+u.month+'</b></td><td class="num" style="color:var(--green)">+'+u.newUsers+'</td><td class="num">'+fmtNum(u.active)+'</td><td class="num" style="color:var(--red)">-'+u.churned+'</td><td class="num" style="color:'+retColor+';font-weight:800">'+u.retention+'%</td></tr>';
    }).join('')+'</tbody></table>';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px"><div style="font-size:11px;color:var(--text-faint)">Showing '+(start+1)+'–'+Math.min(start+PAGE_SIZE,total)+' of '+total+'</div><div style="display:flex;gap:4px">';
  html+='<button onclick="acqPage=Math.max(1,acqPage-1);renderUserAcquisition()" '+(acqPage===1?'disabled':'')+' style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-chevron-left"></i></button>';
  for(var p=1;p<=totalPages;p++){
    html+='<button onclick="acqPage='+p+';renderUserAcquisition()" style="width:28px;height:28px;border-radius:6px;border:1px solid '+(p===acqPage?'var(--accent)':'var(--input-border)')+';background:'+(p===acqPage?'var(--accent)':'var(--input-bg)')+';color:'+(p===acqPage?'#fff':'var(--text)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'+p+'</button>';
  }
  html+='<button onclick="acqPage=Math.min('+totalPages+',acqPage+1);renderUserAcquisition()" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-chevron-right"></i></button>';
  html+='</div></div>';
  el.innerHTML=html;
}



function renderRoleDonut(){
  var total=DATA.totalUsers || 1;
  var segments=[];
  var cumulative=0;
  ROLES_DATA.forEach(function(r){
    segments.push({start:cumulative,end:cumulative+r.pct,color:r.color,name:r.name,count:r.count});
    cumulative+=r.pct;
  });
  var gradient='conic-gradient(';
  var pos=0;
  ROLES_DATA.forEach(function(r){
    gradient+=r.color+' '+pos+'% '+(pos+r.pct)+'%';
    pos+=r.pct;
    if(pos<100)gradient+=', ';
  });
  gradient+=')';
  var legend=ROLES_DATA.map(function(r){
    return '<div class="legend-item"><div class="legend-dot" style="background:'+r.color+'"></div>'+r.name+' <b>'+fmtNum(r.count)+'</b></div>';
  }).join('');
  document.getElementById('roleDonut').innerHTML=
    '<div class="donut" style="background:'+gradient+'"><div class="donut-center"><b>'+fmtNum(total)+'</b><span>Users</span></div></div>'+
    '<div class="donut-legend">'+legend+'</div>';
}

function renderContentOverview(){
  var items=[
    {l:'Published Books',v:DATA.publishedBooks,total:DATA.totalBooks||1,color:'var(--green)'},
    {l:'Draft Books',v:DATA.draftBooks,total:DATA.totalBooks||1,color:'var(--amber)'},
    {l:'Flagged Books',v:DATA.flaggedBooks,total:DATA.totalBooks||1,color:'var(--red)'},
    {l:'Published Posts',v:DATA.publishedPosts,total:DATA.totalPosts||1,color:'var(--blue)'},
    {l:'Flagged Posts',v:DATA.flaggedPosts,total:DATA.totalPosts||1,color:'var(--red)'},
    {l:'Total Reads',v:DATA.totalReads,total:DATA.totalReads||1,color:'var(--accent)'}
  ];
  document.getElementById('contentOverview').innerHTML=items.map(function(it){
    var pct=Math.round((it.v/it.total)*100);
    return '<div class="h-bar-row"><div class="h-bar-lbl">'+it.l+'</div><div class="h-bar-track"><div class="h-bar-fill" style="width:'+pct+'%;background:'+it.color+'"></div></div><div class="h-bar-val">'+fmtNum(it.v)+'</div></div>';
  }).join('');
}

function renderTopGenres(){
  document.getElementById('topGenres').innerHTML=GENRES_DATA.map(function(g){
    return '<div class="h-bar-row"><div class="h-bar-lbl">'+g.name+'</div><div class="h-bar-track"><div class="h-bar-fill" style="width:'+g.pct+'%;background:'+g.color+'"></div></div><div class="h-bar-val">'+g.pct+'%</div></div>';
  }).join('');
}

function renderEngagement(){
  var items=[
    {l:'Avg Session',v:DATA.avgSessionMin+'m',ico:'fa-clock',color:'var(--accent)'},
    {l:'Avg Streak',v:DATA.avgStreakDays+'d',ico:'fa-fire',color:'var(--amber)'},
    {l:'Total Reading Hours',v:fmtNum(DATA.totalReadingHours)+'h',ico:'fa-book-open',color:'var(--blue)'},
    {l:'Active Today',v:fmtNum(DATA.activeToday),ico:'fa-bolt',color:'var(--green)'},
    {l:'Likes Given',v:fmtNum(DATA.likesGiven),ico:'fa-heart',color:'var(--red)'},
    {l:'Comments',v:fmtNum(DATA.commentsTotal),ico:'fa-comment',color:'var(--purple)'},
    {l:'Shares',v:fmtNum(DATA.sharesTotal),ico:'fa-share',color:'var(--gold)'},
    {l:'Saves',v:fmtNum(DATA.savesTotal),ico:'fa-bookmark',color:'var(--green)'}
  ];
  document.getElementById('engagementStats').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+items.map(function(it){
    return '<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:'+BG[Object.keys(BG).find(function(k){return ICO[k]===it.color;})||'accent']+';color:'+it.color+';display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0"><i class="fas '+it.ico+'"></i></div><div><div style="font-size:14px;font-weight:800">'+it.v+'</div><div style="font-size:10px;color:var(--text-faint);font-weight:700">'+it.l+'</div></div></div>';
  }).join('')+'</div>';
}

function renderFinancialSummary(){
  var items=[
    {l:'MRR',v:fmtMoney(DATA.mrr),ico:'fa-chart-line',color:'var(--green)'},
    {l:'Total Revenue',v:fmtMoney(DATA.totalRevenue),ico:'fa-sack-dollar',color:'var(--gold)'},
    {l:'Coin Balance',v:fmtNum(DATA.coinBalance),ico:'fa-coins',color:'var(--amber)'},
    {l:'Pending Payouts',v:DATA.pendingPayouts+' ('+fmtMoney(DATA.pendingPayoutAmt)+')',ico:'fa-hourglass-half',color:'var(--blue)'},
    {l:'Open Disputes',v:DATA.openDisputes,ico:'fa-gavel',color:'var(--red)'},
    {l:'Coin Transactions',v:fmtNum(DATA.coinTransWeek)+'/wk',ico:'fa-exchange-alt',color:'var(--purple)'}
  ];
  document.getElementById('financialSummary').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+items.map(function(it){
    return '<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:'+BG[Object.keys(BG).find(function(k){return ICO[k]===it.color;})||'green']+';color:'+it.color+';display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0"><i class="fas '+it.ico+'"></i></div><div><div style="font-size:14px;font-weight:800">'+it.v+'</div><div style="font-size:10px;color:var(--text-faint);font-weight:700">'+it.l+'</div></div></div>';
  }).join('')+'</div>';
}

function renderMarketingPerf(){
  var sl=null;
  try{ if(window.AdService && typeof AdService.spotlightStats==='function') sl=AdService.spotlightStats(); }catch(e){}
  var items=[
    {l:'Live Campaigns',v:DATA.liveCampaigns+' / '+DATA.totalCampaigns,color:'var(--accent)'},
    {l:'Impressions',v:fmtNum(DATA.totalImpressions),color:'var(--blue)'},
    {l:'Clicks',v:fmtNum(DATA.totalClicks),color:'var(--green)'},
    {l:'CTR',v:DATA.ctr+'%',color:'var(--purple)'},
    {l:'Conversions',v:fmtNum(DATA.conversions),color:'var(--gold)'},
    {l:'Revenue Lift',v:'+14%',color:'var(--green)'}
  ];
  if(sl){
    items.push({l:'Spotlight Conversions',v:fmtNum(sl.clicks),color:'var(--green)'});
    items.push({l:'Spotlight CTR',v:(+sl.ctr||0).toFixed(1)+'%',color:'var(--accent)'});
  }
  document.getElementById('marketingPerf').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+items.map(function(it){
    return '<div style="text-align:center;padding:10px;background:var(--input-bg);border-radius:10px"><div style="font-size:18px;font-weight:800;color:'+it.color+'">'+it.v+'</div><div style="font-size:10px;color:var(--text-faint);font-weight:700;margin-top:2px">'+it.l+'</div></div>';
  }).join('')+'</div>';
}

function renderModeration(){
  var items=[
    {l:'Pending Reports',v:DATA.pendingReports,color:'var(--red)',pct:7},
    {l:'Resolved Reports',v:DATA.resolvedReports,color:'var(--green)',pct:85},
    {l:'Banned Users',v:DATA.bannedUsers,color:'var(--red)',pct:1},
    {l:'Suspended Users',v:DATA.suspendedUsers,color:'var(--amber)',pct:2},
    {l:'Flagged Books',v:DATA.flaggedBooks,color:'var(--amber)',pct:2},
    {l:'Flagged Posts',v:DATA.flaggedPosts,color:'var(--amber)',pct:1}
  ];
  document.getElementById('moderationStats').innerHTML=items.map(function(it){
    return '<div class="h-bar-row"><div class="h-bar-lbl">'+it.l+'</div><div class="h-bar-track"><div class="h-bar-fill" style="width:'+it.pct+'%;background:'+it.color+'"></div></div><div class="h-bar-val">'+it.v+'</div></div>';
  }).join('');
}

function renderTopWriters(){
  document.getElementById('topWriters').innerHTML='<table class="mini-tbl"><thead><tr><th>Writer</th><th>Genre</th><th>Books</th><th class="num">Reads</th><th class="num">Earnings</th></tr></thead><tbody>'+
    TOP_WRITERS.map(function(w){
      return '<tr><td><div style="display:flex;align-items:center;gap:8px"><img src="'+w.avatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover" alt=""/><div><a href="../Pages/profile.html?id='+w.id+'" style="font-weight:700;color:var(--text);text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text)\'">'+w.name+'</a><div style="font-size:10px;color:var(--text-faint)">@'+w.username+'</div></div></div></td><td style="font-size:11px">'+w.genre+'</td><td>'+w.books+'</td><td class="num">'+fmtNum(w.reads)+'</td><td class="num" style="color:var(--green)">'+fmtMoney(w.payout)+'</td></tr>';
    }).join('')+'</tbody></table>';
}

function renderTopReaders(){
  var el=document.getElementById('topReaders');
  var total=TOP_READERS.length;
  var start=(readerPage-1)*PAGE_SIZE;
  var pageRows=TOP_READERS.slice(start,start+PAGE_SIZE);
  var totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  var html='<table class="mini-tbl"><thead><tr><th>Reader</th><th>Top Genre</th><th class="num">Read Time</th><th class="num">Avg Session</th><th class="num">Streak</th><th class="num">Coins Spent</th><th class="num">Tips Sent</th><th class="num">Books Read</th><th class="num">Comments</th></tr></thead><tbody>'+
    pageRows.map(function(r){
      var streakVal=r.streakDays>0?('🔥 '+r.streakDays+'d'):'—';
      return '<tr><td><div style="display:flex;align-items:center;gap:8px"><img src="'+r.avatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover" alt=""/><div><a href="../Pages/profile.html?id='+r.id+'" style="font-weight:700;color:var(--text);text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text)\'">'+r.name+'</a><div style="font-size:10px;color:var(--text-faint)">@'+r.username+'</div></div></div></td><td style="font-size:11px">'+r.topGenre+'</td><td class="num">'+r.readingHours+'h</td><td class="num">'+r.avgSessionMin+'m</td><td class="num">'+streakVal+'</td><td class="num">'+coins(r.coinsSpent)+'</td><td class="num">'+coins(r.tipsCoins)+'</td><td class="num">'+r.booksRead+'</td><td class="num">'+fmtNum(r.comments)+'</td></tr>';
    }).join('')+'</tbody></table>';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px"><div style="font-size:11px;color:var(--text-faint)">Showing '+(start+1)+'–'+Math.min(start+PAGE_SIZE,total)+' of '+total+'</div><div style="display:flex;gap:4px">';
  html+='<button onclick="readerPage=Math.max(1,readerPage-1);renderTopReaders()" '+(readerPage===1?'disabled':'')+' style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-chevron-left"></i></button>';
  for(var p=1;p<=totalPages;p++){
    html+='<button onclick="readerPage='+p+';renderTopReaders()" style="width:28px;height:28px;border-radius:6px;border:1px solid '+(p===readerPage?'var(--accent)':'var(--input-border)')+';background:'+(p===readerPage?'var(--accent)':'var(--input-bg)')+';color:'+(p===readerPage?'#fff':'var(--text)')+';font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">'+p+'</button>';
  }
  html+='<button onclick="readerPage=Math.min('+totalPages+',readerPage+1);renderTopReaders()" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11px;cursor:pointer;font-family:inherit"><i class="fas fa-chevron-right"></i></button>';
  html+='</div></div>';
  el.innerHTML=html;
}

/* ── Period tabs ── */
document.getElementById('revenuePeriod').addEventListener('click',function(e){
  var btn=e.target.closest('button');
  if(!btn)return;
  document.querySelectorAll('#revenuePeriod button').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  revPage=1;
  renderRevenueDetail(btn.dataset.p);
});

/* ── Init ── */
(async function boot(){
  try {
    await loadAnalytics();
  } catch (e) {
    var host = document.getElementById('analyticsRoot') || document.body;
    var note = document.createElement('div');
    note.style.cssText = 'margin:16px;padding:12px 14px;border:1px solid var(--red);border-radius:10px;color:var(--red);font-size:12px';
    note.innerHTML = '<i class="fas fa-circle-exclamation"></i> Could not load analytics: ' + esc(e.message || e);
    host.appendChild(note);
  }
  renderTopStats();
  renderRevenueDetail('monthly');
  renderUserAcquisition();
  renderRoleDonut();
  renderContentOverview();
  renderTopGenres();
  renderEngagement();
  renderFinancialSummary();
  renderMarketingPerf();
  renderModeration();
  renderTopWriters();
  renderTopReaders();
})();

/* ── window exports: HTML-referenced globals only (inline onclick in generated templates) ── */
window.renderRevenueDetail = renderRevenueDetail;
window.renderUserAcquisition = renderUserAcquisition;
window.renderTopReaders = renderTopReaders;
Object.defineProperty(window, 'revPage', { get: function(){ return revPage; }, set: function(v){ revPage = v; }, configurable: true });
Object.defineProperty(window, 'acqPage', { get: function(){ return acqPage; }, set: function(v){ acqPage = v; }, configurable: true });
Object.defineProperty(window, 'readerPage', { get: function(){ return readerPage; }, set: function(v){ readerPage = v; }, configurable: true });

/* ── API contract (when USE_API=true) ──
GET    /api/super-admin/platform-analytics/summary   -> DATA
GET    /api/super-admin/platform-analytics/revenue?view=monthly|quarterly|bySource
GET    /api/super-admin/platform-analytics/acquisition
GET    /api/super-admin/platform-analytics/top-readers
*/
})();
