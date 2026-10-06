/**
 * payments-service.js — Payments page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = false;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[PaymentsService] backend unavailable, using demo data', e);
    return null;
  }
}

const PAYMENTS=[
  {id:'PYMT-0156',recipient:'Amara Okafor',amount:'$3,420.00',method:'Bank Transfer',status:'completed',date:'Jun 17, 2026'},
  {id:'PYMT-0155',recipient:'Sofia Lindqvist',amount:'$2,180.00',method:'PayPal',status:'completed',date:'Jun 17, 2026'},
  {id:'PYMT-0154',recipient:'Isabella Rossi',amount:'$4,500.00',method:'Mobile Money',status:'pending',date:'Jun 16, 2026'},
  {id:'PYMT-0153',recipient:'Marcus Chen',amount:'$980.00',method:'Bank Transfer',status:'completed',date:'Jun 15, 2026'},
  {id:'PYMT-0152',recipient:'Priya Nair',amount:'$1,560.00',method:'PayPal',status:'failed',date:'Jun 14, 2026'},
  {id:'PYMT-0151',recipient:'Layla Haddad',amount:'$2,890.00',method:'Bank Transfer',status:'completed',date:'Jun 13, 2026'},
  {id:'PYMT-0150',recipient:'Daniel Reyes',amount:'$450.00',method:'Mobile Money',status:'pending',date:'Jun 12, 2026'},
  {id:'PYMT-0149',recipient:'Julien Moreau',amount:'$320.00',method:'PayPal',status:'completed',date:'Jun 11, 2026'},
];
function statusPillHtml(s){const m={completed:{cls:'',label:'Completed'},pending:{cls:'pending',label:'Pending'},failed:{cls:'failed',label:'Failed'}}[s]||m.completed;return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`}
function currentFiltered(){const q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();const s=document.getElementById('statusSelect').value;let l=PAYMENTS;if(s)l=l.filter(r=>r.status===s);if(q)l=l.filter(r=>r.id.toLowerCase().includes(q)||r.recipient.toLowerCase().includes(q));return l}
function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function exportReport(){ return callBackend('/payments/export', { method:'POST' }).then(function(r){ if(!r) svcToast('Exporting payment report…'); }); }
function openDatePicker(){ svcToast('Date picker'); }
function openPaymentSettings(){ svcToast('Opening payment settings…'); }
function openReconciliation(){ svcToast('Opening reconciliation report…'); }
function viewPayment(id){ return callBackend('/payments/' + encodeURIComponent(id)).then(function(r){ if(!r) svcToast('Viewing payment…'); }); }
function moreActions(id){ svcToast('More actions…'); }
function renderTable(list){const b=document.getElementById('tableBody');if(!list.length){b.innerHTML=`<tr class="empty-row"><td colspan="7"><i class="fas fa-credit-card"></i>No payments match.</td></tr>`;return}
b.innerHTML=list.slice(0,8).map(r=>`<tr><td data-label="Payment ID" style="font-weight:700">${r.id}</td><td data-label="Recipient" style="font-weight:600">${r.recipient}</td><td data-label="Amount" style="font-weight:800">${r.amount}</td><td data-label="Method" style="font-weight:600">${r.method}</td><td data-label="Status">${statusPillHtml(r.status)}</td><td data-label="Date" style="font-weight:600">${r.date}</td><td data-label="Actions"><div class="actions-cell"><button class="act-btn" onclick="PaymentsService.viewPayment('${r.id}')"><i class="fas fa-eye"></i></button><button class="act-btn" onclick="PaymentsService.moreActions('${r.id}')"><i class="fas fa-ellipsis"></i></button></div></td></tr>`).join('')}
function renderPageInfo(c){const s=Math.min(8,c);document.getElementById('pageInfo').innerHTML=`Showing <b>${c?1:0}</b> to <b>${s}</b> of <b>181</b> payments`}
function refresh(){const l=currentFiltered();renderTable(l);renderPageInfo(l.length)}
function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3,4,5,'...',23];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>p==='...'?`<span style="color:var(--text-faint);font-size:12px;padding:0 2px">…</span>`:`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

var _bound=false;
function bindEvents(){
  if(_bound)return;_bound=true;
  document.getElementById('tableSearch').addEventListener('input',refresh);document.getElementById('statusSelect').addEventListener('change',refresh);
}

function init(){
  SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'payments',title:'Payments',subtitle:'Manage platform payments and disbursements',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,searchPlaceholder:'Search payments...',mobileSearchTarget:'#tableSearch',onSearch:(v)=>{document.getElementById('tableSearch').value=v;refresh()}});
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/payments').then(function (data) { if (data && data.payments) { refresh(); } });
  callBackend('/payments');
  bindEvents();
  renderPagination();refresh();
}

window.PaymentsService={init:init,exportReport:exportReport,openDatePicker:openDatePicker,openPaymentSettings:openPaymentSettings,openReconciliation:openReconciliation,viewPayment:viewPayment,moreActions:moreActions};

})();
