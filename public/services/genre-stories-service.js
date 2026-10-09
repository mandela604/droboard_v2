/* ═══════════════════════════════════════════════════════════════
   GENRE STORIES SERVICE
   Full-page story list for a genre. HTML calls GenreStoriesPage.init().
   Call-and-render only: init() parses ?genre=, calls API, renders cards.
   Swap USE_API to true when backend is live — no other change needed.
   API: GET /api/genres/:slug/stories?sort=top|new|rising&page=&limit=
   top = most reads. new = newest books. rising = reads velocity
   (reads per day since creation). Fully automatic, no manual picks.
   Demo fallback mirrors the same three orders.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/genres';
  const PAGE_SIZE = 10;

  let GENRE_SLUG = 'fantasy';
  let GENRE_NAME = 'Fantasy';
  let sort = 'top';
  let page = 1;
  let total = 0;
  let items = [];

  const SORT_TO_API = { top: 'top', new: 'new', rising: 'rising' };

  async function callBackend(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error('api_' + res.status);
    return res.json();
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── Demo fallback (fake, same card shape as API) ── */
  function demoPool() {
    const seed = window.GenreDemoSeed;
    const demo = window.DemoData;
    const base = (seed && seed.DEMO_STORIES && (seed.DEMO_STORIES[GENRE_SLUG] || seed.DEMO_STORIES.fantasy)) || [];
    const extra = (demo && demo.STORIES) || [];
    const pool = base.concat(
      extra.slice(0, 12).map((s, i) => ({
        id: 'demo-' + GENRE_SLUG + '-' + i,
        title: s.title || ('Untitled ' + (i + 1)),
        author: s.author || s.writer || 'Droboard',
        cover: s.cover || s.img || '',
        reads: s.reads || ((900 - i * 57) + 'k'),
        rating: s.rating || (4.9 - (i % 5) * 0.1).toFixed(1),
      }))
    );
    // Expand to 10 rows so Top-10 demo is real.
    const out = [];
    for (let i = 0; i < 10; i++) {
      const b = pool[i % Math.max(pool.length, 1)] || { title: 'Untitled ' + (i + 1) };
      out.push({
        id: b.id || ('g-' + GENRE_SLUG + '-' + i),
        title: b.title || ('Untitled ' + (i + 1)),
        author: b.author || 'Droboard',
        genre: GENRE_NAME,
        cover: b.cover || b.img || '',
        img: b.cover || b.img || '',
        reads: b.reads || ((1000 - i * 63) + 'k'),
        likes: b.likes || (4200 - i * 311),
        rating: b.rating || (4.9 - (i % 4) * 0.1).toFixed(1),
        chapters: b.chapters || b.ch || (12 - (i % 5)),
        ch: b.chapters || b.ch || (12 - (i % 5)),
        status: i < 2 ? 'ongoing' : (i % 3 === 0 ? 'completed' : 'ongoing'),
        _rank: i,
        _fresh: i % 3,
      });
    }
    return out;
  }

  function demoFetch() {
    const pool = demoPool();
    const sorted = pool.slice();
    if (sort === 'new') sorted.sort((a, b) => a._fresh - b._fresh || a._rank - b._rank);
    else if (sort === 'rising') sorted.sort((a, b) => (b.likes % 997) - (a.likes % 997));
    // top: keep seed order (already reads-descending)
    total = sorted.length;
    return { items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total };
  }

  /* ── Fetch (call) ── */
  async function fetchStories() {
    if (USE_API) {
      const apiSort = SORT_TO_API[sort] || 'reads';
      const data = await callBackend(
        API_BASE + '/' + encodeURIComponent(GENRE_SLUG) +
        '/stories?sort=' + apiSort + '&page=' + page + '&limit=' + PAGE_SIZE
      );
      return { items: data.items || [], total: data.total || 0, genre: data.genre || null };
    }
    return demoFetch();
  }

  function resolveGenre() {
    const params = new URLSearchParams(location.search);
    const raw = (params.get('genre') || 'fantasy').toLowerCase();
    GENRE_SLUG = raw;
    const seed = window.GenreDemoSeed;
    if (seed && seed.DEMO_GENRES && seed.DEMO_GENRES[raw]) {
      GENRE_NAME = seed.DEMO_GENRES[raw].name || raw;
    } else {
      GENRE_NAME = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
  }

  /* ── Render ── */
  function renderHeader() {
    document.getElementById('pageTitle').textContent = GENRE_NAME + ' Stories';
    const label = sort === 'top' ? 'Top 10' : (sort === 'new' ? 'New' : 'Rising');
    document.getElementById('pageSub').textContent = label + ' in ' + GENRE_NAME;
    document.querySelectorAll('#sortRow .sort-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.sort === sort);
    });
  }

  function cardHTML(s, rank) {
    if (window.DroboardBookCard) {
      return window.DroboardBookCard.render({
        id: s.id, title: s.title, genre: s.genre || GENRE_NAME,
        cover: s.cover || s.img || '', img: s.cover || s.img || '',
        reads: s.reads, likes: s.likes, chapters: s.chapters || s.ch,
        status: s.status || 'ongoing',
      });
    }
    return '<div class="story-row" data-id="' + esc(s.id) + '">' +
      '<span>#' + rank + ' ' + esc(s.title) + '</span></div>';
  }

  function badgeFor(rank) {
    if (sort === 'new') {
      return { text: 'NEW', bg: '#ff0050' };
    }
    if (sort === 'top') {
      return { text: String(rank), bg: '#ff0050' };
    }
    // rising: rank + momentum (change color/icon here if you want another look)
    return { text: '▲ ' + rank, bg: '#fb923c' };
  }

  function paintBadges(offset) {
    const feed = document.getElementById('feed');
    const cards = feed.querySelectorAll('.dbc-card');
    const start = offset == null ? 0 : offset;
    cards.forEach((card, ci) => {
      if (ci < start) return;
      const rank = ci + 1;
      const cover = card.querySelector('.dbc-cover');
      if (!cover) return;
      if (cover.querySelector('.gs-badge')) return;
      const b = badgeFor(rank);
      const el = document.createElement('div');
      el.className = 'gs-badge';
      el.textContent = b.text;
      el.style.cssText = 'position:absolute;' +
        (b.rank ? 'top:6px;left:6px;' : 'top:6px;right:6px;') +
        'background:' + b.bg + ';color:#fff;' +
        (b.rank
          ? 'min-width:22px;height:22px;border-radius:11px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 6px;box-shadow:0 2px 6px rgba(0,0,0,.25)'
          : 'font-size:9px;font-weight:800;padding:3px 8px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.15)');
      cover.style.position = 'relative';
      cover.appendChild(el);
    });
  }

  function render(append) {
    renderHeader();
    const feed = document.getElementById('feed');
    const offset = append ? feed.querySelectorAll('.dbc-card').length : 0;
    const html = items.map((s, i) => cardHTML(s, (page - 1) * PAGE_SIZE + i + 1)).join('');
    if (append) feed.insertAdjacentHTML('beforeend', html);
    else feed.innerHTML = html || '<div class="empty">No stories yet in ' + esc(GENRE_NAME) + '.</div>';
    const freshCards = feed.querySelectorAll('.dbc-card');
    freshCards.forEach(el => {
      if (el.dataset.gsBound) return;
      el.dataset.gsBound = '1';
      el.addEventListener('click', () => {
        const titleEl = el.querySelector('.dbc-title');
        const title = titleEl ? titleEl.textContent.trim() : '';
        const hit = items.find(x => x.title === title);
        location.href = 'bridge.html?id=' + encodeURIComponent(hit ? hit.id : title);
      });
    });
    paintBadges(append ? offset : 0);
    const moreBtn = document.getElementById('moreBtn');
    if (moreBtn) {
      const done = items.length >= total || total === 0;
      moreBtn.disabled = done;
      moreBtn.textContent = done ? 'All caught up' : 'Load more (' + items.length + '/' + total + ')';
    }
  }

  /* ── Controller ── */
  async function load(reset) {
    if (reset) { page = 1; items = []; }
    try {
      const data = await fetchStories();
      total = data.total || 0;
      if (data.genre && data.genre.name) GENRE_NAME = data.genre.name;
      const rows = data.items || [];
      items = reset ? rows : items.concat(rows);
      render(!reset);
    } catch (e) {
      toast('Could not load stories');
    }
  }

  function bind() {
    document.querySelectorAll('#sortRow .sort-chip').forEach(el => {
      el.addEventListener('click', () => {
        if (sort === el.dataset.sort) return;
        sort = el.dataset.sort;
        load(true);
      });
    });
    const moreBtn = document.getElementById('moreBtn');
    if (moreBtn) moreBtn.addEventListener('click', () => {
      if (items.length >= total) return;
      page += 1;
      load(false);
    });
    if (window.DroboardNav) DroboardNav.configure({ active: 'none' });
  }

  function init() {
    resolveGenre();
    bind();
    load(true);
  }

  window.GenreStoriesPage = { init };
})();
