/**
 * withdrawal-requests-service.js — Withdrawal Requests page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and point API_BASE at the real API
 * to fetch data via callBackend(); demo paths keep working with local data.
 */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    try {
      const res = await fetch(API_BASE + path, options || {});
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  const WITHDRAWALS=[
    {id:'WD-0047',author:'Amara Okafor',avatar:'https://i.pravatar.cc/100?img=45',amount:'$2,450.00',method:'Bank Transfer',status:'pending',requested:'Jun 17, 2026',processed:'—'},
    {id:'WD-0046',author:'Sofia Lindqvist',avatar:'https://i.pravatar.cc/100?img=32',amount:'$1,820.00',method:'PayPal',status:'processing',requested:'Jun 16, 2026',processed:'Jun 17, 2026'},
    {id:'WD-0045',author:'Isabella Rossi',avatar:'https://i.pravatar.cc/100?img=38',amount:'$3,100.00',method:'Mobile Money',status:'completed',requested:'Jun 14, 2026',processed:'Jun 16, 2026'},
    {id:'WD-0044',author:'Marcus Chen',avatar:'https://i.pravatar.cc/100?img=12',amount:'$980.00',method:'Bank Transfer',status:'pending',requested:'Jun 13, 2026',processed:'—'},
    {id:'WD-0043',author:'Priya Nair',avatar:'https://i.pravatar.cc/100?img=27',amount:'$1,560.00',method:'PayPal',status:'completed',requested:'Jun 12, 2026',processed:'Jun 14, 2026'},
    {id:'WD-0042',author:'Layla Haddad',avatar:'https://i.pravatar.cc/100?img=48',amount:'$2,890.00',method:'Bank Transfer',status:'processing',requested:'Jun 11, 2026',processed:'Jun 13, 2026'},
    {id:'WD-0041',author:'Daniel Reyes',avatar:'https://i.pravatar.cc/100?img=51',amount:'$450.00',method:'Mobile Money',status:'pending',requested:'Jun 10, 2026',processed:'—'},
    {id:'WD-0040',author:'Julien Moreau',avatar:'https://i.pravatar.cc/100?img=15',amount:'$320.00',method:'PayPal',status:'rejected',requested:'Jun 9, 2026',processed:'Jun 11, 2026'},
  ];
  let currentView='all';
  function statusPillHtml(s){const m={pending:{cls:'pending',label:'Pending'},processing:{cls:'processing',label:'Processing'},completed:{cls:'completed',label:'Completed'},rejected:{cls:'rejected',label:'Rejected'}}[s]||{cls:'pending',label:'Pending'};return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`}
  function viewSource(){if(currentView==='all')return WITHDRAWALS;return WITHDRAWALS.filter(r=>r.status===currentView)}
  function currentFiltered(){const q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();const s=document.getElementById('statusSelect').value;let l=viewSource();if(s)l=l.filter(r=>r.status===s);if(q)l=l.filter(r=>r.id.toLowerCase().includes(q)||r.author.toLowerCase().includes(q)||r.amount.toLowerCase().includes(q));return l}
  function renderTable(list){const b=document.getElementById('tableBody');if(!list.length){b.innerHTML=`<tr class="empty-row"><td colspan="7"><i class="fas fa-money-bill-wave"></i>No requests match this search.</td></tr>`;return}
  b.innerHTML=list.slice(0,8).map(r=>`<tr><td data-label="Author"><div class="auth-cell"><img src="${r.avatar}" alt=""/><span>${r.author}</span></div></td><td data-label="Amount" class="amount-cell">${r.amount}</td><td data-label="Method" style="font-weight:600">${r.method}</td><td data-label="Status">${statusPillHtml(r.status)}</td><td data-label="Requested" style="font-weight:600">${r.requested}</td><td data-label="Processed" style="color:var(--text-muted)">${r.processed}</td><td data-label="Actions"><div class="actions-cell"><button class="act-btn" title="View" onclick="toast('Opening withdrawal details…')"><i class="fas fa-eye"></i></button><button class="act-btn" title="Approve" onclick="toast('Approving withdrawal…')"><i class="fas fa-check"></i></button><button class="act-btn" title="More" onclick="toast('More actions…')"><i class="fas fa-ellipsis"></i></button></div></td></tr>`).join('')}
  function renderPageInfo(c){const t={all:47,pending:12,processing:8,completed:24,rejected:3};const total=t[currentView]??c;const s=Math.min(8,c);document.getElementById('pageInfo').innerHTML=`Showing <b>${c?1:0}</b> to <b>${s}</b> of <b>${total.toLocaleString()}</b> requests`}
  function refresh(){const l=currentFiltered();renderTable(l);renderPageInfo(l.length)}
  function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3,4,5,6];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

  function bindEvents(){
    document.querySelectorAll('.sub-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');currentView=tab.dataset.view;document.getElementById('statusSelect').value='';renderPagination();refresh()})});
    document.getElementById('tableSearch').addEventListener('input',refresh);document.getElementById('statusSelect').addEventListener('change',(e)=>{const s=e.target.value;currentView=s||'all';document.querySelectorAll('.sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===currentView));renderPagination();refresh()});
  }

  let _inited = false;

  function init(){
    DroboardShell.attach('#dashboardRoot',{activeFile:'withdrawal-requests.html',title:'Withdrawal Requests',subtitle:'Manage and process author withdrawal requests',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,searchPlaceholder:'Search by author, amount, or ID...',mobileSearchTarget:'#tableSearch',onSearch:(v)=>{document.getElementById('tableSearch').value=v;refresh()}});
    if (_inited) { refresh(); return; }
    _inited = true;
    bindEvents();
    renderPagination();refresh();
  }

  window.WithdrawalRequestsService = { init: init };

})();
