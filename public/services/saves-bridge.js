/* ═══════════════════════════════════════════════════════════════
   DROBOARD SAVE BRIDGE (production)
   Defines window.DroboardSaveAPI over the live /api/saves endpoints so the
   save-modal component persists for real: getSaveState / toggleQuickSave /
   toggleCollection.
   save-modal checks for this global at call time; load order vs
   save-modal.js does not matter. Demo fallback stays inside save-modal.
   New collections are NOT created here — the sheet sends the reader to
   profile.html?tab=collections&create=1, and ProfileData owns that write.
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
    if (!res.ok) {
      const e = new Error((json && (json.error || json.message)) || ('Request failed (' + res.status + ')'));
      e.status = res.status;
      // A refused collection write says HOW MUCH more reading is required; the
      // sheet cannot show that number unless the fields survive the throw.
      if (json) {
        if (json.required != null) e.required = json.required;
        if (json.chaptersRead != null) e.chaptersRead = json.chaptersRead;
      }
      throw e;
    }
    return json;
  }

  window.DroboardSaveAPI = {
    getSaveState: (storyId) => req('GET', '/state?storyId=' + encodeURIComponent(storyId)),
    toggleQuickSave: (storyId, key, value) => req('POST', '/quick', { storyId, key, value }),
    toggleCollection: (storyId, collId, value) =>
      req('POST', '/collections/' + encodeURIComponent(collId) + '/toggle', { storyId, value }),
  };
})();
