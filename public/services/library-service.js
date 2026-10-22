/* ═══════════════════════════════════════════════════════════════
   LIBRARY DATA SERVICE
   Fetch-with-demo-fallback pattern. USE_API flips to real endpoints later.
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  async function getStats() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/stats`);
      if (!res.ok) throw new Error('Library Stats API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 60));
    const d = window.DemoData;
    const lib = d.LIBRARY || [];
    const inProgress = lib.filter(s => s.status === 'progress').length;
    const finished = lib.filter(s => s.status === 'finished').length;
    return { inProgress, finished, hoursRead: 48 };
  }

  async function getPromoSlides() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/promo`);
      if (!res.ok) throw new Error('Library Promo API failed');
      return res.json();
    }
    if (window.AdService) {
      try { return await AdService.getPromoSlides({ page: 'library' }); }
      catch (e) {}
    }
    return [];
  }

  async function getContinueReading() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/continue`);
      if (!res.ok) throw new Error('Continue Reading API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData;
    return (d.CONTINUE_READING || []).map(s => ({
      ...s,
      img: s.img || s.cover,
    }));
  }

  async function getLibrary() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/items`);
      if (!res.ok) throw new Error('Library API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 100));
    const d = window.DemoData;
    return (d.LIBRARY || []).map(s => ({
      ...s,
      img: s.img || s.cover,
    }));
  }

  async function getSaved() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/saved`);
      if (!res.ok) throw new Error('Saved API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData;
    return (d.SAVED_POSTS || []).map(p => ({
      ...p,
      img: p.avatar,
    }));
  }

  async function getHistory() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/library/history`);
      if (!res.ok) throw new Error('History API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData;
    return (d.HISTORY || []).map(s => ({
      ...s,
      img: s.img || s.cover,
    }));
  }

  window.LibraryData = {
    getStats,
    getPromoSlides,
    getContinueReading,
    getLibrary,
    getSaved,
    getHistory,
  };
})();

/* ═══════════════════════════════════════════════════════════════
   LIBRARY PAGE CONTROLLER
   Library page orchestration. HTML calls LibraryPage.init().
   Layout (tabs, panels, containers) lives in library.html;
   cards render via component/library-card.js (window.LibraryCard).
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ICONS = {
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>'
  };
  function icon(name, opts) {
    opts = opts || {};
    const size = opts.size || 18, stroke = opts.stroke || 2, color = opts.color || 'currentColor';
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let CONTINUE = [], PROMO = [], LIBRARY = [], SAVED = [], HISTORY = [];
  let currentView = { reading: 'grid', saved: 'grid', history: 'grid' };
  let currentFilter = 'all';
  let libPage = 1;
  const LIB_PAGE_SIZE = 12;
  let contPage = 1;
  const CONT_PAGE_SIZE = 4;

  function storyHref(s) {
    return 'bridge.html?id=' + encodeURIComponent(s.id || s.title || '');
  }

  /* Render items through the shared card component, then bind taps → bridge */
  function renderItems(items, view, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!window.LibraryCard) { el.innerHTML = ''; return; }
    if (view === 'grid') LibraryCard.renderGrid(containerId, items);
    else LibraryCard.renderList(containerId, items);
    const wrap = el.firstElementChild;
    if (!wrap) return;
    Array.from(wrap.children).forEach((card, i) => {
      const s = items[i];
      if (!s) return;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => { location.href = storyHref(s); });
    });
  }

  function getFilteredLibrary() {
    if (currentFilter === 'progress') return LIBRARY.filter(s => s.status === 'progress');
    if (currentFilter === 'finished') return LIBRARY.filter(s => s.status === 'finished');
    if (currentFilter === 'unread') return LIBRARY.filter(s => s.status === 'unread');
    return LIBRARY;
  }

  function renderStats(stats) {
    const nums = document.querySelectorAll('.stats-strip .stat-chip .stat-num');
    if (nums[0]) nums[0].textContent = stats.inProgress;
    if (nums[1]) nums[1].textContent = stats.finished;
    if (nums[2]) nums[2].textContent = stats.hoursRead;
  }

  function renderLibrary() {
    const filtered = getFilteredLibrary();
    const totalPages = Math.max(1, Math.ceil(filtered.length / LIB_PAGE_SIZE));
    if (libPage > totalPages) libPage = totalPages;
    if (libPage < 1) libPage = 1;
    const start = (libPage - 1) * LIB_PAGE_SIZE;
    renderItems(filtered.slice(start, start + LIB_PAGE_SIZE), currentView.reading, 'lib-container');
    renderLibPagination(totalPages);
  }

  function renderLibPagination(totalPages) {
    const el = document.getElementById('lib-pagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn nav ${libPage === 1 ? 'disabled' : ''}" data-page="prev">${icon('chevronLeft', { size: 14 })}</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn ${i === libPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn nav ${libPage === totalPages ? 'disabled' : ''}" data-page="next">${icon('chevronRight', { size: 14 })}</button>`;
    el.innerHTML = html;
  }

  function renderPosts(containerId, posts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const typeIcon = { debate: 'fa-comments', poll: 'fa-poll', repost: 'fa-retweet', quote: 'fa-quote-left', ama: 'fa-circle-question' };
    const typeLabel = { debate: 'Debate', poll: 'Poll', repost: 'Repost', quote: 'Quote', ama: 'AMA' };
    el.innerHTML = posts.map(p => {
      const isLong = p.text && p.text.length > 90;
      const shortText = isLong ? p.text.substring(0, 90).trim() + '…' : p.text;
      return `
      <div class="lib-item post-item" data-id="${esc(p.id)}">
        <img class="post-avatar" src="${esc(p.avatar)}" alt="" onerror="this.style.display='none'"/>
        <div class="lib-body">
          <div class="lib-title">
            <a href="profile.html?u=${esc(p.name)}" onclick="event.stopPropagation()" style="color:inherit;text-decoration:none">${esc(p.name)}</a>
            <span class="post-type">${typeLabel[p.type] || ''}</span>
          </div>
          <div class="lib-preview post-text">${esc(shortText)} <a href="discussion.html?id=${esc(p.id)}" onclick="event.stopPropagation()" style="color:var(--pink);font-weight:600">see more</a></div>
          <div class="lib-foot">
            <span class="lib-ch"><i class="fas ${typeIcon[p.type] || 'fa-comment'}"></i> ${p.likes || 0} likes · ${p.comments || 0} comments</span>
            <div style="display:flex;align-items:center;gap:8px;position:relative">
              <span class="lib-pct">${esc(p.time || '')}</span>
              <button class="post-menu-btn" onclick="event.stopPropagation();togglePostMenu('${esc(p.id)}')" title="More"><i class="fas fa-ellipsis"></i></button>
              <div class="post-menu" id="menu-${esc(p.id)}" style="display:none;position:absolute;right:0;top:32px;background:var(--white);border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);z-index:10;min-width:120px">
                <button onclick="event.stopPropagation();confirmRemovePost('${esc(p.id)}')" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;font-size:13px;color:var(--ink-2);border-radius:10px;text-align:left"><i class="fas fa-trash-can" style="color:var(--pink)"></i> Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `}).join('');
  }

  function togglePostMenu(id) {
    document.querySelectorAll('.post-menu').forEach(m => { if (m.id !== 'menu-' + id) m.style.display = 'none'; });
    const menu = document.getElementById('menu-' + id);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  function confirmRemovePost(id) {
    const post = SAVED.find(p => p.id === id);
    if (!post) return;
    openModal(
      'Remove post?',
      'This will remove the post from your saved list.',
      () => { SAVED = SAVED.filter(p => p.id !== id); renderSaved(); }
    );
  }

  function renderSaved() {
    const count = document.getElementById('saved-count');
    if (count) count.textContent = SAVED.length + '/10';
    renderPosts('saved-container', SAVED);
  }

  function renderHistory() {
    renderItems(HISTORY, currentView.history, 'history-container');
  }

  function renderContinue() {
    if (!window.LibraryCard) return;
    const start = (contPage - 1) * CONT_PAGE_SIZE;
    LibraryCard.renderContinue('continue-row', CONTINUE.slice(start, start + CONT_PAGE_SIZE));
    const row = document.getElementById('continue-row');
    if (!row) return;
    Array.from(row.children).forEach((card, i) => {
      const s = CONTINUE[start + i];
      if (!s) return;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => { location.href = storyHref(s); });
    });
  }

  /* ── Promo slider (shared component; slides + on/off controlled via marketing ad-manager) ── */
  function initPromoSlider() {
    var mount = document.getElementById('libPromoMount');
    var row = mount ? mount.closest('.promo-row') : null;
    if (!PROMO.length || !window.DroboardPromoSlider) { if (row) row.style.display = 'none'; return; }
    if (row) row.style.display = '';
    DroboardPromoSlider.mount('#libPromoMount', { slides: PROMO.slice(0, 5), interval: 3200 });
  }

  /* ── Static header/decorative icons ── */
  function renderHeader() {
    const search = document.getElementById('search-btn');
    if (search && !search.innerHTML) search.innerHTML = icon('search', { size: 18 });
    const bell = document.getElementById('bell-btn');
    if (bell && !bell.innerHTML) bell.innerHTML = icon('bell', { size: 19 }) + '<span class="badge-dot"></span>';
    const gift = document.getElementById('gift-btn');
    if (gift && !gift.innerHTML) gift.innerHTML = icon('gift', { size: 19 });
  }
  function renderQuickIcons() {
    const ic = document.getElementById('empty-ic');
    if (ic && !ic.innerHTML) ic.innerHTML = icon('download', { size: 28 });
    const btn = document.getElementById('empty-btn');
    if (btn && !btn.querySelector('svg')) btn.innerHTML = icon('compass', { size: 14, color: '#fff' }) + ' Browse Stories';
  }
  function renderViewToggleIcons() {
    const bl = document.getElementById('btn-list');
    if (bl && !bl.innerHTML) bl.innerHTML = icon('list', { size: 15 });
    const bg = document.getElementById('btn-grid');
    if (bg && !bg.innerHTML) bg.innerHTML = icon('grid', { size: 15 });
    document.querySelectorAll('#saved-toggle .view-btn, #history-toggle .view-btn').forEach(btn => {
      if (!btn.innerHTML) btn.innerHTML = icon(btn.dataset.view === 'list' ? 'list' : 'grid', { size: 15 });
    });
  }

  /* ── Events ── */
  function initTabs() {
    document.querySelectorAll('#main-tabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#main-tabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + t.dataset.panel).classList.add('active');
      });
    });
  }
  function initFilters() {
    document.querySelectorAll('#filter-row .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#filter-row .filter-chip').forEach(x => x.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        libPage = 1;
        renderLibrary();
      });
    });
  }
  function initViewToggles() {
    document.querySelectorAll('#view-toggle .view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-toggle .view-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        currentView.reading = btn.dataset.view;
        libPage = 1;
        renderLibrary();
      });
    });
    document.querySelectorAll('#history-toggle .view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#history-toggle .view-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        currentView.history = btn.dataset.view;
        renderHistory();
      });
    });
  }
  function initPagination() {
    const el = document.getElementById('lib-pagination');
    if (!el) return;
    el.addEventListener('click', e => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.classList.contains('disabled')) return;
      const p = btn.dataset.page;
      const totalPages = Math.max(1, Math.ceil(getFilteredLibrary().length / LIB_PAGE_SIZE));
      if (p === 'prev') { if (libPage > 1) libPage--; }
      else if (p === 'next') { if (libPage < totalPages) libPage++; }
      else libPage = parseInt(p, 10);
      renderLibrary();
    });
    const contEl = document.getElementById('cont-pagination');
    if (contEl) contEl.addEventListener('click', e => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.classList.contains('disabled')) return;
      const p = btn.dataset.page;
      const totalPages = Math.max(1, Math.ceil(CONTINUE.length / CONT_PAGE_SIZE));
      if (p === 'prev') { if (contPage > 1) contPage--; }
      else if (p === 'next') { if (contPage < totalPages) contPage++; }
      else contPage = parseInt(p, 10);
      renderContinue();
    });
  }

  let pendingAction = null;

  function initModal() {
    const modal = document.getElementById('lb-clear-modal');
    if (!modal) return;
    const cancelBtn = document.getElementById('lb-clear-cancel');
    const confirmBtn = document.getElementById('lb-clear-confirm');
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (pendingAction) pendingAction();
      closeModal();
    });
  }

  function openModal(title, sub, action) {
    const modal = document.getElementById('lb-clear-modal');
    const titleEl = document.getElementById('lb-clear-title');
    const subEl = document.getElementById('lb-clear-sub');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
    pendingAction = action;
    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('lb-clear-modal').classList.remove('open');
    pendingAction = null;
  }

  function initHistoryClear() {
    const clearBtn = document.getElementById('history-clear');
    if (!clearBtn) return;
    clearBtn.addEventListener('click', () => {
      const n = HISTORY.length;
      if (!n) return;
      openModal(
        `Clear ${n} ${n === 1 ? 'story' : 'stories'}?`,
        `This will remove ${n} ${n === 1 ? 'story' : 'stories'} from your history. Can't be undone.`,
        () => { HISTORY = []; renderHistory(); }
      );
    });
  }

  function initSavedClear() {
    const clearBtn = document.getElementById('saved-clear');
    if (!clearBtn) return;
    clearBtn.addEventListener('click', () => {
      const n = SAVED.length;
      if (!n) return;
      openModal(
        `Clear ${n} ${n === 1 ? 'post' : 'posts'}?`,
        `This will remove ${n} ${n === 1 ? 'post' : 'posts'} from your saved. Can't be undone.`,
        () => { SAVED = []; renderSaved(); }
      );
    });
  }

  function initContViewAll() {
    const btn = document.getElementById('cont-viewall');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!window.BrowseOverlay) return;
      const stories = CONTINUE.map(s => ({
        id: s.id,
        title: s.title,
        author: s.author || '',
        img: s.img || s.cover || '',
        genre: s.genre || 'fiction',
        badge: s.badge || '',
        rating: s.rating || '',
        chapters: s.chapters || '',
        preview: s.preview || (s.ch ? s.ch + ' · ' + (s.pct || 0) + '%' : ''),
      }));
      BrowseOverlay.configure({
        stories,
        onOpenStory: s => { location.href = 'bridge.html?id=' + encodeURIComponent(s.id || ''); },
      });
      BrowseOverlay.open({ title: 'Continue Reading', mode: 'section' });
    });
  }
  function initNavButtons() {
    const bell = document.getElementById('bell-btn');
    if (bell) bell.addEventListener('click', () => { location.href = 'notifications.html'; });
    const gift = document.getElementById('gift-btn');
    if (gift) gift.addEventListener('click', () => { location.href = 'store.html'; });
    const empty = document.getElementById('empty-btn');
    if (empty) empty.addEventListener('click', () => { location.href = 'discover.html'; });
  }

  const THEME_KEY = 'droboardTheme';
  function applyThemeIcon(t) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = t === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
  function initTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    applyThemeIcon(t);
  }
  function toggleTheme() {
    const html = document.documentElement;
    const next = (html.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    applyThemeIcon(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    if (window.DroboardSearch) DroboardSearch.setTheme(next);
    if (window.DroboardNav) DroboardNav.setTheme(next);
  }
  /* ── Guest gate: a visitor with no account has no library ──────
     Show the sign-in CTA + story recommendations instead of an empty
     shelf (component/guest-gate.js). */
  function renderGuestGate() {
    const tabs = document.getElementById('main-tabs');
    if (tabs) tabs.style.display = 'none';
    const sk = document.getElementById('loadingState');
    if (sk) sk.style.display = 'none';
    document.querySelectorAll('#content .panel').forEach(p => { p.style.display = 'none'; });
    if (!window.DroboardGuestGate) return;
    DroboardGuestGate.mount({
      anchor: '#loadingState',
      variant: 'library',
      cta: [
        { label: 'Log in', href: (window.AuthSession && AuthSession.loginUrl) ? AuthSession.loginUrl('library.html') : 'login.html', primary: true, icon: 'fa-right-to-bracket' },
        { label: 'Create account', href: 'signup.html', icon: 'fa-user-plus' },
      ],
    });
  }

  async function init() {
    initTheme();
    if (window.DroboardNav) DroboardNav.configure({ active: 'library' });
    renderHeader();
    renderQuickIcons();
    renderViewToggleIcons();

    // No account → no library. Show the gate and stop here.
    if (window.AuthSession && AuthSession.isGuest && AuthSession.isGuest()) {
      renderGuestGate();
      return;
    }

    try {
      const d = window.LibraryData;
      if (!d) throw new Error('LibraryData is not defined — check services/library-service.js');
      const [stats, promo, cont, lib, saved, hist] = await Promise.all([
        d.getStats(), d.getPromoSlides(), d.getContinueReading(),
        d.getLibrary(), d.getSaved(), d.getHistory(),
      ]);
      renderStats(stats);
      PROMO = promo; CONTINUE = cont; LIBRARY = lib; SAVED = saved; HISTORY = hist;
      if (window.AdService) {
        try {
          const placement = await AdService.getPlacement('library');
          if (placement.promoSlider === false) PROMO = [];
        } catch (e) {}
      }
    } catch (err) {
      console.error('[library] init() failed:', err);
    }
    if (window.DroboardSearch) {
      let searchData;
      if (window.SearchIndex) { try { searchData = await SearchIndex.build(); } catch (e) {} }
      DroboardSearch.configure({
        data: searchData,
        onOpenStory: (s) => { location.href = 'bridge.html?id=' + encodeURIComponent((s && s.id) || ''); },
        onOpenWriter: (w) => { location.href = 'profile.html?u=' + encodeURIComponent(((w && (w.handle || w.name)) || '').replace('@', '')); },
        onOpenDebate: (d) => { location.href = 'discussion.html?id=' + encodeURIComponent((d && d.id) || ''); },
      });
    }
    renderContinue();
    initPromoSlider();
    renderLibrary();
    renderSaved();
    renderHistory();
    initTabs();
    initFilters();
    initViewToggles();
    initPagination();
    initModal();
    initHistoryClear();
    initSavedClear();
    initNavButtons();
  }

  window.LibraryPage = { init, toggleTheme };
  window.togglePostMenu = togglePostMenu;
  window.confirmRemovePost = confirmRemovePost;
})();