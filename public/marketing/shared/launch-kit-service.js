/**
 * launch-kit-service.js — CRUD service for Campaigns
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'droboard_launch_kits';
  var DATA_VERSION = 'v3';

  function delay(ms) { return new Promise(function(r) { setTimeout(r, ms || 200); }); }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var ver = localStorage.getItem(STORAGE_KEY + '_ver');
      if (ver !== DATA_VERSION) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY + '_ver'); return null; }
      return JSON.parse(raw);
    }
    catch (e) { return null; }
  }

  function saveLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEY + '_ver', DATA_VERSION);
  }

  function getSeedData() {
    return typeof LaunchKitData !== 'undefined' ? JSON.parse(JSON.stringify(LaunchKitData)) : [];
  }

  function ensureLocalData() {
    var data = loadLocal();
    if (!data || !data.length) {
      data = getSeedData();
      saveLocal(data);
    }
    return data;
  }

  var LaunchKitService = {
    _local_data: [],

    getAll: function() {
      var self = this;
      return delay().then(function() {
        self._local_data = ensureLocalData();
        return self._local_data;
      });
    },

    getById: function(id) {
      var data = ensureLocalData();
      return Promise.resolve(data.find(function(k) { return k.id === id; }) || null);
    },

    getByWriterId: function(writerId) {
      var data = ensureLocalData();
      return Promise.resolve(data.find(function(k) { return k.writerId === writerId; }) || null);
    },

    create: function(campaign) {
      var self = this;
      var data = ensureLocalData();
      var newCampaign = Object.assign({
        id: 'lk_' + Date.now(),
        writerId: 'w_' + Date.now(),
        writerName: '',
        writerAvatar: '',
        campaignName: '',
        campaignType: 'book',
        campaignImage: '',
        campaignImageWide: '',
        description: '',
        destination: '',
        cta: 'Read Now',
        referralCode: '',
        campaignLink: '',
        status: 'draft',
        launchDate: '',
        created: new Date().toISOString().split('T')[0],
        analytics: { visitors: 0, clicks: 0, conversions: 0, conversionRate: 0 },
        sources: { whatsapp: 0, facebook: 0, tiktok: 0, instagram: 0, direct: 0 },
        promoters: [],
        assets: { whatsapp: '', facebook: '', tiktok: '', instagram: '', excerpt: '', caption: '' },
        rewards: [],
        countdown: []
      }, campaign);
      data.push(newCampaign);
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return newCampaign; });
    },

    update: function(id, updates) {
      var self = this;
      var data = ensureLocalData();
      var idx = data.findIndex(function(k) { return k.id === id; });
      if (idx === -1) return Promise.reject(new Error('Campaign not found'));
      data[idx] = Object.assign({}, data[idx], updates);
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return data[idx]; });
    },

    remove: function(id) {
      var self = this;
      var data = ensureLocalData();
      data = data.filter(function(k) { return k.id !== id; });
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return true; });
    },

    reset: function() {
      var self = this;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + '_ver');
      var data = getSeedData();
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return data; });
    },

    getStats: function() {
      var data = ensureLocalData();
      var total = data.length;
      var active = data.filter(function(k) { return k.status === 'active'; }).length;
      var scheduled = data.filter(function(k) { return k.status === 'scheduled'; }).length;
      var draft = data.filter(function(k) { return k.status === 'draft'; }).length;
      var totalVisitors = data.reduce(function(s, k) { return s + (k.analytics.visitors || 0); }, 0);
      var totalClicks = data.reduce(function(s, k) { return s + (k.analytics.clicks || 0); }, 0);
      var totalConversions = data.reduce(function(s, k) { return s + (k.analytics.conversions || 0); }, 0);
      return { total: total, active: active, scheduled: scheduled, draft: draft, totalVisitors: totalVisitors, totalClicks: totalClicks, totalConversions: totalConversions };
    }
  };

  window.LaunchKitService = LaunchKitService;
})();
