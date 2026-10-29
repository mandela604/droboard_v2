/* ═══════════════════════════════════════════════════════════════
   STORE PAGE SERVICE (call-and-render)
   Page-inline logic moved verbatim from Pages/store.html.
   Catalog comes from GET /api/store (the finance console's own rows) with the
   demo catalog as fallback; checkout is live (server-verified, no local crediting).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  let selectedPack = null;
  let currentTab = 'coins';
  let storeData = null;

  // Localize a price for display. Each product carries an explicit
  // per-location ladder (prices:{NGN,USD,GBP}); the currency service
  // picks the reader's string. Legacy price/priceUSD still resolve.
  function priceFor(item) {
    if (!item) return '';
    if (window.DroboardCurrency) return DroboardCurrency.priceFor(item);
    return item.price || '';
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tab-coins').style.display = tab === 'coins' ? '' : 'none';
    document.getElementById('tab-subscription').style.display = tab === 'subscription' ? '' : 'none';
  }

  function renderBalance(data) {
    const b = data.balance || {};
    const coins = Number(b.coins) || 0;
    const bonus = Math.max(0, Math.min(coins, Number(b.bonus) || 0));
    /* Bonus is part of the total, never extra to it, so it is shown as a tag on
       the number the reader already knows — and says what it will not do. */
    document.getElementById('balanceCard').innerHTML = `
      <div class="balance-label">YOUR BALANCE</div>
      <div class="balance-row">
        <div class="balance-icon"><i class="fas fa-coins"></i></div>
        <div class="balance-coins">${coins.toLocaleString()}</div>
      </div>
      ${bonus > 0 ? `<div class="balance-split">
        <span class="balance-chip"><i class="fas fa-gift"></i>${bonus.toLocaleString()} bonus · reading only</span>
        <span class="balance-chip"><i class="fas fa-heart"></i>${(coins - bonus).toLocaleString()} can gift</span>
      </div>` : ''}`;
  }

  // Card chrome is typed by Finance into the catalog, so it is staff-authored
  // text landing in innerHTML on every reader's store page: only a bare
  // font-awesome class name and a #hex survive. Anything else falls back.
  function safeIcon(v, dflt) { return /^fa-[a-z0-9-]+$/i.test(String(v || '')) ? v : dflt; }
  function safeColor(v, dflt) { return /^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : dflt; }

  function renderPacks(packs) {
    document.getElementById('packsGrid').innerHTML = packs.map(p => `
      <div class="pack-card" data-pack-id="${p.id}" onclick="selectPack('${p.id}')">
        ${p.badge ? `<div class="pack-badge${p.badge === 'Best Value' ? ' green' : ''}">${p.badge}</div>` : ''}
        <div class="pack-coins"><i class="fas ${safeIcon(p.icon, 'fa-coins')}" style="color:${safeColor(p.color, 'var(--gold,#b45309)')}"></i>${p.coins.toLocaleString()}</div>
        <div class="pack-label">coins</div>
        <div class="pack-price">${priceFor(p)}</div>
      </div>`).join('');
  }

  function renderBundles(bundles) {
    document.getElementById('bundlesList').innerHTML = bundles.map(b => `
      <div class="bundle-card" onclick="selectBundle('${b.id}')">
        <div class="bundle-icon" style="background:${safeColor(b.color, '#7c3aed')}"><i class="fas ${safeIcon(b.icon, 'fa-gift')}"></i></div>
        <div class="bundle-info">
          <div class="bundle-name">${b.name}</div>
          <div class="bundle-coins">${b.coins.toLocaleString()} coins</div>
          <div class="bundle-bonus">+${b.bonus.toLocaleString()} bonus coins</div>
        </div>
        <div class="bundle-price">${priceFor(b)}</div>
      </div>`).join('');
  }

  function renderRewards(rewards) {
    // Every task type the server is willing to pay for is listed: the backend
    // drops anything half-configured (no ad URL, bad video id, no cooldown), so
    // a card here is a task whose claim will actually be honoured.
    const list = (rewards || []).filter(function (r) { return r && Number(r.coins) > 0; });
    let soonest = 0;
    document.getElementById('rewardsList').innerHTML = list.map(r => {
      const p = window.DroboardEarn ? DroboardEarn.pending(r.code || r.id) : null;
      const left = p ? DroboardEarn.waitSec(p) : 0;
      if (left > 0) soonest = soonest ? Math.min(soonest, left) : left;
      const btn = p
        ? (left > 0
            ? `<button class="reward-btn" disabled>${left}s left</button>`
            : `<button class="reward-btn" onclick="handleEarn('${r.id}')">Claim +${p.coins || r.coins}</button>`)
        : `<button class="reward-btn" ${r.available ? '' : 'disabled'} onclick="handleEarn('${r.id}')">${r.needsProof ? 'Start' : 'Claim'}</button>`;
      const hint = r.type === 'blog_read' ? ' · ' + (r.pagesRequired || 3) + ' pages, ' + (r.minWatchSec || 0) + 's'
        : (r.needsWatch && r.minWatchSec) ? ' · ' + r.minWatchSec + 's on the task'
        : '';
      return `
      <div class="reward-card">
        <div class="reward-icon"><i class="fas ${r.icon}"></i></div>
        <div class="reward-info">
          <div class="reward-action">${r.action}</div>
          <div class="reward-meta">Every ${r.cooldown}${hint}</div>
        </div>
        <div class="reward-coins"><i class="fas fa-coins"></i>+${r.coins}</div>
        ${btn}
      </div>`;
    }).join('');
    // Redraw the moment the shortest countdown lands, so a waiting card becomes
    // a Claim button without a per-second timer.
    if (soonest && window.DroboardEarn) {
      clearTimeout(renderRewards._t);
      renderRewards._t = setTimeout(function () {
        if (storeData && storeData.adRewards) renderRewards(storeData.adRewards);
      }, soonest * 1000 + 400);
    }
  }
  function fmtWait(sec){
    sec = Math.max(1, Math.round(Number(sec) || 0));
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.round(sec / 60) + ' min';
    return Math.round(sec / 3600) + ' hr';
  }
  function demoCredit(r){
    if (window.StoreService && StoreService.addCoins) {
      StoreService.addCoins(r.coins);
      storeData.balance = StoreService.getBalance();
      renderBalance(storeData);
    }
  }
  function credited(coins, balance) {
    if (balance != null && window.StoreService && StoreService.setServerBalance) StoreService.setServerBalance(balance);
    storeData.balance = StoreService.getBalance();
    renderBalance(storeData);
    toast('✅ +' + coins + ' coins credited');
    renderRewards(storeData.adRewards);
  }
  /* One tap, whatever the task type. DroboardEarn owns the protocol: start (the
     server hands out a single-use token + the destination) → do the task →
     claim with that token. The server refuses an early claim, a replayed token
     and any coin amount the client tried to bring itself, so there is no
     "credit 2s after opening a tab" anymore. A demo credit only happens with
     the backend unreachable AND a dev host. */
  function handleEarn(id){
    const r = (storeData && storeData.adRewards ? storeData.adRewards : []).find(x => x.id === id);
    if (!r) return toast('This reward is no longer available');
    if (!window.DroboardEarn) return toast('Earn service did not load');
    DroboardEarn.tap(r).then(function (res) {
      if (!res) return;
      if (res.kind === 'ok') {
        if (res.coins) return credited(res.coins, res.balance);
        toast('Do the task, then come back to claim +' + (res.pending && res.pending.coins || r.coins) + ' coins');
        renderRewards(storeData.adRewards);
        return;
      }
      if (res.kind === 'cooldown') return toast('⏳ Wait ' + fmtWait(res.retryAfterSec) + ' before claiming this again');
      if (res.kind === 'early') return toast('⏳ Stay on the task ' + fmtWait(res.retryAfterSec) + ' longer');
      if (res.kind === 'offline') {
        if (DroboardEarn.isLocal()) { demoCredit(r); toast('🎉 +' + r.coins + ' coins (demo — backend offline)'); return; }
        return toast('Could not reach the server — try again');
      }
      toast(res.msg || 'Could not claim');
    });
  }

  function renderSubscriptions(subs) {
    document.getElementById('subsList').innerHTML = subs.map(s => `
      <div class="sub-card" data-sub-id="${s.id}" onclick="selectSub('${s.id}')">
        ${s.badge ? `<div class="sub-badge" style="background:${s.color}">${s.badge}</div>` : ''}
        <div class="sub-header">
          <div class="sub-icon" style="background:${s.color}"><i class="fas ${s.icon}"></i></div>
          <div>
            <div class="sub-name">${s.name}</div>
            <div class="sub-price">${priceFor(s)}</div>
            <div class="sub-period">per ${s.period}</div>
          </div>
        </div>
        <div class="sub-features">
          ${s.features.map(f => `<div class="sub-feature"><i class="fas fa-check-circle"></i>${f}</div>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderMergeSub(merge) {
    document.getElementById('mergeSub').innerHTML = `
      <div class="merge-card" data-sub-id="${merge.id}" onclick="selectSub('${merge.id}')">
        <div class="merge-badge">${merge.badge}</div>
        <div class="merge-icon"><i class="fas ${merge.icon}"></i></div>
        <div class="merge-name">${merge.name}</div>
        <div class="merge-price">${priceFor(merge)}</div>
        <div class="merge-period">per ${merge.period}</div>
        <div class="merge-features">
          ${merge.features.map(f => `<div class="merge-feature"><i class="fas fa-check"></i>${f}</div>`).join('')}
        </div>
        <div class="merge-cta">Subscribe Now</div>
      </div>`;
  }

  var _catalog = null;
  async function liveCatalog() {
    if (_catalog) return _catalog;
    try {
      const res = await fetch('/api/store', { credentials: 'include' });
      if (res.ok) { _catalog = await res.json(); return _catalog; }
    } catch (e) {}
    return null;
  }
  function parseNGN(s) {
    const n = parseFloat(String(s || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  // Canonical charge amount (NGN) for an item: live catalog leg first,
  // demo price string as fallback. Null = unpriceable, never charge.
  async function amountNGNFor(kind, item) {
    try {
      const cat = await liveCatalog();
      const list = (cat && ((kind === 'pack' && cat.packs) || (kind === 'bundle' && cat.bundles) || (kind === 'sub' && cat.subscriptions))) || [];
      const code = item.code || item.id;
      const hit = list.find(function (x) { return String(x.code || x.id) === String(code); });
      if (hit && Number(hit.basePriceNGN) > 0) return Number(hit.basePriceNGN);
    } catch (e) {}
    const fallback = parseNGN(item.prices && item.prices.NGN);
    return fallback > 0 ? fallback : null;
  }

  async function refreshBalance() {
    try {
      const res = await fetch('/api/wallet/balance', { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      if (window.StoreService && StoreService.setServerBalance) StoreService.setServerBalance(j);
      storeData.balance = StoreService.getBalance();
      renderBalance(storeData);
    } catch (e) {}
  }

  function openCheckout(item) {
    if (!window.DroboardPaySheet) { toast('Checkout unavailable'); return; }
    if (!item.packCode) { toast('Item unavailable'); return; }
    amountNGNFor(item.kind, item).then(function (amountNGN) {
      if (!(amountNGN > 0)) { toast('Price unavailable in your region'); return; }
      DroboardPaySheet.open({
        title: item.title, sub: item.sub, price: item.price,
        packCode: item.packCode, amountNGN: amountNGN,
        onSuccess: function (receipt) {
          // Server truth only: backend verified + credited. Refresh balance.
          recordReceipt(item, receipt);
          refreshBalance();
          if (receipt && receipt.plan) toast('✅ Subscribed! Enjoy unlimited reading');
          else toast('✅ Payment successful! Balance updated');
        },
        onError: function (err) {
          if (!err) { toast('Payment failed'); return; }
          if (err.message === 'paystack_not_configured' || err.message === 'flutterwave_not_configured' || err.message === 'no_provider_configured') toast('Payments not enabled yet');
          else if (err.message === 'store_billing_unavailable') toast('In-app billing coming soon');
          else if (err.message === 'email_required') toast('Add an email to your profile first');
          else toast('Payment failed' + (err.status ? ' (' + err.status + ')' : ''));
        },
      });
    });
  }

  /* ── Reader "report a problem" ──
     Successful checkouts and gift tips are logged locally so a report can name
     the exact purchase; it reaches finance via the shared DroboardDisputes store. */
  var RECEIPTS_KEY = 'dro_reader_receipts';
  function readerName() {
    var D = window.DemoData || {};
    return (D.CURRENT_READER && D.CURRENT_READER.name) || 'Luna Vale';
  }
  function readReceipts() {
    try { var v = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  /* Server history wins over the local log: the ids are real CoinTransaction
     ids, so a report can name the exact charge finance will find in the ledger. */
  function writeServerReceipts(items) {
    try {
      var list = items.slice(0, 20).map(function (t) {
        var title = (t.note || t.type || 'Purchase').split(' — ')[0];
        return {
          id: String(t.id), title: title, sub: t.type, price: (t.coins || 0).toLocaleString() + ' coins',
          amount: Number(t.fiatAmount) || 0, usd: 0, kind: t.type, at: t.at,
        };
      });
      if (list.length) localStorage.setItem(RECEIPTS_KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function loadHistory() {
    return fetch(API_BASE + '/wallet/transactions', { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; });
  }
  function recordReceipt(item, receipt) {
    try {
      var list = readReceipts();
      list.unshift({
        id: (receipt && (receipt.reference || receipt.id)) || 'RC-' + Date.now(),
        title: item.title, sub: item.sub, price: item.price,
        amount: Number(receipt && receipt.amount) || 0,
        usd: Number(item.priceUSD) || 0,
        kind: item.kind,
        at: new Date().toISOString(),
      });
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) {}
  }
  var FIELD = 'width:100%;padding:9px;border-radius:9px;border:1px solid var(--divider);font-family:inherit;font-size:12.5px;margin-bottom:6px';
  function openStoreReport() {
    var slot = document.getElementById('reportSlot');
    if (!slot) return;
    if (slot.childElementCount) { slot.innerHTML = ''; return; }
    var list = readReceipts();
    var opts = list.slice(0, 5).map(function (r) {
      return '<option value="' + r.id + '">' + r.title + ' — ' + r.price + ' · ' + new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</option>';
    }).join('');
    slot.innerHTML = '<div style="border:1px solid var(--divider);border-radius:14px;padding:12px;margin-bottom:14px">' +
      '<div style="font-size:12.5px;font-weight:800;margin-bottom:8px">What went wrong?</div>' +
      (opts ? '<select id="reportItem" style="' + FIELD + '">' + opts + '<option value="other">Something else</option></select>' : '') +
      '<select id="reportReasonSel" style="' + FIELD + '">' +
      '<option>Coins were not credited</option><option>Gift was not delivered</option><option>Charged twice</option><option>Charged the wrong amount</option><option>Other</option></select>' +
      '<textarea id="reportNote" rows="2" placeholder="Add details (optional)" style="' + FIELD + '"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:4px"><button id="reportCancel" style="flex:1;padding:9px;border-radius:9px;border:1px solid var(--divider);background:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>' +
      '<button id="reportSend" style="flex:1;padding:9px;border-radius:9px;border:none;background:var(--pink);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Submit</button></div></div>';
    document.getElementById('reportCancel').onclick = function () { slot.innerHTML = ''; };
    document.getElementById('reportSend').onclick = function () {
      var reason = document.getElementById('reportReasonSel').value;
      var note = document.getElementById('reportNote').value.trim();
      var itemSel = document.getElementById('reportItem');
      var picked = itemSel ? readReceipts().find(function (x) { return x.id === itemSel.value; }) : null;
      var label = picked ? picked.title + (picked.price ? ' — ' + picked.price : '') : 'Coin purchase / tip';
      var fullReason = reason + (note ? ': ' + note : '');
      var payload = {
        reason: fullReason, role: 'reader', item: label,
        amount: picked ? (picked.amount || 0) : 0,
        transactionId: picked ? String(picked.id).slice(0, 40) : '',
      };
      if (window.DroboardDisputes) {
        DroboardDisputes.add(Object.assign({ who: readerName(), txnId: payload.transactionId || 'GENERAL-' + Date.now() }, payload));
      }
      slot.innerHTML = '';
      toast('✅ Report submitted — finance will review it');
    };
  }

  function priceOk(item) {
    if (!window.DroboardCurrency) return true;
    var r = DroboardCurrency.resolve(item);
    if (!r.ok) {
      try { console.error('[DroboardCurrency]', r.error, r.product || '', r.currency || ''); } catch (e) {}
      toast('Price unavailable in your region (' + r.error + ')');
      return false;
    }
    return true;
  }

  function selectPack(id) {
    selectedPack = id;
    document.querySelectorAll('.pack-card').forEach(c => c.classList.toggle('selected', c.dataset.packId === id));
    document.querySelectorAll('.sub-card, .merge-card').forEach(c => c.classList.remove('selected'));
    var p = (storeData.packs || []).find(function (x) { return x.id === id; });
    if (!p) { toast('Selected pack — tap to purchase'); return; }
    if (!priceOk(p)) return;
    openCheckout({ kind: 'pack', packCode: p.code || p.id, title: 'Coin Pack', sub: p.coins.toLocaleString() + ' coins', price: priceFor(p), prices: p.prices, coins: p.coins, bonus: 0 });
  }

  function selectBundle(id) {
    var b = (storeData.bundles || []).find(function (x) { return x.id === id; });
    if (!b) return;
    if (!priceOk(b)) return;
    openCheckout({ kind: 'bundle', packCode: b.code || b.id, title: b.name, sub: b.coins.toLocaleString() + ' coins + ' + b.bonus.toLocaleString() + ' bonus', price: priceFor(b), prices: b.prices, coins: b.coins, bonus: b.bonus });
  }

  function selectSub(id) {
    document.querySelectorAll('.pack-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.sub-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    document.querySelectorAll('.merge-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    var s = (storeData.subscriptions || []).find(function (x) { return x.id === id; })
      || ((storeData.mergeSub && storeData.mergeSub.id === id) ? storeData.mergeSub : null);
    if (!s) { toast('Selected plan — tap to subscribe'); return; }
    if (!priceOk(s)) return;
    openCheckout({ kind: 'sub', packCode: s.code || s.id, title: s.name, sub: 'Subscription · per ' + (s.period || 'month'), price: priceFor(s), prices: s.prices, coins: 0, bonus: 0 });
  }

  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1c1c22;color:#fff;padding:10px 20px;border-radius:24px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap;font-family:var(--font-body)';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  async function init() {
    let data;
    try { data = await StoreService.fetchStoreData(); } catch (e) { data = { balance: { coins: 0 }, packs: [], bundles: [], adRewards: [], subscriptions: [], mergeSub: {} }; }
    storeData = data;
    renderBalance(data);
    renderPacks(data.packs);
    renderBundles(data.bundles);
    renderRewards(data.adRewards);
    renderSubscriptions(data.subscriptions);
    renderMergeSub(data.mergeSub);
    // Which providers can actually take money today (Flutterwave until the
    // Paystack keys exist) — read once, before anyone taps Buy.
    if (window.PaymentService && PaymentService.warm) PaymentService.warm();
    // Real history/balance when the wallet API answers; silent otherwise.
    loadHistory().then(function (h) {
      if (!h || !Array.isArray(h.items)) return;
      writeServerReceipts(h.items);
      if (h.balance && h.balance.coins != null && storeData) {
        if (window.StoreService && StoreService.setServerBalance) StoreService.setServerBalance(h.balance);
        storeData.balance = StoreService.getBalance();
        renderBalance(storeData);
      }
    });
    // Re-price if geo-detection resolves after first paint.
    if (window.DroboardCurrency && !init._curSub) {
      init._curSub = true;
      DroboardCurrency.onChange(function () {
        if (!storeData) return;
        renderPacks(storeData.packs);
        renderBundles(storeData.bundles);
        renderSubscriptions(storeData.subscriptions);
        renderMergeSub(storeData.mergeSub);
      });
    }
  }

  init();

  if (window.DroboardNav) {
    DroboardNav.configure({ active: 'discover' });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
    });
  }

  // Expose identical window globals the HTML inline onclick attributes expect.
  window.switchTab = switchTab;
  window.openStoreReport = openStoreReport;
  window.renderBalance = renderBalance;
  window.renderPacks = renderPacks;
  window.renderBundles = renderBundles;
  window.renderRewards = renderRewards;
  window.handleEarn = handleEarn;
  window.renderSubscriptions = renderSubscriptions;
  window.renderMergeSub = renderMergeSub;
  window.selectPack = selectPack;
  window.selectBundle = selectBundle;
  window.selectSub = selectSub;
  window.toast = toast;
})();
