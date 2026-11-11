/**
 * email-templates-service.js — live CRUD over /api/super-admin/email-templates.
 * Templates live in Mongo (EmailTemplate docs, keyed by `key`), never in
 * localStorage and never seeded from a demo file.
 */
(function () {
  'use strict';

  var API_BASE = '/api/super-admin/email-templates';
  var _cache = [];

  function api(method, path, body) {
    var opts = { method: method, credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(API_BASE + (path || ''), opts).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return null; }).then(function (b) {
          var e = new Error((b && b.error) || ('HTTP ' + r.status));
          e.status = r.status;
          throw e;
        });
      }
      return r.json().catch(function () { return null; });
    });
  }

  function normalize(t) {
    if (!t) return t;
    var out = Object.assign({}, t);
    out.id = t.key || t.id;
    if (Array.isArray(out.bullets)) out.bullets = out.bullets.join('\n');
    return out;
  }

  function payload(data) {
    var out = {};
    Object.keys(data || {}).forEach(function (k) {
      if (k === 'id' || k === '_id' || k === '__v') return;
      out[k] = data[k];
    });
    if (typeof out.bullets === 'string') {
      out.bullets = out.bullets.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return out;
  }

  var EmailTemplates = {
    _local_data: [],

    getAll: function () {
      return api('GET', '').then(function (rows) {
        _cache = (Array.isArray(rows) ? rows : (rows && rows.items) || []).map(normalize);
        this._local_data = _cache;
        return _cache;
      }.bind(this));
    },

    getById: function (id) {
      return api('GET', '/' + encodeURIComponent(id)).then(normalize).catch(function () {
        return _cache.find(function (t) { return String(t.id) === String(id); }) || null;
      });
    },

    create: function (template) {
      var body = payload(template);
      body.key = template.id || template.key || ('tpl_' + Date.now());
      return api('POST', '', body).then(function (created) {
        var row = normalize(created);
        _cache.push(row);
        return row;
      });
    },

    update: function (id, updates) {
      return api('PUT', '/' + encodeURIComponent(id), payload(updates)).then(function (saved) {
        var row = normalize(saved);
        var idx = _cache.findIndex(function (t) { return String(t.id) === String(id); });
        if (idx >= 0) _cache[idx] = row; else _cache.push(row);
        return row;
      });
    },

    remove: function (id) {
      return api('DELETE', '/' + encodeURIComponent(id)).then(function () {
        _cache = _cache.filter(function (t) { return String(t.id) !== String(id); });
        return true;
      });
    },

    /* There is no server-side "reset to defaults": templates are data, not a
       local seed. Reload whatever the API currently holds. */
    reset: function () {
      return this.getAll();
    },

    save: function (id, data) {
      var exists = _cache.some(function (t) { return String(t.id) === String(id); });
      var p = exists ? this.update(id, data) : this.create(Object.assign({ id: id }, data));
      return p.then(function (saved) {
        if (typeof window.toast === 'function') window.toast('Template saved!');
        return saved;
      });
    },
  };

  window.DroboardEmailTemplates = EmailTemplates;
  window.DroboardEmailSeed = function () { return []; };
})();
