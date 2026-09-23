/* ═══════════════════════════════════════════════════════════════
   BOOK DETAILS SERVICE (series landing page)
   HTML calls BookDetailsPage.init(). Demo assembles from
   central-demo-data.js SERIES (+ profile books for writer catalogs).
   When going live: set USE_API = true, point API_BASE at the backend.
   API contract: GET /api/series/:id → normalized series record.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';
  const THEME_KEY = 'droboardTheme';

  let SERIES = null;

  function toast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 2200);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* ── Theme ── */
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
  }

  /* ── Demo assembly ── */
  function profileBooks() {
    const out = [];
    try {
      const seed = window.ProfileDemoSeed;
      if (!seed || !seed.DEMO_PROFILES) return out;
      Object.keys(seed.DEMO_PROFILES).forEach(handle => {
        const p = seed.DEMO_PROFILES[handle];
        (p.books || []).forEach(b => out.push({
          id: b.id, title: b.title, cover: b.cover, cat: b.cat,
          author: p.name, authorHandle: p.handle,
          reads: b.reads, likes: b.likes, rating: b.rating,
          chapterCount: b.chapters, source: 'profile',
        }));
      });
    } catch (e) {}
    return out;
  }
  function synthChapters(book) {
    const n = Math.max(1, +book.chapterCount || 1);
    const list = [];
    for (let i = 1; i <= n; i++) {
      list.push({
        id: book.id + '_ch' + i, num: i,
        title: 'Chapter ' + i,
        date: 'Ch. ' + i + ' of ' + n,
        reads: 0, locked: i > 3,
      });
    }
    return list;
  }
  function normalizeSeries(rec) {
    if (!rec) return null;
    if (rec.source === 'profile') {
      return {
        id: rec.id, title: rec.title, cover: rec.cover, cat: rec.cat,
        author: rec.author, authorHandle: rec.authorHandle,
        tagline: '', status: 'ongoing', seasons: 1,
        reads: rec.reads || '0', likes: rec.likes || '0',
        rating: rec.rating || '—', comments: '', saves: '',
        chapters: synthChapters(rec),
      };
    }
    return {
      id: rec.id, title: rec.title, cover: rec.cover, cat: rec.cat,
      author: rec.author || rec.authorName || '', authorHandle: rec.authorHandle || rec.author || '',
      tagline: rec.tagline || rec.desc || '', status: rec.status || 'ongoing',
      seasons: rec.seasons || 1,
      reads: rec.reads || '0', likes: rec.likes || '0',
      rating: rec.rating || '—', comments: rec.comments || '', saves: rec.saves || '',
      chapters: (rec.chapters || []).map(c => ({
        id: c.id, num: c.num, title: c.title, date: c.date,
        reads: c.reads || 0, locked: c.status !== 'published',
      })),
    };
  }
  function findDemo(id) {
    const d = window.DemoData || {};
    const hit = (d.SERIES || []).find(s => String(s.id) === String(id));
    if (hit) return normalizeSeries(hit);
    const pb = profileBooks().find(b => String(b.id) === String(id));
    if (pb) return normalizeSeries(pb);
    return normalizeSeries((d.SERIES || [])[0]);
  }
  async function fetchSeries(id) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/series/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('Series API failed');
      return normalizeSeries(await res.json());
    }
    await new Promise(r => setTimeout(r, 120));
    return findDemo(id);
  }
  function demoReviews() {
    const d = window.DemoData || {};
    return ((d.COMMENTS || []).slice(0, 3)).map(c => ({
      name: c.name, avatar: c.avatar, time: c.time,
      text: c.text, likes: c.likes,
    }));
  }
  function moreLike() {
    const d = window.DemoData || {};
    return (d.SERIES || []).filter(s => !SERIES || String(s.id) !== String(SERIES.id)).slice(0, 4);
  }

  /* ── Render ── */
  function statusLabel(s) {
    return { ongoing: 'Ongoing', completed: 'Completed', paused: 'Paused' }[s] || 'Ongoing';
  }
  function renderHero(s) {
    document.getElementById('heroBg').style.backgroundImage = `url('${s.cover || ''}')`;
    document.getElementById('sdCover').src = s.cover || '';
    document.getElementById('sdCover').alt = s.title || '';
    document.getElementById('statusBadge').textContent = statusLabel(s.status);
    document.getElementById('statusBadge').className = 'status-badge ' + (s.status || 'ongoing');
    document.getElementById('sdTitle').textContent = s.title || '';
    document.getElementById('tbTitle').textContent = s.title || 'Details';
    document.title = (s.title || 'Details') + ' · DroBoard';
    const by = document.getElementById('sdAuthor');
    if (s.author) {
      by.innerHTML = `by <a href="profile.html?u=${encodeURIComponent(s.authorHandle || s.author)}">${esc(s.author)}</a>`;
      by.style.display = 'block';
    } else by.style.display = 'none';
    document.getElementById('sdGenre').textContent = s.cat || '';
    document.getElementById('statReads').textContent = s.reads || '0';
    document.getElementById('statLikes').textContent = s.likes || '0';
    document.getElementById('statRating').textContent = s.rating || '—';
    document.getElementById('statChapters').textContent = (s.chapters || []).length;
  }
  function renderSynopsis(s) {
    const text = s.tagline || 'No synopsis yet.';
    const el = document.getElementById('synText');
    el.textContent = text;
    el.classList.remove('open');
    document.getElementById('synBtn').style.display = text.length > 140 ? 'flex' : 'none';
  }
  function toggleSyn() { document.getElementById('synText').classList.toggle('open'); }
  function renderChapters(s) {
    const list = s.chapters || [];
    document.getElementById('chCount').textContent = list.length + (list.length === 1 ? ' chapter' : ' chapters');
    const el = document.getElementById('chList');
    if (!list.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-book-open"></i>No chapters yet.</div>`; return; }
    el.innerHTML = list.map(c => `
      <div class="ch-row" data-ch="${c.num}">
        <div class="ch-num">${c.num}</div>
        <div class="ch-info">
          <div class="ch-title">${esc(c.title)}</div>
          <div class="ch-meta">${esc(c.date || '')}${c.reads ? ' · ' + esc(String(c.reads)) + ' reads' : ''}</div>
        </div>
        <div class="ch-go">${c.locked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-chevron-right"></i>'}</div>
      </div>`).join('');
    el.querySelectorAll('.ch-row').forEach(row => row.addEventListener('click', () => {
      location.href = 'bridge.html?id=' + encodeURIComponent(s.id);
    }));
  }
  function renderDetails(s) {
    const rows = [
      ['Status', statusLabel(s.status)],
      ['Seasons', String(s.seasons || 1)],
      ['Genre', s.cat || '—'],
      ['Chapters', String((s.chapters || []).length)],
    ];
    if (s.comments) rows.push(['Comments', s.comments]);
    if (s.saves) rows.push(['Saved by', s.saves]);
    document.getElementById('detGrid').innerHTML = rows.map(([k, v]) =>
      `<div class="det-item"><div class="det-k">${k}</div><div class="det-v">${esc(v)}</div></div>`
    ).join('');
  }
  function renderAuthor(s) {
    const el = document.getElementById('authorCard');
    if (!s.author) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `
      <div class="au-av">${esc((s.author || '?')[0].toUpperCase())}</div>
      <div class="au-info">
        <div class="au-name">${esc(s.author)}</div>
        <div class="au-sub">Author</div>
      </div>
      <div class="au-go"><i class="fas fa-chevron-right"></i></div>`;
    el.addEventListener('click', () => {
      location.href = 'profile.html?u=' + encodeURIComponent(s.authorHandle || s.author);
    }, { once: true });
  }
  function renderReviews() {
    const revs = demoReviews();
    const el = document.getElementById('revList');
    if (!revs.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-star"></i>No reviews yet.</div>`; return; }
    el.innerHTML = revs.map(r => `
      <div class="rev-card">
        <div class="rev-head">
          <div class="rev-av">${esc((r.name || '?')[0].toUpperCase())}</div>
          <div class="rev-info">
            <div class="rev-name">${esc(r.name || '')}</div>
            <div class="rev-time">${esc(r.time || '')}</div>
          </div>
        </div>
        <div class="rev-text">${esc(r.text || '')}</div>
        <div class="rev-foot"><i class="far fa-thumbs-up"></i> Helpful (${esc(String(r.likes || 0))})</div>
      </div>`).join('');
  }
  function renderMore() {
    const items = moreLike();
    const sec = document.getElementById('moreSec');
    if (!items.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    document.getElementById('moreRow').innerHTML = items.map(s => `
      <div class="more-card" data-id="${esc(s.id)}">
        <div class="more-cover"><img src="${esc(s.cover || '')}" loading="lazy" alt=""/></div>
        <div class="more-title">${esc(s.title)}</div>
      </div>`).join('');
    document.querySelectorAll('.more-card').forEach(c => c.addEventListener('click', () => {
      location.href = 'book-details.html?id=' + encodeURIComponent(c.dataset.id);
    }));
  }

  /* ── Actions ── */
  function goReader() {
    if (!SERIES) return;
    location.href = 'bridge.html?id=' + encodeURIComponent(SERIES.id);
  }
  function openSave() {
    if (!SERIES || !window.openSaveModal) { toast('Save unavailable'); return; }
    openSaveModal({
      title: SERIES.title, sub: SERIES.author ? 'by ' + SERIES.author : 'DroBoard',
      img: SERIES.cover, storyId: SERIES.id,
    });
  }
  function openShare() {
    if (!SERIES || !window.openShareModal) { toast('Share unavailable'); return; }
    openShareModal({
      title: SERIES.title, sub: SERIES.author ? 'by ' + SERIES.author : 'DroBoard',
      img: SERIES.cover, url: 'https://droboard.app/series/' + SERIES.id,
    });
  }

  /* ── Boot ── */
  async function init() {
    initTheme();
    window.toast = toast;
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    document.getElementById('synBtn').addEventListener('click', toggleSyn);
    document.getElementById('btnRead').addEventListener('click', goReader);
    document.getElementById('btnLib').addEventListener('click', openSave);
    document.getElementById('btnShare').addEventListener('click', openShare);
    try {
      SERIES = await fetchSeries(id || '');
    } catch (err) {
      console.error('[book-details] init() failed:', err);
      SERIES = null;
    }
    document.getElementById('loadingState').style.display = 'none';
    if (!SERIES) { document.getElementById('emptyState').style.display = 'block'; return; }
    document.getElementById('detailsRoot').style.display = 'block';
    renderHero(SERIES);
    renderSynopsis(SERIES);
    renderChapters(SERIES);
    renderDetails(SERIES);
    renderAuthor(SERIES);
    renderReviews();
    renderMore();
    window.onDroboardSaveChange = function (storyId, saved) {
      if (String(storyId) === String(SERIES.id)) toast(saved ? 'Saved to library' : 'Removed from library');
    };
  }

  window.BookDetailsPage = { init, toast, toggleTheme, goReader, openSave, openShare, toggleSyn };
})();
