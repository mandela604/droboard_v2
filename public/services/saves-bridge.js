/* ═══════════════════════════════════════════════════════════════
   DROBOARD SAVE BRIDGE (production)
   Defines window.DroboardSaveAPI over the live /api/saves endpoints so the
   save-modal component persists for real: getSaveState / toggleQuickSave /
   toggleCollection / createCollection (with storyId, so a collection born
   from the save sheet already contains the story — matching demo).
   save-modal checks for this global at call time; load order vs
   save-modal.js does not matter. Demo fallback stays inside save-modal.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardSaveAPI) return;

  const API = '/api/saves';

  async function req(method, path, body) {
    const res = await fetch(API + path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) throw new Error((json && (json.error || json.message)) || ('Request failed (' + res.status + ')'));
    return json;
  }

  window.DroboardSaveAPI = {
    getSaveState: (storyId) => req('GET', '/state?storyId=' + encodeURIComponent(storyId)),
    toggleQuickSave: (storyId, key, value) => req('POST', '/quick', { storyId, key, value }),
    toggleCollection: (storyId, collId, value) =>
      req('POST', '/collections/' + encodeURIComponent(collId) + '/toggle', { storyId, value }),
    createCollection: (storyId, name, icon) => req('POST', '/collections', { name, icon, storyId }),
  };
})();
