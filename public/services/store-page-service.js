/* ═══════════════════════════════════════════════════════════════
   STORE PAGE SERVICE (call-and-render)
   Page-inline logic moved verbatim from Pages/store.html.
   Backend-ready: set USE_API=true and point API_BASE at the live API;
   demo behavior stays (StoreService fallback) while USE_API=false.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false, API_BASE = '/api';

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
    document.getElementById('balanceCard').innerHTML = `
      <div class="balance-label">YOUR BALANCE</div>
      <div class="balance-row">
        <div class="balance-icon"><i class="fas fa-coins"></i></div>
        <div class="balance-coins">${data.balance.coins.toLocaleString()}</div>
      </div>
      <div class="balance-level"><i class="fas fa-gem" style="margin-right:4px"></i>${data.balance.level} Member</div>`;
  }

  function renderPacks(packs) {
    document.getElementById('packsGrid').innerHTML = packs.map(p => `
      <div class="pack-card" data-pack-id="${p.id}" onclick="selectPack('${p.id}')">
        ${p.badge ? `<div class="pack-badge${p.badge === 'Best Value' ? ' green' : ''}">${p.badge}</div>` : ''}
        <div class="pack-coins">${p.coins.toLocaleString()}</div>
        <div class="pack-label">coins</div>
        <div class="pack-price">${priceFor(p)}</div>
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
        <div class="bundle-price">${priceFor(b)}</div>
      </div>`).join('');
  }

  function renderRewards(rewards) {
    document.getElementById('rewardsList').innerHTML = rewards.map(r => `
      <div class="reward-card">
        <div class="reward-icon"><i class="fas ${r.icon}"></i></div>
        <div class="reward-info">
          <div class="reward-action">${r.action}</div>
          <div class="reward-meta">Every ${r.cooldown}${r.type==='blog_read'?' · '+(r.pagesRequired||3)+' pages':''}${r.type==='youtube_watch' && r.minWatchSec ? ' · '+r.minWatchSec+'s watch':''}</div>
        </div>
        <div class="reward-coins"><i class="fas fa-coins"></i>+${r.coins}</div>
        <button class="reward-btn" ${r.available ? '' : 'disabled'} onclick="handleEarn('${r.id}')">Claim</button>
      </div>`).join('');
  }
  function handleEarn(id){
    const r=(storeData&&storeData.adRewards?storeData.adRewards:[]).find(x=>x.id===id);
    if(!r) return toast('Claiming…');
    if(r.type==='blog_read'){
      const pages=r.pagesRequired||3;
      const url=r.blogUrl||('blog.html?cat='+(r.blogCategory||'tech'));
      // support both relative Pages/blog.html and full https://
      const target = url.includes('http') ? url : url + (url.includes('?')?'&':'?') + 'earn='+encodeURIComponent(id);
      // check per-category progress if internal blog, else generic
      const cat=r.blogCategory||'tech';
      const key='dro_blog_read_ids_'+cat;
      let prog=0; try{ const arr=JSON.parse(localStorage.getItem(key)||'[]'); prog=Array.isArray(arr)?arr.length:0; }catch(e){}
      if(prog>=pages){
        if(window.StoreService&&StoreService.addCoins){ StoreService.addCoins(r.coins); storeData.balance=StoreService.getBalance(); renderBalance(storeData); }
        localStorage.setItem(key, JSON.stringify([]));
        return toast('🎉 +'+r.coins+' coins for reading '+pages+' blog pages!');
      }
      window.location.href=target;
      return;
    }
    if(r.type==='youtube_sub'){
      const ch=r.channelId||r.channelUrl||'';
      const url= ch.includes('http')?ch:'https://youtube.com/channel/'+ch+'?sub_confirmation=1';
      window.open(url,'_blank');
      setTimeout(()=>{
        if(window.StoreService&&StoreService.addCoins){ StoreService.addCoins(r.coins); storeData.balance=StoreService.getBalance(); renderBalance(storeData); }
        toast('✅ Subscribed! +'+r.coins+' coins');
      }, 2000);
      return;
    }
    if(r.type==='youtube_watch'){
      const vid=r.videoId||'';
      window.location.href='youtube-earn.html?vid='+encodeURIComponent(vid)+'&coins='+r.coins+'&sec='+(r.minWatchSec||60);
      return;
    }
    // default watch_ad etc
    if(window.StoreService&&StoreService.addCoins){ StoreService.addCoins(r.coins); storeData.balance=StoreService.getBalance(); renderBalance(storeData); }
    toast('Claiming +'+r.coins+' coins…');
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

  function openCheckout(item) {
    if (!window.DroboardPaySheet) { toast('Checkout unavailable'); return; }
    DroboardPaySheet.open({
      title: item.title, sub: item.sub, price: item.price, coins: item.coins,
      onSuccess: function (receipt) {
        // DEMO: credit locally. Live: POST receipt to backend verify endpoint,
        // backend credits coins only after Play/Paystack verification.
        var credit = (item.coins || 0) + (item.bonus || 0);
        if (window.StoreService && StoreService.addCoins && credit > 0) {
          StoreService.addCoins(credit);
          try { storeData.balance = StoreService.getBalance(); } catch (e) {}
          renderBalance(storeData);
        }
        toast('✅ Payment successful! +' + credit.toLocaleString() + ' coins');
      }
    });
  }

  // Strict pricing: block checkout unless the item has an exact local
  // price. Never charge a substituted/fallback price.
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
    openCheckout({ title: 'Coin Pack', sub: p.coins.toLocaleString() + ' coins', price: priceFor(p), coins: p.coins, bonus: 0 });
  }

  function selectBundle(id) {
    var b = (storeData.bundles || []).find(function (x) { return x.id === id; });
    if (!b) return;
    if (!priceOk(b)) return;
    openCheckout({ title: b.name, sub: b.coins.toLocaleString() + ' coins + ' + b.bonus.toLocaleString() + ' bonus', price: priceFor(b), coins: b.coins, bonus: b.bonus });
  }

  function selectSub(id) {
    document.querySelectorAll('.pack-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.sub-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    document.querySelectorAll('.merge-card').forEach(c => c.classList.toggle('selected', c.dataset.subId === id));
    var s = (storeData.subscriptions || []).find(function (x) { return x.id === id; })
      || ((storeData.mergeSub && storeData.mergeSub.id === id) ? storeData.mergeSub : null);
    if (!s) { toast('Selected plan — tap to subscribe'); return; }
    if (!priceOk(s)) return;
    openCheckout({ title: s.name, sub: 'Subscription · per ' + (s.period || 'month'), price: priceFor(s), coins: 0, bonus: 0 });
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
    try { data = await StoreService.fetchStoreData(); } catch (e) { data = { balance: { coins: 0, level: 'Bronze' }, packs: [], bundles: [], adRewards: [], subscriptions: [], mergeSub: {} }; }
    storeData = data;
    renderBalance(data);
    renderPacks(data.packs);
    renderBundles(data.bundles);
    renderRewards(data.adRewards);
    renderSubscriptions(data.subscriptions);
    renderMergeSub(data.mergeSub);
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
