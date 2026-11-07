/* ═══════════════════════════════════════════════════════════════
   STORE PAGE SERVICE — DEMO MODE
   Pure demo: no API fetches, no currency service, no blocking.
   When going live: replace demoData() with real API call + keep
   the same render/checkout flow intact.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let storeData = null;
  let currentTab = 'coins';

  /* ── Demo catalog ─────────────────────────────────────────── */
  function demoData() {
    const coins = localCoins();
    return {
      balance: { coins: coins, bonus: 0 },
      packs: [
        { id: 'pack1', coins: 100,  price: '₦600',    badge: '',           icon: 'fa-coins',  color: '#635F6E' },
        { id: 'pack2', coins: 500,  price: '₦2,400',  badge: 'Popular',    icon: 'fa-coins',  color: '#FF2D6A' },
        { id: 'pack3', coins: 1200, price: '₦4,800',  badge: 'Best Value', icon: 'fa-coins',  color: '#D6165A' },
        { id: 'pack4', coins: 2500, price: '₦9,000',  badge: '',           icon: 'fa-coins',  color: '#16A34A' },
      ],
      bundles: [
        { id: 'b1', name: 'Starter Bundle', coins: 500,  bonus: 50,   price: '₦2,400',  icon: 'fa-seedling', color: '#22c55e' },
        { id: 'b2', name: 'Pro Bundle',     coins: 1500, bonus: 300,  price: '₦6,000',  icon: 'fa-fire',     color: '#FF2D6A' },
        { id: 'b3', name: 'Elite Bundle',   coins: 5000, bonus: 1500, price: '₦18,000', icon: 'fa-crown',    color: '#D6165A' },
      ],
      adRewards: [
        { id: 'ad1', action: 'Watch Ad',         coins: 10, cooldown: '5 min',  icon: 'fa-film',          available: true },
        { id: 'ad2', action: 'Daily Check-in',   coins: 25, cooldown: '24 hr',  icon: 'fa-calendar-check',available: true },
        { id: 'ad3', action: 'Rate a Story',     coins: 5,  cooldown: '1 hr',   icon: 'fa-star',          available: true },
        { id: 'ad4', action: 'Share a Story',    coins: 15, cooldown: '2 hr',   icon: 'fa-share-nodes',   available: true },
        { id: 'ad5', action: 'Subscribe YouTube',coins: 30, cooldown: '30 days',icon: 'fa-youtube',       available: true },
      ],
      subscriptions: [
        { id: 'sub-daily',   name: 'Daily',   price: '₦600',    period: 'day',   badge: '',           color: '#635F6E', icon: 'fa-clock',         features: ['Unlimited reading for 24 hours'] },
        { id: 'sub-weekly',  name: 'Weekly',  price: '₦3,000',  period: 'week',  badge: 'Popular',    color: '#FF2D6A', icon: 'fa-calendar-week', features: ['Unlimited reading for 7 days', 'Save 14% vs daily'] },
        { id: 'sub-monthly', name: 'Monthly', price: '₦9,000',  period: 'month', badge: 'Best Value', color: '#D6165A', icon: 'fa-calendar',      features: ['Unlimited reading for 30 days', 'Save 50% vs daily'] },
        { id: 'sub-yearly',  name: 'Yearly',  price: '₦60,000', period: 'year',  badge: 'Best Deal',  color: '#16A34A', icon: 'fa-crown',         features: ['Unlimited reading for 365 days', 'Save 73% vs daily'] },
      ],
      mergeSub: {
        id: 'sub-merge', name: 'Merge Pass', price: '₦12,000', period: 'month',
        badge: 'Premium', color: '#7c3aed', icon: 'fa-bolt',
        features: ['Ad-free browsing', 'Ad-free reading', 'Unlimited reading', 'Priority support', 'Early access to new stories'],
      },
    };
  }

  /* ── Local coin balance (localStorage) ───────────────────── */
  const BAL_KEY = 'dro_store_balance';
  function localCoins() {
    const v = parseInt(localStorage.getItem(BAL_KEY), 10);
    return isNaN(v) ? 350 : v;
  }
  function saveCoins(n) {
    localStorage.setItem(BAL_KEY, String(Math.max(0, n)));
  }
  function addCoins(amount) {
    saveCoins(localCoins() + amount);
  }

  /* ── Tab switch ───────────────────────────────────────────── */
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tab-coins').style.display = tab === 'coins' ? '' : 'none';
    document.getElementById('tab-subscription').style.display = tab === 'subscription' ? '' : 'none';
  }

  /* ── Render helpers ───────────────────────────────────────── */
  function renderBalance(data) {
    const coins = Number((data.balance || {}).coins) || 0;
    document.getElementById('balanceCard').innerHTML = `
      <div class="balance-label">YOUR BALANCE</div>
      <div class="balance-row">
        <div class="balance-icon"><i class="fas fa-coins"></i></div>
        <div class="balance-coins">${coins.toLocaleString()}</div>
      </div>`;
  }

  function renderPacks(packs) {
    document.getElementById('packsGrid').innerHTML = packs.map(p => `
      <div class="pack-card" data-pack-id="${p.id}" onclick="selectPack('${p.id}')">
        ${p.badge ? `<div class="pack-badge${p.badge === 'Best Value' ? ' green' : ''}">${p.badge}</div>` : ''}
        <div class="pack-coins"><i class="fas fa-coins" style="color:${p.color||'#b45309'}"></i>${p.coins.toLocaleString()}</div>
        <div class="pack-label">coins</div>
        <div class="pack-price">${p.price}</div>
      </div>`).join('');
  }

  function renderBundles(bundles) {
    document.getElementById('bundlesList').innerHTML = bundles.map(b => `
      <div class="bundle-card" onclick="selectBundle('${b.id}')">
        <div class="bundle-icon" style="background:${b.color}"><i class="fas ${b.icon}"></i></div>
        <div class="bundle-info">
          <div class="bundle-name">${b.name}</div>
          <div class="bundle-coins">${b.coins.toLocaleString()} coins</div>
          <div class="bundle-bonus">+${b.bonus.toLocaleString()} bonus coins</div>
        </div>
        <div class="bundle-price">${b.price}</div>
      </div>`).join('');
  }

  function renderRewards(rewards) {
    document.getElementById('rewardsList').innerHTML = rewards.map(r => `
      <div class="reward-card">
        <div class="reward-icon"><i class="fas ${r.icon}"></i></div>
        <div class="reward-info">
          <div class="reward-action">${r.action}</div>
          <div class="reward-meta">Every ${r.cooldown}</div>
        </div>
        <div class="reward-coins"><i class="fas fa-coins"></i>+${r.coins}</div>
        <button class="reward-btn" onclick="handleEarn('${r.id}')">Claim</button>
      </div>`).join('');
  }

  function renderSubscriptions(subs) {
    document.getElementById('subsList').innerHTML = subs.map(s => `
      <div class="sub-card" data-sub-id="${s.id}" onclick="selectSub('${s.id}')">
        ${s.badge ? `<div class="sub-badge" style="background:${s.color}">${s.badge}</div>` : ''}
        <div class="sub-header">
          <div class="sub-icon" style="background:${s.color}"><i class="fas ${s.icon}"></i></div>
          <div>
            <div class="sub-name">${s.name}</div>
            <div class="sub-price">${s.price}</div>
            <div class="sub-period">per ${s.period}</div>
          </div>
        </div>
        <div class="sub-features">
          ${s.features.map(f => `<div class="sub-feature"><i class="fas fa-check-circle"></i>${f}</div>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderMergeSub(merge) {
    const box = document.getElementById('mergeSub');
    if (!box || !merge || !merge.id) { if (box) box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="merge-card" data-sub-id="${merge.id}" onclick="selectSub('${merge.id}')">
        <div class="merge-badge">${merge.badge}</div>
        <div class="merge-icon"><i class="fas ${merge.icon}"></i></div>
        <div class="merge-name">${merge.name}</div>
        <div class="merge-price">${merge.price}</div>
        <div class="merge-period">per ${merge.period}</div>
        <div class="merge-features">
          ${merge.features.map(f => `<div class="merge-feature"><i class="fas fa-check"></i>${f}</div>`).join('')}
        </div>
        <div class="merge-cta">Subscribe Now</div>
      </div>`;
  }

  /* ── Demo checkout sheet ──────────────────────────────────── */
  function openCheckout(item) {
    if (!window.DroboardPaySheet) { toast('Checkout unavailable'); return; }
    DroboardPaySheet.open({
      title: item.title,
      sub: item.sub,
      price: item.price,
      coins: item.coins || 0,
      packCode: item.id || 'demo',
      amountNGN: 0,
      isSub: item.kind === 'sub',
      onSuccess: function (receipt) {
        if (item.kind === 'sub') {
          toast('✅ Subscribed! (Demo) Enjoy unlimited reading');
        } else {
          const total = (item.coins || 0) + (item.bonus || 0);
          addCoins(total);
          storeData.balance.coins = localCoins();
          renderBalance(storeData);
          toast('🎉 +' + total.toLocaleString() + ' coins added!');
        }
      },
      onError: function () { toast('Purchase failed'); },
    });
  }

  /* ── Click handlers ───────────────────────────────────────── */
  function selectPack(id) {
    document.querySelectorAll('.pack-card').forEach(c => c.classList.toggle('selected', c.dataset.packId === id));
    const p = (storeData.packs || []).find(x => x.id === id);
    if (!p) return;
    openCheckout({ kind: 'pack', id: p.id, title: 'Coin Pack', sub: p.coins.toLocaleString() + ' coins', price: p.price, coins: p.coins, bonus: 0 });
  }

  function selectBundle(id) {
    const b = (storeData.bundles || []).find(x => x.id === id);
    if (!b) return;
    openCheckout({ kind: 'bundle', id: b.id, title: b.name, sub: b.coins.toLocaleString() + ' coins + ' + b.bonus.toLocaleString() + ' bonus', price: b.price, coins: b.coins, bonus: b.bonus });
  }

  function selectSub(id) {
    document.querySelectorAll('.sub-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    document.querySelectorAll('.merge-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    const s = (storeData.subscriptions || []).find(x => x.id === id)
      || (storeData.mergeSub && storeData.mergeSub.id === id ? storeData.mergeSub : null);
    if (!s) return;
    openCheckout({ kind: 'sub', id: s.id, title: s.name, sub: 'Subscription · per ' + s.period, price: s.price, coins: 0, bonus: 0 });
  }

  function handleEarn(id) {
    const r = (storeData.adRewards || []).find(x => x.id === id);
    if (!r) return;
    addCoins(r.coins);
    storeData.balance.coins = localCoins();
    renderBalance(storeData);
    toast('🎉 +' + r.coins + ' coins earned! (Demo)');
  }

  /* ── Report a problem (stub) ──────────────────────────────── */
  function openStoreReport() {
    toast('Report feature available in live mode');
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

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    storeData = demoData();
    renderBalance(storeData);
    renderPacks(storeData.packs);
    renderBundles(storeData.bundles);
    renderRewards(storeData.adRewards);
    renderSubscriptions(storeData.subscriptions);
    renderMergeSub(storeData.mergeSub);
    if (window.DroboardNav) DroboardNav.configure({ active: 'discover' });
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
})();
