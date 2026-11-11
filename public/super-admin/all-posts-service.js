/**
 * all-posts-service.js — All Posts page controller.
 * Live API only, no hardcoded demo posts.
 */
(function(){
'use strict';
const USE_API = true, API_BASE = '/api/super-admin';

var shell = SuperAdminSidebar.attach('#postsRoot',{
  activeItem:'all-posts',
  title:'All Posts',
  subtitle:'Every post across the platform',
  user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'},
  notifCount:9,
  searchPlaceholder:'Search everything...',
});

var ICO={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',purple:'var(--purple)',green:'var(--green)',gold:'var(--gold)',accent:'var(--accent)'};
var BG={red:'var(--red-bg)',amber:'var(--amber-bg)',blue:'var(--blue-bg)',purple:'var(--purple-bg)',green:'var(--green-bg)',gold:'var(--gold-bg)',accent:'rgba(255,0,80,.1)'};

var TYPE_CONFIG={
  'post':          {color:'blue',   icon:'fa-comment',   label:'Post'},
  'chapter-drop':  {color:'purple', icon:'fa-book-open',  label:'Chapter Drop'},
  'ama':           {color:'accent', icon:'fa-microphone', label:'AMA'},
  'quote':         {color:'gold',   icon:'fa-quote-left', label:'Quote'},
  'repost':        {color:'blue',   icon:'fa-retweet',    label:'Repost'},
  'poll':          {color:'green',  icon:'fa-chart-bar',  label:'Poll'},
  'debate':        {color:'amber',  icon:'fa-scale-balanced', label:'Debate'},
  'review':        {color:'gold',   icon:'fa-star',       label:'Review'},
  'recommendation':{color:'green',  icon:'fa-thumbs-up',  label:'Recommendation'}
};

var POSTS=[];
var filtered=[];
var page=1;
var pageSize=25;
var openRowId=null;

function showError(msg){
  document.getElementById('postList').innerHTML='<div class="empty-state" style="color:var(--red)"><i class="fas fa-circle-exclamation"></i> '+msg+'</div>';
  document.getElementById('statCards').innerHTML='';
}

async function loadPosts(){
  try {
    var res = await fetch(API_BASE+'/posts?limit=200', { credentials:'include' });
    if(!res.ok) throw new Error('API error '+res.status);
    var data = await res.json();
    POSTS = Array.isArray(data) ? data : (data.items || []);
    filtered = POSTS.slice();
    renderStatCards();
    applyFilters();
  } catch(e) {
    showError('Failed to load posts: '+e.message);
  }
}

function fmtNum(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n);}
function fmtHours(h){if(h===0)return'Just now';if(h<24)return h+'h ago';if(h<24*30)return Math.floor(h/24)+'d ago';return Math.floor(h/(24*30))+'mo ago';}
function authorName(p){return p.author?p.author.name:'Unknown';}
function authorId(p){return p.author?p.author.id:'';}

function getPreviewText(p){
  if(p.text)return p.text;
  if(p.quote)return'\u201c'+p.quote.substring(0,100)+(p.quote.length>100?'...':'')+'\u201d';
  if(p.note)return p.note;
  if(p.amaData)return p.amaData.title;
  if(p.chapterRef)return p.chapterRef.title+' \u2014 '+p.chapterRef.ch;
  if(p.poll)return p.poll.question;
  if(p.debateData)return p.debateData.question;
  if(p.reviewText)return p.reviewText.substring(0,100)+'...';
  if(p.storyRef)return p.storyRef.title;
  return '';
}

function getPostUrl(p){
  return '../Pages/discussion.html?post='+p.id;
}

function renderStatCards(){
  var total=POSTS.length;
  var published=POSTS.filter(function(p){return p.status==='published';}).length;
  var flagged=POSTS.filter(function(p){return p.status==='flagged';}).length;
  var underReview=POSTS.filter(function(p){return p.status==='under-review';}).length;
  document.getElementById('totalCountLbl') && (document.getElementById('totalCountLbl').textContent=fmtNum(total));
  var stats=[
    {n:fmtNum(total),l:'Total Posts',ico:'fa-rss',cls:'gold'},
    {n:fmtNum(published),l:'Published',ico:'fa-circle-check',cls:'green'},
    {n:flagged,l:'Flagged',ico:'fa-flag',cls:'red'},
    {n:underReview,l:'Under Review',ico:'fa-clock',cls:'amber'}
  ];
  document.getElementById('statCards').innerHTML=stats.map(function(s){
    return '<div class="stat-card"><div class="stat-ico" style="background:'+BG[s.cls]+';color:'+ICO[s.cls]+'"><i class="fas '+s.ico+'"></i></div><div><div class="stat-num">'+s.n+'</div><div class="stat-lbl">'+s.l+'</div></div></div>';
  }).join('');
}

function applyFilters(){
  var q=document.getElementById('searchInput').value.trim().toLowerCase();
  var type=document.getElementById('typeFilter').value;
  var status=document.getElementById('statusFilter').value;
  var sort=document.getElementById('sortFilter').value;

  filtered=POSTS.filter(function(p){
    var txt=(p.text||p.quote||p.note||'').toLowerCase();
    var name=authorName(p).toLowerCase();
    if(q&&txt.indexOf(q)===-1&&name.indexOf(q)===-1&&p.id.indexOf(q)===-1)return false;
    if(type&&p.type!==type)return false;
    if(status&&p.status!==status)return false;
    return true;
  });

  if(sort==='recent')filtered.sort(function(a,b){return (a.hoursAgo||0)-(b.hoursAgo||0);});
  else if(sort==='views')filtered.sort(function(a,b){return (b.views||0)-(a.views||0);});
  else if(sort==='likes')filtered.sort(function(a,b){return (b.likes||0)-(a.likes||0);});
  else if(sort==='comments')filtered.sort(function(a,b){return (b.comments||0)-(a.comments||0);});

  page=1;
  openRowId=null;
  renderList();
}

function renderList(){
  var start=(page-1)*pageSize;
  var pageItems=filtered.slice(start,start+pageSize);
  var listEl=document.getElementById('postList');

  if(!pageItems.length){
    listEl.innerHTML='<div class="empty-state"><i class="fas fa-inbox"></i>No posts match your filters.</div>';
  }else{
    listEl.innerHTML=pageItems.map(function(p){
      var tc=TYPE_CONFIG[p.type]||TYPE_CONFIG['post'];
      var color=ICO[tc.color]||'var(--text-faint)';
      var bg=BG[tc.color]||'var(--table-head)';
      var isOpen=openRowId===p.id;
      var preview=getPreviewText(p);
      var statusClass=p.status==='under-review'?'under-review':p.status;
      return '<div>'+
        '<div class="post-row'+(isOpen?' is-open':'')+'" data-id="'+p.id+'">'+
          '<i class="fas fa-chevron-right expand-ico"></i>'+
          '<div class="post-main">'+
            (p.author&&p.author.avatar?'<img class="post-avatar" src="'+p.author.avatar+'" alt=""/>':'')+
            '<div class="post-info">'+
              '<a class="post-title-link" href="'+getPostUrl(p)+'" onclick="event.stopPropagation()">'+preview+'</a>'+
              '<div class="post-meta">by <a href="../Pages/profile.html?id='+authorId(p)+'">'+authorName(p)+'</a> \u00b7 '+p.id+'</div>'+
            '</div>'+
          '</div>'+
          '<div class="col-type"><span class="type-chip" style="background:'+bg+';color:'+color+'"><i class="fas '+tc.icon+'"></i> '+tc.label+'</span></div>'+
          '<div class="col-hide num-cell">'+fmtNum(p.views||0)+'</div>'+
          '<div class="num-cell faint">'+fmtNum(p.comments||0)+'</div>'+
          '<div><span class="status-chip '+statusClass+'"><i class="fas fa-circle"></i> '+p.status.replace('-',' ')+'</span></div>'+
          '<div class="col-date" style="font-size:11px;color:var(--text-faint)">'+(p.hoursAgo!=null?fmtHours(p.hoursAgo):(p.createdAt?new Date(p.createdAt).toLocaleDateString():''))+'</div>'+
        '</div>'+
        '<div class="post-detail'+(isOpen?' show':'')+'" id="detail-'+p.id+'"></div>'+
      '</div>';
    }).join('');
  }
  if(openRowId&&pageItems.some(function(p){return p.id===openRowId;}))renderDetailPanel(openRowId);
  renderFooter();
}

function renderDetailPanel(id){
  var p=POSTS.find(function(x){return x.id===id;});
  if(!p)return;
  var panel=document.getElementById('detail-'+id);
  if(!panel)return;
  var tc=TYPE_CONFIG[p.type]||TYPE_CONFIG['post'];
  var color=ICO[tc.color]||'var(--text-faint)';
  var html='<div class="detail-inner">';
  html+='<div class="detail-section"><div class="ds-label"><i class="fas fa-chart-simple"></i> Post Stats</div><div class="detail-grid">';
  html+='<div class="detail-item accent"><span>Likes</span><b>'+fmtNum(p.likes||0)+'</b></div>';
  html+='<div class="detail-item"><span>Comments</span><b>'+fmtNum(p.comments||0)+'</b></div>';
  html+='<div class="detail-item green"><span>Views</span><b>'+fmtNum(p.views||0)+'</b></div>';
  html+='<div class="detail-item"><span>Type</span><b>'+tc.label+'</b></div>';
  html+='</div></div>';
  html+='<div class="detail-foot">';
  html+='<a class="mini-btn primary" href="'+getPostUrl(p)+'" target="_blank"><i class="fas fa-arrow-up-right-from-square"></i> View Post</a>';
  html+='<a class="mini-btn" href="../Pages/profile.html?id='+authorId(p)+'"><i class="fas fa-user"></i> View Author</a>';
  html+='</div></div>';
  panel.innerHTML=html;
}

function renderFooter(){
  var total=filtered.length;
  var start=total===0?0:(page-1)*pageSize+1;
  var end=Math.min(page*pageSize,total);
  document.getElementById('footerInfo').textContent='Showing '+start+'\u2013'+end+' of '+fmtNum(total)+' posts';
  var totalPages=Math.max(1,Math.ceil(total/pageSize));
  var html='<button '+(page===1?'disabled':'')+' data-p="prev"><i class="fas fa-chevron-left"></i></button>';
  var pagesToShow=new Set([1,totalPages,page,page-1,page+1]);
  var last=0;
  for(var pg=1;pg<=totalPages;pg++){
    if(!pagesToShow.has(pg))continue;
    if(pg-last>1)html+='<span class="pager-gap">\u2026</span>';
    html+='<button data-p="'+pg+'" class="'+(pg===page?'active':'')+'">'+pg+'</button>';
    last=pg;
  }
  html+='<button '+(page===totalPages?'disabled':'')+' data-p="next"><i class="fas fa-chevron-right"></i></button>';
  document.getElementById('pager').innerHTML=html;
  document.querySelectorAll('#pager button').forEach(function(btn){
    btn.addEventListener('click',function(){
      var pp=btn.dataset.p;
      var totalPages2=Math.max(1,Math.ceil(filtered.length/pageSize));
      if(pp==='prev')page=Math.max(1,page-1);
      else if(pp==='next')page=Math.min(totalPages2,page+1);
      else page=parseInt(pp,10);
      renderList();
      document.querySelector('.panel').scrollIntoView({behavior:'smooth',block:'start'});
    });
  });
}

document.addEventListener('click',function(e){
  var postRow=e.target.closest('.post-row');
  if(postRow&&!e.target.closest('a')){
    var id=postRow.dataset.id;
    openRowId=openRowId===id?null:id;
    renderList();
  }
});

document.getElementById('searchInput').addEventListener('input',applyFilters);
document.getElementById('typeFilter').addEventListener('change',applyFilters);
document.getElementById('statusFilter').addEventListener('change',applyFilters);
document.getElementById('sortFilter').addEventListener('change',applyFilters);
document.getElementById('reviewFlaggedBtn')&&document.getElementById('reviewFlaggedBtn').addEventListener('click',function(){
  document.getElementById('statusFilter').value='flagged';
  applyFilters();
});

loadPosts();
})();
