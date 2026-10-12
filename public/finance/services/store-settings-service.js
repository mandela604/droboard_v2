/**
 * store-settings-service.js — Store Settings page controller.
 * Call-and-render over window.FinanceData (coin packs / ad rewards / bundles),
 * which tries /api/finance first and falls back to demo data.
 */
(function () {
  'use strict';
  if (window.StoreSettingsService) return;

  function toast(m) {
    let t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const naira = (n) => (n === undefined || n === null || n === '') ? '—' : (window.DroboardCurrency && DroboardCurrency.ngnToMoney ? DroboardCurrency.ngnToMoney(n) : '₦' + Number(n).toLocaleString('en-US'));

  const state = { packs: [], rewards: [], bundles: [] };

  function statusChip(s) {
    const on = (s || 'active') === 'active';
    return `<span class="st-chip ${on ? 'on' : 'off'}">${on ? 'Active' : 'Inactive'}</span>`;
  }

  /* ── Coin packs ── */
  function packRow(p) {
    const id = esc(p.id || p.code);
    return `<tr data-id="${id}">
      <td><b>${esc(p.code || p.id)}</b></td>
      <td>${esc(p.coins)}</td>
      <td>${esc(p.bonusPct != null ? p.bonusPct + '%' : '—')}</td>
      <td>${naira(p.basePriceNGN != null ? p.basePriceNGN : (p.price || ''))}</td>
      <td>${statusChip(p.status)}</td>
      <td class="row-actions">
        <button class="mini-btn" data-pack-edit="${id}">Edit</button>
        <button class="mini-btn" data-pack-toggle="${id}">${(p.status || 'active') === 'active' ? 'Disable' : 'Enable'}</button>
        <button class="mini-btn danger" data-pack-del="${id}">Delete</button>
      </td>
    </tr>`;
  }
  function renderPacks() {
    const el = document.getElementById('packsBody');
    el.innerHTML = state.packs.length ? state.packs.map(packRow).join('')
      : `<tr><td colspan="6" class="empty-msg">No coin packs yet.</td></tr>`;
  }
  async function reloadPacks() {
    try { state.packs = await FinanceData.getCoinPacks() || []; }
    catch (e) { state.packs = []; }
    renderPacks();
  }

  /* ── Ad rewards ── */
  const REWARD_TYPES = ['watch_ad', 'checkin', 'rate', 'share', 'blog_read', 'youtube_sub', 'youtube_watch'];
  function rewardRow(r) {
    const id = esc(r.id || r.code);
    return `<tr data-id="${id}">
      <td><b>${esc(r.action || r.code)}</b><div class="sub">${esc(r.code || '')} · ${esc(r.type || '')}</div></td>
      <td>${esc(r.coins)}</td>
      <td>${esc(r.cooldown || '—')}</td>
      <td>${statusChip(r.status)}</td>
      <td class="row-actions">
        <button class="mini-btn" data-reward-edit="${id}">Edit</button>
        <button class="mini-btn" data-reward-toggle="${id}">${(r.status || 'active') === 'active' ? 'Disable' : 'Enable'}</button>
        <button class="mini-btn danger" data-reward-del="${id}">Delete</button>
      </td>
    </tr>`;
  }
  function renderRewards() {
    const el = document.getElementById('rewardsBody');
    el.innerHTML = state.rewards.length ? state.rewards.map(rewardRow).join('')
      : `<tr><td colspan="5" class="empty-msg">No ad rewards yet.</td></tr>`;
  }
  async function reloadRewards() {
    try { state.rewards = await FinanceData.getAdRewards() || []; }
    catch (e) { state.rewards = []; }
    renderRewards();
  }

  /* ── Bundles ── */
  function bundleRow(b) {
    const id = esc(b.id || b.code);
    return `<tr data-id="${id}">
      <td><b>${esc(b.name || b.code)}</b><div class="sub">${esc(b.code || '')}</div></td>
      <td>${esc(b.coins)} <span class="sub">+${esc(b.bonus || 0)} bonus</span></td>
      <td>${naira(b.basePriceNGN != null ? b.basePriceNGN : (b.price || ''))}</td>
      <td>${statusChip(b.status)}</td>
      <td class="row-actions">
        <button class="mini-btn" data-bundle-edit="${id}">Edit</button>
        <button class="mini-btn" data-bundle-toggle="${id}">${(b.status || 'active') === 'active' ? 'Disable' : 'Enable'}</button>
        <button class="mini-btn danger" data-bundle-del="${id}">Delete</button>
      </td>
    </tr>`;
  }
  function renderBundles() {
    const el = document.getElementById('bundlesBody');
    el.innerHTML = state.bundles.length ? state.bundles.map(bundleRow).join('')
      : `<tr><td colspan="5" class="empty-msg">No bundles yet.</td></tr>`;
  }
  async function reloadBundles() {
    try { state.bundles = await FinanceData.getBundles() || []; }
    catch (e) { state.bundles = []; }
    renderBundles();
  }

  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

  async function init() {
    if (window.FinanceSidebar && FinanceSidebar.attach) {
      FinanceSidebar.attach('#storeRoot', {
        activeItem: 'store-settings', title: 'Store Settings', subtitle: 'Coin packs, ad rewards and bundles',
      });
    }
    await Promise.all([reloadPacks(), reloadRewards(), reloadBundles()]);
    wireForms();
    wireTables();
  }

  function wireForms() {
    document.getElementById('packForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        id: val('packId') || undefined,
        code: val('packCode'), coins: parseInt(val('packCoins'), 10) || 0,
        bonusPct: parseFloat(val('packBonus')) || 0, basePriceNGN: parseFloat(val('packPrice')) || 0,
        status: val('packStatus') || 'active',
      };
      if (!body.code) { toast('Pack code is required'); return; }
      try {
        await FinanceData.saveCoinPack(body);
        e.target.reset(); document.getElementById('packId').value = '';
        await reloadPacks(); toast('✅ Coin pack saved');
      } catch (err) { toast('Could not save pack'); }
    });
    document.getElementById('rewardForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        id: val('rewardId') || undefined,
        code: val('rewardCode'), action: val('rewardAction'), type: val('rewardType') || 'watch_ad',
        coins: parseInt(val('rewardCoins'), 10) || 0, cooldown: val('rewardCooldown'),
        status: val('rewardStatus') || 'active',
      };
      if (!body.code || !body.action) { toast('Code and action are required'); return; }
      try {
        await FinanceData.saveAdReward(body);
        e.target.reset(); document.getElementById('rewardId').value = '';
        await reloadRewards(); toast('✅ Ad reward saved');
      } catch (err) { toast('Could not save reward'); }
    });
    document.getElementById('bundleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        id: val('bundleId') || undefined,
        code: val('bundleCode'), name: val('bundleName'), coins: parseInt(val('bundleCoins'), 10) || 0,
        bonus: parseInt(val('bundleBonus'), 10) || 0, basePriceNGN: parseFloat(val('bundlePrice')) || 0,
        status: val('bundleStatus') || 'active',
      };
      if (!body.code || !body.name) { toast('Code and name are required'); return; }
      try {
        await FinanceData.saveBundle(body);
        e.target.reset(); document.getElementById('bundleId').value = '';
        await reloadBundles(); toast('✅ Bundle saved');
      } catch (err) { toast('Could not save bundle'); }
    });
  }

  function fillForm(prefix, obj, pairs) {
    document.getElementById(prefix + 'Id').value = obj.id || obj.code || '';
    pairs.forEach(([key, suffix]) => {
      const el = document.getElementById(prefix + suffix);
      if (el) el.value = obj[key] != null ? obj[key] : '';
    });
    document.getElementById(prefix + 'Form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function wireTables() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const find = (list, attr) => {
        const id = t.dataset[attr];
        if (id === undefined) return null;
        return list.find(x => String(x.id || x.code) === String(id));
      };
      let item;
      if ((item = find(state.packs, 'packEdit'))) { fillForm('pack', item, [['code', 'Code'], ['coins', 'Coins'], ['bonusPct', 'Bonus'], ['basePriceNGN', 'Price'], ['status', 'Status']]); return; }
      if ((item = find(state.packs, 'packToggle'))) {
        try { await FinanceData.saveCoinPack(Object.assign({}, item, { status: (item.status || 'active') === 'active' ? 'inactive' : 'active' })); await reloadPacks(); }
        catch (err) { toast('Could not update pack'); }
        return;
      }
      if (find(state.packs, 'packDel')) {
        const p = find(state.packs, 'packDel');
        if (!confirm(`Delete pack "${p.code || p.id}"?`)) return;
        try { await FinanceData.deleteCoinPack(p.id || p.code); await reloadPacks(); toast('🗑️ Pack deleted'); }
        catch (err) { toast('Could not delete pack'); }
        return;
      }
      if ((item = find(state.rewards, 'rewardEdit'))) { fillForm('reward', item, [['code', 'Code'], ['action', 'Action'], ['type', 'Type'], ['coins', 'Coins'], ['cooldown', 'Cooldown'], ['status', 'Status']]); return; }
      if ((item = find(state.rewards, 'rewardToggle'))) {
        try { await FinanceData.saveAdReward(Object.assign({}, item, { status: (item.status || 'active') === 'active' ? 'inactive' : 'active' })); await reloadRewards(); }
        catch (err) { toast('Could not update reward'); }
        return;
      }
      if (find(state.rewards, 'rewardDel')) {
        const r = find(state.rewards, 'rewardDel');
        if (!confirm(`Delete reward "${r.action || r.code}"?`)) return;
        try { await FinanceData.deleteAdReward(r.id || r.code); await reloadRewards(); toast('🗑️ Reward deleted'); }
        catch (err) { toast('Could not delete reward'); }
        return;
      }
      if ((item = find(state.bundles, 'bundleEdit'))) { fillForm('bundle', item, [['code', 'Code'], ['name', 'Name'], ['coins', 'Coins'], ['bonus', 'Bonus'], ['basePriceNGN', 'Price'], ['status', 'Status']]); return; }
      if ((item = find(state.bundles, 'bundleToggle'))) {
        try { await FinanceData.saveBundle(Object.assign({}, item, { status: (item.status || 'active') === 'active' ? 'inactive' : 'active' })); await reloadBundles(); }
        catch (err) { toast('Could not update bundle'); }
        return;
      }
      if (find(state.bundles, 'bundleDel')) {
        const b = find(state.bundles, 'bundleDel');
        if (!confirm(`Delete bundle "${b.name || b.code}"?`)) return;
        try { await FinanceData.deleteBundle(b.id || b.code); await reloadBundles(); toast('🗑️ Bundle deleted'); }
        catch (err) { toast('Could not delete bundle'); }
        return;
      }
    });
    ['packForm', 'rewardForm', 'bundleForm'].forEach(fid => {
      const form = document.getElementById(fid);
      form.addEventListener('reset', () => {
        const hid = form.querySelector('input[type="hidden"]');
        if (hid) hid.value = '';
      });
    });
  }

  window.StoreSettingsService = { init };
})();
