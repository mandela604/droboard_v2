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
    return (d.SAVED || []).map(s => ({
      ...s,
      img: s.img || s.cover,
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

  let CONTINUE = [], PROMO = [], LIBRARY = [], SAVED = [], HISTORY = [];
  let currentView = { reading: 'grid', saved: 'grid', history: 'grid' };
  let currentFilter = 'all';
  let libPage = 1;
  const LIB_PAGE_SIZE = 6;

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

  function renderSaved() {
    const count = document.getElementById('saved-count');
    if (count) count.textContent = SAVED.length + ' stories';
    renderItems(SAVED, currentView.saved, 'saved-container');
  }

  function renderHistory() {
    renderItems(HISTORY, currentView.history, 'history-container');
  }

  function renderContinue() {
    if (!window.LibraryCard) return;
    LibraryCard.renderContinue('continue-row', CONTINUE);
    const row = document.getElementById('continue-row');
    if (!row) return;
    Array.from(row.children).forEach((card, i) => {
      const s = CONTINUE[i];
      if (!s) return;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => { location.href = storyHref(s); });
    });
  }

  /* ── Promo slider ── */
  let promoIndex = 0, promoTimer = null;
  function renderPromo() {
    const track = document.getElementById('promo-track');
    const dots = document.getElementById('promo-dots');
    const slider = document.getElementById('promo-slider');
    if (!track || !dots) return;
    const slides = PROMO.slice(0, 5);
    if (slider) slider.style.display = slides.length ? '' : 'none';
    if (!slides.length) return;
    track.innerHTML = slides.map(s => `
      <div class="promo-slide" style="background-image:url('${s.img || s.cover || ''}')">
        <div class="promo-scrim"></div>
        <div class="promo-text">
          <div class="promo-eyebrow">Promoted</div>
          <div class="promo-title">${s.title}</div>
          <div class="promo-author">by ${s.author}</div>
        </div>
        <div class="promo-cta">${s.cta}</div>
      </div>`).join('');
    dots.innerHTML = slides.map((_, i) => `<div class="promo-dot${i === 0 ? ' on' : ''}"></div>`).join('');
    Array.from(track.children).forEach((slide, i) => {
      slide.addEventListener('click', () => { location.href = storyHref(slides[i]); });
    });
  }
  function goToPromoSlide(i) {
    const slides = document.querySelectorAll('.promo-slide');
    if (!slides.length) return;
    promoIndex = (i + slides.length) % slides.length;
    document.getElementById('promo-track').style.transform = `translateX(-${promoIndex * 100}%)`;
    document.querySelectorAll('.promo-dot').forEach((d, idx) => d.classList.toggle('on', idx === promoIndex));
  }
  function stopPromoAutoplay() { if (promoTimer) clearInterval(promoTimer); }
  function startPromoAutoplay() { stopPromoAutoplay(); promoTimer = setInterval(() => goToPromoSlide(promoIndex + 1), 3200); }
  function initPromoSlider() {
    renderPromo();
    goToPromoSlide(0);
    startPromoAutoplay();
    const slider = document.getElementById('promo-slider');
    if (!slider) return;
    slider.addEventListener('touchstart', stopPromoAutoplay, { passive: true });
    slider.addEventListener('touchend', startPromoAutoplay, { passive: true });
    slider.addEventListener('mouseenter', stopPromoAutoplay);
    slider.addEventListener('mouseleave', startPromoAutoplay);
    let startX = 0, deltaX = 0, dragging = false;
    slider.addEventListener('touchstart', e => { dragging = true; startX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchmove', e => { if (dragging) deltaX = e.touches[0].clientX - startX; }, { passive: true });
    slider.addEventListener('touchend', () => {
      if (Math.abs(deltaX) > 40) goToPromoSlide(promoIndex + (deltaX < 0 ? 1 : -1));
      dragging = false; deltaX = 0;
    });
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
    document.querySelectorAll('#saved-toggle .view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#saved-toggle .view-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        currentView.saved = btn.dataset.view;
        renderSaved();
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
  async function init() {
    initTheme();
    if (window.DroboardNav) DroboardNav.configure({ active: 'library' });
    renderHeader();
    renderQuickIcons();
    renderViewToggleIcons();
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
    initNavButtons();
  }

  window.LibraryPage = { init, toggleTheme };
})();