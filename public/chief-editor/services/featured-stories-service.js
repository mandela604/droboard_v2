/**
 * featured-stories-service.js — Data layer for Featured Stories page
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';
if(window.__featuredStoriesService) return;
window.__featuredStoriesService = true;

const API_BASE = window.DROBOARD_API_BASE || '/api/chief/featured';
const TIMEOUT_MS = 5000;

function showError(msg) {
  console.error('Featured stories error:', msg);
  // UI error handling would be implemented by the page controller
}

async function callApi(path, opts) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, { signal: c.signal, credentials:'include', ...opts });
    clearTimeout(t);
    if(!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch(e) {
    clearTimeout(t);
    throw e;
  }
}

async function loadTags() {
  try {
    const data = await callApi('/tags');
    const allowedTags = ['featured', 'editors-pick'];
    const filtered = {};
    allowedTags.forEach(tag => {
      if(data[tag]) filtered[tag] = data[tag];
    });
    return filtered;
  } catch(e) {
    showError('Failed to load tags: ' + e.message);
    return {};
  }
}

async function loadSections() {
  try {
    const data = await callApi('/sections');
    return Array.isArray(data) ? data : (data.items || []);
  } catch(e) {
    showError('Failed to load sections: ' + e.message);
    return [];
  }
}

async function loadLibrary() {
  try {
    const data = await callApi('/library');
    return Array.isArray(data) ? data : (data.items || []);
  } catch(e) {
    showError('Failed to load library: ' + e.message);
    return [];
  }
}

async function loadPlacements() {
  try {
    const data = await callApi('/placements');
    return Array.isArray(data) ? data : (data.items || []);
  } catch(e) {
    showError('Failed to load placements: ' + e.message);
    return [];
  }
}

async function loadHistory() {
  try {
    const data = await callApi('/history');
    return Array.isArray(data) ? data : (data.items || []);
  } catch(e) {
    showError('Failed to load history: ' + e.message);
    return [];
  }
}

async function loadAll() {
  try {
    const [tags, sections, library, placements, history] = await Promise.all([
      loadTags(),
      loadSections(),
      loadLibrary(),
      loadPlacements(),
      loadHistory()
    ]);
    
    return { tags, sections, library, placements, history };
  } catch(e) {
    showError('Failed to load featured stories data: ' + e.message);
    return { tags: {}, sections: [], library: [], placements: [], history: [] };
  }
}

async function createPlacement(placement) {
  try {
    const result = await callApi('/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(placement)
    });
    return result;
  } catch(e) {
    throw new Error('Failed to create placement: ' + e.message);
  }
}

async function updatePlacement(id, patch) {
  try {
    const result = await callApi(`/placements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    return result;
  } catch(e) {
    throw new Error('Failed to update placement: ' + e.message);
  }
}

async function deletePlacement(id) {
  try {
    await callApi(`/placements/${id}`, { method: 'DELETE' });
    return true;
  } catch(e) {
    throw new Error('Failed to delete placement: ' + e.message);
  }
}

async function updateSection(id, patch) {
  try {
    const result = await callApi(`/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    return result;
  } catch(e) {
    throw new Error('Failed to update section: ' + e.message);
  }
}

async function updateLibraryItem(id, patch) {
  try {
    const result = await callApi(`/library/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    return result;
  } catch(e) {
    throw new Error('Failed to update library item: ' + e.message);
  }
}

window.FeaturedStoriesService = {
  loadAll,
  loadTags,
  loadSections,
  loadLibrary,
  loadPlacements,
  loadHistory,
  createPlacement,
  updatePlacement,
  deletePlacement,
  updateSection,
  updateLibraryItem
};

})();