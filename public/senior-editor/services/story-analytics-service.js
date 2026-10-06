(function(){
'use strict';

/* ── Backend-ready header (for future API use; demo paths keep working) ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

var shell = null;
var allData = [];
var page = 1;
var PER_PAGE = 3;

async function init(){
  shell = SeniorEditorSidebar.attach('#saRoot',{activeItem:'story-analytics',title:'Story Analytics',subtitle:'Performance metrics',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4});

  // Future backend path (disabled by default; demo path keeps working):
  // const remote = await callBackend('/story-analytics');
  // if (remote) { allData = Array.isArray(remote) ? remote : (remote.stories || []); render(); return; }

  const d = await SeniorEditorData.getStoryAnalytics();
  allData = d.stories;
  render();
}

function render(){
  const total=Math.max(1,Math.ceil(allData.length/PER_PAGE));if(page>total)page=total;
  const start=(page-1)*PER_PAGE,items=allData.slice(start,start+PER_PAGE);
  document.getElementById('analyticsTable').querySelector('tbody').innerHTML=items.map(s=>`<tr><td><strong>${s.title}</strong></td><td>${s.author}</td><td>${s.reads.toLocaleString()}</td><td>${s.completions}%</td><td>${s.retention}%</td><td>${s.chapters}</td><td>${s.engagement}/10</td><td style="font-weight:700;color:var(--green)">${s.revenue}</td></tr>`).join('');
  if(total<=1){document.getElementById('pagination').innerHTML='';return;}
  let h=`<button class="page-btn" ${page<=1?'disabled':''} data-p="${page-1}"><i class="fas fa-chevron-left"></i></button>`;
  for(let i=1;i<=total;i++)h+=`<button class="page-btn ${i===page?'active':''}" data-p="${i}">${i}</button>`;
  h+=`<button class="page-btn" ${page>=total?'disabled':''} data-p="${page+1}"><i class="fas fa-chevron-right"></i></button>`;
  document.getElementById('pagination').innerHTML=h;
  document.querySelectorAll('#pagination .page-btn:not([disabled])').forEach(b=>b.addEventListener('click',()=>{page=parseInt(b.dataset.p);render();}));
}

window.StoryAnalyticsService = { init: init };

})();
