/**
 * editor-bill-review-service.js — My Earnings page logic (pure call-and-render).
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
    console.warn('[EditorBillReviewService] backend unavailable, using demo data', e);
    return null;
  }
}

var txns=[
  {id:'TXN-001',type:'earning',title:'The CEO\'s Hidden Son — Ch.24',book:'The CEO\'s Hidden Son',amount:'+ $180.00',num:180,date:'Jun 20, 2026',status:'completed',desc:'Chapter read revenue. 2,400 reads.'},
  {id:'TXN-002',type:'earning',title:'The CEO\'s Hidden Son — Ch.23',book:'The CEO\'s Hidden Son',amount:'+ $145.00',num:145,date:'Jun 19, 2026',status:'completed',desc:'Chapter read revenue. 1,920 reads.'},
  {id:'TXN-003',type:'withdrawal',title:'Withdrawal to GTBank',book:'',amount:'- $1,200.00',num:-1200,date:'Jun 18, 2026',status:'completed',desc:'Processed and paid to GTBank · · · · 4821.'},
  {id:'TXN-004',type:'earning',title:'Billionaire\'s Forbidden Love — Bonus',book:'Billionaire\'s Forbidden Love',amount:'+ $500.00',num:500,date:'Jun 17, 2026',status:'completed',desc:'Completion bonus for finishing the series.'},
  {id:'TXN-005',type:'earning',title:'The CEO\'s Hidden Son — Ch.22',book:'The CEO\'s Hidden Son',amount:'+ $165.00',num:165,date:'Jun 16, 2026',status:'completed',desc:'Chapter read revenue. 2,180 reads.'},
  {id:'TXN-006',type:'withdrawal',title:'Withdrawal to PayPal',book:'',amount:'- $850.00',num:-850,date:'Jun 15, 2026',status:'processing',desc:'Processing. Will arrive in 1-2 business days.'},
  {id:'TXN-007',type:'earning',title:'Billionaire\'s Forbidden Love — Ch.18',book:'Billionaire\'s Forbidden Love',amount:'+ $95.00',num:95,date:'Jun 14, 2026',status:'completed',desc:'Chapter read revenue. 1,260 reads.'},
  {id:'TXN-008',type:'earning',title:'The CEO\'s Hidden Son — Ch.21',book:'The CEO\'s Hidden Son',amount:'+ $155.00',num:155,date:'Jun 13, 2026',status:'completed',desc:'Chapter read revenue. 2,050 reads.'},
  {id:'TXN-009',type:'withdrawal',title:'Withdrawal to GTBank',book:'',amount:'- $1,500.00',num:-1500,date:'Jun 12, 2026',status:'completed',desc:'Processed and paid to GTBank · · · · 4821.'},
  {id:'TXN-010',type:'earning',title:'Billionaire\'s Forbidden Love — Ch.17',book:'Billionaire\'s Forbidden Love',amount:'+ $88.00',num:88,date:'Jun 11, 2026',status:'completed',desc:'Chapter read revenue. 1,170 reads.'},
  {id:'TXN-011',type:'earning',title:'The CEO\'s Hidden Son — Completion Bonus',book:'The CEO\'s Hidden Son',amount:'+ $750.00',num:750,date:'Jun 10, 2026',status:'completed',desc:'Book completion bonus. 35 chapters delivered.'},
  {id:'TXN-012',type:'withdrawal',title:'Withdrawal to GTBank',book:'',amount:'- $2,000.00',num:-2000,date:'Jun 9, 2026',status:'completed',desc:'Processed and paid.'},
  {id:'TXN-013',type:'earning',title:'The CEO\'s Hidden Son — Ch.20',book:'The CEO\'s Hidden Son',amount:'+ $140.00',num:140,date:'Jun 8, 2026',status:'completed',desc:'Chapter read revenue. 1,860 reads.'},
  {id:'TXN-014',type:'earning',title:'Billionaire\'s Forbidden Love — Ch.16',book:'Billionaire\'s Forbidden Love',amount:'+ $72.00',num:72,date:'Jun 7, 2026',status:'completed',desc:'Chapter read revenue. 960 reads.'},
  {id:'TXN-015',type:'withdrawal',title:'Withdrawal to PayPal',book:'',amount:'- $1,100.00',num:-1100,date:'Jun 6, 2026',status:'completed',desc:'Paid to PayPal.'},
];
var currentPage=1,PER_PAGE=6,openRowId=null;
var _bound=false;

function filtered(){
  var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  var ty=(document.getElementById('typeFilter').value);
  var st=(document.getElementById('statusFilter').value);
  return txns.filter(function(a){if(ty&&a.type!==ty)return false;if(st&&a.status!==st)return false;if(q&&a.title.toLowerCase().indexOf(q)===-1&&a.id.toLowerCase().indexOf(q)===-1)return false;return true;});
}
function statusPill(s){
  var icons={completed:'fa-check-circle',pending:'fa-clock',processing:'fa-spinner',failed:'fa-times-circle'};
  return'<span class="status-pill '+s+'"><i class="fas '+icons[s]+'"></i>'+s.charAt(0).toUpperCase()+s.slice(1)+'</span>';
}
function render(){
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>tp)currentPage=tp;
  var start=(currentPage-1)*PER_PAGE,page=list.slice(start,start+PER_PAGE);
  var body=document.getElementById('tableBody');
  if(!page.length){body.innerHTML='<div class="empty-msg"><i class="fas fa-receipt"></i>No transactions match your filters.</div>';document.getElementById('pageBtns').innerHTML='';document.getElementById('pageInfo').innerHTML='';return;}
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    var isEarning=a.type==='earning';
    var ico=isEarning?'fa-arrow-down':'fa-arrow-up';
    var cls=isEarning?'earning':'withdrawal';
    var amtCls=isEarning?'positive':'negative';
    return '<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+a.id+'"><div class="expand-ico"><i class="fas fa-chevron-right"></i></div><div class="tx-icon '+cls+'"><i class="fas '+ico+'"></i></div><div class="tx-info col-date"><span class="tx-title">'+a.title+'</span><span class="tx-sub">'+a.id+'</span></div><div class="tx-date">'+a.date+'</div><div class="amount '+amtCls+'">'+a.amount+'</div><div>'+statusPill(a.status)+'</div></div><div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+a.id+'"></div></div>';
  }).join('');
  if(openRowId&&page.some(function(a){return a.id===openRowId;}))renderDetail(openRowId);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(start+1)+'</b> – <b>'+Math.min(start+PER_PAGE,total)+'</b> of <b>'+total+'</b> transactions';
  renderPag(tp);
}
function renderDetail(id){
  var a=txns.find(function(x){return x.id===id;});if(!a)return;
  var p=document.getElementById('detail-'+id);if(!p)return;
  var isEarning=a.type==='earning';
  p.innerHTML='<div class="detail-inner"><div class="detail-grid"><div class="detail-card"><label>Transaction ID</label><b>'+a.id+'</b></div><div class="detail-card"><label>Type</label><b>'+(isEarning?'Earning':'Withdrawal')+'</b></div><div class="detail-card accent"><label>Amount</label><b>'+a.amount+'</b></div><div class="detail-card"><label>Date</label><b>'+a.date+'</b></div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px"><div style="font-size:10px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:flex;align-items:center;gap:5px"><i class="fas fa-note-sticky" style="color:var(--accent)"></i> Description</div><p style="font-size:12.5px;color:var(--text-muted);line-height:1.7">'+a.desc+'</p></div></div>';
}
function renderPag(tp){
  var w=document.getElementById('pageBtns');if(tp<=1){w.innerHTML='';return;}
  var h='<button class="pg-btn"'+(currentPage<=1?' disabled':'')+' onclick="go('+(currentPage-1)+')"><i class="fas fa-chevron-left"></i></button>';
  for(var i=1;i<=tp;i++)h+='<button class="pg-btn'+(i===currentPage?' active':'')+'" onclick="go('+i+')">'+i+'</button>';
  h+='<button class="pg-btn"'+(currentPage>=tp?' disabled':'')+' onclick="go('+(currentPage+1)+')"><i class="fas fa-chevron-right"></i></button>';
  w.innerHTML=h;
}
function go(p){currentPage=p;render();}
function toast(m){var t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2400);}

/* ── Payment Methods ── */
var paymentMethods=[
  {id:1,type:'bank',name:'GTBank Savings',detail:'GTBank · · · · 4821',active:true},
  {id:2,type:'paypal',name:'PayPal',detail:'wren@email.com',active:false},
];
function renderPM(){
  var grid=document.getElementById('pmGrid');
  var html=paymentMethods.map(function(m){
    var icon=m.type==='bank'?'fa-building-columns':m.type==='paypal'?'fab fa-paypal':'fa-mobile-screen';
    return '<div class="pm-card'+(m.active?' active':'')+'" data-id="'+m.id+'"><div class="pm-check"><i class="fas fa-check"></i></div><div class="pm-icon"><i class="fas '+icon+'"></i></div><div class="pm-name">'+m.name+'</div><div class="pm-detail">'+m.detail+'</div><div class="pm-actions"><button class="pm-btn" title="Edit" onclick="event.stopPropagation();editPM('+m.id+')"><i class="fas fa-pen"></i></button><button class="pm-btn del" title="Delete" onclick="event.stopPropagation();deletePM('+m.id+')"><i class="fas fa-trash"></i></button></div></div>';
  }).join('');
  html+='<div class="pm-card pm-add" onclick="openAddPM()"><i class="fas fa-plus"></i><span>Add New Method</span></div>';
  grid.innerHTML=html;
  grid.querySelectorAll('.pm-card:not(.pm-add)').forEach(function(card){
    card.addEventListener('click',function(){
      paymentMethods.forEach(function(m){m.active=m.id===+card.dataset.id});
      renderPM();toast('Payment method selected');
    });
  });
  updateWithdrawMethods();
}
function updateWithdrawMethods(){
  var sel=document.getElementById('withdrawMethod');
  sel.innerHTML=paymentMethods.map(function(m){return'<option value="'+m.id+'">'+m.name+' · '+m.detail+'</option>'}).join('');
}

function attachShell(){
  if(!window.SeniorEditorSidebar||!window.SeniorEditorSidebar.attach)return;
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'editor-bill-review',title:'My Earnings',subtitle:'Track your earnings, withdrawals, and payment methods',user:{name:'Wren Okonkwo',role:'Editor',avatar:'https://i.pravatar.cc/100?img=15'},notifCount:2,searchPlaceholder:'Search…'});
}

function bindWindowActions(){
  window.go=go;
  window.openAddPM=function(){document.getElementById('pmModalTitle').textContent='Add Payment Method';document.getElementById('pmModalSub').textContent='Add a new withdrawal account';document.getElementById('pmEditId').value='';document.getElementById('pmName1').value='';document.getElementById('pmName2').value='';document.getElementById('pmType').value='bank';document.getElementById('pmModal').classList.add('show');};
  window.editPM=function(id){var m=paymentMethods.find(function(x){return x.id===id});if(!m)return;document.getElementById('pmModalTitle').textContent='Edit Payment Method';document.getElementById('pmModalSub').textContent='Update your withdrawal account';document.getElementById('pmEditId').value=id;document.getElementById('pmType').value=m.type;document.getElementById('pmName1').value=m.name;document.getElementById('pmName2').value=m.detail;document.getElementById('pmModal').classList.add('show');};
  window.closePMModal=function(){document.getElementById('pmModal').classList.remove('show');};
  window.savePM=function(){var name=document.getElementById('pmName1').value.trim();var detail=document.getElementById('pmName2').value.trim();var type=document.getElementById('pmType').value;var editId=document.getElementById('pmEditId').value;if(!name||!detail){toast('Fill in all fields');return;}if(editId){var m=paymentMethods.find(function(x){return x.id===+editId});if(m){m.name=name;m.detail=detail;m.type=type;}toast('Payment method updated');}else{var newId=Date.now();paymentMethods.push({id:newId,type:type,name:name,detail:detail,active:false});toast('Payment method added');}closePMModal();renderPM();};
  window.deletePM=function(id){var m=paymentMethods.find(function(x){return x.id===id});if(!m)return;document.getElementById('deletePmId').value=id;document.getElementById('deleteModalSub').textContent='Delete '+m.name+' ('+m.detail+')?';document.getElementById('deleteModal').classList.add('show');};
  window.closeDeleteModal=function(){document.getElementById('deleteModal').classList.remove('show');};
  window.confirmDeletePM=function(){var id=+document.getElementById('deletePmId').value;paymentMethods=paymentMethods.filter(function(m){return m.id!==id});if(paymentMethods.length&&!paymentMethods.some(function(m){return m.active})){paymentMethods[0].active=true;}closeDeleteModal();renderPM();toast('Payment method deleted');};
  window.openWithdraw=function(){document.getElementById('withdrawModal').classList.add('show');};
  window.closeWithdraw=function(){document.getElementById('withdrawModal').classList.remove('show');};
  window.submitWithdraw=function(){var amt=document.getElementById('withdrawAmount').value;if(!amt||parseFloat(amt)<=0){toast('Enter a valid amount');return;}toast('$'+amt+' withdrawal submitted');closeWithdraw();document.getElementById('withdrawAmount').value='';};
}

function bindEvents(){
  if(_bound)return;_bound=true;
  document.addEventListener('click',function(e){var row=e.target.closest('.item-row');if(row&&!e.target.closest('.actions-cell')){var id=row.dataset.id;openRowId=openRowId===id?null:id;render();}});
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('typeFilter').addEventListener('change',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
}

function init(){
  attachShell();
  bindWindowActions();
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/editor-bill-review').then(function(data){ if(data&&data.items){ render(); } });
  callBackend('/editor-bill-review');
  bindEvents();
  renderPM();
  render();
}

window.EditorBillReviewService={init:init};

})();
