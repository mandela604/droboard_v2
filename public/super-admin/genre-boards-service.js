/**
 * genre-boards-service.js — Boards admin page controller.
 * Accordion list: summary columns on the row, full engagement stats on expand.
 * Metrics: members, new/wk, posts/wk, replies/post (discussion depth),
 * returning visitors %, daily/weekly/monthly visits, open mod reports,
 * growth. No story counts — boards are discussion-only.
 * A board is a chief-editor category; its genres are sections inside it, so the
 * crew shown here is the one team covering all of them.
 * Backend-ready: flip USE_API, point API_BASE at the live routes —
 *   GET  /api/super-admin/boards        (?q=&status=&sort=&page=&limit=)
 *   PUT  /api/super-admin/boards/:id/crew   {admins:[], moderators:[]}
 *   POST /api/super-admin/boards/:id/flag     {reason, note?, password}
 *   POST /api/super-admin/boards/:id/unflag   {password}
 */
(function(){
'use strict';
const USE_API = true, API_BASE = '/api';

SuperAdminSidebar.attach('#boardsRoot', {
  activeItem: 'genre-boards',
  title: 'Boards',
  subtitle: 'Every board, its moderation team & engagement stats',
  user: { name: 'Tobi Adenuga', role: 'Super Admin', avatar: 'https://i.pravatar.cc/100?img=68' },
  notifCount: 9,
  searchPlaceholder: 'Search everything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', gold:'var(--gold)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', gold:'var(--gold-bg)' };

/* ── DEMO DATASET — live swap: GET /api/super-admin/boards ── */
const API_BASE = '/api/super-admin/genre-boards';

async function callApi(path, opts){
  const res = await fetch(API_BASE + (path||''), { credentials:'include', ...opts });
  if(!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

let BOARDS = [];

async function loadBoards(){
  try {
    const data = await callApi('');
    BOARDS = Array.isArray(data) ? data : (data.items || []);
    renderStatCards();
    renderBoards();
  } catch(e){
    document.getElementById('boardGrid').innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> Failed to load genre boards: ${e.message}</div>`;
  }
}

const FLAG_REASONS = [
  'Hate speech or harassment',
  'Adult / NSFW content',
  'Spam or scam',
  'Unmoderated abuse',
  'Off-topic / misleading',
  'Other (see details)',
];

function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function todayLabel(){
  return new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

let filtered = BOARDS.slice();
let page = 1;
const pageSize = 10;
const openIds = {};
let flagBoardId = null;
let flagMode = 'flag';

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
    { n:String(BOARDS.length), l:'Boards', ico:'fa-th-large', cls:'gold' },
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
    if(status === 'flagged'){ if(!b.flagReason) return false; }
    else if(status && b.status !== status) return false;
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
  const flagBanner = b.flagReason
    ? '<div class="flag-banner"><i class="fas fa-flag"></i><div><b>Flagged — '+esc(b.flagReason)+'</b>'
      + (b.flagNote ? '<div class="flag-note">'+esc(b.flagNote)+'</div>' : '')
      + '<div class="flag-meta">Flagged by '+esc(b.flaggedBy || 'Super Admin')+' · '+esc(b.flaggedAt || '')+'</div></div></div>'
    : '';
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
    + flagBanner
    + '<div class="detail-foot">'
      + '<div class="mod-team">'+modList+'</div>'
      + '<div class="detail-actions">'
        + '<button class="detail-flag'+(b.flagReason ? ' on' : '')+'" data-flag="'+b.id+'"><i class="fas fa-flag'+(b.flagReason ? '-circle-check' : '')+'"></i> '+(b.flagReason ? 'Unflag board' : 'Flag board')+'</button>'
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
          + '<div style="min-width:0"><div class="board-name">'+b.name+(b.flagReason ? ' <i class="fas fa-flag row-flag" title="Flagged: '+esc(b.flagReason)+'"></i>' : '')+'</div>'
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
    if(b) openFlagModal(b);
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

/* ── Flag / unflag modal — same flow as the senior editor's book flag ── */
function ensureFlagModal(){
  if(document.getElementById('gbFlagOv')) return;
  var style = document.createElement('style');
  style.id = 'gbFlagCss';
  style.textContent = ''
    + '.gb-ov{position:fixed;inset:0;background:rgba(15,10,30,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}'
    + '.gb-ov.open{display:flex}'
    + '.gb-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:430px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px}'
    + '.gb-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}'
    + '.gb-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}'
    + '.gb-ico.red{background:var(--red-bg);color:var(--red)}.gb-ico.green{background:var(--green-bg);color:var(--green)}'
    + '.gb-title{font-size:15px;font-weight:800}.gb-sub{font-size:11.5px;color:var(--text-muted);margin-top:2px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.gb-x{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}'
    + '.gb-label{font-size:11px;font-weight:700;display:block;margin-bottom:5px}.gb-label span{color:var(--red)}'
    + '.gb-field{width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);font-family:inherit;outline:none;margin-bottom:12px}'
    + '.gb-field:focus{border-color:var(--accent)}textarea.gb-field{resize:vertical;min-height:64px}'
    + '.gb-hint{font-size:11px;color:var(--text-muted);line-height:1.5;margin-bottom:12px}'
    + '.gb-err{font-size:11.5px;color:var(--red);font-weight:600;min-height:16px;margin-bottom:8px}'
    + '.gb-actions{display:flex;gap:8px;justify-content:flex-end}'
    + '.gb-btn{font-size:12px;font-weight:700;padding:9px 16px;border-radius:9px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}'
    + '.gb-btn.danger{background:var(--red);border-color:transparent;color:#fff}.gb-btn.primary{background:var(--accent);border-color:transparent;color:#fff}.gb-btn:disabled{opacity:.5;cursor:default}';
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<div class="gb-ov" id="gbFlagOv"><div class="gb-modal">'
      + '<div class="gb-head"><div class="gb-ico red" id="gbFlagIco"><i class="fas fa-flag"></i></div>'
        + '<div><div class="gb-title" id="gbFlagHeading">Flag Board</div><div class="gb-sub" id="gbFlagBoard"></div></div>'
        + '<button class="gb-x" id="gbFlagX" type="button"><i class="fas fa-xmark"></i></button></div>'
      + '<div class="gb-hint" id="gbFlagHint"></div>'
      + '<div id="gbFlagReasonWrap"><label class="gb-label">Reason <span>*</span></label>'
        + '<select class="gb-field" id="gbFlagReason"><option value="">Select a reason…</option>'
        + FLAG_REASONS.map(function(r){ return '<option value="'+esc(r)+'">'+esc(r)+'</option>'; }).join('')
        + '</select></div>'
      + '<div id="gbFlagNoteWrap"><label class="gb-label">Details <span style="color:var(--text-faint)">(optional)</span></label>'
        + '<textarea class="gb-field" id="gbFlagNote" placeholder="Links, reports described, context…"></textarea></div>'
      + '<label class="gb-label">Your password <span>*</span></label>'
        + '<input type="password" class="gb-field" id="gbFlagPass" placeholder="Enter password to confirm" autocomplete="current-password"/>'
      + '<div class="gb-err" id="gbFlagErr"></div>'
      + '<div class="gb-actions"><button class="gb-btn" id="gbFlagCancel" type="button">Cancel</button>'
        + '<button class="gb-btn danger" id="gbFlagSubmit" type="button"><i class="fas fa-flag"></i> Flag Board</button></div>'
    + '</div></div>';
  document.body.appendChild(wrap.firstChild);

  document.getElementById('gbFlagCancel').addEventListener('click', closeFlagModal);
  document.getElementById('gbFlagX').addEventListener('click', closeFlagModal);
  document.getElementById('gbFlagSubmit').addEventListener('click', submitFlag);
  document.getElementById('gbFlagOv').addEventListener('click', function(e){ if(e.target === this) closeFlagModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeFlagModal(); });
}

function closeFlagModal(){
  var ov = document.getElementById('gbFlagOv');
  if(ov) ov.classList.remove('open');
}

function openFlagModal(b){
  ensureFlagModal();
  flagBoardId = b.id;
  flagMode = b.flagReason ? 'unflag' : 'flag';
  var isFlag = flagMode === 'flag';
  document.getElementById('gbFlagIco').className = 'gb-ico ' + (isFlag ? 'red' : 'green');
  document.getElementById('gbFlagIco').innerHTML = '<i class="fas fa-flag' + (isFlag ? '' : '-circle-check') + '"></i>';
  document.getElementById('gbFlagHeading').textContent = isFlag ? 'Flag Board' : 'Unflag Board';
  document.getElementById('gbFlagBoard').textContent = b.name;
  document.getElementById('gbFlagReasonWrap').style.display = isFlag ? '' : 'none';
  document.getElementById('gbFlagNoteWrap').style.display = isFlag ? '' : 'none';
  document.getElementById('gbFlagHint').textContent = isFlag
    ? 'A reason is required. Confirm with your account password — this action is logged.'
    : 'Confirm with your account password to restore this board.';
  document.getElementById('gbFlagReason').value = '';
  document.getElementById('gbFlagNote').value = '';
  document.getElementById('gbFlagPass').value = '';
  document.getElementById('gbFlagErr').textContent = '';
  var btn = document.getElementById('gbFlagSubmit');
  btn.innerHTML = '<i class="fas fa-flag"></i> ' + (isFlag ? 'Flag Board' : 'Unflag Board');
  btn.className = 'gb-btn ' + (isFlag ? 'danger' : 'primary');
  document.getElementById('gbFlagOv').classList.add('open');
  document.getElementById('gbFlagPass').focus();
}

function submitFlag(){
  var b = BOARDS.find(function(x){ return x.id === flagBoardId; });
  if(!b) return;
  var errEl = document.getElementById('gbFlagErr');
  errEl.textContent = '';
  var reason = flagMode === 'flag' ? document.getElementById('gbFlagReason').value : '';
  var note = flagMode === 'flag' ? document.getElementById('gbFlagNote').value.trim() : '';
  var pass = document.getElementById('gbFlagPass').value;
  if(flagMode === 'flag' && !reason){ errEl.textContent = 'Select a reason for flagging.'; return; }
  if(!pass){ errEl.textContent = 'Enter your password to confirm.'; return; }
  if(pass.length < 4){ errEl.textContent = 'Demo mode: password must be at least 4 characters.'; return; }

  if(flagMode === 'flag'){
    b.flagReason = reason;
    b.flagNote = note;
    b.flaggedAt = todayLabel();
    b.flaggedBy = 'Tobi Adenuga';
  } else {
    b.flagReason = '';
    b.flagNote = '';
    b.flaggedAt = '';
    b.flaggedBy = '';
  }
  closeFlagModal();
  toast(b.name + (flagMode === 'flag' ? ' flagged' : ' unflagged'));
  renderList();
}

function init(){
  loadBoards();
  document.getElementById('sortFilter').value = 'members';
  applyFilters();
}
init();
})();
