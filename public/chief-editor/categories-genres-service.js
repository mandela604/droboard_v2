/**
 * categories-genres-service.js — Data layer for Categories & Genres page
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';
if(window.__catGenreService) return;
window.__catGenreService = true;

/* ── Live API ── */
const API_BASE = window.DROBOARD_API_BASE || '/api/chief';
const TIMEOUT_MS = 2500;

async function callBackend(path, opts){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE + path, { signal: c.signal, ...opts });
    clearTimeout(t);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch(e) {
    clearTimeout(t);
    throw e;
  }
}

function showError(msg) {
  const el = document.getElementById('tableBody');
  if(el) el.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fas fa-circle-exclamation" style="color:var(--red);margin-right:8px"></i>${msg}</td></tr>`;
}

function showLoading() {
  const el = document.getElementById('tableBody');
  if(el) el.innerHTML = `<tr class="empty-row"><td colspan="6"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Loading...</td></tr>`;
}

/* ── Mappers ── */
function toBooks(n){ return (Number(n)||0).toLocaleString('en-US'); }

const ICON_OPTIONS = [
  {icon:'fa-heart',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-crown',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-paw',bg:'#eef0f2',color:'#5b6470'},
  {icon:'fa-droplet',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-wand-magic-sparkles',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-gun',bg:'#e7e7ea',color:'#26262b'},
  {icon:'fa-building',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-ring',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-fire',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-rotate-left',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-briefcase',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-shield',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-heart-crack',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-ban',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-book',bg:'#e2f8ea',color:'#16a34a'},
  {icon:'fa-film',bg:'#fef3d8',color:'#d97706'}
];

function pickIcon(){ return ICON_OPTIONS[Math.floor(Math.random()*ICON_OPTIONS.length)]; }
function icoFor(src){
  const ico = pickIcon();
  return { icon: src.icon || ico.icon, bg: src.bg || ico.bg, color: src.color || ico.color };
}

function mapCategory(c, genreCounts){
  const ico = icoFor(c);
  return {
    id: c.id,
    name: c.name || '',
    icon: ico.icon,
    bg: ico.bg,
    color: ico.color,
    desc: c.desc || '',
    genres: genreCounts[c.id] || 0,
    books: toBooks(c.booksCount),
    status: c.status || 'active'
  };
}

function mapGenre(g, catNameById){
  const ico = icoFor(g);
  return {
    id: g.id,
    name: g.name || '',
    cat: catNameById[g.categoryId] || '',
    icon: ico.icon,
    bg: ico.bg,
    color: ico.color,
    books: toBooks(g.booksCount),
    status: g.status || 'active'
  };
}

function mapTrope(t){
  const ico = icoFor(t);
  return {
    id: t.id,
    name: t.name || '',
    genre: t.genre || '',
    icon: ico.icon,
    bg: ico.bg,
    color: ico.color,
    books: toBooks(t.booksCount),
    status: t.status || 'active'
  };
}

function mapPopular(p){
  const ico = pickIcon();
  return {
    name: p.name || '',
    icon: ico.icon,
    bg: ico.bg,
    color: ico.color,
    books: toBooks(p.count) + ' books'
  };
}

async function itemsOf(path){
  const d = await callBackend(path);
  if(Array.isArray(d)) return d;
  return (d && Array.isArray(d.items)) ? d.items : [];
}

async function loadLive() {
  try {
    const [catRaw, genRaw, troRaw, popRaw] = await Promise.all([
      itemsOf('/categories?limit=50'),
      itemsOf('/genres?limit=50'),
      itemsOf('/tropes?limit=50'),
      callBackend('/genres/popular')
    ]);

    const catNameById = {};
    const genreCounts = {};
    
    catRaw.forEach(c => catNameById[c.id] = c.name);
    genRaw.forEach(g => {
      if(g.categoryId != null) genreCounts[g.categoryId] = (genreCounts[g.categoryId] || 0) + 1;
    });

    const popular = Array.isArray(popRaw) ? popRaw.map(mapPopular) : [];

    return {
      categories: catRaw.map(c => mapCategory(c, genreCounts)),
      genres: genRaw.map(g => mapGenre(g, catNameById)),
      tropes: troRaw.map(mapTrope),
      popular
    };
  } catch(e) {
    showError('Failed to load data: ' + e.message);
    return { categories: [], genres: [], tropes: [], popular: [] };
  }
}

/* ── Public API ── */
window.CategoriesGenresService = {

  async loadData() {
    showLoading();
    return await loadLive();
  },

  async getCategories() {
    const data = await loadLive();
    return data.categories;
  },

  async getGenres() {
    const data = await loadLive();
    return data.genres;
  },

  async getTropes() {
    const data = await loadLive();
    return data.tropes;
  },

  async getPopularGenres() {
    const data = await loadLive();
    return data.popular;
  },

  getIconOptions() { return ICON_OPTIONS.slice(); },

  async addCategory(payload) {
    try {
      const res = await callBackend('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to add category: ' + e.message);
    }
  },

  async updateCategory(id, payload) {
    try {
      const res = await callBackend(`/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to update category: ' + e.message);
    }
  },

  async deleteCategory(id) {
    try {
      await callBackend(`/categories/${id}`, { method: 'DELETE' });
    } catch(e) {
      throw new Error('Failed to delete category: ' + e.message);
    }
  },

  async addGenre(payload) {
    try {
      const res = await callBackend('/genres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to add genre: ' + e.message);
    }
  },

  async updateGenre(id, payload) {
    try {
      const res = await callBackend(`/genres/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to update genre: ' + e.message);
    }
  },

  async deleteGenre(id) {
    try {
      await callBackend(`/genres/${id}`, { method: 'DELETE' });
    } catch(e) {
      throw new Error('Failed to delete genre: ' + e.message);
    }
  },

  async addTrope(payload) {
    try {
      const res = await callBackend('/tropes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to add trope: ' + e.message);
    }
  },

  async updateTrope(id, payload) {
    try {
      const res = await callBackend(`/tropes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res;
    } catch(e) {
      throw new Error('Failed to update trope: ' + e.message);
    }
  },

  async toggleCategoryStatus(id) {
    try {
      const res = await callBackend(`/categories/${id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return res;
    } catch(e) {
      throw new Error('Failed to toggle category status: ' + e.message);
    }
  },

  async toggleGenreStatus(id) {
    try {
      const res = await callBackend(`/genres/${id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return res;
    } catch(e) {
      throw new Error('Failed to toggle genre status: ' + e.message);
    }
  },

  async toggleTropeStatus(id) {
    try {
      const res = await callBackend(`/tropes/${id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return res;
    } catch(e) {
      throw new Error('Failed to toggle trope status: ' + e.message);
    }
  },

  async deleteTrope(id) {
    try {
      await callBackend(`/tropes/${id}`, { method: 'DELETE' });
    } catch(e) {
      throw new Error('Failed to delete trope: ' + e.message);
    }
  }
};

})();