/**
 * awards-service.js — Awards catalog + criteria + auto-grant engine
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';
if(window.__awardsService) return; 
window.__awardsService = true;

const API_BASE = '/api/awards';

let catalog = [];
let userAwards = [];

function showError(msg) {
  const el = document.getElementById('awardsTableBody');
  if(el) el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--red)"><i class="fas fa-circle-exclamation"></i> ${msg}</td></tr>`;
}

function showLoading() {
  const el = document.getElementById('awardsTableBody');
  if(el) el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading awards...</td></tr>`;
}

async function callApi(path, opts) {
  try {
    const res = await fetch(API_BASE + path, { credentials:'include', ...opts });
    if(!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch(e) {
    console.error('Awards API error:', e);
    throw e;
  }
}

async function loadCatalog() {
  try {
    catalog = await callApi('');
    return catalog;
  } catch(e) {
    showError('Failed to load awards catalog: ' + e.message);
    catalog = [];
    return [];
  }
}

async function loadUserAwards(handle) {
  try {
    if(handle) {
      userAwards = await callApi(`/user/${handle}`);
    } else {
      userAwards = [];
    }
    return userAwards;
  } catch(e) {
    console.error('Failed to load user awards:', e);
    userAwards = [];
    return [];
  }
}

async function list() {
  if(catalog.length === 0) await loadCatalog();
  return catalog.slice();
}

async function byId(id) {
  if(catalog.length === 0) await loadCatalog();
  return catalog.find(a => a.id === id) || null;
}

async function awardsForHandle(handle) {
  const userAwards = await loadUserAwards(handle);
  const catalog = await loadCatalog();
  
  return userAwards
    .map(r => {
      const a = catalog.find(a => a.id === r.awardId);
      return a ? { id:a.id, name:a.name, icon:a.icon, color:a.color, desc:a.desc, grantedAt:r.grantedAt } : null;
    })
    .filter(Boolean);
}

async function stats() {
  const cat = await list();
  return {
    total: cat.length,
    active: cat.filter(a => a.status === 'active').length,
    draft: cat.filter(a => a.status === 'draft').length,
    auto: cat.filter(a => a.criteria.metric !== 'manual').length,
    manual: cat.filter(a => a.criteria.metric === 'manual').length,
  };
}

async function createAward(payload) {
  try {
    const award = await callApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    catalog = []; // Invalidate cache
    return award;
  } catch(e) {
    throw new Error('Failed to create award: ' + e.message);
  }
}

async function updateAward(id, patch) {
  try {
    const award = await callApi(`/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    catalog = []; // Invalidate cache
    return award;
  } catch(e) {
    throw new Error('Failed to update award: ' + e.message);
  }
}

async function deleteAward(id) {
  try {
    await callApi(`/${id}`, { method: 'DELETE' });
    catalog = []; // Invalidate cache
    return true;
  } catch(e) {
    throw new Error('Failed to delete award: ' + e.message);
  }
}

async function grant(awardId, handle) {
  try {
    await callApi(`/${awardId}/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle })
    });
    userAwards = []; // Invalidate cache
    return true;
  } catch(e) {
    throw new Error('Failed to grant award: ' + e.message);
  }
}

async function revoke(awardId, handle) {
  try {
    await callApi(`/${awardId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle })
    });
    userAwards = []; // Invalidate cache
    return true;
  } catch(e) {
    throw new Error('Failed to revoke award: ' + e.message);
  }
}

async function holders(awardId) {
  try {
    const result = await callApi(`/${awardId}/holders`);
    return Array.isArray(result) ? result : [];
  } catch(e) {
    console.error('Failed to load holders:', e);
    return [];
  }
}

async function runAutoGrant() {
  try {
    await callApi('/run-auto-grant', { method: 'POST' });
    catalog = []; // Invalidate cache
    userAwards = [];
    return true;
  } catch(e) {
    throw new Error('Failed to run auto-grant: ' + e.message);
  }
}

// Expose
window.AwardsService = { 
  list, byId, stats, create: createAward, update: updateAward, remove: deleteAward, 
  holders, grant, revoke, runAutoGrant 
};
window.AwardsEngine = { 
  grantedFor: awardsForHandle, runAutoGrant 
};

})();