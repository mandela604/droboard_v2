/* ═══════════════════════════════════════════════════════════════
   STORE SERVICE — window.StoreService
   One shared, cached read of the live catalog:
     GET /api/store → { balance?, packs, bundles, gifts, adRewards,
                        subscriptions, mergeSub }
   (mounted in store.routes.js; balance attached only for a signed-in
   reader as { coins, bonus, paid } — bonus/earned coins read chapters
   but can never tip). The wallet API moves coins (POST /api/wallet/*);
   this service only reads and checks affordability. There is no fallback
   catalog: any failure throws and the calling page shows the error.
   HTML calls StorePage.init(); the tip picker on reader pages reads
   getGifts()/getBalance() after warm() has run.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  function arr(v){ return Array.isArray(v) ? v : []; }

  /* Live rewards normalized to the card shape. GET /api/store hands back
     the validated, fully shaped task (label, target, needsProof,
     minWatchSec); this only fills gaps for rows that came from elsewhere,
     and never invents a destination. */
  function normalizeReward(r) {
    const m = (r && r.meta && typeof r === 'object' && typeof r.meta === 'object') ? r.meta : {};
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

  async function liveCatalog() {
    const res = await fetch(`${API_BASE}/store`, { credentials: 'include' });
    if (!res.ok) throw new Error('Store API failed: ' + res.status);
    const d = await res.json();
    if (!d || typeof d !== 'object' || (!arr(d.packs).length && !arr(d.subscriptions).length)) {
      throw new Error('Store catalog is empty');
    }
    if (d.balance && d.balance.coins != null) setServerBalance(d.balance);
    return {
      balance: getBalance(),
      packs: arr(d.packs),
      bundles: arr(d.bundles),
      gifts: arr(d.gifts),
      adRewards: arr(d.adRewards).map(normalizeReward),
      subscriptions: deriveSubExtras(arr(d.subscriptions)),
      mergeSub: deriveSubExtras(d.mergeSub && d.mergeSub.id ? [d.mergeSub] : [])[0] || null,
    };
  }

  /* One shared, cached catalog. Pages that never render the store (the tip
     picker on a reader page) still get the live gifts + the real balance,
     because warm() runs as soon as this file loads. A failed warm is not
     cached, so the next call retries. */
  let _live = null, _warmP = null;
  function warm() {
    if (!_warmP) {
      _warmP = liveCatalog().then(function (d) {
        _live = d;
        return d;
      }).catch(function (e) {
        _warmP = null;
        throw e;
      });
    }
    return _warmP;
  }

  /* Once the wallet API has answered, its numbers are the only balance anyone
     reads. The API reports the balance as {coins, bonus, paid}: `coins` is
     the spendable total and `bonus` the part of it with no cash behind it,
     which reads chapters but cannot tip. A bare number is still accepted (a
     write that only answers the total), and the known bonus tag is kept,
     clamped to the new total. */
  let _serverBal = null;
  function setServerBalance(bal){
    const src = (bal && typeof bal === 'object') ? bal : { coins: bal };
    const c = Number(src.coins);
    if (!isFinite(c)) return null;
    const coins = Math.max(0, Math.round(c));
    const b = Number(src.bonus);
    const bonus = Math.max(0, Math.min(coins, isFinite(b) ? Math.round(b) : ((_serverBal && _serverBal.bonus) || 0)));
    _serverBal = { coins, bonus, paid: coins - bonus };
    return _serverBal;
  }
  function getBalance() {
    if (_serverBal) return { coins: _serverBal.coins, bonus: _serverBal.bonus, paid: _serverBal.paid };
    return { coins: 0, bonus: 0, paid: 0 };
  }
  function syncBalance(){
    return fetch(`${API_BASE}/wallet/balance`, { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('Wallet balance API failed: ' + res.status);
        return res.json();
      })
      .then(function (j) { if (j && j.coins != null) setServerBalance(j); return getBalance(); })
      .catch(function (e) { return getBalance(); });
  }

  /* Duration + "Save X% vs daily" are pure math over the catalog — never
     typed. Staff only enter price, period and real features. */
  const PERIOD_DAYS = { day:1, week:7, month:30, year:365 };
  function deriveSubExtras(list){
    const usd = s => Number(s.priceUSD) || parseFloat(String(s.price||'').replace(/[$,\s]/g,'')) || 0;
    const daily = list.find(s => s.period === 'day');
    const dailyPrice = daily ? usd(daily) : 0;
    return list.map(s=>{
      const out = Object.assign({}, s, { features:(s.features||[]).slice() });
      const days = PERIOD_DAYS[s.period] || Number(s.durationDays) || 0;
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

  function getGifts() {
    return (_live && arr(_live.gifts)) || [];
  }

  async function fetchStoreData() {
    return warm();
  }

  /* Affordability check only — the wallet API moves coins (POST
     /api/wallet/tip, /unlock, /earn), then syncBalance() pulls the new
     number. Before the first balance read we do not guess: the server is
     the authority and refuses an unaffordable spend itself. */
  function spendCoins(amount){
    if (!_serverBal) return true;
    return _serverBal.coins >= amount;
  }
  function canAfford(amount){ return spendCoins(amount); }

  warm();

  window.StoreService = { fetchStoreData, getBalance, syncBalance, setServerBalance, getGifts, spendCoins, canAfford };
})();
