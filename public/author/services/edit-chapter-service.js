/**
 * edit-chapter-service.js — Data layer for edit-chapter.html.
 * TODO backend: GET/PUT /api/author/books/:bookId/chapters/:num
 */
(function () {
  'use strict'; if (window.EditChapterService) return;
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author' };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  window.EditChapterService = {
    async get(bookId, num) {
      if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num); if (r.ok) return await r.json(); } catch (e) {} }
      await delay(); return { bookId: bookId, num: num, title: 'Chapter ' + num, content: '' };
    },
    async save(bookId, num, payload) {
      if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/chapters/' + num, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (r.ok) return await r.json(); } catch (e) {} }
      await delay(250); return { ok: true };
    }
  };
})();
