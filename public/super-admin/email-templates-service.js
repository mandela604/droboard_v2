/**
 * email-templates-service.js — CRUD service for email templates
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'droboard_email_templates';

  function delay(ms) { return new Promise(function(r) { setTimeout(r, ms || 200); }); }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return null; }
  }

  function saveLocal(templates) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }

  function getSeedData() {
    return typeof EmailTemplatesData !== 'undefined' ? JSON.parse(JSON.stringify(EmailTemplatesData)) : [];
  }

  function ensureLocalData() {
    var data = loadLocal();
    if (!data || !data.length) {
      data = getSeedData();
      saveLocal(data);
    }
    return data;
  }

  var EmailTemplates = {
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
      return Promise.resolve(data.find(function(t) { return t.id === id; }) || null);
    },

    create: function(template) {
      var self = this;
      var data = ensureLocalData();
      var newTemplate = Object.assign({
        id: 'tpl_' + Date.now(),
        name: 'Untitled Template',
        subject: '',
        preheader: '',
        fromName: 'Droboard Team',
        fromEmail: 'noreply@droboard.app',
        headerColor: '#ff0050',
        headerTitle: '',
        headerSub: '',
        greeting: '',
        body: '',
        bullets: '',
        btnText: '',
        btnColor: '#ff0050',
        btnLink: '',
        footerNote: '',
        unsub: 'Unsubscribe | Manage Preferences',
        status: 'active',
        lastEdited: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }, template);
      data.push(newTemplate);
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return newTemplate; });
    },

    update: function(id, updates) {
      var self = this;
      var data = ensureLocalData();
      var idx = data.findIndex(function(t) { return t.id === id; });
      if (idx === -1) return Promise.reject(new Error('Template not found'));
      data[idx] = Object.assign({}, data[idx], updates, { lastEdited: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return data[idx]; });
    },

    remove: function(id) {
      var self = this;
      var data = ensureLocalData();
      data = data.filter(function(t) { return t.id !== id; });
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return true; });
    },

    reset: function() {
      var self = this;
      localStorage.removeItem(STORAGE_KEY);
      var data = getSeedData();
      saveLocal(data);
      self._local_data = data;
      return delay().then(function() { return data; });
    },

    save: function(id, data) {
      var templates = ensureLocalData();
      var idx = templates.findIndex(function(t) { return t.id === id; });
      var now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (idx >= 0) {
        templates[idx] = Object.assign({}, templates[idx], data, { lastEdited: now });
      } else {
        templates.push(Object.assign({}, data, { id: data.id || 'tpl_' + Date.now(), status: 'active', lastEdited: now }));
      }
      saveLocal(templates);
      this._local_data = templates;
      if (typeof toast === 'function') toast('Template saved!');
    },
  };

  window.DroboardEmailTemplates = EmailTemplates;
})();
