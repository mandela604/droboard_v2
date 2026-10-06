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
var plag = [], compl = [], plagP = 1, compP = 1;
var PP = 3;

async function init(){
  shell = SeniorEditorSidebar.attach('#rcRoot',{activeItem:'reports-compliance',title:'Reports & Compliance',subtitle:'Content review & enforcement',user:{name:'Chioma Reddy',role:'Senior Editor',avatar:'https://i.pravatar.cc/100?img=5'},notifCount:4});

  // Future backend path (disabled by default; demo path keeps working):
  // const remote = await callBackend('/reports-compliance');
  // if (remote) { plag = remote.plagiarism || []; compl = remote.complaints || []; renderPlag(); renderComp(); /* violations */ return; }

  const d = await SeniorEditorData.getReports();
  plag = d.plagiarism;
  compl = d.complaints;
  renderPlag();
  renderComp();
  document.getElementById('violationsList').innerHTML=d.violations.map(v=>`<div class="case-card"><div class="cc-title">${v.story} — ${v.type} <span class="status-pill ${v.status}">${v.status}</span></div><div class="cc-meta"><span>📅 ${v.filed}</span><span>✅ ${v.action}</span></div></div>`).join('');
}

function renderPlag(){
  const t=Math.max(1,Math.ceil(plag.length/PP));if(plagP>t)plagP=t;
  const s=(plagP-1)*PP;document.getElementById('plagCount').textContent=`(${plag.length})`;
  document.getElementById('plagiarismList').innerHTML=plag.slice(s,s+PP).map(p=>`<div class="case-card"><div class="cc-title">"${p.story}" <span class="status-pill ${p.status}">${p.status}</span></div><div class="cc-detail">${p.notes}</div><div class="cc-meta"><span>🔍 ${p.confidence}% match</span><span>📅 ${p.filed}</span></div></div>`).join('');
  if(t<=1){document.getElementById('plagPag').innerHTML='';return;}
  let h='';for(let i=1;i<=t;i++)h+=`<button class="page-btn ${i===plagP?'active':''}" data-p="${i}">${i}</button>`;
  document.getElementById('plagPag').innerHTML=h;
  document.querySelectorAll('#plagPag .page-btn').forEach(b=>b.addEventListener('click',()=>{plagP=parseInt(b.dataset.p);renderPlag();}));
}

function renderComp(){
  const t=Math.max(1,Math.ceil(compl.length/PP));if(compP>t)compP=t;
  const s=(compP-1)*PP;document.getElementById('compCount').textContent=`(${compl.length})`;
  document.getElementById('complaintsList').innerHTML=compl.slice(s,s+PP).map(c=>`<div class="case-card"><div class="cc-title">${c.type} <span class="status-pill ${c.status}">${c.status}</span></div><div class="cc-detail">${c.detail}</div><div class="cc-meta"><span>👤 ${c.reader} → ${c.against}</span><span>📅 ${c.filed}</span></div></div>`).join('');
  if(t<=1){document.getElementById('compPag').innerHTML='';return;}
  let h='';for(let i=1;i<=t;i++)h+=`<button class="page-btn ${i===compP?'active':''}" data-p="${i}">${i}</button>`;
  document.getElementById('compPag').innerHTML=h;
  document.querySelectorAll('#compPag .page-btn').forEach(b=>b.addEventListener('click',()=>{compP=parseInt(b.dataset.p);renderComp();}));
}

window.ReportsComplianceService = { init: init };

})();
