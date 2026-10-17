/* ═══════════════════════════════════════════════════════════════
   AD MANAGER CONTROLLER
   Admin UI for the ad inventory served by services/ad-service.js.
   Demo: persists to localStorage 'dro_ads_override' (client pages read
   it live). Live: marketing-data.js CRUD hits /api/marketing/ads.
   HTML calls AdManagerPage.init().
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FORMATS = [
    { id: 'platform', label: 'Platform', icon: 'fa-megaphone' },
    { id: 'book', label: 'Book promo', icon: 'fa-book-open' },
    { id: 'native', label: 'Native', icon: 'fa-newspaper' },
    { id: 'embed', label: 'Network embed', icon: 'fa-code' },
    { id: 'follow', label: 'Follow', icon: 'fa-user-plus' },
    { id: 'banner', label: 'Banner', icon: 'fa-flag' },
    { id: 'promo', label: 'Promo slide', icon: 'fa-images' },
  ];

  let INV = { pools: {}, placements: {} };
  let STATS = [];
  let CAMPS = [];
  let campaignFilter = '';
  let filterFormat = 'all';
  let filterStatus = 'all';
  let sortKey = 'default';
  let searchText = '';
  let listPage = 1;
  const PAGE_SIZE = 10;
  let _slotProg = {};      // slotId -> {formats:[], adIds:[]} — pending programming edits
  let _curSlotId = null;   // slot selected in the programming card

  /* live | off | scheduled | ended */
  function adStatus(ad) {
    if (!ad || ad.active === false) return 'off';
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (ad.startDate) { const s = new Date(ad.startDate); s.setHours(0, 0, 0, 0); if (!isNaN(s) && s > now) return 'scheduled'; }
    if (ad.endDate) { const e = new Date(ad.endDate); e.setHours(0, 0, 0, 0); if (!isNaN(e) && e < now) return 'ended'; }
    return 'live';
  }
  function scheduleText(ad) {
    if (!ad.startDate && !ad.endDate) return '';
    return ` · ${ad.startDate || '…'} → ${ad.endDate || '…'}`;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function readOverrides() {
    try { return JSON.parse(localStorage.getItem('dro_ads_override') || '{}') || {}; }
    catch (e) { return {}; }
  }
  function toast(msg) {
    const t = document.getElementById('admToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function fmtN(n) { return Number(n || 0).toLocaleString('en-US'); }
  function adTitle(ad) { return ad.title || ad.heading || ad.headline || ad.brand || ad.name || ad.id; }
  function campName(id) {
    if (!id) return '';
    const c = CAMPS.find(x => String(x.id) === String(id));
    return c ? (c.name || c.id) : String(id);
  }
  function adCover(ad) { return ad.img || ad.cover || ad.image || ad.avatar || ''; }
  function allAds() {
    const out = [];
    Object.keys(INV.pools || {}).forEach(f => {
      ((INV.pools || {})[f] || []).forEach(ad => out.push({ format: f, ad }));
    });
    return out;
  }

  /* ── Stats ── */
  function renderStats() {
    const ads = allAds();
    const live = ads.filter(x => x.ad.active !== false).length;
    let imp = 0, clk = 0;
    STATS.forEach(s => { imp += (+s.impressions || 0); clk += (+s.clicks || 0); });
    const ctr = imp ? ((clk / imp) * 100).toFixed(1) + '%' : '—';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stLive', live + ' / ' + ads.length);
    set('stImp', fmtN(imp));
    set('stClk', fmtN(clk));
    set('stCtr', ctr);
  }

  /* ── Placements ── */
  /* Pages with hand-built cards above (extra fields: interval, cycle,
     words…). Every other page in the registry gets a generic on/off card
     rendered from AdSetupData.PAGES — add a page to the registry and it
     appears here with no further wiring. */
  const BESPOKE_PAGES = ['discover', 'feed', 'genreHub', 'home', 'fullReader', 'scrollReader', 'library', 'droboardPage', 'comments'];
  const GEN_ICONS = {
    series: ['fa-book', 'var(--blue)'], debate: ['fa-scale-balanced', 'var(--accent)'],
    discussion: ['fa-comments', 'var(--purple)'], collection: ['fa-layer-group', 'var(--green)'],
    followers: ['fa-user-group', 'var(--amber)'], profile: ['fa-user', 'var(--accent)'],
  };
  function renderGenericSurfaces() {
    const grid = document.querySelector('#plBody .pl-grid');
    const anchor = document.getElementById('plProgCard');
    if (!grid || !anchor) return;
    grid.querySelectorAll('.pl-gen-card').forEach(n => n.remove());
    const pages = (window.AdSetupData && AdSetupData.PAGES) ? AdSetupData.PAGES : [];
    const p = INV.placements || {};
    let html = '';
    pages.forEach(pg => {
      if (BESPOKE_PAGES.indexOf(pg.id) !== -1) return;
      const [ico, col] = GEN_ICONS[pg.id] || ['fa-ad', 'var(--gray-400)'];
      const on = (p[pg.id] || {}).enabled !== false;
      html += `<div class="pl-card pl-gen-card" data-page="${esc(pg.id)}">` +
        `<div class="pl-name"><i class="fas ${ico}" style="color:${col}"></i> ${esc(pg.label)}</div>` +
        `<label class="pl-check"><input type="checkbox" id="plGen_${esc(pg.id)}"${on ? ' checked' : ''}/> Ads on this page</label>` +
        `</div>`;
    });
    if (html) anchor.insertAdjacentHTML('beforebegin', html);
  }
  function renderPlacements() {
    const p = INV.placements || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const on = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v !== false; };
    const slotOn = (v) => v !== false && !(v && typeof v === 'object' && v.enabled === false);
    set('plDisInt', (p.discover || {}).interval || 6);
    set('plDisCycle', ((p.discover || {}).cycle || []).join(', '));
    on('plDisOn', (p.discover || {}).enabled);
    set('plFeedInt', (p.feed || {}).interval || 4);
    on('plFeedOn', (p.feed || {}).enabled);
    set('plHubInt', (p.genreHub || {}).interval || 3);
    on('plHubOn', (p.genreHub || {}).enabled);
    const tp = document.getElementById('plHubTop');
    if (tp) tp.checked = (p.genreHub || {}).topPromo !== false;
    set('plHomeInt', (p.home || {}).interval || 5);
    on('plHomeOn', (p.home || {}).enabled);
    on('plFullOn', (p.fullReader || {}).enabled);
    set('plFullWords', (p.fullReader || {}).wordsPerSlot || 300);
    const fslots = (p.fullReader || {}).slots || {};
    on('plFullTop', slotOn(fslots['fullReader:top']));
    on('plFullInline', slotOn(fslots['fullReader:per-300-words']));
    on('plFullBottom', slotOn(fslots['fullReader:bottom']));
    on('plFullPaidAds', (p.fullReader || {}).paidUnlockAds === true);
    on('plScrollOn', (p.scrollReader || {}).enabled);
    set('plScrollWords', (p.scrollReader || {}).wordsPerSlot || 300);
    const sslots = (p.scrollReader || {}).slots || {};
    on('plScrollTop', slotOn(sslots['scrollReader:top']));
    on('plScrollInline', slotOn(sslots['scrollReader:per-300-words']));
    on('plScrollBottom', slotOn(sslots['scrollReader:bottom']));
    on('plScrollPaidAds', (p.scrollReader || {}).paidUnlockAds === true);
    const ls = document.getElementById('plLibSlider');
    if (ls) ls.checked = (p.library || {}).promoSlider !== false;
    const drb = document.getElementById('plDrbOn');
    if (drb) drb.checked = (p.droboardPage || {}).enabled !== false;
    set('plDrbInt', (p.droboardPage || {}).interval || 4);
    const co = document.getElementById('plCommentsOn');
    if (co) co.checked = (p.comments || {}).enabled !== false;
    set('plCommentsInt', (p.comments || {}).interval || 5);
    const cslots = (p.comments || {}).slots || {};
    on('plSlotListTop', slotOn(cslots['comments:list-top']));
    on('plSlotEveryNth', slotOn(cslots['comments:every-nth']));
    on('plSlotThreadTop', slotOn(cslots['comments:thread-top']));
    renderGenericSurfaces();
    renderSlotProgram();
  }

  /* ── Slot programming (per-slot formats / pinned ad ids) ── */
  const PROG_FMTS = ['platform', 'book', 'native', 'embed', 'follow', 'banner']; // promo excluded (slider only)
  function allSlots() {
    return (window.AdSetupData && AdSetupData.allSlots) ? AdSetupData.allSlots() : [];
  }
  function readSlotCfg(slotId) {
    const meta = allSlots().find(s => s.id === slotId);
    if (!meta) return null;
    const raw = ((INV.placements || {})[meta.page] || {}).slots || {};
    const v = raw[slotId];
    if (v && typeof v === 'object') return { enabled: v.enabled !== false, formats: v.formats || [], adIds: v.adIds || [] };
    return { enabled: v !== false, formats: [], adIds: [] };
  }
  function persistSlotForm() {
    if (!_curSlotId) return;
    const sel = document.getElementById('plProgFmts');
    const adInp = document.getElementById('plProgAdIds');
    const fmts = [];
    if (sel) sel.querySelectorAll('input[type=checkbox]:checked').forEach(c => fmts.push(c.value));
    const adIds = adInp ? adInp.value.split(',').map(s => s.trim()).filter(Boolean) : [];
    _slotProg[_curSlotId] = { formats: fmts, adIds };
  }
  function loadSlotForm(slotId) {
    _curSlotId = slotId;
    const cfg = readSlotCfg(slotId) || { formats: [], adIds: [] };
    const fmts = (_slotProg[slotId] ? _slotProg[slotId].formats : cfg.formats) || [];
    const adIds = (_slotProg[slotId] ? _slotProg[slotId].adIds : cfg.adIds) || [];
    const sel = document.getElementById('plProgFmts');
    if (sel) sel.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = fmts.indexOf(c.value) !== -1; });
    const adInp = document.getElementById('plProgAdIds');
    if (adInp) adInp.value = adIds.join(', ');
  }
  function renderSlotProgram() {
    const selSlot = document.getElementById('plProgSlot');
    const fmtBox = document.getElementById('plProgFmts');
    if (!selSlot || !fmtBox) return;
    const slots = allSlots();
    if (selSlot.dataset.bound !== '1') {
      let html = '<option value="">— choose a slot —</option>';
      let lastPage = null;
      slots.forEach(s => {
        if (s.page !== lastPage) {
          if (lastPage !== null) html += '</optgroup>';
          html += `<optgroup label="${esc(s.pageLabel)}">`;
          lastPage = s.page;
        }
        html += `<option value="${esc(s.id)}">${esc(s.label)}</option>`;
      });
      if (lastPage !== null) html += '</optgroup>';
      selSlot.innerHTML = html;
      selSlot.dataset.bound = '1';
      selSlot.addEventListener('change', () => { persistSlotForm(); loadSlotForm(selSlot.value); });
      fmtBox.innerHTML = PROG_FMTS.map(f => `<label class="pl-fmt-chk"><input type="checkbox" value="${f}"/> ${f}</label>`).join('');
      fmtBox.addEventListener('change', persistSlotForm);
      const adInp = document.getElementById('plProgAdIds');
      if (adInp) adInp.addEventListener('change', persistSlotForm);
      const clearBtn = document.getElementById('plProgClear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        if (!_curSlotId) return;
        delete _slotProg[_curSlotId];
        loadSlotForm(_curSlotId);
        toast('Programming cleared for this slot (save to apply)');
      });
    }
    const target = _curSlotId || (slots[0] && slots[0].id) || '';
    if (selSlot && target && selSlot.value !== target) selSlot.value = target;
    loadSlotForm(target);
  }
  async function savePlacements() {
    persistSlotForm(); // capture any in-progress programming edits
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const num = (v, fb) => { const n = parseInt(v, 10); return n > 0 ? n : fb; };
    const chk = (id) => { const el = document.getElementById(id); return !!el && el.checked; };
    const words = (id) => Math.min(5000, Math.max(50, parseInt(get(id), 10) || 300));
    /* Merge a slot's on/off state with any programming (formats / pinned
       adIds). Bare boolean when no programming — matches slotCfg()'s shape. */
    const progFor = (slotId) => _slotProg[slotId] || null;
    const slotVal = (slotId, enabled) => {
      const p = progFor(slotId);
      if (p && (p.formats.length || p.adIds.length)) return { enabled: !!enabled, formats: p.formats, adIds: p.adIds };
      return !!enabled;
    };
    const patch = {
      discover: { enabled: chk('plDisOn'), interval: num(get('plDisInt'), 6), cycle: get('plDisCycle').split(',').map(s => s.trim()).filter(Boolean) },
      feed: { enabled: chk('plFeedOn'), interval: num(get('plFeedInt'), 4) },
      genreHub: { enabled: chk('plHubOn'), interval: num(get('plHubInt'), 3), topPromo: !!document.getElementById('plHubTop').checked },
      home: { enabled: chk('plHomeOn'), interval: num(get('plHomeInt'), 5) },
      fullReader: { enabled: chk('plFullOn'), wordsPerSlot: words('plFullWords'), paidUnlockAds: chk('plFullPaidAds'), slots: { 'fullReader:top': slotVal('fullReader:top', chk('plFullTop')), 'fullReader:per-300-words': slotVal('fullReader:per-300-words', chk('plFullInline')), 'fullReader:bottom': slotVal('fullReader:bottom', chk('plFullBottom')) } },
      scrollReader: { enabled: chk('plScrollOn'), wordsPerSlot: words('plScrollWords'), paidUnlockAds: chk('plScrollPaidAds'), slots: { 'scrollReader:top': slotVal('scrollReader:top', chk('plScrollTop')), 'scrollReader:per-300-words': slotVal('scrollReader:per-300-words', chk('plScrollInline')), 'scrollReader:bottom': slotVal('scrollReader:bottom', chk('plScrollBottom')) } },
      library: { promoSlider: !!document.getElementById('plLibSlider').checked },
      droboardPage: { interval: num(get('plDrbInt'), 4), enabled: !!document.getElementById('plDrbOn').checked },
      comments: { interval: num(get('plCommentsInt'), 5), enabled: !!document.getElementById('plCommentsOn').checked, slots: { 'comments:list-top': slotVal('comments:list-top', chk('plSlotListTop')), 'comments:every-nth': slotVal('comments:every-nth', chk('plSlotEveryNth')), 'comments:thread-top': slotVal('comments:thread-top', chk('plSlotThreadTop')) } },
    };
    /* Every registered page must land in the patch, or its on/off is
       silently dropped on save. Bespoke cards above already set theirs;
       the rest read their generic toggle (plGen_<pageId>). */
    const pages = (window.AdSetupData && AdSetupData.PAGES) ? AdSetupData.PAGES : [];
    pages.forEach(pg => {
      if (patch[pg.id]) return;
      const el = document.getElementById('plGen_' + pg.id);
      patch[pg.id] = { enabled: el ? !!el.checked : true };
    });
    /* Slots with no on/off checkbox in the panel (debate, feed, home, …):
       programming-only writes must still land on the right page, keeping the
       slot's existing enabled state from INV.placements. */
    Object.keys(_slotProg).forEach(slotId => {
      const meta = allSlots().find(s => s.id === slotId);
      if (!meta) return;
      if (!patch[meta.page]) patch[meta.page] = { enabled: true };
      if (!patch[meta.page].slots) patch[meta.page].slots = {};
      if (patch[meta.page].slots[slotId] !== undefined) return; // already handled via checkbox
      const existing = (((INV.placements || {})[meta.page] || {}).slots || {})[slotId];
      const wasOn = existing === undefined ? true : (typeof existing === 'object' ? existing.enabled !== false : existing !== false);
      patch[meta.page].slots[slotId] = slotVal(slotId, wasOn);
    });
    try {
      INV.placements = await MarketingData.savePlacements(patch);
      _slotProg = {}; // committed — clear pending edits
      toast('✅ Placement frequency saved — live on client pages');
      renderPlacements(); // refresh programming form from saved state
    } catch (e) { toast('Could not save placements'); }
  }

  /* ── Reader League (full CRUD: weights, prizes, kill switch) ── */
  const LEAGUE_ACTIONS = [
    { id: 'chapter', label: '📖 Chapter' }, { id: 'hour', label: '⏱ Hour read' },
    { id: 'reaction', label: '❤️ Reaction' }, { id: 'comment', label: '💬 Comment' },
    { id: 'reply', label: '↩️ Reply' }, { id: 'debate', label: '🗳 Debate vote' },
    { id: 'win', label: '🏆 Debate win' }, { id: 'streak', label: '🔥 Streak day' },
  ];
  let LEAGUE = null;
  let _lgRemoved = [];
  function lgCustomActions() {
    const core = {};
    LEAGUE_ACTIONS.forEach(a => (core[a.id] = true));
    return Object.keys((LEAGUE && LEAGUE.weights) || {}).filter(k => !core[k]);
  }
  function renderLeague() {
    const wWrap = document.getElementById('lgWeights');
    const pWrap = document.getElementById('lgPrizes');
    if (!wWrap || !pWrap || !LEAGUE) return;
    const on = document.getElementById('lgOn');
    if (on) on.checked = LEAGUE.enabled !== false;
    const labels = LEAGUE.actionLabels || {};
    const icons = LEAGUE.actionIcons || {};
    wWrap.innerHTML = LEAGUE_ACTIONS.map(a =>
      `<div><label class="pl-lbl">${a.label}</label>` +
      `<input class="pl-inp" id="lgW_${a.id}" type="number" min="0" value="${(+((LEAGUE.weights || {})[a.id]) || 0)}"/></div>`
    ).join('') + lgCustomActions().map(id =>
      `<div><label class="pl-lbl"><span id="lgE_${id}">${esc(icons[id] || '✦')}</span> <span id="lgL_${id}">${esc(labels[id] || id)}</span> <a href="#" data-lgdel="${esc(id)}" style="color:var(--red);font-weight:800" title="Remove action">✕</a></label>` +
      `<div style="display:flex;gap:6px"><input class="pl-inp" id="lgI_${esc(id)}" value="${esc(icons[id] || '✦')}" maxlength="4" title="Emoji icon" style="max-width:52px;margin-bottom:0;text-align:center"/>` +
      `<input class="pl-inp" id="lgW_${esc(id)}" type="number" min="0" value="${(+(LEAGUE.weights || {})[id] || 0)}" style="margin-bottom:0"/></div></div>`
    ).join('') +
    `<div><label class="pl-lbl">＋ New action label</label>` +
    `<input class="pl-inp" id="lgNewLabel" placeholder="e.g. Story shared" style="margin-bottom:6px"/>` +
    `<div style="display:flex;gap:6px"><input class="pl-inp" id="lgNewIcon" value="✦" maxlength="4" title="Emoji icon" style="max-width:52px;margin-bottom:0;text-align:center"/>` +
    `<input class="pl-inp" id="lgNewPts" type="number" min="0" value="5" style="margin-bottom:0"/>` +
    `<button class="btn-ghost" id="lgAddBtn" style="padding:9px 12px;white-space:nowrap">Add</button></div></div>`;
    wWrap.querySelectorAll('[data-lgdel]').forEach(a => a.addEventListener('click', (e) => {      e.preventDefault();
      const id = a.dataset.lgdel;
      if (!confirm(`Remove the "${id}" action from scoring?`)) return;
      _lgRemoved.push(id);
      delete LEAGUE.weights[id];
      renderLeague();
      toast('Action removed (Save league to apply)');
    }));
    lgCustomActions().forEach(id => {
      const inp = document.getElementById('lgI_' + id);
      if (inp) inp.addEventListener('input', () => {
        const s = document.getElementById('lgE_' + id);
        if (s) s.textContent = inp.value.trim().slice(0, 4) || '✦';
      });
    });
    const addBtn = document.getElementById('lgAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => {
      const lblEl = document.getElementById('lgNewLabel');
      const ptsEl = document.getElementById('lgNewPts');
      const icoEl = document.getElementById('lgNewIcon');
      const label = (lblEl.value || '').trim();
      if (!label) { toast('Name the action first'); return; }
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('action_' + Date.now());
      LEAGUE.weights = LEAGUE.weights || {};
      LEAGUE.actionLabels = LEAGUE.actionLabels || {};
      LEAGUE.actionIcons = LEAGUE.actionIcons || {};
      LEAGUE.weights[id] = Math.max(0, parseInt(ptsEl.value, 10) || 0);
      LEAGUE.actionLabels[id] = label;
      LEAGUE.actionIcons[id] = ((icoEl && icoEl.value) || '✦').trim().slice(0, 4) || '✦';
      _lgRemoved = _lgRemoved.filter(k => k !== id);
      renderLeague();
      toast(`✅ “${label}” scores +${LEAGUE.weights[id]} — Save league to apply`);
    });
    pWrap.innerHTML = (LEAGUE.prizes || []).map((p, i) =>
      `<div class="pl-card"><div class="pl-name">#${p.place || (i + 1)}</div>` +
      `<div class="pl-lbl">Live preview — exactly as winners see it</div>` +
      `<div id="lgP${i}_prev" style="margin-bottom:9px"></div>` +
      `<label class="pl-lbl">Badge label (text on the winner's profile)</label><input class="pl-inp" id="lgP${i}_badge" data-lgprev="${i}" value="${esc(p.badge || '')}"/>` +
      `<label class="pl-lbl">Icon (Font Awesome name, e.g. fa-crown)</label><input class="pl-inp" id="lgP${i}_icon" data-lgprev="${i}" value="${esc(p.icon || 'fa-medal')}"/>` +
      `<label class="pl-lbl">Color</label>` +
      `<div style="display:flex;gap:8px;align-items:center;margin-bottom:9px">` +
      `<input type="color" id="lgP${i}_color" data-lgprev="${i}" value="${esc(p.color || '#f59e0b')}" style="width:44px;height:36px;padding:3px;border:1px solid var(--input-border);border-radius:9px;background:var(--input-bg);cursor:pointer;flex-shrink:0"/>` +
      `<input class="pl-inp" id="lgP${i}_hex" data-lgprev="${i}" value="${esc(p.color || '#f59e0b')}" style="margin-bottom:0" maxlength="7" spellcheck="false"/>` +
      `</div>` +
      `<label class="pl-lbl">Perks (comma separated)</label><input class="pl-inp" id="lgP${i}_perks" value="${esc((p.perks || []).join(', '))}"/>` +
      `<label class="pl-lbl">Ad-free days</label><input class="pl-inp" id="lgP${i}_days" type="number" min="0" max="30" value="${(p.adFreeDays == null ? 0 : +p.adFreeDays)}"/>` +
      `</div>`
    ).join('');
    (LEAGUE.prizes || []).forEach((p, i) => bindLeaguePreview(i));
  }
  /* Live badge preview — mirrors profile ach-chip rendering exactly. */
  function leagueHexSoft(hex) {
    var h = String(hex || '#f59e0b').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    var r = parseInt(h.substr(0, 2), 16) || 0, g = parseInt(h.substr(2, 2), 16) || 0, b = parseInt(h.substr(4, 2), 16) || 0;
    return `rgba(${r},${g},${b},.12)`;
  }
  function paintLeaguePreview(i) {
    const prev = document.getElementById(`lgP${i}_prev`);
    if (!prev) return;
    const badgeEl = document.getElementById(`lgP${i}_badge`);
    const iconEl = document.getElementById(`lgP${i}_icon`);
    const badge = badgeEl ? badgeEl.value : 'Badge';
    const icon = iconEl ? iconEl.value : 'fa-medal';
    let color = '#f59e0b';
    const hexEl = document.getElementById(`lgP${i}_hex`);
    const colEl = document.getElementById(`lgP${i}_color`);
    const raw = ((hexEl && hexEl.value) || (colEl && colEl.value) || '').trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) color = raw;
    prev.innerHTML =
      `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:800;white-space:nowrap;` +
      `background:${leagueHexSoft(color)};color:${color};border:1px solid ${color}">` +
      `<i class="fas ${esc(icon)}"></i> ${esc(badge) || 'Badge'}</span>`;
  }
  function bindLeaguePreview(i) {
    paintLeaguePreview(i);
    ['badge', 'icon', 'hex'].forEach(k => {
      const el = document.getElementById(`lgP${i}_${k}`);
      if (el) el.addEventListener('input', () => {
        if (k === 'hex') {
          const col = document.getElementById(`lgP${i}_color`);
          if (col && /^#([0-9a-fA-F]{6})$/.test(el.value.trim())) col.value = el.value.trim();
        }
        paintLeaguePreview(i);
      });
    });
    const col = document.getElementById(`lgP${i}_color`);
    if (col) col.addEventListener('input', () => {
      const hex = document.getElementById(`lgP${i}_hex`);
      if (hex) hex.value = col.value;
      paintLeaguePreview(i);
    });
  }
  async function saveLeague() {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const num = (v) => Math.max(0, parseInt(v, 10) || 0);
    const weights = {};
    LEAGUE_ACTIONS.forEach(a => { weights[a.id] = num(get('lgW_' + a.id)); });
    lgCustomActions().forEach(id => {
      const el = document.getElementById('lgW_' + id);
      if (el) weights[id] = num(el.value);
    });
    const labels = {};
    lgCustomActions().forEach(id => {
      const el = document.getElementById('lgL_' + id);
      labels[id] = el ? el.textContent : id;
    });
    const icons = {};
    lgCustomActions().forEach(id => {
      const el = document.getElementById('lgI_' + id);
      icons[id] = el ? el.value.trim().slice(0, 4) : '✦';
    });
    const newLbl = ((document.getElementById('lgNewLabel') || {}).value || '').trim();
    const newPts = (document.getElementById('lgNewPts') || {}).value || '';
    if (newLbl) {
      const nid = newLbl.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('action_' + Date.now());
      LEAGUE.weights = LEAGUE.weights || {};
      LEAGUE.actionLabels = LEAGUE.actionLabels || {};
      LEAGUE.actionIcons = LEAGUE.actionIcons || {};
      if (LEAGUE.weights[nid] == null) {
        LEAGUE.weights[nid] = Math.max(0, parseInt(newPts, 10) || 0);
        LEAGUE.actionLabels[nid] = newLbl;
        LEAGUE.actionIcons[nid] = ((document.getElementById('lgNewIcon') || {}).value || '✦').trim().slice(0, 4) || '✦';
      }
    }
    const prizes = (LEAGUE.prizes || []).map((p, i) => ({
      place: p.place || (i + 1),
      badge: get(`lgP${i}_badge`) || p.badge,
      icon: get(`lgP${i}_icon`) || 'fa-medal',
      color: (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(get(`lgP${i}_hex`).trim()) ? get(`lgP${i}_hex`).trim() : (get(`lgP${i}_color`) || '#f59e0b')),
      perks: get(`lgP${i}_perks`).split(',').map(s => s.trim()).filter(Boolean),
      adFreeDays: Math.min(30, num(get(`lgP${i}_days`))),
    }));
    try {
      LEAGUE = await MarketingData.saveLeagueConfig({
        enabled: !!document.getElementById('lgOn').checked,
        weights, actionLabels: labels, actionIcons: icons, prizes,
        removeActions: _lgRemoved,
      });
      _lgRemoved = [];
      renderLeague();
      toast('✅ League saved — live on client pages at next load');
    } catch (e) { toast('Could not save league'); }
  }
  async function resetLeague() {
    if (!confirm('Reset league scoring and prizes to defaults?')) return;
    try {
      LEAGUE = await MarketingData.resetLeague();
      renderLeague();
      toast('League reset to defaults');
    } catch (e) { toast('Could not reset league'); }
  }

  /* ── Ad list ── */
  function renderFilterPills() {
    const ads = allAds();
    const countFor = (f) => f === 'all' ? ads.length : ads.filter(x => x.format === f).length;
    const wrap = document.getElementById('fmtPills');
    if (!wrap) return;
    wrap.innerHTML = [{ id: 'all', label: 'All' }].concat(FORMATS).map(f =>
      `<button class="filter-pill${filterFormat === f.id ? ' on' : ''}" data-fmt="${f.id}">${f.label} <span class="pill-count">${countFor(f.id)}</span></button>`
    ).join('');
    wrap.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => { filterFormat = b.dataset.fmt; listPage = 1; renderList(); renderFilterPills(); }));
  }
  function renderCampFilter() {
    const row = document.getElementById('campFilterRow');
    if (!row) return;
    if (!campaignFilter) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    document.getElementById('campFilterText').textContent = '📣 Campaign: ' + campName(campaignFilter);
  }
  function statFor(id) { return STATS.find(s => String(s.id) === String(id)) || { impressions: 0, clicks: 0, ctr: '0.0' }; }
  function audienceChip(ad) {
    const aud = (ad && ad.audience) || {};
    const n = ((aud.segments || []).length) + ((aud.genres || []).length);
    return n ? `<span class="type-chip" style="background:var(--amber-bg);color:var(--amber)">🎯 ${n} target${n === 1 ? '' : 's'}</span>` : '';
  }
  function audienceText(ad) {
    const aud = (ad && ad.audience) || {};
    const names = [];
    ((aud.segments || [])).forEach(id => {
      const lbl = window.AdSetupData ? AdSetupData.segmentLabel(id) : id;
      names.push(lbl);
    });
    (aud.genres || []).forEach(g => names.push(g));
    if ((aud.countries || []).length) names.push(aud.countries.join(', '));
    return names.length ? ' · 🎯 ' + names.join(', ') : '';
  }
  function renderStatusPills() {
    const defs = [['all', 'All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['ended', 'Ended'], ['off', 'Off']];
    const wrap = document.getElementById('statusPills');
    if (!wrap) return;
    wrap.innerHTML = defs.map(([v, l]) => `<button class="filter-pill${filterStatus === v ? ' on' : ''}" data-st="${v}">${l}</button>`).join('');
    wrap.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.st; listPage = 1; renderList(); renderStatusPills(); }));
  }
  function renderList() {
    const q = searchText.trim().toLowerCase();
    const list = allAds().filter(x =>
      (filterFormat === 'all' || x.format === filterFormat) &&
      (filterStatus === 'all' || adStatus(x.ad) === filterStatus) &&
      (!campaignFilter || String(x.ad.campaign || '') === String(campaignFilter)) &&
      (!q || adTitle(x.ad).toLowerCase().includes(q))
    );
    if (sortKey !== 'default') {
      const metric = (x) => {
        const st = statFor(x.ad.id);
        if (sortKey.indexOf('imp') === 0) return +st.impressions || 0;
        if (sortKey.indexOf('clk') === 0) return +st.clicks || 0;
        return parseFloat(st.ctr) || 0;
      };
      const dir = sortKey.indexOf('-asc') > 0 ? 1 : -1;
      list.sort((a, b) => (metric(a) - metric(b)) * dir);
    }
    const el = document.getElementById('adList');
    document.getElementById('adCount').textContent = list.length + ' ad' + (list.length === 1 ? '' : 's');
    if (!list.length) {
      const missing = !window.MarketingData ? 'data layer (marketing-data.js) failed to load. Check script paths.'
        : (!window.DemoData && !Object.keys(readOverrides()).length ? 'demo data (central-demo-data.js) failed to load. Check script paths.' : '');
      el.innerHTML = `<div class="empty-msg"><i class="fas fa-rectangle-ad"></i>${missing ? '⚠️ ' + missing : 'No ads here yet — create one to fill this slot.'}</div>`;
      document.getElementById('adPager').style.display = 'none';
      return;
    }
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (listPage > totalPages) listPage = totalPages;
    const pageItems = list.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);
    const pillLabel = { live: 'live', off: 'off', scheduled: 'scheduled', ended: 'ended' };
    el.innerHTML = pageItems.map(x => {
      const st = STATS.find(s => String(s.id) === String(x.ad.id)) || {};
      const status = adStatus(x.ad);
      const on = status === 'live' || status === 'scheduled';
      const pages = Array.isArray(x.ad.pages) && x.ad.pages.length ? x.ad.pages : ['discover', 'feed', 'genreHub', 'library', 'home', 'fullReader', 'scrollReader'];
      return `<div class="ad-row" data-fmt="${x.format}" data-id="${esc(x.ad.id)}">
        ${adCover(x.ad) ? `<img class="ad-thumb" src="${esc(adCover(x.ad))}" loading="lazy" alt=""/>` : `<div class="ad-thumb empty"><i class="fas fa-image"></i></div>`}
        <div class="ad-main">
          <div class="ad-top"><span class="ad-name">${esc(adTitle(x.ad))}</span>
            <span class="type-chip">${x.format}</span>
            ${x.ad.campaign ? `<span class="type-chip" style="background:var(--blue-bg);color:var(--blue)">📣 ${esc(campName(x.ad.campaign))}</span>` : ''}
            ${audienceChip(x.ad)}
            <span class="status-pill ${status}">${pillLabel[status]}</span>
          </div>
          <div class="ad-sub">${esc(x.ad.sponsor || x.ad.brand || x.ad.author || '')} · shows on ${pages.join(', ')}${esc(scheduleText(x.ad))}${esc(audienceText(x.ad))}</div>
          <div class="ad-meta"><span><i class="fas fa-eye"></i> ${fmtN(st.impressions)} imp</span><span class="metric-click"><i class="fas fa-mouse-pointer"></i> ${fmtN(st.clicks)} clicks</span><span><i class="fas fa-chart-line"></i> ${st.ctr || '0.0'}% CTR</span></div>
          <div class="ad-actions">
            <button class="ad-btn" data-act="toggle">${x.ad.active === false ? 'Turn on' : 'Turn off'}</button>
            <button class="ad-btn" data-act="edit">Edit</button>
            <button class="ad-btn danger" data-act="del">Delete</button>
          </div>
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('.ad-row').forEach(row => {
      const fmt = row.dataset.fmt, id = row.dataset.id;
      row.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'toggle') toggleAd(fmt, id);
        else if (act === 'edit') openWizard(fmt, id);
        else if (act === 'del') deleteAd(fmt, id);
      }));
    });
    renderPager(list.length, totalPages);
  }
  function renderPager(total, totalPages) {
    const pager = document.getElementById('adPager');
    if (totalPages <= 1) { pager.style.display = 'none'; return; }
    pager.style.display = 'flex';
    const start = (listPage - 1) * PAGE_SIZE + 1, end = Math.min(total, listPage * PAGE_SIZE);
    document.getElementById('pgnInfo').textContent = `Showing ${start}–${end} of ${total}`;
    let btns = `<button class="pgn-btn" data-pg="prev"${listPage === 1 ? ' disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      btns += `<button class="pgn-btn${i === listPage ? ' on' : ''}" data-pg="${i}">${i}</button>`;
    }
    btns += `<button class="pgn-btn" data-pg="next"${listPage === totalPages ? ' disabled' : ''}>›</button>`;
    const wrap = document.getElementById('pgnBtns');
    wrap.innerHTML = btns;
    wrap.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.pg;
      if (v === 'prev') { if (listPage > 1) listPage--; }
      else if (v === 'next') { if (listPage < totalPages) listPage++; }
      else listPage = parseInt(v, 10);
      renderList();
    }));
  }

  async function toggleAd(fmt, id) {
    const ad = ((INV.pools || {})[fmt] || []).find(a => String(a.id) === String(id));
    if (!ad) return;
    try {
      await MarketingData.toggleAd(fmt, id, ad.active === false);
      await reload();
      toast(ad.active === false ? '✅ Ad live' : 'Ad turned off');
    } catch (e) { toast('Could not update ad'); }
  }
  async function deleteAd(fmt, id) {
    const ad = ((INV.pools || {})[fmt] || []).find(a => String(a.id) === String(id));
    if (!ad) return;
    if (!confirm(`Delete "${adTitle(ad)}"? It stops serving immediately.`)) return;
    try {
      await MarketingData.deleteAd(fmt, id);
      await reload();
      toast('🗑️ Ad deleted');
    } catch (e) { toast('Could not delete ad'); }
  }

  /* ── Ad setup lives on its own page (ad-setup.html). ── */
  function openWizard(format, id) {
    if (id) window.location.href = 'ad-setup.html?edit=' + encodeURIComponent(format) + ':' + encodeURIComponent(id);
    else window.location.href = 'ad-setup.html' + (format && format !== 'platform' ? '?format=' + encodeURIComponent(format) : '');
  }

  /* ── Boot ── */
  async function reload() {
    try { INV = await MarketingData.getAdInventory(); } catch (e) {}
    try { STATS = await MarketingData.getAdStats(); } catch (e) { STATS = []; }
    try { CAMPS = await MarketingData.getCampaigns(); } catch (e) { CAMPS = []; }
    try { LEAGUE = await MarketingData.getLeagueConfig(); } catch (e) { LEAGUE = null; }
    renderStats();
    renderPlacements();
    renderLeague();
    renderFilterPills();
    renderStatusPills();
    renderCampFilter();
    renderList();
  }
  async function init() {
    try {
      const params = new URLSearchParams(location.search);
      campaignFilter = params.get('campaign') || '';
      if (campaignFilter) listPage = 1;
    } catch (e) {}
    if (window.MarketingSidebar) {
      MarketingSidebar.attach('#admRoot', {
        activeItem: 'ad-manager',
        title: 'Ad Manager',
        subtitle: 'Creatives, frequency and placements for every client surface',
        user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
        notifCount: 5,
        searchPlaceholder: 'Search ads…',
        onSearch: (v) => { searchText = v || ''; listPage = 1; const si = document.getElementById('searchInput'); if (si) si.value = searchText; renderList(); },
      });
    }
    await reload();
    document.getElementById('newAdBtn').addEventListener('click', () => openWizard('platform'));
    document.getElementById('plSaveBtn').addEventListener('click', savePlacements);
    const _lgSave = document.getElementById('lgSaveBtn');
    if (_lgSave) _lgSave.addEventListener('click', saveLeague);
    const _lgReset = document.getElementById('lgResetBtn');
    if (_lgReset) _lgReset.addEventListener('click', resetLeague);
    const _lgPrev = document.getElementById('lgPreviewBtn');
    if (_lgPrev) _lgPrev.addEventListener('click', () => {
      try {
        if (window.ReaderLeague && ReaderLeague.previewAsChampion()) toast('👑 Preview on — open your profile to see badge + gold frame');
        else toast('Could not set preview');
      } catch (e) { toast('Could not set preview'); }
    });
    const _lgPrevClr = document.getElementById('lgPreviewClearBtn');
    if (_lgPrevClr) _lgPrevClr.addEventListener('click', () => {
      try {
        if (window.ReaderLeague && ReaderLeague.clearPreview()) toast('Preview cleared');
        else toast('Could not clear preview');
      } catch (e) { toast('Could not clear preview'); }
    });
    const _lgHead = document.getElementById('lgHead');
    if (_lgHead) {
      const toggle = () => document.getElementById('lgPanel').classList.toggle('collapsed');
      _lgHead.addEventListener('click', toggle);
      _lgHead.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }
    document.getElementById('resetAdsBtn').addEventListener('click', async () => {
      if (!confirm('Reset all ads and frequencies to defaults?')) return;
      await MarketingData.resetAds();
      await reload();
      toast('Ads reset to defaults');
    });
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('input', () => { searchText = si.value; listPage = 1; renderList(); });
    const cc = document.getElementById('campFilterClear');
    if (cc) cc.addEventListener('click', () => { campaignFilter = ''; listPage = 1; renderCampFilter(); renderList(); });
    const sortSel = document.getElementById('sortSel');
    if (sortSel) sortSel.addEventListener('change', () => { sortKey = sortSel.value; listPage = 1; renderList(); });
    const plHead = document.getElementById('plHead');
    if (plHead) {
      const toggle = () => document.getElementById('plPanel').classList.toggle('collapsed');
      plHead.addEventListener('click', toggle);
      plHead.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }
  }

  window.AdManagerPage = { init };
})();
