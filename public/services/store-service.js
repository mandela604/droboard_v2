/* ═══════════════════════════════════════════════════════════════
   STORE SERVICE
   Coin packs, bundles, and ad rewards. HTML calls StorePage.init().
   Live first: GET /api/store is the catalog the finance console edits.
   Every getter below is the demo fallback for when the backend is down.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  function _financePacks(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_packs')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getCoinPacks() {
    const fp=_financePacks(); if(fp) return fp;
    return [
      { id: 'pack1', coins: 100, price: '$0.99', priceUSD: 0.99, prices: { NGN: '₦600', USD: '$0.99', GBP: '£1.13' }, badge: '', color: '#635F6E' },
      { id: 'pack2', coins: 500, price: '$3.99', priceUSD: 3.99, prices: { NGN: '₦2,400', USD: '$3.99', GBP: '£4.55' }, badge: 'Popular', color: '#FF2D6A' },
      { id: 'pack3', coins: 1200, price: '$7.99', priceUSD: 7.99, prices: { NGN: '₦4,800', USD: '$7.99', GBP: '£9.11' }, badge: 'Best Value', color: '#D6165A' },
      { id: 'pack4', coins: 2500, price: '$14.99', priceUSD: 14.99, prices: { NGN: '₦9,000', USD: '$14.99', GBP: '£17.09' }, badge: '', color: '#16A34A' },
    ];
  }

  function _financeBundles(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_bundles')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getBundles() {
    const fb=_financeBundles(); if(fb) return fb;
    return [
      { id: 'b1', name: 'Starter Bundle', coins: 500, bonus: 50, price: '$3.99', priceUSD: 3.99, prices: { NGN: '₦2,400', USD: '$3.99', GBP: '£4.55' }, icon: 'fa-seedling', color: '#22c55e' },
      { id: 'b2', name: 'Pro Bundle', coins: 1500, bonus: 300, price: '$9.99', priceUSD: 9.99, prices: { NGN: '₦6,000', USD: '$9.99', GBP: '£11.39' }, icon: 'fa-fire', color: '#FF2D6A' },
      { id: 'b3', name: 'Elite Bundle', coins: 5000, bonus: 1500, price: '$29.99', priceUSD: 29.99, prices: { NGN: '₦18,000', USD: '$29.99', GBP: '£34.19' }, icon: 'fa-crown', color: '#D6165A' },
    ];
  }

  function _financeRewards(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_rewards')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getAdRewards() {
    const fr=_financeRewards(); if(fr) return fr;
    // Offline demo only, and every task type is listed — the live catalog
    // (finance → Coin Transactions) replaces this whole list, and the server
    // decides which of its own rows are complete enough to be offered.
    return [
      { id: 'ad1', action: 'Watch Ad', coins: 10, cooldown: '5 min', icon: 'fa-film', available: true, type: 'watch_ad', needsProof: true, needsWatch: true, minWatchSec: 20, target: '' },
      { id: 'ad2', action: 'Daily Check-in', coins: 25, cooldown: '24 hr', icon: 'fa-calendar-check', available: true, type: 'checkin' },
      { id: 'ad3', action: 'Rate Story', coins: 5, cooldown: '1 hr', icon: 'fa-star', available: true, type: 'rate', needsProof: true, target: 'Pages/library.html' },
      { id: 'ad4', action: 'Share Story', coins: 15, cooldown: '2 hr', icon: 'fa-share-nodes', available: true, type: 'share', needsProof: true, target: 'Pages/library.html' },
      { id: 'ad5', action: 'Read Blog — Tech (3 pages)', coins: 25, cooldown: '24 hr', icon: 'fa-newspaper', available: true, type: 'blog_read', pagesRequired: 3, blogCategory: 'tech', blogUrl: 'Pages/blog.html?cat=tech', needsProof: true, needsWatch: true, minWatchSec: 45, target: 'Pages/blog.html?cat=tech' },
      { id: 'ad6', action: 'Subscribe on YouTube', coins: 30, cooldown: '30 days', icon: 'fa-youtube', available: true, type: 'youtube_sub', channelId: '@droboard', needsProof: true, target: 'https://www.youtube.com/@droboard?sub_confirmation=1' },
      { id: 'ad7', action: 'Watch YouTube Video', coins: 15, cooldown: '24 hr', icon: 'fa-play', available: true, type: 'youtube_watch', videoId: 'dQw4w9WgXcQ', minWatchSec: 60, needsProof: true, needsWatch: true, target: 'youtube-earn.html?vid=dQw4w9WgXcQ&sec=60&earn=ad7' },
    ];
  }

  /* Live rewards (finance → Coin Transactions) normalized to the card shape.
     GET /api/store already hands back the validated, fully shaped task (label,
     target, needsProof, minWatchSec); this only fills gaps for rows that came
     from elsewhere, and never invents a destination. */
  function normalizeReward(r) {
    const m = (r && r.meta && typeof r.meta === 'object') ? r.meta : {};
    const x = (k) => (r[k] !== undefined ? r[k] : m[k]);
    const rawIcon = String(x('icon') || 'fa-coins');
    const icon = /^fa-[a-z0-9-]+$/i.test(rawIcon) ? rawIcon : 'fa-coins';
    const tgt = String(x('target') || '');
    return {
      id: r.id || r.code, code: r.code || r.id, action: r.action, label: r.label || r.action,
      type: r.type, coins: Number(r.coins) || 0,
      cooldown: r.cooldown || '', cooldownSec: Number(r.cooldownSec) || 0,
      pagesRequired: Number(x('pagesRequired')) || 0,
      icon, faIcon: icon,
      available: r.available !== undefined ? !!r.available : (r.status || 'active') === 'active',
      needsProof: !!r.needsProof, needsWatch: !!r.needsWatch,
      // only an https link or a plain in-app path ever leaves this function
      target: (/^https:\/\//i.test(tgt) || /^[A-Za-z0-9._~!$&'()*+,;=@/?#%:-]+$/.test(tgt)) ? tgt : '',
      minWatchSec: Number(x('minWatchSec')) || 0,
      blogCategory: x('blogCategory'), blogUrl: x('blogUrl'),
      channelId: x('channelId'), channelUrl: x('channelUrl'),
      videoId: x('videoId'), adUrl: x('adUrl'),
    };
  }
  function arr(v){ return Array.isArray(v) ? v : []; }
  /* The whole catalog comes from the backend the finance console writes to.
     Any failure (offline, 401, empty) falls back to the demo getters. */
  async function liveCatalog() {
    try {
      const res = await fetch(`${API_BASE}/store`, { credentials: 'include' });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || (!arr(d.packs).length && !arr(d.subscriptions).length)) return null;
      if (d.balance && d.balance.coins != null) setServerBalance(d.balance);
      return {
        balance: getBalance(),
        packs: arr(d.packs),
        bundles: arr(d.bundles),
        gifts: arr(d.gifts),
        adRewards: arr(d.adRewards).map(normalizeReward),
        subscriptions: deriveSubExtras(arr(d.subscriptions)),
        mergeSub: deriveSubExtras(d.mergeSub && d.mergeSub.id ? [d.mergeSub] : [])[0] || {},
      };
    } catch (e) { return null; }
  }

  /* One shared, cached catalog. Pages that never render the store (the tip
     picker on a reader page) still get the live gifts + the real balance,
     because warm() runs as soon as this file loads. */
  let _live = null, _warmP = null;
  function warm() {
    if (!_warmP) {
      _warmP = liveCatalog().then(function (d) {
        _live = d;
        if (d) syncBalance();
        return d;
      });
    }
    return _warmP;
  }

  const BALANCE_KEY = 'dro_store_balance';
  function _readBal(){ try{ const v=parseInt(localStorage.getItem(BALANCE_KEY),10); return isNaN(v)?350:v; }catch(e){ return 350; } }
  function _writeBal(v){ try{ localStorage.setItem(BALANCE_KEY, String(v)); }catch(e){} }
  /* Once the wallet API has answered, its numbers are the only balance anyone
     reads — local spends stop pretending to be the ledger. The API reports the
     balance as {coins, bonus, paid}: `coins` is the spendable total and `bonus`
     the part of it with no cash behind it, which reads chapters but cannot tip.
     A bare number is still accepted (a write that only answers the total), and
     the known bonus tag is kept, clamped to the new total. */
  let _serverBal = null;
  function setServerBalance(bal){
    const src = (bal && typeof bal === 'object') ? bal : { coins: bal };
    const c = Number(src.coins);
    if (!isFinite(c)) return null;
    const coins = Math.max(0, Math.round(c));
    const b = Number(src.bonus);
    const bonus = Math.max(0, Math.min(coins, isFinite(b) ? Math.round(b) : ((_serverBal && _serverBal.bonus) || 0)));
    _serverBal = { coins, bonus, paid: coins - bonus };
    _writeBal(coins);
    return _serverBal;
  }
  function getBalance() {
    if (_serverBal) return { coins: _serverBal.coins, bonus: _serverBal.bonus, paid: _serverBal.paid };
    return { coins: _readBal(), bonus: 0, paid: _readBal() };
  }
  function syncBalance(){
    return fetch(`${API_BASE}/wallet/balance`, { credentials: 'include' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (j) { if (j && j.coins != null) setServerBalance(j); return getBalance(); })
      .catch(function () { return getBalance(); });
  }

  /* Duration + "Save X% vs daily" are pure math over the catalog — never typed.
     Staff only enter price, period and real features; this runs wherever subs
     are read (store page, finance preview, and the backend the same way live). */
  const PERIOD_DAYS = { day:1, week:7, month:30, year:365 };
  function deriveSubExtras(list){
    const usd = s => Number(s.priceUSD) || parseFloat(String(s.price||'').replace(/[$,\s]/g,'')) || 0;
    const daily = list.find(s => s.period === 'day');
    const dailyPrice = daily ? usd(daily) : 0;
    return list.map(s=>{
      const out = Object.assign({}, s, { features:(s.features||[]).slice() });
      const days = PERIOD_DAYS[s.period];
      if(days && !out.features.some(f=>/unlimited reading/i.test(f)))
        out.features.unshift(days===1 ? 'Unlimited reading for 24 hours' : 'Unlimited reading for ' + days + ' days');
      if(dailyPrice > 0 && s.period !== 'day' && days){
        const pct = Math.round((1 - (usd(s)/days)/dailyPrice) * 100);
        if(pct > 0 && !out.features.some(f=>/save \d+% vs daily/i.test(f)))
          out.features.push('Save ' + pct + '% vs daily');
      }
      return out;
    });
  }

  function getSubscriptions() {
    // Finance → Coin Transactions "Subscriptions" section owns the live catalog.
    try{ const fs=JSON.parse(localStorage.getItem('dro_finance_subs')||'null'); if(Array.isArray(fs)&&fs.length) return deriveSubExtras(fs); }catch(e){}
    return deriveSubExtras([
      { id: 'sub-daily', name: 'Daily', price: '$0.99', priceUSD: 0.99, prices: { NGN: '₦600', USD: '$0.99', GBP: '£1.13' }, period: 'day', features: ['Access all stories'], badge: '', color: '#635F6E', icon: 'fa-clock' },
      { id: 'sub-weekly', name: 'Weekly', price: '$4.99', priceUSD: 4.99, prices: { NGN: '₦3,000', USD: '$4.99', GBP: '£5.69' }, period: 'week', features: ['Access all stories'], badge: 'Popular', color: '#FF2D6A', icon: 'fa-calendar-week' },
      { id: 'sub-monthly', name: 'Monthly', price: '$14.99', priceUSD: 14.99, prices: { NGN: '₦9,000', USD: '$14.99', GBP: '£17.09' }, period: 'month', features: ['Access all stories'], badge: 'Best Value', color: '#D6165A', icon: 'fa-calendar' },
      { id: 'sub-yearly', name: 'Yearly', price: '$99.99', priceUSD: 99.99, prices: { NGN: '₦60,000', USD: '$99.99', GBP: '£113.99' }, period: 'year', features: ['Access all stories'], badge: 'Best Deal', color: '#16A34A', icon: 'fa-crown' },
    ]);
  }

  function getMergeSubscription() {
    return {
      id: 'sub-merge',
      name: 'Merge Pass',
      price: '$19.99',
      priceUSD: 19.99,
      prices: { NGN: '₦12,000', USD: '$19.99', GBP: '£22.79' },
      period: 'month',
      features: ['Ad-free browsing', 'Ad-free reading', 'Unlimited reading', 'Priority support', 'Early access to new stories'],
      badge: 'Premium',
      color: '#7c3aed',
      icon: 'fa-bolt',
    };
  }

  function getGifts() {
    // Live catalog (finance → Coin Transactions "Gift Items") first: this is
    // what the tip picker on any reader page shows.
    if (_live && _live.gifts.length) return _live.gifts;
    try{ const fg=JSON.parse(localStorage.getItem('dro_finance_gifts')||'null'); if(Array.isArray(fg)&&fg.length) return fg; }catch(e){}
    return [
      { id: 'gift-rose', name: 'Rose', price: 10, icon: 'fa-rose', faIcon: 'fa-heart', color: '#FF2D6A', desc: 'A sweet thank you' },
      { id: 'gift-heart', name: 'Big Heart', price: 50, icon: 'fa-heart', faIcon: 'fa-heart', color: '#E11D48', desc: 'Show some love' },
      { id: 'gift-diamond', name: 'Diamond', price: 100, icon: 'fa-gem', faIcon: 'fa-gem', color: '#0EA5E9', desc: 'Precious support' },
      { id: 'gift-crown', name: 'Crown', price: 250, icon: 'fa-crown', faIcon: 'fa-crown', color: '#F59E0B', desc: 'For the best author' },
      { id: 'gift-rocket', name: 'Rocket', price: 500, icon: 'fa-rocket', faIcon: 'fa-rocket', color: '#7C3AED', desc: 'Boost the story' },
      { id: 'gift-dragon', name: 'Dragon', price: 1000, icon: 'fa-dragon', faIcon: 'fa-dragon', color: '#16A34A', desc: 'Legendary gift' },
      { id: 'gift-trophy', name: 'Trophy', price: 750, icon: 'fa-trophy', faIcon: 'fa-trophy', color: '#FF8C00', desc: 'Champion vibes' },
      { id: 'gift-fireworks', name: 'Fireworks', price: 300, icon: 'fa-wand-sparkles', faIcon: 'fa-wand-sparkles', color: '#EC4899', desc: 'Celebrate the chapter' },
    ];
  }

  async function fetchStoreData() {
    const live = await warm();
    if (live) return live;
    await new Promise(r => setTimeout(r, 80));
    return {
      balance: getBalance(),
      packs: getCoinPacks(),
      bundles: getBundles(),
      adRewards: getAdRewards(),
      subscriptions: getSubscriptions(),
      mergeSub: getMergeSubscription(),
      gifts: getGifts(),
    };
  }
  warm();

  /* With a server balance these are affordability checks only — the wallet API
     moves coins (POST /api/wallet/tip, /unlock, /earn), then syncBalance() pulls
     the new number. Locally decrementing here would just be a guess. */
  function spendCoins(amount){
    if (_serverBal) return getBalance().coins >= amount;
    const cur=_readBal();
    if(cur < amount) return false;
    _writeBal(cur-amount);
    return true;
  }
  function addCoins(amount){
    if (_serverBal) return getBalance().coins;
    const cur=_readBal();
    _writeBal(cur+amount);
    return _readBal();
  }
  function canAfford(amount){ return getBalance().coins >= amount; }

  window.StoreService = { fetchStoreData, getBalance, syncBalance, setServerBalance, getGifts, getBundles, getCoinPacks, getAdRewards, getSubscriptions, spendCoins, addCoins, canAfford };
})();
