/* ═══════════════════════════════════════════════════════════════
   COLLECTION DATA SERVICE — Live
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API_BASE = '/api';

  async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function getCollections() {
    const j = await apiFetch('/collections?limit=50');
    return Array.isArray(j) ? j : (j.items || []);
  }

  async function getCollection(id) {
    return apiFetch(`/collections/${encodeURIComponent(id)}`);
  }

  async function getCollectionStories(collectionId) {
    const j = await apiFetch(`/collections/${encodeURIComponent(collectionId)}/stories`);
    return Array.isArray(j) ? j : (j.items || []);
  }

  async function getStoryById(storyId) {
    const j = await apiFetch(`/stories/${encodeURIComponent(storyId)}`);
    return j.story || j;
  }

  window.CollectionData = {
    getCollections,
    getCollection,
    getCollectionStories,
    getStoryById,
  };
})();
