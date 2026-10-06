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

let LOGS=[];
function toast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
async function loadLogs(){const d=await SeniorEditorData.getActivityLogs();LOGS=d;refresh();renderPagination();}
function refresh(){const q=document.getElementById('tableSearch').value.toLowerCase();const a=document.getElementById('actionFilter').value;let l=LOGS;if(a)l=l.filter(r=>r.type===a);if(q)l=l.filter(r=>r.user.toLowerCase().includes(q)||r.action.toLowerCase().includes(q)||r.detail.toLowerCase().includes(q));renderTable(l);document.getElementById('pageInfo').innerHTML=`Showing <b>${l.length?1:0}</b> to <b>${Math.min(8,l.length)}</b> of <b>${LOGS.length}</b> activities`}
function renderTable(l){const b=document.getElementById('tableBody');if(!l.length){b.innerHTML=`<tr class="empty-row"><td colspan="6"><i class="fas fa-list-check"></i>No activities match.</td></tr>`;return}
b.innerHTML=l.slice(0,8).map(r=>`<tr><td data-label="User"><div class="act-user"><img src="${r.av}"/><span>${r.user}</span></div></td><td data-label="Action" class="act-action">${r.action}</td><td data-label="Type"><span class="act-type ${r.type}">${r.type.charAt(0).toUpperCase()+r.type.slice(1)}</span></td><td data-label="Details" class="detail-cell">${r.detail}</td><td data-label="IP Address" style="font-family:monospace;font-size:12px;color:var(--text-faint)">${r.ip}</td><td data-label="Timestamp" class="time-cell">${r.time}</td></tr>`).join('')}
function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

function init(){
  SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'activity-logs',title:'Activity Logs',subtitle:'Track and monitor all platform activities and user actions',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,searchPlaceholder:'Search by user, action, or detail...',mobileSearchTarget:'#tableSearch',onSearch:(v)=>{document.getElementById('tableSearch').value=v;refresh()}});
  document.getElementById('tableSearch').addEventListener('input',refresh);document.getElementById('actionFilter').addEventListener('change',refresh);
  return loadLogs();
}

function exportLogs(){ return callBackend('/activity-logs/export', { method:'POST' }).then(function(r){ if(!r) toast('Exporting activity logs…'); }); }
function openDatePicker(){ toast('Date picker'); }
function openFilters(){ toast('Filters'); }

window.ActivityLogsService = { init, exportLogs, openDatePicker, openFilters };

})();
