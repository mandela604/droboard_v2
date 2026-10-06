/** withdrawal-request-service.js — Data + UI wrapper for withdrawal-request.html. TODO: POST /api/author/withdrawals */
(function () {
  'use strict';
  if (window.AuthorWithdrawalService && window.AuthorWithdrawalService.init) return;
  var Svc = window.AuthorWithdrawalService || {};

  /* Backend-ready API (preserved) */
  Svc.list = Svc.list || async function () { return window.AuthorFinance ? window.AuthorFinance.getWithdrawals() : []; };
  Svc.methods = Svc.methods || async function () { return window.AuthorFinance ? window.AuthorFinance.getPaymentMethods() : []; };
  Svc.request = Svc.request || async function (a, m) { return window.AuthorFinance ? window.AuthorFinance.requestWithdrawal(a, m) : { id: 'WD-new' }; };

  var balance = 0, minWithdrawal = 100, methods = [], selectedMethod = null;

  function toast(m){var t=document.getElementById('toastEl')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'toastEl',className:'toast'}));t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2500);}

  async function render(){
    var earnings = await window.AuthorFinance.getEarnings();
    methods = await window.AuthorFinance.getPaymentMethods();
    balance = earnings.balance;
    minWithdrawal = (window.DemoData && window.DemoData.WITHDRAWAL_MIN) || 100;

    document.getElementById('balanceMini').innerHTML =
      '<div><div class="bal-label">Available Balance</div><div class="bal-amount">'+window.AuthorFinance.fmtCurrency(balance)+'</div><div class="bal-min">Minimum withdrawal: $'+minWithdrawal+'</div></div>'+
      '<a href="payment-details.html" style="color:#fff;font-size:12px;font-weight:700;opacity:.8"><i class="fas fa-credit-card"></i> Manage</a>';

    renderMethods();
    validate();
  }

  function renderMethods(){
    var el = document.getElementById('methodList');
    if (!methods.length) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No payment methods yet.<br/><a href="payment-details.html" style="color:var(--pink);font-weight:700">Add one now</a></p></div>';
      return;
    }
    el.innerHTML = methods.map(function(m){
      var sel = selectedMethod === m.id ? ' selected' : '';
      var detail = m.type === 'bank' ? m.bankName + ' •••• ' + m.accountNumber.slice(-4) :
                     m.type === 'paypal' ? m.email :
                     m.phoneNumber;
      return '<div class="method-option'+sel+'" onclick="selectMethod(\''+m.id+'\')">'+
        '<div class="method-icon '+m.type+'"><i class="fas '+m.icon+'"></i></div>'+
        '<div class="method-info"><div class="method-name">'+(m.type==='bank'?m.bankName:m.type==='paypal'?'PayPal':m.provider)+'</div><div class="method-detail">'+detail+(m.isDefault?' · Default':'')+'</div></div>'+
        '<div class="method-check"><i class="fas fa-check"></i></div>'+
      '</div>';
    }).join('');
  }

  function selectMethod(id){
    selectedMethod = selectedMethod === id ? null : id;
    renderMethods();
    validate();
  }

  function validate(){
    var amt = parseFloat(document.getElementById('amountInput').value) || 0;
    var btn = document.getElementById('submitBtn');
    var valid = amt >= minWithdrawal && amt <= balance && selectedMethod;
    btn.disabled = !valid;

    var sec = document.getElementById('summarySection');
    if (amt > 0 && selectedMethod) {
      var method = methods.find(function(m){ return m.id === selectedMethod; });
      var methodLabel = method.type === 'bank' ? method.bankName + ' •••• ' + method.accountNumber.slice(-4) :
                          method.type === 'paypal' ? method.email : method.phoneNumber;
      sec.style.display = '';
      document.getElementById('summaryContent').innerHTML =
        '<div class="summary-row"><span class="label">Amount</span><span class="value">'+window.AuthorFinance.fmtCurrency(amt)+'</span></div>'+
        '<div class="summary-row"><span class="label">Method</span><span class="value">'+methodLabel+'</span></div>'+
        '<div class="summary-divider"></div>'+
        '<div class="summary-row"><span class="label">Remaining Balance</span><span class="value">'+window.AuthorFinance.fmtCurrency(balance - amt)+'</span></div>'+
        '<div class="summary-row"><span class="label">Processing Time</span><span class="value">3-5 business days</span></div>';
    } else {
      sec.style.display = 'none';
    }
  }

  function init(){
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('withdrawal-request.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    document.getElementById('amountInput').addEventListener('input', validate);
    document.getElementById('withdrawAll').addEventListener('click', function(){
      document.getElementById('amountInput').value = balance;
      validate();
    });
    document.getElementById('submitBtn').addEventListener('click', async function(){
      var amt = parseFloat(document.getElementById('amountInput').value) || 0;
      if (!selectedMethod) { toast('Select a payment method'); return; }
      if (amt < minWithdrawal) { toast('Minimum withdrawal is $'+minWithdrawal); return; }
      if (amt > balance) { toast('Insufficient balance'); return; }
      try {
        await window.AuthorFinance.requestWithdrawal(amt, selectedMethod);
        document.getElementById('successMsg').textContent = 'Your $'+amt+' withdrawal request has been submitted. Funds will arrive within 3-5 business days.';
        document.getElementById('successModal').classList.add('show');
      } catch (e) { toast(e.message); }
    });
    render();
  }

  Svc.init = init;
  Svc.render = render;
  window.AuthorWithdrawalService = Svc;
  /* onclick refs in generated HTML */
  window.selectMethod = selectMethod;
})();
