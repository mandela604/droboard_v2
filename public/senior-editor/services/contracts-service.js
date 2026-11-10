/**
 * contracts-service.js — Contract management for Senior Editor
 * Live API only, no demo fallbacks.
 */
(function(){
'use strict';

const API_BASE = '/api/senior-editor/contracts';
const TIMEOUT_MS = 5000;

function showError(msg) {
  console.error('Contracts service error:', msg);
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

async function loadContracts() {
  try {
    const data = await callApi('');
    return data.items || data.contracts || [];
  } catch(e) {
    showError('Failed to load contracts: ' + e.message);
    return [];
  }
}

async function getContract(id) {
  try {
    return await callApi(`/${id}`);
  } catch(e) {
    throw new Error('Failed to load contract: ' + e.message);
  }
}

async function sendContract(payload) {
  try {
    return await callApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e) {
    throw new Error('Failed to send contract: ' + e.message);
  }
}

async function approveContract(id) {
  try {
    return await callApi(`/${id}/approve`, { method: 'POST' });
  } catch(e) {
    throw new Error('Failed to approve contract: ' + e.message);
  }
}

async function rejectContract(id, note) {
  try {
    return await callApi(`/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
  } catch(e) {
    throw new Error('Failed to reject contract: ' + e.message);
  }
}

async function replyToContract(id, message) {
  try {
    return await callApi(`/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
  } catch(e) {
    throw new Error('Failed to reply to contract: ' + e.message);
  }
}

async function loadTemplates() {
  try {
    const data = await callApi('/templates');
    return data.items || data.templates || [];
  } catch(e) {
    showError('Failed to load templates: ' + e.message);
    return [];
  }
}

async function getTemplate(id) {
  try {
    return await callApi(`/templates/${id}`);
  } catch(e) {
    throw new Error('Failed to load template: ' + e.message);
  }
}

async function createTemplate(payload) {
  try {
    return await callApi('/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e) {
    throw new Error('Failed to create template: ' + e.message);
  }
}

async function updateTemplate(id, payload) {
  try {
    return await callApi(`/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e) {
    throw new Error('Failed to update template: ' + e.message);
  }
}

async function loadSignedContracts() {
  try {
    const data = await callApi('/signed');
    return data.items || data.signedContracts || [];
  } catch(e) {
    showError('Failed to load signed contracts: ' + e.message);
    return [];
  }
}

async function getSignedContract(id) {
  try {
    return await callApi(`/signed/${id}`);
  } catch(e) {
    throw new Error('Failed to load signed contract: ' + e.message);
  }
}

window.ContractsService = {
  loadContracts,
  getContract,
  sendContract,
  approveContract,
  rejectContract,
  replyToContract,
  loadTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  loadSignedContracts,
  getSignedContract
};

})();