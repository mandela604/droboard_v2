/* ═══════════════════════════════════════════════════════════════
   BOOK DETAILS SERVICE (story landing page)
   HTML calls BookDetailsPage.init(). LIVE ONLY: the story, its
   chapters, the reviews grid and the more-like-this row all come
   from the backend:
     GET /api/books/:id            → story + chapters + writer + similar
     GET /api/stories/:id/ratings  → reader reviews (paginated)
   On API failure the page shows its explicit empty-state with the
   failure message — no demo assembly anywhere.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';
  const THEME_KEY = 'droboardTheme';

  let STORY = null;

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
  function fmtN(n) { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1e3).toFixed(1) + 'k' : String(n); }
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

  /* ── Live fetch ── */
  async function fetchStory(id) {
    const res = await fetch(`${API_BASE}/books/${encodeURIComponent(id)}`, { credentials: 'include' });
    let j = null;
    try { j = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const detail = (j && (j.error || j.message)) || '';
      throw new Error('Story not found (' + res.status + ')' + (detail ? ' — ' + detail : ''));
    }
    return normalizeStory(j);
  }

  // GET /api/books/:id → page shape. No synthesis: missing fields stay
  // empty and the renderers show honest empty states.
  function normalizeStory(b) {
    if (!b) return null;
    const w = b.writer || {};
    const stats = b.stats || {};
    const rows = Array.isArray(b.chapters) ? b.chapters : [];
    return {
      id: b.id, title: b.title || 'Untitled', cover: b.cover || '',
      cat: b.genre || '',
      author: w.name || w.username || '', authorHandle: w.username || '',
      tagline: b.synopsis || '', status: b.status || 'ongoing',
      reads: fmtN(stats.reads || 0), likes: fmtN(stats.likes || 0),
      rating: stats.rating ? stats.rating.toFixed ? Number(stats.rating).toFixed(1) : String(stats.rating) : '—',
      comments: stats.comments ? fmtN(stats.comments) : '',
      saves: '',
      chapters: rows.map(c => ({
        id: c.id, num: c.n, title: c.title || ('Chapter ' + c.n),
        date: c.words ? Math.max(1, Math.round(c.words / 200)) + ' min read' : '',
        reads: c.views || 0,
        locked: (c.price || 0) > 0,
      })),
      similar: (b.similar || []).map(x => ({
        id: x.id, title: x.title || '', cover: x.cover || '',
      })),
    };
  }

  /* ── Reviews — GET /api/stories/:id/ratings (paginated BookRating rows) ── */
  function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 604800) return Math.round(s / 86400) + 'd ago';
    return Math.round(s / 604800) + 'w ago';
  }
  async function fetchReviews() {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(STORY.id)}/ratings?limit=6&sort=helpful`, { credentials: 'include' });
    if (!res.ok) throw new Error('Reviews failed (' + res.status + ')');
    const j = await res.json();
    return j.items || [];
  }
  function renderReviews(revs) {
    const el = document.getElementById('revList');
    if (!el) return;
    if (!revs.length) { el.innerHTML = `<div class="panel-empty"><i class="fas fa-star"></i>No reviews yet.</div>`; return; }
    el.innerHTML = revs.map(r => `
      <div class="rev-card">
        <div class="rev-head">
          <div class="rev-av">${esc((r.name || '?')[0].toUpperCase())}</div>
          <div class="rev-info">
            <div class="rev-name">${esc(r.name || '')}</div>
            <div class="rev-time">${esc(timeAgo(r.createdAt || Date.now()))}</div>
          </div>
          <div class="rev-stars">${'★'.repeat(r.stars || 0)}${'☆'.repeat(5 - (r.stars || 0))}</div>
        </div>
        <div class="rev-text">${esc(r.text || '')}</div>
        <div class="rev-foot"><i class="far fa-thumbs-up"></i> Helpful (${esc(String(r.helpful || 0))})</div>
      </div>`).join('');
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
      ['Genre', s.cat || '—'],
      ['Chapters', String((s.chapters || []).length)],
    ];
    if (s.comments) rows.push(['Comments', s.comments]);
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
  function renderMore() {
    const items = STORY.similar || [];
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
    if (!STORY) return;
    location.href = 'bridge.html?id=' + encodeURIComponent(STORY.id);
  }
  function openSave() {
    if (!STORY || !window.openSaveModal) { toast('Save unavailable'); return; }
    openSaveModal({
      title: STORY.title, sub: STORY.author ? 'by ' + STORY.author : 'DroBoard',
      img: STORY.cover, storyId: STORY.id,
    });
  }
  function openShare() {
    if (!STORY || !window.openShareModal) { toast('Share unavailable'); return; }
    openShareModal({
      title: STORY.title, sub: STORY.author ? 'by ' + STORY.author : 'DroBoard',
      img: STORY.cover, url: 'https://droboard.app/story/' + STORY.id,
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
    let failMsg = '';
    try {
      STORY = await fetchStory(id || '');
    } catch (err) {
      console.error('[book-details] init() failed:', err);
      STORY = null;
      failMsg = (err && err.message) || 'Failed to load story.';
    }
    document.getElementById('loadingState').style.display = 'none';
    if (!STORY) {
      // Explicit error empty-state carrying the backend failure message —
      // demo content is never substituted.
      const empty = document.getElementById('emptyState');
      if (empty) empty.innerHTML = '<i class="fas fa-exclamation-circle" style="font-size:28px;display:block;margin-bottom:10px;color:var(--acc,#ff0050)"></i>Could not load this story — ' + esc(failMsg);
      document.getElementById('emptyState').style.display = 'block';
      return;
    }
    document.getElementById('detailsRoot').style.display = 'block';
    renderHero(STORY);
    renderSynopsis(STORY);
    renderChapters(STORY);
    renderDetails(STORY);
    renderAuthor(STORY);
    renderMore();
    fetchReviews().then(renderReviews).catch(err => {
      const el = document.getElementById('revList');
      if (el) el.innerHTML = `<div class="panel-empty"><i class="fas fa-exclamation-circle"></i>Could not load reviews — ${esc((err && err.message) || 'request failed')}</div>`;
    });
    window.onDroboardSaveChange = function (storyId, saved) {
      if (String(storyId) === String(STORY.id)) toast(saved ? 'Saved to library' : 'Removed from library');
    };
  }

  window.BookDetailsPage = { init, toast, toggleTheme, goReader, openSave, openShare, toggleSyn };
})();
