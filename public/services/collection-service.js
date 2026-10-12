/* ═══════════════════════════════════════════════════════════════
   COLLECTION DATA SERVICE
   Fetch-with-demo-fallback pattern. USE_API flips to real endpoints later.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = true;
  const API_BASE = '/api';

  /* Live first, demo fallback: any network/auth failure falls through to
     the bundled demo data so pages never break offline or logged-out. */
  async function live(path) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function getCollections() {
    if (USE_API) {
      const j = await live('/collections?limit=50');
      if (Array.isArray(j)) return j;
    }
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData || {};
    return d.COLLECTIONS || [];
  }

  async function getCollection(id) {
    if (USE_API) {
      const j = await live(`/collections/${encodeURIComponent(id)}`);
      if (j && j.id) return j;
    }
    await new Promise(r => setTimeout(r, 60));
    const d = window.DemoData || {};
    const cols = d.COLLECTIONS || [];
    const slug = s => (s.title||s.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    return cols.find(c => c.id === id || slug(c) === (id||'').toLowerCase()) || cols[0] || null;
  }

  async function getCollectionStories(collectionId) {
    if (USE_API) {
      const j = await live(`/collections/${encodeURIComponent(collectionId)}/stories`);
      if (Array.isArray(j)) return j;
    }
    await new Promise(r => setTimeout(r, 100));
    const d = window.DemoData || {};
    const cols = d.COLLECTIONS || [];
    const slug = s => (s.title||s.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const col = cols.find(c => c.id === collectionId || slug(c) === (collectionId||'').toLowerCase()) || cols[0];
    if (!col) return [];
    return col.storyList || (d.STORIES || []).slice(0, 8);
  }

  async function getStoryById(storyId) {
    if (USE_API) {
      const j = await live(`/stories/${encodeURIComponent(storyId)}`);
      if (j && (j.id || j.story)) return j.story || j;
    }
    await new Promise(r => setTimeout(r, 50));
    const d = window.DemoData || {};
    return (d.STORIES || []).find(s => s.id === storyId) || null;
  }

  window.CollectionData = {
    getCollections,
    getCollection,
    getCollectionStories,
    getStoryById,
  };
})();
