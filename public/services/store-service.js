/* ═══════════════════════════════════════════════════════════════
   STORE SERVICE
   Coin packs, bundles, and ad rewards. HTML calls StorePage.init().
   When going live: set USE_API = true, update API_BASE.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  function getCoinPacks() {
    return [
      { id: 'pack1', coins: 100, price: '$0.99', badge: '', color: '#635F6E' },
      { id: 'pack2', coins: 500, price: '$3.99', badge: 'Popular', color: '#FF2D6A' },
      { id: 'pack3', coins: 1200, price: '$7.99', badge: 'Best Value', color: '#D6165A' },
      { id: 'pack4', coins: 2500, price: '$14.99', badge: '', color: '#16A34A' },
    ];
  }

  function getBundles() {
    return [
      { id: 'b1', name: 'Starter Bundle', coins: 500, bonus: 50, price: '$3.99', icon: 'fa-seedling', color: '#22c55e' },
      { id: 'b2', name: 'Pro Bundle', coins: 1500, bonus: 300, price: '$9.99', icon: 'fa-fire', color: '#FF2D6A' },
      { id: 'b3', name: 'Elite Bundle', coins: 5000, bonus: 1500, price: '$29.99', icon: 'fa-crown', color: '#D6165A' },
    ];
  }

  function getAdRewards() {
    return [
      { id: 'ad1', action: 'Watch Ad', coins: 10, cooldown: '5 min', icon: 'fa-film', available: true },
      { id: 'ad2', action: 'Daily Check-in', coins: 25, cooldown: '24 hr', icon: 'fa-calendar-check', available: true },
      { id: 'ad3', action: 'Rate Story', coins: 5, cooldown: '1 hr', icon: 'fa-star', available: true },
      { id: 'ad4', action: 'Share Story', coins: 15, cooldown: '2 hr', icon: 'fa-share-nodes', available: true },
    ];
  }

  function getBalance() {
    return { coins: 350, level: 'Silver' };
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
    };
  }

  window.StoreService = { fetchStoreData };
})();
