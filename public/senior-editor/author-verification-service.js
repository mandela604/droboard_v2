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
  const el = document.getElementById('tableBody');
  if(el) el.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:40px"><i class="fas fa-circle-exclamation"></i> ${msg}</td></tr>`;
}

function showLoading() {
  const el = document.getElementById('tableBody');
  if(el) el.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading verification requests...</td></tr>`;
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
  },

  async init() {
    // Attach sidebar first so the page has chrome
    if (window.SeniorEditorSidebar) {
      const me = (window.AuthSession && AuthSession.getSync && AuthSession.getSync()) || {};
      SeniorEditorSidebar.attach('#dashboardRoot', {
        activeItem: 'author-verification',
        title: 'Author Verification',
        subtitle: 'Review and approve author identity requests',
        user: { name: me.name || me.username || 'Editor', role: 'Senior Editor', avatar: me.avatar || '' },
        notifCount: 0,
        searchPlaceholder: 'Search by author name or email...',
      });
    }
    const tbody = document.getElementById('tableBody');
    const pageInfo = document.getElementById('pageInfo');
    const pendingCount = document.getElementById('pendingCount');
    try {
      const requests = await this.getRequests();
      if(tbody) {
        if(!requests.length) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:40px"><i class="fas fa-inbox" style="font-size:24px;color:var(--text-faint);display:block;margin-bottom:8px"></i>No verification requests.</td></tr>';
        } else {
          tbody.innerHTML = requests.map(r => {
            const statusClass = (r.status||'pending').toLowerCase();
            return '<tr class="req-row"><td class="auth-cell"><img class="auth-avatar" src="'+(r.avatar||'../assets/droboard-icon.png')+'" alt=""/><div><div class="auth-name">'+(r.author||'—')+'</div><div class="auth-email">'+(r.email||'—')+'</div></div></td><td class="doc-cell"><i class="fas fa-file"></i> '+(r.document||'—')+'</td><td class="plain-cell">'+(r.submitted||'—')+'</td><td class="reviewer-cell"><img src="'+(r.reviewerAvatar||'../assets/droboard-icon.png')+'" alt=""/><span>'+(r.reviewer||'—')+'</span></td><td><span class="status-pill '+statusClass+'">'+(r.status||'Pending')+'</span></td><td class="actions-cell"><button class="act-btn approve" onclick="AuthorVerificationService.approveRequest('+requests.indexOf(r)+', requests)"><i class="fas fa-check"></i></button><button class="act-btn reject" onclick="AuthorVerificationService.rejectRequest('+requests.indexOf(r)+', requests)"><i class="fas fa-times"></i></button></td></tr>';
          }).join('');
        }
      }
      if(pageInfo && requests.length) pageInfo.textContent = 'Showing 1 to '+requests.length+' of '+requests.length+' requests';
      if(pendingCount) {
        const pending = requests.filter(r=>(r.status||'pending').toLowerCase()==='pending').length;
        pendingCount.textContent = pending;
      }
    } catch(e) {
      showError('Failed to load verification requests: ' + e.message);
      if(pageInfo) pageInfo.textContent = 'Showing 0 to 0 of 0 requests';
      if(pendingCount) pendingCount.textContent = '0';
    }

    const recentGrid = document.getElementById('authorGrid');
    try {
      const reviews = await this.getRecentReviews();
      if(recentGrid) {
        if(!reviews.length) recentGrid.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:20px">No recently reviewed requests.</div>';
        else recentGrid.innerHTML = reviews.map(r => '<div class="author-card"><img src="'+(r.avatar||'../assets/droboard-icon.png')+'" alt=""/><div class="author-card-name">'+(r.author||'—')+'</div><div class="author-card-meta">'+(r.status||'Reviewed')+'</div></div>').join('');
      }
    } catch(e) {
      console.error('Failed to load recent reviews:', e);
    }
  }
};

})();