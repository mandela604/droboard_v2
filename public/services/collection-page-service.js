/* ═══════════════════════════════════════════════════════════════
   COLLECTION PAGE SERVICE
   All data comes from the live API. No demo fallbacks.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  let currentCollection = null;
  let collStories = [];
  let collPage = 1;
  const COLL_PER = 10;
  let collSort = 'latest';
  let following = false;

  // In-flight GET deduplication
  const _pending = new Map();

  function collId() {
    return (currentCollection && currentCollection.id) || new URLSearchParams(location.search).get('id');
  }

  async function liveReq(method, path, body) {
    const cacheKey = method === 'GET' ? `${method}:${path}` : null;
    if (cacheKey && _pending.has(cacheKey)) return _pending.get(cacheKey);

    const promise = fetch(API_BASE + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async res => {
      if (!res.ok) throw new Error('api_' + res.status);
      return res.json();
    }).finally(() => {
      if (cacheKey) _pending.delete(cacheKey);
    });

    if (cacheKey) _pending.set(cacheKey, promise);
    return promise;
  }

  function paintFollow() {
    const btn = document.getElementById('followBtn');
    if (!btn) return;
    btn.innerHTML = following
      ? '<i class="fas fa-check"></i> Following'
      : '<i class="fas fa-plus"></i> Follow Collection';
  }

  async function syncLiveState() {
    try {
      const j = await liveReq('GET', '/collections/' + encodeURIComponent(collId()));
      if (!j || !j.id) return;
      if (typeof j.following === 'boolean') { following = j.following; paintFollow(); }
      if (j.followers != null && currentCollection) { currentCollection.followers = j.followers; renderStats(currentCollection); }
    } catch (e) {}
  }

  function renderCollPage() {
    const total = collStories.length;
    const tp = Math.max(1, Math.ceil(total / COLL_PER));
    if (collPage > tp) collPage = tp;
    const start = (collPage - 1) * COLL_PER;
    const slice = collStories.slice(start, start + COLL_PER);
    document.getElementById('storyList').innerHTML =
      slice.map(renderBookCard).join('') ||
      '<div style="padding:30px 14px;text-align:center;color:var(--gray-400)">No stories in this collection yet.</div>';
    const pager = document.getElementById('collPager');
    if (tp <= 1) { pager.innerHTML = ''; return; }
    let h = '<button class="sort-btn" data-p="prev" ' + (collPage === 1 ? 'style="opacity:.4;pointer-events:none"' : '') + '><i class="fas fa-chevron-left"></i></button>';
    for (let i = 1; i <= tp; i++) h += '<button class="sort-btn" data-p="' + i + '" style="' + (i === collPage ? 'background:var(--pink);color:#fff;border-color:var(--pink)' : '') + '">' + i + '</button>';
    h += '<button class="sort-btn" data-p="next" ' + (collPage === tp ? 'style="opacity:.4;pointer-events:none"' : '') + '><i class="fas fa-chevron-right"></i></button>';
    pager.innerHTML = h;
    pager.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.p;
      if (p === 'prev') collPage--; else if (p === 'next') collPage++; else collPage = parseInt(p);
      renderCollPage();
      document.getElementById('storyList').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function renderBookCard(story) {
    const href = `bridge.html?id=${encodeURIComponent(story.id || story.title || '')}`;
    const statusCls = (story.status || 'ongoing').toLowerCase();
    return `<a class="book-card" href="${href}" style="text-decoration:none;color:inherit">
      <div class="book-cover" style="background-image:url('${story.cover}')"></div>
      <div class="book-info">
        <div class="book-title-row"><div class="book-title">${story.title || ''}</div></div>
        <div class="book-genre">${story.cat || story.author || ''}</div>
        <div class="book-stats">
          <span class="book-stat"><i class="fas fa-eye"></i> ${story.reads || '0'}</span>
          <span class="book-stat"><i class="fas fa-heart"></i> ${story.likes || '0'}</span>
          <span class="book-stat"><i class="fas fa-book"></i> ${story.chapters || '0'} ch</span>
        </div>
        <div class="book-foot">
          <span class="status-badge ${statusCls}">${story.badge || 'Ongoing'}</span>
        </div>
      </div>
    </a>`;
  }

  async function loadCollection() {
    const colId = new URLSearchParams(location.search).get('id');
    if (!colId) {
      document.getElementById('heroSection').innerHTML =
        '<div style="padding:40px 20px;text-align:center;color:var(--tx-muted)">No collection specified.</div>';
      return;
    }

    try {
      currentCollection = await liveReq('GET', '/collections/' + encodeURIComponent(colId));
    } catch (e) {
      document.getElementById('heroSection').innerHTML =
        '<div style="padding:40px 20px;text-align:center;color:var(--tx-muted)">Collection not found.</div>';
      return;
    }

    if (!currentCollection || !currentCollection.id) {
      document.getElementById('heroSection').innerHTML =
        '<div style="padding:40px 20px;text-align:center;color:var(--tx-muted)">Collection not found.</div>';
      return;
    }

    renderHero(currentCollection);
    renderStats(currentCollection);
    renderAbout(currentCollection);
    renderCurated(currentCollection);

    if (typeof currentCollection.following === 'boolean') {
      following = currentCollection.following;
      paintFollow();
    } else {
      syncLiveState();
    }

    collStories = Array.isArray(currentCollection.storyList) ? currentCollection.storyList : [];
    renderCollPage();
    initTabs();
    initButtons();
    initReportModal();
    try { if (window.InsightsTracker) InsightsTracker.hit('collection', String(colId)); } catch (e) {}
  }

  function renderHero(col) {
    document.getElementById('heroSection').innerHTML = `
      <div class="hero-cover">
        <img src="${col.cover}" alt="${col.title} cover"/>
        <div class="hero-cover-scrim"></div>
        <div class="hero-count"><i class="fas fa-layer-group"></i> ${col.stories} STORIES</div>
      </div>
      <div class="hero-info">
        <div class="coll-pill"><i class="fas fa-layer-group"></i> COLLECTION</div>
        <div class="hero-title">${col.title}</div>
        <div class="hero-sub">${col.sub}</div>
        <div class="hero-author">
          <img class="hero-av" src="${col.authorAv}" alt="${col.author}"/>
          <span class="hero-author-name">${col.author}</span>
          ${col.verified ? '<i class="fas fa-circle-check hero-verified"></i>' : ''}
        </div>
      </div>`;
  }

  function renderStats(col) {
    document.getElementById('statsSection').innerHTML = `
      <div class="stat"><div class="stat-top"><i class="fas fa-book-open"></i>${col.stories}</div><div class="stat-label">Stories</div></div>
      <div class="stat"><div class="stat-top"><i class="fas fa-user-group"></i>${col.followers}</div><div class="stat-label">Followers</div></div>
      <div class="stat"><div class="stat-top"><i class="far fa-eye"></i>${col.visits}</div><div class="stat-label">Visits</div></div>
      <div class="stat"><div class="stat-top"><i class="fas fa-star"></i>${col.rating}</div><div class="stat-label">Rating</div></div>`;
  }

  function renderAbout(col) {
    const genreTags = (col.genres || []).map(g => `<span class="about-tag">${g}</span>`).join('');
    const panel = document.getElementById('panel-about');
    panel.innerHTML = `
      <div class="about-block">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
          <div class="about-label" style="margin-bottom:0">About this collection</div>
          <button id="editAboutBtn" style="font-size:11px;font-weight:700;color:var(--pink);background:rgba(255,0,80,.08);border:1px solid var(--pink-line);padding:5px 10px;border-radius:10px"><i class="fas fa-pen"></i> Edit</button>
        </div>
        <div class="about-text" id="aboutView">${col.about || ''}</div>
        <div id="aboutForm" style="display:none;margin-top:10px">
          <textarea id="aboutInput" rows="3" style="width:100%;background:var(--divider);border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px;resize:none;margin-bottom:10px">${col.about || ''}</textarea>
          <div class="about-label">Genres</div>
          <div id="genreChecks" style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px"></div>
          <div style="display:flex;gap:8px">
            <button id="aboutSave" style="flex:1;background:var(--pink);color:#fff;padding:10px;border-radius:10px;font-weight:700">Save</button>
            <button id="aboutCancel" style="flex:1;background:var(--divider);border:1px solid var(--line);padding:10px;border-radius:10px;font-weight:700">Cancel</button>
          </div>
        </div>
      </div>
      <div class="about-block">
        <div class="about-label">Curated by</div>
        <div class="about-text" style="display:flex;align-items:center;gap:9px">
          <img class="hero-av" src="${col.authorAv}" style="width:30px;height:30px" alt=""/>
          ${col.author} ${col.verified ? '<i class="fas fa-circle-check hero-verified"></i>' : ''}
        </div>
      </div>
      <div class="about-block">
        <div class="about-label">Genres</div>
        <div class="about-tags">${genreTags || '<span style="font-size:12px;color:var(--gray-400)">No genres yet</span>'}</div>
      </div>`;

    // Fetch genre list from API for the edit form
    liveReq('GET', '/genres?limit=50').then(data => {
      const list = Array.isArray(data) ? data : (data.items || data.genres || []);
      const names = list.map(g => g.name || g);
      const checks = document.getElementById('genreChecks');
      if (checks && names.length) {
        checks.innerHTML = names.map(g =>
          '<label style="display:inline-flex;align-items:center;gap:5px;background:var(--divider);padding:6px 10px;border-radius:16px;font-size:11.5px;font-weight:600;cursor:pointer;border:1.5px solid transparent">' +
          '<input type="checkbox" value="' + g.replace(/"/g, '&quot;') + '" ' + ((col.genres || []).includes(g) ? 'checked' : '') + ' style="accent-color:var(--pink)"> ' + g + '</label>'
        ).join('');
      }
    }).catch(() => {});

    document.getElementById('editAboutBtn').onclick = () => {
      document.getElementById('aboutForm').style.display = 'block';
      document.getElementById('aboutView').style.display = 'none';
    };
    document.getElementById('aboutCancel').onclick = () => {
      document.getElementById('aboutForm').style.display = 'none';
      document.getElementById('aboutView').style.display = 'block';
    };
    document.getElementById('aboutSave').onclick = async () => {
      const about = document.getElementById('aboutInput').value.trim();
      const genres = Array.from(document.querySelectorAll('#genreChecks input:checked')).map(i => i.value);
      try {
        await liveReq('PATCH', '/collections/' + encodeURIComponent(collId()), { about, genres });
        currentCollection.about = about;
        currentCollection.genres = genres;
        renderAbout(currentCollection);
        showToast('About updated');
      } catch (e) {
        showToast('Failed to save. Please try again.');
      }
    };
  }

  function renderCurated(col) {
    document.getElementById('curatedBanner').innerHTML = `
      <div class="curated-icon"><i class="fas fa-award"></i></div>
      <div>
        <div class="curated-title">A curated collection by ${col.author}</div>
        <div class="curated-sub">Handpicked stories full of emotion, love and unforgettable moments.</div>
      </div>`;
  }

  function initTabs() {
    document.querySelectorAll('#tabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#tabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const tab = t.dataset.tab;
        document.getElementById('panel-stories').style.display = tab === 'stories' ? 'block' : 'none';
        document.getElementById('panel-about').classList.toggle('active', tab === 'about');
      });
    });
  }

  function initButtons() {
    const followBtn = document.getElementById('followBtn');
    followBtn.addEventListener('click', async () => {
      const want = !following;
      following = want;
      paintFollow();
      try {
        const j = await liveReq(want ? 'POST' : 'DELETE', '/collections/' + encodeURIComponent(collId()) + '/follow');
        if (j && j.followers != null && currentCollection) { currentCollection.followers = j.followers; renderStats(currentCollection); }
      } catch (e) { following = !want; paintFollow(); }
    });

    function doShare() {
      if (typeof openShareModal === 'function') {
        openShareModal({ title: currentCollection.title, sub: currentCollection.sub, img: currentCollection.cover, url: location.href, contentId: collId(), contentType: 'collections' });
      } else { showToast('Share: ' + location.href); }
      liveReq('POST', '/collections/' + encodeURIComponent(collId()) + '/share', { channel: 'page' }).catch(() => {});
    }
    document.getElementById('topShareBtn')?.addEventListener('click', doShare);
    document.getElementById('bottomShareBtn')?.addEventListener('click', doShare);

    const menuDots = document.getElementById('menuDots');
    const dropdown = document.getElementById('dropdownMenu');
    menuDots.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown.classList.remove('show'));

    document.getElementById('reportBtn').addEventListener('click', () => { dropdown.classList.remove('show'); openReportModal(); });
    document.getElementById('collStatsBtn')?.addEventListener('click', () => {
      dropdown.classList.remove('show');
      location.href = 'insights.html?surface=collection&id=' + encodeURIComponent(collId());
    });
  }

  /* ── Report Modal ── */
  let selectedReason = '';

  function openReportModal() {
    selectedReason = '';
    document.querySelectorAll('.report-reason').forEach(r => r.classList.remove('selected'));
    document.getElementById('reportDetails').value = '';
    document.getElementById('reportSubmitBtn').disabled = true;
    document.getElementById('reportOverlay').classList.add('open');
  }

  function closeReportModal() {
    document.getElementById('reportOverlay').classList.remove('open');
  }

  function initReportModal() {
    document.getElementById('reportCloseBtn').addEventListener('click', closeReportModal);
    document.getElementById('reportOverlay').addEventListener('click', function (e) {
      if (e.target === this) closeReportModal();
    });

    document.querySelectorAll('.report-reason').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.report-reason').forEach(r => r.classList.remove('selected'));
        btn.classList.add('selected');
        selectedReason = btn.dataset.reason;
        document.getElementById('reportSubmitBtn').disabled = false;
      });
    });

    document.getElementById('reportSubmitBtn').addEventListener('click', async () => {
      const details = document.getElementById('reportDetails').value.trim();
      try {
        await liveReq('POST', '/reports', {
          target: 'collection', targetId: collId(),
          reason: selectedReason || 'other', details,
        });
        document.getElementById('reportBody').innerHTML = `
          <div class="report-success">
            <i class="fas fa-check-circle"></i>
            <h4>Report Submitted</h4>
            <p>Thank you for your report. Our team will review it and take appropriate action.</p>
          </div>`;
        setTimeout(closeReportModal, 2200);
      } catch (e) {
        showToast('Failed to submit report. Please try again.');
      }
    });
  }

  function showToast(msg) {
    let t = document.getElementById('collToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'collToast';
      t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;font-weight:600;z-index:999;opacity:0;transition:.3s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 2000);
  }

  /* ── Add Story ── */
  let addSelected = new Set();
  let addStories = [];

  function paintAddGrid(query) {
    const grid = document.getElementById('addStoryGrid');
    if (!grid) return;
    const q = (query || '').trim().toLowerCase();
    const hits = !q ? addStories.slice(0, 30) : addStories.filter(s =>
      ((s.title || '').toLowerCase().indexOf(q) !== -1) || ((s.author || '').toLowerCase().indexOf(q) !== -1));
    if (!addStories.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--gray-400)">No more stories to add.</div>';
    } else if (!hits.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--gray-400)">No stories match your search.</div>';
    } else {
      grid.innerHTML = hits.map(s =>
        '<div class="add-pick" data-id="' + s.id + '" style="border:2px solid transparent;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--divider)">' +
        '<img src="' + s.cover + '" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block"/>' +
        '<div style="font-size:9px;font-weight:700;padding:4px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (s.title || '') + '</div>' +
        '<div style="position:absolute;top:5px;right:5px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;opacity:0" class="pick-check"><i class="fas fa-check"></i></div></div>'
      ).join('');
      grid.querySelectorAll('.add-pick').forEach(el => {
        el.style.position = 'relative';
        const id = String(el.dataset.id);
        if (addSelected.has(id)) {
          el.style.borderColor = 'var(--pink)';
          el.querySelector('.pick-check').style.opacity = '1';
          el.querySelector('.pick-check').style.background = 'var(--pink)';
        }
        el.addEventListener('click', () => {
          if (addSelected.has(id)) {
            addSelected.delete(id); el.style.borderColor = 'transparent'; el.querySelector('.pick-check').style.opacity = '0';
          } else {
            addSelected.add(id); el.style.borderColor = 'var(--pink)'; el.querySelector('.pick-check').style.opacity = '1'; el.querySelector('.pick-check').style.background = 'var(--pink)';
          }
        });
      });
    }
  }

  async function openAddStory() {
    try {
      const res = await fetch(API_BASE + '/collections/eligible-stories', { credentials: 'include' });
      if (!res.ok) throw new Error('api_' + res.status);
      const j = await res.json();
      addStories = Array.isArray(j.items)
        ? j.items.filter(s => s.eligible !== false).map(s => ({ id: s.id, title: s.title, cover: s.cover, author: s.author || '' }))
        : [];
    } catch (e) {
      showToast('Could not load stories. Please try again.');
      return;
    }
    const existing = new Set((currentCollection?.storyList || []).map(s => String(s.id || s)));
    addStories = addStories.filter(s => !existing.has(String(s.id)));
    addSelected.clear();
    const searchEl = document.getElementById('addStorySearch');
    if (searchEl) searchEl.value = '';
    paintAddGrid('');
    document.getElementById('addStoryOverlay').classList.add('open');
  }

  function closeAddStory() { document.getElementById('addStoryOverlay').classList.remove('open'); }

  document.getElementById('addStoryBtn').addEventListener('click', () => { document.getElementById('dropdownMenu').classList.remove('show'); openAddStory(); });
  document.getElementById('addStoryClose').addEventListener('click', closeAddStory);
  document.getElementById('addStoryOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddStory(); });
  document.getElementById('addStorySearch').addEventListener('input', e => paintAddGrid(e.target.value));

  document.getElementById('addStoryConfirm').addEventListener('click', async () => {
    if (!addSelected.size) { showToast('Select at least one story'); return; }
    const ids = Array.from(addSelected);
    const fullIds = [...(currentCollection.storyList || []).map(s => s.id || s), ...ids].filter(Boolean);
    try {
      const updated = await liveReq('PATCH', '/collections/' + encodeURIComponent(collId()), { stories: fullIds });
      // Use server-returned list if available, else optimistically update
      collStories = Array.isArray(updated && updated.storyList) ? updated.storyList : fullIds.map(id => addStories.find(s => String(s.id) === String(id)) || { id });
      currentCollection.storyList = collStories;
      currentCollection.stories = collStories.length;
      collPage = Math.ceil(collStories.length / COLL_PER);
      renderCollPage();
      closeAddStory();
      showToast('Added ' + ids.length + ' stor' + (ids.length > 1 ? 'ies' : 'y'));
    } catch (e) {
      showToast('Failed to add stories. Please try again.');
    }
  });

  function applyCollSort() {
    if (!collStories.length) return;
    const sorted = collStories.slice();
    if (collSort === 'likes') sorted.sort((a, b) => (parseInt(String(b.likes || 0).replace(/[^0-9]/g, '')) || 0) - (parseInt(String(a.likes || 0).replace(/[^0-9]/g, '')) || 0));
    else if (collSort === 'reads') sorted.sort((a, b) => (parseInt(String(b.reads || 0).replace(/[^0-9]/g, '')) || 0) - (parseInt(String(a.reads || 0).replace(/[^0-9]/g, '')) || 0));
    else if (collSort === 'title') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    collStories = sorted;
    collPage = 1;
    renderCollPage();
  }

  document.getElementById('sortBtn')?.addEventListener('click', () => document.getElementById('sortOverlay').classList.add('open'));
  document.getElementById('sortClose')?.addEventListener('click', () => document.getElementById('sortOverlay').classList.remove('open'));
  document.getElementById('sortOverlay')?.addEventListener('click', e => { if (e.target.id === 'sortOverlay') e.currentTarget.classList.remove('open'); });
  document.querySelectorAll('#sortOptions .report-reason').forEach(el => el.addEventListener('click', () => {
    collSort = el.dataset.sort;
    document.getElementById('sortBtn').innerHTML = el.textContent.trim() + ' <i class="fas fa-chevron-down"></i>';
    document.getElementById('sortOverlay').classList.remove('open');
    applyCollSort();
  }));

  loadCollection();

  if (window.DroboardNav) {
    DroboardNav.configure({ active: 'none' });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.DroboardNav) DroboardNav.configure({ active: 'none' });
    });
  }

  window.renderCollPage = renderCollPage;
  window.renderBookCard = renderBookCard;
  window.loadCollection = loadCollection;
  window.renderHero = renderHero;
  window.renderStats = renderStats;
  window.renderAbout = renderAbout;
  window.renderCurated = renderCurated;
  window.applyCollSort = applyCollSort;
  window.showToast = showToast;
})();
