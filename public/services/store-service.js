/* ═══════════════════════════════════════════════════════════════
   STORE SERVICE
   Coin packs, bundles, and ad rewards. HTML calls StorePage.init().
   When going live: set USE_API = true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  function _financePacks(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_packs')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getCoinPacks() {
    const fp=_financePacks(); if(fp) return fp;
    return [
      { id: 'pack1', coins: 100, price: '$0.99', badge: '', color: '#635F6E' },
      { id: 'pack2', coins: 500, price: '$3.99', badge: 'Popular', color: '#FF2D6A' },
      { id: 'pack3', coins: 1200, price: '$7.99', badge: 'Best Value', color: '#D6165A' },
      { id: 'pack4', coins: 2500, price: '$14.99', badge: '', color: '#16A34A' },
    ];
  }

  function _financeBundles(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_bundles')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getBundles() {
    const fb=_financeBundles(); if(fb) return fb;
    return [
      { id: 'b1', name: 'Starter Bundle', coins: 500, bonus: 50, price: '$3.99', icon: 'fa-seedling', color: '#22c55e' },
      { id: 'b2', name: 'Pro Bundle', coins: 1500, bonus: 300, price: '$9.99', icon: 'fa-fire', color: '#FF2D6A' },
      { id: 'b3', name: 'Elite Bundle', coins: 5000, bonus: 1500, price: '$29.99', icon: 'fa-crown', color: '#D6165A' },
    ];
  }

  function _financeRewards(){ try{ const v=JSON.parse(localStorage.getItem('dro_finance_rewards')||'null'); return Array.isArray(v)&&v.length?v:null; }catch(e){ return null; } }
  function getAdRewards() {
    const fr=_financeRewards(); if(fr) return fr;
    return [
      { id: 'ad1', action: 'Watch Ad', coins: 10, cooldown: '5 min', icon: 'fa-film', available: true, type:'watch_ad' },
      { id: 'ad2', action: 'Daily Check-in', coins: 25, cooldown: '24 hr', icon: 'fa-calendar-check', available: true, type:'checkin' },
      { id: 'ad3', action: 'Rate Story', coins: 5, cooldown: '1 hr', icon: 'fa-star', available: true, type:'rate' },
      { id: 'ad4', action: 'Share Story', coins: 15, cooldown: '2 hr', icon: 'fa-share-nodes', available: true, type:'share' },
      { id: 'ad5', action: 'Read Blog — Tech (3 pages)', coins: 25, cooldown: '24 hr', icon: 'fa-microchip', available: true, type:'blog_read', pagesRequired:3, blogCategory:'tech', blogUrl:'Pages/blog.html?cat=tech' },
      { id: 'ad8', action: 'Read Blog — Health (3 pages)', coins: 25, cooldown: '24 hr', icon: 'fa-heart-pulse', available: true, type:'blog_read', pagesRequired:3, blogCategory:'health', blogUrl:'Pages/blog.html?cat=health' },
      { id: 'ad6', action: 'Subscribe on YouTube', coins: 30, cooldown: '30d', icon: 'fa-youtube', available: true, type:'youtube_sub', channelId:'UCxxxxDroboard' },
      { id: 'ad7', action: 'Watch YouTube Video', coins: 15, cooldown: '24 hr', icon: 'fa-circle-play', available: true, type:'youtube_watch', videoId:'dQw4w9WgXcQ', minWatchSec:60 },
    ];
  }

  const BALANCE_KEY = 'dro_store_balance';
  function _readBal(){ try{ const v=parseInt(localStorage.getItem(BALANCE_KEY),10); return isNaN(v)?350:v; }catch(e){ return 350; } }
  function _writeBal(v){ try{ localStorage.setItem(BALANCE_KEY, String(v)); }catch(e){} }
  function _levelFor(coins){ if(coins>=1000) return 'Gold'; if(coins>=500) return 'Silver'; if(coins>=100) return 'Bronze'; return 'Starter'; }
  function getBalance() {
    const coins = _readBal();
    return { coins, level: _levelFor(coins) };
  }

  function getSubscriptions() {
    return [
      { id: 'sub-daily', name: 'Daily', price: '$0.99', period: 'day', features: ['Unlimited reading for 24 hours', 'Access all stories'], badge: '', color: '#635F6E', icon: 'fa-clock' },
      { id: 'sub-weekly', name: 'Weekly', price: '$4.99', period: 'week', features: ['Unlimited reading for 7 days', 'Access all stories', 'Save 30% vs daily'], badge: 'Popular', color: '#FF2D6A', icon: 'fa-calendar-week' },
      { id: 'sub-monthly', name: 'Monthly', price: '$14.99', period: 'month', features: ['Unlimited reading for 30 days', 'Access all stories', 'Save 50% vs daily'], badge: 'Best Value', color: '#D6165A', icon: 'fa-calendar' },
      { id: 'sub-yearly', name: 'Yearly', price: '$99.99', period: 'year', features: ['Unlimited reading for 365 days', 'Access all stories', 'Save 72% vs daily'], badge: 'Best Deal', color: '#16A34A', icon: 'fa-crown' },
    ];
  }

  function getMergeSubscription() {
    return {
      id: 'sub-merge',
      name: 'Merge Pass',
      price: '$19.99',
      period: 'month',
      features: ['Ad-free browsing', 'Ad-free reading', 'Unlimited reading', 'Priority support', 'Early access to new stories'],
      badge: 'Premium',
      color: '#7c3aed',
      icon: 'fa-bolt',
    };
  }

  function getGifts() {
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
    if (USE_API) {
      const res = await fetch(`${API_BASE}/store`);
      if (!res.ok) throw new Error('Store API failed');
      return res.json();
    }
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

  function spendCoins(amount){
    const cur=_readBal();
    if(cur < amount) return false;
    _writeBal(cur-amount);
    return true;
  }
  function addCoins(amount){
    const cur=_readBal();
    _writeBal(cur+amount);
    return _readBal();
  }
  function canAfford(amount){ return _readBal() >= amount; }

  window.StoreService = { fetchStoreData, getBalance, getGifts, getBundles, getCoinPacks, getAdRewards, spendCoins, addCoins, canAfford };
})();
