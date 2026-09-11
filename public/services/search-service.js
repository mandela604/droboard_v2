/* ═══════════════════════════════════════════════════════════════
   SEARCH INDEX SERVICE
   Builds the search-overlay pools from the central demo data so every
   story, chapter and writer is findable. Pages pass the result into
   DroboardSearch.configure({ data: SearchIndex.build() }).
   When going live: set USE_API = true (GET /api/search/index).
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  function keywordsOf() {
    const words = [];
    for (let i = 0; i < arguments.length; i++) {
      String(arguments[i] || '').toLowerCase().split(/[^a-z0-9]+/).forEach(w => {
        if (w.length >= 3 && words.indexOf(w) === -1) words.push(w);
      });
    }
    return words;
  }

  function storyEntry(s) {
    return {
      type: 'story', id: s.id,
      img: s.cover || s.img || '', cat: s.cat || s.genre || 'Story',
      title: s.title, author: s.author || s.authorName || '',
      av: s.authorAv || '', views: s.reads || '', likes: s.likes || '',
      badge: (s.gbadge || s.badge || '').toLowerCase(),
      keywords: keywordsOf(s.title, s.author, s.authorName, s.cat, s.genre),
    };
  }

  function buildStoryIndex() {
    const d = window.DemoData || {};
    const out = [];
    const seen = {};
    const push = (e) => {
      const k = String(e.title || '').toLowerCase();
      if (!e.title || seen[k]) return;
      seen[k] = true;
      out.push(e);
    };
    ((d.STORIES || [])).forEach(s => push(storyEntry(s)));
    if (d.FULL_STORY) {
      const f = d.FULL_STORY;
      push(storyEntry({ id: 'fullstory', cover: (f.chapters || [])[0] && '', img: '', cat: f.category, title: f.title, author: (f.author || {}).name, authorAv: (f.author || {}).avatar, reads: '', likes: '' }));
      // Chapters open the parent story in the full reader
      ((f.chapters || [])).forEach(c => push({
        type: 'story', id: 'fullstory',
        img: '', cat: 'Chapter ' + c.n, title: c.title,
        author: (f.author || {}).name || '', av: (f.author || {}).avatar || '',
        views: '', likes: '', badge: '',
        keywords: keywordsOf(c.title, f.title),
      }));
    }
    Object.keys(d.SERIES_CATALOG || {}).forEach(k => {
      const s = d.SERIES_CATALOG[k];
      push(storyEntry({ id: s.id, cover: s.cover, cat: s.cat, title: s.title, author: (s.writer || {}).name, reads: (s.stats || {}).reads, likes: (s.stats || {}).likes }));
    });
    return out;
  }

  function buildWriterIndex() {
    const d = window.DemoData || {};
    return Object.keys(d.USERS || {}).map(k => {
      const u = d.USERS[k];
      const followers = typeof u.stats?.followers === 'number'
        ? (u.stats.followers >= 1000 ? (u.stats.followers / 1000).toFixed(1) + 'k' : String(u.stats.followers))
        : (u.stats?.followers || '');
      return {
        type: 'writer', name: u.name, handle: '@' + u.handle,
        genre: (u.genres || [])[0] || '', av: u.avatar || '',
        followers, verified: !!u.verified, following: false,
        keywords: keywordsOf(u.name, u.handle, (u.genres || []).join(' ')),
      };
    });
  }

  async function build() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/search/index`);
      if (!res.ok) throw new Error('Search index API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 30));
    return { poolStories: buildStoryIndex(), poolWriters: buildWriterIndex() };
  }

  window.SearchIndex = { build, buildStoryIndex, buildWriterIndex };
})();
