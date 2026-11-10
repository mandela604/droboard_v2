/**
 * marketing-data.js — Data layer for Marketing & Growth pages.
 * All methods call /api/marketing directly. Errors propagate to the caller.
 */
(function () {
  'use strict';
  if (window.__marketingData) return;
  window.__marketingData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/marketing';
  const TIMEOUT_MS = 8000;

  async function callBackend(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal, credentials: 'include' }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.status === 204 ? null : await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  window.MarketingData = {
    getDashboard() {
      return callBackend('/dashboard');
    },

    getCampaigns() {
      return callBackend('/campaigns').then(data => Array.isArray(data) ? data : data.campaigns);
    },

    createCampaign(payload) {
      return callBackend('/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },

    updateCampaign(id, payload) {
      return callBackend('/campaigns/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },

    deleteCampaign(id) {
      return callBackend('/campaigns/' + id, { method: 'DELETE' });
    },

    getAdsByCampaign(id) {
      return callBackend('/ads/campaign?id=' + encodeURIComponent(id));
    },

    getAdInventory() {
      return callBackend('/ads/inventory');
    },

    saveAd(format, ad) {
      return callBackend('/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, ad, { format })) });
    },

    deleteAd(format, id) {
      return callBackend('/ads/' + encodeURIComponent(id), { method: 'DELETE' });
    },

    toggleAd(format, id, active) {
      return callBackend('/ads/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    },

    savePlacements(patch) {
      return callBackend('/ads/placements', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    },

    resetAds() {
      return callBackend('/ads/reset', { method: 'POST' });
    },

    getLeagueConfig() {
      return callBackend('/league/config');
    },

    saveLeagueConfig(patch) {
      return callBackend('/league/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    },

    resetLeague() {
      return callBackend('/league/reset', { method: 'POST' });
    },

    getAdStats() {
      return callBackend('/ads/stats');
    },
  };
})();
