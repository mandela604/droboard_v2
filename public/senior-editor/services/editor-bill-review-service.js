/**
 * editor-bill-review-service.js — My Earnings page (senior editor's own pay).
 * Live-first: reads /api/senior-editor/earnings/* and /api/finance/payment-methods.
 * Every request falls back to the demo ledger so the page still works offline.
 */
(function () {
'use strict';

var API_BASE = '/api/senior-editor';
var FIN_BASE = '/api/finance';

var LIVE = false;
var SUMMARY = null;

/* ── Demo fallback (backend offline) ── */
var DEMO_SUMMARY = {
  currency: 'USD', earned: 12480, available: 4850, withdrawn: 6780,
  pendingPayout: 850, thisMonth: 2100, minWithdrawal: 100,
};
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
var DEMO_COVERS={
  "The CEO's Hidden Son":'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
  "Billionaire's Forbidden Love":'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
};
txns.forEach(function(t){if(!t.cover&&t.book)t.cover=DEMO_COVERS[t.book]||'';});
var currentPage=1,PER_PAGE=6,openRowId=null;
var _bound=false;

/* ── Helpers ── */
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function round2(n){return Math.round((Number(n)||0)*100)/100;}
/* Pay is stored in dollars (the backend summary's `currency` says what the
   numbers ARE, not how they should be shown). Displays restate that figure in
   the currency Super Admin set; the withdrawal INPUT stays dollars, because
   that is the unit the POST body is written in. */
function money(n){
  if(window.DroboardCurrency && DroboardCurrency.usdToMoney) return DroboardCurrency.usdToMoney(Math.abs(Number(n)||0));
  return '$' + Math.abs(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function moneySigned(n){ var v=Number(n)||0; return (v<0?'-':'+') + money(v); }
function authHeaders(extra){
  var h=Object.assign({'Accept':'application/json'},extra||{});
  var t=null;try{t=localStorage.getItem('dro_access_token')||sessionStorage.getItem('dro_access_token');}catch(e){}
  if(t)h['Authorization']='Bearer '+t;
  return h;
}
async function api(base,path,options){
  var opts=Object.assign({},options||{});
  opts.credentials='include';
  opts.headers=authHeaders(opts.headers);
  var res=await fetch(base+path,opts);
  var body=await res.json().catch(function(){return{};});
  if(!res.ok){var e=new Error(body.error||('HTTP '+res.status));e.status=res.status;throw e;}
  return body;
}

/* ── Data ── */
async function loadAllRows(){
  var out=[],page=1,total=Infinity;
  while(out.length<total&&page<=8){
    var d=await api(API_BASE,'/editor-bill-review?limit=50&page='+page);
    var items=(d&&d.items)||[];
    out=out.concat(items);
    total=Number(d&&d.total)||out.length;
    if(!items.length)break;
    page++;
  }
  return out;
}

function mapMethod(m){
  var detail;
  if(m.type==='paypal')detail=m.email||'';
  else if(m.type==='mobile')detail=m.phoneNumber||m.provider||'';
  else detail=(m.bankName?m.bankName+' · ':'')+'\u2022\u2022\u2022\u2022';
  return {
    id:String(m.id),
    type:m.type,
    name:m.accountName||('Bank account'),
    detail:detail||'—',
    active:!!m.isDefault,
    raw:m,
  };
}

function applySummary(s){
  document.getElementById('balanceAmount').textContent=money(s.available);
  document.getElementById('statEarned').textContent=money(s.earned);
  document.getElementById('statWithdrawn').textContent=money(s.withdrawn!=null?s.withdrawn:Math.max(0,s.earned-s.available-s.pendingPayout));
  document.getElementById('statPending').textContent=money(s.pendingPayout);
  document.getElementById('statMonth').textContent=money(s.thisMonth);
  document.getElementById('withdrawBal').textContent=money(s.available);
  document.getElementById('withdrawMin').textContent=s.minWithdrawal?('Minimum withdrawal '+money(s.minWithdrawal)):'';
}

function setLedgerLabel(text){var el=document.getElementById('txnSub');if(el)el.textContent=text;}

async function tryLive(){
  try{
    var res=await Promise.all([
      api(API_BASE,'/earnings/summary'),
      loadAllRows(),
      api(FIN_BASE,'/payment-methods').catch(function(){return null;}),
    ]);
    var s=res[0],rows=res[1],methods=res[2];
    if(!s||typeof s.available!=='number')throw new Error('bad summary');
    LIVE=true;SUMMARY=s;txns=rows;
    paymentMethods=Array.isArray(methods)?methods.map(mapMethod):[];
    if(paymentMethods.length&&!paymentMethods.some(function(m){return m.active;}))paymentMethods[0].active=true;
    applySummary(s);
    if(rows.length&&rows[0].type==='earning'){
      document.getElementById('balanceSub').textContent='Last earning '+rows[0].date+' — '+rows[0].title;
    }else{
      document.getElementById('balanceSub').textContent='No earnings recorded yet';
    }
    renderPM();render();
    setLedgerLabel('Live ledger · '+(rows.length?rows.length+' records':'no transactions yet'));
  }catch(e){
    console.info('[MyEarnings] backend unavailable — demo data:',e.message);
    setLedgerLabel('Demo data — backend not connected');
  }
}

async function refreshLive(){
  if(!LIVE)return;
  try{
    SUMMARY=await api(API_BASE,'/earnings/summary');
    txns=await loadAllRows();
    applySummary(SUMMARY);render();
  }catch(e){toast('Could not refresh — '+e.message);}
}

/* ── Ledger table ── */
function filtered(){
  var q=(document.getElementById('searchInput').value||'').trim().toLowerCase();
  var ty=(document.getElementById('typeFilter').value);
  var st=(document.getElementById('statusFilter').value);
  return txns.filter(function(a){
    if(ty&&a.type!==ty)return false;
    if(st&&a.status!==st)return false;
    if(q&&String(a.title||'').toLowerCase().indexOf(q)===-1&&String(a.id||'').toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
}
function statusPill(s){
  var icons={completed:'fa-check-circle',pending:'fa-clock',processing:'fa-spinner',failed:'fa-times-circle'};
  var cls=icons[s]?s:'pending';
  var label=cls==='failed'?'Failed':cls.charAt(0).toUpperCase()+cls.slice(1);
  return '<span class="status-pill '+cls+'"><i class="fas '+icons[cls]+'"></i>'+label+'</span>';
}
function render(){
  var list=filtered(),total=list.length,tp=Math.max(1,Math.ceil(total/PER_PAGE));
  if(currentPage>tp)currentPage=tp;
  var start=(currentPage-1)*PER_PAGE,page=list.slice(start,start+PER_PAGE);
  var body=document.getElementById('tableBody');
  if(!page.length){
    body.innerHTML='<div class="empty-msg"><i class="fas fa-receipt"></i>No transactions match your filters.</div>';
    document.getElementById('pageBtns').innerHTML='';
    document.getElementById('pageInfo').innerHTML='';
    return;
  }
  body.innerHTML=page.map(function(a){
    var isOpen=openRowId===a.id;
    var isEarning=a.type==='earning';
    var thumb=isEarning
      ? (a.cover
        ? '<div class="tx-thumb"><img src="'+esc(a.cover)+'" alt=""/></div>'
        : '<div class="tx-thumb earning"><i class="fas fa-arrow-down"></i></div>')
      : '<div class="tx-thumb withdrawal"><i class="fas fa-arrow-up"></i></div>';
    var amtCls=isEarning?'positive':'negative';
    var amtHtml = typeof a.num === 'number' ? moneySigned(a.num) : esc(a.amount);
    return '<div><div class="item-row'+(isOpen?' is-open':'')+'" data-id="'+esc(a.id)+'">'+thumb+'<div class="tx-info"><span class="tx-title">'+esc(a.title)+'</span><span class="tx-sub">'+esc(a.id)+'</span></div><div class="tx-date col-date">'+esc(a.date)+'</div><div class="amount '+amtCls+'">'+amtHtml+'</div><div class="col-status">'+statusPill(a.status)+'</div></div><div class="item-detail'+(isOpen?' show':'')+'" id="detail-'+esc(a.id)+'"></div></div>';
  }).join('');
  if(openRowId&&page.some(function(a){return a.id===openRowId;}))renderDetail(openRowId);
  document.getElementById('pageInfo').innerHTML='Showing <b>'+(start+1)+'</b> – <b>'+Math.min(start+PER_PAGE,total)+'</b> of <b>'+total+'</b> transactions';
  renderPag(tp);
}
function renderDetail(id){
  var a=txns.find(function(x){return x.id===id;});if(!a)return;
  var p=document.getElementById('detail-'+id);if(!p)return;
  var isEarning=a.type==='earning';
  var amtDetail = typeof a.num === 'number' ? moneySigned(a.num) : esc(a.amount);
  p.innerHTML='<div class="detail-inner"><div class="detail-grid"><div class="detail-card"><label>Transaction ID</label><b>'+esc(a.id)+'</b></div><div class="detail-card"><label>Type</label><b>'+(isEarning?'Earning':'Withdrawal')+'</b></div><div class="detail-card accent"><label>Amount</label><b>'+amtDetail+'</b></div><div class="detail-card"><label>Date</label><b>'+esc(a.date)+'</b></div></div><div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px"><div style="font-size:10px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:flex;align-items:center;gap:5px"><i class="fas fa-note-sticky" style="color:var(--accent)"></i> Description</div><p style="font-size:12.5px;color:var(--text-muted);line-height:1.7">'+esc(a.desc)+'</p></div></div>';
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
  {id:'1',type:'bank',name:'GTBank Savings',detail:'GTBank · · · · 4821',active:true},
  {id:'2',type:'paypal',name:'PayPal',detail:'wren@email.com',active:false},
];
function findPM(id){return paymentMethods.find(function(m){return String(m.id)===String(id);});}
function renderPM(){
  var grid=document.getElementById('pmGrid');
  var html=paymentMethods.map(function(m){
    var icon=m.type==='bank'?'fa-building-columns':m.type==='paypal'?'fab fa-paypal':'fa-mobile-screen';
    return '<div class="pm-card'+(m.active?' active':'')+'" data-id="'+esc(m.id)+'"><div class="pm-check"><i class="fas fa-check"></i></div><div class="pm-icon"><i class="fas '+icon+'"></i></div><div class="pm-name">'+esc(m.name)+'</div><div class="pm-detail">'+esc(m.detail)+'</div><div class="pm-actions"><button class="pm-btn" title="Edit" onclick="event.stopPropagation();editPM(\''+esc(m.id)+'\')"><i class="fas fa-pen"></i></button><button class="pm-btn del" title="Delete" onclick="event.stopPropagation();deletePM(\''+esc(m.id)+'\')"><i class="fas fa-trash"></i></button></div></div>';
  }).join('');
  html+='<div class="pm-card pm-add" onclick="openAddPM()"><i class="fas fa-plus"></i><span>Add New Method</span></div>';
  grid.innerHTML=html;
  grid.querySelectorAll('.pm-card:not(.pm-add)').forEach(function(card){
    card.addEventListener('click',function(){selectPM(card.dataset.id);});
  });
  updateWithdrawMethods();
}
async function selectPM(id){
  var m=findPM(id);if(!m)return;
  if(!LIVE){
    paymentMethods.forEach(function(x){x.active=String(x.id)===String(id);});
    renderPM();toast('Payment method selected');
    return;
  }
  try{
    await api(FIN_BASE,'/payment-methods/'+encodeURIComponent(id)+'/default',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});
    paymentMethods.forEach(function(x){x.active=String(x.id)===String(id);});
    renderPM();toast('Default payment method updated');
  }catch(e){toast('Could not update default — '+e.message);}
}
function updateWithdrawMethods(){
  var sel=document.getElementById('withdrawMethod');
  var keep=sel.value;
  sel.innerHTML=paymentMethods.map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.detail)+'</option>'}).join('');
  if(keep&&paymentMethods.some(function(m){return String(m.id)===String(keep);}))sel.value=keep;
  else{
    var active=paymentMethods.find(function(m){return m.active;});
    if(active)sel.value=String(active.id);
  }
}
function syncPMFields(){
  var t=document.getElementById('pmType').value;
  var l2=document.getElementById('pmLabel2'),i2=document.getElementById('pmName2');
  if(t==='bank'){l2.textContent='Account Number';i2.placeholder='e.g. 0123456789';}
  else if(t==='paypal'){l2.textContent='PayPal Email';i2.placeholder='e.g. wren@email.com';}
  else{l2.textContent='Mobile Number';i2.placeholder='e.g. +234 801 234 5678';}
}
function methodBody(type,name,detail){
  var body={type:type,accountName:name};
  if(type==='bank'&&detail)body.accountNumber=detail;
  if(type==='paypal'&&detail)body.email=detail;
  if(type==='mobile'&&detail)body.phoneNumber=detail;
  return body;
}
async function reloadMethods(){
  if(!LIVE)return;
  try{
    var list=await api(FIN_BASE,'/payment-methods');
    paymentMethods=(list||[]).map(mapMethod);
    if(paymentMethods.length&&!paymentMethods.some(function(m){return m.active;}))paymentMethods[0].active=true;
    renderPM();
  }catch(e){toast('Could not load payment methods');}
}

function attachShell(){
  if(!window.SeniorEditorSidebar||!window.SeniorEditorSidebar.attach)return;
  SeniorEditorSidebar.attach('#dashRoot',{activeItem:'editor-bill-review',title:'My Earnings',subtitle:'Track your earnings, withdrawals, and payment methods',user:{name:'Wren Okonkwo',role:'Editor',avatar:'https://i.pravatar.cc/100?img=15'},notifCount:2,searchPlaceholder:'Search…'});
}

function bindWindowActions(){
  window.go=go;
  window.openAddPM=function(){
    document.getElementById('pmModalTitle').textContent='Add Payment Method';
    document.getElementById('pmModalSub').textContent='Add a new withdrawal account';
    document.getElementById('pmEditId').value='';
    document.getElementById('pmType').value='bank';
    document.getElementById('pmName1').value='';
    document.getElementById('pmName2').value='';
    syncPMFields();
    document.getElementById('pmModal').classList.add('show');
  };
  window.editPM=async function(id){
    var m=findPM(id);if(!m)return;
    document.getElementById('pmModalTitle').textContent='Edit Payment Method';
    document.getElementById('pmModalSub').textContent='Update your withdrawal account';
    document.getElementById('pmEditId').value=String(m.id);
    document.getElementById('pmType').value=m.type;
    document.getElementById('pmName1').value=m.name;
    document.getElementById('pmName2').value=(LIVE&&m.type==='bank')?'':(m.detail==='—'?'':m.detail);
    syncPMFields();
    document.getElementById('pmModal').classList.add('show');
    if(!LIVE)return;
    // The list endpoint hides account numbers; this owner-only read reveals it
    // so the form shows what is actually stored.
    try{
      var full=await api(FIN_BASE,'/payment-methods/'+encodeURIComponent(id));
      var val=m.type==='bank'?full.accountNumber:(m.type==='paypal'?full.email:full.phoneNumber);
      if(val)document.getElementById('pmName2').value=val;
    }catch(e){/* leave the field blank if the reveal read fails */}
  };
  window.closePMModal=function(){document.getElementById('pmModal').classList.remove('show');};
  window.savePM=async function(){
    var name=document.getElementById('pmName1').value.trim();
    var detail=document.getElementById('pmName2').value.trim();
    var type=document.getElementById('pmType').value;
    var editId=document.getElementById('pmEditId').value;
    if(!name){toast('Enter an account name');return;}
    if(!editId&&!detail){toast('Fill in all fields');return;}
    if(LIVE){
      try{
        if(editId){
          await api(FIN_BASE,'/payment-methods/'+encodeURIComponent(editId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(methodBody(type,name,detail))});
          toast('Payment method updated');
        }else{
          await api(FIN_BASE,'/payment-methods',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(methodBody(type,name,detail))});
          toast('Payment method added');
        }
        closePMModal();
        await reloadMethods();
      }catch(e){toast(e.message||'Could not save payment method');}
      return;
    }
    if(editId){
      var m=findPM(editId);
      if(m){m.name=name;m.type=type;if(detail)m.detail=detail;}
      toast('Payment method updated');
    }else{
      paymentMethods.push({id:String(Date.now()),type:type,name:name,detail:detail,active:false});
      toast('Payment method added');
    }
    closePMModal();renderPM();
  };
  window.deletePM=function(id){
    var m=findPM(id);if(!m)return;
    document.getElementById('deletePmId').value=String(id);
    document.getElementById('deleteModalSub').textContent='Delete '+m.name+' ('+m.detail+')?';
    document.getElementById('deleteModal').classList.add('show');
  };
  window.closeDeleteModal=function(){document.getElementById('deleteModal').classList.remove('show');};
  window.confirmDeletePM=async function(){
    var id=document.getElementById('deletePmId').value;
    if(LIVE){
      try{
        await api(FIN_BASE,'/payment-methods/'+encodeURIComponent(id),{method:'DELETE'});
        closeDeleteModal();
        await reloadMethods();
        toast('Payment method deleted');
      }catch(e){toast(e.message||'Could not delete payment method');}
      return;
    }
    paymentMethods=paymentMethods.filter(function(m){return String(m.id)!==String(id);});
    if(paymentMethods.length&&!paymentMethods.some(function(m){return m.active;}))paymentMethods[0].active=true;
    closeDeleteModal();renderPM();toast('Payment method deleted');
  };
  window.openWithdraw=function(){
    if(!paymentMethods.length){toast('Add a payment method first');openAddPM();return;}
    var s=SUMMARY||DEMO_SUMMARY;
    document.getElementById('withdrawModal').classList.add('show');
    applySummary(s);
    document.getElementById('withdrawAmount').value='';
    document.getElementById('withdrawAmount').focus();
  };
  window.closeWithdraw=function(){document.getElementById('withdrawModal').classList.remove('show');};
  window.submitWithdraw=async function(){
    var raw=document.getElementById('withdrawAmount').value;
    var amt=parseFloat(raw);
    var s=SUMMARY||DEMO_SUMMARY;
    if(!amt||amt<=0){toast('Enter a valid amount');return;}
    if(s.minWithdrawal&&amt<s.minWithdrawal){toast('Minimum withdrawal is '+money(s.minWithdrawal));return;}
    if(amt>s.available){toast('Amount exceeds your available balance');return;}
    var methodId=document.getElementById('withdrawMethod').value;
    if(!methodId){toast('Choose a payment method');return;}
    if(LIVE){
      var errs={below_minimum:'Amount is below the minimum withdrawal',no_method:'That payment method no longer exists',insufficient:'Amount exceeds your available balance'};
      try{
        await api(API_BASE,'/earnings/withdrawals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:amt,methodId:String(methodId)})});
        toast('Withdrawal request submitted');
        closeWithdraw();
        await refreshLive();
      }catch(e){toast(errs[e.message]||e.message||'Withdrawal failed');}
      return;
    }
    DEMO_SUMMARY.available=round2(DEMO_SUMMARY.available-amt);
    DEMO_SUMMARY.pendingPayout=round2(DEMO_SUMMARY.pendingPayout+amt);
    var m=findPM(methodId);
    txns.unshift({
      id:'WD-'+Date.now(),type:'withdrawal',book:'',
      title:'Withdrawal'+(m?' · '+m.name:''),
      amount:'- '+money(amt),num:-amt,
      date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      status:'pending',
      desc:'Requested. Awaiting finance approval.',
    });
    applySummary(DEMO_SUMMARY);render();closeWithdraw();toast('Withdrawal request submitted');
  };
}

function bindEvents(){
  if(_bound)return;_bound=true;
  document.addEventListener('click',function(e){
    var row=e.target.closest('.item-row');
    if(row&&!e.target.closest('.actions-cell')){var id=row.dataset.id;openRowId=openRowId===id?null:id;render();}
  });
  document.getElementById('searchInput').addEventListener('input',function(){currentPage=1;render();});
  document.getElementById('typeFilter').addEventListener('change',function(){currentPage=1;render();});
  document.getElementById('statusFilter').addEventListener('change',function(){currentPage=1;render();});
  document.getElementById('pmType').addEventListener('change',syncPMFields);
}

function init(){
  attachShell();
  bindWindowActions();
  bindEvents();
  applySummary(DEMO_SUMMARY);
  renderPM();
  render();
  setLedgerLabel('Demo data — backend not connected');
  tryLive();
}

window.EditorBillReviewService={init:init};

})();
