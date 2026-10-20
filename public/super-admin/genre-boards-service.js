/**
 * genre-boards-service.js — Genre Boards admin page controller.
 * Accordion list: summary columns on the row, full engagement stats on expand.
 * Metrics: members, new/wk, posts/wk, replies/post (discussion depth),
 * returning visitors %, daily/weekly/monthly visits, open mod reports,
 * growth. No story counts — boards are discussion-only.
 * Backend-ready: flip USE_API, point API_BASE at GET /api/admin/genre-boards.
 */
(function(){
'use strict';
const USE_API = false, API_BASE = '/api';

SuperAdminSidebar.attach('#boardsRoot', {
  activeItem: 'genre-boards',
  title: 'Genre Boards',
  subtitle: 'Every board, its moderation team & engagement stats',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

function toast(m){
  var t=document.getElementById('toastEl');
  if(!t){t=document.createElement('div');t.id='toastEl';t.style.cssText='position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(16px);background:var(--text);color:#fff;padding:10px 18px;border-radius:28px;font-size:12.5px;font-weight:700;z-index:900;opacity:0;transition:.28s;pointer-events:none;white-space:nowrap;max-width:88vw;text-align:center;box-shadow:0 8px 26px rgba(0,0,0,.25)';document.body.appendChild(t);}
  t.textContent=m;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(16px)';},2400);
}

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

/* ── DEMO DATASET — live swap: GET /api/admin/genre-boards ── */
function mod(name, img, role){ return { name:name, avatar:'https://i.pravatar.cc/100?img='+img, role:role }; }

const BOARDS = [
  { id:'romance', name:'Romance', icon:'fa-heart', color:'red', status:'active',
    mods:[mod('Zara_M',16,'Admin'), mod('Ife Solarin',44,'Mod'), mod('Lena Okafor',5,'Mod')],
    members:412300, newWeek:3120, postsWeek:1840, repliesPerPost:6.4, returningPct:42,
    visits:{d:9800,w:62400,m:251000}, threads:15600, reportsOpen:2, growth:4.2, lastActiveMin:2 },
  { id:'fantasy', name:'Fantasy', icon:'fa-hat-wizard', color:'purple', status:'active',
    mods:[mod('Kelo Writes',11,'Admin'), mod('Priya Nandan',25,'Mod')],
    members:298700, newWeek:2210, postsWeek:1320, repliesPerPost:5.1, returningPct:38,
    visits:{d:7400,w:48200,m:196000}, threads:11400, reportsOpen:0, growth:3.1, lastActiveMin:4 },
  { id:'thriller', name:'Thriller', icon:'fa-user-secret', color:'blue', status:'growing',
    mods:[mod('R.K. Vance',52,'Admin'), mod('Chidi Blackwood',60,'Mod'), mod('Aminah Cole',31,'Mod')],
    members:187400, newWeek:1980, postsWeek:980, repliesPerPost:7.2, returningPct:47,
    visits:{d:5600,w:36800,m:142000}, threads:7200, reportsOpen:4, growth:6.8, lastActiveMin:6 },
  { id:'scifi', name:'Sci-Fi', icon:'fa-rocket', color:'blue', status:'active',
    mods:[mod('Diego Marsh',15,'Admin'), mod('TJ Rourke',33,'Mod')],
    members:156200, newWeek:1140, postsWeek:760, repliesPerPost:4.3, returningPct:35,
    visits:{d:4100,w:27500,m:110000}, threads:5400, reportsOpen:1, growth:2.4, lastActiveMin:9 },
  { id:'horror', name:'Horror', icon:'fa-ghost', color:'red', status:'active',
    mods:[mod('Nadia Cross',9,'Admin'), mod('Marcus Webb Jr.',59,'Mod')],
    members:132800, newWeek:980, postsWeek:690, repliesPerPost:3.8, returningPct:31,
    visits:{d:3900,w:25100,m:98400}, threads:4600, reportsOpen:0, growth:1.9, lastActiveMin:11 },
  { id:'drama', name:'Drama', icon:'fa-masks-theater', color:'amber', status:'active',
    mods:[mod('Ada_Writes',32,'Admin'), mod('Chiamaka_N',47,'Mod')],
    members:221500, newWeek:1760, postsWeek:1150, repliesPerPost:8.1, returningPct:51,
    visits:{d:6200,w:40300,m:161000}, threads:9100, reportsOpen:3, growth:3.8, lastActiveMin:3 },
  { id:'werewolf', name:'Werewolf', icon:'fa-paw', color:'purple', status:'growing',
    mods:[mod('Fated Luna',24,'Admin'), mod('Alpha Ridge',56,'Mod'), mod('Moon Cast',36,'Mod')],
    members:264900, newWeek:2640, postsWeek:1480, repliesPerPost:9.3, returningPct:55,
    visits:{d:8100,w:52700,m:208000}, threads:10800, reportsOpen:6, growth:7.4, lastActiveMin:2 },
  { id:'teen', name:'Teen Fiction', icon:'fa-star', color:'green', status:'active',
    mods:[mod('Aminah Cole',31,'Admin'), mod('TJ Rourke',33,'Mod')],
    members:98600, newWeek:860, postsWeek:540, repliesPerPost:3.2, returningPct:28,
    visits:{d:2800,w:18600,m:74200}, threads:3300, reportsOpen:1, growth:2.2, lastActiveMin:14 },
  { id:'mystery', name:'Mystery', icon:'fa-magnifying-glass', color:'gold', status:'growing',
    mods:[mod('Marcus Webb Jr.',59,'Admin'), mod('R.K. Vance',52,'Mod')],
    members:143700, newWeek:1520, postsWeek:820, repliesPerPost:6.9, returningPct:44,
    visits:{d:4700,w:30900,m:121000}, threads:6100, reportsOpen:2, growth:5.6, lastActiveMin:7 },
  { id:'poetry', name:'Poetry', icon:'fa-feather', color:'green', status:'quiet',
    mods:[mod('Ife Solarin',44,'Admin')],
    members:54300, newWeek:320, postsWeek:310, repliesPerPost:2.4, returningPct:22,
    visits:{d:1200,w:8100,m:33500}, threads:1900, reportsOpen:0, growth:-0.8, lastActiveMin:42 },
  { id:'action', name:'Action', icon:'fa-fist-raised', color:'red', status:'active',
    mods:[mod('Diego Marsh',15,'Admin'), mod('Chidi Blackwood',60,'Mod')],
    members:119800, newWeek:940, postsWeek:610, repliesPerPost:4.7, returningPct:36,
    visits:{d:3400,w:22300,m:88700}, threads:4100, reportsOpen:1, growth:2.7, lastActiveMin:10 },
  { id:'adventure', name:'Adventure', icon:'fa-compass', color:'blue', status:'quiet',
    mods:[mod('Lena Okafor',5,'Admin'), mod('Kelo Writes',11,'Mod')],
    members:67200, newWeek:290, postsWeek:280, repliesPerPost:2.1, returningPct:19,
    visits:{d:1100,w:7400,m:30100}, threads:1700, reportsOpen:0, growth:-0.3, lastActiveMin:55 },
];

let filtered = BOARDS.slice();
let page = 1;
const pageSize = 10;
const openIds = {};

function fmtNum(n){
  n = Number(n) || 0;
  if(n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if(n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return String(n);
}
function lastActive(m){
  if(m < 60) return m+'m ago';
  if(m < 1440) return Math.floor(m/60)+'h ago';
  return Math.floor(m/1440)+'d ago';
}

function renderStatCards(){
  const totalMembers = BOARDS.reduce(function(s,b){return s+b.members;},0);
  const postsWeek = BOARDS.reduce(function(s,b){return s+b.postsWeek;},0);
  const reportsOpen = BOARDS.reduce(function(s,b){return s+b.reportsOpen;},0);
  const avgReplies = (BOARDS.reduce(function(s,b){return s+b.repliesPerPost;},0)/BOARDS.length).toFixed(1);
  const stats = [
    { n:String(BOARDS.length), l:'Genre Boards', ico:'fa-th-large', cls:'gold' },
    { n:fmtNum(totalMembers), l:'Total Members', ico:'fa-users', cls:'blue' },
    { n:fmtNum(postsWeek), l:'Posts This Week', ico:'fa-pen-nib', cls:'green' },
    { n:avgReplies, l:'Avg Replies / Post', ico:'fa-comments', cls:'purple' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:'+BG_MAP[s.cls]+';color:'+ICO_MAP[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>';
  }).join('');
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const sort = document.getElementById('sortFilter').value;

  filtered = BOARDS.filter(function(b){
    if(status && b.status !== status) return false;
    if(q){
      const inName = b.name.toLowerCase().indexOf(q) !== -1;
      const inMods = b.mods.some(function(m){ return m.name.toLowerCase().indexOf(q) !== -1; });
      if(!inName && !inMods) return false;
    }
    return true;
  });

  if(sort==='members') filtered.sort(function(a,b){return b.members-a.members;});
  else if(sort==='posts') filtered.sort(function(a,b){return b.postsWeek-a.postsWeek;});
  else if(sort==='replies') filtered.sort(function(a,b){return b.repliesPerPost-a.repliesPerPost;});
  else if(sort==='returning') filtered.sort(function(a,b){return b.returningPct-a.returningPct;});
  else if(sort==='daily') filtered.sort(function(a,b){return b.visits.d-a.visits.d;});
  else if(sort==='growth') filtered.sort(function(a,b){return b.growth-a.growth;});
  else if(sort==='reports') filtered.sort(function(a,b){return b.reportsOpen-a.reportsOpen;});
  else if(sort==='name') filtered.sort(function(a,b){return a.name.localeCompare(b.name);});

  page = 1;
  renderList();
}

function modStackHtml(mods){
  if(!mods || !mods.length) return '<span class="mod-none">No team</span>';
  const shown = mods.slice(0,3).map(function(m){
    return '<img class="mod-av" src="'+m.avatar+'" alt="'+m.name+'" title="'+m.name+' · '+m.role+'"/>';
  }).join('');
  const more = mods.length > 3 ? '<span class="mod-more">+'+(mods.length-3)+'</span>' : '';
  return '<span class="mod-stack" title="'+mods.map(function(m){return m.name+' ('+m.role+')';}).join(', ')+'">'+shown+more+'</span>';
}

function growthHtml(g){
  const up = g >= 0;
  return '<span class="growth-chip '+(up?'up':'down')+'"><i class="fas fa-arrow-'+(up?'up':'down')+'"></i>'+Math.abs(g)+'%</span>';
}

function detailHtml(b){
  const reportsCls = b.reportsOpen >= 5 ? 'bad' : (b.reportsOpen > 0 ? 'warn' : '');
  const modList = b.mods.map(function(m){
    return '<b>'+m.name+'</b> ('+m.role+')';
  }).join(' · ') || 'No team assigned';
  return '<div class="board-detail">'
    + '<div class="detail-grid">'
      + '<div class="dtile"><div class="dtile-lbl">Daily Visits</div><div class="dtile-val">'+fmtNum(b.visits.d)+'</div><div class="dtile-sub">last 24h</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Weekly Visits</div><div class="dtile-val">'+fmtNum(b.visits.w)+'</div><div class="dtile-sub">last 7 days</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Monthly Visits</div><div class="dtile-val">'+fmtNum(b.visits.m)+'</div><div class="dtile-sub">last 30 days</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Returning Visitors</div><div class="dtile-val">'+b.returningPct+'%</div><div class="dtile-sub">came back this week</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Threads</div><div class="dtile-val">'+fmtNum(b.threads)+'</div><div class="dtile-sub">discussions total</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Replies / Post</div><div class="dtile-val">'+b.repliesPerPost.toFixed(1)+'</div><div class="dtile-sub">discussion depth</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">New Members</div><div class="dtile-val">+'+fmtNum(b.newWeek)+'</div><div class="dtile-sub">this week</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Open Reports</div><div class="dtile-val '+reportsCls+'">'+b.reportsOpen+'</div><div class="dtile-sub">mod queue</div></div>'
      + '<div class="dtile"><div class="dtile-lbl">Last Activity</div><div class="dtile-val">'+lastActive(b.lastActiveMin)+'</div><div class="dtile-sub">most recent post</div></div>'
    + '</div>'
    + '<div class="detail-foot">'
      + '<div class="mod-team">'+modList+'</div>'
      + '<div class="detail-actions">'
        + '<button class="detail-flag" data-flag="'+b.id+'"><i class="fas fa-flag"></i> Flag board</button>'
        + '<a class="detail-link" href="../Pages/genre-hub.html?genre='+b.id+'">Open board <i class="fas fa-arrow-up-right-from-square"></i></a>'
      + '</div>'
    + '</div>'
  + '</div>';
}

function renderList(){
  const start = (page-1)*pageSize;
  const pageItems = filtered.slice(start, start+pageSize);
  const listEl = document.getElementById('boardList');

  if(!pageItems.length){
    listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i>No boards match your filters.</div>';
  } else {
    listEl.innerHTML = pageItems.map(function(b){
      const isOpen = !!openIds[b.id];
      return '<div class="board-item'+(isOpen?' open':'')+'" data-id="'+b.id+'">'
        + '<div class="board-row" data-toggle="'+b.id+'">'
          + '<div class="board-main"><div class="board-ico" style="background:'+BG_MAP[b.color]+';color:'+ICO_MAP[b.color]+'"><i class="fas '+b.icon+'"></i></div>'
          + '<div style="min-width:0"><div class="board-name">'+b.name+'</div>'
          + '<div class="board-sub"><span class="status-dot '+b.status+'"></span>'+b.status+' · active '+lastActive(b.lastActiveMin)+'</div></div></div>'
          + '<div>'+modStackHtml(b.mods)+'</div>'
          + '<div class="num-cell">'+fmtNum(b.members)+'</div>'
          + '<div class="num-cell faint">'+fmtNum(b.visits.d)+'</div>'
          + '<div class="num-cell col-hide faint">'+fmtNum(b.visits.w)+'</div>'
          + '<div class="num-cell faint">'+fmtNum(b.postsWeek)+'</div>'
          + '<div class="num-cell">'+growthHtml(b.growth)+'</div>'
          + '<div class="chev"><i class="fas fa-chevron-down"></i></div>'
        + '</div>'
        + detailHtml(b)
      + '</div>';
    }).join('');
  }
  renderFooter();
}

function renderFooter(){
  const total = filtered.length;
  const start = total === 0 ? 0 : (page-1)*pageSize+1;
  const end = Math.min(page*pageSize, total);
  document.getElementById('footerInfo').textContent = 'Showing '+start+'–'+end+' of '+total+' boards';

  const totalPages = Math.max(1, Math.ceil(total/pageSize));
  let html = '<button '+(page===1?'disabled':'')+' data-p="prev"><i class="fas fa-chevron-left"></i></button>';
  const pagesToShow = {};
  [1, totalPages, page, page-1, page+1].forEach(function(p){ if(p>=1 && p<=totalPages) pagesToShow[p]=1; });
  let last = 0;
  for(let p=1;p<=totalPages;p++){
    if(!pagesToShow[p]) continue;
    if(p - last > 1) html += '<span class="pager-gap">…</span>';
    html += '<button data-p="'+p+'" class="'+(p===page?'active':'')+'">'+p+'</button>';
    last = p;
  }
  html += '<button '+(page===totalPages?'disabled':'')+' data-p="next"><i class="fas fa-chevron-right"></i></button>';
  document.getElementById('pager').innerHTML = html;

  document.querySelectorAll('#pager button').forEach(function(btn){
    btn.addEventListener('click', function(){
      const p = btn.dataset.p;
      const totalPages2 = Math.max(1, Math.ceil(filtered.length/pageSize));
      if(p==='prev') page = Math.max(1, page-1);
      else if(p==='next') page = Math.min(totalPages2, page+1);
      else page = parseInt(p,10);
      renderList();
      document.querySelector('.panel').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('statusFilter').addEventListener('change', applyFilters);
document.getElementById('sortFilter').addEventListener('change', applyFilters);

document.getElementById('boardList').addEventListener('click', function(e){
  const flagBtn = e.target.closest('[data-flag]');
  if(flagBtn){
    e.stopPropagation();
    const b = BOARDS.find(function(x){ return x.id === flagBtn.dataset.flag; });
    if(b){
      toast(b.name + (b.reportsOpen > 0 ? ' already has open reports' : ' flagged for review'));
    }
    return;
  }
  const link = e.target.closest('a');
  if(link) return;
  const row = e.target.closest('[data-toggle]');
  if(!row) return;
  const id = row.dataset.toggle;
  const item = row.closest('.board-item');
  if(openIds[id]){ delete openIds[id]; item.classList.remove('open'); }
  else { openIds[id] = true; item.classList.add('open'); }
});

function init(){
  renderStatCards();
  document.getElementById('sortFilter').value = 'members';
  applyFilters();
}
init();
})();
