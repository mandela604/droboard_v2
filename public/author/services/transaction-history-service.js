/** transaction-history-service.js — Data + UI wrapper for transaction-history.html. TODO: GET /api/author/transactions */
(function () {
  'use strict';
  if (window.AuthorTransactionsService && window.AuthorTransactionsService.init) return;
  var Svc = window.AuthorTransactionsService || {};

  /* Backend-ready API (preserved) */
  Svc.list = Svc.list || async function () { return window.AuthorFinance ? window.AuthorFinance.getTransactions() : []; };
  Svc.kpis = Svc.kpis || async function (l) { return window.AuthorFinance ? window.AuthorFinance.getTransactionKPIs(l) : {}; };

  var allTxns = [], filtered = [], activeFilter = 'all', currentTxn = null;
  var currentPage = 1;
  var PER_PAGE = 5;

  function toast(m){var t=document.getElementById('toastEl')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'toastEl',className:'toast'}));t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2500);}

  async function render(){
    allTxns = await window.AuthorFinance.getTransactions();
    var kpis = await window.AuthorFinance.getTransactionKPIs(allTxns);
    document.getElementById('kpis').innerHTML =
      '<div class="kpi"><div class="kpi-label">Total Withdrawn</div><div class="kpi-val blue">'+window.AuthorFinance.fmtCurrency(kpis.totalWithdrawn)+'</div></div>'+
      '<div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-val" style="color:var(--tx-high)">'+kpis.count+'</div></div>';
    applyFilter();
  }

  function applyFilter(){
    var q = (document.getElementById('searchInput').value||'').toLowerCase();
    filtered = allTxns.filter(function(t){
      if (activeFilter !== 'all' && t.type !== activeFilter) return false;
      if (q && !t.desc.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q) && !(t.book||'').toLowerCase().includes(q)) return false;
      return true;
    });
    currentPage = 1;
    renderList();
  }

  function renderList(){
    var el = document.getElementById('txnList');
    if (!filtered.length) {
      el.innerHTML = '<div class="empty"><i class="fas fa-receipt"></i><p>No transactions found.</p></div>';
      return;
    }
    var totalPages = Math.ceil(filtered.length / PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * PER_PAGE;
    var page = filtered.slice(start, start + PER_PAGE);

    var html = page.map(function(t){
      var isPos = t.amount >= 0;
      var icon = t.type === 'earned' ? 'fa-book-open' : t.type === 'bonus' ? 'fa-trophy' : t.type === 'withdrawal' ? 'fa-building-columns' : 'fa-sliders';
      return '<div class="txn-card" onclick="showDetail(\''+t.id+'\')">'+
        '<div class="txn-top">'+
          '<div class="txn-icon '+t.type+'"><i class="fas '+icon+'"></i></div>'+
          '<div class="txn-info"><div class="txn-desc">'+t.desc+'</div>'+
            '<div class="txn-meta"><span><i class="fas fa-clock"></i> '+window.AuthorFinance.timeAgo(t.date)+'</span>'+
            (t.book ? '<span><i class="fas fa-book"></i> '+t.book+'</span>' : '')+'</div></div>'+
          '<div class="txn-right"><div class="txn-amount '+(isPos?'pos':'neg')+'">'+(isPos?'+':'')+window.AuthorFinance.fmtCurrency(t.amount)+'</div>'+
            '<div class="txn-status '+t.status+'">'+t.status+'</div></div>'+
        '</div>'+
      '</div>';
    }).join('');

    if (totalPages > 1) {
      html += '<div class="pagination">';
      html += '<button class="page-btn nav" onclick="goPage('+(currentPage-1)+')" '+(currentPage===1?'disabled':'')+'><i class="fas fa-chevron-left"></i></button>';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button class="page-btn'+(i===currentPage?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
      }
      html += '<button class="page-btn nav" onclick="goPage('+(currentPage+1)+')" '+(currentPage===totalPages?'disabled':'')+'><i class="fas fa-chevron-right"></i></button>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function goPage(p){
    currentPage = p;
    renderList();
    document.getElementById('txnList').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function showDetail(id){
    currentTxn = allTxns.find(function(t){ return t.id === id; });
    if (!currentTxn) return;
    var isPos = currentTxn.amount >= 0;
    document.getElementById('detailContent').innerHTML =
      '<div class="detail-row"><span class="lbl">Transaction ID</span><span class="val">'+currentTxn.id+'</span></div>'+
      '<div class="detail-row"><span class="lbl">Type</span><span class="val" style="text-transform:capitalize">'+currentTxn.type+'</span></div>'+
      '<div class="detail-row"><span class="lbl">Description</span><span class="val">'+currentTxn.desc+'</span></div>'+
      '<div class="detail-row"><span class="lbl">Amount</span><span class="val" style="color:'+(isPos?'var(--success)':'var(--danger)')+';font-size:16px">'+(isPos?'+':'')+window.AuthorFinance.fmtCurrency(currentTxn.amount)+'</span></div>'+
      (currentTxn.book ? '<div class="detail-row"><span class="lbl">Book</span><span class="val">'+currentTxn.book+'</span></div>' : '')+
      '<div class="detail-row"><span class="lbl">Date</span><span class="val">'+window.AuthorFinance.fmtDateTime(currentTxn.date)+'</span></div>'+
      '<div class="detail-row"><span class="lbl">Status</span><span class="val" style="text-transform:capitalize">'+currentTxn.status+'</span></div>'+
      (currentTxn.type !== 'withdrawal' ? '<button class="dispute-btn" onclick="openDispute()"><i class="fas fa-flag"></i> Dispute This Transaction</button>' : '');
    document.getElementById('detailModal').classList.add('show');
  }
  function closeDetail(){ document.getElementById('detailModal').classList.remove('show'); }

  function openDispute(){
    if (!currentTxn) return;
    document.getElementById('disputeTxnInfo').innerHTML =
      '<div class="lbl">Transaction</div><div class="val">'+currentTxn.id+' — '+currentTxn.desc+'</div>'+
      '<div class="lbl" style="margin-top:8px">Amount</div><div class="val">'+window.AuthorFinance.fmtCurrency(Math.abs(currentTxn.amount))+'</div>';
    document.getElementById('disputeReason').value = '';
    closeDetail();
    document.getElementById('disputeForm').classList.add('show');
  }
  function closeDispute(){ document.getElementById('disputeForm').classList.remove('show'); }

  async function submitDispute(){
    var reason = document.getElementById('disputeReason').value.trim();
    if (!reason) { toast('Please describe the issue'); return; }
    if (!currentTxn) return;
    await window.AuthorFinance.fileDispute(currentTxn.id, reason);
    closeDispute();
    toast('Dispute filed — we\'ll review it within 48 hours');
  }

  function init(){
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('transaction-history.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    document.querySelectorAll('.tab').forEach(function(tab){
      tab.addEventListener('click', function(){
        document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        applyFilter();
      });
    });
    document.getElementById('searchInput').addEventListener('input', applyFilter);
    document.getElementById('detailModal').addEventListener('click', function(e){ if (e.target === document.getElementById('detailModal')) closeDetail(); });
    document.getElementById('disputeForm').addEventListener('click', function(e){ if (e.target === document.getElementById('disputeForm')) closeDispute(); });
    render();
  }

  Svc.init = init;
  Svc.render = render;
  window.AuthorTransactionsService = Svc;
  /* onclick refs in markup + generated HTML */
  window.goPage = goPage;
  window.showDetail = showDetail;
  window.closeDetail = closeDetail;
  window.openDispute = openDispute;
  window.closeDispute = closeDispute;
  window.submitDispute = submitDispute;
})();
