/**
 * super-admin-data.js — Data layer for Super Admin pages.
 * All methods call /api/super-admin directly. Errors propagate to the caller.
 */
(function () {
  'use strict';
  if (window.__superAdminData) return;
  window.__superAdminData = true;

  const API_BASE = window.DROBOARD_API_BASE || '/api/super-admin';
  const TIMEOUT_MS = 8000;

  async function api(path, opts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + path, Object.assign({ signal: controller.signal, credentials: 'include' }, opts || {}));
      clearTimeout(timer);
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.status === 204 ? null : await res.json();
    } catch (e) { clearTimeout(timer); throw e; }
  }

  function post(path, body) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function patch(path, body) {
    return api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function put(path, body) {
    return api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }
  function del(path) {
    return api(path, { method: 'DELETE' });
  }

  window.SuperAdminData = {
    getDashboard()                  { return api('/dashboard/summary'); },

    getUsers()                      { return api('/users'); },
    updateUser(id, data)            { return patch('/users/' + id, data); },
    deleteUser(id)                  { return del('/users/' + id); },

    getRoles()                      { return api('/roles'); },
    updateRole(id, data)            { return put('/roles/' + id, data); },

    getPlatformSettings()           { return api('/settings'); },
    updatePlatformSettings(data)    { return put('/settings', data); },

    getAnalytics()                  { return api('/analytics/summary'); },
    getEarnings()                   { return api('/earnings'); },

    getSystemLogs()                 { return api('/audit'); },
    getEmailTemplates()             { return api('/email-templates'); },
    createEmailTemplate(data)       { return post('/email-templates', data); },
    updateEmailTemplate(id, data)   { return put('/email-templates/' + id, data); },
    deleteEmailTemplate(id)         { return del('/email-templates/' + id); },

    broadcastNotification(data)     { return post('/notifications/broadcast', data); },

    getSystemPages()                { return api('/system-pages'); },
    createSystemPage(data)          { return post('/system-pages', data); },

    getEditorialTeam()              { return api('/editorial-team'); },
    getAuthors()                    { return api('/authors'); },
    getBooks()                      { return api('/books'); },
  };
})();
