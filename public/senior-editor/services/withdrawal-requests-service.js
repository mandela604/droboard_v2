/**
 * withdrawal-requests-service.js — Withdrawal Requests page logic (pure call-and-render). */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[WithdrawalRequestsService] backend unavailable, using demo data', e);
    return null;
  }
}

/* Author withdrawals settle in dollars; the column is restated in the currency
   Super Admin set (usdToMoney accepts the live number or the seeded '$2,450.00'). */
function money(n){ if(window.DroboardCurrency && DroboardCurrency.usdToMoney) return DroboardCurrency.usdToMoney(n); return typeof n==='string' ? n : '$' + Number(n||0).toLocaleString('en-US'); }

const WITHDRAWALS=[];

let currentView='all';
let _bound=false;

function statusPillHtml(s){const m={pending:{cls:'pending',label:'Pending'},processing:{cls:'processing',label:'Processing'},completed:{cls:'completed',label:'Completed'},rejected:{cls:'rejected',label:'Rejected'}}[s]||m.pending;return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`}
function viewSource(){if(currentView==='all')return WITHDRAWALS;return WITHDRAWALS.filter(r=>r.status===currentView)}
function currentFiltered(){const q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();const s=document.getElementById('statusSelect').value;let l=viewSource();if(s)l=l.filter(r=>r.status===s);if(q)l=l.filter(r=>r.id.toLowerCase().includes(q)||r.author.toLowerCase().includes(q)||String(r.amount).toLowerCase().includes(q));return l}
function renderTable(list){const b=document.getElementById('tableBody');if(!list.length){b.innerHTML=`<tr class="empty-row"><td colspan="7"><i class="fas fa-money-bill-wave"></i>No requests match this search.</td></tr>`;return}
b.innerHTML=list.slice(0,8).map(r=>`<tr><td data-label="Author"><div class="auth-cell"><img src="${r.avatar}" alt=""/><span>${r.author}</span></div></td><td data-label="Amount" class="amount-cell">${money(r.amount)}</td><td data-label="Method" style="font-weight:600">${r.method}</td><td data-label="Status">${statusPillHtml(r.status)}</td><td data-label="Requested" style="font-weight:600">${r.requested}</td><td data-label="Processed" style="color:var(--text-muted)">${r.processed}</td><td data-label="Actions"><div class="actions-cell"><button class="act-btn" title="View" onclick="toast('Opening withdrawal details…')"><i class="fas fa-eye"></i></button><button class="act-btn" title="Approve" onclick="toast('Approving withdrawal…')"><i class="fas fa-check"></i></button><button class="act-btn" title="More" onclick="toast('More actions…')"><i class="fas fa-ellipsis"></i></button></div></td></tr>`).join('')}
function renderPageInfo(c){const t={all:47,pending:12,processing:8,completed:24,rejected:3};const total=t[currentView]??c;const s=Math.min(8,c);document.getElementById('pageInfo').innerHTML=`Showing <b>${c?1:0}</b> to <b>${s}</b> of <b>${total.toLocaleString()}</b> requests`}
function refresh(){const l=currentFiltered();renderTable(l);renderPageInfo(l.length)}
function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3,4,5,6];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

async function loadWithdrawals(){
  const data = await callBackend('/withdrawal-requests');
  if (data && Array.isArray(data.items)) {
    WITHDRAWALS = data.items.map(w => ({
      id: w.id,
      author: w.author || '',
      avatar: w.avatar || '',
      amount: Number(w.amount) || 0,
      method: w.method || '',
      status: w.status || 'pending',
      requested: w.requested || w.requestedAt || '',
      processed: w.processed || w.processedAt || '—'
    }));
    refresh();
  }
}

function attachShell(){
  if(!window.SeniorEditorSidebar||!window.SeniorEditorSidebar.attach)return;
  (async function() {
    const user = await (window.SeniorEditorGetUser || (async () => null))();
    SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'withdrawal-requests',title:'Withdrawal Requests',subtitle:'Manage and process author withdrawal requests',user:null,notifCount:0,searchPlaceholder:'Search by author, amount, or ID...',mobileSearchTarget:'#tableSearch',onSearch:(v)=>{document.getElementById('tableSearch').value=v;refresh()}});
  })();
}

function bindEvents(){
  if(_bound)return;_bound=true;
  document.querySelectorAll('.sub-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');currentView=tab.dataset.view;document.getElementById('statusSelect').value='';renderPagination();refresh()})});
  document.getElementById('tableSearch').addEventListener('input',refresh);
  document.getElementById('statusSelect').addEventListener('change',(e)=>{const s=e.target.value;currentView=s||'all';document.querySelectorAll('.sub-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===currentView));renderPagination();refresh()});
}

function init(){
  attachShell();
  window.refresh=refresh;
  loadWithdrawals();
  bindEvents();
  renderPagination();refresh();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function openSettings(){ return callBackend('/withdrawal-settings').then(function(r){ if(!r) svcToast('Opening withdrawal settings…'); }); }
function openFilters(){ svcToast('Opening filters…'); }

window.WithdrawalRequestsService={init:init,openSettings:openSettings,openFilters:openFilters};

})();
