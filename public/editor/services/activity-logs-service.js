/* activity-logs-service.js — Activity Logs page logic (backend-ready).
 * Demo mode: USE_API=false keeps all demo paths working.
 * Flip USE_API=true and point API_BASE at the real backend to go live. */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    const res = await fetch(API_BASE + path, options || {});
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     ATTACH THE SHARED SHELL
     ═══════════════════════════════════════════════════════════ */
  function attachShell() {
    DroboardShell.attach('#dashboardRoot',{activeFile:'activity-logs.html',title:'Activity Logs',subtitle:'Track and monitor all platform activities and user actions',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,searchPlaceholder:'Search by user, action, or detail...',mobileSearchTarget:'#tableSearch',onSearch:(v)=>{document.getElementById('tableSearch').value=v;refresh()}});
  }

  const LOGS=[
  {user:'Reina Morgan',av:'https://i.pravatar.cc/100?img=47',action:'Approved contract CNTR-2026-00125',type:'update',detail:'Signed Exclusive Publishing Agreement for "Bound by the Ruthless Alpha"',ip:'192.168.1.42',time:'Jun 17, 2026 10:24 AM'},
  {user:'System',av:'https://i.pravatar.cc/100?img=3',action:'Processed payout batch',type:'create',detail:'Monthly payout of $12,840 disbursed to 24 authors',ip:'—',time:'Jun 17, 2026 09:00 AM'},
  {user:'Daniel Carter',av:'https://i.pravatar.cc/100?img=12',action:'Updated book status: Published',type:'update',detail:'"He Deleted Our Photos" status changed to Published',ip:'10.0.0.15',time:'Jun 16, 2026 04:15 PM'},
  {user:'Sophia Bennett',av:'https://i.pravatar.cc/100?img=29',action:'Verified author: Sofia Lindqvist',type:'create',detail:'Author verification approved - Sofia Lindqvist',ip:'10.0.0.22',time:'Jun 16, 2026 02:30 PM'},
  {user:'Reina Morgan',av:'https://i.pravatar.cc/100?img=47',action:'Created announcement',type:'create',detail:'New announcement: "Introducing Book Analytics"',ip:'192.168.1.42',time:'Jun 16, 2026 11:20 AM'},
  {user:'Ethan Walker',av:'https://i.pravatar.cc/100?img=53',action:'Flagged content as inappropriate',type:'update',detail:'Flagged Chapter 12 in "The Ruthless CEO"',ip:'10.0.0.8',time:'Jun 15, 2026 09:45 AM'},
  {user:'System',av:'https://i.pravatar.cc/100?img=3',action:'Automated backup completed',type:'create',detail:'Daily system backup completed successfully (2.4 GB)',ip:'—',time:'Jun 15, 2026 03:00 AM'},
  {user:'Marcus Webb',av:'https://i.pravatar.cc/100?img=33',action:'Rejected author verification',type:'delete',detail:'Verification rejected for Tobias Bergman - insufficient documents',ip:'10.0.0.5',time:'Jun 14, 2026 01:10 PM'},
  ];
  function refresh(){const q=document.getElementById('tableSearch').value.toLowerCase();const a=document.getElementById('actionFilter').value;let l=LOGS;if(a)l=l.filter(r=>r.type===a);if(q)l=l.filter(r=>r.user.toLowerCase().includes(q)||r.action.toLowerCase().includes(q)||r.detail.toLowerCase().includes(q));renderTable(l);document.getElementById('pageInfo').innerHTML=`Showing <b>${l.length?1:0}</b> to <b>${Math.min(8,l.length)}</b> of <b>12,847</b> activities`}
  function renderTable(l){const b=document.getElementById('tableBody');if(!l.length){b.innerHTML=`<tr class="empty-row"><td colspan="6"><i class="fas fa-list-check"></i>No activities match.</td></tr>`;return}
  b.innerHTML=l.slice(0,8).map(r=>`<tr><td data-label="User"><div class="act-user"><img src="${r.av}"/><span>${r.user}</span></div></td><td data-label="Action" class="act-action">${r.action}</td><td data-label="Type"><span class="act-type ${r.type}">${r.type.charAt(0).toUpperCase()+r.type.slice(1)}</span></td><td data-label="Details" class="detail-cell">${r.detail}</td><td data-label="IP Address" style="font-family:monospace;font-size:12px;color:var(--text-faint)">${r.ip}</td><td data-label="Timestamp" class="time-cell">${r.time}</td></tr>`).join('')}
  function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3,4,5,'...',1606];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>p==='...'?`<span style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>`:`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

  function bindEvents(){
    document.getElementById('tableSearch').addEventListener('input',refresh);document.getElementById('actionFilter').addEventListener('change',refresh);
  }

  function init(){
    attachShell();
    bindEvents();
    renderPagination();refresh();
  }

  window.ActivityLogsService = { init: init };
})();
