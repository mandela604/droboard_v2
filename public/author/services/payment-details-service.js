/** payment-details-service.js — Data + UI wrapper for payment-details.html. TODO: GET /api/author/payment-methods */
(function () {
  'use strict';
  if (window.AuthorPaymentService && window.AuthorPaymentService.init) return;
  var Svc = window.AuthorPaymentService || {};

  /* Backend-ready API (preserved) */
  Svc.list = Svc.list || async function () { return window.AuthorFinance ? window.AuthorFinance.getPaymentMethods() : []; };
  Svc.add = Svc.add || async function (d) { return window.AuthorFinance ? window.AuthorFinance.addPaymentMethod(d) : d; };
  Svc.remove = Svc.remove || async function (id) { return window.AuthorFinance ? window.AuthorFinance.deletePaymentMethod(id) : { ok: true }; };
  Svc.setDefault = Svc.setDefault || async function (id) { return window.AuthorFinance ? window.AuthorFinance.setDefaultMethod(id) : { ok: true }; };

  var methods = [];

  function toast(m){var t=document.getElementById('toastEl')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'toastEl',className:'toast'}));t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show');},2500);}

  async function render(){
    methods = await window.AuthorFinance.getPaymentMethods();
    var el = document.getElementById('methodsList');
    if (!methods.length) {
      el.innerHTML = '<div class="empty"><i class="fas fa-credit-card"></i><p>No payment methods yet.<br/>Add one to start receiving withdrawals.</p></div>';
      return;
    }
    el.innerHTML = methods.map(function(m){
      var detail = m.type === 'bank' ? 'Account: <span>'+m.accountNumber+'</span><br/>Routing: <span>'+(m.routingCode||'—')+'</span>' :
                     m.type === 'paypal' ? 'Email: <span>'+m.email+'</span>' :
                     'Phone: <span>'+m.phoneNumber+'</span><br/>Provider: <span>'+m.provider+'</span>';
      var tags = [];
      if (m.isDefault) tags.push('<span class="tag default">Default</span>');
      if (m.verified) tags.push('<span class="tag verified"><i class="fas fa-check"></i> Verified</span>');
      else tags.push('<span class="tag unverified"><i class="fas fa-clock"></i> Unverified</span>');
      return '<div class="method-card'+(m.isDefault?' default':'')+'">'+
        '<div class="method-top">'+
          '<div class="method-icon '+m.type+'"><i class="fas '+m.icon+'"></i></div>'+
          '<div><div class="method-type">'+(m.type==='bank'?'Bank Transfer':m.type==='paypal'?'PayPal':'Mobile Money')+'</div><div class="method-name">'+(m.accountName||'')+'</div></div>'+
        '</div>'+
        '<div class="method-detail">'+detail+'</div>'+
        '<div class="method-tags">'+tags.join('')+'</div>'+
        '<div class="method-actions">'+
          (!m.isDefault ? '<button class="method-btn primary" onclick="setDefault(\''+m.id+'\')">Set as Default</button>' : '')+
          '<button class="method-btn danger" onclick="deleteMethod(\''+m.id+'\')"><i class="fas fa-trash"></i> Remove</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  function toggleTypeFields(){
    var t = document.getElementById('fType').value;
    document.getElementById('bankFields').style.display = t === 'bank' ? '' : 'none';
    document.getElementById('paypalFields').style.display = t === 'paypal' ? '' : 'none';
    document.getElementById('mobileFields').style.display = t === 'mobile' ? '' : 'none';
  }

  function closeForm(){ document.getElementById('addForm').classList.remove('show'); }

  async function addMethod(){
    var type = document.getElementById('fType').value;
    var accountName = document.getElementById('fAccountName').value.trim();
    if (!accountName) { toast('Enter account name'); return; }
    var data = { type: type, accountName: accountName, icon: type === 'bank' ? 'fa-building-columns' : type === 'paypal' ? 'fa-paypal' : 'fa-mobile-screen' };
    if (type === 'bank') {
      data.bankName = document.getElementById('fBankName').value.trim();
      data.accountNumber = document.getElementById('fAccountNum').value.trim();
      data.routingCode = document.getElementById('fRouting').value.trim();
      if (!data.bankName || !data.accountNumber) { toast('Fill in all bank details'); return; }
    } else if (type === 'paypal') {
      data.email = document.getElementById('fPaypalEmail').value.trim();
      if (!data.email) { toast('Enter PayPal email'); return; }
    } else {
      data.provider = document.getElementById('fProvider').value.trim();
      data.phoneNumber = document.getElementById('fPhone').value.trim();
      if (!data.provider || !data.phoneNumber) { toast('Fill in all mobile details'); return; }
    }
    try {
      await window.AuthorFinance.addPaymentMethod(data);
      closeForm();
      toast('Payment method added');
      render();
    } catch (e) { toast(e.message); }
  }

  async function setDefault(id){
    await window.AuthorFinance.setDefaultMethod(id);
    toast('Default method updated');
    render();
  }

  async function deleteMethod(id){
    if (!confirm('Remove this payment method?')) return;
    await window.AuthorFinance.deletePaymentMethod(id);
    toast('Method removed');
    render();
  }

  function init(){
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('payment-details.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    document.getElementById('addCard').addEventListener('click', function(){
      document.getElementById('addForm').classList.add('show');
    });
    render();
  }

  Svc.init = init;
  Svc.render = render;
  window.AuthorPaymentService = Svc;
  /* onclick refs in markup + generated HTML (+ onchange) */
  window.closeForm = closeForm;
  window.addMethod = addMethod;
  window.setDefault = setDefault;
  window.deleteMethod = deleteMethod;
  window.toggleTypeFields = toggleTypeFields;
})();
