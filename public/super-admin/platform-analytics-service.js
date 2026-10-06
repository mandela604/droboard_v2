/**
 * platform-analytics-service.js — Platform Analytics page logic (call-and-render)
 * ────────────────────────────────────────────────────────────────────
 * Verbatim page logic moved from platform-analytics.html inline script.
 * Backend later owns analytics aggregation.
 * Going live: swap USE_API=true, no HTML change.
 */
(function(){
'use strict';
var USE_API = false;
var API_BASE = '/api/super-admin/platform-analytics';

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
function fmtMoney(n){if(n>=1e6)return'$'+(n/1e6).toFixed(1)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(1)+'K';return'$'+n;}
function coinToUSD(c){return Math.round(c/COIN_RATE);}

/* ── Platform data (aggregated from all modules) ── */
var DATA = {
  totalUsers:2847, activeUsers:1923, newUsersWeek:186, newUsersPrev:152,
  totalWriters:342, totalReaders:2389, totalEditors:54, totalAuthors:1840,
  activeToday:412, activeYesterday:389,
  mrr:47280, mrrPrev:43100, totalRevenue:1248000, revenuePrev:1120000,
  coinBalance:4200000, coinTransWeek:2840, coinTransPrev:2410,
  pendingPayouts:9, pendingPayoutAmt:14860, openDisputes:4,
  totalBooks:2400, publishedBooks:1872, flaggedBooks:47, draftBooks:186,
  totalPosts:3200, publishedPosts:2640, flaggedPosts:38,
  totalReads:3420000, totalChapters:18400, avgRating:4.2,
  totalCampaigns:10, liveCampaigns:4, totalImpressions:3400000, totalClicks:218000, ctr:6.4, conversions:12800,
  pendingReports:12, resolvedReports:156, bannedUsers:18, suspendedUsers:34,
  uptime:99.98, avgSessionMin:24, avgStreakDays:8.4, totalReadingHours:186000,
  systemHealth:98.2, apiLatency:42, errorRate:0.03
};

var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var GENRES_DATA=[
  {name:'Romance & Betrayal',pct:28,color:'var(--accent)'},
  {name:'Werewolf & Fantasy',pct:22,color:'var(--purple)'},
  {name:'Mafia & Urban',pct:16,color:'var(--blue)'},
  {name:'Campus & Revenge',pct:12,color:'var(--green)'},
  {name:'Elegy & Heartbreak',pct:9,color:'var(--amber)'},
  {name:'Mystery',pct:7,color:'var(--gold)'},
  {name:'Other',pct:6,color:'var(--text-faint)'}
];

var ROLES_DATA=[
  {name:'Readers',count:2389,pct:84,color:'var(--blue)'},
  {name:'Writers',count:342,pct:12,color:'var(--purple)'},
  {name:'Editors',count:54,pct:2,color:'var(--green)'},
  {name:'Finance',count:8,pct:0.3,color:'var(--gold)'},
  {name:'Marketing',count:12,pct:0.4,color:'var(--amber)'},
  {name:'Super Admins',count:4,pct:0.1,color:'var(--red)'}
];

var REVENUE_MONTHLY=[
  {label:'Jul 2025',revenue:28000,coins:18200,ads:6400,subs:3400,prev:25800},
  {label:'Aug 2025',revenue:31000,coins:20100,ads:7200,subs:3700,prev:28000},
  {label:'Sep 2025',revenue:34000,coins:22400,ads:7800,subs:3800,prev:31000},
  {label:'Oct 2025',revenue:36000,coins:23800,ads:8200,subs:4000,prev:34000},
  {label:'Nov 2025',revenue:38000,coins:25200,ads:8600,subs:4200,prev:36000},
  {label:'Dec 2025',revenue:41000,coins:27100,ads:9200,subs:4700,prev:38000},
  {label:'Jan 2026',revenue:43000,coins:28400,ads:9600,subs:5000,prev:41000},
  {label:'Feb 2026',revenue:45000,coins:29800,ads:10000,subs:5200,prev:43000},
  {label:'Mar 2026',revenue:47000,coins:31200,ads:10400,subs:5400,prev:45000},
  {label:'Apr 2026',revenue:44000,coins:29000,ads:9800,subs:5200,prev:47000},
  {label:'May 2026',revenue:42000,coins:27600,ads:9200,subs:5200,prev:44000},
  {label:'Jun 2026',revenue:47280,coins:31200,ads:10680,subs:5400,prev:42000}
];

var USER_ACQ=[
  {month:'Jul 2025',newUsers:142,active:1580,churned:38,retention:87},
  {month:'Aug 2025',newUsers:168,active:1680,churned:42,retention:88},
  {month:'Sep 2025',newUsers:195,active:1790,churned:35,retention:89},
  {month:'Oct 2025',newUsers:210,active:1920,churned:40,retention:88},
  {month:'Nov 2025',newUsers:178,active:2020,churned:45,retention:87},
  {month:'Dec 2025',newUsers:224,active:2150,churned:38,retention:90},
  {month:'Jan 2026',newUsers:198,active:2280,churned:42,retention:89},
  {month:'Feb 2026',newUsers:165,active:2380,churned:38,retention:90},
  {month:'Mar 2026',newUsers:210,active:2510,churned:35,retention:91},
  {month:'Apr 2026',newUsers:145,active:2600,churned:40,retention:89},
  {month:'May 2026',newUsers:112,active:2680,churned:35,retention:90},
  {month:'Jun 2026',newUsers:186,active:2847,churned:32,retention:91}
];

var TOP_WRITERS=[
  {id:'u1',name:'Ada_Writes',username:'ada_writes',avatar:'https://i.pravatar.cc/60?img=5',books:2,reads:389000,payout:4010000,genre:'Romance & Betrayal'},
  {id:'u2',name:'Ifeanyi_Story',username:'ifeanyi_story',avatar:'https://i.pravatar.cc/60?img=12',books:1,reads:312000,payout:3120000,genre:'Twist & Drama'},
  {id:'u11',name:'Yusuf_Howl',username:'yusuf_howl',avatar:'https://i.pravatar.cc/60?img=59',books:1,reads:210000,payout:1980000,genre:'Werewolf & Fantasy'},
  {id:'u5',name:'Zara_M',username:'zara_m',avatar:'https://i.pravatar.cc/60?img=32',books:1,reads:192000,payout:1740000,genre:'Mafia & Urban'},
  {id:'u7',name:'CampusQueen',username:'campus_queen',avatar:'https://i.pravatar.cc/60?img=41',books:1,reads:134000,payout:1560000,genre:'Campus & Revenge'}
];

var TOP_READERS=[
  {id:'u6',name:'Blessing_O',username:'blessing_o',avatar:'https://i.pravatar.cc/60?img=23',readingHours:340,avgSessionMin:52,streakDays:61,coinsSpent:96000,tips:112000,likesGiven:1540,shares:210,saves:388,comments:512,topGenre:'Elegy & Heartbreak',booksRead:89},
  {id:'u3',name:'Chinelo_23',username:'chinelo_23',avatar:'https://i.pravatar.cc/60?img=9',readingHours:210,avgSessionMin:41,streakDays:27,coinsSpent:48000,tips:34000,likesGiven:890,shares:112,saves:206,comments:210,topGenre:'Romance & Betrayal',booksRead:64},
  {id:'u13',name:'PraiseUnending',username:'praise_unending',avatar:'https://i.pravatar.cc/60?img=14',readingHours:95,avgSessionMin:29,streakDays:15,coinsSpent:15400,tips:21000,likesGiven:410,shares:52,saves:88,comments:76,topGenre:'Romance & Betrayal',booksRead:31},
  {id:'u4',name:'KingDave',username:'king_dave',avatar:'https://i.pravatar.cc/60?img=53',readingHours:58,avgSessionMin:12,streakDays:0,coinsSpent:12500,tips:2000,likesGiven:120,shares:8,saves:15,comments:340,topGenre:'Mafia & Urban',booksRead:19},
  {id:'u8',name:'Emeka_T',username:'emeka_t',avatar:'https://i.pravatar.cc/60?img=36',readingHours:8,avgSessionMin:6,streakDays:0,coinsSpent:3200,tips:0,likesGiven:12,shares:1,saves:2,comments:88,topGenre:'Mafia & Urban',booksRead:5},
  {id:'u14',name:'TheGreyFox',username:'the_grey_fox',avatar:'https://i.pravatar.cc/60?img=59',readingHours:14,avgSessionMin:8,streakDays:0,coinsSpent:5100,tips:1000,likesGiven:30,shares:3,saves:6,comments:150,topGenre:'Mystery',booksRead:6},
  {id:'u15',name:'Amara_Reads',username:'amara_reads',avatar:'https://i.pravatar.cc/60?img=45',readingHours:180,avgSessionMin:38,streakDays:42,coinsSpent:72000,tips:85000,likesGiven:1200,shares:165,saves:290,comments:380,topGenre:'Werewolf & Fantasy',booksRead:72},
  {id:'u16',name:'Kelvin_B',username:'kelvin_b',avatar:'https://i.pravatar.cc/60?img=60',readingHours:120,avgSessionMin:28,streakDays:18,coinsSpent:34000,tips:28000,likesGiven:560,shares:78,saves:140,comments:195,topGenre:'Campus & Revenge',booksRead:45},
  {id:'u17',name:'Nneka_V',username:'nneka_v',avatar:'https://i.pravatar.cc/60?img=47',readingHours:260,avgSessionMin:45,streakDays:38,coinsSpent:88000,tips:96000,likesGiven:980,shares:130,saves:245,comments:320,topGenre:'Romance & Betrayal',booksRead:58},
  {id:'u18',name:'Tunde_Reader',username:'tunde_reader',avatar:'https://i.pravatar.cc/60?img=52',readingHours:42,avgSessionMin:15,streakDays:5,coinsSpent:8200,tips:3500,likesGiven:85,shares:12,saves:22,comments:65,topGenre:'Mafia & Urban',booksRead:14},
  {id:'u19',name:'Fatima_Z',username:'fatima_z',avatar:'https://i.pravatar.cc/60?img=26',readingHours:155,avgSessionMin:35,streakDays:22,coinsSpent:55000,tips:62000,likesGiven:720,shares:95,saves:180,comments:240,topGenre:'Elegy & Heartbreak',booksRead:48},
  {id:'u20',name:'Obi_N',username:'obi_n',avatar:'https://i.pravatar.cc/60?img=33',readingHours:75,avgSessionMin:20,streakDays:10,coinsSpent:21000,tips:15000,likesGiven:310,shares:42,saves:78,comments:110,topGenre:'Fantasy',booksRead:28}
];

/* ── Renderers ── */
var revPage=1, acqPage=1, readerPage=1;
var PAGE_SIZE=6;
function renderTopStats(){
  var mrrTrend = DATA.mrr > DATA.mrrPrev ? 'up' : 'down';
  var mrrPct = Math.round(((DATA.mrr-DATA.mrrPrev)/DATA.mrrPrev)*100);
  var userTrend = DATA.newUsersWeek > DATA.newUsersPrev ? 'up' : 'down';
  var userPct = Math.round(((DATA.newUsersWeek-DATA.newUsersPrev)/DATA.newUsersPrev)*100);
  var coinTrend = DATA.coinTransWeek > DATA.coinTransPrev ? 'up' : 'down';
  var coinPct = Math.round(((DATA.coinTransWeek-DATA.coinTransPrev)/DATA.coinTransPrev)*100);
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
  var el=document.getElementById('revenueDetail');
  if(view==='bySource'){
    var sources=[
      {name:'Coin Purchases',pct:66,color:'var(--gold)',amt:'$31.2K'},
      {name:'Ad Revenue',pct:23,color:'var(--blue)',amt:'$10.7K'},
      {name:'Subscriptions',pct:11,color:'var(--green)',amt:'$5.4K'}
    ];
    el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">'+sources.map(function(s){
      return '<div style="text-align:center;padding:14px;background:var(--input-bg);border-radius:10px"><div style="font-size:22px;font-weight:800;color:'+s.color+'">'+s.pct+'%</div><div style="font-size:11px;color:var(--text-faint);font-weight:700;margin-top:2px">'+s.name+'</div><div style="font-size:13px;font-weight:800;margin-top:4px">'+s.amt+'</div></div>';
    }).join('')+'</div>';
    el.innerHTML+='<div style="font-size:11px;color:var(--text-faint);font-weight:700;text-align:center">Current month breakdown — Total: $47,280</div>';
    return;
  }
  var rows=view==='quarterly'?[
    {label:'Q3 2025',revenue:93000,coins:60700,ads:21400,subs:10900,prev:0,growth:'—'},
    {label:'Q4 2025',revenue:115000,coins:76100,ads:26000,subs:12900,prev:93000,growth:'+23.7%'},
    {label:'Q1 2026',revenue:135000,coins:89400,ads:30000,subs:15600,prev:115000,growth:'+17.4%'},
    {label:'Q2 2026',revenue:133280,coins:87800,ads:29680,subs:15800,prev:135000,growth:'-1.3%'}
  ]:REVENUE_MONTHLY;
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
  var total=DATA.totalUsers;
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
    {l:'Published Books',v:DATA.publishedBooks,total:DATA.totalBooks,color:'var(--green)'},
    {l:'Draft Books',v:DATA.draftBooks,total:DATA.totalBooks,color:'var(--amber)'},
    {l:'Flagged Books',v:DATA.flaggedBooks,total:DATA.totalBooks,color:'var(--red)'},
    {l:'Published Posts',v:DATA.publishedPosts,total:DATA.totalPosts,color:'var(--blue)'},
    {l:'Flagged Posts',v:DATA.flaggedPosts,total:DATA.totalPosts,color:'var(--red)'},
    {l:'Total Reads',v:DATA.totalReads,total:DATA.totalReads,color:'var(--accent)'}
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
    {l:'Likes Given',v:'1.2M',ico:'fa-heart',color:'var(--red)'},
    {l:'Comments',v:'847K',ico:'fa-comment',color:'var(--purple)'},
    {l:'Shares',v:'124K',ico:'fa-share',color:'var(--gold)'},
    {l:'Saves',v:'386K',ico:'fa-bookmark',color:'var(--green)'}
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
  var items=[
    {l:'Live Campaigns',v:DATA.liveCampaigns+' / '+DATA.totalCampaigns,color:'var(--accent)'},
    {l:'Impressions',v:fmtNum(DATA.totalImpressions),color:'var(--blue)'},
    {l:'Clicks',v:fmtNum(DATA.totalClicks),color:'var(--green)'},
    {l:'CTR',v:DATA.ctr+'%',color:'var(--purple)'},
    {l:'Conversions',v:fmtNum(DATA.conversions),color:'var(--gold)'},
    {l:'Revenue Lift',v:'+14%',color:'var(--green)'}
  ];
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
  var html='<table class="mini-tbl"><thead><tr><th>Reader</th><th>Top Genre</th><th class="num">Read Time</th><th class="num">Avg Session</th><th class="num">Streak</th><th class="num">Coins Spent</th><th class="num">Tips</th><th class="num">Books Read</th><th class="num">Comments</th></tr></thead><tbody>'+
    pageRows.map(function(r){
      var streakVal=r.streakDays>0?('🔥 '+r.streakDays+'d'):'—';
      return '<tr><td><div style="display:flex;align-items:center;gap:8px"><img src="'+r.avatar+'" style="width:28px;height:28px;border-radius:50%;object-fit:cover" alt=""/><div><a href="../Pages/profile.html?id='+r.id+'" style="font-weight:700;color:var(--text);text-decoration:none;cursor:pointer" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text)\'">'+r.name+'</a><div style="font-size:10px;color:var(--text-faint)">@'+r.username+'</div></div></div></td><td style="font-size:11px">'+r.topGenre+'</td><td class="num">'+r.readingHours+'h</td><td class="num">'+r.avgSessionMin+'m</td><td class="num">'+streakVal+'</td><td class="num">'+fmtMoney(coinToUSD(r.coinsSpent))+'</td><td class="num">'+fmtMoney(coinToUSD(r.tips))+'</td><td class="num">'+r.booksRead+'</td><td class="num">'+fmtNum(r.comments)+'</td></tr>';
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
