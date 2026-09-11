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
    { id: 'follow', label: 'Follow', icon: 'fa-user-plus' },
    { id: 'banner', label: 'Banner', icon: 'fa-flag' },
    { id: 'promo', label: 'Promo slide', icon: 'fa-images' },
  ];
  const PAGES = [
    { id: 'discover', label: 'Discover' },
    { id: 'feed', label: 'Feed' },
    { id: 'genreHub', label: 'Genre Hub' },
    { id: 'library', label: 'Library' },
    { id: 'series', label: 'Series Page' },
    { id: 'home', label: 'Homepage' },
    { id: 'fullReader', label: 'Full Reader' },
    { id: 'scrollReader', label: 'Scroll Reader' },
  ];
  /* field: [key, label, type] — type: text | area | img */
  const FIELDS = {
    platform: [['sponsor', 'Sponsor', 'text'], ['title', 'Headline', 'text'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    book: [['title', 'Book title', 'text'], ['author', 'Author', 'text'], ['genre', 'Genre', 'text'], ['rating', 'Rating', 'text'], ['chapters', 'Chapters', 'text'], ['preview', 'Preview line', 'area'], ['cta', 'CTA button', 'text'], ['img', 'Cover image', 'img']],
    native: [['brand', 'Brand', 'text'], ['heading', 'Headline', 'text'], ['body', 'Body', 'area'], ['cta', 'CTA button', 'text'], ['image', 'Image', 'img']],
    follow: [['name', 'Display name', 'text'], ['handle', 'Handle', 'text'], ['tagline', 'Tagline', 'text'], ['cta', 'CTA button', 'text'], ['avatar', 'Avatar', 'img']],
    banner: [['brand', 'Brand', 'text'], ['headline', 'Headline', 'text'], ['sub', 'Sub line', 'text'], ['cta', 'CTA button', 'text']],
    promo: [['title', 'Title', 'text'], ['sub', 'Sub line', 'text'], ['author', 'Author', 'text'], ['cta', 'CTA button', 'text'], ['genre', 'Hub genre (blank = all hubs)', 'text'], ['img', 'Slide image', 'img']],
  };

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
  let editing = null; // { format, ad }
  let imgDataUrl = '';

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
  function renderPlacements() {
    const p = INV.placements || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('plDisInt', (p.discover || {}).interval || 6);
    set('plDisCycle', ((p.discover || {}).cycle || []).join(', '));
    set('plFeedInt', (p.feed || {}).interval || 4);
    set('plHubInt', (p.genreHub || {}).interval || 3);
    const tp = document.getElementById('plHubTop');
    if (tp) tp.checked = (p.genreHub || {}).topPromo !== false;
    set('plHomeInt', (p.home || {}).interval || 5);
    set('plFullInt', (p.fullReader || {}).interval || 3);
    set('plScrollInt', (p.scrollReader || {}).interval || 4);
    const ls = document.getElementById('plLibSlider');
    if (ls) ls.checked = (p.library || {}).promoSlider !== false;
  }
  async function savePlacements() {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const num = (v, fb) => { const n = parseInt(v, 10); return n > 0 ? n : fb; };
    const patch = {
      discover: { interval: num(get('plDisInt'), 6), cycle: get('plDisCycle').split(',').map(s => s.trim()).filter(Boolean) },
      feed: { interval: num(get('plFeedInt'), 4) },
      genreHub: { interval: num(get('plHubInt'), 3), topPromo: !!document.getElementById('plHubTop').checked },
      home: { interval: num(get('plHomeInt'), 5) },
      fullReader: { interval: num(get('plFullInt'), 3) },
      scrollReader: { interval: num(get('plScrollInt'), 4) },
      library: { promoSlider: !!document.getElementById('plLibSlider').checked },
    };
    try {
      INV.placements = await MarketingData.savePlacements(patch);
      toast('✅ Placement frequency saved — live on client pages');
    } catch (e) { toast('Could not save placements'); }
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
  function statFor(id) { return STATS.find(s => String(s.id) === String(id)) || { impressions: 0, clicks: 0, ctr: '0.0' }; }
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
            <span class="status-pill ${status}">${pillLabel[status]}</span>
          </div>
          <div class="ad-sub">${esc(x.ad.sponsor || x.ad.brand || x.ad.author || '')} · shows on ${pages.join(', ')}${esc(scheduleText(x.ad))}</div>
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
        else if (act === 'edit') openModal(fmt, id);
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

  /* ── Modal form ── */
  function openModal(fmt, id) {
    editing = { format: fmt || 'platform', ad: null };
    if (id) {
      const found = ((INV.pools || {})[editing.format] || []).find(a => String(a.id) === String(id));
      if (found) editing.ad = JSON.parse(JSON.stringify(found));
    }
    imgDataUrl = '';
    document.getElementById('mTitle').textContent = editing.ad ? 'Edit ad' : 'New ad';
    const sel = document.getElementById('mFormat');
    sel.value = editing.format;
    sel.disabled = !!editing.ad;
    buildFields();
    fillCampaignSelect(editing.ad && editing.ad.campaign);
    syncStoryWrap();
    document.getElementById('mActive').checked = !editing.ad || editing.ad.active !== false;
    document.getElementById('mStart').value = (editing.ad && editing.ad.startDate) || '';
    document.getElementById('mEnd').value = (editing.ad && editing.ad.endDate) || '';
    renderPageChecks();
    document.getElementById('admModalOv').classList.add('open');
  }
  function closeModal() {
    document.getElementById('admModalOv').classList.remove('open');
    editing = null;
  }
  function buildFields() {
    const fmt = editing.format;
    const ad = editing.ad || {};
    const wrap = document.getElementById('mFields');
    wrap.innerHTML = (FIELDS[fmt] || []).map(([key, label, type]) => {
      if (type === 'area') return `<label class="f-lbl">${label}<textarea class="f-inp" data-k="${key}" rows="2">${esc(ad[key] || '')}</textarea></label>`;
      if (type === 'img') {
        const cur = ad[key] || '';
        return `<label class="f-lbl">${label}<input class="f-inp" data-k="${key}" value="${esc(cur)}" placeholder="https://…"/>
          <span class="f-row"><input type="file" id="mFile" accept="image/*" class="f-file"/><img id="mPreview" class="f-preview" src="${esc(cur)}" style="${cur ? '' : 'display:none'}"/></span></label>`;
      }
      return `<label class="f-lbl">${label}<input class="f-inp" data-k="${key}" value="${esc(ad[key] || '')}"/></label>`;
    }).join('');
    const file = document.getElementById('mFile');
    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        imgDataUrl = r.result;
        const pv = document.getElementById('mPreview');
        if (pv) { pv.src = r.result; pv.style.display = 'block'; }
      };
      r.readAsDataURL(f);
    });
  }
  /* ── Platform story lookup (book promos) ── */
  function storySource() {
    const d = window.DemoData || {};
    return Array.isArray(d.STORIES) ? d.STORIES : [];
  }
  function renderStoryHits(q) {
    const box = document.getElementById('mStoryResults');
    if (!box) return;
    q = (q || '').trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const hits = storySource().filter(s =>
      (s.title || '').toLowerCase().includes(q) || (s.author || '').toLowerCase().includes(q)
    ).slice(0, 6);
    box.innerHTML = hits.length ? hits.map((s, i) =>
      `<button type="button" class="story-hit" data-hit="${i}">
        ${s.cover ? `<img src="${esc(s.cover)}" loading="lazy" alt=""/>` : ''}
        <div style="flex:1;min-width:0"><div class="story-hit-t">${esc(s.title)}</div><div class="story-hit-a">${esc(s.author || '')}${s.cat ? ' · ' + esc(s.cat) : ''}</div></div>
      </button>`
    ).join('') : `<div class="empty-msg" style="padding:14px">No platform story matches.</div>`;
    box.querySelectorAll('[data-hit]').forEach(btn => btn.addEventListener('click', () => {
      const s = hits[+btn.dataset.hit];
      if (s) fillFromStory(s);
    }));
  }
  function setField(key, val) {
    const el = document.querySelector(`#mFields [data-k="${key}"]`);
    if (el && val != null) el.value = val;
  }
  function fillFromStory(s) {
    setField('title', s.title);
    setField('author', s.author);
    setField('genre', (s.cat || '').replace(/^[^\s]+\s/, ''));
    setField('preview', s.desc);
    setField('chapters', s.chapters);
    setField('img', s.cover);
    imgDataUrl = '';
    const pv = document.getElementById('mPreview');
    if (pv && s.cover) { pv.src = s.cover; pv.style.display = 'block'; }
    document.getElementById('mStoryResults').innerHTML = '';
    document.getElementById('mStorySearch').value = s.title;
    toast('📖 Prefilled from "' + s.title + '" — author can still send their own image/link');
  }
  function syncStoryWrap() {
    const show = editing && editing.format === 'book';
    document.getElementById('mStoryWrap').style.display = show ? 'block' : 'none';
    if (!show) {
      const si = document.getElementById('mStorySearch');
      if (si) si.value = '';
      const box = document.getElementById('mStoryResults');
      if (box) box.innerHTML = '';
    }
  }
  function renderCampFilter() {
    const row = document.getElementById('campFilterRow');
    if (!row) return;
    if (!campaignFilter) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    document.getElementById('campFilterText').textContent = '📣 Campaign: ' + campName(campaignFilter);
  }
  function fillCampaignSelect(selected) {
    const sel = document.getElementById('mCampaign');
    sel.innerHTML = '<option value="">No campaign</option>' + CAMPS.map(c =>
      `<option value="${esc(c.id)}"${String(c.id) === String(selected || '') ? ' selected' : ''}>${esc(c.name || c.id)}</option>`
    ).join('');
  }
  function renderPageChecks() {
    const ad = (editing && editing.ad) || {};
    const pages = Array.isArray(ad.pages) && ad.pages.length ? ad.pages : PAGES.map(p => p.id);
    document.getElementById('mPages').innerHTML = PAGES.map(p =>
      `<label class="pg-check"><input type="checkbox" data-pg="${p.id}"${pages.includes(p.id) ? ' checked' : ''}/> ${p.label}</label>`
    ).join('');
  }
  /* A dated schedule means "not live right now" — uncheck Live. */
  function syncLiveCheckbox() {
    const box = document.getElementById('mActive');
    if (!box) return;
    const dated = !!(document.getElementById('mStart').value || document.getElementById('mEnd').value);
    if (dated) box.checked = false;
  }
  async function submitModal() {
    if (!editing) return;
    const fmt = editing.format;
    const payload = Object.assign({}, editing.ad || {});
    document.querySelectorAll('#mFields [data-k]').forEach(el => { payload[el.dataset.k] = el.value.trim(); });
    const imgField = (FIELDS[fmt] || []).find(f => f[2] === 'img');
    if (imgField && imgDataUrl) payload[imgField[0]] = imgDataUrl;
    if (fmt === 'book') payload.isBook = true;
    payload.campaign = document.getElementById('mCampaign').value || '';
    payload.startDate = document.getElementById('mStart').value || '';
    payload.endDate = document.getElementById('mEnd').value || '';
    payload.pages = [...document.querySelectorAll('#mPages [data-pg]:checked')].map(el => el.dataset.pg);
    payload.active = document.getElementById('mActive').checked;
    if (!adTitle(payload)) { toast('Give the ad a title first'); return; }
    const btn = document.getElementById('mSaveBtn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await MarketingData.saveAd(fmt, payload);
      closeModal();
      await reload();
      toast('✅ Ad saved — serving on client pages');
    } catch (e) { toast('Could not save ad'); }
    btn.textContent = 'Save ad'; btn.disabled = false;
  }

  /* ── Boot ── */
  async function reload() {
    try { INV = await MarketingData.getAdInventory(); } catch (e) {}
    try { STATS = await MarketingData.getAdStats(); } catch (e) { STATS = []; }
    try { CAMPS = await MarketingData.getCampaigns(); } catch (e) { CAMPS = []; }
    renderStats();
    renderPlacements();
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
    document.getElementById('newAdBtn').addEventListener('click', () => openModal('platform'));
    document.getElementById('mFormat').addEventListener('change', (e) => { editing.format = e.target.value; editing.ad = null; buildFields(); syncStoryWrap(); renderPageChecks(); });
    document.getElementById('mStorySearch').addEventListener('input', (e) => renderStoryHits(e.target.value));
    document.getElementById('mStart').addEventListener('change', syncLiveCheckbox);
    document.getElementById('mEnd').addEventListener('change', syncLiveCheckbox);
    document.getElementById('mCancelBtn').addEventListener('click', closeModal);
    document.getElementById('mSaveBtn').addEventListener('click', submitModal);
    document.getElementById('admModalOv').addEventListener('click', (e) => { if (e.target.id === 'admModalOv') closeModal(); });
    document.getElementById('plSaveBtn').addEventListener('click', savePlacements);
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
