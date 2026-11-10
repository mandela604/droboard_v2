/**
 * author-verification-service.js — Data layer for Author Verification page
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';
if(window.__authorVerificationService) return;
window.__authorVerificationService = true;

const API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/author-verification';
const TIMEOUT_MS = 5000;

function showError(msg) {
  const el = document.getElementById('requestsTableBody');
  if(el) el.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ${msg}</td></tr>`;
}

function showLoading() {
  const el = document.getElementById('requestsTableBody');
  if(el) el.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading verification requests...</td></tr>`;
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

async function loadRequests() {
  showLoading();
  try {
    const requests = await callApi('/requests');
    return requests.map(r => ({
      ...r,
      live: true,
      avatar: r.avatar || '../assets/droboard-icon.png'
    }));
  } catch(e) {
    showError('Failed to load verification requests: ' + e.message);
    return [];
  }
}

async function loadRecentReviews() {
  try {
    const reviews = await callApi('/recent-reviews');
    return reviews.map(r => ({
      ...r,
      live: true,
      avatar: r.avatar || '../assets/droboard-icon.png'
    }));
  } catch(e) {
    console.error('Failed to load recent reviews:', e);
    return [];
  }
}

window.AuthorVerificationService = {

  async getRequests() {
    return await loadRequests();
  },

  async getRecentReviews() {
    return await loadRecentReviews();
  },

  async approveRequest(idx, requests) {
    const r = requests[idx];
    if(!r) throw new Error('Request not found');
    
    try {
      await callApi(`/requests/${r.id}/approve`, { method: 'POST' });
      return { success: true, message: 'Request approved' };
    } catch(e) {
      throw new Error('Failed to approve request: ' + e.message);
    }
  },

  async rejectRequest(idx, requests, reason) {
    const r = requests[idx];
    if(!r) throw new Error('Request not found');
    
    try {
      await callApi(`/requests/${r.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      return { success: true, message: 'Request rejected' };
    } catch(e) {
      throw new Error('Failed to reject request: ' + e.message);
    }
  },

  async requestMoreInfo(idx, requests, message) {
    const r = requests[idx];
    if(!r) throw new Error('Request not found');
    
    try {
      await callApi(`/requests/${r.id}/request-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      return { success: true, message: 'More info requested' };
    } catch(e) {
      throw new Error('Failed to request more info: ' + e.message);
    }
  },

  async getKycDetails(authorId) {
    try {
      const kyc = await callApi(`/kyc/${authorId}`);
      return kyc;
    } catch(e) {
      console.error('Failed to load KYC details:', e);
      return null;
    }
  },

  async getStatement(authorId) {
    try {
      const statement = await callApi(`/statement/${authorId}`);
      return statement;
    } catch(e) {
      console.error('Failed to load statement:', e);
      return '';
    }
  }
};

})();