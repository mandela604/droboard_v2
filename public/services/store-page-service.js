/* ═══════════════════════════════════════════════════════════════
   STORE PAGE SERVICE — Pages/store.html (window.StorePage)
   Live only. One read feeds every section:
     GET /api/store (via StoreService.fetchStoreData)
       → balance {coins,bonus,paid}, packs, bundles, adRewards,
         subscriptions, mergeSub
   Buying runs the real checkout sheet (DroboardPaySheet →
   PaymentService → POST /api/payments/:channel/verify). Coin packs and
   bundles are booked at face value in naira (item.basePriceNGN) for the PAID
   coins; bonus coins ride along uncharged. Earning runs the shared
   start→claim protocol (DroboardEarn → POST /api/wallet/earn[/start]);
   the server owns amounts and cooldowns. Guests get the login gate —
   this is a purchasing page, not a browse page. Any load failure shows
   an explicit error empty-state with the message; no catalog is ever
   invented client-side.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let storeData = null;
  let currentTab = 'coins';

  /* ── State containers ─────────────────────────────────────── */
  function contentEl() { return document.querySelector('.content'); }
  function showState(html) {
    const content = contentEl();
    if (!content) return;
    ['balanceCard', 'tab-coins', 'tab-subscription'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.tabs').forEach((el) => { el.style.display = 'none'; });
    let box = document.getElementById('storeState');
    if (!box) {
      box = document.createElement('div');
      box.id = 'storeState';
      content.prepend(box);
    }
    box.style.display = '';
    box.innerHTML = html;
  }
  function hideState() {
    const box = document.getElementById('storeState');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    ['balanceCard', 'tab-coins', 'tab-subscription'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    document.querySelectorAll('.tabs').forEach((el) => { el.style.display = ''; });
    applyTab();
  }
  function errorHtml(msg) {
    return '<div class="store-state">'
      + '<i class="fas fa-triangle-exclamation" style="font-size:26px;color:var(--pink)"></i>'
      + '<div style="font-size:14px;font-weight:800;margin-top:10px">Could not load the store</div>'
      + '<div style="font-size:12px;color:var(--gray-600);margin-top:6px">' + esc(msg) + '</div>'
      + '<button class="store-state-btn" onclick="StorePage.init()">Try again</button>'
      + '</div>';
  }
  function guestHtml() {
    const href = (window.AuthSession && AuthSession.loginUrl)
      ? AuthSession.loginUrl('store.html') : 'login.html?next=store.html';
    return '<div class="store-state">'
      + '<i class="fas fa-lock" style="font-size:26px;color:var(--pink)"></i>'
      + '<div style="font-size:14px;font-weight:800;margin-top:10px">Sign in to open the store</div>'
      + '<div style="font-size:12px;color:var(--gray-600);margin-top:6px">Coin packs, bundles and subscriptions need an account.</div>'
      + '<a class="store-state-btn" style="text-decoration:none" href="' + href + '">Log in</a>'
      + '</div>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── Tab switch ───────────────────────────────────────────── */
  function applyTab() {
    const coins = document.getElementById('tab-coins');
    const subs = document.getElementById('tab-subscription');
    if (coins) coins.style.display = currentTab === 'coins' ? '' : 'none';
    if (subs) subs.style.display = currentTab === 'subscription' ? '' : 'none';
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
  }
  function switchTab(tab) {
    currentTab = tab;
    applyTab();
  }

  /* ── Render helpers ───────────────────────────────────────── */
  function renderBalance(data) {
    const bal = data.balance || {};
    const coins = Number(bal.coins) || 0;
    const bonus = Number(bal.bonus) || 0;
    const paid = Number(bal.paid != null ? bal.paid : coins - bonus) || 0;
    const chips = [];
    if (bonus > 0) chips.push('<div class="balance-chip"><i class="fas fa-gift"></i>' + bonus.toLocaleString() + ' bonus</div>');
    if (paid > 0) chips.push('<div class="balance-chip"><i class="fas fa-wallet"></i>' + paid.toLocaleString() + ' paid</div>');
    document.getElementById('balanceCard').innerHTML = `
      <div class="balance-label">YOUR BALANCE</div>
      <div class="balance-row">
        <div class="balance-icon"><i class="fas fa-coins"></i></div>
        <div class="balance-coins">${coins.toLocaleString()}</div>
      </div>
      ${chips.length ? '<div class="balance-split">' + chips.join('') + '</div>' : ''}`;
  }

  function renderPacks(packs) {
    document.getElementById('packsGrid').innerHTML = (packs || []).map((p) => {
      const bonus = Number(p.bonusCoins) || 0;
      return `
      <div class="pack-card" data-pack-id="${esc(p.id)}" onclick="selectPack('${esc(p.id)}')">
        ${p.badge ? `<div class="pack-badge${p.badge === 'Best Value' ? ' green' : ''}">${esc(p.badge)}</div>` : ''}
        <div class="pack-coins"><i class="fas fa-coins" style="color:${esc(p.color || '#b45309')}"></i>${(Number(p.coins) || 0).toLocaleString()}</div>
        <div class="pack-label">coins${bonus > 0 ? ' +' + bonus.toLocaleString() + ' bonus' : ''}</div>
        <div class="pack-price">${esc(p.price)}</div>
      </div>`;
    }).join('');
  }

  function renderBundles(bundles) {
    document.getElementById('bundlesList').innerHTML = (bundles || []).map((b) => `
      <div class="bundle-card" onclick="selectBundle('${esc(b.id)}')">
        <div class="bundle-icon" style="background:${esc(b.color || '#7c3aed')}"><i class="fas ${esc(b.icon || 'fa-gift')}"></i></div>
        <div class="bundle-info">
          <div class="bundle-name">${esc(b.name)}</div>
          <div class="bundle-coins">${(Number(b.coins) || 0).toLocaleString()} coins</div>
          <div class="bundle-bonus">+${(Number(b.bonus) || 0).toLocaleString()} bonus coins</div>
        </div>
        <div class="bundle-price">${esc(b.price)}</div>
      </div>`).join('');
  }

  function renderRewards(rewards) {
    document.getElementById('rewardsList').innerHTML = (rewards || []).map((r) => {
      const label = (window.DroboardEarn && DroboardEarn.buttonText(r)) || 'Claim';
      return `
      <div class="reward-card">
        <div class="reward-icon"><i class="fas ${esc(r.icon || 'fa-coins')}"></i></div>
        <div class="reward-info">
          <div class="reward-action">${esc(r.label || r.action)}</div>
          <div class="reward-meta">${r.cooldown ? 'Every ' + esc(r.cooldown) : ''}</div>
        </div>
        <div class="reward-coins"><i class="fas fa-coins"></i>+${Number(r.coins) || 0}</div>
        <button class="reward-btn" data-reward-id="${esc(r.id)}" onclick="handleEarn('${esc(r.id)}')">${esc(label)}</button>
      </div>`;
    }).join('');
  }

  function renderSubscriptions(subs) {
    document.getElementById('subsList').innerHTML = (subs || []).map((s) => `
      <div class="sub-card" data-sub-id="${esc(s.id)}" onclick="selectSub('${esc(s.id)}')">
        ${s.badge ? `<div class="sub-badge" style="background:${esc(s.color || '#FF2D6A')}">${esc(s.badge)}</div>` : ''}
        <div class="sub-header">
          <div class="sub-icon" style="background:${esc(s.color || '#FF2D6A')}"><i class="fas ${esc(s.icon || 'fa-crown')}"></i></div>
          <div>
            <div class="sub-name">${esc(s.name)}</div>
            <div class="sub-price">${esc(s.price)}</div>
            <div class="sub-period">per ${esc(s.period)}</div>
          </div>
        </div>
        <div class="sub-features">
          ${(s.features || []).map((f) => `<div class="sub-feature"><i class="fas fa-check-circle"></i>${esc(f)}</div>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderMergeSub(merge) {
    const box = document.getElementById('mergeSub');
    if (!box) return;
    if (!merge || !merge.id) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="merge-card" data-sub-id="${esc(merge.id)}" onclick="selectSub('${esc(merge.id)}')">
        ${merge.badge ? `<div class="merge-badge">${esc(merge.badge)}</div>` : ''}
        <div class="merge-icon"><i class="fas ${esc(merge.icon || 'fa-bolt')}"></i></div>
        <div class="merge-name">${esc(merge.name)}</div>
        <div class="merge-price">${esc(merge.price)}</div>
        <div class="merge-period">per ${esc(merge.period)}</div>
        <div class="merge-features">
          ${(merge.features || []).map((f) => `<div class="merge-feature"><i class="fas fa-check"></i>${esc(f)}</div>`).join('')}
        </div>
        <div class="merge-cta">Subscribe Now</div>
      </div>`;
  }

  /* ── Checkout (real payment sheet → server verify) ────────── */
  /* The naira face value the server books the purchase at. Comes from the
     catalog row (basePriceNGN); the formatted NGN leg is the only fallback
     parse — a pack with neither has no price and cannot be bought. */
  function ngnOf(item) {
    const n = Number(item && item.basePriceNGN);
    if (isFinite(n) && n > 0) return n;
    const leg = item && item.prices && item.prices.NGN;
    const p = parseFloat(String(leg || '').replace(/[^0-9.]/g, ''));
    return isFinite(p) ? p : 0;
  }

  function openCheckout(item) {
    if (!window.DroboardPaySheet) { toast('Checkout unavailable — payment sheet failed to load'); return; }
    const amountNGN = ngnOf(item);
    if (!(amountNGN > 0)) { toast('This item has no price yet — check back soon'); return; }
    DroboardPaySheet.open({
      title: item.title,
      sub: item.sub,
      price: item.price,
      coins: item.coins || 0,
      packCode: item.id,
      amountNGN: amountNGN,
      isSub: item.kind === 'sub',
      onSuccess: function () {
        afterPurchase(item);
      },
      onError: function (err) {
        toast('Purchase failed — ' + ((err && err.message) || 'try again'));
      },
    });
  }

  /* Coins/entitlements are credited server-side only; the wallet read is
     the truth, never a local increment. */
  function afterPurchase(item) {
    if (item.kind === 'sub') {
      toast('✅ Subscribed to ' + item.title + ' — enjoy unlimited reading');
      return;
    }
    const total = (item.coins || 0) + (item.bonus || 0);
    if (window.StoreService && StoreService.syncBalance) {
      StoreService.syncBalance().then(function (bal) {
        if (storeData) { storeData.balance = bal; renderBalance(storeData); }
        toast('🎉 +' + total.toLocaleString() + ' coins added!');
      });
    } else {
      toast('🎉 Purchase complete — balance updates on next load');
    }
  }

  /* ── Click handlers ───────────────────────────────────────── */
  function selectPack(id) {
    document.querySelectorAll('.pack-card').forEach((c) => c.classList.toggle('selected', c.dataset.packId === id));
    const p = (storeData.packs || []).find((x) => x.id === id);
    if (!p) return;
    const bonus = Number(p.bonusCoins) || 0;
    openCheckout({
      kind: 'pack', id: p.code || p.id,
      title: p.title || 'Coin Pack',
      sub: (Number(p.coins) || 0).toLocaleString() + ' coins' + (bonus > 0 ? ' + ' + bonus.toLocaleString() + ' bonus' : ''),
      price: p.price, coins: p.coins, bonus: bonus,
    });
  }

  function selectBundle(id) {
    const b = (storeData.bundles || []).find((x) => x.id === id);
    if (!b) return;
    openCheckout({
      kind: 'bundle', id: b.code || b.id,
      title: b.name,
      sub: (Number(b.coins) || 0).toLocaleString() + ' coins + ' + (Number(b.bonus) || 0).toLocaleString() + ' bonus',
      price: b.price, coins: b.coins, bonus: b.bonus,
    });
  }

  function selectSub(id) {
    document.querySelectorAll('.sub-card').forEach((c) => c.classList.toggle('selected', c.dataset.subId === id));
    document.querySelectorAll('.merge-card').forEach((c) => c.classList.toggle('selected', c.dataset.subId === id));
    const s = (storeData.subscriptions || []).find((x) => x.id === id)
      || (storeData.mergeSub && storeData.mergeSub.id === id ? storeData.mergeSub : null);
    if (!s) return;
    openCheckout({
      kind: 'sub', id: s.code || s.id,
      title: s.name,
      sub: 'Subscription · per ' + s.period,
      price: s.price, coins: 0, bonus: 0,
    });
  }

  /* ── Earn: the shared start→claim protocol ────────────────── */
  function handleEarn(id) {
    const r = (storeData.adRewards || []).find((x) => x.id === id);
    if (!r) return;
    if (!window.DroboardEarn) { toast('Earn service unavailable'); return; }
    DroboardEarn.tap(r).then(function (out) {
      const kind = out && out.kind;
      if (kind === 'ok') {
        if (out.pending) return; // sent to the task target; claim happens there
        refreshBalance('🎉 +' + (Number(out.coins) || 0) + ' coins earned!');
        return;
      }
      if (kind === 'cooldown' || kind === 'early') {
        const s = Number(out.retryAfterSec) || 0;
        toast(s > 90 ? 'Available again in ' + Math.round(s / 60) + ' min' : 'Available again in ' + s + 's');
        renderRewards(storeData.adRewards);
        return;
      }
      if (kind === 'restart') { toast(out.msg || 'Start the task again to earn this'); return; }
      if (kind === 'gone') { toast(out.msg || 'This reward is no longer available'); return; }
      if (kind === 'auth') {
        location.href = (window.AuthSession && AuthSession.loginUrl)
          ? AuthSession.loginUrl('store.html') : 'login.html?next=store.html';
        return;
      }
      if (kind === 'offline') { toast('Could not reach the earn service — check your connection'); return; }
      toast(out && out.msg ? out.msg : 'Could not claim this reward');
    });
  }

  function refreshBalance(msg) {
    if (window.StoreService && StoreService.syncBalance) {
      StoreService.syncBalance().then(function (bal) {
        if (storeData) { storeData.balance = bal; renderBalance(storeData); }
        if (msg) toast(msg);
      });
    } else if (msg) toast(msg);
  }

  /* ── Report a purchase problem (POST /api/finance/disputes via
        the shared DroboardDisputes store) ─────────────────────── */
  function openStoreReport() {
    if (!window.DroboardDisputes || !DroboardDisputes.add) {
      toast('Could not file the report — service unavailable');
      return;
    }
    const reason = window.prompt('Describe the problem with your purchase:');
    if (!reason || !reason.trim()) return;
    const who = (window.AuthSession && AuthSession.getSync) ? (AuthSession.getSync().handle || 'Reader') : 'Reader';
    DroboardDisputes.add({
      who, role: 'reader',
      reason: reason.trim().slice(0, 300),
      item: 'Store purchase',
      amount: 0,
    });
    toast('🚩 Report filed. Finance will review it.');
  }

  /* ── Toast ────────────────────────────────────────────────── */
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
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
  }

  /* ── Loader ───────────────────────────────────────────────── */
  function showLoader() {
    let el = document.getElementById('storeLoader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'storeLoader';
      el.style.cssText = 'text-align:center;padding:40px 0;color:var(--gray-400);font-size:13px;font-weight:700';
      el.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="margin-right:8px"></i>Loading store…';
      const content = contentEl();
      if (content) content.prepend(el);
    }
    el.style.display = '';
  }
  function hideLoader() {
    const el = document.getElementById('storeLoader');
    if (el) el.style.display = 'none';
  }

  /* ── Init ─────────────────────────────────────────────────── */
  async function init() {
    hideState();
    showLoader();
    try {
      if (window.AuthSession && AuthSession.isGuest && AuthSession.isGuest()) {
        showState(guestHtml());
        return;
      }
      if (!window.StoreService || !StoreService.fetchStoreData) {
        throw new Error('Store service failed to load');
      }
      storeData = await StoreService.fetchStoreData();
      renderBalance(storeData);
      renderPacks(storeData.packs);
      renderBundles(storeData.bundles);
      renderRewards(storeData.adRewards);
      renderSubscriptions(storeData.subscriptions);
      renderMergeSub(storeData.mergeSub);
      applyTab();
      // The catalog endpoint attaches the balance when it can; the wallet
      // read is the authoritative split ({coins, bonus, paid}).
      if (StoreService.syncBalance) {
        StoreService.syncBalance().then(function (bal) {
          if (storeData) { storeData.balance = bal; renderBalance(storeData); }
        });
      }
    } catch (e) {
      showState(errorHtml((e && e.message) ? e.message : 'request failed'));
    } finally {
      hideLoader();
      if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  /* ── Globals for HTML onclick ─────────────────────────────── */
  window.switchTab      = switchTab;
  window.selectPack     = selectPack;
  window.selectBundle   = selectBundle;
  window.selectSub      = selectSub;
  window.handleEarn     = handleEarn;
  window.openStoreReport = openStoreReport;
  window.StorePage = { init, toast };
})();
