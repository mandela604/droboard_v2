/* ═══════════════════════════════════════════════════════════════
   COLLECTION DATA SERVICE
   Fetch-with-demo-fallback pattern. USE_API flips to real endpoints later.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';

  async function getCollections() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/collections`);
      if (!res.ok) throw new Error('Collections API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 80));
    const d = window.DemoData;
    return d.COLLECTIONS;
  }

  async function getCollection(id) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/collections/${id}`);
      if (!res.ok) throw new Error('Collection API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 60));
    const d = window.DemoData;
    const slug = s => (s.title||s.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    return d.COLLECTIONS.find(c => c.id === id || slug(c) === (id||'').toLowerCase()) || d.COLLECTIONS[0];
  }

  async function getCollectionStories(collectionId) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/collections/${collectionId}/stories`);
      if (!res.ok) throw new Error('Collection Stories API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 100));
    const d = window.DemoData;
    const slug = s => (s.title||s.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const col = d.COLLECTIONS.find(c => c.id === collectionId || slug(c) === (collectionId||'').toLowerCase()) || d.COLLECTIONS[0];
    return col.storyList || d.STORIES.slice(0, 8);
  }

  async function getStoryById(storyId) {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/stories/${storyId}`);
      if (!res.ok) throw new Error('Story API failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 50));
    const d = window.DemoData;
    return d.STORIES.find(s => s.id === storyId) || null;
  }

  window.CollectionData = {
    getCollections,
    getCollection,
    getCollectionStories,
    getStoryById,
  };
})();
